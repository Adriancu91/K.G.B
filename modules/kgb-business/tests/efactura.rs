//! Step 7.4j: invoices received through e-Factura. A UBL XML becomes an
//! expense with the supplier found by CUI or added; the totals are exact;
//! the same invoice twice is refused; the SPV ZIP is read without the
//! signature file; a credit note and a foreign currency are refused with a
//! message; nothing is sent anywhere. (Fictive invoices, CIUS-RO structure.)

use std::io::Write as _;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_business::{Business, ID, efactura};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn ubl(root: &str, number: &str, currency: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<{root} xmlns="urn:oasis:names:specification:ubl:schema:xsd:{root}-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
  <cbc:ID>{number}</cbc:ID>
  <cbc:IssueDate>2026-11-03</cbc:IssueDate>
  <cbc:DueDate>2026-12-03</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>{currency}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PostalAddress><cbc:StreetName>Str. Fabricii 1</cbc:StreetName><cbc:CityName>Cluj-Napoca</cbc:CityName></cac:PostalAddress>
    <cac:PartyTaxScheme><cbc:CompanyID>RO14399840</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
    <cac:PartyLegalEntity><cbc:RegistrationName>Furnizor Test &amp; Co SRL</cbc:RegistrationName><cbc:CompanyID>J12/345/2001</cbc:CompanyID></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyLegalEntity><cbc:RegistrationName>Noi SRL</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="RON">229.95</cbc:TaxAmount>
    <cac:TaxSubtotal><cbc:TaxableAmount currencyID="RON">1095.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="RON">229.95</cbc:TaxAmount></cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="RON">1095.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="RON">1095.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="RON">1324.95</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="RON">1324.95</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="H87">10</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="RON">850.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Ciment 40 kg</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>21</cbc:Percent></cac:ClassifiedTaxCategory></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="RON">85.00</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
  <cac:InvoiceLine><cbc:ID>2</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="RON">245.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Transport</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>21</cbc:Percent></cac:ClassifiedTaxCategory></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="RON">245.00</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
</{root}>"#
    )
}

#[test]
fn ubl_is_read_exactly() {
    let inv = efactura::parse(&ubl("Invoice", "FT-0042", "RON")).unwrap();
    assert_eq!((inv.numar.as_str(), inv.data.as_str(), inv.scadenta.as_str()), ("FT-0042", "2026-11-03", "2026-12-03"));
    assert_eq!((inv.furnizor_nume.as_str(), inv.furnizor_cui.as_str()), ("Furnizor Test & Co SRL", "RO14399840"));
    assert_eq!((inv.total_fara_tva, inv.tva, inv.total), (109_500, 22_995, 132_495));
    assert_eq!(inv.linii.len(), 2);
    assert_eq!((inv.linii[0].denumire.as_str(), inv.linii[0].valoare, inv.linii[0].cota_tva.as_str()), ("Ciment 40 kg", 85_000, "21"));
    assert_eq!(efactura::money("12.5").unwrap(), 1250);
    assert!(efactura::money("12.345").is_err(), "no silent rounding");
    assert!(efactura::parse(&ubl("CreditNote", "NC-1", "RON")).unwrap_err().contains("notă de credit"));
    assert!(efactura::parse(&ubl("Invoice", "FT-1", "EUR")).unwrap_err().contains("EUR"));
    assert!(efactura::parse("<html/>").is_err());
}

#[test]
fn xml_and_spv_zip_become_expenses_once() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into(), "files.own".into()]).unwrap();
    let imp = |ws: &mut Workspace, name: &str, data: &[u8]| call(ws, &mm, "efactura_import", json!({"name": name, "data": B64.encode(data)})).unwrap();

    let r = imp(&mut ws, "FT-0042.xml", ubl("Invoice", "FT-0042", "RON").as_bytes());
    assert_eq!(r[0]["ok"], true, "{r}");
    let partners = call(&mut ws, &mm, "partners", json!({})).unwrap();
    let sup: Vec<&Value> = partners.as_array().unwrap().iter().filter(|p| p["cui"] == "RO14399840").collect();
    assert_eq!(sup.len(), 1, "the supplier was added once");
    let open = call(&mut ws, &mm, "open_documents", json!({})).unwrap();
    let exp = open.as_array().unwrap().iter().find(|d| d["tip"] == "cheltuiala").unwrap();
    assert_eq!(exp["rest"], 132_495, "to pay: the payable amount");

    // The same invoice again: refused, nothing added.
    let r = imp(&mut ws, "FT-0042.xml", ubl("Invoice", "FT-0042", "RON").as_bytes());
    assert_eq!(r[0]["ok"], false, "{r}");

    // The SPV archive: the invoice XML + ANAF's signature; a second invoice inside.
    let mut zbuf = Vec::new();
    {
        let mut z = zip::ZipWriter::new(std::io::Cursor::new(&mut zbuf));
        let o = zip::write::SimpleFileOptions::default();
        z.start_file("4321098765.xml", o).unwrap();
        z.write_all(ubl("Invoice", "FT-0043", "RON").as_bytes()).unwrap();
        z.start_file("semnatura_4321098765.xml", o).unwrap();
        z.write_all(b"<Signature/>").unwrap();
        z.finish().unwrap();
    }
    let r = imp(&mut ws, "4321098765.zip", &zbuf);
    assert_eq!(r.as_array().unwrap().len(), 1, "the signature file is skipped: {r}");
    assert_eq!((r[0]["ok"].as_bool(), r[0]["numar"].as_str()), (Some(true), Some("FT-0043")));
    let partners = call(&mut ws, &mm, "partners", json!({})).unwrap();
    assert_eq!(partners.as_array().unwrap().iter().filter(|p| p["cui"] == "RO14399840").count(), 1, "found by CUI, not added again");
    let v = call(&mut ws, &mm, "verify", json!({})).unwrap();
    assert!(v.to_string().contains("\"ok\":true") || v["ok"] == true, "{v}");
}
