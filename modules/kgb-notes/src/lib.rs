//! `kgb.notes` — demonstration module of Etapa 1 (step 1.9).
//!
//! It exists to prove the module contract end to end: it reaches the
//! workspace only through `ModuleContext`, declares its one collection, and
//! keeps its data when disabled. Its interface lives in
//! `app/src/modules/notes/`; this crate holds the domain logic only.
//!
//! Commands (JSON in, JSON out):
//! - `list` → `[{id, version, text, created_ms, updated_ms}]`, newest first
//! - `add {text}` → the new note
//! - `update {id, version, text}` → the updated note (optimistic concurrency)
//! - `delete {id, version}` → `{deleted: id}` (logical delete; the store keeps it)

pub mod notebook;
pub mod remind;

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, Query, RecordState, Sort, Write};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

pub const ID: &str = "kgb.notes";
const NOTES: &str = "notes";
pub const TEXT_MAX_CHARS: usize = 2000;

pub struct Notes {
    manifest: Manifest,
}

impl Notes {
    pub fn new() -> Notes {
        Notes {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Notes {
    fn default() -> Self {
        Notes::new()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Note {
    pub id: Uuid,
    pub version: u64,
    pub text: String,
    pub created_ms: u64,
    pub updated_ms: u64,
}

impl Note {
    fn from_record(r: &RecordState) -> Note {
        let u = |k: &str| r.fields.get(k).and_then(Value::as_u64).unwrap_or_default();
        Note {
            id: r.id,
            version: r.version,
            text: r
                .fields
                .get("text")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
            created_ms: u("created_ms"),
            updated_ms: u("updated_ms"),
        }
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct AddArgs {
    text: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct UpdateArgs {
    id: Uuid,
    version: u64,
    text: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DeleteArgs {
    id: Uuid,
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct NotebookSave {
    content: String,
    #[serde(default)]
    seen: notebook::SeenState,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct AttachmentAdd {
    data: String,
    ext: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct AttachmentRead {
    id: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ExportFile {
    dest: std::path::PathBuf,
    data: String,
}

fn args<T: for<'de> Deserialize<'de>>(command: &str, v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid(format!("argumentele comenzii {command}"), e.to_string()))
}

fn clean_text(text: &str) -> CoreResult<String> {
    let t = text.trim();
    if t.is_empty() {
        return Err(CoreError::invalid("nota", "textul nu poate fi gol"));
    }
    if t.chars().count() > TEXT_MAX_CHARS {
        return Err(CoreError::invalid(
            "nota",
            format!("textul are mai mult de {TEXT_MAX_CHARS} de caractere"),
        ));
    }
    Ok(t.to_string())
}

fn fields(text: String, created_ms: u64, updated_ms: u64) -> Fields {
    let mut f = Fields::new();
    f.insert("text".into(), Value::String(text));
    f.insert("created_ms".into(), Value::from(created_ms));
    f.insert("updated_ms".into(), Value::from(updated_ms));
    f
}

fn to_json<T: Serialize>(v: &T) -> CoreResult<Value> {
    serde_json::to_value(v).map_err(|e| CoreError::invalid("răspunsul modulului", e.to_string()))
}

fn existing(ctx: &mut ModuleContext<'_>, id: Uuid) -> CoreResult<RecordState> {
    match ctx.get(NOTES, id)? {
        Some(r) if !r.deleted => Ok(r),
        _ => Err(CoreError::invalid("nota", "nu mai există (poate a fost ștearsă)")),
    }
}

impl Module for Notes {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    /// The reminders of the Notes window (7.4l-2b-rem), on this PC's clock.
    fn remind(&self, ctx: &mut ModuleContext<'_>, _today: &str) -> CoreResult<()> {
        remind::send_due(ctx, now_ms() as i64, &remind::System).map(|_| ())
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "list" => {
                let q = Query {
                    sort: Some(Sort {
                        field: "created_ms".into(),
                        desc: true,
                    }),
                    ..Query::default()
                };
                let notes: Vec<Note> = ctx.query(NOTES, &q)?.records.iter().map(Note::from_record).collect();
                to_json(&notes)
            }
            "add" => {
                let AddArgs { text } = args(command, a)?;
                let text = clean_text(&text)?;
                let id = Uuid::now_v7();
                let now = now_ms();
                ctx.write(vec![Write::put(NOTES, id, fields(text, now, now)).expect(0)])?;
                ctx.log("note added");
                to_json(&Note::from_record(&existing(ctx, id)?))
            }
            "update" => {
                let UpdateArgs { id, version, text } = args(command, a)?;
                let text = clean_text(&text)?;
                let cur = Note::from_record(&existing(ctx, id)?);
                ctx.write(vec![
                    Write::put(NOTES, id, fields(text, cur.created_ms, now_ms())).expect(version),
                ])?;
                to_json(&Note::from_record(&existing(ctx, id)?))
            }
            "delete" => {
                let DeleteArgs { id, version } = args(command, a)?;
                existing(ctx, id)?;
                ctx.write(vec![Write::delete(NOTES, id).expect(version)])?;
                ctx.log("note deleted");
                Ok(serde_json::json!({ "deleted": id }))
            }
            // The notebook of the Notes window copied from COS (7.4l-2b), see notebook.rs.
            "notebook_load" => notebook::load(ctx),
            "notebook_save" => {
                let a: NotebookSave = args(command, a)?;
                let report = notebook::save(ctx, &a.content, &a.seen)?;
                to_json(&report)
            }
            "attachment_add" => {
                let a: AttachmentAdd = args(command, a)?;
                Ok(serde_json::json!({ "id": notebook::attachment_add(ctx, &a.data, &a.ext)? }))
            }
            "attachment_read" => {
                let a: AttachmentRead = args(command, a)?;
                Ok(serde_json::json!({ "data": notebook::attachment_read(ctx, &a.id)? }))
            }
            // The window's „Export .md / .html” and „Salvează o copie” of an attachment (the save dialog chose `dest`).
            "export_file" => {
                let a: ExportFile = args(command, a)?;
                let n = notebook::export_file(ctx, &a.dest, &a.data)?;
                Ok(serde_json::json!({ "path": a.dest, "bytes": n }))
            }
            "attachment_delete" => {
                let a: AttachmentRead = args(command, a)?;
                notebook::attachment_delete(ctx, &a.id)?;
                Ok(serde_json::json!({ "deleted": a.id }))
            }
            _ => Err(CoreError::invalid(
                "modulul Note",
                format!("comandă necunoscută „{command}”"),
            )),
        }
    }
}
