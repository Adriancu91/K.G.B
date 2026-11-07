//! Step 4.9: forms — field types are validated (all problems reported at
//! once), answers keep the form version, a changed form with answers gets a
//! new version, exports (XLSX, CSV) reopen with exactly the saved answers.

use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_docs::{Docs, ID};
use kgb_sheets::book::{self, Format};
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

fn form(ws: &mut Workspace, mm: &ModuleManager) -> Value {
    call(
        ws,
        mm,
        "form_save",
        json!({"nume": "Inventar echipamente", "descriere": "Un rând pe echipament", "campuri": [
            {"eticheta": "Denumire", "tip": "text", "obligatoriu": true},
            {"eticheta": "Cantitate", "tip": "numar", "obligatoriu": true, "min": 0, "max": 10000},
            {"eticheta": "Data achiziției", "tip": "data"},
            {"eticheta": "Stare", "tip": "lista", "obligatoriu": true, "optiuni": ["Nou", "Bun", "Defect"]}
        ]}),
    )
    .unwrap()
}

#[test]
fn validation_reports_every_problem() {
    let (_t, mut ws, mm) = setup();
    let f = form(&mut ws, &mm);
    let keys: Vec<&str> = f["campuri"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c["cheie"].as_str().unwrap())
        .collect();
    assert_eq!(keys, ["denumire", "cantitate", "data_achizitiei", "stare"]);
    let err = call(
        &mut ws,
        &mm,
        "answer_save",
        json!({"formular": f["id"], "valori": {"denumire": " ", "cantitate": "10.500", "data_achizitiei": "31.02.2026", "stare": "Vechi"}}),
    )
    .unwrap_err()
    .to_string();
    for want in [
        "„Denumire” e obligatoriu",
        "„Cantitate” trebuie să fie între 0 și 10000",
        "nu este o dată",
        "nu este una dintre opțiuni",
    ] {
        assert!(err.contains(want), "{want} in {err}");
    }
    assert!(
        call(
            &mut ws,
            &mm,
            "answer_save",
            json!({"formular": f["id"], "valori": {"necunoscut": "x"}})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "answer_save",
            json!({"formular": f["id"], "valori": {"cantitate": "doi"}})
        )
        .is_err()
    );
    assert_eq!(
        call(&mut ws, &mm, "answers", json!({"id": f["id"]})).unwrap(),
        json!([])
    );

    // Romanian number and date forms are accepted and normalised.
    let a = call(
        &mut ws,
        &mm,
        "answer_save",
        json!({"formular": f["id"], "valori": {"denumire": "Laptop", "cantitate": "12,5", "data_achizitiei": "29.02.2028", "stare": "Bun"}}),
    )
    .unwrap();
    assert_eq!(a["formular_versiune"], 1);
    let saved = &call(&mut ws, &mm, "answers", json!({"id": f["id"]})).unwrap()[0];
    assert_eq!(saved["valori"]["cantitate"], 12.5);
    assert_eq!(saved["valori"]["data_achizitiei"], "2028-02-29");

    // Bad definitions are refused.
    for bad in [
        json!([]),
        json!([{"eticheta": "Listă", "tip": "lista", "optiuni": []}]),
        json!([{"eticheta": "L", "tip": "lista", "optiuni": ["a", "a"]}]),
        json!([{"eticheta": "N", "tip": "numar", "min": 5, "max": 1}]),
        json!([{"eticheta": "", "tip": "text"}]),
        json!([{"eticheta": "X", "tip": "fisier"}]),
    ] {
        assert!(
            call(&mut ws, &mm, "form_save", json!({"nume": "F", "campuri": bad})).is_err(),
            "{bad}"
        );
    }
}

#[test]
fn versions_and_identical_exports() {
    let (tmp, mut ws, mm) = setup();
    let f = form(&mut ws, &mm);
    let answers = [
        json!({"denumire": "Laptop Dell", "cantitate": "3", "data_achizitiei": "2026-11-01", "stare": "Nou"}),
        json!({"denumire": "=HYPERLINK(\"http://x\")", "cantitate": "1.234,5", "stare": "Defect"}),
    ];
    for v in &answers {
        call(&mut ws, &mm, "answer_save", json!({"formular": f["id"], "valori": v})).unwrap();
    }
    // Changing a form that has answers: version 2; the old answers keep version 1.
    let mut campuri = f["campuri"].as_array().unwrap().clone();
    campuri.push(json!({"eticheta": "Locație", "tip": "text"}));
    let f2 = call(
        &mut ws,
        &mm,
        "form_save",
        json!({"id": f["id"], "nume": "Inventar echipamente", "campuri": campuri}),
    )
    .unwrap();
    assert_eq!(f2["versiune"], 2);
    let a3 = call(
        &mut ws,
        &mm,
        "answer_save",
        json!({"formular": f["id"], "valori": {"denumire": "Imprimantă", "cantitate": 1, "stare": "Bun", "locatie": "Birou 2"}}),
    )
    .unwrap();
    assert_eq!(a3["formular_versiune"], 2);
    // A form with answers is not deleted by accident.
    assert!(call(&mut ws, &mm, "form_delete", json!({"id": f["id"]})).is_err());

    // XLSX: reopened, the cells are the answers.
    let x = tmp.path().join("raspunsuri.xlsx");
    let r = call(
        &mut ws,
        &mm,
        "export_answers",
        json!({"formular": f["id"], "format": "xlsx", "dest": x}),
    )
    .unwrap();
    assert_eq!(r["raspunsuri"], 3);
    let b = book::read(&std::fs::read(&x).unwrap(), Format::Xlsx).unwrap();
    let s = &b.sheets[0];
    let cell = |r: u32, c: u32| {
        s.values
            .get_value((r, c))
            .and_then(book::show)
            .map(|x| x.0)
            .unwrap_or_default()
    };
    let row = |r: u32| (0..7).map(|c| cell(r, c)).collect::<Vec<_>>();
    assert_eq!(s.name, "Inventar echipamente");
    assert_eq!(
        row(0)[1..],
        [
            "Versiunea formularului",
            "Denumire",
            "Cantitate",
            "Data achiziției",
            "Stare",
            "Locație"
        ]
    );
    assert_eq!(row(1)[1..], ["1", "Laptop Dell", "3", "01.11.2026", "Nou", ""]);
    assert_eq!(
        row(2)[1..],
        ["1", "=HYPERLINK(\"http://x\")", "1234.5", "", "Defect", ""]
    );
    assert_eq!(row(3)[1..], ["2", "Imprimantă", "1", "", "Bun", "Birou 2"]);
    assert_eq!(
        s.values.get_value((2, 3)).and_then(book::show).map(|x| x.1),
        Some('n'),
        "numbers stay numbers"
    );

    // CSV (Romanian style): the formula-looking text is neutralised.
    let c = tmp.path().join("raspunsuri.csv");
    call(
        &mut ws,
        &mm,
        "export_answers",
        json!({"formular": f["id"], "format": "csv", "stil": "ro", "dest": c}),
    )
    .unwrap();
    let text = String::from_utf8(std::fs::read(&c).unwrap()[3..].to_vec()).unwrap();
    assert!(text.contains(";\"'=HYPERLINK"), "{text}");
    assert!(text.contains(";1234,5;"), "{text}");
    let back = book::read(&std::fs::read(&c).unwrap(), Format::Csv).unwrap();
    assert_eq!(back.sheets[0].size(), (4, 7));

    // Deleting the answers, then the form.
    for a in call(&mut ws, &mm, "answers", json!({"id": f["id"]}))
        .unwrap()
        .as_array()
        .unwrap()
    {
        call(&mut ws, &mm, "answer_delete", json!({"id": a["id"]})).unwrap();
    }
    call(&mut ws, &mm, "form_delete", json!({"id": f["id"]})).unwrap();
    assert_eq!(call(&mut ws, &mm, "forms", json!({})).unwrap(), json!([]));
}
