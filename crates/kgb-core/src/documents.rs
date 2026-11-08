//! Versioned documents (Etapa 3, step 3.4; decision D-034). Uses the module's
//! `files.own` permission: a document is a file that keeps its history.
//!
//! - **Import** creates the document and version 1, the original. It is never
//!   changed or removed while the document exists.
//! - **Every save creates a new version.** Versions are immutable records;
//!   restoring an old version creates a newer one with the old content.
//! - The document record and its new version are written in one atomic batch,
//!   so a crash leaves either the old state or the new one, never half.
//! - Contents are BLAKE3 blobs, verified on every read. Blobs referenced by
//!   any version are protected from [`crate::files::collect_unreferenced`].
//! - **Export writes a copy** to a path the user chose; the stored document is
//!   untouched, and an existing file is only replaced when asked explicitly.

use std::path::Path;

use kgb_store::fsutil::write_atomic;
use kgb_store::{Fields, RecordState, Write};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::files::{MAX_FILE_BYTES, clean_name};
use crate::workspace::{Workspace, now_ms};

pub const DOCUMENTS_COLLECTION: &str = "core.documents";
pub const VERSIONS_COLLECTION: &str = "core.document_versions";
const NOTE_MAX_CHARS: usize = 200;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct DocumentRef {
    pub id: Uuid,
    pub name: String,
    /// Lower-case file extension, e.g. `pdf`, `xlsx` ("" if none).
    pub kind: String,
    pub current: u64,
    pub created_ms: u64,
    pub updated_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct VersionRef {
    pub document: Uuid,
    pub number: u64,
    pub size: u64,
    pub hash: String,
    pub note: String,
    pub created_ms: u64,
}

fn s(r: &RecordState, k: &str) -> String {
    r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}
fn n(r: &RecordState, k: &str) -> u64 {
    r.fields.get(k).and_then(Value::as_u64).unwrap_or_default()
}

fn doc_ref(r: &RecordState) -> DocumentRef {
    DocumentRef {
        id: r.id,
        name: s(r, "name"),
        kind: s(r, "kind"),
        current: n(r, "current"),
        created_ms: n(r, "created_ms"),
        updated_ms: n(r, "updated_ms"),
    }
}

fn version_ref(r: &RecordState) -> VersionRef {
    VersionRef {
        document: Uuid::parse_str(&s(r, "document")).unwrap_or_default(),
        number: n(r, "number"),
        size: n(r, "size"),
        hash: s(r, "hash"),
        note: s(r, "note"),
        created_ms: n(r, "created_ms"),
    }
}

/// Version records have a deterministic id: (document, number) → one record,
/// so two saves racing for the same number cannot both succeed.
fn version_id(doc: Uuid, number: u64) -> Uuid {
    let h = blake3::hash(format!("{doc}/{number}").as_bytes());
    Uuid::from_bytes(h.as_bytes()[..16].try_into().expect("16 bytes"))
}

fn kind_of(name: &str) -> String {
    match name.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() && ext.len() <= 8 => ext.to_lowercase(),
        _ => String::new(),
    }
}

fn clean_note(note: &str) -> String {
    note.trim()
        .chars()
        .filter(|c| !c.is_control())
        .take(NOTE_MAX_CHARS)
        .collect()
}

fn check_size(data: &[u8]) -> CoreResult<()> {
    if data.len() > MAX_FILE_BYTES {
        return Err(CoreError::invalid(
            "documentul",
            format!(
                "are {} MB; limita este {} MB",
                data.len() / (1024 * 1024),
                MAX_FILE_BYTES / (1024 * 1024)
            ),
        ));
    }
    Ok(())
}

fn version_fields(module: &str, doc: Uuid, number: u64, hash: &str, size: usize, note: &str) -> Fields {
    let mut f = Fields::new();
    f.insert("module".into(), Value::String(module.into()));
    f.insert("document".into(), Value::String(doc.to_string()));
    f.insert("number".into(), Value::from(number));
    f.insert("hash".into(), Value::String(hash.into()));
    f.insert("size".into(), Value::from(size as u64));
    f.insert("note".into(), Value::String(clean_note(note)));
    f.insert("created_ms".into(), Value::from(now_ms()));
    f
}

fn owned(ws: &Workspace, module: &str, id: Uuid) -> CoreResult<RecordState> {
    match ws.store().get(DOCUMENTS_COLLECTION, id)? {
        Some(r) if r.fields.get("module").and_then(Value::as_str) == Some(module) => Ok(r),
        _ => Err(CoreError::invalid("documentul", "nu există")),
    }
}

/// Imports a document: the bytes become version 1, the protected original.
pub(crate) fn import(ws: &mut Workspace, module: &str, name: &str, data: &[u8]) -> CoreResult<DocumentRef> {
    let name = clean_name(name)?;
    check_size(data)?;
    // The blob goes first: if we crash before the records, it is just an
    // unreferenced blob that maintenance collects later.
    let hash = ws.store().put_blob(data)?;
    let id = Uuid::now_v7();
    let now = now_ms();
    let mut d = Fields::new();
    d.insert("module".into(), Value::String(module.into()));
    d.insert("name".into(), Value::String(name.clone()));
    d.insert("kind".into(), Value::String(kind_of(&name)));
    d.insert("current".into(), Value::from(1u64));
    d.insert("created_ms".into(), Value::from(now));
    d.insert("updated_ms".into(), Value::from(now));
    ws.store_mut().write(vec![
        Write::put(DOCUMENTS_COLLECTION, id, d).expect(0),
        Write::put(
            VERSIONS_COLLECTION,
            version_id(id, 1),
            version_fields(module, id, 1, &hash, data.len(), "original importat"),
        )
        .expect(0),
    ])?;
    Ok(doc_ref(
        &ws.store().get(DOCUMENTS_COLLECTION, id)?.expect("just written"),
    ))
}

/// Saves new content as the next version. `based_on` is the version the
/// caller edited; if someone saved in the meantime the save is refused
/// (nothing is overwritten) and the caller can reload.
pub(crate) fn save_version(
    ws: &mut Workspace,
    module: &str,
    id: Uuid,
    based_on: u64,
    data: &[u8],
    note: &str,
) -> CoreResult<VersionRef> {
    check_size(data)?;
    let r = owned(ws, module, id)?;
    let current = n(&r, "current");
    if based_on != current {
        return Err(CoreError::invalid(
            "documentul",
            format!("a fost salvat între timp (versiunea {current}, nu {based_on}); redeschide-l"),
        ));
    }
    let hash = ws.store().put_blob(data)?;
    let next = current + 1;
    let mut d = r.fields.clone();
    d.insert("current".into(), Value::from(next));
    d.insert("updated_ms".into(), Value::from(now_ms()));
    let vid = version_id(id, next);
    ws.store_mut().write(vec![
        Write::put(DOCUMENTS_COLLECTION, id, d).expect(r.version),
        Write::put(
            VERSIONS_COLLECTION,
            vid,
            version_fields(module, id, next, &hash, data.len(), note),
        )
        .expect(0),
    ])?;
    Ok(version_ref(
        &ws.store().get(VERSIONS_COLLECTION, vid)?.expect("just written"),
    ))
}

/// Creates a new version with the content of an older one.
pub(crate) fn restore_version(ws: &mut Workspace, module: &str, id: Uuid, number: u64) -> CoreResult<VersionRef> {
    let r = owned(ws, module, id)?;
    let (_, data) = read(ws, module, id, Some(number))?;
    save_version(
        ws,
        module,
        id,
        n(&r, "current"),
        &data,
        &format!("restaurat din versiunea {number}"),
    )
}

/// Reads a version (the current one if `number` is `None`). The bytes are
/// re-hashed by the store: damaged content is an error, never silent.
pub(crate) fn read(ws: &Workspace, module: &str, id: Uuid, number: Option<u64>) -> CoreResult<(VersionRef, Vec<u8>)> {
    let r = owned(ws, module, id)?;
    let number = number.unwrap_or_else(|| n(&r, "current"));
    let v = ws
        .store()
        .get(VERSIONS_COLLECTION, version_id(id, number))?
        .ok_or_else(|| CoreError::invalid("versiunea", format!("{number} nu există")))?;
    let v = version_ref(&v);
    if !ws.store().has_blob(&v.hash) {
        return Err(CoreError::invalid(
            "fișierul",
            "conținutul nu a ajuns încă de pe celălalt calculator; vine la următoarea sincronizare",
        ));
    }
    let data = ws.store().get_blob(&v.hash)?;
    Ok((v, data))
}

pub(crate) fn versions(ws: &Workspace, module: &str, id: Uuid) -> CoreResult<Vec<VersionRef>> {
    let r = owned(ws, module, id)?;
    let mut out = Vec::new();
    for k in 1..=n(&r, "current") {
        if let Some(v) = ws.store().get(VERSIONS_COLLECTION, version_id(id, k))? {
            out.push(version_ref(&v));
        }
    }
    Ok(out)
}

pub(crate) fn list(ws: &Workspace, module: &str) -> CoreResult<Vec<DocumentRef>> {
    let mut v: Vec<DocumentRef> = ws
        .store()
        .scan(DOCUMENTS_COLLECTION, |r| {
            r.fields.get("module").and_then(Value::as_str) == Some(module)
        })?
        .iter()
        .map(doc_ref)
        .collect();
    v.sort_by_key(|d| std::cmp::Reverse(d.updated_ms));
    Ok(v)
}

/// Marks the document and all its versions deleted (one atomic batch). The
/// bytes stay until maintenance collects unreferenced blobs.
pub(crate) fn delete(ws: &mut Workspace, module: &str, id: Uuid) -> CoreResult<()> {
    let r = owned(ws, module, id)?;
    let mut batch = vec![Write::delete(DOCUMENTS_COLLECTION, id).expect(r.version)];
    for k in 1..=n(&r, "current") {
        let vid = version_id(id, k);
        if let Some(v) = ws.store().get(VERSIONS_COLLECTION, vid)? {
            batch.push(Write::delete(VERSIONS_COLLECTION, vid).expect(v.version));
        }
    }
    ws.store_mut().write(batch)?;
    Ok(())
}

/// Writes a copy of a version to `dest`. Refuses to replace an existing file
/// unless `overwrite` (the user confirmed it); the write itself is atomic.
pub(crate) fn export(
    ws: &Workspace,
    module: &str,
    id: Uuid,
    number: Option<u64>,
    dest: &Path,
    overwrite: bool,
) -> CoreResult<VersionRef> {
    let (v, data) = read(ws, module, id, number)?;
    if dest.exists() && !overwrite {
        return Err(CoreError::AlreadyExists(dest.to_path_buf()));
    }
    write_atomic(dest, &data)?;
    Ok(v)
}

/// Writes bytes a module produced (a conversion, a CSV export) to a path the
/// user chose in the save dialog. Same rules as [`export`]: no silent replace,
/// atomic write, nothing stored in the workspace.
pub(crate) fn export_bytes(dest: &Path, data: &[u8], overwrite: bool) -> CoreResult<()> {
    check_size(data)?;
    if dest.exists() && !overwrite {
        return Err(CoreError::AlreadyExists(dest.to_path_buf()));
    }
    write_atomic(dest, data)?;
    Ok(())
}

/// Hashes referenced by any live version (protected from blob collection).
pub(crate) fn referenced_hashes(ws: &Workspace) -> CoreResult<Vec<String>> {
    Ok(ws
        .store()
        .scan(VERSIONS_COLLECTION, |_| true)?
        .iter()
        .map(|r| s(r, "hash"))
        .collect())
}
