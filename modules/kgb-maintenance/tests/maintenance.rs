//! 7.9e Mentenanța echipamentelor: equipment with a counter, a plan by days and one by counter, what is due
//! (overdue, soon, no reading), an intervention done moving it, a lower reading refused (and one from another PC
//! shown), the yearly costs with downtime, deleting only what has no history, reminders without names, once.

use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_maintenance::{ID, Maintenance, READINGS};
use kgb_store::{Fields, Write};
use serde_json::{Value, json};
use uuid::Uuid;

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Maintenance::new())], CORE_VERSION).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &["storage.own".into(), "notify.send".into(), "partners.read".into()],
    )
    .unwrap();
    (tmp, ws, mm)
}

const T: &str = "2030-06-01";

fn due_of<'a>(list: &'a Value, name: &str) -> &'a Value {
    list.as_array().unwrap().iter().find(|d| d["denumire"] == name).unwrap()
}

#[test]
fn plans_due_interventions_and_readings() {
    let (_t, mut ws, mm) = setup();
    let e = call(
        &mut ws,
        &mm,
        "echipament_save",
        json!({"nume": "Stivuitor 2", "categorie": "utilaj", "contor_unitate": "ore",
        "serie": "ST-7781", "garantie_pana": "2030-06-20"}),
    )
    .unwrap();
    let eid = e["id"].clone();
    // A legal check every 365 days (the person's own text), an oil change every 250 hours.
    call(
        &mut ws,
        &mm,
        "plan_save",
        json!({"echipament": eid, "denumire": "Verificare anuală", "fel": "verificare_legala",
        "la_zile": 365, "de_la": "2029-06-10"}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "plan_save",
        json!({"echipament": eid, "denumire": "Schimb ulei", "fel": "preventiv",
        "la_contor": 250, "de_la": "2030-01-01"}),
    )
    .unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "plan_save",
            json!({"echipament": eid, "denumire": "Nimic", "fel": "preventiv", "de_la": T})
        )
        .is_err(),
        "no interval"
    );

    let due = call(&mut ws, &mm, "scadente", json!({"azi": T})).unwrap();
    assert_eq!(due_of(&due, "Verificare anuală")["stare"], "curand");
    assert_eq!(due_of(&due, "Verificare anuală")["urmatoarea_data"], "2030-06-10");
    assert_eq!(
        due_of(&due, "Schimb ulei")["stare"],
        "fara_citire",
        "no reading: not ok"
    );

    // Readings: 240 hours (soon, within 10% of 250), then a lower one refused.
    call(
        &mut ws,
        &mm,
        "citire_save",
        json!({"echipament": eid, "data": "2030-05-30", "valoare": 240}),
    )
    .unwrap();
    let e2 = call(
        &mut ws,
        &mm,
        "citire_save",
        json!({"echipament": eid, "data": "2030-05-31", "valoare": 200}),
    )
    .unwrap_err();
    assert!(e2.to_string().contains("mai mică"), "{e2}");
    let due = call(&mut ws, &mm, "scadente", json!({"azi": T})).unwrap();
    let oil = due_of(&due, "Schimb ulei");
    assert_eq!(
        (
            oil["stare"].as_str(),
            oil["din"].as_str(),
            oil["urmatorul_contor"].as_i64()
        ),
        (Some("curand"), Some("contor"), Some(250))
    );

    // The oil changed at 255 hours: the next one at 505, the reading recorded too.
    let plans = call(&mut ws, &mm, "echipament", json!({"id": eid, "azi": T})).unwrap()["planuri"].clone();
    let oil_plan = plans
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["denumire"] == "Schimb ulei")
        .unwrap()["id"]
        .clone();
    assert!(
        call(
            &mut ws,
            &mm,
            "interventie_save",
            json!({"echipament": eid, "plan": oil_plan, "fel": "planificata",
        "data": "2030-06-02", "stare": "facuta", "azi": T})
        )
        .is_err(),
        "done in the future"
    );
    call(
        &mut ws,
        &mm,
        "interventie_save",
        json!({"echipament": eid, "plan": oil_plan, "fel": "planificata", "data": T,
        "stare": "facuta", "contor": 255, "cost": 45_000, "oprire_ore": 2, "cine": "Service Auto", "azi": T}),
    )
    .unwrap();
    let due = call(&mut ws, &mm, "scadente", json!({"azi": T})).unwrap();
    assert_eq!(due_of(&due, "Schimb ulei")["urmatorul_contor"], 505);
    assert_eq!(due_of(&due, "Schimb ulei")["contor_actual"], 255);
    assert_eq!(due_of(&due, "Schimb ulei")["stare"], "ok");

    // A repair of a broken machine: the page is asked to propose „functional”.
    let one = call(&mut ws, &mm, "echipament", json!({"id": eid, "azi": T})).unwrap();
    call(
        &mut ws,
        &mm,
        "echipament_stare",
        json!({"id": eid, "version": one["version"], "stare": "defect"}),
    )
    .unwrap();
    let r = call(
        &mut ws,
        &mm,
        "interventie_save",
        json!({"echipament": eid, "fel": "reparatie", "data": T, "stare": "facuta",
        "cost": 120_000, "oprire_ore": 16, "descriere": "Pompă hidraulică", "azi": T}),
    )
    .unwrap();
    assert_eq!(r["propune_functional"], true);

    // A lower reading that came from another PC is shown, not hidden.
    let mut f = Fields::new();
    f.insert("echipament".into(), json!(eid));
    f.insert("data".into(), json!("2030-06-01"));
    f.insert("valoare".into(), json!(100));
    f.insert("creat_ms".into(), json!(9_999_999_999_999_i64));
    ws.store_mut()
        .write(vec![
            Write::put(&format!("mod.{ID}.{READINGS}"), Uuid::now_v7(), f).expect(0),
        ])
        .unwrap();
    let one = call(&mut ws, &mm, "echipament", json!({"id": eid, "azi": T})).unwrap();
    assert!(
        one["citiri"]
            .as_array()
            .unwrap()
            .iter()
            .any(|c| c["valoare"] == 100 && c["mai_mica"] == true)
    );
    assert_eq!(one["cost_an"], 165_000);
    assert_eq!(one["oprire_an"], 18);

    let costs = call(&mut ws, &mm, "costuri", json!({"an": 2030})).unwrap();
    assert_eq!(costs["total"], 165_000);
    assert_eq!(costs["echipamente"][0]["reparatii"], 1);
    assert_eq!(costs["echipamente"][0]["oprire_ore"], 18);

    // With history: not deleted (marked „scos”), and a plan with interventions is stopped, not deleted.
    assert!(
        call(
            &mut ws,
            &mm,
            "echipament_delete",
            json!({"id": eid, "version": one["version"]})
        )
        .is_err()
    );
    let p = one["planuri"]
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["denumire"] == "Schimb ulei")
        .unwrap()
        .clone();
    assert!(
        call(
            &mut ws,
            &mm,
            "plan_delete",
            json!({"id": p["id"], "version": p["version"]})
        )
        .is_err()
    );
    // A plan on a counter for equipment without one is refused.
    let x = call(
        &mut ws,
        &mm,
        "echipament_save",
        json!({"nume": "Cuptor", "categorie": "aparat"}),
    )
    .unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "plan_save",
            json!({"echipament": x["id"], "denumire": "Revizie", "fel": "preventiv", "la_contor": 100, "de_la": T})
        )
        .is_err()
    );
    let one = call(&mut ws, &mm, "echipament", json!({"id": x["id"], "azi": T})).unwrap();
    call(
        &mut ws,
        &mm,
        "echipament_delete",
        json!({"id": x["id"], "version": one["version"]}),
    )
    .unwrap();
}

#[test]
fn reminders_without_names_once() {
    let (_t, mut ws, mm) = setup();
    let e = call(
        &mut ws,
        &mm,
        "echipament_save",
        json!({"nume": "Centrala Secretă", "categorie": "instalatie",
        "garantie_pana": "2030-06-15"}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "plan_save",
        json!({"echipament": e["id"], "denumire": "Revizie", "fel": "preventiv", "la_zile": 30, "de_la": "2030-04-01"}),
    )
    .unwrap();
    call(&mut ws, &mm, "plan_save", json!({"echipament": e["id"], "denumire": "Curățare", "fel": "preventiv", "la_zile": 30, "de_la": "2030-05-10"})).unwrap();
    let n = mm.remind_all(&mut ws, T).unwrap();
    let titles: Vec<&str> = n.iter().map(|x| x.titlu.as_str()).collect();
    assert!(titles.contains(&"O mentenanță depășită"), "{titles:?}");
    assert!(titles.contains(&"O mentenanță în curând"), "{titles:?}");
    assert!(titles.contains(&"O garanție expiră în 30 de zile"), "{titles:?}");
    for x in &n {
        assert!(!x.titlu.contains("Secret") && !x.text.contains("Secret") && !x.text.contains("Revizie"));
    }
    assert!(mm.remind_all(&mut ws, T).unwrap().is_empty(), "once");
}
