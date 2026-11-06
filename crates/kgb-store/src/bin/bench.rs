//! Volume benchmark (Master Plan §9.4). `bench <dir> <n>[,<n>...]` prints a Markdown table.
//! Records are ~1 KB inventory-like objects with 10 fields.

use std::path::Path;
use std::time::Instant;

use kgb_store::{Durability, Options, Store, Write};
use serde_json::{Value, json};
use uuid::Uuid;

fn record(n: u64) -> kgb_store::Fields {
    let Value::Object(f) = json!({
        "sku": format!("SKU-{n:08}"),
        "name": format!("Produs de test numărul {n}"),
        "category": format!("CAT-{:02}", n % 50),
        "warehouse": format!("DEP-{}", n % 5),
        "price": (n % 10_000) as f64 / 100.0,
        "qty": n % 1000,
        "unit": "buc",
        "supplier": format!("Furnizor {}", n % 300),
        "barcode": format!("594{:010}", n),
        "notes": "x".repeat(700),
    }) else {
        unreachable!()
    };
    f
}

fn pct(v: &mut [f64], p: f64) -> f64 {
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    v[((v.len() as f64 - 1.0) * p) as usize]
}

fn ms(t: Instant) -> f64 {
    t.elapsed().as_secs_f64() * 1000.0
}

fn bench(root: &Path, n: u64) -> Vec<(String, String)> {
    let dir = root.join(format!("bench-{n}"));
    let _ = std::fs::remove_dir_all(&dir);
    let mut rows = Vec::new();
    let id = |i: u64| Uuid::from_u128(i as u128 + 1);

    // bulk load, buffered, batches of 1000, one flush per batch
    let mut s = Store::open(
        &dir,
        Options {
            durability: Durability::Buffered,
            ..Options::default()
        },
    )
    .unwrap();
    let t = Instant::now();
    let mut i = 0;
    while i < n {
        let end = (i + 1000).min(n);
        s.write((i..end).map(|k| Write::put("items", id(k), record(k))).collect())
            .unwrap();
        s.flush().unwrap();
        i = end;
    }
    let load = ms(t);
    rows.push((
        "Încărcare în loturi de 1.000 (flush/lot)".into(),
        format!("{:.0} ms ({:.0} rec/s)", load, n as f64 / load * 1000.0),
    ));
    drop(s);

    let t = Instant::now();
    let mut s = Store::open(&dir, Options::default()).unwrap();
    rows.push(("Deschidere + reconstruire keydir".into(), format!("{:.0} ms", ms(t))));

    let t = Instant::now();
    s.create_index("items", "category").unwrap();
    rows.push(("Construire index `category`".into(), format!("{:.0} ms", ms(t))));
    drop(s);
    let t = Instant::now();
    let mut s = Store::open(&dir, Options::default()).unwrap();
    rows.push((
        "Deschidere + reconstruire keydir și index".into(),
        format!("{:.0} ms", ms(t)),
    ));

    // single durable writes
    let mut lat = Vec::new();
    for k in 0..300 {
        let t = Instant::now();
        let mut f = record(k);
        f.insert("qty".into(), json!(k + 1_000_000));
        s.write(vec![Write::put("items", id(k), f)]).unwrap();
        lat.push(ms(t));
    }
    rows.push((
        "Scriere unitară durabilă p50 / p95".into(),
        format!("{:.2} / {:.2} ms", pct(&mut lat, 0.5), pct(&mut lat, 0.95)),
    ));

    let t = Instant::now();
    s.write((0..1000).map(|k| Write::put("items", id(k), record(k))).collect())
        .unwrap();
    rows.push(("Lot de 1.000 actualizări durabile".into(), format!("{:.0} ms", ms(t))));

    let mut lat = Vec::new();
    for k in 0..2000u64 {
        let key = (k * 7919) % n;
        let t = Instant::now();
        s.get("items", id(key)).unwrap().unwrap();
        lat.push(ms(t));
    }
    rows.push((
        "Citire după ID p50 / p95".into(),
        format!("{:.3} / {:.3} ms", pct(&mut lat, 0.5), pct(&mut lat, 0.95)),
    ));

    let t = Instant::now();
    let hits = s.find_by("items", "category", &json!("CAT-07")).unwrap().len();
    rows.push((
        format!("Căutare indexată ({hits} rezultate)"),
        format!("{:.1} ms", ms(t)),
    ));

    let t = Instant::now();
    let hits = s
        .scan("items", |r| r.fields["price"].as_f64().unwrap_or(0.0) < 1.0)
        .unwrap()
        .len();
    rows.push((
        format!("Filtrare fără index ({hits} rezultate)"),
        format!("{:.0} ms", ms(t)),
    ));

    let before = s.disk_bytes().unwrap();
    let t = Instant::now();
    let c = s.compact().unwrap();
    rows.push(("Compactare".into(), format!("{:.0} ms", ms(t))));
    rows.push((
        "Spațiu pe disc înainte / după compactare".into(),
        format!("{:.1} / {:.1} MB", before as f64 / 1e6, c.bytes_after as f64 / 1e6),
    ));
    let raw: usize = serde_json::to_vec(&record(1)).unwrap().len();
    rows.push((
        "Raport disc / date utile (după compactare)".into(),
        format!("{:.2}×", c.bytes_after as f64 / (raw as f64 * n as f64)),
    ));
    drop(s);
    let _ = std::fs::remove_dir_all(&dir);
    rows
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let root = Path::new(args.get(1).map(String::as_str).unwrap_or("bench-out"));
    let sizes: Vec<u64> = args
        .get(2)
        .map(|s| s.split(',').map(|x| x.parse().unwrap()).collect())
        .unwrap_or(vec![10_000, 100_000]);
    std::fs::create_dir_all(root).unwrap();
    let results: Vec<(u64, Vec<(String, String)>)> = sizes.iter().map(|&n| (n, bench(root, n))).collect();
    print!("| Măsurătoare |");
    for (n, _) in &results {
        print!(" {n} înreg. |");
    }
    println!();
    print!("|---|");
    for _ in &results {
        print!("---|");
    }
    println!();
    for row in 0..results[0].1.len() {
        print!("| {} |", results[0].1[row].0.split(" (").next().unwrap());
        for (_, r) in &results {
            print!(" {} |", r[row].1);
        }
        println!();
    }
}
