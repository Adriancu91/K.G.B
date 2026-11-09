//! Step 7.4j: the monthly package for the accountant — one ZIP with the
//! month's issued invoices as PDF, the sales and purchase journals, money in
//! and out, the due list at the end of the month, the report and a note;
//! only the month asked for; a wrong month is refused.

use std::io::Read as _;

use kgb_business::{Business, ID};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

#[test]
fn monthly_package_for_the_accountant() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into(), "files.own".into()]).unwrap();
    call(&mut ws, &mm, "settings_save", json!({"firma": {"firma_nume": "Noi SRL", "firma_cui": "RO18547290", "firma_adresa": "Iași"}})).unwrap();
    let series = call(&mut ws, &mm, "series_save", json!({"cod": "F"})).unwrap();
    let client = call(&mut ws, &mm, "partner_save", json!({"nume": "Client Test SRL", "cui": "RO14399840", "tip": "ambele"})).unwrap();
    let issue = |ws: &mut Workspace, d: &str, price: &str| {
        call(ws, &mm, "invoice_issue", json!({"serie": series["id"], "partener": client["id"], "data": d,
            "linii": [{"descriere": "Servicii", "cantitate": "1", "pret_unitar": price, "cota_tva": 21}]}))
        .unwrap()
    };
    issue(&mut ws, "2026-10-30", "50"); // October: not in the package
    let f = issue(&mut ws, "2026-11-03", "1000"); // 1210,00
    issue(&mut ws, "2026-11-20", "100"); // 121,00
    call(&mut ws, &mm, "purchase_save", json!({"furnizor": client["id"], "numar": "FZ-9", "data": "2026-11-05", "total_fara_tva": "200,00", "tva": "42,00", "total": "242,00"})).unwrap();
    let bank = call(&mut ws, &mm, "account_save", json!({"tip": "banca", "nume": "Banca X"})).unwrap();
    call(&mut ws, &mm, "payment_save", json!({"cont": bank["id"], "data": "2026-11-10", "sens": "incasare", "suma": "1.210,00",
        "document": {"tip": "factura", "id": f["id"]}, "explicatie": "OP F 2"})).unwrap();

    let dest = tmp.path().join("pachet-2026-11.zip");
    let r = call(&mut ws, &mm, "accountant_package", json!({"luna": "2026-11", "dest": dest})).unwrap();
    assert_eq!((r["facturi"].as_u64(), r["cheltuieli"].as_u64(), r["plati"].as_u64()), (Some(2), Some(1), Some(1)), "{r}");
    let mut z = zip::ZipArchive::new(std::fs::File::open(&dest).unwrap()).unwrap();
    let names: Vec<String> = (0..z.len()).map(|i| z.by_index(i).unwrap().name().unwrap().to_string()).collect();
    for want in ["jurnal-vanzari.csv", "jurnal-cumparari.csv", "incasari-si-plati.csv", "scadentar.csv", "raport-2026-11.xlsx", "CITESTE.txt"] {
        assert!(names.iter().any(|n| n == want), "{want} missing in {names:?}");
    }
    let pdfs: Vec<&String> = names.iter().filter(|n| n.starts_with("facturi-emise/") && n.ends_with(".pdf")).collect();
    assert_eq!(pdfs.len(), 2, "only November's invoices: {names:?}");
    let text = |z: &mut zip::ZipArchive<std::fs::File>, n: &str| {
        let mut s = String::new();
        z.by_name(n).unwrap().read_to_string(&mut s).unwrap();
        s
    };
    let sales = text(&mut z, "jurnal-vanzari.csv");
    assert!(sales.starts_with('\u{FEFF}') && sales.contains("F 2;03.11.2026;Client Test SRL;RO14399840;1.000,00;210,00;1.210,00"), "{sales}");
    assert!(!sales.contains("30.10.2026"), "October left out");
    let buys = text(&mut z, "jurnal-cumparari.csv");
    assert!(buys.contains("FZ-9;05.11.2026;Client Test SRL") && buys.contains("242,00"), "{buys}");
    let money = text(&mut z, "incasari-si-plati.csv");
    assert!(money.contains("10.11.2026;Banca X;încasare;1.210,00") && money.contains("factura F 2"), "{money}");
    let due = text(&mut z, "scadentar.csv");
    assert!(due.contains("121,00") && due.contains("242,00") && !due.contains("1.210,00"), "the paid invoice is not due: {due}");
    let mut pdf = Vec::new();
    z.by_name(pdfs[0]).unwrap().read_to_end(&mut pdf).unwrap();
    assert!(pdf.starts_with(b"%PDF"));
    assert!(text(&mut z, "CITESTE.txt").contains("nu o declarație fiscală"));

    assert!(call(&mut ws, &mm, "accountant_package", json!({"luna": "2026-13", "dest": tmp.path().join("x.zip")})).is_err());
}
