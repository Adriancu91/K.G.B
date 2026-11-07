//! Step 3.9: data extraction (§6.4). Fields with their source and
//! confidence; nothing uncertain imported without confirmation; every import
//! journaled; duplicates refused; scanned or damaged PDFs refused clearly.

use std::path::{Path, PathBuf};

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_extract::fields::{self, Line, Source};
use kgb_extract::{Extract, ID};
use serde_json::{Value, json};

fn td(rel: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../testdata/etapa3")
        .join(rel)
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Extract::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".to_string(), "files.own".to_string()])
        .unwrap();
    (tmp, ws, mm)
}

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn import_bytes(ws: &mut Workspace, mm: &ModuleManager, name: &str, data: &[u8]) -> CoreResult<Value> {
    call(ws, mm, "import", json!({"name": name, "data": B64.encode(data)}))
}

fn field<'a>(fs: &'a Value, key: &str) -> &'a Value {
    fs["fields"]
        .as_array()
        .unwrap()
        .iter()
        .find(|f| f["key"] == key)
        .unwrap()
}

#[test]
fn invoice_pdf_fields_with_source_and_confidence() {
    let (_t, mut ws, mm) = setup();
    let id = import_bytes(
        &mut ws,
        &mm,
        "factura.pdf",
        &std::fs::read(td("files/edge/factura.pdf")).unwrap(),
    )
    .unwrap()["document"]["id"]
        .clone();
    let x = call(&mut ws, &mm, "extract", json!({"id": id})).unwrap();
    // The values the manifest of the test set expects (testdata/etapa3/MANIFEST.json).
    for (key, value, level) in [
        ("numar", "FCT-0042", "de verificat"),
        ("data", "07.11.2026", "sigur"),
        ("scadenta", "07.12.2026", "sigur"),
        ("furnizor", "Exemplu Țesături Șerban SRL", "de verificat"),
        ("client", "Școala Gimnazială „Ion Creangă”", "de verificat"),
        ("total_fara_tva", "1406.00", "sigur"),
        ("tva", "267.14", "sigur"),
        ("total", "1673.14", "sigur"),
    ] {
        let f = field(&x, key);
        assert_eq!(
            (f["value"].as_str(), f["level"].as_str()),
            (Some(value), Some(level)),
            "{key}: {f}"
        );
    }
    // The fictitious CUI RO00000000 fails the control-digit check: uncertain.
    assert_eq!(field(&x, "cui_furnizor")["level"], "incert");
    // Every value says where it was found.
    let total = field(&x, "total");
    assert_eq!(
        total["source"],
        json!({"kind": "pagina", "page": 1, "line": total["source"]["line"]})
    );
    assert!(total["note"].as_str().unwrap().contains("total fără TVA + TVA = total"));
    assert!(
        field(&x, "numar")["context"]
            .as_str()
            .unwrap()
            .contains("FACTURĂ FISCALĂ")
    );
}

#[test]
fn nothing_uncertain_is_imported_without_confirmation_and_every_import_is_journaled() {
    let (_t, mut ws, mm) = setup();
    let id = import_bytes(
        &mut ws,
        &mm,
        "factura.pdf",
        &std::fs::read(td("files/edge/factura.pdf")).unwrap(),
    )
    .unwrap()["document"]["id"]
        .clone();
    // Accept everything as found, confirming nothing: refused, nothing written.
    let err = call(
        &mut ws,
        &mm,
        "confirm",
        json!({"id": id, "values": {}, "confirmed": []}),
    )
    .unwrap_err()
    .to_string();
    assert!(
        err.contains("Număr factură: trebuie confirmat") && err.contains("Furnizor: trebuie confirmat"),
        "{err}"
    );
    assert_eq!(call(&mut ws, &mm, "records", json!({})).unwrap(), json!([]));
    // Confirm the uncertain ones, correct the client, clear the fictitious CUI.
    let r = call(
        &mut ws,
        &mm,
        "confirm",
        json!({
            "id": id,
            "values": {"client": "Școala Gimnazială Ion Creangă Iași", "cui_furnizor": ""},
            "confirmed": ["numar", "furnizor", "client"]
        }),
    )
    .unwrap();
    assert_eq!(r["record"]["total"], 1673.14);
    assert_eq!(r["record"]["data"], "07.11.2026");
    assert_eq!(r["record"]["cui_furnizor"], Value::Null);
    assert_eq!(r["corectate"], json!(["client"]));
    let j = call(&mut ws, &mm, "journal", json!({})).unwrap();
    assert_eq!(j.as_array().unwrap().len(), 1);
    assert_eq!(
        j[0]["automate"],
        json!(["data", "scadenta", "total_fara_tva", "tva", "total"])
    );
    assert_eq!(j[0]["confirmate"], json!(["numar", "furnizor", "client"]));
    assert_eq!(j[0]["sursa_versiune"], 1);
    // The same invoice again: refused unless asked for explicitly.
    let again = json!({"id": id, "values": {"cui_furnizor": ""}, "confirmed": ["numar", "furnizor", "client"]});
    let err = call(&mut ws, &mm, "confirm", again.clone()).unwrap_err().to_string();
    assert!(err.contains("deja importată"), "{err}");
    let mut dup = again;
    dup["allow_duplicate"] = json!(true);
    call(&mut ws, &mm, "confirm", dup).unwrap();
    assert_eq!(
        call(&mut ws, &mm, "records", json!({}))
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        2
    );
}

#[test]
fn corrected_values_are_validated() {
    let (_t, mut ws, mm) = setup();
    let id = import_bytes(
        &mut ws,
        &mm,
        "factura.pdf",
        &std::fs::read(td("files/edge/factura.pdf")).unwrap(),
    )
    .unwrap()["document"]["id"]
        .clone();
    let all = ["numar", "furnizor", "client", "cui_furnizor", "data", "total"];
    for (key, bad, why) in [
        ("data", "31.02.2026", "nu este o dată"),
        ("total", "o mie", "nu este o sumă"),
        ("numar", "", "lipsește"),
    ] {
        let err = call(
            &mut ws,
            &mm,
            "confirm",
            json!({"id": id, "values": {key: bad}, "confirmed": all}),
        )
        .unwrap_err()
        .to_string();
        assert!(err.contains(why), "{key}: {err}");
    }
    // A correction must be confirmed too, even of a "sure" field.
    let err = call(&mut ws, &mm, "confirm", json!({"id": id, "values": {"total": "1.700,00", "cui_furnizor": ""}, "confirmed": ["numar", "furnizor", "client"]})).unwrap_err().to_string();
    assert!(
        err.contains("Total de plată: trebuie confirmat (valoare corectată"),
        "{err}"
    );
    let r = call(&mut ws, &mm, "confirm", json!({"id": id, "values": {"total": "1.700,00", "cui_furnizor": ""}, "confirmed": ["numar", "furnizor", "client", "total"]})).unwrap();
    assert_eq!(r["record"]["total"], 1700.0);
    assert_eq!(r["corectate"], json!(["total"]));
}

#[test]
fn spreadsheet_invoice_cells_are_sources() {
    let (_t, mut ws, mm) = setup();
    let bytes = kgb_sheets::templates::workbook("factura").unwrap();
    let id = import_bytes(&mut ws, &mm, "factura-sablon.xlsx", &bytes).unwrap()["document"]["id"].clone();
    let x = call(&mut ws, &mm, "extract", json!({"id": id})).unwrap();
    let total = field(&x, "total");
    assert_eq!(total["value"], "1701.26");
    assert_eq!(total["level"], "sigur", "1406.00 + 295.26 = 1701.26");
    assert_eq!(
        total["source"],
        json!({"kind": "celula", "sheet": "Factură", "cell": "F22"})
    );
    assert_eq!(field(&x, "numar")["value"], "FCT-0001");
    // "zz.ll.aaaa" is not a date: the field is missing, not invented.
    assert_eq!(field(&x, "data")["level"], "lipsă");
}

#[test]
fn scanned_damaged_and_unknown_files_are_refused_clearly() {
    let (_t, mut ws, mm) = setup();
    for (f, why) in [
        ("files/pdf/cu-imagine.pdf", "pare scanat"),
        ("files/pdf/stricat-trunchiat.pdf", "deteriorat"),
        ("files/xlsx/nu-e-zip.xlsx", "deteriorat"),
    ] {
        let name = Path::new(f).file_name().unwrap().to_string_lossy().to_string();
        let err = import_bytes(&mut ws, &mm, &name, &std::fs::read(td(f)).unwrap())
            .unwrap_err()
            .to_string();
        assert!(err.contains(why), "{f}: {err}");
    }
    assert!(
        import_bytes(&mut ws, &mm, "a.docx", b"x")
            .unwrap_err()
            .to_string()
            .contains("formatul")
    );
    assert_eq!(call(&mut ws, &mm, "list", json!({})).unwrap(), json!([]));
}

#[test]
fn records_export_as_csv() {
    let (tmp, mut ws, mm) = setup();
    let id = import_bytes(
        &mut ws,
        &mm,
        "factura.pdf",
        &std::fs::read(td("files/edge/factura.pdf")).unwrap(),
    )
    .unwrap()["document"]["id"]
        .clone();
    call(
        &mut ws,
        &mm,
        "confirm",
        json!({"id": id, "values": {"cui_furnizor": ""}, "confirmed": ["numar", "furnizor", "client"]}),
    )
    .unwrap();
    let dest = tmp.path().join("facturi.csv");
    call(&mut ws, &mm, "export_records", json!({"dest": dest, "style": "ro"})).unwrap();
    let text = String::from_utf8(std::fs::read(&dest).unwrap()[3..].to_vec()).unwrap();
    let lines: Vec<&str> = text.split("\r\n").collect();
    assert!(lines[0].starts_with("Număr factură;Data emiterii;"), "{}", lines[0]);
    assert!(
        lines[1].starts_with("FCT-0042;07.11.2026;07.12.2026;Exemplu Țesături Șerban SRL;;"),
        "{}",
        lines[1]
    );
    assert!(lines[1].ends_with("1406,00;267,14;1673,14"), "{}", lines[1]);
}

#[test]
fn checks_amounts_dates_and_fiscal_codes() {
    assert_eq!(fields::amount("1.673,14"), Some(1673.14));
    assert_eq!(fields::amount("1,673.14"), Some(1673.14));
    assert_eq!(fields::amount("267,14"), Some(267.14));
    assert_eq!(fields::amount("1.234.567"), Some(1_234_567.0));
    assert_eq!(fields::amount("12 lei"), Some(12.0));
    assert_eq!(fields::amount("12 kg"), None);
    assert_eq!(
        fields::date("emisă la 29.02.2028").map(|d| d.1),
        Some("29.02.2028".into())
    );
    assert_eq!(fields::date("29.02.2027"), None);
    assert!(fields::cui_valid("RO14399840"));
    assert!(!fields::cui_valid("RO14399841"));
    assert!(!fields::cui_valid("RO00000000"));
    // Totals that do not add up make all three uncertain.
    let at = |t: &str, n: u32| Line {
        text: t.into(),
        source: Source::Pagina { page: 1, line: n },
    };
    let f = fields::extract(&[
        at("Total fără TVA 100,00", 1),
        at("TVA 21,00", 2),
        at("Total de plată 125,00", 3),
    ]);
    assert!(
        f.iter()
            .filter(|x| ["total_fara_tva", "tva", "total"].contains(&x.key))
            .all(|x| x.level == "incert"),
        "{f:?}"
    );
    assert!(f.iter().any(|x| x.note.contains("NU se potrivește")));
}

#[test]
fn every_real_file_of_the_corpus_is_handled_without_a_crash() {
    // Extraction must never stop the program, whatever the text looks like:
    // an error message is fine, a panic is not. Runs on the external corpus
    // when it is present locally (python testdata/etapa3/extern.py).
    let (_t, mut ws, mm) = setup();
    let dir = td("extern");
    if !dir.exists() {
        eprintln!("corpusul extern lipsește");
        return;
    }
    let (mut files, mut extracted) = (0, 0);
    for kind in ["pdf", "xlsx", "xls", "ods", "csv"] {
        for e in std::fs::read_dir(dir.join(kind)).into_iter().flatten().flatten() {
            let p = e.path();
            let name = p.file_name().unwrap().to_string_lossy().to_string();
            files += 1;
            if let Ok(d) = import_bytes(&mut ws, &mm, &name, &std::fs::read(&p).unwrap())
                && call(&mut ws, &mm, "extract", json!({"id": d["document"]["id"]})).is_ok()
            {
                extracted += 1;
            }
        }
    }
    eprintln!("{files} fișiere, {extracted} citite și analizate");
    assert!(extracted > files / 2, "{extracted}/{files}");
}
