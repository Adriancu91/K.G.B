//! Step 1.4: workspace create/open, single instance, damaged or too-new
//! manifest, cloud folders, registry.

use kgb_core::CoreError;
use kgb_core::workspace::{MANIFEST_FILE, Registry, Workspace, open_last_or_create_default};
use kgb_store::Write;
use serde_json::json;
use uuid::Uuid;

#[test]
fn create_then_reopen_keeps_identity_and_data() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    let id;
    {
        let mut ws = Workspace::create(&dir, "  Firma mea  ").unwrap();
        assert_eq!(ws.manifest().name, "Firma mea");
        id = ws.manifest().id;
        let fields = json!({"a": 1}).as_object().unwrap().clone();
        ws.store_mut()
            .write(vec![Write::put("t", Uuid::from_u128(7), fields)])
            .unwrap();
    }
    let ws = Workspace::open(&dir).unwrap();
    assert_eq!(ws.manifest().id, id);
    assert!(ws.store().get("t", Uuid::from_u128(7)).unwrap().is_some());
    assert!(ws.logs_dir().is_dir());
}

#[test]
fn second_open_is_refused_while_first_is_open() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    let _first = Workspace::create(&dir, "A").unwrap();
    match Workspace::open(&dir) {
        Err(CoreError::WorkspaceInUse(_)) => {}
        other => panic!("expected WorkspaceInUse, got {:?}", other.map(|_| ())),
    }
}

#[test]
fn create_refuses_non_empty_folder_and_bad_names() {
    let tmp = tempfile::tempdir().unwrap();
    std::fs::write(tmp.path().join("x.txt"), b"x").unwrap();
    assert!(matches!(
        Workspace::create(tmp.path(), "A"),
        Err(CoreError::AlreadyExists(_))
    ));
    let d = tmp.path().join("n");
    assert!(matches!(Workspace::create(&d, "   "), Err(CoreError::Invalid { .. })));
    assert!(matches!(
        Workspace::create(&d, &"x".repeat(81)),
        Err(CoreError::Invalid { .. })
    ));
    assert!(matches!(
        Workspace::create(&d, "a\u{0007}b"),
        Err(CoreError::Invalid { .. })
    ));
    assert!(!d.exists(), "nothing created for an invalid name");
}

#[test]
fn damaged_manifest_is_reported_and_left_untouched() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    drop(Workspace::create(&dir, "A").unwrap());
    let path = dir.join(MANIFEST_FILE);
    std::fs::write(&path, b"{ not json").unwrap();
    assert!(matches!(
        Workspace::open(&dir),
        Err(CoreError::WorkspaceManifestCorrupt { .. })
    ));
    assert_eq!(std::fs::read(&path).unwrap(), b"{ not json");
    assert!(dir.join("store").is_dir(), "store not deleted");
}

#[test]
fn newer_format_is_refused_as_too_new() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    drop(Workspace::create(&dir, "A").unwrap());
    std::fs::write(dir.join(MANIFEST_FILE), br#"{"format": 99, "future": true}"#).unwrap();
    match Workspace::open(&dir) {
        Err(CoreError::WorkspaceTooNew {
            format: 99,
            supported: 1,
            ..
        }) => {}
        other => panic!("{:?}", other.map(|_| ())),
    }
}

#[test]
fn missing_manifest_is_not_a_workspace() {
    let tmp = tempfile::tempdir().unwrap();
    assert!(matches!(Workspace::open(tmp.path()), Err(CoreError::NotAWorkspace(_))));
}

#[test]
fn cloud_folders_are_refused() {
    let tmp = tempfile::tempdir().unwrap();
    for sub in ["OneDrive/ws", "Dropbox/ws", "Google Drive/ws"] {
        let d = tmp.path().join(sub);
        assert!(
            matches!(Workspace::create(&d, "A"), Err(CoreError::UnsafeLocation(_))),
            "{sub}"
        );
        assert!(!d.exists());
    }
}

#[test]
fn rename_persists() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    let mut ws = Workspace::create(&dir, "A").unwrap();
    ws.rename("B").unwrap();
    assert!(ws.rename("").is_err());
    drop(ws);
    assert_eq!(Workspace::open(&dir).unwrap().manifest().name, "B");
}

#[test]
fn first_run_creates_default_then_reopens_same() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path().join("KGB");
    let (ws, created) = open_last_or_create_default(&root, "Spațiul meu").unwrap();
    assert!(created);
    let id = ws.manifest().id;
    drop(ws);
    let (ws, created) = open_last_or_create_default(&root, "Spațiul meu").unwrap();
    assert!(!created);
    assert_eq!(ws.manifest().id, id);
    let reg = Registry::load(&root).unwrap();
    assert_eq!(reg.workspaces.len(), 1);
    assert_eq!(reg.last_opened, Some(id));
}

#[test]
fn damaged_registry_is_reported_not_replaced() {
    let tmp = tempfile::tempdir().unwrap();
    std::fs::write(tmp.path().join("workspaces.json"), b"garbage").unwrap();
    assert!(open_last_or_create_default(tmp.path(), "X").is_err());
    assert_eq!(std::fs::read(tmp.path().join("workspaces.json")).unwrap(), b"garbage");
    assert!(!tmp.path().join("workspaces").exists());
}
