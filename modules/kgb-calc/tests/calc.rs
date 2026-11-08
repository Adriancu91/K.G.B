//! Step 7.4 (D-065): calculator and conversions, with hand-checked examples.

use kgb_calc::exact::{Q, eval};
use kgb_calc::units::convert;
use kgb_calc::{Calc, ID, show};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use serde_json::{Value, json};

fn ev(s: &str) -> String {
    show(&eval(s).unwrap()).unwrap().0
}

#[test]
fn exact_arithmetic() {
    assert_eq!(ev("0,1 + 0,2"), "0,3", "no hidden rounding error");
    assert_eq!(ev("2 + 3 × 4"), "14");
    assert_eq!(ev("(2 + 3) × 4"), "20");
    assert_eq!(ev("10 - 2 - 3"), "5", "left to right");
    assert_eq!(ev("100 / 8"), "12,5");
    assert_eq!(ev("-3 × -2"), "6");
    assert_eq!(ev("200 × 19%"), "38");
    assert_eq!(ev("1.234,5 + 0,5"), "1.235", "Romanian thousands and decimals");
    assert_eq!(ev("1000000 × 1000000"), "1.000.000.000.000");
    let (third, exact) = show(&eval("1/3").unwrap()).unwrap();
    assert_eq!(
        (third.as_str(), exact),
        ("0,3333333333", false),
        "rounded for display and marked"
    );
    assert_eq!(ev("1/3 × 3"), "1", "exact inside");
    assert!(eval("1/0").unwrap_err().contains("zero"));
    assert!(eval("2 + ").is_err());
    assert!(eval("(2 + 3").unwrap_err().contains("paranteză"));
    assert!(eval("2 & 3").is_err());
    assert!(
        eval("99999999999999999999 × 99999999999999999999 × 99999999999999999999").is_err(),
        "overflow is an error"
    );
    assert_eq!(Q::parse("1.234").unwrap(), Q::int(1234), "dots group thousands");
    assert_eq!(Q::parse("10.000.000").unwrap(), Q::int(10_000_000));
    assert_eq!(
        Q::parse("2.5").unwrap(),
        Q::new(5, 2).unwrap(),
        "not a thousands group: a decimal point"
    );
    assert_eq!(
        Q::parse("0.125").unwrap(),
        Q::new(1, 8).unwrap(),
        "a leading zero is never a thousands group"
    );
}

fn conv(cat: &str, v: &str, a: &str, b: &str) -> String {
    show(&convert(cat, Q::parse(v).unwrap(), a, b).unwrap()).unwrap().0
}

#[test]
fn conversions_with_exact_factors() {
    assert_eq!(conv("lungime", "1", "in", "cm"), "2,54");
    assert_eq!(conv("lungime", "1", "mi", "km"), "1,609344");
    assert_eq!(conv("suprafata", "1", "ha", "m2"), "10.000");
    let (acre, exact) = show(&convert("suprafata", Q::int(1), "acru", "ha").unwrap()).unwrap();
    assert_eq!(
        (acre.as_str(), exact),
        ("0,4046856422", false),
        "11 decimals: shown rounded, marked"
    );
    assert_eq!(conv("volum", "1", "gal", "l"), "3,785411784");
    assert_eq!(conv("volum", "1", "m3", "l"), "1.000");
    assert_eq!(conv("masa", "1", "lb", "kg"), "0,45359237");
    assert_eq!(conv("masa", "16", "oz", "lb"), "1", "16 ounces are exactly a pound");
    assert_eq!(conv("energie", "1", "kwh", "mj"), "3,6");
    assert_eq!(conv("energie", "1", "kcal", "kj"), "4,184");
    assert_eq!(conv("temperatura", "100", "c", "f"), "212");
    assert_eq!(conv("temperatura", "-40", "c", "f"), "-40");
    assert_eq!(conv("temperatura", "0", "c", "k"), "273,15");
    assert_eq!(conv("temperatura", "98,6", "f", "c"), "37");
    assert!(
        convert("temperatura", Q::parse("-300").unwrap(), "c", "k").is_err(),
        "below absolute zero"
    );
    assert!(
        convert("lungime", Q::int(1), "m", "kg").is_err(),
        "units of another category"
    );
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Calc::new())], kgb_core::CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into()]).unwrap();
    (t, ws, mm)
}

fn call(mm: &ModuleManager, ws: &mut Workspace, cmd: &str, a: Value) -> Value {
    mm.call(ws, None, ID, cmd, a).unwrap_or_else(|e| panic!("{cmd}: {e}"))
}

#[test]
fn money_calculations_in_bani() {
    let (_t, mut ws, mm) = setup();
    // VAT 21% on 100 lei net = 21 lei; from 121 gross back to 100 net.
    let v = call(&mm, &mut ws, "tva", json!({"suma": "100", "cota": "21", "din": "net"}));
    assert_eq!((v["tva"].clone(), v["brut"].clone()), (json!("21,00"), json!("121,00")));
    let v = call(&mm, &mut ws, "tva", json!({"suma": "121", "cota": "21", "din": "brut"}));
    assert_eq!((v["net"].clone(), v["tva"].clone()), (json!("100,00"), json!("21,00")));
    // 0,33 lei × 21% = 0,0693 → 0,07 lei (half away from zero, to the ban).
    let v = call(&mm, &mut ws, "tva", json!({"suma": "0,33", "cota": "21", "din": "net"}));
    assert_eq!(v["tva_bani"], 7);
    // Gross 10 lei at 11%: net = 10 / 1,11 = 9,009… → 9,01; VAT = 0,99 (net + VAT = gross exactly).
    let v = call(&mm, &mut ws, "tva", json!({"suma": "10", "cota": "11", "din": "brut"}));
    assert_eq!(
        (v["net"].clone(), v["tva"].clone(), v["brut"].clone()),
        (json!("9,01"), json!("0,99"), json!("10,00"))
    );

    // Cost 80, price 100: markup 25%, margin 20%.
    let v = call(&mm, &mut ws, "adaos", json!({"cost": "80", "pret": "100"}));
    assert_eq!(
        (v["adaos_pct"].clone(), v["marja_pct"].clone(), v["profit"].clone()),
        (json!("25"), json!("20"), json!("20,00"))
    );
    // Cost 80 + 30% markup = 104.
    let v = call(&mm, &mut ws, "adaos", json!({"cost": "80", "adaos": "30"}));
    assert_eq!(v["pret"], "104,00");
    assert!(
        mm.call(&mut ws, None, ID, "adaos", json!({"cost": "0", "pret": "1"}))
            .is_err()
    );

    // Percentages.
    assert_eq!(
        call(&mm, &mut ws, "procent", json!({"tip": "din", "a": "15", "b": "200"}))["rezultat"],
        "30"
    );
    assert_eq!(
        call(
            &mm,
            &mut ws,
            "procent",
            json!({"tip": "cat_la_suta", "a": "30", "b": "200"})
        )["rezultat"],
        "15"
    );
    assert_eq!(
        call(
            &mm,
            &mut ws,
            "procent",
            json!({"tip": "variatie", "a": "80", "b": "100"})
        )["rezultat"],
        "25"
    );

    // Simple interest: 10.000 lei × 5% × 73 days / 365 = 100 lei.
    let v = call(
        &mm,
        &mut ws,
        "dobanda",
        json!({"suma": "10.000", "rata": "5", "zile": 73}),
    );
    assert_eq!(
        (v["dobanda"].clone(), v["total"].clone()),
        (json!("100,00"), json!("10.100,00"))
    );
}

#[test]
fn history_is_kept_and_bounded() {
    let (_t, mut ws, mm) = setup();
    for i in 0..205 {
        call(&mm, &mut ws, "calc", json!({"expresie": format!("{i} + 1")}));
    }
    let h = call(&mm, &mut ws, "istoric", json!({}));
    assert_eq!(h.as_array().unwrap().len(), 50, "the screen shows the last 50");
    assert_eq!(h[0]["expresie"], "204 + 1", "newest first");
    assert_eq!(h[0]["rezultat"], "205");
    assert_eq!(
        call(&mm, &mut ws, "istoric_sterge", json!({}))["sterse"],
        200,
        "at most 200 kept"
    );
    assert!(call(&mm, &mut ws, "istoric", json!({})).as_array().unwrap().is_empty());
    assert!(mm.call(&mut ws, None, ID, "calc", json!({"expresie": "1/0"})).is_err());
}
