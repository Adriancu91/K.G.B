//! Step 1.6: device key (DPAPI-sealed Ed25519) and workspace owner.

use kgb_core::CoreError;
use kgb_core::identity::{
    DEVICE_KEY_FILE, DEVICES_COLLECTION, DeviceIdentity, owner, register_this_device, set_owner, verify,
};
use kgb_core::workspace::Workspace;

#[test]
fn key_is_created_once_and_reloaded_identically() {
    let tmp = tempfile::tempdir().unwrap();
    let a = DeviceIdentity::load_or_create(tmp.path()).unwrap();
    assert!(a.created());
    let b = DeviceIdentity::load_or_create(tmp.path()).unwrap();
    assert!(!b.created());
    assert_eq!(a.public_hex(), b.public_hex());
    assert_eq!(a.fingerprint().len(), 19);
    let sig = a.sign(b"hello");
    assert!(verify(&b.public_key(), b"hello", &sig));
    assert!(!verify(&b.public_key(), b"hellO", &sig));
    // Debug output never shows the secret.
    assert!(!format!("{a:?}").contains("sealed"));
}

#[test]
fn key_file_does_not_contain_the_secret_in_clear() {
    let tmp = tempfile::tempdir().unwrap();
    let dev = DeviceIdentity::load_or_create(tmp.path()).unwrap();
    let raw = std::fs::read_to_string(tmp.path().join(DEVICE_KEY_FILE)).unwrap();
    let v: serde_json::Value = serde_json::from_str(&raw).unwrap();
    assert_eq!(v["protection"], "dpapi-user");
    assert_eq!(v["public"], dev.public_hex());
    // The DPAPI blob is much longer than a raw 32-byte key (64 hex chars).
    assert!(v["sealed"].as_str().unwrap().len() > 200);
    // Signing with the reloaded key must match: if the file held the secret in
    // clear, it would be the 64-hex-char string; no such field exists.
    assert_eq!(v.as_object().unwrap().len(), 4);
}

#[test]
fn tampered_key_file_is_refused_not_regenerated() {
    let tmp = tempfile::tempdir().unwrap();
    let dev = DeviceIdentity::load_or_create(tmp.path()).unwrap();
    let path = tmp.path().join(DEVICE_KEY_FILE);
    let mut v: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    let mut sealed = v["sealed"].as_str().unwrap().to_string();
    let last = if sealed.ends_with('0') { "1" } else { "0" };
    sealed.replace_range(sealed.len() - 1.., last);
    v["sealed"] = sealed.into();
    std::fs::write(&path, v.to_string()).unwrap();
    assert!(matches!(
        DeviceIdentity::load_or_create(tmp.path()),
        Err(CoreError::WorkspaceManifestCorrupt { .. })
    ));
    // The damaged file is left for diagnosis; a new identity is NOT made silently.
    assert!(std::fs::read_to_string(&path).unwrap().contains(&dev.public_hex()));

    // Swapping in another public key is detected too.
    std::fs::remove_file(&path).unwrap();
    let dev = DeviceIdentity::load_or_create(tmp.path()).unwrap();
    let mut v: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    v["public"] = "00".repeat(32).into();
    std::fs::write(&path, v.to_string()).unwrap();
    assert!(DeviceIdentity::load_or_create(tmp.path()).is_err());
    drop(dev);
}

#[test]
fn owner_and_device_are_recorded_in_the_workspace() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    let dev = DeviceIdentity::load_or_create(&tmp.path().join("device")).unwrap();
    {
        let mut ws = Workspace::create(&dir, "W").unwrap();
        assert!(owner(ws.store()).unwrap().is_none());
        assert!(set_owner(ws.store_mut(), "", 0).is_err());
        set_owner(ws.store_mut(), "Adrian", 0).unwrap();
        let id = register_this_device(ws.store_mut(), &dev, "Laptop").unwrap();
        assert_eq!(
            register_this_device(ws.store_mut(), &dev, "Laptop").unwrap(),
            id,
            "idempotent"
        );
        assert_eq!(ws.store().count(DEVICES_COLLECTION), 1);
    }
    let mut ws = Workspace::open(&dir).unwrap();
    let o = owner(ws.store()).unwrap().unwrap();
    assert_eq!(o.display_name, "Adrian");
    set_owner(ws.store_mut(), "Adrian C.", o.version).unwrap();
    let o2 = owner(ws.store()).unwrap().unwrap();
    assert_eq!(o2.created_ms, o.created_ms, "rename keeps creation time");
    assert!(
        set_owner(ws.store_mut(), "X", o.version).is_err(),
        "stale version refused"
    );
    let rec = ws.store().scan(DEVICES_COLLECTION, |_| true).unwrap();
    assert_eq!(rec[0].fields["status"], "approved");
    assert_eq!(rec[0].fields["public_key"], dev.public_hex());
}
