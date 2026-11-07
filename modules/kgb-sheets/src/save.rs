//! Saving edits to an XLSX (D-033, spike S5): umya applies the edits and
//! keeps the rest of the file; IronCalc recalculates; the result is compared
//! with the original before anything is saved.
//!
//! Recalculation rule (no library computes every formula exactly like the
//! program that wrote the file — IronCalc matched 95.9% of ordinary formulas):
//! - IronCalc evaluates the original as it is. Formulas where it gets the value
//!   stored in the file are "reliable".
//! - After the edits it evaluates again. A changed formula gets the new value
//!   only if it is reliable; an unreliable one keeps the stored value and is
//!   reported ("uncertain") — the user sees it before saving.
//! - A formula the user typed gets IronCalc's value.

use std::collections::{BTreeMap, BTreeSet};
use std::io::{Cursor, Read};
use std::sync::mpsc;
use std::time::Duration;

use ironcalc::base::cell::CellValue as V;
use serde::{Deserialize, Serialize};

use crate::book::{self, Format};

/// How long a recalculation may take before the save is refused (IronCalc
/// hung on one hostile file in S5). The worker thread is abandoned, not joined.
const CALC_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Edit {
    pub sheet: String,
    /// A1 reference, e.g. "B12".
    pub cell: String,
    /// What the user typed: "=SUM(A1:A3)", "12.5", "12,5", "text", "" (clear).
    pub input: String,
}

#[derive(Debug, Serialize)]
pub struct Outcome {
    #[serde(skip)]
    pub bytes: Vec<u8>,
    pub edited: usize,
    /// Formulas whose value changed after the edits.
    pub recalculated: usize,
    /// Changed by the edits but not reliably computable here: stored value kept.
    pub uncertain: Vec<String>,
    /// Parts of the file the save would drop (charts, images, …).
    pub lost: Vec<String>,
}

pub fn parse_ref(r: &str) -> Result<(u32, u32), String> {
    let r = r.trim().to_ascii_uppercase().replace('$', "");
    let letters: String = r.chars().take_while(char::is_ascii_alphabetic).collect();
    let row: u32 = r[letters.len()..]
        .parse()
        .map_err(|_| format!("„{r}” nu este o celulă (ex. B12)"))?;
    if letters.is_empty() || letters.len() > 3 || row == 0 || row > 1_048_576 {
        return Err(format!("„{r}” nu este o celulă (ex. B12)"));
    }
    let col = letters.bytes().fold(0u32, |a, b| a * 26 + u32::from(b - b'A' + 1));
    if col > 16_384 {
        return Err(format!("„{r}” nu este o celulă"));
    }
    Ok((row, col))
}

pub fn col_name(mut c: u32) -> String {
    let mut s = String::new();
    while c > 0 {
        let r = (c - 1) % 26;
        s.insert(0, (b'A' + r as u8) as char);
        c = (c - 1) / 26;
    }
    s
}

/// A number as typed by a Romanian user: "12,5" or "12.5"; "1.234,5" too.
pub fn parse_number(s: &str) -> Option<f64> {
    let t = s.trim();
    if t.is_empty()
        || t.chars()
            .any(|c| !(c.is_ascii_digit() || matches!(c, '.' | ',' | '-' | '+')))
    {
        return None;
    }
    let norm = if t.contains(',') {
        t.replace('.', "").replace(',', ".")
    } else {
        t.to_string()
    };
    norm.parse().ok()
}

type Key = (u32, i32, i32);

fn same(a: &V, b: &V) -> bool {
    match (a, b) {
        (V::Number(x), V::Number(y)) => (x - y).abs() <= 1e-9 * x.abs().max(1.0),
        (V::None, V::String(s)) | (V::String(s), V::None) => s.is_empty(),
        _ => a == b,
    }
}

/// Formula cells and their values: stored in the file (before evaluating) and
/// as IronCalc computes them on the original and after the edits.
struct Calc {
    stored: BTreeMap<Key, V>,
    original: BTreeMap<Key, V>,
    edited: BTreeMap<Key, V>,
    sheet_ids: BTreeMap<String, u32>,
}

fn calculate(data: Vec<u8>, edits: Vec<Edit>) -> Result<Calc, String> {
    let load = |d: &[u8]| -> Result<ironcalc::base::Model<'static>, String> {
        let wb = ironcalc::import::load_from_xlsx_bytes(d, "document", "en", "UTC").map_err(|e| format!("{e:?}"))?;
        ironcalc::base::Model::from_workbook(wb, "en")
    };
    let formula_cells = |m: &ironcalc::base::Model| -> Vec<Key> {
        m.get_all_cells()
            .into_iter()
            .filter(|c| m.get_cell_formula(c.index, c.row, c.column).ok().flatten().is_some())
            .map(|c| (c.index, c.row, c.column))
            .collect()
    };
    let value = |m: &ironcalc::base::Model, k: &Key| m.get_cell_value_by_index(k.0, k.1, k.2).unwrap_or(V::None);

    let mut a = load(&data)?;
    let sheet_ids: BTreeMap<String, u32> = a
        .get_worksheets_properties()
        .iter()
        .enumerate()
        .map(|(i, p)| (p.name.clone(), i as u32))
        .collect();
    let cells = formula_cells(&a);
    let stored: BTreeMap<Key, V> = cells.iter().map(|k| (*k, value(&a, k))).collect();
    a.evaluate();
    let original: BTreeMap<Key, V> = cells.iter().map(|k| (*k, value(&a, k))).collect();

    let mut b = load(&data)?;
    for e in &edits {
        let sid = *sheet_ids
            .get(&e.sheet)
            .ok_or_else(|| format!("foaia „{}” nu există", e.sheet))?;
        let (r, c) = parse_ref(&e.cell)?;
        let input = parse_number(&e.input).map(book::num).unwrap_or_else(|| e.input.clone());
        b.set_user_input(sid, r as i32, c as i32, input)
            .map_err(|err| format!("{}!{}: {err}", e.sheet, e.cell))?;
    }
    b.evaluate();
    let edited: BTreeMap<Key, V> = formula_cells(&b).iter().map(|k| (*k, value(&b, k))).collect();
    Ok(Calc {
        stored,
        original,
        edited,
        sheet_ids,
    })
}

/// IronCalc in a separate thread with a time limit and panic protection.
fn calculate_guarded(data: &[u8], edits: &[Edit]) -> Result<Calc, String> {
    let (tx, rx) = mpsc::channel();
    let (d, e) = (data.to_vec(), edits.to_vec());
    std::thread::spawn(move || {
        let r = std::panic::catch_unwind(move || calculate(d, e))
            .unwrap_or_else(|_| Err("eroare internă la calcul".into()));
        let _ = tx.send(r);
    });
    rx.recv_timeout(CALC_TIMEOUT)
        .map_err(|_| "recalcularea durează prea mult; registrul nu poate fi modificat aici".to_string())?
}

/// Parts of the package that are easy to lose on save, with their counts.
pub fn features(data: &[u8]) -> BTreeMap<String, usize> {
    let mut m = BTreeMap::new();
    let Ok(mut z) = zip::ZipArchive::new(Cursor::new(data)) else {
        return m;
    };
    let names: Vec<String> = z.file_names().filter_map(|n| n.ok().map(|s| s.to_string())).collect();
    for (key, prefix) in [
        ("grafice", "xl/charts/chart"),
        ("desene", "xl/drawings/drawing"),
        ("imagini", "xl/media/"),
        ("comentarii", "xl/comments"),
        ("tabele", "xl/tables/"),
        ("tabele pivot", "xl/pivotTables/"),
        ("macro-uri", "xl/vbaProject.bin"),
        ("legături către alte fișiere", "xl/externalLinks/"),
    ] {
        let n = names.iter().filter(|x| x.starts_with(prefix)).count();
        if n > 0 {
            m.insert(key.to_string(), n);
        }
    }
    for name in names
        .iter()
        .filter(|n| n.starts_with("xl/worksheets/sheet") || *n == "xl/workbook.xml" || *n == "xl/styles.xml")
    {
        let mut s = String::new();
        if z.by_name(name)
            .ok()
            .and_then(|mut e| e.read_to_string(&mut s).ok())
            .is_none()
        {
            continue;
        }
        for (key, tag) in [
            ("formatare condiționată", "<conditionalFormatting"),
            ("validări", "<dataValidation "),
            ("legături", "<hyperlink "),
            ("celule unite", "<mergeCell "),
            ("nume definite", "<definedName "),
            ("panouri înghețate", "state=\"frozen\""),
            ("filtre", "<autoFilter"),
            ("protecție", "<sheetProtection"),
        ] {
            let n = s.matches(tag).count();
            if n > 0 {
                *m.entry(key.to_string()).or_default() += n;
            }
        }
        // Own number formats only: ids below 164 are the built-in ones every
        // program knows; some programs declare them anyway and the saving
        // library leaves the declaration out, which changes nothing (step 3.11).
        let own = s
            .split("<numFmt ")
            .skip(1)
            .filter(|t| {
                t.split("numFmtId=\"")
                    .nth(1)
                    .and_then(|v| v.split('"').next())
                    .and_then(|v| v.parse::<u32>().ok())
                    .is_some_and(|id| id >= 164)
            })
            .count();
        if own > 0 {
            *m.entry("formate de număr".to_string()).or_default() += own;
        }
    }
    m
}

fn set_result(cell: &mut umya_spreadsheet::Cell, v: &V) {
    match v {
        V::Number(n) => {
            cell.set_formula_result_number(*n);
        }
        V::Boolean(b) => {
            cell.set_formula_result_bool(*b);
        }
        V::String(s) if s.starts_with('#') => match s.parse::<umya_spreadsheet::CellErrorType>() {
            Ok(e) => {
                cell.set_formula_result_error(e);
            }
            Err(_) => {
                cell.set_formula_result_string(s.clone());
            }
        },
        V::String(s) => {
            cell.set_formula_result_string(s.clone());
        }
        V::None => {
            cell.set_formula_result_blank();
        }
    }
}

/// Some programs (for example .NET libraries) write a valid package the
/// editing library cannot follow — it saw 0 sheets in such an owner file
/// (step 3.11): internal links as absolute part names ("/xl/styles.xml") and
/// spreadsheet XML with a namespace prefix ([`without_main_prefix`]). Rewrites
/// both into the equivalent common form; the content is unchanged and the
/// saved result is still checked against the original. `None` when there is
/// nothing to rewrite.
fn normalize_package(data: &[u8]) -> Result<Option<Vec<u8>>, String> {
    use std::io::Write as _;
    let mut z = zip::ZipArchive::new(Cursor::new(data)).map_err(|_| "fișierul este deteriorat".to_string())?;
    let mut parts: Vec<(String, Vec<u8>)> = Vec::new();
    let mut changed = false;
    for i in 0..z.len() {
        let mut e = z.by_index(i).map_err(|_| "fișierul este deteriorat".to_string())?;
        let name = e
            .name()
            .map_err(|_| "fișierul este deteriorat".to_string())?
            .to_string();
        let mut bytes = Vec::new();
        e.read_to_end(&mut bytes)
            .map_err(|_| "fișierul este deteriorat".to_string())?;
        if name.ends_with(".rels") && bytes.windows(9).any(|w| w == b"Target=\"/") {
            // The folder the links are relative to: "xl/_rels/x.rels" → "xl/".
            let base = name.rsplit_once("_rels/").map(|(b, _)| b).unwrap_or("");
            let text = String::from_utf8_lossy(&bytes).to_string();
            let mut out = String::with_capacity(text.len());
            let mut rest = text.as_str();
            while let Some(i) = rest.find("Target=\"/") {
                out.push_str(&rest[..i + 8]);
                let after = &rest[i + 9..];
                let end = after.find('"').unwrap_or(after.len());
                let target = &after[..end];
                // Drop the folders the two paths share, go up for the rest.
                let b: Vec<&str> = base.split('/').filter(|x| !x.is_empty()).collect();
                let t: Vec<&str> = target.split('/').collect();
                let common = b
                    .iter()
                    .zip(&t)
                    .take_while(|(x, y)| x == y)
                    .count()
                    .min(t.len().saturating_sub(1));
                let rel = format!("{}{}", "../".repeat(b.len() - common), t[common..].join("/"));
                out.push_str(&rel);
                rest = &after[end..];
            }
            out.push_str(rest);
            bytes = out.into_bytes();
            changed = true;
        }
        if name.ends_with(".xml")
            && let Some(b) = without_main_prefix(&bytes)
        {
            bytes = b;
            changed = true;
        }
        parts.push((name, bytes));
    }
    if !changed {
        return Ok(None);
    }
    let mut buf = Cursor::new(Vec::new());
    {
        let mut w = zip::ZipWriter::new(&mut buf);
        let o = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        for (name, bytes) in parts {
            w.start_file(name, o).map_err(|e| e.to_string())?;
            w.write_all(&bytes).map_err(|e| e.to_string())?;
        }
        w.finish().map_err(|e| e.to_string())?;
    }
    Ok(Some(buf.into_inner()))
}

const MAIN_NS: &[u8] = b"http://schemas.openxmlformats.org/spreadsheetml/2006/main";

/// Spreadsheet XML written with a namespace prefix (`<x:workbook>`, as .NET
/// libraries do) means exactly the same as without it, but the editing
/// library only recognises the unprefixed form (0 sheets otherwise, step
/// 3.11). Removes the prefix bound to the main spreadsheet namespace.
fn without_main_prefix(xml: &[u8]) -> Option<Vec<u8>> {
    let decl = b"xmlns:";
    let pos = xml.windows(decl.len()).enumerate().find_map(|(i, w)| {
        if w != decl {
            return None;
        }
        let rest = &xml[i + decl.len()..];
        let eq = rest.iter().position(|c| *c == b'=')?;
        let prefix = &rest[..eq];
        let value = rest.get(eq + 2..eq + 2 + MAIN_NS.len())?;
        (value == MAIN_NS
            && rest.get(eq + 1) == Some(&b'"')
            && !prefix.is_empty()
            && prefix.iter().all(u8::is_ascii_alphanumeric))
        .then(|| prefix.to_vec())
    })?;
    let replace = |hay: Vec<u8>, from: &[u8], to: &[u8]| -> Vec<u8> {
        let mut out = Vec::with_capacity(hay.len());
        let mut i = 0;
        while i < hay.len() {
            if hay[i..].starts_with(from) {
                out.extend_from_slice(to);
                i += from.len();
            } else {
                out.push(hay[i]);
                i += 1;
            }
        }
        out
    };
    let p = pos;
    let mut x = replace(xml.to_vec(), &[b"xmlns:".as_slice(), &p, b"=\""].concat(), b"xmlns=\"");
    x = replace(x, &[b"</".as_slice(), &p, b":"].concat(), b"</");
    x = replace(x, &[b"<".as_slice(), &p, b":"].concat(), b"<");
    Some(x)
}

pub fn apply(data: &[u8], edits: &[Edit]) -> Result<Outcome, String> {
    if edits.is_empty() {
        return Err("nu există modificări de salvat".into());
    }
    book::guard(data, Format::Xlsx)?;
    // calamine first: it never crashed on real XLSX files (S5); the other two
    // libraries only see a file it could read.
    let before = book::read(data, Format::Xlsx)?;
    let calc = calculate_guarded(data, edits)?;

    let editable = normalize_package(data)?;
    let mut wb = umya_spreadsheet::reader::xlsx::read_reader(Cursor::new(editable.as_deref().unwrap_or(data)), true)
        .map_err(|e| format!("fișierul nu se poate deschide pentru editare: {e}"))?;
    if wb.sheet_count() != before.sheets.len() {
        return Err("structura fișierului nu poate fi citită complet pentru salvare; folosește „Convertește în .xlsx” sau exportă o copie".into());
    }
    let mut typed: BTreeSet<Key> = BTreeSet::new();
    for e in edits {
        let (r, c) = parse_ref(&e.cell)?;
        let ws = wb
            .sheet_by_name_mut(&e.sheet)
            .map_err(|_| format!("foaia „{}” nu există", e.sheet))?;
        let cell = ws.cell_mut((c, r));
        let input = e.input.trim();
        if let Some(f) = input.strip_prefix('=') {
            cell.set_formula(f.to_string());
            typed.insert((calc.sheet_ids[&e.sheet], r as i32, c as i32));
        } else if input.is_empty() {
            cell.set_value_string(String::new());
        } else if let Some(n) = parse_number(input) {
            cell.set_value_number(n);
        } else if input.eq_ignore_ascii_case("adevărat") || input.eq_ignore_ascii_case("true") {
            cell.set_value_bool(true);
        } else if input.eq_ignore_ascii_case("fals") || input.eq_ignore_ascii_case("false") {
            cell.set_value_bool(false);
        } else {
            cell.set_value_string(e.input.clone());
        }
    }
    let names: BTreeMap<u32, String> = calc.sheet_ids.iter().map(|(n, i)| (*i, n.clone())).collect();
    let (mut recalculated, mut uncertain) = (0, Vec::new());
    for (k, after) in &calc.edited {
        let stored = calc.stored.get(k);
        let original = calc.original.get(k);
        let reliable = matches!((stored, original), (Some(s), Some(o)) if same(s, o));
        let changed = original.is_none_or(|o| !same(o, after));
        let ws = wb.sheet_by_name_mut(&names[&k.0]).map_err(|e| e.to_string())?;
        let cell = ws.cell_mut((k.2 as u32, k.1 as u32));
        if typed.contains(k) || (changed && reliable) {
            set_result(cell, after);
            recalculated += 1;
        } else if changed {
            uncertain.push(format!("{}!{}{}", names[&k.0], col_name(k.2 as u32), k.1));
        }
    }
    let mut out = Vec::new();
    umya_spreadsheet::writer::xlsx::write_writer(&wb, &mut out)
        .map_err(|e| format!("fișierul nu se poate scrie: {e}"))?;

    // The check: the result reopens, every cell not edited and not
    // recalculated keeps its stored value, and every formula is still there.
    let after = book::read(&out, Format::Xlsx).map_err(|e| format!("rezultatul nu trece verificarea: {e}"))?;
    let edited_cells: BTreeSet<(String, u32, u32)> = edits
        .iter()
        .filter_map(|e| parse_ref(&e.cell).ok().map(|(r, c)| (e.sheet.clone(), r, c)))
        .collect();
    let recalculated_cells: BTreeSet<(String, u32, u32)> = calc
        .edited
        .keys()
        .map(|k| (names[&k.0].clone(), k.1 as u32, k.2 as u32))
        .collect();
    for (s, sa) in before.sheets.iter().zip(&after.sheets) {
        if s.name != sa.name {
            return Err("rezultatul nu trece verificarea: foile s-au schimbat".into());
        }
        for (r, c, v) in s.values.used_cells() {
            let key = (
                s.name.clone(),
                r as u32 + s.values.start().unwrap_or((0, 0)).0 + 1,
                c as u32 + s.values.start().unwrap_or((0, 0)).1 + 1,
            );
            if edited_cells.contains(&key) || recalculated_cells.contains(&key) {
                continue;
            }
            let now = sa.values.get_value((key.1 - 1, key.2 - 1));
            if book::show(v) != now.and_then(book::show)
                && !(book::show(v).is_some_and(|x| x.0.is_empty()) && now.is_none())
            {
                return Err(format!(
                    "rezultatul nu trece verificarea: {}!{}{} s-a schimbat",
                    s.name,
                    col_name(key.2),
                    key.1
                ));
            }
        }
        for (r, c, f) in s.formulas.used_cells() {
            let start = s.formulas.start().unwrap_or((0, 0));
            let (row, col) = (r as u32 + start.0, c as u32 + start.1);
            if edited_cells.contains(&(s.name.clone(), row + 1, col + 1)) || f.is_empty() {
                continue;
            }
            let now = sa.formulas.get_value((row, col)).cloned().unwrap_or_default();
            if now.replace(' ', "").to_uppercase() != f.replace(' ', "").to_uppercase() {
                return Err(format!(
                    "rezultatul nu trece verificarea: formula din {}!{}{} s-a schimbat",
                    s.name,
                    col_name(col + 1),
                    row + 1
                ));
            }
        }
    }
    let fb = features(data);
    let fa = features(&out);
    let lost = fb
        .iter()
        .filter(|(k, n)| fa.get(*k).copied().unwrap_or(0) < **n)
        .map(|(k, n)| format!("{k} ({n} → {})", fa.get(k).copied().unwrap_or(0)))
        .collect();
    Ok(Outcome {
        bytes: out,
        edited: edits.len(),
        recalculated,
        uncertain,
        lost,
    })
}
