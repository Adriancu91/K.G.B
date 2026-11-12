//! Step 7.3: team and timesheet, with examples worked out by hand.
//! - worked time: 08:00–16:30 with 30 min break = 8:00; 22:00–06:00 (past
//!   midnight) with 30 min = 7:30; a break as long as the shift is refused;
//! - one record per employee per day; overtime above the daily norm;
//! - leave: overlapping requests refused; approved leave blocks pontaj on
//!   those days and counts working days (Mon–Fri) in the month;
//! - the monthly report and its XLSX export match the hand totals.

use calamine::{Data, Reader, Xlsx};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_team::{ID, Team, day_number, hm, weekday, worked};
use serde_json::{Value, json};

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Team::new())], kgb_core::CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "files.own".into()])
        .unwrap();
    (t, ws, mm)
}

fn call(mm: &ModuleManager, ws: &mut Workspace, cmd: &str, a: Value) -> Value {
    mm.call(ws, None, ID, cmd, a).unwrap_or_else(|e| panic!("{cmd}: {e}"))
}

#[test]
fn time_arithmetic() {
    assert_eq!(worked("08:00", "16:30", 30), Ok(480));
    assert_eq!(worked("22:00", "06:00", 30), Ok(450), "past midnight");
    assert_eq!(worked("07:15", "07:45", 0), Ok(30));
    assert!(worked("08:00", "09:00", 60).is_err(), "break as long as the shift");
    assert!(worked("8:00", "16:00", 0).is_err(), "HH:MM only");
    assert!(worked("08:00", "24:00", 0).is_err());
    assert_eq!(hm(570), "9:30");
    assert_eq!(weekday(day_number("2026-11-09").unwrap()), 0, "Monday");
    assert_eq!(weekday(day_number("2026-11-08").unwrap()), 6, "Sunday");
}

#[test]
fn timesheet_leave_and_monthly_report() {
    let (t, mut ws, mm) = setup();
    let ana = call(
        &mm,
        &mut ws,
        "angajat_save",
        json!({"nume": "Ana Test", "functie": "operator", "norma_min": 480}),
    )["id"]
        .clone();
    let ion = call(
        &mm,
        &mut ws,
        "angajat_save",
        json!({"nume": "Ion Test", "norma_min": 240}),
    )["id"]
        .clone();
    assert!(
        mm.call(&mut ws, None, ID, "angajat_save", json!({"nume": "ana test"}))
            .is_err(),
        "same name"
    );
    assert!(
        mm.call(&mut ws, None, ID, "angajat_save", json!({"nume": "X", "norma_min": 30}))
            .is_err(),
        "norm 1–12 h"
    );

    let day = |d: &str, a: &str, b: &str, p: i64| json!({"angajat": ana, "data": d, "intrare": a, "iesire": b, "pauza_min": p});
    assert_eq!(
        call(&mm, &mut ws, "pontaj_save", day("2026-11-02", "08:00", "16:30", 30))["lucrat_min"],
        480
    );
    let d3 = call(&mm, &mut ws, "pontaj_save", day("2026-11-03", "08:00", "18:00", 30));
    assert_eq!(d3["lucrat_min"], 570);
    call(&mm, &mut ws, "pontaj_save", day("2026-11-04", "22:00", "06:00", 30));
    // The same day twice: refused; changing it with its version: fine.
    let e = mm
        .call(
            &mut ws,
            None,
            ID,
            "pontaj_save",
            day("2026-11-02", "09:00", "17:00", 60),
        )
        .unwrap_err();
    assert!(e.to_string().contains("deja pontată"), "{e}");
    // A day entered by mistake, deleted, then entered again: allowed (the
    // owner hit this on 2026-11-12: „zice că am adăugat deja”).
    let w = call(&mm, &mut ws, "pontaj_save", day("2026-11-12", "07:00", "17:00", 0));
    call(&mm, &mut ws, "pontaj_delete", json!({"id": w["id"], "version": w["version"]}));
    let again = call(&mm, &mut ws, "pontaj_save", day("2026-11-12", "08:00", "16:00", 0));
    assert_eq!(again["lucrat_min"], 480);
    assert_eq!(again["id"], w["id"]);
    let e = mm
        .call(&mut ws, None, ID, "pontaj_save", day("2026-11-12", "08:00", "16:00", 0))
        .unwrap_err();
    assert!(e.to_string().contains("deja pontată"), "{e}");
    call(&mm, &mut ws, "pontaj_delete", json!({"id": again["id"], "version": again["version"]}));
    let mut fix = day("2026-11-03", "08:00", "18:00", 30);
    fix["version"] = d3["version"].clone();
    fix["nota"] = json!("corectat");
    call(&mm, &mut ws, "pontaj_save", fix);
    // Ion (4 h norm): 5 h = 1 h overtime.
    call(
        &mm,
        &mut ws,
        "pontaj_save",
        json!({"angajat": ion, "data": "2026-11-02", "intrare": "08:00", "iesire": "13:00"}),
    );

    // Leave: 5–11 Nov (Thu–Wed): Mon–Fri days are 5, 6, 9, 10, 11 = 5.
    let l = call(
        &mm,
        &mut ws,
        "concediu_cere",
        json!({"angajat": ana, "tip": "odihna", "de_la": "2026-11-05", "pana_la": "2026-11-11"}),
    )["id"]
        .clone();
    let e = mm
        .call(
            &mut ws,
            None,
            ID,
            "concediu_cere",
            json!({"angajat": ana, "tip": "alt", "de_la": "2026-11-10", "pana_la": "2026-11-12"}),
        )
        .unwrap_err();
    assert!(e.to_string().contains("se suprapune"), "{e}");
    let lv = call(&mm, &mut ws, "concedii", json!({}))[0].clone();
    call(
        &mm,
        &mut ws,
        "concediu_decide",
        json!({"id": l, "version": lv["version"], "stare": "aprobat"}),
    );
    assert!(
        mm.call(
            &mut ws,
            None,
            ID,
            "concediu_decide",
            json!({"id": l, "version": lv["version"], "stare": "respins"})
        )
        .is_err(),
        "decided once"
    );
    let e = mm
        .call(&mut ws, None, ID, "pontaj_save", day("2026-11-06", "08:00", "16:00", 0))
        .unwrap_err();
    assert!(e.to_string().contains("concediu aprobat"), "{e}");
    // A leave over days already worked cannot be approved.
    let l2 = call(
        &mm,
        &mut ws,
        "concediu_cere",
        json!({"angajat": ana, "tip": "medical", "de_la": "2026-11-02", "pana_la": "2026-11-02"}),
    )["id"]
        .clone();
    let v2 = call(&mm, &mut ws, "concedii", json!({}))
        .as_array()
        .unwrap()
        .iter()
        .find(|x| x["id"] == l2)
        .unwrap()["version"]
        .clone();
    let e = mm
        .call(
            &mut ws,
            None,
            ID,
            "concediu_decide",
            json!({"id": l2, "version": v2, "stare": "aprobat"}),
        )
        .unwrap_err();
    assert!(e.to_string().contains("zile pontate"), "{e}");

    // The month, by hand: Ana 480 + 570 + 450 = 1500 min, overtime 90; 5 leave days.
    let r = call(&mm, &mut ws, "raport", json!({"luna": "2026-11"}));
    let ana_r = r.as_array().unwrap().iter().find(|x| x["nume"] == "Ana Test").unwrap();
    assert_eq!(
        (
            ana_r["zile"].clone(),
            ana_r["lucrat_min"].clone(),
            ana_r["suplimentar_min"].clone()
        ),
        (json!(3), json!(1500), json!(90))
    );
    assert_eq!(ana_r["concediu"]["odihna"], 5);
    let ion_r = r.as_array().unwrap().iter().find(|x| x["nume"] == "Ion Test").unwrap();
    assert_eq!(
        (ion_r["lucrat_min"].clone(), ion_r["suplimentar_min"].clone()),
        (json!(300), json!(60))
    );
    // October is empty.
    let oct = call(&mm, &mut ws, "raport", json!({"luna": "2026-10"}));
    assert!(oct.as_array().unwrap().iter().all(|x| x["zile"] == 0));

    // XLSX export, read back.
    let dest = t.path().join("pontaj.xlsx");
    call(&mm, &mut ws, "raport_export", json!({"luna": "2026-11", "dest": dest}));
    let mut book: Xlsx<_> = calamine::open_workbook(&dest).unwrap();
    let sheet = book.worksheet_range("Pontaj 2026-11").unwrap();
    let rows: Vec<Vec<Data>> = sheet.rows().map(|r| r.to_vec()).collect();
    assert_eq!(rows[0][0], Data::String("Angajat".into()));
    let ana_row = rows.iter().find(|r| r[0] == Data::String("Ana Test".into())).unwrap();
    assert_eq!(ana_row[2], Data::Float(3.0));
    assert_eq!(ana_row[3], Data::String("25:00".into()));
    assert_eq!(ana_row[4], Data::String("1:30".into()));
    assert_eq!(ana_row[5], Data::Float(5.0));
}
