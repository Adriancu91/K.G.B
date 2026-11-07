//! Step 4.8b (D-045, Typst): a PDF from a built-in model has the right values
//! (searchable, diacritics included), a value that looks like Typst code is
//! printed as text, the same model and values give the same PDF, missing
//! values are refused, and the model itself is unchanged.

use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_docs::{Docs, ID};
use serde_json::{Value, json};

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Docs::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "files.own".into()])
        .unwrap();
    call(
        &mut ws,
        &mm,
        "company_save",
        json!({"valori": {"nume": "Kronos Global Business SRL", "cui": "RO12345678", "reg_com": "J22/123/2020",
            "adresa": "Iași, Str. Lăpușneanu 1", "telefon": "0700 000 000", "email": "office@exemplu.ro",
            "reprezentant": "Adrian Popescu", "functie_reprezentant": "administrator"}}),
    )
    .unwrap();
    (tmp, ws, mm)
}

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

#[test]
fn pdf_from_a_typst_model() {
    let (tmp, mut ws, mm) = setup();
    let list = call(&mut ws, &mm, "models", json!({})).unwrap();
    let m = list
        .as_array()
        .unwrap()
        .iter()
        .find(|m| m["nume"] == "Ofertă comercială (PDF)")
        .unwrap()
        .clone();
    assert_eq!(m["format"], "pdf");
    let fields: Vec<&str> = m["campuri"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["camp"].as_str().unwrap())
        .collect();
    assert!(
        fields.contains(&"client") && fields.contains(&"firma.cui") && fields.contains(&"valoare"),
        "{fields:?}"
    );
    let versions_before = call(&mut ws, &mm, "model_versions", json!({"id": m["id"]})).unwrap();

    let vals = json!({"numar": "7", "data": "08.11.2026", "client": "Școala Gimnazială „Ion Creangă” Iași",
        "obiect": "#panic(\"x\") ]* _ mentenanță țiglă", "valoare": "1.673,14 lei", "termen_livrare": "10 zile",
        "conditii_plata": "ordin de plată", "valabil_pana_la": "30.11.2026"});
    // A missing value is refused.
    let mut partial = vals.clone();
    partial["valoare"] = json!("");
    assert!(
        call(&mut ws, &mm, "generate", json!({"model": m["id"], "valori": partial}))
            .unwrap_err()
            .to_string()
            .contains("Valoarea")
    );

    let g = call(
        &mut ws,
        &mm,
        "generate",
        json!({"model": m["id"], "valori": vals, "nume": "Oferta 7"}),
    )
    .unwrap();
    assert_eq!(g["format"], "pdf");
    let text = call(&mut ws, &mm, "text", json!({"id": g["id"]})).unwrap()["text"]
        .as_str()
        .unwrap()
        .to_string();
    let flat: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
    for want in [
        "Kronos Global Business SRL",
        "RO12345678",
        "Școala Gimnazială „Ion Creangă” Iași",
        "1.673,14 lei",
        "OFERTĂ COMERCIALĂ",
    ] {
        assert!(flat.contains(want), "missing {want} in {flat}");
    }
    assert!(
        flat.contains("#panic(\"x\") ]* _ mentenanță țiglă"),
        "code-like value printed as text: {flat}"
    );

    // Exported as a real PDF; the same values give the same bytes.
    let a = tmp.path().join("a.pdf");
    call(&mut ws, &mm, "export", json!({"id": g["id"], "dest": a})).unwrap();
    let g2 = call(
        &mut ws,
        &mm,
        "generate",
        json!({"model": m["id"], "valori": vals, "nume": "Oferta 7 bis"}),
    )
    .unwrap();
    let b = tmp.path().join("b.pdf");
    call(&mut ws, &mm, "export", json!({"id": g2["id"], "dest": b})).unwrap();
    let (pa, pb) = (std::fs::read(&a).unwrap(), std::fs::read(&b).unwrap());
    assert!(pa.starts_with(b"%PDF-"));
    assert_eq!(pa, pb, "same model and values, same PDF");

    // The model is unchanged and cannot be replaced.
    assert_eq!(
        call(&mut ws, &mm, "model_versions", json!({"id": m["id"]})).unwrap(),
        versions_before
    );
    assert!(call(&mut ws, &mm, "model_update", json!({"id": m["id"], "data": "AAAA"})).is_err());
}
