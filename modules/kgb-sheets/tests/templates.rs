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
fn the_library_lists_twelve_templates() {
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
        [
            "buget-lunar",
            "factura",
            "registru-casa",
            "cost-km",
            "rate-credit",
            "deviz",
            "centralizator",
            "situatie-plata",
            "inventar",
            "pontaj",
            "flux-numerar",
            "comparatie-oferte"
        ]
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

/// Step 7.4i. Deviz: 45 × 95 = 4275; 90 × 38.50 = 3465; 90 × 24 = 2160;
/// direct 9900; indirect 10% = 990; profit 4% of 10890 = 435.60;
/// without VAT 11325.60; VAT 21% = 2378.376 → 2378.38; total 13703.98.
#[test]
fn works_estimate() {
    let (_t, mut ws, mm) = setup();
    let id = use_t(&mut ws, &mm, "deviz");
    for (cell, want) in [("F12", 4275.0), ("F13", 3465.0), ("F14", 2160.0), ("F15", 0.0), ("F22", 9900.0), ("F23", 990.0), ("F24", 435.6), ("F25", 11325.6), ("F26", 2378.38), ("F27", 13703.98)] {
        let v = get(&mut ws, &mm, &id, "Deviz", cell);
        assert!(close(&v, want), "{cell}: {v} ≠ {want}");
    }
}

/// Centralizator: rows 24000, 60000, 36000; columns 57000, 48000, 10000,
/// 5000; total 120000; shares 20%, 50%, 30%.
#[test]
fn cost_summary() {
    let (_t, mut ws, mm) = setup();
    let id = use_t(&mut ws, &mm, "centralizator");
    for (cell, want) in [("F5", 24000.0), ("F6", 60000.0), ("F7", 36000.0), ("B15", 57000.0), ("C15", 48000.0), ("D15", 10000.0), ("E15", 5000.0), ("F15", 120000.0), ("G5", 0.2), ("G6", 0.5), ("G7", 0.3)] {
        let v = get(&mut ws, &mm, &id, "Centralizator", cell);
        assert!(close(&v, want), "{cell}: {v} ≠ {want}");
    }
}

/// Situație de plată: 150 × 32 = 4800 (cumulated 450 × 32 = 14400, 50 left);
/// 60 × 520 = 31200 (cumulated 100 × 520 = 52000, 20 left); period 36000,
/// cumulated 66400; VAT 7560; retention 5% = 1800; to pay 41760.
#[test]
fn payment_statement() {
    let (_t, mut ws, mm) = setup();
    let id = use_t(&mut ws, &mm, "situatie-plata");
    for (cell, want) in [("G9", 4800.0), ("H9", 14400.0), ("I9", 50.0), ("G10", 31200.0), ("H10", 52000.0), ("I10", 20.0), ("G19", 36000.0), ("H19", 66400.0), ("G20", 7560.0), ("G21", 1800.0), ("G22", 41760.0)] {
        let v = get(&mut ws, &mm, &id, "Situație de plată", cell);
        assert!(close(&v, want), "{cell}: {v} ≠ {want}");
    }
}

/// Inventar: ciment 120 vs 118 × 32.50 → 3900 / 3835, −2, −65, „minus”;
/// cărămidă equal; oțel 800 vs 812 × 5.40 → 4320 / 4384.80, +12, +64.80,
/// „plus”; totals 14220 / 14219.80, difference −0.20.
#[test]
fn stock_count() {
    let (_t, mut ws, mm) = setup();
    let id = use_t(&mut ws, &mm, "inventar");
    let g = |ws: &mut Workspace, a1: &str| get(ws, &mm, &id, "Inventar", a1);
    for (cell, want) in [("G6", 3900.0), ("H6", 3835.0), ("I6", -2.0), ("J6", -65.0), ("I7", 0.0), ("G8", 4320.0), ("H8", 4384.8), ("I8", 12.0), ("J8", 64.8), ("G26", 14220.0), ("H26", 14219.8), ("J26", -0.2)] {
        let v = g(&mut ws, cell);
        assert!(close(&v, want), "{cell}: {v} ≠ {want}");
    }
    assert_eq!(g(&mut ws, "K6"), "minus");
    assert_eq!(g(&mut ws, "K7"), "");
    assert_eq!(g(&mut ws, "K8"), "plus");
}

/// The models' warning is on a sheet of its own, not on the sheet that is printed (owner, 10 nov. 2026).
#[test]
fn the_warning_is_not_on_the_printed_sheet() {
    let (_t, mut ws, mm) = setup();
    for (t, sheet) in [("factura", "Factură"), ("buget-lunar", "Buget"), ("deviz", "Deviz")] {
        let id = use_t(&mut ws, &mm, t);
        assert_eq!(get(&mut ws, &mm, &id, sheet, "A2"), "", "{t}: row 2 of the printed sheet");
        assert!(get(&mut ws, &mm, &id, "Despre model", "A3").contains("orientativ"), "{t}");
    }
}

/// 7.9d Pontaj: Popescu 22 days × 8 h = 176 h, 22 days, 8 h over the 168 h norm; Ionescu the same but „CO”
/// on day 10: 168 h, 21 days, 0 over; totals 344 h, 43 days, 8 h.
#[test]
fn monthly_timesheet() {
    let (_t, mut ws, mm) = setup();
    let id = use_t(&mut ws, &mm, "pontaj");
    for (cell, want) in [("AG6", 176.0), ("AH6", 22.0), ("AI6", 8.0), ("AG7", 168.0), ("AH7", 21.0), ("AI7", 0.0), ("AG21", 344.0), ("AH21", 43.0), ("AI21", 8.0)] {
        let v = get(&mut ws, &mm, &id, "Pontaj", cell);
        assert!(close(&v, want), "{cell}: {v} ≠ {want}");
    }
    assert_eq!(get(&mut ws, &mm, &id, "Pontaj", "AG8"), "", "an empty line stays empty");
}

/// 7.9d Flux de numerar: 30 000 in and 3 500 + 9 000 + 14 000 + 2 500 = 29 000 out every month: net 1 000,
/// balance 20 000 + 1 000 = 21 000 after the first month and 32 000 after the twelfth; yearly 360 000 / 348 000.
#[test]
fn cash_flow() {
    let (_t, mut ws, mm) = setup();
    let id = use_t(&mut ws, &mm, "flux-numerar");
    for (cell, want) in [("B11", 30000.0), ("B20", 29000.0), ("B22", 1000.0), ("B23", 21000.0), ("C23", 22000.0), ("M23", 32000.0), ("N11", 360000.0), ("N20", 348000.0)] {
        let v = get(&mut ws, &mm, &id, "Flux de numerar", cell);
        assert!(close(&v, want), "{cell}: {v} ≠ {want}");
    }
    assert_eq!(get(&mut ws, &mm, &id, "Flux de numerar", "B24"), "");
}

/// 7.9d Comparație de oferte: paper 50 × 24.50 / 23.90 / 25.20 = 1 225 / 1 195 / 1 260 → B; toner 6 × 310 / 295 /
/// 289 = 1 860 / 1 770 / 1 734 → C; folders 200 × 1.90 / 2.10 / 1.85 = 380 / 420 / 370 → C; totals 3 465 /
/// 3 385 / 3 364, lowest per line 3 299; cheapest overall C.
#[test]
fn offer_comparison() {
    let (_t, mut ws, mm) = setup();
    let id = use_t(&mut ws, &mm, "comparatie-oferte");
    let g = |ws: &mut Workspace, a1: &str| get(ws, &mm, &id, "Comparație oferte", a1);
    for (cell, want) in [("D6", 1225.0), ("F6", 1195.0), ("H6", 1260.0), ("I6", 1195.0), ("I7", 1734.0), ("I8", 370.0), ("D21", 3465.0), ("F21", 3385.0), ("H21", 3364.0), ("I21", 3299.0)] {
        let v = g(&mut ws, cell);
        assert!(close(&v, want), "{cell}: {v} ≠ {want}");
    }
    assert_eq!(g(&mut ws, "J6"), "Furnizor B");
    assert_eq!(g(&mut ws, "J7"), "Furnizor C");
    assert_eq!(g(&mut ws, "J9"), "");
    assert_eq!(g(&mut ws, "D22"), "Furnizor C");
}
