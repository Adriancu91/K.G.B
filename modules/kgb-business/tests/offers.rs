//! Step 7.4k-1: offers with a validity date — lines and VAT computed like an
//! invoice; an open offer past its date shows "expirata" and cannot be
//! accepted; refused or closed needs a reason; a closed offer stays closed;
//! a copy is a new offer with the same lines; the PDF has the offer's data.

use kgb_business::{Business, ID, offers};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

#[test]
fn offers_expire_close_with_reason_and_copy() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into(), "files.own".into()]).unwrap();
    call(&mut ws, &mm, "settings_save", json!({"firma": {"firma_nume": "Noi SRL", "firma_cui": "RO18547290"}})).unwrap();
    let client = call(&mut ws, &mm, "partner_save", json!({"nume": "Client Ofertă SRL", "tip": "client"})).unwrap();
    // 3 × 120,50 = 361,50 (VAT 75,92 = 361,50 × 21% = 75,915 → 75,92); 1 × 200 = 200 (42); total 679,42.
    let o = call(&mut ws, &mm, "offer_save", json!({"partener": client["id"], "data": "2026-11-09", "valabil_pana": "2026-11-23",
        "linii": [{"descriere": "Montaj", "cantitate": "3", "pret_unitar": "120,50", "cota_tva": 21}, {"descriere": "Transport", "cantitate": "1", "pret_unitar": "200", "cota_tva": 21}]})).unwrap();
    assert_eq!((o["numar"].as_str(), o["total"].as_i64()), (Some("OF 1"), Some(67_942)), "{o}");

    let list = |ws: &mut Workspace, azi: &str| call(ws, &mm, "offers", json!({"azi": azi})).unwrap();
    assert_eq!(list(&mut ws, "2026-11-23")[0]["stare_afisata"], "deschisa", "valid on its last day");
    assert_eq!(list(&mut ws, "2026-11-24")[0]["stare_afisata"], "expirata", "expires by itself");
    // Expired: cannot be accepted, only copied.
    let e = call(&mut ws, &mm, "offer_close", json!({"id": o["id"], "stare": "acceptata", "azi": "2026-11-24"})).unwrap_err();
    assert!(e.to_string().contains("expirat"), "{e}");
    // Refused without a reason: refused.
    assert!(call(&mut ws, &mm, "offer_close", json!({"id": o["id"], "stare": "respinsa", "azi": "2026-11-24"})).is_err());

    // A copy with new dates: a new offer, same lines and totals.
    let c = call(&mut ws, &mm, "offer_copy", json!({"id": o["id"], "data": "2026-11-24", "valabil_pana": "2026-12-08"})).unwrap();
    assert_eq!((c["numar"].as_str(), c["total"].as_i64()), (Some("OF 2"), Some(67_942)));
    assert!(call(&mut ws, &mm, "offer_copy", json!({"id": o["id"], "data": "2026-11-24", "valabil_pana": "2026-11-20"})).is_err(), "valid before its date");
    // The copy is accepted; the old one closed with a reason.
    call(&mut ws, &mm, "offer_close", json!({"id": c["id"], "stare": "acceptata", "azi": "2026-11-25"})).unwrap();
    call(&mut ws, &mm, "offer_close", json!({"id": o["id"], "stare": "inchisa", "motiv": "înlocuită de OF 2", "azi": "2026-11-25"})).unwrap();
    let l = list(&mut ws, "2026-12-30");
    let by = |n: &str| l.as_array().unwrap().iter().find(|x| x["numar_text"] == n).unwrap().clone();
    assert_eq!((by("OF 2")["stare_afisata"].as_str(), by("OF 1")["stare_afisata"].as_str()), (Some("acceptata"), Some("inchisa")), "a closed offer does not expire");
    assert_eq!((by("OF 1")["motiv"].as_str(), by("OF 2")["copie_dupa"].as_str()), (Some("înlocuită de OF 2"), o["id"].as_str()));
    assert!(call(&mut ws, &mm, "offer_close", json!({"id": c["id"], "stare": "respinsa", "motiv": "x", "azi": "2026-11-26"})).is_err(), "closed stays closed");

    // PDF.
    let dest = tmp.path().join("oferta.pdf");
    call(&mut ws, &mm, "offer_pdf", json!({"id": c["id"], "dest": dest})).unwrap();
    let pdf = std::fs::read(&dest).unwrap();
    assert!(pdf.starts_with(b"%PDF"));
    // Bad input.
    assert!(call(&mut ws, &mm, "offer_save", json!({"partener": client["id"], "data": "2026-11-09", "valabil_pana": "2026-11-23", "linii": []})).is_err());
    assert!(call(&mut ws, &mm, "offer_save", json!({"partener": client["id"], "data": "2026-11-09", "valabil_pana": "2026-11-23",
        "linii": [{"descriere": "x", "cantitate": "1", "pret_unitar": "1", "cota_tva": 7}]})).is_err(), "VAT rate not in settings");
    assert_eq!(offers::shown_state("deschisa", "2026-11-23", "2026-11-24"), "expirata");
}
