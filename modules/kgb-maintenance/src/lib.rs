//! `kgb.maintenance` — „Mentenanța echipamentelor” (Etapa 7, step 7.9e).
//!
//! - **Equipment** (`echipamente`): machines, vehicles (revisions and repairs only; ITP, RCA and the road tax stay
//!   in „Permise și autorizații”), installations, devices, IT; with a counter (hours, km, cycles) or none.
//! - **Plans** (`planuri`): what is done periodically, every so many days and/or every so much counter, counted from
//!   a date and a counter value. A legal check (`verificare_legala`) carries only the person's own text: the module
//!   invents no legal ground or term.
//! - **Interventions** (`interventii`): planned, repairs, checks; cost without VAT (bani), counter, downtime hours.
//! - **Counter readings** (`citiri`): never lower than an earlier one on this PC; one that came lower from another PC
//!   is shown, not hidden.
//!
//! What is due is computed, never written: the last done intervention of a plan (else its start) plus the days and
//! the counter; with both, the one that comes first decides and the answer says which. A plan on a counter without
//! any reading is „fără citire”, not „ok”.
//!
//! Commands: `parteneri {text}`, `echipamente {text?, categorie?, stare?}`, `echipament {id, an}`, `echipament_save`,
//! `echipament_stare {id, version, stare}`, `echipament_delete {id, version}`, `plan_save`, `plan_delete`,
//! `interventie_save`, `interventie_stare`, `citire_save`, `scadente {azi}`, `costuri {an}`.

use std::collections::BTreeMap;

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

pub const ID: &str = "kgb.maintenance";
pub const EQUIPMENT: &str = "echipamente";
pub const PLANS: &str = "planuri";
pub const WORKS: &str = "interventii";
pub const READINGS: &str = "citiri";
pub const CATEGORIES: [&str; 6] = ["utilaj", "vehicul", "instalatie", "aparat", "it", "altul"];
pub const EQUIPMENT_STATES: [&str; 4] = ["functional", "defect", "in_reparatie", "scos"];
pub const UNITS: [&str; 4] = ["", "ore", "km", "cicluri"];
pub const PLAN_KINDS: [&str; 3] = ["preventiv", "verificare_legala", "calibrare"];
pub const WORK_KINDS: [&str; 3] = ["planificata", "reparatie", "verificare"];
pub const WORK_STATES: [&str; 3] = ["programata", "facuta", "anulata"];

pub struct Maintenance {
    manifest: Manifest,
}

impl Maintenance {
    pub fn new() -> Maintenance {
        Maintenance {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Maintenance {
    fn default() -> Self {
        Maintenance::new()
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

// ---------- days ----------

/// Days since 1970-01-01 of `AAAA-LL-ZZ`, if it is a real date.
pub fn day_number(d: &str) -> Option<i64> {
    let by = d.as_bytes();
    if by.len() != 10 || by[4] != b'-' || by[7] != b'-' {
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

fn date_arg(what: &str, t: &str) -> CoreResult<i64> {
    day_number(t.trim()).ok_or_else(|| bad(what, format!("„{t}” nu e o dată AAAA-LL-ZZ")))
}

fn opt_date(what: &str, t: &str) -> CoreResult<String> {
    let t = t.trim();
    if t.is_empty() {
        return Ok(String::new());
    }
    Ok(date_of(date_arg(what, t)?))
}

fn fold(t: &str) -> String {
    t.to_lowercase()
        .replace(['ă', 'â'], "a")
        .replace('î', "i")
        .replace(['ș', 'ş'], "s")
        .replace(['ț', 'ţ'], "t")
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

// ---------- what is due ----------

/// The state of a plan, from the worst: overdue, soon, no reading yet (a counter plan), fine.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Due {
    Depasit,
    Curand,
    FaraCitire,
    Ok,
}

impl Due {
    pub fn text(self) -> &'static str {
        match self {
            Due::Depasit => "depasit",
            Due::Curand => "curand",
            Due::FaraCitire => "fara_citire",
            Due::Ok => "ok",
        }
    }
}

/// One plan's due: the next date and / or counter, the current counter, the state and which part decided.
#[derive(Clone, Debug, PartialEq)]
pub struct PlanDue {
    pub last: Option<i64>,
    pub next_day: Option<i64>,
    pub next_counter: Option<i64>,
    pub counter_now: Option<i64>,
    pub state: Due,
    /// "data", "contor" or "".
    pub by: &'static str,
}

/// What a plan says: every so many days and / or counter, counted from a day and a counter value, warned so many
/// days before.
#[derive(Clone, Copy, Debug)]
pub struct Terms {
    pub la_zile: i64,
    pub la_contor: i64,
    pub start: i64,
    pub start_counter: i64,
    pub warn_days: i64,
}

/// Computes a plan's due as of `today`: from its last done intervention (`last`: day and counter, -1 = not read)
/// or else from its start; `reading` is the equipment's latest counter reading.
pub fn plan_due(terms: Terms, last: Option<(i64, i64)>, reading: Option<i64>, today: i64) -> PlanDue {
    let Terms {
        la_zile,
        la_contor,
        start,
        start_counter,
        warn_days,
    } = terms;
    let base_day = last.map_or(start, |(d, _)| d);
    let base_counter = match last {
        Some((_, c)) if c >= 0 => c,
        _ => start_counter,
    };
    let mut state = Due::Ok;
    let mut by = "";
    let next_day = (la_zile > 0).then(|| base_day + la_zile);
    if let Some(n) = next_day {
        let st = if n < today {
            Due::Depasit
        } else if n - today <= warn_days {
            Due::Curand
        } else {
            Due::Ok
        };
        if st < state || by.is_empty() {
            state = st;
            by = "data";
        }
    }
    let next_counter = (la_contor > 0).then(|| base_counter + la_contor);
    if let Some(n) = next_counter {
        let st = match reading {
            None => Due::FaraCitire,
            Some(r) if r >= n => Due::Depasit,
            Some(r) if n - r <= (la_contor / 10).max(1) => Due::Curand,
            Some(_) => Due::Ok,
        };
        if st < state || by.is_empty() {
            state = st;
            by = "contor";
        }
    }
    PlanDue {
        last: last.map(|(d, _)| d),
        next_day,
        next_counter,
        counter_now: reading,
        state,
        by,
    }
}

// ---------- arguments ----------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PartnerSearch {
    #[serde(default)]
    text: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct List {
    #[serde(default)]
    text: String,
    #[serde(default)]
    categorie: Option<String>,
    #[serde(default)]
    stare: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct One {
    id: Uuid,
    azi: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EquipmentSave {
    id: Option<Uuid>,
    version: Option<u64>,
    nume: String,
    #[serde(default)]
    cod_inventar: String,
    categorie: String,
    #[serde(default)]
    loc: String,
    #[serde(default)]
    producator: String,
    #[serde(default)]
    model: String,
    #[serde(default)]
    serie: String,
    #[serde(default)]
    punere_functiune: String,
    #[serde(default)]
    garantie_pana: String,
    #[serde(default)]
    contor_unitate: String,
    #[serde(default)]
    responsabil: String,
    #[serde(default)]
    nota: String,
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
struct ByIdVersion {
    id: Uuid,
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PlanSave {
    id: Option<Uuid>,
    version: Option<u64>,
    echipament: Uuid,
    denumire: String,
    fel: String,
    #[serde(default)]
    la_zile: i64,
    #[serde(default)]
    la_contor: i64,
    de_la: String,
    #[serde(default)]
    de_la_contor: Option<i64>,
    #[serde(default = "fourteen")]
    avertizare_zile: i64,
    #[serde(default)]
    partener: Option<Uuid>,
    #[serde(default)]
    partener_nume: String,
    #[serde(default = "yes")]
    activ: bool,
}

fn fourteen() -> i64 {
    14
}

fn yes() -> bool {
    true
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WorkSave {
    id: Option<Uuid>,
    version: Option<u64>,
    echipament: Uuid,
    #[serde(default)]
    plan: Option<Uuid>,
    fel: String,
    data: String,
    #[serde(default)]
    descriere: String,
    #[serde(default)]
    cine: String,
    #[serde(default)]
    partener: Option<Uuid>,
    #[serde(default)]
    cost: i64,
    #[serde(default = "unread")]
    contor: i64,
    #[serde(default)]
    oprire_ore: i64,
    #[serde(default)]
    piese: String,
    stare: String,
    #[serde(default)]
    document: String,
    azi: String,
}

fn unread() -> i64 {
    -1
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WorkState {
    id: Uuid,
    version: u64,
    stare: String,
    azi: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ReadingSave {
    echipament: Uuid,
    data: String,
    valoare: i64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Today {
    azi: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Year {
    an: i64,
}

// ---------- the module ----------

impl Maintenance {
    fn live(&self, ctx: &mut ModuleContext<'_>, c: &str, id: Uuid, what: &str) -> CoreResult<RecordState> {
        ctx.get(c, id)?
            .filter(|r| !r.deleted)
            .ok_or_else(|| bad(what, "nu mai există"))
    }

    fn all(&self, ctx: &mut ModuleContext<'_>, c: &str) -> CoreResult<Vec<RecordState>> {
        ctx.scan(c, |r| !r.deleted)
    }

    fn of(&self, ctx: &mut ModuleContext<'_>, c: &str, equipment: Uuid) -> CoreResult<Vec<RecordState>> {
        let key = json!(equipment.to_string());
        ctx.scan(c, |r| !r.deleted && r.fields.get("echipament") == Some(&key))
    }

    fn equipment_view(r: &RecordState) -> Value {
        let mut v = Value::Object(r.fields.clone());
        v["id"] = json!(r.id);
        v["version"] = json!(r.version);
        v
    }

    /// The latest reading of each equipment (by date, then by when it was written).
    fn latest_readings(readings: &[RecordState]) -> BTreeMap<String, i64> {
        let mut by: BTreeMap<String, (String, i64, i64)> = BTreeMap::new();
        for r in readings {
            let e = by.entry(s(r, "echipament")).or_insert((String::new(), -1, -1));
            if (s(r, "data"), i(r, "creat_ms")) > (e.0.clone(), e.2) {
                *e = (s(r, "data"), i(r, "valoare"), i(r, "creat_ms"));
            }
        }
        by.into_iter().map(|(k, (_, v, _))| (k, v)).collect()
    }

    fn due_list(&self, ctx: &mut ModuleContext<'_>, today: i64, only: Option<Uuid>) -> CoreResult<Vec<(Value, Due)>> {
        let equipment: BTreeMap<String, RecordState> = self
            .all(ctx, EQUIPMENT)?
            .into_iter()
            .filter(|e| s(e, "stare") != "scos" && only.is_none_or(|x| x == e.id))
            .map(|e| (e.id.to_string(), e))
            .collect();
        let works = self.all(ctx, WORKS)?;
        let readings = Self::latest_readings(&self.all(ctx, READINGS)?);
        let mut out = Vec::new();
        for p in self.all(ctx, PLANS)? {
            let Some(e) = equipment.get(&s(&p, "echipament")) else {
                continue;
            };
            if !b(&p, "activ") {
                continue;
            }
            let pid = p.id.to_string();
            let last = works
                .iter()
                .filter(|w| s(w, "plan") == pid && s(w, "stare") == "facuta")
                .filter_map(|w| day_number(&s(w, "data")).map(|d| (d, i(w, "contor"), i(w, "creat_ms"))))
                .max_by_key(|(d, _, c)| (*d, *c))
                .map(|(d, c, _)| (d, c));
            let start = day_number(&s(&p, "de_la")).unwrap_or(today);
            let reading = readings.get(&e.id.to_string()).copied();
            let d = plan_due(
                Terms {
                    la_zile: i(&p, "la_zile"),
                    la_contor: i(&p, "la_contor"),
                    start,
                    start_counter: i(&p, "de_la_contor"),
                    warn_days: i(&p, "avertizare_zile"),
                },
                last,
                reading,
                today,
            );
            out.push((
                json!({
                    "plan": p.id, "plan_version": p.version, "denumire": s(&p, "denumire"), "fel": s(&p, "fel"),
                    "echipament": e.id, "echipament_nume": s(e, "nume"), "categorie": s(e, "categorie"),
                    "unitate": s(e, "contor_unitate"), "la_zile": i(&p, "la_zile"), "la_contor": i(&p, "la_contor"),
                    "ultima": d.last.map(date_of).unwrap_or_default(),
                    "urmatoarea_data": d.next_day.map(date_of).unwrap_or_default(),
                    "urmatorul_contor": d.next_counter, "contor_actual": d.counter_now,
                    "zile_ramase": d.next_day.map(|n| n - today),
                    "stare": d.state.text(), "din": d.by, "partener_nume": s(&p, "partener_nume"),
                }),
                d.state,
            ));
        }
        out.sort_by_key(|(v, st)| (*st, v["urmatoarea_data"].as_str().unwrap_or("9999").to_string()));
        Ok(out)
    }

    fn equipment_save(&self, ctx: &mut ModuleContext<'_>, a: EquipmentSave) -> CoreResult<Value> {
        if !CATEGORIES.contains(&a.categorie.as_str()) {
            return Err(bad("categoria", format!("„{}” nu există", a.categorie)));
        }
        if !UNITS.contains(&a.contor_unitate.as_str()) {
            return Err(bad("contorul", "e în ore, km, cicluri sau deloc"));
        }
        let (id, expect, state, created) = match a.id {
            Some(id) => {
                let old = self.live(ctx, EQUIPMENT, id, "echipamentul")?;
                (
                    id,
                    a.version.unwrap_or(old.version),
                    s(&old, "stare"),
                    i(&old, "creat_ms"),
                )
            }
            None => (Uuid::now_v7(), 0, "functional".to_string(), now_ms() as i64),
        };
        let mut f = Fields::new();
        f.insert("nume".into(), json!(text("numele", &a.nume, 120, true)?));
        f.insert(
            "cod_inventar".into(),
            json!(text("codul de inventar", &a.cod_inventar, 40, false)?),
        );
        f.insert("categorie".into(), json!(a.categorie));
        f.insert("loc".into(), json!(text("locul", &a.loc, 120, false)?));
        f.insert(
            "producator".into(),
            json!(text("producătorul", &a.producator, 80, false)?),
        );
        f.insert("model".into(), json!(text("modelul", &a.model, 80, false)?));
        f.insert("serie".into(), json!(text("seria", &a.serie, 80, false)?));
        f.insert(
            "punere_functiune".into(),
            json!(opt_date("punerea în funcțiune", &a.punere_functiune)?),
        );
        f.insert("garantie_pana".into(), json!(opt_date("garanția", &a.garantie_pana)?));
        f.insert("contor_unitate".into(), json!(a.contor_unitate));
        f.insert(
            "responsabil".into(),
            json!(text("responsabilul", &a.responsabil, 120, false)?),
        );
        f.insert("stare".into(), json!(state));
        f.insert("nota".into(), json!(text("nota", &a.nota, 2000, false)?));
        f.insert("creat_ms".into(), json!(created));
        ctx.write(vec![Write::put(EQUIPMENT, id, f).expect(expect)])?;
        Ok(json!({"id": id}))
    }

    fn plan_save(&self, ctx: &mut ModuleContext<'_>, a: PlanSave) -> CoreResult<Value> {
        let e = self.live(ctx, EQUIPMENT, a.echipament, "echipamentul")?;
        if !PLAN_KINDS.contains(&a.fel.as_str()) {
            return Err(bad("felul", "e preventiv, verificare legală sau calibrare"));
        }
        if !(0..=3650).contains(&a.la_zile) || a.la_contor < 0 || (a.la_zile == 0 && a.la_contor == 0) {
            return Err(bad(
                "planul",
                "are nevoie de un interval: la câte zile (1–3650) și/sau la cât contor",
            ));
        }
        if a.la_contor > 0 && s(&e, "contor_unitate").is_empty() {
            return Err(bad(
                "planul",
                format!("„{}” nu are contor: alege-i unitatea întâi", s(&e, "nume")),
            ));
        }
        if !(0..=90).contains(&a.avertizare_zile) {
            return Err(bad("avertizarea", "e între 0 și 90 de zile"));
        }
        let start = date_arg("începutul", &a.de_la)?;
        let mut partner_name = text("firma de service", &a.partener_nume, 200, false)?;
        if let Some(pid) = a.partener {
            partner_name = ctx.partner(pid)?.denumire;
        }
        let start_counter = match a.de_la_contor {
            Some(c) if c >= 0 => c,
            Some(_) => return Err(bad("contorul de la început", "nu poate fi negativ")),
            None => Self::latest_readings(&self.of(ctx, READINGS, a.echipament)?)
                .get(&a.echipament.to_string())
                .copied()
                .unwrap_or(0),
        };
        let (id, expect) = match a.id {
            Some(id) => (id, a.version.unwrap_or(self.live(ctx, PLANS, id, "planul")?.version)),
            None => (Uuid::now_v7(), 0),
        };
        let mut f = Fields::new();
        f.insert("echipament".into(), json!(a.echipament.to_string()));
        f.insert("denumire".into(), json!(text("denumirea", &a.denumire, 200, true)?));
        f.insert("fel".into(), json!(a.fel));
        f.insert("la_zile".into(), json!(a.la_zile));
        f.insert("la_contor".into(), json!(a.la_contor));
        f.insert("de_la".into(), json!(date_of(start)));
        f.insert("de_la_contor".into(), json!(start_counter));
        f.insert("avertizare_zile".into(), json!(a.avertizare_zile));
        f.insert(
            "partener".into(),
            json!(a.partener.map(|x| x.to_string()).unwrap_or_default()),
        );
        f.insert("partener_nume".into(), json!(partner_name));
        f.insert("activ".into(), json!(a.activ));
        ctx.write(vec![Write::put(PLANS, id, f).expect(expect)])?;
        Ok(json!({"id": id}))
    }

    fn work_save(&self, ctx: &mut ModuleContext<'_>, a: WorkSave) -> CoreResult<Value> {
        let e = self.live(ctx, EQUIPMENT, a.echipament, "echipamentul")?;
        if !WORK_KINDS.contains(&a.fel.as_str()) || !WORK_STATES.contains(&a.stare.as_str()) {
            return Err(bad("intervenția", "felul sau starea nu există"));
        }
        let day = date_arg("data", &a.data)?;
        let today = date_arg("data de azi", &a.azi)?;
        if a.stare == "facuta" && day > today {
            return Err(bad("intervenția", "una făcută nu poate avea data în viitor"));
        }
        if let Some(p) = a.plan {
            let plan = self.live(ctx, PLANS, p, "planul")?;
            if s(&plan, "echipament") != a.echipament.to_string() {
                return Err(bad("planul", "e al altui echipament"));
            }
        }
        if a.cost < 0 || a.contor < -1 || !(0..=10_000).contains(&a.oprire_ore) {
            return Err(bad("intervenția", "costul și orele de oprire nu pot fi negative"));
        }
        if a.document.chars().count() > 36 {
            return Err(bad("documentul", "nu e un document din depozit"));
        }
        let (id, expect, created) = match a.id {
            Some(id) => {
                let old = self.live(ctx, WORKS, id, "intervenția")?;
                (id, a.version.unwrap_or(old.version), i(&old, "creat_ms"))
            }
            None => (Uuid::now_v7(), 0, now_ms() as i64),
        };
        let mut f = Fields::new();
        f.insert("echipament".into(), json!(a.echipament.to_string()));
        f.insert("plan".into(), json!(a.plan.map(|x| x.to_string()).unwrap_or_default()));
        f.insert("fel".into(), json!(a.fel));
        f.insert("data".into(), json!(date_of(day)));
        f.insert(
            "descriere".into(),
            json!(text("descrierea", &a.descriere, 2000, false)?),
        );
        f.insert("cine".into(), json!(text("cine a făcut-o", &a.cine, 200, false)?));
        f.insert(
            "partener".into(),
            json!(a.partener.map(|x| x.to_string()).unwrap_or_default()),
        );
        f.insert("cost".into(), json!(a.cost));
        f.insert("contor".into(), json!(a.contor));
        f.insert("oprire_ore".into(), json!(a.oprire_ore));
        f.insert("piese".into(), json!(text("piesele", &a.piese, 1000, false)?));
        f.insert("stare".into(), json!(a.stare));
        f.insert("document".into(), json!(a.document.trim()));
        f.insert("creat_ms".into(), json!(created));
        let mut w = vec![Write::put(WORKS, id, f).expect(expect)];
        // The counter read at the intervention is a reading too (if it is not lower than an earlier one).
        if a.stare == "facuta"
            && a.contor >= 0
            && !s(&e, "contor_unitate").is_empty()
            && let Some(r) = self.reading_write(ctx, &e, day, a.contor)?
        {
            w.push(r);
        }
        ctx.write(w)?;
        // A repaired machine that was down: the page asks whether it works again (nothing written here).
        let ask =
            a.stare == "facuta" && a.fel == "reparatie" && matches!(s(&e, "stare").as_str(), "defect" | "in_reparatie");
        Ok(json!({"id": id, "propune_functional": ask}))
    }

    /// A reading of `value` on `day`, refused when it is lower than an earlier one (or higher than a later one);
    /// `None` when the same value is already there.
    fn reading_write(
        &self,
        ctx: &mut ModuleContext<'_>,
        e: &RecordState,
        day: i64,
        value: i64,
    ) -> CoreResult<Option<Write>> {
        let date = date_of(day);
        let list = self.of(ctx, READINGS, e.id)?;
        if let Some(r) = list.iter().find(|r| s(r, "data") <= date && i(r, "valoare") > value) {
            return Err(bad(
                "citirea",
                format!("{value} e mai mică decât {} citit pe {}", i(r, "valoare"), s(r, "data")),
            ));
        }
        if let Some(r) = list.iter().find(|r| s(r, "data") > date && i(r, "valoare") < value) {
            return Err(bad(
                "citirea",
                format!(
                    "{value} e mai mare decât {} citit mai târziu, pe {}",
                    i(r, "valoare"),
                    s(r, "data")
                ),
            ));
        }
        if list.iter().any(|r| s(r, "data") == date && i(r, "valoare") == value) {
            return Ok(None);
        }
        let mut f = Fields::new();
        f.insert("echipament".into(), json!(e.id.to_string()));
        f.insert("data".into(), json!(date));
        f.insert("valoare".into(), json!(value));
        f.insert("creat_ms".into(), json!(now_ms() as i64));
        Ok(Some(Write::put(READINGS, Uuid::now_v7(), f).expect(0)))
    }

    fn one(&self, ctx: &mut ModuleContext<'_>, a: One) -> CoreResult<Value> {
        let today = date_arg("data de azi", &a.azi)?;
        let e = self.live(ctx, EQUIPMENT, a.id, "echipamentul")?;
        let mut plans = self.of(ctx, PLANS, a.id)?;
        plans.sort_by_key(|p| s(p, "denumire").to_lowercase());
        let mut works = self.of(ctx, WORKS, a.id)?;
        works.sort_by_key(|w| std::cmp::Reverse((s(w, "data"), i(w, "creat_ms"))));
        let mut readings = self.of(ctx, READINGS, a.id)?;
        readings.sort_by_key(|r| (s(r, "data"), i(r, "creat_ms")));
        // A reading lower than one before it (as after two PCs offline) is shown.
        let mut top = i64::MIN;
        let readings_view: Vec<Value> = readings
            .iter()
            .map(|r| {
                let lower = i(r, "valoare") < top;
                top = top.max(i(r, "valoare"));
                json!({"id": r.id, "data": s(r, "data"), "valoare": i(r, "valoare"), "mai_mica": lower})
            })
            .collect();
        let due: BTreeMap<String, Value> = self
            .due_list(ctx, today, Some(a.id))?
            .into_iter()
            .map(|(v, _)| (v["plan"].as_str().unwrap_or_default().to_string(), v))
            .collect();
        let year = &date_of(today)[..4];
        let this_year: Vec<&RecordState> = works
            .iter()
            .filter(|w| s(w, "stare") == "facuta" && s(w, "data").starts_with(year))
            .collect();
        let mut v = Self::equipment_view(&e);
        v["planuri"] = json!(
            plans
                .iter()
                .map(|p| {
                    let mut x = Value::Object(p.fields.clone());
                    x["id"] = json!(p.id);
                    x["version"] = json!(p.version);
                    x["scadenta"] = due.get(&p.id.to_string()).cloned().unwrap_or(Value::Null);
                    x
                })
                .collect::<Vec<_>>()
        );
        v["interventii"] = json!(
            works
                .iter()
                .map(|w| {
                    let mut x = Value::Object(w.fields.clone());
                    x["id"] = json!(w.id);
                    x["version"] = json!(w.version);
                    x
                })
                .collect::<Vec<_>>()
        );
        v["citiri"] = json!(readings_view);
        v["cost_an"] = json!(this_year.iter().map(|w| i(w, "cost")).sum::<i64>());
        v["oprire_an"] = json!(this_year.iter().map(|w| i(w, "oprire_ore")).sum::<i64>());
        Ok(v)
    }

    fn costs(&self, ctx: &mut ModuleContext<'_>, a: Year) -> CoreResult<Value> {
        if !(1900..=2200).contains(&a.an) {
            return Err(bad("anul", "nu e un an"));
        }
        let year = format!("{:04}", a.an);
        let equipment = self.all(ctx, EQUIPMENT)?;
        let works: Vec<RecordState> = self
            .all(ctx, WORKS)?
            .into_iter()
            .filter(|w| s(w, "stare") == "facuta" && s(w, "data").starts_with(&year))
            .collect();
        let mut rows = Vec::new();
        let mut by_cat: BTreeMap<String, (i64, i64, usize)> = BTreeMap::new();
        for e in &equipment {
            let mine: Vec<&RecordState> = works
                .iter()
                .filter(|w| s(w, "echipament") == e.id.to_string())
                .collect();
            if mine.is_empty() {
                continue;
            }
            let cost: i64 = mine.iter().map(|w| i(w, "cost")).sum();
            let down: i64 = mine.iter().map(|w| i(w, "oprire_ore")).sum();
            let repairs = mine.iter().filter(|w| s(w, "fel") == "reparatie").count();
            let c = by_cat.entry(s(e, "categorie")).or_default();
            c.0 += cost;
            c.1 += down;
            c.2 += mine.len();
            rows.push(
                json!({"echipament": e.id, "nume": s(e, "nume"), "categorie": s(e, "categorie"), "cost": cost,
                             "oprire_ore": down, "interventii": mine.len(), "reparatii": repairs}),
            );
        }
        rows.sort_by_key(|r| std::cmp::Reverse(r["cost"].as_i64().unwrap_or_default()));
        Ok(json!({
            "an": a.an, "echipamente": rows,
            "categorii": by_cat.iter().map(|(k, (c, d, n))| json!({"categorie": k, "cost": c, "oprire_ore": d, "interventii": n})).collect::<Vec<_>>(),
            "total": works.iter().map(|w| i(w, "cost")).sum::<i64>(),
        }))
    }

    /// Counts only, no equipment names: overdue (daily), soon (weekly), warranties ending within 30 days (weekly).
    fn reminders(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        let Some(t) = day_number(today) else { return Ok(()) };
        let due = self.due_list(ctx, t, None)?;
        let overdue = due.iter().filter(|(_, st)| *st == Due::Depasit).count();
        let soon = due.iter().filter(|(_, st)| *st == Due::Curand).count();
        let monday = t - (t + 3).rem_euclid(7);
        let key = format!("dep:{}", date_of(t));
        if overdue > 0 && !ctx.notify_key_used(&key)? {
            let title = if overdue == 1 {
                "O mentenanță depășită".to_string()
            } else {
                format!("{overdue} mentenanțe depășite")
            };
            ctx.notify(
                &Notice::new(title, "Vezi „Scadențe” în Mentenanța echipamentelor.")
                    .level(Level::Atentie)
                    .key(key),
            )?;
        }
        let key = format!("sapt:{}", date_of(monday));
        if soon > 0 && !ctx.notify_key_used(&key)? {
            let title = if soon == 1 {
                "O mentenanță în curând".to_string()
            } else {
                format!("{soon} mentenanțe în curând")
            };
            ctx.notify(
                &Notice::new(title, "Vezi „Scadențe” în Mentenanța echipamentelor.")
                    .level(Level::Info)
                    .key(key),
            )?;
        }
        let warranties = self
            .all(ctx, EQUIPMENT)?
            .iter()
            .filter(|e| s(e, "stare") != "scos")
            .filter_map(|e| day_number(&s(e, "garantie_pana")))
            .filter(|d| (t..=t + 30).contains(d))
            .count();
        let key = format!("gar:{}", date_of(monday));
        if warranties > 0 && !ctx.notify_key_used(&key)? {
            let title = if warranties == 1 {
                "O garanție expiră în 30 de zile".to_string()
            } else {
                format!("{warranties} garanții expiră în 30 de zile")
            };
            ctx.notify(
                &Notice::new(title, "Vezi „Echipamente” în Mentenanța echipamentelor.")
                    .level(Level::Info)
                    .key(key),
            )?;
        }
        Ok(())
    }
}

impl Module for Maintenance {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn remind(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        self.reminders(ctx, today)
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
            "echipamente" => {
                let a: List = args(command, a)?;
                let q = fold(a.text.trim());
                let mut l: Vec<RecordState> = self
                    .all(ctx, EQUIPMENT)?
                    .into_iter()
                    .filter(|e| {
                        a.categorie
                            .as_ref()
                            .is_none_or(|c| c.is_empty() || *c == s(e, "categorie"))
                    })
                    .filter(|e| a.stare.as_ref().is_none_or(|c| c.is_empty() || *c == s(e, "stare")))
                    .filter(|e| {
                        q.is_empty()
                            || ["nume", "cod_inventar", "serie", "loc", "model"]
                                .iter()
                                .any(|k| fold(&s(e, k)).contains(&q))
                    })
                    .collect();
                l.sort_by_key(|e| fold(&s(e, "nume")));
                Ok(json!(l.iter().map(Self::equipment_view).collect::<Vec<_>>()))
            }
            "echipament" => self.one(ctx, args(command, a)?),
            "echipament_save" => self.equipment_save(ctx, args(command, a)?),
            "echipament_stare" => {
                let a: StateSet = args(command, a)?;
                if !EQUIPMENT_STATES.contains(&a.stare.as_str()) {
                    return Err(bad("starea", format!("„{}” nu există", a.stare)));
                }
                let old = self.live(ctx, EQUIPMENT, a.id, "echipamentul")?;
                let mut f = old.fields.clone();
                f.insert("stare".into(), json!(a.stare));
                ctx.write(vec![Write::put(EQUIPMENT, a.id, f).expect(a.version)])?;
                Ok(json!({"id": a.id, "stare": a.stare}))
            }
            "echipament_delete" => {
                let a: ByIdVersion = args(command, a)?;
                self.live(ctx, EQUIPMENT, a.id, "echipamentul")?;
                if !self.of(ctx, WORKS, a.id)?.is_empty() {
                    return Err(bad(
                        "echipamentul",
                        "are intervenții: nu se șterge, se marchează „scos din uz”",
                    ));
                }
                let mut w = vec![Write::delete(EQUIPMENT, a.id).expect(a.version)];
                for c in [PLANS, READINGS] {
                    for r in self.of(ctx, c, a.id)? {
                        w.push(Write::delete(c, r.id).expect(r.version));
                    }
                }
                ctx.write(w)?;
                Ok(json!({"deleted": a.id}))
            }
            "plan_save" => self.plan_save(ctx, args(command, a)?),
            "plan_delete" => {
                let a: ByIdVersion = args(command, a)?;
                self.live(ctx, PLANS, a.id, "planul")?;
                let key = json!(a.id.to_string());
                if !ctx
                    .scan(WORKS, |r| !r.deleted && r.fields.get("plan") == Some(&key))?
                    .is_empty()
                {
                    return Err(bad("planul", "are intervenții: nu se șterge, se oprește (inactiv)"));
                }
                ctx.write(vec![Write::delete(PLANS, a.id).expect(a.version)])?;
                Ok(json!({"deleted": a.id}))
            }
            "interventie_save" => self.work_save(ctx, args(command, a)?),
            "interventie_stare" => {
                let a: WorkState = args(command, a)?;
                if !WORK_STATES.contains(&a.stare.as_str()) {
                    return Err(bad("starea", format!("„{}” nu există", a.stare)));
                }
                let old = self.live(ctx, WORKS, a.id, "intervenția")?;
                if a.stare == "facuta" && day_number(&s(&old, "data")) > Some(date_arg("data de azi", &a.azi)?) {
                    return Err(bad("intervenția", "una făcută nu poate avea data în viitor"));
                }
                let mut f = old.fields.clone();
                f.insert("stare".into(), json!(a.stare));
                ctx.write(vec![Write::put(WORKS, a.id, f).expect(a.version)])?;
                Ok(json!({"id": a.id, "stare": a.stare}))
            }
            "citire_save" => {
                let a: ReadingSave = args(command, a)?;
                let e = self.live(ctx, EQUIPMENT, a.echipament, "echipamentul")?;
                if s(&e, "contor_unitate").is_empty() {
                    return Err(bad("citirea", format!("„{}” nu are contor", s(&e, "nume"))));
                }
                if a.valoare < 0 {
                    return Err(bad("citirea", "nu poate fi negativă"));
                }
                let day = date_arg("data", &a.data)?;
                if let Some(w) = self.reading_write(ctx, &e, day, a.valoare)? {
                    ctx.write(vec![w])?;
                }
                Ok(json!({"echipament": a.echipament, "valoare": a.valoare}))
            }
            "scadente" => {
                let a: Today = args(command, a)?;
                let t = date_arg("data de azi", &a.azi)?;
                Ok(json!(
                    self.due_list(ctx, t, None)?
                        .into_iter()
                        .map(|(v, _)| v)
                        .collect::<Vec<_>>()
                ))
            }
            "costuri" => self.costs(ctx, args(command, a)?),
            other => Err(CoreError::invalid("comanda", format!("„{other}” nu există în {ID}"))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn terms(la_zile: i64, la_contor: i64, start: i64, start_counter: i64) -> Terms {
        Terms {
            la_zile,
            la_contor,
            start,
            start_counter,
            warn_days: 14,
        }
    }

    #[test]
    fn due_by_days_by_counter_and_which_first() {
        let t = day_number("2030-06-01").unwrap();
        // Every 365 days from 2029-06-10: due 2030-06-10, 9 days away, warned 14 days before → soon.
        let d = plan_due(terms(365, 0, day_number("2029-06-10").unwrap(), 0), None, None, t);
        assert_eq!(
            (d.state, d.by, d.next_day.map(date_of)),
            (Due::Curand, "data", Some("2030-06-10".into()))
        );
        // Every 250 hours from 1000, read 1180: fine; read 1240 (within 10%): soon; 1250: overdue.
        assert_eq!(plan_due(terms(0, 250, t, 1000), None, Some(1180), t).state, Due::Ok);
        assert_eq!(plan_due(terms(0, 250, t, 1000), None, Some(1240), t).state, Due::Curand);
        assert_eq!(
            plan_due(terms(0, 250, t, 1000), None, Some(1250), t).state,
            Due::Depasit
        );
        // No reading: not „ok”.
        let d = plan_due(terms(0, 250, t, 0), None, None, t);
        assert_eq!((d.state, d.by), (Due::FaraCitire, "contor"));
        // Both: the counter comes first and says so; the date is still shown.
        let d = plan_due(
            terms(365, 250, day_number("2030-01-01").unwrap(), 0),
            None,
            Some(300),
            t,
        );
        assert_eq!((d.state, d.by), (Due::Depasit, "contor"));
        assert_eq!(d.next_day.map(date_of).as_deref(), Some("2031-01-01"));
        // The last done intervention moves the base (its counter too).
        let d = plan_due(terms(0, 250, t, 0), Some((t - 10, 300)), Some(320), t);
        assert_eq!((d.next_counter, d.state), (Some(550), Due::Ok));
    }
}
