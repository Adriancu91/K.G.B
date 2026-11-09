//! IronCalc probe (Etapa 7, step 7.4l-4, D-073 plan): runs a list of formulas
//! on IronCalc, the calculation engine of K.G.B., and prints each result with
//! its type, so the formula tests of Cyber Office Studio can be compared
//! against it (the comparison itself is done on the COS side, with the
//! tolerances of its tests).
//!
//! Input (a JSON file given as the first argument, or stdin): an array of
//! cases `{ "id"?, "formula": "=SUM(A1:A3)", "cells"?: {"A1": "1", "B2": "text"},
//! "cell"?: "J10", "sheets"?: ["Foaie2"] }`. `cells` are typed in as a user
//! would (numbers, text, other formulas); names like `Foaie2!A1` go to that
//! sheet (created on demand). The formula goes in `cell` (default J10).
//!
//! Output (stdout): an array of `{ "id", "formula", "type", "result" }` where
//! `type` is `number`, `text`, `boolean`, `error`, `array` (`result` = rows of
//! the spilled values), `empty`, or `input_error` / `panic` (with the reason).
//!
//! Use: `ironcalc-probe cases.json > out.json` (or the input on stdin).
//!
//! Two more modes, for the measurement agreed with the COS session (D-073):
//! - `ironcalc-probe xlsx <file.xlsx>`: loads the workbook with IronCalc's
//!   import, recalculates everything and prints every formula cell as
//!   `{ "sheet", "cell", "formula", "value", "type" }` (cells without a
//!   formula are left out);
//! - `ironcalc-probe json <file.json>`: input `{"cells": {"A1": "9700",
//!   "H1": "=XLOOKUP(...)"}}`, one sheet named „Foaia 1”; values may use the
//!   decimal comma (9,5), as in the COS tests; same output, per formula cell.

use std::io::Read;

use ironcalc::base::Model;
use ironcalc::base::cell::CellValue;
use ironcalc::base::types::{Cell, CellType};
use serde_json::{Value, json};

/// "B12" → (row 12, column 2), 1-based.
fn cell_ref(r: &str) -> Option<(i32, i32)> {
    let r = r.trim().to_ascii_uppercase();
    let letters: String = r.chars().take_while(char::is_ascii_alphabetic).collect();
    let digits = &r[letters.len()..];
    if letters.is_empty() || digits.is_empty() {
        return None;
    }
    let col = letters.bytes().fold(0i32, |a, b| a * 26 + i32::from(b - b'A' + 1));
    let row: i32 = digits.parse().ok()?;
    (row >= 1 && col >= 1).then_some((row, col))
}

fn value(m: &Model, s: u32, r: i32, c: i32) -> Value {
    match m.get_cell_value_by_index(s, r, c) {
        Ok(CellValue::Number(n)) => json!(n),
        Ok(CellValue::String(t)) => json!(t),
        Ok(CellValue::Boolean(b)) => json!(b),
        Ok(CellValue::None) | Err(_) => Value::Null,
    }
}

fn kind(m: &Model, s: u32, r: i32, c: i32) -> &'static str {
    if matches!(m.get_cell_value_by_index(s, r, c), Ok(CellValue::None)) {
        return "empty";
    }
    match m.get_cell_type(s, r, c) {
        Ok(CellType::Number) => "number",
        Ok(CellType::Text) => "text",
        Ok(CellType::LogicalValue) => "boolean",
        Ok(CellType::ErrorValue) => "error",
        Ok(CellType::Array) => "number",
        Ok(CellType::CompoundData) => "text",
        Err(_) => "empty",
    }
}

fn run(case: &Value) -> Result<(&'static str, Value), String> {
    let formula = case["formula"].as_str().ok_or("lipsește „formula”")?;
    let mut m = Model::new_empty("probe", "en", "UTC", "en")?;
    // Sheets by name (the first one is "Sheet1").
    let sheet_of = |m: &mut Model, name: &str| -> Result<u32, String> {
        let names: Vec<String> = m.get_worksheets_properties().iter().map(|p| p.name.clone()).collect();
        if let Some(i) = names.iter().position(|n| n.eq_ignore_ascii_case(name)) {
            return Ok(i as u32);
        }
        m.add_sheet(name)?;
        Ok(names.len() as u32)
    };
    for s in case["sheets"].as_array().into_iter().flatten().filter_map(Value::as_str) {
        sheet_of(&mut m, s)?;
    }
    if let Some(cells) = case["cells"].as_object() {
        for (addr, v) in cells {
            let (sheet, a) = match addr.rsplit_once('!') {
                Some((s, a)) => (sheet_of(&mut m, s.trim_matches('\''))?, a),
                None => (0, addr.as_str()),
            };
            let (r, c) = cell_ref(a).ok_or_else(|| format!("adresă greșită: {addr}"))?;
            let text = match v {
                Value::String(t) => t.clone(),
                Value::Bool(b) => (if *b { "TRUE" } else { "FALSE" }).to_string(),
                other => other.to_string(),
            };
            m.set_user_input(sheet, r, c, text).map_err(|e| format!("{addr}: {e}"))?;
        }
    }
    let (r, c) = cell_ref(case["cell"].as_str().unwrap_or("J10")).ok_or("„cell” greșit")?;
    m.set_user_input(0, r, c, formula.to_string()).map_err(|e| format!("formula: {e}"))?;
    m.evaluate();
    // A dynamic array formula: its anchor knows the spill size (width, height).
    let spill = m.workbook.worksheet(0).ok().and_then(|w| match w.cell(r, c).as_deref() {
        Some(Cell::ArrayFormula { r: (w, h), .. }) if *w * *h > 1 => Some((*w, *h)),
        _ => None,
    });
    if let Some((w, h)) = spill {
        let rows: Vec<Value> = (0..h).map(|dr| Value::Array((0..w).map(|dc| value(&m, 0, r + dr, c + dc)).collect())).collect();
        return Ok(("array", Value::Array(rows)));
    }
    let t = kind(&m, 0, r, c);
    Ok((t, value(&m, 0, r, c)))
}

/// (row, column) → "B12".
fn cell_name(row: i32, col: i32) -> String {
    let mut c = col;
    let mut letters = Vec::new();
    while c > 0 {
        let d = ((c - 1) % 26) as u8;
        letters.push((b'A' + d) as char);
        c = (c - 1) / 26;
    }
    letters.iter().rev().collect::<String>() + &row.to_string()
}

/// "9,5" / "1.234,5" → "9.5" / "1234.5" (values typed the Romanian way); other text as it is.
fn decimal_point(t: &str) -> String {
    let s = t.trim();
    let num_like = !s.is_empty() && s.chars().all(|c| c.is_ascii_digit() || matches!(c, ',' | '.' | '-' | '+')) && s.contains(',');
    if num_like { s.replace('.', "").replace(',', ".") } else { t.to_string() }
}

/// Every formula cell of every sheet, after recalculating.
fn formula_cells(m: &mut Model) -> Vec<Value> {
    m.evaluate();
    let names: Vec<String> = m.get_worksheets_properties().iter().map(|p| p.name.clone()).collect();
    let mut out = Vec::new();
    for c in m.get_all_cells() {
        let Ok(Some(f)) = m.get_cell_formula(c.index, c.row, c.column) else { continue };
        let (t, v) = (kind(m, c.index, c.row, c.column), value(m, c.index, c.row, c.column));
        out.push(json!({"sheet": names.get(c.index as usize), "cell": cell_name(c.row, c.column), "formula": f, "value": v, "type": t}));
    }
    out
}

fn mode_xlsx(path: &str) -> Result<Vec<Value>, String> {
    let mut m = ironcalc::import::load_from_xlsx(path, "en", "UTC", "en").map_err(|e| format!("{path}: {e:?}"))?;
    Ok(formula_cells(&mut m))
}

fn mode_json(path: &str) -> Result<Vec<Value>, String> {
    let input: Value = serde_json::from_str(&std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?).map_err(|e| format!("{path}: {e}"))?;
    let mut m = Model::new_empty("probe", "en", "UTC", "en")?;
    m.rename_sheet_by_index(0, "Foaia 1")?;
    for (addr, v) in input["cells"].as_object().ok_or("lipsește „cells”")? {
        let (r, c) = cell_ref(addr).ok_or_else(|| format!("adresă greșită: {addr}"))?;
        let text = match v {
            Value::String(t) if t.starts_with('=') => t.clone(),
            Value::String(t) => decimal_point(t),
            Value::Bool(b) => (if *b { "TRUE" } else { "FALSE" }).to_string(),
            other => other.to_string(),
        };
        m.set_user_input(0, r, c, text).map_err(|e| format!("{addr}: {e}"))?;
    }
    Ok(formula_cells(&mut m))
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    std::panic::set_hook(Box::new(|_| {}));
    if let (Some(mode @ ("xlsx" | "json")), Some(path)) = (args.get(1).map(String::as_str), args.get(2)) {
        let path = path.clone();
        let res = std::panic::catch_unwind(|| if mode == "xlsx" { mode_xlsx(&path) } else { mode_json(&path) });
        match res {
            Ok(Ok(cells)) => println!("{}", serde_json::to_string_pretty(&cells).expect("json")),
            Ok(Err(e)) => {
                eprintln!("{e}");
                std::process::exit(2);
            }
            Err(_) => {
                eprintln!("IronCalc s-a oprit la acest fișier");
                std::process::exit(3);
            }
        }
        return;
    }
    cases_main();
}

fn cases_main() {
    let mut input = String::new();
    match std::env::args().nth(1) {
        Some(path) => input = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path}: {e}")),
        None => {
            std::io::stdin().read_to_string(&mut input).expect("stdin");
        }
    }
    let cases: Vec<Value> = serde_json::from_str(&input).expect("intrarea e o listă JSON de cazuri");
    let out: Vec<Value> = cases
        .iter()
        .map(|case| {
            let base = json!({"id": case.get("id").cloned().unwrap_or(Value::Null), "formula": case["formula"]});
            let (t, res) = match std::panic::catch_unwind(|| run(case)) {
                Ok(Ok((t, v))) => (t, v),
                Ok(Err(e)) => ("input_error", json!(e)),
                Err(_) => ("panic", json!("IronCalc s-a oprit la această formulă")),
            };
            let mut o = base;
            o["type"] = json!(t);
            o["result"] = res;
            o
        })
        .collect();
    println!("{}", serde_json::to_string_pretty(&out).expect("json"));
}
