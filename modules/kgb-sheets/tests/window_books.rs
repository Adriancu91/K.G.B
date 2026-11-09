//! D-073 / D-077: the spreadsheet window copied from Cyber Office Studio reads whole workbooks and hands
//! them back; `read`, `save_book` and `save_new_book` keep the core's versions and refuse anything broken.

use std::path::{Path, PathBuf};

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_sheets::{ID, Sheets, check_book};
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

const SSHEET: &str = r#"{"format":"suite-sheet","version":1,"title":"Buget","sheets":[{"name":"Foaia 1","cells":{"A1":"5","A2":"=A1*2"}}],"updatedAt":"2026-11-09T20:00:00Z"}"#;

#[test]
fn an_xlsx_is_read_whole_and_saved_as_a_new_version() {
    let (_t, mut ws, mm) = setup();
    let data = std::fs::read(td("files/xlsx/formule.xlsx")).unwrap();
    let d = call(
        &mut ws,
        &mm,
        "import",
        json!({"name": "formule.xlsx", "data": B64.encode(&data)}),
    )
    .unwrap();
    let id = d["document"]["id"].clone();

    let r = call(&mut ws, &mm, "read", json!({"id": id})).unwrap();
    assert_eq!(r["version"], 1);
    assert_eq!(r["name"], "formule.xlsx");
    assert_eq!(B64.decode(r["data"].as_str().unwrap()).unwrap(), data);

    // The window hands back a workbook (here the same bytes): a new version, the first one kept.
    let s = call(
        &mut ws,
        &mm,
        "save_book",
        json!({"id": id, "based_on": 1, "data": B64.encode(&data), "summary": "Foaie modificată"}),
    )
    .unwrap();
    assert_eq!(s["version"], 2);
    assert!(s["sheets"].as_u64().unwrap() >= 1);
    let old = call(&mut ws, &mm, "read", json!({"id": id, "version": 1})).unwrap();
    assert_eq!(B64.decode(old["data"].as_str().unwrap()).unwrap(), data);

    // Saving on an old version is refused: someone saved in between.
    let e = call(
        &mut ws,
        &mm,
        "save_book",
        json!({"id": id, "based_on": 1, "data": B64.encode(&data), "summary": "x"}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("salvat între timp"), "{e}");
}

#[test]
fn broken_workbooks_and_missing_summaries_are_refused() {
    let (_t, mut ws, mm) = setup();
    let data = std::fs::read(td("files/xlsx/simplu.xlsx")).unwrap();
    let d = call(
        &mut ws,
        &mm,
        "import",
        json!({"name": "simplu.xlsx", "data": B64.encode(&data)}),
    )
    .unwrap();
    let id = d["document"]["id"].clone();
    for bad in [
        "files/xlsx/stricat-trunchiat.xlsx",
        "files/xlsx/nu-e-zip.xlsx",
        "files/xlsx/zip-fara-workbook.xlsx",
    ] {
        let b = std::fs::read(td(bad)).unwrap();
        let e = call(
            &mut ws,
            &mm,
            "save_book",
            json!({"id": id, "based_on": 1, "data": B64.encode(&b), "summary": "x"}),
        )
        .unwrap_err();
        assert!(e.to_string().contains("nu trece verificarea"), "{bad}: {e}");
    }
    let e = call(
        &mut ws,
        &mm,
        "save_book",
        json!({"id": id, "based_on": 1, "data": B64.encode(&data), "summary": "  "}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("descrierea"), "{e}");
    // Nothing was saved.
    assert_eq!(call(&mut ws, &mm, "read", json!({"id": id})).unwrap()["version"], 1);
}

#[test]
fn the_windows_own_format_is_kept_and_checked() {
    let (_t, mut ws, mm) = setup();
    let d = call(
        &mut ws,
        &mm,
        "save_new_book",
        json!({"name": "Buget.ssheet", "data": B64.encode(SSHEET), "summary": "Registru nou"}),
    )
    .unwrap();
    assert_eq!(d["sheets"], 1);
    let id = d["document"]["id"].clone();
    let list = call(&mut ws, &mm, "list", json!({})).unwrap();
    assert!(
        list.as_array().unwrap().iter().any(|x| x["name"] == "Buget.ssheet"),
        "{list}"
    );
    // The page shows it in the list: its sheets, its versions, and that it opens in the window.
    let info = call(&mut ws, &mm, "info", json!({"id": id})).unwrap();
    assert_eq!(info["format"], "ssheet");
    assert_eq!(info["editable"], false);
    assert_eq!(info["sheets"][0]["name"], "Foaia 1");
    assert_eq!(info["versions"].as_array().unwrap().len(), 1);
    let r = call(&mut ws, &mm, "read", json!({"id": id})).unwrap();
    assert_eq!(B64.decode(r["data"].as_str().unwrap()).unwrap(), SSHEET.as_bytes());

    let changed = SSHEET.replace("\"5\"", "\"7\"");
    assert_eq!(
        call(
            &mut ws,
            &mm,
            "save_book",
            json!({"id": id, "based_on": 1, "data": B64.encode(&changed), "summary": "A1 = 7"})
        )
        .unwrap()["version"],
        2
    );

    for bad in [
        "nu e json",
        r#"{"format":"alt-format","version":1,"sheets":[{"name":"A","cells":{}}]}"#,
        r#"{"format":"suite-sheet","version":2,"sheets":[{"name":"A","cells":{}}]}"#,
        r#"{"format":"suite-sheet","version":1,"sheets":[]}"#,
        r#"{"format":"suite-sheet","version":1,"sheets":[{"cells":{}}]}"#,
    ] {
        assert!(check_book("x.ssheet", bad.as_bytes()).is_err(), "{bad}");
        let e = call(
            &mut ws,
            &mm,
            "save_new_book",
            json!({"name": "x.ssheet", "data": B64.encode(bad), "summary": "x"}),
        )
        .unwrap_err();
        assert!(e.to_string().contains("nu trece verificarea"), "{e}");
    }
    // Only .xlsx and .ssheet are written; a name with a folder is refused.
    assert!(
        call(
            &mut ws,
            &mm,
            "save_new_book",
            json!({"name": "a.csv", "data": B64.encode("a;b"), "summary": "x"})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "save_new_book",
            json!({"name": "../a.ssheet", "data": B64.encode(SSHEET), "summary": "x"})
        )
        .is_err()
    );
}
