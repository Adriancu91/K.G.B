//! Free music (8.19, D-098): internet radio stations from Radio Browser, the public community directory of
//! stations that broadcast freely on the internet. The directory is a source in „Surse externe”, added filled in
//! but switched off (D-063). Nothing is read until the person searches or presses play; the app plays a station in
//! a hidden window cut off from K.G.B. (see `app/src-tauri/src/radio.rs`).
//!
//! This file only knows the source, the addresses and the shape of a station; the app does the requests.

use kgb_store::Store;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::sources::{self, Source, SourceInput};

/// The address the source is registered under (the directory's API).
pub const URL: &str = "https://all.api.radio-browser.info";
/// Servers tried in turn (the docs ask not to hard-code one; `all.` answers from any of them).
pub const SERVERS: &[&str] = &["https://all.api.radio-browser.info", "https://de1.api.radio-browser.info"];
pub const TERMS_URL: &str = "https://api.radio-browser.info/";
pub const TERMS: &str = "Radio Browser (citit pe 13 nov. 2026): API-ul e complet gratuit și open source și se poate folosi în programe gratuite și comerciale. Cere un User-Agent care numește programul și semnalarea fiecărui clic pe un post. Fluxurile audio aparțin posturilor de radio, care le transmit liber pe internet.";
pub const LICENCE: &str = "API liber (gratuit, open source); fluxurile aparțin posturilor de radio";
pub const CHECKED: &str = "2026-11-13";
const NAME: &str = "Radio Browser — catalogul posturilor de radio pe internet";

/// At most this many stations per search.
pub const LIMIT: u32 = 40;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Station {
    pub stationuuid: String,
    pub name: String,
    #[serde(default)]
    pub url_resolved: String,
    #[serde(default)]
    pub homepage: String,
    #[serde(default)]
    pub tags: String,
    #[serde(default)]
    pub countrycode: String,
    #[serde(default)]
    pub codec: String,
    #[serde(default)]
    pub bitrate: u32,
    #[serde(default)]
    pub votes: i64,
}

pub fn source_id() -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_URL, URL.as_bytes())
}

pub fn source(store: &Store) -> CoreResult<Option<Source>> {
    Ok(sources::list(store)?.into_iter().find(|s| s.url == URL))
}

/// Adds the directory, filled in but switched off, when it was never in the register.
pub fn ensure_source(store: &mut Store) -> CoreResult<bool> {
    if store.get_any(sources::SOURCES_COLLECTION, source_id())?.is_some() {
        return Ok(false);
    }
    sources::add_fixed(
        store,
        source_id(),
        SourceInput {
            id: None,
            nume: NAME.into(),
            url: URL.into(),
            tip: "api".into(),
            termeni: TERMS.into(),
            termeni_url: TERMS_URL.into(),
            licenta: LICENCE.into(),
            verificat: CHECKED.into(),
            note: "Adăugată de K.G.B. completată, dar oprită: o pornește proprietarul (D-063). Se citește doar la căutare sau la pornirea unui post.".into(),
            version: 0,
        },
    )?;
    Ok(true)
}

pub fn usable(store: &Store) -> CoreResult<Source> {
    match source(store)? {
        Some(s) if s.activa => Ok(s),
        Some(_) => Err(CoreError::invalid("radio", "catalogul de radiouri e oprit; îl poți porni din „Surse externe”")),
        None => Err(CoreError::invalid("radio", "catalogul de radiouri nu e în „Surse externe”")),
    }
}

fn enc(s: &str) -> String {
    let mut o = String::new();
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            o.push(b as char);
        } else {
            o.push_str(&format!("%{b:02X}"));
        }
    }
    o
}

/// The search path: by name when given, else the most voted stations of the country.
pub fn search_path(name: &str, country: &str) -> CoreResult<String> {
    let name: String = name.trim().chars().take(60).collect();
    let country = country.trim().to_ascii_uppercase();
    if !country.is_empty() && (country.len() != 2 || !country.bytes().all(|c| c.is_ascii_uppercase())) {
        return Err(CoreError::invalid("țara", "codul țării are două litere (de ex. RO)"));
    }
    let mut p = format!("/json/stations/search?order=votes&reverse=true&hidebroken=true&limit={LIMIT}");
    if !country.is_empty() {
        p.push_str(&format!("&countrycode={country}"));
    }
    if !name.is_empty() {
        p.push_str(&format!("&name={}", enc(&name)));
    }
    Ok(p)
}

/// The stations of an answer that can be played here: an http(s) stream, a name, a valid id.
pub fn parse(body: &str) -> CoreResult<Vec<Station>> {
    let v: Vec<Station> =
        serde_json::from_str(body).map_err(|_| CoreError::invalid("radio", "răspunsul catalogului nu e citibil"))?;
    Ok(v.into_iter()
        .filter(|s| {
            let u = s.url_resolved.to_ascii_lowercase();
            (u.starts_with("https://") || u.starts_with("http://"))
                && !s.name.trim().is_empty()
                && Uuid::parse_str(&s.stationuuid).is_ok()
        })
        .take(LIMIT as usize)
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paths_are_encoded_and_checked() {
        assert_eq!(
            search_path("", "ro").unwrap(),
            "/json/stations/search?order=votes&reverse=true&hidebroken=true&limit=40&countrycode=RO"
        );
        assert!(search_path("Radio România & co", "RO").unwrap().ends_with("&name=Radio%20Rom%C3%A2nia%20%26%20co"));
        assert!(search_path("x", "ROU").is_err());
        assert!(search_path("x", "R1").is_err());
    }

    #[test]
    fn only_playable_stations() {
        let body = r#"[
          {"stationuuid":"96062a7b-0601-11e8-ae97-52543be04c81","name":"Radio Test","url_resolved":"https://s.example/live.aac","codec":"AAC+","bitrate":128,"votes":5,"countrycode":"RO","tags":"news,talk","homepage":"https://example.ro"},
          {"stationuuid":"x","name":"Fără id","url_resolved":"https://s.example/a"},
          {"stationuuid":"96062a7b-0601-11e8-ae97-52543be04c82","name":"Fără flux","url_resolved":"javascript:alert(1)"}
        ]"#;
        let v = parse(body).unwrap();
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].name, "Radio Test");
        assert!(parse("<html>").is_err());
    }
}
