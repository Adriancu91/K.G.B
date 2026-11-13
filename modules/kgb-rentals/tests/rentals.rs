//! 8.17 Spații și chiriași: the exact split to the ban (figures computed by hand), overlapping leases refused, a
//! month's utilities split by people, area and equally with the free premises' part left to the owner, the month's
//! situation, a cancelled payment not counted and the arrears up to today.

use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_rentals::{ID, Rentals, months_between, split};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Rentals::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "partners.read".into()])
        .unwrap();
    (tmp, ws, mm)
}

#[test]
fn split_by_hand() {
    // 10,00 lei in three equal parts: 3,34 + 3,33 + 3,33 (the first gets the ban left).
    assert_eq!(split(1_000, &[3, 3, 3]).unwrap(), [334, 333, 333]);
    // 100,00 lei on 52,50 / 70,00 / 35,00 m²: 33,33 / 44,44 / 22,22 + 1 ban to the largest remainder (the second).
    assert_eq!(split(10_000, &[5_250, 7_000, 3_500]).unwrap(), [3_333, 4_445, 2_222]);
    assert_eq!(split(60_000, &[2, 3, 1]).unwrap(), [20_000, 30_000, 10_000]);
    assert!(split(500, &[0, 0]).is_none());
    assert_eq!(
        months_between("2026-09-01", "2026-11-13"),
        ["2026-09", "2026-10", "2026-11"]
    );
}

#[test]
fn premises_leases_utilities_payments() {
    let (_t, mut ws, mm) = setup();
    let ap1 = call(
        &mut ws,
        &mm,
        "spatiu_save",
        json!({"nume": "Ap. 1", "cladire": "Bloc A", "suprafata": 5_250, "persoane": 2}),
    )
    .unwrap();
    let ap2 = call(
        &mut ws,
        &mm,
        "spatiu_save",
        json!({"nume": "Ap. 2", "cladire": "Bloc A", "suprafata": 7_000, "persoane": 3}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "spatiu_save",
        json!({"nume": "Birou", "cladire": "Bloc A", "fel": "birou", "suprafata": 3_500, "persoane": 1}),
    )
    .unwrap();
    let e = call(
        &mut ws,
        &mm,
        "spatiu_save",
        json!({"nume": "ap. 1", "cladire": "bloc a"}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("există deja"), "{e}");

    let l1 = call(
        &mut ws,
        &mm,
        "inchiriere_save",
        json!({"spatiu": ap1["id"], "chirias_nume": "Popescu Ion", "de_la": "2026-09-01", "chirie": 150_000, "garantie": 150_000, "zi_plata": 5}),
    )
    .unwrap();
    let l2 = call(
        &mut ws,
        &mm,
        "inchiriere_save",
        json!({"spatiu": ap2["id"], "chirias_nume": "Ionescu SRL", "de_la": "2026-10-15", "chirie": 200_000}),
    )
    .unwrap();
    let e = call(
        &mut ws,
        &mm,
        "inchiriere_save",
        json!({"spatiu": ap1["id"], "chirias_nume": "Altcineva", "de_la": "2026-10-01", "pana_la": "2026-12-31", "chirie": 1}),
    )
    .unwrap_err();
    assert!(
        e.to_string().contains("se suprapune cu contractul lui Popescu Ion"),
        "{e}"
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "inchiriere_save",
            json!({"spatiu": ap1["id"], "de_la": "2027-01-01", "chirie": 1})
        )
        .is_err(),
        "no tenant"
    );

    // October's utilities: water 600 by people, cleaning 100 by area, administration 90 equally.
    for (fel, suma, cheie) in [
        ("Apă", 60_000, "persoane"),
        ("Curățenie", 10_000, "suprafata"),
        ("Administrare", 9_000, "egal"),
    ] {
        call(
            &mut ws,
            &mm,
            "utilitate_save",
            json!({"luna": "2026-10", "fel": fel, "suma": suma, "cheie": cheie}),
        )
        .unwrap();
    }
    let r = call(&mut ws, &mm, "repartizare", json!({"luna": "2026-10"})).unwrap();
    let total = |n: &str| {
        r["spatii"]
            .as_array()
            .unwrap()
            .iter()
            .find(|x| x["nume"] == n)
            .unwrap()
            .clone()
    };
    // Ap. 1: 200 + 33,33 + 30 = 263,33; Ap. 2: 300 + 44,45 + 30 = 374,45; the free office: 100 + 22,22 + 30 = 152,22.
    assert_eq!(total("Ap. 1")["total"], 26_333);
    assert_eq!(total("Ap. 2")["total"], 37_445);
    let office = total("Birou");
    assert_eq!(
        (office["total"].as_i64(), office["liber"].as_bool()),
        (Some(15_222), Some(true))
    );
    assert_eq!(26_333 + 37_445 + 15_222, 60_000 + 10_000 + 9_000);

    // Payments for October: Ap. 1 the whole 1.763,33; Ap. 2 the rent only; a wrong one cancelled.
    call(
        &mut ws,
        &mm,
        "incasare_save",
        json!({"inchiriere": l1["id"], "luna": "2026-10", "data": "2026-11-05", "suma": 176_333}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "incasare_save",
        json!({"inchiriere": l2["id"], "luna": "2026-10", "data": "2026-11-05", "suma": 200_000}),
    )
    .unwrap();
    let wrong = call(
        &mut ws,
        &mm,
        "incasare_save",
        json!({"inchiriere": l2["id"], "luna": "2026-10", "data": "2026-11-06", "suma": 37_445}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "incasare_anuleaza",
        json!({"id": wrong["id"], "version": wrong["version"], "motiv": "plată respinsă de bancă"}),
    )
    .unwrap();

    let s = call(&mut ws, &mm, "situatie", json!({"luna": "2026-10"})).unwrap();
    // 1.763,33 + 2.374,45 = 4.137,78 owed; 3.763,33 paid; 374,45 left; the owner carries 152,22.
    assert_eq!(
        (s["total"].as_i64(), s["incasat"].as_i64(), s["rest"].as_i64()),
        (Some(413_778), Some(376_333), Some(37_445))
    );
    assert_eq!(s["utilitati_proprietar"], 15_222);

    // Arrears on 13.11.2026 (no November utilities yet): Popescu Sep + Oct + Nov = 1.500 + 1.763,33 + 1.500 = 4.763,33,
    // paid 1.763,33, rest 3.000,00; Ionescu Oct + Nov = 2.374,45 + 2.000 = 4.374,45, paid 2.000, rest 2.374,45.
    let a = call(&mut ws, &mm, "restante", json!({"azi": "2026-11-13"})).unwrap();
    assert_eq!(a["total"], 537_445);
    assert_eq!(
        (
            a["restante"][0]["chirias_nume"].as_str(),
            a["restante"][0]["rest"].as_i64()
        ),
        (Some("Popescu Ion"), Some(300_000))
    );

    // Ending a lease frees the premises for a new one after it; a premises with leases is not deleted.
    call(
        &mut ws,
        &mm,
        "inchiriere_incheie",
        json!({"id": l1["id"], "version": l1["version"], "data": "2026-12-31"}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "inchiriere_save",
        json!({"spatiu": ap1["id"], "chirias_nume": "Noul chiriaș", "de_la": "2027-01-01", "chirie": 160_000}),
    )
    .unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "spatiu_delete",
            json!({"id": ap1["id"], "version": ap1["version"]})
        )
        .is_err()
    );
}
