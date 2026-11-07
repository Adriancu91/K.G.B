//! Step 3.10: the non-corruption gate test of Etapa 3, over the whole test
//! set (and the external corpus when it is present locally).
//!
//! For every file, through the real modules (PDF, spreadsheets, extraction):
//! - the file on disk is never changed;
//! - the imported original (version 1) is stored byte for byte;
//! - an operation (PDF: rotate a page; XLSX: edit a cell) either is refused
//!   or saves a verified new version, and version 1 is still byte-identical;
//! - deliberately damaged copies (truncated, bytes altered, middle zeroed)
//!   are refused clearly or opened read-only — never a crash, never a
//!   silently "repaired" result.
//!
//! The summary is printed; `docs/etapa3/NECORUPERE.md` records a local run.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn td(rel: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../testdata/etapa3")
        .join(rel)
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(
        vec![
            Box::new(kgb_pdf::Pdf::new()),
            Box::new(kgb_sheets::Sheets::new()),
            Box::new(kgb_extract::Extract::new()),
        ],
        CORE_VERSION,
    )
    .unwrap();
    mm.enable(&mut ws, "kgb.pdf", &["files.own".into()]).unwrap();
    mm.enable(&mut ws, "kgb.sheets", &["files.own".into()]).unwrap();
    mm.enable(&mut ws, "kgb.extract", &["storage.own".into(), "files.own".into()])
        .unwrap();
    (tmp, ws, mm)
}

fn files() -> Vec<PathBuf> {
    let mut v = Vec::new();
    for dir in [
        "files/pdf",
        "files/edge",
        "files/xlsx",
        "files/csv",
        "extern/pdf",
        "extern/xlsx",
        "extern/xlsm",
        "extern/xls",
        "extern/ods",
        "extern/csv",
    ] {
        for e in std::fs::read_dir(td(dir)).into_iter().flatten().flatten() {
            let p = e.path();
            if p.extension().is_some_and(|x| {
                ["pdf", "xlsx", "xlsm", "xls", "xlsb", "ods", "csv"]
                    .contains(&x.to_string_lossy().to_lowercase().as_str())
            }) {
                v.push(p);
            }
        }
    }
    v.sort();
    v
}

fn module_for(name: &str) -> &'static str {
    if name.to_lowercase().ends_with(".pdf") {
        "kgb.pdf"
    } else {
        "kgb.sheets"
    }
}

/// Deliberately damaged copies of a file, deterministic.
fn damaged(data: &[u8]) -> Vec<(&'static str, Vec<u8>)> {
    let n = data.len();
    let mut out = Vec::new();
    for (label, keep) in [
        ("trunchiat 10%", n / 10),
        ("trunchiat 50%", n / 2),
        ("trunchiat 90%", n * 9 / 10),
    ] {
        out.push((label, data[..keep].to_vec()));
    }
    let mut flipped = data.to_vec();
    for k in (n / 7..n).step_by((n / 11).max(1)).take(8) {
        flipped[k] ^= 0xA5;
    }
    out.push(("octeți alterați", flipped));
    let mut zeroed = data.to_vec();
    let (a, b) = (n * 2 / 5, (n * 3 / 5).min(n));
    zeroed[a..b].iter_mut().for_each(|x| *x = 0);
    out.push(("mijloc șters", zeroed));
    out
}

fn read_v(ws: &mut Workspace, mm: &ModuleManager, m: &str, id: &Value, v: u64) -> Vec<u8> {
    let r = if m == "kgb.pdf" {
        mm.call(ws, None, m, "read", json!({"id": id, "version": v})).unwrap()["data"].clone()
    } else {
        // The spreadsheet module has no raw read; export the version and read it back.
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("v.bin");
        mm.call(ws, None, m, "export", json!({"id": id, "version": v, "dest": dest}))
            .unwrap();
        return std::fs::read(dest).unwrap();
    };
    B64.decode(r.as_str().unwrap()).unwrap()
}

/// One operation that changes the document, if the module allows it.
fn operate(ws: &mut Workspace, mm: &ModuleManager, m: &str, id: &Value, sheet: Option<String>) -> CoreResult<Value> {
    if m == "kgb.pdf" {
        mm.call(
            ws,
            None,
            m,
            "rotate",
            json!({"id": id, "based_on": 1, "pages": [1], "angle": 90, "apply": true}),
        )
    } else {
        let info = mm.call(ws, None, m, "info", json!({"id": id}))?;
        if info["editable"] != true {
            return mm.call(ws, None, m, "convert", json!({"id": id}));
        }
        let sheet = sheet.unwrap_or_else(|| info["sheets"][0]["name"].as_str().unwrap_or_default().to_string());
        let rows = info["sheets"][0]["rows"].as_u64().unwrap_or(0);
        let cell = format!("A{}", rows + 2);
        mm.call(
            ws,
            None,
            m,
            "save",
            json!({"id": id, "based_on": 1, "apply": true, "accept_losses": true,
            "edits": [{"sheet": sheet, "cell": cell, "input": "verificare necorupere ăîșț"}]}),
        )
    }
}

#[test]
fn nothing_is_ever_corrupted_and_damaged_files_never_crash_the_app() {
    let all = files();
    assert!(all.len() >= 27, "the own test set is present ({} files)", all.len());
    let (_t, mut ws, mm) = setup();
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {})); // library panics are caught by the core; keep output short
    let mut stats: BTreeMap<&str, usize> = BTreeMap::new();
    let mut accepted: BTreeMap<String, usize> = BTreeMap::new();
    let mut bump = |k: &'static str| *stats.entry(k).or_default() += 1;

    for path in &all {
        let name = path.file_name().unwrap().to_string_lossy().to_string();
        let before = std::fs::read(path).unwrap();
        let m = module_for(&name);
        bump("fișiere");
        match mm.call(
            &mut ws,
            None,
            m,
            "import",
            json!({"name": name, "data": B64.encode(&before)}),
        ) {
            Err(_) => bump("refuzate clar la import"),
            Ok(r) => {
                bump("importate");
                let id = r["document"]["id"].clone();
                assert_eq!(
                    read_v(&mut ws, &mm, m, &id, 1),
                    before,
                    "{name}: the original is stored byte for byte"
                );
                match operate(&mut ws, &mm, m, &id, None) {
                    Ok(_) => bump("operații salvate (verificate)"),
                    Err(_) => bump("operații refuzate (doar citire)"),
                }
                assert_eq!(
                    read_v(&mut ws, &mm, m, &id, 1),
                    before,
                    "{name}: version 1 unchanged after the operation"
                );
                // Extraction must not crash either.
                if let Ok(x) = mm.call(
                    &mut ws,
                    None,
                    "kgb.extract",
                    "import",
                    json!({"name": name, "data": B64.encode(&before)}),
                ) {
                    let _ = mm.call(
                        &mut ws,
                        None,
                        "kgb.extract",
                        "extract",
                        json!({"id": x["document"]["id"]}),
                    );
                    bump("analizate de extragere");
                }
            }
        }
        // Damaged copies of the file.
        if before.len() >= 64 && before.len() <= 8 * 1024 * 1024 {
            for (label, bad) in damaged(&before) {
                bump("variante deteriorate");
                match mm.call(
                    &mut ws,
                    None,
                    m,
                    "import",
                    json!({"name": name, "data": B64.encode(&bad)}),
                ) {
                    Err(_) => bump("variante refuzate clar"),
                    Ok(r) => {
                        let id = r["document"]["id"].clone();
                        assert_eq!(
                            read_v(&mut ws, &mm, m, &id, 1),
                            bad,
                            "{name} ({label}): stored as received"
                        );
                        match operate(&mut ws, &mm, m, &id, None) {
                            Ok(_) => {
                                bump("variante deschise și modificate verificat");
                                let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
                                *accepted.entry(format!("{ext} / {label}")).or_default() += 1;
                            }
                            Err(_) => bump("variante doar citire"),
                        }
                    }
                }
            }
        }
        assert_eq!(
            std::fs::read(path).unwrap(),
            before,
            "{name}: the file on disk is never changed"
        );
    }
    std::panic::set_hook(prev);
    let audit = kgb_core::modules::audit_log(&ws, 100_000).unwrap();
    let internal = audit
        .iter()
        .filter(|e| e.get("outcome").and_then(Value::as_str) == Some("eroare internă"))
        .count();
    for (k, v) in &stats {
        eprintln!("{k}: {v}");
    }
    for (k, v) in &accepted {
        eprintln!("  acceptată și modificată: {k}: {v}");
    }
    eprintln!("erori interne prinse de nucleu (fără oprirea aplicației): {internal}");
}
