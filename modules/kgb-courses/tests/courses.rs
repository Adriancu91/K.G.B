//! 8.17 Cursuri și cursanți: the sessions of a month from the schedule, what is owed per month and per course with
//! the figures computed by hand, a full group refusing a third trainee until one leaves, a second enrolment in the
//! same group refused, attendance kept once per day (an extra day said so, a trainee not enrolled that day refused),
//! a cancelled payment not counted, the arrears, deleting only what has no enrolments.

use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_courses::{Courses, ID, day_number, owed, sessions, weekday};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Courses::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into()]).unwrap();
    (tmp, ws, mm)
}

const TODAY: &str = "2026-11-13";

#[test]
fn calendar_and_money_by_hand() {
    // 13.11.2026 is a Friday; 1.11.2026 a Sunday; 15.09.2026 a Tuesday.
    assert_eq!(weekday(day_number(TODAY).unwrap()), 5);
    assert_eq!(weekday(day_number("2026-11-01").unwrap()), 7);
    assert_eq!(weekday(day_number("2026-09-15").unwrap()), 2);
    // Tuesdays and Thursdays of November 2026: 3, 5, 10, 12, 17, 19, 24, 26.
    let nov = sessions("2026-11", "2026-09-15", "2027-06-15", &[2, 4]);
    assert_eq!(
        nov,
        [
            "2026-11-03",
            "2026-11-05",
            "2026-11-10",
            "2026-11-12",
            "2026-11-17",
            "2026-11-19",
            "2026-11-24",
            "2026-11-26"
        ]
    );
    // September from the 15th: 15, 17, 22, 24, 29.
    assert_eq!(sessions("2026-09", "2026-09-15", "2027-06-15", &[2, 4]).len(), 5);
    // Per month: September, October and November touched = 3 × 250,00 lei.
    assert_eq!(
        owed(true, 25_000, ["2026-09-20", "2026-09-15"], [TODAY, "2027-06-15", TODAY]),
        75_000
    );
    // Left on 20.10: October only.
    assert_eq!(
        owed(
            true,
            20_000,
            ["2026-10-01", "2026-09-15"],
            ["2026-10-20", "2027-06-15", TODAY]
        ),
        20_000
    );
    // Per course: once; not yet started: nothing.
    assert_eq!(
        owed(
            false,
            60_000,
            ["2026-11-02", "2026-11-02"],
            [TODAY, "2026-11-27", TODAY]
        ),
        60_000
    );
    assert_eq!(
        owed(
            false,
            60_000,
            ["2026-11-20", "2026-11-02"],
            [TODAY, "2026-11-27", TODAY]
        ),
        0
    );
}

#[test]
fn groups_enrolments_attendance_payments() {
    let (_t, mut ws, mm) = setup();
    let g = call(
        &mut ws,
        &mm,
        "grupa_save",
        json!({"nume": "Engleză copii A1", "fel": "grupa", "formator": "Maria Pop", "de_la": "2026-09-15", "pana_la": "2027-06-15",
            "zile": [4, 2, 2], "ora": "17:00", "capacitate": 2, "taxa_fel": "lunar", "taxa": 25_000}),
    )
    .unwrap();
    for (bad, why) in [
        (
            json!({"nume": "X", "de_la": "2026-09-15", "pana_la": "2026-09-01", "zile": [1], "ora": "10:00"}),
            "înainte să înceapă",
        ),
        (
            json!({"nume": "X", "de_la": "2026-09-15", "pana_la": "2026-12-01", "zile": [], "ora": "10:00"}),
            "cel puțin o zi",
        ),
        (
            json!({"nume": "X", "de_la": "2026-09-15", "pana_la": "2026-12-01", "zile": [8], "ora": "10:00"}),
            "cel puțin o zi",
        ),
        (
            json!({"nume": "X", "de_la": "2026-09-15", "pana_la": "2026-12-01", "zile": [1], "ora": "25:00"}),
            "HH:MM",
        ),
    ] {
        let e = call(&mut ws, &mm, "grupa_save", bad).unwrap_err();
        assert!(e.to_string().contains(why), "{e}");
    }
    let ana = call(
        &mut ws,
        &mm,
        "cursant_save",
        json!({"nume": "Ana Ionescu", "tutore": "Elena Ionescu", "telefon": "0744 111 222"}),
    )
    .unwrap();
    let mihai = call(&mut ws, &mm, "cursant_save", json!({"nume": "Mihai Radu"})).unwrap();
    let ioana = call(&mut ws, &mm, "cursant_save", json!({"nume": "Ioana Matei"})).unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "cursant_save",
            json!({"nume": "X", "email": "nu-e-adresa"})
        )
        .is_err()
    );

    let ea = call(
        &mut ws,
        &mm,
        "inscrie",
        json!({"grupa": g["id"], "cursant": ana["id"], "de_la": "2026-09-20"}),
    )
    .unwrap();
    let e = call(
        &mut ws,
        &mm,
        "inscrie",
        json!({"grupa": g["id"], "cursant": ana["id"], "de_la": "2026-10-01"}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("e deja înscris"), "{e}");
    let em = call(
        &mut ws,
        &mm,
        "inscrie",
        json!({"grupa": g["id"], "cursant": mihai["id"], "de_la": "2026-10-01", "taxa": 20_000}),
    )
    .unwrap();
    let e = call(
        &mut ws,
        &mm,
        "inscrie",
        json!({"grupa": g["id"], "cursant": ioana["id"], "de_la": "2026-10-05"}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("e plină (2 locuri)"), "{e}");
    call(
        &mut ws,
        &mm,
        "retrage",
        json!({"id": em["id"], "version": em["version"], "data": "2026-10-20"}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "inscrie",
        json!({"grupa": g["id"], "cursant": ioana["id"], "de_la": "2026-11-20"}),
    )
    .unwrap();

    // Attendance: a planned Tuesday, an extra Wednesday; Mihai (left in October) is refused on 10.11.
    let first = call(
        &mut ws,
        &mm,
        "prezenta_save",
        json!({"grupa": g["id"], "data": "2026-11-10", "prezenti": [ana["id"]]}),
    )
    .unwrap();
    assert_eq!(first["extra"], false);
    let e = call(
        &mut ws,
        &mm,
        "prezenta_save",
        json!({"grupa": g["id"], "data": "2026-11-10", "prezenti": [ana["id"], mihai["id"]]}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("Mihai Radu nu era înscris"), "{e}");
    let r = call(
        &mut ws,
        &mm,
        "prezenta_save",
        json!({"grupa": g["id"], "data": "2026-11-11", "prezenti": []}),
    )
    .unwrap();
    assert_eq!(r["extra"], true);
    let e = call(
        &mut ws,
        &mm,
        "prezenta_save",
        json!({"grupa": g["id"], "data": "2026-11-12", "prezenti": [ana["id"]], "tinuta": false}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("nu s-a ținut"), "{e}");
    // The same day again updates the record, never a second one.
    let again = call(
        &mut ws,
        &mm,
        "prezenta_save",
        json!({"grupa": g["id"], "data": "2026-11-10", "prezenti": [ana["id"]], "nota": "recapitulare"}),
    )
    .unwrap();
    assert_eq!(
        (again["id"].clone(), again["version"].as_u64()),
        (first["id"].clone(), Some(first["version"].as_u64().unwrap() + 1))
    );

    // Payments: 250 + 250 lei, a third one of 250 cancelled.
    let p1 = call(
        &mut ws,
        &mm,
        "plata_save",
        json!({"inscriere": ea["id"], "data": "2026-09-20", "suma": 25_000, "fel": "card"}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "plata_save",
        json!({"inscriere": ea["id"], "data": "2026-10-05", "suma": 25_000}),
    )
    .unwrap();
    let wrong = call(
        &mut ws,
        &mm,
        "plata_save",
        json!({"inscriere": ea["id"], "data": "2026-11-05", "suma": 25_000}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "plata_anuleaza",
        json!({"id": wrong["id"], "version": wrong["version"], "motiv": "trecută de două ori"}),
    )
    .unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "plata_anuleaza",
            json!({"id": p1["id"], "version": p1["version"], "motiv": "x"})
        )
        .is_err(),
        "short reason"
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "plata_save",
            json!({"inscriere": ea["id"], "data": "2026-11-05", "suma": 0})
        )
        .is_err()
    );

    // A per-course group.
    let x = call(
        &mut ws,
        &mm,
        "grupa_save",
        json!({"nume": "Curs Excel", "de_la": "2026-11-02", "pana_la": "2026-11-27", "zile": [1, 3], "ora": "18:30", "taxa_fel": "curs", "taxa": 60_000}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "inscrie",
        json!({"grupa": x["id"], "cursant": ana["id"], "de_la": "2026-11-02"}),
    )
    .unwrap();

    // The group's November: 8 planned sessions + the extra Wednesday; Ana 2 held, present at 1; owes 750, paid 500.
    let d = call(
        &mut ws,
        &mm,
        "grupa",
        json!({"id": g["id"], "azi": TODAY, "luna": "2026-11"}),
    )
    .unwrap();
    assert_eq!(d["sedinte_luna"].as_array().unwrap().len(), 9);
    assert_eq!(d["inscrisi"], 2);
    let a = d["cursanti"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["nume"] == "Ana Ionescu")
        .unwrap();
    assert_eq!((a["sedinte"].as_i64(), a["prezent"].as_i64()), (Some(2), Some(1)));
    assert_eq!(
        (a["datorat"].as_i64(), a["platit"].as_i64(), a["rest"].as_i64()),
        (Some(75_000), Some(50_000), Some(25_000))
    );
    let m = d["cursanti"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["nume"] == "Mihai Radu")
        .unwrap();
    assert_eq!(
        (m["stare"].as_str(), m["datorat"].as_i64()),
        (Some("retras"), Some(20_000))
    );
    let io = d["cursanti"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["nume"] == "Ioana Matei")
        .unwrap();
    assert_eq!(io["datorat"], 0, "starts after today");

    // Arrears: Ana 250 + Mihai 200 + Ana's Excel course 600 = 1.050,00 lei.
    let r = call(&mut ws, &mm, "restante", json!({"azi": TODAY})).unwrap();
    assert_eq!(r["total"], 105_000);
    assert_eq!(r["restante"].as_array().unwrap().len(), 3);
    assert_eq!(r["restante"][0]["grupa_nume"], "Curs Excel");

    // Deleting only what has no enrolments.
    assert!(
        call(
            &mut ws,
            &mm,
            "grupa_delete",
            json!({"id": g["id"], "version": g["version"]})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "cursant_delete",
            json!({"id": ana["id"], "version": ana["version"]})
        )
        .is_err()
    );
    let free = call(&mut ws, &mm, "cursant_save", json!({"nume": "De șters"})).unwrap();
    call(
        &mut ws,
        &mm,
        "cursant_delete",
        json!({"id": free["id"], "version": free["version"]}),
    )
    .unwrap();
    assert_eq!(
        call(&mut ws, &mm, "cursanti", json!({"text": "ionescu"}))
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        1,
        "by tutor too"
    );
}
