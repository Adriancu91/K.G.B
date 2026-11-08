//! Today's weather on the start page (Etapa 7, step 7.4e), from MET Norway's
//! Locationforecast (free, also for commercial use; data under NLOD 2.0 and
//! CC BY 4.0, credit „Date de la MET Norway”). Terms read on 9 Nov 2026:
//! <https://api.met.no/doc/TermsOfService>, <https://api.met.no/doc/License>.
//!
//! - Only while the source is switched on in „Surse externe” (D-062); K.G.B.
//!   adds it filled in but switched off: MET asks that its terms be read and
//!   accepted by a person in charge, which is what switching it on means.
//! - The request names K.G.B. and its public page (MET's rule for the
//!   User-Agent); coordinates have at most 4 decimals; the same town is asked
//!   again only after the time MET gives in `Expires`, and at least 3 hours
//!   apart (MET's rule for places outside the Nordic countries).
//! - MET sees this PC's internet address and the chosen town; nothing else.
//! - This file only reads the answer; the app fetches it.

use kgb_store::Store;
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::sources::{self, Source, SourceInput};

pub const MET_BASE: &str = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
pub const MET_TERMS_URL: &str = "https://api.met.no/doc/TermsOfService";
pub const MET_CREDIT: &str = "Date de la MET Norway (CC BY 4.0)";
/// How MET's rule asks the app to name itself.
pub const USER_AGENT: &str = concat!("KGB/", env!("CARGO_PKG_VERSION"), " github.com/Adriancu91/K.G.B");
/// The same town is not asked again sooner than this (MET: every 3rd hour outside the Nordics).
pub const MIN_REFRESH_SECS: u64 = 3 * 3600;
const SOURCE_NAME: &str = "MET Norway — vremea";

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("vremea", detail)
}

/// County seats and Bucharest: (key, name, latitude, longitude), 4 decimals at most.
pub const TOWNS: &[(&str, &str, &str, &str)] = &[
    ("alba-iulia", "Alba Iulia", "46.0667", "23.5833"),
    ("alexandria", "Alexandria", "43.9833", "25.3333"),
    ("arad", "Arad", "46.1833", "21.3167"),
    ("bacau", "Bacău", "46.5667", "26.9167"),
    ("baia-mare", "Baia Mare", "47.6500", "23.5833"),
    ("bistrita", "Bistrița", "47.1333", "24.5000"),
    ("botosani", "Botoșani", "47.7500", "26.6667"),
    ("braila", "Brăila", "45.2667", "27.9833"),
    ("brasov", "Brașov", "45.6500", "25.6000"),
    ("bucuresti", "București", "44.4325", "26.1039"),
    ("buzau", "Buzău", "45.1500", "26.8333"),
    ("calarasi", "Călărași", "44.2000", "27.3333"),
    ("cluj-napoca", "Cluj-Napoca", "46.7667", "23.5833"),
    ("constanta", "Constanța", "44.1733", "28.6383"),
    ("craiova", "Craiova", "44.3167", "23.8000"),
    ("deva", "Deva", "45.8833", "22.9000"),
    ("drobeta", "Drobeta-Turnu Severin", "44.6333", "22.6500"),
    ("focsani", "Focșani", "45.7000", "27.1833"),
    ("galati", "Galați", "45.4333", "28.0500"),
    ("giurgiu", "Giurgiu", "43.9000", "25.9667"),
    ("iasi", "Iași", "47.1667", "27.6000"),
    ("miercurea-ciuc", "Miercurea Ciuc", "46.3667", "25.8000"),
    ("oradea", "Oradea", "47.0667", "21.9333"),
    ("piatra-neamt", "Piatra Neamț", "46.9333", "26.3667"),
    ("pitesti", "Pitești", "44.8500", "24.8667"),
    ("ploiesti", "Ploiești", "44.9500", "26.0167"),
    ("ramnicu-valcea", "Râmnicu Vâlcea", "45.1000", "24.3667"),
    ("resita", "Reșița", "45.3000", "21.8833"),
    ("satu-mare", "Satu Mare", "47.8000", "22.8833"),
    ("sfantu-gheorghe", "Sfântu Gheorghe", "45.8667", "25.7833"),
    ("sibiu", "Sibiu", "45.8000", "24.1500"),
    ("slatina", "Slatina", "44.4333", "24.3667"),
    ("slobozia", "Slobozia", "44.5667", "27.3667"),
    ("suceava", "Suceava", "47.6500", "26.2500"),
    ("targoviste", "Târgoviște", "44.9333", "25.4500"),
    ("targu-jiu", "Târgu Jiu", "45.0500", "23.2833"),
    ("targu-mures", "Târgu Mureș", "46.5500", "24.5667"),
    ("timisoara", "Timișoara", "45.7500", "21.2333"),
    ("tulcea", "Tulcea", "45.1667", "28.8000"),
    ("vaslui", "Vaslui", "46.6333", "27.7333"),
    ("zalau", "Zalău", "47.1833", "23.0500"),
];

/// The request address for a town key, or why not.
pub fn url_for(town: &str) -> CoreResult<String> {
    let (_, _, lat, lon) = TOWNS.iter().find(|t| t.0 == town).ok_or_else(|| bad(format!("orașul „{town}” nu e în listă")))?;
    Ok(format!("{MET_BASE}?lat={lat}&lon={lon}"))
}

pub fn town_name(town: &str) -> Option<&'static str> {
    TOWNS.iter().find(|t| t.0 == town).map(|t| t.1)
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Today {
    pub oras: String,
    /// Now (the first forecast hour), °C, one decimal as published.
    pub temperatura: f64,
    pub vant_ms: f64,
    /// In words, e.g. „înnorat”, „ploaie slabă”.
    pub cer: String,
    /// Lowest and highest temperature of the rest of today.
    pub minima: f64,
    pub maxima: f64,
    /// Rain in the next 6 hours, mm.
    pub precipitatii_6h: f64,
    /// When MET last updated the forecast (UTC, as published).
    pub actualizat: String,
}

/// MET's symbol code in Romanian ("lightrain_showers_day" → „averse slabe de ploaie”).
pub fn sky(code: &str) -> String {
    let c = code.split('_').next().unwrap_or(code);
    let showers = code.contains("showers");
    let t = match c {
        "clearsky" => "senin",
        "fair" => "în mare parte senin",
        "partlycloudy" => "parțial noros",
        "cloudy" => "înnorat",
        "fog" => "ceață",
        "lightrain" => if showers { "averse slabe de ploaie" } else { "ploaie slabă" },
        "rain" => if showers { "averse de ploaie" } else { "ploaie" },
        "heavyrain" => if showers { "averse puternice" } else { "ploaie puternică" },
        "lightsleet" | "sleet" | "heavysleet" => "lapoviță",
        "lightsnow" => "ninsoare slabă",
        "snow" => "ninsoare",
        "heavysnow" => "ninsoare abundentă",
        _ if c.ends_with("andthunder") => "ploaie cu descărcări electrice",
        _ => "—",
    };
    t.to_string()
}

fn num(v: &Value) -> Option<f64> {
    v.as_f64()
}

/// Reads MET's compact answer. `azi` is today's date (AAAA-LL-ZZ) and
/// `offset_min` the PC's offset from UTC, to know which hours are "today".
pub fn parse(json: &str, town: &str, azi: &str, offset_min: i64) -> CoreResult<Today> {
    let v: Value = serde_json::from_str(json).map_err(|_| bad("răspunsul nu e JSON"))?;
    let series = v["properties"]["timeseries"].as_array().filter(|a| !a.is_empty()).ok_or_else(|| bad("răspunsul nu are prognoza"))?;
    let first = &series[0]["data"];
    let det = &first["instant"]["details"];
    let temperatura = num(&det["air_temperature"]).ok_or_else(|| bad("lipsește temperatura"))?;
    let code = first["next_1_hours"]["summary"]["symbol_code"]
        .as_str()
        .or_else(|| first["next_6_hours"]["summary"]["symbol_code"].as_str())
        .unwrap_or("");
    let (mut lo, mut hi) = (temperatura, temperatura);
    for s in series {
        let Some(t) = s["time"].as_str() else { continue };
        if local_day(t, offset_min).as_deref() != Some(azi) {
            continue;
        }
        if let Some(x) = num(&s["data"]["instant"]["details"]["air_temperature"]) {
            lo = lo.min(x);
            hi = hi.max(x);
        }
    }
    Ok(Today {
        oras: town_name(town).unwrap_or(town).to_string(),
        temperatura,
        vant_ms: num(&det["wind_speed"]).unwrap_or(0.0),
        cer: sky(code),
        minima: lo,
        maxima: hi,
        precipitatii_6h: num(&first["next_6_hours"]["details"]["precipitation_amount"]).unwrap_or(0.0),
        actualizat: v["properties"]["meta"]["updated_at"].as_str().unwrap_or_default().to_string(),
    })
}

/// "2026-11-09T22:00:00Z" + 120 min → "2026-11-10".
fn local_day(utc: &str, offset_min: i64) -> Option<String> {
    let b = utc.as_bytes();
    if b.len() < 16 {
        return None;
    }
    let p = |r: std::ops::Range<usize>| utc.get(r)?.parse::<i64>().ok();
    let (y, m, d, h, mi) = (p(0..4)?, p(5..7)?, p(8..10)?, p(11..13)?, p(14..16)?);
    let mins = h * 60 + mi + offset_min;
    let shift = mins.div_euclid(24 * 60);
    // Days from civil (Howard Hinnant), shifted, back to civil.
    let days = days_from_civil(y, m, d) + shift;
    let (y, m, d) = civil_from_days(days);
    Some(format!("{y:04}-{m:02}-{d:02}"))
}

fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn civil_from_days(z: i64) -> (i64, i64, i64) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// The same id on every PC.
pub fn source_id() -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_URL, MET_BASE.as_bytes())
}

pub fn source(store: &Store) -> CoreResult<Option<Source>> {
    Ok(sources::list(store)?.into_iter().find(|s| s.url == MET_BASE))
}

/// Adds the MET Norway source, filled in but switched off, when there is none.
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
            url: MET_BASE.into(),
            tip: "api".into(),
            termeni: "Serviciu gratuit, fără cont, permis și pentru folosire comercială (FAQ MET). Reguli (Terms of Service, revizuite 5 nov. 2026): aplicația se identifică (nume și pagina ei publică); coordonate cu cel mult 4 zecimale; aceeași cerere nu se repetă înainte de ora din „Expires” și, pentru România, nu mai des de o dată la 3 ore; fără garanții de funcționare; MET vede adresa de internet a PC-ului și orașul ales. Termenii trebuie citiți și acceptați de o persoană cu autoritate în firmă: asta înseamnă pornirea sursei.".into(),
            termeni_url: MET_TERMS_URL.into(),
            licenta: "NLOD 2.0 și CC BY 4.0, cu mențiunea „Date de la MET Norway”".into(),
            verificat: "2026-11-09".into(),
            note: "Adăugată de K.G.B. completată, dar oprită: o pornește proprietarul, după ce citește termenii (D-063).".into(),
            version: 0,
        },
    )
}

pub fn usable(store: &Store) -> CoreResult<Source> {
    match source(store)? {
        Some(s) if s.activa => Ok(s),
        Some(_) => Err(bad("sursa de vreme (MET Norway) e oprită; o poți porni din „Surse externe”, după ce citești termenii")),
        None => Err(bad("sursa de vreme nu e în „Surse externe”")),
    }
}
