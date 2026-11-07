//! PDF from Typst models (step 4.8b; D-045: Typst, chosen by the owner).
//!
//! - A model uses the same `{{field}}` placeholders as the Word models. Before
//!   compiling, each one becomes `#{__kgb.at("field")}`: the value comes from
//!   `sys.inputs` as a string, so whatever the user types is printed as text
//!   and never runs as Typst code.
//! - The model cannot read files from the computer or the network: the Typst
//!   world here has only the model itself and the fonts built into the app.
//! - The fonts are Typst's own (built in), so the same model and values give
//!   the same PDF on any computer and in any year.
//! - Only the built-in models are Typst models; the user's own models are
//!   Word files (a Typst file is a program and could run for ever).

use std::collections::{BTreeMap, BTreeSet};
use std::sync::OnceLock;

use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime, Dict, Duration, IntoValue};
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World};
use typst_layout::PagedDocument;

/// The fonts, loaded once per process.
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

struct ModelWorld {
    library: LazyHash<Library>,
    main: Source,
}

impl World for ModelWorld {
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
        if id == self.main.id() {
            Ok(self.main.clone())
        } else {
            Err(FileError::AccessDenied)
        }
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

/// The `{{fields}}` of a Typst model.
pub fn fields_in(src: &str) -> BTreeSet<String> {
    crate::fill::placeholders(src).into_iter().map(|(_, _, n)| n).collect()
}

/// `{{field}}` → `#{__kgb.at("field")}` (a code block: nothing after it can
/// continue the expression).
fn prepare(src: &str) -> String {
    let mut out = String::from("#let __kgb = sys.inputs\n");
    let mut last = 0;
    for (s, e, name) in crate::fill::placeholders(src) {
        out.push_str(&src[last..s]);
        out.push_str(&format!("#{{__kgb.at(\"{name}\")}}"));
        last = e;
    }
    out.push_str(&src[last..]);
    out
}

pub fn render(src: &str, values: &BTreeMap<String, String>) -> Result<Vec<u8>, String> {
    let mut dict = Dict::new();
    for (k, v) in values {
        dict.insert(k.as_str().into(), v.clone().into_value());
    }
    let id = FileId::new(RootedPath::new(
        VirtualRoot::Project,
        VirtualPath::new("/model.typ").map_err(|e| format!("{e:?}"))?,
    ));
    let world = ModelWorld {
        library: LazyHash::new(Library::builder().with_inputs(dict).build()),
        main: Source::new(id, prepare(src)),
    };
    let doc: PagedDocument = typst::compile(&world).output.map_err(|errs| {
        errs.iter()
            .map(|e| e.message.to_string())
            .collect::<Vec<_>>()
            .join("; ")
    })?;
    typst_pdf::pdf(&doc, &typst_pdf::PdfOptions::default()).map_err(|errs| {
        errs.iter()
            .map(|e| e.message.to_string())
            .collect::<Vec<_>>()
            .join("; ")
    })
}

/// The text of every page (for the check after generating and the preview).
pub fn text(pdf: &[u8]) -> Result<String, String> {
    let doc = lopdf::Document::load_mem(pdf).map_err(|e| format!("PDF-ul nu se poate citi: {e}"))?;
    let pages: Vec<u32> = doc.get_pages().keys().copied().collect();
    doc.extract_text(&pages).map_err(|e| e.to_string())
}
