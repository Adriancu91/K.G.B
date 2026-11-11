//! The firm's permits (7.10b): the authorizations, approvals and licences the firm already has, each with its
//! number, the institution, the day it was issued and the day it stops being valid (or none), the procedure it
//! came from and the document of „Depozitul de documente” it is written on. The list says what is valid, what
//! expires within 30 days and what has expired; reminders come once within the last 30 days, once within the last
//! week, on the day and once in each of the four weeks after. Proposals from the vault are filled in by the page; nothing is written without
//! the person.

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use kgb_core::notifications::{Level, Notice};
use kgb_core::workspace::now_ms;
use kgb_store::{Fields, Write};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use super::{Permits, bad, date_or_empty, day_number, ro_date, text, view};

pub const HELD: &str = "autorizatii";
/// Within this many days of its end a permit is „expiră curând”.
pub const SOON_DAYS: i64 = 30;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct HeldIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    titlu: String,
    #[serde(default)]
    institutie: String,
    #[serde(default)]
    numar: String,
    #[serde(default)]
    emisa: Option<String>,
    #[serde(default)]
    valabila_pana: Option<String>,
    #[serde(default)]
    procedura: Option<Uuid>,
    /// The id of the vault's document it is written on (text: modules do not read each other's data).
    #[serde(default)]
    document: String,
    #[serde(default)]
    nota: String,
}

/// The state of a permit on `today`: (state, days left) — `fara_termen`, `valabila`, `expira`, `expirata`.
pub fn state(valid_until: Option<&str>, today: i64) -> (&'static str, Option<i64>) {
    match valid_until.and_then(day_number) {
        None => ("fara_termen", None),
        Some(d) if d < today => ("expirata", Some(d - today)),
        Some(d) if d - today <= SOON_DAYS => ("expira", Some(d - today)),
        Some(d) => ("valabila", Some(d - today)),
    }
}

impl Permits {
    pub(crate) fn held(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<Value> {
        let t = day_number(today).ok_or_else(|| bad("ziua de azi", format!("„{today}” nu este o dată")))?;
        let mut out: Vec<Value> = ctx
            .scan(HELD, |_| true)?
            .iter()
            .map(|r| {
                let until = r.fields.get("valabila_pana").and_then(Value::as_str);
                let (st, left) = state(until, t);
                let mut v = view(r);
                v["stare"] = json!(st);
                v["zile"] = json!(left);
                v
            })
            .collect();
        // Expired first, then what ends soonest; without an end last; by title within.
        let rank = |v: &Value| match v["stare"].as_str() {
            Some("expirata") => 0,
            Some("expira") => 1,
            Some("valabila") => 2,
            _ => 3,
        };
        out.sort_by(|a, b| {
            (
                rank(a),
                a["zile"].as_i64().unwrap_or(i64::MAX),
                a["titlu"].as_str().unwrap_or("").to_lowercase(),
            )
                .cmp(&(
                    rank(b),
                    b["zile"].as_i64().unwrap_or(i64::MAX),
                    b["titlu"].as_str().unwrap_or("").to_lowercase(),
                ))
        });
        Ok(json!(out))
    }

    pub(crate) fn held_save(&self, ctx: &mut ModuleContext<'_>, a: HeldIn) -> CoreResult<Value> {
        let titlu = text("titlul", &a.titlu, 200, true)?;
        let emisa = date_or_empty("data emiterii", &a.emisa)?;
        let until = date_or_empty("valabilă până la", &a.valabila_pana)?;
        if let (Some(e), Some(u)) = (&emisa, &until)
            && day_number(u) < day_number(e)
        {
            return Err(bad("valabilă până la", "e înainte de data emiterii"));
        }
        let document = a.document.trim().to_string();
        if !document.is_empty() && document.parse::<Uuid>().is_err() {
            return Err(bad("documentul", "nu e un document al depozitului"));
        }
        if let Some(p) = a.procedura {
            Self::live(ctx, super::PROCEDURES, p, "procedura")?;
        }
        let mut f = Fields::new();
        f.insert("titlu".into(), json!(titlu));
        f.insert(
            "institutie".into(),
            json!(text("instituția", &a.institutie, 300, false)?),
        );
        f.insert("numar".into(), json!(text("numărul", &a.numar, 80, false)?));
        f.insert("emisa".into(), emisa.map_or(Value::Null, Value::from));
        f.insert("valabila_pana".into(), until.map_or(Value::Null, Value::from));
        f.insert(
            "procedura".into(),
            a.procedura.map_or(Value::Null, |p| json!(p.to_string())),
        );
        f.insert(
            "document".into(),
            if document.is_empty() {
                Value::Null
            } else {
                json!(document)
            },
        );
        f.insert("nota".into(), json!(text("nota", &a.nota, 2000, false)?));
        let now = now_ms();
        let (id, w) = match a.id {
            Some(id) => {
                let cur = Self::live(ctx, HELD, id, "autorizația")?;
                f.insert(
                    "creat_ms".into(),
                    cur.fields.get("creat_ms").cloned().unwrap_or(json!(now)),
                );
                f.insert("actualizat_ms".into(), json!(now));
                (id, Write::put(HELD, id, f).expect(a.version))
            }
            None => {
                let id = Uuid::now_v7();
                f.insert("creat_ms".into(), json!(now));
                f.insert("actualizat_ms".into(), json!(now));
                (id, Write::put(HELD, id, f).expect(0))
            }
        };
        let v = ctx.write(vec![w])?[0];
        Ok(json!({"id": id, "version": v}))
    }

    pub(crate) fn held_delete(&self, ctx: &mut ModuleContext<'_>, id: Uuid, version: u64) -> CoreResult<Value> {
        Self::live(ctx, HELD, id, "autorizația")?;
        ctx.write(vec![Write::delete(HELD, id).expect(version)])?;
        Ok(Value::Null)
    }

    /// Within 30 days of the end, within the last week, on the day, then once in each of the four weeks after;
    /// each reminder once.
    pub(crate) fn held_reminders(&self, ctx: &mut ModuleContext<'_>, today: i64) -> CoreResult<()> {
        for r in ctx.scan(HELD, |_| true)? {
            let Some(until) = r.fields.get("valabila_pana").and_then(Value::as_str).map(String::from) else {
                continue;
            };
            let Some(d) = day_number(&until) else { continue };
            // By interval, so a day the app was not opened does not lose the reminder; each key once.
            let left = d - today;
            let (kind, level, head) = match left {
                8..=30 => ("30".to_string(), Level::Info, "Expiră în curând"),
                1..=7 => ("7".to_string(), Level::Atentie, "Expiră în mai puțin de o săptămână"),
                0 => ("azi".to_string(), Level::Urgent, "Expiră azi"),
                -28..=-1 => (format!("dupa{}", (-left - 1) / 7 + 1), Level::Urgent, "A expirat"),
                _ => continue,
            };
            let key = format!("aut:{kind}:{}:{until}", r.id);
            if ctx.notify_key_used(&key)? {
                continue;
            }
            let titlu = r.fields.get("titlu").and_then(Value::as_str).unwrap_or_default();
            ctx.notify(
                &Notice::new(
                    format!("{head}: „{titlu}”"),
                    format!("Valabilă până la {}.", ro_date(&until)),
                )
                .level(level)
                .key(key),
            )?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_state_of_a_permit() {
        let t = day_number("2026-11-11").unwrap();
        assert_eq!(state(None, t), ("fara_termen", None));
        assert_eq!(state(Some("2026-11-10"), t), ("expirata", Some(-1)));
        assert_eq!(state(Some("2026-11-11"), t), ("expira", Some(0)));
        assert_eq!(state(Some("2026-12-11"), t), ("expira", Some(30)));
        assert_eq!(state(Some("2026-12-12"), t), ("valabila", Some(31)));
    }
}
