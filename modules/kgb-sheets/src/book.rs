//! Reading a workbook for display (calamine, D-033) and CSV files, behind the
//! module's own safety check: libraries load a "zip bomb" without any limit
//! (spike S5: up to 625 MB), so the archive is checked first (R19).

use std::io::Cursor;

use calamine::{Data, Range, Reader, open_workbook_auto_from_rs};

pub const MAX_UNPACKED: u64 = 256 * 1024 * 1024;
const MAX_RATIO: u64 = 200;

/// File formats the module understands, from the name and the first bytes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Format {
    Xlsx,
    Xlsm,
    Xls,
    Xlsb,
    Ods,
    Csv,
}

impl Format {
    pub fn from_name(name: &str) -> Option<Format> {
        let ext = name.rsplit_once('.')?.1.to_ascii_lowercase();
        Some(match ext.as_str() {
            "xlsx" => Format::Xlsx,
            "xlsm" => Format::Xlsm,
            "xls" => Format::Xls,
            "xlsb" => Format::Xlsb,
            "ods" => Format::Ods,
            "csv" | "tsv" | "txt" => Format::Csv,
            _ => return None,
        })
    }
    /// Only XLSX is edited (umya + IronCalc); the others are read-only for now.
    pub fn editable(self) -> bool {
        self == Format::Xlsx
    }
    pub fn zipped(self) -> bool {
        matches!(self, Format::Xlsx | Format::Xlsm | Format::Xlsb | Format::Ods)
    }
}

/// The archive check: declared unpacked size and compression ratio, before
/// any library sees the bytes. A password-protected Office file is an OLE
/// container, not a ZIP, and is reported as such.
pub fn guard(data: &[u8], format: Format) -> Result<(), String> {
    if !format.zipped() {
        return Ok(());
    }
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
            return Err("fișierul se dezarhivează în mult prea mult (posibilă „bombă zip”); refuzat".into());
        }
    }
    if total > MAX_UNPACKED {
        return Err(format!(
            "fișierul are {} MB după dezarhivare; limita este {} MB",
            total >> 20,
            MAX_UNPACKED >> 20
        ));
    }
    Ok(())
}

pub struct Sheet {
    pub name: String,
    pub values: Range<Data>,
    pub formulas: Range<String>,
}

impl Sheet {
    /// Size as shown: up to the last used row/column (1-based counts).
    pub fn size(&self) -> (u32, u32) {
        let end = |r: Option<(u32, u32)>| r.map(|(a, b)| (a + 1, b + 1)).unwrap_or((0, 0));
        let (r1, c1) = end(self.values.end());
        let (r2, c2) = end(self.formulas.end());
        (r1.max(r2), c1.max(c2))
    }
}

pub struct Book {
    pub sheets: Vec<Sheet>,
}

pub fn read(data: &[u8], format: Format) -> Result<Book, String> {
    guard(data, format)?;
    if format == Format::Csv {
        return read_csv(data);
    }
    let mut wb = open_workbook_auto_from_rs(Cursor::new(data)).map_err(|e| explain(&e.to_string()))?;
    let mut sheets = Vec::new();
    for name in wb.sheet_names() {
        let values = wb.worksheet_range(&name).map_err(|e| explain(&e.to_string()))?;
        let formulas = wb.worksheet_formula(&name).unwrap_or_default();
        sheets.push(Sheet { name, values, formulas });
    }
    if sheets.is_empty() {
        return Err("registrul nu are nicio foaie".into());
    }
    Ok(Book { sheets })
}

fn explain(e: &str) -> String {
    if e.contains("password") {
        "fișierul este protejat cu parolă".into()
    } else {
        format!("fișierul nu se poate citi: {}", e.chars().take(160).collect::<String>())
    }
}

/// CSV: UTF-8 (with or without BOM) or, if not valid UTF-8, Windows-1250 (the
/// old Romanian code page); separator detected from the first line.
pub fn read_csv(data: &[u8]) -> Result<Book, String> {
    let text = decode(data);
    let first = text.lines().next().unwrap_or("");
    let delim = (*b";,\t")
        .into_iter()
        .max_by_key(|d| first.bytes().filter(|b| b == d).count())
        .unwrap_or(b',');
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .delimiter(delim)
        .from_reader(text.as_bytes());
    let mut rows: Vec<Vec<String>> = Vec::new();
    for rec in rdr.records() {
        let rec = rec.map_err(|e| format!("CSV invalid: {e}"))?;
        rows.push(rec.iter().map(str::to_string).collect());
    }
    let h = rows.len() as u32;
    let w = rows.iter().map(Vec::len).max().unwrap_or(0) as u32;
    let mut values = Range::new((0, 0), (h.saturating_sub(1), w.saturating_sub(1)));
    if h == 0 || w == 0 {
        values = Range::empty();
    }
    for (r, row) in rows.iter().enumerate() {
        for (c, v) in row.iter().enumerate() {
            if !v.is_empty() {
                values.set_value((r as u32, c as u32), Data::String(v.clone()));
            }
        }
    }
    Ok(Book {
        sheets: vec![Sheet {
            name: "CSV".into(),
            values,
            formulas: Range::empty(),
        }],
    })
}

pub fn decode(data: &[u8]) -> String {
    let data = data.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(data);
    match std::str::from_utf8(data) {
        Ok(s) => s.to_string(),
        Err(_) => encoding_rs::WINDOWS_1250.decode(data).0.into_owned(),
    }
}

/// Text shown in a cell, and its kind (n = number, s = text, b = logical,
/// e = error, d = date).
pub fn show(d: &Data) -> Option<(String, char)> {
    Some(match d {
        Data::Empty => return None,
        Data::Int(i) => (i.to_string(), 'n'),
        Data::Float(f) => (num(*f), 'n'),
        Data::String(s) => (s.clone(), 's'),
        Data::Bool(b) => ((if *b { "ADEVĂRAT" } else { "FALS" }).to_string(), 'b'),
        Data::Error(e) => (format!("{e}"), 'e'),
        Data::DateTime(dt) => {
            let f = dt.as_f64();
            if dt.is_datetime() && f >= 1.0 {
                (date(f), 'd')
            } else {
                (num(f), 'n')
            }
        }
        Data::DateTimeIso(s) | Data::DurationIso(s) => (s.clone(), 'd'),
    })
}

/// Serial date (days since 30.12.1899, as spreadsheets count) as zz.ll.aaaa,
/// with hh:mm when there is a time of day.
pub fn date(serial: f64) -> String {
    // Spreadsheets count 1900 as a leap year (serial 60 = the fictitious
    // 29.02.1900), so serials before 61 are one day off from 30.12.1899.
    let whole = serial.floor() as i64;
    let days = if whole < 61 { whole - 25568 } else { whole - 25569 }; // days since 1.1.1970
    // Civil-from-days (H. Hinnant), proleptic Gregorian calendar.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    let mins = ((serial - serial.floor()) * 1440.0).round() as i64;
    if mins == 0 || mins == 1440 {
        format!("{d:02}.{m:02}.{y}")
    } else {
        format!("{d:02}.{m:02}.{y} {:02}:{:02}", mins / 60, mins % 60)
    }
}

pub fn num(f: f64) -> String {
    if f == f.trunc() && f.abs() < 1e15 {
        format!("{}", f as i64)
    } else {
        let s = format!("{f:.10}");
        s.trim_end_matches('0').trim_end_matches('.').to_string()
    }
}
