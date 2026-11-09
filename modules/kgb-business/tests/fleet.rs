//! Step 7.4k-6: fleet and drivers — vehicles and drivers with documents that
//! expire; the list of what expires soon; reminders 30 and 7 days before, on
//! the day and weekly after, each once.

use kgb_business::{Business, ID};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

#[test]
fn vehicles_drivers_and_expiring_documents() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into(), "files.own".into()]).unwrap();

    let v = call(&mut ws, &mm, "vehicle_save", json!({"numar": " is-01-abc ", "marca": "Iveco", "model": "Daily", "an": 2019, "sofer": "Vasile Pop",
        "acte": [{"tip": "ITP", "expira": "2026-12-09"}, {"tip": "RCA", "numar": "RO/12/345", "emis": "2025-11-16", "expira": "16.11.2026"}]})).unwrap();
    assert_eq!(v["numar"], "IS-01-ABC");
    assert_eq!(v["acte"][1]["expira"], "2026-11-16", "dates in either form");
    let e = call(&mut ws, &mm, "vehicle_save", json!({"numar": "IS-01-ABC"})).unwrap_err().to_string();
    assert!(e.contains("există deja"), "{e}");
    assert!(call(&mut ws, &mm, "vehicle_save", json!({"numar": "B-1", "acte": [{"tip": "ITP", "expira": "31.02.2026"}]})).is_err());
    assert!(call(&mut ws, &mm, "vehicle_save", json!({"numar": "B-1", "acte": [{"tip": "ITP", "emis": "2026-12-01", "expira": "2026-11-01"}]})).unwrap_err().to_string().contains("înainte"));
    assert!(call(&mut ws, &mm, "vehicle_save", json!({"numar": "B-1", "an": 1800})).is_err());
    let d = call(&mut ws, &mm, "driver_save", json!({"nume": "Vasile Pop", "categorii": "B, C, CE",
        "acte": [{"tip": "Permis de conducere", "expira": "2026-11-09"}, {"tip": "Aviz medical", "expira": "2026-11-02"}]})).unwrap();
    // An inactive vehicle sends nothing.
    call(&mut ws, &mm, "vehicle_save", json!({"numar": "VS-99-OLD", "activ": false, "acte": [{"tip": "ITP", "expira": "2026-11-09"}]})).unwrap();

    let soon = call(&mut ws, &mm, "fleet_expiring", json!({"azi": "2026-11-09"})).unwrap();
    let rows: Vec<(String, String, i64)> = soon.as_array().unwrap().iter().map(|x| (x["nume"].as_str().unwrap().into(), x["tip"].as_str().unwrap().into(), x["zile"].as_i64().unwrap())).collect();
    assert_eq!(rows, vec![
        ("Vasile Pop".into(), "Aviz medical".into(), -7),
        ("Vasile Pop".into(), "Permis de conducere".into(), 0),
        ("IS-01-ABC".into(), "RCA".into(), 7),
        ("IS-01-ABC".into(), "ITP".into(), 30),
    ]);

    let n = mm.remind_all(&mut ws, "2026-11-09").unwrap();
    let titles: Vec<String> = n.iter().map(|x| x.titlu.clone()).collect();
    assert_eq!(titles.len(), 4, "{titles:?}");
    assert!(titles.contains(&"Expiră azi: Permis de conducere — Vasile Pop".to_string()), "{titles:?}");
    assert!(titles.contains(&"Expirat: Aviz medical — Vasile Pop".to_string()), "{titles:?}");
    assert!(titles.contains(&"Expiră în 7 zile: RCA — IS-01-ABC".to_string()), "{titles:?}");
    assert!(mm.remind_all(&mut ws, "2026-11-09").unwrap().is_empty(), "once");
    assert!(mm.remind_all(&mut ws, "2026-11-10").unwrap().is_empty(), "nothing on a day in between");

    // Renewed: the new date replaces the old one, no reminder for it.
    let mut acte = d["acte"].clone();
    acte[1]["expira"] = json!("2027-11-02");
    call(&mut ws, &mm, "driver_save", json!({"id": d["id"], "version": d["version"], "nume": "Vasile Pop", "acte": acte})).unwrap();
    let soon = call(&mut ws, &mm, "fleet_expiring", json!({"azi": "2026-11-09", "zile": 7})).unwrap();
    assert_eq!(soon.as_array().unwrap().len(), 2);
    assert_eq!(call(&mut ws, &mm, "vehicles", json!({})).unwrap().as_array().unwrap()[0]["numar"], "IS-01-ABC", "active first");
}
