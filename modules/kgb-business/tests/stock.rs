//! Step 5.1: stock = sum of movements; issues above stock refused; documents
//! never change, storno is visible and only once; minimum-stock reminders;
//! everything survives reopening.

use kgb_business::{Business, ID};
use kgb_core::modules::ModuleManager;
use kgb_core::notifications;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn manager() -> ModuleManager {
    ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap()
}

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn stock_of(ws: &mut Workspace, mm: &ModuleManager, product: &Value, wh: &Value) -> i64 {
    let rows = call(ws, mm, "stock", json!({"produs": product["id"], "depozit": wh["id"]})).unwrap();
    rows.as_array()
        .unwrap()
        .first()
        .map(|r| r["cantitate"].as_i64().unwrap())
        .unwrap_or(0)
}

#[test]
fn receive_issue_storno_and_reopen() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    let mut ws = Workspace::create(&dir, "T").unwrap();
    let mm = manager();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into()])
        .unwrap();

    let p = call(
        &mut ws,
        &mm,
        "product_save",
        json!({"cod": "CIM-40", "nume": "Ciment 40 kg", "um": "sac", "stoc_minim": "10"}),
    )
    .unwrap();
    let s = call(
        &mut ws,
        &mm,
        "product_save",
        json!({"cod": "SRB-6", "nume": "Șurub 6 mm", "um": "kg"}),
    )
    .unwrap();
    // The same code twice is refused.
    assert!(
        call(
            &mut ws,
            &mm,
            "product_save",
            json!({"cod": "CIM-40", "nume": "Alt ciment", "um": "sac"})
        )
        .is_err()
    );
    let a = call(&mut ws, &mm, "warehouse_save", json!({"nume": "Depozit central"})).unwrap();
    let b = call(&mut ws, &mm, "warehouse_save", json!({"nume": "Șantier Iași"})).unwrap();

    let nir = call(
        &mut ws,
        &mm,
        "receive",
        json!({"depozit": a["id"], "numar": "NIR 1", "data": "01.11.2026", "partener": "Furnizor SRL",
               "linii": [{"produs": p["id"], "cantitate": "25", "pret_unitar": "32,50"},
                         {"produs": s["id"], "cantitate": "2,5", "pret_unitar": "18"}]}),
    )
    .unwrap();
    assert_eq!(stock_of(&mut ws, &mm, &p, &a), 25_000);
    assert_eq!(stock_of(&mut ws, &mm, &s, &a), 2_500);

    // An issue above the stock is refused, saying what is there; nothing is written.
    let err = call(
        &mut ws,
        &mm,
        "issue",
        json!({"depozit": a["id"], "numar": "BC 1", "data": "02.11.2026",
               "linii": [{"produs": p["id"], "cantitate": "20"}, {"produs": p["id"], "cantitate": "6"}]}),
    )
    .unwrap_err()
    .to_string();
    assert!(err.contains("în depozit sunt 25, se cer 26"), "{err}");
    assert_eq!(stock_of(&mut ws, &mm, &p, &a), 25_000);
    // Other warehouse: nothing there.
    assert!(call(&mut ws, &mm, "issue", json!({"depozit": b["id"], "numar": "BC 2", "data": "02.11.2026", "linii": [{"produs": p["id"], "cantitate": "1"}]})).is_err());

    let issue = call(
        &mut ws,
        &mm,
        "issue",
        json!({"depozit": a["id"], "numar": "BC 1", "data": "02.11.2026", "linii": [{"produs": p["id"], "cantitate": "18"}]}),
    )
    .unwrap();
    assert_eq!(stock_of(&mut ws, &mm, &p, &a), 7_000);

    // Below the minimum (10): one reminder per day, not repeated.
    let n = mm.remind_all(&mut ws, "2026-11-02").unwrap();
    assert_eq!(n.len(), 1);
    assert_eq!(n[0].titlu, "Stoc sub minim: Ciment 40 kg");
    assert_eq!(n[0].text, "Depozit central: 7 sac (minim 10).");
    assert!(mm.remind_all(&mut ws, "2026-11-02").unwrap().is_empty());

    // Storno of the receipt is refused: 18 bags already left.
    let err = call(
        &mut ws,
        &mm,
        "storno",
        json!({"document": nir["document"], "data": "03.11.2026"}),
    )
    .unwrap_err()
    .to_string();
    assert!(err.contains("au ieșit deja"), "{err}");
    // Storno of the issue: the stock comes back; only once; the original stays.
    call(
        &mut ws,
        &mm,
        "storno",
        json!({"document": issue["document"], "data": "03.11.2026", "nota": "greșeală"}),
    )
    .unwrap();
    assert_eq!(stock_of(&mut ws, &mm, &p, &a), 25_000);
    assert!(
        call(
            &mut ws,
            &mm,
            "storno",
            json!({"document": issue["document"], "data": "03.11.2026"})
        )
        .is_err()
    );
    let docs = call(&mut ws, &mm, "documents", json!({})).unwrap();
    let docs = docs.as_array().unwrap();
    assert_eq!(docs.len(), 3, "receipt, issue and storno, all kept");
    assert!(docs.iter().any(|d| d["tip"] == "iesire" && d["stornat"] == true));
    assert!(docs.iter().any(|d| d["tip"] == "storno" && d["numar"] == "STORNO BC 1"));

    // Bad input refused: zero, negative, too many decimals, missing price, bad date.
    for (kind, line, date) in [
        (
            "receive",
            json!({"produs": p["id"], "cantitate": "0", "pret_unitar": "1"}),
            "01.11.2026",
        ),
        (
            "receive",
            json!({"produs": p["id"], "cantitate": "-1", "pret_unitar": "1"}),
            "01.11.2026",
        ),
        (
            "receive",
            json!({"produs": p["id"], "cantitate": "1,0001", "pret_unitar": "1"}),
            "01.11.2026",
        ),
        ("receive", json!({"produs": p["id"], "cantitate": "1"}), "01.11.2026"),
        (
            "receive",
            json!({"produs": p["id"], "cantitate": "1", "pret_unitar": "1"}),
            "31.02.2026",
        ),
    ] {
        assert!(
            call(
                &mut ws,
                &mm,
                kind,
                json!({"depozit": a["id"], "numar": "X", "data": date, "linii": [line]})
            )
            .is_err(),
            "{line} {date}"
        );
    }

    // After reopening: the same stock, recomputed from the movements.
    drop(ws);
    let mut ws = Workspace::open(&dir).unwrap();
    assert_eq!(stock_of(&mut ws, &mm, &p, &a), 25_000);
    assert_eq!(stock_of(&mut ws, &mm, &s, &a), 2_500);
    let moves = call(&mut ws, &mm, "movements", json!({"produs": p["id"]})).unwrap();
    let sum: i64 = moves
        .as_array()
        .unwrap()
        .iter()
        .map(|m| m["cantitate"].as_i64().unwrap())
        .sum();
    assert_eq!(sum, 25_000, "stock = sum of movements");
    let _ = notifications::list(&ws, false, 1);
}
