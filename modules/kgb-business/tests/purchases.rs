//! Step 5.4: received invoices and expenses — totals checked, duplicates
//! refused, storno visible; the CSV exported by „Extragere date” is taken
//! over in one atomic write, or not at all.

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_business::{Business, ID};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &["storage.own".into(), "notify.send".into(), "files.own".into()],
    )
    .unwrap();
    (tmp, ws, mm)
}

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

#[test]
fn manual_expenses() {
    let (_t, mut ws, mm) = setup();
    let s = call(
        &mut ws,
        &mm,
        "partner_save",
        json!({"nume": "Furnizor SRL", "cui": "RO12345674", "tip": "furnizor"}),
    )
    .unwrap();
    let doc = |numar: &str, net: &str, tva: &str, total: &str| {
        json!({"furnizor": s["id"], "numar": numar, "data": "05.11.2026", "scadenta": "20.11.2026", "categorie": "materiale",
               "total_fara_tva": net, "tva": tva, "total": total})
    };
    let a = call(
        &mut ws,
        &mm,
        "purchase_save",
        doc("F-12", "1.000,00", "210,00", "1.210,00"),
    )
    .unwrap();
    // net + VAT must equal the total
    let err = call(&mut ws, &mm, "purchase_save", doc("F-13", "100", "21", "122"))
        .unwrap_err()
        .to_string();
    assert!(err.contains("nu este egal"), "{err}");
    // the same document again: refused (number compared without spaces/case), unless intended
    assert!(
        call(&mut ws, &mm, "purchase_save", doc("f - 12", "1.000", "210", "1.210"))
            .unwrap_err()
            .to_string()
            .contains("deja înregistrat")
    );
    let mut again = doc("F-12", "1.000", "210", "1.210");
    again["permite_duplicat"] = json!(true);
    call(&mut ws, &mm, "purchase_save", again).unwrap();
    // a receipt with only the total
    call(
        &mut ws,
        &mm,
        "purchase_save",
        json!({"furnizor": s["id"], "tip": "bon", "numar": "B 77", "data": "06.11.2026", "total": "45,50"}),
    )
    .unwrap();
    // storno: visible, once, opposite amounts
    let st = call(
        &mut ws,
        &mm,
        "purchase_storno",
        json!({"id": a["id"], "data": "07.11.2026"}),
    )
    .unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "purchase_storno",
            json!({"id": a["id"], "data": "07.11.2026"})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "purchase_storno",
            json!({"id": st["id"], "data": "07.11.2026"})
        )
        .is_err()
    );
    let list = call(&mut ws, &mm, "purchases", json!({})).unwrap();
    let list = list.as_array().unwrap();
    assert_eq!(list.len(), 4);
    let sum: i64 = list.iter().map(|x| x["total"].as_i64().unwrap()).sum();
    // 1.210,00 − 1.210,00 + 1.210,00 + 45,50
    assert_eq!(sum, 125_550);
}

#[test]
fn import_from_extract_csv() {
    let (_t, mut ws, mm) = setup();
    call(
        &mut ws,
        &mm,
        "partner_save",
        json!({"nume": "Alfa SRL", "cui": "RO12345674", "tip": "furnizor"}),
    )
    .unwrap();
    // Exactly the shape of „Extragere date” → Exportă CSV (Romanian style).
    let csv = "\u{feff}Număr factură;Data emiterii;Scadența;Furnizor;CUI furnizor;Client;Total fără TVA;TVA;Total de plată\r\n\
               F-1;01.11.2026;15.11.2026;Alfa SRL;RO12345674;Noi SRL;1000,00;210,00;1210,00\r\n\
               B-9;02.11.2026;;Beta Construct SRL;RO18547290;Noi SRL;100,00;21,00;121,00\r\n\
               B-9;02.11.2026;;Beta Construct SRL;RO18547290;Noi SRL;100,00;21,00;121,00\r\n";
    let enc = |s: &str| B64.encode(s.as_bytes());
    let r = call(
        &mut ws,
        &mm,
        "import",
        json!({"name": "Facturi extrase.csv", "data": enc(csv)}),
    )
    .unwrap();
    assert_eq!(r["importate"], 2);
    assert_eq!(
        r["duplicate"].as_array().unwrap().len(),
        1,
        "the repeated row is skipped and listed"
    );
    let partners = call(&mut ws, &mm, "partners", json!({})).unwrap();
    assert!(
        partners
            .as_array()
            .unwrap()
            .iter()
            .any(|p| p["nume"] == "Beta Construct SRL" && p["cui"] == "RO18547290"),
        "a new supplier is created"
    );
    assert_eq!(
        partners.as_array().unwrap().len(),
        2,
        "Alfa matched by CUI, not created again"
    );
    // The same file again: everything is a duplicate, nothing new.
    let r = call(
        &mut ws,
        &mm,
        "import",
        json!({"name": "Facturi extrase.csv", "data": enc(csv)}),
    )
    .unwrap();
    assert_eq!(r["importate"], 0);
    // A file with one bad row: nothing at all is imported.
    let bad = "Număr factură;Data emiterii;Furnizor;CUI furnizor;Total de plată\r\nG-1;03.11.2026;Gama SRL;RO1;10,00\r\nG-2;03.11.2026;Gama SRL;;10,00\r\n";
    let err = call(&mut ws, &mm, "import", json!({"name": "x.csv", "data": enc(bad)}))
        .unwrap_err()
        .to_string();
    assert!(err.contains("nimic nu a fost importat"), "{err}");
    assert_eq!(
        call(&mut ws, &mm, "purchases", json!({}))
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        2
    );
    // Not the Extract export: refused with a clear message.
    let other = "Nume;Valoare\r\nx;1\r\n";
    assert!(
        call(&mut ws, &mm, "import", json!({"name": "y.csv", "data": enc(other)}))
            .unwrap_err()
            .to_string()
            .contains("lipsește coloana")
    );
    assert!(call(&mut ws, &mm, "import", json!({"name": "y.xlsx", "data": enc(other)})).is_err());
}
