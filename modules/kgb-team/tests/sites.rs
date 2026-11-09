//! Step 7.4m-7: work sites and the team leader's daily report — present
//! workers get their norm ± the extra hours from the site's start hour;
//! absent ones get nothing; a day already in the timesheet is not overwritten.

use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_team::{ID, Team};
use serde_json::{Value, json};

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Team::new())], kgb_core::CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "files.own".into()]).unwrap();
    (t, ws, mm)
}

#[test]
fn site_and_daily_report() {
    let (_t, mut ws, mm) = setup();
    let mut call = |cmd: &str, a: Value| mm.call(&mut ws, None, ID, cmd, a);
    let ankit = call("angajat_save", json!({"nume": "Ankit"})).unwrap()["id"].clone();
    let tahir = call("angajat_save", json!({"nume": "Tahir"})).unwrap()["id"].clone();
    let tofiq = call("angajat_save", json!({"nume": "Tofiq", "norma_min": 360})).unwrap()["id"].clone();
    let site = call("punct_save", json!({"nume": "Curte Iași", "sef": "Ion Pop", "inceput": "07:00", "angajati": [ankit, tahir, tofiq]})).unwrap()["id"].clone();
    assert!(call("punct_save", json!({"nume": "curte iași"})).unwrap_err().to_string().contains("există deja"));
    assert!(call("punct_save", json!({"nume": "X", "inceput": "7"})).is_err());
    let list = call("puncte", json!({})).unwrap();
    assert_eq!(list[0]["sef"], "Ion Pop");
    assert_eq!(list[0]["muncitori"].as_array().unwrap().len(), 3);

    // Tahir already has the day (entered at the office): left as it is.
    call("pontaj_save", json!({"angajat": tahir, "data": "2026-11-09", "intrare": "07:00", "iesire": "15:00"})).unwrap();
    let r = call("raport_zi", json!({"punct": site, "data": "2026-11-09", "de_la": "Ion Pop", "linii": [
        {"angajat": ankit, "nume": "Ankit", "prezent": true, "extra": 2},
        {"angajat": tahir, "nume": "Tahir", "prezent": true, "extra": 0},
        {"angajat": tofiq, "nume": "Tofiq", "prezent": false, "extra": 0},
    ]})).unwrap();
    assert_eq!(r, json!({"pontati": 1, "absenti": 1, "deja_pontati": ["Tahir"]}));
    let days = call("pontaj", json!({"luna": "2026-11"})).unwrap();
    let a = days.as_array().unwrap().iter().find(|d| d["angajat"] == ankit).unwrap();
    // 07:00 + 8 h + 2 h extra = 17:00, 600 minutes.
    assert_eq!((a["intrare"].as_str(), a["iesire"].as_str(), a["lucrat_min"].as_i64()), (Some("07:00"), Some("17:00"), Some(600)));
    assert!(a["nota"].as_str().unwrap().contains("+2 ore extra"), "{}", a["nota"]);
    assert!(!days.as_array().unwrap().iter().any(|d| d["angajat"] == tofiq), "absent: no day");

    // Fewer hours; limits.
    let r = call("raport_zi", json!({"punct": site, "data": "2026-11-10", "linii": [{"angajat": tofiq, "prezent": true, "extra": -2}]})).unwrap();
    assert_eq!(r["pontati"], 1);
    let days = call("pontaj", json!({"luna": "2026-11"})).unwrap();
    let t = days.as_array().unwrap().iter().find(|d| d["angajat"] == tofiq).unwrap();
    assert_eq!((t["iesire"].as_str(), t["lucrat_min"].as_i64()), (Some("11:00"), Some(240)), "6 h norm − 2 h");
    assert!(call("raport_zi", json!({"punct": site, "data": "2026-11-11", "linii": [{"angajat": ankit, "prezent": true, "extra": 13}]})).is_err());
    assert!(call("raport_zi", json!({"punct": site, "data": "2026-11-11", "linii": [{"angajat": tofiq, "prezent": true, "extra": -6}]})).is_err());
    assert!(call("raport_zi", json!({"punct": site, "data": "11.11.2026", "linii": [{"angajat": ankit, "prezent": true}]})).is_err());
}
