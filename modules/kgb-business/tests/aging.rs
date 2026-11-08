//! Step 5.6: aging by days past due, the partner statement (its balances are
//! the same as the documents' remainders), due-date reminders once.

use kgb_business::aging::{bucket, days_between};
use kgb_business::{Business, ID};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

#[test]
fn days_and_buckets() {
    assert_eq!(days_between("2026-11-01", "2026-11-08"), Some(7));
    assert_eq!(days_between("2026-12-31", "2027-01-01"), Some(1));
    assert_eq!(days_between("2028-02-28", "2028-03-01"), Some(2), "leap year");
    assert_eq!(days_between("2026-11-08", "2026-11-01"), Some(-7));
    assert_eq!(
        [
            bucket(-3),
            bucket(0),
            bucket(1),
            bucket(30),
            bucket(31),
            bucket(90),
            bucket(91)
        ],
        [0, 0, 1, 1, 2, 3, 4]
    );
}

#[test]
fn aging_statement_and_reminders() {
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
    let issue = |ws: &mut Workspace, date: &str, due: &str, price: &str| {
        call(
            ws,
            &mm,
            "invoice_issue",
            json!({"serie": ser["id"], "partener": c["id"], "data": date, "scadenta": due,
            "linii": [{"descriere": "Servicii", "cantitate": "1", "pret_unitar": price, "cota_tva": 0}]}),
        )
        .unwrap()
    };
    // Today 2026-11-08: one invoice 45 days late, one 5 days late, one not yet due.
    let a = issue(&mut ws, "2026-09-01", "2026-09-24", "1000");
    issue(&mut ws, "2026-10-20", "2026-11-03", "300");
    issue(&mut ws, "2026-11-05", "2026-11-20", "200");
    // An expense from the same partner, due tomorrow.
    call(
        &mut ws,
        &mm,
        "purchase_save",
        json!({"furnizor": c["id"], "numar": "X-1", "data": "2026-11-01", "scadenta": "2026-11-09", "total": "80"}),
    )
    .unwrap();
    // 400 collected on the late invoice.
    let casa = call(&mut ws, &mm, "account_save", json!({"tip": "casa", "nume": "Casa"})).unwrap();
    call(&mut ws, &mm, "payment_save", json!({"cont": casa["id"], "data": "2026-10-01", "sens": "incasare", "suma": "400", "document": {"tip": "factura", "id": a["id"]}})).unwrap();

    let ag = call(&mut ws, &mm, "aging", json!({"azi": "2026-11-08"})).unwrap();
    let collect = &ag["rezumat"][0];
    assert_eq!(collect["tip"], "de_incasat");
    let per: Vec<i64> = collect["intervale"]
        .as_array()
        .unwrap()
        .iter()
        .map(|x| x["suma"].as_i64().unwrap())
        .collect();
    // not yet due 200; 1–30 days 300; 31–60 days 600 (1000 − 400)
    assert_eq!(per, [20_000, 30_000, 60_000, 0, 0]);
    assert_eq!(collect["total"], 110_000);
    assert_eq!(ag["rezumat"][1]["total"], 8_000, "to pay: the expense");
    assert_eq!(ag["randuri"][0]["zile_intarziere"], 45);

    let sheet = call(&mut ws, &mm, "partner_sheet", json!({"id": c["id"]})).unwrap();
    assert_eq!(sheet["de_incasat"], 110_000, "1000 + 300 + 200 − 400");
    assert_eq!(sheet["de_platit"], 8_000);
    let rows = sheet["randuri"].as_array().unwrap();
    assert_eq!(rows.len(), 5, "3 invoices, 1 expense, 1 payment");
    assert_eq!(rows.last().unwrap()["sold_incasat_text"], "1.100,00");

    // Reminders: the expense due tomorrow; nothing twice.
    let n = mm.remind_all(&mut ws, "2026-11-08").unwrap();
    assert_eq!(n.len(), 1, "{n:?}");
    assert_eq!(n[0].titlu, "De plătit mâine: Factură X-1 · Client SRL");
    assert!(mm.remind_all(&mut ws, "2026-11-08").unwrap().is_empty());
    let n = mm.remind_all(&mut ws, "2026-11-09").unwrap();
    assert!(n.iter().any(|x| x.titlu.starts_with("De plătit azi")));
    let n = mm.remind_all(&mut ws, "2026-11-19").unwrap();
    assert!(
        n.iter().any(|x| x.titlu.starts_with("De încasat mâine: Factura F 3")),
        "{n:?}"
    );
}
