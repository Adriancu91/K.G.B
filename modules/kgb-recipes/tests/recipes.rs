//! 7.9e Rețete și costuri: the net quantity and the gross from the loss (potatoes 0,800 kg net at 20 % = 1,000 kg
//! gross), a semi-finished sauce inside a dish, a recipe containing itself refused, allergens through the sauce
//! (and none ticked is not „none”), the proposed price and the margin, an old price warned, the consumption list
//! through the semi-finished one, deleting only what is not used.

use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_recipes::{ID, Recipes, consumption_csv};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Recipes::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "files.own".into()])
        .unwrap();
    (tmp, ws, mm)
}

const T: &str = "2030-06-01";

#[test]
fn costs_allergens_and_consumption() {
    let (tmp, mut ws, mm) = setup();
    let ing = |ws: &mut Workspace, a: Value| call(ws, &mm, "ingredient_save", a).unwrap()["id"].clone();
    // Potatoes 2,50 lei/kg with 20 % loss; milk 6,00 lei/l; butter 40,00 lei/kg (price from long ago); flour.
    let potato = ing(
        &mut ws,
        json!({"nume": "Cartofi", "um": "kg", "pret": 250, "pret_data": T, "pierdere": 2000}),
    );
    let milk = ing(
        &mut ws,
        json!({"nume": "Lapte", "um": "l", "pret": 600, "pret_data": T, "alergeni": ["lapte"]}),
    );
    let butter = ing(
        &mut ws,
        json!({"nume": "Unt", "um": "kg", "pret": 4000, "pret_data": "2029-01-01", "alergeni": ["lapte"]}),
    );
    let flour = ing(
        &mut ws,
        json!({"nume": "Făină", "um": "kg", "pret": 300, "pret_data": T, "alergeni": ["gluten"]}),
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "ingredient_save",
            json!({"nume": "X", "um": "kg", "alergeni": ["nuci"]})
        )
        .is_err(),
        "only the 14"
    );

    // A white sauce: 1 l of milk, 0,050 kg butter, 0,050 kg flour → 1 l of sauce.
    let sauce = call(&mut ws, &mm, "reteta_save", json!({"nume": "Sos alb", "fel": "semipreparat", "lot": 1000, "unitate_lot": "l",
        "linii": [{"tip": "ingredient", "id": milk, "cantitate": 1000}, {"tip": "ingredient", "id": butter, "cantitate": 50},
                  {"tip": "ingredient", "id": flour, "cantitate": 50}]}))
    .unwrap()["id"]
        .clone();
    // Mashed potatoes for 4 portions: 0,800 kg potatoes (net), 0,200 l sauce; 100 % mark-up, VAT 11 %.
    let dish = call(&mut ws, &mm, "reteta_save", json!({"nume": "Piure", "fel": "preparat", "lot": 4000, "unitate_lot": "porție",
        "adaos": 10000, "tva": 11, "randament_preparare": 9000,
        "linii": [{"tip": "ingredient", "id": potato, "cantitate": 800}, {"tip": "reteta", "id": sauce, "cantitate": 200}]}))
    .unwrap()["id"]
        .clone();
    assert!(
        call(
            &mut ws,
            &mm,
            "reteta_save",
            json!({"nume": "R", "fel": "preparat", "lot": 1000, "unitate_lot": "buc", "tva": 9})
        )
        .is_err(),
        "21, 11 or 0"
    );

    let v = call(&mut ws, &mm, "reteta", json!({"id": dish, "azi": T})).unwrap();
    let c = &v["calcul"];
    let lines = c["linii"].as_array().unwrap();
    assert!(
        (lines[0]["brut"].as_f64().unwrap() - 1.0).abs() < 1e-9,
        "0,800 net → 1,000 gross"
    );
    assert!((lines[0]["cost"].as_f64().unwrap() - 250.0).abs() < 1e-9);
    // Sauce per litre: 600 + 0,05 × 4000 + 0,05 × 300 = 815 bani; 0,2 l = 163 bani. Lot: 413 bani; portion 103,25.
    assert!((lines[1]["cost"].as_f64().unwrap() - 163.0).abs() < 1e-9);
    assert!((c["cost_unitate"].as_f64().unwrap() - 103.25).abs() < 1e-9);
    // Proposed: 103,25 × 2 × 1,11 = 229,215 → 229 bani, rounded once.
    assert_eq!(c["pret_propus"], 229);
    assert_eq!(c["alergeni"], json!(["gluten", "lapte"]), "through the sauce");
    assert!(
        c["avertismente"]
            .as_array()
            .unwrap()
            .iter()
            .any(|w| w.as_str().unwrap().contains("Unt")),
        "an old price"
    );
    assert!(
        (c["net_dupa_preparare_kg"].as_f64().unwrap() - 0.72).abs() < 1e-9,
        "0,800 kg × 90 %"
    );

    // A sale price written: margin and food cost from it (2,22 lei with 11 % VAT → 2,00 net; cost 1,0325).
    let mut r = v.clone();
    r["pret_vanzare"] = json!(222);
    let save = json!({"id": dish, "version": v["version"], "nume": "Piure", "fel": "preparat", "lot": 4000, "unitate_lot": "porție",
        "adaos": 10000, "tva": 11, "pret_vanzare": 222, "randament_preparare": 9000, "linii": v["linii"]});
    call(&mut ws, &mm, "reteta_save", save).unwrap();
    let c = call(&mut ws, &mm, "reteta", json!({"id": dish, "azi": T})).unwrap()["calcul"].clone();
    assert_eq!((c["marja"].as_i64(), c["food_cost"].as_i64()), (Some(4837), Some(5163)));

    // The sauce may not contain the dish (a cycle).
    let s = call(&mut ws, &mm, "reteta", json!({"id": sauce, "azi": T})).unwrap();
    let e = call(
        &mut ws,
        &mm,
        "reteta_save",
        json!({"id": sauce, "version": s["version"], "nume": "Sos alb", "fel": "semipreparat",
        "lot": 1000, "unitate_lot": "l", "linii": [{"tip": "reteta", "id": dish, "cantitate": 1000}]}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("pe ea însăși"), "{e}");

    // No allergen ticked: an empty list (the page says „nebifat”, never „fără alergeni”).
    let plain = call(
        &mut ws,
        &mm,
        "reteta_save",
        json!({"nume": "Cartofi fierți", "fel": "preparat", "lot": 1000, "unitate_lot": "porție",
        "linii": [{"tip": "ingredient", "id": potato, "cantitate": 300}]}),
    )
    .unwrap()["id"]
        .clone();
    assert_eq!(
        call(&mut ws, &mm, "reteta", json!({"id": plain, "azi": T})).unwrap()["calcul"]["alergeni"],
        json!([])
    );

    // Consumption for 8 portions of mashed potatoes: 2 kg potatoes (gross), 0,4 l milk, 0,02 kg butter and flour.
    let use_ = call(
        &mut ws,
        &mm,
        "consum",
        json!({"linii": [{"reteta": dish, "portii": 8000}]}),
    )
    .unwrap();
    let q = |name: &str| {
        use_.as_array().unwrap().iter().find(|r| r["nume"] == name).unwrap()["cantitate"]
            .as_f64()
            .unwrap()
    };
    assert!((q("Cartofi") - 2.0).abs() < 1e-9 && (q("Lapte") - 0.4).abs() < 1e-9 && (q("Unt") - 0.02).abs() < 1e-9);
    let csv = consumption_csv(use_.as_array().unwrap());
    assert!(
        csv.starts_with('\u{feff}') && csv.contains("\"Cartofi\";2,000;\"kg\";5,00"),
        "{csv}"
    );
    let dest = tmp.path().join("consum.csv");
    call(
        &mut ws,
        &mm,
        "consum_export",
        json!({"linii": [{"reteta": dish, "portii": 8000}], "dest": dest}),
    )
    .unwrap();
    assert!(std::fs::read_to_string(&dest).unwrap().contains("Făină"));
    let book = tmp.path().join("consum.xlsx");
    call(
        &mut ws,
        &mm,
        "consum_export",
        json!({"linii": [{"reteta": dish, "portii": 8000}], "dest": book}),
    )
    .unwrap();
    assert_eq!(&std::fs::read(&book).unwrap()[..2], b"PK", "an .xlsx (zip)");

    // Used things are not deleted.
    let ings = call(&mut ws, &mm, "ingrediente", json!({})).unwrap();
    let p = ings
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["nume"] == "Cartofi")
        .unwrap()
        .clone();
    assert!(
        call(
            &mut ws,
            &mm,
            "ingredient_delete",
            json!({"id": p["id"], "version": p["version"]})
        )
        .is_err()
    );
    let s = call(&mut ws, &mm, "reteta", json!({"id": sauce, "azi": T})).unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "reteta_delete",
            json!({"id": sauce, "version": s["version"]})
        )
        .is_err()
    );
    let copy = call(&mut ws, &mm, "reteta_copie", json!({"id": dish})).unwrap();
    let cv = call(&mut ws, &mm, "reteta", json!({"id": copy["id"], "azi": T})).unwrap();
    assert_eq!(cv["nume"], "Piure (copie)");
    call(
        &mut ws,
        &mm,
        "reteta_delete",
        json!({"id": copy["id"], "version": cv["version"]}),
    )
    .unwrap();
}
