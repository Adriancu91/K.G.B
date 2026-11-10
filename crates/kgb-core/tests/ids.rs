//! 7.4m-2: the Romanian codes have one rule in the app, the same as the spreadsheet window's (cos/src/sheets/ids.ts).
//! The shared list tests/data/ids.json holds the window's answers; app/cos/tests/kgb-ids-parity.test.mjs checks
//! the window against the same list.

use kgb_core::ids::{cnp_valid, compact, cui_clean, cui_valid, iban_valid};
use serde_json::Value;

#[test]
fn the_core_agrees_with_the_window_on_every_shared_code() {
    let list: Value = serde_json::from_str(include_str!("data/ids.json")).unwrap();
    let rows = list["rows"].as_array().unwrap();
    assert!(rows.len() >= 40);
    let mut wrong = Vec::new();
    for r in rows {
        let (kind, code, want) = (
            r["kind"].as_str().unwrap(),
            r["code"].as_str().unwrap(),
            r["valid"].as_bool().unwrap(),
        );
        let got = match kind {
            "cui" => cui_valid(code),
            "iban" => iban_valid(code),
            "cnp" => cnp_valid(code),
            other => panic!("unknown kind {other}"),
        };
        if got != want {
            // The CNPs of the list are made up; still, only the kind and the position are printed.
            wrong.push(format!(
                "{kind} #{}: {got} != {want}",
                rows.iter().position(|x| x == r).unwrap()
            ));
        }
    }
    assert!(wrong.is_empty(), "{wrong:?}");
    for kind in ["cui", "iban", "cnp"] {
        let of: Vec<bool> = rows
            .iter()
            .filter(|r| r["kind"] == kind)
            .map(|r| r["valid"].as_bool().unwrap())
            .collect();
        assert!(
            of.contains(&true) && of.contains(&false),
            "{kind}: both good and wrong codes"
        );
    }
}

#[test]
fn codes_are_stored_without_spaces() {
    assert_eq!(cui_clean(" ro 143 998 40 "), "RO14399840");
    assert_eq!(compact("RO49 AAAA 1B31 0075 9384 0000"), "RO49AAAA1B31007593840000");
    assert!(cui_valid("RO 143 998 40"));
}
