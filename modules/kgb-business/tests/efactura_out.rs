//! 7.4m-3 (D-082): e-Factura of an issued invoice. The page writes the XML (the COS code); the module writes the
//! file only if K.G.B.'s own reader finds in it this invoice's number, the company's CUI and the same totals.
//! Nothing is sent anywhere. (Made-up firms.)

use kgb_business::{Business, ID};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

/// The shape of the COS XML, with the parts K.G.B.'s reader takes.
fn xml(id: &str, cui: &str, net: &str, vat: &str, total: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
  <cbc:ID>{id}</cbc:ID>
  <cbc:IssueDate>2026-11-08</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>RON</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyTaxScheme><cbc:CompanyID>{cui}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
    <cac:PartyLegalEntity><cbc:RegistrationName>Kronos Global Business SRL</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>Client SRL</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="RON">{vat}</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="RON">{net}</cbc:TaxExclusiveAmount>
    <cbc:PayableAmount currencyID="RON">{total}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="RON">{net}</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Transport</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="RON">{net}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
</Invoice>"#
    )
}

#[test]
fn the_file_is_written_only_when_it_matches_the_issued_invoice() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &["storage.own".into(), "notify.send".into(), "files.own".into()],
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "settings_save",
        json!({"firma": {"firma_nume": "Kronos Global Business SRL", "firma_cui": "RO18547290", "firma_adresa": "Iași, Str. Lăpușneanu 1"}}),
    )
    .unwrap();
    let client = call(
        &mut ws,
        &mm,
        "partner_save",
        json!({"nume": "Client SRL", "cui": "RO12345674", "adresa": "Iași", "tip": "client"}),
    )
    .unwrap();
    let series = call(&mut ws, &mm, "series_save", json!({"cod": "KGB", "primul_numar": 100})).unwrap();
    let f = call(
        &mut ws,
        &mm,
        "invoice_issue",
        json!({"serie": series["id"], "partener": client["id"], "data": "2026-11-08",
               "linii": [{"descriere": "Transport", "um": "serviciu", "cantitate": "1", "pret_unitar": "100", "cota_tva": 21}]}),
    )
    .unwrap();
    assert_eq!(f["numar"], "KGB 100");
    let dest = tmp.path().join("KGB 100.xml");
    let export = |ws: &mut Workspace, x: String| {
        call(
            ws,
            &mm,
            "efactura_export",
            json!({"id": f["id"], "dest": dest, "xml": x}),
        )
    };

    // Another number, another company or other sums: refused, nothing written.
    for (bad, why) in [
        (xml("KGB 101", "RO18547290", "100.00", "21.00", "121.00"), "numărul"),
        (
            xml("KGB 100", "RO14399840", "100.00", "21.00", "121.00"),
            "CUI-ul furnizorului",
        ),
        (
            xml("KGB 100", "RO18547290", "100.00", "21.01", "121.01"),
            "TVA-ul 21,01 în loc de 21,00",
        ),
        ("nu e XML".to_string(), "e-Factura"),
    ] {
        let e = export(&mut ws, bad).unwrap_err().to_string();
        assert!(e.contains(why), "{e}");
        assert!(!dest.exists());
    }
    // The matching file is written as it is.
    let good = xml("KGB 100", "RO18547290", "100.00", "21.00", "121.00");
    let r = export(&mut ws, good.clone()).unwrap();
    assert_eq!(r["numar"], "KGB 100");
    assert_eq!(std::fs::read_to_string(&dest).unwrap(), good);
    // An invoice that does not exist.
    assert!(
        call(
            &mut ws,
            &mm,
            "efactura_export",
            json!({"id": "01a1c445-0000-7000-8000-000000000000", "dest": dest, "xml": good})
        )
        .is_err()
    );
}
