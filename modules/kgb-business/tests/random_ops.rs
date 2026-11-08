//! Step 5.8: 1.000 random operations (receipts, issues, transfers,
//! inventories, invoices, stornos, expenses, cash in and out, links), many of
//! them refused on purpose (too much, wrong totals, twice). Afterwards the
//! verification recomputes everything from the records and must find no
//! problem — also after reopening the workspace.

use kgb_business::{Business, ID};
use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use serde_json::{Value, json};

/// A small deterministic generator (the same sequence on every run).
struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        self.0 >> 33
    }
    fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }
}

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

#[test]
fn thousand_random_operations_stay_consistent() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    let mut ws = Workspace::create(&dir, "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Business::new())], CORE_VERSION).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &["storage.own".into(), "notify.send".into(), "files.own".into()],
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "settings_save",
        json!({"firma": {"firma_nume": "Noi SRL", "firma_cui": "RO18547290"}}),
    )
    .unwrap();
    let ser = call(&mut ws, &mm, "series_save", json!({"cod": "F"})).unwrap();
    let ch = call(&mut ws, &mm, "series_save", json!({"cod": "CH"})).unwrap();
    let partner = call(
        &mut ws,
        &mm,
        "partner_save",
        json!({"nume": "Partener SRL", "tip": "ambele"}),
    )
    .unwrap();
    let products: Vec<Value> = (0..4)
        .map(|k| {
            call(
                &mut ws,
                &mm,
                "product_save",
                json!({"cod": format!("P{k}"), "nume": format!("Produs {k}"), "um": "buc"}),
            )
            .unwrap()
        })
        .collect();
    let whs: Vec<Value> = (0..3)
        .map(|k| call(&mut ws, &mm, "warehouse_save", json!({"nume": format!("D{k}")})).unwrap())
        .collect();
    let casa = call(&mut ws, &mm, "account_save", json!({"tip": "casa", "nume": "Casa"})).unwrap();
    let banca = call(&mut ws, &mm, "account_save", json!({"tip": "banca", "nume": "Banca"})).unwrap();

    let mut rng = Rng(20_261_108);
    let mut stock_docs: Vec<Value> = Vec::new();
    let mut invoices: Vec<Value> = Vec::new();
    let mut payments: Vec<Value> = Vec::new();
    let (mut ok, mut refused) = (0, 0);
    for n in 0..1_000 {
        let day = format!("2026-{:02}-{:02}", 1 + n / 100, 1 + (n % 28));
        let p = &products[rng.below(4) as usize];
        let w = &whs[rng.below(3) as usize];
        let qty = format!("{},{}", rng.below(20), rng.below(1000));
        let price = format!("{},{:02}", 1 + rng.below(200), rng.below(100));
        let r = match rng.below(12) {
            0 | 1 => call(
                &mut ws,
                &mm,
                "receive",
                json!({"depozit": w["id"], "numar": format!("N{n}"), "data": day, "linii": [{"produs": p["id"], "cantitate": qty, "pret_unitar": price}]}),
            ),
            2 => call(
                &mut ws,
                &mm,
                "issue",
                json!({"depozit": w["id"], "numar": format!("B{n}"), "data": day, "linii": [{"produs": p["id"], "cantitate": qty}]}),
            ),
            3 => {
                let to = &whs[rng.below(3) as usize];
                call(
                    &mut ws,
                    &mm,
                    "transfer",
                    json!({"depozit": w["id"], "depozit_destinatie": to["id"], "numar": format!("T{n}"), "data": day, "linii": [{"produs": p["id"], "cantitate": qty}]}),
                )
            }
            4 => call(
                &mut ws,
                &mm,
                "inventory",
                json!({"depozit": w["id"], "numar": format!("I{n}"), "data": day, "linii": [{"produs": p["id"], "cantitate_numarata": qty}]}),
            ),
            5 if !stock_docs.is_empty() => {
                let d = &stock_docs[rng.below(stock_docs.len() as u64) as usize];
                call(&mut ws, &mm, "storno", json!({"document": d["document"], "data": day}))
            }
            6 => {
                let with_stock = rng.below(2) == 0;
                let rate = [21, 11, 0][rng.below(3) as usize];
                let mut inv = json!({"serie": ser["id"], "partener": partner["id"], "data": day,
                    "linii": [{"produs": p["id"], "cantitate": qty, "pret_unitar": price, "cota_tva": rate},
                              {"descriere": "Servicii", "cantitate": "1", "pret_unitar": price, "cota_tva": 21}]});
                if with_stock {
                    inv["depozit"] = w["id"].clone();
                }
                call(&mut ws, &mm, "invoice_issue", inv)
            }
            7 if !invoices.is_empty() => {
                let f = &invoices[rng.below(invoices.len() as u64) as usize];
                call(&mut ws, &mm, "invoice_storno", json!({"id": f["id"], "data": day}))
            }
            8 => {
                // Sometimes the total does not match on purpose.
                let net = 1 + rng.below(500);
                let vat = net * 21 / 100;
                let total = net + vat + if rng.below(4) == 0 { 1 } else { 0 };
                call(
                    &mut ws,
                    &mm,
                    "purchase_save",
                    json!({"furnizor": partner["id"], "numar": format!("C{}", rng.below(300)), "data": day,
                    "total_fara_tva": net.to_string(), "tva": vat.to_string(), "total": total.to_string()}),
                )
            }
            9 => call(
                &mut ws,
                &mm,
                "payment_save",
                json!({"cont": casa["id"], "data": day, "sens": "incasare", "suma": price, "chitanta_serie": ch["id"]}),
            ),
            10 => call(
                &mut ws,
                &mm,
                "payment_save",
                json!({"cont": if rng.below(2) == 0 { &casa["id"] } else { &banca["id"] }, "data": day, "sens": "plata", "suma": price}),
            ),
            _ => {
                let open = call(&mut ws, &mm, "open_documents", json!({})).unwrap();
                match open.as_array().unwrap().iter().find(|d| d["tip"] == "factura") {
                    Some(d) => call(
                        &mut ws,
                        &mm,
                        "payment_save",
                        json!({"cont": banca["id"], "data": day, "sens": "incasare", "suma": price, "document": {"tip": "factura", "id": d["id"]}}),
                    ),
                    None => Ok(Value::Null),
                }
            }
        };
        match r {
            Ok(v) => {
                ok += 1;
                if v.get("document").is_some() && v.get("linii").is_some() {
                    stock_docs.push(v);
                } else if v
                    .get("numar")
                    .and_then(Value::as_str)
                    .is_some_and(|x| x.starts_with("F "))
                {
                    invoices.push(v);
                } else if v.get("id").is_some() {
                    payments.push(v);
                }
            }
            Err(_) => refused += 1,
        }
    }
    assert!(ok > 300 && refused > 50, "a real mix: {ok} accepted, {refused} refused");
    // How long one operation and one stock view take at this size (printed
    // for the report; release builds are several times faster).
    let t = std::time::Instant::now();
    call(&mut ws, &mm, "receive", json!({"depozit": whs[0]["id"], "numar": "X", "data": "2026-12-31", "linii": [{"produs": products[0]["id"], "cantitate": "1", "pret_unitar": "1"}]})).unwrap();
    let one_op = t.elapsed();
    let t = std::time::Instant::now();
    call(&mut ws, &mm, "stock", json!({})).unwrap();
    println!("după {ok} operații: o recepție {one_op:?}, stocul {:?}", t.elapsed());

    let check = |ws: &mut Workspace| {
        let v = call(ws, &mm, "verify", json!({})).unwrap();
        assert_eq!(v["probleme"], 0, "{v:#}");
        v
    };
    let v = check(&mut ws);
    let looked: i64 = v["verificari"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c["verificate"].as_i64().unwrap())
        .sum();
    assert!(looked > 500, "the checks looked at {looked} records");
    // Every stock row is non-negative and reports are consistent with it.
    for r in call(&mut ws, &mm, "stock", json!({})).unwrap().as_array().unwrap() {
        assert!(
            r["cantitate"].as_i64().unwrap() >= 0 && r["valoare"].as_i64().unwrap() >= 0,
            "{r}"
        );
    }
    let journal = call(&mut ws, &mm, "journal", json!({"limit": 5000})).unwrap();
    assert!(
        journal.as_array().unwrap().len() >= ok as usize - 20,
        "everything recorded is in the journal"
    );

    // Reopened: the same, recomputed from the files.
    drop(ws);
    let mut ws = Workspace::open(&dir).unwrap();
    check(&mut ws);
}
