//! 7.10a Depozitul de documente: files from a folder kept unchanged and once per content, sorted from their text
//! and their names (with a confidence and a reason), invoices recognised from an e-Factura XML (sales or
//! purchases by the firm's CUI), the CNP hidden in the kept text, confirmation and re-sorting.

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_vault::{ID, Vault, sort};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Vault::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "files.own".into()])
        .unwrap();
    (tmp, ws, mm)
}

fn add(ws: &mut Workspace, mm: &ModuleManager, name: &str, cale: &str, data: &[u8]) -> Value {
    call(
        ws,
        mm,
        "adauga",
        json!({"name": name, "cale": cale, "data": B64.encode(data)}),
    )
    .unwrap()
}

fn ubl(id: &str, supplier: &str, customer: &str, total: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:cac" xmlns:cbc="urn:cbc">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>
  <cbc:ID>{id}</cbc:ID>
  <cbc:IssueDate>2026-11-05</cbc:IssueDate>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Furnizor SRL</cbc:RegistrationName>
    <cbc:CompanyID>{supplier}</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Client SRL</cbc:RegistrationName>
    <cbc:CompanyID>{customer}</cbc:CompanyID></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="RON">{total}</cbc:PayableAmount></cac:LegalMonetaryTotal>
</Invoice>"#
    )
}

#[test]
fn a_folder_sorted_and_kept_once() {
    let (_t, mut ws, mm) = setup();
    // Text files stand for any document with text; the sorting reads the text and the folder names.
    let cim = add(
        &mut ws,
        &mm,
        "cim-popescu.txt",
        "Firma/Personal/cim-popescu.txt",
        "CONTRACT INDIVIDUAL DE MUNCĂ nr. 7\nAngajator: Noi SRL\nSalariat: Popescu Ion, CNP 1960101123456".as_bytes(),
    );
    assert_eq!(cim["categorie"], "contracte_munca", "{cim}");
    assert!(cim["incredere"].as_i64().unwrap() >= 75);
    let cert = add(
        &mut ws,
        &mm,
        "certificat.txt",
        "Firma/Acte/certificat.txt",
        "Oficiul Registrului Comerțului\nCERTIFICAT CONSTATATOR\nCod unic de înregistrare 14399840".as_bytes(),
    );
    assert_eq!(cert["categorie"], "identitate");
    let scan = add(
        &mut ws,
        &mm,
        "scan001.png",
        "Firma/Autorizatii/scan001.png",
        &[137, 80, 78, 71, 1, 2, 3],
    );
    assert_eq!(scan["categorie"], "autorizatii", "the folder's name: {scan}");
    assert!(scan["incredere"].as_i64().unwrap() <= 50, "names only: to confirm");
    let none = add(&mut ws, &mm, "x.txt", "x.txt", "ceva fără legătură".as_bytes());
    assert_eq!(none["categorie"], "altele");

    // The same bytes again (under another name): kept once.
    let again = add(
        &mut ws,
        &mm,
        "copie.txt",
        "Altundeva/copie.txt",
        "CONTRACT INDIVIDUAL DE MUNCĂ nr. 7\nAngajator: Noi SRL\nSalariat: Popescu Ion, CNP 1960101123456".as_bytes(),
    );
    assert_eq!(again["exista"], true);
    assert_eq!(again["id"], cim["id"]);

    let all = call(&mut ws, &mm, "lista", json!({})).unwrap();
    assert_eq!(all.as_array().unwrap().len(), 4);
    let found = call(&mut ws, &mm, "lista", json!({"text": "popescu"})).unwrap();
    assert_eq!(found.as_array().unwrap().len(), 1);
    let text = serde_json::to_string(&found).unwrap();
    assert!(!text.contains("1960101123456"), "the CNP is not kept in the text");

    // To confirm: the uncertain ones; a confirmation (with another category) is the person's.
    let todo = call(&mut ws, &mm, "lista", json!({"de_confirmat": true})).unwrap();
    let ids: Vec<&Value> = todo.as_array().unwrap().iter().map(|r| &r["id"]).collect();
    assert!(ids.contains(&&scan["id"]) && ids.contains(&&none["id"]) && !ids.contains(&&cim["id"]));
    let r = todo
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["id"] == none["id"])
        .unwrap()
        .clone();
    call(
        &mut ws,
        &mm,
        "confirma",
        json!({"id": r["id"], "version": r["version"], "categorie": "personal"}),
    )
    .unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "confirma",
            json!({"id": r["id"], "version": r["version"], "categorie": "nimic"})
        )
        .is_err()
    );
    let sum = call(&mut ws, &mm, "rezumat", json!({})).unwrap();
    assert_eq!(sum["total"], 4);
    assert_eq!(sum["de_confirmat"], 1);
    let personal = sum["categorii"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["id"] == "personal")
        .unwrap()
        .clone();
    assert_eq!(personal["documente"], 1);

    // Deleted: gone from the list, and the same bytes can come in again.
    let r = call(&mut ws, &mm, "lista", json!({"categorie": "altele"})).unwrap();
    assert!(r.as_array().unwrap().is_empty());
    let one = call(&mut ws, &mm, "lista", json!({"categorie": "identitate"})).unwrap()[0].clone();
    call(
        &mut ws,
        &mm,
        "sterge",
        json!({"id": one["id"], "version": one["version"]}),
    )
    .unwrap();
    let back = add(
        &mut ws,
        &mm,
        "certificat.txt",
        "Firma/Acte/certificat.txt",
        "Oficiul Registrului Comerțului\nCERTIFICAT CONSTATATOR\nCod unic de înregistrare 14399840".as_bytes(),
    );
    assert_eq!(back["exista"], false);
}

#[test]
fn invoices_sales_or_purchases_by_the_firms_cui() {
    let (_t, mut ws, mm) = setup();
    let sale = add(
        &mut ws,
        &mm,
        "f12.xml",
        "Facturi/f12.xml",
        ubl("KGB 0012", "RO14399840", "RO18547290", "1210.00").as_bytes(),
    );
    assert_eq!(sale["factura"]["emitent_cui"], "14399840");
    assert_eq!(sale["factura"]["serie"], "KGB");
    assert_eq!(sale["factura"]["numar"], "12");
    assert_eq!(sale["factura"]["data"], "2026-11-05");
    assert_eq!(sale["factura"]["total"], 121_000);
    assert_eq!(
        sale["categorie"], "facturi_achizitie",
        "the firm's CUI is not known yet"
    );
    assert!(sale["incredere"].as_i64().unwrap() < 75);
    let buy = add(
        &mut ws,
        &mm,
        "a7.xml",
        "Facturi/a7.xml",
        ubl("ABC7", "18547290", "14399840", "50").as_bytes(),
    );

    assert!(
        call(&mut ws, &mm, "setari_save", json!({"cui_firma": "RO 14399841"})).is_err(),
        "a wrong check digit"
    );
    let r = call(&mut ws, &mm, "setari_save", json!({"cui_firma": "RO 143 998 40"})).unwrap();
    assert_eq!(r["resortate"], 2);
    let l = call(&mut ws, &mm, "lista", json!({})).unwrap();
    let cat = |id: &Value| l.as_array().unwrap().iter().find(|x| &x["id"] == id).unwrap()["categorie"].clone();
    assert_eq!(cat(&sale["id"]), "facturi_vanzare");
    assert_eq!(cat(&buy["id"]), "facturi_achizitie");

    // The invoice's data corrected by the person.
    let row = l
        .as_array()
        .unwrap()
        .iter()
        .find(|x| x["id"] == buy["id"])
        .unwrap()
        .clone();
    let r = call(&mut ws, &mm, "factura_save", json!({"id": row["id"], "version": row["version"],
        "factura": {"emitent_cui": "RO18547290", "serie": "abc", "numar": "0007", "data": "06.11.2026", "total": "59,50"}}))
    .unwrap();
    assert_eq!(r["factura"]["numar"], "7");
    assert_eq!(r["factura"]["serie"], "ABC");
    assert_eq!(r["factura"]["total"], 5_950);
    assert_eq!(r["factura"]["data"], "2026-11-06");
}

#[test]
fn contracts_by_the_firms_role() {
    let t = "Contract de prestări servicii\nPărțile contractante\nPrestator: Noi SRL, CUI 14399840\nBeneficiar: Alfa SRL, CUI 18547290\nObiectul contractului";
    assert_eq!(sort("c.pdf", t, None, "14399840").category, "contracte_clienti");
    assert_eq!(sort("c.pdf", t, None, "18547290").category, "contracte_furnizori");
    let unknown = sort("c.pdf", t, None, "");
    assert_eq!(unknown.category, "contracte_clienti");
    assert!(unknown.confidence < 75, "not knowing the side: to confirm");
    assert!(unknown.reason.contains("contract"), "{}", unknown.reason);
}

#[test]
fn the_same_invoice_twice_is_shown() {
    let (_t, mut ws, mm) = setup();
    let xml = add(
        &mut ws,
        &mm,
        "f12.xml",
        "Facturi/f12.xml",
        ubl("KGB 0012", "RO14399840", "RO18547290", "1210.00").as_bytes(),
    );
    assert!(xml["dublura_de"].is_null());
    // The same invoice in another file (here: the same XML written with other spaces), then the same number with
    // another total.
    let twin = add(
        &mut ws,
        &mm,
        "f12-copie.xml",
        "Altele/f12-copie.xml",
        ubl("KGB 12", "14399840", "RO18547290", "1210.00").as_bytes(),
    );
    assert_eq!(twin["exista"], false, "another file: kept");
    assert_eq!(twin["dublura_de"]["id"], xml["id"]);
    assert_eq!(twin["dublura_de"]["sigur"], true);
    let other = add(
        &mut ws,
        &mm,
        "f12-alta.xml",
        "Altele/f12-alta.xml",
        ubl("KGB12", "RO14399840", "RO18547290", "999.00").as_bytes(),
    );
    assert_eq!(
        other["dublura_de"]["sigur"], false,
        "same number, another total: possibly"
    );
    add(
        &mut ws,
        &mm,
        "f13.xml",
        "Facturi/f13.xml",
        ubl("KGB 13", "RO14399840", "RO18547290", "1.00").as_bytes(),
    );

    let groups = call(&mut ws, &mm, "dubluri", json!({})).unwrap();
    let g = groups.as_array().unwrap();
    assert_eq!(g.len(), 1, "{groups}");
    assert_eq!(g[0]["documente"].as_array().unwrap().len(), 3);
    assert_eq!(g[0]["sigur"], false, "one of the three has another total");
}

#[test]
fn without_the_firms_cui_the_folder_proposes_the_side() {
    let inv = kgb_vault::Invoice {
        emitent_cui: "14399840".into(),
        serie: "KGB".into(),
        numar: "12".into(),
        ..Default::default()
    };
    let sale = sort("Facturi/emise/KGB 12.xml", "", Some(&inv), "");
    assert_eq!(sale.category, "facturi_vanzare");
    assert!(sale.confidence < 75 && sale.reason.contains("emise"), "{}", sale.reason);
    assert_eq!(
        sort("Achizitii 2026/f.pdf", "", Some(&inv), "").category,
        "facturi_achizitie"
    );
    assert!(sort("Facturi/f.pdf", "", Some(&inv), "").confidence < 75);
    // The firm's CUI decides over the folder.
    assert_eq!(
        sort("Facturi/primite/f.pdf", "", Some(&inv), "14399840").category,
        "facturi_vanzare"
    );
}

/// 7.10b: the firm's data read from the papers of „Actele firmei”, one proposal per value with the documents it
/// comes from; a document of another category is not read; two papers that disagree give two proposals.
#[test]
fn the_firm_profile_from_its_papers() {
    let (_t, mut ws, mm) = setup();
    let cert = "CERTIFICAT CONSTATATOR\nDenumire: ALFA CONSTRUCT S.R.L.\nCod unic de înregistrare: 14399840\n\
                Număr de ordine în registrul comerţului: J22/1234/2002\nSediul social: Iaşi, Str. Lăpuşneanu nr. 1\n";
    let c = add(&mut ws, &mm, "certificat constatator.txt", "Acte firma/certificat constatator.txt", cert.as_bytes());
    // Sorted as an act of the firm (if the text alone was not enough, confirmed here).
    let id = c["id"].clone();
    let l = call(&mut ws, &mm, "lista", json!({})).unwrap();
    let d = l.as_array().unwrap().iter().find(|d| d["id"] == id).unwrap().clone();
    if d["categorie"] != "identitate" {
        call(&mut ws, &mm, "confirma", json!({"id": id, "version": d["version"], "categorie": "identitate"})).unwrap();
    }
    // The same data again in a second paper, and a different seat in a third.
    let cui_paper = add(&mut ws, &mm, "certificat inregistrare.txt", "Acte firma/certificat inregistrare.txt",
        "CERTIFICAT DE ÎNREGISTRARE\nFirma: ALFA CONSTRUCT S.R.L.\nCUI: RO14399840\nSediul social: Iaşi, Str. Cuza Vodă 2\n".as_bytes());
    let l = call(&mut ws, &mm, "lista", json!({})).unwrap();
    let d2 = l.as_array().unwrap().iter().find(|d| d["id"] == cui_paper["id"]).unwrap().clone();
    if d2["categorie"] != "identitate" {
        call(&mut ws, &mm, "confirma", json!({"id": d2["id"], "version": d2["version"], "categorie": "identitate"})).unwrap();
    }
    // A contract that names another firm is not read for the firm's own data.
    add(&mut ws, &mm, "contract.txt", "Contracte/contract.txt", "CONTRACT DE PRESTĂRI SERVICII\nDenumire: GAMMA SRL\nCUI: 14399840\n".as_bytes());

    let p = call(&mut ws, &mm, "profil_firma", json!({})).unwrap();
    assert_eq!(p["documente"], 2);
    let props = p["propuneri"].as_array().unwrap();
    let of = |camp: &str| props.iter().filter(|x| x["camp"] == camp).map(|x| (x["valoare"].as_str().unwrap().to_string(), x["din"].as_array().unwrap().len())).collect::<Vec<_>>();
    assert_eq!(of("nume"), [("ALFA CONSTRUCT S.R.L.".to_string(), 2)]);
    assert_eq!(of("cui"), [("14399840".to_string(), 2)]);
    assert_eq!(of("reg_com"), [("J22/1234/2002".to_string(), 1)]);
    assert_eq!(of("adresa").len(), 2, "two papers, two seats: the person chooses");
    assert!(!props.iter().any(|x| x["valoare"] == "GAMMA SRL"));
}
