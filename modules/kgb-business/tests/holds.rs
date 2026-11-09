//! Step 7.4k-3: reserved and blocked stock — never more than what is free;
//! a block needs a reason; reserved and blocked stock does not leave through
//! an issue or a transfer; an order's reservations end when it goes into
//! delivery or is cancelled; released by hand with a reason for a block;
//! each hold keeps its history; the stock view shows reserved, blocked, free.

use kgb_business::{Business, ID};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

#[test]
fn reserved_and_blocked_stock() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into(), "files.own".into()]).unwrap();
    call(&mut ws, &mm, "settings_save", json!({"firma": {"firma_nume": "Noi SRL", "firma_cui": "RO18547290"}})).unwrap();
    let p = call(&mut ws, &mm, "product_save", json!({"cod": "CIM", "nume": "Ciment", "um": "sac"})).unwrap();
    let a = call(&mut ws, &mm, "warehouse_save", json!({"nume": "Central"})).unwrap();
    let b = call(&mut ws, &mm, "warehouse_save", json!({"nume": "Șantier"})).unwrap();
    call(&mut ws, &mm, "receive", json!({"depozit": a["id"], "numar": "NIR 1", "data": "01.11.2026", "partener": "F SRL",
        "linii": [{"produs": p["id"], "cantitate": "100", "pret_unitar": "30"}]})).unwrap();
    let client = call(&mut ws, &mm, "partner_save", json!({"nume": "Client SRL", "tip": "client"})).unwrap();
    let order = |ws: &mut Workspace| {
        call(ws, &mm, "order_save", json!({"tip": "vanzare", "partener": client["id"], "data": "2026-11-09",
            "linii": [{"descriere": "Ciment", "cantitate": "60", "pret_unitar": "40", "cota_tva": 21}]})).unwrap()
    };
    let o1 = order(&mut ws);
    let hold = |ws: &mut Workspace, q: &str, tip: &str, comanda: Option<&Value>, motiv: Option<&str>| {
        call(ws, &mm, "hold_save", json!({"produs": p["id"], "depozit": a["id"], "cantitate": q, "tip": tip, "comanda": comanda, "motiv": motiv}))
    };
    let r1 = hold(&mut ws, "60", "rezervare", Some(&o1["id"]), None).unwrap();
    assert!(hold(&mut ws, "30", "blocare", None, None).is_err(), "a block needs a reason");
    let bl = hold(&mut ws, "30", "blocare", None, Some("saci deteriorați")).unwrap();
    assert_eq!(bl["liber_ramas"], 10_000);
    let e = hold(&mut ws, "20", "rezervare", Some(&o1["id"]), None).unwrap_err().to_string();
    assert!(e.contains("liber 10") && e.contains("rezervat 60") && e.contains("blocat 30"), "{e}");

    // Only the free 10 leave, by issue or transfer.
    let issue = |ws: &mut Workspace, q: &str| call(ws, &mm, "issue", json!({"depozit": a["id"], "numar": "BC", "data": "02.11.2026", "linii": [{"produs": p["id"], "cantitate": q}]}));
    assert!(issue(&mut ws, "15").unwrap_err().to_string().contains("libere 10"));
    assert!(call(&mut ws, &mm, "transfer", json!({"depozit": a["id"], "depozit_destinatie": b["id"], "numar": "T1", "data": "02.11.2026", "linii": [{"produs": p["id"], "cantitate": "11"}]})).is_err());
    issue(&mut ws, "10").unwrap();
    let row = |ws: &mut Workspace| call(ws, &mm, "stock", json!({"produs": p["id"], "depozit": a["id"]})).unwrap()[0].clone();
    let r = row(&mut ws);
    assert_eq!((r["cantitate"].as_i64(), r["rezervat"].as_i64(), r["blocat"].as_i64(), r["liber"].as_i64()), (Some(90_000), Some(60_000), Some(30_000), Some(0)));

    // The order goes into delivery: its reservation ends; its 60 can leave.
    for st in ["asteapta", "aprobata", "livrare"] {
        call(&mut ws, &mm, "order_move", json!({"id": o1["id"], "stare": st})).unwrap();
    }
    assert_eq!(row(&mut ws)["liber"], 60_000);
    issue(&mut ws, "60").unwrap();

    // Another order reserved then cancelled: released in the same write.
    let o2 = order(&mut ws);
    assert!(hold(&mut ws, "1", "rezervare", Some(&o2["id"]), None).is_err(), "nothing free: 30 left, all blocked");
    call(&mut ws, &mm, "hold_release", json!({"id": bl["id"], "motiv": ""})).unwrap_err();
    call(&mut ws, &mm, "hold_release", json!({"id": bl["id"], "motiv": "verificați, sunt buni"})).unwrap();
    let r2 = hold(&mut ws, "5", "rezervare", Some(&o2["id"]), None).unwrap();
    call(&mut ws, &mm, "order_move", json!({"id": o2["id"], "stare": "anulata", "motiv": "clientul a renunțat"})).unwrap();
    assert_eq!(row(&mut ws)["liber"], 30_000);

    let holds = call(&mut ws, &mm, "holds", json!({})).unwrap();
    let get = |id: &Value| holds.as_array().unwrap().iter().find(|h| h["id"] == *id).unwrap().clone();
    let h1 = get(&r1["id"]);
    assert_eq!((h1["activa"].as_bool(), h1["comanda_text"].as_str()), (Some(false), Some("CMD 1")));
    assert_eq!(h1["istoric"][1]["motiv"], "comanda a intrat în livrare");
    assert_eq!(get(&bl["id"])["istoric"][1]["motiv"], "verificați, sunt buni");
    assert_eq!(get(&r2["id"])["istoric"][1]["motiv"], "comanda a fost anulată");
    assert!(call(&mut ws, &mm, "hold_save", json!({"produs": p["id"], "depozit": a["id"], "cantitate": "1", "tip": "rezervare", "comanda": o2["id"]})).is_err(), "a cancelled order gets no reservation");
    let v = call(&mut ws, &mm, "verify", json!({})).unwrap();
    assert!(v.to_string().contains("\"ok\":true") || v["ok"] == true, "{v}");
}
