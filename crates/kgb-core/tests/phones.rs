//! Step 7.4m: phones — pairing waits for approval; only an approved phone
//! adds to the inbox; a revoked one cannot; the token is not stored, only
//! its hash; files go into the inbox with limits.

use kgb_core::phones::{self, Upload};
use kgb_core::workspace::Workspace;
use serde_json::json;

#[test]
fn pair_approve_submit_revoke() {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    assert!(phones::pair(&mut ws, " ").is_err());
    let (id, token) = phones::pair(&mut ws, "Telefon depozit").unwrap();
    assert_eq!(token.len(), 64);
    let p = phones::by_token(&ws, &token).unwrap().unwrap();
    assert_eq!((p.id, p.stare.as_str()), (id, "asteapta"));
    assert!(phones::by_token(&ws, &"0".repeat(64)).unwrap().is_none());
    // The token itself is not in the store.
    let raw = ws.store().get(phones::PHONES_COLLECTION, id).unwrap().unwrap();
    assert!(!raw.fields.values().any(|v| v.as_str() == Some(token.as_str())));

    let fields = |v: serde_json::Value| v.as_object().unwrap().clone();
    let photo = || Upload { name: "aviz.jpg".into(), mime: "image/jpeg".into(), data: vec![0xFF, 0xD8, 1, 2, 3] };
    assert!(phones::submit(&mut ws, &p, "document", fields(json!({"nota": "x"})), vec![photo()]).is_err(), "not approved yet");
    assert!(phones::approve(&mut ws, id, "").is_err(), "whose phone");
    phones::approve(&mut ws, id, "Ion Pop").unwrap();
    let p = phones::by_token(&ws, &token).unwrap().unwrap();
    let sid = phones::submit(&mut ws, &p, "document", fields(json!({"sofer": "Vasile", "nota": "aviz și CMR"})), vec![photo(), photo()]).unwrap();
    assert!(phones::submit(&mut ws, &p, "extras", fields(json!({"nota": "x"})), vec![]).is_err(), "a statement needs its file");
    assert!(phones::submit(&mut ws, &p, "alt", fields(json!({"a": "b"})), vec![]).is_err());
    let big = Upload { name: "mare.jpg".into(), mime: "image/jpeg".into(), data: vec![0; phones::MAX_FILE_BYTES + 1] };
    assert!(phones::submit(&mut ws, &p, "document", fields(json!({})), vec![big]).is_err());
    let exe = Upload { name: "x.exe".into(), mime: "application/x-msdownload".into(), data: vec![1] };
    assert!(phones::submit(&mut ws, &p, "document", fields(json!({})), vec![exe]).is_err());

    let inbox = phones::inbox(&ws).unwrap();
    assert_eq!(inbox.len(), 1);
    assert_eq!((inbox[0]["membru_nume"].as_str(), inbox[0]["campuri"]["sofer"].as_str()), (Some("Ion Pop"), Some("Vasile")));
    let fid: uuid::Uuid = inbox[0]["fisiere"][0]["id"].as_str().unwrap().parse().unwrap();
    assert_eq!(phones::file(&ws, fid).unwrap().1, vec![0xFF, 0xD8, 1, 2, 3]);
    phones::mark_done(&mut ws, sid, true).unwrap();
    assert_eq!(phones::inbox(&ws).unwrap()[0]["procesat"], true);

    phones::revoke(&mut ws, id).unwrap();
    let p = phones::by_token(&ws, &token).unwrap().unwrap();
    assert!(phones::submit(&mut ws, &p, "document", fields(json!({"nota": "y"})), vec![]).is_err(), "revoked");
}
