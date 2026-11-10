//! Partners and issued invoices (step 5.3).
//!
//! - **Numbering (D-054):** each series has its next number in a record; the
//!   invoice and the series' new number are written in one atomic batch,
//!   checked against the series version, so two invoices can never get the
//!   same number and no number is skipped — also after a crash.
//! - **VAT (D-049):** per line, value = quantity × unit price rounded to the
//!   ban; VAT = value × rate / 100 rounded to the ban (half away from zero);
//!   the document totals are the sums of the lines.
//! - **Immutable (D-051):** an invoice is never edited or deleted. A storno
//!   invoice (next number of the same series, negative lines) cancels it;
//!   goods taken from stock come back through a stock storno in the same
//!   atomic write.
//! - **The invoice keeps a copy** of the client's and of the company's
//!   details as they were when it was issued.
//! - **Not certified accounting (D-052):** the VAT rates are settings the
//!   owner (or an accountant) confirms; e-Factura and SAF-T are not part of
//!   this step.

use std::collections::BTreeMap;

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use kgb_core::workspace::now_ms;
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::num::{self, Money, Qty};
use crate::{Business, PRODUCTS, bad, date, i, live, s, text};

pub(crate) const PARTNERS: &str = "parteneri";
pub(crate) const SETTINGS: &str = "setari";
pub(crate) const SERIES: &str = "serii";
pub(crate) const INVOICES: &str = "facturi";
const MAX_INVOICE_LINES: usize = 200;
/// Company fields printed on invoices (kept in this module's settings).
pub const COMPANY: [(&str, &str); 8] = [
    ("firma_nume", "Denumire"),
    ("firma_cui", "CUI"),
    ("firma_reg_com", "Nr. Registrul Comerțului"),
    ("firma_adresa", "Sediu"),
    ("firma_iban", "IBAN"),
    ("firma_banca", "Banca"),
    ("firma_capital", "Capital social"),
    ("firma_email", "E-mail"),
];
/// Default VAT rates (D-052): to be confirmed by the owner or an accountant.
pub const DEFAULT_RATES: [i64; 3] = [21, 11, 0];


/// Romanian CUI/CIF check digit: the app's one rule (kgb_core::ids, 7.4m-2).
pub use kgb_core::ids::cui_valid;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct PartnerSave {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: Option<u64>,
    nume: String,
    #[serde(default)]
    cui: Option<String>,
    #[serde(default)]
    reg_com: Option<String>,
    #[serde(default)]
    adresa: Option<String>,
    #[serde(default)]
    iban: Option<String>,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    telefon: Option<String>,
    #[serde(default = "both")]
    tip: String,
}

fn both() -> String {
    "ambele".into()
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct SettingsSave {
    #[serde(default)]
    version: Option<u64>,
    #[serde(default)]
    cote_tva: Option<Vec<i64>>,
    #[serde(default)]
    firma: BTreeMap<String, String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct SeriesSave {
    cod: String,
    /// The first number to use (default 1).
    #[serde(default)]
    primul_numar: Option<i64>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct InvoiceLine {
    #[serde(default)]
    produs: Option<Uuid>,
    #[serde(default)]
    descriere: Option<String>,
    #[serde(default)]
    um: Option<String>,
    cantitate: String,
    /// Price per unit without VAT, as typed.
    pret_unitar: String,
    cota_tva: i64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct InvoiceIssue {
    serie: Uuid,
    partener: Uuid,
    data: String,
    #[serde(default)]
    scadenta: Option<String>,
    /// When set, the lines with a product leave this warehouse.
    #[serde(default)]
    depozit: Option<Uuid>,
    #[serde(default)]
    nota: Option<String>,
    linii: Vec<InvoiceLine>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct InvoiceStorno {
    id: Uuid,
    data: String,
}

/// One computed line: value and VAT in bani.
pub fn line_amounts(q: Qty, unit_price: Money, rate: i64) -> (Money, Money) {
    let value = num::value(q, unit_price);
    let vat = num::div_round(value as i128 * rate as i128, 100) as Money;
    (value, vat)
}

impl Business {
    pub(crate) fn settings(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<(Option<RecordState>, Vec<i64>)> {
        let r = ctx.scan(SETTINGS, |_| true)?.into_iter().next();
        let rates = r
            .as_ref()
            .and_then(|r| r.fields.get("cote_tva"))
            .and_then(|v| serde_json::from_value::<Vec<i64>>(v.clone()).ok())
            .unwrap_or_else(|| DEFAULT_RATES.to_vec());
        Ok((r, rates))
    }

    pub(crate) fn settings_view(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let (r, rates) = self.settings(ctx)?;
        let firma: Vec<Value> = COMPANY
            .iter()
            .map(|(k, l)| json!({"camp": k, "eticheta": l, "valoare": r.as_ref().map(|r| s(r, k)).unwrap_or_default()}))
            .collect();
        Ok(
            json!({"cote_tva": rates, "firma": firma, "version": r.as_ref().map(|r| r.version), "confirmate": r.is_some()}),
        )
    }

    pub(crate) fn settings_save(&self, ctx: &mut ModuleContext<'_>, a: SettingsSave) -> CoreResult<Value> {
        let (cur, rates) = self.settings(ctx)?;
        let mut rates = a.cote_tva.unwrap_or(rates);
        rates.sort_unstable_by(|x, y| y.cmp(x));
        rates.dedup();
        if rates.is_empty() || rates.len() > 10 || rates.iter().any(|r| !(0..=100).contains(r)) {
            return Err(bad(
                "cotele de TVA",
                "trebuie să fie între 1 și 10 cote, fiecare între 0 și 100",
            ));
        }
        if let Some(k) = a.firma.keys().find(|k| !COMPANY.iter().any(|(f, _)| f == k)) {
            return Err(bad("datele firmei", format!("câmpul „{k}” nu există")));
        }
        let mut f = cur.as_ref().map(|r| r.fields.clone()).unwrap_or_default();
        f.insert("cote_tva".into(), json!(rates));
        for (k, _) in COMPANY {
            if let Some(v) = a.firma.get(k) {
                f.insert(k.into(), text(Some(v.clone()), k, 300, false)?);
            } else {
                f.entry(k.to_string()).or_insert(Value::Null);
            }
        }
        if let Some(c) = f.get("firma_cui").and_then(Value::as_str)
            && !cui_valid(c)
        {
            return Err(bad("CUI-ul firmei", format!("„{c}” nu are cifra de control corectă")));
        }
        f.insert("actualizat_ms".into(), json!(now_ms()));
        let w = match cur {
            Some(c) => Write::put(SETTINGS, c.id, f).expect(a.version.unwrap_or(c.version)),
            None => Write::put(SETTINGS, Uuid::now_v7(), f).expect(0),
        };
        ctx.write(vec![w])?;
        self.settings_view(ctx)
    }

    pub(crate) fn partner_save(&self, ctx: &mut ModuleContext<'_>, a: PartnerSave) -> CoreResult<Value> {
        if !["client", "furnizor", "ambele"].contains(&a.tip.as_str()) {
            return Err(bad(
                "tipul partenerului",
                format!("„{}” nu există (client, furnizor, ambele)", a.tip),
            ));
        }
        let cui = text(a.cui, "CUI-ul", 20, false)?;
        if let Some(c) = cui.as_str()
            && !cui_valid(c)
        {
            return Err(bad("CUI-ul", format!("„{c}” nu are cifra de control corectă")));
        }
        let mut f = Fields::new();
        f.insert("nume".into(), text(Some(a.nume), "numele partenerului", 200, true)?);
        f.insert("cui".into(), cui);
        f.insert(
            "reg_com".into(),
            text(a.reg_com, "nr. Registrul Comerțului", 40, false)?,
        );
        f.insert("adresa".into(), text(a.adresa, "adresa", 300, false)?);
        f.insert("iban".into(), text(a.iban, "IBAN-ul", 40, false)?);
        f.insert("email".into(), text(a.email, "e-mailul", 100, false)?);
        f.insert("telefon".into(), text(a.telefon, "telefonul", 40, false)?);
        f.insert("tip".into(), json!(a.tip));
        f.insert("activ".into(), json!(true));
        let (id, w) = match a.id {
            Some(id) => {
                let cur = live(ctx, PARTNERS, id, "partenerul")?;
                f.insert("creat_ms".into(), cur.fields["creat_ms"].clone());
                (id, Write::put(PARTNERS, id, f).expect(a.version.unwrap_or(cur.version)))
            }
            None => {
                f.insert("creat_ms".into(), json!(now_ms()));
                let id = Uuid::now_v7();
                (id, Write::put(PARTNERS, id, f).expect(0))
            }
        };
        ctx.write(vec![w])?;
        Ok(json!({"id": id}))
    }

    pub(crate) fn series_save(&self, ctx: &mut ModuleContext<'_>, a: SeriesSave) -> CoreResult<Value> {
        let cod = a.cod.trim().to_uppercase();
        if cod.is_empty() || cod.len() > 10 || !cod.chars().all(|c| c.is_ascii_alphanumeric()) {
            return Err(bad("seria", "are 1–10 litere sau cifre (de exemplu KGB)"));
        }
        if !ctx
            .scan(SERIES, |r| r.fields.get("cod") == Some(&json!(cod)))?
            .is_empty()
        {
            return Err(bad(
                "seria",
                format!("{cod} există deja; numerotarea unei serii nu se schimbă"),
            ));
        }
        let first = a.primul_numar.unwrap_or(1);
        if !(1..=99_999_999).contains(&first) {
            return Err(bad("primul număr", "trebuie să fie între 1 și 99.999.999"));
        }
        let mut f = Fields::new();
        f.insert("cod".into(), json!(cod));
        f.insert("urmator".into(), json!(first));
        f.insert("creat_ms".into(), json!(now_ms()));
        let id = Uuid::now_v7();
        ctx.write(vec![Write::put(SERIES, id, f).expect(0)])?;
        Ok(json!({"id": id}))
    }

    pub(crate) fn invoice_issue(&self, ctx: &mut ModuleContext<'_>, a: InvoiceIssue) -> CoreResult<Value> {
        let (settings, rates) = self.settings(ctx)?;
        let settings = settings.ok_or_else(|| {
            bad(
                "facturarea",
                "completează mai întâi datele firmei și confirmă cotele de TVA (fila „Setări”)",
            )
        })?;
        if s(&settings, "firma_nume").is_empty() || s(&settings, "firma_cui").is_empty() {
            return Err(bad("facturarea", "lipsesc denumirea sau CUI-ul firmei (fila „Setări”)"));
        }
        let series = live(ctx, SERIES, a.serie, "seria")?;
        let partner = live(ctx, PARTNERS, a.partener, "partenerul")?;
        let data = date(&a.data).ok_or_else(|| bad("data", format!("„{}” nu este o dată", a.data)))?;
        let due = match a.scadenta.as_deref().map(str::trim).filter(|t| !t.is_empty()) {
            None => Value::Null,
            Some(t) => {
                let d = date(t).ok_or_else(|| bad("scadența", format!("„{t}” nu este o dată")))?;
                if d < data {
                    return Err(bad("scadența", "nu poate fi înaintea datei facturii"));
                }
                json!(d)
            }
        };
        if a.linii.is_empty() || a.linii.len() > MAX_INVOICE_LINES {
            return Err(bad("factura", format!("are nevoie de 1–{MAX_INVOICE_LINES} linii")));
        }
        let mut lines = Vec::new();
        let mut stock_lines: Vec<(RecordState, Qty)> = Vec::new();
        let mut errs = Vec::new();
        let (mut net, mut vat) = (0_i64, 0_i64);
        for (n, l) in a.linii.iter().enumerate() {
            let label = format!("linia {}", n + 1);
            let product = match l.produs {
                Some(p) => Some(live(ctx, PRODUCTS, p, "produsul")?),
                None => None,
            };
            let desc = l
                .descriere
                .clone()
                .filter(|d| !d.trim().is_empty())
                .or_else(|| product.as_ref().map(|p| s(p, "nume")))
                .unwrap_or_default();
            let um =
                l.um.clone()
                    .filter(|u| !u.trim().is_empty())
                    .or_else(|| product.as_ref().map(|p| s(p, "um")))
                    .unwrap_or_else(|| "buc".into());
            if desc.trim().is_empty() || desc.chars().count() > 300 {
                errs.push(format!("{label}: descrierea are 1–300 de caractere"));
                continue;
            }
            let q = match num::qty(&l.cantitate) {
                Some(q) if q > 0 => q,
                _ => {
                    errs.push(format!("{label}: cantitatea „{}” nu e un număr pozitiv", l.cantitate));
                    continue;
                }
            };
            let price = match num::money(&l.pret_unitar) {
                Some(p) if p >= 0 => p,
                _ => {
                    errs.push(format!("{label}: prețul „{}” nu e valid", l.pret_unitar));
                    continue;
                }
            };
            if !rates.contains(&l.cota_tva) {
                errs.push(format!("{label}: cota de TVA {}% nu e în lista din setări", l.cota_tva));
                continue;
            }
            let (value, tva) = line_amounts(q, price, l.cota_tva);
            net += value;
            vat += tva;
            if let (Some(p), Some(_)) = (&product, a.depozit) {
                stock_lines.push((p.clone(), q));
            }
            lines.push(json!({
                "produs": product.as_ref().map(|p| p.id), "descriere": desc.trim(), "um": um.trim(),
                "cantitate": q, "pret_unitar": price, "cota_tva": l.cota_tva, "valoare": value, "tva": tva,
            }));
        }
        if !errs.is_empty() {
            return Err(bad("factura", errs.join("; ")));
        }
        let number = i(&series, "urmator");
        let numar_text = format!("{} {number}", s(&series, "cod"));
        let mut batch = Vec::new();
        let stock_doc = match a.depozit {
            Some(dep) if !stock_lines.is_empty() => {
                let (doc, writes) = self.issue_writes(
                    ctx,
                    dep,
                    &format!("Factura {numar_text}"),
                    &data,
                    json!(s(&partner, "nume")),
                    &stock_lines,
                )?;
                batch.extend(writes);
                Some(doc)
            }
            _ => None,
        };
        let mut sf = series.fields.clone();
        sf.insert("urmator".into(), json!(number + 1));
        batch.push(Write::put(SERIES, series.id, sf).expect(series.version));
        let id = Uuid::now_v7();
        let mut f = Fields::new();
        f.insert("serie".into(), json!(s(&series, "cod")));
        f.insert("numar".into(), json!(number));
        f.insert("data".into(), json!(data));
        f.insert("scadenta".into(), due);
        f.insert("partener".into(), json!(partner.id.to_string()));
        f.insert(
            "client".into(),
            json!({"nume": s(&partner, "nume"), "cui": s(&partner, "cui"), "reg_com": s(&partner, "reg_com"), "adresa": s(&partner, "adresa")}),
        );
        f.insert(
            "furnizor".into(),
            json!(
                COMPANY
                    .iter()
                    .map(|(k, _)| (k.to_string(), json!(s(&settings, k))))
                    .collect::<serde_json::Map<_, _>>()
            ),
        );
        f.insert(
            "depozit".into(),
            a.depozit.map_or(Value::Null, |d| json!(d.to_string())),
        );
        f.insert(
            "document_stoc".into(),
            stock_doc.map_or(Value::Null, |d| json!(d.to_string())),
        );
        f.insert("linii".into(), json!(lines));
        f.insert("total_fara_tva".into(), json!(net));
        f.insert("total_tva".into(), json!(vat));
        f.insert("total".into(), json!(net + vat));
        f.insert("storno_de".into(), Value::Null);
        f.insert("nota".into(), text(a.nota, "nota", 500, false)?);
        f.insert("creat_ms".into(), json!(now_ms()));
        batch.push(Write::put(INVOICES, id, f).expect(0));
        ctx.write(batch)?;
        ctx.log("factură emisă");
        Ok(json!({"id": id, "numar": numar_text, "total": net + vat, "total_text": num::fmt_money(net + vat)}))
    }

    pub(crate) fn invoice_storno(&self, ctx: &mut ModuleContext<'_>, a: InvoiceStorno) -> CoreResult<Value> {
        let inv = live(ctx, INVOICES, a.id, "factura")?;
        if inv.fields.get("storno_de").is_some_and(|v| !v.is_null()) {
            return Err(bad("factura", "o factură de stornare nu se stornează"));
        }
        let idv = json!(a.id.to_string());
        if !ctx
            .scan(INVOICES, |r| r.fields.get("storno_de") == Some(&idv))?
            .is_empty()
        {
            return Err(bad("factura", "a fost deja stornată"));
        }
        let data = date(&a.data).ok_or_else(|| bad("data", format!("„{}” nu este o dată", a.data)))?;
        if data < s(&inv, "data") {
            return Err(bad("data", "stornarea nu poate fi înaintea facturii"));
        }
        let code = s(&inv, "serie");
        let series = ctx
            .scan(SERIES, |r| r.fields.get("cod") == Some(&json!(code)))?
            .into_iter()
            .next()
            .ok_or_else(|| bad("seria", "nu mai există"))?;
        let number = i(&series, "urmator");
        let mut batch = Vec::new();
        let stock_doc = match inv
            .fields
            .get("document_stoc")
            .and_then(Value::as_str)
            .and_then(|x| x.parse().ok())
        {
            Some(doc) => {
                let (sd, writes) = self.storno_writes(
                    ctx,
                    doc,
                    &data,
                    json!(format!("Storno factura {code} {}", i(&inv, "numar"))),
                )?;
                batch.extend(writes);
                Some(sd)
            }
            None => None,
        };
        let mut sf = series.fields.clone();
        sf.insert("urmator".into(), json!(number + 1));
        batch.push(Write::put(SERIES, series.id, sf).expect(series.version));
        let neg = |v: &Value| json!(-v.as_i64().unwrap_or_default());
        let lines: Vec<Value> = inv.fields["linii"]
            .as_array()
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .map(|mut l| {
                l["cantitate"] = neg(&l["cantitate"]);
                l["valoare"] = neg(&l["valoare"]);
                l["tva"] = neg(&l["tva"]);
                l
            })
            .collect();
        let mut f = inv.fields.clone();
        f.insert("numar".into(), json!(number));
        f.insert("data".into(), json!(data));
        f.insert("scadenta".into(), Value::Null);
        f.insert("linii".into(), json!(lines));
        f.insert(
            "document_stoc".into(),
            stock_doc.map_or(Value::Null, |d| json!(d.to_string())),
        );
        for k in ["total_fara_tva", "total_tva", "total"] {
            f.insert(k.into(), neg(&inv.fields[k]));
        }
        f.insert("storno_de".into(), idv);
        f.insert(
            "nota".into(),
            json!(format!("Stornează factura {code} {}", i(&inv, "numar"))),
        );
        f.insert("creat_ms".into(), json!(now_ms()));
        let id = Uuid::now_v7();
        batch.push(Write::put(INVOICES, id, f).expect(0));
        ctx.write(batch)?;
        ctx.log("factură stornată");
        Ok(json!({"id": id, "numar": format!("{code} {number}")}))
    }

    pub(crate) fn invoices(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let all = ctx.scan(INVOICES, |_| true)?;
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
                v["numar_text"] = json!(format!("{} {}", s(r, "serie"), i(r, "numar")));
                v["total_text"] = json!(num::fmt_money(i(r, "total")));
                v["stornata"] = json!(reversed.contains(&r.id.to_string()));
                v
            })
            .collect();
        list.sort_by(|a, b| b["id"].as_str().cmp(&a["id"].as_str()));
        Ok(json!(list))
    }

    /// The invoice as PDF (Typst, D-045), checked by reading it back.
    pub(crate) fn invoice_pdf(&self, ctx: &mut ModuleContext<'_>, id: Uuid) -> CoreResult<Vec<u8>> {
        let inv = live(ctx, INVOICES, id, "factura")?;
        let mut v = BTreeMap::new();
        let numar = format!("{} {}", s(&inv, "serie"), i(&inv, "numar"));
        let ro = |iso: &str| iso.split('-').rev().collect::<Vec<_>>().join(".");
        v.insert("numar".to_string(), numar.clone());
        v.insert("data".into(), ro(&s(&inv, "data")));
        v.insert(
            "scadenta".into(),
            inv.fields
                .get("scadenta")
                .and_then(Value::as_str)
                .map(ro)
                .unwrap_or_default(),
        );
        for (k, _) in COMPANY {
            v.insert(
                k.into(),
                inv.fields["furnizor"][k].as_str().unwrap_or_default().to_string(),
            );
        }
        for k in ["nume", "cui", "reg_com", "adresa"] {
            v.insert(
                format!("client_{k}"),
                inv.fields["client"][k].as_str().unwrap_or_default().to_string(),
            );
        }
        let lines: Vec<Value> = inv.fields["linii"]
            .as_array()
            .cloned()
            .unwrap_or_default()
            .iter()
            .map(|l| {
                json!([
                    l["descriere"],
                    l["um"],
                    num::fmt_qty(l["cantitate"].as_i64().unwrap_or_default()),
                    num::fmt_money(l["pret_unitar"].as_i64().unwrap_or_default()),
                    format!("{}%", l["cota_tva"].as_i64().unwrap_or_default()),
                    num::fmt_money(l["valoare"].as_i64().unwrap_or_default()),
                    num::fmt_money(l["tva"].as_i64().unwrap_or_default()),
                ])
            })
            .collect();
        v.insert("linii".into(), serde_json::to_string(&lines).unwrap_or_default());
        v.insert("total_fara_tva".into(), num::fmt_money(i(&inv, "total_fara_tva")));
        v.insert("total_tva".into(), num::fmt_money(i(&inv, "total_tva")));
        v.insert("total".into(), num::fmt_money(i(&inv, "total")));
        v.insert(
            "titlu".into(),
            if inv.fields.get("storno_de").is_some_and(|x| !x.is_null()) {
                "FACTURĂ (STORNARE)"
            } else {
                "FACTURĂ"
            }
            .into(),
        );
        v.insert("nota".into(), s(&inv, "nota"));
        let pdf =
            kgb_docs::pdf::render(include_str!("../models/factura.typ"), &v).map_err(|e| bad("PDF-ul facturii", e))?;
        let text: String = kgb_docs::pdf::text(&pdf)
            .map_err(|e| bad("PDF-ul facturii", e))?
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        for want in [&numar, &v["total"], &v["client_nume"]] {
            if !want.split_whitespace().all(|w| text.contains(w)) {
                return Err(bad(
                    "PDF-ul facturii",
                    format!("verificarea a eșuat: „{want}” nu apare"),
                ));
            }
        }
        Ok(pdf)
    }
}
