//! Step 7.4j: bank payments matched to invoices with a score and reasons;
//! a small difference is shown and stays to be paid; nothing that would
//! overpay is offered; the sure ones are confirmed together, in one write;
//! a wrong pair refuses the whole batch.

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_business::{Business, ID};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn left(ws: &mut Workspace, mm: &ModuleManager, id: &Value) -> Option<i64> {
    call(ws, mm, "open_documents", json!({})).unwrap().as_array().unwrap().iter().find(|d| d["id"] == *id).map(|d| d["rest"].as_i64().unwrap())
}

#[test]
fn bank_payments_matched_with_reasons() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into(), "files.own".into()]).unwrap();
    call(&mut ws, &mm, "settings_save", json!({"firma": {"firma_nume": "Noi SRL", "firma_cui": "RO18547290"}})).unwrap();
    let series = call(&mut ws, &mm, "series_save", json!({"cod": "F"})).unwrap();
    let alfa = call(&mut ws, &mm, "partner_save", json!({"nume": "Alfa Construct SRL", "cui": "RO14399840", "tip": "client"})).unwrap();
    let beta = call(&mut ws, &mm, "partner_save", json!({"nume": "Beta Logistic SRL", "tip": "client"})).unwrap();
    let issue = |ws: &mut Workspace, partner: &Value, price: &str| {
        call(ws, &mm, "invoice_issue", json!({"serie": series["id"], "partener": partner["id"], "data": "2026-11-01",
            "linii": [{"descriere": "Servicii", "cantitate": "1", "pret_unitar": price, "cota_tva": 21}]}))
        .unwrap()
    };
    // F 1: 1000 + 21% = 1210,00; F 2: 500 + 21% = 605,00; F 3: 100 + 21% = 121,00.
    let f1 = issue(&mut ws, &alfa, "1000");
    let f2 = issue(&mut ws, &beta, "500");
    let f3 = issue(&mut ws, &beta, "100");
    let bank = call(&mut ws, &mm, "account_save", json!({"tip": "banca", "nume": "Banca X"})).unwrap();
    // 1) exact amount, invoice number and CUI in the details → sure;
    // 2) 604,60 for F 2 (0,40 short), Beta's name in the details;
    // 3) 2000 lei: more than anything open → never offered.
    let csv = "Data;Descriere;Debit;Credit\r\n05.11.2026;OP 14399840 Alfa Construct factura F 1;;1.210,00\r\n06.11.2026;Beta Logistic plata servicii;;604,60\r\n07.11.2026;Încasare necunoscută;;2.000,00\r\n";
    call(&mut ws, &mm, "bank_import", json!({"cont": bank["id"], "name": "extras.csv", "data": B64.encode(csv.as_bytes())})).unwrap();

    let sug = call(&mut ws, &mm, "match_suggest", json!({})).unwrap();
    let sug = sug.as_array().unwrap();
    assert_eq!(sug.len(), 2, "the 2000 lei payment overpays everything: {sug:?}");
    let s1 = sug.iter().find(|x| x["plata"]["suma"] == 121_000).unwrap();
    assert_eq!(s1["sigur"], true, "{s1}");
    let c1 = &s1["candidati"][0];
    assert_eq!(c1["document"]["id"], f1["id"]);
    let why: Vec<&str> = c1["motive"].as_array().unwrap().iter().map(|m| m.as_str().unwrap()).collect();
    assert!(why.iter().any(|m| m.contains("exact")) && why.iter().any(|m| m.contains("numărul")) && why.iter().any(|m| m.contains("CUI")), "{why:?}");

    let s2 = sug.iter().find(|x| x["plata"]["suma"] == 60_460).unwrap();
    let c2 = &s2["candidati"][0];
    assert_eq!(c2["document"]["id"], f2["id"], "{s2}");
    assert!(c2["motive"].to_string().contains("diferență de 0,40 lei"), "{c2}");
    assert!(!s2["candidati"].as_array().unwrap().iter().any(|c| c["document"]["id"] == f3["id"] && c["motive"].to_string().contains("exact")));

    // A wrong pair (the 604,60 payment on F 3, which has 121 left) refuses the whole batch.
    let p1 = s1["plata"]["id"].clone();
    let p2 = s2["plata"]["id"].clone();
    let bad = call(&mut ws, &mm, "match_confirm", json!({"perechi": [
        {"plata": p1, "document": {"tip": "factura", "id": f1["id"]}},
        {"plata": p2, "document": {"tip": "factura", "id": f3["id"]}},
    ]}));
    assert!(bad.is_err());
    assert_eq!(left(&mut ws, &mm, &f1["id"]), Some(121_000), "nothing was linked");

    // The good batch: both linked at once; F 1 paid, F 2 keeps its 0,40 lei.
    let ok = call(&mut ws, &mm, "match_confirm", json!({"perechi": [
        {"plata": p1, "document": {"tip": "factura", "id": f1["id"]}},
        {"plata": p2, "document": {"tip": "factura", "id": f2["id"]}},
    ]})).unwrap();
    assert_eq!(ok["legate"], 2);
    assert_eq!(left(&mut ws, &mm, &f1["id"]), None, "paid");
    assert_eq!(left(&mut ws, &mm, &f2["id"]), Some(40));
    // Only the unmatched payment is left, and it still overpays everything.
    assert_eq!(call(&mut ws, &mm, "match_suggest", json!({})).unwrap().as_array().unwrap().len(), 0);
    // The books still check out.
    let v = call(&mut ws, &mm, "verify", json!({})).unwrap();
    assert!(v.to_string().contains("\"ok\":true") || v["ok"] == true, "{v}");
}

/// Step 7.4j-2: one payment split over several invoices — each link has its
/// amount; never more than the payment nor than what an invoice has left;
/// the partner statement shows each part; a storno of the payment reopens
/// every invoice it paid; the books check out.
#[test]
fn one_payment_split_over_invoices() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into(), "files.own".into()]).unwrap();
    call(&mut ws, &mm, "settings_save", json!({"firma": {"firma_nume": "Noi SRL", "firma_cui": "RO18547290"}})).unwrap();
    let series = call(&mut ws, &mm, "series_save", json!({"cod": "F"})).unwrap();
    let alfa = call(&mut ws, &mm, "partner_save", json!({"nume": "Alfa SRL", "tip": "client"})).unwrap();
    let issue = |ws: &mut Workspace, price: &str| {
        call(ws, &mm, "invoice_issue", json!({"serie": series["id"], "partener": alfa["id"], "data": "2026-11-01",
            "linii": [{"descriere": "Servicii", "cantitate": "1", "pret_unitar": price, "cota_tva": 21}]}))
        .unwrap()
    };
    let f1 = issue(&mut ws, "1000"); // 1210,00
    let f2 = issue(&mut ws, "500"); // 605,00
    let bank = call(&mut ws, &mm, "account_save", json!({"tip": "banca", "nume": "Banca X"})).unwrap();
    // 2000 lei in: 1210 + 605 = 1815, 185 stay unlinked.
    let pay = call(&mut ws, &mm, "payment_save", json!({"cont": bank["id"], "data": "2026-11-05", "sens": "incasare", "suma": "2.000,00", "explicatie": "Alfa F1 F2"})).unwrap();
    let pid = pay["id"].clone();

    // More than an invoice has left, or more than the payment: refused, nothing linked.
    assert!(call(&mut ws, &mm, "match_confirm", json!({"perechi": [{"plata": pid, "document": {"tip": "factura", "id": f1["id"]}, "suma": "1.300,00"}]})).is_err());
    assert!(call(&mut ws, &mm, "match_confirm", json!({"perechi": [
        {"plata": pid, "document": {"tip": "factura", "id": f1["id"]}, "suma": "1.210,00"},
        {"plata": pid, "document": {"tip": "factura", "id": f2["id"]}, "suma": "900,00"},
    ]})).is_err());
    assert_eq!(left(&mut ws, &mm, &f1["id"]), Some(121_000));

    // Split: both invoices paid from the one payment, in one write.
    let ok = call(&mut ws, &mm, "match_confirm", json!({"perechi": [
        {"plata": pid, "document": {"tip": "factura", "id": f1["id"]}, "suma": "1.210,00"},
        {"plata": pid, "document": {"tip": "factura", "id": f2["id"]}, "suma": "605,00"},
    ]})).unwrap();
    assert_eq!(ok["legate"], 2);
    assert_eq!((left(&mut ws, &mm, &f1["id"]), left(&mut ws, &mm, &f2["id"])), (None, None));
    let pays = call(&mut ws, &mm, "payments", json!({})).unwrap();
    let p = pays.as_array().unwrap().iter().find(|x| x["id"] == pid).unwrap();
    assert_eq!((p["legaturi"].as_u64(), p["nelegat"].as_i64()), (Some(2), Some(18_500)), "{p}");
    // The 185 lei left are offered for matching (nothing open now) and can be linked by hand later.
    assert!(call(&mut ws, &mm, "payment_link", json!({"plata": pid, "document": {"tip": "factura", "id": f1["id"]}})).is_err(), "F1 is paid");

    // The partner statement shows each part, not the whole payment twice.
    let sheet = call(&mut ws, &mm, "partner_sheet", json!({"id": alfa["id"]})).unwrap().to_string();
    assert!(sheet.contains("121000") && sheet.contains("60500") && !sheet.contains("200000"), "{sheet}");
    let v = call(&mut ws, &mm, "verify", json!({})).unwrap();
    assert!(v.to_string().contains("\"ok\":true") || v["ok"] == true, "{v}");

    // A storno of the payment reopens both invoices.
    call(&mut ws, &mm, "payment_storno", json!({"id": pid, "data": "2026-11-06"})).unwrap();
    assert_eq!((left(&mut ws, &mm, &f1["id"]), left(&mut ws, &mm, &f2["id"])), (Some(121_000), Some(60_500)));
    let v = call(&mut ws, &mm, "verify", json!({})).unwrap();
    assert!(v.to_string().contains("\"ok\":true") || v["ok"] == true, "{v}");
}
