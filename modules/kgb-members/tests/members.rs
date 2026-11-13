//! 8.17 Membri și cotizații: what a member owes per year with a yearly and a monthly rate (figures computed by hand),
//! a category's own rate winning over the general one, a duplicate rate refused, leaving the association, a cancelled
//! payment not counted, the year's situation, a meeting counting only who was a member that day, deleting only a
//! member without payments or meetings.

use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_members::{ID, Members, owed_for_year};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Members::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into()]).unwrap();
    (tmp, ws, mm)
}

const TODAY: &str = "2026-11-13";

#[test]
fn owed_by_hand() {
    // Yearly: once, if a member any day of the year up to today.
    assert_eq!(owed_for_year(2026, false, 12_000, "2025-03-10", "", TODAY), 12_000);
    assert_eq!(
        owed_for_year(2026, false, 12_000, "2026-01-01", "2026-06-30", TODAY),
        12_000
    );
    assert_eq!(owed_for_year(2026, false, 12_000, "2027-01-05", "", TODAY), 0);
    assert_eq!(owed_for_year(2026, false, 12_000, "2024-01-01", "2025-05-01", TODAY), 0);
    // Monthly from 15.02 to today (November): February … November = 10 months × 5,00 lei.
    assert_eq!(owed_for_year(2026, true, 500, "2026-02-15", "", TODAY), 5_000);
    // A past year is counted to 31 December.
    assert_eq!(owed_for_year(2025, true, 500, "2025-03-10", "", TODAY), 5_000);
}

#[test]
fn members_rates_payments_situation_meetings() {
    let (_t, mut ws, mm) = setup();
    call(&mut ws, &mm, "tarif_save", json!({"an": 2026, "suma": 12_000})).unwrap();
    call(
        &mut ws,
        &mm,
        "tarif_save",
        json!({"an": 2026, "categorie": "student", "suma": 500, "perioada": "lunar"}),
    )
    .unwrap();
    call(&mut ws, &mm, "tarif_save", json!({"an": 2025, "suma": 10_000})).unwrap();
    let e = call(&mut ws, &mm, "tarif_save", json!({"an": 2026, "suma": 1})).unwrap_err();
    assert!(e.to_string().contains("pentru toți membrii în 2026 există deja"), "{e}");
    let e = call(
        &mut ws,
        &mm,
        "tarif_save",
        json!({"an": 2026, "categorie": "Student", "suma": 1}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("există deja"), "{e}");

    let ion = call(
        &mut ws,
        &mm,
        "membru_save",
        json!({"nume": "Ion Popa", "intrat": "2025-03-10"}),
    )
    .unwrap();
    let maria = call(
        &mut ws,
        &mm,
        "membru_save",
        json!({"nume": "Maria Dobre", "categorie": "student", "intrat": "2026-02-15"}),
    )
    .unwrap();
    let firma = call(
        &mut ws,
        &mm,
        "membru_save",
        json!({"nume": "Firma Sponsor SRL", "fel": "firma", "intrat": "2026-01-01"}),
    )
    .unwrap();
    let vasile = call(
        &mut ws,
        &mm,
        "membru_save",
        json!({"nume": "Vasile Nou", "intrat": "2027-01-05"}),
    )
    .unwrap();
    let ana = call(
        &mut ws,
        &mm,
        "membru_save",
        json!({"nume": "Ana Veche", "intrat": "2024-01-01"}),
    )
    .unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "membru_save",
            json!({"nume": "X", "intrat": "2026-13-01"})
        )
        .is_err()
    );
    call(
        &mut ws,
        &mm,
        "membru_iesire",
        json!({"id": firma["id"], "version": firma["version"], "stare": "retras", "data": "2026-06-30"}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "membru_iesire",
        json!({"id": ana["id"], "version": ana["version"], "stare": "exclus", "data": "2025-05-01"}),
    )
    .unwrap();
    let e = call(
        &mut ws,
        &mm,
        "membru_iesire",
        json!({"id": vasile["id"], "version": vasile["version"], "stare": "retras", "data": "2026-01-01"}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("înaintea intrării"), "{e}");

    for (who, an, suma) in [(&ion, 2025, 10_000), (&ion, 2026, 6_000), (&firma, 2026, 12_000)] {
        call(
            &mut ws,
            &mm,
            "plata_save",
            json!({"membru": who["id"], "an": an, "data": "2026-03-01", "suma": suma}),
        )
        .unwrap();
    }
    let wrong = call(
        &mut ws,
        &mm,
        "plata_save",
        json!({"membru": maria["id"], "an": 2026, "data": "2026-03-01", "suma": 5_000}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "plata_anuleaza",
        json!({"id": wrong["id"], "version": wrong["version"], "motiv": "alt membru"}),
    )
    .unwrap();

    // 2026: Ion 120 (paid 60), Maria 10 × 5 = 50 (paid 0), the firm 120 (paid); Vasile and Ana are not in 2026.
    let s = call(&mut ws, &mm, "situatie", json!({"an": 2026, "azi": TODAY})).unwrap();
    assert_eq!(
        (s["datorat"].as_i64(), s["platit"].as_i64(), s["rest"].as_i64()),
        (Some(29_000), Some(18_000), Some(11_000))
    );
    assert_eq!(
        (s["cu_restante"].as_i64(), s["membri"].as_array().unwrap().len()),
        (Some(2), 3)
    );
    assert_eq!(s["membri"][0]["nume"], "Ion Popa");
    let m = s["membri"]
        .as_array()
        .unwrap()
        .iter()
        .find(|m| m["nume"] == "Maria Dobre")
        .unwrap();
    assert_eq!(
        (m["datorat"].as_i64(), m["perioada"].as_str()),
        (Some(5_000), Some("lunar"))
    );

    let one = call(&mut ws, &mm, "membru", json!({"id": ion["id"], "azi": TODAY})).unwrap();
    assert_eq!(one["ani"].as_array().unwrap().len(), 2);
    assert_eq!(
        (one["ani"][0]["an"].as_i64(), one["ani"][0]["rest"].as_i64()),
        (Some(2026), Some(6_000))
    );
    assert_eq!(one["ani"][1]["rest"], 0);

    // A meeting: only who was a member that day.
    let e = call(
        &mut ws,
        &mm,
        "sedinta_save",
        json!({"data": "2026-10-10", "prezenti": [ion["id"], firma["id"]]}),
    )
    .unwrap_err();
    assert!(
        e.to_string().contains("Firma Sponsor SRL nu era membru la 2026-10-10"),
        "{e}"
    );
    let r = call(
        &mut ws,
        &mm,
        "sedinta_save",
        json!({"data": "2026-10-10", "ordine_de_zi": "1. Bugetul pe 2027", "prezenti": [ion["id"], maria["id"]], "hotarari": "Bugetul se aprobă."}),
    )
    .unwrap();
    assert_eq!(
        (r["prezenti"].as_i64(), r["membri_activi"].as_i64()),
        (Some(2), Some(2))
    );

    // Deleting: not with payments or meetings.
    let e = call(
        &mut ws,
        &mm,
        "membru_delete",
        json!({"id": ion["id"], "version": ion["version"]}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("marchează-l retras"), "{e}");
    call(
        &mut ws,
        &mm,
        "membru_delete",
        json!({"id": vasile["id"], "version": vasile["version"]}),
    )
    .unwrap();
    assert_eq!(
        call(&mut ws, &mm, "membri", json!({"stare": "activ"}))
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        2
    );
}
