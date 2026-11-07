//! `kgb.planner` — planner (Etapa 4, step 4.1; Master Plan §6.9): tasks,
//! projects, checklists and the team's people.
//!
//! Built only on the module contract (`storage.own`): three collections with
//! schemas the core checks on every write, indexed by status, assignee and
//! project. Until the network stage (Etapa 6) "people" are a local list in the
//! workspace, not user accounts (D-042): assigning is record-keeping. Its
//! interface lives in `app/src/modules/planner/`.
//!
//! Commands (JSON in, JSON out):
//! - people: `persons`, `person_save {id?, version?, nume, rol?, email?, activ?}`,
//!   `person_delete {id, version}` (refused while open tasks are assigned)
//! - projects: `projects`, `project_save {id?, version?, nume, descriere?, arhivat?}`,
//!   `project_delete {id, version}` (refused while it has tasks)
//! - tasks: `tasks {stare?, responsabil?, proiect?, text?, azi?, intarziate?, de_la?, pana_la?}`,
//!   `task_save {id?, version?, titlu, …}`, `task_status {id, version, stare}`,
//!   `task_delete {id, version}`
//! - `summary {azi}`: counts by status, overdue, by person

pub mod dates;
pub mod recur;
pub mod report;

use std::collections::BTreeMap;

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::notifications::{Level, Notice};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Cond, Fields, Query, RecordState, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.planner";
pub const PEOPLE: &str = "persoane";
pub const PROJECTS: &str = "proiecte";
pub const TASKS: &str = "taskuri";
pub const STATES: [&str; 4] = ["de_facut", "in_lucru", "blocat", "gata"];
pub const PRIORITIES: [&str; 4] = ["scazuta", "normala", "ridicata", "urgenta"];
const CHECKLIST_MAX: usize = 100;

pub struct Planner {
    manifest: Manifest,
}

impl Planner {
    pub fn new() -> Planner {
        Planner {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Planner {
    fn default() -> Self {
        Planner::new()
    }
}

fn args<T: DeserializeOwned>(command: &str, v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid(format!("argumentele comenzii {command}"), e.to_string()))
}

fn bad(what: &str, detail: impl Into<String>) -> CoreError {
    CoreError::invalid(what, detail)
}

/// A record as JSON: its fields plus `id` and `version`.
fn view(r: &RecordState) -> Value {
    let mut v = Value::Object(r.fields.clone());
    v["id"] = json!(r.id);
    v["version"] = json!(r.version);
    if let Some(rule) = r
        .fields
        .get("recurenta")
        .and_then(|x| serde_json::from_value::<recur::Rule>(x.clone()).ok())
    {
        v["repetare"] = json!(recur::describe(&rule));
    }
    v
}

fn text(v: Option<String>, what: &str, max: usize, required: bool) -> CoreResult<Value> {
    let t = v.map(|s| s.trim().to_string()).unwrap_or_default();
    if t.is_empty() {
        return if required {
            Err(bad(what, "nu poate fi gol"))
        } else {
            Ok(Value::Null)
        };
    }
    if t.chars().count() > max {
        return Err(bad(what, format!("are mai mult de {max} de caractere")));
    }
    Ok(json!(t))
}

fn live(ctx: &mut ModuleContext<'_>, coll: &str, id: Uuid, what: &str) -> CoreResult<RecordState> {
    match ctx.get(coll, id)? {
        Some(r) if !r.deleted => Ok(r),
        _ => Err(bad(what, "nu există (poate a fost șters)")),
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PersonSave {
    id: Option<Uuid>,
    version: Option<u64>,
    nume: String,
    rol: Option<String>,
    email: Option<String>,
    activ: Option<bool>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ProjectSave {
    id: Option<Uuid>,
    version: Option<u64>,
    nume: String,
    descriere: Option<String>,
    arhivat: Option<bool>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ById {
    id: Uuid,
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ReportArgs {
    azi: String,
    #[serde(default)]
    filtru: TaskFilter,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ExportReport {
    azi: String,
    #[serde(default)]
    filtru: TaskFilter,
    /// `xlsx` (three sheets) or `csv` (one table).
    format: String,
    /// For CSV: `persoane`, `proiecte` or `taskuri`.
    #[serde(default)]
    tabel: Option<String>,
    /// For CSV: `ro` (`;` and decimal comma) or `standard`.
    #[serde(default)]
    stil: Option<String>,
    /// Chosen by the user in the system save dialog.
    dest: std::path::PathBuf,
}

#[derive(Deserialize, Default)]
#[serde(deny_unknown_fields)]
struct TaskFilter {
    stare: Option<String>,
    /// A person id, or "" for tasks nobody is responsible for.
    responsabil: Option<String>,
    proiect: Option<String>,
    text: Option<String>,
    /// Today (YYYY-MM-DD), from the user's computer: tasks are overdue relative to it.
    azi: Option<String>,
    #[serde(default)]
    intarziate: bool,
    /// Only tasks due on or before this date.
    pana_la: Option<String>,
    /// Only tasks due on or after this date (with `pana_la`: a calendar range).
    de_la: Option<String>,
}

#[derive(Deserialize, Clone)]
#[serde(deny_unknown_fields)]
struct CheckItem {
    text: String,
    gata: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct TaskSave {
    id: Option<Uuid>,
    version: Option<u64>,
    titlu: String,
    descriere: Option<String>,
    responsabil: Option<String>,
    proiect: Option<String>,
    termen: Option<String>,
    prioritate: Option<String>,
    stare: Option<String>,
    checklist: Option<Vec<CheckItem>>,
    /// Repetition (D-046); `null` = does not repeat. Needs a due date.
    #[serde(default)]
    recurenta: Option<recur::Rule>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct TaskStatus {
    id: Uuid,
    version: u64,
    stare: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Summary {
    azi: String,
}

/// When a repeating task is done: the next occurrence (same title, person,
/// project, priority and rule; checklist unticked), unless one was already
/// created for this task or the series has ended.
fn next_occurrence(done: &Fields) -> Option<(Uuid, Fields)> {
    if done.get("urmator").is_some_and(|v| !v.is_null()) {
        return None;
    }
    let rule: recur::Rule = serde_json::from_value(done.get("recurenta")?.clone()).ok()?;
    let due = done.get("termen")?.as_str().and_then(dates::parse)?;
    let next = recur::next(&rule, due)?;
    let mut f = Fields::new();
    for k in [
        "titlu",
        "descriere",
        "responsabil",
        "proiect",
        "prioritate",
        "recurenta",
        "serie",
    ] {
        f.insert(k.into(), done.get(k).cloned().unwrap_or(Value::Null));
    }
    let unticked: Vec<Value> = done
        .get("checklist")
        .and_then(Value::as_array)
        .map(|c| c.iter().map(|i| json!({"text": i["text"], "gata": false})).collect())
        .unwrap_or_default();
    let now = now_ms();
    f.insert("checklist".into(), json!(unticked));
    f.insert("termen".into(), json!(next.iso()));
    f.insert("stare".into(), json!("de_facut"));
    f.insert("creat_ms".into(), json!(now));
    f.insert("actualizat_ms".into(), json!(now));
    f.insert("finalizat_ms".into(), Value::Null);
    f.insert("urmator".into(), Value::Null);
    Some((Uuid::now_v7(), f))
}

/// The notification for a next occurrence in this batch (the second write).
fn next_notice(batch: &[Write]) -> Option<Notice> {
    let Some(Write::Put { id, fields, .. }) = batch.get(1) else {
        return None;
    };
    let titlu = fields.get("titlu")?.as_str()?;
    let termen = fields.get("termen")?.as_str().and_then(dates::parse)?;
    Some(
        Notice::new(
            format!("Următorul: {titlu}"),
            format!("Taskul se repetă; următoarea dată este {}.", termen.ro()),
        )
        .key(format!("urmator:{id}")),
    )
}

/// Notifications are a convenience: the task is already saved, so a missing
/// permission (granted before the module asked for it) or an error only
/// skips the notification.
fn announce(ctx: &mut ModuleContext<'_>, n: Option<Notice>) {
    if let Some(n) = n
        && ctx.has("notify.send")
        && let Err(e) = ctx.notify(&n)
    {
        ctx.log(&format!("notificarea nu a fost trimisă: {e}"));
    }
}

fn one_of(v: &str, allowed: &[&str], what: &str) -> CoreResult<()> {
    if allowed.contains(&v) {
        Ok(())
    } else {
        Err(bad(what, format!("„{v}” nu este una dintre: {}", allowed.join(", "))))
    }
}

/// Sort key: due date first (no date last), then priority (urgent first), then title.
fn order(t: &Value) -> (String, usize, String) {
    let due = t["termen"].as_str().unwrap_or("9999-99-99").to_string();
    let p = PRIORITIES
        .iter()
        .position(|x| Some(*x) == t["prioritate"].as_str())
        .unwrap_or(1);
    (due, 3 - p, t["titlu"].as_str().unwrap_or("").to_lowercase())
}

fn overdue(t: &Value, today: Option<&str>) -> bool {
    match (t["termen"].as_str(), today) {
        (Some(d), Some(today)) => d < today && t["stare"] != "gata",
        _ => false,
    }
}

impl Planner {
    fn save_person(&self, ctx: &mut ModuleContext<'_>, a: PersonSave) -> CoreResult<Value> {
        let mut f = Fields::new();
        f.insert("nume".into(), text(Some(a.nume), "numele persoanei", 100, true)?);
        f.insert("rol".into(), text(a.rol, "rolul", 100, false)?);
        let email = text(a.email, "emailul", 200, false)?;
        if let Some(e) = email.as_str()
            && (!e.contains('@') || e.contains(' '))
        {
            return Err(bad("emailul", format!("„{e}” nu pare o adresă de email")));
        }
        f.insert("email".into(), email);
        f.insert("activ".into(), json!(a.activ.unwrap_or(true)));
        let (id, w) = match a.id {
            Some(id) => {
                let cur = live(ctx, PEOPLE, id, "persoana")?;
                f.insert("creat_ms".into(), cur.fields["creat_ms"].clone());
                (id, Write::put(PEOPLE, id, f).expect(a.version.unwrap_or(cur.version)))
            }
            None => {
                let id = Uuid::now_v7();
                f.insert("creat_ms".into(), json!(now_ms()));
                (id, Write::put(PEOPLE, id, f).expect(0))
            }
        };
        ctx.write(vec![w])?;
        Ok(view(&live(ctx, PEOPLE, id, "persoana")?))
    }

    fn save_project(&self, ctx: &mut ModuleContext<'_>, a: ProjectSave) -> CoreResult<Value> {
        let mut f = Fields::new();
        f.insert("nume".into(), text(Some(a.nume), "numele proiectului", 150, true)?);
        f.insert("descriere".into(), text(a.descriere, "descrierea", 2000, false)?);
        f.insert("arhivat".into(), json!(a.arhivat.unwrap_or(false)));
        let (id, w) = match a.id {
            Some(id) => {
                let cur = live(ctx, PROJECTS, id, "proiectul")?;
                f.insert("creat_ms".into(), cur.fields["creat_ms"].clone());
                (id, Write::put(PROJECTS, id, f).expect(a.version.unwrap_or(cur.version)))
            }
            None => {
                let id = Uuid::now_v7();
                f.insert("creat_ms".into(), json!(now_ms()));
                (id, Write::put(PROJECTS, id, f).expect(0))
            }
        };
        ctx.write(vec![w])?;
        Ok(view(&live(ctx, PROJECTS, id, "proiectul")?))
    }

    fn reference(&self, ctx: &mut ModuleContext<'_>, v: Option<String>, coll: &str, what: &str) -> CoreResult<Value> {
        match v.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
            None => Ok(Value::Null),
            Some(s) => {
                let id = Uuid::parse_str(&s).map_err(|_| bad(what, "identificator invalid"))?;
                let r = live(ctx, coll, id, what)?;
                if coll == PEOPLE && r.fields.get("activ") == Some(&json!(false)) {
                    return Err(bad(what, "persoana nu mai este activă"));
                }
                Ok(json!(id.to_string()))
            }
        }
    }

    fn save_task(&self, ctx: &mut ModuleContext<'_>, a: TaskSave) -> CoreResult<Value> {
        let mut f = Fields::new();
        f.insert("titlu".into(), text(Some(a.titlu), "titlul taskului", 200, true)?);
        f.insert("descriere".into(), text(a.descriere, "descrierea", 4000, false)?);
        f.insert(
            "responsabil".into(),
            self.reference(ctx, a.responsabil, PEOPLE, "responsabilul")?,
        );
        f.insert("proiect".into(), self.reference(ctx, a.proiect, PROJECTS, "proiectul")?);
        let termen = match a.termen.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
            None => Value::Null,
            Some(d) => json!(
                dates::parse(&d)
                    .ok_or_else(|| bad("termenul", format!("„{d}” nu este o dată (aaaa-ll-zz)")))?
                    .iso()
            ),
        };
        f.insert("termen".into(), termen);
        let p = a.prioritate.unwrap_or_else(|| "normala".into());
        one_of(&p, &PRIORITIES, "prioritatea")?;
        f.insert("prioritate".into(), json!(p));
        let stare = a.stare.unwrap_or_else(|| "de_facut".into());
        one_of(&stare, &STATES, "starea")?;
        let checklist = a.checklist.unwrap_or_default();
        if checklist.len() > CHECKLIST_MAX {
            return Err(bad("checklistul", format!("are mai mult de {CHECKLIST_MAX} de puncte")));
        }
        let mut items = Vec::new();
        for c in checklist {
            let t = c.text.trim();
            if t.is_empty() {
                continue;
            }
            if t.chars().count() > 300 {
                return Err(bad("checklistul", "un punct are mai mult de 300 de caractere"));
            }
            items.push(json!({"text": t, "gata": c.gata}));
        }
        f.insert("checklist".into(), json!(items));
        let rule = match a.recurenta {
            None => Value::Null,
            Some(mut r) => {
                r.check().map_err(|e| bad("repetarea", e))?;
                let due = f["termen"]
                    .as_str()
                    .and_then(dates::parse)
                    .ok_or_else(|| bad("repetarea", "un task care se repetă are nevoie de un termen"))?;
                if let Some(end) = r.pana_la.as_deref().filter(|s| !s.is_empty()) {
                    r.pana_la = Some(
                        dates::parse(end)
                            .ok_or_else(|| bad("repetarea", format!("„{end}” nu este o dată")))?
                            .iso(),
                    );
                } else {
                    r.pana_la = None;
                }
                // Keep the anchor only while it explains the due date (31 → 28
                // Feb); a due date moved by hand sets a new anchor.
                let keeps = r.zi.is_some_and(|z| z.min(dates::days_in_month(due.y, due.m)) == due.d);
                if !keeps {
                    r.zi = Some(due.d);
                }
                json!(r)
            }
        };
        f.insert("recurenta".into(), rule);
        let now = now_ms();
        f.insert("actualizat_ms".into(), json!(now));
        let mut extra = Vec::new();
        let (id, w) = match a.id {
            Some(id) => {
                let cur = live(ctx, TASKS, id, "taskul")?;
                f.insert("creat_ms".into(), cur.fields["creat_ms"].clone());
                for k in ["serie", "urmator"] {
                    f.insert(k.into(), cur.fields.get(k).cloned().unwrap_or(Value::Null));
                }
                if !f["recurenta"].is_null() && f["serie"].is_null() {
                    f.insert("serie".into(), json!(id.to_string()));
                }
                let was_done = cur.fields.get("stare") == Some(&json!("gata"));
                if stare == "gata"
                    && !was_done
                    && let Some((nid, nf)) = next_occurrence(&f)
                {
                    f.insert("urmator".into(), json!(nid.to_string()));
                    extra.push(Write::put(TASKS, nid, nf).expect(0));
                }
                f.insert(
                    "finalizat_ms".into(),
                    if stare == "gata" {
                        if was_done {
                            cur.fields["finalizat_ms"].clone()
                        } else {
                            json!(now)
                        }
                    } else {
                        Value::Null
                    },
                );
                f.insert("stare".into(), json!(stare));
                (id, Write::put(TASKS, id, f).expect(a.version.unwrap_or(cur.version)))
            }
            None => {
                let id = Uuid::now_v7();
                f.insert("creat_ms".into(), json!(now));
                f.insert(
                    "serie".into(),
                    if f["recurenta"].is_null() {
                        Value::Null
                    } else {
                        json!(id.to_string())
                    },
                );
                f.insert("urmator".into(), Value::Null);
                if stare == "gata"
                    && let Some((nid, nf)) = next_occurrence(&f)
                {
                    f.insert("urmator".into(), json!(nid.to_string()));
                    extra.push(Write::put(TASKS, nid, nf).expect(0));
                }
                f.insert(
                    "finalizat_ms".into(),
                    if stare == "gata" { json!(now) } else { Value::Null },
                );
                f.insert("stare".into(), json!(stare));
                (id, Write::put(TASKS, id, f).expect(0))
            }
        };
        // The task and its next occurrence (if any) in one atomic write.
        let mut batch = vec![w];
        batch.extend(extra);
        let next = next_notice(&batch);
        ctx.write(batch)?;
        announce(ctx, next);
        ctx.log("task salvat");
        Ok(view(&live(ctx, TASKS, id, "taskul")?))
    }

    fn tasks(&self, ctx: &mut ModuleContext<'_>, f: TaskFilter) -> CoreResult<Vec<Value>> {
        // Equality on an indexed field narrows the query; the rest is filtered here.
        let mut conds = Vec::new();
        if let Some(s) = &f.stare {
            one_of(s, &STATES, "starea")?;
            conds.push(Cond::Eq {
                field: "stare".into(),
                value: json!(s),
            });
        }
        if let Some(p) = f.proiect.as_ref().filter(|p| !p.is_empty()) {
            conds.push(Cond::Eq {
                field: "proiect".into(),
                value: json!(p),
            });
        }
        match f.responsabil.as_deref() {
            Some("") => conds.push(Cond::Eq {
                field: "responsabil".into(),
                value: Value::Null,
            }),
            Some(p) => conds.push(Cond::Eq {
                field: "responsabil".into(),
                value: json!(p),
            }),
            None => {}
        }
        let q = Query {
            filter: if conds.is_empty() {
                None
            } else {
                Some(Cond::And { all: conds })
            },
            ..Query::default()
        };
        let today = f
            .azi
            .as_deref()
            .map(|d| {
                dates::parse(d)
                    .map(|x| x.iso())
                    .ok_or_else(|| bad("data de azi", d.to_string()))
            })
            .transpose()?;
        let until = f
            .pana_la
            .as_deref()
            .map(|d| {
                dates::parse(d)
                    .map(|x| x.iso())
                    .ok_or_else(|| bad("data", d.to_string()))
            })
            .transpose()?;
        let from = f
            .de_la
            .as_deref()
            .map(|d| {
                dates::parse(d)
                    .map(|x| x.iso())
                    .ok_or_else(|| bad("data", d.to_string()))
            })
            .transpose()?;
        let needle = f
            .text
            .as_deref()
            .map(str::to_lowercase)
            .filter(|t| !t.trim().is_empty());
        let mut out: Vec<Value> = ctx
            .query(TASKS, &q)?
            .records
            .iter()
            .map(view)
            .filter(|t| {
                needle.as_ref().is_none_or(|n| {
                    t["titlu"].as_str().unwrap_or("").to_lowercase().contains(n)
                        || t["descriere"].as_str().unwrap_or("").to_lowercase().contains(n)
                })
            })
            .filter(|t| {
                until
                    .as_ref()
                    .is_none_or(|u| t["termen"].as_str().is_some_and(|d| d <= u.as_str()))
            })
            .filter(|t| {
                from.as_ref()
                    .is_none_or(|u| t["termen"].as_str().is_some_and(|d| d >= u.as_str()))
            })
            .map(|mut t| {
                t["intarziat"] = json!(overdue(&t, today.as_deref()));
                t
            })
            .filter(|t| !f.intarziate || t["intarziat"] == true)
            .collect();
        out.sort_by_key(order);
        Ok(out)
    }
}

/// At most this many reminders per kind in one round (the app calls again a
/// minute later), and overdue tasks only up to this many days back: older
/// ones are in the list's „Întârziate” count, not worth a burst of messages.
const REMIND_BATCH: usize = 10;
const OVERDUE_DAYS: i64 = 7;

impl Planner {
    fn report(&self, ctx: &mut ModuleContext<'_>, azi: String, mut filtru: TaskFilter) -> CoreResult<report::Report> {
        filtru.azi = Some(azi);
        let tasks = self.tasks(ctx, filtru)?;
        let mut names = BTreeMap::new();
        for coll in [PEOPLE, PROJECTS] {
            for r in ctx.scan(coll, |_| true)? {
                let n = r
                    .fields
                    .get("nume")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                names.insert(r.id.to_string(), n);
            }
        }
        Ok(report::build(tasks, names))
    }

    fn reminders(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        let now = dates::parse(today).ok_or_else(|| bad("ziua de azi", format!("„{today}” nu este o dată")))?;
        let (today, tomorrow, oldest) = (
            now.iso(),
            recur::add_days(now, 1).iso(),
            recur::add_days(now, -OVERDUE_DAYS).iso(),
        );
        let people: BTreeMap<String, String> = ctx
            .scan(PEOPLE, |_| true)?
            .into_iter()
            .map(|r| {
                (
                    r.id.to_string(),
                    r.fields
                        .get("nume")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                )
            })
            .collect();
        let mut open = ctx.scan(TASKS, |r| {
            r.fields.get("stare") != Some(&json!("gata")) && r.fields.get("termen").and_then(Value::as_str).is_some()
        })?;
        open.sort_by(|a, b| a.fields["termen"].as_str().cmp(&b.fields["termen"].as_str()));
        let mut sent: BTreeMap<&str, usize> = BTreeMap::new();
        for t in open {
            let termen = t.fields["termen"].as_str().unwrap_or_default().to_string();
            let (kind, level, head) = if termen == tomorrow {
                ("maine", Level::Info, "Mâine")
            } else if termen == today {
                ("azi", Level::Atentie, "Azi")
            } else if termen < today && termen >= oldest {
                ("intarziat", Level::Urgent, "Întârziat")
            } else {
                continue;
            };
            let count = sent.entry(kind).or_default();
            if *count >= REMIND_BATCH {
                continue;
            }
            let key = format!("{kind}:{}:{termen}", t.id);
            if ctx.notify_key_used(&key)? {
                continue;
            }
            let titlu = t.fields.get("titlu").and_then(Value::as_str).unwrap_or_default();
            let date = dates::parse(&termen).map(|d| d.ro()).unwrap_or(termen.clone());
            let who = t
                .fields
                .get("responsabil")
                .and_then(Value::as_str)
                .and_then(|id| people.get(id))
                .map(|n| format!(" · {n}"))
                .unwrap_or_default();
            let text = if kind == "intarziat" {
                format!("Termenul a fost {date}{who}.")
            } else {
                format!("Termen {date}{who}.")
            };
            ctx.notify(&Notice::new(format!("{head}: {titlu}"), text).level(level).key(key))?;
            *count += 1;
        }
        Ok(())
    }
}

impl Module for Planner {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn remind(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        self.reminders(ctx, today)
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "persons" => {
                let mut v: Vec<Value> = ctx.query(PEOPLE, &Query::default())?.records.iter().map(view).collect();
                v.sort_by_key(|p| (p["activ"] != true, p["nume"].as_str().unwrap_or("").to_lowercase()));
                Ok(json!(v))
            }
            "person_save" => self.save_person(ctx, args(command, a)?),
            "person_delete" => {
                let a: ById = args(command, a)?;
                live(ctx, PEOPLE, a.id, "persoana")?;
                let open = self
                    .tasks(
                        ctx,
                        TaskFilter {
                            responsabil: Some(a.id.to_string()),
                            ..TaskFilter::default()
                        },
                    )?
                    .into_iter()
                    .filter(|t| t["stare"] != "gata")
                    .count();
                if open > 0 {
                    return Err(bad(
                        "persoana",
                        format!("are {open} taskuri nefinalizate; reatribuie-le sau marcheaz-o „inactivă”"),
                    ));
                }
                ctx.write(vec![Write::delete(PEOPLE, a.id).expect(a.version)])?;
                Ok(json!({"deleted": a.id}))
            }
            "projects" => {
                let mut v: Vec<Value> = ctx
                    .query(PROJECTS, &Query::default())?
                    .records
                    .iter()
                    .map(view)
                    .collect();
                v.sort_by_key(|p| (p["arhivat"] == true, p["nume"].as_str().unwrap_or("").to_lowercase()));
                Ok(json!(v))
            }
            "project_save" => self.save_project(ctx, args(command, a)?),
            "project_delete" => {
                let a: ById = args(command, a)?;
                live(ctx, PROJECTS, a.id, "proiectul")?;
                let n = self
                    .tasks(
                        ctx,
                        TaskFilter {
                            proiect: Some(a.id.to_string()),
                            ..TaskFilter::default()
                        },
                    )?
                    .len();
                if n > 0 {
                    return Err(bad(
                        "proiectul",
                        format!("are {n} taskuri; mută-le sau arhivează proiectul"),
                    ));
                }
                ctx.write(vec![Write::delete(PROJECTS, a.id).expect(a.version)])?;
                Ok(json!({"deleted": a.id}))
            }
            "tasks" => Ok(json!(self.tasks(ctx, args(command, a)?)?)),
            "task_save" => self.save_task(ctx, args(command, a)?),
            "task_status" => {
                let a: TaskStatus = args(command, a)?;
                one_of(&a.stare, &STATES, "starea")?;
                let cur = live(ctx, TASKS, a.id, "taskul")?;
                let mut f = cur.fields.clone();
                let now = now_ms();
                let was_done = f.get("stare") == Some(&json!("gata"));
                f.insert("stare".into(), json!(a.stare));
                f.insert("actualizat_ms".into(), json!(now));
                if a.stare == "gata" && !was_done {
                    f.insert("finalizat_ms".into(), json!(now));
                } else if a.stare != "gata" {
                    f.insert("finalizat_ms".into(), Value::Null);
                }
                let mut batch = Vec::new();
                if a.stare == "gata"
                    && !was_done
                    && let Some((nid, nf)) = next_occurrence(&f)
                {
                    f.insert("urmator".into(), json!(nid.to_string()));
                    batch.push(Write::put(TASKS, nid, nf).expect(0));
                }
                batch.insert(0, Write::put(TASKS, a.id, f).expect(a.version));
                let next = next_notice(&batch);
                ctx.write(batch)?;
                announce(ctx, next);
                Ok(view(&live(ctx, TASKS, a.id, "taskul")?))
            }
            "task_delete" => {
                let a: ById = args(command, a)?;
                live(ctx, TASKS, a.id, "taskul")?;
                ctx.write(vec![Write::delete(TASKS, a.id).expect(a.version)])?;
                Ok(json!({"deleted": a.id}))
            }
            "report" => {
                let a: ReportArgs = args(command, a)?;
                Ok(self.report(ctx, a.azi, a.filtru)?.json())
            }
            "export_report" => {
                let a: ExportReport = args(command, a)?;
                let r = self.report(ctx, a.azi, a.filtru)?;
                let bytes = match a.format.as_str() {
                    "xlsx" => {
                        kgb_sheets::convert::to_xlsx(&r.book())
                            .map_err(|e| bad("exportul", e))?
                            .bytes
                    }
                    "csv" => {
                        let which = a.tabel.as_deref().unwrap_or("taskuri");
                        let sheet = r.csv_sheet(which).ok_or_else(|| {
                            bad(
                                "exportul",
                                format!("tabelul „{which}” nu există (persoane, proiecte, taskuri)"),
                            )
                        })?;
                        let style = match a.stil.as_deref().unwrap_or("ro") {
                            "ro" => kgb_sheets::convert::CsvStyle::Ro,
                            "standard" => kgb_sheets::convert::CsvStyle::Standard,
                            other => {
                                return Err(bad(
                                    "exportul",
                                    format!("stilul CSV „{other}” nu există (ro, standard)"),
                                ));
                            }
                        };
                        kgb_sheets::convert::to_csv(&sheet, style, true).map_err(|e| bad("exportul", e))?
                    }
                    other => return Err(bad("exportul", format!("formatul „{other}” nu există (xlsx, csv)"))),
                };
                // The user confirmed replacing an existing file in the save dialog.
                ctx.export_bytes(&a.dest, &bytes, true)?;
                ctx.log("raport exportat");
                Ok(json!({"taskuri": r.tasks.len(), "octeti": bytes.len()}))
            }
            "summary" => {
                let a: Summary = args(command, a)?;
                let all = self.tasks(
                    ctx,
                    TaskFilter {
                        azi: Some(a.azi),
                        ..TaskFilter::default()
                    },
                )?;
                let mut by_state: BTreeMap<&str, usize> = STATES.iter().map(|s| (*s, 0)).collect();
                let mut by_person: BTreeMap<String, (usize, usize)> = BTreeMap::new();
                for t in &all {
                    if let Some(s) = t["stare"].as_str().and_then(|s| STATES.iter().find(|x| **x == s)) {
                        *by_state.get_mut(s).expect("known") += 1;
                    }
                    if t["stare"] != "gata" {
                        let e = by_person
                            .entry(t["responsabil"].as_str().unwrap_or("").to_string())
                            .or_default();
                        e.0 += 1;
                        e.1 += usize::from(t["intarziat"] == true);
                    }
                }
                let overdue = all.iter().filter(|t| t["intarziat"] == true).count();
                Ok(json!({
                    "total": all.len(),
                    "pe_stare": by_state,
                    "intarziate": overdue,
                    "pe_persoana": by_person.into_iter().map(|(p, (open, late))| json!({"responsabil": p, "deschise": open, "intarziate": late})).collect::<Vec<_>>(),
                }))
            }
            other => Err(CoreError::invalid(
                "modulul Planificator",
                format!("comandă necunoscută „{other}”"),
            )),
        }
    }
}
