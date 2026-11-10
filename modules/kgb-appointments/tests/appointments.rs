//! 7.9e Programări: resources with their hours, services, appointments without overlaps on this PC, the free
//! times at the edges of the hours and around the lunch break, days off, states, the overlap that two PCs can make
//! offline (marked, not hidden), and reminders without names or phones, once a day.

use kgb_appointments::{APPOINTMENTS, Appointments, ID, local_now};
use kgb_core::modules::ModuleManager;
use kgb_core::notifications;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_store::{Fields, Write};
use serde_json::{Value, json};
use uuid::Uuid;

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Appointments::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into()]).unwrap();
    (tmp, ws, mm)
}

/// A doctor working Monday–Friday 08:00–12:00 and 13:00–17:00 (lunch 12–13), off on 2030-01-04.
fn doctor(ws: &mut Workspace, mm: &ModuleManager) -> Value {
    let week = ["08:00-12:00", "13:00-17:00"];
    call(ws, mm, "resursa_save", json!({"nume": "Dr. Ionescu", "fel": "persoana",
        "program": {"1": week, "2": week, "3": week, "4": week, "5": week, "6": [], "7": []}, "libere": ["2030-01-04"]}))
    .unwrap()
}

// 2030-01-01 is a Tuesday: far enough in the future for every test day.
const TUE: &str = "2030-01-01";

#[test]
fn free_times_overlaps_and_hours() {
    let (_t, mut ws, mm) = setup();
    let dr = doctor(&mut ws, &mm);
    let sv = call(&mut ws, &mm, "serviciu_save", json!({"nume": "Consultație", "durata": 30, "pret": 15000, "resurse": [dr["id"]]})).unwrap();

    let free = |ws: &mut Workspace| call(ws, &mm, "libere", json!({"data": TUE, "serviciu": sv["id"]})).unwrap()[0]["ore"].clone();
    let f = free(&mut ws);
    let f: Vec<&str> = f.as_array().unwrap().iter().map(|v| v.as_str().unwrap()).collect();
    assert_eq!(f.first(), Some(&"08:00"));
    assert!(f.contains(&"11:30") && !f.contains(&"11:35"), "30 minutes fit until 12:00, not after");
    assert!(!f.contains(&"12:00") && f.contains(&"13:00") && f.contains(&"16:30") && !f.contains(&"16:35"));

    let a = call(&mut ws, &mm, "programare_save", json!({"start": format!("{TUE}T09:00"), "resursa": dr["id"], "serviciu": sv["id"],
        "client": "Popescu Maria", "telefon": "0722 000 111"})).unwrap();
    assert_eq!(a["sfarsit"], "09:30");
    let e = call(&mut ws, &mm, "programare_save", json!({"start": format!("{TUE}T09:15"), "resursa": dr["id"], "serviciu": sv["id"], "client": "Ion"})).unwrap_err();
    assert!(e.to_string().contains("are deja o programare"), "{e}");
    let f = free(&mut ws);
    assert!(!f.as_array().unwrap().contains(&json!("09:00")) && !f.as_array().unwrap().contains(&json!("08:45")) && f.as_array().unwrap().contains(&json!("09:30")));

    // Outside the hours (lunch break, a day off, the weekend): only when the person confirms.
    for start in [format!("{TUE}T12:10"), "2030-01-04T09:00".to_string(), "2030-01-05T09:00".to_string()] {
        let e = call(&mut ws, &mm, "programare_save", json!({"start": start, "resursa": dr["id"], "durata": 20, "client": "Urgent"})).unwrap_err();
        assert!(e.to_string().contains("în afara programului"), "{e}");
    }
    call(&mut ws, &mm, "programare_save", json!({"start": format!("{TUE}T12:10"), "resursa": dr["id"], "durata": 20, "client": "Urgent", "in_afara_programului": true})).unwrap();
    assert!(call(&mut ws, &mm, "libere", json!({"data": "2030-01-04", "serviciu": sv["id"]})).unwrap()[0]["ore"].as_array().unwrap().is_empty());
    assert!(call(&mut ws, &mm, "programare_save", json!({"start": format!("{TUE}T23:50"), "resursa": dr["id"], "durata": 30, "client": "X", "in_afara_programului": true})).is_err(), "not into the next day");

    // A cancelled appointment frees its time; bringing it back is refused if the time was given meanwhile.
    let day = call(&mut ws, &mm, "zi", json!({"data": TUE})).unwrap();
    let first = day["programari"].as_array().unwrap().iter().find(|p| p["ora"] == "09:00").unwrap().clone();
    call(&mut ws, &mm, "programare_stare", json!({"id": first["id"], "version": first["version"], "stare": "anulat"})).unwrap();
    call(&mut ws, &mm, "programare_save", json!({"start": format!("{TUE}T09:00"), "resursa": dr["id"], "serviciu": sv["id"], "client": "Altcineva"})).unwrap();
    let again = call(&mut ws, &mm, "zi", json!({"data": TUE})).unwrap()["programari"].as_array().unwrap().iter().find(|p| p["id"] == first["id"]).unwrap().clone();
    let e = call(&mut ws, &mm, "programare_stare", json!({"id": again["id"], "version": again["version"], "stare": "programat"})).unwrap_err();
    assert!(e.to_string().contains("dată altcuiva"), "{e}");
    assert!(call(&mut ws, &mm, "programare_stare", json!({"id": again["id"], "version": again["version"], "stare": "plecat"})).is_err());

    // The client's history.
    let h = call(&mut ws, &mm, "cauta", json!({"text": "popescu"})).unwrap();
    assert_eq!(h.as_array().unwrap().len(), 1);
    assert_eq!(call(&mut ws, &mm, "cauta", json!({"text": "0722000"})).unwrap().as_array().unwrap().len(), 1);
}

#[test]
fn an_overlap_made_on_two_pcs_is_shown() {
    let (_t, mut ws, mm) = setup();
    let dr = doctor(&mut ws, &mm);
    // Two receptions offline, each booking 10:00 — written directly, as synchronisation brings them.
    for client in ["Recepția 1", "Recepția 2"] {
        let mut f = Fields::new();
        f.insert("start".into(), json!(format!("{TUE}T10:00")));
        f.insert("durata".into(), json!(30));
        f.insert("resursa".into(), json!(dr["id"]));
        f.insert("serviciu".into(), json!(""));
        f.insert("client".into(), json!(client));
        f.insert("telefon".into(), json!(""));
        f.insert("partener".into(), json!(""));
        f.insert("nota".into(), json!(""));
        f.insert("stare".into(), json!("programat"));
        f.insert("creat_ms".into(), json!(1));
        ws.store_mut()
            .write(vec![Write::put(&format!("mod.{ID}.{APPOINTMENTS}"), Uuid::now_v7(), f).expect(0)])
            .unwrap();
    }
    call(&mut ws, &mm, "programare_save", json!({"start": format!("{TUE}T11:00"), "resursa": dr["id"], "durata": 30, "client": "Fără grijă"})).unwrap();
    let day = call(&mut ws, &mm, "zi", json!({"data": TUE})).unwrap();
    let marks: Vec<(String, bool)> = day["programari"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| (p["client"].as_str().unwrap().to_string(), p["suprapusa"].as_bool().unwrap()))
        .collect();
    assert_eq!(marks, [("Recepția 1".into(), true), ("Recepția 2".into(), true), ("Fără grijă".into(), false)]);
    let week = call(&mut ws, &mm, "saptamana", json!({"de_la": "2029-12-31"})).unwrap();
    assert_eq!(week["programari"].as_array().unwrap().iter().filter(|p| p["suprapusa"] == true).count(), 2);
}

#[test]
fn reminders_without_names_once_a_day() {
    let (_t, mut ws, mm) = setup();
    let dr = doctor(&mut ws, &mm);
    let (today, minute) = local_now();
    let date = |d: i64| kgb_appointments::date_of(d);
    // Two tomorrow (whatever weekday: outside the hours is confirmed), one today unconfirmed.
    for (d, h, who) in [(today + 1, "09:00", "Ana Pop"), (today + 1, "10:00", "Ion Pop"), (today, "23:00", "Seara Tarziu")] {
        call(&mut ws, &mm, "programare_save", json!({"start": format!("{}T{h}", date(d)), "resursa": dr["id"], "durata": 30,
            "client": who, "telefon": "0700 123 456", "in_afara_programului": true})).unwrap();
    }
    let n = mm.remind_all(&mut ws, &date(today)).unwrap();
    let titles: Vec<&str> = n.iter().map(|x| x.titlu.as_str()).collect();
    assert!(titles.contains(&"Mâine: 2 programări"), "{titles:?}");
    if minute >= 7 * 60 {
        assert!(titles.contains(&"Azi: o programare neconfirmată"), "{titles:?}");
    }
    for x in &n {
        assert!(!x.titlu.contains("Pop") && !x.text.contains("Pop") && !x.text.contains("0700"), "no names or phones in a notice");
    }
    assert!(mm.remind_all(&mut ws, &date(today)).unwrap().is_empty(), "once a day");
    assert!(notifications::list(&ws, false, usize::MAX).unwrap().len() <= 2);
}
