//! Step 5.2: transfers, inventory and weighted average cost (D-050), checked
//! against examples calculated by hand.

use kgb_business::{Business, ID};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &["storage.own".into(), "notify.send".into(), "files.own".into()],
    )
    .unwrap();
    (tmp, ws, mm)
}

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

/// (quantity in thousandths, value in bani, average as text)
fn pos(ws: &mut Workspace, mm: &ModuleManager, p: &Value, w: &Value) -> (i64, i64, String) {
    let rows = call(ws, mm, "stock", json!({"produs": p["id"], "depozit": w["id"]})).unwrap();
    let r = &rows[0];
    (
        r["cantitate"].as_i64().unwrap(),
        r["valoare"].as_i64().unwrap(),
        r["cost_mediu_text"].as_str().unwrap_or("").to_string(),
    )
}

#[test]
fn weighted_average_by_hand() {
    let (_t, mut ws, mm) = setup();
    let p = call(
        &mut ws,
        &mm,
        "product_save",
        json!({"cod": "P1", "nume": "Placă", "um": "buc"}),
    )
    .unwrap();
    let a = call(&mut ws, &mm, "warehouse_save", json!({"nume": "A"})).unwrap();
    let b = call(&mut ws, &mm, "warehouse_save", json!({"nume": "B"})).unwrap();
    let line = |q: &str, pr: &str| json!([{"produs": p["id"], "cantitate": q, "pret_unitar": pr}]);
    let out = |q: &str| json!([{"produs": p["id"], "cantitate": q}]);

    // 10 × 10,00 = 100,00 ; + 5 × 13,00 = 65,00 → 15 buc, 165,00, average 11,00
    call(
        &mut ws,
        &mm,
        "receive",
        json!({"depozit": a["id"], "numar": "N1", "data": "2026-11-01", "linii": line("10", "10")}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "receive",
        json!({"depozit": a["id"], "numar": "N2", "data": "2026-11-02", "linii": line("5", "13")}),
    )
    .unwrap();
    assert_eq!(pos(&mut ws, &mm, &p, &a), (15_000, 16_500, "11,00".into()));
    // Issue 3 at 11,00 = 33,00 → 12 buc, 132,00
    let issue = call(
        &mut ws,
        &mm,
        "issue",
        json!({"depozit": a["id"], "numar": "BC1", "data": "2026-11-03", "linii": out("3")}),
    )
    .unwrap();
    assert_eq!(pos(&mut ws, &mm, &p, &a), (12_000, 13_200, "11,00".into()));
    // Transfer 4 to B: 44,00 leaves A and arrives in B
    let tr = call(
        &mut ws,
        &mm,
        "transfer",
        json!({"depozit": a["id"], "depozit_destinatie": b["id"], "numar": "T1", "data": "2026-11-04", "linii": out("4")}),
    )
    .unwrap();
    assert_eq!(pos(&mut ws, &mm, &p, &a), (8_000, 8_800, "11,00".into()));
    assert_eq!(pos(&mut ws, &mm, &p, &b), (4_000, 4_400, "11,00".into()));
    // Inventory A: counted 7 (1 missing, −11,00); B: counted 5 (1 found, +11,00 at the average)
    let inv = call(
        &mut ws,
        &mm,
        "inventory",
        json!({"depozit": a["id"], "numar": "INV1", "data": "2026-11-05", "linii": [{"produs": p["id"], "cantitate_numarata": "7"}]}),
    )
    .unwrap();
    assert_eq!(inv["linii"][0]["diferenta"], "-1");
    call(&mut ws, &mm, "inventory", json!({"depozit": b["id"], "numar": "INV2", "data": "2026-11-05", "linii": [{"produs": p["id"], "cantitate_numarata": "5"}]})).unwrap();
    assert_eq!(pos(&mut ws, &mm, &p, &a), (7_000, 7_700, "11,00".into()));
    assert_eq!(pos(&mut ws, &mm, &p, &b), (5_000, 5_500, "11,00".into()));
    // Storno of the issue: exactly its 33,00 comes back
    call(
        &mut ws,
        &mm,
        "storno",
        json!({"document": issue["document"], "data": "2026-11-06"}),
    )
    .unwrap();
    assert_eq!(pos(&mut ws, &mm, &p, &a), (10_000, 11_000, "11,00".into()));
    // Storno of the transfer is refused only if B no longer has the goods; here it has.
    call(
        &mut ws,
        &mm,
        "storno",
        json!({"document": tr["document"], "data": "2026-11-06"}),
    )
    .unwrap();
    assert_eq!(pos(&mut ws, &mm, &p, &a), (14_000, 15_400, "11,00".into()));
    assert_eq!(pos(&mut ws, &mm, &p, &b), (1_000, 1_100, "11,00".into()));

    // Total value = sum of the movement values (nothing lost or invented).
    let moves = call(&mut ws, &mm, "movements", json!({})).unwrap();
    let sum: i64 = moves
        .as_array()
        .unwrap()
        .iter()
        .map(|m| m["valoare"].as_i64().unwrap())
        .sum();
    assert_eq!(sum, 15_400 + 1_100);
}

#[test]
fn no_stray_bani_and_refusals() {
    let (_t, mut ws, mm) = setup();
    let p = call(
        &mut ws,
        &mm,
        "product_save",
        json!({"cod": "P2", "nume": "Șurub", "um": "kg"}),
    )
    .unwrap();
    let a = call(&mut ws, &mm, "warehouse_save", json!({"nume": "A"})).unwrap();
    let b = call(&mut ws, &mm, "warehouse_save", json!({"nume": "B"})).unwrap();
    // 3 × 3,33 = 9,99; out 1 → 3,33; out the last 2 → exactly the 6,66 left.
    call(&mut ws, &mm, "receive", json!({"depozit": a["id"], "numar": "N", "data": "2026-11-01", "linii": [{"produs": p["id"], "cantitate": "3", "pret_unitar": "3,33"}]})).unwrap();
    // 1/3 of 9,99 = 3,33
    call(&mut ws, &mm, "issue", json!({"depozit": a["id"], "numar": "B1", "data": "2026-11-02", "linii": [{"produs": p["id"], "cantitate": "1"}]})).unwrap();
    assert_eq!(pos(&mut ws, &mm, &p, &a), (2_000, 666, "3,33".into()));
    // 0,5 kg out of 2 kg worth 6,66 → 1,665 → 1,67 (half away from zero)
    call(&mut ws, &mm, "issue", json!({"depozit": a["id"], "numar": "B2", "data": "2026-11-03", "linii": [{"produs": p["id"], "cantitate": "0,5"}]})).unwrap();
    assert_eq!(pos(&mut ws, &mm, &p, &a), (1_500, 499, "3,33".into()));
    call(&mut ws, &mm, "issue", json!({"depozit": a["id"], "numar": "B3", "data": "2026-11-04", "linii": [{"produs": p["id"], "cantitate": "1,5"}]})).unwrap();
    assert_eq!(
        pos(&mut ws, &mm, &p, &a),
        (0, 0, String::new()),
        "empty stock, value exactly 0"
    );

    // Transfer refusals: same warehouse, more than the stock.
    assert!(call(&mut ws, &mm, "transfer", json!({"depozit": a["id"], "depozit_destinatie": a["id"], "numar": "T", "data": "2026-11-05", "linii": [{"produs": p["id"], "cantitate": "1"}]})).is_err());
    let err = call(&mut ws, &mm, "transfer", json!({"depozit": a["id"], "depozit_destinatie": b["id"], "numar": "T", "data": "2026-11-05", "linii": [{"produs": p["id"], "cantitate": "1"}]}))
        .unwrap_err()
        .to_string();
    assert!(err.contains("în „A” sunt 0, se cer 1"), "{err}");
    // Inventory refusals: negative count, the same product twice.
    assert!(call(&mut ws, &mm, "inventory", json!({"depozit": a["id"], "numar": "I", "data": "2026-11-05", "linii": [{"produs": p["id"], "cantitate_numarata": "-1"}]})).is_err());
    assert!(call(&mut ws, &mm, "inventory", json!({"depozit": a["id"], "numar": "I", "data": "2026-11-05", "linii": [{"produs": p["id"], "cantitate_numarata": "1"}, {"produs": p["id"], "cantitate_numarata": "2"}]})).is_err());
    // An inventory plus with no known cost comes in at 0 (shown, not invented).
    call(&mut ws, &mm, "inventory", json!({"depozit": b["id"], "numar": "I", "data": "2026-11-05", "linii": [{"produs": p["id"], "cantitate_numarata": "2"}]})).unwrap();
    assert_eq!(pos(&mut ws, &mm, &p, &b).0, 2_000);
    assert_eq!(pos(&mut ws, &mm, &p, &b).1, 0);
}
