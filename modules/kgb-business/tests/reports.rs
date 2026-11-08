//! Step 5.7: reports rebuilt from the records, checked against an example
//! calculated by hand; the export reopens with the same numbers.

use kgb_business::{Business, ID};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_sheets::book::{self, Format};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

#[test]
fn report_by_hand_and_export() {
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
    let ser = call(&mut ws, &mm, "series_save", json!({"cod": "F"})).unwrap();
    let c = call(
        &mut ws,
        &mm,
        "partner_save",
        json!({"nume": "Client SRL", "tip": "ambele"}),
    )
    .unwrap();
    let p = call(
        &mut ws,
        &mm,
        "product_save",
        json!({"cod": "CIM", "nume": "Ciment", "um": "sac"}),
    )
    .unwrap();
    let w = call(&mut ws, &mm, "warehouse_save", json!({"nume": "Central"})).unwrap();
    // 10 bags at 25,00 = 250,00
    call(&mut ws, &mm, "receive", json!({"depozit": w["id"], "numar": "N", "data": "2026-11-01", "linii": [{"produs": p["id"], "cantitate": "10", "pret_unitar": "25"}]})).unwrap();
    // Invoice: 4 bags × 40,00 (net 160,00, VAT 33,60) + transport 50,00 (VAT 10,50)
    let inv = call(
        &mut ws,
        &mm,
        "invoice_issue",
        json!({"serie": ser["id"], "partener": c["id"], "data": "2026-11-02", "depozit": w["id"],
        "linii": [{"produs": p["id"], "cantitate": "4", "pret_unitar": "40", "cota_tva": 21},
                  {"descriere": "Transport", "cantitate": "1", "pret_unitar": "50", "cota_tva": 21}]}),
    )
    .unwrap();
    // Expenses: rent 1.000 + 210 VAT; a receipt of 30 (total only)
    call(&mut ws, &mm, "purchase_save", json!({"furnizor": c["id"], "numar": "C-1", "data": "2026-11-03", "categorie": "chirie", "total_fara_tva": "1000", "tva": "210", "total": "1210"})).unwrap();
    call(
        &mut ws,
        &mm,
        "purchase_save",
        json!({"furnizor": c["id"], "tip": "bon", "numar": "B-1", "data": "2026-11-04", "total": "30"}),
    )
    .unwrap();

    let r = call(
        &mut ws,
        &mm,
        "report",
        json!({"de_la": "2026-11-01", "pana_la": "2026-11-30"}),
    )
    .unwrap();
    assert_eq!(r["vanzari"]["net"], 21_000);
    assert_eq!(r["vanzari"]["tva"], 4_410);
    assert_eq!(r["vanzari"]["total"], 25_410);
    assert_eq!(r["cost_marfuri"], 10_000, "4 bags at 25,00");
    assert_eq!(
        r["cheltuieli"]["net"], 103_000,
        "1.000 + 30 (receipt: total counts as net)"
    );
    // 210 − 100 − 1.030 = −920
    assert_eq!(r["profit"], -92_000);
    assert_eq!(r["stoc_valoare"], 15_000, "6 bags at 25,00");
    assert_eq!(r["pe_produse"].as_array().unwrap().len(), 2);
    assert_eq!(
        r["pe_categorii"]
            .as_array()
            .unwrap()
            .iter()
            .find(|x| x["nume"] == "chirie")
            .unwrap()["valori"]["total"],
        121_000
    );

    // A period that leaves the invoice out.
    let later = call(
        &mut ws,
        &mm,
        "report",
        json!({"de_la": "2026-11-03", "pana_la": "2026-11-30"}),
    )
    .unwrap();
    assert_eq!(
        (later["vanzari"]["net"].as_i64(), later["cost_marfuri"].as_i64()),
        (Some(0), Some(0))
    );
    // The stock at the end of 1 November: 10 bags, before the invoice.
    let first = call(
        &mut ws,
        &mm,
        "report",
        json!({"de_la": "2026-11-01", "pana_la": "2026-11-01"}),
    )
    .unwrap();
    assert_eq!(first["stoc_valoare"], 25_000);
    assert!(
        call(
            &mut ws,
            &mm,
            "report",
            json!({"de_la": "2026-11-30", "pana_la": "2026-11-01"})
        )
        .is_err()
    );

    // Storno of the invoice: sales and cost of goods come back to 0.
    call(
        &mut ws,
        &mm,
        "invoice_storno",
        json!({"id": inv["id"], "data": "2026-11-05"}),
    )
    .unwrap();
    let r2 = call(
        &mut ws,
        &mm,
        "report",
        json!({"de_la": "2026-11-01", "pana_la": "2026-11-30"}),
    )
    .unwrap();
    assert_eq!(
        (
            r2["vanzari"]["total"].as_i64(),
            r2["cost_marfuri"].as_i64(),
            r2["stoc_valoare"].as_i64()
        ),
        (Some(0), Some(0), Some(25_000))
    );

    // Export: XLSX with the tables, reopened with the same numbers; one table as CSV.
    let x = tmp.path().join("raport.xlsx");
    call(
        &mut ws,
        &mm,
        "report_export",
        json!({"de_la": "2026-11-01", "pana_la": "2026-11-30", "format": "xlsx", "dest": x}),
    )
    .unwrap();
    let b = book::read(&std::fs::read(&x).unwrap(), Format::Xlsx).unwrap();
    let names: Vec<&str> = b.sheets.iter().map(|s| s.name.as_str()).collect();
    assert_eq!(
        names,
        [
            "Rezumat",
            "Vânzări pe clienți",
            "Vânzări pe produse",
            "Cheltuieli pe categorii",
            "Cheltuieli pe furnizori",
            "Stoc"
        ]
    );
    let cell = |r: u32, c: u32| {
        b.sheets[0]
            .values
            .get_value((r, c))
            .and_then(book::show)
            .map(|x| x.0)
            .unwrap_or_default()
    };
    assert_eq!(cell(3, 1), "1030");
    assert_eq!(cell(5, 1), "250");
    let c = tmp.path().join("chelt.csv");
    call(&mut ws, &mm, "report_export", json!({"de_la": "2026-11-01", "pana_la": "2026-11-30", "format": "csv", "tabel": "Cheltuieli pe categorii", "dest": c})).unwrap();
    let text = String::from_utf8(std::fs::read(&c).unwrap()[3..].to_vec()).unwrap();
    assert!(text.contains("chirie;1000;210;1210"), "{text}");
}
