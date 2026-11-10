//! The notebook of the Notes window copied from Cyber Office Studio (7.4l-2b): the window reads and writes
//! the whole notebook at once (JSON `suite-notes`), the core keeps one record per note.
//!
//! - collection `pages`: one note per record (id = uuid v5 of the note's own id), its JSON without the large
//!   pictures, its `updated_ms`, whether it is in the trash, its place in the list;
//! - collection `notebook`: one record (fixed id) with the rest of the notebook (sections, colours, groups,
//!   notebooks) and the map picture hash → module file;
//! - pictures over 16 KB are module files, stored once by their blake3 hash; the note keeps `kgbimg:<hash>`.
//!
//! Two PCs: `notebook_load` also returns what it read (`seen`: every note's `updated_ms`, the notebook
//! record's version). `notebook_save` deletes a note missing from the window only if the window had seen
//! it and it has not changed since; a note that arrived from another PC after the load stays; when the
//! same note changed in both places the newer `updated_ms` wins (and the log says so). The notebook record
//! is merged, not overwritten, when it changed since the load.

use std::collections::{BTreeMap, BTreeSet, HashMap};

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::modules::ModuleContext;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, RecordState, Write};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use uuid::Uuid;

pub const PAGES: &str = "pages";
pub const NOTEBOOK: &str = "notebook";
/// Pictures larger than this leave the note and become module files.
const PICTURE_INLINE_MAX: usize = 16 * 1024;
/// One note, without its large pictures.
const NOTE_MAX: usize = 2 * 1024 * 1024;
/// The whole notebook handed over by the window.
const NOTEBOOK_MAX: usize = 256 * 1024 * 1024;
const IMG: &str = "kgbimg:";

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("caietul de notițe", detail)
}

fn ns() -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_URL, b"kgb://kgb.notes/")
}
pub fn page_id(note_id: &str) -> Uuid {
    Uuid::new_v5(&ns(), format!("page/{note_id}").as_bytes())
}
pub fn notebook_id() -> Uuid {
    Uuid::new_v5(&ns(), b"notebook")
}

/// `2026-11-10T12:34:56.789Z` → milliseconds since 1970 (0 if it cannot be read).
pub fn iso_ms(s: &str) -> u64 {
    let b = s.as_bytes();
    let num = |a: usize, n: usize| -> Option<i64> { s.get(a..a + n)?.parse().ok() };
    let (Some(y), Some(mo), Some(d)) = (num(0, 4), num(5, 2), num(8, 2)) else {
        return 0;
    };
    if b.len() < 10 || b[4] != b'-' || b[7] != b'-' {
        return 0;
    }
    let (h, mi, se) = if b.len() >= 19 {
        (
            num(11, 2).unwrap_or(0),
            num(14, 2).unwrap_or(0),
            num(17, 2).unwrap_or(0),
        )
    } else {
        (0, 0, 0)
    };
    let ms = if b.len() >= 23 && b[19] == b'.' {
        num(20, 3).unwrap_or(0)
    } else {
        0
    };
    // Days from the civil date (H. Hinnant).
    let (yy, m) = if mo <= 2 { (y - 1, mo + 9) } else { (y, mo - 3) };
    let era = yy.div_euclid(400);
    let yoe = yy - era * 400;
    let doy = (153 * m + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    let t = ((days * 24 + h) * 60 + mi) * 60 + se;
    if t < 0 { 0 } else { (t * 1000 + ms) as u64 }
}

/// What the window read: every note's `updated_ms` and the notebook record's version.
#[derive(Serialize, Deserialize, Default, Debug, Clone)]
pub struct SeenState {
    #[serde(default)]
    pub notes: BTreeMap<String, u64>,
    #[serde(default)]
    pub notebook_version: u64,
}

struct Stored {
    rec: RecordState,
    note: Value,
    updated_ms: u64,
    trashed: bool,
}

fn stored_pages(ctx: &mut ModuleContext<'_>) -> CoreResult<HashMap<String, Stored>> {
    let mut out = HashMap::new();
    for r in ctx.scan(PAGES, |r| !r.deleted)? {
        let note = r.fields.get("note").cloned().unwrap_or(Value::Null);
        let Some(id) = note.get("id").and_then(Value::as_str).map(String::from) else {
            continue;
        };
        let updated_ms = r.fields.get("updated_ms").and_then(Value::as_u64).unwrap_or(0);
        let trashed = r.fields.get("trashed").and_then(Value::as_bool).unwrap_or(false);
        out.insert(
            id,
            Stored {
                rec: r,
                note,
                updated_ms,
                trashed,
            },
        );
    }
    Ok(out)
}

struct Book {
    version: u64,
    meta: Map<String, Value>,
    images: BTreeMap<String, String>,
    exists: bool,
}

fn stored_book(ctx: &mut ModuleContext<'_>) -> CoreResult<Book> {
    match ctx.get(NOTEBOOK, notebook_id())? {
        Some(r) => {
            let meta = r
                .fields
                .get("meta")
                .and_then(Value::as_object)
                .cloned()
                .unwrap_or_default();
            let images = r
                .fields
                .get("images")
                .and_then(Value::as_object)
                .map(|m| {
                    m.iter()
                        .filter_map(|(k, v)| Some((k.clone(), v.as_str()?.to_string())))
                        .collect()
                })
                .unwrap_or_default();
            Ok(Book {
                version: r.version,
                meta: if r.deleted { Map::new() } else { meta },
                images,
                exists: !r.deleted,
            })
        }
        None => Ok(Book {
            version: 0,
            meta: Map::new(),
            images: BTreeMap::new(),
            exists: false,
        }),
    }
}

/// The notebook as the window reads it, the large pictures put back.
pub fn load(ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
    let pages = stored_pages(ctx)?;
    let book = stored_book(ctx)?;
    let mut list: Vec<&Stored> = pages.values().collect();
    list.sort_by_key(|s| {
        (
            s.rec.fields.get("idx").and_then(Value::as_u64).unwrap_or(u64::MAX),
            s.updated_ms,
        )
    });
    let mut cache: HashMap<String, String> = HashMap::new();
    let mut notes = Vec::new();
    let mut trash = Vec::new();
    let mut seen = SeenState {
        notebook_version: book.version,
        ..SeenState::default()
    };
    for s in list {
        let mut n = s.note.clone();
        inline_pictures(ctx, &mut n, &book.images, &mut cache)?;
        seen.notes.insert(
            n.get("id").and_then(Value::as_str).unwrap_or_default().to_string(),
            s.updated_ms,
        );
        if s.trashed { trash.push(n) } else { notes.push(n) }
    }
    let mut out = book.meta.clone();
    out.insert("format".into(), json!("suite-notes"));
    out.insert("version".into(), json!(1));
    out.insert("notes".into(), Value::Array(notes));
    if !trash.is_empty() {
        out.insert("trash".into(), Value::Array(trash));
    }
    let content = serde_json::to_string(&Value::Object(out)).map_err(|e| bad(e.to_string()))?;
    Ok(json!({ "content": content, "seen": seen, "empty": pages.is_empty() && !book.exists }))
}

fn inline_pictures(
    ctx: &mut ModuleContext<'_>,
    n: &mut Value,
    images: &BTreeMap<String, String>,
    cache: &mut HashMap<String, String>,
) -> CoreResult<()> {
    let Some(arr) = n.get_mut("images").and_then(Value::as_array_mut) else {
        return Ok(());
    };
    for v in arr.iter_mut() {
        let Some(hash) = v.as_str().and_then(|s| s.strip_prefix(IMG)).map(String::from) else {
            continue;
        };
        if let Some(s) = cache.get(&hash) {
            *v = Value::String(s.clone());
            continue;
        }
        let Some(file) = images.get(&hash).and_then(|f| Uuid::parse_str(f).ok()) else {
            continue;
        };
        let (_, bytes) = ctx.get_file(file)?;
        let s = String::from_utf8(bytes).map_err(|_| bad("o poză a notițelor nu se poate citi"))?;
        cache.insert(hash, s.clone());
        *v = Value::String(s);
    }
    Ok(())
}

/// The large pictures of a note become module files (once each); the note keeps `kgbimg:<hash>`.
fn extract_pictures(
    ctx: &mut ModuleContext<'_>,
    n: &mut Value,
    images: &mut BTreeMap<String, String>,
    used: &mut BTreeSet<String>,
) -> CoreResult<()> {
    let Some(arr) = n.get_mut("images").and_then(Value::as_array_mut) else {
        return Ok(());
    };
    for v in arr.iter_mut() {
        let Some(s) = v.as_str() else { continue };
        if let Some(h) = s.strip_prefix(IMG) {
            used.insert(h.to_string());
            continue;
        }
        if s.len() <= PICTURE_INLINE_MAX || !s.starts_with("data:image/") {
            continue;
        }
        let hash = blake3::hash(s.as_bytes()).to_hex().to_string();
        if !images.contains_key(&hash) {
            let f = ctx.put_file(&format!("{hash}.img"), s.as_bytes())?;
            images.insert(hash.clone(), f.id.to_string());
        }
        used.insert(hash.clone());
        *v = Value::String(format!("{IMG}{hash}"));
    }
    Ok(())
}

fn page_fields(note: Value, updated_ms: u64, trashed: bool, idx: u64) -> Fields {
    let mut f = Fields::new();
    f.insert("note".into(), note);
    f.insert("updated_ms".into(), json!(updated_ms));
    f.insert("trashed".into(), json!(trashed));
    f.insert("idx".into(), json!(idx));
    f
}

/// The lists of the notebook (sections, notebooks) merged: the window's order, then what only the store has.
fn merge_meta(stored: &Map<String, Value>, incoming: Map<String, Value>) -> Map<String, Value> {
    let mut out = incoming;
    for (k, sv) in stored {
        match (out.get_mut(k), sv) {
            (None, _) => {
                out.insert(k.clone(), sv.clone());
            }
            (Some(Value::Array(a)), Value::Array(b)) => {
                for x in b {
                    if !a.contains(x) {
                        a.push(x.clone());
                    }
                }
            }
            (Some(Value::Object(a)), Value::Object(b)) => {
                for (bk, bv) in b {
                    a.entry(bk.clone()).or_insert_with(|| bv.clone());
                }
            }
            _ => {}
        }
    }
    out
}

#[derive(Serialize, Default, Debug)]
pub struct SaveReport {
    pub written: usize,
    pub deleted: usize,
    pub kept_from_elsewhere: usize,
    pub conflicts: usize,
    pub pictures_removed: usize,
    /// Pictures kept as files after the save.
    pub pictures: usize,
    /// What the window holds now, for its next save: the notes it wrote or had unchanged at their stored
    /// `updated_ms`; a note kept from another PC keeps the old value (so the next save still sees that
    /// conflict); the notebook record's version, or the old one when it was merged (the window does not
    /// have the merged lists until it loads again).
    pub seen: SeenState,
}

/// The notebook from the window, written note by note (see the module's comment for the two-PC rules).
pub fn save(ctx: &mut ModuleContext<'_>, content: &str, seen: &SeenState) -> CoreResult<SaveReport> {
    if content.len() > NOTEBOOK_MAX {
        return Err(bad(format!("caietul are peste {} MB", NOTEBOOK_MAX / 1024 / 1024)));
    }
    let v: Value = serde_json::from_str(content).map_err(|_| bad("caietul nu este JSON valid"))?;
    let Value::Object(mut root) = v else {
        return Err(bad("caietul nu are forma așteptată"));
    };
    if root.get("format") != Some(&json!("suite-notes")) || root.get("version") != Some(&json!(1)) {
        return Err(bad("caietul nu are formatul „suite-notes”, versiunea 1"));
    }
    let notes = match root.remove("notes") {
        Some(Value::Array(a)) => a,
        _ => return Err(bad("caietul nu are lista de notițe")),
    };
    let trash = match root.remove("trash") {
        Some(Value::Array(a)) => a,
        _ => Vec::new(),
    };
    root.remove("format");
    root.remove("version");

    let mut stored = stored_pages(ctx)?;
    let mut book = stored_book(ctx)?;
    let images_before = book.images.clone();
    let mut report = SaveReport::default();
    let mut used: BTreeSet<String> = BTreeSet::new();
    let mut writes = Vec::new();
    let mut incoming_ids = BTreeSet::new();

    for (idx, (mut n, trashed)) in notes
        .into_iter()
        .map(|n| (n, false))
        .chain(trash.into_iter().map(|n| (n, true)))
        .enumerate()
    {
        let Some(id) = n
            .get("id")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty() && s.len() < 200)
            .map(String::from)
        else {
            return Err(bad("o notiță nu are id"));
        };
        if !incoming_ids.insert(id.clone()) {
            continue;
        }
        let updated_ms = iso_ms(n.get("updated").and_then(Value::as_str).unwrap_or(""));
        extract_pictures(ctx, &mut n, &mut book.images, &mut used)?;
        let size = serde_json::to_vec(&n).map(|b| b.len()).unwrap_or(usize::MAX);
        if size > NOTE_MAX {
            let title = n
                .get("title")
                .and_then(Value::as_str)
                .unwrap_or("")
                .chars()
                .take(60)
                .collect::<String>();
            return Err(bad(format!(
                "notița „{title}” are peste {} MB fără poze",
                NOTE_MAX / 1024 / 1024
            )));
        }
        let pid = page_id(&id);
        match stored.remove(&id) {
            Some(s) if s.note == n && s.trashed == trashed => {
                // Unchanged; only its place in the list may have moved.
                report.seen.notes.insert(id.clone(), s.updated_ms);
                if s.rec.fields.get("idx").and_then(Value::as_u64) != Some(idx as u64) {
                    let updated_ms = s.updated_ms;
                    writes.push(
                        Write::put(PAGES, pid, page_fields(n, updated_ms, trashed, idx as u64)).expect(s.rec.version),
                    );
                }
            }
            Some(s) => {
                let changed_here = seen.notes.get(&id) != Some(&s.updated_ms);
                if changed_here && s.updated_ms > updated_ms {
                    // Changed on another PC after the load, and more recently: that version stays.
                    report.conflicts += 1;
                    ctx.log(&format!("notița {id}: păstrată varianta mai nouă, de pe alt PC"));
                    collect_used(&s.note, &mut used);
                    if let Some(&ms) = seen.notes.get(&id) {
                        report.seen.notes.insert(id.clone(), ms);
                    }
                    continue;
                }
                if changed_here {
                    report.conflicts += 1;
                    ctx.log(&format!(
                        "notița {id}: schimbată în ambele locuri, păstrată varianta din fereastră (mai nouă)"
                    ));
                }
                writes.push(
                    Write::put(PAGES, pid, page_fields(n, updated_ms, trashed, idx as u64)).expect(s.rec.version),
                );
                report.seen.notes.insert(id.clone(), updated_ms);
                report.written += 1;
            }
            None => {
                match ctx.get(PAGES, pid)? {
                    Some(r) if r.deleted => {
                        writes.push(Write::restore(PAGES, pid).expect(r.version));
                        writes.push(
                            Write::put(PAGES, pid, page_fields(n, updated_ms, trashed, idx as u64))
                                .expect(r.version + 1),
                        );
                    }
                    _ => writes.push(Write::put(PAGES, pid, page_fields(n, updated_ms, trashed, idx as u64)).expect(0)),
                }
                report.seen.notes.insert(id.clone(), updated_ms);
                report.written += 1;
            }
        }
    }
    // Notes the window no longer has: deleted only if it had seen them unchanged.
    for (id, s) in stored {
        match seen.notes.get(&id) {
            Some(&ms) if ms == s.updated_ms => {
                writes.push(Write::delete(PAGES, s.rec.id).expect(s.rec.version));
                report.deleted += 1;
            }
            old => {
                report.kept_from_elsewhere += 1;
                collect_used(&s.note, &mut used);
                if let Some(&ms) = old {
                    report.seen.notes.insert(id.clone(), ms);
                }
            }
        }
    }
    // The rest of the notebook: merged when it changed since the load.
    let merged = book.exists && book.version != seen.notebook_version;
    let meta = if merged {
        merge_meta(&book.meta, root)
    } else {
        root
    };
    // Pictures no note uses any more (in the list or in the trash) are removed.
    let unused: Vec<(String, String)> = book
        .images
        .iter()
        .filter(|(h, _)| !used.contains(*h))
        .map(|(h, f)| (h.clone(), f.clone()))
        .collect();
    for (h, _) in &unused {
        book.images.remove(h);
    }
    if meta != book.meta || book.images != images_before || !book.exists {
        let mut f = Fields::new();
        f.insert("meta".into(), Value::Object(meta));
        f.insert("images".into(), json!(book.images));
        if book.exists {
            writes.push(Write::put(NOTEBOOK, notebook_id(), f).expect(book.version));
        } else if book.version > 0 {
            writes.push(Write::restore(NOTEBOOK, notebook_id()).expect(book.version));
            writes.push(Write::put(NOTEBOOK, notebook_id(), f).expect(book.version + 1));
        } else {
            writes.push(Write::put(NOTEBOOK, notebook_id(), f).expect(0));
        }
    }
    report.pictures = book.images.len();
    if !writes.is_empty() {
        ctx.write(writes)?;
    }
    report.seen.notebook_version = if merged {
        seen.notebook_version
    } else {
        stored_book(ctx)?.version
    };
    for (_, f) in unused {
        if let Ok(id) = Uuid::parse_str(&f) {
            let _ = ctx.delete_file(id);
            report.pictures_removed += 1;
        }
    }
    Ok(report)
}

fn collect_used(note: &Value, used: &mut BTreeSet<String>) {
    if let Some(arr) = note.get("images").and_then(Value::as_array) {
        for v in arr {
            if let Some(h) = v.as_str().and_then(|s| s.strip_prefix(IMG)) {
                used.insert(h.to_string());
            }
        }
    }
}

/// An attachment of a note (PDF, recording), as a module file.
pub fn attachment_add(ctx: &mut ModuleContext<'_>, data: &str, ext: &str) -> CoreResult<String> {
    let ext = match ext {
        "pdf" | "webm" | "bin" => ext,
        _ => return Err(bad("felul atașamentului nu este acceptat (pdf, webm, bin)")),
    };
    let bytes = B64
        .decode(data.as_bytes())
        .map_err(|_| bad("atașamentul nu a ajuns întreg"))?;
    let f = ctx.put_file(&format!("atasament.{ext}"), &bytes)?;
    Ok(f.id.to_string())
}

pub fn attachment_read(ctx: &mut ModuleContext<'_>, id: &str) -> CoreResult<String> {
    let id = Uuid::parse_str(id).map_err(|_| bad("atașamentul nu există"))?;
    let (_, bytes) = ctx.get_file(id)?;
    Ok(B64.encode(bytes))
}
