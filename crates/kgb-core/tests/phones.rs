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
    let photo = || Upload {
        name: "aviz.jpg".into(),
        mime: "image/jpeg".into(),
        data: vec![0xFF, 0xD8, 1, 2, 3],
    };
    assert!(
        phones::submit(&mut ws, &p, "document", fields(json!({"nota": "x"})), vec![photo()]).is_err(),
        "not approved yet"
    );
    assert!(phones::approve(&mut ws, id, "").is_err(), "whose phone");
    phones::approve(&mut ws, id, "Ion Pop").unwrap();
    let p = phones::by_token(&ws, &token).unwrap().unwrap();
    let sid = phones::submit(
        &mut ws,
        &p,
        "document",
        fields(json!({"sofer": "Vasile", "nota": "aviz și CMR"})),
        vec![photo(), photo()],
    )
    .unwrap();
    assert!(
        phones::submit(&mut ws, &p, "extras", fields(json!({"nota": "x"})), vec![]).is_err(),
        "a statement needs its file"
    );
    assert!(phones::submit(&mut ws, &p, "alt", fields(json!({"a": "b"})), vec![]).is_err());
    let big = Upload {
        name: "mare.jpg".into(),
        mime: "image/jpeg".into(),
        data: vec![0; phones::MAX_FILE_BYTES + 1],
    };
    assert!(phones::submit(&mut ws, &p, "document", fields(json!({})), vec![big]).is_err());
    let exe = Upload {
        name: "x.exe".into(),
        mime: "application/x-msdownload".into(),
        data: vec![1],
    };
    assert!(phones::submit(&mut ws, &p, "document", fields(json!({})), vec![exe]).is_err());

    let inbox = phones::inbox(&ws).unwrap();
    assert_eq!(inbox.len(), 1);
    assert_eq!(
        (inbox[0]["membru_nume"].as_str(), inbox[0]["campuri"]["sofer"].as_str()),
        (Some("Ion Pop"), Some("Vasile"))
    );
    let fid: uuid::Uuid = inbox[0]["fisiere"][0]["id"].as_str().unwrap().parse().unwrap();
    assert_eq!(phones::file(&ws, fid).unwrap().1, vec![0xFF, 0xD8, 1, 2, 3]);
    phones::mark_done(&mut ws, sid, true).unwrap();
    assert_eq!(phones::inbox(&ws).unwrap()[0]["procesat"], true);

    phones::revoke(&mut ws, id).unwrap();
    let p = phones::by_token(&ws, &token).unwrap().unwrap();
    assert!(
        phones::submit(&mut ws, &p, "document", fields(json!({"nota": "y"})), vec![]).is_err(),
        "revoked"
    );
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
    let photo = |n: u8| Upload {
        name: format!("linia{n}.jpg"),
        mime: "image/jpeg".into(),
        data: vec![0xFF, 0xD8, n],
    };
    let head = json!({"furnizor": "Fier Vechi SRL", "vehicul": "IS-02-XYZ"})
        .as_object()
        .unwrap()
        .clone();
    let lines = vec![
        json!({"categorie": "Fier vechi", "um": "kg", "brut": "12.450", "tara": "8.200", "foto": 0}),
        json!({"categorie": "Cupru", "um": "kg", "cantitate": "125,5", "foto": 1}),
        json!({"categorie": "Aluminiu", "cantitate": "40"}),
    ];
    let sid =
        phones::submit_with_lines(&mut ws, &p, "receptie", head.clone(), lines, vec![photo(1), photo(2)]).unwrap();
    let inbox = phones::inbox(&ws).unwrap();
    let rec = inbox.iter().find(|x| x["id"] == json!(sid)).unwrap();
    let l = rec["linii"].as_array().unwrap();
    assert_eq!(l.len(), 3);
    // 12.450 − 8.200 = 4.250 kg (Romanian thousands).
    assert_eq!(
        (l[0]["cantitate"].as_i64(), l[0]["cantitate_text"].as_str()),
        (Some(4_250_000), Some("4.250"))
    );
    assert_eq!(
        (l[1]["cantitate"].as_i64(), l[1]["cantitate_text"].as_str()),
        (Some(125_500), Some("125,5"))
    );
    assert_eq!((l[2]["um"].as_str(), l[2]["foto"].is_null()), (Some("buc"), true));
    let f0: uuid::Uuid = l[0]["foto"].as_str().unwrap().parse().unwrap();
    assert_eq!(
        phones::file(&ws, f0).unwrap().1,
        vec![0xFF, 0xD8, 1],
        "each line keeps its own photo"
    );

    let mut bad = |ls: Vec<serde_json::Value>| {
        phones::submit_with_lines(&mut ws, &p, "receptie", head.clone(), ls, vec![])
            .unwrap_err()
            .to_string()
    };
    assert!(bad(vec![json!({"categorie": "", "cantitate": "1"})]).contains("categoria"));
    assert!(bad(vec![json!({"categorie": "x", "cantitate": "0"})]).contains("pozitiv"));
    assert!(bad(vec![json!({"categorie": "x", "brut": "10", "tara": "12"})]).contains("tara"));
    assert!(bad(vec![json!({"categorie": "x", "brut": "10"})]).contains("și tara"));
    assert!(bad(vec![json!({"categorie": "x", "cantitate": "1", "foto": 3})]).contains("poza"));
    drop(bad);
    assert!(
        phones::submit_with_lines(
            &mut ws,
            &p,
            "document",
            head.clone(),
            vec![json!({"categorie": "x", "cantitate": "1"})],
            vec![]
        )
        .is_err()
    );
    assert_eq!(phones::qty_thousandths("1.234,5"), Some(1_234_500));
    assert_eq!(phones::qty_thousandths("1234.5"), Some(1_234_500));
    assert_eq!(phones::fmt_thousandths(1_234_500), "1.234,5");
}

/// Step 7.4m-6: an inventory counted on the phone (products of Business,
/// zero allowed) and a photographed expense receipt (photo and sum needed).
#[test]
fn inventory_and_expense_receipt() {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    let (id, token) = phones::pair(&mut ws, "Telefon depozit").unwrap();
    phones::approve(&mut ws, id, "Ion").unwrap();
    let p = phones::by_token(&ws, &token).unwrap().unwrap();
    let head = |v: serde_json::Value| v.as_object().unwrap().clone();
    let prod = uuid::Uuid::now_v7().to_string();
    let lines = vec![
        json!({"categorie": "Fier vechi", "produs": prod, "um": "kg", "cantitate": "1.200"}),
        json!({"categorie": "Cupru", "produs": uuid::Uuid::now_v7().to_string(), "um": "kg", "cantitate": "0"}),
    ];
    let sid = phones::submit_with_lines(
        &mut ws,
        &p,
        "inventar",
        head(json!({"depozit": "Curte"})),
        lines,
        vec![],
    )
    .unwrap();
    let inbox = phones::inbox(&ws).unwrap();
    let inv = inbox.iter().find(|x| x["id"] == json!(sid)).unwrap();
    assert_eq!(inv["tip"], "inventar");
    assert_eq!(
        (
            inv["linii"][0]["cantitate_text"].as_str(),
            inv["linii"][1]["cantitate"].as_i64()
        ),
        (Some("1.200"), Some(0))
    );
    let err = |r: kgb_core::CoreResult<uuid::Uuid>| r.unwrap_err().to_string();
    assert!(
        err(phones::submit_with_lines(
            &mut ws,
            &p,
            "inventar",
            head(json!({"depozit": "Curte"})),
            vec![],
            vec![]
        ))
        .contains("cel puțin o linie")
    );
    assert!(
        err(phones::submit_with_lines(
            &mut ws,
            &p,
            "inventar",
            head(json!({})),
            vec![json!({"categorie": "Ceva", "cantitate": "3"})],
            vec![]
        ))
        .contains("lista din Business")
    );

    let bon = Upload {
        name: "bon.jpg".into(),
        mime: "image/jpeg".into(),
        data: vec![0xFF, 0xD8, 9],
    };
    let ok = phones::submit(
        &mut ws,
        &p,
        "bon",
        head(json!({"furnizor": "Benzinăria X", "suma": "250,40", "ce": "motorină"})),
        vec![bon],
    )
    .unwrap();
    assert!(
        phones::inbox(&ws)
            .unwrap()
            .iter()
            .any(|x| x["id"] == json!(ok) && x["campuri"]["suma"] == "250,40")
    );
    let bon2 = || Upload {
        name: "bon.jpg".into(),
        mime: "image/jpeg".into(),
        data: vec![0xFF, 0xD8, 9],
    };
    assert!(err(phones::submit(&mut ws, &p, "bon", head(json!({"suma": "10"})), vec![])).contains("fotografiază"));
    assert!(
        err(phones::submit(
            &mut ws,
            &p,
            "bon",
            head(json!({"suma": "zece"})),
            vec![bon2()]
        ))
        .contains("suma")
    );
    assert!(
        err(phones::submit(
            &mut ws,
            &p,
            "bon",
            head(json!({"ce": "x"})),
            vec![bon2()]
        ))
        .contains("suma")
    );
}

/// Step 7.4m-6b: entry and exit declared from the phone (no location).
#[test]
fn timesheet_from_phone() {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    let (id, token) = phones::pair(&mut ws, "Telefon Ion").unwrap();
    phones::approve(&mut ws, id, "Ion").unwrap();
    let p = phones::by_token(&ws, &token).unwrap().unwrap();
    let f = |v: serde_json::Value| v.as_object().unwrap().clone();
    phones::submit(
        &mut ws,
        &p,
        "pontaj",
        f(json!({"miscare": "intrare", "ora": "07:58", "data": "2026-11-09"})),
        vec![],
    )
    .unwrap();
    phones::submit(
        &mut ws,
        &p,
        "pontaj",
        f(json!({"miscare": "iesire", "ora": "16:30", "data": "2026-11-09"})),
        vec![],
    )
    .unwrap();
    assert_eq!(
        phones::inbox(&ws)
            .unwrap()
            .iter()
            .filter(|x| x["tip"] == "pontaj")
            .count(),
        2
    );
    let mut err = |v: serde_json::Value| {
        phones::submit(&mut ws, &p, "pontaj", f(v), vec![])
            .unwrap_err()
            .to_string()
    };
    assert!(err(json!({"miscare": "pauza", "ora": "10:00", "data": "2026-11-09"})).contains("intrare"));
    assert!(err(json!({"miscare": "intrare", "ora": "24:00", "data": "2026-11-09"})).contains("HH:MM"));
    assert!(err(json!({"miscare": "intrare", "ora": "8:00", "data": "2026-11-09"})).contains("HH:MM"));
    assert!(err(json!({"miscare": "intrare", "ora": "08:00", "data": "09.11.2026"})).contains("AAAA-LL-ZZ"));
    assert!(err(json!({"miscare": "intrare", "ora": "08:00", "data": "2026-13-01"})).contains("AAAA-LL-ZZ"));
    drop(err);
    let photo = Upload {
        name: "x.jpg".into(),
        mime: "image/jpeg".into(),
        data: vec![1],
    };
    assert!(
        phones::submit(
            &mut ws,
            &p,
            "pontaj",
            f(json!({"miscare": "intrare", "ora": "08:00", "data": "2026-11-09"})),
            vec![photo]
        )
        .is_err()
    );
}

/// Step 7.4m-6c: the driver reports a delivery's stage (applied on the PC).
#[test]
fn driver_delivery_stage() {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    let (id, token) = phones::pair(&mut ws, "Telefon șofer").unwrap();
    phones::approve(&mut ws, id, "Vasile").unwrap();
    let p = phones::by_token(&ws, &token).unwrap().unwrap();
    let f = |v: serde_json::Value| v.as_object().unwrap().clone();
    let liv = uuid::Uuid::now_v7().to_string();
    let aviz = Upload {
        name: "aviz-semnat.jpg".into(),
        mime: "image/jpeg".into(),
        data: vec![0xFF, 0xD8, 7],
    };
    phones::submit(
        &mut ws,
        &p,
        "livrare",
        f(json!({"livrare": liv, "etapa": "in_drum", "aviz": "AV-12"})),
        vec![],
    )
    .unwrap();
    phones::submit(
        &mut ws,
        &p,
        "livrare",
        f(json!({"livrare": liv, "etapa": "livrat", "primit_de": "Ion Client"})),
        vec![aviz],
    )
    .unwrap();
    let mut err = |v: serde_json::Value| {
        phones::submit(&mut ws, &p, "livrare", f(v), vec![])
            .unwrap_err()
            .to_string()
    };
    assert!(err(json!({"livrare": liv, "etapa": "in_drum"})).contains("avizului"));
    assert!(err(json!({"livrare": liv, "etapa": "livrat", "aviz": "x"})).contains("cine a primit"));
    assert!(err(json!({"livrare": liv, "etapa": "confirmat"})).contains("doar"));
    assert!(err(json!({"livrare": "x", "etapa": "in_drum", "aviz": "A"})).contains("aleasă"));
}

/// Step 7.4m-6d: "I finished this task" (marked done on the PC).
#[test]
fn task_done_from_phone() {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    let (id, token) = phones::pair(&mut ws, "Telefon").unwrap();
    phones::approve(&mut ws, id, "Ion").unwrap();
    let p = phones::by_token(&ws, &token).unwrap().unwrap();
    let f = |v: serde_json::Value| v.as_object().unwrap().clone();
    phones::submit(
        &mut ws,
        &p,
        "task",
        f(json!({"task": uuid::Uuid::now_v7().to_string(), "titlu": "Sună furnizorul"})),
        vec![],
    )
    .unwrap();
    assert!(phones::submit(&mut ws, &p, "task", f(json!({"task": "x", "titlu": "T"})), vec![]).is_err());
    assert!(
        phones::submit(
            &mut ws,
            &p,
            "task",
            f(json!({"task": uuid::Uuid::now_v7().to_string()})),
            vec![]
        )
        .is_err()
    );
}

/// Step 7.4m-7: the team leader's daily report (present, extra hours).
#[test]
fn team_report_from_phone() {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    let (id, token) = phones::pair(&mut ws, "Telefon șef").unwrap();
    phones::approve(&mut ws, id, "Ion Pop").unwrap();
    let p = phones::by_token(&ws, &token).unwrap().unwrap();
    let head = |v: serde_json::Value| v.as_object().unwrap().clone();
    let site = uuid::Uuid::now_v7().to_string();
    let (a, b) = (uuid::Uuid::now_v7().to_string(), uuid::Uuid::now_v7().to_string());
    let sid = phones::submit_with_lines(
        &mut ws,
        &p,
        "pontaj_echipa",
        head(json!({"punct": site, "punct_nume": "Curte", "data": "2026-11-09"})),
        vec![
            json!({"angajat": a, "nume": "Ankit", "prezent": true, "extra": 2}),
            json!({"angajat": b, "nume": "Tofiq", "prezent": false, "extra": 3}),
        ],
        vec![],
    )
    .unwrap();
    let inbox = phones::inbox(&ws).unwrap();
    let r = inbox.iter().find(|x| x["id"] == json!(sid)).unwrap();
    assert_eq!(r["linii"][0]["extra"], 2);
    assert_eq!(r["linii"][1]["extra"], 0, "absent: no extra hours");
    let mut err = |f: serde_json::Value, l: Vec<serde_json::Value>| {
        phones::submit_with_lines(&mut ws, &p, "pontaj_echipa", head(f), l, vec![])
            .unwrap_err()
            .to_string()
    };
    assert!(err(json!({"punct": site, "data": "2026-11-09"}), vec![]).contains("1–200"));
    assert!(
        err(
            json!({"punct": site, "data": "2026-11-09"}),
            vec![json!({"angajat": a, "prezent": true, "extra": 20})]
        )
        .contains("−12")
    );
    assert!(
        err(
            json!({"data": "2026-11-09"}),
            vec![json!({"angajat": a, "prezent": true})]
        )
        .contains("punctul de lucru")
    );
    assert!(
        err(
            json!({"punct": site, "data": "2026-11-09"}),
            vec![json!({"angajat": "x", "prezent": true})]
        )
        .contains("ales")
    );
}
