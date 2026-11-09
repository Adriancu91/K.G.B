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

/// Step 7.4m-5: a reception sheet with lines — category or product,
/// quantity (or gross − tare), unit and a photo per line.
#[test]
fn reception_sheet_with_lines() {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    let (id, token) = phones::pair(&mut ws, "Telefon cântar").unwrap();
    phones::approve(&mut ws, id, "Ion").unwrap();
    let p = phones::by_token(&ws, &token).unwrap().unwrap();
    let photo = |n: u8| Upload { name: format!("linia{n}.jpg"), mime: "image/jpeg".into(), data: vec![0xFF, 0xD8, n] };
    let head = json!({"furnizor": "Fier Vechi SRL", "vehicul": "IS-02-XYZ"}).as_object().unwrap().clone();
    let lines = vec![
        json!({"categorie": "Fier vechi", "um": "kg", "brut": "12.450", "tara": "8.200", "foto": 0}),
        json!({"categorie": "Cupru", "um": "kg", "cantitate": "125,5", "foto": 1}),
        json!({"categorie": "Aluminiu", "cantitate": "40"}),
    ];
    let sid = phones::submit_with_lines(&mut ws, &p, "receptie", head.clone(), lines, vec![photo(1), photo(2)]).unwrap();
    let inbox = phones::inbox(&ws).unwrap();
    let rec = inbox.iter().find(|x| x["id"] == json!(sid)).unwrap();
    let l = rec["linii"].as_array().unwrap();
    assert_eq!(l.len(), 3);
    // 12.450 − 8.200 = 4.250 kg (Romanian thousands).
    assert_eq!((l[0]["cantitate"].as_i64(), l[0]["cantitate_text"].as_str()), (Some(4_250_000), Some("4.250")));
    assert_eq!((l[1]["cantitate"].as_i64(), l[1]["cantitate_text"].as_str()), (Some(125_500), Some("125,5")));
    assert_eq!((l[2]["um"].as_str(), l[2]["foto"].is_null()), (Some("buc"), true));
    let f0: uuid::Uuid = l[0]["foto"].as_str().unwrap().parse().unwrap();
    assert_eq!(phones::file(&ws, f0).unwrap().1, vec![0xFF, 0xD8, 1], "each line keeps its own photo");

    let mut bad = |ls: Vec<serde_json::Value>| phones::submit_with_lines(&mut ws, &p, "receptie", head.clone(), ls, vec![]).unwrap_err().to_string();
    assert!(bad(vec![json!({"categorie": "", "cantitate": "1"})]).contains("categoria"));
    assert!(bad(vec![json!({"categorie": "x", "cantitate": "0"})]).contains("pozitiv"));
    assert!(bad(vec![json!({"categorie": "x", "brut": "10", "tara": "12"})]).contains("tara"));
    assert!(bad(vec![json!({"categorie": "x", "brut": "10"})]).contains("și tara"));
    assert!(bad(vec![json!({"categorie": "x", "cantitate": "1", "foto": 3})]).contains("poza"));
    drop(bad);
    assert!(phones::submit_with_lines(&mut ws, &p, "document", head.clone(), vec![json!({"categorie": "x", "cantitate": "1"})], vec![]).is_err());
    assert_eq!(phones::qty_thousandths("1.234,5"), Some(1_234_500));
    assert_eq!(phones::qty_thousandths("1234.5"), Some(1_234_500));
    assert_eq!(phones::fmt_thousandths(1_234_500), "1.234,5");
}
