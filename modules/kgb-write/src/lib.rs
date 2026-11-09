//! `kgb.write` — text documents (D-080): the documents written in the document window copied from
//! Cyber Office Studio (D-073), kept as versioned documents of the core (permission `files.own`, D-034).
//! The window edits a whole document and hands it back; nothing is saved before it passes
//! [`check_doc`]. Every save is a new version; the old ones stay. The model library stays in `kgb.docs`.
//!
//! Formats: `.sdoc`, the window's own (JSON, `"format": "suite-doc"`), which keeps everything the window
//! does, and `.docx`, opened and saved back as it is (a valid archive with `word/document.xml`).
//!
//! Commands (JSON in, JSON out; file contents are base64):
//! - `list` → the documents (.sdoc, .docx)
//! - `import {name, data}` → a document from the computer (from the file dialog)
//! - `info {id, version?}` → name, format, versions
//! - `read {id, version?}` → `{version, name, data}`
//! - `save_doc {id, based_on, data, summary}` → a new version
//! - `save_new_doc {name, data, summary}` → a new document
//! - `peek {name, data}` → the same file back, read once by the window and not kept (pictures, a
//!   document to compare with, tables to bring in)
//! - `export_file {dest, data}` → the window's export (.docx, .pdf, .odt…) at a path the user chose
//! - `restore {id, version}`, `export {id, version?, dest, overwrite}`, `delete {id}`

use std::io::{Cursor, Read as _};
use std::path::PathBuf;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::{CoreError, CoreResult};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.write";

/// The largest document the window may hand back.
const MAX_DOC_BYTES: usize = 100 * 1024 * 1024;
/// A .docx unpacked may not grow past this, nor any part by more than `MAX_RATIO` (zip bombs).
const MAX_UNPACKED: u64 = 512 * 1024 * 1024;
const MAX_RATIO: u64 = 200;

pub struct Write {
    manifest: Manifest,
}

impl Write {
    pub fn new() -> Write {
        Write {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Write {
    fn default() -> Self {
        Write::new()
    }
}

fn args<T: DeserializeOwned>(v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid("comanda", e.to_string()))
}

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("documentul", detail)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Import {
    name: String,
    data: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Which {
    id: Uuid,
    #[serde(default)]
    version: Option<u64>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SaveDoc {
    id: Uuid,
    based_on: u64,
    data: String,
    summary: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SaveNewDoc {
    name: String,
    data: String,
    summary: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ExportFile {
    dest: PathBuf,
    data: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Restore {
    id: Uuid,
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Export {
    id: Uuid,
    #[serde(default)]
    version: Option<u64>,
    dest: PathBuf,
    #[serde(default)]
    overwrite: bool,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Format {
    Sdoc,
    Docx,
}

impl Format {
    pub fn from_name(name: &str) -> Option<Format> {
        let ext = name.rsplit_once('.')?.1.to_ascii_lowercase();
        match ext.as_str() {
            "sdoc" => Some(Format::Sdoc),
            "docx" => Some(Format::Docx),
            _ => None,
        }
    }
    fn as_str(self) -> &'static str {
        match self {
            Format::Sdoc => "sdoc",
            Format::Docx => "docx",
        }
    }
}

fn format_of(name: &str) -> CoreResult<Format> {
    Format::from_name(name).ok_or_else(|| bad("se păstrează doar documente .sdoc sau .docx"))
}

/// A document from the window or the computer, before it is kept: an .sdoc must be the window's JSON
/// with a document body; a .docx must be a sound archive (no zip bomb, every part passes its CRC) with
/// `word/document.xml`. Returns the format.
pub fn check_doc(name: &str, data: &[u8]) -> Result<Format, String> {
    if data.len() > MAX_DOC_BYTES {
        return Err(format!("documentul are peste {} MB", MAX_DOC_BYTES / 1024 / 1024));
    }
    let format = Format::from_name(name).ok_or("se păstrează doar documente .sdoc sau .docx")?;
    match format {
        Format::Sdoc => {
            let v: Value =
                serde_json::from_slice(data).map_err(|_| "documentul .sdoc nu este JSON valid".to_string())?;
            if v["format"] != "suite-doc" || v["version"] != 1 {
                return Err("documentul .sdoc nu are formatul „suite-doc”, versiunea 1".into());
            }
            if v["content"]["type"] != "doc" {
                return Err("documentul .sdoc nu are conținut".into());
            }
        }
        Format::Docx => {
            if data.starts_with(&[0xD0, 0xCF, 0x11, 0xE0]) {
                return Err("fișierul este protejat cu parolă (criptat)".into());
            }
            let mut z = zip::ZipArchive::new(Cursor::new(data))
                .map_err(|_| "fișierul este deteriorat (arhiva nu se poate citi)".to_string())?;
            let mut total = 0u64;
            for i in 0..z.len() {
                let e = z.by_index_raw(i).map_err(|_| "fișierul este deteriorat".to_string())?;
                total = total.saturating_add(e.size());
                if e.size() > 16 * 1024 * 1024 && e.size() / e.compressed_size().max(1) > MAX_RATIO {
                    return Err("fișierul se dezarhivează în mult prea mult (posibilă „bombă zip”)".into());
                }
            }
            if total > MAX_UNPACKED {
                return Err(format!("fișierul are {} MB după dezarhivare", total >> 20));
            }
            for i in 0..z.len() {
                let mut e = z.by_index(i).map_err(|_| "fișierul este deteriorat".to_string())?;
                std::io::copy(&mut e, &mut std::io::sink())
                    .map_err(|_| "fișierul este deteriorat (o parte nu trece verificarea CRC)".to_string())?;
            }
            let mut body = String::new();
            z.by_name("word/document.xml")
                .map_err(|_| "fișierul nu este un document .docx (lipsește word/document.xml)".to_string())?
                .read_to_string(&mut body)
                .map_err(|_| "word/document.xml nu se poate citi".to_string())?;
            if !body.contains("<w:body") {
                return Err("word/document.xml nu are corpul documentului".into());
            }
        }
    }
    Ok(format)
}

fn summary_of(s: &str) -> CoreResult<String> {
    let s = s.trim().chars().take(200).collect::<String>();
    if s.is_empty() {
        return Err(bad("lipsește descrierea schimbării"));
    }
    Ok(s)
}

fn valid_name(name: &str) -> CoreResult<&str> {
    let name = name.trim();
    if name.is_empty() || name.contains(['/', '\\']) {
        return Err(bad("numele documentului nu este valid"));
    }
    Ok(name)
}

impl Module for Write {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "list" => {
                let docs: Vec<_> = ctx
                    .list_documents()?
                    .into_iter()
                    .filter(|d| Format::from_name(&d.name).is_some())
                    .collect();
                Ok(serde_json::to_value(docs).expect("serialisable"))
            }
            "import" => {
                let a: Import = args(a)?;
                let name = valid_name(&a.name)?;
                let data = B64
                    .decode(a.data.as_bytes())
                    .map_err(|_| bad("conținutul nu este valid (base64)"))?;
                let format = check_doc(name, &data).map_err(bad)?;
                let d = ctx.import_document(name, &data)?;
                ctx.log(&format!("document importat (.{})", format.as_str()));
                Ok(json!({"document": d, "format": format.as_str()}))
            }
            "info" => {
                let a: Which = args(a)?;
                let doc = ctx
                    .list_documents()?
                    .into_iter()
                    .find(|d| d.id == a.id)
                    .ok_or_else(|| bad("documentul nu există"))?;
                let format = format_of(&doc.name)?;
                Ok(json!({
                    "name": doc.name,
                    "format": format.as_str(),
                    "version": a.version.unwrap_or(doc.current),
                    "versions": ctx.document_versions(a.id)?,
                }))
            }
            "read" => {
                let a: Which = args(a)?;
                let doc = ctx
                    .list_documents()?
                    .into_iter()
                    .find(|d| d.id == a.id)
                    .ok_or_else(|| bad("documentul nu există"))?;
                let (v, data) = ctx.read_document(a.id, a.version)?;
                Ok(json!({"version": v.number, "name": doc.name, "data": B64.encode(&data)}))
            }
            "save_doc" => {
                let a: SaveDoc = args(a)?;
                let doc = ctx
                    .list_documents()?
                    .into_iter()
                    .find(|d| d.id == a.id)
                    .ok_or_else(|| bad("documentul nu există"))?;
                if doc.current != a.based_on {
                    return Err(bad(format!(
                        "a fost salvat între timp (versiunea {}); redeschide-l",
                        doc.current
                    )));
                }
                let summary = summary_of(&a.summary)?;
                let data = B64
                    .decode(a.data.as_bytes())
                    .map_err(|_| bad("documentul nu a ajuns întreg"))?;
                check_doc(&doc.name, &data).map_err(|e| bad(format!("documentul nu trece verificarea: {e}")))?;
                let v = ctx.save_document(a.id, a.based_on, &data, &summary)?;
                Ok(json!({"version": v.number, "summary": summary}))
            }
            "save_new_doc" => {
                let a: SaveNewDoc = args(a)?;
                let name = valid_name(&a.name)?;
                let summary = summary_of(&a.summary)?;
                let data = B64
                    .decode(a.data.as_bytes())
                    .map_err(|_| bad("documentul nu a ajuns întreg"))?;
                let format =
                    check_doc(name, &data).map_err(|e| bad(format!("documentul nu trece verificarea: {e}")))?;
                let d = ctx.import_document(name, &data)?;
                ctx.log(&format!("document nou din fereastră (.{}): {summary}", format.as_str()));
                Ok(json!({"document": d, "summary": summary}))
            }
            "peek" => {
                // Nothing is stored: the window reads the file and decides what to do with it.
                let a: Import = args(a)?;
                Ok(json!({"name": a.name, "data": a.data}))
            }
            "export_file" => {
                let a: ExportFile = args(a)?;
                let data = B64
                    .decode(a.data.as_bytes())
                    .map_err(|_| bad("fișierul nu a ajuns întreg"))?;
                if data.len() > MAX_DOC_BYTES {
                    return Err(bad("fișierul este prea mare"));
                }
                // The save dialog has already asked before replacing a file.
                ctx.export_bytes(&a.dest, &data, true)?;
                Ok(json!({"path": a.dest, "bytes": data.len()}))
            }
            "restore" => {
                let a: Restore = args(a)?;
                Ok(serde_json::to_value(ctx.restore_document_version(a.id, a.version)?).expect("serialisable"))
            }
            "export" => {
                let a: Export = args(a)?;
                Ok(
                    serde_json::to_value(ctx.export_document(a.id, a.version, &a.dest, a.overwrite)?)
                        .expect("serialisable"),
                )
            }
            "delete" => {
                let a: Which = args(a)?;
                ctx.delete_document(a.id)?;
                Ok(json!({"deleted": a.id}))
            }
            other => Err(CoreError::invalid(
                "comanda",
                format!("„{other}” nu există în modulul Documente text"),
            )),
        }
    }
}
