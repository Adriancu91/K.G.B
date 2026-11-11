//! File attachments for modules (Etapa 2, step 2.8; permission `files.own`).
//!
//! File contents go to the store's content-addressed blobs (BLAKE3; verified
//! on every read). Which module owns which file is recorded by the core in
//! `core.files`, so a module can only see and read its own files, even when two
//! modules happen to store identical bytes.
//!
//! Deleting a file only marks its record deleted. The bytes are removed later,
//! by [`collect_unreferenced`], which moves blobs no live record points to into
//! `retired/blobs/` (kept until the next collection) — never immediately.

use std::collections::HashSet;

use kgb_store::{Fields, RecordState, Write};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::workspace::{Workspace, now_ms};

pub const FILES_COLLECTION: &str = "core.files";
/// Largest accepted file. Bigger imports are a later, streaming feature.
pub const MAX_FILE_BYTES: usize = 64 * 1024 * 1024;
const NAME_MAX_CHARS: usize = 200;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct FileRef {
    pub id: Uuid,
    pub name: String,
    pub size: u64,
    pub hash: String,
    pub created_ms: u64,
}

fn from_record(r: &RecordState) -> FileRef {
    let s = |k: &str| r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    let n = |k: &str| r.fields.get(k).and_then(Value::as_u64).unwrap_or_default();
    FileRef {
        id: r.id,
        name: s("name"),
        size: n("size"),
        hash: s("hash"),
        created_ms: n("created_ms"),
    }
}

/// A file name as the user sees it: no folders, no control characters.
pub fn clean_name(name: &str) -> CoreResult<String> {
    let n = name.trim();
    let bad = |d: &str| Err(CoreError::invalid("numele fișierului", d.to_string()));
    if n.is_empty() {
        return bad("nu poate fi gol");
    }
    if n.chars().count() > NAME_MAX_CHARS {
        return bad("este prea lung");
    }
    if n.chars()
        .any(|c| c.is_control() || matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
    {
        return bad("conține caractere nepermise (/ \\ : * ? \" < > |)");
    }
    if n == "." || n == ".." {
        return bad("nu este un nume de fișier");
    }
    Ok(n.to_string())
}

pub fn put(ws: &mut Workspace, module: &str, name: &str, data: &[u8]) -> CoreResult<FileRef> {
    let name = clean_name(name)?;
    if data.len() > MAX_FILE_BYTES {
        return Err(CoreError::invalid(
            "fișierul",
            format!(
                "are {} MB; limita este {} MB",
                data.len() / (1024 * 1024),
                MAX_FILE_BYTES / (1024 * 1024)
            ),
        ));
    }
    let hash = ws.store().put_blob(data)?;
    let id = Uuid::now_v7();
    let mut f = Fields::new();
    f.insert("module".into(), Value::String(module.into()));
    f.insert("name".into(), Value::String(name));
    f.insert("size".into(), Value::from(data.len() as u64));
    f.insert("hash".into(), Value::String(hash));
    f.insert("created_ms".into(), Value::from(now_ms()));
    ws.store_mut()
        .write(vec![Write::put(FILES_COLLECTION, id, f).expect(0)])?;
    Ok(from_record(
        &ws.store().get(FILES_COLLECTION, id)?.expect("just written"),
    ))
}

fn owned(ws: &Workspace, module: &str, id: Uuid) -> CoreResult<RecordState> {
    match ws.store().get(FILES_COLLECTION, id)? {
        Some(r) if r.fields.get("module").and_then(Value::as_str) == Some(module) => Ok(r),
        _ => Err(CoreError::invalid("fișierul", "nu există")),
    }
}

pub(crate) fn get(ws: &Workspace, module: &str, id: Uuid) -> CoreResult<(FileRef, Vec<u8>)> {
    let r = owned(ws, module, id)?;
    let f = from_record(&r);
    // The store re-hashes the bytes: a damaged file is an error, never silent.
    if !ws.store().has_blob(&f.hash) {
        return Err(CoreError::invalid(
            "fișierul",
            "conținutul nu a ajuns încă de pe celălalt calculator; vine la următoarea sincronizare",
        ));
    }
    let data = ws.store().get_blob(&f.hash)?;
    Ok((f, data))
}

pub(crate) fn delete(ws: &mut Workspace, module: &str, id: Uuid) -> CoreResult<()> {
    let r = owned(ws, module, id)?;
    ws.store_mut()
        .write(vec![Write::delete(FILES_COLLECTION, id).expect(r.version)])?;
    Ok(())
}

pub(crate) fn list(ws: &Workspace, module: &str) -> CoreResult<Vec<FileRef>> {
    let mut v: Vec<FileRef> = ws
        .store()
        .scan(FILES_COLLECTION, |r| {
            r.fields.get("module").and_then(Value::as_str) == Some(module)
        })?
        .iter()
        .map(from_record)
        .collect();
    v.sort_by_key(|f| std::cmp::Reverse(f.id));
    Ok(v)
}

#[derive(Debug, Default, Serialize)]
pub struct ForgetReport {
    /// Blobs no record points to any more (a deleted attachment, a picture replaced), now gone.
    pub blobs: usize,
    /// Bytes removed from the disk: the old journal generation and those blobs.
    pub bytes: u64,
}

/// Forgets, on this computer, what the workspace held before its current state (D-090): the journal keeps only
/// the newest state of every record (compaction), the blobs nothing points to are retired, and `retired/` is
/// removed. Asked for by the person, for example right after a note was locked, so that its text and attachments
/// as they were before the lock are no longer on the disk. Other computers keep their own history until they
/// compact, backups keep theirs; peers that were behind the new compaction floor resynchronise in full.
pub fn forget_history(ws: &mut Workspace) -> CoreResult<ForgetReport> {
    ws.store_mut().compact()?;
    let c = collect_unreferenced(ws)?;
    let dropped = ws.store_mut().drop_retired()?;
    Ok(ForgetReport { blobs: c.blobs_retired, bytes: dropped.bytes })
}

#[derive(Debug, Default, Serialize)]
pub struct CollectReport {
    pub blobs_retired: usize,
    pub bytes_retired: u64,
}

/// Moves blobs that no live file record or document version points to into
/// `retired/blobs/`.
/// Run explicitly (maintenance), never as part of a delete.
pub fn collect_unreferenced(ws: &mut Workspace) -> CoreResult<CollectReport> {
    let mut referenced: HashSet<String> = ws
        .store()
        .scan(FILES_COLLECTION, |_| true)?
        .iter()
        .filter_map(|r| r.fields.get("hash").and_then(Value::as_str).map(String::from))
        .collect();
    // Every version of every live document keeps its bytes (D-034).
    referenced.extend(crate::documents::referenced_hashes(ws)?);
    let orphans: Vec<String> = ws
        .store()
        .blob_hashes()?
        .into_iter()
        .filter(|h| !referenced.contains(h))
        .collect();
    let bytes = ws.store().retire_blobs(&orphans)?;
    Ok(CollectReport {
        blobs_retired: orphans.len(),
        bytes_retired: bytes,
    })
}
