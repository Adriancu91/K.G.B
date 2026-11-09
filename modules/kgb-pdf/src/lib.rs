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
//! - `stamp {id, based_on, pages?, filigran?, antet?, subsol?, stampila?,
//!   imagine?, apply}` → watermark / header / footer ({n}, {total}), a text
//!   stamp and an image over the pages (7.4l-1a, 7.4l-1b)
//! - `stamp_annot {id, based_on, pages?, text, sub?, culoare?, opacitate?,
//!   pozitie?, biblioteca?, latime_mm?, autor?, apply}` → a `/Stamp`
//!   annotation as in Cyber Office Studio (7.4l-1b2)
//! - `save_new {id, version?, data, name, summary, apply}` → a new document
//!   made in the window (n-up, booklet, poster…), checked, then created
//! - `save_edit {id, based_on, data, summary, same_text_pages?, apply}` → a
//!   result made in the window by a tool copied from COS (pdf-lib, D-072),
//!   checked like the others, then a preview or a new version
//! - `redact {id, based_on, zone: [{page, x, y, w, h}], apply}` → the zones
//!   hidden for good: those pages become images with black zones (7.4l-1c)
//! - `stampile`, `stampila_save {nume, date}`, `stampila_delete {id}` →
//!   „Ștampilele mele” (PNG, at most 12), kept as the module's files
//! - `restore {id, version}`, `export {id, version?, dest, overwrite}`, `delete {id}`

pub mod check;
pub mod ops;
pub mod overlay;
pub mod redact;
pub mod stamp;

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

/// A stamp as in Cyber Office Studio (7.4l-1b2): a `/Stamp` annotation.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StampAnnot {
    id: Uuid,
    based_on: u64,
    #[serde(default)]
    pages: Vec<u32>,
    #[serde(default)]
    text: String,
    #[serde(default)]
    sub: String,
    #[serde(default = "red_hex")]
    culoare: String,
    #[serde(default = "full")]
    opacitate: f64,
    #[serde(default = "bottom_right")]
    pozitie: String,
    /// A stamp from „Ștampilele mele” (its file id) instead of the text one.
    #[serde(default)]
    biblioteca: Option<Uuid>,
    #[serde(default = "default_width")]
    latime_mm: f64,
    #[serde(default)]
    autor: String,
    #[serde(default)]
    apply: bool,
}

fn red_hex() -> String {
    "#c62828".into()
}
fn full() -> f64 {
    1.0
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LibSave {
    nume: String,
    /// PNG (with transparency), base64.
    date: String,
}

/// „Ștampilele mele” are files of the module with this name prefix.
const LIB_PREFIX: &str = "Ștampilă - ";
const LIB_MAX: usize = 12;

/// A result made in the window by a tool copied from Cyber Office Studio
/// (pdf-lib, D-072): checked here like every other result, then a preview
/// or a new version.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SaveEdit {
    id: Uuid,
    based_on: u64,
    /// The new PDF, base64.
    data: String,
    /// What was done (the version's note).
    summary: String,
    /// Pages whose text must have stayed exactly as it was (1-based).
    #[serde(default)]
    same_text_pages: Vec<u32>,
    #[serde(default)]
    apply: bool,
}

/// A new document made in the window by a tool copied from COS (n-up,
/// booklet, poster…; pdf-lib, D-072): checked here, then a preview or a new
/// document (the source stays as it is).
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SaveNew {
    /// The source document (its version must exist and be intact).
    id: Uuid,
    #[serde(default)]
    version: Option<u64>,
    data: String,
    name: String,
    summary: String,
    #[serde(default)]
    apply: bool,
}

/// Hiding data for good (7.4l-1c).
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Redact {
    id: Uuid,
    based_on: u64,
    /// Zones on the pages as shown: page (from 1), x, y, w, h in points, origin top-left.
    zone: Vec<ZoneIn>,
    #[serde(default)]
    apply: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ZoneIn {
    page: u32,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

/// Text over the pages (7.4l-1a).
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Stamp {
    id: Uuid,
    based_on: u64,
    /// Empty: every page.
    #[serde(default)]
    pages: Vec<u32>,
    #[serde(default)]
    filigran: String,
    #[serde(default)]
    antet: String,
    /// May contain {n} and {total}.
    #[serde(default)]
    subsol: String,
    /// A framed text stamp (7.4l-1b).
    #[serde(default)]
    stampila: Option<StampIn>,
    /// An image: base64 PNG/JPEG, width in mm, place (7.4l-1b).
    #[serde(default)]
    imagine: Option<ImageIn>,
    #[serde(default)]
    apply: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StampIn {
    text: String,
    #[serde(default = "red")]
    culoare: String,
    #[serde(default = "bottom_right")]
    pozitie: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ImageIn {
    date: String,
    #[serde(default = "default_width")]
    latime_mm: f64,
    #[serde(default = "bottom_right")]
    pozitie: String,
}

fn red() -> String {
    "rosu".into()
}
fn bottom_right() -> String {
    "jos-dreapta".into()
}
fn default_width() -> f64 {
    40.0
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
            "save_new" => {
                let a: SaveNew = args(a)?;
                intact(ctx, a.id, a.version)?;
                let out = B64.decode(a.data.as_bytes()).map_err(|_| bad("rezultatul nu a ajuns întreg"))?;
                let summary = a.summary.trim().chars().take(200).collect::<String>();
                if summary.is_empty() {
                    return Err(bad("lipsește descrierea schimbării"));
                }
                let n = match check::check(&out) {
                    check::Status::Intact(n) if n > 0 => n,
                    s => return Err(bad(format!("rezultatul nu trece verificarea: {}", s.reason()))),
                };
                if !a.apply {
                    return Ok(preview(&out, n, summary));
                }
                let d = ctx.import_document(&pdf_name(&a.name), &out)?;
                Ok(json!({"applied": true, "document": d, "pages": n, "summary": summary}))
            }
            "save_edit" => {
                let a: SaveEdit = args(a)?;
                let (num, data) = intact(ctx, a.id, Some(a.based_on))?;
                let before = texts_of(&data)?;
                let out = B64.decode(a.data.as_bytes()).map_err(|_| bad("rezultatul nu a ajuns întreg"))?;
                let summary = a.summary.trim().chars().take(200).collect::<String>();
                if summary.is_empty() {
                    return Err(bad("lipsește descrierea schimbării"));
                }
                // Strict check, same number of pages, the untouched pages keep their text exactly.
                let after = match check::check(&out) {
                    check::Status::Intact(_) => ops::page_texts(&ops::load(&out).map_err(bad)?),
                    s => return Err(bad(format!("rezultatul nu trece verificarea: {}", s.reason()))),
                };
                if after.len() != before.len() {
                    return Err(bad(format!("rezultatul are {} pagini în loc de {}", after.len(), before.len())));
                }
                if let Some(p) = a.same_text_pages.iter().find(|p| {
                    let i = (**p as usize).wrapping_sub(1);
                    i >= before.len() || before[i] != after[i]
                }) {
                    return Err(bad(format!("textul paginii {p} nu s-a păstrat")));
                }
                let n = after.len();
                if !a.apply {
                    return Ok(preview(&out, n, summary));
                }
                let v = ctx.save_document(a.id, num, &out, &summary)?;
                Ok(json!({"applied": true, "version": v.number, "pages": n, "summary": summary}))
            }
            "redact" => {
                let a: Redact = args(a)?;
                let (num, data) = intact(ctx, a.id, Some(a.based_on))?;
                let mut texts = texts_of(&data)?;
                let zones: Vec<redact::Zone> = a.zone.iter().map(|z| redact::Zone { page: z.page, x: z.x, y: z.y, w: z.w, h: z.h }).collect();
                let (out, pages) = redact::redact(&data, &zones).map_err(bad)?;
                // The pages turned into images have no text left; the others keep theirs exactly.
                for p in &pages {
                    texts[*p as usize - 1] = String::new();
                }
                let n = ops::verify(&out, &texts, None).map_err(bad)?;
                let summary = format!("{} pe {} (devine imagine)", plural(a.zone.len(), "zonă ascunsă", "zone ascunse"), plural(pages.len(), "pagină", "pagini"));
                if !a.apply {
                    return Ok(preview(&out, n, summary));
                }
                let v = ctx.save_document(a.id, num, &out, &summary)?;
                Ok(json!({"applied": true, "version": v.number, "pages": n, "summary": summary}))
            }
            "stamp_annot" => {
                let a: StampAnnot = args(a)?;
                let (num, data) = intact(ctx, a.id, Some(a.based_on))?;
                let texts = texts_of(&data)?;
                let (image, label) = match a.biblioteca {
                    Some(fid) => {
                        let (fr, bytes) = ctx.get_file(fid)?;
                        let name = fr.name.strip_prefix(LIB_PREFIX).ok_or_else(|| bad("ștampila nu e din „Ștampilele mele”"))?.trim_end_matches(".png").to_string();
                        (Some(bytes), name)
                    }
                    None => (None, a.text.clone()),
                };
                let spec = stamp::StampSpec { label, sub: a.sub, color: a.culoare, opacity: a.opacitate, place: a.pozitie, image, width_mm: a.latime_mm, author: a.autor };
                let out = stamp::add(&data, &a.pages, &spec).map_err(bad)?;
                let n = ops::verify(&out, &texts, None).map_err(bad)?;
                let chosen: Vec<u32> = if a.pages.is_empty() { (1..=n as u32).collect() } else { a.pages.clone() };
                if let Some(p) = chosen.iter().find(|p| stamp::stamps_on(&out, **p).is_empty()) {
                    return Err(bad(format!("ștampila nu a ajuns pe pagina {p}")));
                }
                let summary = format!("ștampila „{}” pe {}", spec.label, plural(chosen.len(), "pagină", "pagini"));
                if !a.apply {
                    return Ok(preview(&out, n, summary));
                }
                let v = ctx.save_document(a.id, num, &out, &summary)?;
                Ok(json!({"applied": true, "version": v.number, "pages": n, "summary": summary}))
            }
            "stampile" => {
                let mut out = Vec::new();
                for f in ctx.list_files()?.into_iter().filter(|f| f.name.starts_with(LIB_PREFIX)) {
                    let (_, bytes) = ctx.get_file(f.id)?;
                    let (w, h) = stamp::png_size(&bytes).unwrap_or((1, 1));
                    out.push(json!({"id": f.id, "nume": f.name.trim_start_matches(LIB_PREFIX).trim_end_matches(".png"), "raport": f64::from(w) / f64::from(h.max(1)), "png": B64.encode(&bytes)}));
                }
                Ok(json!(out))
            }
            "stampila_save" => {
                let a: LibSave = args(a)?;
                let nume = a.nume.trim();
                if nume.is_empty() || nume.chars().count() > 40 || nume.chars().any(|c| c.is_control() || r#"\\/:*?"<>|"#.contains(c)) {
                    return Err(bad("numele ștampilei are 1–40 de caractere, fără / \\ : * ? \" < > |"));
                }
                let bytes = B64.decode(a.date.as_bytes()).map_err(|_| bad("imaginea nu a ajuns întreagă"))?;
                let (w, h) = stamp::png_size(&bytes).ok_or_else(|| bad("ștampila se păstrează ca PNG"))?;
                if w == 0 || h == 0 || w > 2000 || h > 2000 || bytes.len() > 3 * 1024 * 1024 {
                    return Err(bad("imaginea ștampilei e prea mare (cel mult 2000 de pixeli pe latură, 3 MB)"));
                }
                let list: Vec<_> = ctx.list_files()?.into_iter().filter(|f| f.name.starts_with(LIB_PREFIX)).collect();
                let name = format!("{LIB_PREFIX}{nume}.png");
                if list.iter().any(|f| f.name.to_lowercase() == name.to_lowercase()) {
                    return Err(bad(format!("există deja o ștampilă „{nume}”")));
                }
                if list.len() >= LIB_MAX {
                    return Err(bad(format!("„Ștampilele mele” au cel mult {LIB_MAX}; șterge una mai întâi")));
                }
                let f = ctx.put_file(&name, &bytes)?;
                Ok(json!({"id": f.id}))
            }
            "stampila_delete" => {
                let a: Which = args(a)?;
                let f = ctx.list_files()?.into_iter().find(|f| f.id == a.id && f.name.starts_with(LIB_PREFIX)).ok_or_else(|| bad("ștampila nu există"))?;
                ctx.delete_file(f.id)?;
                Ok(json!({"deleted": true}))
            }
            "stamp" => {
                let a: Stamp = args(a)?;
                let (num, data) = intact(ctx, a.id, Some(a.based_on))?;
                let texts = texts_of(&data)?;
                let image = match a.imagine {
                    Some(im) => Some(overlay::Picture {
                        data: B64.decode(im.date.as_bytes()).map_err(|_| bad("imaginea nu a ajuns întreagă"))?,
                        width_mm: im.latime_mm,
                        place: im.pozitie,
                    }),
                    None => None,
                };
                let stamp = a.stampila.map(|st| overlay::Stamp { text: st.text, color: st.culoare, place: st.pozitie });
                let o = overlay::Overlay { watermark: a.filigran, header: a.antet, footer: a.subsol, stamp, image };
                let out = overlay::apply(&data, &a.pages, &o).map_err(bad)?;
                // The pages keep their own text exactly; the overlay is checked to be there.
                let n = ops::verify(&out, &texts, None).map_err(bad)?;
                let chosen: Vec<u32> = if a.pages.is_empty() { (1..=n as u32).collect() } else { a.pages.clone() };
                if let Some(p) = chosen.iter().find(|p| !overlay::has_overlay(&out, **p)) {
                    return Err(bad(format!("textul nu a ajuns pe pagina {p}")));
                }
                let what: Vec<&str> = [
                    (!o.watermark.trim().is_empty(), "filigran"),
                    (!o.header.trim().is_empty(), "antet"),
                    (!o.footer.trim().is_empty(), "subsol"),
                    (o.stamp.is_some(), "ștampilă"),
                    (o.image.is_some(), "imagine"),
                ]
                    .into_iter()
                    .filter_map(|(on, w)| on.then_some(w))
                    .collect();
                let summary = format!("{} pe {}", what.join(", "), plural(chosen.len(), "pagină", "pagini"));
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
