//! Filling a DOCX model (Etapa 4, step 4.8; D-045, spike S6): `{{camp}}` placeholders replaced with values, the
//! rest of the file kept byte for byte.
//!
//! Word often splits a placeholder over several runs (`{{fir` + `ma}}`, after
//! spell-check or a formatting change). The text of each paragraph is read as
//! a whole; a placeholder spread over runs is replaced in its first run and
//! removed from the others, so each run keeps its formatting.

use std::collections::{BTreeMap, BTreeSet};
use std::io::{Cursor, Read, Write};

use quick_xml::events::{BytesStart, BytesText, Event};
use quick_xml::{Reader, Writer};

/// Limits against hostile files (zip bombs).
const MAX_ENTRIES: usize = 5_000;
const MAX_UNPACKED: u64 = 200 * 1024 * 1024;
const MAX_RATIO: u64 = 200;

pub struct Filled {
    pub bytes: Vec<u8>,
    pub replaced: usize,
    /// Placeholders in the model with no value (the document is not produced).
    pub missing: BTreeSet<String>,
    pub parts_changed: Vec<String>,
}

fn is_text_part(name: &str) -> bool {
    name == "word/document.xml"
        || (name.starts_with("word/header") || name.starts_with("word/footer")) && name.ends_with(".xml")
}

pub fn guard(data: &[u8]) -> Result<(), String> {
    let mut z = zip::ZipArchive::new(Cursor::new(data)).map_err(|e| format!("nu este DOCX: {e}"))?;
    if z.len() > MAX_ENTRIES {
        return Err("prea multe părți în fișier".into());
    }
    let mut total = 0u64;
    for i in 0..z.len() {
        let f = z.by_index_raw(i).map_err(|e| e.to_string())?;
        total += f.size();
        if f.compressed_size() > 0 && f.size() / f.compressed_size().max(1) > MAX_RATIO && f.size() > 1_000_000 {
            return Err(format!(
                "parte suspectă (raport de compresie): {}",
                f.name().unwrap_or_default()
            ));
        }
    }
    if total > MAX_UNPACKED {
        return Err("fișierul dezarhivat e prea mare".into());
    }
    if z.by_name("word/document.xml").is_err() {
        return Err("lipsește word/document.xml".into());
    }
    Ok(())
}

pub fn fill(data: &[u8], values: &BTreeMap<String, String>) -> Result<Filled, String> {
    guard(data)?;
    let mut z = zip::ZipArchive::new(Cursor::new(data)).map_err(|e| e.to_string())?;
    let mut out = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let mut replaced = 0;
    let mut missing = BTreeSet::new();
    let mut changed = Vec::new();
    for i in 0..z.len() {
        let name = z
            .by_index_raw(i)
            .map_err(|e| e.to_string())?
            .name()
            .map_err(|e| e.to_string())?
            .to_string();
        if is_text_part(&name) {
            let mut xml = Vec::new();
            z.by_index(i)
                .map_err(|e| e.to_string())?
                .read_to_end(&mut xml)
                .map_err(|e| e.to_string())?;
            let (new_xml, n, miss) = fill_part(&xml, values).map_err(|e| format!("{name}: {e}"))?;
            missing.extend(miss);
            if n > 0 {
                replaced += n;
                changed.push(name.clone());
                let opts =
                    zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
                out.start_file(name, opts).map_err(|e| e.to_string())?;
                out.write_all(&new_xml).map_err(|e| e.to_string())?;
                continue;
            }
        }
        // Untouched parts are copied as they are (compressed bytes included).
        let f = z.by_index_raw(i).map_err(|e| e.to_string())?;
        out.raw_copy_file(f).map_err(|e| e.to_string())?;
    }
    let bytes = out.finish().map_err(|e| e.to_string())?.into_inner();
    Ok(Filled {
        bytes,
        replaced,
        missing,
        parts_changed: changed,
    })
}

/// Placeholder names: letters, digits, `_` and `.` (e.g. `firma.cui`).
pub fn placeholders(text: &str) -> Vec<(usize, usize, String)> {
    let mut out = Vec::new();
    let mut from = 0;
    while let Some(s) = text[from..].find("{{").map(|i| i + from) {
        let Some(e) = text[s + 2..].find("}}").map(|i| i + s + 2) else {
            break;
        };
        let name = text[s + 2..e].trim();
        if !name.is_empty() && name.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '.') && name.len() <= 64 {
            out.push((s, e + 2, name.to_string()));
            from = e + 2;
        } else {
            from = s + 2;
        }
    }
    out
}

type PartResult = (Vec<u8>, usize, BTreeSet<String>);

fn fill_part(xml: &[u8], values: &BTreeMap<String, String>) -> Result<PartResult, String> {
    let mut reader = Reader::from_reader(xml);
    reader.config_mut().trim_text(false);
    let mut events: Vec<Event<'static>> = Vec::new();
    let mut buf = Vec::new();
    loop {
        let ev = reader.read_event_into(&mut buf).map_err(|e| e.to_string())?;
        if matches!(ev, Event::Eof) {
            break;
        }
        events.push(ev.into_owned());
        buf.clear();
        if events.len() > 5_000_000 {
            return Err("prea multe elemente".into());
        }
    }

    // Text nodes inside <w:t> (text and entity references such as &amp;),
    // grouped by paragraph, each with the index of its <w:t> start tag.
    let mut paragraphs: Vec<Vec<(usize, usize)>> = Vec::new();
    let mut cur: Option<Vec<(usize, usize)>> = None;
    let mut t_start: Option<usize> = None;
    for (i, ev) in events.iter().enumerate() {
        match ev {
            Event::Start(s) if s.name().0 == "w:p" => cur = Some(Vec::new()),
            Event::End(e) if e.name().0 == "w:p" => {
                if let Some(p) = cur.take() {
                    paragraphs.push(p);
                }
            }
            Event::Start(s) if s.name().0 == "w:t" => t_start = Some(i),
            Event::End(e) if e.name().0 == "w:t" => t_start = None,
            Event::Text(_) | Event::GeneralRef(_) => {
                if let (Some(p), Some(t)) = (cur.as_mut(), t_start) {
                    p.push((i, t));
                }
            }
            _ => {}
        }
    }

    let mut new_text: BTreeMap<usize, String> = BTreeMap::new();
    let mut changed_t: BTreeSet<usize> = BTreeSet::new();
    let mut count = 0;
    let mut missing = BTreeSet::new();
    for p in paragraphs {
        let texts: Vec<String> = p.iter().map(|(i, _)| node_text(&events[*i])).collect();
        let whole: String = texts.concat();
        let found = placeholders(&whole);
        if found.is_empty() {
            continue;
        }
        // Where each node starts in the paragraph text.
        let mut starts = Vec::with_capacity(texts.len());
        let mut pos = 0;
        for t in &texts {
            starts.push(pos);
            pos += t.len();
        }
        let mut pieces: Vec<String> = texts.clone();
        // Replace from the end so earlier offsets stay valid.
        for (s, e, name) in found.into_iter().rev() {
            let Some(v) = values.get(&name) else {
                missing.insert(name);
                continue;
            };
            count += 1;
            // The node holding the placeholder's first character.
            let first = starts
                .iter()
                .zip(&texts)
                .position(|(st, t)| st + t.len() > s)
                .unwrap_or(0);
            for (k, st) in starts.iter().enumerate() {
                let len = texts[k].len();
                let (a, b) = (s.max(*st), e.min(st + len));
                if a >= b {
                    continue;
                }
                let (ra, rb) = (a - st, b - st);
                let orig = &texts[k];
                // Going from the end, earlier changes to this node are all at
                // or after `rb`: the node's first `rb` bytes are still original.
                let tail = pieces[k][rb..].to_string();
                let head = &orig[..ra];
                pieces[k] = if k == first {
                    format!("{head}{v}{tail}")
                } else {
                    format!("{head}{tail}")
                };
            }
        }
        for (k, (i, t)) in p.iter().enumerate() {
            if pieces[k] != texts[k] {
                new_text.insert(*i, pieces[k].clone());
                changed_t.insert(*t);
            }
        }
    }
    if count == 0 {
        return Ok((xml.to_vec(), 0, missing));
    }

    // Write back; every changed <w:t> gets xml:space="preserve" (spaces kept).
    let mut w = Writer::new(Vec::new());
    for (i, ev) in events.into_iter().enumerate() {
        let ev = if let Some(t) = new_text.remove(&i) {
            Event::Text(BytesText::new(&t).into_owned())
        } else if changed_t.contains(&i) {
            match ev {
                Event::Start(s) if s.name().0 == "w:t" => {
                    let has = s.attributes().flatten().any(|a| a.key.0 == "xml:space");
                    let mut n = BytesStart::new("w:t");
                    n.extend_attributes(s.attributes().flatten());
                    if !has {
                        n.push_attribute(("xml:space", "preserve"));
                    }
                    Event::Start(n.into_owned())
                }
                other => other,
            }
        } else {
            ev
        };
        w.write_event(ev).map_err(|e| e.to_string())?;
    }
    Ok((w.into_inner(), count, missing))
}

/// The text of a text node or entity reference (`amp` → `&`, `#x219` → `ș`).
fn node_text(ev: &Event<'_>) -> String {
    match ev {
        Event::Text(t) => t.xml10_content().into_owned(),
        Event::GeneralRef(r) => {
            let name: String = r.as_ref().to_string();
            match name.as_str() {
                "amp" => "&".into(),
                "lt" => "<".into(),
                "gt" => ">".into(),
                "quot" => "\"".into(),
                "apos" => "'".into(),
                n => {
                    let code = n
                        .strip_prefix("#x")
                        .and_then(|h| u32::from_str_radix(h, 16).ok())
                        .or_else(|| n.strip_prefix('#').and_then(|d| d.parse().ok()));
                    code.and_then(char::from_u32).map(String::from).unwrap_or_default()
                }
            }
        }
        _ => String::new(),
    }
}

/// The visible text of a DOCX (paragraphs joined by newlines), for checks.
pub fn text_of(data: &[u8], part: &str) -> Result<String, String> {
    let mut z = zip::ZipArchive::new(Cursor::new(data)).map_err(|e| e.to_string())?;
    let mut xml = String::new();
    z.by_name(part)
        .map_err(|e| e.to_string())?
        .read_to_string(&mut xml)
        .map_err(|e| e.to_string())?;
    let mut r = Reader::from_str(&xml);
    r.config_mut().trim_text(false);
    let (mut out, mut in_t) = (String::new(), false);
    loop {
        match r.read_event().map_err(|e| e.to_string())? {
            Event::Eof => break,
            Event::Start(s) if s.name().0 == "w:t" => in_t = true,
            Event::End(e) if e.name().0 == "w:t" => in_t = false,
            Event::End(e) if e.name().0 == "w:p" => out.push('\n'),
            ev @ (Event::Text(_) | Event::GeneralRef(_)) if in_t => out.push_str(&node_text(&ev)),
            _ => {}
        }
    }
    Ok(out)
}

/// The `{{fields}}` a model asks for (in the body, headers and footers).
pub fn fields_in(data: &[u8]) -> Result<BTreeSet<String>, String> {
    Ok(fill(data, &BTreeMap::new())?.missing)
}

/// All visible text: headers first, then the body (for previews and checks).
pub fn text(data: &[u8]) -> Result<String, String> {
    let z = zip::ZipArchive::new(Cursor::new(data)).map_err(|e| e.to_string())?;
    let mut parts: Vec<String> = z
        .file_names()
        .filter_map(|n| n.ok().map(|c| c.into_owned()))
        .filter(|n| is_text_part(n))
        .collect();
    parts.sort_by_key(|n| (n == "word/document.xml", n.clone()));
    let mut out = String::new();
    for p in parts {
        out.push_str(&text_of(data, &p)?);
    }
    Ok(out)
}
