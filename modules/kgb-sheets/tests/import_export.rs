//! Step 3.8: import/export — CSV export in the Romanian and the standard
//! style, diacritics, separators inside text, line breaks inside cells, old
//! Windows encoding, conversion of read-only formats into editable XLSX, and
//! damaged files refused clearly.

use std::path::{Path, PathBuf};

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_sheets::{ID, Sheets};
use serde_json::{Value, json};

fn td(rel: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../testdata/etapa3")
        .join(rel)
}

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

fn import(ws: &mut Workspace, mm: &ModuleManager, rel: &str) -> CoreResult<Value> {
    let name = Path::new(rel).file_name().unwrap().to_string_lossy().to_string();
    call(
        ws,
        mm,
        "import",
        json!({"name": name, "data": B64.encode(std::fs::read(td(rel)).unwrap())}),
    )
}

fn cell(ws: &mut Workspace, mm: &ModuleManager, id: &Value, sheet: &str, r: u32, c: u32) -> String {
    let w = call(
        ws,
        mm,
        "cells",
        json!({"id": id, "sheet": sheet, "row0": r - 1, "rows": 1, "col0": c - 1, "cols": 1}),
    )
    .unwrap();
    w["rows"][0][0]["v"].as_str().unwrap_or("").to_string()
}

#[test]
fn csv_export_in_the_romanian_style_reads_back_identically() {
    let (tmp, mut ws, mm) = setup();
    let id = import(&mut ws, &mm, "files/xlsx/formule.xlsx").unwrap()["document"]["id"].clone();
    let dest = tmp.path().join("formule.csv");
    let r = call(
        &mut ws,
        &mm,
        "export_csv",
        json!({"id": id, "sheet": "Formule", "style": "ro", "dest": dest}),
    )
    .unwrap();
    assert_eq!(r["rows"], 19);
    let bytes = std::fs::read(&dest).unwrap();
    assert!(
        bytes.starts_with(b"\xEF\xBB\xBF"),
        "UTF-8 mark for spreadsheet programs"
    );
    let text = String::from_utf8(bytes[3..].to_vec()).unwrap();
    let lines: Vec<&str> = text.split("\r\n").collect();
    assert_eq!(lines[0], "Nume;Valoare");
    assert_eq!(lines[2], "pere;7,5", "decimal comma");
    assert_eq!(lines[7], "SUM;71,75", "a formula is exported as its value");
    // Import the exported file again: the same values come back.
    let back = call(
        &mut ws,
        &mm,
        "import",
        json!({"name": "inapoi.csv", "data": B64.encode(std::fs::read(&dest).unwrap())}),
    )
    .unwrap();
    let bid = back["document"]["id"].clone();
    assert_eq!(cell(&mut ws, &mm, &bid, "CSV", 8, 2), "71,75");
    assert_eq!(cell(&mut ws, &mm, &bid, "CSV", 10, 2), "mare");
}

#[test]
fn csv_export_in_the_standard_style_keeps_diacritics_quotes_and_line_breaks() {
    let (tmp, mut ws, mm) = setup();
    // Text with commas, quotes and a line break inside a cell.
    let id = import(&mut ws, &mm, "files/csv/ghilimele-multilinie.csv").unwrap()["document"]["id"].clone();
    let dest = tmp.path().join("ghilimele.csv");
    call(
        &mut ws,
        &mm,
        "export_csv",
        json!({"id": id, "sheet": "CSV", "style": "standard", "bom": false, "dest": dest}),
    )
    .unwrap();
    let text = std::fs::read_to_string(&dest).unwrap();
    assert!(text.contains("\"are, virgulă\""), "{text}");
    assert!(text.contains("\"are \"\"ghilimele\"\"\""), "{text}");
    assert!(text.contains("\"pe două\r\nrânduri\""), "{text}");
    // Diacritics from a workbook with several sheets.
    let id = import(&mut ws, &mm, "files/xlsx/diacritice-foi-multiple.xlsx").unwrap()["document"]["id"].clone();
    let dest = tmp.path().join("sumar.csv");
    call(
        &mut ws,
        &mm,
        "export_csv",
        json!({"id": id, "sheet": "Sumar ș ț", "style": "standard", "dest": dest}),
    )
    .unwrap();
    let text = String::from_utf8(std::fs::read(&dest).unwrap()[3..].to_vec()).unwrap();
    assert_eq!(text, "Total încasări,2180.75\r\nĂÂÎȘȚ ăâîșț,2890.75\r\n");
}

#[test]
fn a_csv_in_the_old_windows_encoding_converts_to_an_editable_workbook() {
    let (_t, mut ws, mm) = setup();
    let id = import(&mut ws, &mm, "files/csv/windows-1250.csv").unwrap()["document"]["id"].clone();
    let c = call(&mut ws, &mm, "convert", json!({"id": id})).unwrap();
    assert_eq!(c["document"]["name"], "windows-1250.xlsx");
    let xid = c["document"]["id"].clone();
    let info = call(&mut ws, &mm, "info", json!({"id": xid})).unwrap();
    assert_eq!(info["editable"], true);
    assert_eq!(cell(&mut ws, &mm, &xid, "CSV", 2, 2), "Ţăndărei");
    // Now it can be edited like any XLSX; the CSV itself is untouched.
    call(&mut ws, &mm, "save", json!({"id": xid, "based_on": 1, "edits": [{"sheet": "CSV", "cell": "C2", "input": "=LEN(B2)"}], "apply": true})).unwrap();
    assert_eq!(cell(&mut ws, &mm, &xid, "CSV", 2, 3), "8");
    assert_eq!(call(&mut ws, &mm, "info", json!({"id": id})).unwrap()["version"], 1);
    // An XLSX is not "converted" again.
    assert!(
        call(&mut ws, &mm, "convert", json!({"id": xid}))
            .unwrap_err()
            .to_string()
            .contains("deja")
    );
}

#[test]
fn separators_are_detected_outside_quotes() {
    let b = kgb_sheets::book::read_csv(b"\"a;b\",c,d\r\n1,2,3\r\n").unwrap();
    let s = &b.sheets[0];
    assert_eq!(s.size(), (2, 3), "the ; inside quotes is text, the separator is ,");
    let b = kgb_sheets::book::read_csv("Nume;Sumă\nIon;\"1,5\"\n".as_bytes()).unwrap();
    assert_eq!(b.sheets[0].size(), (2, 2));
}

#[test]
fn ods_and_xls_files_convert_with_their_values_when_present() {
    let (_t, mut ws, mm) = setup();
    let mut done = 0;
    for f in [
        "extern/ods/SampleSS.ods",
        "extern/xls/SampleSS.xls",
        "extern/ods/formula-across-sheets.ods",
    ] {
        if !td(f).exists() {
            continue;
        }
        let d = import(&mut ws, &mm, f).unwrap();
        let id = d["document"]["id"].clone();
        let c = call(&mut ws, &mm, "convert", json!({"id": id})).unwrap();
        let xid = c["document"]["id"].clone();
        // Same sheets, same first rows (the module verified every cell).
        let src = call(&mut ws, &mm, "info", json!({"id": id})).unwrap();
        let out = call(&mut ws, &mm, "info", json!({"id": xid})).unwrap();
        assert_eq!(
            src["sheets"].as_array().unwrap().len(),
            out["sheets"].as_array().unwrap().len(),
            "{f}"
        );
        let s0 = src["sheets"][0]["name"].as_str().unwrap().to_string();
        let o0 = out["sheets"][0]["name"].as_str().unwrap().to_string();
        assert_eq!(
            cell(&mut ws, &mm, &id, &s0, 1, 1),
            cell(&mut ws, &mm, &xid, &o0, 1, 1),
            "{f}"
        );
        done += 1;
    }
    if done == 0 {
        eprintln!("corpusul extern lipsește: python testdata/etapa3/extern.py");
    }
}

#[test]
fn damaged_and_unknown_files_are_refused_clearly() {
    let (_t, mut ws, mm) = setup();
    for (f, why) in [
        ("files/xlsx/stricat-trunchiat.xlsx", "deteriorat"),
        ("files/xlsx/nu-e-zip.xlsx", "deteriorat"),
        ("files/pdf/simplu-1-pagina.pdf", "formatul nu este acceptat"),
    ] {
        let err = import(&mut ws, &mm, f).unwrap_err().to_string();
        assert!(err.contains(why), "{f}: {err}");
    }
    let id = import(&mut ws, &mm, "files/xlsx/simplu.xlsx").unwrap()["document"]["id"].clone();
    let err = call(
        &mut ws,
        &mm,
        "export_csv",
        json!({"id": id, "sheet": "Date", "style": "excel", "dest": "x.csv"}),
    )
    .unwrap_err();
    assert!(err.to_string().contains("ro, standard"), "{err}");
    let err = call(
        &mut ws,
        &mm,
        "export_csv",
        json!({"id": id, "sheet": "Nu", "style": "ro", "dest": "x.csv"}),
    )
    .unwrap_err();
    assert!(err.to_string().contains("nu există"), "{err}");
}
