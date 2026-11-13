//! 8.17 Service auto: a client's car (number kept without spaces, VIN checked, duplicates refused), a work order
//! with labour and parts whose values, VAT and total match the figures computed by hand, the steps up to delivered
//! (which then never changes), a cancelled order kept with its reason, a lower odometer accepted but said, the car's
//! history, deleting a car only without history.

use kgb_autoservice::{AutoService, ID, Line, add_months, line_value, plate, totals, vin};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(AutoService::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "partners.read".into()])
        .unwrap();
    (tmp, ws, mm)
}

fn line(fel: &str, denumire: &str, cantitate: i64, pret: i64) -> Line {
    Line {
        fel: fel.into(),
        cod: String::new(),
        denumire: denumire.into(),
        um: String::new(),
        cantitate,
        pret,
    }
}

#[test]
fn arithmetic_by_hand() {
    // 2,5 h × 150,00 lei = 375,00 lei; 1 × 45,99 = 45,99; 4,5 l × 38,33 = 172,485 → 172,49 (half up).
    assert_eq!(line_value(2_500, 15_000), 37_500);
    assert_eq!(line_value(1_000, 4_599), 4_599);
    assert_eq!(line_value(4_500, 3_833), 17_249);
    let t = totals(
        &[
            line("manopera", "Schimb ulei și filtre", 2_500, 15_000),
            line("piesa", "Filtru ulei", 1_000, 4_599),
            line("piesa", "Ulei 5W30", 4_500, 3_833),
        ],
        21,
    );
    // 375,00 + 45,99 + 172,49 = 593,48; TVA 21 % = 124,6308 → 124,63; total 718,11.
    assert_eq!(
        (t.manopera, t.piese, t.fara_tva, t.tva, t.total),
        (37_500, 21_848, 59_348, 12_463, 71_811)
    );
    assert_eq!(add_months("2026-01-31", 1).as_deref(), Some("2026-02-28"));
    assert_eq!(add_months("2024-01-31", 1).as_deref(), Some("2024-02-29"));
    assert_eq!(add_months("2026-11-13", 12).as_deref(), Some("2027-11-13"));
    assert_eq!(plate(" is 12 abc ").unwrap(), "IS12ABC");
    assert_eq!(plate("b-123-xyz").unwrap(), "B123XYZ");
    assert!(plate("B").is_err() && plate("B 12 ȘĂȚ").is_err());
    assert_eq!(vin(" wvwzzz1kz8w123456 ").unwrap(), "WVWZZZ1KZ8W123456");
    assert_eq!(vin("").unwrap(), "");
    assert!(vin("WVWZZZ1KZ8W12345").is_err(), "16 characters");
    assert!(vin("WVWZZZ1KZ8WI23456").is_err(), "an I");
}

#[test]
fn cars_orders_steps_and_history() {
    let (_t, mut ws, mm) = setup();
    let car = call(
        &mut ws,
        &mm,
        "vehicul_save",
        json!({"client_nume": "Popescu Ion", "telefon": "0722 000 000", "nr": "is 12 abc", "vin": "wvwzzz1kz8w123456",
            "marca": "Dacia", "model": "Logan", "an": 2018, "combustibil": "motorina"}),
    )
    .unwrap();
    assert_eq!(car["nr"], "IS12ABC");
    // The same number or VIN on another car: refused.
    let e = call(
        &mut ws,
        &mm,
        "vehicul_save",
        json!({"client_nume": "Altcineva", "nr": "IS-12-ABC"}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("e deja la altă mașină"), "{e}");
    let e = call(
        &mut ws,
        &mm,
        "vehicul_save",
        json!({"client_nume": "Altcineva", "nr": "B 1 XYZ", "vin": "WVWZZZ1KZ8W123456"}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("e deja la mașina IS12ABC"), "{e}");
    assert!(
        call(&mut ws, &mm, "vehicul_save", json!({"nr": "B 1 XYZ"})).is_err(),
        "no client"
    );

    // A work order: numbered 1, open, with the values computed.
    let o = call(
        &mut ws,
        &mm,
        "comanda_save",
        json!({"vehicul": car["id"], "data_intrare": "2026-11-13", "km": 152_300, "reclamatie": "zgomot la frânare",
            "linii": [
                {"fel": "manopera", "denumire": "Schimb ulei și filtre", "cantitate": 2_500, "pret": 15_000},
                {"fel": "piesa", "cod": "F-123", "denumire": "Filtru ulei", "cantitate": 1_000, "pret": 4_599},
                {"fel": "piesa", "denumire": "Ulei 5W30", "um": "l", "cantitate": 4_500, "pret": 3_833}
            ], "garantie_luni": 3}),
    )
    .unwrap();
    assert_eq!(
        (o["numar"].as_i64(), o["total"].as_i64(), o["atentie"].as_str()),
        (Some(1), Some(71_811), Some(""))
    );
    let v = call(&mut ws, &mm, "comanda", json!({"id": o["id"]})).unwrap();
    assert_eq!(v["stare"], "deschisa");
    assert_eq!(
        (v["manopera"].as_i64(), v["piese"].as_i64(), v["tva"].as_i64()),
        (Some(37_500), Some(21_848), Some(12_463))
    );
    assert_eq!(v["linii"][0]["um"], "ore");
    assert_eq!(v["linii"][1]["um"], "buc");
    assert_eq!(v["linii"][2]["valoare"], 17_249);
    assert_eq!(
        (v["nr"].as_str(), v["masina"].as_str()),
        (Some("IS12ABC"), Some("Dacia Logan"))
    );
    // Bad lines are refused.
    for (bad, why) in [
        (
            json!({"fel": "altceva", "denumire": "x", "cantitate": 1000, "pret": 1}),
            "manoperă sau piesă",
        ),
        (
            json!({"fel": "piesa", "denumire": "x", "cantitate": 0, "pret": 1}),
            "mai mare decât zero",
        ),
        (
            json!({"fel": "piesa", "denumire": "x", "cantitate": 1000, "pret": -1}),
            "negativ",
        ),
        (
            json!({"fel": "piesa", "denumire": " ", "cantitate": 1000, "pret": 1}),
            "linia 1",
        ),
    ] {
        let e = call(
            &mut ws,
            &mm,
            "comanda_save",
            json!({"vehicul": car["id"], "data_intrare": "2026-11-13", "linii": [bad]}),
        )
        .unwrap_err();
        assert!(e.to_string().contains(why), "{e}");
    }

    // Steps: delivered needs the day; then nothing changes.
    let mut ver = v["version"].as_u64().unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "comanda_stare",
            json!({"id": o["id"], "version": ver, "stare": "predata", "data": "2026-11-14"})
        )
        .is_err(),
        "skips steps"
    );
    for st in ["in_lucru", "gata"] {
        ver = call(
            &mut ws,
            &mm,
            "comanda_stare",
            json!({"id": o["id"], "version": ver, "stare": st}),
        )
        .unwrap()["version"]
            .as_u64()
            .unwrap();
    }
    let e = call(
        &mut ws,
        &mm,
        "comanda_stare",
        json!({"id": o["id"], "version": ver, "stare": "predata", "data": "2026-11-12"}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("înaintea datei de intrare"), "{e}");
    ver = call(
        &mut ws,
        &mm,
        "comanda_stare",
        json!({"id": o["id"], "version": ver, "stare": "predata", "data": "2026-11-14"}),
    )
    .unwrap()["version"]
        .as_u64()
        .unwrap();
    let v = call(&mut ws, &mm, "comanda", json!({"id": o["id"]})).unwrap();
    assert_eq!(
        (v["stare"].as_str(), v["garantie_pana"].as_str()),
        (Some("predata"), Some("2027-02-14"))
    );
    let e = call(
        &mut ws,
        &mm,
        "comanda_save",
        json!({"id": o["id"], "version": ver, "vehicul": car["id"], "data_intrare": "2026-11-13"}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("nu se mai schimbă"), "{e}");
    assert!(
        call(
            &mut ws,
            &mm,
            "comanda_stare",
            json!({"id": o["id"], "version": ver, "stare": "anulata", "motiv": "greșit"})
        )
        .is_err()
    );

    // A second order: a lower odometer is accepted but said; an empty order is not delivered; cancelled with a reason.
    let o2 = call(
        &mut ws,
        &mm,
        "comanda_save",
        json!({"vehicul": car["id"], "data_intrare": "2026-12-01", "km": 150_000}),
    )
    .unwrap();
    assert_eq!(o2["numar"], 2);
    assert!(
        o2["atentie"].as_str().unwrap().contains("152300 km"),
        "{}",
        o2["atentie"]
    );
    let mut v2 = o2["version"].as_u64().unwrap();
    for st in ["in_lucru", "gata"] {
        v2 = call(
            &mut ws,
            &mm,
            "comanda_stare",
            json!({"id": o2["id"], "version": v2, "stare": st}),
        )
        .unwrap()["version"]
            .as_u64()
            .unwrap();
    }
    let e = call(
        &mut ws,
        &mm,
        "comanda_stare",
        json!({"id": o2["id"], "version": v2, "stare": "predata", "data": "2026-12-02"}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("nicio linie"), "{e}");
    assert!(
        call(
            &mut ws,
            &mm,
            "comanda_stare",
            json!({"id": o2["id"], "version": v2, "stare": "anulata", "motiv": ""})
        )
        .is_err()
    );
    call(
        &mut ws,
        &mm,
        "comanda_stare",
        json!({"id": o2["id"], "version": v2, "stare": "anulata", "motiv": "clientul a renunțat"}),
    )
    .unwrap();

    // Lists and history.
    let open = call(&mut ws, &mm, "comenzi", json!({"stare": "deschise"})).unwrap();
    assert_eq!(open.as_array().unwrap().len(), 0);
    let all = call(&mut ws, &mm, "comenzi", json!({"text": "is 12"})).unwrap();
    assert_eq!(all.as_array().unwrap().len(), 2);
    let h = call(&mut ws, &mm, "vehicul", json!({"id": car["id"]})).unwrap();
    assert_eq!(
        (h["comenzi"].as_i64(), h["km_maxim"].as_i64()),
        (Some(2), Some(152_300))
    );
    assert_eq!(h["istoric"][0]["motiv_anulare"], "clientul a renunțat");
    let found = call(&mut ws, &mm, "vehicule", json!({"text": "logan"})).unwrap();
    assert_eq!(found.as_array().unwrap().len(), 1);

    // A car with history is not deleted; one without is.
    let e = call(
        &mut ws,
        &mm,
        "vehicul_delete",
        json!({"id": car["id"], "version": car["version"]}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("2 comenzi"), "{e}");
    let other = call(
        &mut ws,
        &mm,
        "vehicul_save",
        json!({"client_nume": "Ionescu", "nr": "CJ 99 ZZZ"}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "vehicul_delete",
        json!({"id": other["id"], "version": other["version"]}),
    )
    .unwrap();
    assert_eq!(
        call(&mut ws, &mm, "vehicule", json!({}))
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        1
    );
}
