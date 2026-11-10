//! InfoNews (Etapa 7, step 7.5): the items of RSS 2.0 and Atom feeds, read only from the sources approved and
//! switched on in „Surse externe” (D-062, kind `rss`). Every item keeps its source, its time and its link; the
//! text is plain (the feed's HTML is reduced to text, never shown as HTML), short and limited in number. Links
//! are kept only when they are http(s).

use quick_xml::Reader;
use quick_xml::events::Event;
use serde::Serialize;

/// At most this many items are taken from one feed.
pub const MAX_ITEMS: usize = 100;
const TITLE_MAX: usize = 300;
const SUMMARY_MAX: usize = 500;
/// Feeds larger than this are not read.
pub const MAX_FEED: usize = 4 * 1024 * 1024;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Item {
    pub titlu: String,
    /// The item's page (http/https only), empty when the feed gave none.
    pub link: String,
    /// The time of the item (ms since 1970, UTC), 0 when the feed gave none or it cannot be read.
    pub ms: i64,
    pub rezumat: String,
    /// The name of the source in the register.
    pub sursa: String,
}

/// HTML (or any markup) reduced to plain text: tags dropped, entities decoded, spaces folded.
pub fn plain(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => {
                in_tag = true;
                out.push(' ');
            }
            '>' if in_tag => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    let decoded = decode_entities(&out);
    decoded.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn decode_entities(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(i) = rest.find('&') {
        out.push_str(&rest[..i]);
        let tail = &rest[i..];
        let end = tail.find(';').filter(|&e| e <= 10);
        let ent = end.map(|e| &tail[1..e]);
        let ch = match ent {
            Some("amp") => Some('&'),
            Some("lt") => Some('<'),
            Some("gt") => Some('>'),
            Some("quot") => Some('"'),
            Some("apos") => Some('\''),
            Some("nbsp") => Some(' '),
            Some(e) if e.starts_with("#x") || e.starts_with("#X") => {
                u32::from_str_radix(&e[2..], 16).ok().and_then(char::from_u32)
            }
            Some(e) if e.starts_with('#') => e[1..].parse::<u32>().ok().and_then(char::from_u32),
            _ => None,
        };
        match (ch, end) {
            (Some(c), Some(e)) => {
                out.push(c);
                rest = &tail[e + 1..];
            }
            _ => {
                out.push('&');
                rest = &tail[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

fn cut(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    let mut t: String = s.chars().take(max).collect();
    t.push('…');
    t
}

fn web_link(s: &str) -> String {
    let t = s.trim();
    let lower = t.to_ascii_lowercase();
    if (lower.starts_with("https://") || lower.starts_with("http://"))
        && t.len() <= 2000
        && !t.chars().any(char::is_whitespace)
    {
        t.to_string()
    } else {
        String::new()
    }
}

fn days(y: i64, m: i64, d: i64) -> i64 {
    let (yy, mm) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
    let era = yy.div_euclid(400);
    let yoe = yy - era * 400;
    let doy = (153 * mm + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// The offset of a zone written as `+0200`, `+02:00`, `Z`, `GMT`, `UT`, `EET`…, in minutes.
fn offset_min(z: &str) -> Option<i64> {
    let z = z.trim();
    match z.to_ascii_uppercase().as_str() {
        "Z" | "GMT" | "UT" | "UTC" => return Some(0),
        "EET" => return Some(120),
        "EEST" => return Some(180),
        "CET" => return Some(60),
        "CEST" => return Some(120),
        "EST" => return Some(-300),
        "EDT" => return Some(-240),
        "PST" => return Some(-480),
        "PDT" => return Some(-420),
        _ => {}
    }
    let (sign, rest) = match z.as_bytes().first()? {
        b'+' => (1, &z[1..]),
        b'-' => (-1, &z[1..]),
        _ => return None,
    };
    let digits: String = rest.chars().filter(char::is_ascii_digit).collect();
    if digits.len() != 4 {
        return None;
    }
    let h: i64 = digits[..2].parse().ok()?;
    let m: i64 = digits[2..].parse().ok()?;
    Some(sign * (h * 60 + m))
}

/// RFC 822 / 1123 dates of RSS: `Tue, 10 Nov 2026 13:05:00 +0200` (the day name may be missing).
pub fn rfc822_ms(s: &str) -> Option<i64> {
    let s = s.trim();
    let s = s.split_once(',').map_or(s, |(_, r)| r).trim();
    let mut it = s.split_whitespace();
    let d: i64 = it.next()?.parse().ok()?;
    let mon = it.next()?.get(..3)?.to_ascii_lowercase();
    let m = [
        "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    ]
    .iter()
    .position(|x| *x == mon)? as i64
        + 1;
    let mut y: i64 = it.next()?.parse().ok()?;
    if y < 100 {
        y += 2000;
    }
    let mut hms = it.next()?.split(':');
    let h: i64 = hms.next()?.parse().ok()?;
    let mi: i64 = hms.next()?.parse().ok()?;
    let se: i64 = hms.next().map_or(Some(0), |x| x.parse().ok())?;
    let off = it.next().map_or(Some(0), offset_min)?;
    if !(1..=31).contains(&d) || h > 23 || mi > 59 || se > 60 {
        return None;
    }
    Some(((days(y, m, d) * 24 + h) * 60 + mi - off) * 60_000 + se * 1000)
}

/// ISO 8601 dates of Atom: `2026-11-10T13:05:00Z`, `…+02:00`, with or without fractions of a second.
pub fn iso_ms(s: &str) -> Option<i64> {
    let s = s.trim();
    let (date, time) = s.split_once(['T', 't', ' '])?;
    let mut dp = date.split('-');
    let y: i64 = dp.next()?.parse().ok()?;
    let m: i64 = dp.next()?.parse().ok()?;
    let d: i64 = dp.next()?.parse().ok()?;
    let zpos = time.find(['Z', 'z', '+', '-']).unwrap_or(time.len());
    let (clock, zone) = time.split_at(zpos);
    let mut hms = clock.split(':');
    let h: i64 = hms.next()?.parse().ok()?;
    let mi: i64 = hms.next()?.parse().ok()?;
    let se: f64 = hms.next().map_or(Some(0.0), |x| x.parse().ok())?;
    let off = if zone.is_empty() { 0 } else { offset_min(zone)? };
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) || h > 23 || mi > 59 {
        return None;
    }
    Some(((days(y, m, d) * 24 + h) * 60 + mi - off) * 60_000 + (se * 1000.0) as i64)
}

#[derive(Default)]
struct Draft {
    title: String,
    link: String,
    date: String,
    summary: String,
}

/// The items of an RSS 2.0 or Atom feed. Refuses a document that is neither.
pub fn parse(xml: &str, source: &str) -> Result<Vec<Item>, String> {
    if xml.len() > MAX_FEED {
        return Err("fluxul e prea mare".into());
    }
    let mut r = Reader::from_str(xml);
    // Not trimmed: „A &amp; B” keeps its spaces; the texts are folded below.
    r.config_mut().trim_text(false);
    let mut out = Vec::new();
    let mut path: Vec<String> = Vec::new();
    let mut cur: Option<Draft> = None;
    let mut kind: Option<&str> = None;
    let mut buf_text = String::new();
    loop {
        let ev = r.read_event().map_err(|e| format!("fluxul nu e XML valid ({e})"))?;
        match ev {
            ev @ (Event::Start(_) | Event::Empty(_)) => {
                let (e, empty) = match ev {
                    Event::Start(e) => (e, false),
                    Event::Empty(e) => (e, true),
                    _ => unreachable!(),
                };
                let name = e.local_name().as_ref().to_ascii_lowercase();
                if path.is_empty() {
                    kind = match name.as_str() {
                        "rss" | "rdf" => Some("rss"),
                        "feed" => Some("atom"),
                        _ => return Err("nu e un flux RSS sau Atom".into()),
                    };
                }
                if name == "item" || name == "entry" {
                    cur = Some(Draft::default());
                }
                // Atom links are attributes: the alternate (or unmarked) one is the page of the entry.
                if name == "link"
                    && kind == Some("atom")
                    && let Some(d) = cur.as_mut()
                {
                    {
                        let mut href = String::new();
                        let mut rel = String::new();
                        for a in e.attributes().flatten() {
                            let v = a
                                .normalized_value(quick_xml::XmlVersion::default())
                                .map(|v| v.into_owned())
                                .unwrap_or_default();
                            match a.key.local_name().as_ref() {
                                "href" => href = v,
                                "rel" => rel = v,
                                _ => {}
                            }
                        }
                        if (rel.is_empty() || rel == "alternate") && d.link.is_empty() {
                            d.link = href;
                        }
                    }
                }
                if !empty {
                    path.push(name);
                }
                buf_text.clear();
            }
            Event::Text(t) => buf_text.push_str(&t.xml10_content()),
            Event::GeneralRef(g) => {
                let r = g.as_ref();
                let c = match r {
                    "amp" => Some('&'),
                    "lt" => Some('<'),
                    "gt" => Some('>'),
                    "quot" => Some('"'),
                    "apos" => Some('\''),
                    _ if r.starts_with("#x") || r.starts_with("#X") => {
                        u32::from_str_radix(&r[2..], 16).ok().and_then(char::from_u32)
                    }
                    _ if r.starts_with('#') => r[1..].parse::<u32>().ok().and_then(char::from_u32),
                    _ => None,
                };
                buf_text.extend(c);
            }
            Event::CData(t) => buf_text.push_str(&t.into_inner()),
            Event::End(_) => {
                let name = path.pop().unwrap_or_default();
                if let Some(d) = cur.as_mut() {
                    let text = std::mem::take(&mut buf_text);
                    match name.as_str() {
                        "title" if d.title.is_empty() => d.title = text,
                        "link" if kind == Some("rss") && d.link.is_empty() => d.link = text.trim().to_string(),
                        "pubdate" | "date" | "updated" | "published" if d.date.is_empty() => {
                            d.date = text.trim().to_string()
                        }
                        "description" | "summary" | "content" | "encoded" if d.summary.is_empty() => d.summary = text,
                        _ => {}
                    }
                }
                if (name == "item" || name == "entry")
                    && let Some(d) = cur.take()
                {
                    {
                        let title = cut(&plain(&d.title), TITLE_MAX);
                        if !title.is_empty() {
                            let ms = rfc822_ms(&d.date).or_else(|| iso_ms(&d.date)).unwrap_or(0);
                            out.push(Item {
                                titlu: title,
                                link: web_link(&d.link),
                                ms,
                                rezumat: cut(&plain(&d.summary), SUMMARY_MAX),
                                sursa: source.to_string(),
                            });
                            if out.len() >= MAX_ITEMS {
                                break;
                            }
                        }
                    }
                }
                buf_text.clear();
            }
            Event::DocType(_) => return Err("fluxul are o declarație DOCTYPE, care nu se acceptă".into()),
            Event::Eof => break,
            _ => {}
        }
    }
    if kind.is_none() {
        return Err("nu e un flux RSS sau Atom".into());
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rss_items_keep_title_link_time_and_plain_text() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Știri</title>
<item><title>Ședința de &amp; azi</title><link>https://example.ro/a?x=1</link>
<pubDate>Tue, 10 Nov 2026 13:05:00 +0200</pubDate>
<description><![CDATA[<p>Text <b>important</b> &amp; scurt</p><script>alert(1)</script>]]></description></item>
<item><title>Fără legătură bună</title><link>javascript:alert(1)</link><pubDate>10 Nov 2026 11:00 GMT</pubDate></item>
<item><title></title><link>https://example.ro/gol</link></item>
</channel></rss>"#;
        let v = parse(xml, "Sursa test").unwrap();
        assert_eq!(v.len(), 2, "the item without a title is left out");
        assert_eq!(v[0].titlu, "Ședința de & azi");
        assert_eq!(v[0].link, "https://example.ro/a?x=1");
        assert_eq!(v[0].ms, iso_ms("2026-11-10T11:05:00Z").unwrap());
        assert!(v[0].rezumat.starts_with("Text important & scurt"), "{}", v[0].rezumat);
        assert!(!v[0].rezumat.contains('<'));
        assert_eq!(v[0].sursa, "Sursa test");
        assert_eq!(v[1].link, "", "a non-web link is dropped");
        assert_eq!(v[1].ms, iso_ms("2026-11-10T11:00:00Z").unwrap());
    }

    #[test]
    fn atom_entries_take_the_alternate_link() {
        let xml = r#"<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
<entry><title type="html">Titlu &lt;i&gt;nou&lt;/i&gt;</title>
<link rel="self" href="https://example.ro/self"/><link rel="alternate" href="https://example.ro/pagina"/>
<updated>2026-11-10T13:05:30.5+02:00</updated><summary>Rezumat</summary></entry></feed>"#;
        let v = parse(xml, "Atom").unwrap();
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].titlu, "Titlu nou");
        assert_eq!(v[0].link, "https://example.ro/pagina");
        assert_eq!(v[0].ms, iso_ms("2026-11-10T11:05:30Z").unwrap() + 500);
        assert_eq!(v[0].rezumat, "Rezumat");
    }

    #[test]
    fn other_documents_and_doctype_are_refused() {
        assert!(parse("<html><body>x</body></html>", "x").is_err());
        assert!(parse("nu e xml <", "x").is_err());
        assert!(parse(r#"<!DOCTYPE rss [<!ENTITY x "y">]><rss><channel/></rss>"#, "x").is_err());
        assert!(parse(&"a".repeat(MAX_FEED + 1), "x").is_err());
    }

    #[test]
    fn many_items_are_cut_and_long_text_shortened() {
        let mut xml = String::from("<rss><channel>");
        for i in 0..150 {
            xml.push_str(&format!(
                "<item><title>T{i}</title><description>{}</description></item>",
                "cuvânt ".repeat(200)
            ));
        }
        xml.push_str("</channel></rss>");
        let v = parse(&xml, "x").unwrap();
        assert_eq!(v.len(), MAX_ITEMS);
        assert!(v[0].rezumat.chars().count() <= SUMMARY_MAX + 1 && v[0].rezumat.ends_with('…'));
    }
}
