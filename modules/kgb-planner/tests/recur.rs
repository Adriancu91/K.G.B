//! Step 4.3: repeating tasks — completing one creates the next occurrence
//! (checklist unticked), once; the series ends at „până la”; bad rules refused.

use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_planner::{ID, Planner};
use serde_json::{Value, json};

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Planner::new())], CORE_VERSION).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &["storage.own".into(), "notify.send".into(), "files.own".into()],
    )
    .unwrap();
    (tmp, ws, mm)
}

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn all(ws: &mut Workspace, mm: &ModuleManager) -> Vec<Value> {
    call(ws, mm, "tasks", json!({})).unwrap().as_array().unwrap().clone()
}

fn status(ws: &mut Workspace, mm: &ModuleManager, t: &Value, stare: &str) -> Value {
    call(
        ws,
        mm,
        "task_status",
        json!({"id": t["id"], "version": t["version"], "stare": stare}),
    )
    .unwrap()
}

#[test]
fn completing_creates_the_next_occurrence_once() {
    let (_t, mut ws, mm) = setup();
    let t = call(
        &mut ws,
        &mm,
        "task_save",
        json!({"titlu": "Plata chiriei", "termen": "2027-01-31", "prioritate": "ridicata",
               "checklist": [{"text": "virament", "gata": true}, {"text": "factura", "gata": false}],
               "recurenta": {"frecventa": "lunar"}}),
    )
    .unwrap();
    assert_eq!(t["recurenta"]["zi"], 31, "anchor day stored from the due date");
    assert_eq!(t["serie"], t["id"]);
    assert_eq!(t["repetare"], "lunar");

    let done = status(&mut ws, &mm, &t, "gata");
    let tasks = all(&mut ws, &mm);
    assert_eq!(tasks.len(), 2);
    let next = tasks.iter().find(|x| x["id"] != t["id"]).unwrap().clone();
    assert_eq!(done["urmator"], next["id"]);
    assert_eq!(next["termen"], "2027-02-28");
    assert_eq!(next["stare"], "de_facut");
    assert_eq!(next["prioritate"], "ridicata");
    assert_eq!(next["serie"], t["id"]);
    assert_eq!(next["finalizat_ms"], Value::Null);
    assert!(next["checklist"].as_array().unwrap().iter().all(|c| c["gata"] == false));
    assert_eq!(next["checklist"][1]["text"], "factura");

    // Reopen and complete again: no duplicate.
    let re = status(&mut ws, &mm, &done, "in_lucru");
    status(&mut ws, &mm, &re, "gata");
    assert_eq!(all(&mut ws, &mm).len(), 2);

    // The next one, completed through the form, goes back to the 31st.
    let n2 = call(
        &mut ws,
        &mm,
        "task_save",
        json!({"id": next["id"], "version": next["version"], "titlu": "Plata chiriei", "termen": "2027-02-28",
               "stare": "gata", "recurenta": next["recurenta"]}),
    )
    .unwrap();
    let third: Vec<Value> = all(&mut ws, &mm)
        .into_iter()
        .filter(|x| x["id"] == n2["urmator"])
        .collect();
    assert_eq!(third[0]["termen"], "2027-03-31");
    assert_eq!(third[0]["serie"], t["id"]);

    // Moving the due date by hand sets a new anchor day.
    let moved = call(
        &mut ws,
        &mm,
        "task_save",
        json!({"id": third[0]["id"], "version": third[0]["version"], "titlu": "Plata chiriei",
               "termen": "2027-03-15", "recurenta": third[0]["recurenta"]}),
    )
    .unwrap();
    assert_eq!(moved["recurenta"]["zi"], 15);
}

#[test]
fn until_ends_series_and_bad_rules_are_refused() {
    let (_t, mut ws, mm) = setup();
    let t = call(
        &mut ws,
        &mm,
        "task_save",
        json!({"titlu": "Inventar", "termen": "2026-12-01",
               "recurenta": {"frecventa": "saptamanal", "interval": 2, "pana_la": "2026-12-10"}}),
    )
    .unwrap();
    status(&mut ws, &mm, &t, "gata");
    assert_eq!(all(&mut ws, &mm).len(), 1, "15 Dec is after 10 Dec: series ended");

    for (rule, termen) in [
        (json!({"frecventa": "lunar"}), Value::Null),
        (json!({"frecventa": "zilnic", "interval": 0}), json!("2026-12-01")),
        (json!({"frecventa": "lunar", "zile": [1]}), json!("2026-12-01")),
        (json!({"frecventa": "orar"}), json!("2026-12-01")),
        (json!({"frecventa": "lunar", "pana_la": "mâine"}), json!("2026-12-01")),
    ] {
        assert!(
            call(
                &mut ws,
                &mm,
                "task_save",
                json!({"titlu": "x", "termen": termen, "recurenta": rule})
            )
            .is_err(),
            "{rule}"
        );
    }
    // A task without a rule completes normally, nothing new appears.
    let p = call(
        &mut ws,
        &mm,
        "task_save",
        json!({"titlu": "simplu", "termen": "2026-12-01"}),
    )
    .unwrap();
    assert_eq!(p["serie"], Value::Null);
    status(&mut ws, &mm, &p, "gata");
    assert_eq!(all(&mut ws, &mm).len(), 2);
}

#[test]
fn next_occurrence_is_announced_once() {
    let (_t, mut ws, mm) = setup();
    let t = call(
        &mut ws,
        &mm,
        "task_save",
        json!({"titlu": "Inventar", "termen": "2026-12-01", "recurenta": {"frecventa": "lunar"}}),
    )
    .unwrap();
    let done = status(&mut ws, &mm, &t, "gata");
    let re = status(&mut ws, &mm, &done, "in_lucru");
    status(&mut ws, &mm, &re, "gata");
    let list = kgb_core::notifications::list(&ws, false, 10).unwrap();
    assert_eq!(list.len(), 1, "{list:?}");
    assert_eq!(list[0].module, ID);
    assert_eq!(list[0].titlu, "Următorul: Inventar");
    assert!(list[0].text.contains("01.01.2027"), "{}", list[0].text);
}

#[test]
fn without_notify_permission_the_task_still_repeats() {
    let (_t, mut ws, mm) = setup();
    // As on a computer where the module was enabled before it asked for
    // notify.send: the stored grant has only storage.own.
    let rec = ws
        .store()
        .scan(kgb_core::modules::MODULES_COLLECTION, |r| {
            r.fields.get("module_id") == Some(&json!(ID))
        })
        .unwrap()
        .remove(0);
    let mut f = rec.fields.clone();
    f.insert("granted".into(), json!(["storage.own"]));
    ws.store_mut()
        .write(vec![
            kgb_store::Write::put(kgb_core::modules::MODULES_COLLECTION, rec.id, f).expect(rec.version),
        ])
        .unwrap();
    let t = call(
        &mut ws,
        &mm,
        "task_save",
        json!({"titlu": "Inventar", "termen": "2026-12-01", "recurenta": {"frecventa": "lunar"}}),
    )
    .unwrap();
    status(&mut ws, &mm, &t, "gata");
    assert_eq!(all(&mut ws, &mm).len(), 2, "the next occurrence is still created");
    assert!(kgb_core::notifications::list(&ws, false, 10).unwrap().is_empty());
    let refused = kgb_core::modules::audit_log(&ws, 50)
        .unwrap()
        .iter()
        .any(|e| e.get("outcome") == Some(&json!("refuzat")));
    assert!(!refused, "no refusal noise: the module checks first");
}
