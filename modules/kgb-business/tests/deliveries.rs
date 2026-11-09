//! Step 7.4k-4: tracked deliveries — stages only in order; each needs its
//! fields; the client's confirmed quantity on every line, a difference kept;
//! cancelled only before delivery, with a reason; made from an approved order.

use kgb_business::{Business, ID, deliveries};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

#[test]
fn delivery_stages_fields_and_confirmation() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into(), "files.own".into()]).unwrap();
    call(&mut ws, &mm, "settings_save", json!({"firma": {"firma_nume": "Noi SRL", "firma_cui": "RO18547290"}})).unwrap();
    let client = call(&mut ws, &mm, "partner_save", json!({"nume": "Client SRL", "tip": "client"})).unwrap();
    let order = call(&mut ws, &mm, "order_save", json!({"tip": "vanzare", "partener": client["id"], "data": "2026-11-09",
        "linii": [{"descriere": "Ciment", "um": "sac", "cantitate": "60", "pret_unitar": "40", "cota_tva": 21}, {"descriere": "Var", "um": "sac", "cantitate": "10", "pret_unitar": "20", "cota_tva": 21}]})).unwrap();
    let new_from_order = |ws: &mut Workspace| call(ws, &mm, "delivery_save", json!({"comanda": order["id"], "adresa": "Str. Șantierului 1, Iași", "data": "2026-11-10"}));
    assert!(new_from_order(&mut ws).unwrap_err().to_string().contains("aprobată"), "a draft order is not delivered");
    for st in ["asteapta", "aprobata"] {
        call(&mut ws, &mm, "order_move", json!({"id": order["id"], "stare": st})).unwrap();
    }
    let d = new_from_order(&mut ws).unwrap();
    assert_eq!(d["numar"], "LIV 1");
    let step = |ws: &mut Workspace, etapa: &str, campuri: Value, confirmat: Value| call(ws, &mm, "delivery_step", json!({"id": d["id"], "etapa": etapa, "campuri": campuri, "confirmat": confirmat}));

    assert!(step(&mut ws, "in_drum", json!({}), json!([])).unwrap_err().to_string().contains("urmează"), "no skipping");
    let e = step(&mut ws, "incarcat", json!({"vehicul": "IS-01-KGB"}), json!([])).unwrap_err().to_string();
    assert!(e.contains("șoferul"), "{e}");
    step(&mut ws, "incarcat", json!({"vehicul": "IS-01-KGB", "sofer": "Ion Pop"}), json!([])).unwrap();
    assert!(step(&mut ws, "in_drum", json!({"aviz": "  "}), json!([])).is_err(), "blank does not count");
    step(&mut ws, "in_drum", json!({"aviz": "AV-123"}), json!([])).unwrap();
    step(&mut ws, "livrat", json!({"primit_de": "Maria Ionescu"}), json!([])).unwrap();
    assert!(call(&mut ws, &mm, "delivery_step", json!({"id": d["id"], "etapa": "anulata", "motiv": "x"})).is_err(), "delivered: not cancelled");
    assert!(step(&mut ws, "confirmat", json!({}), json!(["60"])).is_err(), "every line");
    let r = step(&mut ws, "confirmat", json!({}), json!(["58", "10"])).unwrap();
    assert_eq!(r["diferente"], true);

    let list = call(&mut ws, &mm, "deliveries", json!({})).unwrap();
    let l = &list[0];
    assert_eq!((l["etapa"].as_str(), l["comanda_text"].as_str(), l["destinatar"].as_str()), (Some("confirmat"), Some("CMD 1"), Some("Client SRL")));
    assert_eq!((l["linii"][0]["cantitate_text"].as_str(), l["linii"][0]["confirmat_text"].as_str()), (Some("60"), Some("58")));
    assert_eq!((l["campuri"]["vehicul"].as_str(), l["campuri"]["aviz"].as_str(), l["campuri"]["primit_de"].as_str()), (Some("IS-01-KGB"), Some("AV-123"), Some("Maria Ionescu")));
    let stages: Vec<&str> = l["istoric"].as_array().unwrap().iter().map(|h| h["etapa"].as_str().unwrap()).collect();
    assert_eq!(stages, deliveries::STAGES);

    // By hand, cancelled with a reason before delivery.
    let d2 = call(&mut ws, &mm, "delivery_save", json!({"destinatar": "Alt client", "adresa": "Cluj", "data": "2026-11-11", "linii": [{"descriere": "Paleți", "cantitate": "4"}]})).unwrap();
    assert!(call(&mut ws, &mm, "delivery_step", json!({"id": d2["id"], "etapa": "anulata"})).is_err(), "a reason is needed");
    call(&mut ws, &mm, "delivery_step", json!({"id": d2["id"], "etapa": "anulata", "motiv": "clientul a amânat"})).unwrap();
    assert!(call(&mut ws, &mm, "delivery_step", json!({"id": d2["id"], "etapa": "incarcat", "campuri": {"vehicul": "x", "sofer": "y"}})).is_err(), "cancelled stays cancelled");
}
