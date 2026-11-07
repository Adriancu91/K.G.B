//! `kgb.pdf` — PDF documents (Etapa 3, step 3.5; Master Plan §6.1).
//!
//! Built only on the module contract: documents are the core's versioned
//! documents (permission `files.own`, D-034), so the imported original never
//! changes and every edit is a new version. Libraries chosen in spike S4
//! (D-032): lopdf for operations, hayro for page thumbnails; the window shows
//! pages with pdf.js. Its interface lives in `app/src/modules/pdf/`.
//!
//! Rules:
//! - Before any operation the file passes a strict integrity check
//!   ([`check`]); damaged or encrypted PDFs are read-only (R18).
//! - Every result is verified before it is saved: it reopens, passes the strict
//!   check, has the expected pages, rotations and per-page text ([`ops::verify`]).
//! - Operations first return a preview (`apply: false`); only `apply: true`
//!   saves, as a new version or a new document.
//!
//! Commands (JSON in, JSON out; file contents are base64):
//! - `list` → documents
//! - `import {name, data}` → `{document, status, pages, reason}`
//! - `info {id, version?}` → name, versions, status, pages, rotations
//! - `read {id, version?}` → `{data}`
//! - `thumb {id, version?, page, width?}` → `{png}`
//! - `text {id, version?}` → `[page text]`
//! - `rotate {id, based_on, pages, angle, apply}` → preview or new version
//! - `delete_pages {id, based_on, pages, apply}` → preview or new version
//! - `extract {id, version?, pages, name, apply}` → preview or new document
//! - `merge {ids, name, apply}` → preview or new document
//! - `restore {id, version}`, `export {id, version?, dest, overwrite}`, `delete {id}`

pub mod check;
pub mod ops;

use std::path::PathBuf;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::documents::DocumentRef;
use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::{CoreError, CoreResult};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

use check::Status;

pub const ID: &str = "kgb.pdf";
const THUMB_DEFAULT_WIDTH: f32 = 160.0;
const THUMB_MAX_WIDTH: f32 = 1600.0;

pub struct Pdf {
    manifest: Manifest,
}

impl Pdf {
    pub fn new() -> Pdf {
        Pdf {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Pdf {
    fn default() -> Self {
        Pdf::new()
    }
}

fn args<T: DeserializeOwned>(v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid("comanda", e.to_string()))
}

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("PDF", detail)
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
struct Thumb {
    id: Uuid,
    #[serde(default)]
    version: Option<u64>,
    page: u32,
    #[serde(default)]
    width: Option<f32>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Edit {
    id: Uuid,
    based_on: u64,
    pages: Vec<u32>,
    #[serde(default)]
    angle: Option<i64>,
    #[serde(default)]
    apply: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Extract {
    id: Uuid,
    #[serde(default)]
    version: Option<u64>,
    pages: Vec<u32>,
    name: String,
    #[serde(default)]
    apply: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Merge {
    ids: Vec<Uuid>,
    name: String,
    #[serde(default)]
    apply: bool,
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

fn status_json(s: &Status) -> Value {
    json!({
        "status": s.code(),
        "pages": match s { Status::Intact(n) => Some(*n), _ => None },
        "reason": s.reason(),
    })
}

/// Bytes of a version, only if the PDF is intact (operations need that).
fn intact(ctx: &mut ModuleContext<'_>, id: Uuid, version: Option<u64>) -> CoreResult<(u64, Vec<u8>)> {
    let (v, data) = ctx.read_document(id, version)?;
    match check::check(&data) {
        Status::Intact(_) => Ok((v.number, data)),
        s => Err(bad(format!("{} — nu se poate modifica", s.reason()))),
    }
}

/// „1 pagină rotită” / „3 pagini rotite”.
fn plural(n: usize, one: &str, many: &str) -> String {
    if n == 1 {
        format!("1 {one}")
    } else {
        format!("{n} {many}")
    }
}

fn pdf_name(name: &str) -> String {
    let n = name.trim();
    if n.to_lowercase().ends_with(".pdf") {
        n.to_string()
    } else {
        format!("{n}.pdf")
    }
}

/// The texts the result must keep, page by page.
fn texts_of(data: &[u8]) -> CoreResult<Vec<String>> {
    Ok(ops::page_texts(&ops::load(data).map_err(bad)?))
}

fn preview(result: &[u8], pages: usize, summary: String) -> Value {
    json!({"preview": B64.encode(result), "pages": pages, "summary": summary, "applied": false})
}

impl Module for Pdf {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "list" => {
                let docs: Vec<DocumentRef> = ctx.list_documents()?.into_iter().filter(|d| d.kind == "pdf").collect();
                Ok(serde_json::to_value(docs).expect("serialisable"))
            }
            "import" => {
                let a: Import = args(a)?;
                let data = B64
                    .decode(a.data.as_bytes())
                    .map_err(|_| bad("conținutul nu este valid (base64)"))?;
                if !check::is_pdf(&data) {
                    return Err(bad("fișierul nu este un PDF"));
                }
                // Even a damaged PDF is imported (the original is kept exactly
                // as received); it is just read-only.
                let s = check::check(&data);
                let d = ctx.import_document(&pdf_name(&a.name), &data)?;
                ctx.log(&format!("PDF importat ({})", s.code()));
                let mut v = status_json(&s);
                v["document"] = serde_json::to_value(d).expect("serialisable");
                Ok(v)
            }
            "info" => {
                let a: Which = args(a)?;
                let (v, data) = ctx.read_document(a.id, a.version)?;
                let doc = ctx.list_documents()?.into_iter().find(|d| d.id == a.id);
                let versions = ctx.document_versions(a.id)?;
                let s = check::check(&data);
                let mut out = status_json(&s);
                out["name"] = json!(doc.map(|d| d.name));
                out["version"] = json!(v.number);
                out["size"] = json!(v.size);
                out["versions"] = serde_json::to_value(versions).expect("serialisable");
                out["rotations"] = match &s {
                    Status::Intact(_) => json!(ops::rotations(&ops::load(&data).map_err(bad)?)),
                    _ => json!([]),
                };
                Ok(out)
            }
            "read" => {
                let a: Which = args(a)?;
                let (v, data) = ctx.read_document(a.id, a.version)?;
                Ok(json!({"version": v.number, "data": B64.encode(&data)}))
            }
            "thumb" => {
                let a: Thumb = args(a)?;
                let (_, data) = ctx.read_document(a.id, a.version)?;
                let png = thumbnail(
                    data,
                    a.page,
                    a.width.unwrap_or(THUMB_DEFAULT_WIDTH).clamp(16.0, THUMB_MAX_WIDTH),
                )?;
                Ok(json!({"png": B64.encode(png)}))
            }
            "text" => {
                let a: Which = args(a)?;
                let (_, data) = intact(ctx, a.id, a.version)?;
                Ok(json!(texts_of(&data)?))
            }
            "rotate" => {
                let a: Edit = args(a)?;
                let angle = a.angle.unwrap_or(90);
                let (num, data) = intact(ctx, a.id, Some(a.based_on))?;
                let src = ops::load(&data).map_err(bad)?;
                let texts = ops::page_texts(&src);
                let mut rot = ops::rotations(&src);
                let out = ops::rotate(&data, &a.pages, angle).map_err(bad)?;
                for p in &a.pages {
                    rot[*p as usize - 1] = (rot[*p as usize - 1] + angle).rem_euclid(360);
                }
                let n = ops::verify(&out, &texts, Some(&rot)).map_err(bad)?;
                let summary = format!(
                    "{} cu {angle}°",
                    plural(a.pages.len(), "pagină rotită", "pagini rotite")
                );
                if !a.apply {
                    return Ok(preview(&out, n, summary));
                }
                let v = ctx.save_document(a.id, num, &out, &summary)?;
                Ok(json!({"applied": true, "version": v.number, "pages": n, "summary": summary}))
            }
            "delete_pages" => {
                let a: Edit = args(a)?;
                let (num, data) = intact(ctx, a.id, Some(a.based_on))?;
                let texts = texts_of(&data)?;
                let keep: Vec<u32> = (1..=texts.len() as u32).filter(|p| !a.pages.contains(p)).collect();
                if keep.is_empty() {
                    return Err(bad("nu se pot scoate toate paginile"));
                }
                let out = ops::keep(&data, &keep).map_err(bad)?;
                let want: Vec<String> = keep.iter().map(|p| texts[*p as usize - 1].clone()).collect();
                let n = ops::verify(&out, &want, None).map_err(bad)?;
                let summary = format!("{}, rămân {n}", plural(a.pages.len(), "pagină scoasă", "pagini scoase"));
                if !a.apply {
                    return Ok(preview(&out, n, summary));
                }
                let v = ctx.save_document(a.id, num, &out, &summary)?;
                Ok(json!({"applied": true, "version": v.number, "pages": n, "summary": summary}))
            }
            "extract" => {
                let a: Extract = args(a)?;
                let (num, data) = intact(ctx, a.id, a.version)?;
                let texts = texts_of(&data)?;
                let mut pages = a.pages.clone();
                pages.sort_unstable();
                pages.dedup();
                let out = ops::keep(&data, &pages).map_err(bad)?;
                let want: Vec<String> = pages.iter().map(|p| texts[*p as usize - 1].clone()).collect();
                let n = ops::verify(&out, &want, None).map_err(bad)?;
                let summary = format!("{} din versiunea {num}", plural(n, "pagină extrasă", "pagini extrase"));
                if !a.apply {
                    return Ok(preview(&out, n, summary));
                }
                let d = ctx.import_document(&pdf_name(&a.name), &out)?;
                Ok(json!({"applied": true, "document": d, "pages": n, "summary": summary}))
            }
            "merge" => {
                let a: Merge = args(a)?;
                let mut srcs = Vec::new();
                let mut want = Vec::new();
                for id in &a.ids {
                    let (_, data) = intact(ctx, *id, None)?;
                    want.extend(texts_of(&data)?);
                    srcs.push(data);
                }
                let out = ops::merge(&srcs).map_err(bad)?;
                let n = ops::verify(&out, &want, None).map_err(bad)?;
                let summary = format!("{} documente unite, {}", a.ids.len(), plural(n, "pagină", "pagini"));
                if !a.apply {
                    return Ok(preview(&out, n, summary));
                }
                let d = ctx.import_document(&pdf_name(&a.name), &out)?;
                Ok(json!({"applied": true, "document": d, "pages": n, "summary": summary}))
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
                format!("„{other}” nu există în modulul PDF"),
            )),
        }
    }
}

/// A page as a PNG `width` pixels wide (hayro, pure Rust).
fn thumbnail(data: Vec<u8>, page: u32, width: f32) -> CoreResult<Vec<u8>> {
    let pdf = hayro::hayro_syntax::Pdf::new(data).map_err(|_| bad("PDF-ul nu se poate afișa"))?;
    let pages = pdf.pages();
    let p = pages
        .get((page as usize).wrapping_sub(1))
        .ok_or_else(|| bad(format!("pagina {page} nu există")))?;
    let (w, _) = p.render_dimensions();
    let scale = (width / w.max(1.0)).min(4.0);
    let cache = hayro::RenderCache::new();
    let px = hayro::render(
        p,
        &cache,
        &hayro::hayro_interpret::InterpreterSettings::default(),
        &hayro::RenderSettings::default(),
        &hayro::PixmapSettings {
            x_scale: scale,
            y_scale: scale,
            bg_color: hayro::vello_cpu::color::palette::css::WHITE,
        },
    );
    px.into_png()
        .map_err(|e| bad(format!("miniatura nu s-a putut crea: {e}")))
}
