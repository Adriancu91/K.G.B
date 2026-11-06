//! Step 2.3: structured queries give exactly the same answers as a full
//! decode + filter, with and without indexes, and reject malformed input.

use kgb_store::query::matches;
use kgb_store::{Cond, Options, Query, Sort, Store, Write};
use serde_json::{Value, json};
use uuid::Uuid;

fn obj(v: Value) -> kgb_store::Fields {
    v.as_object().unwrap().clone()
}

/// Small deterministic generator (no extra dependency).
struct Lcg(u64);
impl Lcg {
    fn next(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        self.0 >> 33
    }
    fn pick<'a, T>(&mut self, v: &'a [T]) -> &'a T {
        &v[(self.next() as usize) % v.len()]
    }
}

fn record(i: u64) -> kgb_store::Fields {
    let mut f = obj(json!({
        "name": format!("Produs {i} {}", ["Alfa", "beta", "GAMA", "ștafetă"][(i % 4) as usize]),
        "cat": format!("C{}", i % 7),
        "price": (i % 50) as f64 / 2.0,
        "qty": i % 13,
        "active": !i.is_multiple_of(3),
    }));
    if i.is_multiple_of(5) {
        f.remove("qty"); // some records lack a field
    }
    if i.is_multiple_of(11) {
        f.insert("qty".into(), Value::Null);
    }
    f
}

fn setup(n: u64) -> (tempfile::TempDir, Store) {
    let tmp = tempfile::tempdir().unwrap();
    let mut s = Store::open(tmp.path().join("s"), Options::default()).unwrap();
    s.write(
        (0..n)
            .map(|i| Write::put("items", Uuid::from_u128(i as u128 + 1), record(i)))
            .collect(),
    )
    .unwrap();
    s.write(vec![Write::put("other", Uuid::from_u128(999_999), record(1))])
        .unwrap();
    // A deleted record must never be returned.
    s.write(vec![Write::delete("items", Uuid::from_u128(2))]).unwrap();
    // An updated record: only its newest state counts.
    s.write(vec![Write::put("items", Uuid::from_u128(3), record(1000))])
        .unwrap();
    (tmp, s)
}

fn random_cond(r: &mut Lcg, depth: u32) -> Cond {
    let fields = ["name", "cat", "price", "qty", "active", "missing"];
    let values = [
        json!("C3"),
        json!(5.0),
        json!(5),
        json!(true),
        json!(null),
        json!("Produs 1"),
        json!(12),
    ];
    let field = r.pick(&fields).to_string();
    let value = r.pick(&values).clone();
    match if depth > 2 { r.next() % 9 } else { r.next() % 12 } {
        0 => Cond::Eq { field, value },
        1 => Cond::Ne { field, value },
        2 => Cond::Lt { field, value },
        3 => Cond::Le { field, value },
        4 => Cond::Gt { field, value },
        5 => Cond::Ge { field, value },
        6 => Cond::In {
            field,
            values: vec![value, json!("C1"), json!(3)],
        },
        7 => Cond::Contains {
            field,
            text: r.pick(&["alfa", "GAMA", "Ștaf", "x"]).to_string(),
        },
        8 => Cond::Exists { field },
        9 => Cond::And {
            all: (0..2 + r.next() % 2).map(|_| random_cond(r, depth + 1)).collect(),
        },
        10 => Cond::Or {
            any: (0..2 + r.next() % 2).map(|_| random_cond(r, depth + 1)).collect(),
        },
        _ => Cond::Not {
            cond: Box::new(random_cond(r, depth + 1)),
        },
    }
}

fn ids(v: &[kgb_store::RecordState]) -> Vec<Uuid> {
    v.iter().map(|r| r.id).collect()
}

#[test]
fn random_filters_match_full_decode() {
    let (_t, mut s) = setup(400);
    let mut r = Lcg(42);
    for round in 0..2 {
        if round == 1 {
            s.create_index("items", "cat").unwrap();
            s.create_index("items", "active").unwrap();
        }
        for _ in 0..150 {
            let c = random_cond(&mut r, 0);
            let mut expected = ids(&s.scan("items", |st| matches(&c, st)).unwrap());
            expected.sort();
            let got = s
                .query(
                    "items",
                    &Query {
                        filter: Some(c.clone()),
                        ..Query::default()
                    },
                )
                .unwrap();
            assert_eq!(ids(&got.records), expected, "{c:?}");
            assert_eq!(got.total, expected.len());
        }
    }
}

#[test]
fn index_is_used_and_gives_same_result() {
    let (_t, mut s) = setup(300);
    let q = Query {
        filter: Some(Cond::And {
            all: vec![
                Cond::Eq {
                    field: "cat".into(),
                    value: json!("C2"),
                },
                Cond::Gt {
                    field: "price".into(),
                    value: json!(10),
                },
            ],
        }),
        ..Query::default()
    };
    let without = s.query("items", &q).unwrap();
    assert!(!without.used_index);
    s.create_index("items", "cat").unwrap();
    let with = s.query("items", &q).unwrap();
    assert!(with.used_index);
    assert_eq!(ids(&with.records), ids(&without.records));
    assert!(!with.records.is_empty());
    // Numbers never go through the index (1 and 1.0 must stay equal).
    s.create_index("items", "qty").unwrap();
    let n = s
        .query(
            "items",
            &Query {
                filter: Some(Cond::Eq {
                    field: "qty".into(),
                    value: json!(4.0),
                }),
                ..Query::default()
            },
        )
        .unwrap();
    assert!(!n.used_index);
    assert!(n.records.iter().all(|r| r.fields["qty"] == json!(4)));
    assert!(!n.records.is_empty());
}

#[test]
fn sort_offset_limit() {
    let (_t, s) = setup(100);
    let q = Query {
        filter: None,
        sort: Some(Sort {
            field: "qty".into(),
            desc: true,
        }),
        offset: 5,
        limit: Some(10),
    };
    let r = s.query("items", &q).unwrap();
    assert_eq!(r.total, 99); // 100 - 1 deleted
    assert_eq!(r.records.len(), 10);
    let all = s
        .query(
            "items",
            &Query {
                sort: q.sort.clone(),
                ..Query::default()
            },
        )
        .unwrap();
    assert_eq!(ids(&r.records), ids(&all.records[5..15]));
    // Descending numbers first, records without a number (missing or null) last.
    let qtys: Vec<&Value> = all
        .records
        .iter()
        .map(|r| r.fields.get("qty").unwrap_or(&Value::Null))
        .collect();
    let numbers: Vec<f64> = qtys.iter().filter_map(|v| v.as_f64()).collect();
    assert!(numbers.windows(2).all(|w| w[0] >= w[1]));
    let first_non_number = qtys.iter().position(|v| !v.is_number()).unwrap();
    assert!(qtys[first_non_number..].iter().all(|v| !v.is_number()));
}

#[test]
fn deleted_updated_and_other_collections() {
    let (_t, s) = setup(50);
    let all = s.query("items", &Query::default()).unwrap();
    assert!(!ids(&all.records).contains(&Uuid::from_u128(2)));
    assert!(!ids(&all.records).contains(&Uuid::from_u128(999_999)));
    let three = all.records.iter().find(|r| r.id == Uuid::from_u128(3)).unwrap();
    assert_eq!(three.fields["name"], record(1000)["name"]);
    assert_eq!(s.query("nope", &Query::default()).unwrap().total, 0);
}

#[test]
fn queries_are_data_and_malformed_ones_are_refused() {
    let q: Query = serde_json::from_value(json!({
        "filter": {"op": "and", "all": [
            {"op": "contains", "field": "name", "text": "alfa"},
            {"op": "not", "cond": {"op": "eq", "field": "cat", "value": "C0"}}
        ]},
        "sort": {"field": "price"},
        "limit": 3
    }))
    .unwrap();
    let (_t, s) = setup(60);
    assert!(s.query("items", &q).unwrap().records.len() <= 3);
    assert!(serde_json::from_value::<Query>(json!({"filter": {"op": "regex", "field": "a"}})).is_err());
    assert!(
        serde_json::from_value::<Query>(json!({"filter": {"op": "eq", "field": "a", "value": 1, "x": 2}})).is_err()
    );
    let mut deep = Cond::Exists { field: "name".into() };
    for _ in 0..40 {
        deep = Cond::Not { cond: Box::new(deep) };
    }
    assert!(
        s.query(
            "items",
            &Query {
                filter: Some(deep),
                ..Query::default()
            }
        )
        .is_err()
    );
}
