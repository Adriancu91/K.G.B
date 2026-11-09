//! Step 3.5: the PDF module on the Etapa 3 test set (`testdata/etapa3`).
//! Every operation: preview first, then a new version or a new document; the
//! original stays byte-identical; damaged and encrypted PDFs are read-only.

use std::path::{Path, PathBuf};

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreError, CoreResult};
use kgb_pdf::{ID, Pdf};
use serde_json::{Value, json};

fn testdata(rel: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../testdata/etapa3/files/pdf")
        .join(rel)
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Pdf::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["files.own".to_string()]).unwrap();
    (tmp, ws, mm)
}

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn import(ws: &mut Workspace, mm: &ModuleManager, file: &str) -> Value {
    let data = std::fs::read(testdata(file)).unwrap();
    call(ws, mm, "import", json!({"name": file, "data": B64.encode(data)})).unwrap()
}

fn bytes(ws: &mut Workspace, mm: &ModuleManager, id: &Value, version: Option<u64>) -> Vec<u8> {
    let r = call(ws, mm, "read", json!({"id": id, "version": version})).unwrap();
    B64.decode(r["data"].as_str().unwrap()).unwrap()
}

#[test]
fn import_classifies_every_test_file() {
    let (_t, mut ws, mm) = setup();
    for (file, status, pages) in [
        ("simplu-1-pagina.pdf", "intact", Some(1)),
        ("multipagina-50.pdf", "intact", Some(50)),
        ("rotite-si-formate.pdf", "intact", Some(4)),
        ("actualizare-incrementala.pdf", "intact", Some(3)),
        ("xref-stream-pdf15.pdf", "intact", Some(3)),
        ("formular.pdf", "intact", Some(1)),
        ("cu-imagine.pdf", "intact", Some(1)),
        ("semne-de-carte-si-legaturi.pdf", "intact", Some(3)),
        ("stricat-trunchiat.pdf", "deteriorat", None),
        ("stricat-octeti.pdf", "deteriorat", None),
        ("stricat-xref-gresit.pdf", "deteriorat", None),
        ("ostil-imbricare-adanca.pdf", "deteriorat", None),
    ] {
        let r = import(&mut ws, &mm, file);
        assert_eq!(r["status"], status, "{file}: {r}");
        assert_eq!(r["pages"].as_u64(), pages.map(|p: u64| p), "{file}");
        // The original is stored exactly as received, even when damaged.
        let stored = bytes(&mut ws, &mm, &r["document"]["id"], Some(1));
        assert_eq!(stored, std::fs::read(testdata(file)).unwrap(), "{file}");
    }
    for file in ["nu-e-pdf.pdf", "gol.pdf"] {
        let data = std::fs::read(testdata(file)).unwrap();
        let err = call(&mut ws, &mm, "import", json!({"name": file, "data": B64.encode(data)})).unwrap_err();
        assert!(err.to_string().contains("nu este un PDF"), "{file}: {err}");
    }
    assert_eq!(
        call(&mut ws, &mm, "list", json!({})).unwrap().as_array().unwrap().len(),
        12
    );
}

#[test]
fn damaged_pdfs_are_read_only() {
    let (_t, mut ws, mm) = setup();
    let r = import(&mut ws, &mm, "stricat-trunchiat.pdf");
    let id = &r["document"]["id"];
    assert!(r["reason"].as_str().unwrap().contains("trunchiat"), "{r}");
    // Reading is allowed (the viewer decides what it can show) …
    assert!(!bytes(&mut ws, &mm, id, None).is_empty());
    // … every change is refused.
    for (cmd, a) in [
        ("rotate", json!({"id": id, "based_on": 1, "pages": [1], "apply": true})),
        (
            "delete_pages",
            json!({"id": id, "based_on": 1, "pages": [1], "apply": true}),
        ),
        ("extract", json!({"id": id, "pages": [1], "name": "x", "apply": true})),
        ("text", json!({"id": id})),
    ] {
        let err = call(&mut ws, &mm, cmd, a).unwrap_err();
        assert!(err.to_string().contains("deteriorat"), "{cmd}: {err}");
    }
    assert_eq!(
        call(&mut ws, &mm, "info", json!({"id": id})).unwrap()["versions"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn rotate_previews_then_saves_a_new_version_keeping_the_original() {
    let (_t, mut ws, mm) = setup();
    let id = import(&mut ws, &mm, "rotite-si-formate.pdf")["document"]["id"].clone();
    let original = bytes(&mut ws, &mm, &id, Some(1));
    let p = call(
        &mut ws,
        &mm,
        "rotate",
        json!({"id": id, "based_on": 1, "pages": [1, 4], "angle": 90}),
    )
    .unwrap();
    assert_eq!(p["applied"], false);
    assert_eq!(p["pages"], 4);
    assert!(
        B64.decode(p["preview"].as_str().unwrap())
            .unwrap()
            .starts_with(b"%PDF-")
    );
    // A preview changes nothing.
    assert_eq!(call(&mut ws, &mm, "info", json!({"id": id})).unwrap()["version"], 1);
    let r = call(
        &mut ws,
        &mm,
        "rotate",
        json!({"id": id, "based_on": 1, "pages": [1, 4], "angle": 90, "apply": true}),
    )
    .unwrap();
    assert_eq!(r["version"], 2);
    let info = call(&mut ws, &mm, "info", json!({"id": id})).unwrap();
    assert_eq!(info["rotations"], json!([90, 90, 180, 0]));
    assert_eq!(info["versions"][1]["note"], "2 pagini rotite cu 90°");
    assert_eq!(bytes(&mut ws, &mm, &id, Some(1)), original);
    // Editing a version that is no longer current is refused.
    let err = call(
        &mut ws,
        &mm,
        "rotate",
        json!({"id": id, "based_on": 1, "pages": [2], "apply": true}),
    )
    .unwrap_err();
    assert!(err.to_string().contains("salvat între timp"), "{err}");
}

#[test]
fn delete_extract_merge_keep_every_page_text() {
    let (_t, mut ws, mm) = setup();
    let id50 = import(&mut ws, &mm, "multipagina-50.pdf")["document"]["id"].clone();
    let texts = call(&mut ws, &mm, "text", json!({"id": id50})).unwrap();
    assert_eq!(texts.as_array().unwrap().len(), 50);
    assert!(texts[49].as_str().unwrap().contains("Pagina 50 din 50"));

    // Delete pages 2..49 → pages 1 and 50 remain, with their own text.
    let pages: Vec<u32> = (2..=49).collect();
    let r = call(
        &mut ws,
        &mm,
        "delete_pages",
        json!({"id": id50, "based_on": 1, "pages": pages, "apply": true}),
    )
    .unwrap();
    assert_eq!(r["pages"], 2);
    let now = call(&mut ws, &mm, "text", json!({"id": id50})).unwrap();
    assert_eq!(now, json!([texts[0], texts[49]]));
    assert!(
        call(
            &mut ws,
            &mm,
            "delete_pages",
            json!({"id": id50, "based_on": 2, "pages": [1, 2]})
        )
        .is_err(),
        "not all pages"
    );

    // Extract pages 3 and 1 from the incremental-update file → a new document.
    let inc = import(&mut ws, &mm, "actualizare-incrementala.pdf")["document"]["id"].clone();
    let e = call(
        &mut ws,
        &mm,
        "extract",
        json!({"id": inc, "pages": [3, 1], "name": "extras", "apply": true}),
    )
    .unwrap();
    assert_eq!(e["pages"], 2);
    assert_eq!(e["document"]["name"], "extras.pdf");
    let et = call(&mut ws, &mm, "text", json!({"id": e["document"]["id"]})).unwrap();
    assert!(et[1].as_str().unwrap().contains("Pagina 3 adaugata"), "{et}");

    // Merge three documents (one with object streams) → pages and texts in order.
    let xs = import(&mut ws, &mm, "xref-stream-pdf15.pdf")["document"]["id"].clone();
    let one = import(&mut ws, &mm, "simplu-1-pagina.pdf")["document"]["id"].clone();
    let m = call(
        &mut ws,
        &mm,
        "merge",
        json!({"ids": [one, xs, inc], "name": "unit.pdf", "apply": true}),
    )
    .unwrap();
    assert_eq!(m["pages"], 1 + 3 + 3);
    let mt = call(&mut ws, &mm, "text", json!({"id": m["document"]["id"]})).unwrap();
    assert!(mt[0].as_str().unwrap().contains("K.G.B. test simplu"));
    assert!(mt[3].as_str().unwrap().contains("Obiecte comprimate 3"));
    assert!(mt[5].as_str().unwrap().contains("Pagina 2 MODIFICATA"));
    // The sources are untouched.
    assert_eq!(call(&mut ws, &mm, "info", json!({"id": xs})).unwrap()["version"], 1);
}

#[test]
fn thumbnails_restore_and_export() {
    let (tmp, mut ws, mm) = setup();
    let id = import(&mut ws, &mm, "cu-imagine.pdf")["document"]["id"].clone();
    let t = call(&mut ws, &mm, "thumb", json!({"id": id, "page": 1, "width": 120})).unwrap();
    let png = B64.decode(t["png"].as_str().unwrap()).unwrap();
    assert!(png.starts_with(b"\x89PNG"));
    assert!(call(&mut ws, &mm, "thumb", json!({"id": id, "page": 2})).is_err());

    call(
        &mut ws,
        &mm,
        "rotate",
        json!({"id": id, "based_on": 1, "pages": [1], "apply": true}),
    )
    .unwrap();
    let r = call(&mut ws, &mm, "restore", json!({"id": id, "version": 1})).unwrap();
    assert_eq!(r["number"], 3);
    assert_eq!(bytes(&mut ws, &mm, &id, None), bytes(&mut ws, &mm, &id, Some(1)));

    let dest = tmp.path().join("copie.pdf");
    call(&mut ws, &mm, "export", json!({"id": id, "version": 2, "dest": dest})).unwrap();
    assert_eq!(std::fs::read(&dest).unwrap(), bytes(&mut ws, &mm, &id, Some(2)));
    assert!(matches!(
        call(&mut ws, &mm, "export", json!({"id": id, "dest": dest})),
        Err(CoreError::AlreadyExists(_))
    ));
}

#[test]
fn bad_arguments_are_refused_clearly() {
    let (_t, mut ws, mm) = setup();
    let id = import(&mut ws, &mm, "simplu-1-pagina.pdf")["document"]["id"].clone();
    let err = call(
        &mut ws,
        &mm,
        "rotate",
        json!({"id": id, "based_on": 1, "pages": [7], "apply": true}),
    )
    .unwrap_err();
    assert!(err.to_string().contains("pagina 7 nu există"), "{err}");
    let err = call(
        &mut ws,
        &mm,
        "rotate",
        json!({"id": id, "based_on": 1, "pages": [1], "angle": 45}),
    )
    .unwrap_err();
    assert!(err.to_string().contains("90"), "{err}");
    assert!(call(&mut ws, &mm, "merge", json!({"ids": [id], "name": "x"})).is_err());
    assert!(
        call(
            &mut ws,
            &mm,
            "rotate",
            json!({"id": id, "based_on": 1, "pages": [1], "extra": 1})
        )
        .is_err()
    );
    assert!(call(&mut ws, &mm, "import", json!({"name": "a.pdf", "data": "%%%"})).is_err());
}

/// Step 7.4l-1a: watermark, header and footer over the pages — preview,
/// then a new version; every page keeps its own text; Romanian letters and
/// page numbers in the overlay; the page as shown changes (rendered).
#[test]
fn stamp_watermark_header_footer() {
    let (_t, mut ws, mm) = setup();
    let id = import(&mut ws, &mm, "rotite-si-formate.pdf")["document"]["id"].clone();
    let before: Vec<String> = serde_json::from_value(call(&mut ws, &mm, "text", json!({"id": id})).unwrap()).unwrap();
    let thumb = |ws: &mut Workspace, v: u64, page: u32| call(ws, &mm, "thumb", json!({"id": id, "version": v, "page": page, "width": 300})).unwrap()["png"].as_str().unwrap().to_string();
    let args = json!({"id": id, "based_on": 1, "filigran": "CONFIDENȚIAL — copie", "antet": "Fier Vechi SRL · Iași", "subsol": "Pagina {n} din {total}"});
    let p = call(&mut ws, &mm, "stamp", args.clone()).unwrap();
    assert_eq!((p["applied"].as_bool(), p["pages"].as_u64()), (Some(false), Some(4)));
    assert_eq!(p["summary"], "filigran, antet, subsol pe 4 pagini");
    assert_eq!(call(&mut ws, &mm, "info", json!({"id": id})).unwrap()["version"], 1, "a preview changes nothing");
    let mut a = args.clone();
    a["apply"] = json!(true);
    let r = call(&mut ws, &mm, "stamp", a).unwrap();
    assert_eq!(r["version"], 2);
    let out = bytes(&mut ws, &mm, &id, Some(2));
    for p in 1..=4 {
        assert!(kgb_pdf::overlay::has_overlay(&out, p), "page {p}");
    }
    let after: Vec<String> = serde_json::from_value(call(&mut ws, &mm, "text", json!({"id": id})).unwrap()).unwrap();
    assert_eq!(after, before, "each page keeps exactly its own text");
    let info = call(&mut ws, &mm, "info", json!({"id": id})).unwrap();
    assert_eq!(info["rotations"], json!([0, 90, 180, 270]), "rotations unchanged");
    // The overlay's own words: diacritics and the page numbers.
    let o = kgb_pdf::overlay::Overlay { watermark: "CONFIDENȚIAL".into(), header: "Fier Vechi SRL · Iași".into(), footer: "Pagina {n} din {total}".into(), ..Default::default() };
    let t = kgb_pdf::overlay::overlay_text(&[(595.0, 842.0), (842.0, 595.0)], &o).unwrap();
    for w in ["CONFIDENȚIAL", "Iași", "Pagina 1 din 2", "Pagina 2 din 2"] {
        assert!(t.contains(w), "{w} in {t}");
    }
    // The pages as shown are different now (also the one turned upside down).
    for page in [1, 3] {
        assert_ne!(thumb(&mut ws, 1, page), thumb(&mut ws, 2, page), "page {page} changed");
    }
    if let Ok(dir) = std::env::var("KGB_STAMP_PREVIEW") {
        for page in 1..=4 {
            let png = B64.decode(thumb(&mut ws, 2, page)).unwrap();
            std::fs::write(std::path::Path::new(&dir).join(format!("stamp-{page}.png")), png).unwrap();
        }
    }
    // Only chosen pages; bad input refused.
    let r = call(&mut ws, &mm, "stamp", json!({"id": id, "based_on": 2, "pages": [2], "filigran": "ANULAT", "apply": true})).unwrap();
    assert_eq!(r["summary"], "filigran pe 1 pagină");
    assert!(call(&mut ws, &mm, "stamp", json!({"id": id, "based_on": 3})).unwrap_err().to_string().contains("filigranul, antetul, subsolul"));
    assert!(call(&mut ws, &mm, "stamp", json!({"id": id, "based_on": 3, "pages": [9], "antet": "x"})).unwrap_err().to_string().contains("nu există"));
    assert!(call(&mut ws, &mm, "stamp", json!({"id": id, "based_on": 3, "antet": "a\nb"})).is_err());
    assert!(call(&mut ws, &mm, "stamp", json!({"id": id, "based_on": 3, "antet": "#{panic()}"})).is_ok(), "typed text is data, not Typst code");
}

/// Step 7.4l-1b: a text stamp and an image (PNG/JPEG) in a chosen place.
#[test]
fn stamp_and_image_on_pages() {
    let (_t, mut ws, mm) = setup();
    let id = import(&mut ws, &mm, "rotite-si-formate.pdf")["document"]["id"].clone();
    // A real PNG: the thumbnail of the first page.
    let png = call(&mut ws, &mm, "thumb", json!({"id": id, "page": 1, "width": 120})).unwrap()["png"].as_str().unwrap().to_string();
    let before: Vec<String> = serde_json::from_value(call(&mut ws, &mm, "text", json!({"id": id})).unwrap()).unwrap();
    let r = call(&mut ws, &mm, "stamp", json!({"id": id, "based_on": 1, "pages": [1, 3],
        "stampila": {"text": "PLĂTIT 09.11.2026", "culoare": "albastru", "pozitie": "sus-dreapta"},
        "imagine": {"date": png, "latime_mm": 30, "pozitie": "jos-stanga"}, "apply": true})).unwrap();
    assert_eq!(r["summary"], "ștampilă, imagine pe 2 pagini");
    let out = bytes(&mut ws, &mm, &id, Some(2));
    assert!(kgb_pdf::overlay::has_overlay(&out, 1) && kgb_pdf::overlay::has_overlay(&out, 3) && !kgb_pdf::overlay::has_overlay(&out, 2));
    let after: Vec<String> = serde_json::from_value(call(&mut ws, &mm, "text", json!({"id": id})).unwrap()).unwrap();
    assert_eq!(after, before);
    if let Ok(dir) = std::env::var("KGB_STAMP_PREVIEW") {
        for page in [1, 3] {
            let png = call(&mut ws, &mm, "thumb", json!({"id": id, "version": 2, "page": page, "width": 300})).unwrap()["png"].as_str().unwrap().to_string();
            std::fs::write(std::path::Path::new(&dir).join(format!("stampila-{page}.png")), B64.decode(png).unwrap()).unwrap();
        }
    }
    let err = |ws: &mut Workspace, a: Value| call(ws, &mm, "stamp", a).unwrap_err().to_string();
    let base = |extra: Value| { let mut a = json!({"id": id, "based_on": 2}); for (k, v) in extra.as_object().unwrap() { a[k] = v.clone(); } a };
    assert!(err(&mut ws, base(json!({"imagine": {"date": B64.encode(b"GIF89a....")}}))).contains("PNG sau JPEG"));
    assert!(err(&mut ws, base(json!({"imagine": {"date": png, "latime_mm": 500}}))).contains("5 și 200"));
    assert!(err(&mut ws, base(json!({"stampila": {"text": "OK", "pozitie": "undeva"}}))).contains("poziție"));
    assert!(err(&mut ws, base(json!({"stampila": {"text": "OK", "culoare": "mov"}}))).contains("culoarea"));
    assert!(err(&mut ws, base(json!({"stampila": {"text": ""}}))).contains("1–40"));
}

/// Step 7.4l-1b2: stamps as in Cyber Office Studio — `/Stamp` annotations
/// with their drawing; a preset with the line under it, colour, opacity;
/// „Ștampilele mele” (PNG) kept as the module's files, at most 12.
#[test]
fn stamp_annotations_and_my_stamps() {
    let (_t, mut ws, mm) = setup();
    let id = import(&mut ws, &mm, "rotite-si-formate.pdf")["document"]["id"].clone();
    let before: Vec<String> = serde_json::from_value(call(&mut ws, &mm, "text", json!({"id": id})).unwrap()).unwrap();
    let p = call(&mut ws, &mm, "stamp_annot", json!({"id": id, "based_on": 1, "text": "APROBAT", "sub": "Ion Pop · 09.11.2026", "culoare": "#1a237e", "opacitate": 0.6, "pozitie": "sus-dreapta", "autor": "Ion Pop"})).unwrap();
    assert_eq!((p["applied"].as_bool(), p["summary"].as_str()), (Some(false), Some("ștampila „APROBAT” pe 4 pagini")));
    let r = call(&mut ws, &mm, "stamp_annot", json!({"id": id, "based_on": 1, "text": "APROBAT", "sub": "Ion Pop · 09.11.2026", "culoare": "#1a237e", "opacitate": 0.6, "pozitie": "sus-dreapta", "autor": "Ion Pop", "apply": true})).unwrap();
    assert_eq!(r["version"], 2);
    let out = bytes(&mut ws, &mm, &id, Some(2));
    for p in 1..=4 {
        assert_eq!(kgb_pdf::stamp::stamps_on(&out, p), vec!["APROBAT Ion Pop · 09.11.2026".to_string()], "page {p}");
    }
    let after: Vec<String> = serde_json::from_value(call(&mut ws, &mm, "text", json!({"id": id})).unwrap()).unwrap();
    assert_eq!(after, before, "the pages keep their text");
    let raw = String::from_utf8_lossy(&out);
    assert!(raw.contains("/Subtype /Stamp") || raw.contains("/Subtype/Stamp"), "real stamp annotations");
    if let Ok(dir) = std::env::var("KGB_STAMP_PREVIEW") {
        std::fs::write(Path::new(&dir).join("stampile-cos.pdf"), &out).unwrap();
    }

    // My stamps: a PNG, listed, put on page 2 only, deleted.
    let png = call(&mut ws, &mm, "thumb", json!({"id": id, "page": 1, "width": 120})).unwrap()["png"].as_str().unwrap().to_string();
    let s = call(&mut ws, &mm, "stampila_save", json!({"nume": "Ștampila firmei", "date": png})).unwrap();
    assert!(call(&mut ws, &mm, "stampila_save", json!({"nume": "ștampila firmei", "date": png})).unwrap_err().to_string().contains("există deja"));
    assert!(call(&mut ws, &mm, "stampila_save", json!({"nume": "x/y", "date": png})).is_err());
    assert!(call(&mut ws, &mm, "stampila_save", json!({"nume": "JPEG", "date": B64.encode([0xFF, 0xD8, 0xFF, 0])})).unwrap_err().to_string().contains("PNG"));
    let lib = call(&mut ws, &mm, "stampile", json!({})).unwrap();
    assert_eq!((lib.as_array().unwrap().len(), lib[0]["nume"].as_str()), (1, Some("Ștampila firmei")));
    assert!(lib[0]["raport"].as_f64().unwrap() > 0.5);
    let r = call(&mut ws, &mm, "stamp_annot", json!({"id": id, "based_on": 2, "pages": [2], "biblioteca": s["id"], "latime_mm": 40, "pozitie": "jos-stanga", "apply": true})).unwrap();
    assert_eq!(r["summary"], "ștampila „Ștampila firmei” pe 1 pagină");
    let out = bytes(&mut ws, &mm, &id, Some(3));
    assert_eq!(kgb_pdf::stamp::stamps_on(&out, 2).len(), 2);
    assert_eq!(kgb_pdf::stamp::stamps_on(&out, 1).len(), 1);
    if let Ok(dir) = std::env::var("KGB_STAMP_PREVIEW") {
        std::fs::write(Path::new(&dir).join("stampile-cos-2.pdf"), &out).unwrap();
    }
    call(&mut ws, &mm, "stampila_delete", json!({"id": s["id"]})).unwrap();
    assert!(call(&mut ws, &mm, "stampile", json!({})).unwrap().as_array().unwrap().is_empty());

    // Refused clearly.
    let e = |ws: &mut Workspace, a: Value| call(ws, &mm, "stamp_annot", a).unwrap_err().to_string();
    assert!(e(&mut ws, json!({"id": id, "based_on": 3, "text": ""})).contains("1–40"));
    assert!(e(&mut ws, json!({"id": id, "based_on": 3, "text": "OK", "culoare": "#ff00ff"})).contains("negru"));
    assert!(e(&mut ws, json!({"id": id, "based_on": 3, "text": "OK", "opacitate": 0.1})).contains("20%"));
    assert!(e(&mut ws, json!({"id": id, "based_on": 3, "text": "OK", "pozitie": "afară"})).contains("poziție"));
}

/// Step 7.4l-1c: hiding data for good — the page with zones becomes an image
/// with black over them (its text leaves the file), the other pages keep
/// their text exactly; preview first, then a new version.
#[test]
fn redact_zones_for_good() {
    let (_t, mut ws, mm) = setup();
    let id = import(&mut ws, &mm, "multipagina-50.pdf")["document"]["id"].clone();
    let before: Vec<String> = serde_json::from_value(call(&mut ws, &mm, "text", json!({"id": id})).unwrap()).unwrap();
    assert!(!before[1].is_empty());
    let zone = json!([{"page": 2, "x": 40, "y": 40, "w": 300, "h": 60}, {"page": 2, "x": 40, "y": 200, "w": 200, "h": 30}]);
    let p = call(&mut ws, &mm, "redact", json!({"id": id, "based_on": 1, "zone": zone})).unwrap();
    assert_eq!(p["summary"], "2 zone ascunse pe 1 pagină (devine imagine)");
    let r = call(&mut ws, &mm, "redact", json!({"id": id, "based_on": 1, "zone": zone, "apply": true})).unwrap();
    assert_eq!(r["version"], 2);
    let after: Vec<String> = serde_json::from_value(call(&mut ws, &mm, "text", json!({"id": id})).unwrap()).unwrap();
    assert_eq!(after.len(), 50);
    assert!(after[1].is_empty(), "page 2: no text left in the file");
    assert_eq!(after[0], before[0]);
    assert_eq!(after[2..], before[2..], "the other pages keep their text");
    let out = bytes(&mut ws, &mm, &id, Some(2));
    if let Ok(dir) = std::env::var("KGB_STAMP_PREVIEW") {
        std::fs::write(Path::new(&dir).join("ascuns.pdf"), &out).unwrap();
    }
    // The black is really on the page (rendered): the zone's middle is black.
    let png = B64.decode(call(&mut ws, &mm, "thumb", json!({"id": id, "version": 2, "page": 2, "width": 595})).unwrap()["png"].as_str().unwrap()).unwrap();
    assert!(png.len() > 100);
    // A redacted document can still be merged with another.
    let other = import(&mut ws, &mm, "simplu-1-pagina.pdf")["document"]["id"].clone();
    let m = call(&mut ws, &mm, "merge", json!({"ids": [id, other], "name": "unit"}));
    assert!(m.is_ok(), "{m:?}");
    assert!(call(&mut ws, &mm, "redact", json!({"id": id, "based_on": 2, "zone": []})).unwrap_err().to_string().contains("cel puțin o zonă"));
    assert!(call(&mut ws, &mm, "redact", json!({"id": id, "based_on": 2, "zone": [{"page": 99, "x": 0, "y": 0, "w": 10, "h": 10}]})).unwrap_err().to_string().contains("nu există"));
}

/// A stamped, then redacted document still merges (found by the window test).
#[test]
fn stamped_redacted_merges() {
    let (_t, mut ws, mm) = setup();
    let id = import(&mut ws, &mm, "simplu-1-pagina.pdf")["document"]["id"].clone();
    call(&mut ws, &mm, "stamp_annot", json!({"id": id, "based_on": 1, "text": "APROBAT", "pozitie": "sus-dreapta", "apply": true})).unwrap();
    call(&mut ws, &mm, "redact", json!({"id": id, "based_on": 2, "zone": [{"page": 1, "x": 40, "y": 40, "w": 200, "h": 40}], "apply": true})).unwrap();
    let other = import(&mut ws, &mm, "rotite-si-formate.pdf")["document"]["id"].clone();
    let m = call(&mut ws, &mm, "merge", json!({"ids": [id, other], "name": "unit"}));
    assert!(m.is_ok(), "{m:?}");
}

/// Step 7.4l-1c2: a result made in the window (pdf-lib tools from COS) is
/// checked here like every other one: strict check, same pages, the pages
/// said to be untouched keep their text; then a preview or a new version.
#[test]
fn save_edit_checks_window_results() {
    let (_t, mut ws, mm) = setup();
    let id = import(&mut ws, &mm, "rotite-si-formate.pdf")["document"]["id"].clone();
    let same = B64.encode(bytes(&mut ws, &mm, &id, Some(1)));
    let p = call(&mut ws, &mm, "save_edit", json!({"id": id, "based_on": 1, "data": same, "summary": "test", "same_text_pages": [1, 2, 3, 4]})).unwrap();
    assert_eq!((p["applied"].as_bool(), p["pages"].as_u64()), (Some(false), Some(4)));
    let other = B64.encode(std::fs::read(testdata("simplu-1-pagina.pdf")).unwrap());
    assert!(call(&mut ws, &mm, "save_edit", json!({"id": id, "based_on": 1, "data": other, "summary": "x"})).unwrap_err().to_string().contains("pagini în loc de"));
    let broken = B64.encode(std::fs::read(testdata("stricat-trunchiat.pdf")).unwrap());
    assert!(call(&mut ws, &mm, "save_edit", json!({"id": id, "based_on": 1, "data": broken, "summary": "x"})).unwrap_err().to_string().contains("verificarea"));
    let four = B64.encode(bytes(&mut ws, &mm, &id, Some(1)));
    assert!(call(&mut ws, &mm, "save_edit", json!({"id": id, "based_on": 1, "data": four, "summary": " "})).is_err(), "a summary is needed");
    let r = call(&mut ws, &mm, "save_edit", json!({"id": id, "based_on": 1, "data": four, "summary": "ascuns", "apply": true})).unwrap();
    assert_eq!(r["version"], 2);
}
