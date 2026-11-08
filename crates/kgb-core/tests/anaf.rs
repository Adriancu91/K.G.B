//! Step 7.4b: company data by CUI from ANAF.
//! - the request body follows the official v9 documentation (number CUI, day),
//!   at most 100 CUIs, wrong CUIs refused before anything is sent;
//! - the answer is read as documented (fictive data below, same structure);
//! - the ANAF source is added filled in but switched off, once, with the same
//!   id on every PC; it can be used only after the owner switches it on.

use kgb_core::anaf;
use kgb_core::sources;
use kgb_core::workspace::Workspace;
use serde_json::Value;

/// Fictive company, in the structure of the official documentation.
const ANSWER: &str = r#"{
  "cod": 200, "message": "SUCCESS",
  "found": [{
    "date_generale": {
      "cui": 14399840, "data": "2026-11-08", "denumire": "FIRMA DE TEST SRL",
      "adresa": "MUN. CLUJ-NAPOCA, STR. FABRICII, NR.1", "nrRegCom": "J12/345/2001",
      "telefon": "0264000000", "fax": "", "codPostal": "400000", "act": "",
      "stare_inregistrare": "INREGISTRAT din data 01.02.2001", "data_inregistrare": "2001-02-01",
      "cod_CAEN": "4941", "iban": "", "statusRO_e_Factura": true,
      "organFiscalCompetent": "", "forma_de_proprietate": "", "forma_organizare": "", "forma_juridica": ""
    },
    "inregistrare_scop_Tva": { "scpTVA": true, "perioade_TVA": [] },
    "inregistrare_RTVAI": { "statusTvaIncasare": false },
    "stare_inactiv": { "dataInactivare": "", "dataReactivare": "", "dataPublicare": "", "dataRadiere": "", "statusInactivi": false },
    "inregistrare_SplitTVA": { "statusSplitTVA": false },
    "adresa_sediu_social": {
      "sdenumire_Strada": "Str. Fabricii", "snumar_Strada": "1", "sdenumire_Localitate": "Mun. Cluj-Napoca",
      "scod_Localitate": "", "sdenumire_Judet": "CLUJ", "scod_Judet": "12", "scod_JudetAuto": "CJ",
      "stara": "", "sdetalii_Adresa": "Et. 2", "scod_Postal": "400001"
    },
    "adresa_domiciliu_fiscal": {}
  }],
  "notFound": [12345678]
}"#;

#[test]
fn request_body_follows_the_documentation() {
    let b: Value = serde_json::from_str(&anaf::request_body(&["RO14399840"], "2026-11-08").unwrap()).unwrap();
    assert_eq!(b, serde_json::json!([{"cui": 14399840, "data": "2026-11-08"}]));
    assert!(anaf::request_body(&["14399841"], "2026-11-08").unwrap_err().to_string().contains("cifra de control"));
    assert!(anaf::request_body(&[], "2026-11-08").is_err());
    let many = vec!["14399840"; 101];
    assert!(anaf::request_body(&many, "2026-11-08").unwrap_err().to_string().contains("100"));
    assert_eq!(anaf::MIN_INTERVAL_MS, 1000, "one request per second");
}

#[test]
fn answer_is_read() {
    let (found, not_found) = anaf::parse(ANSWER).unwrap();
    assert_eq!(not_found, ["12345678"]);
    let c = &found[0];
    assert_eq!(c.cui, "14399840");
    assert_eq!(c.denumire, "FIRMA DE TEST SRL");
    assert_eq!(c.nr_reg_com, "J12/345/2001");
    assert_eq!(c.sediu, "Str. Fabricii, nr. 1, Et. 2");
    assert_eq!((c.localitate.as_str(), c.judet.as_str(), c.cod_postal.as_str()), ("Mun. Cluj-Napoca", "CLUJ", "400001"));
    assert_eq!(c.telefon, "0264000000");
    assert!(c.platitor_tva && c.e_factura && !c.tva_la_incasare && !c.inactiv && !c.radiat);
    assert_eq!(c.cod_caen, "4941");

    // Without a structured office address, the fiscal address text is used.
    let mut v: Value = serde_json::from_str(ANSWER).unwrap();
    v["found"][0]["adresa_sediu_social"] = serde_json::json!({});
    let (f, _) = anaf::parse(&v.to_string()).unwrap();
    assert_eq!(f[0].sediu, "MUN. CLUJ-NAPOCA, STR. FABRICII, NR.1");

    // Errors from the service and answers that are not JSON are explained.
    assert!(anaf::parse(r#"{"cod":500,"message":"eroare"}"#).unwrap_err().to_string().contains("500"));
    assert!(anaf::parse("<html>").unwrap_err().to_string().contains("JSON"));
    let (f, nf) = anaf::parse(r#"{"cod":200,"found":[],"notFound":[1]}"#).unwrap();
    assert!(f.is_empty() && nf == ["1"]);
}

#[test]
fn source_is_added_switched_off_once() {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    assert!(anaf::usable(ws.store()).unwrap_err().to_string().contains("nu e în"));
    let id = anaf::ensure_source(ws.store_mut()).unwrap();
    assert_eq!(id, anaf::source_id(), "the same id on every PC");
    assert_eq!(anaf::ensure_source(ws.store_mut()).unwrap(), id);
    let all = sources::list(ws.store()).unwrap();
    assert_eq!(all.len(), 1);
    let s = &all[0];
    assert!(!s.activa, "K.G.B. never switches a source on by itself (D-063)");
    assert!(sources::missing_for_activation(s).is_empty(), "filled in: terms, licence, date");
    assert!(anaf::usable(ws.store()).unwrap_err().to_string().contains("oprită"));
    sources::set_active(ws.store_mut(), id, true, "Proprietar").unwrap();
    assert_eq!(anaf::usable(ws.store()).unwrap().id, id);
}
