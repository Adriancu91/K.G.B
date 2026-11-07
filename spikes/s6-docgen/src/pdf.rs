//! PDF from a model with Typst used as a library (no external program, no
//! network). The values never become part of the model's code: they arrive as
//! `sys.inputs` strings, so a value like `#panic()` is printed as text.

use std::collections::BTreeMap;

use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime, Dict, Duration, IntoValue};
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World};
use typst_layout::PagedDocument;

struct DocWorld {
    library: LazyHash<Library>,
    book: LazyHash<FontBook>,
    fonts: Vec<Font>,
    main: Source,
}

impl DocWorld {
    fn new(model: &str, inputs: &BTreeMap<String, String>, extra_fonts: &[Vec<u8>]) -> DocWorld {
        let mut dict = Dict::new();
        for (k, v) in inputs {
            dict.insert(k.as_str().into(), v.clone().into_value());
        }
        let library = Library::builder().with_inputs(dict).build();
        let mut fonts = Vec::new();
        #[cfg(feature = "typst-fonts")]
        for data in typst_assets::fonts() {
            fonts.extend(Font::iter(Bytes::new(data)));
        }
        for data in extra_fonts {
            fonts.extend(Font::iter(Bytes::new(data.clone())));
        }
        let book = FontBook::from_fonts(&fonts);
        let id = FileId::new(RootedPath::new(
            VirtualRoot::Project,
            VirtualPath::new("/model.typ").expect("path"),
        ));
        DocWorld {
            library: LazyHash::new(library),
            book: LazyHash::new(book),
            fonts,
            main: Source::new(id, model.to_string()),
        }
    }
}

impl World for DocWorld {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }
    fn book(&self) -> &LazyHash<FontBook> {
        &self.book
    }
    fn main(&self) -> FileId {
        self.main.id()
    }
    fn source(&self, id: FileId) -> FileResult<Source> {
        if id == self.main.id() {
            Ok(self.main.clone())
        } else {
            // A model cannot read other files from the computer.
            Err(FileError::AccessDenied)
        }
    }
    fn file(&self, _id: FileId) -> FileResult<Bytes> {
        Err(FileError::AccessDenied)
    }
    fn font(&self, index: usize) -> Option<Font> {
        self.fonts.get(index).cloned()
    }
    fn today(&self, _offset: Option<Duration>) -> Option<Datetime> {
        None
    }
}

pub fn render(model: &str, inputs: &BTreeMap<String, String>, extra_fonts: &[Vec<u8>]) -> Result<Vec<u8>, String> {
    let world = DocWorld::new(model, inputs, extra_fonts);
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
