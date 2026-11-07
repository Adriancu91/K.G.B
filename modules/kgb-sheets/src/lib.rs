//! `kgb.sheets` — spreadsheets (Etapa 3, step 3.6; Master Plan §6.2).
//!
//! Built only on the module contract: workbooks are the core's versioned
//! documents (permission `files.own`, D-034) — the imported original never
//! changes, every save is a new version. Libraries chosen in spike S5 (D-033):
//! calamine reads (XLSX, XLSM, XLS, XLSB, ODS), umya edits and saves XLSX,
//! IronCalc recalculates; CSV is read with the `csv` crate. The interface
//! lives in `app/src/modules/sheets/`.
//!
//! Rules:
//! - Every file passes the module's own archive check before any library
//!   ([`book::guard`]): zip bombs and password-protected files are refused.
//! - Only XLSX is edited; the other formats are shown read-only.
//! - A save first returns a preview: what changes, which formulas were
//!   recalculated, which could not be recalculated reliably, and which parts
//!   of the file would be lost (charts, images, …). Losses must be accepted
//!   explicitly; the result is verified before it is saved ([`save::apply`]).
//!
//! Commands (JSON in, JSON out; file contents are base64):
//! - `list` → workbooks
//! - `import {name, data}` → `{document, format, editable, sheets}`
//! - `info {id, version?}` → name, format, versions, sheets with their size
//! - `cells {id, version?, sheet, row0, rows, col0?, cols?}` → a window of cells
//! - `save {id, based_on, edits, apply, accept_losses?}` → preview or new version
//! - `restore {id, version}`, `export {id, version?, dest, overwrite}`, `delete {id}`

pub mod book;
pub mod save;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::{CoreError, CoreResult};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

use book::{Book, Format};

pub const ID: &str = "kgb.sheets";
const MAX_WINDOW_ROWS: u32 = 500;
const MAX_WINDOW_COLS: u32 = 100;
const MAX_EDITS: usize = 10_000;

pub struct Sheets {
    manifest: Manifest,
    /// The last workbook read, so scrolling does not re-read the file.
    cache: Mutex<Option<(Uuid, u64, Arc<Book>)>>,
}

impl Sheets {
    pub fn new() -> Sheets {
        Sheets {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
            cache: Mutex::new(None),
        }
    }
}

impl Default for Sheets {
    fn default() -> Self {
        Sheets::new()
    }
}

fn args<T: DeserializeOwned>(v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid("comanda", e.to_string()))
}

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("foaia de calcul", detail)
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
struct Cells {
    id: Uuid,
    #[serde(default)]
    version: Option<u64>,
    sheet: String,
    row0: u32,
    rows: u32,
    #[serde(default)]
    col0: u32,
    #[serde(default)]
    cols: Option<u32>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Save {
    id: Uuid,
    based_on: u64,
    edits: Vec<save::Edit>,
    #[serde(default)]
    apply: bool,
    #[serde(default)]
    accept_losses: bool,
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

fn sheets_json(b: &Book) -> Value {
    json!(
        b.sheets
            .iter()
            .map(|s| {
                let (rows, cols) = s.size();
                json!({"name": s.name, "rows": rows, "cols": cols})
            })
            .collect::<Vec<_>>()
    )
}

fn format_of(name: &str) -> CoreResult<Format> {
    Format::from_name(name).ok_or_else(|| bad("formatul nu este acceptat (.xlsx, .xlsm, .xls, .xlsb, .ods, .csv)"))
}

fn plural(n: usize, one: &str, many: &str) -> String {
    if n == 1 {
        format!("1 {one}")
    } else {
        format!("{n} {many}")
    }
}

impl Sheets {
    /// The workbook of a version, read once and kept for scrolling.
    fn book(
        &self,
        ctx: &mut ModuleContext<'_>,
        id: Uuid,
        version: Option<u64>,
    ) -> CoreResult<(u64, String, Arc<Book>)> {
        let doc = ctx
            .list_documents()?
            .into_iter()
            .find(|d| d.id == id)
            .ok_or_else(|| bad("documentul nu există"))?;
        let number = version.unwrap_or(doc.current);
        if let Some((cid, cv, b)) = self.cache.lock().expect("cache lock").as_ref()
            && *cid == id
            && *cv == number
        {
            return Ok((number, doc.name, b.clone()));
        }
        let (_, data) = ctx.read_document(id, Some(number))?;
        let b = Arc::new(book::read(&data, format_of(&doc.name)?).map_err(bad)?);
        *self.cache.lock().expect("cache lock") = Some((id, number, b.clone()));
        Ok((number, doc.name, b))
    }
}

impl Module for Sheets {
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
                let format = format_of(&a.name)?;
                let data = B64
                    .decode(a.data.as_bytes())
                    .map_err(|_| bad("conținutul nu este valid (base64)"))?;
                // A file that cannot be read is refused: there would be nothing to show.
                let b = book::read(&data, format).map_err(bad)?;
                let d = ctx.import_document(&a.name, &data)?;
                ctx.log(&format!("foaie de calcul importată ({} foi)", b.sheets.len()));
                Ok(
                    json!({"document": d, "format": format!("{format:?}").to_lowercase(), "editable": format.editable(), "sheets": sheets_json(&b)}),
                )
            }
            "info" => {
                let a: Which = args(a)?;
                let (number, name, b) = self.book(ctx, a.id, a.version)?;
                let format = format_of(&name)?;
                let versions = ctx.document_versions(a.id)?;
                let reason = if format.editable() {
                    String::new()
                } else {
                    format!(
                        "Fișierele .{} se deschid doar pentru citire; editarea se face pe .xlsx.",
                        format!("{format:?}").to_lowercase()
                    )
                };
                Ok(json!({
                    "name": name,
                    "format": format!("{format:?}").to_lowercase(),
                    "editable": format.editable(),
                    "reason": reason,
                    "version": number,
                    "versions": versions,
                    "sheets": sheets_json(&b),
                }))
            }
            "cells" => {
                let a: Cells = args(a)?;
                let (_, _, b) = self.book(ctx, a.id, a.version)?;
                let s = b
                    .sheets
                    .iter()
                    .find(|s| s.name == a.sheet)
                    .ok_or_else(|| bad(format!("foaia „{}” nu există", a.sheet)))?;
                let (h, w) = s.size();
                let rows = a.rows.min(MAX_WINDOW_ROWS);
                let cols = a.cols.unwrap_or(w).min(MAX_WINDOW_COLS);
                let mut out = Vec::new();
                for r in a.row0..(a.row0 + rows).min(h) {
                    let mut row = Vec::new();
                    for c in a.col0..(a.col0 + cols).min(w) {
                        let v = s.values.get_value((r, c)).and_then(book::show);
                        let f = s.formulas.get_value((r, c)).filter(|f| !f.is_empty());
                        row.push(match (v, f) {
                            (None, None) => Value::Null,
                            (v, f) => {
                                let (text, kind) = v.unwrap_or_default();
                                json!({"v": text, "k": kind.to_string(), "f": f.map(|f| format!("={}", f.trim_start_matches('=')))})
                            }
                        });
                    }
                    out.push(row);
                }
                Ok(json!({"row0": a.row0, "col0": a.col0, "rows": out, "total_rows": h, "total_cols": w}))
            }
            "save" => {
                let a: Save = args(a)?;
                if a.edits.len() > MAX_EDITS {
                    return Err(bad(format!("prea multe modificări deodată (cel mult {MAX_EDITS})")));
                }
                let doc = ctx
                    .list_documents()?
                    .into_iter()
                    .find(|d| d.id == a.id)
                    .ok_or_else(|| bad("documentul nu există"))?;
                if !format_of(&doc.name)?.editable() {
                    return Err(bad("doar fișierele .xlsx se pot modifica"));
                }
                let (v, data) = ctx.read_document(a.id, Some(a.based_on))?;
                if v.number != doc.current {
                    return Err(bad(format!(
                        "a fost salvat între timp (versiunea {}); redeschide-l",
                        doc.current
                    )));
                }
                let o = save::apply(&data, &a.edits).map_err(bad)?;
                let summary = format!(
                    "{}, {}",
                    plural(o.edited, "celulă modificată", "celule modificate"),
                    plural(o.recalculated, "formulă recalculată", "formule recalculate")
                );
                let mut report = serde_json::to_value(&o).expect("serialisable");
                report["summary"] = json!(summary);
                if !a.apply {
                    report["applied"] = json!(false);
                    return Ok(report);
                }
                if (!o.lost.is_empty() || !o.uncertain.is_empty()) && !a.accept_losses {
                    return Err(bad(
                        "salvarea ar pierde sau ar lăsa neactualizate unele părți; confirmă după previzualizare",
                    ));
                }
                let mut note = summary.clone();
                if !o.lost.is_empty() {
                    note += &format!("; pierdut: {}", o.lost.join(", "));
                }
                let saved = ctx.save_document(a.id, doc.current, &o.bytes, &note)?;
                report["applied"] = json!(true);
                report["version"] = json!(saved.number);
                Ok(report)
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
                *self.cache.lock().expect("cache lock") = None;
                Ok(json!({"deleted": a.id}))
            }
            other => Err(CoreError::invalid(
                "comanda",
                format!("„{other}” nu există în modulul Foi de calcul"),
            )),
        }
    }
}
