//! Step 3.11: the owner's real files (D-041), through the real modules.
//! The files contain real and personal data: they live only in the local,
//! git-ignored `testdata/proprietar/` and this test prints only counts and
//! levels — never the content. Without the folder (CI) it does nothing.

use std::path::Path;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::CORE_VERSION;
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use serde_json::json;

#[test]
fn owner_files_open_edit_and_extract_without_loss() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../testdata/proprietar");
    if !dir.exists() {
        eprintln!("fișierele proprietarului lipsesc (doar local)");
        return;
    }
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
    mm.enable(
        &mut ws,
        "kgb.extract",
        &["storage.own".into(), "files.own".into(), "notify.send".into()],
    )
    .unwrap();
    let mut names: Vec<_> = std::fs::read_dir(&dir).unwrap().flatten().map(|e| e.path()).collect();
    names.sort();
    for p in names {
        let name = p.file_name().unwrap().to_string_lossy().to_string();
        let data = std::fs::read(&p).unwrap();
        let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
        let module = match ext.as_str() {
            "pdf" => "kgb.pdf",
            "xlsx" | "xlsm" | "xls" | "ods" | "csv" => "kgb.sheets",
            _ => {
                eprintln!("{name}: imagine — necesită OCR (D-035), nu face parte din Etapa 3");
                continue;
            }
        };
        let r = mm.call(
            &mut ws,
            None,
            module,
            "import",
            json!({"name": name, "data": B64.encode(&data)}),
        );
        let id = match r {
            Ok(r) => r["document"]["id"].clone(),
            Err(e) => {
                eprintln!("{name}: refuzat la import: {e}");
                continue;
            }
        };
        if module == "kgb.pdf" {
            let i = mm.call(&mut ws, None, module, "info", json!({"id": id})).unwrap();
            let rot = mm.call(
                &mut ws,
                None,
                module,
                "rotate",
                json!({"id": id, "based_on": 1, "pages": [1], "apply": true}),
            );
            eprintln!(
                "{name}: {} · {} pagini · rotire: {}",
                i["status"],
                i["pages"],
                if rot.is_ok() {
                    "salvată, verificată"
                } else {
                    "refuzată"
                }
            );
        } else {
            let i = mm.call(&mut ws, None, module, "info", json!({"id": id})).unwrap();
            let sheets: Vec<String> = i["sheets"]
                .as_array()
                .unwrap()
                .iter()
                .map(|s| format!("{}×{}", s["rows"], s["cols"]))
                .collect();
            let first = i["sheets"][0]["name"].as_str().unwrap().to_string();
            let rows = i["sheets"][0]["rows"].as_u64().unwrap();
            let edits = json!([{"sheet": first, "cell": format!("A{}", rows + 3), "input": "test K.G.B."}]);
            let p = mm.call(
                &mut ws,
                None,
                module,
                "save",
                json!({"id": id, "based_on": 1, "edits": edits}),
            );
            let line = match &p {
                Ok(p) => format!(
                    "salvare: {} recalculate, {} formule nesigure, pierderi: {}",
                    p["recalculated"],
                    p["uncertain"].as_array().map(Vec::len).unwrap_or(0),
                    if p["lost"].as_array().is_some_and(|l| l.is_empty()) {
                        "niciuna".into()
                    } else {
                        p["lost"].to_string()
                    }
                ),
                Err(e) => format!("salvare refuzată: {e}"),
            };
            eprintln!("{name}: {} foi ({}) · {line}", sheets.len(), sheets.join(", "));
            // The original must be intact whatever happened.
            let d = tmp.path().join("v1.bin");
            mm.call(
                &mut ws,
                None,
                module,
                "export",
                json!({"id": id, "version": 1, "dest": d, "overwrite": true}),
            )
            .unwrap();
            assert_eq!(std::fs::read(&d).unwrap(), data, "{name}: original intact");
        }
        // Extraction: which fields are found and how sure (no values printed).
        if let Ok(x) = mm.call(
            &mut ws,
            None,
            "kgb.extract",
            "import",
            json!({"name": name, "data": B64.encode(&data)}),
        ) && let Ok(f) = mm.call(
            &mut ws,
            None,
            "kgb.extract",
            "extract",
            json!({"id": x["document"]["id"]}),
        ) {
            let found: Vec<String> = f["fields"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|f| f["level"] != "lipsă")
                .map(|f| format!("{}={}", f["key"].as_str().unwrap(), f["level"].as_str().unwrap()))
                .collect();
            eprintln!(
                "    extragere: {}",
                if found.is_empty() {
                    "niciun câmp de factură".to_string()
                } else {
                    found.join(", ")
                }
            );
        }
    }
}
