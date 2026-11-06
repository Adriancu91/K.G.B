//! Step 1.10 (core part): profiles hide/show modules per profile.

use kgb_core::profiles::{hidden, set_visible};
use kgb_core::workspace::Workspace;

#[test]
fn visibility_is_per_profile_and_persists() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    {
        let mut ws = Workspace::create(&dir, "T").unwrap();
        assert!(hidden(ws.store(), "birou").unwrap().is_empty());
        set_visible(ws.store_mut(), "birou", "kgb.notes", false).unwrap();
        set_visible(ws.store_mut(), "birou", "kgb.notes", false).unwrap();
        assert!(hidden(ws.store(), "birou").unwrap().contains("kgb.notes"));
        assert!(hidden(ws.store(), "management").unwrap().is_empty());
    }
    let mut ws = Workspace::open(&dir).unwrap();
    assert!(hidden(ws.store(), "birou").unwrap().contains("kgb.notes"));
    set_visible(ws.store_mut(), "birou", "kgb.notes", true).unwrap();
    assert!(hidden(ws.store(), "birou").unwrap().is_empty());
}

#[test]
fn unknown_profile_is_refused() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    assert!(hidden(ws.store(), "nope").is_err());
    assert!(set_visible(ws.store_mut(), "nope", "kgb.notes", false).is_err());
}
