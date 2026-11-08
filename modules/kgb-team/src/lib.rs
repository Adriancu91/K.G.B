//! `kgb.team` — team and timesheet (Etapa 7, step 7.3; Master Plan §6.8;
//! D-064).
//!
//! - **Employees** with a daily norm (minutes), optionally linked to a person
//!   of the organization.
//! - **Shifts**: named templates (start, end, break) to fill a day quickly.
//! - **Timesheet**: one declared record per employee per day — entry, exit,
//!   break. A shift past midnight is fine (exit before entry = next day).
//!   Worked time and overtime are computed in whole minutes.
//! - **Leave**: requested, then approved or refused; a leave that overlaps
//!   another requested or approved one of the same employee is refused.
//! - **Monthly report**: per employee — days worked, hours, overtime, leave
//!   working days by type — exported to XLSX or CSV.
//!
//! Hours are entered by people: K.G.B. does not watch computers, screens or
//! locations (D-064). The data is personal: the module is reached only by
//! roles given access to it (Etapa 6).

use std::collections::BTreeMap;
use std::path::PathBuf;

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_sheets::book::Book;
use kgb_sheets::convert::{Cell, table};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.team";
pub const EMPLOYEES: &str = "angajati";
pub const SHIFTS: &str = "ture";
pub const TIMESHEET: &str = "pontaj";
pub const LEAVE: &str = "concedii";
pub const LEAVE_KINDS: [(&str, &str); 4] = [
    ("odihna", "concediu de odihnă"),
    ("medical", "concediu medical"),
    ("fara_plata", "concediu fără plată"),
    ("alt", "altă absență"),
];

pub struct Team {
    manifest: Manifest,
}

impl Team {
    pub fn new() -> Team {
        Team {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Team {
    fn default() -> Self {
        Team::new()
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

fn s(f: &Fields, k: &str) -> String {
    f.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}

// ---------- time arithmetic (whole minutes, no floating point) ----------

/// Days since 1970-01-01 for `aaaa-ll-zz`.
pub fn day_number(d: &str) -> Option<i64> {
    let b = d.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return None;
    }
    let y: i64 = d[..4].parse().ok()?;
    let m: i64 = d[5..7].parse().ok()?;
    let dd: i64 = d[8..].parse().ok()?;
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    let dim = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if !(1900..=2200).contains(&y) || !(1..=12).contains(&m) || dd < 1 || dd > dim[(m - 1) as usize] {
        return None;
    }
    let y2 = if m <= 2 { y - 1 } else { y };
    let era = y2.div_euclid(400);
    let yoe = y2 - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + dd - 1;
    Some(era * 146_097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719_468)
}

/// 0 = Monday … 6 = Sunday.
pub fn weekday(day: i64) -> i64 {
    (day + 3).rem_euclid(7)
}

/// Minutes since midnight for `HH:MM`.
pub fn clock(t: &str) -> Option<i64> {
    let (h, m) = t.trim().split_once(':')?;
    let (h, m): (i64, i64) = (h.parse().ok()?, m.parse().ok()?);
    ((0..24).contains(&h) && (0..60).contains(&m) && t.trim().len() == 5).then_some(h * 60 + m)
}

/// Minutes worked between `entry` and `exit` minus `pause`; an exit at or
/// before the entry is on the next day.
pub fn worked(entry: &str, exit: &str, pause: i64) -> Result<i64, String> {
    let a = clock(entry).ok_or_else(|| format!("ora de intrare „{entry}” nu e HH:MM"))?;
    let b = clock(exit).ok_or_else(|| format!("ora de ieșire „{exit}” nu e HH:MM"))?;
    let span = if b > a { b - a } else { b + 24 * 60 - a };
    if pause < 0 || pause >= span {
        return Err("pauza trebuie să fie mai scurtă decât intervalul lucrat".into());
    }
    Ok(span - pause)
}

/// `7:30` style for minutes.
pub fn hm(min: i64) -> String {
    format!("{}:{:02}", min / 60, min % 60)
}

/// First and last day (`aaaa-ll-zz`) of month `aaaa-ll`.
fn month_bounds(month: &str) -> Option<(String, String, i64, i64)> {
    let first = format!("{month}-01");
    let a = day_number(&first)?;
    let (y, m): (i64, i64) = (month[..4].parse().ok()?, month[5..7].parse().ok()?);
    let next = if m == 12 {
        format!("{}-01-01", y + 1)
    } else {
        format!("{y}-{:02}-01", m + 1)
    };
    let b = day_number(&next)? - 1;
    Some((first, String::new(), a, b))
}

// ---------- commands ----------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EmployeeIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    nume: String,
    #[serde(default)]
    functie: String,
    #[serde(default = "default_norm")]
    norma_min: i64,
    #[serde(default)]
    persoana: Option<String>,
    #[serde(default = "yes")]
    activ: bool,
}
fn default_norm() -> i64 {
    480
}
fn yes() -> bool {
    true
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ShiftIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    nume: String,
    inceput: String,
    sfarsit: String,
    #[serde(default)]
    pauza_min: i64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DayIn {
    angajat: Uuid,
    data: String,
    intrare: String,
    iesire: String,
    #[serde(default)]
    pauza_min: i64,
    #[serde(default)]
    nota: String,
    /// 0 for a new day; the current version to change an existing one.
    #[serde(default)]
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LeaveIn {
    angajat: Uuid,
    tip: String,
    de_la: String,
    pana_la: String,
    #[serde(default)]
    nota: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ById {
    id: Uuid,
    version: u64,
}

fn short(what: &str, v: &str, max: usize, required: bool) -> CoreResult<String> {
    let t = v.trim();
    if required && t.is_empty() {
        return Err(bad(what, "nu poate fi gol"));
    }
    if t.chars().count() > max || t.chars().any(char::is_control) {
        return Err(bad(
            what,
            format!("prea lung (maximum {max}) sau cu caractere nepermise"),
        ));
    }
    Ok(t.to_string())
}

fn opt(s: String) -> Value {
    if s.is_empty() { Value::Null } else { json!(s) }
}

/// The record id of an employee's day: one record per employee per day.
fn day_id(employee: Uuid, date: &str) -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_OID, format!("kgb-team:{employee}:{date}").as_bytes())
}

/// One employee's monthly totals.
#[derive(Default, Clone, Debug)]
pub struct MonthLine {
    pub zile: i64,
    pub lucrat_min: i64,
    pub suplimentar_min: i64,
    /// Working days (Monday–Friday) of approved leave in the month, by kind.
    pub concediu: BTreeMap<String, i64>,
}

impl Team {
    fn employee(ctx: &mut ModuleContext<'_>, id: Uuid) -> CoreResult<RecordState> {
        ctx.get(EMPLOYEES, id)?.ok_or_else(|| bad("angajatul", "nu există"))
    }

    fn save_employee(&self, ctx: &mut ModuleContext<'_>, e: EmployeeIn) -> CoreResult<Value> {
        if !(60..=720).contains(&e.norma_min) {
            return Err(bad("norma", "trebuie să fie între 1 și 12 ore pe zi"));
        }
        let nume = short("numele", &e.nume, 100, true)?;
        let existing = ctx.scan(EMPLOYEES, |_| true)?;
        if existing
            .iter()
            .any(|r| Some(r.id) != e.id && s(&r.fields, "nume").to_lowercase() == nume.to_lowercase())
        {
            return Err(bad("angajatul", format!("„{nume}” există deja")));
        }
        let created = match e.id {
            Some(id) => Self::employee(ctx, id)?
                .fields
                .get("creat_ms")
                .cloned()
                .unwrap_or(json!(now_ms())),
            None => json!(now_ms()),
        };
        let mut f = Fields::new();
        f.insert("nume".into(), json!(nume));
        f.insert("functie".into(), opt(short("funcția", &e.functie, 100, false)?));
        f.insert("norma_min".into(), json!(e.norma_min));
        f.insert(
            "persoana".into(),
            e.persoana
                .filter(|p| !p.is_empty())
                .map(Value::from)
                .unwrap_or(Value::Null),
        );
        f.insert("activ".into(), json!(e.activ));
        f.insert("creat_ms".into(), created);
        let id = e.id.unwrap_or_else(Uuid::new_v4);
        ctx.write(vec![Write::put(EMPLOYEES, id, f).expect(if e.id.is_some() {
            e.version
        } else {
            0
        })])?;
        Ok(json!({"id": id}))
    }

    fn save_shift(&self, ctx: &mut ModuleContext<'_>, t: ShiftIn) -> CoreResult<Value> {
        worked(&t.inceput, &t.sfarsit, t.pauza_min).map_err(|e| bad("tura", e))?;
        let mut f = Fields::new();
        f.insert("nume".into(), json!(short("numele turei", &t.nume, 60, true)?));
        f.insert("inceput".into(), json!(t.inceput.trim()));
        f.insert("sfarsit".into(), json!(t.sfarsit.trim()));
        f.insert("pauza_min".into(), json!(t.pauza_min));
        let id = t.id.unwrap_or_else(Uuid::new_v4);
        ctx.write(vec![Write::put(SHIFTS, id, f).expect(if t.id.is_some() {
            t.version
        } else {
            0
        })])?;
        Ok(json!({"id": id}))
    }

    fn save_day(&self, ctx: &mut ModuleContext<'_>, d: DayIn) -> CoreResult<Value> {
        Self::employee(ctx, d.angajat)?;
        if day_number(&d.data).is_none() {
            return Err(bad("data", format!("„{}” nu e o dată AAAA-LL-ZZ", d.data)));
        }
        let min = worked(&d.intrare, &d.iesire, d.pauza_min).map_err(|e| bad("pontajul", e))?;
        if self.leave_on(ctx, d.angajat, &d.data)?.is_some() {
            return Err(bad("pontajul", "în ziua aceasta angajatul are un concediu aprobat"));
        }
        let mut f = Fields::new();
        f.insert("angajat".into(), json!(d.angajat.to_string()));
        f.insert("data".into(), json!(d.data));
        f.insert("intrare".into(), json!(d.intrare.trim()));
        f.insert("iesire".into(), json!(d.iesire.trim()));
        f.insert("pauza_min".into(), json!(d.pauza_min));
        f.insert("lucrat_min".into(), json!(min));
        f.insert("nota".into(), opt(short("nota", &d.nota, 500, false)?));
        f.insert("actualizat_ms".into(), json!(now_ms()));
        let id = day_id(d.angajat, &d.data);
        // version 0 = a new day; a second entry for the same day is refused
        // by the store (expected version 0 on an existing record).
        let v = ctx
            .write(vec![Write::put(TIMESHEET, id, f).expect(d.version)])
            .map_err(|e| match d.version {
                0 => bad("pontajul", "ziua aceasta e deja pontată; modific-o pe cea existentă"),
                _ => e,
            })?[0];
        Ok(json!({"id": id, "version": v, "lucrat_min": min}))
    }

    /// The approved leave covering `date`, if any.
    fn leave_on(&self, ctx: &mut ModuleContext<'_>, employee: Uuid, date: &str) -> CoreResult<Option<RecordState>> {
        let e = employee.to_string();
        let d = day_number(date);
        Ok(ctx
            .scan(LEAVE, |r| {
                r.fields.get("angajat").and_then(Value::as_str) == Some(e.as_str())
                    && r.fields.get("stare") == Some(&json!("aprobat"))
            })?
            .into_iter()
            .find(|r| {
                let a = day_number(&s(&r.fields, "de_la"));
                let b = day_number(&s(&r.fields, "pana_la"));
                matches!((a, b, d), (Some(a), Some(b), Some(d)) if a <= d && d <= b)
            }))
    }

    fn request_leave(&self, ctx: &mut ModuleContext<'_>, l: LeaveIn) -> CoreResult<Value> {
        Self::employee(ctx, l.angajat)?;
        if !LEAVE_KINDS.iter().any(|(k, _)| *k == l.tip) {
            return Err(bad("tipul concediului", "nu e cunoscut"));
        }
        let (a, b) = match (day_number(&l.de_la), day_number(&l.pana_la)) {
            (Some(a), Some(b)) if a <= b => (a, b),
            (Some(_), Some(_)) => return Err(bad("perioada", "începe după ce se termină")),
            _ => return Err(bad("perioada", "datele trebuie să fie AAAA-LL-ZZ")),
        };
        if b - a > 366 {
            return Err(bad("perioada", "e mai lungă de un an"));
        }
        let e = l.angajat.to_string();
        let overlap = ctx
            .scan(LEAVE, |r| {
                r.fields.get("angajat").and_then(Value::as_str) == Some(e.as_str())
                    && r.fields.get("stare") != Some(&json!("respins"))
            })?
            .into_iter()
            .any(|r| {
                let (x, y) = (day_number(&s(&r.fields, "de_la")), day_number(&s(&r.fields, "pana_la")));
                matches!((x, y), (Some(x), Some(y)) if x <= b && a <= y)
            });
        if overlap {
            return Err(bad(
                "concediul",
                "se suprapune cu alt concediu cerut sau aprobat al aceluiași angajat",
            ));
        }
        let mut f = Fields::new();
        f.insert("angajat".into(), json!(e));
        f.insert("tip".into(), json!(l.tip));
        f.insert("de_la".into(), json!(l.de_la));
        f.insert("pana_la".into(), json!(l.pana_la));
        f.insert("stare".into(), json!("cerut"));
        f.insert("nota".into(), opt(short("nota", &l.nota, 500, false)?));
        f.insert("creat_ms".into(), json!(now_ms()));
        f.insert("decis_ms".into(), Value::Null);
        let id = Uuid::new_v4();
        ctx.write(vec![Write::put(LEAVE, id, f).expect(0)])?;
        Ok(json!({"id": id}))
    }

    fn decide_leave(&self, ctx: &mut ModuleContext<'_>, a: Value) -> CoreResult<Value> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct A {
            id: Uuid,
            version: u64,
            stare: String,
        }
        let a: A = args("concediu_decide", a)?;
        if a.stare != "aprobat" && a.stare != "respins" {
            return Err(bad("decizia", "poate fi doar „aprobat” sau „respins”"));
        }
        let r = ctx.get(LEAVE, a.id)?.ok_or_else(|| bad("concediul", "nu există"))?;
        if r.fields.get("stare") != Some(&json!("cerut")) {
            return Err(bad("concediul", "a fost deja decis"));
        }
        if a.stare == "aprobat" {
            let e = s(&r.fields, "angajat");
            let (x, y) = (
                day_number(&s(&r.fields, "de_la")).unwrap_or(0),
                day_number(&s(&r.fields, "pana_la")).unwrap_or(0),
            );
            let worked_days: Vec<String> = ctx
                .scan(TIMESHEET, |t| {
                    t.fields.get("angajat").and_then(Value::as_str) == Some(e.as_str())
                })?
                .into_iter()
                .filter(|t| day_number(&s(&t.fields, "data")).is_some_and(|d| x <= d && d <= y))
                .map(|t| s(&t.fields, "data"))
                .collect();
            if !worked_days.is_empty() {
                return Err(bad(
                    "concediul",
                    format!(
                        "în perioadă există zile pontate ({}); șterge-le sau schimbă perioada",
                        worked_days.join(", ")
                    ),
                ));
            }
        }
        let mut f = r.fields.clone();
        f.insert("stare".into(), json!(a.stare));
        f.insert("decis_ms".into(), json!(now_ms()));
        let v = ctx.write(vec![Write::put(LEAVE, a.id, f).expect(a.version)])?[0];
        Ok(json!({"version": v}))
    }

    /// Monthly totals per employee id.
    pub fn month(&self, ctx: &mut ModuleContext<'_>, month: &str) -> CoreResult<BTreeMap<String, MonthLine>> {
        let (first, _, a, b) = month_bounds(month).ok_or_else(|| bad("luna", format!("„{month}” nu e AAAA-LL")))?;
        let _ = first;
        let norms: BTreeMap<String, i64> = ctx
            .scan(EMPLOYEES, |_| true)?
            .into_iter()
            .map(|r| {
                (
                    r.id.to_string(),
                    r.fields.get("norma_min").and_then(Value::as_i64).unwrap_or(480),
                )
            })
            .collect();
        let mut out: BTreeMap<String, MonthLine> = BTreeMap::new();
        for t in ctx.scan(TIMESHEET, |_| true)? {
            let Some(d) = day_number(&s(&t.fields, "data")) else {
                continue;
            };
            if d < a || d > b {
                continue;
            }
            let e = s(&t.fields, "angajat");
            let min = t.fields.get("lucrat_min").and_then(Value::as_i64).unwrap_or(0);
            let line = out.entry(e.clone()).or_default();
            line.zile += 1;
            line.lucrat_min += min;
            line.suplimentar_min += (min - norms.get(&e).copied().unwrap_or(480)).max(0);
        }
        for l in ctx.scan(LEAVE, |r| r.fields.get("stare") == Some(&json!("aprobat")))? {
            let (Some(x), Some(y)) = (day_number(&s(&l.fields, "de_la")), day_number(&s(&l.fields, "pana_la"))) else {
                continue;
            };
            let days = (x.max(a)..=y.min(b)).filter(|d| weekday(*d) < 5).count() as i64;
            if days > 0 {
                *out.entry(s(&l.fields, "angajat"))
                    .or_default()
                    .concediu
                    .entry(s(&l.fields, "tip"))
                    .or_default() += days;
            }
        }
        Ok(out)
    }

    fn report(&self, ctx: &mut ModuleContext<'_>, month: &str) -> CoreResult<Vec<Value>> {
        let totals = self.month(ctx, month)?;
        let mut rows: Vec<Value> = ctx
            .scan(EMPLOYEES, |_| true)?
            .into_iter()
            .filter(|r| r.fields.get("activ") == Some(&json!(true)) || totals.contains_key(&r.id.to_string()))
            .map(|r| {
                let t = totals.get(&r.id.to_string()).cloned().unwrap_or_default();
                json!({
                    "angajat": r.id, "nume": s(&r.fields, "nume"), "functie": s(&r.fields, "functie"),
                    "zile": t.zile, "lucrat_min": t.lucrat_min, "suplimentar_min": t.suplimentar_min,
                    "concediu": t.concediu,
                })
            })
            .collect();
        rows.sort_by_key(|r| r["nume"].as_str().unwrap_or("").to_lowercase());
        Ok(rows)
    }

    fn export(&self, ctx: &mut ModuleContext<'_>, a: Value) -> CoreResult<Value> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct A {
            luna: String,
            dest: PathBuf,
            #[serde(default = "xlsx")]
            format: String,
            #[serde(default)]
            overwrite: bool,
        }
        fn xlsx() -> String {
            "xlsx".into()
        }
        let a: A = args("raport_export", a)?;
        let rows = self.report(ctx, &a.luna)?;
        let mut t: Vec<Vec<Cell>> = vec![
            ["Angajat", "Funcție", "Zile lucrate", "Ore lucrate", "Ore suplimentare"]
                .iter()
                .map(|h| Cell::from(*h))
                .chain(LEAVE_KINDS.iter().map(|(_, l)| Cell::from(format!("Zile {l}"))))
                .collect(),
        ];
        for r in &rows {
            let mut line = vec![
                Cell::from(r["nume"].as_str().unwrap_or("").to_string()),
                Cell::from(r["functie"].as_str().unwrap_or("").to_string()),
                Cell::Number(r["zile"].as_i64().unwrap_or(0) as f64),
                Cell::from(hm(r["lucrat_min"].as_i64().unwrap_or(0))),
                Cell::from(hm(r["suplimentar_min"].as_i64().unwrap_or(0))),
            ];
            for (k, _) in LEAVE_KINDS {
                line.push(Cell::Number(r["concediu"][k].as_i64().unwrap_or(0) as f64));
            }
            t.push(line);
        }
        let sheet = table(&format!("Pontaj {}", a.luna), &t);
        let bytes = match a.format.as_str() {
            "xlsx" => {
                kgb_sheets::convert::to_xlsx(&Book { sheets: vec![sheet] })
                    .map_err(|e| bad("exportul", e))?
                    .bytes
            }
            "csv" => kgb_sheets::convert::to_csv(&sheet, kgb_sheets::convert::CsvStyle::Ro, true)
                .map_err(|e| bad("exportul", e))?,
            other => return Err(bad("exportul", format!("formatul „{other}” nu există (xlsx, csv)"))),
        };
        ctx.export_bytes(&a.dest, &bytes, a.overwrite)?;
        Ok(json!({"randuri": rows.len()}))
    }
}

impl Module for Team {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        #[derive(Deserialize, Default)]
        #[serde(default)]
        struct Filter {
            luna: Option<String>,
            angajat: Option<String>,
        }
        match command {
            "angajati" => {
                let mut v: Vec<Value> = ctx.scan(EMPLOYEES, |_| true)?.iter().map(view).collect();
                v.sort_by_key(|e| (e["activ"] != true, e["nume"].as_str().unwrap_or("").to_lowercase()));
                Ok(json!(v))
            }
            "angajat_save" => self.save_employee(ctx, args(command, a)?),
            "ture" => {
                let mut v: Vec<Value> = ctx.scan(SHIFTS, |_| true)?.iter().map(view).collect();
                v.sort_by_key(|e| e["inceput"].as_str().unwrap_or("").to_string());
                Ok(json!(v))
            }
            "tura_save" => self.save_shift(ctx, args(command, a)?),
            "tura_delete" => {
                let a: ById = args(command, a)?;
                ctx.write(vec![Write::delete(SHIFTS, a.id).expect(a.version)])?;
                Ok(Value::Null)
            }
            "pontaj" => {
                let f: Filter = serde_json::from_value(a).unwrap_or_default();
                let mut v: Vec<Value> = ctx
                    .scan(TIMESHEET, |r| {
                        f.luna.as_deref().is_none_or(|l| s(&r.fields, "data").starts_with(l))
                            && f.angajat.as_deref().is_none_or(|e| s(&r.fields, "angajat") == e)
                    })?
                    .iter()
                    .map(view)
                    .collect();
                v.sort_by_key(|r| {
                    (
                        r["data"].as_str().unwrap_or("").to_string(),
                        r["angajat"].as_str().unwrap_or("").to_string(),
                    )
                });
                Ok(json!(v))
            }
            "pontaj_save" => self.save_day(ctx, args(command, a)?),
            "pontaj_delete" => {
                let a: ById = args(command, a)?;
                ctx.write(vec![Write::delete(TIMESHEET, a.id).expect(a.version)])?;
                Ok(Value::Null)
            }
            "concedii" => {
                let mut v: Vec<Value> = ctx.scan(LEAVE, |_| true)?.iter().map(view).collect();
                v.sort_by_key(|r| std::cmp::Reverse(r["de_la"].as_str().unwrap_or("").to_string()));
                Ok(json!(v))
            }
            "concediu_cere" => self.request_leave(ctx, args(command, a)?),
            "concediu_decide" => self.decide_leave(ctx, a),
            "raport" => {
                let f: Filter = serde_json::from_value(a).unwrap_or_default();
                Ok(json!(self.report(ctx, f.luna.as_deref().unwrap_or(""))?))
            }
            "raport_export" => self.export(ctx, a),
            _ => Err(bad("comanda", format!("„{command}” nu există în modulul {ID}"))),
        }
    }
}
