//! Fleet and drivers (Etapa 7, step 7.4k-6; idea from the owner's ERP, code
//! written here).
//!
//! - **Vehicles**: registration number, make, model, year, usual driver.
//! - **Drivers**: name, phone, licence categories.
//! - Each one keeps its **documents that expire**: for a vehicle ITP, RCA,
//!   CASCO, rovinietă, service, transport licence, tachograph check…; for a
//!   driver the licence, professional certificate, tachograph card, medical
//!   and psychological checks. The type is free text (the list only suggests).
//! - Reminders like the partners' documents (D-066): 30 and 7 days before,
//!   on the day, then weekly for four weeks after it expired.
//!
//! Commands: `vehicles`, `vehicle_save`, `drivers`, `driver_save`,
//! `fleet_expiring {azi, zile?}`.

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use kgb_core::notifications::{Level, Notice};
use kgb_core::workspace::now_ms;
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::aging::days_between;
use crate::{Business, bad, date, live, s, text};

pub(crate) const VEHICLES: &str = "vehicule";
pub(crate) const DRIVERS: &str = "soferi";
pub const VEHICLE_DOCS: [&str; 9] = ["ITP", "RCA", "CASCO", "Rovinietă", "Revizie", "Licență de transport", "Verificare tahograf", "Extinctor", "Trusă medicală"];
pub const DRIVER_DOCS: [&str; 5] = ["Permis de conducere", "Atestat profesional", "Card tahograf", "Aviz medical", "Aviz psihologic"];
const MAX_DOCS: usize = 30;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct DocIn {
    tip: String,
    #[serde(default)]
    numar: Option<String>,
    #[serde(default)]
    emis: Option<String>,
    expira: String,
    #[serde(default)]
    nota: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct VehicleSave {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    numar: String,
    #[serde(default)]
    marca: Option<String>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    an: Option<i64>,
    #[serde(default)]
    sofer: Option<String>,
    #[serde(default = "yes")]
    activ: bool,
    #[serde(default)]
    acte: Vec<DocIn>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct DriverSave {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    nume: String,
    #[serde(default)]
    telefon: Option<String>,
    #[serde(default)]
    categorii: Option<String>,
    #[serde(default = "yes")]
    activ: bool,
    #[serde(default)]
    acte: Vec<DocIn>,
}

#[derive(Deserialize)]
pub(crate) struct Expiring {
    azi: String,
    #[serde(default)]
    zile: Option<i64>,
}

fn yes() -> bool {
    true
}

fn docs(list: Vec<DocIn>) -> CoreResult<Value> {
    if list.len() > MAX_DOCS {
        return Err(bad("actele", format!("cel mult {MAX_DOCS}")));
    }
    let mut out = Vec::new();
    for (n, d) in list.into_iter().enumerate() {
        let label = format!("actul {}", n + 1);
        let tip = text(Some(d.tip), &format!("{label}: tipul"), 60, true)?;
        let expira = date(&d.expira).ok_or_else(|| bad("actele", format!("{label}: „{}” nu este o dată de expirare", d.expira)))?;
        let emis = match d.emis.as_deref().map(str::trim).filter(|x| !x.is_empty()) {
            Some(e) => json!(date(e).ok_or_else(|| bad("actele", format!("{label}: „{e}” nu este o dată de emitere")))?),
            None => Value::Null,
        };
        if let Some(e) = emis.as_str()
            && e > expira.as_str()
        {
            return Err(bad("actele", format!("{label}: expiră înainte să fie emis")));
        }
        out.push(json!({
            "tip": tip,
            "numar": text(d.numar, &format!("{label}: numărul"), 60, false)?,
            "emis": emis,
            "expira": expira,
            "nota": text(d.nota, &format!("{label}: nota"), 300, false)?,
        }));
    }
    Ok(json!(out))
}

fn view(r: &RecordState) -> Value {
    let mut v = Value::Object(r.fields.clone());
    v["id"] = json!(r.id);
    v["version"] = json!(r.version);
    v
}

/// A document that expires soon (or has), on a vehicle or a driver.
fn expiring_in(ctx: &mut ModuleContext<'_>, today: &str, days: i64) -> CoreResult<Vec<Value>> {
    let mut out = Vec::new();
    for (coll, ce, name_key) in [(VEHICLES, "vehicul", "numar"), (DRIVERS, "sofer", "nume")] {
        for r in ctx.scan(coll, |r| r.fields.get("activ") != Some(&json!(false)))? {
            for d in r.fields.get("acte").and_then(Value::as_array).into_iter().flatten() {
                let exp = d["expira"].as_str().unwrap_or_default();
                let Some(left) = days_between(today, exp) else { continue };
                if left <= days {
                    out.push(json!({
                        "ce": ce, "id": r.id, "nume": s(&r, name_key), "tip": d["tip"], "numar": d["numar"],
                        "expira": exp, "zile": left,
                    }));
                }
            }
        }
    }
    out.sort_by_key(|x| (x["zile"].as_i64().unwrap_or(0), x["nume"].as_str().unwrap_or_default().to_string()));
    Ok(out)
}

impl Business {
    pub(crate) fn vehicle_save(&self, ctx: &mut ModuleContext<'_>, a: VehicleSave) -> CoreResult<Value> {
        let numar: String = a.numar.trim().to_uppercase().split_whitespace().collect::<Vec<_>>().join(" ");
        if numar.is_empty() || numar.chars().count() > 20 {
            return Err(bad("numărul de înmatriculare", "are 1–20 de caractere"));
        }
        let taken = ctx.scan(VEHICLES, |r| r.fields.get("numar") == Some(&json!(numar)))?.into_iter().any(|r| Some(r.id) != a.id);
        if taken {
            return Err(bad("vehiculul", format!("{numar} există deja")));
        }
        if let Some(y) = a.an
            && !(1950..=2100).contains(&y)
        {
            return Err(bad("anul", format!("{y} nu e un an de fabricație")));
        }
        let mut f = Fields::new();
        f.insert("numar".into(), json!(numar));
        f.insert("marca".into(), text(a.marca, "marca", 60, false)?);
        f.insert("model".into(), text(a.model, "modelul", 60, false)?);
        f.insert("an".into(), a.an.map_or(Value::Null, |y| json!(y)));
        f.insert("sofer".into(), text(a.sofer, "șoferul", 100, false)?);
        f.insert("activ".into(), json!(a.activ));
        f.insert("acte".into(), docs(a.acte)?);
        let (id, version) = match a.id {
            Some(id) => {
                let cur = live(ctx, VEHICLES, id, "vehiculul")?;
                f.insert("creat_ms".into(), cur.fields.get("creat_ms").cloned().unwrap_or(json!(now_ms())));
                (id, a.version)
            }
            None => {
                f.insert("creat_ms".into(), json!(now_ms()));
                (Uuid::now_v7(), 0)
            }
        };
        ctx.write(vec![Write::put(VEHICLES, id, f).expect(version)])?;
        ctx.log("parc auto: vehicul salvat");
        Ok(view(&live(ctx, VEHICLES, id, "vehiculul")?))
    }

    pub(crate) fn driver_save(&self, ctx: &mut ModuleContext<'_>, a: DriverSave) -> CoreResult<Value> {
        let mut f = Fields::new();
        f.insert("nume".into(), text(Some(a.nume), "numele șoferului", 100, true)?);
        f.insert("telefon".into(), text(a.telefon, "telefonul", 30, false)?);
        f.insert("categorii".into(), text(a.categorii, "categoriile permisului", 30, false)?);
        f.insert("activ".into(), json!(a.activ));
        f.insert("acte".into(), docs(a.acte)?);
        let (id, version) = match a.id {
            Some(id) => {
                let cur = live(ctx, DRIVERS, id, "șoferul")?;
                f.insert("creat_ms".into(), cur.fields.get("creat_ms").cloned().unwrap_or(json!(now_ms())));
                (id, a.version)
            }
            None => {
                f.insert("creat_ms".into(), json!(now_ms()));
                (Uuid::now_v7(), 0)
            }
        };
        ctx.write(vec![Write::put(DRIVERS, id, f).expect(version)])?;
        ctx.log("parc auto: șofer salvat");
        Ok(view(&live(ctx, DRIVERS, id, "șoferul")?))
    }

    pub(crate) fn vehicles(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let mut v: Vec<Value> = ctx.scan(VEHICLES, |_| true)?.iter().map(view).collect();
        v.sort_by_key(|x| (x["activ"] == json!(false), x["numar"].as_str().unwrap_or_default().to_string()));
        Ok(json!(v))
    }

    pub(crate) fn drivers(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let mut v: Vec<Value> = ctx.scan(DRIVERS, |_| true)?.iter().map(view).collect();
        v.sort_by_key(|x| (x["activ"] == json!(false), x["nume"].as_str().unwrap_or_default().to_lowercase()));
        Ok(json!(v))
    }

    pub(crate) fn fleet_expiring(&self, ctx: &mut ModuleContext<'_>, a: Expiring) -> CoreResult<Value> {
        let today = date(&a.azi).ok_or_else(|| bad("data de azi", a.azi.clone()))?;
        Ok(json!(expiring_in(ctx, &today, a.zile.unwrap_or(30).clamp(0, 366))?))
    }

    /// 30 and 7 days before, on the day, then weekly for four weeks.
    pub(crate) fn fleet_reminders(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        let mut sent = 0;
        for x in expiring_in(ctx, today, 30)? {
            let left = x["zile"].as_i64().unwrap_or(0);
            let level = match left {
                30 => Level::Info,
                7 => Level::Atentie,
                0 => Level::Urgent,
                n if (-28..0).contains(&n) && n % 7 == 0 => Level::Urgent,
                _ => continue,
            };
            let (tip, nume, exp) = (x["tip"].as_str().unwrap_or_default(), x["nume"].as_str().unwrap_or_default(), x["expira"].as_str().unwrap_or_default());
            let key = format!("parc:{}:{tip}:{exp}:{left}", x["id"].as_str().unwrap_or_default());
            if sent >= 20 || ctx.notify_key_used(&key)? {
                continue;
            }
            let title = match left {
                0 => format!("Expiră azi: {tip} — {nume}"),
                n if n < 0 => format!("Expirat: {tip} — {nume}"),
                n => format!("Expiră în {n} zile: {tip} — {nume}"),
            };
            let when = format!("{}.{}.{}", &exp[8..], &exp[5..7], &exp[..4]);
            let who = if x["ce"] == "vehicul" { "Vehiculul" } else { "Șoferul" };
            ctx.notify(&Notice::new(title, format!("{who} {nume}: {tip}, data {when}.")).level(level).key(key))?;
            sent += 1;
        }
        Ok(())
    }
}
