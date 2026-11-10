//! 7.6 (D-087): the watch list kept by hand — a symbol once, a quote per moment once, the CSV with its report
//! (header, duplicates, a different price, wrong rows), the last quote and the change, alerts on the last quote
//! only (a year of history gives one notice, not dozens), negative prices, deleting an instrument with its data.

use base64::Engine as _;
use kgb_core::modules::ModuleManager;
use kgb_core::notifications;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_market::{ID, Market};
use serde_json::{Value, json};

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn b64(s: &str) -> String {
    base64::engine::general_purpose::STANDARD.encode(s.as_bytes())
}

#[test]
fn a_watch_list_kept_by_hand() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Market::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into()])
        .unwrap();

    let tlv = call(
        &mut ws,
        &mm,
        "instrument_save",
        json!({"simbol": "tlv", "nume": "Banca Transilvania", "fel": "actiune", "moneda": "ron"}),
    )
    .unwrap();
    let e = call(
        &mut ws,
        &mm,
        "instrument_save",
        json!({"simbol": "TLV", "nume": "Altceva", "fel": "actiune", "moneda": "RON"}),
    )
    .unwrap_err();
    assert!(e.to_string().contains("deja"), "{e}");
    assert!(
        call(
            &mut ws,
            &mm,
            "instrument_save",
            json!({"simbol": "X Y", "nume": "Spațiu", "fel": "actiune", "moneda": "RON"})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "instrument_save",
            json!({"simbol": "Z", "nume": "Z", "fel": "crypto", "moneda": "RON"})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "instrument_save",
            json!({"simbol": "Z", "nume": "Z", "fel": "altul", "moneda": "LE"})
        )
        .is_err()
    );

    // By hand: one quote per moment.
    call(
        &mut ws,
        &mm,
        "quote_add",
        json!({"instrument": tlv["id"], "moment": "2026-11-09T10:00", "pret": "30,50"}),
    )
    .unwrap();
    let e = call(
        &mut ws,
        &mm,
        "quote_add",
        json!({"instrument": tlv["id"], "moment": "2026-11-09 10:00", "pret": "31"}),
    )
    .unwrap_err();
    assert!(
        e.to_string().contains("există deja") && e.to_string().contains("30,50"),
        "{e}"
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "quote_add",
            json!({"instrument": tlv["id"], "moment": "30.02.2026", "pret": "1"})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "quote_add",
            json!({"instrument": tlv["id"], "moment": "2026-11-09T11:00", "pret": "1,23456"})
        )
        .is_err()
    );

    // The CSV: a header, Romanian dates and decimals, a duplicate, the same moment with another price, a bad row.
    let csv = "Data;Ora;Pret;Sursa\n05.11.2026;;29,80;BVB\n06.11.2026;;30,10;BVB\n09.11.2026;10:00;30,50;BVB\n09.11.2026;10:00;30,50;BVB\n10.11.2026;;31,20\n10.11.2026;;99;BVB\nnu e data;;1\n";
    let r = call(
        &mut ws,
        &mm,
        "import_csv",
        json!({"instrument": tlv["id"], "name": "tlv.csv", "data": b64(csv)}),
    )
    .unwrap();
    assert_eq!(r["adaugate"], 3, "{r}");
    let ex = r["existente"].as_array().unwrap();
    assert_eq!(ex.len(), 3, "{r}");
    assert!(ex.iter().any(|x| x["motiv"] == "există deja"));
    assert!(
        ex.iter().any(|x| x["motiv"]
            .as_str()
            .unwrap()
            .contains("alt preț (31,20 în listă, 99,00 în fișier)")),
        "{r}"
    );
    assert_eq!(r["refuzate"].as_array().unwrap().len(), 1);
    assert_eq!(r["separator"], "„;”");

    let q = call(&mut ws, &mm, "quotes", json!({"instrument": tlv["id"]})).unwrap();
    let moments: Vec<&str> = q
        .as_array()
        .unwrap()
        .iter()
        .map(|x| x["moment"].as_str().unwrap())
        .collect();
    assert_eq!(
        moments,
        [
            "2026-11-05T00:00",
            "2026-11-06T00:00",
            "2026-11-09T10:00",
            "2026-11-10T00:00"
        ]
    );
    assert_eq!(q[0]["sursa"], "BVB (CSV: tlv.csv)");
    assert_eq!(q[3]["sursa"], "CSV: tlv.csv");
    assert_eq!(q[2]["sursa"], "scris de mână");
    let some = call(
        &mut ws,
        &mm,
        "quotes",
        json!({"instrument": tlv["id"], "de_la": "2026-11-06", "pana_la": "2026-11-09"}),
    )
    .unwrap();
    assert_eq!(some.as_array().unwrap().len(), 2);

    let list = call(&mut ws, &mm, "list", json!({})).unwrap();
    assert_eq!(list[0]["simbol"], "TLV");
    assert_eq!(list[0]["ultima"]["pret_text"], "31,20");
    assert_eq!(list[0]["variatie"], 229, "+2,29 % since 30,50");

    // Alerts: only the last quote; one notice, not one per row of history.
    call(
        &mut ws,
        &mm,
        "alert_save",
        json!({"instrument": tlv["id"], "directie": "peste", "nivel": "30"}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "alert_save",
        json!({"instrument": tlv["id"], "directie": "sub", "nivel": "29,90"}),
    )
    .unwrap();
    let n = mm.remind_all(&mut ws, "2026-11-10").unwrap();
    assert_eq!(n.len(), 1, "{:?}", n.iter().map(|x| &x.titlu).collect::<Vec<_>>());
    assert_eq!(n[0].titlu, "TLV: 31,20 peste 30,00");
    assert!(n[0].text.contains("nu sfat de investiții"));
    assert!(
        mm.remind_all(&mut ws, "2026-11-10").unwrap().is_empty(),
        "the same quote is not announced twice"
    );
    // A new last quote that crosses again: a new notice.
    call(
        &mut ws,
        &mm,
        "quote_add",
        json!({"instrument": tlv["id"], "moment": "2026-11-11T09:00", "pret": "29,50", "sursa": "BVB"}),
    )
    .unwrap();
    let n = mm.remind_all(&mut ws, "2026-11-11").unwrap();
    assert_eq!(n.len(), 1);
    assert_eq!(n[0].titlu, "TLV: 29,50 sub 29,90");

    // Negative prices (oil, April 2020).
    let oil = call(
        &mut ws,
        &mm,
        "instrument_save",
        json!({"simbol": "WTI", "nume": "Petrol WTI", "fel": "marfa", "moneda": "USD"}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "quote_add",
        json!({"instrument": oil["id"], "moment": "2020-04-20", "pret": "-37,63"}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "alert_save",
        json!({"instrument": oil["id"], "directie": "sub", "nivel": "0"}),
    )
    .unwrap();
    let n = mm.remind_all(&mut ws, "2026-11-11").unwrap();
    assert_eq!(n.len(), 1);
    assert_eq!(n[0].titlu, "WTI: -37,63 sub 0,00");

    // Deleting an instrument takes its quotes and alerts with it.
    let list = call(&mut ws, &mm, "list", json!({})).unwrap();
    let w = list
        .as_array()
        .unwrap()
        .iter()
        .find(|x| x["simbol"] == "WTI")
        .unwrap()
        .clone();
    call(
        &mut ws,
        &mm,
        "instrument_delete",
        json!({"id": w["id"], "version": w["version"]}),
    )
    .unwrap();
    assert_eq!(
        call(&mut ws, &mm, "list", json!({})).unwrap().as_array().unwrap().len(),
        1
    );
    assert!(call(&mut ws, &mm, "quotes", json!({"instrument": oil["id"]})).is_err());
    assert_eq!(notifications::list(&ws, false, usize::MAX).unwrap().len(), 3);
}

#[test]
fn a_csv_with_commas_and_iso_dates() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Market::new())], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".into(), "notify.send".into()])
        .unwrap();
    let eur = call(
        &mut ws,
        &mm,
        "instrument_save",
        json!({"simbol": "EURRON", "nume": "Euro", "fel": "valuta", "moneda": "RON"}),
    )
    .unwrap();
    let csv = "\u{feff}date,close\n2026-11-03 13:00,4.9762\n2026-11-04 13:00,\"4.9771\"\n";
    let r = call(
        &mut ws,
        &mm,
        "import_csv",
        json!({"instrument": eur["id"], "name": "bnr.csv", "data": b64(csv)}),
    )
    .unwrap();
    assert_eq!(r["adaugate"], 2, "{r}");
    assert_eq!(r["separator"], "„,”");
    let q = call(&mut ws, &mm, "quotes", json!({"instrument": eur["id"]})).unwrap();
    assert_eq!(q[1]["pret_text"], "4,9771");
    assert_eq!(q[1]["moment"], "2026-11-04T13:00");
}
