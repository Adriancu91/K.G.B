//! Step 5.5: cash and bank — balances from the payments, a cash register
//! never below zero, receipts numbered without gaps, a payment linked once
//! and never above what is left, advances settled exactly, bank statements
//! imported once.

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

fn balance(ws: &mut Workspace, mm: &ModuleManager, acc: &Value) -> i64 {
    call(ws, mm, "accounts", json!({}))
        .unwrap()
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["id"] == acc["id"])
        .unwrap()["sold"]
        .as_i64()
        .unwrap()
}

fn open_left(ws: &mut Workspace, mm: &ModuleManager, id: &Value) -> Option<i64> {
    call(ws, mm, "open_documents", json!({}))
        .unwrap()
        .as_array()
        .unwrap()
        .iter()
        .find(|d| d["id"] == *id)
        .map(|d| d["rest"].as_i64().unwrap())
}

#[test]
fn cash_bank_links_receipts_advances() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &["storage.own".into(), "notify.send".into(), "files.own".into()],
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "settings_save",
        json!({"firma": {"firma_nume": "Noi SRL", "firma_cui": "RO18547290"}}),
    )
    .unwrap();
    let inv_series = call(&mut ws, &mm, "series_save", json!({"cod": "F"})).unwrap();
    let rec_series = call(&mut ws, &mm, "series_save", json!({"cod": "CH"})).unwrap();
    let client = call(
        &mut ws,
        &mm,
        "partner_save",
        json!({"nume": "Client SRL", "tip": "ambele"}),
    )
    .unwrap();
    // 100,00 + 21% = 121,00
    let inv = call(
        &mut ws,
        &mm,
        "invoice_issue",
        json!({"serie": inv_series["id"], "partener": client["id"], "data": "2026-11-01",
        "linii": [{"descriere": "Servicii", "cantitate": "1", "pret_unitar": "100", "cota_tva": 21}]}),
    )
    .unwrap();
    let casa = call(
        &mut ws,
        &mm,
        "account_save",
        json!({"tip": "casa", "nume": "Casa principală"}),
    )
    .unwrap();
    let banca = call(
        &mut ws,
        &mm,
        "account_save",
        json!({"tip": "banca", "nume": "Banca X", "iban": "RO49AAAA1B31007593840000"}),
    )
    .unwrap();
    let doc = json!({"tip": "factura", "id": inv["id"]});

    // Cash in 50 with a receipt; 71 left.
    let r1 = call(&mut ws, &mm, "payment_save", json!({"cont": casa["id"], "data": "2026-11-02", "sens": "incasare", "suma": "50", "partener": client["id"], "document": doc, "chitanta_serie": rec_series["id"]})).unwrap();
    assert_eq!(r1["numar"], "Chitanța CH 1");
    assert_eq!(open_left(&mut ws, &mm, &inv["id"]), Some(7_100));
    // More than what is left: refused, nothing written (receipt number not used).
    let err = call(&mut ws, &mm, "payment_save", json!({"cont": casa["id"], "data": "2026-11-02", "sens": "incasare", "suma": "80", "document": doc, "chitanta_serie": rec_series["id"]})).unwrap_err().to_string();
    assert!(err.contains("mai sunt de achitat 71,00"), "{err}");
    // An invoice is paid by money in, not out.
    assert!(
        call(
            &mut ws,
            &mm,
            "payment_save",
            json!({"cont": banca["id"], "data": "2026-11-02", "sens": "plata", "suma": "1", "document": doc})
        )
        .is_err()
    );
    let r2 = call(&mut ws, &mm, "payment_save", json!({"cont": casa["id"], "data": "2026-11-03", "sens": "incasare", "suma": "71", "document": doc, "chitanta_serie": rec_series["id"]})).unwrap();
    assert_eq!(r2["numar"], "Chitanța CH 2", "no gap after the refused one");
    assert_eq!(open_left(&mut ws, &mm, &inv["id"]), None, "fully paid");
    assert_eq!(balance(&mut ws, &mm, &casa), 12_100);

    // Cash never below zero.
    let err = call(
        &mut ws,
        &mm,
        "payment_save",
        json!({"cont": casa["id"], "data": "2026-11-04", "sens": "plata", "suma": "200"}),
    )
    .unwrap_err()
    .to_string();
    assert!(err.contains("sold negativ"), "{err}");

    // An expense paid by bank (a bank account may be overdrawn).
    let sup = call(
        &mut ws,
        &mm,
        "partner_save",
        json!({"nume": "Furnizor SRL", "tip": "furnizor"}),
    )
    .unwrap();
    let exp = call(
        &mut ws,
        &mm,
        "purchase_save",
        json!({"furnizor": sup["id"], "numar": "A-1", "data": "2026-11-02", "total": "60,50"}),
    )
    .unwrap();
    call(&mut ws, &mm, "payment_save", json!({"cont": banca["id"], "data": "2026-11-05", "sens": "plata", "suma": "60,50", "document": {"tip": "cheltuiala", "id": exp["id"]}})).unwrap();
    assert_eq!(open_left(&mut ws, &mm, &exp["id"]), None);
    assert_eq!(balance(&mut ws, &mm, &banca), -6_050);

    // Advance of 100 from cash to Ion; he spends 30 (a receipt) and returns 70.
    let adv = call(&mut ws, &mm, "payment_save", json!({"cont": casa["id"], "data": "2026-11-06", "sens": "plata", "suma": "100", "avans_persoana": "Ion Ionescu"})).unwrap();
    assert_eq!(balance(&mut ws, &mm, &casa), 2_100);
    let bon = call(
        &mut ws,
        &mm,
        "purchase_save",
        json!({"furnizor": sup["id"], "tip": "bon", "numar": "B-30", "data": "2026-11-06", "total": "30"}),
    )
    .unwrap();
    let wrong = call(
        &mut ws,
        &mm,
        "settle",
        json!({"avans": adv["id"], "data": "2026-11-07", "cheltuieli": [bon["id"]], "restituit": "60"}),
    )
    .unwrap_err()
    .to_string();
    assert!(
        wrong.contains("trebuie să fie egale cu avansul (100,00 lei)"),
        "{wrong}"
    );
    call(
        &mut ws,
        &mm,
        "settle",
        json!({"avans": adv["id"], "data": "2026-11-07", "cheltuieli": [bon["id"]], "restituit": "70"}),
    )
    .unwrap();
    assert_eq!(balance(&mut ws, &mm, &casa), 9_100, "the 70 came back");
    assert_eq!(open_left(&mut ws, &mm, &bon["id"]), None, "paid from the advance");
    assert!(
        call(
            &mut ws,
            &mm,
            "settle",
            json!({"avans": adv["id"], "data": "2026-11-07", "restituit": "100"})
        )
        .is_err(),
        "only once"
    );

    // Storno of a cash-in: the invoice is open again for that amount.
    call(
        &mut ws,
        &mm,
        "payment_storno",
        json!({"id": r2["id"], "data": "2026-11-08"}),
    )
    .unwrap();
    assert_eq!(open_left(&mut ws, &mm, &inv["id"]), Some(7_100));
    assert_eq!(balance(&mut ws, &mm, &casa), 2_000);
    assert!(
        call(
            &mut ws,
            &mm,
            "payment_storno",
            json!({"id": r2["id"], "data": "2026-11-08"})
        )
        .is_err()
    );
}

#[test]
fn bank_statement_import() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &["storage.own".into(), "notify.send".into(), "files.own".into()],
    )
    .unwrap();
    let banca = call(&mut ws, &mm, "account_save", json!({"tip": "banca", "nume": "Banca X"})).unwrap();
    let casa = call(&mut ws, &mm, "account_save", json!({"tip": "casa", "nume": "Casa"})).unwrap();
    let csv = "Data;Descriere;Debit;Credit\r\n03.11.2026;Încasare Client SRL F 1;;1.210,00\r\n04.11.2026;Plată chirie noiembrie;2.500,00;\r\n05.11.2026;Comision;1,50;\r\n";
    let imp = |ws: &mut Workspace, acc: &Value, name: &str, body: &str| {
        call(
            ws,
            &mm,
            "bank_import",
            json!({"cont": acc["id"], "name": name, "data": B64.encode(body.as_bytes())}),
        )
    };
    let r = imp(&mut ws, &banca, "extras.csv", csv).unwrap();
    assert_eq!(r["importate"], 3);
    // 1.210,00 − 2.500,00 − 1,50
    assert_eq!(balance(&mut ws, &mm, &banca), 121_000 - 250_000 - 150);
    let r = imp(&mut ws, &banca, "extras.csv", csv).unwrap();
    assert_eq!(
        (r["importate"].as_i64(), r["sarite"].as_i64()),
        (Some(0), Some(3)),
        "the same statement twice adds nothing"
    );
    // One signed amount column works too; a bad amount refuses the file.
    let signed = "Data operatiunii;Detalii;Suma\r\n06.11.2026;Dobândă;0,25\r\n";
    assert_eq!(imp(&mut ws, &banca, "b.csv", signed).unwrap()["importate"], 1);
    assert!(
        imp(
            &mut ws,
            &banca,
            "c.csv",
            "Data;Detalii;Suma\r\n06.11.2026;X;doi lei\r\n"
        )
        .unwrap_err()
        .to_string()
        .contains("nimic nu a fost importat")
    );
    // Only into a bank account; only CSV.
    assert!(imp(&mut ws, &casa, "extras.csv", csv).is_err());
    assert!(imp(&mut ws, &banca, "extras.pdf", csv).is_err());
}
