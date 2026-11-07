//! Step 4.5: task reminders — the day before, on the day, and once when
//! overdue (up to a week back); never twice, also after reopening the
//! workspace or clearing the notifications; done tasks are quiet.

use kgb_core::modules::ModuleManager;
use kgb_core::notifications::{self, Level};
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_planner::{ID, Planner};
use serde_json::{Value, json};

fn manager() -> ModuleManager {
    ModuleManager::new(vec![Box::new(Planner::new())], CORE_VERSION).unwrap()
}

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn titles(new: &[notifications::NotificationView]) -> Vec<String> {
    new.iter().map(|n| n.titlu.clone()).collect()
}

#[test]
fn reminders_on_the_right_day_and_never_twice() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    let mut ws = Workspace::create(&dir, "T").unwrap();
    let mm = manager();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into()])
        .unwrap();
    let ana = call(&mut ws, &mm, "person_save", json!({"nume": "Ana"})).unwrap();
    for (t, d) in [
        ("Raport", "2026-11-10"),
        ("Inventar", "2026-11-11"),
        ("Vechi", "2026-10-01"),
    ] {
        call(
            &mut ws,
            &mm,
            "task_save",
            json!({"titlu": t, "termen": d, "responsabil": ana["id"]}),
        )
        .unwrap();
    }
    let done = call(
        &mut ws,
        &mm,
        "task_save",
        json!({"titlu": "Făcut", "termen": "2026-11-10"}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "task_status",
        json!({"id": done["id"], "version": done["version"], "stare": "gata"}),
    )
    .unwrap();

    // Two days before: nothing yet.
    assert!(mm.remind_all(&mut ws, "2026-11-08").unwrap().is_empty());
    // The day before.
    let n = mm.remind_all(&mut ws, "2026-11-09").unwrap();
    assert_eq!(titles(&n), ["Mâine: Raport"]);
    assert_eq!(n[0].text, "Termen 10.11.2026 · Ana.");
    assert_eq!(n[0].nivel, Level::Info);
    // Same day again (the app ticks every minute): nothing new.
    assert!(mm.remind_all(&mut ws, "2026-11-09").unwrap().is_empty());
    // On the day, plus tomorrow's.
    let n = mm.remind_all(&mut ws, "2026-11-10").unwrap();
    assert_eq!(titles(&n), ["Azi: Raport", "Mâine: Inventar"]);
    assert_eq!(n[0].nivel, Level::Atentie);

    // Reopen the workspace and clear everything: still no repeats.
    drop(ws);
    let mut ws = Workspace::open(&dir).unwrap();
    notifications::mark_all_read(&mut ws).unwrap();
    notifications::clear_read(&mut ws).unwrap();
    assert!(mm.remind_all(&mut ws, "2026-11-10").unwrap().is_empty());

    // Overdue, once; „Vechi” (more than a week late) stays quiet.
    let n = mm.remind_all(&mut ws, "2026-11-12").unwrap();
    assert_eq!(titles(&n), ["Întârziat: Raport", "Întârziat: Inventar"]);
    assert_eq!(n[0].text, "Termenul a fost 10.11.2026 · Ana.");
    assert_eq!(n[0].nivel, Level::Urgent);
    assert!(mm.remind_all(&mut ws, "2026-11-13").unwrap().is_empty());

    // A due date moved by hand: reminded again for the new date.
    let t = call(&mut ws, &mm, "tasks", json!({"text": "Raport"})).unwrap()[0].clone();
    call(
        &mut ws,
        &mm,
        "task_save",
        json!({"id": t["id"], "version": t["version"], "titlu": "Raport", "termen": "2026-11-14"}),
    )
    .unwrap();
    assert_eq!(titles(&mm.remind_all(&mut ws, "2026-11-14").unwrap()), ["Azi: Raport"]);
}

#[test]
fn many_due_at_once_come_in_batches_and_bad_day_is_refused() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = manager();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into()])
        .unwrap();
    for i in 0..13 {
        call(
            &mut ws,
            &mm,
            "task_save",
            json!({"titlu": format!("T{i}"), "termen": "2026-11-10"}),
        )
        .unwrap();
    }
    assert_eq!(mm.remind_all(&mut ws, "2026-11-10").unwrap().len(), 10);
    assert_eq!(mm.remind_all(&mut ws, "2026-11-10").unwrap().len(), 3);
    assert!(mm.remind_all(&mut ws, "2026-11-10").unwrap().is_empty());
    // A bad date from the app is skipped (logged), it does not fail the round.
    assert!(mm.remind_all(&mut ws, "mâine").unwrap().is_empty());
}

#[test]
fn no_reminders_without_permission_or_when_disabled() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = manager();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into()])
        .unwrap();
    call(&mut ws, &mm, "task_save", json!({"titlu": "X", "termen": "2026-11-10"})).unwrap();
    mm.disable(&mut ws, ID).unwrap();
    assert!(mm.remind_all(&mut ws, "2026-11-10").unwrap().is_empty());
    let log = kgb_core::modules::audit_log(&ws, 50).unwrap();
    assert!(
        !log.iter().any(|e| e.get("outcome") == Some(&json!("refuzat"))),
        "no refusal noise"
    );
}
