//! Text over the pages (Etapa 7, step 7.4l-1a; tool taken from Cyber Office
//! Studio, D-067, rewritten here): a watermark across the page, a header and
//! a footer (with the page number), on all pages or chosen ones.
//!
//! - The text is laid out by Typst with the fonts built into the app, so the
//!   Romanian letters (ă, â, î, ș, ț) come out right on any computer; what
//!   the user types is passed as data, never run as Typst code.
//! - Each page gets its overlay as a separate drawing (a form XObject) drawn
//!   after its own content, inside a saved graphics state: the page's own
//!   content is not changed, and its text stays exactly as it was (the
//!   non-corruption check compares it).
//! - Rotated pages: the overlay follows the page as it is shown.
//! - The watermark is half transparent, so it does not hide what is under it.

use std::collections::BTreeMap;
use std::sync::OnceLock;

use lopdf::{Dictionary, Document, Object, ObjectId, Stream};
use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime, Dict, Duration, IntoValue};
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World};
use typst_layout::PagedDocument;

use crate::ops::{self, load, save};

/// What to put on the pages.
#[derive(Clone, Debug, Default)]
pub struct Overlay {
    pub watermark: String,
    pub header: String,
    /// May contain `{n}` (page number) and `{total}` (number of pages).
    pub footer: String,
}

pub const MAX_TEXT: usize = 120;

fn fonts() -> &'static (LazyHash<FontBook>, Vec<Font>) {
    static FONTS: OnceLock<(LazyHash<FontBook>, Vec<Font>)> = OnceLock::new();
    FONTS.get_or_init(|| {
        let mut fonts = Vec::new();
        for data in typst_assets::fonts() {
            fonts.extend(Font::iter(Bytes::new(data)));
        }
        (LazyHash::new(FontBook::from_fonts(&fonts)), fonts)
    })
}

/// A Typst world with only the overlay source and the built-in fonts: no
/// files, no network.
struct OverlayWorld {
    library: LazyHash<Library>,
    main: Source,
}

impl World for OverlayWorld {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }
    fn book(&self) -> &LazyHash<FontBook> {
        &fonts().0
    }
    fn main(&self) -> FileId {
        self.main.id()
    }
    fn source(&self, id: FileId) -> FileResult<Source> {
        if id == self.main.id() { Ok(self.main.clone()) } else { Err(FileError::AccessDenied) }
    }
    fn file(&self, _id: FileId) -> FileResult<Bytes> {
        Err(FileError::AccessDenied)
    }
    fn font(&self, index: usize) -> Option<Font> {
        fonts().1.get(index).cloned()
    }
    fn today(&self, _offset: Option<Duration>) -> Option<Datetime> {
        None
    }
}

/// A page as shown: its media box, rotation and shown size.
struct PageBox {
    x0: f64,
    y0: f64,
    w: f64,
    h: f64,
    rotate: i64,
}

impl PageBox {
    fn shown(&self) -> (f64, f64) {
        if self.rotate % 180 == 0 { (self.w, self.h) } else { (self.h, self.w) }
    }
    /// Maps the shown page (origin bottom-left) onto the page's own space.
    fn matrix(&self) -> [f64; 6] {
        let (w, h, x, y) = (self.w, self.h, self.x0, self.y0);
        match self.rotate {
            90 => [0.0, 1.0, -1.0, 0.0, x + w, y],
            180 => [-1.0, 0.0, 0.0, -1.0, x + w, y + h],
            270 => [0.0, -1.0, 1.0, 0.0, x, y + h],
            _ => [1.0, 0.0, 0.0, 1.0, x, y],
        }
    }
}

fn num(o: &Object) -> Option<f64> {
    match o {
        Object::Integer(i) => Some(*i as f64),
        Object::Real(r) => Some(f64::from(*r)),
        _ => None,
    }
}

fn page_box(doc: &Document, id: ObjectId) -> Result<PageBox, String> {
    let d = doc.get_dictionary(id).map_err(|e| e.to_string())?;
    let mb = d
        .get(b"MediaBox")
        .ok()
        .and_then(|o| match o {
            Object::Reference(r) => doc.get_object(*r).ok(),
            o => Some(o),
        })
        .and_then(|o| o.as_array().ok())
        .and_then(|a| a.iter().map(num).collect::<Option<Vec<f64>>>())
        .filter(|a| a.len() == 4)
        .unwrap_or_else(|| vec![0.0, 0.0, 595.0, 842.0]);
    let rotate = d.get(b"Rotate").ok().and_then(|o| o.as_i64().ok()).unwrap_or(0).rem_euclid(360);
    let (x0, y0) = (mb[0].min(mb[2]), mb[1].min(mb[3]));
    Ok(PageBox { x0, y0, w: (mb[2] - mb[0]).abs(), h: (mb[3] - mb[1]).abs(), rotate })
}

fn clean(t: &str, what: &str) -> Result<String, String> {
    let t = t.trim();
    if t.chars().count() > MAX_TEXT {
        return Err(format!("{what} are cel mult {MAX_TEXT} de caractere"));
    }
    if t.chars().any(char::is_control) {
        return Err(format!("{what} nu poate avea rânduri noi sau caractere de control"));
    }
    Ok(t.to_string())
}

/// Lays out one overlay page per chosen page (Typst → PDF).
fn layout(sizes: &[(f64, f64)], numbers: &[usize], total: usize, o: &Overlay) -> Result<Vec<u8>, String> {
    let mut inputs = Dict::new();
    inputs.insert("w".into(), o.watermark.clone().into_value());
    inputs.insert("h".into(), o.header.clone().into_value());
    let mut src = String::from("#let i = sys.inputs\n#set page(margin: 0pt, fill: none)\n#set text(font: \"Libertinus Serif\")\n");
    for (k, ((w, h), n)) in sizes.iter().zip(numbers).enumerate() {
        let footer = o.footer.replace("{n}", &n.to_string()).replace("{total}", &total.to_string());
        inputs.insert(format!("f{k}").as_str().into(), footer.clone().into_value());
        src.push_str(&format!("#page(width: {w:.2}pt, height: {h:.2}pt)[\n"));
        if !o.watermark.is_empty() {
            let diag = (w * w + h * h).sqrt();
            let size = (diag / (o.watermark.chars().count() as f64 * 0.62 + 2.0)).clamp(18.0, 110.0);
            let angle = -(h.atan2(*w).to_degrees());
            src.push_str(&format!(
                "#place(center + horizon, rotate({angle:.2}deg, reflow: true, text(size: {size:.1}pt, weight: \"bold\", fill: rgb(120, 120, 120).transparentize(70%))[#i.at(\"w\")]))\n"
            ));
        }
        if !o.header.is_empty() {
            src.push_str("#place(top + center, dy: 16pt, text(size: 9pt, fill: rgb(60, 60, 60))[#i.at(\"h\")])\n");
        }
        if !footer.is_empty() {
            src.push_str(&format!("#place(bottom + center, dy: -16pt, text(size: 9pt, fill: rgb(60, 60, 60))[#i.at(\"f{k}\")])\n"));
        }
        src.push_str("]\n");
    }
    let id = FileId::new(RootedPath::new(VirtualRoot::Project, VirtualPath::new("/overlay.typ").map_err(|e| format!("{e:?}"))?));
    let world = OverlayWorld { library: LazyHash::new(Library::builder().with_inputs(inputs).build()), main: Source::new(id, src) };
    let doc: PagedDocument = typst::compile(&world)
        .output
        .map_err(|errs| errs.iter().map(|e| e.message.to_string()).collect::<Vec<_>>().join("; "))?;
    typst_pdf::pdf(&doc, &typst_pdf::PdfOptions::default()).map_err(|errs| errs.iter().map(|e| e.message.to_string()).collect::<Vec<_>>().join("; "))
}

/// The content of a page, decoded and joined.
fn page_content(doc: &Document, page: ObjectId) -> Result<Vec<u8>, String> {
    let c = doc.get_page_content(page);
    if c.is_empty() {
        return Err("textul de pus pe pagini a ieșit gol".into());
    }
    Ok(c)
}

/// Puts the overlay on the chosen pages (1-based; all if empty).
pub fn apply(src: &[u8], pages: &[u32], o: &Overlay) -> Result<Vec<u8>, String> {
    let o = Overlay { watermark: clean(&o.watermark, "filigranul")?, header: clean(&o.header, "antetul")?, footer: clean(&o.footer, "subsolul")? };
    if o.watermark.is_empty() && o.header.is_empty() && o.footer.is_empty() {
        return Err("scrie filigranul, antetul sau subsolul".into());
    }
    let mut doc = load(src)?;
    ops::flatten_inherited(&mut doc);
    let all: BTreeMap<u32, ObjectId> = doc.get_pages();
    let total = all.len();
    let chosen: Vec<u32> = if pages.is_empty() { all.keys().copied().collect() } else { pages.to_vec() };
    if let Some(p) = chosen.iter().find(|p| !all.contains_key(p)) {
        return Err(format!("pagina {p} nu există (documentul are {total})"));
    }
    let boxes: Vec<PageBox> = chosen.iter().map(|p| page_box(&doc, all[p])).collect::<Result<_, _>>()?;
    let sizes: Vec<(f64, f64)> = boxes.iter().map(PageBox::shown).collect();
    let numbers: Vec<usize> = chosen.iter().map(|p| *p as usize).collect();
    let ov_bytes = layout(&sizes, &numbers, total, &o)?;

    let mut ov = load(&ov_bytes)?;
    ops::flatten_inherited(&mut ov);
    ov.renumber_objects_with(doc.max_id + 1);
    let ov_pages: Vec<ObjectId> = ov.get_pages().values().copied().collect();
    if ov_pages.len() != chosen.len() {
        return Err("textul de pus pe pagini nu a ieșit cum trebuia".into());
    }
    let mut forms = Vec::new();
    for pid in &ov_pages {
        let content = page_content(&ov, *pid)?;
        let res = ov.get_dictionary(*pid).ok().and_then(|d| d.get(b"Resources").ok().cloned()).unwrap_or(Object::Dictionary(Dictionary::new()));
        forms.push((content, res));
    }
    // Everything the overlay pages use (fonts, transparency…), but not its pages.
    let skip: Vec<ObjectId> = ov_pages.clone();
    for (id, obj) in std::mem::take(&mut ov.objects) {
        let is_tree = obj.as_dict().ok().and_then(|d| d.get(b"Type").ok()).and_then(|t| t.as_name().ok()).is_some_and(|n| n == b"Catalog" || n == b"Pages");
        if !skip.contains(&id) && !is_tree {
            doc.objects.insert(id, obj);
        }
    }
    doc.max_id = doc.max_id.max(ov.max_id);

    for (k, p) in chosen.iter().enumerate() {
        let page_id = all[p];
        let (content, res) = forms[k].clone();
        let (vw, vh) = sizes[k];
        let m = boxes[k].matrix();
        let mut form = Dictionary::new();
        form.set("Type", "XObject");
        form.set("Subtype", "Form");
        form.set("BBox", vec![0.into(), 0.into(), Object::Real(vw as f32), Object::Real(vh as f32)]);
        form.set("Matrix", m.iter().map(|x| Object::Real(*x as f32)).collect::<Vec<_>>());
        form.set("Resources", res);
        let mut stream = Stream::new(form, content);
        let _ = stream.compress();
        let form_id = doc.add_object(stream);
        let name = format!("KGBo{k}");

        // The page's resources: its own dictionary (never a shared one).
        let page = doc.get_dictionary(page_id).map_err(|e| e.to_string())?.clone();
        let mut resources = match page.get(b"Resources") {
            Ok(Object::Reference(r)) => doc.get_dictionary(*r).map_err(|e| e.to_string())?.clone(),
            Ok(Object::Dictionary(d)) => d.clone(),
            _ => Dictionary::new(),
        };
        let mut xobjects = match resources.get(b"XObject") {
            Ok(Object::Reference(r)) => doc.get_dictionary(*r).map_err(|e| e.to_string())?.clone(),
            Ok(Object::Dictionary(d)) => d.clone(),
            _ => Dictionary::new(),
        };
        xobjects.set(name.as_bytes(), form_id);
        resources.set("XObject", xobjects);
        // Content: q <own content> Q, then the overlay.
        let before = doc.add_object(Stream::new(Dictionary::new(), b"q\n".to_vec()));
        let after = doc.add_object(Stream::new(Dictionary::new(), format!("\nQ\nq /{name} Do Q\n").into_bytes()));
        let mut contents = vec![Object::Reference(before)];
        match page.get(b"Contents") {
            Ok(Object::Array(a)) => contents.extend(a.iter().cloned()),
            Ok(o @ Object::Reference(_)) => contents.push(o.clone()),
            _ => {}
        }
        contents.push(Object::Reference(after));
        let pd = doc.get_object_mut(page_id).and_then(Object::as_dict_mut).map_err(|e| e.to_string())?;
        pd.set("Resources", resources);
        pd.set("Contents", contents);
    }
    doc.prune_objects();
    save(&mut doc)
}

/// Whether page `n` (1-based) carries an overlay (for the checks).
pub fn has_overlay(pdf: &[u8], n: u32) -> bool {
    let Ok(doc) = load(pdf) else { return false };
    let Some(id) = doc.get_pages().get(&n).copied() else { return false };
    let Ok(d) = doc.get_dictionary(id) else { return false };
    let res = match d.get(b"Resources") {
        Ok(Object::Reference(r)) => doc.get_dictionary(*r).ok(),
        Ok(Object::Dictionary(d)) => Some(d),
        _ => None,
    };
    let xo = res.and_then(|r| match r.get(b"XObject") {
        Ok(Object::Reference(x)) => doc.get_dictionary(*x).ok(),
        Ok(Object::Dictionary(x)) => Some(x),
        _ => None,
    });
    xo.is_some_and(|x| x.iter().any(|(k, _)| k.starts_with(b"KGBo")))
}

/// The text the overlay alone would put on the pages (for the preview and
/// the tests: the overlay's own words, laid out by Typst).
pub fn overlay_text(sizes: &[(f64, f64)], o: &Overlay) -> Result<String, String> {
    let numbers: Vec<usize> = (1..=sizes.len()).collect();
    let pdf = layout(sizes, &numbers, sizes.len(), o)?;
    let doc = load(&pdf)?;
    let pages: Vec<u32> = doc.get_pages().keys().copied().collect();
    doc.extract_text(&pages).map_err(|e| e.to_string())
}
