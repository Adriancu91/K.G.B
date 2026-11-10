//! `kgb.permits` — permits and authorizations (Etapa 7, step 7.2; Master
//! Plan §6.6).
//!
//! - **Procedures**: what a permit needs — institution, conditions (each
//!   marked mandatory or only recommended), documents, steps, fees, legal
//!   deadline — and the **official sources** it comes from, each with a link
//!   and the date it was checked. A procedure without an official source is
//!   shown as "neverificată"; one not checked for a year as "veche".
//! - **Case files** (dosare): a procedure followed for a client or project,
//!   with what has been ticked, the attached documents, a deadline (with
//!   reminders) and a state.
//! - The module never claims to replace legal advice or the institution's
//!   confirmation: every screen says so, and K.G.B. ships no procedures of its
//!   own (legal content must come from a source the user checked).
//!
//! Commands (JSON in, JSON out):
//! - `proceduri {azi}`, `procedura_save {...}`, `procedura_delete {id, version}`
//! - `dosare {azi}`, `dosar_save {...}`, `dosar_bifeaza {id, version, cheie, bifat}`,
//!   `dosar_stare {id, version, stare}`, `dosar_fisier {id, version, name, data}`,
//!   `fisier_salveaza {fisier, dest, overwrite?}`, `dosar_delete {id, version}`

pub mod catalog;

use std::collections::BTreeMap;
use std::path::PathBuf;

use base64::Engine;
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

pub const ID: &str = "kgb.permits";
pub const PROCEDURES: &str = "proceduri";
pub const CASES: &str = "dosare";
pub const DOMAINS: [&str; 8] = [
    "constructii",
    "mediu",
    "isu",
    "functionare",
    "sanitar",
    "transport",
    "comercial",
    "altul",
];
pub const STATES: [&str; 5] = ["deschis", "depus", "aprobat", "respins", "inchis"];
/// A procedure not checked for this many days is shown as old.
pub const STALE_DAYS: i64 = 365;
const OVERDUE_DAYS: i64 = 7;

pub struct Permits {
    manifest: Manifest,
}

impl Permits {
    pub fn new() -> Permits {
        Permits {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Permits {
    fn default() -> Self {
        Permits::new()
    }
}

fn args<T: DeserializeOwned>(command: &str, v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid(format!("argumentele comenzii {command}"), e.to_string()))
}

fn bad(what: &str, detail: impl Into<String>) -> CoreError {
    CoreError::invalid(what, detail)
}

fn view(r: &RecordState) -> Value {
    let mut v = Value::Object(r.fields.clone());
    v["id"] = json!(r.id);
    v["version"] = json!(r.version);
    v
}

// ---------- dates (calendar days) ----------

/// Days since 1970-01-01 for `aaaa-ll-zz` (checks the date exists).
pub fn day_number(s: &str) -> Option<i64> {
    let b = s.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return None;
    }
    let y: i64 = s[..4].parse().ok()?;
    let m: i64 = s[5..7].parse().ok()?;
    let d: i64 = s[8..].parse().ok()?;
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    let dim = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if !(1900..=2200).contains(&y) || !(1..=12).contains(&m) || d < 1 || d > dim[(m - 1) as usize] {
        return None;
    }
    // Days from civil (Howard Hinnant's algorithm).
    let y2 = if m <= 2 { y - 1 } else { y };
    let era = y2.div_euclid(400);
    let yoe = y2 - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146_097 + doe - 719_468)
}

fn date_or_empty(what: &str, s: &Option<String>) -> CoreResult<Option<String>> {
    match s.as_deref().map(str::trim) {
        None | Some("") => Ok(None),
        Some(d) if day_number(d).is_some() => Ok(Some(d.to_string())),
        Some(d) => Err(bad(what, format!("„{d}” nu este o dată AAAA-LL-ZZ"))),
    }
}

fn ro_date(s: &str) -> String {
    if s.len() == 10 {
        format!("{}.{}.{}", &s[8..], &s[5..7], &s[..4])
    } else {
        s.to_string()
    }
}

// ---------- procedures ----------

#[derive(Deserialize, Clone)]
#[serde(deny_unknown_fields)]
struct Condition {
    text: String,
    #[serde(default)]
    obligatoriu: bool,
}

#[derive(Deserialize, Clone)]
#[serde(deny_unknown_fields)]
struct Document {
    nume: String,
    #[serde(default)]
    obligatoriu: bool,
    #[serde(default)]
    nota: String,
}

#[derive(Deserialize, Clone)]
#[serde(deny_unknown_fields)]
struct SourceRef {
    titlu: String,
    url: String,
    #[serde(default)]
    verificat: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ProcedureIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    titlu: String,
    domeniu: String,
    #[serde(default)]
    institutie: String,
    #[serde(default)]
    descriere: String,
    #[serde(default)]
    conditii: Vec<Condition>,
    #[serde(default)]
    documente: Vec<Document>,
    #[serde(default)]
    pasi: Vec<String>,
    #[serde(default)]
    taxe: String,
    #[serde(default)]
    termen_legal: String,
    #[serde(default)]
    surse: Vec<SourceRef>,
}

fn text(what: &str, s: &str, max: usize, required: bool) -> CoreResult<String> {
    let t = s.trim();
    if required && t.is_empty() {
        return Err(bad(what, "nu poate fi gol"));
    }
    if t.chars().count() > max {
        return Err(bad(what, format!("are mai mult de {max} de caractere")));
    }
    if t.chars().any(|c| c.is_control() && c != '\n' && c != '\t') {
        return Err(bad(what, "conține caractere de control"));
    }
    Ok(t.to_string())
}

fn opt(s: String) -> Value {
    if s.is_empty() { Value::Null } else { json!(s) }
}

/// "verificata", "veche" or "neverificata", with the date of the newest
/// checked official source.
pub fn verification(fields: &Fields, today: Option<&str>) -> (String, Option<String>) {
    let newest = fields
        .get("surse")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter(|s| {
            s.get("url")
                .and_then(Value::as_str)
                .is_some_and(|u| u.starts_with("https://") || u.starts_with("http://"))
        })
        .filter_map(|s| {
            s.get("verificat")
                .and_then(Value::as_str)
                .filter(|d| day_number(d).is_some())
        })
        .max()
        .map(String::from);
    let Some(d) = newest else {
        return ("neverificata".into(), None);
    };
    let old = today
        .and_then(day_number)
        .zip(day_number(&d))
        .is_some_and(|(t, v)| t - v > STALE_DAYS);
    (if old { "veche" } else { "verificata" }.into(), Some(d))
}

impl Permits {
    fn save_procedure(&self, ctx: &mut ModuleContext<'_>, p: ProcedureIn) -> CoreResult<Value> {
        if !DOMAINS.contains(&p.domeniu.as_str()) {
            return Err(bad("domeniul", "nu e cunoscut"));
        }
        let mut conds = Vec::new();
        for c in &p.conditii {
            let t = text("o condiție", &c.text, 1000, false)?;
            if !t.is_empty() {
                conds.push(json!({"text": t, "obligatoriu": c.obligatoriu}));
            }
        }
        let mut docs = Vec::new();
        for d in &p.documente {
            let n = text("un document", &d.nume, 300, false)?;
            if !n.is_empty() {
                docs.push(json!({"nume": n, "obligatoriu": d.obligatoriu, "nota": text("nota documentului", &d.nota, 500, false)?}));
            }
        }
        let mut steps = Vec::new();
        for s in &p.pasi {
            let t = text("un pas", s, 500, false)?;
            if !t.is_empty() {
                steps.push(json!(t));
            }
        }
        let mut sources = Vec::new();
        for s in &p.surse {
            let url = s.url.trim();
            if url.is_empty() && s.titlu.trim().is_empty() {
                continue;
            }
            if !(url.starts_with("https://") || url.starts_with("http://")) || url.chars().any(char::is_whitespace) {
                return Err(bad("o sursă oficială", "trebuie să aibă o adresă web (https://…)"));
            }
            let verificat = date_or_empty("data verificării sursei", &Some(s.verificat.clone()))?.unwrap_or_default();
            sources.push(
                json!({"titlu": text("titlul sursei", &s.titlu, 300, true)?, "url": url, "verificat": verificat}),
            );
        }
        let mut f = Fields::new();
        f.insert("titlu".into(), json!(text("titlul", &p.titlu, 200, true)?));
        f.insert("domeniu".into(), json!(p.domeniu));
        f.insert("institutie".into(), opt(text("instituția", &p.institutie, 300, false)?));
        f.insert("descriere".into(), opt(text("descrierea", &p.descriere, 4000, false)?));
        f.insert("conditii".into(), json!(conds));
        f.insert("documente".into(), json!(docs));
        f.insert("pasi".into(), json!(steps));
        f.insert("taxe".into(), opt(text("taxele", &p.taxe, 2000, false)?));
        f.insert(
            "termen_legal".into(),
            opt(text("termenul legal", &p.termen_legal, 300, false)?),
        );
        f.insert("surse".into(), json!(sources));
        let (_, newest) = verification(&f, None);
        f.insert("verificat".into(), newest.map(Value::from).unwrap_or(Value::Null));
        let now = now_ms();
        let (id, created) = match p.id {
            Some(id) => {
                let old = ctx.get(PROCEDURES, id)?.ok_or_else(|| bad("procedura", "nu există"))?;
                (id, old.fields.get("creat_ms").cloned().unwrap_or(json!(now)))
            }
            None => (Uuid::new_v4(), json!(now)),
        };
        f.insert("creat_ms".into(), created);
        f.insert("actualizat_ms".into(), json!(now));
        ctx.write(vec![Write::put(PROCEDURES, id, f).expect(if p.id.is_some() {
            p.version
        } else {
            0
        })])?;
        Ok(json!({"id": id}))
    }

    fn procedures(&self, ctx: &mut ModuleContext<'_>, today: Option<&str>) -> CoreResult<Value> {
        let cases = ctx.scan(CASES, |_| true)?;
        let mut count: BTreeMap<String, usize> = BTreeMap::new();
        for c in &cases {
            if let Some(p) = c.fields.get("procedura").and_then(Value::as_str) {
                *count.entry(p.to_string()).or_default() += 1;
            }
        }
        let mut v: Vec<Value> = ctx
            .scan(PROCEDURES, |_| true)?
            .iter()
            .map(|r| {
                let mut x = view(r);
                let (st, _) = verification(&r.fields, today);
                x["stare_verificare"] = json!(st);
                x["dosare"] = json!(count.get(&r.id.to_string()).copied().unwrap_or(0));
                x
            })
            .collect();
        v.sort_by_key(|p| p["titlu"].as_str().unwrap_or("").to_lowercase());
        Ok(json!(v))
    }
}

// ---------- case files ----------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CaseIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    titlu: String,
    procedura: Uuid,
    #[serde(default)]
    client: String,
    deschis: String,
    #[serde(default)]
    termen: Option<String>,
    #[serde(default)]
    note: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ById {
    id: Uuid,
    version: u64,
}

fn case_items(proc: &Fields) -> Vec<(String, String, bool)> {
    let mut out = Vec::new();
    for (i, d) in proc
        .get("documente")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .enumerate()
    {
        out.push((
            format!("doc:{i}"),
            d.get("nume").and_then(Value::as_str).unwrap_or_default().to_string(),
            d.get("obligatoriu").and_then(Value::as_bool).unwrap_or(false),
        ));
    }
    for (i, s) in proc
        .get("pasi")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .enumerate()
    {
        out.push((format!("pas:{i}"), s.as_str().unwrap_or_default().to_string(), true));
    }
    out
}

impl Permits {
    fn live(ctx: &mut ModuleContext<'_>, coll: &str, id: Uuid, what: &str) -> CoreResult<RecordState> {
        ctx.get(coll, id)?.ok_or_else(|| bad(what, "nu există"))
    }

    fn save_case(&self, ctx: &mut ModuleContext<'_>, c: CaseIn) -> CoreResult<Value> {
        Self::live(ctx, PROCEDURES, c.procedura, "procedura")?;
        let deschis = date_or_empty("data deschiderii", &Some(c.deschis.clone()))?
            .ok_or_else(|| bad("data deschiderii", "lipsește"))?;
        let termen = date_or_empty("termenul", &c.termen)?;
        if let Some(t) = &termen
            && day_number(t) < day_number(&deschis)
        {
            return Err(bad("termenul", "este înaintea datei de deschidere"));
        }
        let (mut f, expected) = match c.id {
            Some(id) => {
                let old = Self::live(ctx, CASES, id, "dosarul")?;
                (old.fields.clone(), c.version)
            }
            None => {
                let mut f = Fields::new();
                f.insert("stare".into(), json!("deschis"));
                f.insert("bifate".into(), json!({}));
                f.insert("fisiere".into(), json!([]));
                f.insert("creat_ms".into(), json!(now_ms()));
                (f, 0)
            }
        };
        if c.id.is_some() && f.get("procedura").and_then(Value::as_str) != Some(c.procedura.to_string().as_str()) {
            return Err(bad(
                "procedura",
                "nu se poate schimba la un dosar existent; deschide unul nou",
            ));
        }
        f.insert("titlu".into(), json!(text("titlul", &c.titlu, 200, true)?));
        f.insert("procedura".into(), json!(c.procedura.to_string()));
        f.insert("client".into(), opt(text("clientul", &c.client, 200, false)?));
        f.insert("deschis".into(), json!(deschis));
        f.insert("termen".into(), termen.map(Value::from).unwrap_or(Value::Null));
        f.insert("note".into(), opt(text("notele", &c.note, 4000, false)?));
        f.insert("actualizat_ms".into(), json!(now_ms()));
        let id = c.id.unwrap_or_else(Uuid::new_v4);
        ctx.write(vec![Write::put(CASES, id, f).expect(expected)])?;
        Ok(json!({"id": id}))
    }

    fn cases(&self, ctx: &mut ModuleContext<'_>, today: Option<&str>) -> CoreResult<Value> {
        let procs: BTreeMap<String, Fields> = ctx
            .scan(PROCEDURES, |_| true)?
            .into_iter()
            .map(|r| (r.id.to_string(), r.fields))
            .collect();
        let t = today.and_then(day_number);
        let mut v: Vec<Value> = ctx
            .scan(CASES, |_| true)?
            .iter()
            .map(|r| {
                let mut x = view(r);
                let pid = r.fields.get("procedura").and_then(Value::as_str).unwrap_or_default();
                let empty = Fields::new();
                let proc = procs.get(pid).unwrap_or(&empty);
                let ticked = r.fields.get("bifate").and_then(Value::as_object).cloned().unwrap_or_default();
                let items: Vec<Value> = case_items(proc)
                    .into_iter()
                    .map(|(k, label, mandatory)| json!({"cheie": k, "text": label, "obligatoriu": mandatory, "bifat": ticked.get(&k) == Some(&json!(true))}))
                    .collect();
                let done = items.iter().filter(|i| i["bifat"] == true).count();
                let missing_mandatory = items.iter().filter(|i| i["obligatoriu"] == true && i["bifat"] != true).count();
                x["procedura_titlu"] = json!(proc.get("titlu").and_then(Value::as_str).unwrap_or("(procedură ștearsă)"));
                x["elemente"] = json!(items);
                x["gata"] = json!(done);
                x["obligatorii_lipsa"] = json!(missing_mandatory);
                let open = matches!(r.fields.get("stare").and_then(Value::as_str), Some("deschis" | "depus"));
                let late = open
                    && r.fields
                        .get("termen")
                        .and_then(Value::as_str)
                        .and_then(day_number)
                        .zip(t)
                        .is_some_and(|(d, t)| d < t);
                x["intarziat"] = json!(late);
                x
            })
            .collect();
        v.sort_by_key(|c| {
            (
                !matches!(c["stare"].as_str(), Some("deschis" | "depus")),
                c["termen"].as_str().unwrap_or("9999").to_string(),
                c["titlu"].as_str().unwrap_or("").to_lowercase(),
            )
        });
        Ok(json!(v))
    }

    fn tick(&self, ctx: &mut ModuleContext<'_>, a: Value) -> CoreResult<Value> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct A {
            id: Uuid,
            version: u64,
            cheie: String,
            bifat: bool,
        }
        let a: A = args("dosar_bifeaza", a)?;
        let r = Self::live(ctx, CASES, a.id, "dosarul")?;
        let pid: Uuid = r
            .fields
            .get("procedura")
            .and_then(Value::as_str)
            .and_then(|s| s.parse().ok())
            .unwrap_or_default();
        let proc = Self::live(ctx, PROCEDURES, pid, "procedura")?;
        if !case_items(&proc.fields).iter().any(|(k, _, _)| *k == a.cheie) {
            return Err(bad("elementul", "nu face parte din procedură"));
        }
        let mut f = r.fields.clone();
        let mut ticked = f.get("bifate").and_then(Value::as_object).cloned().unwrap_or_default();
        if a.bifat {
            ticked.insert(a.cheie, json!(true));
        } else {
            ticked.remove(&a.cheie);
        }
        f.insert("bifate".into(), Value::Object(ticked));
        f.insert("actualizat_ms".into(), json!(now_ms()));
        let v = ctx.write(vec![Write::put(CASES, a.id, f).expect(a.version)])?[0];
        Ok(json!({"version": v}))
    }

    fn set_state(&self, ctx: &mut ModuleContext<'_>, a: Value) -> CoreResult<Value> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct A {
            id: Uuid,
            version: u64,
            stare: String,
        }
        let a: A = args("dosar_stare", a)?;
        if !STATES.contains(&a.stare.as_str()) {
            return Err(bad("starea", "nu e cunoscută"));
        }
        let r = Self::live(ctx, CASES, a.id, "dosarul")?;
        let mut f = r.fields.clone();
        f.insert("stare".into(), json!(a.stare));
        f.insert("actualizat_ms".into(), json!(now_ms()));
        let v = ctx.write(vec![Write::put(CASES, a.id, f).expect(a.version)])?[0];
        Ok(json!({"version": v}))
    }

    fn attach(&self, ctx: &mut ModuleContext<'_>, a: Value) -> CoreResult<Value> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct A {
            id: Uuid,
            version: u64,
            name: String,
            data: String,
        }
        let a: A = args("dosar_fisier", a)?;
        let r = Self::live(ctx, CASES, a.id, "dosarul")?;
        if r.version != a.version {
            return Err(bad("dosarul", "a fost modificat între timp; reîncarcă"));
        }
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(a.data.as_bytes())
            .map_err(|_| bad("fișierul", "conținut ilizibil"))?;
        let file = ctx.put_file(&a.name, &bytes)?;
        let mut f = r.fields.clone();
        let mut list = f.get("fisiere").and_then(Value::as_array).cloned().unwrap_or_default();
        list.push(json!({"id": file.id, "nume": file.name, "marime": file.size}));
        f.insert("fisiere".into(), json!(list));
        f.insert("actualizat_ms".into(), json!(now_ms()));
        let v = ctx.write(vec![Write::put(CASES, a.id, f).expect(a.version)])?[0];
        Ok(json!({"version": v, "fisier": file.id}))
    }

    fn reminders(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        let Some(t) = day_number(today) else {
            return Err(bad("ziua de azi", format!("„{today}” nu este o dată")));
        };
        for c in ctx.scan(CASES, |r| {
            matches!(r.fields.get("stare").and_then(Value::as_str), Some("deschis" | "depus"))
        })? {
            let Some(termen) = c.fields.get("termen").and_then(Value::as_str).map(String::from) else {
                continue;
            };
            let Some(d) = day_number(&termen) else { continue };
            let (kind, level, head) = match d - t {
                1 => ("maine", Level::Info, "Mâine"),
                0 => ("azi", Level::Atentie, "Azi"),
                n if (-OVERDUE_DAYS..0).contains(&n) => ("intarziat", Level::Urgent, "Termen depășit"),
                _ => continue,
            };
            let key = format!("{kind}:{}:{termen}", c.id);
            if ctx.notify_key_used(&key)? {
                continue;
            }
            let titlu = c.fields.get("titlu").and_then(Value::as_str).unwrap_or_default();
            ctx.notify(
                &Notice::new(
                    format!("{head}: dosarul „{titlu}”"),
                    format!("Termen {}.", ro_date(&termen)),
                )
                .level(level)
                .key(key),
            )?;
        }
        Ok(())
    }
}

impl Module for Permits {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn remind(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        self.reminders(ctx, today)
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        #[derive(Deserialize, Default)]
        struct Today {
            #[serde(default)]
            azi: Option<String>,
        }
        match command {
            "proceduri" => {
                let t: Today = serde_json::from_value(a).unwrap_or_default();
                self.procedures(ctx, t.azi.as_deref())
            }
            "procedura_save" => self.save_procedure(ctx, args(command, a)?),
            // The catalog of procedures from official sources (7.9a, D-088): what it offers, and adding one.
            "catalog" => {
                let have: Vec<String> = ctx
                    .scan(PROCEDURES, |_| true)?
                    .iter()
                    .filter_map(|r| r.fields.get("titlu").and_then(Value::as_str).map(str::to_lowercase))
                    .collect();
                Ok(json!(
                    catalog::entries()
                        .iter()
                        .map(|e| json!({
                            "cheie": e.cheie, "titlu": e.titlu, "domeniu": e.domeniu, "institutie": e.institutie,
                            "descriere": e.descriere, "activitati": e.activitati, "documente": e.documente.len(),
                            "pasi": e.pasi.len(), "surse": e.surse, "verificat": catalog::checked(e),
                            "adaugata": have.contains(&e.titlu.to_lowercase()),
                        }))
                        .collect::<Vec<_>>()
                ))
            }
            "catalog_adauga" => {
                #[derive(Deserialize)]
                #[serde(deny_unknown_fields)]
                struct Key {
                    cheie: String,
                }
                let k: Key = args(command, a)?;
                let e = catalog::find(&k.cheie).ok_or_else(|| bad("procedura", "nu e în catalog"))?;
                let descriere = if e.temei_legal.trim().is_empty() {
                    e.descriere.clone()
                } else {
                    format!(
                        "{}

Temei legal: {}",
                        e.descriere.trim(),
                        e.temei_legal.trim()
                    )
                };
                let p = ProcedureIn {
                    id: None,
                    version: 0,
                    titlu: e.titlu.clone(),
                    domeniu: e.domeniu.clone(),
                    institutie: e.institutie.clone(),
                    descriere: descriere.chars().take(4000).collect(),
                    conditii: e
                        .conditii
                        .iter()
                        .map(|c| Condition {
                            text: c.text.clone(),
                            obligatoriu: c.obligatoriu,
                        })
                        .collect(),
                    documente: e
                        .documente
                        .iter()
                        .map(|d| Document {
                            nume: d.nume.clone(),
                            obligatoriu: d.obligatoriu,
                            nota: d.nota.clone(),
                        })
                        .collect(),
                    pasi: e.pasi.clone(),
                    taxe: e.taxe.clone(),
                    termen_legal: e.termen_legal.clone(),
                    surse: e
                        .surse
                        .iter()
                        .map(|s| SourceRef {
                            titlu: s.titlu.clone(),
                            url: s.url.clone(),
                            verificat: s.verificat.clone(),
                        })
                        .collect(),
                };
                self.save_procedure(ctx, p)
            }
            "procedura_delete" => {
                let a: ById = args(command, a)?;
                let id = a.id.to_string();
                if !ctx
                    .scan(CASES, |r| {
                        r.fields.get("procedura").and_then(Value::as_str) == Some(id.as_str())
                    })?
                    .is_empty()
                {
                    return Err(bad("procedura", "are dosare; închide sau șterge întâi dosarele"));
                }
                ctx.write(vec![Write::delete(PROCEDURES, a.id).expect(a.version)])?;
                Ok(Value::Null)
            }
            "dosare" => {
                let t: Today = serde_json::from_value(a).unwrap_or_default();
                self.cases(ctx, t.azi.as_deref())
            }
            "dosar_save" => self.save_case(ctx, args(command, a)?),
            "dosar_bifeaza" => self.tick(ctx, a),
            "dosar_stare" => self.set_state(ctx, a),
            "dosar_fisier" => self.attach(ctx, a),
            "fisier_salveaza" => {
                #[derive(Deserialize)]
                #[serde(deny_unknown_fields)]
                struct A {
                    fisier: Uuid,
                    dest: PathBuf,
                    #[serde(default)]
                    overwrite: bool,
                }
                let a: A = args(command, a)?;
                let (_, bytes) = ctx.get_file(a.fisier)?;
                ctx.export_bytes(&a.dest, &bytes, a.overwrite)?;
                Ok(Value::Null)
            }
            "dosar_delete" => {
                let a: ById = args(command, a)?;
                let r = Self::live(ctx, CASES, a.id, "dosarul")?;
                ctx.write(vec![Write::delete(CASES, a.id).expect(a.version)])?;
                for f in r.fields.get("fisiere").and_then(Value::as_array).into_iter().flatten() {
                    if let Some(fid) = f.get("id").and_then(Value::as_str).and_then(|s| s.parse().ok()) {
                        let _ = ctx.delete_file(fid);
                    }
                }
                Ok(Value::Null)
            }
            _ => Err(bad("comanda", format!("„{command}” nu există în modulul {ID}"))),
        }
    }
}
