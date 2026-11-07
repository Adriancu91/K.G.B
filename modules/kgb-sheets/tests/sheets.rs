//! Step 3.6: the spreadsheet module on the Etapa 3 test set (and on the
//! external corpus when it is present locally, `testdata/etapa3/extern`).

use std::io::Write as _;
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

fn import_bytes(ws: &mut Workspace, mm: &ModuleManager, name: &str, data: &[u8]) -> CoreResult<Value> {
    call(ws, mm, "import", json!({"name": name, "data": B64.encode(data)}))
}

fn import(ws: &mut Workspace, mm: &ModuleManager, rel: &str) -> CoreResult<Value> {
    let name = Path::new(rel).file_name().unwrap().to_string_lossy().to_string();
    import_bytes(ws, mm, &name, &std::fs::read(td(rel)).unwrap())
}

/// The cell at an A1 reference (1-based), as `{v, k, f}` or null.
fn cell(
    ws: &mut Workspace,
    mm: &ModuleManager,
    id: &Value,
    version: Option<u64>,
    sheet: &str,
    r: u32,
    c: u32,
) -> Value {
    let w = call(
        ws,
        mm,
        "cells",
        json!({"id": id, "version": version, "sheet": sheet, "row0": r - 1, "rows": 1, "col0": c - 1, "cols": 1}),
    )
    .unwrap();
    w["rows"][0][0].clone()
}

#[test]
fn own_workbooks_open_with_their_values_and_broken_ones_are_refused() {
    let (_t, mut ws, mm) = setup();
    let d = import(&mut ws, &mm, "files/xlsx/formule.xlsx").unwrap();
    assert_eq!(d["editable"], true);
    let id = d["document"]["id"].clone();
    let b8 = cell(&mut ws, &mm, &id, None, "Formule", 8, 2);
    assert_eq!(b8["v"], "71.75");
    assert_eq!(b8["f"], "=SUM(B2:B6)");
    assert_eq!(cell(&mut ws, &mm, &id, None, "Formule", 10, 2)["v"], "mare");

    let d = import(&mut ws, &mm, "files/xlsx/diacritice-foi-multiple.xlsx").unwrap();
    assert_eq!(
        d["sheets"]
            .as_array()
            .unwrap()
            .iter()
            .map(|s| s["name"].clone())
            .collect::<Vec<_>>(),
        vec![json!("Ianuarie"), json!("Februarie"), json!("Sumar ș ț")]
    );
    let id = d["document"]["id"].clone();
    assert_eq!(cell(&mut ws, &mm, &id, None, "Ianuarie", 2, 1)["v"], "Încasări școală");

    let d = import(&mut ws, &mm, "files/xlsx/formate.xlsx").unwrap();
    let id = d["document"]["id"].clone();
    let b2 = cell(&mut ws, &mm, &id, None, "Formate", 2, 2);
    assert_eq!(
        (b2["v"].as_str(), b2["k"].as_str()),
        (Some("07.11.2026"), Some("d")),
        "date shown as a date"
    );
    assert_eq!(cell(&mut ws, &mm, &id, None, "Formate", 2, 3)["v"], "1234.5");

    for (f, why) in [
        ("files/xlsx/stricat-trunchiat.xlsx", "deteriorat"),
        ("files/xlsx/nu-e-zip.xlsx", "deteriorat"),
        ("files/xlsx/stricat-octeti.xlsx", "deteriorat"),
        ("files/xlsx/zip-fara-workbook.xlsx", "nu se poate citi"),
    ] {
        let err = import(&mut ws, &mm, f).unwrap_err().to_string();
        assert!(err.contains(why), "{f}: {err}");
    }
    assert!(
        import_bytes(&mut ws, &mm, "x.docx", b"PK")
            .unwrap_err()
            .to_string()
            .contains("formatul")
    );
    assert_eq!(
        call(&mut ws, &mm, "list", json!({})).unwrap().as_array().unwrap().len(),
        3
    );
}

#[test]
fn a_zip_bomb_is_refused_before_any_library_reads_it() {
    let (_t, mut ws, mm) = setup();
    let mut buf = std::io::Cursor::new(Vec::new());
    {
        let mut z = zip::ZipWriter::new(&mut buf);
        let o = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        z.start_file("xl/worksheets/sheet1.xml", o).unwrap();
        let chunk = vec![b' '; 1 << 20];
        for _ in 0..40 {
            z.write_all(&chunk).unwrap();
        }
        z.finish().unwrap();
    }
    let err = import_bytes(&mut ws, &mm, "bomba.xlsx", buf.get_ref())
        .unwrap_err()
        .to_string();
    assert!(err.contains("bombă zip"), "{err}");
    // An encrypted (password-protected) Office file is named as such.
    let err = import_bytes(&mut ws, &mm, "parola.xlsx", &[0xD0, 0xCF, 0x11, 0xE0, 0, 0, 0, 0])
        .unwrap_err()
        .to_string();
    assert!(err.contains("parolă"), "{err}");
}

#[test]
fn csv_files_open_with_their_encoding_and_separator() {
    let (_t, mut ws, mm) = setup();
    for (f, r, c, want) in [
        ("files/csv/utf8-bom-virgula.csv", 2, 2, "București"),
        ("files/csv/ro-punct-si-virgula.csv", 2, 3, "-1.234,56"),
        ("files/csv/windows-1250.csv", 2, 2, "Ţăndărei"),
        ("files/csv/ghilimele-multilinie.csv", 3, 2, "are \"ghilimele\""),
        ("files/csv/ghilimele-multilinie.csv", 4, 2, "pe două\r\nrânduri"),
        ("files/csv/randuri-inegale.csv", 3, 4, "6"),
    ] {
        let d = import(&mut ws, &mm, f).unwrap();
        assert_eq!(d["editable"], false, "{f}");
        let id = d["document"]["id"].clone();
        assert_eq!(cell(&mut ws, &mm, &id, None, "CSV", r, c)["v"], want, "{f}");
    }
}

#[test]
fn editing_saves_a_new_version_with_recalculated_formulas() {
    let (_t, mut ws, mm) = setup();
    let id = import(&mut ws, &mm, "files/xlsx/formule.xlsx").unwrap()["document"]["id"].clone();
    let edits = json!([
        {"sheet": "Formule", "cell": "B2", "input": "22"},
        {"sheet": "Formule", "cell": "C2", "input": "=B2*2"},
        {"sheet": "Formule", "cell": "A3", "input": "piersici"}
    ]);
    let p = call(&mut ws, &mm, "save", json!({"id": id, "based_on": 1, "edits": edits})).unwrap();
    assert_eq!(p["applied"], false);
    assert_eq!(p["lost"], json!([]));
    assert_eq!(p["uncertain"], json!([]));
    assert!(p["recalculated"].as_u64().unwrap() >= 5, "{p}");
    // The preview changed nothing.
    assert_eq!(call(&mut ws, &mm, "info", json!({"id": id})).unwrap()["version"], 1);

    let r = call(
        &mut ws,
        &mm,
        "save",
        json!({"id": id, "based_on": 1, "edits": edits, "apply": true}),
    )
    .unwrap();
    assert_eq!(r["version"], 2);
    let v = |ws: &mut Workspace, ver: Option<u64>, row, col| cell(ws, &mm, &id, ver, "Formule", row, col)["v"].clone();
    assert_eq!(v(&mut ws, None, 2, 2), "22");
    assert_eq!(v(&mut ws, None, 2, 3), "44", "typed formula computed");
    assert_eq!(cell(&mut ws, &mm, &id, None, "Formule", 2, 3)["f"], "=B2*2");
    assert_eq!(v(&mut ws, None, 8, 2), "81.75", "SUM recalculated");
    assert_eq!(v(&mut ws, None, 9, 2), "16.35", "AVERAGE recalculated");
    assert_eq!(v(&mut ws, None, 13, 2), "40.25", "SUMIF: both „mere” rows (22 + 18.25)");
    assert_eq!(v(&mut ws, None, 3, 1), "piersici");
    // The original is untouched.
    assert_eq!(v(&mut ws, Some(1), 8, 2), "71.75");
    assert_eq!(v(&mut ws, Some(1), 2, 2), "12");
    // Saving on a version that is no longer current is refused.
    let err = call(
        &mut ws,
        &mm,
        "save",
        json!({"id": id, "based_on": 1, "edits": edits, "apply": true}),
    )
    .unwrap_err();
    assert!(err.to_string().contains("salvat între timp"), "{err}");
}

#[test]
fn advanced_features_survive_an_edit() {
    let (_t, mut ws, mm) = setup();
    let id = import(&mut ws, &mm, "files/xlsx/functii-avansate.xlsx").unwrap()["document"]["id"].clone();
    let edits = json!([{"sheet": "Avansat", "cell": "B2", "input": "15"}]);
    let r = call(
        &mut ws,
        &mm,
        "save",
        json!({"id": id, "based_on": 1, "edits": edits, "apply": true}),
    )
    .unwrap();
    assert_eq!(
        r["lost"],
        json!([]),
        "conditional formatting, validation, link, defined name kept"
    );
    assert_eq!(
        cell(&mut ws, &mm, &id, None, "Avansat", 5, 2)["v"],
        "190",
        "SUM over a defined name"
    );
}

#[test]
fn only_xlsx_is_edited_and_bad_edits_are_refused() {
    let (_t, mut ws, mm) = setup();
    let csv = import(&mut ws, &mm, "files/csv/utf8-bom-virgula.csv").unwrap()["document"]["id"].clone();
    let err = call(
        &mut ws,
        &mm,
        "save",
        json!({"id": csv, "based_on": 1, "edits": [{"sheet": "CSV", "cell": "A1", "input": "x"}]}),
    )
    .unwrap_err();
    assert!(err.to_string().contains(".xlsx"), "{err}");
    let id = import(&mut ws, &mm, "files/xlsx/simplu.xlsx").unwrap()["document"]["id"].clone();
    for (sheet, cell_ref, why) in [
        ("Date", "B0", "nu este o celulă"),
        ("Date", "AAAA1", "nu este o celulă"),
        ("Nu", "A1", "nu există"),
    ] {
        let err = call(
            &mut ws,
            &mm,
            "save",
            json!({"id": id, "based_on": 1, "edits": [{"sheet": sheet, "cell": cell_ref, "input": "1"}]}),
        )
        .unwrap_err();
        assert!(err.to_string().contains(why), "{cell_ref}: {err}");
    }
    assert!(call(&mut ws, &mm, "save", json!({"id": id, "based_on": 1, "edits": []})).is_err());
}

#[test]
fn numbers_are_read_the_romanian_way_too() {
    use kgb_sheets::save::{col_name, parse_number, parse_ref};
    assert_eq!(parse_number("12,5"), Some(12.5));
    assert_eq!(parse_number("1.234,5"), Some(1234.5));
    assert_eq!(parse_number("12.5"), Some(12.5));
    assert_eq!(parse_number("-3"), Some(-3.0));
    assert_eq!(parse_number("12 lei"), None);
    assert_eq!(parse_ref("$B$12"), Ok((12, 2)));
    assert_eq!(parse_ref("xfd1"), Ok((1, 16384)));
    assert_eq!(col_name(28), "AB");
    assert_eq!(kgb_sheets::book::date(46333.5), "07.11.2026 12:00");
    assert_eq!(kgb_sheets::book::date(1.0), "01.01.1900");
}

// ------------------------------------------- real files (if present locally)

fn extern_file(name: &str) -> Option<String> {
    let p = td("extern/xlsx").join(name);
    p.exists().then(|| format!("extern/xlsx/{name}"))
}

#[test]
fn real_files_losses_and_uncertain_formulas_are_reported_before_saving() {
    let (_t, mut ws, mm) = setup();
    if let Some(f) = extern_file("123233_charts.xlsx") {
        let d = import(&mut ws, &mm, &f).unwrap();
        let id = d["document"]["id"].clone();
        let sheet = d["sheets"][0]["name"].as_str().unwrap().to_string();
        let edits = json!([{"sheet": sheet, "cell": "Z1", "input": "notă"}]);
        let p = call(&mut ws, &mm, "save", json!({"id": id, "based_on": 1, "edits": edits})).unwrap();
        assert!(
            p["lost"]
                .as_array()
                .unwrap()
                .iter()
                .any(|l| l.as_str().unwrap().starts_with("grafice")),
            "{p}"
        );
        let err = call(
            &mut ws,
            &mm,
            "save",
            json!({"id": id, "based_on": 1, "edits": edits, "apply": true}),
        )
        .unwrap_err();
        assert!(err.to_string().contains("confirmă"), "{err}");
        let r = call(
            &mut ws,
            &mm,
            "save",
            json!({"id": id, "based_on": 1, "edits": edits, "apply": true, "accept_losses": true}),
        )
        .unwrap();
        assert_eq!(r["version"], 2);
        let info = call(&mut ws, &mm, "info", json!({"id": id})).unwrap();
        assert!(
            info["versions"][1]["note"]
                .as_str()
                .unwrap()
                .contains("grafice (4 → 0)"),
            "{info}"
        );
    } else {
        eprintln!("corpusul extern lipsește: python testdata/etapa3/extern.py");
    }
}

#[test]
fn a_formula_we_cannot_recompute_reliably_keeps_its_stored_value_and_is_reported() {
    // A workbook as another program might have saved it: the stored result of
    // B8 = SUM(B2:B6) is 999, not what can be computed here (71.75). After an
    // edit of B2 the module must not invent a value: it keeps 999 and reports
    // B8, while the formulas it computes reliably are recalculated.
    let src = std::fs::read(td("files/xlsx/formule.xlsx")).unwrap();
    let mut zin = zip::ZipArchive::new(std::io::Cursor::new(src)).unwrap();
    let mut out = std::io::Cursor::new(Vec::new());
    {
        let mut zw = zip::ZipWriter::new(&mut out);
        for i in 0..zin.len() {
            let mut f = zin.by_index(i).unwrap();
            let name = f.name().unwrap().to_string();
            let mut data = Vec::new();
            std::io::Read::read_to_end(&mut f, &mut data).unwrap();
            if name == "xl/worksheets/sheet1.xml" {
                let x = String::from_utf8(data).unwrap();
                assert!(x.contains("<f>SUM(B2:B6)</f><v>71.75</v>"));
                data = x
                    .replace("<f>SUM(B2:B6)</f><v>71.75</v>", "<f>SUM(B2:B6)</f><v>999</v>")
                    .into_bytes();
            }
            zw.start_file(name, zip::write::SimpleFileOptions::default()).unwrap();
            zw.write_all(&data).unwrap();
        }
        zw.finish().unwrap();
    }
    let (_t, mut ws, mm) = setup();
    let id = import_bytes(&mut ws, &mm, "altul.xlsx", out.get_ref()).unwrap()["document"]["id"].clone();
    let edits = json!([{"sheet": "Formule", "cell": "B2", "input": "22"}]);
    let p = call(&mut ws, &mm, "save", json!({"id": id, "based_on": 1, "edits": edits})).unwrap();
    assert_eq!(p["uncertain"], json!(["Formule!B8"]), "{p}");
    assert!(
        p["recalculated"].as_u64().unwrap() >= 3,
        "the reliable ones (AVERAGE, MAX/MIN, …): {p}"
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "save",
            json!({"id": id, "based_on": 1, "edits": edits, "apply": true})
        )
        .is_err()
    );
    call(
        &mut ws,
        &mm,
        "save",
        json!({"id": id, "based_on": 1, "edits": edits, "apply": true, "accept_losses": true}),
    )
    .unwrap();
    assert_eq!(
        cell(&mut ws, &mm, &id, None, "Formule", 8, 2)["v"],
        "999",
        "stored value kept, not invented"
    );
    assert_eq!(
        cell(&mut ws, &mm, &id, None, "Formule", 9, 2)["v"],
        "16.35",
        "AVERAGE recalculated"
    );
}

#[test]
fn a_large_sheet_scrolls_through_the_cache() {
    let p = td("large/100k-randuri.xlsx");
    if !p.exists() {
        eprintln!("fișierul mare lipsește: python testdata/etapa3/generate.py");
        return;
    }
    let (_t, mut ws, mm) = setup();
    let id = import(&mut ws, &mm, "large/100k-randuri.xlsx").unwrap()["document"]["id"].clone();
    let info = call(&mut ws, &mm, "info", json!({"id": id})).unwrap();
    assert_eq!(info["sheets"][0]["rows"], 100_001);
    let t = std::time::Instant::now();
    for start in [99_900u32, 50_000, 0, 77_777] {
        let w = call(
            &mut ws,
            &mm,
            "cells",
            json!({"id": id, "sheet": "Vanzari", "row0": start, "rows": 100}),
        )
        .unwrap();
        assert_eq!(w["rows"].as_array().unwrap().len() as u32, 100.min(100_001 - start));
    }
    let ms = t.elapsed().as_millis();
    assert!(ms < 2000, "4 windows took {ms} ms");
    assert_eq!(cell(&mut ws, &mm, &id, None, "Vanzari", 100_001, 1)["v"], "100000");
}
