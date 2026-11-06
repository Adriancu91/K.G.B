//! Functional and failure tests for the S1 storage spike (TEST_STRATEGY.md, Spike S1).

use std::fs::{self, OpenOptions};
use std::io::Write as _;
use std::path::Path;

use kgb_store_spike::{Durability, Error, Options, Store, Write, repair, restore_backup, sync_pair, verify_backup};
use serde_json::{Value, json};
use uuid::Uuid;

fn obj(v: Value) -> kgb_store_spike::Fields {
    match v {
        Value::Object(m) => m,
        _ => panic!("not an object"),
    }
}

fn opts() -> Options {
    Options::default()
}

fn open(dir: &Path) -> Store {
    Store::open(dir, opts()).expect("open")
}

fn id(n: u128) -> Uuid {
    Uuid::from_u128(n)
}

fn last_segment(dir: &Path) -> std::path::PathBuf {
    let mut segs: Vec<_> = fs::read_dir(dir.join("journal"))
        .unwrap()
        .map(|e| e.unwrap().path())
        .collect();
    segs.sort();
    segs.pop().unwrap()
}

#[test]
fn create_read_update_and_reopen() {
    let t = tempfile::tempdir().unwrap();
    {
        let mut s = open(t.path());
        let v = s
            .write(vec![Write::put(
                "items",
                id(1),
                obj(json!({"name": "Șurub", "qty": 10})),
            )])
            .unwrap();
        assert_eq!(v, vec![1]);
        let v = s
            .write(vec![Write::put(
                "items",
                id(1),
                obj(json!({"name": "Șurub", "qty": 12})),
            )])
            .unwrap();
        assert_eq!(v, vec![2]);
        // unchanged put is a no-op and keeps the version
        let v = s
            .write(vec![Write::put(
                "items",
                id(1),
                obj(json!({"name": "Șurub", "qty": 12})),
            )])
            .unwrap();
        assert_eq!(v, vec![2]);
    }
    let s = open(t.path());
    let r = s.get("items", id(1)).unwrap().unwrap();
    assert_eq!(r.version, 2);
    assert_eq!(r.fields["qty"], json!(12));
    assert_eq!(s.count("items"), 1);
}

#[test]
fn optimistic_concurrency_rejects_stale_writer() {
    let t = tempfile::tempdir().unwrap();
    let mut s = open(t.path());
    s.write(vec![Write::put("items", id(1), obj(json!({"qty": 1})))])
        .unwrap();
    // two editors both read version 1
    s.write(vec![Write::put("items", id(1), obj(json!({"qty": 2}))).expect(1)])
        .unwrap();
    let err = s
        .write(vec![Write::put("items", id(1), obj(json!({"qty": 3}))).expect(1)])
        .unwrap_err();
    assert!(
        matches!(
            err,
            Error::VersionConflict {
                expected: 1,
                actual: 2,
                ..
            }
        ),
        "{err}"
    );
    assert_eq!(s.get("items", id(1)).unwrap().unwrap().fields["qty"], json!(2));
    // must-not-exist
    let err = s
        .write(vec![Write::put("items", id(1), obj(json!({"qty": 9}))).expect(0)])
        .unwrap_err();
    assert!(matches!(err, Error::VersionConflict { .. }));
}

#[test]
fn batch_is_all_or_nothing() {
    let t = tempfile::tempdir().unwrap();
    let mut s = open(t.path());
    let err = s
        .write(vec![
            Write::put("items", id(1), obj(json!({"qty": 1}))),
            Write::delete("items", id(99)), // does not exist → whole batch rejected
        ])
        .unwrap_err();
    assert!(matches!(err, Error::NotFound { .. }));
    assert!(s.get("items", id(1)).unwrap().is_none());
    // the rejected batch must not consume sequence numbers
    s.write(vec![Write::put("items", id(2), obj(json!({"qty": 1})))])
        .unwrap();
    assert_eq!(s.version_vector()[&s.device()], 1);
}

#[test]
fn logical_delete_and_restore_keep_data() {
    let t = tempfile::tempdir().unwrap();
    let mut s = open(t.path());
    s.write(vec![Write::put("items", id(1), obj(json!({"qty": 5})))])
        .unwrap();
    s.write(vec![Write::delete("items", id(1))]).unwrap();
    assert!(s.get("items", id(1)).unwrap().is_none());
    assert!(s.get_any("items", id(1)).unwrap().unwrap().deleted);
    assert!(matches!(
        s.write(vec![Write::put("items", id(1), obj(json!({"qty": 6})))]),
        Err(Error::RecordDeleted { .. })
    ));
    s.write(vec![Write::restore("items", id(1))]).unwrap();
    drop(s);
    let s = open(t.path());
    assert_eq!(s.get("items", id(1)).unwrap().unwrap().fields["qty"], json!(5));
}

#[test]
fn second_writer_is_refused() {
    let t = tempfile::tempdir().unwrap();
    let _a = open(t.path());
    let err = Store::open(t.path(), opts()).err().unwrap();
    assert!(matches!(err, Error::Locked(_)), "{err}");
}

#[test]
fn torn_tail_is_quarantined_not_deleted() {
    let t = tempfile::tempdir().unwrap();
    {
        let mut s = open(t.path());
        s.write(vec![Write::put("items", id(1), obj(json!({"qty": 1})))])
            .unwrap();
    }
    let seg = last_segment(t.path());
    let good_len = fs::metadata(&seg).unwrap().len();
    // simulate a crash mid-write: header + partial payload
    let mut f = OpenOptions::new().append(true).open(&seg).unwrap();
    f.write_all(b"KGB1\x40\x00\x00\x00\x01\x00\x00\x00\xde\xad\xbe\xef{\"partial")
        .unwrap();
    drop(f);
    let s = open(t.path());
    let torn = s.recovery_report().torn_tail.clone().expect("torn tail reported");
    assert_eq!(torn.offset, good_len);
    assert!(torn.saved_to.exists(), "torn bytes must be kept in quarantine");
    assert_eq!(fs::metadata(&seg).unwrap().len(), good_len);
    assert_eq!(s.get("items", id(1)).unwrap().unwrap().fields["qty"], json!(1));
}

#[test]
fn incomplete_transaction_is_dropped_entirely() {
    let t = tempfile::tempdir().unwrap();
    let before;
    {
        let mut s = open(t.path());
        s.write(vec![Write::put("items", id(1), obj(json!({"qty": 1})))])
            .unwrap();
        before = fs::metadata(last_segment(t.path())).unwrap().len();
        s.write(vec![
            Write::put("items", id(2), obj(json!({"qty": 2}))),
            Write::put("items", id(3), obj(json!({"qty": 3}))),
            Write::put("items", id(4), obj(json!({"qty": 4}))),
        ])
        .unwrap();
    }
    // cut inside the last frame of the 3-op transaction
    let seg = last_segment(t.path());
    let len = fs::metadata(&seg).unwrap().len();
    OpenOptions::new()
        .write(true)
        .open(&seg)
        .unwrap()
        .set_len(len - 5)
        .unwrap();
    let s = open(t.path());
    assert!(s.recovery_report().torn_tail.is_some());
    assert_eq!(fs::metadata(&seg).unwrap().len(), before);
    assert!(s.get("items", id(1)).unwrap().is_some());
    for n in 2..=4 {
        assert!(
            s.get("items", id(n)).unwrap().is_none(),
            "partial transaction must not be visible"
        );
    }
}

#[test]
fn mid_log_corruption_refuses_then_explicit_repair() {
    let t = tempfile::tempdir().unwrap();
    {
        let mut s = open(t.path());
        for n in 1..=3 {
            s.write(vec![Write::put("items", id(n), obj(json!({"qty": n as u64})))])
                .unwrap();
        }
    }
    let seg = last_segment(t.path());
    let mut bytes = fs::read(&seg).unwrap();
    bytes[20] ^= 0xFF; // inside the payload of the first frame
    fs::write(&seg, &bytes).unwrap();
    let err = Store::open(t.path(), opts()).err().unwrap();
    assert!(matches!(err, Error::Corruption { offset: 0, .. }), "{err}");
    assert_eq!(
        fs::read(&seg).unwrap(),
        bytes,
        "refusing to open must not modify the file"
    );

    let rep = repair(t.path()).unwrap();
    assert_eq!(rep.segments_rewritten.len(), 1);
    assert!(rep.originals_saved_to[0].exists());
    let s = open(t.path());
    assert!(s.get("items", id(1)).unwrap().is_none(), "damaged transaction is lost");
    assert!(s.get("items", id(2)).unwrap().is_some());
    assert!(s.get("items", id(3)).unwrap().is_some());
}

#[test]
fn missing_manifest_is_not_guessed() {
    let t = tempfile::tempdir().unwrap();
    {
        let mut s = open(t.path());
        s.write(vec![Write::put("items", id(1), obj(json!({"qty": 1})))])
            .unwrap();
    }
    fs::remove_file(t.path().join("MANIFEST")).unwrap();
    assert!(matches!(
        Store::open(t.path(), opts()).err().unwrap(),
        Error::ManifestMissing(_)
    ));
}

#[test]
fn index_lookup_and_rebuild() {
    let t = tempfile::tempdir().unwrap();
    let mut s = open(t.path());
    for n in 0..100u128 {
        let cat = if n % 2 == 0 { "A" } else { "B" };
        s.write(vec![Write::put(
            "items",
            id(n),
            obj(json!({"cat": cat, "n": n as u64})),
        )])
        .unwrap();
    }
    s.create_index("items", "cat").unwrap();
    assert_eq!(s.find_by("items", "cat", &json!("A")).unwrap().len(), 50);
    s.write(vec![Write::put("items", id(0), obj(json!({"cat": "B", "n": 0})))])
        .unwrap();
    s.write(vec![Write::delete("items", id(2))]).unwrap();
    assert_eq!(s.find_by("items", "cat", &json!("A")).unwrap().len(), 48);
    s.rebuild_indexes().unwrap();
    assert_eq!(s.find_by("items", "cat", &json!("A")).unwrap().len(), 48);
    drop(s);
    let s = open(t.path());
    assert_eq!(s.find_by("items", "cat", &json!("B")).unwrap().len(), 51);
    assert!(matches!(
        s.find_by("items", "n", &json!(1)),
        Err(Error::NotIndexed { .. })
    ));
    let scanned = s.scan("items", |r| r.fields["n"].as_u64().unwrap() < 10).unwrap();
    assert_eq!(scanned.len(), 9); // 0..10 minus deleted #2
}

#[test]
fn compaction_keeps_state_and_shrinks() {
    let t = tempfile::tempdir().unwrap();
    let mut s = open(t.path());
    for round in 0..20u64 {
        for n in 0..50u128 {
            s.write(vec![Write::put("items", id(n), obj(json!({"round": round})))])
                .unwrap();
        }
    }
    s.write(vec![Write::delete("items", id(7))]).unwrap();
    let rep = s.compact().unwrap();
    assert!(rep.bytes_after < rep.bytes_before / 5, "{rep:?}");
    assert_eq!(s.count("items"), 49);
    drop(s);
    let mut s = open(t.path());
    assert_eq!(s.get("items", id(3)).unwrap().unwrap().fields["round"], json!(19));
    assert!(s.get_any("items", id(7)).unwrap().unwrap().deleted);
    s.write(vec![Write::put("items", id(3), obj(json!({"round": 99})))])
        .unwrap();
    assert!(t.path().join("retired").exists());
}

#[test]
fn backup_verify_restore_and_tamper_detection() {
    let t = tempfile::tempdir().unwrap();
    let ws = t.path().join("ws");
    let bk = t.path().join("backup");
    let mut s = open(&ws);
    for n in 0..200u128 {
        s.write(vec![Write::put("items", id(n), obj(json!({"n": n as u64})))])
            .unwrap();
    }
    let blob = s.put_blob(b"factura.pdf contents").unwrap();
    let info = s.backup_to(&bk).unwrap();
    assert_eq!(info.records, 200);
    verify_backup(&bk).unwrap();

    let restored = restore_backup(&bk, &t.path().join("restored"), opts()).unwrap();
    assert_eq!(restored.count("items"), 200);
    assert_eq!(restored.get_blob(&blob).unwrap(), b"factura.pdf contents");

    let seg = fs::read_dir(bk.join("journal"))
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path();
    let mut b = fs::read(&seg).unwrap();
    b[30] ^= 1;
    fs::write(&seg, b).unwrap();
    assert!(matches!(verify_backup(&bk), Err(Error::BackupInvalid(_))));
    assert!(restore_backup(&bk, &t.path().join("restored2"), opts()).is_err());
}

#[test]
fn blob_tamper_is_detected() {
    let t = tempfile::tempdir().unwrap();
    let s = open(t.path());
    let h = s.put_blob(b"hello").unwrap();
    let p = t.path().join("blobs").join(&h[..2]).join(&h);
    fs::write(p, b"hellO").unwrap();
    assert!(matches!(s.get_blob(&h), Err(Error::BlobMismatch(_))));
}

#[test]
fn cloud_folder_is_refused() {
    let t = tempfile::tempdir().unwrap();
    let err = Store::open(t.path().join("OneDrive").join("ws"), opts()).err().unwrap();
    assert!(matches!(err, Error::UnsafeLocation(_)));
}

// ------------------------------------------------------------------ sync

fn pair(t: &Path) -> (Store, Store) {
    let o = Options {
        durability: Durability::Sync,
        ..opts()
    };
    (
        Store::open(t.join("pc1"), o.clone()).unwrap(),
        Store::open(t.join("pc2"), o).unwrap(),
    )
}

#[test]
fn sync_fast_forward_and_dedupe() {
    let t = tempfile::tempdir().unwrap();
    let (mut a, mut b) = pair(t.path());
    a.write(vec![Write::put("items", id(1), obj(json!({"qty": 1})))])
        .unwrap();
    sync_pair(&mut a, &mut b).unwrap();
    assert_eq!(b.get("items", id(1)).unwrap().unwrap().fields["qty"], json!(1));
    b.write(vec![Write::put("items", id(1), obj(json!({"qty": 2})))])
        .unwrap();
    let (ra, _) = sync_pair(&mut a, &mut b).unwrap();
    assert_eq!(ra.fast_forward, 1);
    assert_eq!(a.get("items", id(1)).unwrap().unwrap().fields["qty"], json!(2));
    // re-sending the same changes changes nothing
    let again = b.changes_since(&Default::default()).unwrap();
    let r = a.apply_remote(again).unwrap();
    assert_eq!(r.skipped, 2);
}

#[test]
fn sync_offline_edits_on_different_fields_merge() {
    let t = tempfile::tempdir().unwrap();
    let (mut a, mut b) = pair(t.path());
    a.write(vec![Write::put("items", id(1), obj(json!({"qty": 1, "price": 10})))])
        .unwrap();
    sync_pair(&mut a, &mut b).unwrap();
    // both offline
    a.write(vec![Write::put("items", id(1), obj(json!({"qty": 5, "price": 10})))])
        .unwrap();
    b.write(vec![Write::put("items", id(1), obj(json!({"qty": 1, "price": 12})))])
        .unwrap();
    let (ra, rb) = sync_pair(&mut a, &mut b).unwrap();
    assert_eq!((ra.merged, rb.merged, ra.conflicts, rb.conflicts), (1, 1, 0, 0));
    let (sa, sb) = (
        a.get("items", id(1)).unwrap().unwrap(),
        b.get("items", id(1)).unwrap().unwrap(),
    );
    assert_eq!(sa.fields, obj(json!({"qty": 5, "price": 12})));
    assert_eq!(sa.fields, sb.fields);
    assert_eq!(sa.rev, sb.rev);
    // after merging, the next edit is a plain fast-forward on the other side
    a.write(vec![Write::put("items", id(1), obj(json!({"qty": 6, "price": 12})))])
        .unwrap();
    let (_, rb) = sync_pair(&mut a, &mut b).unwrap();
    assert_eq!(rb.fast_forward, 1);
}

#[test]
fn sync_same_field_conflict_goes_to_user() {
    let t = tempfile::tempdir().unwrap();
    let (mut a, mut b) = pair(t.path());
    a.write(vec![Write::put("items", id(1), obj(json!({"qty": 1})))])
        .unwrap();
    sync_pair(&mut a, &mut b).unwrap();
    a.write(vec![Write::put("items", id(1), obj(json!({"qty": 5})))])
        .unwrap();
    b.write(vec![Write::put("items", id(1), obj(json!({"qty": 7})))])
        .unwrap();
    sync_pair(&mut a, &mut b).unwrap();
    let (ca, cb) = (a.conflicts(false).unwrap(), b.conflicts(false).unwrap());
    assert_eq!((ca.len(), cb.len()), (1, 1));
    assert_eq!(ca[0].id, cb[0].id, "both copies name the conflict identically");
    // deterministic provisional value on both sides
    assert_eq!(
        a.get("items", id(1)).unwrap().unwrap().fields,
        b.get("items", id(1)).unwrap().unwrap().fields
    );
    // user decides on PC1; decision propagates
    a.resolve_conflict(ca[0].id, Some(json!(6))).unwrap();
    sync_pair(&mut a, &mut b).unwrap();
    assert_eq!(b.get("items", id(1)).unwrap().unwrap().fields["qty"], json!(6));
    assert!(a.conflicts(false).unwrap().is_empty());
}

#[test]
fn sync_delete_vs_edit_is_a_conflict() {
    let t = tempfile::tempdir().unwrap();
    let (mut a, mut b) = pair(t.path());
    a.write(vec![Write::put("items", id(1), obj(json!({"qty": 1})))])
        .unwrap();
    sync_pair(&mut a, &mut b).unwrap();
    a.write(vec![Write::delete("items", id(1))]).unwrap();
    b.write(vec![Write::put("items", id(1), obj(json!({"qty": 2})))])
        .unwrap();
    sync_pair(&mut a, &mut b).unwrap();
    assert_eq!(a.conflicts(false).unwrap().len(), 1);
    assert_eq!(b.conflicts(false).unwrap().len(), 1);
    let (sa, sb) = (
        a.get_any("items", id(1)).unwrap().unwrap(),
        b.get_any("items", id(1)).unwrap().unwrap(),
    );
    assert_eq!(
        (sa.deleted, &sa.fields),
        (sb.deleted, &sb.fields),
        "copies converge on the provisional state"
    );
}

#[test]
fn sync_gap_and_compacted_history_are_errors() {
    let t = tempfile::tempdir().unwrap();
    let (mut a, mut b) = pair(t.path());
    for n in 1..=3 {
        a.write(vec![Write::put("items", id(n), obj(json!({"n": n as u64})))])
            .unwrap();
    }
    let mut ch = a.changes_since(&Default::default()).unwrap();
    ch.remove(1);
    assert!(matches!(
        b.apply_remote(ch),
        Err(Error::SyncGap {
            expected: 2,
            got: 3,
            ..
        })
    ));
    a.compact().unwrap();
    let fresh = Store::open(t.path().join("pc3"), opts()).unwrap();
    assert!(matches!(
        a.changes_since(&fresh.version_vector()),
        Err(Error::HistoryCompacted { .. })
    ));
}

#[test]
fn reserved_names_are_rejected() {
    let t = tempfile::tempdir().unwrap();
    let mut s = open(t.path());
    assert!(matches!(
        s.write(vec![Write::put("_conflicts", id(1), obj(json!({})))]),
        Err(Error::InvalidInput(_))
    ));
    assert!(matches!(
        s.write(vec![Write::put("items", id(1), obj(json!({"_deleted": true})))]),
        Err(Error::InvalidInput(_))
    ));
}
