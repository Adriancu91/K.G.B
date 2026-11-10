//! Partner directory (Etapa 7, step 7.4a; D-066): one card per client or
//! supplier, shared by every module through the core.
//!
//! - Base data (name, CUI checked with its control digit, trade register
//!   number, address, contact, bank), **work points**, **documents with
//!   dates** (an environmental permit with its yearly review, a transport
//!   licence…) and **extra fields** the user adds by hand.
//! - Where each value came from is kept per field: `anaf`, `document`,
//!   `manual` (with the day), so a card shows what was checked.
//! - Documents with an expiry date send reminders (30 and 7 days before, on
//!   the day, then once a week for a month), once each.
//! - Search and suggestions match the beginning of any word of the name, the
//!   CUI, or any extra value, so typing in a document field can offer a card.
//! - In an organization the directory travels to every PC; any active person
//!   whose role can write somewhere may change it (it is shared work data).

use std::collections::BTreeMap;

use kgb_store::{Fields, RecordState, Store, Write};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::workspace::{Workspace, now_ms, validate_name};

pub const PARTNERS_COLLECTION: &str = "core.partners";
/// The pseudo-module name used for notifications and the audit journal.
pub const PARTNERS_SOURCE: &str = "core.partners";

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("partenerul", detail)
}

/// Romanian CUI/CIF check digit (one rule for the app, 7.4m-2: crate::ids).
pub use crate::ids::cui_valid;

/// The CUI without `RO` and spaces (for comparing and searching).
pub fn cui_digits(cui: &str) -> String {
    cui.to_uppercase().chars().filter(char::is_ascii_digit).collect()
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct WorkPoint {
    pub denumire: String,
    #[serde(default)]
    pub adresa: String,
    #[serde(default)]
    pub contact: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct PartnerDoc {
    /// e.g. „Autorizație de mediu”, „Licență de transport”.
    pub tip: String,
    #[serde(default)]
    pub numar: String,
    #[serde(default)]
    pub emis: String,
    /// Expiry or next review (`aaaa-ll-zz`); reminders are sent before it.
    #[serde(default)]
    pub expira: String,
    #[serde(default)]
    pub nota: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ExtraField {
    pub nume: String,
    pub valoare: String,
}

/// A card as the screen and modules see it.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Partner {
    #[serde(default)]
    pub id: Option<Uuid>,
    #[serde(default)]
    pub version: u64,
    /// "client", "furnizor" or "ambele".
    #[serde(default = "both")]
    pub tip: String,
    pub denumire: String,
    #[serde(default)]
    pub cui: String,
    #[serde(default)]
    pub nr_reg_com: String,
    #[serde(default)]
    pub sediu: String,
    #[serde(default)]
    pub localitate: String,
    #[serde(default)]
    pub judet: String,
    #[serde(default)]
    pub tara: String,
    #[serde(default)]
    pub telefon: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub iban: String,
    #[serde(default)]
    pub banca: String,
    #[serde(default)]
    pub reprezentant: String,
    #[serde(default)]
    pub functie_reprezentant: String,
    #[serde(default)]
    pub platitor_tva: Option<bool>,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub puncte_lucru: Vec<WorkPoint>,
    #[serde(default)]
    pub documente: Vec<PartnerDoc>,
    #[serde(default)]
    pub campuri: Vec<ExtraField>,
    /// Field name → where its value came from: {"sursa": "anaf"|"document"|"manual", "data": "aaaa-ll-zz"}.
    #[serde(default)]
    pub surse: BTreeMap<String, Value>,
    #[serde(default)]
    pub activ: Option<bool>,
}

fn both() -> String {
    "ambele".into()
}

fn valid_date(d: &str) -> bool {
    let b = d.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && d[..4].parse::<u32>().is_ok_and(|y| (1900..=2200).contains(&y))
        && d[5..7].parse::<u32>().is_ok_and(|m| (1..=12).contains(&m))
        && d[8..].parse::<u32>().is_ok_and(|x| (1..=31).contains(&x))
}

fn text(what: &str, s: &str, max: usize) -> CoreResult<String> {
    let t = s.trim();
    if t.chars().count() > max {
        return Err(bad(format!("{what} are mai mult de {max} de caractere")));
    }
    if t.chars().any(|c| c.is_control() && c != '\n') {
        return Err(bad(format!("{what} conține caractere de control")));
    }
    Ok(t.to_string())
}

fn from(r: &RecordState) -> Partner {
    let mut f = r.fields.clone();
    // Stored-only bookkeeping, not part of the card the screen edits.
    f.remove("actualizat_ms");
    let mut p: Partner = serde_json::from_value(Value::Object(f)).unwrap_or_else(|e| {
        tracing::warn!("partner card {} unreadable: {e}", r.id);
        Partner {
            denumire: "(fișă ilizibilă)".into(),
            ..Partner::default()
        }
    });
    p.id = Some(r.id);
    p.version = r.version;
    p
}

/// Cleans and checks a card; returns the stored fields.
fn fields(p: &Partner) -> CoreResult<Fields> {
    let mut c = p.clone();
    c.denumire = validate_name("denumirea partenerului", &p.denumire)?;
    if !["client", "furnizor", "ambele"].contains(&c.tip.as_str()) {
        return Err(bad("tipul trebuie să fie client, furnizor sau ambele"));
    }
    // Stored without spaces anywhere (7.4m-2), as the check reads it.
    c.cui = crate::ids::cui_clean(&p.cui);
    if !c.cui.is_empty() && !cui_valid(&c.cui) {
        return Err(bad(format!(
            "CUI-ul „{}” nu e valid (cifra de control nu se potrivește)",
            c.cui
        )));
    }
    for (what, v, max) in [
        ("nr. Registrul Comerțului", &mut c.nr_reg_com, 40),
        ("sediul", &mut c.sediu, 300),
        ("localitatea", &mut c.localitate, 100),
        ("județul", &mut c.judet, 60),
        ("țara", &mut c.tara, 60),
        ("telefonul", &mut c.telefon, 60),
        ("e-mailul", &mut c.email, 200),
        ("IBAN-ul", &mut c.iban, 40),
        ("banca", &mut c.banca, 120),
        ("reprezentantul", &mut c.reprezentant, 120),
        ("funcția reprezentantului", &mut c.functie_reprezentant, 120),
        ("notele", &mut c.note, 4000),
    ] {
        *v = text(what, v, max)?;
    }
    // Stored without spaces; a wrong IBAN is not refused (older cards), the page warns (crate::ids::iban_valid).
    c.iban = crate::ids::compact(&c.iban);
    if c.puncte_lucru.len() > 50 || c.documente.len() > 100 || c.campuri.len() > 100 {
        return Err(bad("prea multe puncte de lucru, documente sau câmpuri"));
    }
    c.puncte_lucru
        .retain(|w| !w.denumire.trim().is_empty() || !w.adresa.trim().is_empty());
    for w in &mut c.puncte_lucru {
        w.denumire = text("punctul de lucru", &w.denumire, 200)?;
        w.adresa = text("adresa punctului de lucru", &w.adresa, 300)?;
        w.contact = text("contactul punctului de lucru", &w.contact, 200)?;
    }
    c.documente
        .retain(|d| !d.tip.trim().is_empty() || !d.numar.trim().is_empty());
    for d in &mut c.documente {
        d.tip = text("tipul documentului", &d.tip, 120)?;
        if d.tip.is_empty() {
            return Err(bad("un document nu are tip (de ex. „Autorizație de mediu”)"));
        }
        d.numar = text("numărul documentului", &d.numar, 120)?;
        d.nota = text("nota documentului", &d.nota, 500)?;
        for (what, v) in [("data emiterii", &d.emis), ("data expirării/revizuirii", &d.expira)] {
            if !v.is_empty() && !valid_date(v) {
                return Err(bad(format!("{what} pentru „{}” trebuie să fie AAAA-LL-ZZ", d.tip)));
            }
        }
    }
    c.campuri.retain(|f| !f.nume.trim().is_empty());
    for f in &mut c.campuri {
        f.nume = text("numele câmpului", &f.nume, 80)?;
        f.valoare = text("valoarea câmpului", &f.valoare, 1000)?;
    }
    c.activ = Some(c.activ.unwrap_or(true));
    let mut v = serde_json::to_value(&c).map_err(|e| bad(e.to_string()))?;
    let o = v.as_object_mut().expect("object");
    o.remove("id");
    o.remove("version");
    o.insert("actualizat_ms".into(), json!(now_ms()));
    Ok(o.clone())
}

pub fn list(store: &Store, include_inactive: bool) -> CoreResult<Vec<Partner>> {
    let mut v: Vec<Partner> = store
        .scan(PARTNERS_COLLECTION, |_| true)?
        .iter()
        .map(from)
        .filter(|p| include_inactive || p.activ != Some(false))
        .collect();
    v.sort_by_key(|p| p.denumire.to_lowercase());
    Ok(v)
}

pub fn get(store: &Store, id: Uuid) -> CoreResult<Partner> {
    store
        .get(PARTNERS_COLLECTION, id)?
        .map(|r| from(&r))
        .ok_or_else(|| bad("nu există"))
}

/// Adds or changes a card. Two cards with the same CUI are refused.
pub fn save(store: &mut Store, p: Partner) -> CoreResult<Uuid> {
    let f = fields(&p)?;
    let id = p.id.unwrap_or_else(Uuid::new_v4);
    let cui = cui_digits(f.get("cui").and_then(Value::as_str).unwrap_or(""));
    if !cui.is_empty()
        && let Some(dup) = list(store, true)?
            .into_iter()
            .find(|o| o.id != Some(id) && cui_digits(&o.cui) == cui)
    {
        return Err(bad(format!("CUI-ul există deja la „{}”", dup.denumire)));
    }
    store.write(vec![Write::put(PARTNERS_COLLECTION, id, f).expect(if p.id.is_some() {
        p.version
    } else {
        0
    })])?;
    Ok(id)
}

/// What `remember` did with a card.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Remembered {
    pub id: Uuid,
    /// A new card was made.
    pub noua: bool,
    /// Fields filled in or added on an existing card.
    pub completate: Vec<String>,
    /// Fields where the card already had another value; left as they were.
    pub diferite: Vec<String>,
}

/// Keeps what was typed in a form (a document, an invoice partner) in the
/// directory, for next time (step 7.4c). The card is found by CUI, else by
/// the exact name (without diacritics); a missing one is made. On an existing
/// card only empty fields are filled and new extra fields added: a value the
/// card already has is never overwritten from a form (it is reported in
/// `diferite`; the card is changed on the „Parteneri” page). Hidden cards
/// are found too and stay hidden.
pub fn remember(store: &mut Store, input: Partner, sursa: &str, azi: &str) -> CoreResult<Remembered> {
    if input.denumire.trim().is_empty() {
        return Err(bad("lipsește denumirea"));
    }
    let digits = cui_digits(&input.cui);
    let name = fold(input.denumire.trim());
    let all = list(store, true)?;
    let found = all
        .iter()
        .find(|o| !digits.is_empty() && cui_digits(&o.cui) == digits)
        .or_else(|| {
            all.iter()
                .find(|o| fold(o.denumire.trim()) == name && (digits.is_empty() || o.cui.trim().is_empty()))
        })
        .cloned();
    let mark = json!({"sursa": sursa, "data": azi});
    let Some(mut card) = found else {
        let mut p = input;
        p.id = None;
        p.version = 0;
        p.activ = Some(true);
        let filled: Vec<String> = base_values(&p)
            .into_iter()
            .filter(|(_, v)| !v.trim().is_empty())
            .map(|(k, _)| k.to_string())
            .collect();
        for k in &filled {
            p.surse.insert(k.clone(), mark.clone());
        }
        let id = save(store, p)?;
        return Ok(Remembered {
            id,
            noua: true,
            completate: filled,
            diferite: vec![],
        });
    };
    let mut done = Vec::new();
    let mut differ = Vec::new();
    {
        let new_vals = base_values(&input)
            .into_iter()
            .map(|(k, v)| (k, v.trim().to_string()))
            .collect::<Vec<_>>();
        for (k, v) in new_vals {
            if v.is_empty() {
                continue;
            }
            let slot = base_slot(&mut card, k);
            if slot.trim().is_empty() {
                *slot = v;
                card.surse.insert(k.to_string(), mark.clone());
                done.push(k.to_string());
            } else if fold(slot.trim()) != fold(&v) {
                differ.push(k.to_string());
            }
        }
    }
    for f in input
        .campuri
        .into_iter()
        .filter(|f| !f.nume.trim().is_empty() && !f.valoare.trim().is_empty())
    {
        match card
            .campuri
            .iter_mut()
            .find(|c| fold(c.nume.trim()) == fold(f.nume.trim()))
        {
            Some(c) if c.valoare.trim().is_empty() => {
                c.valoare = f.valoare.trim().to_string();
                done.push(f.nume.trim().to_string());
            }
            Some(c) if fold(c.valoare.trim()) != fold(f.valoare.trim()) => differ.push(f.nume.trim().to_string()),
            Some(_) => {}
            None => {
                done.push(f.nume.trim().to_string());
                card.campuri.push(ExtraField {
                    nume: f.nume.trim().into(),
                    valoare: f.valoare.trim().into(),
                });
            }
        }
    }
    for w in input
        .puncte_lucru
        .into_iter()
        .filter(|w| !(w.denumire.trim().is_empty() && w.adresa.trim().is_empty()))
    {
        let same = |o: &WorkPoint| {
            fold(o.adresa.trim()) == fold(w.adresa.trim()) && fold(o.denumire.trim()) == fold(w.denumire.trim())
        };
        if !card.puncte_lucru.iter().any(same) {
            card.puncte_lucru.push(w);
            done.push("puncte_lucru".into());
        }
    }
    let id = card.id.ok_or_else(|| bad("fișa nu are id"))?;
    if !done.is_empty() {
        save(store, card)?;
    }
    Ok(Remembered {
        id,
        noua: false,
        completate: done,
        diferite: differ,
    })
}

fn base_values(p: &Partner) -> Vec<(&'static str, String)> {
    vec![
        ("cui", p.cui.clone()),
        ("nr_reg_com", p.nr_reg_com.clone()),
        ("sediu", p.sediu.clone()),
        ("localitate", p.localitate.clone()),
        ("judet", p.judet.clone()),
        ("tara", p.tara.clone()),
        ("telefon", p.telefon.clone()),
        ("email", p.email.clone()),
        ("iban", p.iban.clone()),
        ("banca", p.banca.clone()),
        ("reprezentant", p.reprezentant.clone()),
        ("functie_reprezentant", p.functie_reprezentant.clone()),
    ]
}

fn base_slot<'a>(p: &'a mut Partner, k: &str) -> &'a mut String {
    match k {
        "cui" => &mut p.cui,
        "nr_reg_com" => &mut p.nr_reg_com,
        "sediu" => &mut p.sediu,
        "localitate" => &mut p.localitate,
        "judet" => &mut p.judet,
        "tara" => &mut p.tara,
        "telefon" => &mut p.telefon,
        "email" => &mut p.email,
        "iban" => &mut p.iban,
        "banca" => &mut p.banca,
        "reprezentant" => &mut p.reprezentant,
        _ => &mut p.functie_reprezentant,
    }
}

/// Hides a card (kept for documents that refer to it).
pub fn set_active(store: &mut Store, id: Uuid, active: bool) -> CoreResult<()> {
    let mut p = get(store, id)?;
    p.activ = Some(active);
    store.write(vec![Write::put(PARTNERS_COLLECTION, id, fields(&p)?).expect(p.version)])?;
    Ok(())
}

fn words(s: &str) -> impl Iterator<Item = String> + '_ {
    s.split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .map(fold)
}

/// Lowercase without Romanian diacritics, for matching.
pub fn fold(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| match c {
            'ă' | 'â' => 'a',
            'î' => 'i',
            'ș' | 'ş' => 's',
            'ț' | 'ţ' => 't',
            _ => c,
        })
        .collect()
}

/// Cards matching `query`: the beginning of a word of the name, the CUI
/// digits, or the beginning of any other value. Name matches come first.
pub fn search(store: &Store, query: &str, limit: usize) -> CoreResult<Vec<Partner>> {
    let q = fold(query.trim());
    if q.is_empty() {
        return Ok(list(store, false)?.into_iter().take(limit).collect());
    }
    let qd = cui_digits(&q);
    let mut scored: Vec<(u8, Partner)> = list(store, false)?
        .into_iter()
        .filter_map(|p| {
            let name = fold(&p.denumire);
            let score = if name.starts_with(&q) {
                0
            } else if words(&p.denumire).any(|w| w.starts_with(&q)) {
                1
            } else if !qd.is_empty() && qd.len() >= 2 && cui_digits(&p.cui).starts_with(&qd) {
                2
            } else if [
                &p.nr_reg_com,
                &p.sediu,
                &p.localitate,
                &p.email,
                &p.telefon,
                &p.reprezentant,
            ]
            .iter()
            .any(|v| fold(v).starts_with(&q) || words(v).any(|w| w.starts_with(&q)))
                || p.campuri.iter().any(|f| fold(&f.valoare).starts_with(&q))
                || p.puncte_lucru.iter().any(|w| fold(&w.denumire).starts_with(&q))
            {
                3
            } else {
                return None;
            };
            Some((score, p))
        })
        .collect();
    scored.sort_by(|a, b| {
        a.0.cmp(&b.0)
            .then(a.1.denumire.to_lowercase().cmp(&b.1.denumire.to_lowercase()))
    });
    Ok(scored.into_iter().take(limit).map(|(_, p)| p).collect())
}

/// Days since 1970-01-01.
fn day(d: &str) -> Option<i64> {
    if !valid_date(d) {
        return None;
    }
    let (y, m, dd): (i64, i64, i64) = (d[..4].parse().ok()?, d[5..7].parse().ok()?, d[8..].parse().ok()?);
    let y2 = if m <= 2 { y - 1 } else { y };
    let era = y2.div_euclid(400);
    let yoe = y2 - era * 400;
    let doy = (153 * ((m + 9) % 12) + 2) / 5 + dd - 1;
    Some(era * 146_097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719_468)
}

/// A document that expires soon or has expired.
#[derive(Clone, Debug, Serialize)]
pub struct Expiring {
    pub partener: Uuid,
    pub denumire: String,
    pub tip: String,
    pub numar: String,
    pub expira: String,
    /// Days left (negative: expired).
    pub zile: i64,
}

/// Documents expiring within `days` (or already expired), soonest first.
pub fn expiring(store: &Store, today: &str, days: i64) -> CoreResult<Vec<Expiring>> {
    let t = day(today).ok_or_else(|| bad(format!("„{today}” nu e o dată")))?;
    let mut out = Vec::new();
    for p in list(store, false)? {
        for d in &p.documente {
            if let Some(e) = day(&d.expira)
                && e - t <= days
            {
                out.push(Expiring {
                    partener: p.id.unwrap_or_default(),
                    denumire: p.denumire.clone(),
                    tip: d.tip.clone(),
                    numar: d.numar.clone(),
                    expira: d.expira.clone(),
                    zile: e - t,
                });
            }
        }
    }
    out.sort_by_key(|x| x.zile);
    Ok(out)
}

/// Reminders for partner documents: 30 and 7 days before, on the day, and
/// once a week for four weeks after; each only once (core notification keys).
pub fn remind(ws: &mut Workspace, today: &str) -> CoreResult<usize> {
    use crate::notifications::{self, Level, Notice};
    let mut sent = 0;
    for x in expiring(ws.store(), today, 30)? {
        let (stage, level) = match x.zile {
            30 => ("30", Level::Info),
            7 => ("7", Level::Atentie),
            0 => ("0", Level::Urgent),
            n if (-28..0).contains(&n) && n % 7 == 0 => ("dupa", Level::Urgent),
            _ => continue,
        };
        let key = format!("doc:{}:{}:{}:{}:{}", x.partener, x.tip, x.expira, stage, x.zile);
        let date = format!("{}.{}.{}", &x.expira[8..], &x.expira[5..7], &x.expira[..4]);
        let title = match x.zile {
            0 => format!("Expiră azi: {} — {}", x.tip, x.denumire),
            n if n < 0 => format!("Expirat: {} — {}", x.tip, x.denumire),
            n => format!("Expiră în {n} zile: {} — {}", x.tip, x.denumire),
        };
        let text = format!(
            "{}{} · data {date}",
            x.tip,
            if x.numar.is_empty() {
                String::new()
            } else {
                format!(" nr. {}", x.numar)
            }
        );
        let (_, new) = notifications::send(ws, PARTNERS_SOURCE, &Notice::new(title, text).level(level).key(key))?;
        if new {
            sent += 1;
        }
    }
    Ok(sent)
}

/// Columns of the partner import model (step 7.4j), in order.
pub const IMPORT_COLUMNS: &[&str] = &[
    "Denumire",
    "Tip",
    "CUI",
    "Nr. Reg. Com.",
    "Sediu",
    "Localitate",
    "Județ",
    "Țara",
    "Telefon",
    "E-mail",
    "IBAN",
    "Banca",
    "Reprezentant",
    "Funcția reprezentantului",
    "Note",
];

/// What an import did.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct ImportReport {
    pub adaugate: usize,
    pub completate: usize,
    pub neschimbate: usize,
    /// (row number as in the file, why it was skipped).
    pub erori: Vec<(usize, String)>,
}

/// Imports partners from a table (first row = headers, matched by name
/// without diacritics; unknown columns become extra fields). Each row goes
/// through [`remember`]: new cards are made, existing ones only get their
/// empty fields filled; a bad row is reported and skipped, the others go in.
pub fn import_rows(store: &mut Store, rows: &[Vec<String>], azi: &str) -> CoreResult<ImportReport> {
    let mut rep = ImportReport::default();
    let Some(head) = rows.first() else {
        return Err(bad("tabelul e gol"));
    };
    if rows.len() > 5001 {
        return Err(bad("cel mult 5000 de rânduri într-un import"));
    }
    let key = |h: &str| fold(h).replace(['.', ' ', '-'], "");
    let known: Vec<String> = IMPORT_COLUMNS.iter().map(|c| key(c)).collect();
    let cols: Vec<Option<usize>> = head.iter().map(|h| known.iter().position(|k| *k == key(h))).collect();
    if !cols.contains(&Some(0)) {
        return Err(bad("lipsește coloana „Denumire” (descarcă modelul de import)"));
    }
    for (i, row) in rows.iter().enumerate().skip(1) {
        let line = i + 1;
        if row.iter().all(|c| c.trim().is_empty()) {
            continue;
        }
        let mut p = Partner {
            tip: "ambele".into(),
            activ: Some(true),
            ..Partner::default()
        };
        for (c, cell) in row.iter().enumerate() {
            let v = cell.trim().to_string();
            if v.is_empty() {
                continue;
            }
            match cols.get(c).copied().flatten() {
                Some(0) => p.denumire = v,
                Some(1) => {
                    let t = fold(&v);
                    p.tip = if t.starts_with("client") && !t.contains("furn") {
                        "client".into()
                    } else if t.starts_with("furn") {
                        "furnizor".into()
                    } else {
                        "ambele".into()
                    };
                }
                Some(2) => p.cui = v,
                Some(3) => p.nr_reg_com = v,
                Some(4) => p.sediu = v,
                Some(5) => p.localitate = v,
                Some(6) => p.judet = v,
                Some(7) => p.tara = v,
                Some(8) => p.telefon = v,
                Some(9) => p.email = v,
                Some(10) => p.iban = v,
                Some(11) => p.banca = v,
                Some(12) => p.reprezentant = v,
                Some(13) => p.functie_reprezentant = v,
                Some(14) => p.note = v,
                _ => {
                    if let Some(name) = head.get(c).map(|h| h.trim()).filter(|h| !h.is_empty()) {
                        p.campuri.push(ExtraField {
                            nume: name.to_string(),
                            valoare: v,
                        });
                    }
                }
            }
        }
        if p.denumire.is_empty() {
            rep.erori.push((line, "lipsește denumirea".into()));
            continue;
        }
        if !p.cui.is_empty() && !cui_valid(&p.cui) {
            rep.erori.push((line, format!("CUI-ul „{}” nu e valid", p.cui)));
            continue;
        }
        match remember(store, p, "import", azi) {
            Ok(r) if r.noua => rep.adaugate += 1,
            Ok(r) if !r.completate.is_empty() => rep.completate += 1,
            Ok(_) => rep.neschimbate += 1,
            Err(e) => rep.erori.push((line, e.to_string())),
        }
    }
    Ok(rep)
}
