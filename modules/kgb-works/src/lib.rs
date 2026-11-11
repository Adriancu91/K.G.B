//! `kgb.works` — „Situații de lucrări” (Etapa 7, step 7.9e): the estimate and the monthly payment statements.
//!
//! - **Estimates** (`devize`): name, number, date, the client (a card of the core's directory and a copy of its name),
//!   the contract as text (as in Maintenance), the site, the VAT rate and the retention chosen by the person, with the
//!   retention's base (without VAT, or with it, „as the contract says”).
//! - **Items** (`articole`): code, name, unit, quantity (thousandths), unit price without VAT (bani). A price does not
//!   change once the item is in an issued statement.
//! - **Supplements** (`suplimentari`): more quantity on an item, always with a reason.
//! - **Statements** (`situatii`): number, period, the quantities executed on the items. A draft may change; an issued
//!   one does not (as invoices, D-051): a wrong one is cancelled with a reason, stays visible, no longer counts, and
//!   its number is not used again. The VAT and the retention are copied from the estimate when it is issued.
//!
//! What is computed, never written: previous (the issued statements before), current, cumulated, remaining, the
//! values (f64 bani) and the totals rounded to the ban once. A statement may not take an item past its estimate
//! (with the supplements). Two PCs offline can still issue two statements that together go past it, or with the same
//! number: they meet at synchronisation and are shown („depășire”, „număr dublu”), not hidden.
//!
//! Commands: `parteneri`, `devize`, `deviz {id}`, `deviz_save`, `deviz_stare`, `deviz_delete`, `articol_save`,
//! `articol_delete`, `articole_lipire {deviz, text, confirma}`, `suplimentare_save`, `situatie_noua`, `situatie_save`,
//! `situatie_emite`, `situatie_anulare {id, version, motiv}`, `situatie_delete`, `situatie {id}`, `situatie_pdf`,
//! `situatie_xlsx`, `deviz_xlsx`.

pub mod calc;
pub mod pdf;

use std::collections::BTreeMap;
use std::path::PathBuf;

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.works";
pub const ESTIMATES: &str = "devize";
pub const ITEMS: &str = "articole";
pub const SUPPLEMENTS: &str = "suplimentari";
pub const STATEMENTS: &str = "situatii";
pub const VAT_RATES: [i64; 3] = [21, 11, 0];

pub struct Works {
    manifest: Manifest,
}

impl Works {
    pub fn new() -> Works {
        Works {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Works {
    fn default() -> Self {
        Works::new()
    }
}

fn args<T: DeserializeOwned>(command: &str, v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid(format!("argumentele comenzii {command}"), e.to_string()))
}

fn bad(what: &str, detail: impl Into<String>) -> CoreError {
    CoreError::invalid(what, detail)
}

fn s(r: &RecordState, k: &str) -> String {
    r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn i(r: &RecordState, k: &str) -> i64 {
    r.fields.get(k).and_then(Value::as_i64).unwrap_or_default()
}

fn text(what: &str, t: &str, max: usize, required: bool) -> CoreResult<String> {
    let t = t.trim();
    if (required && t.is_empty()) || t.chars().count() > max {
        return Err(bad(
            what,
            if required {
                format!("are 1–{max} caractere")
            } else {
                format!("are cel mult {max} caractere")
            },
        ));
    }
    Ok(t.to_string())
}

fn date_ok(what: &str, t: &str) -> CoreResult<String> {
    let t = t.trim();
    let b = t.as_bytes();
    let ok = b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && t[0..4].parse::<u32>().is_ok_and(|y| (1990..=2200).contains(&y))
        && t[5..7].parse::<u32>().is_ok_and(|m| (1..=12).contains(&m))
        && t[8..10].parse::<u32>().is_ok_and(|d| (1..=31).contains(&d));
    if ok {
        Ok(t.to_string())
    } else {
        Err(bad(what, format!("„{t}” nu e o dată AAAA-LL-ZZ")))
    }
}

fn ro(d: &str) -> String {
    d.split('-').rev().collect::<Vec<_>>().join(".")
}

/// A line of a statement: the item and the quantity executed (thousandths).
fn lines_of(r: &RecordState) -> Vec<(String, i64)> {
    r.fields
        .get("linii")
        .and_then(Value::as_array)
        .map(|l| {
            l.iter()
                .map(|x| {
                    (
                        x.get("articol").and_then(Value::as_str).unwrap_or_default().to_string(),
                        x.get("cantitate").and_then(Value::as_i64).unwrap_or_default(),
                    )
                })
                .collect()
        })
        .unwrap_or_default()
}

// ---------- arguments ----------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ById {
    id: Uuid,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ByIdVersion {
    id: Uuid,
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PartnerSearch {
    #[serde(default)]
    text: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EstimateSave {
    id: Option<Uuid>,
    version: Option<u64>,
    nume: String,
    #[serde(default)]
    numar: String,
    data: String,
    #[serde(default)]
    partener: Option<Uuid>,
    #[serde(default)]
    beneficiar_nume: String,
    #[serde(default)]
    contract_text: String,
    #[serde(default)]
    santier: String,
    #[serde(default = "standard_vat")]
    tva: i64,
    #[serde(default)]
    garantie: i64,
    #[serde(default = "without_vat")]
    garantie_baza: String,
    #[serde(default)]
    nota: String,
}

fn standard_vat() -> i64 {
    21
}

fn without_vat() -> String {
    "fara_tva".into()
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StateSet {
    id: Uuid,
    version: u64,
    stare: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ItemSave {
    id: Option<Uuid>,
    version: Option<u64>,
    deviz: Uuid,
    #[serde(default)]
    cod: String,
    denumire: String,
    #[serde(default)]
    um: String,
    cantitate: i64,
    pret_unitar: i64,
    #[serde(default)]
    ordine: Option<i64>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Paste {
    deviz: Uuid,
    text: String,
    #[serde(default)]
    confirma: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SupplementSave {
    articol: Uuid,
    cantitate: i64,
    motiv: String,
    data: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StatementNew {
    deviz: Uuid,
    de_la: String,
    pana_la: String,
    data: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LineIn {
    articol: Uuid,
    cantitate: i64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StatementSave {
    id: Uuid,
    version: u64,
    linii: Vec<LineIn>,
    #[serde(default)]
    de_la: Option<String>,
    #[serde(default)]
    pana_la: Option<String>,
    #[serde(default)]
    data: Option<String>,
    #[serde(default)]
    nota: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Cancel {
    id: Uuid,
    version: u64,
    motiv: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Export {
    id: Uuid,
    dest: PathBuf,
    #[serde(default)]
    executant: String,
}

// ---------- the module ----------

/// An estimate with its items and their quantities (with the supplements).
struct Book {
    estimate: RecordState,
    items: Vec<RecordState>,
    /// Item id → the estimate's quantity with the supplements.
    quantity: BTreeMap<String, i64>,
    supplements: Vec<RecordState>,
    statements: Vec<RecordState>,
}

impl Works {
    fn live(&self, ctx: &mut ModuleContext<'_>, c: &str, id: Uuid, what: &str) -> CoreResult<RecordState> {
        ctx.get(c, id)?
            .filter(|r| !r.deleted)
            .ok_or_else(|| bad(what, "nu mai există"))
    }

    fn book(&self, ctx: &mut ModuleContext<'_>, estimate: Uuid) -> CoreResult<Book> {
        let est = self.live(ctx, ESTIMATES, estimate, "devizul")?;
        let key = json!(estimate.to_string());
        let mut items = ctx.scan(ITEMS, |r| !r.deleted && r.fields.get("deviz") == Some(&key))?;
        items.sort_by_key(|r| (i(r, "ordine"), s(r, "cod")));
        let ids: Vec<String> = items.iter().map(|r| r.id.to_string()).collect();
        let supplements: Vec<RecordState> = ctx
            .scan(SUPPLEMENTS, |r| !r.deleted)?
            .into_iter()
            .filter(|r| ids.contains(&s(r, "articol")))
            .collect();
        let mut quantity: BTreeMap<String, i64> = items.iter().map(|r| (r.id.to_string(), i(r, "cantitate"))).collect();
        for sp in &supplements {
            *quantity.entry(s(sp, "articol")).or_default() += i(sp, "cantitate");
        }
        let mut statements = ctx.scan(STATEMENTS, |r| !r.deleted && r.fields.get("deviz") == Some(&key))?;
        statements.sort_by_key(|r| (i(r, "numar"), i(r, "creat_ms")));
        Ok(Book {
            estimate: est,
            items,
            quantity,
            supplements,
            statements,
        })
    }

    /// The quantities executed per item in the issued statements before `before` (all issued ones when `None`).
    fn previous(book: &Book, before: Option<&RecordState>) -> BTreeMap<String, i64> {
        let mut out: BTreeMap<String, i64> = BTreeMap::new();
        for st in &book.statements {
            if s(st, "stare") != "emisa" {
                continue;
            }
            if let Some(b) = before
                && (st.id == b.id || (i(st, "numar"), i(st, "creat_ms")) >= (i(b, "numar"), i(b, "creat_ms")))
            {
                continue;
            }
            for (a, q) in lines_of(st) {
                *out.entry(a).or_default() += q;
            }
        }
        out
    }

    /// Refuses lines that take an item past its estimate (with the supplements).
    fn check_lines(book: &Book, before: Option<&RecordState>, lines: &[(String, i64)]) -> CoreResult<()> {
        let prev = Self::previous(book, before);
        for (a, q) in lines {
            if *q < 0 {
                return Err(bad("cantitatea", "nu poate fi negativă"));
            }
            let item = book
                .items
                .iter()
                .find(|r| r.id.to_string() == *a)
                .ok_or_else(|| bad("articolul", "nu e în acest deviz"))?;
            let deviz = book.quantity.get(a).copied().unwrap_or_default();
            let cum = prev.get(a).copied().unwrap_or_default() + q;
            if cum > deviz {
                return Err(bad(
                    "situația",
                    format!(
                        "depășește devizul la „{}” cu {} {}; adaugă o suplimentare cu motiv",
                        s(item, "denumire"),
                        calc::qty(cum - deviz),
                        s(item, "um")
                    ),
                ));
            }
        }
        Ok(())
    }

    /// A statement computed: its lines on every item, the totals, the marks.
    fn statement_view(&self, book: &Book, st: &RecordState) -> Value {
        let state = s(st, "stare");
        let fixed = state != "ciorna";
        let (vat, retention, base) = if fixed {
            (i(st, "tva"), i(st, "garantie"), s(st, "garantie_baza"))
        } else {
            (
                i(&book.estimate, "tva"),
                i(&book.estimate, "garantie"),
                s(&book.estimate, "garantie_baza"),
            )
        };
        let prev = Self::previous(book, Some(st));
        let mine: BTreeMap<String, i64> = lines_of(st).into_iter().collect();
        let mut values = Vec::new();
        let mut lines = Vec::new();
        for it in &book.items {
            let id = it.id.to_string();
            let c = calc::item(
                book.quantity.get(&id).copied().unwrap_or_default(),
                prev.get(&id).copied().unwrap_or_default(),
                mine.get(&id).copied().unwrap_or_default(),
                i(it, "pret_unitar"),
            );
            if state != "anulata" {
                values.push(c.valoare_curent);
            }
            lines.push(json!({
                "articol": it.id, "cod": s(it, "cod"), "denumire": s(it, "denumire"), "um": s(it, "um"),
                "pret_unitar": i(it, "pret_unitar"), "deviz": c.deviz, "anterior": c.anterior, "curent": c.curent,
                "cumulat": c.cumulat, "rest": c.rest, "valoare_curent": c.valoare_curent, "valoare_cumulat": c.valoare_cumulat,
                "depasire": c.cumulat > c.deviz,
            }));
        }
        let t = calc::totals(&values, vat, retention, base == "cu_tva");
        let same_number = book
            .statements
            .iter()
            .filter(|x| x.id != st.id && s(x, "stare") != "anulata" && i(x, "numar") == i(st, "numar"))
            .count()
            > 0;
        json!({
            "id": st.id, "version": st.version, "deviz": s(st, "deviz"), "numar": i(st, "numar"), "de_la": s(st, "de_la"),
            "pana_la": s(st, "pana_la"), "data": s(st, "data"), "stare": state, "motiv_anulare": s(st, "motiv_anulare"),
            "nota": s(st, "nota"), "tva": vat, "garantie": retention, "garantie_baza": base, "linii": lines,
            "valoare": t.valoare, "tva_valoare": t.tva, "retinere": t.retinere, "de_plata": t.de_plata,
            "numar_dublu": same_number && state != "anulata",
            "depasire": state != "anulata" && lines.iter().any(|l| l["depasire"] == true),
        })
    }

    fn estimate_save(&self, ctx: &mut ModuleContext<'_>, a: EstimateSave) -> CoreResult<Value> {
        if !VAT_RATES.contains(&a.tva) {
            return Err(bad("cota de TVA", "e 21, 11 sau 0"));
        }
        if !(0..=2000).contains(&a.garantie) || !matches!(a.garantie_baza.as_str(), "fara_tva" | "cu_tva") {
            return Err(bad(
                "reținerea de garanție",
                "e între 0% și 20%, pe valoarea fără TVA sau cu TVA",
            ));
        }
        let mut name = text("beneficiarul", &a.beneficiar_nume, 200, false)?;
        if let Some(pid) = a.partener {
            name = ctx.partner(pid)?.denumire;
        }
        let (id, expect, state, created) = match a.id {
            Some(id) => {
                let old = self.live(ctx, ESTIMATES, id, "devizul")?;
                (
                    id,
                    a.version.unwrap_or(old.version),
                    s(&old, "stare"),
                    i(&old, "creat_ms"),
                )
            }
            None => (Uuid::now_v7(), 0, "ciorna".to_string(), now_ms() as i64),
        };
        let mut f = Fields::new();
        f.insert("nume".into(), json!(text("numele devizului", &a.nume, 200, true)?));
        f.insert("numar".into(), json!(text("numărul", &a.numar, 40, false)?));
        f.insert("data".into(), json!(date_ok("data", &a.data)?));
        f.insert("beneficiar_nume".into(), json!(name));
        f.insert(
            "partener".into(),
            json!(a.partener.map(|x| x.to_string()).unwrap_or_default()),
        );
        f.insert(
            "contract_text".into(),
            json!(text("contractul", &a.contract_text, 200, false)?),
        );
        f.insert("santier".into(), json!(text("lucrarea", &a.santier, 200, false)?));
        f.insert("tva".into(), json!(a.tva));
        f.insert("garantie".into(), json!(a.garantie));
        f.insert("garantie_baza".into(), json!(a.garantie_baza));
        f.insert("stare".into(), json!(state));
        f.insert("nota".into(), json!(text("nota", &a.nota, 2000, false)?));
        f.insert("creat_ms".into(), json!(created));
        ctx.write(vec![Write::put(ESTIMATES, id, f).expect(expect)])?;
        Ok(json!({"id": id}))
    }

    fn item_fields(a: &ItemSave, order: i64) -> CoreResult<Fields> {
        if !(1..=1_000_000_000_000).contains(&a.cantitate) || a.pret_unitar < 0 {
            return Err(bad(
                "articolul",
                "cantitatea e pozitivă, iar prețul nu poate fi negativ",
            ));
        }
        let mut f = Fields::new();
        f.insert("deviz".into(), json!(a.deviz.to_string()));
        f.insert("cod".into(), json!(text("codul", &a.cod, 40, false)?));
        f.insert("denumire".into(), json!(text("denumirea", &a.denumire, 300, true)?));
        f.insert("um".into(), json!(text("unitatea de măsură", &a.um, 20, false)?));
        f.insert("cantitate".into(), json!(a.cantitate));
        f.insert("pret_unitar".into(), json!(a.pret_unitar));
        f.insert("ordine".into(), json!(order));
        Ok(f)
    }

    fn item_save(&self, ctx: &mut ModuleContext<'_>, a: ItemSave) -> CoreResult<Value> {
        let book = self.book(ctx, a.deviz)?;
        if s(&book.estimate, "stare") == "inchis" {
            return Err(bad("devizul", "e închis"));
        }
        let issued = Self::previous(&book, None);
        let (id, expect, order) = match a.id {
            Some(id) => {
                let old = self.live(ctx, ITEMS, id, "articolul")?;
                let key = id.to_string();
                let used = book
                    .statements
                    .iter()
                    .any(|st| s(st, "stare") != "ciorna" && lines_of(st).iter().any(|(x, _)| *x == key));
                if used && i(&old, "pret_unitar") != a.pret_unitar {
                    return Err(bad(
                        "prețul",
                        "articolul e în situații emise: prețul nu se mai schimbă; fă un articol nou",
                    ));
                }
                let supplements: i64 = book
                    .supplements
                    .iter()
                    .filter(|x| s(x, "articol") == key)
                    .map(|x| i(x, "cantitate"))
                    .sum();
                let done = issued.get(&key).copied().unwrap_or_default();
                if a.cantitate + supplements < done {
                    return Err(bad(
                        "cantitatea",
                        format!("e sub ce s-a executat deja în situații emise ({})", calc::qty(done)),
                    ));
                }
                (
                    id,
                    a.version.unwrap_or(old.version),
                    a.ordine.unwrap_or(i(&old, "ordine")),
                )
            }
            None => (Uuid::now_v7(), 0, a.ordine.unwrap_or(book.items.len() as i64 + 1)),
        };
        let f = Self::item_fields(&a, order)?;
        ctx.write(vec![Write::put(ITEMS, id, f).expect(expect)])?;
        Ok(json!({"id": id}))
    }

    fn paste(&self, ctx: &mut ModuleContext<'_>, a: Paste) -> CoreResult<Value> {
        let book = self.book(ctx, a.deviz)?;
        let (rows, refused) = calc::parse_rows(&a.text);
        if rows.len() > 1000 {
            return Err(bad("tabelul", "are mai mult de 1000 de rânduri"));
        }
        if a.confirma && !rows.is_empty() {
            let mut w = Vec::new();
            let start = book.items.len() as i64;
            for (k, r) in rows.iter().enumerate() {
                let item = ItemSave {
                    id: None,
                    version: None,
                    deviz: a.deviz,
                    cod: r.cod.clone(),
                    denumire: r.denumire.clone(),
                    um: r.um.clone(),
                    cantitate: r.cantitate,
                    pret_unitar: r.pret_unitar,
                    ordine: None,
                };
                w.push(Write::put(ITEMS, Uuid::now_v7(), Self::item_fields(&item, start + k as i64 + 1)?).expect(0));
            }
            ctx.write(w)?;
        }
        Ok(json!({
            "randuri": rows.iter().map(|r| json!({"cod": r.cod, "denumire": r.denumire, "um": r.um, "cantitate": r.cantitate, "pret_unitar": r.pret_unitar})).collect::<Vec<_>>(),
            "refuzate": refused.iter().map(|(n, why)| json!({"rand": n, "motiv": why})).collect::<Vec<_>>(),
            "adaugate": if a.confirma { rows.len() } else { 0 },
        }))
    }

    fn statement_new(&self, ctx: &mut ModuleContext<'_>, a: StatementNew) -> CoreResult<Value> {
        let book = self.book(ctx, a.deviz)?;
        if s(&book.estimate, "stare") == "inchis" {
            return Err(bad("devizul", "e închis"));
        }
        let (from, to) = (
            date_ok("începutul perioadei", &a.de_la)?,
            date_ok("sfârșitul perioadei", &a.pana_la)?,
        );
        if to < from {
            return Err(bad("perioada", "se termină înainte să înceapă"));
        }
        // The next number; a cancelled statement's number is not used again.
        let numar = book.statements.iter().map(|r| i(r, "numar")).max().unwrap_or(0) + 1;
        let id = Uuid::now_v7();
        let mut f = Fields::new();
        f.insert("deviz".into(), json!(a.deviz.to_string()));
        f.insert("numar".into(), json!(numar));
        f.insert("de_la".into(), json!(from));
        f.insert("pana_la".into(), json!(to));
        f.insert("data".into(), json!(date_ok("data", &a.data)?));
        f.insert("stare".into(), json!("ciorna"));
        f.insert("motiv_anulare".into(), json!(""));
        f.insert("linii".into(), json!([]));
        f.insert("tva".into(), json!(i(&book.estimate, "tva")));
        f.insert("garantie".into(), json!(i(&book.estimate, "garantie")));
        f.insert("garantie_baza".into(), json!(s(&book.estimate, "garantie_baza")));
        f.insert("nota".into(), json!(""));
        f.insert("creat_ms".into(), json!(now_ms() as i64));
        ctx.write(vec![Write::put(STATEMENTS, id, f).expect(0)])?;
        Ok(json!({"id": id, "numar": numar}))
    }

    fn statement_save(&self, ctx: &mut ModuleContext<'_>, a: StatementSave) -> CoreResult<Value> {
        let st = self.live(ctx, STATEMENTS, a.id, "situația")?;
        if s(&st, "stare") != "ciorna" {
            return Err(bad(
                "situația",
                "e emisă: nu se mai schimbă (o greșeală se anulează, cu motiv)",
            ));
        }
        let book = self.book(
            ctx,
            s(&st, "deviz").parse().map_err(|_| bad("situația", "nu are deviz"))?,
        )?;
        let lines: Vec<(String, i64)> = a
            .linii
            .iter()
            .filter(|l| l.cantitate != 0)
            .map(|l| (l.articol.to_string(), l.cantitate))
            .collect();
        if lines.len() > 1000 {
            return Err(bad("situația", "are mai mult de 1000 de linii"));
        }
        Self::check_lines(&book, Some(&st), &lines)?;
        let mut f = st.fields.clone();
        f.insert(
            "linii".into(),
            json!(
                lines
                    .iter()
                    .map(|(x, q)| json!({"articol": x, "cantitate": q}))
                    .collect::<Vec<_>>()
            ),
        );
        if let Some(d) = &a.de_la {
            f.insert("de_la".into(), json!(date_ok("începutul perioadei", d)?));
        }
        if let Some(d) = &a.pana_la {
            f.insert("pana_la".into(), json!(date_ok("sfârșitul perioadei", d)?));
        }
        if let Some(d) = &a.data {
            f.insert("data".into(), json!(date_ok("data", d)?));
        }
        if let Some(n) = &a.nota {
            f.insert("nota".into(), json!(text("nota", n, 2000, false)?));
        }
        ctx.write(vec![Write::put(STATEMENTS, a.id, f).expect(a.version)])?;
        Ok(json!({"id": a.id}))
    }

    fn statement_issue(&self, ctx: &mut ModuleContext<'_>, a: ByIdVersion) -> CoreResult<Value> {
        let st = self.live(ctx, STATEMENTS, a.id, "situația")?;
        if s(&st, "stare") != "ciorna" {
            return Err(bad("situația", "e deja emisă"));
        }
        let book = self.book(
            ctx,
            s(&st, "deviz").parse().map_err(|_| bad("situația", "nu are deviz"))?,
        )?;
        let lines = lines_of(&st);
        if lines.is_empty() {
            return Err(bad("situația", "nu are nicio cantitate executată"));
        }
        Self::check_lines(&book, Some(&st), &lines)?;
        let mut f = st.fields.clone();
        f.insert("stare".into(), json!("emisa"));
        f.insert("tva".into(), json!(i(&book.estimate, "tva")));
        f.insert("garantie".into(), json!(i(&book.estimate, "garantie")));
        f.insert("garantie_baza".into(), json!(s(&book.estimate, "garantie_baza")));
        ctx.write(vec![Write::put(STATEMENTS, a.id, f).expect(a.version)])?;
        ctx.log(&format!("situația {} nr. {} emisă", a.id, i(&st, "numar")));
        Ok(json!({"id": a.id, "numar": i(&st, "numar")}))
    }

    fn view(&self, ctx: &mut ModuleContext<'_>, id: Uuid) -> CoreResult<(Book, Value)> {
        let st = self.live(ctx, STATEMENTS, id, "situația")?;
        let book = self.book(
            ctx,
            s(&st, "deviz").parse().map_err(|_| bad("situația", "nu are deviz"))?,
        )?;
        let v = self.statement_view(&book, &st);
        Ok((book, v))
    }

    fn statement_pdf(&self, ctx: &mut ModuleContext<'_>, a: Export) -> CoreResult<Value> {
        let (book, v) = self.view(ctx, a.id)?;
        let e = &book.estimate;
        let lines: Vec<Value> = v["linii"]
            .as_array()
            .map(|l| {
                l.iter()
                    .map(|x| {
                        let n = |k: &str| x[k].as_i64().unwrap_or_default();
                        json!({
                            "cod": x["cod"], "denumire": x["denumire"], "um": x["um"], "pret": calc::lei(n("pret_unitar")),
                            "deviz": calc::qty(n("deviz")), "anterior": calc::qty(n("anterior")), "curent": calc::qty(n("curent")),
                            "cumulat": calc::qty(n("cumulat")), "rest": calc::qty(n("rest")),
                            "val_curent": calc::lei(x["valoare_curent"].as_f64().unwrap_or_default().round() as i64),
                            "val_cumulat": calc::lei(x["valoare_cumulat"].as_f64().unwrap_or_default().round() as i64),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();
        let pct = |x: i64| format!("{},{:02}", x / 100, x % 100);
        let mut title = v["numar"].to_string();
        if v["stare"] == "anulata" {
            title = format!(
                "{title} — ANULATĂ ({})",
                s(
                    &book
                        .statements
                        .iter()
                        .find(|x| x.id == a.id)
                        .cloned()
                        .unwrap_or_else(|| e.clone()),
                    "motiv_anulare"
                )
            );
        } else if v["stare"] == "ciorna" {
            title = format!("{title} — CIORNĂ");
        }
        let data = json!({
            "numar": title, "de_la": ro(v["de_la"].as_str().unwrap_or_default()), "pana_la": ro(v["pana_la"].as_str().unwrap_or_default()),
            "data": ro(v["data"].as_str().unwrap_or_default()), "executant": a.executant.trim(), "beneficiar": s(e, "beneficiar_nume"),
            "deviz": format!("{} {}", s(e, "nume"), s(e, "numar")).trim(), "contract": s(e, "contract_text"), "santier": s(e, "santier"),
            "linii": lines, "valoare": calc::lei(v["valoare"].as_i64().unwrap_or_default()), "tva_pct": v["tva"].to_string(),
            "tva": calc::lei(v["tva_valoare"].as_i64().unwrap_or_default()), "garantie_pct": pct(v["garantie"].as_i64().unwrap_or_default()),
            "garantie_baza": if v["garantie_baza"] == "cu_tva" { "calculată pe valoarea cu TVA" } else { "calculată pe valoarea fără TVA" },
            "retinere": calc::lei(v["retinere"].as_i64().unwrap_or_default()), "de_plata": calc::lei(v["de_plata"].as_i64().unwrap_or_default()),
        });
        let bytes = pdf::render(&data).map_err(|e| bad("PDF-ul", e))?;
        ctx.export_bytes(&a.dest, &bytes, true)?;
        Ok(json!({"salvat": a.dest, "octeti": bytes.len()}))
    }

    fn xlsx(&self, rows: &[Vec<Value>], head: &[&str], title: &str) -> Result<Vec<u8>, String> {
        use rust_xlsxwriter::{Format, Workbook};
        let mut wb = Workbook::new();
        let bold = Format::new().set_bold();
        let ws = wb.add_worksheet();
        ws.set_name(title.chars().take(31).collect::<String>())
            .map_err(|e| e.to_string())?;
        for (c, h) in head.iter().enumerate() {
            ws.write_string_with_format(0, c as u16, *h, &bold)
                .map_err(|e| e.to_string())?;
        }
        for (r, row) in rows.iter().enumerate() {
            for (c, v) in row.iter().enumerate() {
                let (r, c) = (r as u32 + 1, c as u16);
                match v {
                    Value::Number(n) => ws.write_number(r, c, n.as_f64().unwrap_or_default()).map(|_| ()),
                    other => ws.write_string(r, c, other.as_str().unwrap_or_default()).map(|_| ()),
                }
                .map_err(|e| e.to_string())?;
            }
        }
        ws.set_column_width(1, 40).map_err(|e| e.to_string())?;
        wb.save_to_buffer().map_err(|e| e.to_string())
    }

    fn statement_xlsx(&self, ctx: &mut ModuleContext<'_>, a: Export) -> CoreResult<Value> {
        let (_, v) = self.view(ctx, a.id)?;
        let q = |x: &Value, k: &str| json!(x[k].as_i64().unwrap_or_default() as f64 / 1000.0);
        let lei = |x: f64| json!((x / 100.0 * 100.0).round() / 100.0);
        let mut rows: Vec<Vec<Value>> = v["linii"]
            .as_array()
            .map(|l| {
                l.iter()
                    .map(|x| {
                        vec![
                            x["cod"].clone(),
                            x["denumire"].clone(),
                            x["um"].clone(),
                            lei(x["pret_unitar"].as_i64().unwrap_or_default() as f64),
                            q(x, "deviz"),
                            q(x, "anterior"),
                            q(x, "curent"),
                            q(x, "cumulat"),
                            q(x, "rest"),
                            lei(x["valoare_curent"].as_f64().unwrap_or_default()),
                            lei(x["valoare_cumulat"].as_f64().unwrap_or_default()),
                        ]
                    })
                    .collect()
            })
            .unwrap_or_default();
        for (label, k) in [
            ("Valoare fără TVA", "valoare"),
            ("TVA", "tva_valoare"),
            ("Reținere de garanție", "retinere"),
            ("De plată", "de_plata"),
        ] {
            let mut r = vec![json!(""); 11];
            r[1] = json!(label);
            r[9] = lei(v[k].as_i64().unwrap_or_default() as f64);
            rows.push(r);
        }
        let head = [
            "Cod",
            "Denumire",
            "UM",
            "Preț unitar",
            "Deviz",
            "Anterior",
            "Curent",
            "Cumulat",
            "Rest",
            "Valoare curentă",
            "Valoare cumulată",
        ];
        let bytes = self
            .xlsx(&rows, &head, &format!("Situatia {}", v["numar"]))
            .map_err(|e| bad("exportul .xlsx", e))?;
        ctx.export_bytes(&a.dest, &bytes, true)?;
        Ok(json!({"salvat": a.dest}))
    }

    fn estimate_xlsx(&self, ctx: &mut ModuleContext<'_>, a: Export) -> CoreResult<Value> {
        let book = self.book(ctx, a.id)?;
        let rows: Vec<Vec<Value>> = book
            .items
            .iter()
            .map(|it| {
                let qd = book.quantity.get(&it.id.to_string()).copied().unwrap_or_default();
                let p = i(it, "pret_unitar");
                vec![
                    json!(s(it, "cod")),
                    json!(s(it, "denumire")),
                    json!(s(it, "um")),
                    json!(qd as f64 / 1000.0),
                    json!(p as f64 / 100.0),
                    json!(((qd as f64 * p as f64 / 1000.0).round()) / 100.0),
                ]
            })
            .collect();
        let bytes = self
            .xlsx(
                &rows,
                &["Cod", "Denumire", "UM", "Cantitate", "Preț unitar", "Valoare"],
                "Deviz",
            )
            .map_err(|e| bad("exportul .xlsx", e))?;
        ctx.export_bytes(&a.dest, &bytes, true)?;
        Ok(json!({"salvat": a.dest}))
    }
}

impl Module for Works {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "parteneri" => {
                let a: PartnerSearch = args(command, a)?;
                Ok(json!(
                    ctx.partners_search(&a.text, 30)?
                        .iter()
                        .map(|p| json!({"id": p.id, "denumire": p.denumire, "cui": p.cui}))
                        .collect::<Vec<_>>()
                ))
            }
            "devize" => {
                let mut l = ctx.scan(ESTIMATES, |r| !r.deleted)?;
                l.sort_by_key(|r| std::cmp::Reverse(s(r, "data")));
                Ok(json!(
                    l.iter()
                        .map(|r| {
                            let mut v = Value::Object(r.fields.clone());
                            v["id"] = json!(r.id);
                            v["version"] = json!(r.version);
                            v
                        })
                        .collect::<Vec<_>>()
                ))
            }
            "deviz" => {
                let a: ById = args(command, a)?;
                let book = self.book(ctx, a.id)?;
                let issued = Self::previous(&book, None);
                let mut v = Value::Object(book.estimate.fields.clone());
                v["id"] = json!(book.estimate.id);
                v["version"] = json!(book.estimate.version);
                let mut total = 0.0;
                v["articole"] = json!(
                    book.items
                        .iter()
                        .map(|it| {
                            let id = it.id.to_string();
                            let qd = book.quantity.get(&id).copied().unwrap_or_default();
                            total += qd as f64 * i(it, "pret_unitar") as f64 / 1000.0;
                            json!({
                                "id": it.id, "version": it.version, "cod": s(it, "cod"), "denumire": s(it, "denumire"), "um": s(it, "um"),
                                "cantitate": i(it, "cantitate"), "pret_unitar": i(it, "pret_unitar"), "ordine": i(it, "ordine"),
                                "cantitate_deviz": qd, "executat": issued.get(&id).copied().unwrap_or_default(),
                                "suplimentari": book.supplements.iter().filter(|x| s(x, "articol") == id)
                                    .map(|x| json!({"cantitate": i(x, "cantitate"), "motiv": s(x, "motiv"), "data": s(x, "data")})).collect::<Vec<_>>(),
                            })
                        })
                        .collect::<Vec<_>>()
                );
                v["valoare_deviz"] = json!(total.round() as i64);
                v["situatii"] = json!(book.statements.iter().map(|st| {
                    let x = self.statement_view(&book, st);
                    json!({"id": x["id"], "version": x["version"], "numar": x["numar"], "de_la": x["de_la"], "pana_la": x["pana_la"],
                        "stare": x["stare"], "motiv_anulare": x["motiv_anulare"], "valoare": x["valoare"], "de_plata": x["de_plata"],
                        "numar_dublu": x["numar_dublu"], "depasire": x["depasire"]})
                }).collect::<Vec<_>>());
                Ok(v)
            }
            "deviz_save" => self.estimate_save(ctx, args(command, a)?),
            "deviz_stare" => {
                let a: StateSet = args(command, a)?;
                if !matches!(a.stare.as_str(), "ciorna" | "aprobat" | "inchis") {
                    return Err(bad("starea", format!("„{}” nu există", a.stare)));
                }
                let old = self.live(ctx, ESTIMATES, a.id, "devizul")?;
                let mut f = old.fields.clone();
                f.insert("stare".into(), json!(a.stare));
                ctx.write(vec![Write::put(ESTIMATES, a.id, f).expect(a.version)])?;
                Ok(json!({"id": a.id, "stare": a.stare}))
            }
            "deviz_delete" => {
                let a: ByIdVersion = args(command, a)?;
                let book = self.book(ctx, a.id)?;
                if book.statements.iter().any(|st| s(st, "stare") != "ciorna") {
                    return Err(bad("devizul", "are situații emise: nu se șterge, se închide"));
                }
                let mut w = vec![Write::delete(ESTIMATES, a.id).expect(a.version)];
                for r in book.items.iter().chain(&book.supplements).chain(&book.statements) {
                    let c = if book.items.iter().any(|x| x.id == r.id) {
                        ITEMS
                    } else if book.supplements.iter().any(|x| x.id == r.id) {
                        SUPPLEMENTS
                    } else {
                        STATEMENTS
                    };
                    w.push(Write::delete(c, r.id).expect(r.version));
                }
                ctx.write(w)?;
                Ok(json!({"deleted": a.id}))
            }
            "articol_save" => self.item_save(ctx, args(command, a)?),
            "articol_delete" => {
                let a: ByIdVersion = args(command, a)?;
                let it = self.live(ctx, ITEMS, a.id, "articolul")?;
                let book = self.book(
                    ctx,
                    s(&it, "deviz").parse().map_err(|_| bad("articolul", "nu are deviz"))?,
                )?;
                let key = a.id.to_string();
                if book
                    .statements
                    .iter()
                    .any(|st| lines_of(st).iter().any(|(x, _)| *x == key))
                {
                    return Err(bad("articolul", "e într-o situație: nu se șterge"));
                }
                let mut w = vec![Write::delete(ITEMS, a.id).expect(a.version)];
                for sp in book.supplements.iter().filter(|x| s(x, "articol") == key) {
                    w.push(Write::delete(SUPPLEMENTS, sp.id).expect(sp.version));
                }
                ctx.write(w)?;
                Ok(json!({"deleted": a.id}))
            }
            "articole_lipire" => self.paste(ctx, args(command, a)?),
            "suplimentare_save" => {
                let a: SupplementSave = args(command, a)?;
                self.live(ctx, ITEMS, a.articol, "articolul")?;
                if !(1..=1_000_000_000_000).contains(&a.cantitate) {
                    return Err(bad("suplimentarea", "are o cantitate pozitivă"));
                }
                let mut f = Fields::new();
                f.insert("articol".into(), json!(a.articol.to_string()));
                f.insert("cantitate".into(), json!(a.cantitate));
                f.insert(
                    "motiv".into(),
                    json!(text("motivul suplimentării", &a.motiv, 500, true)?),
                );
                f.insert("data".into(), json!(date_ok("data", &a.data)?));
                f.insert("creat_ms".into(), json!(now_ms() as i64));
                let id = Uuid::now_v7();
                ctx.write(vec![Write::put(SUPPLEMENTS, id, f).expect(0)])?;
                Ok(json!({"id": id}))
            }
            "situatie_noua" => self.statement_new(ctx, args(command, a)?),
            "situatie_save" => self.statement_save(ctx, args(command, a)?),
            "situatie_emite" => self.statement_issue(ctx, args(command, a)?),
            "situatie_anulare" => {
                let a: Cancel = args(command, a)?;
                let st = self.live(ctx, STATEMENTS, a.id, "situația")?;
                if s(&st, "stare") != "emisa" {
                    return Err(bad("situația", "se anulează doar una emisă (o ciornă se șterge)"));
                }
                let mut f = st.fields.clone();
                f.insert("stare".into(), json!("anulata"));
                f.insert(
                    "motiv_anulare".into(),
                    json!(text("motivul anulării", &a.motiv, 500, true)?),
                );
                ctx.write(vec![Write::put(STATEMENTS, a.id, f).expect(a.version)])?;
                ctx.log(&format!("situația {} nr. {} anulată", a.id, i(&st, "numar")));
                Ok(json!({"id": a.id}))
            }
            "situatie_delete" => {
                let a: ByIdVersion = args(command, a)?;
                let st = self.live(ctx, STATEMENTS, a.id, "situația")?;
                if s(&st, "stare") != "ciorna" {
                    return Err(bad("situația", "e emisă: nu se șterge, se anulează cu motiv"));
                }
                ctx.write(vec![Write::delete(STATEMENTS, a.id).expect(a.version)])?;
                Ok(json!({"deleted": a.id}))
            }
            "situatie" => {
                let a: ById = args(command, a)?;
                Ok(self.view(ctx, a.id)?.1)
            }
            "situatie_pdf" => self.statement_pdf(ctx, args(command, a)?),
            "situatie_xlsx" => self.statement_xlsx(ctx, args(command, a)?),
            "deviz_xlsx" => self.estimate_xlsx(ctx, args(command, a)?),
            other => Err(CoreError::invalid("comanda", format!("„{other}” nu există în {ID}"))),
        }
    }
}
