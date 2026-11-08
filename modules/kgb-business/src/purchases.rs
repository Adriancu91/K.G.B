//! Received invoices and expenses (step 5.4).
//!
//! - Typed by hand, or **taken over from the „Extragere date” register**
//!   through its CSV export (the modules never read each other's data; the
//!   user exports there and imports here).
//! - **The same document is not recorded twice:** same supplier (CUI, or
//!   name when there is no CUI) and same number → refused, unless the user
//!   says it is intended.
//! - **Totals are checked:** total = net + VAT, to the ban; a mismatch is
//!   refused, not „corrected”.
//! - **Immutable (D-051):** a mistake is cancelled by a storno record with
//!   the opposite amounts, which stays visible.

use std::collections::BTreeMap;

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use kgb_core::workspace::now_ms;
use kgb_sheets::book::{self, Format};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::invoices::{PARTNERS, cui_valid};
use crate::num::{self, Money};
use crate::{Business, bad, date, i, live, s, text};

pub(crate) const PURCHASES: &str = "cheltuieli";
pub const KINDS: [(&str, &str); 3] = [("factura", "Factură"), ("bon", "Bon fiscal"), ("alt", "Alt document")];

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct PurchaseSave {
    furnizor: Uuid,
    #[serde(default = "invoice")]
    tip: String,
    numar: String,
    data: String,
    #[serde(default)]
    scadenta: Option<String>,
    #[serde(default)]
    categorie: Option<String>,
    /// As typed: `1.234,56`.
    #[serde(default)]
    total_fara_tva: Option<String>,
    #[serde(default)]
    tva: Option<String>,
    total: String,
    #[serde(default)]
    nota: Option<String>,
    #[serde(default)]
    permite_duplicat: bool,
}

fn invoice() -> String {
    "factura".into()
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct PurchaseStorno {
    id: Uuid,
    data: String,
}

/// Same document: same supplier key and same number (case and spaces ignored).
fn doc_key(supplier_cui: &str, supplier_name: &str, number: &str) -> String {
    let who = if supplier_cui.is_empty() {
        supplier_name.trim().to_lowercase()
    } else {
        supplier_cui.trim().to_uppercase().trim_start_matches("RO").to_string()
    };
    format!("{who}|{}", number.split_whitespace().collect::<String>().to_lowercase())
}

/// Checked amounts: (net, vat, total). Net and VAT are optional (a receipt
/// may show only the total); when both are given, total = net + VAT.
fn amounts(net: Option<&str>, vat: Option<&str>, total: &str) -> Result<(Option<Money>, Option<Money>, Money), String> {
    let parse = |label: &str, v: &str| num::money(v).ok_or_else(|| format!("{label}: „{v}” nu este o sumă"));
    let opt = |label: &str, v: Option<&str>| match v.map(str::trim).filter(|x| !x.is_empty()) {
        None => Ok(None),
        Some(x) => parse(label, x).map(Some),
    };
    let net = opt("totalul fără TVA", net)?;
    let vat = opt("TVA-ul", vat)?;
    let total = parse("totalul", total.trim())?;
    if let (Some(n), Some(v)) = (net, vat)
        && n + v != total
    {
        return Err(format!(
            "totalul {} nu este egal cu {} + {} TVA",
            num::fmt_money(total),
            num::fmt_money(n),
            num::fmt_money(v)
        ));
    }
    Ok((net, vat, total))
}

/// The supplier as recorded on the document.
#[derive(Clone)]
struct Supplier {
    id: Uuid,
    nume: String,
    cui: String,
}

impl Supplier {
    fn of(r: &RecordState) -> Supplier {
        Supplier {
            id: r.id,
            nume: s(r, "nume"),
            cui: s(r, "cui"),
        }
    }
}

impl Business {
    fn purchase_record(
        &self,
        ctx: &mut ModuleContext<'_>,
        supplier: &Supplier,
        a: PurchaseSave,
        source: &str,
    ) -> CoreResult<(Uuid, Fields)> {
        if !KINDS.iter().any(|(k, _)| *k == a.tip) {
            return Err(bad(
                "tipul documentului",
                format!("„{}” nu există (factura, bon, alt)", a.tip),
            ));
        }
        let numar = text(Some(a.numar), "numărul documentului", 60, true)?;
        let data = date(&a.data).ok_or_else(|| bad("data", format!("„{}” nu este o dată", a.data)))?;
        let due = match a.scadenta.as_deref().map(str::trim).filter(|t| !t.is_empty()) {
            None => Value::Null,
            Some(t) => json!(date(t).ok_or_else(|| bad("scadența", format!("„{t}” nu este o dată")))?),
        };
        let (net, vat, total) =
            amounts(a.total_fara_tva.as_deref(), a.tva.as_deref(), &a.total).map_err(|e| bad("sumele", e))?;
        if total <= 0 {
            return Err(bad(
                "totalul",
                "trebuie să fie mai mare decât 0 (o corectură se face prin storno)",
            ));
        }
        let key = doc_key(&supplier.cui, &supplier.nume, numar.as_str().unwrap_or_default());
        if !a.permite_duplicat {
            let kv = json!(key);
            if !ctx
                .scan(PURCHASES, |r| {
                    r.fields.get("cheie") == Some(&kv) && r.fields.get("storno_de").is_none_or(Value::is_null)
                })?
                .is_empty()
            {
                return Err(bad(
                    "documentul",
                    format!(
                        "{} {} de la {} este deja înregistrat",
                        a.tip,
                        numar.as_str().unwrap_or_default(),
                        supplier.nume
                    ),
                ));
            }
        }
        let mut f = Fields::new();
        f.insert("tip".into(), json!(a.tip));
        f.insert("furnizor".into(), json!(supplier.id.to_string()));
        f.insert("furnizor_nume".into(), json!(supplier.nume));
        f.insert("furnizor_cui".into(), json!(supplier.cui));
        f.insert("numar".into(), numar);
        f.insert("cheie".into(), json!(key));
        f.insert("data".into(), json!(data));
        f.insert("scadenta".into(), due);
        f.insert("categorie".into(), text(a.categorie, "categoria", 100, false)?);
        f.insert("total_fara_tva".into(), net.map_or(Value::Null, |v| json!(v)));
        f.insert("tva".into(), vat.map_or(Value::Null, |v| json!(v)));
        f.insert("total".into(), json!(total));
        f.insert("sursa".into(), json!(source));
        f.insert("storno_de".into(), Value::Null);
        f.insert("nota".into(), text(a.nota, "nota", 500, false)?);
        f.insert("creat_ms".into(), json!(now_ms()));
        Ok((Uuid::now_v7(), f))
    }

    pub(crate) fn purchase_save(&self, ctx: &mut ModuleContext<'_>, a: PurchaseSave) -> CoreResult<Value> {
        let supplier = Supplier::of(&live(ctx, PARTNERS, a.furnizor, "furnizorul")?);
        let (id, f) = self.purchase_record(ctx, &supplier, a, "manual")?;
        ctx.write(vec![Write::put(PURCHASES, id, f).expect(0)])?;
        Ok(json!({"id": id}))
    }

    pub(crate) fn purchase_storno(&self, ctx: &mut ModuleContext<'_>, a: PurchaseStorno) -> CoreResult<Value> {
        let p = live(ctx, PURCHASES, a.id, "documentul")?;
        if p.fields.get("storno_de").is_some_and(|v| !v.is_null()) {
            return Err(bad("documentul", "un storno nu se stornează"));
        }
        let idv = json!(a.id.to_string());
        if !ctx
            .scan(PURCHASES, |r| r.fields.get("storno_de") == Some(&idv))?
            .is_empty()
        {
            return Err(bad("documentul", "a fost deja stornat"));
        }
        let data = date(&a.data).ok_or_else(|| bad("data", format!("„{}” nu este o dată", a.data)))?;
        let mut f = p.fields.clone();
        for k in ["total_fara_tva", "tva", "total"] {
            if let Some(v) = p.fields.get(k).and_then(Value::as_i64) {
                f.insert(k.into(), json!(-v));
            }
        }
        f.insert("data".into(), json!(data));
        f.insert("scadenta".into(), Value::Null);
        f.insert("storno_de".into(), idv);
        f.insert(
            "nota".into(),
            json!(format!("Storno {} {}", s(&p, "tip"), s(&p, "numar"))),
        );
        f.insert("creat_ms".into(), json!(now_ms()));
        let id = Uuid::now_v7();
        ctx.write(vec![Write::put(PURCHASES, id, f).expect(0)])?;
        Ok(json!({"id": id}))
    }

    pub(crate) fn purchases(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let all = ctx.scan(PURCHASES, |_| true)?;
        let reversed: std::collections::BTreeSet<String> = all
            .iter()
            .map(|r| s(r, "storno_de"))
            .filter(|x| !x.is_empty())
            .collect();
        let mut list: Vec<Value> = all
            .iter()
            .map(|r| {
                let mut v = Value::Object(r.fields.clone());
                v["id"] = json!(r.id);
                v["total_text"] = json!(num::fmt_money(i(r, "total")));
                v["stornat"] = json!(reversed.contains(&r.id.to_string()));
                v
            })
            .collect();
        list.sort_by(|a, b| b["id"].as_str().cmp(&a["id"].as_str()));
        Ok(json!(list))
    }

    /// Takes over the CSV exported by „Extragere date” (either CSV style).
    /// Valid rows are recorded together in one atomic write; duplicates are
    /// skipped and listed; any other problem refuses the whole file, so a
    /// half-imported file never happens.
    pub(crate) fn import_extract(&self, ctx: &mut ModuleContext<'_>, name: &str, data: &[u8]) -> CoreResult<Value> {
        if !name.to_lowercase().ends_with(".csv") {
            return Err(bad(
                "importul",
                "se importă fișierul CSV exportat din „Extragere date” (Registru → Exportă CSV)",
            ));
        }
        let b = book::read(data, Format::Csv).map_err(|e| bad("fișierul CSV", e))?;
        let sheet = b.sheets.first().ok_or_else(|| bad("fișierul CSV", "este gol"))?;
        let (h, w) = sheet.size();
        let cell = |r: u32, c: u32| {
            sheet
                .values
                .get_value((r, c))
                .and_then(book::show)
                .map(|x| x.0)
                .unwrap_or_default()
        };
        let fold = |x: &str| x.trim().trim_start_matches('\u{feff}').to_lowercase();
        let header: BTreeMap<String, u32> = (0..w).map(|c| (fold(&cell(0, c)), c)).collect();
        let col = |label: &str| header.get(&fold(label)).copied();
        let need = ["Număr factură", "Data emiterii", "Furnizor", "Total de plată"];
        if let Some(missing) = need.iter().find(|l| col(l).is_none()) {
            return Err(bad(
                "fișierul CSV",
                format!("lipsește coloana „{missing}”; folosește exportul din „Extragere date”"),
            ));
        }
        let get = |r: u32, label: &str| col(label).map(|c| cell(r, c)).unwrap_or_default();
        let mut partners: Vec<Supplier> = ctx.scan(PARTNERS, |_| true)?.iter().map(Supplier::of).collect();
        let mut batch = Vec::new();
        let (mut done, mut dups, mut errs) = (Vec::new(), Vec::new(), Vec::new());
        let mut seen_keys = std::collections::BTreeSet::new();
        for r in 1..h {
            let numar = get(r, "Număr factură");
            let furnizor = get(r, "Furnizor");
            if numar.trim().is_empty() && furnizor.trim().is_empty() {
                continue;
            }
            let cui = get(r, "CUI furnizor").trim().to_uppercase();
            if !cui.is_empty() && !cui_valid(&cui) {
                errs.push(format!(
                    "rândul {}: CUI-ul „{cui}” nu are cifra de control corectă",
                    r + 1
                ));
                continue;
            }
            // The supplier: by CUI, else by name; created when missing.
            let found = partners
                .iter()
                .find(|p| {
                    let pc = p.cui.to_uppercase();
                    if !cui.is_empty() && !pc.is_empty() {
                        pc.trim_start_matches("RO") == cui.trim_start_matches("RO")
                    } else {
                        p.nume.trim().eq_ignore_ascii_case(furnizor.trim())
                    }
                })
                .cloned();
            let supplier = match found {
                Some(p) => p,
                None => {
                    let mut f = Fields::new();
                    f.insert("nume".into(), text(Some(furnizor.clone()), "furnizorul", 200, true)?);
                    f.insert("cui".into(), if cui.is_empty() { Value::Null } else { json!(cui) });
                    for k in ["reg_com", "adresa", "iban", "email", "telefon"] {
                        f.insert(k.into(), Value::Null);
                    }
                    f.insert("tip".into(), json!("furnizor"));
                    f.insert("activ".into(), json!(true));
                    f.insert("creat_ms".into(), json!(now_ms()));
                    let id = Uuid::now_v7();
                    batch.push(Write::put(PARTNERS, id, f).expect(0));
                    let rec = Supplier {
                        id,
                        nume: furnizor.trim().to_string(),
                        cui: cui.clone(),
                    };
                    partners.push(rec.clone());
                    rec
                }
            };
            let save = PurchaseSave {
                furnizor: supplier.id,
                tip: "factura".into(),
                numar: numar.clone(),
                data: get(r, "Data emiterii"),
                scadenta: Some(get(r, "Scadența")),
                categorie: None,
                total_fara_tva: Some(get(r, "Total fără TVA")),
                tva: Some(get(r, "TVA")),
                total: get(r, "Total de plată"),
                nota: Some("preluat din Extragere date".into()),
                permite_duplicat: false,
            };
            let key = doc_key(&supplier.cui, &supplier.nume, &numar);
            if !seen_keys.insert(key) {
                dups.push(format!("{numar} ({furnizor})"));
                continue;
            }
            match self.purchase_record(ctx, &supplier, save, "extragere") {
                Ok((id, f)) => {
                    batch.push(Write::put(PURCHASES, id, f).expect(0));
                    done.push(numar);
                }
                Err(e) if e.to_string().contains("deja înregistrat") => dups.push(format!("{numar} ({furnizor})")),
                Err(e) => errs.push(format!("rândul {}: {e}", r + 1)),
            }
        }
        if !errs.is_empty() {
            return Err(bad(
                "importul",
                format!("nimic nu a fost importat; {}", errs.join("; ")),
            ));
        }
        if !batch.is_empty() {
            ctx.write(batch)?;
        }
        Ok(json!({"importate": done.len(), "duplicate": dups}))
    }
}
