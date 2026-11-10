//! Company data by CUI from the free public ANAF service (Etapa 7, step 7.4b).
//!
//! Official documentation, read on 8 Nov 2026:
//! <https://static.anaf.ro/static/10/Anaf/Informatii_R/Servicii_web/doc_WS_V9.txt>
//! - `POST https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva`, JSON body
//!   `[{"cui": <number>, "data": "AAAA-LL-ZZ"}, …]`;
//! - at most 100 CUIs in one request and at most 1 request per second;
//! - the answer has `found` (one object per company: `date_generale`,
//!   `inregistrare_scop_Tva`, `inregistrare_RTVAI`, `stare_inactiv`,
//!   `inregistrare_SplitTVA`, `adresa_sediu_social`, `adresa_domiciliu_fiscal`)
//!   and `notFound` (the CUIs not found).
//!
//! This file only builds the request and reads the answer; the network call is
//! made by the app (through `kgb-net`), and only while the ANAF source is
//! switched on in the register of external sources (D-062). K.G.B. adds the
//! source filled in but switched off (D-063): the owner switches it on.

use kgb_store::Store;
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::partners::{cui_digits, cui_valid};
use crate::sources::{self, Source, SourceInput};

pub const ANAF_URL: &str = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";
pub const ANAF_DOC_URL: &str = "https://static.anaf.ro/static/10/Anaf/Informatii_R/Servicii_web/doc_WS_V9.txt";
/// The service's own rule: at most 100 CUIs per request.
pub const MAX_PER_REQUEST: usize = 100;
/// The service's own rule: at most one request per second.
pub const MIN_INTERVAL_MS: u64 = 1000;
const SOURCE_NAME: &str = "ANAF — date firmă după CUI";

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("ANAF", detail)
}

/// What K.G.B. takes from the answer for one company.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct Company {
    pub cui: String,
    pub denumire: String,
    pub nr_reg_com: String,
    /// Registered office, street and number (with details), without town and county.
    pub sediu: String,
    pub localitate: String,
    pub judet: String,
    pub cod_postal: String,
    pub telefon: String,
    pub cod_caen: String,
    pub stare: String,
    pub platitor_tva: bool,
    pub tva_la_incasare: bool,
    pub inactiv: bool,
    pub radiat: bool,
    pub e_factura: bool,
    pub iban: String,
    /// The day the data is for (AAAA-LL-ZZ), as the service answered.
    pub data: String,
}

/// The JSON body for these CUIs on this day (`azi` = AAAA-LL-ZZ).
pub fn request_body(cuis: &[&str], azi: &str) -> CoreResult<String> {
    if cuis.is_empty() {
        return Err(bad("niciun CUI"));
    }
    if cuis.len() > MAX_PER_REQUEST {
        return Err(bad(format!("cel mult {MAX_PER_REQUEST} de CUI-uri într-o cerere")));
    }
    let mut items = Vec::with_capacity(cuis.len());
    for c in cuis {
        if !cui_valid(c) {
            return Err(bad(format!(
                "CUI-ul „{c}” nu e valid (cifra de control nu se potrivește)"
            )));
        }
        let n: u64 = cui_digits(c)
            .parse()
            .map_err(|_| bad(format!("CUI-ul „{c}” nu e un număr")))?;
        items.push(json!({"cui": n, "data": azi}));
    }
    Ok(Value::Array(items).to_string())
}

fn st(v: &Value, k: &str) -> String {
    match &v[k] {
        Value::String(s) => s.trim().to_string(),
        Value::Number(n) => n.to_string(),
        _ => String::new(),
    }
}
fn flag(v: &Value, k: &str) -> bool {
    match &v[k] {
        Value::Bool(b) => *b,
        Value::String(s) => s.trim().eq_ignore_ascii_case("true"),
        _ => false,
    }
}

/// Street, number and details of an ANAF address block (`p` = "s" or "d").
fn street(a: &Value, p: &str) -> String {
    let mut out = String::new();
    let strada = st(a, &format!("{p}denumire_Strada"));
    let nr = st(a, &format!("{p}numar_Strada"));
    let detalii = st(a, &format!("{p}detalii_Adresa"));
    if !strada.is_empty() {
        out.push_str(&strada);
    }
    if !nr.is_empty() {
        if !out.is_empty() {
            out.push_str(", ");
        }
        out.push_str("nr. ");
        out.push_str(&nr);
    }
    if !detalii.is_empty() {
        if !out.is_empty() {
            out.push_str(", ");
        }
        out.push_str(&detalii);
    }
    out
}

/// Reads the service's answer. Returns the companies found and the CUIs not found.
pub fn parse(answer: &str) -> CoreResult<(Vec<Company>, Vec<String>)> {
    let v: Value =
        serde_json::from_str(answer).map_err(|_| bad("răspunsul nu e JSON (serviciul poate fi indisponibil)"))?;
    if let Some(cod) = v["cod"].as_i64()
        && cod != 200
    {
        let msg = st(&v, "message");
        return Err(bad(format!(
            "serviciul a răspuns cu codul {cod}{}",
            if msg.is_empty() {
                String::new()
            } else {
                format!(": {msg}")
            }
        )));
    }
    let found = v["found"]
        .as_array()
        .ok_or_else(|| bad("răspunsul nu are lista „found”"))?;
    let mut out = Vec::with_capacity(found.len());
    for f in found {
        let g = &f["date_generale"];
        let s = &f["adresa_sediu_social"];
        let d = &f["adresa_domiciliu_fiscal"];
        // The registered office; when ANAF has no structured office address,
        // the fiscal address it gives as text.
        let mut sediu = street(s, "s");
        let mut localitate = st(s, "sdenumire_Localitate");
        let mut judet = st(s, "sdenumire_Judet");
        let mut cod_postal = st(s, "scod_Postal");
        if sediu.is_empty() && localitate.is_empty() {
            sediu = street(d, "d");
            localitate = st(d, "ddenumire_Localitate");
            judet = st(d, "ddenumire_Judet");
            cod_postal = st(d, "dcod_Postal");
        }
        if sediu.is_empty() && localitate.is_empty() {
            sediu = st(g, "adresa");
        }
        if cod_postal.is_empty() {
            cod_postal = st(g, "codPostal");
        }
        let inactiv = &f["stare_inactiv"];
        out.push(Company {
            cui: st(g, "cui"),
            denumire: st(g, "denumire"),
            nr_reg_com: st(g, "nrRegCom"),
            sediu,
            localitate,
            judet,
            cod_postal,
            telefon: st(g, "telefon"),
            cod_caen: st(g, "cod_CAEN"),
            stare: st(g, "stare_inregistrare"),
            platitor_tva: flag(&f["inregistrare_scop_Tva"], "scpTVA"),
            tva_la_incasare: flag(&f["inregistrare_RTVAI"], "statusTvaIncasare"),
            inactiv: flag(inactiv, "statusInactivi"),
            radiat: !st(inactiv, "dataRadiere").is_empty(),
            e_factura: flag(g, "statusRO_e_Factura"),
            iban: st(g, "iban"),
            data: st(g, "data"),
        });
    }
    let not_found = v["notFound"]
        .as_array()
        .map(|a| {
            a.iter()
                .map(|x| match x {
                    Value::String(s) => s.clone(),
                    other => other.to_string(),
                })
                .collect()
        })
        .unwrap_or_default();
    Ok((out, not_found))
}

/// The same id on every PC (UUID v5 of the service address).
pub fn source_id() -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_URL, ANAF_URL.as_bytes())
}

/// The ANAF source in the register, if there is one (found by its address).
pub fn source(store: &Store) -> CoreResult<Option<Source>> {
    Ok(sources::list(store)?.into_iter().find(|s| s.url == ANAF_URL))
}

/// Adds the ANAF source, filled in but switched off, when the register has
/// none yet. Nothing changes when it exists (also when the owner edited it).
pub fn ensure_source(store: &mut Store) -> CoreResult<Uuid> {
    if let Some(s) = source(store)? {
        return Ok(s.id);
    }
    sources::add_fixed(
        store,
        source_id(),
        SourceInput {
            id: None,
            nume: SOURCE_NAME.into(),
            url: ANAF_URL.into(),
            tip: "oficial".into(),
            termeni: "Serviciu web public și gratuit al ANAF (date din registrele publice: plătitori de TVA, TVA la încasare, inactivi, plată defalcată, RO e-Factura). Reguli din documentația oficială: cel mult 100 de CUI-uri într-o cerere și cel mult o cerere pe secundă; suprasolicitarea serverului se sancționează. K.G.B. trimite doar CUI-ul și data și respectă aceste limite.".into(),
            termeni_url: ANAF_DOC_URL.into(),
            licenta: "date publice ANAF, folosite cu menționarea sursei".into(),
            verificat: "2026-11-08".into(),
            note: "Adăugată de K.G.B. completată, dar oprită: o pornește proprietarul (D-063).".into(),
            version: 0,
        },
    )
}

/// The ANAF source, only when it is switched on; otherwise why not.
pub fn usable(store: &Store) -> CoreResult<Source> {
    match source(store)? {
        Some(s) if s.activa => Ok(s),
        Some(_) => Err(bad(
            "sursa ANAF e oprită; o poți porni din „Surse externe” (sau completezi de mână)",
        )),
        None => Err(bad("sursa ANAF nu e în „Surse externe”")),
    }
}
