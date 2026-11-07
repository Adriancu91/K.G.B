//! Step 4.4 (D-043): a module sends a notification, the user sees it and
//! marks it read; without `notify.send` the send is refused and audited; the
//! same key does not create duplicates (also after reopening); the list stays
//! bounded without dropping unread ones.

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext, ModuleManager, audit_log};
use kgb_core::notifications::{self, Level, MAX_KEPT, Notice};
use kgb_core::workspace::Workspace;
use kgb_core::{CoreError, CoreResult};
use serde_json::{Value, json};

struct Sender(Manifest);

impl Module for Sender {
    fn manifest(&self) -> &Manifest {
        &self.0
    }
    fn handle(&self, ctx: &mut ModuleContext<'_>, cmd: &str, a: Value) -> CoreResult<Value> {
        match cmd {
            "send" => {
                let n: Notice = serde_json::from_value(a).map_err(|e| CoreError::invalid("args", e.to_string()))?;
                let (id, new) = ctx.notify(&n)?;
                Ok(json!({"id": id, "new": new}))
            }
            _ => Ok(Value::Null),
        }
    }
}

fn manager(id: &str, perms: &[&str]) -> ModuleManager {
    let services: Vec<&str> = if perms.is_empty() { vec![] } else { vec!["notify"] };
    let v = json!({
        "manifest_format": 1, "id": id, "name": "S", "description": "d", "version": "0.1.0",
        "core": ">=0.1.0, <0.2.0", "status": "beta", "data_format": 1, "on_disable": "nimic",
        "permissions": perms, "services": services
    });
    ModuleManager::new(
        vec![Box::new(Sender(Manifest::parse(&v.to_string()).unwrap()))],
        "0.1.0",
    )
    .unwrap()
}

#[test]
fn send_see_mark_read_and_no_duplicates() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    let mut ws = Workspace::create(&dir, "T").unwrap();
    let mm = manager("t.sender", &["notify.send"]);
    mm.enable(&mut ws, "t.sender", &["notify.send".into()]).unwrap();

    let a = mm
        .call(
            &mut ws,
            None,
            "t.sender",
            "send",
            json!({"titlu": "Factură scadentă", "text": "F-12, 1.200 lei", "nivel": "urgent", "cheie": "f12"}),
        )
        .unwrap();
    assert_eq!(a["new"], true);
    mm.call(&mut ws, None, "t.sender", "send", json!({"titlu": "Al doilea"}))
        .unwrap();
    // The same key again: the existing one, not a new one.
    let again = mm
        .call(
            &mut ws,
            None,
            "t.sender",
            "send",
            json!({"titlu": "Factură scadentă (iar)", "cheie": "f12"}),
        )
        .unwrap();
    assert_eq!(again["new"], false);
    assert_eq!(again["id"], a["id"]);

    let list = notifications::list(&ws, false, 50).unwrap();
    assert_eq!(list.len(), 2);
    assert_eq!(list[0].titlu, "Al doilea", "newest first");
    assert_eq!(list[1].module, "t.sender");
    assert_eq!(list[1].nivel, Level::Urgent);
    assert_eq!(list[1].text, "F-12, 1.200 lei");
    assert_eq!(notifications::unread_count(&ws).unwrap(), 2);

    notifications::mark_read(&mut ws, list[1].id).unwrap();
    notifications::mark_read(&mut ws, list[1].id).unwrap(); // idempotent
    assert_eq!(notifications::unread_count(&ws).unwrap(), 1);
    assert_eq!(notifications::mark_all_read(&mut ws).unwrap(), 1);
    assert_eq!(notifications::unread_count(&ws).unwrap(), 0);

    // Audited: one entry per new notification.
    let log = audit_log(&ws, 20).unwrap();
    let sends = log
        .iter()
        .filter(|e| e.get("action").and_then(Value::as_str) == Some("notify.send"))
        .count();
    assert_eq!(sends, 2, "{log:?}");

    // After reopening: still there, still read; the key still deduplicates.
    drop(ws);
    let mut ws = Workspace::open(&dir).unwrap();
    let again = mm
        .call(
            &mut ws,
            None,
            "t.sender",
            "send",
            json!({"titlu": "Factură scadentă", "cheie": "f12"}),
        )
        .unwrap();
    assert_eq!(again["new"], false);
    assert_eq!(notifications::list(&ws, false, 50).unwrap().len(), 2);
    assert_eq!(notifications::clear_read(&mut ws).unwrap(), 2);
    assert!(notifications::list(&ws, false, 50).unwrap().is_empty());
}

#[test]
fn without_permission_refused_and_audited() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = manager("t.silent", &[]);
    mm.enable(&mut ws, "t.silent", &[]).unwrap();
    let err = mm.call(&mut ws, None, "t.silent", "send", json!({"titlu": "Spam"}));
    assert!(matches!(err, Err(CoreError::PermissionDenied { .. })), "{err:?}");
    assert!(notifications::list(&ws, false, 10).unwrap().is_empty());
    let log = audit_log(&ws, 10).unwrap();
    assert!(
        log.iter()
            .any(|e| e.get("action").and_then(Value::as_str) == Some("notify.send")
                && e.get("outcome").and_then(Value::as_str) == Some("refuzat"))
    );
}

#[test]
fn bad_text_refused_and_list_bounded() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    assert!(notifications::send(&mut ws, "m", &Notice::new("  ", "")).is_err());
    assert!(notifications::send(&mut ws, "m", &Notice::new("x".repeat(121), "")).is_err());
    assert!(notifications::send(&mut ws, "m", &Notice::new("t", "y".repeat(501))).is_err());
    // Control characters are removed from the title.
    let (id, _) = notifications::send(&mut ws, "m", &Notice::new("a\u{0007}b\u{202e}", "")).unwrap();
    let l = notifications::list(&ws, false, 1).unwrap();
    assert_eq!(l[0].id, id);
    assert_eq!(l[0].titlu, "ab");

    // Fill up: the first 10 read, the rest unread.
    for i in 1..MAX_KEPT {
        notifications::send(&mut ws, "m", &Notice::new(format!("n{i}"), "").level(Level::Info)).unwrap();
        if i <= 10 {
            let first = notifications::list(&ws, false, 1).unwrap()[0].id;
            notifications::mark_read(&mut ws, first).unwrap();
        }
    }
    assert_eq!(notifications::list(&ws, false, usize::MAX).unwrap().len(), MAX_KEPT);
    let unread_before = notifications::unread_count(&ws).unwrap();
    notifications::send(&mut ws, "m", &Notice::new("încă una", "").key("k")).unwrap();
    assert_eq!(notifications::list(&ws, false, usize::MAX).unwrap().len(), MAX_KEPT);
    assert_eq!(
        notifications::unread_count(&ws).unwrap(),
        unread_before + 1,
        "only read ones are dropped"
    );
}
