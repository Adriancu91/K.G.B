//! D-080: the document window copied from Cyber Office Studio keeps its documents in `kgb.write`;
//! `read`, `save_doc` and `save_new_doc` keep the core's versions and refuse anything broken.

use std::io::Write as _;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_write::{Format, ID, Write, check_doc};
use serde_json::{Value, json};

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Write::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["files.own".to_string()]).unwrap();
    (tmp, ws, mm)
}

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

const SDOC: &str = r#"{"format":"suite-doc","version":1,"content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Contract"}]}]},"updatedAt":"2026-11-09T22:00:00Z"}"#;

/// A minimal .docx: the content types and the body, as a document editor writes them.
fn docx(text: &str) -> Vec<u8> {
    let mut z = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let o = zip::write::SimpleFileOptions::default();
    z.start_file("[Content_Types].xml", o).unwrap();
    z.write_all(br#"<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>"#).unwrap();
    z.start_file("word/document.xml", o).unwrap();
    write!(z, r#"<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>"#).unwrap();
    z.finish().unwrap().into_inner()
}

#[test]
fn the_windows_own_format_is_kept_with_its_versions() {
    let (_t, mut ws, mm) = setup();
    let d = call(
        &mut ws,
        &mm,
        "save_new_doc",
        json!({"name": "Contract.sdoc", "data": B64.encode(SDOC), "summary": "Document nou"}),
    )
    .unwrap();
    let id = d["document"]["id"].clone();
    let list = call(&mut ws, &mm, "list", json!({})).unwrap();
    assert_eq!(list.as_array().unwrap().len(), 1, "{list}");
    let r = call(&mut ws, &mm, "read", json!({"id": id})).unwrap();
    assert_eq!(r["version"], 1);
    assert_eq!(r["name"], "Contract.sdoc");
    assert_eq!(B64.decode(r["data"].as_str().unwrap()).unwrap(), SDOC.as_bytes());

    let changed = SDOC.replace("Contract", "Contract de vânzare");
    assert_eq!(
        call(
            &mut ws,
            &mm,
            "save_doc",
            json!({"id": id, "based_on": 1, "data": B64.encode(&changed), "summary": "Titlul"})
        )
        .unwrap()["version"],
        2
    );
    let info = call(&mut ws, &mm, "info", json!({"id": id})).unwrap();
    assert_eq!(info["format"], "sdoc");
    assert_eq!(info["versions"].as_array().unwrap().len(), 2);
    let old = call(&mut ws, &mm, "read", json!({"id": id, "version": 1})).unwrap();
    assert_eq!(B64.decode(old["data"].as_str().unwrap()).unwrap(), SDOC.as_bytes());

    // Saving on an old version is refused: someone saved in between.
    let e = call(
        &mut ws,
        &mm,
        "save_doc",
        json!({"id": id, "based_on": 1, "data": B64.encode(&changed), "summary": "x"}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("salvat între timp"), "{e}");
}

#[test]
fn a_docx_is_imported_and_saved_back() {
    let (_t, mut ws, mm) = setup();
    let first = docx("Oferta");
    let d = call(
        &mut ws,
        &mm,
        "import",
        json!({"name": "Oferta.docx", "data": B64.encode(&first)}),
    )
    .unwrap();
    assert_eq!(d["format"], "docx");
    let id = d["document"]["id"].clone();
    let next = docx("Oferta revizuită");
    assert_eq!(
        call(
            &mut ws,
            &mm,
            "save_doc",
            json!({"id": id, "based_on": 1, "data": B64.encode(&next), "summary": "Salvat în .docx"})
        )
        .unwrap()["version"],
        2
    );
    assert_eq!(check_doc("a.docx", &next).unwrap(), Format::Docx);
}

#[test]
fn broken_documents_and_other_formats_are_refused() {
    let (_t, mut ws, mm) = setup();
    let d = call(
        &mut ws,
        &mm,
        "save_new_doc",
        json!({"name": "A.sdoc", "data": B64.encode(SDOC), "summary": "x"}),
    )
    .unwrap();
    let id = d["document"]["id"].clone();
    for bad in [
        "nu e json",
        r#"{"format":"suite-sheet","version":1,"content":{"type":"doc"}}"#,
        r#"{"format":"suite-doc","version":2,"content":{"type":"doc"}}"#,
        r#"{"format":"suite-doc","version":1}"#,
    ] {
        let e = call(
            &mut ws,
            &mm,
            "save_doc",
            json!({"id": id, "based_on": 1, "data": B64.encode(bad), "summary": "x"}),
        )
        .unwrap_err();
        assert!(e.to_string().contains("nu trece verificarea"), "{bad}: {e}");
    }
    // A .docx that is not an archive, or an archive without the body.
    assert!(check_doc("a.docx", b"PK nu e zip").is_err());
    let mut z = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    z.start_file("altceva.xml", zip::write::SimpleFileOptions::default())
        .unwrap();
    z.write_all(b"<x/>").unwrap();
    assert!(
        check_doc("a.docx", &z.finish().unwrap().into_inner())
            .unwrap_err()
            .contains("word/document.xml")
    );
    // Only .sdoc and .docx are kept; a name with a folder and an empty summary are refused.
    assert!(
        call(
            &mut ws,
            &mm,
            "save_new_doc",
            json!({"name": "a.txt", "data": B64.encode("text"), "summary": "x"})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "save_new_doc",
            json!({"name": "../a.sdoc", "data": B64.encode(SDOC), "summary": "x"})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "save_new_doc",
            json!({"name": "b.sdoc", "data": B64.encode(SDOC), "summary": " "})
        )
        .is_err()
    );
    // Nothing was saved over the document.
    assert_eq!(call(&mut ws, &mm, "read", json!({"id": id})).unwrap()["version"], 1);
}
