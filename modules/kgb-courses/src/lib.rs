//! `kgb.courses` — „Cursuri și cursanți” (Etapa 8, step 8.17).
//!
//! - **Groups** (`grupe`): a course, a group, an after-school or a workshop, with its period, the days of the week
//!   (1 = Monday … 7 = Sunday) and the hour, the length, the number of places (0 = no limit) and the fee: per month
//!   (`lunar`) or once for the whole course (`curs`), in bani.
//! - **Trainees** (`cursanti`): the name, phone, e-mail and, for children, the parent or tutor. Nothing else is asked.
//! - **Enrolments** (`inscrieri`): a trainee in a group from a day, until the day they leave; a fee of their own or
//!   the group's (-1). A full group and a second active enrolment in the same group are refused.
//! - **Attendance** (`prezente`): one record per group and day: who came and whether the session was held. The
//!   sessions of a month are computed from the schedule; a day outside it is accepted as an extra session.
//! - **Payments** (`plati`): never deleted; a wrong one is cancelled with a reason.
//!
//! What is owed is computed, never written: per month, every calendar month touched by the enrolment (from the later
//! of the two starts to the earliest of leaving, the group's end and today) at the fee; per course, the fee once.
//! Commands: `grupe {azi}`, `grupa {id, azi, luna}`, `grupa_save`, `grupa_delete`, `cursanti {text?}`,
//! `cursant_save`, `cursant_delete`, `inscrie`, `retrage {id, version, data}`, `prezenta_save`, `plata_save`,
//! `plata_anuleaza {id, version, motiv}`, `restante {azi}`.

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.courses";
pub const GROUPS: &str = "grupe";
pub const TRAINEES: &str = "cursanti";
pub const ENROLMENTS: &str = "inscrieri";
pub const ATTENDANCE: &str = "prezente";
pub const PAYMENTS: &str = "plati";
pub const KINDS: [&str; 4] = ["curs", "grupa", "after_school", "atelier"];
pub const PAY_KINDS: [&str; 3] = ["numerar", "card", "transfer"];

pub struct Courses {
    manifest: Manifest,
}

impl Courses {
    pub fn new() -> Courses {
        Courses {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Courses {
    fn default() -> Self {
        Courses::new()
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

fn b(r: &RecordState, k: &str) -> bool {
    r.fields.get(k) == Some(&json!(true))
}

fn now() -> i64 {
    i64::try_from(now_ms()).unwrap_or_default()
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

fn fold(t: &str) -> String {
    t.to_lowercase()
        .replace(['ă', 'â'], "a")
        .replace('î', "i")
        .replace(['ș', 'ş'], "s")
        .replace(['ț', 'ţ'], "t")
}

// ---------- days ----------

/// Days since 1970-01-01 of `AAAA-LL-ZZ`, if it is a real date.
pub fn day_number(d: &str) -> Option<i64> {
    let by = d.as_bytes();
    if by.len() != 10 || by[4] != b'-' || by[7] != b'-' {
        return None;
    }
    let (y, m, dd): (i64, i64, i64) = (d[0..4].parse().ok()?, d[5..7].parse().ok()?, d[8..10].parse().ok()?);
    if !(1900..=2200).contains(&y) || !(1..=12).contains(&m) || dd < 1 || dd > days_in_month(y, m) {
        return None;
    }
    let (yy, mm) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
    let era = yy.div_euclid(400);
    let yoe = yy - era * 400;
    let doy = (153 * mm + 2) / 5 + dd - 1;
    Some(era * 146_097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719_468)
}

fn days_in_month(y: i64, m: i64) -> i64 {
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][(m - 1) as usize]
}

/// `AAAA-LL-ZZ` of a day number.
pub fn date_of(z: i64) -> String {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    format!("{:04}-{m:02}-{d:02}", yoe + era * 400 + i64::from(m <= 2))
}

/// 1 = Monday … 7 = Sunday (1970-01-01 was a Thursday).
pub fn weekday(z: i64) -> i64 {
    (z + 3).rem_euclid(7) + 1
}

fn date_arg(what: &str, t: &str) -> CoreResult<String> {
    let t = t.trim();
    day_number(t)
        .map(|_| t.to_string())
        .ok_or_else(|| bad(what, format!("„{t}” nu e o dată AAAA-LL-ZZ")))
}

/// A month as a number (year × 12 + month - 1) of `AAAA-LL-ZZ` or `AAAA-LL`.
fn month_index(d: &str) -> Option<i64> {
    let y: i64 = d.get(0..4)?.parse().ok()?;
    let m: i64 = d.get(5..7)?.parse().ok()?;
    (d.as_bytes().get(4) == Some(&b'-') && (1..=12).contains(&m)).then_some(y * 12 + m - 1)
}

/// The sessions of a month (`AAAA-LL`) for a schedule: the days in `[from, to]` whose weekday is in `days`.
pub fn sessions(month: &str, from: &str, to: &str, days: &[i64]) -> Vec<String> {
    let Some(mi) = month_index(month) else {
        return Vec::new();
    };
    let (y, m) = (mi.div_euclid(12), mi.rem_euclid(12) + 1);
    let (Some(first), Some(a), Some(z)) = (
        day_number(&format!("{y:04}-{m:02}-01")),
        day_number(from),
        day_number(to),
    ) else {
        return Vec::new();
    };
    (first..first + days_in_month(y, m))
        .filter(|d| *d >= a && *d <= z && days.contains(&weekday(*d)))
        .map(date_of)
        .collect()
}

/// What an enrolment owes up to `today`: per month, every calendar month touched between the later start and the
/// earliest end (leaving, the group's end, today) at `fee`; per course, `fee` once (if it started by `today`).
pub fn owed(per_month: bool, fee: i64, starts: [&str; 2], ends: [&str; 3]) -> i64 {
    let start = starts.iter().filter_map(|d| day_number(d)).max();
    let end = ends.iter().filter_map(|d| day_number(d)).min();
    let (Some(start), Some(end)) = (start, end) else {
        return 0;
    };
    if end < start {
        return 0;
    }
    if !per_month {
        return fee;
    }
    let (Some(a), Some(z)) = (month_index(&date_of(start)), month_index(&date_of(end))) else {
        return 0;
    };
    (z - a + 1) * fee
}

// ---------- arguments ----------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Search {
    #[serde(default)]
    text: String,
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
    #[serde(default)]
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct GroupOpen {
    id: Uuid,
    azi: String,
    luna: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct GroupIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    nume: String,
    #[serde(default = "kind")]
    fel: String,
    #[serde(default)]
    formator: String,
    #[serde(default)]
    sala: String,
    de_la: String,
    pana_la: String,
    zile: Vec<i64>,
    ora: String,
    #[serde(default = "sixty")]
    durata_min: i64,
    #[serde(default)]
    capacitate: i64,
    #[serde(default = "monthly")]
    taxa_fel: String,
    #[serde(default)]
    taxa: i64,
    #[serde(default = "yes")]
    activ: bool,
    #[serde(default)]
    nota: String,
}

fn kind() -> String {
    "curs".into()
}

fn sixty() -> i64 {
    60
}

fn monthly() -> String {
    "lunar".into()
}

fn yes() -> bool {
    true
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct TraineeIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    nume: String,
    #[serde(default)]
    telefon: String,
    #[serde(default)]
    email: String,
    #[serde(default)]
    tutore: String,
    #[serde(default)]
    nota: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EnrolIn {
    grupa: Uuid,
    cursant: Uuid,
    de_la: String,
    #[serde(default = "group_fee")]
    taxa: i64,
}

fn group_fee() -> i64 {
    -1
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LeaveIn {
    id: Uuid,
    version: u64,
    data: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct AttendanceIn {
    grupa: Uuid,
    data: String,
    #[serde(default)]
    prezenti: Vec<Uuid>,
    #[serde(default = "yes")]
    tinuta: bool,
    #[serde(default)]
    nota: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PaymentIn {
    inscriere: Uuid,
    data: String,
    suma: i64,
    #[serde(default = "cash")]
    fel: String,
    #[serde(default)]
    document: String,
    #[serde(default)]
    nota: String,
}

fn cash() -> String {
    "numerar".into()
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CancelIn {
    id: Uuid,
    version: u64,
    motiv: String,
}

// ---------- the module ----------

fn days_of(r: &RecordState) -> Vec<i64> {
    r.fields
        .get("zile")
        .and_then(Value::as_array)
        .map(|a| a.iter().filter_map(Value::as_i64).collect())
        .unwrap_or_default()
}

/// The fee of an enrolment: its own, or the group's.
fn fee_of(e: &RecordState, g: &RecordState) -> i64 {
    if i(e, "taxa") >= 0 { i(e, "taxa") } else { i(g, "taxa") }
}

impl Courses {
    fn all(&self, ctx: &mut ModuleContext<'_>, c: &str) -> CoreResult<Vec<RecordState>> {
        ctx.scan(c, |r| !r.deleted)
    }

    fn get(&self, ctx: &mut ModuleContext<'_>, c: &str, id: Uuid, what: &str) -> CoreResult<RecordState> {
        ctx.get(c, id)?
            .filter(|r| !r.deleted)
            .ok_or_else(|| bad(what, "nu există"))
    }

    /// One enrolment's money: owed up to `today`, paid (not cancelled), the rest.
    fn money(&self, e: &RecordState, g: &RecordState, payments: &[RecordState], today: &str) -> (i64, i64) {
        let leave = s(e, "pana_la");
        let due = owed(
            s(g, "taxa_fel") == "lunar",
            fee_of(e, g),
            [&s(e, "de_la"), &s(g, "de_la")],
            [if leave.is_empty() { today } else { &leave }, &s(g, "pana_la"), today],
        );
        let paid = payments
            .iter()
            .filter(|p| s(p, "inscriere") == e.id.to_string() && !b(p, "anulata"))
            .map(|p| i(p, "suma"))
            .sum();
        (due, paid)
    }

    fn group_view(&self, g: &RecordState, enrolments: &[RecordState]) -> Value {
        let active = enrolments
            .iter()
            .filter(|e| s(e, "grupa") == g.id.to_string() && s(e, "stare") == "activ")
            .count();
        json!({
            "id": g.id, "version": g.version, "nume": s(g, "nume"), "fel": s(g, "fel"), "formator": s(g, "formator"),
            "sala": s(g, "sala"), "de_la": s(g, "de_la"), "pana_la": s(g, "pana_la"), "zile": days_of(g),
            "ora": s(g, "ora"), "durata_min": i(g, "durata_min"), "capacitate": i(g, "capacitate"),
            "taxa_fel": s(g, "taxa_fel"), "taxa": i(g, "taxa"), "activ": b(g, "activ"), "nota": s(g, "nota"),
            "inscrisi": active,
        })
    }

    fn save_group(&self, ctx: &mut ModuleContext<'_>, a: GroupIn) -> CoreResult<Value> {
        let nume = text("numele grupei", &a.nume, 120, true)?;
        if !KINDS.contains(&a.fel.as_str()) {
            return Err(bad("felul grupei", "nu e cunoscut"));
        }
        let de_la = date_arg("începutul", &a.de_la)?;
        let pana_la = date_arg("sfârșitul", &a.pana_la)?;
        if pana_la < de_la {
            return Err(bad("perioada", "se termină înainte să înceapă"));
        }
        let mut zile = a.zile.clone();
        zile.sort_unstable();
        zile.dedup();
        if zile.is_empty() || zile.iter().any(|d| !(1..=7).contains(d)) {
            return Err(bad("zilele", "alege cel puțin o zi, de luni (1) la duminică (7)"));
        }
        let ora = a.ora.trim();
        let ok_hour = ora.len() == 5
            && ora.as_bytes()[2] == b':'
            && ora[0..2].parse::<u8>().is_ok_and(|h| h < 24)
            && ora[3..5].parse::<u8>().is_ok_and(|m| m < 60);
        if !ok_hour {
            return Err(bad("ora", format!("„{ora}” nu e HH:MM")));
        }
        if !(15..=600).contains(&a.durata_min) {
            return Err(bad("durata", "are 15–600 de minute"));
        }
        if !(0..=1000).contains(&a.capacitate) {
            return Err(bad("locurile", "sunt 0 (fără limită) până la 1000"));
        }
        if a.taxa_fel != "lunar" && a.taxa_fel != "curs" {
            return Err(bad("taxa", "e lunară sau pe curs"));
        }
        if !(0..=100_000_000).contains(&a.taxa) {
            return Err(bad("taxa", "nu poate fi negativă"));
        }
        let created = match a.id {
            Some(id) => i(&self.get(ctx, GROUPS, id, "grupa")?, "creat_ms"),
            None => now(),
        };
        let mut f = Fields::new();
        f.insert("nume".into(), json!(nume));
        f.insert("fel".into(), json!(a.fel));
        f.insert("formator".into(), json!(text("formatorul", &a.formator, 120, false)?));
        f.insert("sala".into(), json!(text("sala", &a.sala, 120, false)?));
        f.insert("de_la".into(), json!(de_la));
        f.insert("pana_la".into(), json!(pana_la));
        f.insert("zile".into(), json!(zile));
        f.insert("ora".into(), json!(ora));
        f.insert("durata_min".into(), json!(a.durata_min));
        f.insert("capacitate".into(), json!(a.capacitate));
        f.insert("taxa_fel".into(), json!(a.taxa_fel));
        f.insert("taxa".into(), json!(a.taxa));
        f.insert("activ".into(), json!(a.activ));
        f.insert("nota".into(), json!(text("nota", &a.nota, 1000, false)?));
        f.insert("creat_ms".into(), json!(created));
        let id = a.id.unwrap_or_else(Uuid::new_v4);
        let version = ctx.write(vec![Write::put(GROUPS, id, f).expect(if a.id.is_some() {
            a.version
        } else {
            0
        })])?[0];
        Ok(json!({"id": id, "version": version}))
    }

    fn save_trainee(&self, ctx: &mut ModuleContext<'_>, a: TraineeIn) -> CoreResult<Value> {
        let created = match a.id {
            Some(id) => i(&self.get(ctx, TRAINEES, id, "cursantul")?, "creat_ms"),
            None => now(),
        };
        let email = text("e-mailul", &a.email, 120, false)?;
        if !email.is_empty() && (!email.contains('@') || email.contains(' ')) {
            return Err(bad("e-mailul", format!("„{email}” nu arată ca o adresă de e-mail")));
        }
        let mut f = Fields::new();
        f.insert("nume".into(), json!(text("numele cursantului", &a.nume, 120, true)?));
        f.insert("telefon".into(), json!(text("telefonul", &a.telefon, 40, false)?));
        f.insert("email".into(), json!(email));
        f.insert(
            "tutore".into(),
            json!(text("părintele sau tutorele", &a.tutore, 120, false)?),
        );
        f.insert("nota".into(), json!(text("nota", &a.nota, 1000, false)?));
        f.insert("creat_ms".into(), json!(created));
        let id = a.id.unwrap_or_else(Uuid::new_v4);
        let version = ctx.write(vec![Write::put(TRAINEES, id, f).expect(if a.id.is_some() {
            a.version
        } else {
            0
        })])?[0];
        Ok(json!({"id": id, "version": version}))
    }

    fn enrol(&self, ctx: &mut ModuleContext<'_>, a: EnrolIn) -> CoreResult<Value> {
        let g = self.get(ctx, GROUPS, a.grupa, "grupa")?;
        let t = self.get(ctx, TRAINEES, a.cursant, "cursantul")?;
        let de_la = date_arg("data înscrierii", &a.de_la)?;
        if de_la > s(&g, "pana_la") {
            return Err(bad("data înscrierii", "e după sfârșitul grupei"));
        }
        if !(-1..=100_000_000).contains(&a.taxa) {
            return Err(bad("taxa", "nu poate fi negativă"));
        }
        let mine: Vec<RecordState> = self
            .all(ctx, ENROLMENTS)?
            .into_iter()
            .filter(|e| s(e, "grupa") == a.grupa.to_string() && s(e, "stare") == "activ")
            .collect();
        if mine.iter().any(|e| s(e, "cursant") == a.cursant.to_string()) {
            return Err(bad(
                "înscrierea",
                format!("{} e deja înscris(ă) în grupa aceasta", s(&t, "nume")),
            ));
        }
        let cap = i(&g, "capacitate");
        if cap > 0 && mine.len() as i64 >= cap {
            return Err(bad("grupa", format!("e plină ({cap} locuri)")));
        }
        let mut f = Fields::new();
        f.insert("grupa".into(), json!(a.grupa.to_string()));
        f.insert("cursant".into(), json!(a.cursant.to_string()));
        f.insert("de_la".into(), json!(de_la));
        f.insert("pana_la".into(), json!(""));
        f.insert("taxa".into(), json!(a.taxa));
        f.insert("stare".into(), json!("activ"));
        f.insert("creat_ms".into(), json!(now()));
        let id = Uuid::new_v4();
        let version = ctx.write(vec![Write::put(ENROLMENTS, id, f).expect(0)])?[0];
        Ok(json!({"id": id, "version": version}))
    }

    fn save_attendance(&self, ctx: &mut ModuleContext<'_>, a: AttendanceIn) -> CoreResult<Value> {
        let g = self.get(ctx, GROUPS, a.grupa, "grupa")?;
        let data = date_arg("data ședinței", &a.data)?;
        if data < s(&g, "de_la") || data > s(&g, "pana_la") {
            return Err(bad("data ședinței", "e în afara perioadei grupei"));
        }
        let enrolled: Vec<String> = self
            .all(ctx, ENROLMENTS)?
            .iter()
            .filter(|e| s(e, "grupa") == a.grupa.to_string() && s(e, "de_la") <= data)
            .filter(|e| s(e, "pana_la").is_empty() || s(e, "pana_la") >= data)
            .map(|e| s(e, "cursant"))
            .collect();
        let mut present: Vec<String> = a.prezenti.iter().map(Uuid::to_string).collect();
        present.sort();
        present.dedup();
        if let Some(x) = present.iter().find(|p| !enrolled.contains(p)) {
            let name = x
                .parse()
                .ok()
                .and_then(|u| ctx.get(TRAINEES, u).ok().flatten())
                .map(|t| s(&t, "nume"))
                .unwrap_or_default();
            return Err(bad("prezența", format!("{name} nu era înscris(ă) în grupă la {data}")));
        }
        if !a.tinuta && !present.is_empty() {
            return Err(bad("prezența", "o ședință care nu s-a ținut nu are prezenți"));
        }
        // One record per group and day: the existing one is updated (never a second one).
        let existing = self
            .all(ctx, ATTENDANCE)?
            .into_iter()
            .find(|r| s(r, "grupa") == a.grupa.to_string() && s(r, "data") == data);
        let mut f = Fields::new();
        f.insert("grupa".into(), json!(a.grupa.to_string()));
        f.insert("data".into(), json!(data));
        f.insert("prezenti".into(), json!(present));
        f.insert("tinuta".into(), json!(a.tinuta));
        f.insert("nota".into(), json!(text("nota", &a.nota, 500, false)?));
        let (id, expect) = existing.map_or((Uuid::new_v4(), 0), |r| (r.id, r.version));
        let version = ctx.write(vec![Write::put(ATTENDANCE, id, f).expect(expect)])?[0];
        let planned = sessions(&data[0..7], &s(&g, "de_la"), &s(&g, "pana_la"), &days_of(&g)).contains(&data);
        Ok(json!({"id": id, "version": version, "extra": !planned}))
    }

    fn detail(&self, ctx: &mut ModuleContext<'_>, a: GroupOpen) -> CoreResult<Value> {
        let g = self.get(ctx, GROUPS, a.id, "grupa")?;
        let today = date_arg("ziua de azi", &a.azi)?;
        if month_index(&a.luna).is_none() || a.luna.len() != 7 {
            return Err(bad("luna", format!("„{}” nu e AAAA-LL", a.luna)));
        }
        let gid = g.id.to_string();
        let enrolments: Vec<RecordState> = self
            .all(ctx, ENROLMENTS)?
            .into_iter()
            .filter(|e| s(e, "grupa") == gid)
            .collect();
        let trainees = self.all(ctx, TRAINEES)?;
        let payments = self.all(ctx, PAYMENTS)?;
        let attendance: Vec<RecordState> = self
            .all(ctx, ATTENDANCE)?
            .into_iter()
            .filter(|r| s(r, "grupa") == gid)
            .collect();
        let held: Vec<&RecordState> = attendance
            .iter()
            .filter(|r| b(r, "tinuta") && s(r, "data") <= today)
            .collect();
        let mut people: Vec<Value> = enrolments
            .iter()
            .map(|e| {
                let t = trainees.iter().find(|t| t.id.to_string() == s(e, "cursant"));
                let cid = s(e, "cursant");
                let from = s(e, "de_la");
                let to = s(e, "pana_la");
                let mine: Vec<&&RecordState> = held
                    .iter()
                    .filter(|r| s(r, "data") >= from && (to.is_empty() || s(r, "data") <= to))
                    .collect();
                let came = mine
                    .iter()
                    .filter(|r| r.fields.get("prezenti").and_then(Value::as_array).is_some_and(|p| p.contains(&json!(cid))))
                    .count();
                let (due, paid) = self.money(e, &g, &payments, &today);
                let pays: Vec<Value> = payments
                    .iter()
                    .filter(|p| s(p, "inscriere") == e.id.to_string())
                    .map(|p| json!({"id": p.id, "version": p.version, "data": s(p, "data"), "suma": i(p, "suma"), "fel": s(p, "fel"),
                        "document": s(p, "document"), "anulata": b(p, "anulata"), "motiv": s(p, "motiv")}))
                    .collect();
                json!({
                    "inscriere": e.id, "version": e.version, "cursant": cid, "nume": t.map(|t| s(t, "nume")).unwrap_or_default(),
                    "tutore": t.map(|t| s(t, "tutore")).unwrap_or_default(), "telefon": t.map(|t| s(t, "telefon")).unwrap_or_default(),
                    "de_la": from, "pana_la": to, "stare": s(e, "stare"), "taxa": fee_of(e, &g),
                    "sedinte": mine.len(), "prezent": came, "datorat": due, "platit": paid, "rest": due - paid, "plati": pays,
                })
            })
            .collect();
        people.sort_by_key(|p| (p["stare"] != "activ", fold(p["nume"].as_str().unwrap_or(""))));
        let planned = sessions(&a.luna, &s(&g, "de_la"), &s(&g, "pana_la"), &days_of(&g));
        let mut days: Vec<String> = planned.clone();
        for r in &attendance {
            let d = s(r, "data");
            if d.starts_with(&a.luna) && !days.contains(&d) {
                days.push(d);
            }
        }
        days.sort();
        let month: Vec<Value> = days
            .iter()
            .map(|d| {
                let r = attendance.iter().find(|r| s(r, "data") == *d);
                json!({"data": d, "planificata": planned.contains(d), "notata": r.is_some(),
                    "tinuta": r.is_none_or(|r| b(r, "tinuta")),
                    "prezenti": r.and_then(|r| r.fields.get("prezenti").cloned()).unwrap_or(json!([]))})
            })
            .collect();
        let mut view = self.group_view(&g, &enrolments);
        view["cursanti"] = json!(people);
        view["sedinte_luna"] = json!(month);
        Ok(view)
    }

    fn arrears(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<Value> {
        let groups = self.all(ctx, GROUPS)?;
        let trainees = self.all(ctx, TRAINEES)?;
        let payments = self.all(ctx, PAYMENTS)?;
        let mut out: Vec<Value> = Vec::new();
        for e in self.all(ctx, ENROLMENTS)? {
            let Some(g) = groups.iter().find(|g| g.id.to_string() == s(&e, "grupa")) else {
                continue;
            };
            let (due, paid) = self.money(&e, g, &payments, today);
            if due > paid {
                let t = trainees.iter().find(|t| t.id.to_string() == s(&e, "cursant"));
                out.push(json!({"inscriere": e.id, "grupa": g.id, "grupa_nume": s(g, "nume"),
                    "nume": t.map(|t| s(t, "nume")).unwrap_or_default(), "telefon": t.map(|t| s(t, "telefon")).unwrap_or_default(),
                    "tutore": t.map(|t| s(t, "tutore")).unwrap_or_default(), "datorat": due, "platit": paid, "rest": due - paid}));
            }
        }
        out.sort_by_key(|v| std::cmp::Reverse(v["rest"].as_i64().unwrap_or(0)));
        let total: i64 = out.iter().map(|v| v["rest"].as_i64().unwrap_or(0)).sum();
        Ok(json!({"total": total, "restante": out}))
    }
}

impl Module for Courses {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "grupe" => {
                let a: Today = args(command, a)?;
                date_arg("ziua de azi", &a.azi)?;
                let enrolments = self.all(ctx, ENROLMENTS)?;
                let mut l: Vec<RecordState> = self.all(ctx, GROUPS)?;
                l.sort_by_key(|g| (!b(g, "activ"), fold(&s(g, "nume"))));
                Ok(json!(
                    l.iter().map(|g| self.group_view(g, &enrolments)).collect::<Vec<_>>()
                ))
            }
            "grupa" => self.detail(ctx, args(command, a)?),
            "grupa_save" => self.save_group(ctx, args(command, a)?),
            "grupa_delete" => {
                let a: ById = args(command, a)?;
                let n = self
                    .all(ctx, ENROLMENTS)?
                    .iter()
                    .filter(|e| s(e, "grupa") == a.id.to_string())
                    .count();
                if n > 0 {
                    return Err(bad(
                        "grupa",
                        format!("are {n} înscrieri și nu se șterge; marcheaz-o ca inactivă"),
                    ));
                }
                ctx.write(vec![Write::delete(GROUPS, a.id).expect(a.version)])?;
                Ok(Value::Null)
            }
            "cursanti" => {
                let a: Search = args(command, a)?;
                let q = fold(a.text.trim());
                let mut l: Vec<RecordState> = self
                    .all(ctx, TRAINEES)?
                    .into_iter()
                    .filter(|t| q.is_empty() || fold(&s(t, "nume")).contains(&q) || fold(&s(t, "tutore")).contains(&q))
                    .collect();
                l.sort_by_key(|t| fold(&s(t, "nume")));
                Ok(json!(
                    l.iter()
                        .map(|t| json!({"id": t.id, "version": t.version, "nume": s(t, "nume"), "telefon": s(t, "telefon"),
                            "email": s(t, "email"), "tutore": s(t, "tutore"), "nota": s(t, "nota")}))
                        .collect::<Vec<_>>()
                ))
            }
            "cursant_save" => self.save_trainee(ctx, args(command, a)?),
            "cursant_delete" => {
                let a: ById = args(command, a)?;
                let n = self
                    .all(ctx, ENROLMENTS)?
                    .iter()
                    .filter(|e| s(e, "cursant") == a.id.to_string())
                    .count();
                if n > 0 {
                    return Err(bad("cursantul", format!("are {n} înscrieri și nu se șterge")));
                }
                ctx.write(vec![Write::delete(TRAINEES, a.id).expect(a.version)])?;
                Ok(Value::Null)
            }
            "inscrie" => self.enrol(ctx, args(command, a)?),
            "retrage" => {
                let a: LeaveIn = args(command, a)?;
                let e = self.get(ctx, ENROLMENTS, a.id, "înscrierea")?;
                if s(&e, "stare") != "activ" {
                    return Err(bad("înscrierea", "e deja retrasă"));
                }
                let d = date_arg("data retragerii", &a.data)?;
                if d < s(&e, "de_la") {
                    return Err(bad("data retragerii", "e înaintea înscrierii"));
                }
                let mut f = e.fields.clone();
                f.insert("pana_la".into(), json!(d));
                f.insert("stare".into(), json!("retras"));
                let version = ctx.write(vec![Write::put(ENROLMENTS, a.id, f).expect(a.version)])?[0];
                Ok(json!({"id": a.id, "version": version}))
            }
            "prezenta_save" => self.save_attendance(ctx, args(command, a)?),
            "plata_save" => {
                let a: PaymentIn = args(command, a)?;
                self.get(ctx, ENROLMENTS, a.inscriere, "înscrierea")?;
                if !(1..=100_000_000).contains(&a.suma) {
                    return Err(bad("suma", "trebuie să fie mai mare decât zero"));
                }
                if !PAY_KINDS.contains(&a.fel.as_str()) {
                    return Err(bad("felul plății", "e numerar, card sau transfer"));
                }
                let mut f = Fields::new();
                f.insert("inscriere".into(), json!(a.inscriere.to_string()));
                f.insert("data".into(), json!(date_arg("data plății", &a.data)?));
                f.insert("suma".into(), json!(a.suma));
                f.insert("fel".into(), json!(a.fel));
                f.insert("document".into(), json!(text("documentul", &a.document, 60, false)?));
                f.insert("nota".into(), json!(text("nota", &a.nota, 500, false)?));
                f.insert("anulata".into(), json!(false));
                f.insert("motiv".into(), json!(""));
                f.insert("creat_ms".into(), json!(now()));
                let id = Uuid::new_v4();
                let version = ctx.write(vec![Write::put(PAYMENTS, id, f).expect(0)])?[0];
                Ok(json!({"id": id, "version": version}))
            }
            "plata_anuleaza" => {
                let a: CancelIn = args(command, a)?;
                let p = self.get(ctx, PAYMENTS, a.id, "plata")?;
                if b(&p, "anulata") {
                    return Err(bad("plata", "e deja anulată"));
                }
                let m = text("motivul", &a.motiv, 300, true)?;
                if m.chars().count() < 3 {
                    return Err(bad("motivul", "are cel puțin 3 caractere"));
                }
                let mut f = p.fields.clone();
                f.insert("anulata".into(), json!(true));
                f.insert("motiv".into(), json!(m));
                let version = ctx.write(vec![Write::put(PAYMENTS, a.id, f).expect(a.version)])?[0];
                Ok(json!({"id": a.id, "version": version}))
            }
            "restante" => {
                let a: Today = args(command, a)?;
                let today = date_arg("ziua de azi", &a.azi)?;
                self.arrears(ctx, &today)
            }
            other => Err(bad("comanda", format!("„{other}” nu e cunoscută"))),
        }
    }
}
