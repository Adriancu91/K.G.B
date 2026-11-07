//! Page operations with lopdf (D-032) and the non-corruption check that runs
//! on every result before it is saved (the same rule as spike S4: the result
//! reopens, passes the strict check, has the expected pages, and every kept
//! page has exactly the text it had before).

use std::collections::BTreeMap;

use lopdf::{Dictionary, Document, Object, ObjectId};

use crate::check::{self, Status};

pub fn load(b: &[u8]) -> Result<Document, String> {
    Document::load_mem(b).map_err(|e| format!("PDF-ul nu se poate citi: {e}"))
}

pub fn save(doc: &mut Document) -> Result<Vec<u8>, String> {
    let mut v = Vec::new();
    doc.save_to(&mut v)
        .map_err(|e| format!("PDF-ul nu se poate scrie: {e}"))?;
    Ok(v)
}

/// Text of every page, in order (1-based page numbers → text).
pub fn page_texts(doc: &Document) -> Vec<String> {
    doc.get_pages()
        .keys()
        .map(|p| norm(&doc.extract_text(&[*p]).unwrap_or_default()))
        .collect()
}

fn norm(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub fn rotations(doc: &Document) -> Vec<i64> {
    doc.get_pages()
        .values()
        .map(|id| {
            inherited(doc, *id, b"Rotate")
                .and_then(|o| o.as_i64().ok())
                .unwrap_or(0)
                .rem_euclid(360)
        })
        .collect()
}

fn inherited(doc: &Document, page: ObjectId, key: &[u8]) -> Option<Object> {
    let mut cur = Some(page);
    let mut depth = 0;
    while let Some(id) = cur {
        depth += 1;
        if depth > 64 {
            return None;
        }
        let d = doc.get_dictionary(id).ok()?;
        if let Ok(v) = d.get(key) {
            return Some(v.clone());
        }
        cur = d.get(b"Parent").and_then(Object::as_reference).ok();
    }
    None
}

/// Copies inherited page attributes onto each page, so a page stays correct
/// when it is moved into another document or its parent changes.
fn flatten_inherited(doc: &mut Document) {
    let pages: Vec<ObjectId> = doc.get_pages().values().copied().collect();
    for id in pages {
        let add: Vec<(&[u8], Object)> = [b"Resources".as_slice(), b"MediaBox", b"CropBox", b"Rotate"]
            .into_iter()
            .filter(|k| doc.get_dictionary(id).is_ok_and(|d| !d.has(k)))
            .filter_map(|k| inherited(doc, id, k).map(|v| (k, v)))
            .collect();
        if let Ok(d) = doc.get_object_mut(id).and_then(Object::as_dict_mut) {
            for (k, v) in add {
                d.set(k, v);
            }
        }
    }
}

fn check_pages(doc: &Document, pages: &[u32]) -> Result<(), String> {
    let n = doc.get_pages().len() as u32;
    if pages.is_empty() {
        return Err("nu ai ales nicio pagină".into());
    }
    if let Some(p) = pages.iter().find(|p| **p == 0 || **p > n) {
        return Err(format!("pagina {p} nu există (documentul are {n})"));
    }
    Ok(())
}

/// Rotates the chosen pages by `angle` (a multiple of 90).
pub fn rotate(src: &[u8], pages: &[u32], angle: i64) -> Result<Vec<u8>, String> {
    if angle % 90 != 0 {
        return Err("rotirea se face doar cu multipli de 90°".into());
    }
    let mut doc = load(src)?;
    check_pages(&doc, pages)?;
    flatten_inherited(&mut doc);
    let ids: BTreeMap<u32, ObjectId> = doc.get_pages();
    for p in pages {
        let id = ids[p];
        let d = doc
            .get_object_mut(id)
            .and_then(Object::as_dict_mut)
            .map_err(|e| e.to_string())?;
        let cur = d.get(b"Rotate").and_then(Object::as_i64).unwrap_or(0);
        d.set("Rotate", (cur + angle).rem_euclid(360));
    }
    save(&mut doc)
}

/// A document with only the chosen pages (in their original order).
pub fn keep(src: &[u8], pages: &[u32]) -> Result<Vec<u8>, String> {
    let mut doc = load(src)?;
    check_pages(&doc, pages)?;
    flatten_inherited(&mut doc);
    let all: Vec<u32> = doc.get_pages().keys().copied().collect();
    let del: Vec<u32> = all.into_iter().filter(|p| !pages.contains(p)).collect();
    doc.delete_pages(&del);
    doc.prune_objects();
    save(&mut doc)
}

/// All pages of all documents, in order. Bookmarks, forms and links between
/// documents are not carried over (the interface says so before merging).
pub fn merge(srcs: &[Vec<u8>]) -> Result<Vec<u8>, String> {
    if srcs.len() < 2 {
        return Err("pentru unire alege cel puțin două documente".into());
    }
    let mut out = Document::with_version("1.7");
    let mut max_id = 1;
    let mut page_ids = Vec::new();
    for b in srcs {
        let mut d = load(b)?;
        flatten_inherited(&mut d);
        d.renumber_objects_with(max_id);
        max_id = d.max_id + 1;
        let pages: Vec<ObjectId> = d.get_pages().values().copied().collect();
        for (id, o) in d.objects {
            let skip = o
                .as_dict()
                .ok()
                .and_then(|x| x.get(b"Type").ok())
                .and_then(|t| t.as_name().ok())
                .is_some_and(|n| n == b"Catalog" || n == b"Pages");
            if !skip {
                out.objects.insert(id, o);
            }
        }
        page_ids.extend(pages);
    }
    out.max_id = max_id;
    let pages_id = out.new_object_id();
    for id in &page_ids {
        if let Ok(d) = out.get_object_mut(*id).and_then(Object::as_dict_mut) {
            d.set("Parent", pages_id);
        }
    }
    let mut pages = Dictionary::new();
    pages.set("Type", "Pages");
    pages.set("Count", page_ids.len() as i64);
    pages.set(
        "Kids",
        page_ids.iter().map(|id| Object::Reference(*id)).collect::<Vec<_>>(),
    );
    out.objects.insert(pages_id, Object::Dictionary(pages));
    let mut cat = Dictionary::new();
    cat.set("Type", "Catalog");
    cat.set("Pages", pages_id);
    let cat_id = out.add_object(cat);
    out.trailer.set("Root", cat_id);
    out.prune_objects();
    save(&mut out)
}

/// The non-corruption check. `expected` lists, for each page of the result,
/// the text it must have; `rot` the rotation it must have (if checked).
pub fn verify(result: &[u8], expected: &[String], rot: Option<&[i64]>) -> Result<usize, String> {
    let n = match check::check(result) {
        Status::Intact(n) => n,
        s => return Err(format!("rezultatul nu trece verificarea: {}", s.reason())),
    };
    if n != expected.len() {
        return Err(format!("rezultatul are {n} pagini în loc de {}", expected.len()));
    }
    let doc = load(result)?;
    let texts = page_texts(&doc);
    if let Some(i) = texts.iter().zip(expected).position(|(a, b)| a != b) {
        return Err(format!("textul paginii {} nu s-a păstrat", i + 1));
    }
    if let Some(r) = rot
        && rotations(&doc) != r
    {
        return Err("rotirea paginilor nu a ieșit cum trebuia".into());
    }
    Ok(n)
}
