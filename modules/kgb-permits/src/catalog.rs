//! The catalog of procedures (7.9a, D-088): avize, autorizații and other approvals, each taken from the official
//! pages of the institutions and from legislatie.just.ro, with the address and the day each source was read. The
//! catalog only proposes: a procedure becomes the firm's when the person adds it (`catalog_adauga`), and is then
//! theirs to correct. Fields the sources did not say are empty.

use serde::{Deserialize, Serialize};

const CATALOG: &str = include_str!("../catalog/proceduri.json");

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Cond {
    pub text: String,
    #[serde(default)]
    pub obligatoriu: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Doc {
    pub nume: String,
    #[serde(default)]
    pub obligatoriu: bool,
    #[serde(default)]
    pub nota: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Src {
    pub titlu: String,
    pub url: String,
    pub verificat: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Entry {
    pub cheie: String,
    pub titlu: String,
    pub domeniu: String,
    #[serde(default)]
    pub institutie: String,
    #[serde(default)]
    pub descriere: String,
    #[serde(default)]
    pub conditii: Vec<Cond>,
    #[serde(default)]
    pub documente: Vec<Doc>,
    #[serde(default)]
    pub pasi: Vec<String>,
    #[serde(default)]
    pub taxe: String,
    #[serde(default)]
    pub termen_legal: String,
    #[serde(default)]
    pub temei_legal: String,
    #[serde(default)]
    pub activitati: Vec<String>,
    pub surse: Vec<Src>,
}

/// The procedures of the catalog, in their order.
pub fn entries() -> Vec<Entry> {
    serde_json::from_str(CATALOG).expect("the catalog of procedures is valid JSON")
}

pub fn find(key: &str) -> Option<Entry> {
    entries().into_iter().find(|e| e.cheie == key)
}

/// The oldest day a source of the entry was read (YYYY-MM-DD).
pub fn checked(e: &Entry) -> String {
    e.surse.iter().map(|s| s.verificat.clone()).min().unwrap_or_default()
}

/// Whether the address is of a Romanian public institution or the legislation portal (the catalog's rule).
pub fn official(url: &str) -> bool {
    let Some(rest) = url.strip_prefix("https://").or_else(|| url.strip_prefix("http://")) else {
        return false;
    };
    let host = rest.split(['/', '?', '#']).next().unwrap_or("").to_ascii_lowercase();
    host.ends_with(".gov.ro") || host.ends_with(".ro") && !host.contains("wiki") && !host.contains("blog")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every procedure of the catalog is complete and sourced (D-088).
    #[test]
    fn the_catalog_is_sourced_and_complete() {
        let acts = [
            "comert",
            "constructii",
            "transport",
            "horeca",
            "servicii",
            "productie",
            "agricultura",
            "cabinet",
            "birou",
        ];
        let mut keys = std::collections::BTreeSet::new();
        for e in entries() {
            assert!(keys.insert(e.cheie.clone()), "{} de două ori", e.cheie);
            assert!(
                !e.titlu.trim().is_empty() && e.titlu.chars().count() <= 200,
                "{}: titlul",
                e.cheie
            );
            assert!(
                crate::DOMAINS.contains(&e.domeniu.as_str()),
                "{}: domeniul {}",
                e.cheie,
                e.domeniu
            );
            assert!(!e.institutie.trim().is_empty(), "{}: instituția", e.cheie);
            assert!(!e.surse.is_empty(), "{}: fără surse", e.cheie);
            for s in &e.surse {
                assert!(official(&s.url), "{}: sursa {} nu e oficială", e.cheie, s.url);
                let d = s.verificat.as_bytes();
                assert!(
                    d.len() == 10 && d[4] == b'-' && d[7] == b'-',
                    "{}: data verificării {}",
                    e.cheie,
                    s.verificat
                );
            }
            assert!(
                e.activitati.iter().all(|a| acts.contains(&a.as_str())),
                "{}: activitățile",
                e.cheie
            );
            assert!(e.documente.len() <= 40 && e.pasi.len() <= 30, "{}: prea multe", e.cheie);
            assert!(
                e.documente
                    .iter()
                    .all(|d| !d.nume.trim().is_empty() && d.nume.chars().count() <= 300),
                "{}: un document",
                e.cheie
            );
            assert!(e.pasi.iter().all(|p| p.chars().count() <= 500), "{}: un pas", e.cheie);
            // The limits of the module's schema (manifest.json, collection „proceduri”).
            assert!(
                e.institutie.chars().count() <= 300,
                "{}: instituția e prea lungă",
                e.cheie
            );
            assert!(e.taxe.chars().count() <= 2000, "{}: taxele", e.cheie);
            assert!(
                e.termen_legal.chars().count() <= 300,
                "{}: termenul legal are {} caractere",
                e.cheie,
                e.termen_legal.chars().count()
            );
            assert!(
                e.descriere.chars().count() + e.temei_legal.chars().count() + 20 <= 4000,
                "{}: descrierea",
                e.cheie
            );
            assert!(
                e.surse.len() <= 30 && e.conditii.len() <= 100,
                "{}: prea multe surse sau condiții",
                e.cheie
            );
        }
    }

    #[test]
    fn only_institution_addresses_count_as_official() {
        assert!(official("https://www.onrc.ro/index.php/ro/"));
        assert!(official("https://legislatie.just.ro/Public/DetaliiDocument/1"));
        assert!(official("https://www.igsu.ro/"));
        assert!(!official("https://example.com/"));
        assert!(!official("ftp://anaf.ro/"));
        assert!(!official("https://ro.wikipedia.org/x"));
    }
}
