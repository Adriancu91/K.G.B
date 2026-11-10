//! Step 1.9: the notes module through the real module manager.

use kgb_core::modules::{Module, ModuleManager};
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreError};
use kgb_notes::{ID, Note, Notes, TEXT_MAX_CHARS};
use kgb_store::Error as StoreError;
use serde_json::json;

fn mm() -> ModuleManager {
    ModuleManager::new(vec![Box::new(Notes::new()) as Box<dyn Module>], CORE_VERSION).unwrap()
}

fn enabled(tmp: &tempfile::TempDir) -> (Workspace, ModuleManager) {
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = mm();
    mm.enable(&mut ws, ID, &["storage.own".to_string(), "files.own".to_string(), "notify.send".to_string()])
        .unwrap();
    (ws, mm)
}

fn list(ws: &mut Workspace, mm: &ModuleManager) -> Vec<Note> {
    serde_json::from_value(mm.call(ws, None, ID, "list", json!({})).unwrap()).unwrap()
}

fn add(ws: &mut Workspace, mm: &ModuleManager, text: &str) -> Note {
    serde_json::from_value(mm.call(ws, None, ID, "add", json!({ "text": text })).unwrap()).unwrap()
}

#[test]
fn manifest_is_valid_and_compatible_with_this_core() {
    let n = Notes::new();
    assert_eq!(n.manifest().id, ID);
    assert!(n.manifest().compatible_with(CORE_VERSION));
}

#[test]
fn add_list_update_delete() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut ws, mm) = enabled(&tmp);
    let a = add(&mut ws, &mm, "  prima  ");
    assert_eq!(a.text, "prima");
    let b = add(&mut ws, &mm, "a doua");
    let l = list(&mut ws, &mm);
    assert_eq!(
        l.iter().map(|n| n.text.as_str()).collect::<Vec<_>>(),
        ["a doua", "prima"]
    );

    let u: Note = serde_json::from_value(
        mm.call(
            &mut ws,
            None,
            ID,
            "update",
            json!({"id": a.id, "version": a.version, "text": "prima, editată"}),
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(u.created_ms, a.created_ms);
    assert!(u.version > a.version);

    mm.call(&mut ws, None, ID, "delete", json!({"id": b.id, "version": b.version}))
        .unwrap();
    let l = list(&mut ws, &mm);
    assert_eq!(l.len(), 1);
    assert_eq!(l[0].text, "prima, editată");
    // Logical delete: the record is still in the store.
    assert!(
        ws.store()
            .get_any("mod.kgb.notes.notes", b.id)
            .unwrap()
            .unwrap()
            .deleted
    );
}

#[test]
fn stale_version_is_refused() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut ws, mm) = enabled(&tmp);
    let a = add(&mut ws, &mm, "x");
    mm.call(
        &mut ws,
        None,
        ID,
        "update",
        json!({"id": a.id, "version": a.version, "text": "y"}),
    )
    .unwrap();
    let r = mm.call(
        &mut ws,
        None,
        ID,
        "update",
        json!({"id": a.id, "version": a.version, "text": "z"}),
    );
    assert!(
        matches!(r, Err(CoreError::Store(StoreError::VersionConflict { .. }))),
        "{r:?}"
    );
    let r = mm.call(&mut ws, None, ID, "delete", json!({"id": a.id, "version": a.version}));
    assert!(r.is_err());
    assert_eq!(list(&mut ws, &mm)[0].text, "y");
}

#[test]
fn invalid_input_is_refused() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut ws, mm) = enabled(&tmp);
    for bad in [
        json!({"text": "   "}),
        json!({"text": "x".repeat(TEXT_MAX_CHARS + 1)}),
        json!({}),
        json!({"text": 5}),
        json!({"text": "ok", "extra": 1}),
    ] {
        assert!(mm.call(&mut ws, None, ID, "add", bad.clone()).is_err(), "{bad}");
    }
    assert!(mm.call(&mut ws, None, ID, "nope", json!({})).is_err());
    let missing = json!({"id": uuid::Uuid::nil(), "version": 1, "text": "x"});
    assert!(mm.call(&mut ws, None, ID, "update", missing).is_err());
    assert!(list(&mut ws, &mm).is_empty());
    assert_eq!(
        add(&mut ws, &mm, &"ă".repeat(TEXT_MAX_CHARS)).text.chars().count(),
        TEXT_MAX_CHARS
    );
}

/// The Etapa 1 gate, at core level: enable, add, disable, reopen, re-enable —
/// nothing lost.
#[test]
fn gate_scenario_data_survives_disable_and_reopen() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    {
        let mut ws = Workspace::create(&dir, "T").unwrap();
        let mm = mm();
        mm.enable(&mut ws, ID, &["storage.own".to_string(), "files.own".to_string(), "notify.send".to_string()])
            .unwrap();
        add(&mut ws, &mm, "rămân");
        mm.disable(&mut ws, ID).unwrap();
        assert!(mm.call(&mut ws, None, ID, "list", json!({})).is_err());
    }
    let mut ws = Workspace::open(&dir).unwrap();
    let mm = mm();
    assert!(!mm.state(&ws, ID).unwrap().enabled, "disabled state persisted");
    assert_eq!(mm.list(&ws, true).unwrap()[0].records, 1);
    mm.enable(&mut ws, ID, &["storage.own".to_string(), "files.own".to_string(), "notify.send".to_string()])
        .unwrap();
    assert_eq!(list(&mut ws, &mm)[0].text, "rămân");
}
