//! Work sites and the team leader's daily report (Etapa 7, step 7.4m-7,
//! asked by the owner).
//!
//! - A **work site** (punct de lucru) has a name, its team leader (the person
//!   whose phone sends the report), the hour work starts and its workers.
//! - At the end of the day the team leader sends, from the phone, who was
//!   present and the extra hours (+/− whole hours) of each one; at the office
//!   it is shown with colours and then recorded in the timesheet with one
//!   click: a present worker gets a day from the site's start hour, his
//!   daily norm plus the extra hours; an absent one gets nothing.
//! - A day already in the timesheet is left as it is (reported, not
//!   overwritten). Hours are declared by people (D-064).

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use kgb_core::workspace::now_ms;
use kgb_store::{Fields, Write};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{EMPLOYEES, TIMESHEET, Team, bad, clock, day_id, day_number, short, view};

pub const SITES: &str = "puncte";
pub const MAX_EXTRA: i64 = 12;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct SiteIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    nume: String,
    #[serde(default)]
    sef: String,
    #[serde(default = "eight")]
    inceput: String,
    #[serde(default)]
    angajati: Vec<Uuid>,
    #[serde(default = "yes")]
    activ: bool,
}

fn eight() -> String {
    "08:00".into()
}
fn yes() -> bool {
    true
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct ReportLine {
    angajat: Uuid,
    #[serde(default)]
    nume: String,
    prezent: bool,
    #[serde(default)]
    extra: i64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Report {
    punct: Uuid,
    data: String,
    linii: Vec<ReportLine>,
    /// Who sent it (shown in the timesheet note).
    #[serde(default)]
    de_la: String,
}

impl Team {
    pub(crate) fn save_site(&self, ctx: &mut ModuleContext<'_>, a: SiteIn) -> CoreResult<Value> {
        let nume = short("numele punctului de lucru", &a.nume, 100, true)?;
        if clock(a.inceput.trim()).is_none() {
            return Err(bad("ora de început", format!("„{}” nu e HH:MM", a.inceput)));
        }
        let taken = ctx
            .scan(SITES, |r| r.fields.get("nume").and_then(Value::as_str).is_some_and(|n| n.to_lowercase() == nume.to_lowercase()))?
            .into_iter()
            .any(|r| Some(r.id) != a.id);
        if taken {
            return Err(bad("punctul de lucru", format!("„{nume}” există deja")));
        }
        let mut workers = Vec::new();
        for id in a.angajati {
            if ctx.get(EMPLOYEES, id)?.is_none() {
                return Err(bad("muncitorii", "unul dintre angajați nu există"));
            }
            if !workers.contains(&json!(id.to_string())) {
                workers.push(json!(id.to_string()));
            }
        }
        let mut f = Fields::new();
        f.insert("nume".into(), json!(nume));
        f.insert("sef".into(), json!(short("șeful de echipă", &a.sef, 100, false)?));
        f.insert("inceput".into(), json!(a.inceput.trim()));
        f.insert("angajati".into(), json!(workers));
        f.insert("activ".into(), json!(a.activ));
        let (id, version) = match a.id {
            Some(id) => {
                let cur = ctx.get(SITES, id)?.ok_or_else(|| bad("punctul de lucru", "nu există"))?;
                f.insert("creat_ms".into(), cur.fields.get("creat_ms").cloned().unwrap_or(json!(now_ms())));
                (id, a.version)
            }
            None => {
                f.insert("creat_ms".into(), json!(now_ms()));
                (Uuid::new_v4(), 0)
            }
        };
        ctx.write(vec![Write::put(SITES, id, f).expect(version)])?;
        Ok(json!({"id": id}))
    }

    /// The sites, each with its workers (name and daily norm).
    pub(crate) fn sites(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let mut out = Vec::new();
        for r in ctx.scan(SITES, |_| true)? {
            let mut v = view(&r);
            let mut workers = Vec::new();
            for id in r.fields.get("angajati").and_then(Value::as_array).into_iter().flatten() {
                let Some(e) = id.as_str().and_then(|x| x.parse().ok()) else { continue };
                if let Some(e) = ctx.get(EMPLOYEES, e)?
                    && e.fields.get("activ") != Some(&json!(false))
                {
                    workers.push(json!({"id": e.id, "nume": e.fields.get("nume"), "norma_min": e.fields.get("norma_min")}));
                }
            }
            v["muncitori"] = json!(workers);
            out.push(v);
        }
        out.sort_by_key(|v| v["nume"].as_str().unwrap_or_default().to_lowercase());
        Ok(json!(out))
    }

    /// Records a team leader's daily report in the timesheet.
    pub(crate) fn record_report(&self, ctx: &mut ModuleContext<'_>, a: Report) -> CoreResult<Value> {
        let site = ctx.get(SITES, a.punct)?.ok_or_else(|| bad("punctul de lucru", "nu există"))?;
        if day_number(&a.data).is_none() {
            return Err(bad("data", format!("„{}” nu e o dată AAAA-LL-ZZ", a.data)));
        }
        if a.linii.is_empty() || a.linii.len() > 200 {
            return Err(bad("raportul", "are 1–200 de muncitori"));
        }
        let start = site.fields.get("inceput").and_then(Value::as_str).and_then(clock).unwrap_or(8 * 60);
        let site_name = site.fields.get("nume").and_then(Value::as_str).unwrap_or_default().to_string();
        let mut writes = Vec::new();
        let (mut present, mut absent, mut skipped) = (0, 0, Vec::new());
        for l in &a.linii {
            if !(-MAX_EXTRA..=MAX_EXTRA).contains(&l.extra) {
                return Err(bad("orele extra", format!("între −{MAX_EXTRA} și +{MAX_EXTRA}")));
            }
            let e = ctx.get(EMPLOYEES, l.angajat)?.ok_or_else(|| bad("raportul", format!("„{}” nu mai e printre angajați", l.nume)))?;
            let name = e.fields.get("nume").and_then(Value::as_str).unwrap_or_default().to_string();
            if !l.prezent {
                absent += 1;
                continue;
            }
            let norm = e.fields.get("norma_min").and_then(Value::as_i64).unwrap_or(480);
            let minutes = norm + l.extra * 60;
            if minutes <= 0 || minutes >= 24 * 60 {
                return Err(bad("raportul", format!("{name}: {} de ore nu se pot ponta într-o zi", minutes / 60)));
            }
            let id = day_id(l.angajat, &a.data);
            if ctx.get(TIMESHEET, id)?.is_some() {
                skipped.push(name);
                continue;
            }
            if self.leave_on(ctx, l.angajat, &a.data)?.is_some() {
                skipped.push(format!("{name} (în concediu)"));
                continue;
            }
            let end = (start + minutes) % (24 * 60);
            let hhmm = |m: i64| format!("{:02}:{:02}", m / 60, m % 60);
            let extra = match l.extra {
                0 => String::new(),
                x if x > 0 => format!(", +{x} ore extra"),
                x => format!(", {x} ore"),
            };
            let who = if a.de_la.trim().is_empty() { String::new() } else { format!(" de {}", a.de_la.trim()) };
            let mut f = Fields::new();
            f.insert("angajat".into(), json!(l.angajat.to_string()));
            f.insert("data".into(), json!(a.data));
            f.insert("intrare".into(), json!(hhmm(start)));
            f.insert("iesire".into(), json!(hhmm(end)));
            f.insert("pauza_min".into(), json!(0));
            f.insert("lucrat_min".into(), json!(minutes));
            f.insert("nota".into(), json!(format!("raport de prezență{who} ({site_name}){extra}").chars().take(500).collect::<String>()));
            f.insert("actualizat_ms".into(), json!(now_ms()));
            writes.push(Write::put(TIMESHEET, id, f).expect(0));
            present += 1;
        }
        if !writes.is_empty() {
            ctx.write(writes)?;
        }
        Ok(json!({"pontati": present, "absenti": absent, "deja_pontati": skipped}))
    }
}
