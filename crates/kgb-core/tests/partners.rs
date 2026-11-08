//! Step 7.4a (D-066): the partner directory.
//! - CUI checked with its control digit; the same CUI twice is refused;
//! - work points, documents with dates and extra fields are kept;
//! - suggestions match the start of the name, a word, the CUI or an extra value,
//!   ignoring diacritics;
//! - expiring documents remind 30 and 7 days before, on the day, then weekly,
//!   once each;
//! - modules reach the directory only with `partners.read` / `partners.write`.

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext, ModuleManager};
use kgb_core::notifications;
use kgb_core::partners::{self, ExtraField, Partner, PartnerDoc, WorkPoint, cui_valid};
use kgb_core::workspace::Workspace;
use kgb_core::{CoreError, CoreResult};
use serde_json::{Value, json};

fn card(name: &str, cui: &str) -> Partner {
    Partner {
        tip: "ambele".into(),
        denumire: name.into(),
        cui: cui.into(),
        ..Partner::default()
    }
}

#[test]
fn cui_check_digit() {
    assert!(cui_valid("14399840"));
    assert!(cui_valid("RO14399840"));
    assert!(cui_valid(" ro 14399840 ".replace(' ', "").as_str()));
    assert!(!cui_valid("14399841"), "wrong control digit");
    assert!(!cui_valid("ABC"));
    assert!(!cui_valid("1"));
}

#[test]
fn cards_search_and_duplicates() {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    let mut a = card("Transport Ștefănescu SRL", "RO14399840");
    a.sediu = "Str. Fabricii 1, Cluj".into();
    a.puncte_lucru = vec![WorkPoint { denumire: "Depozit Turda".into(), adresa: "Str. Gării 2".into(), contact: String::new() }];
    a.documente = vec![PartnerDoc {
        tip: "Licență de transport".into(),
        numar: "LT-1234".into(),
        emis: "2025-01-10".into(),
        expira: "2026-12-08".into(),
        nota: String::new(),
    }];
    a.campuri = vec![ExtraField { nume: "Cod client intern".into(), valoare: "C-0042".into() }];
    let id = partners::save(ws.store_mut(), a).unwrap();
    partners::save(ws.store_mut(), card("Alfa Construct SA", "")).unwrap();

    // Refused input.
    assert!(partners::save(ws.store_mut(), card("Copie", "14399840")).unwrap_err().to_string().contains("există deja"));
    assert!(partners::save(ws.store_mut(), card("Greșit", "14399841")).unwrap_err().to_string().contains("cifra de control"));
    let mut bad = card("Doc fără tip", "");
    bad.documente = vec![PartnerDoc { numar: "1".into(), ..PartnerDoc::default() }];
    assert!(partners::save(ws.store_mut(), bad).is_err());
    let mut bad = card("Dată greșită", "");
    bad.documente = vec![PartnerDoc { tip: "Aviz".into(), expira: "8.12.2026".into(), ..PartnerDoc::default() }];
    assert!(partners::save(ws.store_mut(), bad).is_err());

    // Search: start of the name, a word without diacritics, the CUI, an extra value, a work point.
    let names = |q: &str| partners::search(ws.store(), q, 10).unwrap().into_iter().map(|p| p.denumire).collect::<Vec<_>>();
    assert_eq!(names("Tra"), ["Transport Ștefănescu SRL"]);
    assert_eq!(names("stefan"), ["Transport Ștefănescu SRL"], "diacritics ignored");
    assert_eq!(names("1439"), ["Transport Ștefănescu SRL"]);
    assert_eq!(names("C-00"), ["Transport Ștefănescu SRL"]);
    assert_eq!(names("Depozit"), ["Transport Ștefănescu SRL"]);
    assert_eq!(names("alfa"), ["Alfa Construct SA"]);
    assert!(names("zzz").is_empty());

    // Everything is kept, also after reopening; an edit keeps the extra data.
    let dir = ws.dir().to_path_buf();
    drop(ws);
    let mut ws = Workspace::open(&dir).unwrap();
    let mut p = partners::get(ws.store(), id).unwrap();
    assert_eq!((p.puncte_lucru.len(), p.documente.len(), p.campuri.len()), (1, 1, 1));
    assert_eq!(p.cui, "RO14399840");
    p.telefon = "0700 000 000".into();
    partners::save(ws.store_mut(), p).unwrap();
    assert_eq!(partners::get(ws.store(), id).unwrap().documente[0].numar, "LT-1234");
    // Hidden cards leave suggestions but stay in the full list.
    partners::set_active(ws.store_mut(), id, false).unwrap();
    assert!(names_in(&ws, "Tra").is_empty());
    assert_eq!(partners::list(ws.store(), true).unwrap().len(), 2);
}

fn names_in(ws: &Workspace, q: &str) -> Vec<String> {
    partners::search(ws.store(), q, 10).unwrap().into_iter().map(|p| p.denumire).collect()
}

#[test]
fn expiring_documents_remind_once_per_stage() {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    let mut p = card("Eco Test SRL", "");
    p.documente = vec![PartnerDoc { tip: "Autorizație de mediu".into(), numar: "AM-7".into(), expira: "2026-12-31".into(), ..PartnerDoc::default() }];
    partners::save(ws.store_mut(), p).unwrap();
    let ex = partners::expiring(ws.store(), "2026-12-01", 60).unwrap();
    assert_eq!((ex.len(), ex[0].zile), (1, 30));
    let titles = |ws: &Workspace| notifications::list(ws, false, 50).unwrap().into_iter().map(|n| n.titlu).collect::<Vec<_>>();
    assert_eq!(partners::remind(&mut ws, "2026-11-30").unwrap(), 0, "31 days: nothing yet");
    assert_eq!(partners::remind(&mut ws, "2026-12-01").unwrap(), 1);
    assert_eq!(partners::remind(&mut ws, "2026-12-01").unwrap(), 0, "once");
    assert_eq!(partners::remind(&mut ws, "2026-12-24").unwrap(), 1, "7 days before");
    assert_eq!(partners::remind(&mut ws, "2026-12-31").unwrap(), 1, "on the day");
    assert_eq!(partners::remind(&mut ws, "2027-01-03").unwrap(), 0, "3 days after: no");
    assert_eq!(partners::remind(&mut ws, "2027-01-07").unwrap(), 1, "a week after");
    let t = titles(&ws);
    assert!(t.iter().any(|x| x == "Expiră în 30 de zile: Autorizație de mediu — Eco Test SRL" || x == "Expiră în 30 zile: Autorizație de mediu — Eco Test SRL"), "{t:?}");
    assert!(t.iter().any(|x| x.starts_with("Expiră azi")), "{t:?}");
    assert!(t.iter().any(|x| x.starts_with("Expirat")), "{t:?}");
}

struct Mod(Manifest);
impl Module for Mod {
    fn manifest(&self) -> &Manifest {
        &self.0
    }
    fn handle(&self, ctx: &mut ModuleContext<'_>, cmd: &str, a: Value) -> CoreResult<Value> {
        match cmd {
            "find" => Ok(json!(ctx.partners_search(a["q"].as_str().unwrap_or(""), 5)?.into_iter().map(|p| p.denumire).collect::<Vec<_>>())),
            "add" => Ok(json!(ctx.partner_save(card(a["n"].as_str().unwrap_or(""), ""))?)),
            _ => Err(CoreError::invalid("cmd", "necunoscut")),
        }
    }
}

fn manager(perms: &[&str]) -> ModuleManager {
    let mut services: Vec<&str> = perms.iter().map(|p| p.split('.').next().unwrap()).collect();
    services.dedup();
    let v = json!({
        "manifest_format": 1, "id": "t.m", "name": "M", "description": "d", "version": "0.1.0",
        "core": ">=0.1.0, <0.2.0", "status": "beta", "data_format": 1, "on_disable": "nimic",
        "permissions": perms, "services": services
    });
    ModuleManager::new(vec![Box::new(Mod(Manifest::parse(&v.to_string()).unwrap()))], "0.1.0").unwrap()
}

#[test]
fn modules_need_the_permissions() {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    partners::save(ws.store_mut(), card("Beta Servicii SRL", "")).unwrap();
    let mm = manager(&["partners.read", "partners.write"]);
    mm.enable(&mut ws, "t.m", &["partners.read".into(), "partners.write".into()]).unwrap();
    assert_eq!(mm.call(&mut ws, None, "t.m", "find", json!({"q": "beta"})).unwrap(), json!(["Beta Servicii SRL"]));
    mm.call(&mut ws, None, "t.m", "add", json!({"n": "Gama SRL"})).unwrap();
    assert_eq!(partners::list(ws.store(), false).unwrap().len(), 2);

    let t2 = tempfile::tempdir().unwrap();
    let mut ws2 = Workspace::create(&t2.path().join("ws"), "T").unwrap();
    let mm = manager(&["partners.read"]);
    mm.enable(&mut ws2, "t.m", &["partners.read".into()]).unwrap();
    let e = mm.call(&mut ws2, None, "t.m", "add", json!({"n": "X"})).unwrap_err();
    assert!(e.to_string().contains("partners.write"), "{e}");
}
