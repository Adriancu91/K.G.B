//! 7.4l-2b-rem: the reminders of the Notes window reach the app's notifications at their moment, once;
//! not before, not long after, not from the trash, and a repeating one again at its next moment.

use kgb_core::CORE_VERSION;
use kgb_core::modules::{Module, ModuleManager};
use kgb_core::notifications::{self, Level};
use kgb_core::workspace::{Workspace, now_ms};
use kgb_notes::remind::to_iso;
use kgb_notes::{ID, Notes};
use serde_json::json;

const MIN: i64 = 60_000;
const DAY: i64 = 86_400_000;

#[test]
fn a_reminder_is_announced_at_its_moment_and_only_once() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Notes::new()) as Box<dyn Module>], CORE_VERSION).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &[
            "storage.own".to_string(),
            "files.own".to_string(),
            "notify.send".to_string(),
        ],
    )
    .unwrap();
    let now = now_ms() as i64;
    let note = |id: &str, title: &str, remind: i64| {
        json!({"id": id, "title": title, "body": format!("textul notiței {title}"), "created": "2026-11-01T10:00:00.000Z",
               "updated": "2026-11-01T10:00:00.000Z", "remind": to_iso(remind)})
    };
    let mut daily = note("zilnic", "", now - 3 * DAY - 2 * MIN);
    daily["repeat"] = json!("zilnic");
    daily["body"] = json!("Pastila de seară\nși apă");
    let mut gone = note("cos", "Din coș", now - MIN);
    gone["deleted"] = json!("2026-11-09T10:00:00.000Z");
    let book = json!({
        "format": "suite-notes", "version": 1,
        "notes": [note("acum", "Sună la bancă", now - MIN), note("vechi", "Ieri", now - DAY), note("viitor", "Mâine", now + DAY), daily],
        "trash": [gone]
    });
    mm.call(&mut ws, None, ID, "notebook_save", json!({"content": book.to_string()}))
        .unwrap();

    let new = mm.remind_all(&mut ws, "2026-11-10").unwrap();
    let mut titles: Vec<&str> = new.iter().map(|n| n.titlu.as_str()).collect();
    titles.sort();
    assert_eq!(titles, vec!["Memento: Pastila de seară", "Memento: Sună la bancă"]);
    let bank = new.iter().find(|n| n.titlu.contains("bancă")).unwrap();
    assert_eq!(bank.text, "textul notiței Sună la bancă");
    assert_eq!(bank.nivel, Level::Atentie);
    assert_eq!(bank.module, ID);

    // The next round (and after reopening the workspace) announces nothing again.
    assert!(mm.remind_all(&mut ws, "2026-11-10").unwrap().is_empty());
    drop(ws);
    let mut ws = Workspace::open(&tmp.path().join("ws")).unwrap();
    assert!(mm.remind_all(&mut ws, "2026-11-10").unwrap().is_empty());
    assert_eq!(notifications::list(&ws, false, usize::MAX).unwrap().len(), 2);
}
