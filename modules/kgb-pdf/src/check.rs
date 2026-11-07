//! Strict integrity check (spike S4, R18, D-032). Tolerant PDF readers quietly
//! "recover" truncated or altered files (a file cut at 60% shows 10 pages, 4 of
//! them empty), so before any operation the module checks the structure
//! itself. A file that fails is shown read-only, never modified.

use lopdf::{Document, Object};

/// What the module can do with a PDF.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Status {
    /// Structure intact: every operation is allowed. Carries the page count.
    Intact(usize),
    /// Encrypted (with or without password): read-only.
    Encrypted,
    /// Damaged: read-only, with the reason.
    Damaged(String),
}

impl Status {
    pub fn code(&self) -> &'static str {
        match self {
            Status::Intact(_) => "intact",
            Status::Encrypted => "criptat",
            Status::Damaged(_) => "deteriorat",
        }
    }
    pub fn reason(&self) -> String {
        match self {
            Status::Intact(_) => String::new(),
            Status::Encrypted => "PDF criptat: se poate doar citi".into(),
            Status::Damaged(r) => format!("PDF deteriorat: {r}"),
        }
    }
}

const GENERAL_FILTERS: [&[u8]; 4] = [b"FlateDecode", b"LZWDecode", b"ASCIIHexDecode", b"ASCII85Decode"];

fn filters(f: &Object) -> Vec<Vec<u8>> {
    match f {
        Object::Name(n) => vec![n.clone()],
        Object::Array(a) => a.iter().filter_map(|x| x.as_name().ok().map(<[u8]>::to_vec)).collect(),
        _ => vec![],
    }
}

pub fn is_pdf(b: &[u8]) -> bool {
    b.starts_with(b"%PDF-")
}

pub fn check(b: &[u8]) -> Status {
    match structure(b) {
        Ok(doc) => {
            if doc.is_encrypted() || doc.was_encrypted() {
                return Status::Encrypted;
            }
            match content(&doc) {
                Ok(n) => Status::Intact(n),
                Err(e) => Status::Damaged(e),
            }
        }
        Err(e) => Status::Damaged(e),
    }
}

/// Header, end marker, and every cross-reference section (following `/Prev`)
/// pointing exactly at the objects it declares.
fn structure(b: &[u8]) -> Result<Document, String> {
    if !is_pdf(b) {
        return Err("nu începe cu %PDF-".into());
    }
    let tail = String::from_utf8_lossy(&b[b.len().saturating_sub(1024)..]);
    if !tail.trim_end().ends_with("%%EOF") {
        return Err("lipsește marcajul de final (fișier trunchiat?)".into());
    }
    let sx = tail.rfind("startxref").ok_or("lipsește startxref")?;
    let off: usize = tail[sx + 9..]
        .split_whitespace()
        .next()
        .and_then(|x| x.parse().ok())
        .ok_or("startxref invalid")?;
    let mut next = Some(off);
    let mut seen = 0;
    while let Some(o) = next {
        seen += 1;
        if seen > 1000 || o >= b.len() {
            return Err("lanțul de tabele xref este invalid".into());
        }
        let at = &b[o..];
        if at.starts_with(b"xref") {
            let text = String::from_utf8_lossy(at);
            let mut lines = text.lines().skip(1);
            loop {
                let h = lines.next().ok_or("tabel xref neterminat")?.trim();
                if h.is_empty() {
                    continue;
                }
                if h.starts_with("trailer") {
                    break;
                }
                let mut it = h.split_whitespace();
                let (start, count): (usize, usize) = match (
                    it.next().and_then(|x| x.parse().ok()),
                    it.next().and_then(|x| x.parse().ok()),
                ) {
                    (Some(a), Some(c)) => (a, c),
                    _ => return Err("antet xref invalid".into()),
                };
                for k in 0..count {
                    let e = lines.next().ok_or("intrare xref lipsă")?;
                    if e.trim_end().ends_with('n') {
                        let eo: usize = e.get(..10).and_then(|x| x.parse().ok()).ok_or("offset xref invalid")?;
                        let want = format!("{} ", start + k);
                        if eo >= b.len() || !b[eo..].starts_with(want.as_bytes()) {
                            return Err(format!("obiectul {} nu e unde îl declară tabelul xref", start + k));
                        }
                    }
                }
            }
            let tr = &text[text.find("trailer").unwrap_or(0)..];
            let tr = &tr[..tr.find("startxref").unwrap_or(tr.len())];
            next = tr.find("/Prev").and_then(|i| {
                tr[i + 5..]
                    .split_whitespace()
                    .next()?
                    .trim_end_matches(">>")
                    .parse()
                    .ok()
            });
        } else if at.first().is_some_and(u8::is_ascii_digit)
            && String::from_utf8_lossy(&at[..at.len().min(400)]).contains("/XRef")
        {
            next = None; // cross-reference stream: checked by the parser below
        } else {
            return Err("startxref nu indică un tabel xref".into());
        }
    }
    Document::load_mem(b).map_err(|e| format!("structură invalidă: {e}"))
}

/// Every generally-compressed stream decompresses (image codecs are the
/// renderer's business) and there is at least one page.
fn content(doc: &Document) -> Result<usize, String> {
    for (id, o) in &doc.objects {
        if let Object::Stream(st) = o
            && let Ok(f) = st.dict.get(b"Filter")
            && !filters(f).is_empty()
            && filters(f).iter().all(|n| GENERAL_FILTERS.contains(&n.as_slice()))
            && st.decompressed_content().is_err()
        {
            return Err(format!("fluxul {} {} nu se poate decomprima", id.0, id.1));
        }
    }
    match doc.get_pages().len() {
        0 => Err("documentul nu are nicio pagină".into()),
        n => Ok(n),
    }
}
