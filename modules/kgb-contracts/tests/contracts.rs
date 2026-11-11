//! 7.9e Contracte și abonamente: the partner from the core's directory, the periods due (monthly from the middle
//! of a month, quarterly on the 28th), the yearly indexation at the contract's anniversary, one mark per period
//! (and the double mark two PCs can make offline, shown), the renewed end computed (not written), the calendar
//! of notice deadlines and renewals, and reminders without partners' names, once.

use kgb_contracts::{BILLINGS, Contracts, ID};
use kgb_core::modules::ModuleManager;
use kgb_core::partners::{self, Partner};
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_store::{Fields, Write};
use serde_json::{Value, json};
use uuid::Uuid;

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Contracts::new())], CORE_VERSION).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &["storage.own".into(), "notify.send".into(), "partners.read".into()],
    )
    .unwrap();
    (tmp, ws, mm)
}

fn periods_of(v: &Value) -> Vec<(String, i64)> {
    v.as_array()
        .unwrap()
        .iter()
        .map(|x| (x["perioada"].as_str().unwrap().to_string(), x["suma"].as_i64().unwrap()))
        .collect()
}

#[test]
fn periods_indexation_and_marks() {
    let (_t, mut ws, mm) = setup();
    let pid = partners::save(
        ws.store_mut(),
        Partner {
            tip: "client".into(),
            denumire: "Alfa Servicii SRL".into(),
            cui: "RO14399840".into(),
            ..Partner::default()
        },
    )
    .unwrap();
    let c = call(
        &mut ws,
        &mm,
        "contract_save",
        json!({"numar": "12/2030", "titlu": "Mentenanță lunară", "parte": "client",
        "partener": pid, "inceput": "2030-01-15", "stare": "activ"}),
    )
    .unwrap();
    let cid = c["id"].clone();
    let monthly = call(&mut ws, &mm, "abonament_save", json!({"contract": cid, "denumire": "Abonament mentenanță", "um": "lună",
        "cantitate": 1000, "pret": 10_000, "perioada": "lunar", "zi_facturare": 5, "de_la": "2030-01-15", "indexare": 500}))
    .unwrap();
    let quarterly = call(
        &mut ws,
        &mm,
        "abonament_save",
        json!({"contract": cid, "denumire": "Revizie", "cantitate": 2500,
        "pret": 4_000, "tva": 11, "perioada": "trimestrial", "zi_facturare": 28, "de_la": "2030-02-10"}),
    )
    .unwrap();

    let one = call(&mut ws, &mm, "contract", json!({"id": cid, "azi": "2030-01-20"})).unwrap();
    assert_eq!(
        one["partener_nume"], "Alfa Servicii SRL",
        "the name comes from the card"
    );
    assert_eq!(one["partener_cui"], "RO14399840");
    assert_eq!(one["linii"].as_array().unwrap().len(), 2);
    assert_eq!(one["sfarsit_efectiv"], "", "indefinite");

    let due = call(
        &mut ws,
        &mm,
        "de_facturat",
        json!({"pana_la": "2030-05-31", "azi": "2030-03-01"}),
    )
    .unwrap();
    let list = due.as_array().unwrap();
    let monthly_list: Vec<&Value> = list.iter().filter(|x| x["abonament"] == monthly["id"]).collect();
    assert_eq!(
        monthly_list
            .iter()
            .map(|x| x["data_facturare"].as_str().unwrap())
            .collect::<Vec<_>>(),
        ["2030-01-15", "2030-02-05", "2030-03-05", "2030-04-05", "2030-05-05"],
        "the first invoice not before the start"
    );
    assert_eq!(monthly_list[0]["intarziata"], true);
    assert_eq!(monthly_list[2]["intarziata"], false);
    let q: Vec<&Value> = list.iter().filter(|x| x["abonament"] == quarterly["id"]).collect();
    assert_eq!(
        q.iter()
            .map(|x| (x["perioada"].as_str().unwrap(), x["suma"].as_i64().unwrap()))
            .collect::<Vec<_>>(),
        [("2030-02", 10_000), ("2030-05", 10_000)],
        "2.5 × 40.00 every three months"
    );
    assert_eq!(q[0]["pana_la"], "2030-04-30");

    // The yearly indexation: from the period that starts on or after 2031-01-15.
    let year = call(
        &mut ws,
        &mm,
        "de_facturat",
        json!({"pana_la": "2031-03-31", "contract": cid}),
    )
    .unwrap();
    assert!(
        periods_of(&year).contains(&("2031-02".to_string(), 10_000)),
        "the quarterly line has no indexation"
    );
    let monthly_2031: Vec<i64> = year
        .as_array()
        .unwrap()
        .iter()
        .filter(|x| x["abonament"] == monthly["id"] && x["perioada"].as_str().unwrap().starts_with("2031"))
        .map(|x| x["pret_unitar"].as_i64().unwrap())
        .collect();
    assert_eq!(monthly_2031, [10_000, 10_500, 10_500]);

    // One mark per period; the invoice number is needed for an issued one.
    let mark = |ws: &mut Workspace, per: &str, st: &str, nr: &str| {
        call(
            ws,
            &mm,
            "facturare_marcheaza",
            json!({"abonament": monthly["id"], "perioada": per, "stare": st, "factura": nr, "data": "2030-02-05"}),
        )
    };
    assert!(mark(&mut ws, "2030-01", "emisa", "").is_err());
    let r = mark(&mut ws, "2030-01", "emisa", "KGB 0001").unwrap();
    assert_eq!(r["suma"], 10_000);
    let e = mark(&mut ws, "2030-01", "emisa", "KGB 0002").unwrap_err();
    assert!(e.to_string().contains("deja marcată"), "{e}");
    assert!(mark(&mut ws, "2030-03-01", "emisa", "X").is_err());
    assert!(
        mark(&mut ws, "2029-12", "emisa", "X").is_err(),
        "not a period of the line"
    );
    mark(&mut ws, "2030-02", "sarita", "").unwrap();
    let due = call(
        &mut ws,
        &mm,
        "de_facturat",
        json!({"pana_la": "2030-03-31", "contract": cid}),
    )
    .unwrap();
    assert_eq!(
        due.as_array()
            .unwrap()
            .iter()
            .filter(|x| x["abonament"] == monthly["id"])
            .map(|x| x["perioada"].as_str().unwrap())
            .collect::<Vec<_>>(),
        ["2030-03"]
    );

    // A line with marked periods keeps its period and start; it is stopped, not deleted.
    let v = one["linii"]
        .as_array()
        .unwrap()
        .iter()
        .find(|l| l["id"] == monthly["id"])
        .unwrap()["version"]
        .clone();
    assert!(
        call(
            &mut ws,
            &mm,
            "abonament_save",
            json!({"id": monthly["id"], "version": v, "contract": cid, "denumire": "Abonament",
        "cantitate": 1000, "pret": 10_000, "perioada": "trimestrial", "de_la": "2030-01-15"})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "abonament_delete",
            json!({"id": monthly["id"], "version": v})
        )
        .is_err()
    );
    // An activated contract is not deleted.
    let one = call(&mut ws, &mm, "contract", json!({"id": cid, "azi": "2030-01-20"})).unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "contract_delete",
            json!({"id": cid, "version": one["version"]})
        )
        .is_err()
    );

    // Two PCs offline mark the same period: both stay, both shown.
    let mut f = Fields::new();
    f.insert("contract".into(), json!(cid));
    f.insert("abonament".into(), json!(monthly["id"]));
    f.insert("perioada".into(), json!("2030-01"));
    f.insert("suma".into(), json!(10_000));
    f.insert("stare".into(), json!("emisa"));
    f.insert("factura".into(), json!("KGB 0009"));
    f.insert("data".into(), json!("2030-02-06"));
    f.insert("creat_ms".into(), json!(1));
    ws.store_mut()
        .write(vec![
            Write::put(&format!("mod.{ID}.{BILLINGS}"), Uuid::now_v7(), f).expect(0),
        ])
        .unwrap();
    let one = call(&mut ws, &mm, "contract", json!({"id": cid, "azi": "2030-02-10"})).unwrap();
    let marks: Vec<(String, bool)> = one["facturari"]
        .as_array()
        .unwrap()
        .iter()
        .map(|x| {
            (
                x["perioada"].as_str().unwrap().to_string(),
                x["dubla"].as_bool().unwrap(),
            )
        })
        .collect();
    assert_eq!(
        marks,
        [
            ("2030-01".into(), true),
            ("2030-01".into(), true),
            ("2030-02".into(), false)
        ]
    );
}

#[test]
fn renewal_calendar_and_reminders() {
    let (_t, mut ws, mm) = setup();
    // A rent paid to a supplier, renewed for 12 months unless denounced 30 days before.
    let rent = call(
        &mut ws,
        &mm,
        "contract_save",
        json!({"numar": "C-7", "titlu": "Chirie depozit", "parte": "furnizor",
        "partener_nume": "Imobil Vest SRL", "inceput": "2030-01-01", "sfarsit": "2030-12-31", "prelungire_auto": true,
        "prelungire_luni": 12, "preaviz_zile": 30, "stare": "activ"}),
    )
    .unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "contract_save",
            json!({"titlu": "X", "parte": "client", "partener_nume": "Y",
        "inceput": "2030-01-01", "prelungire_auto": true})
        )
        .is_err(),
        "indefinite contracts are not renewed"
    );
    // An insurance that simply ends.
    call(
        &mut ws,
        &mm,
        "contract_save",
        json!({"titlu": "Asigurare flotă", "parte": "furnizor", "partener_nume": "Asig SA",
        "inceput": "2030-01-01", "sfarsit": "2030-12-20", "stare": "activ"}),
    )
    .unwrap();

    let l = call(
        &mut ws,
        &mm,
        "contracte",
        json!({"azi": "2031-03-01", "text": "chirie"}),
    )
    .unwrap();
    assert_eq!(l.as_array().unwrap().len(), 1);
    assert_eq!(l[0]["sfarsit_efectiv"], "2031-12-31");
    assert_eq!(l[0]["prelungit"], true);
    assert_eq!(l[0]["preaviz_pana"], "2031-12-01");
    assert_eq!(l[0]["sfarsit"], "2030-12-31", "the written end is not changed");
    let l = call(
        &mut ws,
        &mm,
        "contracte",
        json!({"azi": "2030-06-01", "parte": "furnizor"}),
    )
    .unwrap();
    assert_eq!(l.as_array().unwrap().len(), 2);

    let cal = call(
        &mut ws,
        &mm,
        "calendar",
        json!({"de_la": "2030-11-01", "pana_la": "2031-12-31"}),
    )
    .unwrap();
    let ev: Vec<(String, String)> = cal
        .as_array()
        .unwrap()
        .iter()
        .map(|e| {
            (
                e["data"].as_str().unwrap().to_string(),
                e["fel"].as_str().unwrap().to_string(),
            )
        })
        .collect();
    assert_eq!(
        ev,
        [
            ("2030-12-01".into(), "preaviz".into()),
            ("2030-12-20".into(), "expira".into()),
            ("2030-12-31".into(), "prelungire".into()),
            ("2031-12-01".into(), "preaviz".into()),
            ("2031-12-31".into(), "prelungire".into()),
        ]
    );

    // A line due on the 1st of each month, so something is to be invoiced.
    call(
        &mut ws,
        &mm,
        "abonament_save",
        json!({"contract": rent["id"], "denumire": "Chirie", "um": "lună", "cantitate": 1000,
        "pret": 500_000, "perioada": "lunar", "de_la": "2030-01-01"}),
    )
    .unwrap();

    let n = mm.remind_all(&mut ws, "2030-11-25").unwrap();
    let titles: Vec<&str> = n.iter().map(|x| x.titlu.as_str()).collect();
    assert!(titles.contains(&"Azi: 11 facturări de emis"), "{titles:?}");
    assert!(titles.contains(&"Un contract expiră în 30 de zile"), "{titles:?}");
    assert!(
        titles.contains(&"Ultima zi de preaviz pe 2030-12-01: un contract"),
        "{titles:?}"
    );
    for x in &n {
        assert!(
            !x.titlu.contains("Imobil")
                && !x.text.contains("Imobil")
                && !x.titlu.contains("Asig")
                && !x.text.contains("Asig"),
            "no partners' names in a notice"
        );
    }
    assert!(mm.remind_all(&mut ws, "2030-11-25").unwrap().is_empty(), "once");
    let n = mm.remind_all(&mut ws, "2030-12-01").unwrap();
    let titles: Vec<&str> = n.iter().map(|x| x.titlu.as_str()).collect();
    assert!(
        titles.contains(&"Azi e ultima zi de preaviz: un contract"),
        "{titles:?}"
    );
    assert!(
        !titles.iter().any(|t| t.contains("expiră")),
        "the expiry once a week: {titles:?}"
    );
}
