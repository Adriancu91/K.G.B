//! Register of external sources and licences (Etapa 7, step 7.1; D-062,
//! D-063; Master Plan §13: "every piece of external information has a
//! source, a date and terms of use").
//!
//! - Every source a module may read from the outside world — a news feed, a
//!   quotes API, an official page with rules — is a record here: name, link,
//!   kind, terms of use (text and/or link), licence, the date its terms were
//!   last checked, and who approved it.
//! - A source can be **active** only with terms of use, a licence and a
//!   verification date. Only active sources reach modules; a source switched
//!   off is no longer used by any module.
//! - K.G.B. ships with no active source (D-063): the user adds and approves
//!   them. In an organization the register travels to every PC, and only
//!   administrators change it (like roles).

use kgb_store::{Fields, RecordState, Store, Write};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::workspace::{now_ms, validate_name};

pub const SOURCES_COLLECTION: &str = "core.sources";

/// What kind of source.
pub const KINDS: &[(&str, &str)] = &[
    ("rss", "flux de știri RSS/Atom"),
    ("api", "API de date (de ex. cotații)"),
    ("oficial", "pagină sau document oficial (lege, instituție)"),
    ("altul", "altă sursă"),
];

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Source {
    pub id: Uuid,
    pub nume: String,
    pub url: String,
    pub tip: String,
    /// Terms of use, as text (short summary) and/or a link to them.
    pub termeni: String,
    pub termeni_url: String,
    pub licenta: String,
    /// The day the terms were last checked (YYYY-MM-DD).
    pub verificat: String,
    pub activa: bool,
    /// Who switched it on (name), empty while inactive.
    pub aprobata_de: String,
    pub note: String,
    pub version: u64,
}

/// What the screen sends.
#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SourceInput {
    #[serde(default)]
    pub id: Option<Uuid>,
    pub nume: String,
    pub url: String,
    pub tip: String,
    #[serde(default)]
    pub termeni: String,
    #[serde(default)]
    pub termeni_url: String,
    #[serde(default)]
    pub licenta: String,
    #[serde(default)]
    pub verificat: String,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub version: u64,
}

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("sursa", detail)
}

fn s(f: &Fields, k: &str) -> String {
    f.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn from(r: &RecordState) -> Source {
    let f = &r.fields;
    Source {
        id: r.id,
        nume: s(f, "nume"),
        url: s(f, "url"),
        tip: s(f, "tip"),
        termeni: s(f, "termeni"),
        termeni_url: s(f, "termeni_url"),
        licenta: s(f, "licenta"),
        verificat: s(f, "verificat"),
        activa: f.get("activa").and_then(Value::as_bool).unwrap_or(false),
        aprobata_de: s(f, "aprobata_de"),
        note: s(f, "note"),
        version: r.version,
    }
}

fn web_link(what: &str, url: &str, required: bool) -> CoreResult<String> {
    let u = url.trim();
    if u.is_empty() && !required {
        return Ok(String::new());
    }
    if !(u.starts_with("https://") || u.starts_with("http://")) || u.len() > 2000 || u.chars().any(char::is_whitespace)
    {
        return Err(bad(format!("{what} trebuie să fie o adresă web (https://…)")));
    }
    Ok(u.to_string())
}

fn valid_date(d: &str) -> bool {
    let b = d.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && d[..4].parse::<u32>().is_ok()
        && d[5..7].parse::<u32>().is_ok_and(|m| (1..=12).contains(&m))
        && d[8..].parse::<u32>().is_ok_and(|x| (1..=31).contains(&x))
}

fn fields(src: &Source) -> Fields {
    let mut f = Fields::new();
    for (k, v) in [
        ("nume", &src.nume),
        ("url", &src.url),
        ("tip", &src.tip),
        ("termeni", &src.termeni),
        ("termeni_url", &src.termeni_url),
        ("licenta", &src.licenta),
        ("verificat", &src.verificat),
        ("aprobata_de", &src.aprobata_de),
        ("note", &src.note),
    ] {
        f.insert(k.into(), json!(v));
    }
    f.insert("activa".into(), json!(src.activa));
    f.insert("updated_ms".into(), json!(now_ms()));
    f
}

pub fn list(store: &Store) -> CoreResult<Vec<Source>> {
    let mut v: Vec<Source> = store.scan(SOURCES_COLLECTION, |_| true)?.iter().map(from).collect();
    v.sort_by(|a, b| (!a.activa, a.nume.to_lowercase()).cmp(&(!b.activa, b.nume.to_lowercase())));
    Ok(v)
}

pub fn get(store: &Store, id: Uuid) -> CoreResult<Source> {
    store
        .get(SOURCES_COLLECTION, id)?
        .map(|r| from(&r))
        .ok_or_else(|| bad("nu există"))
}

/// What is missing before a source may be switched on (empty = ready).
pub fn missing_for_activation(src: &Source) -> Vec<&'static str> {
    let mut m = Vec::new();
    if src.termeni.trim().is_empty() && src.termeni_url.trim().is_empty() {
        m.push("condițiile de folosire (text sau link)");
    }
    if src.licenta.trim().is_empty() {
        m.push("licența");
    }
    if !valid_date(&src.verificat) {
        m.push("data verificării condițiilor");
    }
    m
}

/// Adds or changes a source. Changing the terms, licence or link of an
/// active source switches it off: it must be approved again.
pub fn save(store: &mut Store, input: SourceInput) -> CoreResult<Uuid> {
    let nume = validate_name("numele sursei", &input.nume)?;
    if !KINDS.iter().any(|(k, _)| *k == input.tip) {
        return Err(bad("tipul nu e cunoscut"));
    }
    let url = web_link("adresa sursei", &input.url, true)?;
    let termeni_url = web_link("linkul condițiilor de folosire", &input.termeni_url, false)?;
    let verificat = input.verificat.trim().to_string();
    if !verificat.is_empty() && !valid_date(&verificat) {
        return Err(bad("data verificării trebuie să fie AAAA-LL-ZZ"));
    }
    let trim = |x: &str, max: usize, what: &str| -> CoreResult<String> {
        let t = x.trim();
        if t.chars().count() > max {
            return Err(bad(format!("{what} are mai mult de {max} de caractere")));
        }
        Ok(t.to_string())
    };
    let mut src = Source {
        id: input.id.unwrap_or_else(Uuid::new_v4),
        nume,
        url,
        tip: input.tip,
        termeni: trim(&input.termeni, 4000, "rezumatul condițiilor")?,
        termeni_url,
        licenta: trim(&input.licenta, 200, "licența")?,
        verificat,
        activa: false,
        aprobata_de: String::new(),
        note: trim(&input.note, 2000, "notele")?,
        version: 0,
    };
    let expected = match input.id {
        Some(id) => {
            let old = get(store, id)?;
            let same_terms = old.url == src.url
                && old.termeni == src.termeni
                && old.termeni_url == src.termeni_url
                && old.licenta == src.licenta
                && old.verificat == src.verificat;
            if old.activa && same_terms {
                src.activa = true;
                src.aprobata_de = old.aprobata_de;
            }
            input.version
        }
        None => 0,
    };
    if list(store)?
        .iter()
        .any(|o| o.id != src.id && o.nume.to_lowercase() == src.nume.to_lowercase())
    {
        return Err(bad(format!("„{}” există deja", src.nume)));
    }
    store.write(vec![
        Write::put(SOURCES_COLLECTION, src.id, fields(&src)).expect(expected),
    ])?;
    Ok(src.id)
}

/// Switches a source on (only with terms, licence and verification date)
/// or off. `by` is who approves it.
pub fn set_active(store: &mut Store, id: Uuid, active: bool, by: &str) -> CoreResult<()> {
    let mut src = get(store, id)?;
    if active {
        let missing = missing_for_activation(&src);
        if !missing.is_empty() {
            return Err(bad(format!("nu poate fi activată fără: {}", missing.join(", "))));
        }
        src.aprobata_de = by.trim().to_string();
    } else {
        src.aprobata_de = String::new();
    }
    src.activa = active;
    store.write(vec![
        Write::put(SOURCES_COLLECTION, id, fields(&src)).expect(src.version),
    ])?;
    Ok(())
}

/// Deletes a source that is switched off.
pub fn delete(store: &mut Store, id: Uuid) -> CoreResult<()> {
    let src = get(store, id)?;
    if src.activa {
        return Err(bad("oprește întâi sursa"));
    }
    store.write(vec![Write::delete(SOURCES_COLLECTION, id).expect(src.version)])?;
    Ok(())
}

/// Active sources of a kind — what modules may use.
pub fn active(store: &Store, kind: Option<&str>) -> CoreResult<Vec<Source>> {
    Ok(list(store)?
        .into_iter()
        .filter(|s| s.activa && kind.is_none_or(|k| s.tip == k))
        .collect())
}

/// One active source, or why a module may not use it.
pub fn usable(store: &Store, id: Uuid) -> CoreResult<Source> {
    let s = get(store, id)?;
    if !s.activa {
        return Err(bad(format!("„{}” e oprită; nu poate fi folosită", s.nume)));
    }
    Ok(s)
}
