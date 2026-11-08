//! `kgb.business` — primary business records (Etapa 5; Master Plan §6.7).
//! Step 5.1: products, warehouses, receipts and issues, stock per warehouse,
//! minimum-stock reminders. Step 5.2: transfers between warehouses,
//! inventory counts, stock value at weighted average cost (D-050). Step 5.3:
//! partners, VAT settings, invoice series, issued invoices, storno, PDF.
//!
//! Rules (docs/ETAPA5_PLAN.md):
//! - **Exact numbers (D-049):** quantities in thousandths and money in bani,
//!   as integers; see [`num`].
//! - **Nothing recorded changes (D-051):** a stock document and its movements
//!   are written once, in one atomic batch, and never edited or deleted. A
//!   mistake is undone by a storno document with the opposite movements,
//!   which stays visible; a document can be reversed only once.
//! - **Stock is the sum of the movements**, never a stored number that could
//!   drift; an issue (or a storno of a receipt) that would take the stock
//!   below zero is refused.
//! - **Not certified accounting (D-052):** the UI says so on every screen.
//!
//! Commands: `products`, `product_save`, `warehouses`, `warehouse_save`,
//! `receive`, `issue`, `transfer`, `inventory`, `storno`, `documents`,
//! `stock`, `movements`; `partners`, `partner_save`, `settings`,
//! `settings_save`, `series`, `series_save`, `invoice_issue`, `invoices`,
//! `invoice_storno`, `invoice_pdf`; `purchases`, `purchase_save`,
//! `purchase_storno`, `import` (CSV from „Extragere date”); `accounts`,
//! `account_save`, `payments`, `payment_save`, `payment_link`, `payment_storno`,
//! `open_documents`, `settle`, `bank_import`; `aging`, `partner_sheet`.

pub mod aging;
pub mod cash;
pub mod invoices;
pub mod num;
pub mod purchases;
pub mod valuation;

use std::collections::{BTreeMap, BTreeSet};

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::notifications::{Level, Notice};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

use num::{Money, Qty};

pub const ID: &str = "kgb.business";
pub(crate) const PRODUCTS: &str = "produse";
const WAREHOUSES: &str = "depozite";
const DOCS: &str = "documente_stoc";
const MOVES: &str = "miscari";
const MAX_LINES: usize = 500;

pub struct Business {
    manifest: Manifest,
}

impl Business {
    pub fn new() -> Business {
        Business {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Business {
    fn default() -> Self {
        Self::new()
    }
}

pub(crate) fn bad(what: &str, detail: impl Into<String>) -> CoreError {
    CoreError::invalid(what, detail)
}

fn args<T: DeserializeOwned>(v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid("argumentele comenzii", e.to_string()))
}

pub(crate) fn s(r: &RecordState, k: &str) -> String {
    r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}

pub(crate) fn i(r: &RecordState, k: &str) -> i64 {
    r.fields.get(k).and_then(Value::as_i64).unwrap_or_default()
}

pub(crate) fn text(v: Option<String>, what: &str, max: usize, required: bool) -> CoreResult<Value> {
    let t = v.map(|s| s.trim().to_string()).unwrap_or_default();
    if t.is_empty() {
        return if required {
            Err(bad(what, "nu poate fi gol"))
        } else {
            Ok(Value::Null)
        };
    }
    if t.chars().count() > max {
        return Err(bad(what, format!("are mai mult de {max} de caractere")));
    }
    Ok(json!(t))
}

/// `YYYY-MM-DD` or `dd.mm.yyyy` → `YYYY-MM-DD` (real dates only).
pub fn date(s: &str) -> Option<String> {
    let s = s.trim();
    let (y, m, d) = if let Some((d, rest)) = s.split_once('.') {
        let (m, y) = rest.split_once('.')?;
        (y, m, d)
    } else {
        let mut p = s.split('-');
        (p.next()?, p.next()?, p.next()?)
    };
    let (y, m, d): (i32, u32, u32) = (y.parse().ok()?, m.parse().ok()?, d.parse().ok()?);
    let dim = match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 => 29,
        2 => 28,
        _ => return None,
    };
    ((1990..=2200).contains(&y) && (1..=dim).contains(&d)).then(|| format!("{y:04}-{m:02}-{d:02}"))
}

pub(crate) fn live(ctx: &mut ModuleContext<'_>, coll: &str, id: Uuid, what: &str) -> CoreResult<RecordState> {
    ctx.get(coll, id)?
        .filter(|r| !r.deleted)
        .ok_or_else(|| bad(what, "nu există"))
}

/// Accepts a number as JSON number (already in the unit's smallest part) or
/// as text typed by the user (`1,5`).
#[derive(Deserialize)]
#[serde(untagged)]
enum Amount {
    Text(String),
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ProductSave {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: Option<u64>,
    cod: String,
    nume: String,
    um: String,
    #[serde(default)]
    categorie: Option<String>,
    #[serde(default)]
    cod_bare: Option<String>,
    /// As typed (`10`, `2,5`); empty = no minimum.
    #[serde(default)]
    stoc_minim: Option<String>,
    #[serde(default = "yes")]
    activ: bool,
}

fn yes() -> bool {
    true
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WarehouseSave {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: Option<u64>,
    nume: String,
    #[serde(default = "yes")]
    activ: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Line {
    produs: Uuid,
    cantitate: Amount,
    /// Receipts: price per unit, as typed (`12,50`).
    #[serde(default)]
    pret_unitar: Option<Amount>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StockDoc {
    depozit: Uuid,
    numar: String,
    data: String,
    #[serde(default)]
    partener: Option<String>,
    #[serde(default)]
    nota: Option<String>,
    linii: Vec<Line>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Transfer {
    depozit: Uuid,
    depozit_destinatie: Uuid,
    numar: String,
    data: String,
    #[serde(default)]
    nota: Option<String>,
    linii: Vec<Line>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CountLine {
    produs: Uuid,
    /// The quantity counted, as typed.
    cantitate_numarata: Amount,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Inventory {
    depozit: Uuid,
    numar: String,
    data: String,
    #[serde(default)]
    nota: Option<String>,
    linii: Vec<CountLine>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Storno {
    document: Uuid,
    data: String,
    #[serde(default)]
    nota: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Today {
    azi: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ById {
    id: Uuid,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct FromDialog {
    name: String,
    data: String,
}

fn base64_decode(data: &str) -> CoreResult<Vec<u8>> {
    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD
        .decode(data.as_bytes())
        .map_err(|_| bad("fișierul", "conținutul nu este valid (base64)"))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct InvoicePdf {
    id: Uuid,
    dest: std::path::PathBuf,
}

#[derive(Deserialize, Default)]
#[serde(deny_unknown_fields)]
struct StockFilter {
    #[serde(default)]
    depozit: Option<Uuid>,
    #[serde(default)]
    produs: Option<Uuid>,
}

fn amount(a: &Amount, parse: fn(&str) -> Option<i64>, what: &str) -> CoreResult<i64> {
    match a {
        Amount::Text(t) => parse(t).ok_or_else(|| bad(what, format!("„{t}” nu este un număr valid"))),
    }
}

impl Business {
    /// Stock per (product, warehouse), from the movements.
    fn balances(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<BTreeMap<(String, String), Qty>> {
        let mut out: BTreeMap<(String, String), Qty> = BTreeMap::new();
        for m in ctx.scan(MOVES, |_| true)? {
            *out.entry((s(&m, "produs"), s(&m, "depozit"))).or_default() += i(&m, "cantitate");
        }
        Ok(out)
    }

    fn product_save(&self, ctx: &mut ModuleContext<'_>, a: ProductSave) -> CoreResult<Value> {
        let cod = text(Some(a.cod), "codul produsului", 40, true)?;
        let others = ctx.scan(PRODUCTS, |r| r.fields.get("cod") == Some(&cod) && Some(r.id) != a.id)?;
        if !others.is_empty() {
            return Err(bad("codul produsului", format!("{cod} este deja folosit")));
        }
        let min = match a.stoc_minim.as_deref().map(str::trim).filter(|t| !t.is_empty()) {
            None => Value::Null,
            Some(t) => {
                let q = num::qty(t).ok_or_else(|| bad("stocul minim", format!("„{t}” nu este un număr valid")))?;
                if q < 0 {
                    return Err(bad("stocul minim", "nu poate fi negativ"));
                }
                json!(q)
            }
        };
        let mut f = Fields::new();
        f.insert("cod".into(), cod);
        f.insert("nume".into(), text(Some(a.nume), "numele produsului", 200, true)?);
        f.insert("um".into(), text(Some(a.um), "unitatea de măsură", 10, true)?);
        f.insert("categorie".into(), text(a.categorie, "categoria", 100, false)?);
        f.insert("cod_bare".into(), text(a.cod_bare, "codul de bare", 40, false)?);
        f.insert("stoc_minim".into(), min);
        f.insert("activ".into(), json!(a.activ));
        let (id, w) = match a.id {
            Some(id) => {
                let cur = live(ctx, PRODUCTS, id, "produsul")?;
                f.insert("creat_ms".into(), cur.fields["creat_ms"].clone());
                (id, Write::put(PRODUCTS, id, f).expect(a.version.unwrap_or(cur.version)))
            }
            None => {
                f.insert("creat_ms".into(), json!(now_ms()));
                let id = Uuid::now_v7();
                (id, Write::put(PRODUCTS, id, f).expect(0))
            }
        };
        ctx.write(vec![w])?;
        Ok(json!({"id": id}))
    }

    /// Receipts (+) and issues (−): one document and its movements, in one
    /// atomic write. Issues are checked against the stock of every line.
    fn stock_doc(&self, ctx: &mut ModuleContext<'_>, a: StockDoc, kind: &str) -> CoreResult<Value> {
        let wh = live(ctx, WAREHOUSES, a.depozit, "depozitul")?;
        if wh.fields.get("activ") == Some(&json!(false)) {
            return Err(bad("depozitul", "este inactiv"));
        }
        let data = date(&a.data).ok_or_else(|| bad("data", format!("„{}” nu este o dată", a.data)))?;
        if a.linii.is_empty() || a.linii.len() > MAX_LINES {
            return Err(bad("documentul", format!("are nevoie de 1–{MAX_LINES} linii")));
        }
        let numar = text(Some(a.numar), "numărul documentului", 40, true)?;
        let mut lines = Vec::new();
        let mut need: BTreeMap<String, Qty> = BTreeMap::new();
        let mut errs = Vec::new();
        for (n, l) in a.linii.iter().enumerate() {
            let p = live(ctx, PRODUCTS, l.produs, "produsul")?;
            let label = format!("linia {} ({})", n + 1, s(&p, "nume"));
            let q = match amount(&l.cantitate, num::qty, &label) {
                Ok(q) if q > 0 => q,
                Ok(_) => {
                    errs.push(format!("{label}: cantitatea trebuie să fie mai mare decât 0"));
                    continue;
                }
                Err(e) => {
                    errs.push(e.to_string());
                    continue;
                }
            };
            let price: Option<Money> = match (&l.pret_unitar, kind) {
                (Some(pr), "receptie") => match amount(pr, num::money, &label) {
                    Ok(m) if m >= 0 => Some(m),
                    Ok(_) => {
                        errs.push(format!("{label}: prețul nu poate fi negativ"));
                        continue;
                    }
                    Err(e) => {
                        errs.push(e.to_string());
                        continue;
                    }
                },
                (None, "receptie") => {
                    errs.push(format!("{label}: lipsește prețul unitar"));
                    continue;
                }
                _ => None,
            };
            *need.entry(p.id.to_string()).or_default() += q;
            lines.push((p, q, price));
        }
        if kind == "iesire" {
            let stock = self.balances(ctx)?;
            for (pid, q) in &need {
                let have = stock.get(&(pid.clone(), a.depozit.to_string())).copied().unwrap_or(0);
                if *q > have {
                    let name = lines
                        .iter()
                        .find(|(p, _, _)| p.id.to_string() == *pid)
                        .map(|(p, _, _)| s(p, "nume"))
                        .unwrap_or_default();
                    errs.push(format!(
                        "„{name}”: în depozit sunt {}, se cer {}",
                        num::fmt_qty(have),
                        num::fmt_qty(*q)
                    ));
                }
            }
        }
        if !errs.is_empty() {
            return Err(bad("documentul", errs.join("; ")));
        }
        let now = now_ms();
        let doc_id = Uuid::now_v7();
        let mut d = Fields::new();
        d.insert("tip".into(), json!(kind));
        d.insert("numar".into(), numar);
        d.insert("data".into(), json!(data));
        d.insert("depozit".into(), json!(a.depozit.to_string()));
        d.insert("partener".into(), text(a.partener, "partenerul", 200, false)?);
        d.insert("nota".into(), text(a.nota, "nota", 500, false)?);
        d.insert("storno_de".into(), Value::Null);
        d.insert("depozit_destinatie".into(), Value::Null);
        d.insert("creat_ms".into(), json!(now));
        let mut batch = vec![Write::put(DOCS, doc_id, d).expect(0)];
        let sign = if kind == "iesire" { -1 } else { 1 };
        for (p, q, price) in &lines {
            let mut m = Fields::new();
            m.insert("document".into(), json!(doc_id.to_string()));
            m.insert("produs".into(), json!(p.id.to_string()));
            m.insert("depozit".into(), json!(a.depozit.to_string()));
            m.insert("cantitate".into(), json!(sign * q));
            m.insert("pret_unitar".into(), price.map_or(Value::Null, |v| json!(v)));
            m.insert("pereche".into(), Value::Null);
            m.insert("storno_de_miscare".into(), Value::Null);
            m.insert("data".into(), json!(data));
            m.insert("creat_ms".into(), json!(now));
            batch.push(Write::put(MOVES, Uuid::now_v7(), m).expect(0));
        }
        ctx.write(batch)?;
        ctx.log(if kind == "iesire" {
            "ieșire înregistrată"
        } else {
            "recepție înregistrată"
        });
        Ok(json!({"document": doc_id, "linii": lines.len()}))
    }

    /// The opposite movements of a document, once. Refused if it would take
    /// a stock below zero (an issued product cannot be „un-received”).
    fn storno(&self, ctx: &mut ModuleContext<'_>, a: Storno) -> CoreResult<Value> {
        let data = date(&a.data).ok_or_else(|| bad("data", format!("„{}” nu este o dată", a.data)))?;
        let nota = text(a.nota, "nota", 500, false)?;
        let (sid, batch) = self.storno_writes(ctx, a.document, &data, nota)?;
        ctx.write(batch)?;
        ctx.log("storno înregistrat");
        Ok(json!({"document": sid}))
    }

    /// The writes of a storno (not yet written), so that an invoice storno
    /// can put them in the same atomic batch as the invoice.
    pub(crate) fn storno_writes(
        &self,
        ctx: &mut ModuleContext<'_>,
        document: Uuid,
        data: &str,
        nota: Value,
    ) -> CoreResult<(Uuid, Vec<Write>)> {
        let doc = live(ctx, DOCS, document, "documentul")?;
        if s(&doc, "tip") == "storno" {
            return Err(bad(
                "documentul",
                "un storno nu se stornează; înregistrează un document nou",
            ));
        }
        let id = json!(document.to_string());
        if !ctx.scan(DOCS, |r| r.fields.get("storno_de") == Some(&id))?.is_empty() {
            return Err(bad("documentul", "a fost deja stornat"));
        }
        let moves = ctx.scan(MOVES, |r| r.fields.get("document") == Some(&id))?;
        let stock = self.balances(ctx)?;
        let mut after = stock.clone();
        for m in &moves {
            *after.entry((s(m, "produs"), s(m, "depozit"))).or_default() -= i(m, "cantitate");
        }
        if let Some(((pid, _), q)) = after.iter().find(|(_, q)| **q < 0) {
            let name = Uuid::parse_str(pid)
                .ok()
                .and_then(|p| ctx.get(PRODUCTS, p).ok().flatten())
                .map(|p| s(&p, "nume"))
                .unwrap_or_default();
            return Err(bad(
                "stornoul",
                format!(
                    "„{name}” ar ajunge la {} în depozit; au ieșit deja produse din această recepție",
                    num::fmt_qty(*q)
                ),
            ));
        }
        let now = now_ms();
        let sid = Uuid::now_v7();
        let mut d = Fields::new();
        d.insert("tip".into(), json!("storno"));
        d.insert(
            "numar".into(),
            json!(
                format!("STORNO {}", s(&doc, "numar"))
                    .chars()
                    .take(40)
                    .collect::<String>()
            ),
        );
        d.insert("data".into(), json!(data));
        d.insert("depozit".into(), doc.fields["depozit"].clone());
        d.insert(
            "partener".into(),
            doc.fields.get("partener").cloned().unwrap_or(Value::Null),
        );
        d.insert("nota".into(), nota);
        d.insert("storno_de".into(), id);
        d.insert(
            "depozit_destinatie".into(),
            doc.fields.get("depozit_destinatie").cloned().unwrap_or(Value::Null),
        );
        d.insert("creat_ms".into(), json!(now));
        let mut batch = vec![Write::put(DOCS, sid, d).expect(0)];
        for m in &moves {
            let mut f = m.fields.clone();
            f.insert("document".into(), json!(sid.to_string()));
            f.insert("storno_de_miscare".into(), json!(m.id.to_string()));
            f.insert("pereche".into(), Value::Null);
            f.insert("cantitate".into(), json!(-i(m, "cantitate")));
            f.insert("data".into(), json!(data));
            f.insert("creat_ms".into(), json!(now));
            batch.push(Write::put(MOVES, Uuid::now_v7(), f).expect(0));
        }
        Ok((sid, batch))
    }

    /// The writes of an issue (not yet written), checked against the stock:
    /// used by invoices that take goods out of a warehouse.
    pub(crate) fn issue_writes(
        &self,
        ctx: &mut ModuleContext<'_>,
        depozit: Uuid,
        numar: &str,
        data: &str,
        partener: Value,
        lines: &[(RecordState, Qty)],
    ) -> CoreResult<(Uuid, Vec<Write>)> {
        let wh = self.active_warehouse(ctx, depozit)?;
        let stock = self.balances(ctx)?;
        let mut need: BTreeMap<Uuid, Qty> = BTreeMap::new();
        for (p, q) in lines {
            *need.entry(p.id).or_default() += q;
        }
        let mut errs = Vec::new();
        for (pid, q) in &need {
            let have = stock.get(&(pid.to_string(), depozit.to_string())).copied().unwrap_or(0);
            if *q > have {
                let name = lines
                    .iter()
                    .find(|(p, _)| p.id == *pid)
                    .map(|(p, _)| s(p, "nume"))
                    .unwrap_or_default();
                errs.push(format!(
                    "„{name}”: în „{}” sunt {}, se cer {}",
                    s(&wh, "nume"),
                    num::fmt_qty(have),
                    num::fmt_qty(*q)
                ));
            }
        }
        if !errs.is_empty() {
            return Err(bad("stocul", errs.join("; ")));
        }
        let now = now_ms();
        let doc = Uuid::now_v7();
        let mut d = self.header(
            "iesire",
            json!(numar.chars().take(40).collect::<String>()),
            data,
            depozit,
            None,
            Value::Null,
            now,
        );
        d.insert("partener".into(), partener);
        let mut batch = vec![Write::put(DOCS, doc, d).expect(0)];
        for (p, q) in lines {
            batch.push(
                Write::put(
                    MOVES,
                    Uuid::now_v7(),
                    Self::movement(doc, p.id, depozit, -q, data, None, now),
                )
                .expect(0),
            );
        }
        Ok((doc, batch))
    }

    fn active_warehouse(&self, ctx: &mut ModuleContext<'_>, id: Uuid) -> CoreResult<RecordState> {
        let wh = live(ctx, WAREHOUSES, id, "depozitul")?;
        if wh.fields.get("activ") == Some(&json!(false)) {
            return Err(bad("depozitul", format!("„{}” este inactiv", s(&wh, "nume"))));
        }
        Ok(wh)
    }

    #[allow(clippy::too_many_arguments)]
    fn header(
        &self,
        kind: &str,
        numar: Value,
        data: &str,
        depozit: Uuid,
        dest: Option<Uuid>,
        nota: Value,
        now: u64,
    ) -> Fields {
        let mut d = Fields::new();
        d.insert("tip".into(), json!(kind));
        d.insert("numar".into(), numar);
        d.insert("data".into(), json!(data));
        d.insert("depozit".into(), json!(depozit.to_string()));
        d.insert(
            "depozit_destinatie".into(),
            dest.map_or(Value::Null, |x| json!(x.to_string())),
        );
        d.insert("partener".into(), Value::Null);
        d.insert("nota".into(), nota);
        d.insert("storno_de".into(), Value::Null);
        d.insert("creat_ms".into(), json!(now));
        d
    }

    fn movement(doc: Uuid, produs: Uuid, depozit: Uuid, q: Qty, data: &str, pereche: Option<Uuid>, now: u64) -> Fields {
        let mut m = Fields::new();
        m.insert("document".into(), json!(doc.to_string()));
        m.insert("produs".into(), json!(produs.to_string()));
        m.insert("depozit".into(), json!(depozit.to_string()));
        m.insert("cantitate".into(), json!(q));
        m.insert("pret_unitar".into(), Value::Null);
        m.insert("pereche".into(), pereche.map_or(Value::Null, |x| json!(x.to_string())));
        m.insert("storno_de_miscare".into(), Value::Null);
        m.insert("data".into(), json!(data));
        m.insert("creat_ms".into(), json!(now));
        m
    }

    /// Moves goods between two warehouses: an issue at the source and a
    /// receipt at the destination, in one atomic write; the goods keep their
    /// average cost from the source (D-050).
    fn transfer(&self, ctx: &mut ModuleContext<'_>, a: Transfer) -> CoreResult<Value> {
        if a.depozit == a.depozit_destinatie {
            return Err(bad("transferul", "depozitul de destinație trebuie să fie altul"));
        }
        let from = self.active_warehouse(ctx, a.depozit)?;
        self.active_warehouse(ctx, a.depozit_destinatie)?;
        let data = date(&a.data).ok_or_else(|| bad("data", format!("„{}” nu este o dată", a.data)))?;
        if a.linii.is_empty() || a.linii.len() > MAX_LINES {
            return Err(bad("documentul", format!("are nevoie de 1–{MAX_LINES} linii")));
        }
        let numar = text(Some(a.numar), "numărul documentului", 40, true)?;
        let stock = self.balances(ctx)?;
        let mut need: BTreeMap<Uuid, Qty> = BTreeMap::new();
        let mut lines = Vec::new();
        let mut errs = Vec::new();
        for (n, l) in a.linii.iter().enumerate() {
            let p = live(ctx, PRODUCTS, l.produs, "produsul")?;
            let label = format!("linia {} ({})", n + 1, s(&p, "nume"));
            match amount(&l.cantitate, num::qty, &label) {
                Ok(q) if q > 0 => {
                    *need.entry(p.id).or_default() += q;
                    lines.push((p, q));
                }
                Ok(_) => errs.push(format!("{label}: cantitatea trebuie să fie mai mare decât 0")),
                Err(e) => errs.push(e.to_string()),
            }
        }
        for (pid, q) in &need {
            let have = stock
                .get(&(pid.to_string(), a.depozit.to_string()))
                .copied()
                .unwrap_or(0);
            if *q > have {
                let name = lines
                    .iter()
                    .find(|(p, _)| p.id == *pid)
                    .map(|(p, _)| s(p, "nume"))
                    .unwrap_or_default();
                errs.push(format!(
                    "„{name}”: în „{}” sunt {}, se cer {}",
                    s(&from, "nume"),
                    num::fmt_qty(have),
                    num::fmt_qty(*q)
                ));
            }
        }
        if !errs.is_empty() {
            return Err(bad("transferul", errs.join("; ")));
        }
        let now = now_ms();
        let doc = Uuid::now_v7();
        let nota = text(a.nota, "nota", 500, false)?;
        let mut batch = vec![
            Write::put(
                DOCS,
                doc,
                self.header(
                    "transfer",
                    numar,
                    &data,
                    a.depozit,
                    Some(a.depozit_destinatie),
                    nota,
                    now,
                ),
            )
            .expect(0),
        ];
        for (p, q) in &lines {
            let out = Uuid::now_v7();
            batch.push(Write::put(MOVES, out, Self::movement(doc, p.id, a.depozit, -q, &data, None, now)).expect(0));
            batch.push(
                Write::put(
                    MOVES,
                    Uuid::now_v7(),
                    Self::movement(doc, p.id, a.depozit_destinatie, *q, &data, Some(out), now),
                )
                .expect(0),
            );
        }
        ctx.write(batch)?;
        ctx.log("transfer înregistrat");
        Ok(json!({"document": doc, "linii": lines.len()}))
    }

    /// An inventory count: the differences between what was counted and
    /// the stock become correction movements (plus or minus); products not
    /// listed are not touched. A plus is valued at the current average cost.
    fn inventory(&self, ctx: &mut ModuleContext<'_>, a: Inventory) -> CoreResult<Value> {
        self.active_warehouse(ctx, a.depozit)?;
        let data = date(&a.data).ok_or_else(|| bad("data", format!("„{}” nu este o dată", a.data)))?;
        if a.linii.is_empty() || a.linii.len() > 5_000 {
            return Err(bad("inventarul", "are nevoie de 1–5000 de linii"));
        }
        let numar = text(Some(a.numar), "numărul documentului", 40, true)?;
        let stock = self.balances(ctx)?;
        let mut seen = BTreeSet::new();
        let mut diffs = Vec::new();
        let mut errs = Vec::new();
        for (n, l) in a.linii.iter().enumerate() {
            let p = live(ctx, PRODUCTS, l.produs, "produsul")?;
            if !seen.insert(p.id) {
                errs.push(format!("„{}” apare de două ori", s(&p, "nume")));
                continue;
            }
            let label = format!("linia {} ({})", n + 1, s(&p, "nume"));
            match amount(&l.cantitate_numarata, num::qty, &label) {
                Ok(c) if c >= 0 => {
                    let have = stock
                        .get(&(p.id.to_string(), a.depozit.to_string()))
                        .copied()
                        .unwrap_or(0);
                    diffs.push((p, c - have, have, c));
                }
                Ok(_) => errs.push(format!("{label}: cantitatea numărată nu poate fi negativă")),
                Err(e) => errs.push(e.to_string()),
            }
        }
        if !errs.is_empty() {
            return Err(bad("inventarul", errs.join("; ")));
        }
        let now = now_ms();
        let doc = Uuid::now_v7();
        let nota = text(a.nota, "nota", 500, false)?;
        let mut batch = vec![
            Write::put(
                DOCS,
                doc,
                self.header("inventar", numar, &data, a.depozit, None, nota, now),
            )
            .expect(0),
        ];
        let mut out = Vec::new();
        for (p, d, have, counted) in &diffs {
            out.push(json!({"produs": p.id, "nume": s(p, "nume"), "scriptic": num::fmt_qty(*have), "faptic": num::fmt_qty(*counted), "diferenta": num::fmt_qty(*d)}));
            if *d != 0 {
                batch.push(
                    Write::put(
                        MOVES,
                        Uuid::now_v7(),
                        Self::movement(doc, p.id, a.depozit, *d, &data, None, now),
                    )
                    .expect(0),
                );
            }
        }
        ctx.write(batch)?;
        ctx.log("inventar înregistrat");
        Ok(json!({"document": doc, "linii": out}))
    }

    fn stock(&self, ctx: &mut ModuleContext<'_>, f: StockFilter) -> CoreResult<Value> {
        let balances = self.balances(ctx)?;
        let values = valuation::replay(&ctx.scan(MOVES, |_| true)?).positions;
        let products = ctx.scan(PRODUCTS, |_| true)?;
        let warehouses: BTreeMap<String, String> = ctx
            .scan(WAREHOUSES, |_| true)?
            .iter()
            .map(|w| (w.id.to_string(), s(w, "nume")))
            .collect();
        let mut rows = Vec::new();
        for p in &products {
            if f.produs.is_some_and(|x| x != p.id) {
                continue;
            }
            let pid = p.id.to_string();
            let min = p.fields.get("stoc_minim").and_then(Value::as_i64);
            for (wid, wname) in &warehouses {
                if f.depozit.is_some_and(|x| x.to_string() != *wid) {
                    continue;
                }
                let q = balances.get(&(pid.clone(), wid.clone())).copied();
                // Only where the product has had movements: a minimum is not
                // a reason to list (or remind about) every empty warehouse.
                let Some(q) = q else { continue };
                rows.push(json!({
                    "produs": p.id, "cod": s(p, "cod"), "nume": s(p, "nume"), "um": s(p, "um"),
                    "depozit": wid, "depozit_nume": wname,
                    "cantitate": q, "cantitate_text": num::fmt_qty(q),
                    "stoc_minim": min, "sub_minim": min.is_some_and(|m| q < m),
                    "valoare": values.get(&(pid.clone(), wid.clone())).map_or(0, |v| v.value),
                    "valoare_text": num::fmt_money(values.get(&(pid.clone(), wid.clone())).map_or(0, |v| v.value)),
                    "cost_mediu_text": values.get(&(pid.clone(), wid.clone())).and_then(|v| v.average()).map(num::fmt_money),
                }));
            }
        }
        rows.sort_by(|a, b| {
            (a["nume"].as_str(), a["depozit_nume"].as_str()).cmp(&(b["nume"].as_str(), b["depozit_nume"].as_str()))
        });
        Ok(json!(rows))
    }

    fn reminders(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        let rows = self.stock(ctx, StockFilter::default())?;
        let mut sent = 0;
        for r in rows.as_array().into_iter().flatten().filter(|r| r["sub_minim"] == true) {
            // One reminder per product, warehouse and day while it stays low.
            let key = format!(
                "stoc-minim:{}:{}:{today}",
                r["produs"].as_str().unwrap_or_default(),
                r["depozit"].as_str().unwrap_or_default()
            );
            if sent >= 10 || ctx.notify_key_used(&key)? {
                continue;
            }
            let min = r["stoc_minim"].as_i64().unwrap_or_default();
            ctx.notify(
                &Notice::new(
                    format!("Stoc sub minim: {}", r["nume"].as_str().unwrap_or_default()),
                    format!(
                        "{}: {} {} (minim {}).",
                        r["depozit_nume"].as_str().unwrap_or_default(),
                        r["cantitate_text"].as_str().unwrap_or_default(),
                        r["um"].as_str().unwrap_or_default(),
                        num::fmt_qty(min)
                    ),
                )
                .level(Level::Atentie)
                .key(key),
            )?;
            sent += 1;
        }
        Ok(())
    }
}

fn view(r: &RecordState) -> Value {
    let mut v = Value::Object(r.fields.clone());
    v["id"] = json!(r.id);
    v["version"] = json!(r.version);
    v
}

impl Module for Business {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn remind(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        self.reminders(ctx, today)?;
        self.due_reminders(ctx, today)
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "products" => {
                let mut list = ctx.scan(PRODUCTS, |_| true)?;
                list.sort_by_key(|r| s(r, "nume").to_lowercase());
                Ok(json!(
                    list.iter()
                        .map(|r| {
                            let mut v = view(r);
                            v["stoc_minim_text"] = r
                                .fields
                                .get("stoc_minim")
                                .and_then(Value::as_i64)
                                .map_or(Value::Null, |q| json!(num::fmt_qty(q)));
                            v
                        })
                        .collect::<Vec<_>>()
                ))
            }
            "product_save" => self.product_save(ctx, args(a)?),
            "warehouses" => {
                let mut list = ctx.scan(WAREHOUSES, |_| true)?;
                list.sort_by_key(|r| s(r, "nume").to_lowercase());
                Ok(json!(list.iter().map(view).collect::<Vec<_>>()))
            }
            "warehouse_save" => {
                let a: WarehouseSave = args(a)?;
                let mut f = Fields::new();
                f.insert("nume".into(), text(Some(a.nume), "numele depozitului", 100, true)?);
                f.insert("activ".into(), json!(a.activ));
                let (id, w) = match a.id {
                    Some(id) => {
                        let cur = live(ctx, WAREHOUSES, id, "depozitul")?;
                        f.insert("creat_ms".into(), cur.fields["creat_ms"].clone());
                        (
                            id,
                            Write::put(WAREHOUSES, id, f).expect(a.version.unwrap_or(cur.version)),
                        )
                    }
                    None => {
                        f.insert("creat_ms".into(), json!(now_ms()));
                        let id = Uuid::now_v7();
                        (id, Write::put(WAREHOUSES, id, f).expect(0))
                    }
                };
                ctx.write(vec![w])?;
                Ok(json!({"id": id}))
            }
            "receive" => self.stock_doc(ctx, args(a)?, "receptie"),
            "issue" => self.stock_doc(ctx, args(a)?, "iesire"),
            "transfer" => self.transfer(ctx, args(a)?),
            "inventory" => self.inventory(ctx, args(a)?),
            "storno" => self.storno(ctx, args(a)?),
            // Step 5.3: partners, settings, series, invoices.
            "partners" => {
                let mut list = ctx.scan(invoices::PARTNERS, |_| true)?;
                list.sort_by_key(|r| s(r, "nume").to_lowercase());
                Ok(json!(list.iter().map(view).collect::<Vec<_>>()))
            }
            "partner_save" => self.partner_save(ctx, args(a)?),
            "settings" => self.settings_view(ctx),
            "settings_save" => self.settings_save(ctx, args(a)?),
            "series" => {
                let mut list = ctx.scan(invoices::SERIES, |_| true)?;
                list.sort_by_key(|r| s(r, "cod"));
                Ok(json!(list.iter().map(view).collect::<Vec<_>>()))
            }
            "series_save" => self.series_save(ctx, args(a)?),
            "invoice_issue" => self.invoice_issue(ctx, args(a)?),
            "invoices" => self.invoices(ctx),
            "invoice_storno" => self.invoice_storno(ctx, args(a)?),
            // Step 5.6: due dates and partner statements.
            "aging" => {
                let a: Today = args(a)?;
                self.aging(ctx, &a.azi)
            }
            "partner_sheet" => {
                let a: ById = args(a)?;
                self.partner_sheet(ctx, a.id)
            }
            // Step 5.5: cash and bank.
            "accounts" => self.accounts(ctx),
            "account_save" => self.account_save(ctx, args(a)?),
            "payments" => self.payments(ctx),
            "payment_save" => self.payment_save(ctx, args(a)?),
            "payment_link" => self.payment_link(ctx, args(a)?),
            "payment_storno" => self.payment_storno(ctx, args(a)?),
            "open_documents" => self.open_documents(ctx),
            "settle" => self.settle(ctx, args(a)?),
            "bank_import" => self.bank_import(ctx, args(a)?),
            // Step 5.4: received invoices and expenses.
            "purchases" => self.purchases(ctx),
            "purchase_save" => self.purchase_save(ctx, args(a)?),
            "purchase_storno" => self.purchase_storno(ctx, args(a)?),
            // From the system file dialog: the CSV exported by „Extragere date”.
            "import" => {
                let a: FromDialog = args(a)?;
                let data = base64_decode(&a.data)?;
                self.import_extract(ctx, &a.name, &data)
            }
            "invoice_pdf" => {
                let a: InvoicePdf = args(a)?;
                let pdf = self.invoice_pdf(ctx, a.id)?;
                // The user confirmed replacing an existing file in the save dialog.
                ctx.export_bytes(&a.dest, &pdf, true)?;
                Ok(json!({"octeti": pdf.len()}))
            }
            "documents" => {
                let docs = ctx.scan(DOCS, |_| true)?;
                let reversed: BTreeSet<String> = docs
                    .iter()
                    .map(|d| s(d, "storno_de"))
                    .filter(|x| !x.is_empty())
                    .collect();
                let mut list: Vec<Value> = docs
                    .iter()
                    .map(|d| {
                        let mut v = view(d);
                        v["stornat"] = json!(reversed.contains(&d.id.to_string()));
                        v
                    })
                    .collect();
                list.sort_by(|a, b| b["id"].as_str().cmp(&a["id"].as_str()));
                Ok(json!(list))
            }
            "stock" => self.stock(ctx, args(a)?),
            "movements" => {
                let a: StockFilter = args(a)?;
                let mut list = ctx.scan(MOVES, |r| {
                    a.produs
                        .is_none_or(|p| r.fields.get("produs") == Some(&json!(p.to_string())))
                        && a.depozit
                            .is_none_or(|d| r.fields.get("depozit") == Some(&json!(d.to_string())))
                })?;
                list.sort_by_key(|r| r.id);
                let values = valuation::replay(&ctx.scan(MOVES, |_| true)?).moves;
                Ok(json!(
                    list.iter()
                        .map(|r| {
                            let mut v = view(r);
                            v["cantitate_text"] = json!(num::fmt_qty(i(r, "cantitate")));
                            let val = values.get(&r.id).copied().unwrap_or(0);
                            v["valoare"] = json!(val);
                            v["valoare_text"] = json!(num::fmt_money(val));
                            v
                        })
                        .collect::<Vec<_>>()
                ))
            }
            other => Err(CoreError::invalid(
                "modulul Business",
                format!("comandă necunoscută „{other}”"),
            )),
        }
    }
}
