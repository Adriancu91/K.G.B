//! Step 7.4e: BNR exchange rates and MET Norway weather.
//! - the BNR XML is read as published (namespace, `<Cube date>`, `<Rate>`,
//!   `multiplier`), rates kept as text and whole ten-thousandths;
//! - MET's compact answer gives now, today's low/high (local day), sky in
//!   Romanian; towns have at most 4 decimals;
//! - both sources are added filled in but switched off, once, same id on
//!   every PC; the start-page town must be one of the list.

use kgb_core::settings::{self, Settings};
use kgb_core::workspace::Workspace;
use kgb_core::{fx, sources, weather};

/// Shape of https://curs.bnr.ro/nbrfxrates.xml (rates from 6 Nov 2026, shortened).
const BNR: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<DataSet xmlns="https://www.bnr.ro/xsd" xmlns:xsi="https://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="https://curs.bnr.ro/xsd/nbrfxrates.xsd"><Header><Publisher>National Bank of Romania</Publisher><PublishingDate>2026-11-06</PublishingDate><MessageType>DR</MessageType></Header><Body><Subject>Reference rates</Subject><OrigCurrency>RON</OrigCurrency><Cube date="2026-11-06"><Rate currency="AED">1.3012</Rate><Rate currency="EUR">5.3408</Rate><Rate currency="HUF" multiplier="100">1.4662</Rate><Rate currency="USD">4.7795</Rate></Cube></Body></DataSet>"#;

#[test]
fn bnr_rates_are_read() {
    let d = fx::parse(BNR).unwrap();
    assert_eq!(d.data, "2026-11-06");
    let eur = d.rate("EUR").unwrap();
    assert_eq!(
        (eur.text.as_str(), eur.zecimi_de_mii, eur.multiplicator),
        ("5.3408", 53408, 1)
    );
    assert_eq!(d.rate("USD").unwrap().zecimi_de_mii, 47795);
    let huf = d.rate("HUF").unwrap();
    assert_eq!(
        (huf.zecimi_de_mii, huf.multiplicator),
        (14662, 100),
        "for 100 HUF, as published"
    );
    assert!(fx::parse("<html>").is_err());
    assert!(fx::parse(r#"<Cube date="2026-11-06"><Rate currency="EUR">5,34</Rate></Cube>"#).is_err());
    assert!(fx::parse(r#"<Cube date="6.11.2026"><Rate currency="EUR">5.3408</Rate></Cube>"#).is_err());
}

/// MET compact structure (fictive values). 22:00Z on 9 Nov is 00:00 on 10 Nov in Romania (UTC+2).
const MET: &str = r#"{"type":"Feature","properties":{"meta":{"updated_at":"2026-11-09T09:12:00Z","units":{"air_temperature":"celsius"}},
 "timeseries":[
  {"time":"2026-11-09T10:00:00Z","data":{"instant":{"details":{"air_temperature":8.4,"wind_speed":3.1}},"next_1_hours":{"summary":{"symbol_code":"lightrain_showers_day"},"details":{"precipitation_amount":0.3}},"next_6_hours":{"summary":{"symbol_code":"rain"},"details":{"precipitation_amount":2.1}}}},
  {"time":"2026-11-09T13:00:00Z","data":{"instant":{"details":{"air_temperature":11.0}}}},
  {"time":"2026-11-09T20:00:00Z","data":{"instant":{"details":{"air_temperature":4.5}}}},
  {"time":"2026-11-09T22:00:00Z","data":{"instant":{"details":{"air_temperature":-1.0}}}}
 ]}}"#;

#[test]
fn met_weather_is_read() {
    let t = weather::parse(MET, "cluj-napoca", "2026-11-09", 120).unwrap();
    assert_eq!(t.oras, "Cluj-Napoca");
    assert_eq!(
        (t.temperatura, t.minima, t.maxima),
        (8.4, 4.5, 11.0),
        "−1 °C is already tomorrow in Romania"
    );
    assert_eq!(t.cer, "averse slabe de ploaie");
    assert_eq!((t.vant_ms, t.precipitatii_6h), (3.1, 2.1));
    assert_eq!(weather::sky("clearsky_night"), "senin");
    assert_eq!(weather::sky("heavyrainandthunder"), "ploaie cu descărcări electrice");
    assert!(weather::parse("{}", "iasi", "2026-11-09", 120).is_err());
    // Towns: at most 4 decimals (MET's rule), the address built from the list only.
    for (_, _, lat, lon) in weather::TOWNS {
        assert!(lat.split('.').nth(1).unwrap().len() <= 4 && lon.split('.').nth(1).unwrap().len() <= 4);
    }
    assert_eq!(
        weather::url_for("iasi").unwrap(),
        format!("{}?lat=47.1667&lon=27.6000", weather::MET_BASE)
    );
    assert!(weather::url_for("atlantida").is_err());
    assert!(weather::USER_AGENT.starts_with("KGB/") && weather::USER_AGENT.contains("github.com/"));
}

#[test]
fn sources_added_switched_off_and_town_checked() {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    assert_eq!(fx::ensure_source(ws.store_mut()).unwrap(), fx::source_id());
    assert_eq!(weather::ensure_source(ws.store_mut()).unwrap(), weather::source_id());
    fx::ensure_source(ws.store_mut()).unwrap();
    let all = sources::list(ws.store()).unwrap();
    assert_eq!(all.len(), 2);
    assert!(
        all.iter()
            .all(|s| !s.activa && sources::missing_for_activation(s).is_empty())
    );
    assert!(fx::usable(ws.store()).unwrap_err().to_string().contains("oprită"));
    assert!(
        weather::usable(ws.store())
            .unwrap_err()
            .to_string()
            .contains("termenii")
    );
    sources::set_active(ws.store_mut(), fx::source_id(), true, "Proprietar").unwrap();
    fx::usable(ws.store()).unwrap();

    let profiles = ["birou"];
    let mut s = Settings::default();
    s.home.vreme = "iasi".into();
    settings::save(ws.store_mut(), &s, 0, &profiles).unwrap();
    s.home.vreme = "atlantida".into();
    assert!(settings::save(ws.store_mut(), &s, 1, &profiles).is_err());
}
