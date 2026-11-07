//! Step 3.7: calculation templates (D-036). Every template's formulas are
//! checked against values computed by hand (independently, in this file); the
//! values are read back from the stored file, the way any program sees them;
//! the original cannot change — editing a copy leaves the template as it was.

use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_sheets::{ID, Sheets};
use serde_json::{Value, json};

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Sheets::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["files.own".to_string()]).unwrap();
    (tmp, ws, mm)
}

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

/// Uses a template; returns the new document id and a reader of cells by A1.
fn use_t(ws: &mut Workspace, mm: &ModuleManager, t: &str) -> Value {
    call(ws, mm, "use_template", json!({"template": t})).unwrap()["document"]["id"].clone()
}

fn get(ws: &mut Workspace, mm: &ModuleManager, id: &Value, sheet: &str, a1: &str) -> String {
    let (r, c) = kgb_sheets::save::parse_ref(a1).unwrap();
    let w = call(
        ws,
        mm,
        "cells",
        json!({"id": id, "sheet": sheet, "row0": r - 1, "rows": 1, "col0": c - 1, "cols": 1}),
    )
    .unwrap();
    w["rows"][0][0]["v"].as_str().unwrap_or("").to_string()
}

fn money(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

fn close(got: &str, want: f64) -> bool {
    got.parse::<f64>().is_ok_and(|g| (g - want).abs() < 1e-6)
}

#[test]
fn the_library_lists_five_templates() {
    let (_t, mut ws, mm) = setup();
    let l = call(&mut ws, &mm, "templates", json!({})).unwrap();
    let ids: Vec<&str> = l["templates"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t["id"].as_str().unwrap())
        .collect();
    assert_eq!(
        ids,
        ["buget-lunar", "factura", "registru-casa", "cost-km", "rate-credit"]
    );
    assert!(l["note"].as_str().unwrap().contains("orientativ"));
    assert!(call(&mut ws, &mm, "use_template", json!({"template": "nu-exista"})).is_err());
}

#[test]
fn monthly_budget() {
    let (_t, mut ws, mm) = setup();
    let id = use_t(&mut ws, &mm, "buget-lunar");
    let g = |ws: &mut Workspace, a1: &str| get(ws, &mm, &id, "Buget", a1);
    // Income 8000+500 planned, 8200+300 actual; spending 2000+600+1800+500+700
    // planned, 2000+650+1700+560+400 actual.
    for (cell, want) in [
        ("B8", 8500.0),
        ("C8", 8500.0),
        ("D8", 0.0),
        ("B16", 5600.0),
        ("C16", 5310.0),
        ("D16", -290.0),
        ("B18", 2900.0),
        ("C18", 3190.0),
        ("D18", 290.0),
        ("D6", 200.0),
        ("E6", 8200.0 / 8000.0),
        ("E12", 650.0 / 600.0),
    ] {
        let v = g(&mut ws, cell);
        assert!(close(&v, want), "{cell}: {v} ≠ {want}");
    }
}

#[test]
fn invoice() {
    let (_t, mut ws, mm) = setup();
    let id = use_t(&mut ws, &mm, "factura");
    let g = |ws: &mut Workspace, a1: &str| get(ws, &mm, &id, "Factură", a1);
    // 12 × 85.50 = 1026.00 (VAT 21% = 215.46); 1 × 250 = 250.00 (52.50);
    // 40 × 3.25 = 130.00 (27.30); totals 1406.00 + 295.26 = 1701.26.
    for (cell, want) in [
        ("F11", 1026.0),
        ("G11", 215.46),
        ("F12", 250.0),
        ("G12", 52.5),
        ("F13", 130.0),
        ("G13", 27.3),
        ("F14", 0.0),
        ("F20", 1406.0),
        ("F21", 295.26),
        ("F22", 1701.26),
        ("B8", 0.21),
    ] {
        let v = g(&mut ws, cell);
        assert!(close(&v, want), "{cell}: {v} ≠ {want}");
    }
}

#[test]
fn cash_register() {
    let (_t, mut ws, mm) = setup();
    let id = use_t(&mut ws, &mm, "registru-casa");
    let g = |ws: &mut Workspace, a1: &str| get(ws, &mm, &id, "Registru", a1);
    // 1000 +500 −200 +1200 −350.50 −100 +75.25.
    let mut bal = 1000.0;
    for (i, (inc, pay)) in [
        (500.0, 0.0),
        (0.0, 200.0),
        (1200.0, 0.0),
        (0.0, 350.5),
        (0.0, 100.0),
        (75.25, 0.0),
    ]
    .iter()
    .enumerate()
    {
        bal = money(bal + inc - pay);
        let cell = format!("F{}", 5 + i);
        let v = g(&mut ws, &cell);
        assert!(close(&v, bal), "{cell}: {v} ≠ {bal}");
    }
    assert_eq!(g(&mut ws, "A5"), "03.11.2026");
    assert!(
        close(&g(&mut ws, "F34"), 2124.75),
        "the balance carries down empty rows"
    );
    assert!(close(&g(&mut ws, "D35"), 1775.25));
    assert!(close(&g(&mut ws, "E35"), 650.5));
    assert!(close(&g(&mut ws, "F36"), 2124.75));
    assert!(close(&g(&mut ws, "F37"), 2124.75));
    assert_eq!(g(&mut ws, "F38"), "corect");
}

#[test]
fn cost_per_km() {
    let (_t, mut ws, mm) = setup();
    let id = use_t(&mut ws, &mm, "cost-km");
    let g = |ws: &mut Workspace, a1: &str| get(ws, &mm, &id, "Cost km", a1);
    // 450 km × 7.5 l/100 km = 33.75 l; × 7.20 lei = 243.00; + 35 + 40 = 318.00; / 450 = 0.71.
    for (cell, want) in [("B12", 33.75), ("B13", 243.0), ("B14", 318.0), ("B15", 0.71)] {
        let v = g(&mut ws, cell);
        assert!(close(&v, want), "{cell}: {v} ≠ {want}");
    }
}

#[test]
fn loan_payments() {
    let (_t, mut ws, mm) = setup();
    let id = use_t(&mut ws, &mm, "rate-credit");
    let g = |ws: &mut Workspace, a1: &str| get(ws, &mm, &id, "Rate", a1);
    // Annuity: P · r / (1 − (1 + r)^−n), r = 8% / 12, n = 60, P = 50,000.
    let (p, r, n) = (50_000.0f64, 0.08f64 / 12.0, 60u32);
    let pay = money(p * r / (1.0 - (1.0 + r).powi(-(n as i32))));
    assert_eq!(pay, 1013.82, "the textbook value");
    assert!(close(&g(&mut ws, "B8"), pay), "{}", g(&mut ws, "B8"));
    // The schedule, month by month, computed here independently.
    let (mut bal, mut total, mut interest) = (p, 0.0, 0.0);
    for m in 1..=n {
        let x = 12 + m;
        let i = money(bal * r);
        let principal = if m == n { bal } else { money(pay - i) };
        let row = |c: &str| format!("{c}{x}");
        assert!(close(&g(&mut ws, &row("B")), money(bal)), "month {m} start");
        assert!(close(&g(&mut ws, &row("D")), i), "month {m} interest");
        assert!(close(&g(&mut ws, &row("E")), money(principal)), "month {m} principal");
        bal = money(bal - principal);
        assert!(
            close(&g(&mut ws, &row("F")), bal),
            "month {m} end: {} ≠ {bal}",
            g(&mut ws, &row("F"))
        );
        total = money(total + i + principal);
        interest = money(interest + i);
    }
    assert_eq!(bal, 0.0, "the loan is fully repaid");
    assert!(
        close(&g(&mut ws, "B9"), total),
        "total paid {} ≠ {total}",
        g(&mut ws, "B9")
    );
    assert!(
        close(&g(&mut ws, "B10"), interest),
        "total interest {} ≠ {interest}",
        g(&mut ws, "B10")
    );
    assert_eq!(g(&mut ws, "A73"), "", "no month 61");
}

#[test]
fn editing_a_copy_never_changes_the_template() {
    let (_t, mut ws, mm) = setup();
    let id = use_t(&mut ws, &mm, "factura");
    let r = call(
        &mut ws,
        &mm,
        "save",
        json!({"id": id, "based_on": 1, "edits": [{"sheet": "Factură", "cell": "D11", "input": "100"}], "apply": true}),
    )
    .unwrap();
    assert_eq!(r["version"], 2);
    assert!(
        close(&get(&mut ws, &mm, &id, "Factură", "F11"), 8550.0),
        "copy recalculated: 100 × 85.50"
    );
    assert!(
        close(
            &get(&mut ws, &mm, &id, "Factură", "F22"),
            money((8550.0 + 380.0) * 1.21)
        ),
        "total with VAT"
    );
    // A new use of the template starts from the original values again.
    let again = use_t(&mut ws, &mm, "factura");
    assert!(close(&get(&mut ws, &mm, &again, "Factură", "F11"), 1026.0));
}
