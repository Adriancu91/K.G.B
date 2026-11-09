//! Step 7.4k-2: orders with approval — the allowed states only, reasons for
//! rejecting and cancelling, the history of every change, only a draft can
//! be changed; from an accepted offer the lines and prices are taken and
//! ordering more than offered is a warning.

use kgb_business::{Business, ID, orders};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

#[test]
fn orders_states_history_and_offers() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into(), "files.own".into()]).unwrap();
    call(&mut ws, &mm, "settings_save", json!({"firma": {"firma_nume": "Noi SRL", "firma_cui": "RO18547290"}})).unwrap();
    let client = call(&mut ws, &mm, "partner_save", json!({"nume": "Client SRL", "tip": "client"})).unwrap();
    let other = call(&mut ws, &mm, "partner_save", json!({"nume": "Alt Client SRL", "tip": "client"})).unwrap();

    // A purchase order by hand; a transfer without a partner.
    let o = call(&mut ws, &mm, "order_save", json!({"tip": "cumparare", "partener": client["id"], "data": "2026-11-09",
        "linii": [{"descriere": "Ciment", "cantitate": "10", "pret_unitar": "32,50", "cota_tva": 21}]})).unwrap();
    assert_eq!(o["numar"], "CMD 1");
    call(&mut ws, &mm, "order_save", json!({"tip": "transfer", "data": "2026-11-09", "linii": [{"descriere": "Ciment", "cantitate": "5", "pret_unitar": "0", "cota_tva": 21}]})).unwrap();
    assert!(call(&mut ws, &mm, "order_save", json!({"tip": "vanzare", "data": "2026-11-09", "linii": [{"descriere": "x", "cantitate": "1", "pret_unitar": "1", "cota_tva": 21}]})).is_err(), "a sale needs a client");

    let mv = |ws: &mut Workspace, st: &str, why: Option<&str>| call(ws, &mm, "order_move", json!({"id": o["id"], "stare": st, "motiv": why}));
    assert!(mv(&mut ws, "aprobata", None).is_err(), "a draft is not approved directly");
    mv(&mut ws, "asteapta", None).unwrap();
    assert!(mv(&mut ws, "ciorna", None).is_err(), "rejecting needs a reason");
    mv(&mut ws, "ciorna", Some("preț de verificat")).unwrap();
    // Back in draft: can be changed; then approved, delivered, done.
    let ver = call(&mut ws, &mm, "orders", json!({})).unwrap().as_array().unwrap().iter().find(|x| x["id"] == o["id"]).unwrap()["version"].clone();
    call(&mut ws, &mm, "order_save", json!({"id": o["id"], "version": ver, "tip": "cumparare", "partener": client["id"], "data": "2026-11-09",
        "linii": [{"descriere": "Ciment", "cantitate": "12", "pret_unitar": "32,50", "cota_tva": 21}]})).unwrap();
    for st in ["asteapta", "aprobata", "livrare"] {
        mv(&mut ws, st, None).unwrap();
    }
    assert!(call(&mut ws, &mm, "order_save", json!({"id": o["id"], "tip": "cumparare", "partener": client["id"], "data": "2026-11-09",
        "linii": [{"descriere": "Ciment", "cantitate": "1", "pret_unitar": "1", "cota_tva": 21}]})).is_err(), "only a draft is changed");
    mv(&mut ws, "gata", None).unwrap();
    assert!(mv(&mut ws, "anulata", Some("x")).is_err(), "a finished order is not cancelled");
    let list = call(&mut ws, &mm, "orders", json!({})).unwrap();
    let done = list.as_array().unwrap().iter().find(|x| x["id"] == o["id"]).unwrap();
    let hist: Vec<String> = done["istoric"].as_array().unwrap().iter().map(|h| h["in"].as_str().unwrap().to_string()).collect();
    assert_eq!(hist, ["ciorna", "asteapta", "ciorna", "asteapta", "aprobata", "livrare", "gata"]);
    assert_eq!(done["istoric"][2]["motiv"], "preț de verificat");
    // 12 × 32,50 = 390,00 + 21% = 471,90
    assert_eq!(done["total_text"], "471,90");

    // From an offer: only an accepted one, for the same client; prices taken; more than offered warns.
    let of = call(&mut ws, &mm, "offer_save", json!({"partener": client["id"], "data": "2026-11-09", "valabil_pana": "2026-11-30",
        "linii": [{"descriere": "Montaj", "cantitate": "3", "pret_unitar": "120,50", "cota_tva": 21}]})).unwrap();
    let from_offer = |ws: &mut Workspace, partner: &Value, lines: Value| {
        call(ws, &mm, "order_save", json!({"tip": "vanzare", "partener": partner, "data": "2026-11-10", "oferta": of["id"], "linii": lines}))
    };
    assert!(from_offer(&mut ws, &client["id"], json!([])).unwrap_err().to_string().contains("acceptată"));
    call(&mut ws, &mm, "offer_close", json!({"id": of["id"], "stare": "acceptata", "azi": "2026-11-10"})).unwrap();
    assert!(from_offer(&mut ws, &other["id"], json!([])).is_err(), "another client");
    let all = from_offer(&mut ws, &client["id"], json!([])).unwrap();
    assert_eq!((all["total_text"].as_str(), all["avertismente"].as_array().unwrap().len()), (Some("437,42"), 0), "{all}");
    let more = from_offer(&mut ws, &client["id"], json!([{"descriere": "montaj", "cantitate": "5", "pret_unitar": "", "cota_tva": 21}])).unwrap();
    // 5 × 120,50 (price from the offer) = 602,50 + 126,53 = 729,03; warning: 5 vs 3.
    assert_eq!(more["total_text"], "729,03", "{more}");
    assert!(more["avertismente"][0].as_str().unwrap().contains("comandat 5"), "{more}");
    assert!(orders::allowed("livrare", "anulata") && !orders::allowed("gata", "livrare"));
}
