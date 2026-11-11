//! The payment statement as PDF, with Typst (D-045) and its built-in fonts, so it looks the same on any computer.
//! The template is fixed here; everything written by the person (names, items) reaches it as data in
//! `sys.inputs` (a JSON string read with `json(bytes(...))`), so it is printed as text and never runs as Typst code.
//! The Typst world has only the template and the fonts: no file of the computer, no network.

use std::sync::OnceLock;

use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime, Dict, Duration, IntoValue};
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World};
use typst_layout::PagedDocument;

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

struct StatementWorld {
    library: LazyHash<Library>,
    main: Source,
}

impl World for StatementWorld {
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

/// The template: A4 landscape, the head, the table of items, the totals, the signatures.
const TEMPLATE: &str = r#"#let d = json(bytes(sys.inputs.data))
#set page(paper: "a4", flipped: true, margin: (x: 1.4cm, y: 1.3cm))
#set text(font: "Libertinus Serif", size: 8.5pt, lang: "ro")
#align(center)[#text(size: 14pt, weight: "bold")[Situație de lucrări nr. #d.numar]]
#align(center)[perioada #d.de_la – #d.pana_la · data #d.data]
#v(4pt)
#grid(columns: (1fr, 1fr), gutter: 8pt,
  [*Executant:* #d.executant \ *Beneficiar:* #d.beneficiar],
  [*Deviz:* #d.deviz \ *Contract:* #d.contract \ *Lucrarea:* #d.santier])
#v(6pt)
#table(
  columns: (auto, 1fr, auto, auto, auto, auto, auto, auto, auto, auto, auto),
  align: (left, left, center, right, right, right, right, right, right, right, right),
  inset: 3pt,
  stroke: 0.4pt,
  table.header(..("Cod", "Denumire", "UM", "Preț unitar", "Deviz", "Anterior", "Curent", "Cumulat", "Rest", "Valoare curentă", "Valoare cumulată").map(h => text(weight: "bold")[#h])),
  ..d.linii.map(l => (l.cod, l.denumire, l.um, l.pret, l.deviz, l.anterior, l.curent, l.cumulat, l.rest, l.val_curent, l.val_cumulat)).flatten()
)
#v(6pt)
#align(right)[#table(columns: (auto, auto), align: (left, right), stroke: none, inset: 2pt,
  [Valoarea situației (fără TVA):], [#d.valoare lei],
  [TVA #d.tva_pct%:], [#d.tva lei],
  [Reținere de garanție #d.garantie_pct% (#d.garantie_baza):], [− #d.retinere lei],
  [*De plată:*], [*#d.de_plata lei*],
)]
#v(18pt)
#grid(columns: (1fr, 1fr), [Executant, \ semnătura și ștampila], [Beneficiar, \ semnătura și ștampila])
"#;

/// The PDF of a statement; `data` is the JSON of the template's fields (all strings).
pub fn render(data: &serde_json::Value) -> Result<Vec<u8>, String> {
    let mut dict = Dict::new();
    dict.insert("data".into(), data.to_string().into_value());
    let id = FileId::new(RootedPath::new(
        VirtualRoot::Project,
        VirtualPath::new("/situatie.typ").map_err(|e| format!("{e:?}"))?,
    ));
    let world = StatementWorld {
        library: LazyHash::new(Library::builder().with_inputs(dict).build()),
        main: Source::new(id, TEMPLATE.to_string()),
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
