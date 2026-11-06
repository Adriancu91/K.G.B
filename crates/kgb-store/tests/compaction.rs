//! Step 2.5: incremental compaction keeps every record exactly, frees space,
//! lets writes continue between steps, and refuses old journals.

use std::collections::BTreeMap;

use kgb_store::{Options, RecordState, Store, Write};
use serde_json::json;
use uuid::Uuid;

fn small() -> Options {
    Options {
        segment_max_bytes: 16 * 1024,
        ..Options::default()
    }
}

fn put(i: u128, round: u64) -> Write {
    let f = json!({"i": i as u64, "round": round, "pad": "y".repeat(200)})
        .as_object()
        .unwrap()
        .clone();
    Write::put("c", Uuid::from_u128(i), f)
}

/// Every key with its full state, including deleted records.
fn snapshot(s: &Store) -> BTreeMap<Uuid, RecordState> {
    (0..200u128)
        .filter_map(|i| s.get_any("c", Uuid::from_u128(i)).unwrap().map(|r| (r.id, r)))
        .collect()
}

fn churn(s: &mut Store) {
    for round in 0..5 {
        for chunk in (0..200u128).collect::<Vec<_>>().chunks(20) {
            s.write(chunk.iter().map(|&i| put(i, round)).collect()).unwrap();
        }
    }
    for i in (0..200u128).step_by(9) {
        s.write(vec![Write::delete("c", Uuid::from_u128(i))]).unwrap();
    }
}

#[test]
fn steps_keep_every_record_and_free_space() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("s");
    let mut s = Store::open(&dir, small()).unwrap();
    churn(&mut s);
    s.create_index("c", "round").unwrap();
    let before = snapshot(&s);
    let bytes_before = s.disk_bytes().unwrap();
    let mut steps = 0;
    while let Some(r) = s.compact_step(0.3).unwrap() {
        assert!(r.bytes_after < r.bytes_before);
        steps += 1;
        assert!(steps < 1000, "compaction must converge");
        assert_eq!(snapshot(&s), before, "after step {steps}");
    }
    assert!(steps > 0);
    assert!(
        s.disk_bytes().unwrap() < bytes_before / 2,
        "{} vs {bytes_before}",
        s.disk_bytes().unwrap()
    );
    assert_eq!(
        s.find_by("c", "round", &json!(4)).unwrap().len(),
        before.values().filter(|r| !r.deleted).count()
    );
    drop(s);
    let s = Store::open(&dir, small()).unwrap();
    assert_eq!(snapshot(&s), before, "after reopen");
    assert!(s.recovery_report().orphan_segments.is_empty());
    assert!(
        dir.join("retired").read_dir().unwrap().count() <= 1,
        "only the previous generation is kept"
    );
}

#[test]
fn writes_between_steps_are_kept() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("s");
    let mut s = Store::open(&dir, small()).unwrap();
    churn(&mut s);
    let mut round = 100;
    while s.compact_step(0.3).unwrap().is_some() {
        s.write(vec![put(7, round), put(150, round)]).unwrap();
        round += 1;
    }
    let expect = snapshot(&s);
    assert_eq!(expect[&Uuid::from_u128(7)].fields["round"], round - 1);
    drop(s);
    assert_eq!(snapshot(&Store::open(&dir, small()).unwrap()), expect);
}

#[test]
fn nothing_to_do_returns_none() {
    let tmp = tempfile::tempdir().unwrap();
    let mut s = Store::open(tmp.path().join("s"), small()).unwrap();
    assert!(s.compact_step(0.3).unwrap().is_none());
    for i in 0..100u128 {
        s.write(vec![put(i, 0)]).unwrap();
    }
    // No record was overwritten: no segment has garbage.
    assert!(s.compact_step(0.3).unwrap().is_none());
}

#[test]
fn old_format_needs_a_full_compaction_first() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("s");
    drop(Store::open(&dir, small()).unwrap());
    let mut m: serde_json::Value = serde_json::from_slice(&std::fs::read(dir.join("MANIFEST")).unwrap()).unwrap();
    m["format"] = json!(1);
    std::fs::write(dir.join("MANIFEST"), serde_json::to_vec(&m).unwrap()).unwrap();
    let mut s = Store::open(&dir, small()).unwrap();
    churn(&mut s);
    assert!(s.compact_step(0.3).is_err());
    let before = snapshot(&s);
    s.compact().unwrap();
    assert_eq!(snapshot(&s), before);
    assert!(s.compact_step(0.0).is_ok());
}
