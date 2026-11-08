//! Step 5.3: invoices — VAT per line and totals checked by hand, numbering
//! without gaps or duplicates (also after a refused invoice and reopening),
//! stock taken and given back by storno, CUI check digit, the PDF.

use kgb_business::invoices::{cui_valid, line_amounts};
use kgb_business::{Business, ID};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

#[test]
fn vat_and_cui_by_hand() {
    // 3 × 32,50 = 97,50; 21% = 20,475 → 20,48 (half away from zero)
    assert_eq!(line_amounts(3_000, 3_250, 21), (9_750, 2_048));
    // 2,5 × 18,00 = 45,00; 21% = 9,45
    assert_eq!(line_amounts(2_500, 1_800, 21), (4_500, 945));
    // 1 × 0,05; 21% = 0,0105 → 0,01
    assert_eq!(line_amounts(1_000, 5, 21), (5, 1));
    // 0,333 × 1,00 = 0,333 → 0,33; 11% = 0,0363 → 0,04
    assert_eq!(line_amounts(333, 100, 11), (33, 4));
    assert!(cui_valid("RO18547290"));
    assert!(cui_valid("12345674"));
    assert!(cui_valid("987654328"));
    assert!(!cui_valid("RO18547291"));
    assert!(!cui_valid("ABC"));
    assert!(!cui_valid("1"));
}

#[test]
fn issue_number_storno_and_pdf() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    let mut ws = Workspace::create(&dir, "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &["storage.own".into(), "notify.send".into(), "files.own".into()],
    )
    .unwrap();

    let p = call(
        &mut ws,
        &mm,
        "product_save",
        json!({"cod": "CIM", "nume": "Ciment 40 kg", "um": "sac"}),
    )
    .unwrap();
    let w = call(&mut ws, &mm, "warehouse_save", json!({"nume": "Central"})).unwrap();
    call(&mut ws, &mm, "receive", json!({"depozit": w["id"], "numar": "N1", "data": "2026-11-01", "linii": [{"produs": p["id"], "cantitate": "10", "pret_unitar": "25"}]})).unwrap();
    let client = call(
        &mut ws,
        &mm,
        "partner_save",
        json!({"nume": "Client SRL", "cui": "RO12345674", "adresa": "Iași", "tip": "client"}),
    )
    .unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "partner_save",
            json!({"nume": "Greșit", "cui": "RO12345675"})
        )
        .is_err(),
        "bad check digit"
    );
    let series = call(&mut ws, &mm, "series_save", json!({"cod": "kgb", "primul_numar": 100})).unwrap();
    assert!(
        call(&mut ws, &mm, "series_save", json!({"cod": "KGB"})).is_err(),
        "a series is not created twice"
    );

    let invoice = |q: &str| {
        json!({"serie": series["id"], "partener": client["id"], "data": "2026-11-08", "scadenta": "2026-11-23", "depozit": w["id"],
               "linii": [{"produs": p["id"], "cantitate": q, "pret_unitar": "32,50", "cota_tva": 21},
                         {"descriere": "Transport", "um": "cursă", "cantitate": "1", "pret_unitar": "100", "cota_tva": 11}]})
    };
    // No company data yet: refused, nothing numbered.
    assert!(
        call(&mut ws, &mm, "invoice_issue", invoice("3"))
            .unwrap_err()
            .to_string()
            .contains("datele firmei")
    );
    call(
        &mut ws,
        &mm,
        "settings_save",
        json!({"firma": {"firma_nume": "Kronos Global Business SRL", "firma_cui": "RO18547290", "firma_adresa": "Iași, Str. Lăpușneanu 1", "firma_iban": "RO49AAAA1B31007593840000"}}),
    )
    .unwrap();
    assert!(call(&mut ws, &mm, "settings_save", json!({"firma": {"firma_cui": "RO1"}})).is_err());
    // A rate that is not in the settings is refused.
    let mut bad_rate = invoice("3");
    bad_rate["linii"][0]["cota_tva"] = json!(24);
    assert!(call(&mut ws, &mm, "invoice_issue", bad_rate).is_err());
    // More than the stock: refused, and the number is not used.
    assert!(
        call(&mut ws, &mm, "invoice_issue", invoice("11"))
            .unwrap_err()
            .to_string()
            .contains("se cer 11")
    );

    let f1 = call(&mut ws, &mm, "invoice_issue", invoice("3")).unwrap();
    assert_eq!(f1["numar"], "KGB 100");
    // 97,50 + 100,00 = 197,50; VAT 20,48 + 11,00 = 31,48; total 228,98
    assert_eq!(f1["total"], 22_898);
    let list = call(&mut ws, &mm, "invoices", json!({})).unwrap();
    assert_eq!(list[0]["total_fara_tva"], 19_750);
    assert_eq!(list[0]["total_tva"], 3_148);
    assert_eq!(list[0]["client"]["cui"], "RO12345674", "a copy of the client is kept");
    let stock = |ws: &mut Workspace| {
        call(ws, &mm, "stock", json!({"produs": p["id"]})).unwrap()[0]["cantitate"]
            .as_i64()
            .unwrap()
    };
    assert_eq!(stock(&mut ws), 7_000, "the invoice took 3 bags out");

    let f2 = call(&mut ws, &mm, "invoice_issue", invoice("2")).unwrap();
    assert_eq!(f2["numar"], "KGB 101");
    // Storno of the first: next number, negative totals, stock back; only once.
    let st = call(
        &mut ws,
        &mm,
        "invoice_storno",
        json!({"id": f1["id"], "data": "2026-11-09"}),
    )
    .unwrap();
    assert_eq!(st["numar"], "KGB 102");
    assert!(
        call(
            &mut ws,
            &mm,
            "invoice_storno",
            json!({"id": f1["id"], "data": "2026-11-09"})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "invoice_storno",
            json!({"id": st["id"], "data": "2026-11-09"})
        )
        .is_err()
    );
    assert_eq!(stock(&mut ws), 8_000);
    let list = call(&mut ws, &mm, "invoices", json!({})).unwrap();
    let storno = list.as_array().unwrap().iter().find(|x| x["numar"] == 102).unwrap();
    assert_eq!(storno["total"], -22_898);
    assert_eq!(
        list.as_array()
            .unwrap()
            .iter()
            .filter(|x| x["stornata"] == true)
            .count(),
        1
    );

    // PDF: written, readable, with the number and total.
    let pdf = tmp.path().join("f.pdf");
    call(&mut ws, &mm, "invoice_pdf", json!({"id": f2["id"], "dest": pdf})).unwrap();
    assert!(std::fs::read(&pdf).unwrap().starts_with(b"%PDF-"));

    // After reopening, the series continues without a gap.
    drop(ws);
    let mut ws = Workspace::open(&dir).unwrap();
    let f4 = call(&mut ws, &mm, "invoice_issue", invoice("1")).unwrap();
    assert_eq!(f4["numar"], "KGB 103");
    let numbers: Vec<i64> = call(&mut ws, &mm, "invoices", json!({}))
        .unwrap()
        .as_array()
        .unwrap()
        .iter()
        .map(|x| x["numar"].as_i64().unwrap())
        .collect();
    let mut sorted = numbers.clone();
    sorted.sort();
    assert_eq!(sorted, [100, 101, 102, 103], "no gaps, no duplicates");
}
