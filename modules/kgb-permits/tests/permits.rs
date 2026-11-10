//! Step 7.2: permits and authorizations.
//! - a procedure without a dated official source is "neverificată", one not
//!   checked for a year "veche";
//! - a case file follows its procedure's documents and steps; only those can
//!   be ticked; mandatory ones still missing are counted;
//! - deadlines: reminders the day before, on the day and when late, once;
//! - documents attached to a case file come back out identical.

use base64::Engine;
use kgb_core::modules::ModuleManager;
use kgb_core::notifications;
use kgb_core::workspace::Workspace;
use kgb_permits::{ID, Permits, day_number};
use serde_json::{Value, json};

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Permits::new())], kgb_core::CORE_VERSION).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &["storage.own".into(), "files.own".into(), "notify.send".into()],
    )
    .unwrap();
    (t, ws, mm)
}

fn call(mm: &ModuleManager, ws: &mut Workspace, cmd: &str, a: Value) -> Value {
    mm.call(ws, None, ID, cmd, a).unwrap_or_else(|e| panic!("{cmd}: {e}"))
}

fn procedure(sources: Value) -> Value {
    json!({
        "titlu": "Autorizație de funcționare (exemplu de test)",
        "domeniu": "functionare",
        "institutie": "Primăria (exemplu)",
        "conditii": [{"text": "spațiu cu destinație comercială", "obligatoriu": true}, {"text": "aviz recomandat", "obligatoriu": false}],
        "documente": [{"nume": "cerere tip", "obligatoriu": true}, {"nume": "contract de închiriere", "obligatoriu": true}, {"nume": "schiță", "obligatoriu": false}],
        "pasi": ["depunere la registratură", "plata taxei"],
        "taxe": "conform hotărârii locale",
        "termen_legal": "30 de zile",
        "surse": sources
    })
}

#[test]
fn dates() {
    assert_eq!(day_number("1970-01-01"), Some(0));
    assert_eq!(
        day_number("2026-11-08").unwrap() - day_number("2025-11-08").unwrap(),
        365
    );
    assert_eq!(
        day_number("2028-03-01").unwrap() - day_number("2028-02-28").unwrap(),
        2,
        "leap year"
    );
    assert_eq!(day_number("2026-02-29"), None);
    assert_eq!(day_number("8.11.2026"), None);
}

#[test]
fn procedures_and_verification() {
    let (_t, mut ws, mm) = setup();
    let p1 = call(&mm, &mut ws, "procedura_save", procedure(json!([])))["id"].clone();
    let list = call(&mm, &mut ws, "proceduri", json!({"azi": "2026-11-08"}));
    assert_eq!(list[0]["stare_verificare"], "neverificata");

    let src = json!([{"titlu": "Pagina oficială (exemplu)", "url": "https://example.org/procedura", "verificat": "2026-11-01"}]);
    let mut p = procedure(src);
    p["id"] = p1.clone();
    p["version"] = list[0]["version"].clone();
    call(&mm, &mut ws, "procedura_save", p);
    let list = call(&mm, &mut ws, "proceduri", json!({"azi": "2026-11-08"}));
    assert_eq!(list[0]["stare_verificare"], "verificata");
    assert_eq!(list[0]["verificat"], "2026-11-01");
    let later = call(&mm, &mut ws, "proceduri", json!({"azi": "2027-12-01"}));
    assert_eq!(later[0]["stare_verificare"], "veche", "not checked for over a year");

    // Refused input.
    let mut bad = procedure(json!([{"titlu": "x", "url": "fara-link", "verificat": ""}]));
    assert!(mm.call(&mut ws, None, ID, "procedura_save", bad.clone()).is_err());
    bad = procedure(json!([]));
    bad["domeniu"] = json!("necunoscut");
    assert!(mm.call(&mut ws, None, ID, "procedura_save", bad).is_err());
    let mut bad = procedure(json!([{"titlu": "x", "url": "https://x.org", "verificat": "1.11.2026"}]));
    assert!(mm.call(&mut ws, None, ID, "procedura_save", bad.clone()).is_err());
    bad["surse"] = json!([]);
    bad["titlu"] = json!("  ");
    assert!(mm.call(&mut ws, None, ID, "procedura_save", bad).is_err());
}

#[test]
fn case_files_checklist_files_and_reminders() {
    let (t, mut ws, mm) = setup();
    let pid = call(&mm, &mut ws, "procedura_save", procedure(json!([])))["id"].clone();
    let e = mm
        .call(
            &mut ws,
            None,
            ID,
            "dosar_save",
            json!({"titlu": "Magazin X", "procedura": pid, "deschis": "2026-11-08", "termen": "2026-11-01"}),
        )
        .unwrap_err();
    assert!(e.to_string().contains("înaintea"), "{e}");
    let cid = call(
        &mm,
        &mut ws,
        "dosar_save",
        json!({"titlu": "Magazin X", "procedura": pid, "client": "Client test", "deschis": "2026-11-08", "termen": "2026-11-10"}),
    )["id"]
        .clone();
    let c = &call(&mm, &mut ws, "dosare", json!({"azi": "2026-11-08"}))[0];
    assert_eq!(c["elemente"].as_array().unwrap().len(), 5, "3 documents + 2 steps");
    assert_eq!(c["obligatorii_lipsa"], 4);
    assert_eq!(c["stare"], "deschis");

    // Tick a document; an unknown item is refused.
    let v = call(
        &mm,
        &mut ws,
        "dosar_bifeaza",
        json!({"id": cid, "version": c["version"], "cheie": "doc:0", "bifat": true}),
    )["version"]
        .clone();
    assert!(
        mm.call(
            &mut ws,
            None,
            ID,
            "dosar_bifeaza",
            json!({"id": cid, "version": v, "cheie": "doc:9", "bifat": true})
        )
        .is_err()
    );
    let c = &call(&mm, &mut ws, "dosare", json!({"azi": "2026-11-08"}))[0];
    assert_eq!(
        (c["gata"].clone(), c["obligatorii_lipsa"].clone()),
        (json!(1), json!(3))
    );
    // The procedure with a case file cannot be deleted.
    let p = &call(&mm, &mut ws, "proceduri", json!({}))[0];
    assert_eq!(p["dosare"], 1);
    assert!(
        mm.call(
            &mut ws,
            None,
            ID,
            "procedura_delete",
            json!({"id": pid, "version": p["version"]})
        )
        .is_err()
    );

    // Attach a document and save it back out, identical.
    let data: Vec<u8> = (0..50_000u32).map(|i| (i % 251) as u8).collect();
    let r = call(
        &mm,
        &mut ws,
        "dosar_fisier",
        json!({"id": cid, "version": c["version"], "name": "contract.pdf", "data": base64::engine::general_purpose::STANDARD.encode(&data)}),
    );
    let dest = t.path().join("iesire.pdf");
    call(
        &mm,
        &mut ws,
        "fisier_salveaza",
        json!({"fisier": r["fisier"], "dest": dest}),
    );
    assert_eq!(std::fs::read(&dest).unwrap(), data);
    assert!(
        mm.call(
            &mut ws,
            None,
            ID,
            "fisier_salveaza",
            json!({"fisier": r["fisier"], "dest": dest})
        )
        .is_err(),
        "no overwrite by default"
    );

    // Reminders: the day before, on the day, late — each once.
    let titles = |n: &[notifications::NotificationView]| n.iter().map(|x| x.titlu.clone()).collect::<Vec<_>>();
    assert!(mm.remind_all(&mut ws, "2026-11-08").unwrap().is_empty());
    assert_eq!(
        titles(&mm.remind_all(&mut ws, "2026-11-09").unwrap()),
        ["Mâine: dosarul „Magazin X”"]
    );
    assert!(mm.remind_all(&mut ws, "2026-11-09").unwrap().is_empty(), "once");
    assert_eq!(
        titles(&mm.remind_all(&mut ws, "2026-11-10").unwrap()),
        ["Azi: dosarul „Magazin X”"]
    );
    let late = &call(&mm, &mut ws, "dosare", json!({"azi": "2026-11-12"}))[0];
    assert_eq!(late["intarziat"], true);
    assert_eq!(
        titles(&mm.remind_all(&mut ws, "2026-11-12").unwrap()),
        ["Termen depășit: dosarul „Magazin X”"]
    );
    // Approved: no more reminders, not late.
    call(
        &mm,
        &mut ws,
        "dosar_stare",
        json!({"id": cid, "version": late["version"], "stare": "aprobat"}),
    );
    assert!(mm.remind_all(&mut ws, "2026-11-13").unwrap().is_empty());
    assert_eq!(
        call(&mm, &mut ws, "dosare", json!({"azi": "2026-11-13"}))[0]["intarziat"],
        false
    );
}

/// 7.9a (D-088): every procedure of the catalog can be added (it fits the module's rules), comes back with its
/// sources dated and verified, and is shown as added afterwards.
#[test]
fn every_catalog_procedure_can_be_added() {
    let (_t, mut ws, mm) = setup();
    let list = call(&mm, &mut ws, "catalog", json!({}));
    let keys: Vec<String> = list
        .as_array()
        .unwrap()
        .iter()
        .map(|e| e["cheie"].as_str().unwrap().to_string())
        .collect();
    assert!(keys.len() >= 19, "{} proceduri în catalog", keys.len());
    for k in &keys {
        call(&mm, &mut ws, "catalog_adauga", json!({"cheie": k}));
    }
    let procs = call(&mm, &mut ws, "proceduri", json!({"azi": "2026-11-10"}));
    assert_eq!(procs.as_array().unwrap().len(), keys.len());
    for p in procs.as_array().unwrap() {
        assert_eq!(p["stare_verificare"], "verificata", "{}", p["titlu"]);
    }
    let again = call(&mm, &mut ws, "catalog", json!({}));
    assert!(again.as_array().unwrap().iter().all(|e| e["adaugata"] == true));
    assert!(
        mm.call(&mut ws, None, ID, "catalog_adauga", json!({"cheie": "nu-exista"}))
            .is_err()
    );
}
