//! Import/export conversions (Etapa 3, step 3.8): a sheet as CSV, any
//! readable workbook as a new XLSX. Every result is read back and compared
//! cell by cell with the source before it is handed out.

use rust_xlsxwriter::{Format as XFormat, Workbook};

use crate::book::{self, Book, Format, Sheet};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CsvStyle {
    /// What Romanian spreadsheet programs expect: `;` between fields, decimal comma.
    Ro,
    /// `,` between fields, decimal point.
    Standard,
}

/// The text a cell is exported as.
fn text(d: &calamine::Data, style: CsvStyle) -> String {
    match book::show(d) {
        None => String::new(),
        Some((t, 'n')) if style == CsvStyle::Ro => t.replace('.', ","),
        Some((t, 'b')) => (if t == "ADEVĂRAT" { "TRUE" } else { "FALSE" }).to_string(),
        Some((t, _)) => t,
    }
}

/// One sheet as CSV (UTF-8, optionally with the byte-order mark that tells
/// spreadsheet programs it is UTF-8; CRLF line ends). Values, not formulas.
pub fn to_csv(sheet: &Sheet, style: CsvStyle, bom: bool) -> Result<Vec<u8>, String> {
    let (h, w) = sheet.size();
    let mut out = Vec::new();
    if bom {
        out.extend_from_slice(b"\xEF\xBB\xBF");
    }
    let mut wr = csv::WriterBuilder::new()
        .delimiter(if style == CsvStyle::Ro { b';' } else { b',' })
        .terminator(csv::Terminator::CRLF)
        .flexible(true)
        .from_writer(out);
    for r in 0..h {
        let row: Vec<String> = (0..w)
            .map(|c| {
                sheet
                    .values
                    .get_value((r, c))
                    .map(|d| text(d, style))
                    .unwrap_or_default()
            })
            .collect();
        wr.write_record(&row).map_err(|e| e.to_string())?;
    }
    let out = wr.into_inner().map_err(|e| e.to_string())?;

    // The check: read the CSV back; every cell must have the exported text.
    let back = book::read_csv_with(&out, Some(if style == CsvStyle::Ro { b';' } else { b',' }))?;
    let b = &back.sheets[0];
    for r in 0..h {
        for c in 0..w {
            let want = sheet
                .values
                .get_value((r, c))
                .map(|d| text(d, style))
                .unwrap_or_default();
            let got = b
                .values
                .get_value((r, c))
                .and_then(book::show)
                .map(|x| x.0)
                .unwrap_or_default();
            if want != got {
                return Err(format!(
                    "verificarea CSV a eșuat la rândul {}, coloana {}",
                    r + 1,
                    c + 1
                ));
            }
        }
    }
    Ok(out)
}

/// Sheet names allowed in XLSX: at most 31 characters, none of `[]:*?/\`.
fn sheet_name(name: &str, taken: &[String]) -> String {
    let mut n: String = name.chars().filter(|c| !"[]:*?/\\".contains(*c)).take(31).collect();
    if n.trim().is_empty() {
        n = "Foaie".into();
    }
    let base = n.clone();
    let mut k = 2;
    while taken.iter().any(|t| t.eq_ignore_ascii_case(&n)) {
        let suffix = format!(" ({k})");
        n = format!(
            "{}{suffix}",
            base.chars().take(31 - suffix.chars().count()).collect::<String>()
        );
        k += 1;
    }
    n
}

pub struct Converted {
    pub bytes: Vec<u8>,
    /// Formulas of the source written as their values (other formats' formula
    /// syntax is not carried over).
    pub formulas_as_values: usize,
}

/// A readable workbook (CSV, ODS, XLS, XLSB, XLSM, XLSX) as a new XLSX with
/// the same sheets and values. Formulas become their values.
pub fn to_xlsx(src: &Book) -> Result<Converted, String> {
    let mut wb = Workbook::new();
    let date = XFormat::new().set_num_format("dd.mm.yyyy");
    let mut names: Vec<String> = Vec::new();
    let mut formulas = 0;
    for s in &src.sheets {
        let name = sheet_name(&s.name, &names);
        names.push(name.clone());
        let ws = wb.add_worksheet();
        ws.set_name(&name).map_err(|e| e.to_string())?;
        let (h, w) = s.size();
        if w > 16_384 || h > 1_048_576 {
            return Err("foaia depășește limitele formatului .xlsx".into());
        }
        for r in 0..h {
            for c in 0..w {
                if s.formulas.get_value((r, c)).is_some_and(|f| !f.is_empty()) {
                    formulas += 1;
                }
                let Some(d) = s.values.get_value((r, c)) else { continue };
                let (row, col) = (r, c as u16);
                let res = match d {
                    calamine::Data::Empty => continue,
                    calamine::Data::Int(i) => ws.write_number(row, col, *i as f64).map(|_| ()),
                    calamine::Data::Float(f) => ws.write_number(row, col, *f).map(|_| ()),
                    calamine::Data::Bool(b) => ws.write_boolean(row, col, *b).map(|_| ()),
                    calamine::Data::DateTime(dt) if dt.is_datetime() => {
                        ws.write_number_with_format(row, col, dt.as_f64(), &date).map(|_| ())
                    }
                    calamine::Data::DateTime(dt) => ws.write_number(row, col, dt.as_f64()).map(|_| ()),
                    other => {
                        let t = book::show(other).map(|x| x.0).unwrap_or_default();
                        ws.write_string(row, col, t).map(|_| ())
                    }
                };
                res.map_err(|e| e.to_string())?;
            }
        }
    }
    let bytes = wb.save_to_buffer().map_err(|e| e.to_string())?;

    // The check: the new file opens, has the same sheets and, cell by cell,
    // the same values as the source.
    let back = book::read(&bytes, Format::Xlsx).map_err(|e| format!("verificarea a eșuat: {e}"))?;
    if back.sheets.len() != src.sheets.len() {
        return Err("verificarea a eșuat: numărul de foi diferă".into());
    }
    for (a, b) in src.sheets.iter().zip(&back.sheets) {
        let (h, w) = a.size();
        for r in 0..h {
            for c in 0..w {
                let x = a.values.get_value((r, c)).and_then(book::show).map(|v| v.0);
                let y = b.values.get_value((r, c)).and_then(book::show).map(|v| v.0);
                if x.unwrap_or_default() != y.unwrap_or_default() {
                    return Err(format!(
                        "verificarea a eșuat: foaia „{}”, rândul {}, coloana {}",
                        a.name,
                        r + 1,
                        c + 1
                    ));
                }
            }
        }
    }
    Ok(Converted {
        bytes,
        formulas_as_values: formulas,
    })
}

/// A cell of a table built by another module (reports, Etapa 4 step 4.6).
#[derive(Clone, Debug, PartialEq)]
pub enum Cell {
    Text(String),
    Number(f64),
    Empty,
}

impl From<&str> for Cell {
    fn from(s: &str) -> Cell {
        if s.is_empty() {
            Cell::Empty
        } else {
            Cell::Text(s.to_string())
        }
    }
}
impl From<String> for Cell {
    fn from(s: String) -> Cell {
        Cell::from(s.as_str())
    }
}
impl From<usize> for Cell {
    fn from(n: usize) -> Cell {
        Cell::Number(n as f64)
    }
}

/// A sheet made of rows (values only), ready for [`to_xlsx`] / [`to_csv`].
pub fn table(name: &str, rows: &[Vec<Cell>]) -> Sheet {
    let h = rows.len() as u32;
    let w = rows.iter().map(Vec::len).max().unwrap_or(0) as u32;
    let mut values = if h == 0 || w == 0 {
        calamine::Range::empty()
    } else {
        calamine::Range::new((0, 0), (h - 1, w - 1))
    };
    for (r, row) in rows.iter().enumerate() {
        for (c, cell) in row.iter().enumerate() {
            let d = match cell {
                Cell::Text(t) => calamine::Data::String(t.clone()),
                Cell::Number(n) => calamine::Data::Float(*n),
                Cell::Empty => continue,
            };
            values.set_value((r as u32, c as u32), d);
        }
    }
    Sheet {
        name: name.to_string(),
        values,
        formulas: calamine::Range::empty(),
    }
}
