//! Step 2.4: journal format v2 (binary) and compatibility with v1 (JSON),
//! decisions D-028 and D-029.

use kgb_store::codec::{TAG_V2, decode_op, encode, is_v2};
use kgb_store::{Cond, Error, Op, Options, Query, Store, Write, sync_pair};
use serde_json::{Value, json};
use uuid::Uuid;

fn obj(v: Value) -> kgb_store::Fields {
    v.as_object().unwrap().clone()
}

fn manifest(dir: &std::path::Path) -> Value {
    serde_json::from_slice(&std::fs::read(dir.join("MANIFEST")).unwrap()).unwrap()
}

fn journal_bytes(dir: &std::path::Path) -> Vec<u8> {
    let mut all = Vec::new();
    for e in std::fs::read_dir(dir.join("journal")).unwrap() {
        all.extend(std::fs::read(e.unwrap().path()).unwrap());
    }
    all
}

fn contains(hay: &[u8], needle: &[u8]) -> bool {
    hay.windows(needle.len()).any(|w| w == needle)
}

/// Creates an empty store whose manifest says format 1 (as written by Etapa 0/1).
fn v1_store(dir: &std::path::Path) {
    drop(Store::open(dir, Options::default()).unwrap());
    let mut m = manifest(dir);
    m["format"] = json!(1);
    std::fs::write(dir.join("MANIFEST"), serde_json::to_vec_pretty(&m).unwrap()).unwrap();
}

fn rich() -> kgb_store::Fields {
    obj(json!({
        "text": "ăîșțâ „ghilimele” \" \\ \n tab\t 😀",
        "n": 12.5, "i": -7, "big": 18446744073709551615u64,
        "b": true, "nul": null,
        "list": [1, "doi", {"trei": [3]}],
        "obj": {"a": {"b": {"c": "d"}}},
        "": "cheie goală"
    }))
}

#[test]
fn new_stores_write_v2() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("s");
    let mut s = Store::open(&dir, Options::default()).unwrap();
    s.write(vec![Write::put("c", Uuid::from_u128(1), rich())]).unwrap();
    assert_eq!(manifest(&dir)["format"], 2);
    assert!(
        !contains(&journal_bytes(&dir), b"{\"s\":"),
        "no JSON ops in a v2 journal"
    );
    drop(s);
    let s = Store::open(&dir, Options::default()).unwrap();
    assert_eq!(s.get("c", Uuid::from_u128(1)).unwrap().unwrap().fields, rich());
}

#[test]
fn v1_journal_is_read_kept_until_compaction_then_upgraded() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("s");
    v1_store(&dir);
    {
        let mut s = Store::open(&dir, Options::default()).unwrap();
        for i in 0..50u128 {
            s.write(vec![Write::put(
                "c",
                Uuid::from_u128(i),
                obj(json!({"i": i as u64, "t": "x"})),
            )])
            .unwrap();
        }
        s.write(vec![Write::delete("c", Uuid::from_u128(3))]).unwrap();
        s.create_index("c", "t").unwrap();
    }
    // Still format 1: an old app could still open it.
    assert_eq!(manifest(&dir)["format"], 1);
    assert!(contains(&journal_bytes(&dir), b"{\"s\":"));
    let before;
    {
        let mut s = Store::open(&dir, Options::default()).unwrap();
        before = s.query("c", &Query::default()).unwrap().records;
        assert_eq!(before.len(), 49);
        s.compact().unwrap();
        assert_eq!(manifest(&dir)["format"], 2);
        assert!(!contains(&journal_bytes(&dir), b"{\"s\":"));
        // New writes after the upgrade are v2 too.
        s.write(vec![Write::put(
            "c",
            Uuid::from_u128(100),
            obj(json!({"i": 100, "t": "y"})),
        )])
        .unwrap();
    }
    let s = Store::open(&dir, Options::default()).unwrap();
    let after = s
        .query(
            "c",
            &Query {
                filter: Some(Cond::Lt {
                    field: "i".into(),
                    value: json!(50),
                }),
                ..Query::default()
            },
        )
        .unwrap();
    assert_eq!(after.records.len(), 49);
    for (a, b) in before.iter().zip(after.records.iter()) {
        assert_eq!(
            (a.id, a.version, &a.fields, &a.field_revs, a.rev),
            (b.id, b.version, &b.fields, &b.field_revs, b.rev)
        );
    }
    assert!(
        s.get("c", Uuid::from_u128(3)).unwrap().is_none(),
        "deleted stays deleted"
    );
    assert_eq!(
        s.find_by("c", "t", &json!("x")).unwrap().len(),
        49,
        "index rebuilt from v2"
    );
}

#[test]
fn too_new_format_is_refused_without_changes() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("s");
    drop(Store::open(&dir, Options::default()).unwrap());
    let mut m = manifest(&dir);
    m["format"] = json!(3);
    let bytes = serde_json::to_vec_pretty(&m).unwrap();
    std::fs::write(dir.join("MANIFEST"), &bytes).unwrap();
    assert!(matches!(
        Store::open(&dir, Options::default()),
        Err(Error::ManifestCorrupt(_))
    ));
    assert_eq!(std::fs::read(dir.join("MANIFEST")).unwrap(), bytes);
}

fn sample_ops() -> Vec<Op> {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("s");
    let mut s = Store::open(&dir, Options::default()).unwrap();
    s.write(vec![Write::put("c", Uuid::from_u128(1), rich())]).unwrap();
    s.write(vec![Write::put("c", Uuid::from_u128(1), obj(json!({"text": "nou"})))])
        .unwrap();
    s.write(vec![Write::delete("c", Uuid::from_u128(1))]).unwrap();
    s.write(vec![Write::put("c", Uuid::from_u128(2), obj(json!({})))])
        .unwrap();
    s.changes_since(&Default::default()).unwrap()
}

#[test]
fn v2_round_trip_is_exact() {
    let ops = sample_ops();
    assert_eq!(ops.len(), 4);
    for op in &ops {
        let b = encode(op, 2).unwrap();
        assert!(is_v2(&b));
        assert_eq!(&decode_op(&b).unwrap(), op);
        // v1 still decodes too.
        assert_eq!(&decode_op(&encode(op, 1).unwrap()).unwrap(), op);
    }
}

#[test]
fn truncated_or_damaged_v2_is_an_error_never_a_panic() {
    for op in sample_ops() {
        let b = encode(&op, 2).unwrap();
        for cut in 0..b.len() {
            assert!(decode_op(&b[..cut]).is_err(), "prefix of {cut} bytes");
        }
        let mut extra = b.clone();
        extra.push(0);
        assert!(decode_op(&extra).is_err(), "trailing byte");
        // Flip every byte: must never panic (it may still decode to something else;
        // on disk the frame CRC catches that).
        for i in 0..b.len() {
            let mut d = b.clone();
            d[i] ^= 0xFF;
            let _ = decode_op(&d);
        }
    }
    assert!(decode_op(&[TAG_V2, 0xFF, 0xFF]).is_err());
}

#[test]
fn v1_and_v2_stores_sync_with_each_other() {
    let tmp = tempfile::tempdir().unwrap();
    let (a_dir, b_dir) = (tmp.path().join("a"), tmp.path().join("b"));
    v1_store(&a_dir);
    let mut a = Store::open(&a_dir, Options::default()).unwrap();
    let mut b = Store::open(&b_dir, Options::default()).unwrap();
    a.write(vec![Write::put("c", Uuid::from_u128(1), obj(json!({"from": "v1"})))])
        .unwrap();
    b.write(vec![Write::put("c", Uuid::from_u128(2), rich())]).unwrap();
    sync_pair(&mut a, &mut b).unwrap();
    assert_eq!(a.get("c", Uuid::from_u128(2)).unwrap().unwrap().fields, rich());
    assert_eq!(b.get("c", Uuid::from_u128(1)).unwrap().unwrap().fields["from"], "v1");
}
