//! 7.9e Situații de lucrări: an estimate pasted from a spreadsheet (with a refused row shown), two monthly
//! statements with the figures worked out by hand, an overrun refused until a supplement with a reason, an issued
//! statement that does not change, a cancelled one kept with its reason and out of the previous quantities, its
//! number not used again, the retention on the value with VAT, a double number from another PC shown, PDF and .xlsx.
//!
//! The estimate (VAT 21%, retention 5% on the value without VAT):
//!   A  Săpătură     m3    100        × 250,00 lei
//!   B  Tencuială    m2    1.500,5    ×  12,35 lei
//!   C  Ușă          buc   3          × 1.000,00 lei
//! Statement 1: A 40, B 600,25, C 1
//!   values 1.000.000 + 741.308,75 + 100.000 = 1.841.308,75 bani → 18.413,09 lei
//!   VAT 21% = 386.674,8375 → 3.866,75; retention 5% = 92.065,4375 → 920,65; to pay 18.413,09 + 3.866,75 − 920,65 = 21.359,19
//! Statement 2: A 60, B 900,25, C 2 (everything left)
//!   values 1.500.000 + 1.111.808,75 + 200.000 = 2.811.808,75 → 28.118,09; VAT 590.479,8375 → 5.904,80;
//!   retention 140.590,4375 → 1.405,90; to pay 28.118,09 + 5.904,80 − 1.405,90 = 32.616,99
//! With the retention on the value with VAT, statement 1: (1.841.308,75 + 386.674,8375) × 5% = 111.399,18 → 1.113,99.

use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_store::{Fields, Write};
use kgb_works::{ID, STATEMENTS, Works};
use serde_json::{Value, json};
use uuid::Uuid;

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Works::new())], CORE_VERSION).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &["storage.own".into(), "files.own".into(), "partners.read".into()],
    )
    .unwrap();
    (tmp, ws, mm)
}

const TABLE: &str = "Cod\tDenumire\tUM\tCantitate\tPreț unitar\n\
                     A\tSăpătură\tm3\t100\t250,00\n\
                     B;Tencuială;m2;1.500,5;12,35\n\
                     C\tUșă\tbuc\t3\t1.000,00\n\
                     D\tGard\tm\tmult\t10\n";

/// An estimate with the three items pasted; returns its id and the items' ids (A, B, C).
fn estimate(ws: &mut Workspace, mm: &ModuleManager, base: &str) -> (Value, [Value; 3]) {
    let d = call(
        ws,
        mm,
        "deviz_save",
        json!({"nume": "Hală", "numar": "D-7", "data": "2030-03-01", "beneficiar_nume": "Beneficiar Test SRL",
        "contract_text": "Contract 12/2030", "santier": "Hala de depozitare", "tva": 21, "garantie": 500,
        "garantie_baza": base}),
    )
    .unwrap();
    let id = d["id"].clone();
    let p = call(ws, mm, "articole_lipire", json!({"deviz": id, "text": TABLE})).unwrap();
    assert_eq!(p["randuri"].as_array().unwrap().len(), 3, "the preview");
    assert_eq!(p["refuzate"][0]["rand"], 5);
    assert!(p["refuzate"][0]["motiv"].as_str().unwrap().contains("mult"));
    assert_eq!(p["adaugate"], 0, "nothing added before it is confirmed");
    let p = call(
        ws,
        mm,
        "articole_lipire",
        json!({"deviz": id, "text": TABLE, "confirma": true}),
    )
    .unwrap();
    assert_eq!(p["adaugate"], 3);
    let one = call(ws, mm, "deviz", json!({"id": id})).unwrap();
    let items = one["articole"].as_array().unwrap();
    let by = |c: &str| items.iter().find(|x| x["cod"] == c).unwrap()["id"].clone();
    assert_eq!(items[1]["cantitate"], 1_500_500);
    assert_eq!(items[1]["pret_unitar"], 1235);
    // 100 × 250 + 1.500,5 × 12,35 + 3 × 1.000 = 25.000 + 18.531,175 + 3.000 = 46.531,18 lei (rounded once)
    assert_eq!(one["valoare_deviz"], 4_653_118);
    (id, [by("A"), by("B"), by("C")])
}

fn statement(ws: &mut Workspace, mm: &ModuleManager, deviz: &Value, lines: &[(&Value, i64)]) -> CoreResult<Value> {
    let s = call(
        ws,
        mm,
        "situatie_noua",
        json!({"deviz": deviz, "de_la": "2030-04-01", "pana_la": "2030-04-30", "data": "2030-05-02"}),
    )?;
    let v = call(ws, mm, "situatie", json!({"id": s["id"]}))?;
    call(
        ws,
        mm,
        "situatie_save",
        json!({"id": s["id"], "version": v["version"],
        "linii": lines.iter().map(|(a, q)| json!({"articol": a, "cantitate": q})).collect::<Vec<_>>()}),
    )?;
    call(ws, mm, "situatie", json!({"id": s["id"]}))
}

fn line<'a>(s: &'a Value, cod: &str) -> &'a Value {
    s["linii"].as_array().unwrap().iter().find(|l| l["cod"] == cod).unwrap()
}

fn issue(ws: &mut Workspace, mm: &ModuleManager, s: &Value) -> Value {
    call(
        ws,
        mm,
        "situatie_emite",
        json!({"id": s["id"], "version": s["version"]}),
    )
    .unwrap();
    call(ws, mm, "situatie", json!({"id": s["id"]})).unwrap()
}

#[test]
fn two_statements_overrun_and_cancel() {
    let (tmp, mut ws, mm) = setup();
    let (d, [a, b, c]) = estimate(&mut ws, &mm, "fara_tva");

    let s1 = statement(&mut ws, &mm, &d, &[(&a, 40_000), (&b, 600_250), (&c, 1_000)]).unwrap();
    assert_eq!(s1["numar"], 1);
    assert_eq!(s1["stare"], "ciorna");
    assert_eq!(line(&s1, "B")["valoare_curent"], 741_308.75);
    assert_eq!(s1["valoare"], 1_841_309);
    assert_eq!(s1["tva_valoare"], 386_675);
    assert_eq!(s1["retinere"], 92_065);
    assert_eq!(s1["de_plata"], 2_135_919);
    assert_eq!(line(&s1, "A")["rest"], 60_000);
    let s1 = issue(&mut ws, &mm, &s1);
    assert_eq!(s1["stare"], "emisa");

    // An issued statement does not change and is not deleted.
    assert!(
        call(
            &mut ws,
            &mm,
            "situatie_save",
            json!({"id": s1["id"], "version": s1["version"], "linii": []})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "situatie_delete",
            json!({"id": s1["id"], "version": s1["version"]})
        )
        .is_err()
    );
    // Nor does the price of an item that is in it.
    assert!(
        call(
            &mut ws,
            &mm,
            "articol_save",
            json!({"id": a, "deviz": d, "cod": "A", "denumire": "Săpătură", "um": "m3", "cantitate": 100_000, "pret_unitar": 26_000})
        )
        .is_err()
    );

    let s2 = statement(&mut ws, &mm, &d, &[(&a, 60_000), (&b, 900_250), (&c, 2_000)]).unwrap();
    assert_eq!(s2["numar"], 2);
    assert_eq!(line(&s2, "B")["anterior"], 600_250);
    assert_eq!(line(&s2, "B")["cumulat"], 1_500_500);
    for cod in ["A", "B", "C"] {
        assert_eq!(line(&s2, cod)["rest"], 0, "{cod}");
    }
    assert_eq!(s2["valoare"], 2_811_809);
    assert_eq!(s2["tva_valoare"], 590_480);
    assert_eq!(s2["retinere"], 140_590);
    assert_eq!(s2["de_plata"], 3_261_699);
    let s2 = issue(&mut ws, &mm, &s2);

    // One more cubic metre of A is past the estimate: refused, until a supplement with a reason.
    let e = statement(&mut ws, &mm, &d, &[(&a, 1_000)]).unwrap_err();
    assert!(e.to_string().contains("depășește"), "{e}");
    assert!(
        call(
            &mut ws,
            &mm,
            "suplimentare_save",
            json!({"articol": a, "cantitate": 5_000, "motiv": " ", "data": "2030-05-10"})
        )
        .is_err(),
        "a supplement has a reason"
    );
    call(
        &mut ws,
        &mm,
        "suplimentare_save",
        json!({"articol": a, "cantitate": 5_000, "motiv": "teren mai moale decât în studiu", "data": "2030-05-10"}),
    )
    .unwrap();
    // The refused statement left a draft with no lines (number 3); it is used now.
    let one = call(&mut ws, &mm, "deviz", json!({"id": d})).unwrap();
    let draft = one["situatii"]
        .as_array()
        .unwrap()
        .iter()
        .find(|x| x["numar"] == 3)
        .unwrap()
        .clone();
    call(
        &mut ws,
        &mm,
        "situatie_save",
        json!({"id": draft["id"], "version": draft["version"], "linii": [{"articol": a, "cantitate": 1_000}]}),
    )
    .unwrap();
    let s3 = call(&mut ws, &mm, "situatie", json!({"id": draft["id"]})).unwrap();
    assert_eq!(line(&s3, "A")["deviz"], 105_000);
    assert_eq!(line(&s3, "A")["rest"], 4_000);
    // 1 × 250 lei, VAT 52,50, retention 12,50, to pay 290,00
    assert_eq!(s3["valoare"], 25_000);
    assert_eq!(s3["de_plata"], 29_000);

    // Statement 1 was wrong: cancelled with a reason, kept, out of the previous quantities.
    assert!(
        call(
            &mut ws,
            &mm,
            "situatie_anulare",
            json!({"id": s1["id"], "version": s1["version"], "motiv": ""})
        )
        .is_err()
    );
    call(
        &mut ws,
        &mm,
        "situatie_anulare",
        json!({"id": s1["id"], "version": s1["version"], "motiv": "cantități greșite la tencuială"}),
    )
    .unwrap();
    let s1 = call(&mut ws, &mm, "situatie", json!({"id": s1["id"]})).unwrap();
    assert_eq!(s1["stare"], "anulata");
    assert_eq!(s1["motiv_anulare"], "cantități greșite la tencuială");
    let s2 = call(&mut ws, &mm, "situatie", json!({"id": s2["id"]})).unwrap();
    assert_eq!(line(&s2, "B")["anterior"], 0);
    assert_eq!(s2["valoare"], 2_811_809, "statement 2's own values do not change");
    // Its number is not used again.
    let s4 = call(
        &mut ws,
        &mm,
        "situatie_noua",
        json!({"deviz": d, "de_la": "2030-06-01", "pana_la": "2030-06-30", "data": "2030-07-01"}),
    )
    .unwrap();
    assert_eq!(s4["numar"], 4);
    // A cancelled one is cancelled once; a draft is not cancelled, it is deleted.
    assert!(
        call(
            &mut ws,
            &mm,
            "situatie_anulare",
            json!({"id": s1["id"], "version": s1["version"], "motiv": "iar"})
        )
        .is_err()
    );
    let v4 = call(&mut ws, &mm, "situatie", json!({"id": s4["id"]})).unwrap();
    call(
        &mut ws,
        &mm,
        "situatie_delete",
        json!({"id": s4["id"], "version": v4["version"]}),
    )
    .unwrap();
    // The estimate with issued statements is not deleted.
    assert!(
        call(
            &mut ws,
            &mm,
            "deviz_delete",
            json!({"id": d, "version": one["version"]})
        )
        .is_err()
    );

    // PDF and .xlsx.
    let pdf = tmp.path().join("situatia-2.pdf");
    call(
        &mut ws,
        &mm,
        "situatie_pdf",
        json!({"id": s2["id"], "dest": pdf, "executant": "Firma Mea SRL"}),
    )
    .unwrap();
    let doc = lopdf::Document::load(&pdf).unwrap();
    assert!(!doc.get_pages().is_empty());
    let xlsx = tmp.path().join("situatia-2.xlsx");
    call(&mut ws, &mm, "situatie_xlsx", json!({"id": s2["id"], "dest": xlsx})).unwrap();
    assert_eq!(&std::fs::read(&xlsx).unwrap()[..2], b"PK");
    let book = tmp.path().join("deviz.xlsx");
    call(&mut ws, &mm, "deviz_xlsx", json!({"id": d, "dest": book})).unwrap();
    assert_eq!(&std::fs::read(&book).unwrap()[..2], b"PK");
    let cancelled = tmp.path().join("situatia-1.pdf");
    call(&mut ws, &mm, "situatie_pdf", json!({"id": s1["id"], "dest": cancelled})).unwrap();
}

#[test]
fn retention_on_the_value_with_vat() {
    let (_t, mut ws, mm) = setup();
    let (d, [a, b, c]) = estimate(&mut ws, &mm, "cu_tva");
    let s1 = statement(&mut ws, &mm, &d, &[(&a, 40_000), (&b, 600_250), (&c, 1_000)]).unwrap();
    assert_eq!(s1["garantie_baza"], "cu_tva");
    assert_eq!(s1["retinere"], 111_399);
    assert_eq!(s1["de_plata"], 1_841_309 + 386_675 - 111_399);
    // Issued, it keeps the VAT and the retention it had, even if the estimate changes later.
    let s1 = issue(&mut ws, &mm, &s1);
    let one = call(&mut ws, &mm, "deviz", json!({"id": d})).unwrap();
    call(
        &mut ws,
        &mm,
        "deviz_save",
        json!({"id": d, "version": one["version"], "nume": "Hală", "data": "2030-03-01", "tva": 11, "garantie": 1000}),
    )
    .unwrap();
    let again = call(&mut ws, &mm, "situatie", json!({"id": s1["id"]})).unwrap();
    assert_eq!(again["tva"], 21);
    assert_eq!(again["retinere"], 111_399);
    // Bad values are refused.
    assert!(
        call(
            &mut ws,
            &mm,
            "deviz_save",
            json!({"nume": "X", "data": "2030-03-01", "tva": 19})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "deviz_save",
            json!({"nume": "X", "data": "2030-03-01", "garantie": 2500})
        )
        .is_err()
    );
    assert!(call(&mut ws, &mm, "deviz_save", json!({"nume": "X", "data": "1.3.2030"})).is_err());
}

#[test]
fn a_double_number_from_another_pc_is_shown() {
    let (_t, mut ws, mm) = setup();
    let (d, [a, _, _]) = estimate(&mut ws, &mm, "fara_tva");
    let s1 = statement(&mut ws, &mm, &d, &[(&a, 10_000)]).unwrap();
    issue(&mut ws, &mm, &s1);
    // Another PC, offline, issued its own number 1 with 95 m3 of A: together they are past the estimate.
    let mut f = Fields::new();
    for (k, v) in [
        ("deviz", json!(d)),
        ("numar", json!(1)),
        ("de_la", json!("2030-04-01")),
        ("pana_la", json!("2030-04-30")),
        ("data", json!("2030-05-02")),
        ("stare", json!("emisa")),
        ("motiv_anulare", json!("")),
        ("linii", json!([{"articol": a, "cantitate": 95_000}])),
        ("tva", json!(21)),
        ("garantie", json!(500)),
        ("garantie_baza", json!("fara_tva")),
        ("nota", json!("")),
        ("creat_ms", json!(9_999_999_999_999_i64)),
    ] {
        f.insert(k.into(), v);
    }
    ws.store_mut()
        .write(vec![
            Write::put(&format!("mod.{ID}.{STATEMENTS}"), Uuid::now_v7(), f).expect(0),
        ])
        .unwrap();
    let one = call(&mut ws, &mm, "deviz", json!({"id": d})).unwrap();
    let list = one["situatii"].as_array().unwrap();
    assert_eq!(list.len(), 2);
    assert!(list.iter().all(|x| x["numar_dublu"] == true), "{list:?}");
    assert!(list.iter().any(|x| x["depasire"] == true), "the overrun is shown");
    assert_eq!(one["articole"][0]["executat"], 105_000);
}
