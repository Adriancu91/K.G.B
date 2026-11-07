//! Step 4.8: the document library — the original model never changes; the
//! generated document has the right values; company fields come only from
//! „Date firmă”; missing values are refused; models are versioned; hostile
//! files are refused.

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_docs::{Docs, ID, fill};
use serde_json::{Value, json};

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Docs::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "files.own".into()])
        .unwrap();
    (tmp, ws, mm)
}

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn company(ws: &mut Workspace, mm: &ModuleManager) {
    call(
        ws,
        mm,
        "company_save",
        json!({"valori": {"nume": "Kronos Global Business SRL", "cui": "RO12345678", "reg_com": "J22/123/2020",
            "adresa": "Iași, Str. Lăpușneanu 1", "iban": "RO49AAAA1B31007593840000", "banca": "Banca Test",
            "telefon": "0700 000 000", "email": "office@exemplu.ro", "reprezentant": "Adrian Popescu",
            "functie_reprezentant": "administrator"}}),
    )
    .unwrap();
}

fn model<'a>(list: &'a Value, name: &str) -> &'a Value {
    list.as_array().unwrap().iter().find(|m| m["nume"] == name).unwrap()
}

#[test]
fn built_in_models_generate_with_the_right_fields() {
    let (tmp, mut ws, mm) = setup();
    company(&mut ws, &mm);
    let list = call(&mut ws, &mm, "models", json!({})).unwrap();
    let names: Vec<&str> = list
        .as_array()
        .unwrap()
        .iter()
        .map(|m| m["nume"].as_str().unwrap())
        .collect();
    assert_eq!(
        names,
        [
            "Cerere",
            "Contract de prestări servicii",
            "Ofertă comercială",
            "Ofertă comercială (PDF)",
            "Adeverință de salariat",
            "Adeverință de salariat (PDF)",
            "Proces-verbal de recepție",
            "Proces-verbal de recepție (PDF)"
        ]
    );
    // Listing again does not add them twice.
    assert_eq!(
        call(&mut ws, &mm, "models", json!({}))
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        8
    );

    let c = model(&list, "Contract de prestări servicii").clone();
    let fields: Vec<&str> = c["campuri"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["camp"].as_str().unwrap())
        .collect();
    assert!(
        fields.contains(&"firma.iban") && fields.contains(&"client.cui") && fields.contains(&"pret"),
        "{fields:?}"
    );
    assert_eq!(c["versiune"], 1);
    let doc = c["document"].as_str().unwrap().to_string();
    let original = original_bytes(&tmp, &mut ws, &mm, &c);

    let values = json!({"numar": "12", "data": "07.11.2026", "client": "Școala Gimnazială „Ion Creangă” Iași",
        "client.adresa": "Iași, Str. Școlii 5", "client.cui": "RO87654321", "client.reprezentant": "Maria Ionescu",
        "obiect": "mentenanța echipamentelor IT & rețea <LAN>", "pret": "1.673,14 lei", "termen_plata": "15 zile",
        "durata": "12 luni"});
    let g = call(
        &mut ws,
        &mm,
        "generate",
        json!({"model": c["id"], "valori": values, "nume": "Contract Școala 12"}),
    )
    .unwrap();
    assert_eq!(g["model_versiune"], 1);
    let text = call(&mut ws, &mm, "text", json!({"id": g["id"]})).unwrap()["text"]
        .as_str()
        .unwrap()
        .to_string();
    for want in [
        "Kronos Global Business SRL",
        "CUI RO12345678",
        "RO49AAAA1B31007593840000",
        "Școala Gimnazială „Ion Creangă” Iași",
        "mentenanța echipamentelor IT & rețea <LAN>",
        "1.673,14 lei",
        "Adrian Popescu",
    ] {
        assert!(text.contains(want), "missing {want} in {text}");
    }
    assert!(!text.contains("{{"), "{text}");

    // The model's original is unchanged (same bytes, still version 1).
    let again = call(&mut ws, &mm, "models", json!({})).unwrap();
    let after = original_bytes(&tmp, &mut ws, &mm, model(&again, "Contract de prestări servicii"));
    assert_eq!(original, after);
    assert!(
        after.starts_with("1:") && !after.contains(','),
        "still only version 1: {after}"
    );
    assert_eq!(
        model(
            &call(&mut ws, &mm, "models", json!({})).unwrap(),
            "Contract de prestări servicii"
        )["document"],
        doc
    );

    // The generated document: listed with its model, version and values; exported as a real DOCX.
    let listed = call(&mut ws, &mm, "generated", json!({})).unwrap();
    assert_eq!(listed[0]["model_nume"], "Contract de prestări servicii");
    assert_eq!(listed[0]["valori"]["pret"], "1.673,14 lei");
    assert_eq!(
        listed[0]["valori"]["firma.cui"], "RO12345678",
        "company values are recorded too"
    );
    let dest = tmp.path().join("contract.docx");
    call(&mut ws, &mm, "export", json!({"id": g["id"], "dest": dest})).unwrap();
    let bytes = std::fs::read(&dest).unwrap();
    assert!(fill::text(&bytes).unwrap().contains("Maria Ionescu"));
}

/// The model's versions (number + BLAKE3 hash of the content).
fn original_bytes(_tmp: &tempfile::TempDir, ws: &mut Workspace, mm: &ModuleManager, m: &Value) -> String {
    let v = call(ws, mm, "model_versions", json!({"id": m["id"]})).unwrap();
    v.as_array()
        .unwrap()
        .iter()
        .map(|x| format!("{}:{}", x["number"], x["hash"]))
        .collect::<Vec<_>>()
        .join(",")
}

#[test]
fn company_fields_only_from_company_data_and_missing_values_refused() {
    let (_t, mut ws, mm) = setup();
    let list = call(&mut ws, &mm, "models", json!({})).unwrap();
    let cerere = model(&list, "Cerere").clone();
    let vals = json!({"numar": "1", "data": "07.11.2026", "destinatar": "Primăria Iași", "solicitare": "eliberarea unui aviz", "motiv": "extindere"});
    // No company data yet: refused, naming what is missing.
    let err = call(&mut ws, &mm, "generate", json!({"model": cerere["id"], "valori": vals}))
        .unwrap_err()
        .to_string();
    assert!(err.contains("Firma · Denumire") && err.contains("Firma · CUI"), "{err}");
    company(&mut ws, &mm);
    // A company field typed in the form is refused.
    let mut forged = vals.clone();
    forged["firma.cui"] = json!("RO00000000");
    let err = call(
        &mut ws,
        &mm,
        "generate",
        json!({"model": cerere["id"], "valori": forged}),
    )
    .unwrap_err()
    .to_string();
    assert!(err.contains("doar din Date firmă"), "{err}");
    // A missing ordinary value is refused, the field is never left empty silently.
    let mut partial = vals.clone();
    partial["motiv"] = json!("  ");
    let err = call(
        &mut ws,
        &mm,
        "generate",
        json!({"model": cerere["id"], "valori": partial}),
    )
    .unwrap_err()
    .to_string();
    assert!(err.contains("Motiv"), "{err}");
    assert_eq!(call(&mut ws, &mm, "generated", json!({})).unwrap(), json!([]));
    // Complete: it works.
    call(&mut ws, &mm, "generate", json!({"model": cerere["id"], "valori": vals})).unwrap();
    // Unknown company field refused.
    assert!(call(&mut ws, &mm, "company_save", json!({"valori": {"parola": "x"}})).is_err());
}

#[test]
fn own_models_are_versioned_and_hostile_files_refused() {
    let (tmp, mut ws, mm) = setup();
    company(&mut ws, &mm);
    // An own model: the built-in Cerere file under another name stands in for a Word file.
    let data = std::fs::read(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/models/hr-adeverinta-salariat.docx"
    ))
    .unwrap();
    let m = call(
        &mut ws,
        &mm,
        "model_import",
        json!({"name": "Adeverința noastră.docx", "data": B64.encode(&data), "categorie": "hr"}),
    )
    .unwrap();
    assert_eq!(m["sursa"], "importat");
    // From the file dialog: category „altele”, then changed.
    let d = call(
        &mut ws,
        &mm,
        "import",
        json!({"name": "Altă adeverință.docx", "data": B64.encode(&data)}),
    )
    .unwrap();
    assert_eq!(d["categorie"], "altele");
    call(
        &mut ws,
        &mm,
        "model_set",
        json!({"id": d["id"], "categorie": "hr", "nume": "Adeverință (copie)"}),
    )
    .unwrap();
    let l = call(&mut ws, &mm, "models", json!({})).unwrap();
    assert_eq!(model(&l, "Adeverință (copie)")["categorie"], "hr");
    assert_eq!(m["versiune"], 1);
    // A new version of the model: the generated document records which one.
    let v = call(
        &mut ws,
        &mm,
        "model_update",
        json!({"id": m["id"], "data": B64.encode(&data), "nota": "corectură"}),
    )
    .unwrap();
    assert_eq!(v["versiune"], 2);
    let g = call(
        &mut ws,
        &mm,
        "generate",
        json!({"model": m["id"], "valori": {"numar": "3", "data": "07.11.2026", "angajat": "Ion Ionescu", "functie": "contabil",
            "durata_contract": "nedeterminată", "data_angajarii": "01.03.2024", "scop": "medicul de familie"}}),
    )
    .unwrap();
    assert_eq!(g["model_versiune"], 2);

    // Refused: not DOCX, no fields, a zip bomb, wrong category.
    let enc = |b: &[u8]| B64.encode(b);
    assert!(
        call(
            &mut ws,
            &mm,
            "model_import",
            json!({"name": "x.docx", "data": enc(b"nu e zip"), "categorie": "hr"})
        )
        .is_err()
    );
    let plain = plain_docx();
    let err = call(
        &mut ws,
        &mm,
        "model_import",
        json!({"name": "fara.docx", "data": enc(&plain), "categorie": "altele"}),
    )
    .unwrap_err()
    .to_string();
    assert!(err.contains("niciun câmp"), "{err}");
    let bomb = bomb_docx();
    assert!(
        call(
            &mut ws,
            &mm,
            "model_import",
            json!({"name": "b.docx", "data": enc(&bomb), "categorie": "altele"})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "model_import",
            json!({"name": "x.docx", "data": enc(&data), "categorie": "secret"})
        )
        .is_err()
    );
    // Built-in models cannot be deleted; own ones can.
    let list = call(&mut ws, &mm, "models", json!({})).unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "model_delete",
            json!({"id": model(&list, "Cerere")["id"]})
        )
        .is_err()
    );
    call(&mut ws, &mm, "model_delete", json!({"id": m["id"]})).unwrap();
    // The generated document stays readable after its model is deleted.
    assert!(
        call(&mut ws, &mm, "text", json!({"id": g["id"]})).unwrap()["text"]
            .as_str()
            .unwrap()
            .contains("Ion Ionescu")
    );
    drop(tmp);
}

fn zip_of(entries: &[(&str, &[u8])]) -> Vec<u8> {
    use std::io::Write;
    let mut z = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    for (n, d) in entries {
        z.start_file(*n, zip::write::SimpleFileOptions::default()).unwrap();
        z.write_all(d).unwrap();
    }
    z.finish().unwrap().into_inner()
}

fn plain_docx() -> Vec<u8> {
    zip_of(&[(
        "word/document.xml",
        br#"<w:document xmlns:w="w"><w:body><w:p><w:r><w:t>Doar text.</w:t></w:r></w:p></w:body></w:document>"#,
    )])
}

fn bomb_docx() -> Vec<u8> {
    let big = vec![b'a'; 210 * 1024 * 1024];
    zip_of(&[("word/document.xml", b"<w:document/>"), ("word/media/x.bin", &big)])
}
