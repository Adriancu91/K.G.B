//! Finding invoice fields in text lines (PDF pages) or cells (spreadsheets).
//!
//! Plain rules, no guessing machine: a field is found next to its label
//! ("Total de plată", "Data emiterii", "CUI", …), on the same line or the next
//! ones. Every value carries where it was found and a confidence:
//! - the label was found and the value has the right shape → "de verificat";
//! - an independent check also passes (net + VAT = total; the CUI's control
//!   digit; a real calendar date) → "sigur";
//! - a check fails, or the value was only guessed → "incert".
//!
//! Nothing below "sigur" is imported without the user confirming it.

use serde::Serialize;

/// Where a value came from.
#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Source {
    /// PDF page (1-based) and line (1-based) of the extracted text.
    Pagina { page: u32, line: u32 },
    /// Sheet and cell (A1).
    Celula { sheet: String, cell: String },
}

/// A piece of text with its position.
#[derive(Clone, Debug)]
pub struct Line {
    pub text: String,
    pub source: Source,
}

#[derive(Clone, Debug, Serialize)]
pub struct Field {
    pub key: &'static str,
    pub label: &'static str,
    /// Normalised value: dates as zz.ll.aaaa, amounts with a decimal point.
    pub value: String,
    /// The text as found.
    pub raw: String,
    pub source: Source,
    /// The line (or label + cell) the value was found in.
    pub context: String,
    pub confidence: u8,
    pub level: &'static str,
    pub note: String,
}

pub const SURE: u8 = 90;
pub const CHECK: u8 = 60;

pub fn level(c: u8) -> &'static str {
    if c >= SURE {
        "sigur"
    } else if c >= CHECK {
        "de verificat"
    } else {
        "incert"
    }
}

/// The fields of an invoice, in display order: (key, label, required).
pub const FIELDS: &[(&str, &str, bool)] = &[
    ("numar", "Număr factură", true),
    ("data", "Data emiterii", true),
    ("scadenta", "Scadența", false),
    ("furnizor", "Furnizor", true),
    ("cui_furnizor", "CUI furnizor", false),
    ("client", "Client", false),
    ("total_fara_tva", "Total fără TVA", false),
    ("tva", "TVA", false),
    ("total", "Total de plată", true),
];

/// Lower case, without Romanian diacritics, for matching labels.
pub fn fold(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'ă' | 'â' | 'Ă' | 'Â' => 'a',
            'î' | 'Î' => 'i',
            'ș' | 'ş' | 'Ș' | 'Ş' => 's',
            'ț' | 'ţ' | 'Ț' | 'Ţ' => 't',
            c => c.to_lowercase().next().unwrap_or(c),
        })
        .collect()
}

/// An amount as written in Romania ("1.673,14", "267,14") or with a decimal
/// point ("1673.14", "1,673.14").
pub fn amount(s: &str) -> Option<f64> {
    let t: String = s
        .trim()
        .trim_end_matches("lei")
        .trim()
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect();
    if t.is_empty()
        || !t.chars().all(|c| c.is_ascii_digit() || matches!(c, '.' | ',' | '-'))
        || !t.chars().any(|c| c.is_ascii_digit())
    {
        return None;
    }
    let (dots, commas) = (t.matches('.').count(), t.matches(',').count());
    let norm = match (dots, commas) {
        // "1.673,14" or "1,673.14": the last separator is the decimal one.
        (d, c) if d > 0 && c > 0 => {
            if t.rfind(',') > t.rfind('.') {
                t.replace('.', "").replace(',', ".")
            } else {
                t.replace(',', "")
            }
        }
        // "267,14" → decimal comma; "1,234,567" → thousands.
        (0, 1) => t.replace(',', "."),
        (0, _) => t.replace(',', ""),
        // "1.234.567" → thousands; "12.5" → decimal point.
        (d, 0) if d > 1 => t.replace('.', ""),
        _ => t,
    };
    norm.parse().ok()
}

/// Amounts in a line, in order.
fn amounts(line: &str) -> Vec<(String, f64)> {
    line.split(|c: char| c.is_whitespace() || c == ':' || c == ';')
        .filter(|w| w.chars().any(|c| c.is_ascii_digit()) && !w.contains('%'))
        .filter_map(|w| {
            let w = w.trim_matches(|c: char| !c.is_ascii_digit());
            amount(w).map(|v| (w.to_string(), v))
        })
        .collect()
}

/// A date dd.mm.yyyy (also with / or -) that exists in the calendar.
pub fn date(s: &str) -> Option<(String, String)> {
    // Only at character boundaries: the text has diacritics (several bytes each).
    for (i, _) in s.char_indices() {
        let w = &s[i..];
        let Some(cand) = w.get(..10) else { continue };
        let parts: Vec<&str> = cand.split(['.', '/', '-']).collect();
        if parts.len() != 3 || parts[0].len() != 2 || parts[1].len() != 2 || parts[2].len() != 4 {
            continue;
        }
        let (Ok(d), Ok(m), Ok(y)) = (
            parts[0].parse::<u32>(),
            parts[1].parse::<u32>(),
            parts[2].parse::<u32>(),
        ) else {
            continue;
        };
        let dim = match m {
            1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
            4 | 6 | 9 | 11 => 30,
            2 if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 => 29,
            2 => 28,
            _ => continue,
        };
        if (1..=dim).contains(&d) && (1990..=2100).contains(&y) {
            return Some((cand.to_string(), format!("{d:02}.{m:02}.{y}")));
        }
    }
    None
}

/// The Romanian fiscal code's control digit (key 753217532).
pub fn cui_valid(cui: &str) -> bool {
    let digits: String = cui
        .trim()
        .trim_start_matches(['R', 'O', 'r', 'o'])
        .chars()
        .filter(char::is_ascii_digit)
        .collect();
    if !(2..=10).contains(&digits.len()) || digits.chars().all(|c| c == '0') {
        return false;
    }
    let (body, control) = digits.split_at(digits.len() - 1);
    let key = b"753217532";
    let padded = format!("{body:0>9}");
    let sum: u32 = padded
        .bytes()
        .zip(key)
        .map(|(d, k)| u32::from(d - b'0') * u32::from(k - b'0'))
        .sum();
    let c = (sum * 10) % 11 % 10;
    control.parse::<u32>() == Ok(c)
}

fn field(
    key: &'static str,
    value: String,
    raw: String,
    at: &Line,
    context: String,
    confidence: u8,
    note: &str,
) -> Field {
    let label = FIELDS.iter().find(|f| f.0 == key).map(|f| f.1).unwrap_or(key);
    Field {
        key,
        label,
        value,
        raw,
        source: at.source.clone(),
        context,
        confidence,
        level: level(confidence),
        note: note.into(),
    }
}

/// The row of a cell reference ("F22" → 22).
fn row_of(cell: &str) -> &str {
    cell.trim_start_matches(|c: char| c.is_ascii_alphabetic())
}

/// Where a label's value may be: on PDF pages the next lines; in a sheet only
/// the next cells to the right on the same row (a column header is not a
/// label for the values under it).
fn followers(lines: &[Line], i: usize) -> impl Iterator<Item = &Line> {
    let here = &lines[i].source;
    lines[i + 1..]
        .iter()
        .take_while(move |l| match (here, &l.source) {
            (Source::Celula { sheet: s1, cell: c1 }, Source::Celula { sheet: s2, cell: c2 }) => {
                s1 == s2 && row_of(c1) == row_of(c2)
            }
            _ => true,
        })
        .take(2)
}

/// The text after a label on its line, or on the next non-empty line (cell).
fn after(lines: &[Line], i: usize, label_end: usize) -> Option<(&Line, String)> {
    let rest = lines[i].text[label_end..]
        .trim_start_matches([':', ' ', '.'])
        .trim()
        .to_string();
    if !rest.is_empty() {
        return Some((&lines[i], rest));
    }
    followers(lines, i)
        .find(|l| !l.text.trim().is_empty())
        .map(|l| (l, l.text.trim().to_string()))
}

/// Byte offset in `text` just after the label found in its folded form.
fn label_end(text: &str, folded_label: &str) -> Option<usize> {
    let f = fold(text);
    let pos = f.find(folded_label)? + folded_label.len();
    // Map the folded offset back: folding keeps one char per char.
    let chars_before = f[..pos].chars().count();
    Some(
        text.char_indices()
            .nth(chars_before)
            .map(|(b, _)| b)
            .unwrap_or(text.len()),
    )
}

/// The amount next to a label: the last amount on the label's line, or the
/// first amount on the next lines.
fn amount_after(lines: &[Line], i: usize, end: usize) -> Option<(&Line, String, f64)> {
    if let Some((raw, v)) = amounts(&lines[i].text[end..]).pop() {
        return Some((&lines[i], raw, v));
    }
    for l in followers(lines, i) {
        if let Some((raw, v)) = amounts(&l.text).into_iter().next() {
            return Some((l, raw, v));
        }
    }
    None
}

pub fn extract(lines: &[Line]) -> Vec<Field> {
    let mut out: Vec<Field> = Vec::new();
    let has = |out: &Vec<Field>, k: &str| out.iter().any(|f| f.key == k);
    for (i, l) in lines.iter().enumerate() {
        let f = fold(&l.text);
        // Invoice number: "factura … nr. X" / "seria X nr. Y" / "număr: X".
        if !has(&out, "numar") && (f.contains("factur") || f.starts_with("numar") || f.starts_with("nr")) {
            for lab in ["nr.", "nr ", "numar", "numarul"] {
                if let Some(e) = label_end(&l.text, lab)
                    && let Some((at, rest)) = after(lines, i, e)
                {
                    let tok: String = rest
                        .split_whitespace()
                        .next()
                        .unwrap_or("")
                        .trim_matches(|c: char| c == ',' || c == ':')
                        .to_string();
                    if tok.chars().any(|c| c.is_ascii_digit()) && tok.len() <= 30 {
                        let conf = if f.contains("factur") { 85 } else { 65 };
                        out.push(field("numar", tok.clone(), tok, at, at.text.trim().into(), conf, ""));
                        break;
                    }
                }
            }
        }
        for (key, labels) in [
            ("data", &["data emiterii", "data facturii", "data:"][..]),
            ("scadenta", &["scadenta", "data scadentei"][..]),
        ] {
            if has(&out, key) {
                continue;
            }
            for lab in labels {
                if let Some(e) = label_end(&l.text, lab)
                    && let Some((at, rest)) = after(lines, i, e)
                    && let Some((raw, norm)) = date(&rest)
                {
                    out.push(field(
                        key,
                        norm,
                        raw,
                        at,
                        at.text.trim().into(),
                        95,
                        "dată existentă în calendar",
                    ));
                    break;
                }
            }
        }
        for (key, labels) in [
            ("furnizor", &["furnizor", "vanzator"][..]),
            ("client", &["client", "cumparator", "beneficiar"][..]),
        ] {
            if has(&out, key) || !labels.iter().any(|lab| f.trim_start().starts_with(lab)) {
                continue;
            }
            let lab = labels
                .iter()
                .find(|lab| f.trim_start().starts_with(*lab))
                .expect("checked");
            if let Some(e) = label_end(&l.text, lab)
                && let Some((at, rest)) = after(lines, i, e)
            {
                let name = rest.split(',').next().unwrap_or("").trim().to_string();
                if !name.is_empty() {
                    // Names cannot be checked independently: always confirmed by the user.
                    out.push(field(
                        key,
                        name.clone(),
                        name,
                        at,
                        at.text.trim().into(),
                        75,
                        "nume: se confirmă de utilizator",
                    ));
                }
                if key == "furnizor" && !has(&out, "cui_furnizor") {
                    let chars: Vec<char> = rest.chars().collect();
                    let fr: Vec<char> = fold(&rest).chars().collect();
                    let frs: String = fr.iter().collect();
                    let at_char = ["cui", "cif", "cod fiscal"]
                        .iter()
                        .find_map(|k| frs.find(k).map(|p| frs[..p].chars().count() + k.chars().count()));
                    if let Some(start) = at_char {
                        let tail: String = chars[start.min(chars.len())..].iter().collect();
                        let tok: String = tail
                            .trim_start_matches([':', ' '])
                            .split([',', ' '])
                            .next()
                            .unwrap_or("")
                            .to_string();
                        if !tok.is_empty() {
                            let ok = cui_valid(&tok);
                            let note = if ok {
                                "cifra de control corectă"
                            } else {
                                "cifra de control NU se potrivește"
                            };
                            out.push(field(
                                "cui_furnizor",
                                tok.clone(),
                                tok,
                                at,
                                at.text.trim().into(),
                                if ok { 95 } else { 40 },
                                note,
                            ));
                        }
                    }
                }
            }
        }
        for (key, labels, exclude) in [
            (
                "total_fara_tva",
                &["total fara tva", "valoare fara tva", "total net"][..],
                &[][..],
            ),
            (
                "total",
                &["total de plata", "total plata", "total factura", "de plata"][..],
                &[][..],
            ),
            (
                "tva",
                &["tva"][..],
                &["fara tva", "cota tva", "cu tva", "platitor de tva", "neplatitor"][..],
            ),
        ] {
            if has(&out, key) || exclude.iter().any(|x| f.contains(x)) {
                continue;
            }
            if key == "tva" && !f.trim_start().starts_with("tva") && !f.trim_start().starts_with("total tva") {
                continue;
            }
            for lab in labels {
                if let Some(e) = label_end(&l.text, lab)
                    && let Some((at, raw, v)) = amount_after(lines, i, e)
                {
                    out.push(field(
                        key,
                        format!("{v:.2}"),
                        raw,
                        at,
                        format!("{} … {}", l.text.trim(), at.text.trim()),
                        80,
                        "",
                    ));
                    break;
                }
            }
        }
    }
    cross_check(&mut out);
    out
}

/// Net + VAT must equal the total: if they do, all three are sure; if not,
/// all three are uncertain.
fn cross_check(out: &mut [Field]) {
    let get = |out: &[Field], k: &str| {
        out.iter()
            .find(|f| f.key == k)
            .and_then(|f| f.value.parse::<f64>().ok())
    };
    if let (Some(n), Some(t), Some(total)) = (get(out, "total_fara_tva"), get(out, "tva"), get(out, "total")) {
        let ok = (n + t - total).abs() < 0.015;
        for f in out
            .iter_mut()
            .filter(|f| ["total_fara_tva", "tva", "total"].contains(&f.key))
        {
            if ok {
                f.confidence = 98;
                f.note = "verificat: total fără TVA + TVA = total".into();
            } else {
                f.confidence = 45;
                f.note = format!("NU se potrivește: {n:.2} + {t:.2} ≠ {total:.2}");
            }
            f.level = level(f.confidence);
        }
    }
}
