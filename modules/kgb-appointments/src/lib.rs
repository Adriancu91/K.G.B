//! `kgb.appointments` — „Programări” (Etapa 7, step 7.9e): appointments of clients with people, rooms or equipment.
//!
//! - **Resources** (`resurse`): who or what is booked, with working hours per weekday (several intervals a day,
//!   for the lunch break), days off, active or not.
//! - **Services** (`servicii`): name, length in minutes, price in bani (0 = none), the resources that do it.
//! - **Appointments** (`programari`): start (Romania's local time as written, `AAAA-LL-ZZTHH:MM`), length,
//!   resource, service, client (name, phone, partner id — text only, modules do not call each other), note, state.
//!
//! Rules: two active appointments of the same resource do not overlap (checked on this PC; two PCs offline can
//! still write overlapping ones, which meet at synchronisation: `zi` / `saptamana` mark them `suprapusa`). Outside
//! the resource's hours a save needs `in_afara_programului: true`. An appointment that has started is not moved;
//! only its state changes. The client's phone is personal data: it is kept here, never in a notice or in the log.
//!
//! Commands: `resurse`, `resursa_save`, `resursa_delete`, `servicii`, `serviciu_save`, `serviciu_delete`,
//! `zi {data, resursa?}`, `saptamana {de_la, resursa?}`, `libere {data, resursa?, serviciu?, durata?}`,
//! `programare_save {...}`, `programare_stare {id, version, stare}`, `cauta {text}`.

use std::collections::BTreeMap;

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::notifications::{Level, Notice};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Map, Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.appointments";
pub const RESOURCES: &str = "resurse";
pub const SERVICES: &str = "servicii";
pub const APPOINTMENTS: &str = "programari";
pub const KINDS: [&str; 3] = ["persoana", "loc", "echipament"];
pub const STATES: [&str; 5] = ["programat", "confirmat", "venit", "anulat", "neprezentat"];
/// The free times are offered every this many minutes.
const STEP: u32 = 5;
/// The morning reminder of today's unconfirmed appointments comes from this hour (local time).
const MORNING: u32 = 7;

pub struct Appointments {
    manifest: Manifest,
}

impl Appointments {
    pub fn new() -> Appointments {
        Appointments {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Appointments {
    fn default() -> Self {
        Appointments::new()
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

// ---------- days and times ----------

/// Days since 1970-01-01 of `AAAA-LL-ZZ`, if it is a real date.
pub fn day_number(d: &str) -> Option<i64> {
    let b = d.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return None;
    }
    let (y, m, dd): (i64, i64, i64) = (d[0..4].parse().ok()?, d[5..7].parse().ok()?, d[8..10].parse().ok()?);
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    let dim = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if !(1900..=2200).contains(&y) || !(1..=12).contains(&m) || dd < 1 || dd > dim[(m - 1) as usize] {
        return None;
    }
    let (yy, mm) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
    let era = yy.div_euclid(400);
    let yoe = yy - era * 400;
    let doy = (153 * mm + 2) / 5 + dd - 1;
    Some(era * 146_097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719_468)
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

/// ISO weekday of a day number: 1 = Monday … 7 = Sunday.
pub fn weekday(z: i64) -> u32 {
    ((z + 3).rem_euclid(7) + 1) as u32
}

/// `HH:MM` → minutes since midnight.
fn minutes(t: &str) -> Option<u32> {
    let (h, m) = t.trim().split_once(':')?;
    if h.len() != 2 || m.len() != 2 {
        return None;
    }
    let (h, m): (u32, u32) = (h.parse().ok()?, m.parse().ok()?);
    (h <= 24 && m < 60 && h * 60 + m <= 24 * 60).then_some(h * 60 + m)
}

fn hhmm(m: u32) -> String {
    format!("{:02}:{:02}", m / 60, m % 60)
}

/// `AAAA-LL-ZZTHH:MM` (or with a space) → (day number, minutes).
pub fn split_start(t: &str) -> Option<(i64, u32)> {
    let (d, h) = t.trim().split_once(['T', ' '])?;
    let m = minutes(h)?;
    (m < 24 * 60).then_some((day_number(d)?, m))
}

fn start_text(day: i64, m: u32) -> String {
    format!("{}T{}", date_of(day), hhmm(m))
}

/// The local date and minutes now (Windows' clock with its summer time; UTC elsewhere).
pub fn local_now() -> (i64, u32) {
    #[cfg(windows)]
    {
        use windows_sys::Win32::Foundation::SYSTEMTIME;
        use windows_sys::Win32::System::SystemInformation::GetLocalTime;
        // SAFETY: GetLocalTime fills the SYSTEMTIME it is given.
        let t: SYSTEMTIME = unsafe {
            let mut t = std::mem::zeroed();
            GetLocalTime(&mut t);
            t
        };
        let d = format!("{:04}-{:02}-{:02}", t.wYear, t.wMonth, t.wDay);
        (day_number(&d).unwrap_or(0), u32::from(t.wHour) * 60 + u32::from(t.wMinute))
    }
    #[cfg(not(windows))]
    {
        let secs = (now_ms() / 1000) as i64;
        (secs.div_euclid(86_400), (secs.rem_euclid(86_400) / 60) as u32)
    }
}

/// A day's working intervals `HH:MM–HH:MM` → minutes, sorted, not overlapping.
fn intervals(list: &[Value]) -> CoreResult<Vec<(u32, u32)>> {
    let mut out = Vec::new();
    for v in list {
        let t = v.as_str().unwrap_or_default();
        let (a, b) = t
            .split_once(['-', '–'])
            .ok_or_else(|| bad("programul", format!("„{t}” nu e un interval HH:MM-HH:MM")))?;
        let (a, b) = (
            minutes(a).ok_or_else(|| bad("programul", format!("„{t}” nu e un interval HH:MM-HH:MM")))?,
            minutes(b).ok_or_else(|| bad("programul", format!("„{t}” nu e un interval HH:MM-HH:MM")))?,
        );
        if a >= b {
            return Err(bad("programul", format!("„{t}”: sfârșitul e înaintea începutului")));
        }
        out.push((a, b));
    }
    out.sort_unstable();
    if out.windows(2).any(|w| w[1].0 < w[0].1) {
        return Err(bad("programul", "intervalele unei zile se suprapun"));
    }
    Ok(out)
}

/// The hours of a resource on a day: none on a day off or a day without intervals.
fn hours_on(res: &RecordState, day: i64) -> Vec<(u32, u32)> {
    let date = json!(date_of(day));
    if res.fields.get("libere").and_then(Value::as_array).is_some_and(|l| l.contains(&date)) {
        return Vec::new();
    }
    res.fields
        .get("program")
        .and_then(|p| p.get(weekday(day).to_string()))
        .and_then(Value::as_array)
        .and_then(|l| intervals(l).ok())
        .unwrap_or_default()
}

fn active(r: &RecordState) -> bool {
    !matches!(s(r, "stare").as_str(), "anulat" | "neprezentat")
}

// ---------- the module ----------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ResourceSave {
    id: Option<Uuid>,
    version: Option<u64>,
    nume: String,
    fel: String,
    /// {"1": ["08:00-12:00", "13:00-17:00"], …, "7": []}
    program: Map<String, Value>,
    #[serde(default)]
    libere: Vec<String>,
    #[serde(default = "yes")]
    activa: bool,
    #[serde(default)]
    nota: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ServiceSave {
    id: Option<Uuid>,
    version: Option<u64>,
    nume: String,
    durata: i64,
    #[serde(default)]
    pret: i64,
    #[serde(default)]
    resurse: Vec<Uuid>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ByIdVersion {
    id: Uuid,
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Day {
    data: String,
    #[serde(default)]
    resursa: Option<Uuid>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Week {
    de_la: String,
    #[serde(default)]
    resursa: Option<Uuid>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Free {
    data: String,
    #[serde(default)]
    resursa: Option<Uuid>,
    #[serde(default)]
    serviciu: Option<Uuid>,
    #[serde(default)]
    durata: Option<u32>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct AppointmentSave {
    id: Option<Uuid>,
    version: Option<u64>,
    start: String,
    #[serde(default)]
    durata: Option<u32>,
    resursa: Uuid,
    #[serde(default)]
    serviciu: Option<Uuid>,
    client: String,
    #[serde(default)]
    telefon: String,
    #[serde(default)]
    partener: Option<Uuid>,
    #[serde(default)]
    nota: String,
    #[serde(default)]
    in_afara_programului: bool,
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
struct Search {
    text: String,
}

fn yes() -> bool {
    true
}

impl Appointments {
    fn live(&self, ctx: &mut ModuleContext<'_>, c: &str, id: Uuid, what: &str) -> CoreResult<RecordState> {
        ctx.get(c, id)?.filter(|r| !r.deleted).ok_or_else(|| bad(what, "nu mai există"))
    }

    fn all(&self, ctx: &mut ModuleContext<'_>, c: &str) -> CoreResult<Vec<RecordState>> {
        ctx.scan(c, |r| !r.deleted)
    }

    fn resource_view(r: &RecordState) -> Value {
        json!({"id": r.id, "version": r.version, "nume": s(r, "nume"), "fel": s(r, "fel"), "program": r.fields.get("program"),
               "libere": r.fields.get("libere"), "activa": r.fields.get("activa") == Some(&json!(true)), "nota": s(r, "nota")})
    }

    fn resource_save(&self, ctx: &mut ModuleContext<'_>, a: ResourceSave) -> CoreResult<Value> {
        let nume = a.nume.trim().to_string();
        if nume.is_empty() || nume.chars().count() > 100 {
            return Err(bad("numele", "are 1–100 de caractere"));
        }
        if !KINDS.contains(&a.fel.as_str()) {
            return Err(bad("felul", format!("„{}” nu e persoană, loc sau echipament", a.fel)));
        }
        let mut program = Map::new();
        for (k, v) in &a.program {
            if !matches!(k.as_str(), "1" | "2" | "3" | "4" | "5" | "6" | "7") {
                return Err(bad("programul", format!("ziua „{k}” nu există (1 = luni … 7 = duminică)")));
            }
            let list = v.as_array().ok_or_else(|| bad("programul", "fiecare zi are o listă de intervale"))?;
            let iv = intervals(list)?;
            program.insert(k.clone(), json!(iv.iter().map(|(x, y)| format!("{}-{}", hhmm(*x), hhmm(*y))).collect::<Vec<_>>()));
        }
        let mut libere = Vec::new();
        for d in &a.libere {
            day_number(d).ok_or_else(|| bad("zilele libere", format!("„{d}” nu e o dată AAAA-LL-ZZ")))?;
            libere.push(json!(d));
        }
        if libere.len() > 366 || a.nota.chars().count() > 500 {
            return Err(bad("resursa", "prea multe zile libere sau o notă prea lungă"));
        }
        let (id, expect) = match a.id {
            Some(id) => (id, a.version.unwrap_or(self.live(ctx, RESOURCES, id, "resursa")?.version)),
            None => (Uuid::now_v7(), 0),
        };
        let mut f = Fields::new();
        f.insert("nume".into(), json!(nume));
        f.insert("fel".into(), json!(a.fel));
        f.insert("program".into(), Value::Object(program));
        f.insert("libere".into(), json!(libere));
        f.insert("activa".into(), json!(a.activa));
        f.insert("nota".into(), json!(a.nota.trim()));
        ctx.write(vec![Write::put(RESOURCES, id, f).expect(expect)])?;
        Ok(json!({"id": id}))
    }

    fn service_save(&self, ctx: &mut ModuleContext<'_>, a: ServiceSave) -> CoreResult<Value> {
        let nume = a.nume.trim().to_string();
        if nume.is_empty() || nume.chars().count() > 120 {
            return Err(bad("numele serviciului", "are 1–120 de caractere"));
        }
        if !(5..=600).contains(&a.durata) {
            return Err(bad("durata", "e între 5 și 600 de minute"));
        }
        if a.pret < 0 {
            return Err(bad("prețul", "nu poate fi negativ"));
        }
        for r in &a.resurse {
            self.live(ctx, RESOURCES, *r, "resursa serviciului")?;
        }
        let (id, expect) = match a.id {
            Some(id) => (id, a.version.unwrap_or(self.live(ctx, SERVICES, id, "serviciul")?.version)),
            None => (Uuid::now_v7(), 0),
        };
        let mut f = Fields::new();
        f.insert("nume".into(), json!(nume));
        f.insert("durata".into(), json!(a.durata));
        f.insert("pret".into(), json!(a.pret));
        f.insert("resurse".into(), json!(a.resurse.iter().map(Uuid::to_string).collect::<Vec<_>>()));
        ctx.write(vec![Write::put(SERVICES, id, f).expect(expect)])?;
        Ok(json!({"id": id}))
    }

    /// The appointments of some days (day numbers, inclusive), each marked when it overlaps another active one of
    /// the same resource (as after two PCs booked the same time offline).
    fn on_days(&self, ctx: &mut ModuleContext<'_>, from: i64, to: i64, res: Option<Uuid>) -> CoreResult<Vec<Value>> {
        let all = self.all(ctx, APPOINTMENTS)?;
        let mut picked: Vec<(i64, u32, &RecordState)> = all
            .iter()
            .filter_map(|r| split_start(&s(r, "start")).map(|(d, m)| (d, m, r)))
            .filter(|(d, _, r)| *d >= from && *d <= to && res.is_none_or(|x| s(r, "resursa") == x.to_string()))
            .collect();
        picked.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
        let mut out = Vec::new();
        for (d, m, r) in &picked {
            let end = m + i(r, "durata") as u32;
            let overlap = active(r)
                && picked.iter().any(|(d2, m2, r2)| {
                    r2.id != r.id && d2 == d && active(r2) && s(r2, "resursa") == s(r, "resursa") && *m2 < end && m2 + i(r2, "durata") as u32 > *m
                });
            out.push(json!({
                "id": r.id, "version": r.version, "start": s(r, "start"), "data": date_of(*d), "ora": hhmm(*m), "sfarsit": hhmm(end),
                "durata": i(r, "durata"), "resursa": s(r, "resursa"), "serviciu": s(r, "serviciu"), "client": s(r, "client"),
                "telefon": s(r, "telefon"), "partener": s(r, "partener"), "nota": s(r, "nota"), "stare": s(r, "stare"),
                "suprapusa": overlap,
            }));
        }
        Ok(out)
    }

    /// The free start times of a resource on a day, for `length` minutes.
    fn free_times(&self, res: &RecordState, day: i64, length: u32, taken: &[(u32, u32)]) -> Vec<String> {
        let mut out = Vec::new();
        for (a, b) in hours_on(res, day) {
            let mut t = a.div_ceil(STEP) * STEP;
            while t + length <= b {
                if !taken.iter().any(|(x, y)| t < *y && t + length > *x) {
                    out.push(hhmm(t));
                }
                t += STEP;
            }
        }
        out
    }

    fn taken(&self, ctx: &mut ModuleContext<'_>, res: Uuid, day: i64, except: Option<Uuid>) -> CoreResult<Vec<(u32, u32)>> {
        let key = json!(res.to_string());
        Ok(ctx
            .scan(APPOINTMENTS, |r| !r.deleted && r.fields.get("resursa") == Some(&key))?
            .iter()
            .filter(|r| active(r) && Some(r.id) != except)
            .filter_map(|r| split_start(&s(r, "start")).filter(|(d, _)| *d == day).map(|(_, m)| (m, m + i(r, "durata") as u32)))
            .collect())
    }

    fn free(&self, ctx: &mut ModuleContext<'_>, a: Free) -> CoreResult<Value> {
        let day = day_number(&a.data).ok_or_else(|| bad("data", format!("„{}” nu e o dată AAAA-LL-ZZ", a.data)))?;
        let service = match a.serviciu {
            Some(id) => Some(self.live(ctx, SERVICES, id, "serviciul")?),
            None => None,
        };
        let length = match (&service, a.durata) {
            (_, Some(d)) => d,
            (Some(sv), None) => i(sv, "durata") as u32,
            (None, None) => return Err(bad("durata", "alege un serviciu sau scrie durata")),
        };
        if !(5..=600).contains(&length) {
            return Err(bad("durata", "e între 5 și 600 de minute"));
        }
        let allowed: Vec<String> = service
            .as_ref()
            .and_then(|sv| sv.fields.get("resurse").and_then(Value::as_array))
            .map(|l| l.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();
        let mut out = Vec::new();
        for r in self.all(ctx, RESOURCES)? {
            if r.fields.get("activa") != Some(&json!(true))
                || a.resursa.is_some_and(|x| x != r.id)
                || (!allowed.is_empty() && !allowed.contains(&r.id.to_string()))
            {
                continue;
            }
            let taken = self.taken(ctx, r.id, day, None)?;
            out.push(json!({"resursa": r.id, "nume": s(&r, "nume"), "ore": self.free_times(&r, day, length, &taken)}));
        }
        Ok(json!(out))
    }

    fn appointment_save(&self, ctx: &mut ModuleContext<'_>, a: AppointmentSave) -> CoreResult<Value> {
        let (day, m) = split_start(&a.start).ok_or_else(|| bad("începutul", format!("„{}” nu e o dată și o oră", a.start)))?;
        let res = self.live(ctx, RESOURCES, a.resursa, "resursa")?;
        if res.fields.get("activa") != Some(&json!(true)) {
            return Err(bad("resursa", format!("„{}” nu mai primește programări", s(&res, "nume"))));
        }
        let service = match a.serviciu {
            Some(id) => Some(self.live(ctx, SERVICES, id, "serviciul")?),
            None => None,
        };
        if let Some(sv) = &service {
            let allowed = sv.fields.get("resurse").and_then(Value::as_array).cloned().unwrap_or_default();
            if !allowed.is_empty() && !allowed.contains(&json!(a.resursa.to_string())) {
                return Err(bad("serviciul", format!("„{}” nu se face la „{}”", s(sv, "nume"), s(&res, "nume"))));
            }
        }
        let length = a.durata.or_else(|| service.as_ref().map(|sv| i(sv, "durata") as u32)).unwrap_or(30);
        if !(5..=600).contains(&length) {
            return Err(bad("durata", "e între 5 și 600 de minute"));
        }
        if m + length > 24 * 60 {
            return Err(bad("programarea", "se termină în ziua următoare"));
        }
        let client = a.client.trim().to_string();
        if client.is_empty() || client.chars().count() > 200 || a.telefon.chars().count() > 40 || a.nota.chars().count() > 1000 {
            return Err(bad("clientul", "numele are 1–200 de caractere, telefonul cel mult 40, nota cel mult 1000"));
        }
        let now = local_now();
        let (id, expect, state, created) = match a.id {
            Some(id) => {
                let old = self.live(ctx, APPOINTMENTS, id, "programarea")?;
                if let Some((d0, m0)) = split_start(&s(&old, "start"))
                    && (d0, m0) <= now
                    && s(&old, "start") != start_text(day, m)
                {
                    return Err(bad("programarea", "a început deja: nu se mai mută, i se schimbă doar starea"));
                }
                (id, a.version.unwrap_or(old.version), s(&old, "stare"), i(&old, "creat_ms"))
            }
            None => (Uuid::now_v7(), 0, "programat".to_string(), now_ms() as i64),
        };
        let within = hours_on(&res, day).iter().any(|(x, y)| m >= *x && m + length <= *y);
        if !within && !a.in_afara_programului {
            return Err(bad(
                "programarea",
                format!("{} {}–{} e în afara programului pentru „{}”; confirmă dacă vrei totuși", date_of(day), hhmm(m), hhmm(m + length), s(&res, "nume")),
            ));
        }
        if self.taken(ctx, a.resursa, day, Some(id))?.iter().any(|(x, y)| m < *y && m + length > *x) {
            return Err(bad("programarea", format!("„{}” are deja o programare între {} și {}", s(&res, "nume"), hhmm(m), hhmm(m + length))));
        }
        let mut f = Fields::new();
        f.insert("start".into(), json!(start_text(day, m)));
        f.insert("durata".into(), json!(length));
        f.insert("resursa".into(), json!(a.resursa.to_string()));
        f.insert("serviciu".into(), json!(a.serviciu.map(|x| x.to_string()).unwrap_or_default()));
        f.insert("client".into(), json!(client));
        f.insert("telefon".into(), json!(a.telefon.trim()));
        f.insert("partener".into(), json!(a.partener.map(|x| x.to_string()).unwrap_or_default()));
        f.insert("nota".into(), json!(a.nota.trim()));
        f.insert("stare".into(), json!(state));
        f.insert("creat_ms".into(), json!(created));
        ctx.write(vec![Write::put(APPOINTMENTS, id, f).expect(expect)])?;
        ctx.log(&format!("programare {id} salvată ({})", start_text(day, m)));
        Ok(json!({"id": id, "start": start_text(day, m), "sfarsit": hhmm(m + length)}))
    }

    fn appointment_state(&self, ctx: &mut ModuleContext<'_>, a: StateSet) -> CoreResult<Value> {
        if !STATES.contains(&a.stare.as_str()) {
            return Err(bad("starea", format!("„{}” nu e una dintre {}", a.stare, STATES.join(", "))));
        }
        let old = self.live(ctx, APPOINTMENTS, a.id, "programarea")?;
        // Back to an active state: it must not overlap what was booked meanwhile.
        if !active(&old)
            && !matches!(a.stare.as_str(), "anulat" | "neprezentat")
            && let (Ok(res), Some((d, m))) = (s(&old, "resursa").parse::<Uuid>(), split_start(&s(&old, "start")))
        {
            let end = m + i(&old, "durata") as u32;
            if self.taken(ctx, res, d, Some(a.id))?.iter().any(|(x, y)| m < *y && end > *x) {
                return Err(bad("programarea", "între timp ora a fost dată altcuiva"));
            }
        }
        let mut f = old.fields.clone();
        f.insert("stare".into(), json!(a.stare));
        ctx.write(vec![Write::put(APPOINTMENTS, a.id, f).expect(a.version)])?;
        ctx.log(&format!("programare {}: {} → {}", a.id, s(&old, "stare"), a.stare));
        Ok(json!({"id": a.id, "stare": a.stare}))
    }

    fn search(&self, ctx: &mut ModuleContext<'_>, a: Search) -> CoreResult<Value> {
        let fold = |t: &str| {
            t.to_lowercase()
                .replace(['ă', 'â'], "a")
                .replace('î', "i")
                .replace(['ș', 'ş'], "s")
                .replace(['ț', 'ţ'], "t")
        };
        let q = fold(a.text.trim());
        if q.chars().count() < 2 {
            return Err(bad("căutarea", "scrie cel puțin două litere"));
        }
        let mut hits: Vec<RecordState> = self
            .all(ctx, APPOINTMENTS)?
            .into_iter()
            .filter(|r| fold(&s(r, "client")).contains(&q) || s(r, "telefon").replace(' ', "").contains(&q.replace(' ', "")))
            .collect();
        hits.sort_by_key(|r| std::cmp::Reverse(s(r, "start")));
        Ok(json!(hits.iter().take(100).map(|r| json!({"id": r.id, "start": s(r, "start"), "client": s(r, "client"),
            "resursa": s(r, "resursa"), "serviciu": s(r, "serviciu"), "stare": s(r, "stare")})).collect::<Vec<_>>()))
    }

    /// Tomorrow's count (once a day), and in the morning today's unconfirmed ones; no names, no phones.
    fn reminders(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        let Some(t) = day_number(today) else { return Ok(()) };
        let mut by_day: BTreeMap<(i64, bool), usize> = BTreeMap::new();
        for r in self.all(ctx, APPOINTMENTS)? {
            if let Some((d, _)) = split_start(&s(&r, "start"))
                && (d == t || d == t + 1)
                && active(&r)
            {
                *by_day.entry((d, s(&r, "stare") == "programat")).or_default() += 1;
            }
        }
        let tomorrow = by_day.get(&(t + 1, true)).copied().unwrap_or(0) + by_day.get(&(t + 1, false)).copied().unwrap_or(0);
        let key = format!("maine:{}", date_of(t + 1));
        if tomorrow > 0 && !ctx.notify_key_used(&key)? {
            let text = if tomorrow == 1 { "Mâine: o programare".to_string() } else { format!("Mâine: {tomorrow} programări") };
            ctx.notify(&Notice::new(text, "Vezi lista în Programări.").level(Level::Info).key(key))?;
        }
        let (now_day, now_min) = local_now();
        let unconfirmed = by_day.get(&(t, true)).copied().unwrap_or(0);
        let key = format!("azi:{}", date_of(t));
        if now_day == t && now_min >= MORNING * 60 && unconfirmed > 0 && !ctx.notify_key_used(&key)? {
            let text = if unconfirmed == 1 { "Azi: o programare neconfirmată".to_string() } else { format!("Azi: {unconfirmed} programări neconfirmate") };
            ctx.notify(&Notice::new(text, "Confirmă-le sau anulează-le în Programări.").level(Level::Atentie).key(key))?;
        }
        Ok(())
    }
}

impl Module for Appointments {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn remind(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        self.reminders(ctx, today)
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "resurse" => {
                let mut l = self.all(ctx, RESOURCES)?;
                l.sort_by_key(|r| s(r, "nume").to_lowercase());
                Ok(json!(l.iter().map(Self::resource_view).collect::<Vec<_>>()))
            }
            "resursa_save" => self.resource_save(ctx, args(command, a)?),
            "resursa_delete" => {
                let a: ByIdVersion = args(command, a)?;
                let key = json!(a.id.to_string());
                let (today, _) = local_now();
                let ahead = ctx
                    .scan(APPOINTMENTS, |r| !r.deleted && r.fields.get("resursa") == Some(&key))?
                    .iter()
                    .filter(|r| active(r) && split_start(&s(r, "start")).is_some_and(|(d, _)| d >= today))
                    .count();
                if ahead > 0 {
                    return Err(bad("resursa", format!("are {ahead} programări de azi încolo: mută-le sau anulează-le întâi, sau marcheaz-o inactivă")));
                }
                ctx.write(vec![Write::delete(RESOURCES, a.id).expect(a.version)])?;
                Ok(json!({"deleted": a.id}))
            }
            "servicii" => {
                let mut l = self.all(ctx, SERVICES)?;
                l.sort_by_key(|r| s(r, "nume").to_lowercase());
                Ok(json!(l.iter().map(|r| json!({"id": r.id, "version": r.version, "nume": s(r, "nume"), "durata": i(r, "durata"),
                    "pret": i(r, "pret"), "resurse": r.fields.get("resurse")})).collect::<Vec<_>>()))
            }
            "serviciu_save" => self.service_save(ctx, args(command, a)?),
            "serviciu_delete" => {
                let a: ByIdVersion = args(command, a)?;
                ctx.write(vec![Write::delete(SERVICES, a.id).expect(a.version)])?;
                Ok(json!({"deleted": a.id}))
            }
            "zi" => {
                let a: Day = args(command, a)?;
                let d = day_number(&a.data).ok_or_else(|| bad("data", format!("„{}” nu e o dată AAAA-LL-ZZ", a.data)))?;
                let hours: Vec<Value> = self
                    .all(ctx, RESOURCES)?
                    .iter()
                    .filter(|r| a.resursa.is_none_or(|x| x == r.id))
                    .map(|r| json!({"resursa": r.id, "nume": s(r, "nume"), "activa": r.fields.get("activa") == Some(&json!(true)),
                        "program": hours_on(r, d).iter().map(|(x, y)| format!("{}-{}", hhmm(*x), hhmm(*y))).collect::<Vec<_>>()}))
                    .collect();
                Ok(json!({"data": date_of(d), "zi_saptamana": weekday(d), "resurse": hours, "programari": self.on_days(ctx, d, d, a.resursa)?}))
            }
            "saptamana" => {
                let a: Week = args(command, a)?;
                let d = day_number(&a.de_la).ok_or_else(|| bad("data", format!("„{}” nu e o dată AAAA-LL-ZZ", a.de_la)))?;
                Ok(json!({"de_la": date_of(d), "pana_la": date_of(d + 6), "programari": self.on_days(ctx, d, d + 6, a.resursa)?}))
            }
            "libere" => self.free(ctx, args(command, a)?),
            "programare_save" => self.appointment_save(ctx, args(command, a)?),
            "programare_stare" => self.appointment_state(ctx, args(command, a)?),
            "cauta" => self.search(ctx, args(command, a)?),
            other => Err(CoreError::invalid("comanda", format!("„{other}” nu există în {ID}"))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn days_weekdays_and_times() {
        assert_eq!(day_number("1970-01-01"), Some(0));
        assert_eq!(date_of(day_number("2028-02-29").unwrap()), "2028-02-29");
        assert_eq!(day_number("2026-02-29"), None);
        assert_eq!(weekday(day_number("2026-11-10").unwrap()), 2, "a Tuesday");
        assert_eq!(weekday(day_number("2026-11-15").unwrap()), 7, "a Sunday");
        assert_eq!(split_start("2026-11-10T08:30"), Some((day_number("2026-11-10").unwrap(), 510)));
        assert_eq!(split_start("2026-11-10 24:00"), None);
        assert!(intervals(&[json!("13:00-17:00"), json!("08:00-12:00")]).is_ok());
        assert!(intervals(&[json!("08:00-12:00"), json!("11:00-13:00")]).is_err());
        assert!(intervals(&[json!("12:00-08:00")]).is_err());
    }
}
