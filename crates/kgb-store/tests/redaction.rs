//! Partial replication (Etapa 6, step 6.3): a copy that may not see some
//! changes gets redaction markers instead, keeps a complete sequence, forwards
//! markers to others, and gets the real changes later (from any peer that has
//! them) without gaps, duplicates or reordering — also after reopening.

use kgb_store::sync::{is_redacted, redact};
use kgb_store::{Fields, Op, Options, Store, VersionVector, Write};
use serde_json::{Value, json};
use uuid::Uuid;

fn store(dir: &std::path::Path, name: &str) -> Store {
    Store::open(dir.join(name), Options::default()).unwrap()
}

fn put(s: &mut Store, coll: &str, id: Uuid, text: &str) {
    let mut f = Fields::new();
    f.insert("t".into(), json!(text));
    let v = s.get(coll, id).unwrap().map(|r| r.version).unwrap_or(0);
    s.write(vec![Write::put(coll, id, f).expect(v)]).unwrap();
}

fn text(s: &Store, coll: &str, id: Uuid) -> Option<String> {
    s.get(coll, id)
        .unwrap()
        .and_then(|r| r.fields.get("t").and_then(Value::as_str).map(String::from))
}

/// What `from` sends to `to` when `to` may only see collection "n".
fn send_only_n(from: &Store, vv: &VersionVector) -> Vec<Op> {
    from.changes_since(vv)
        .unwrap()
        .into_iter()
        .map(|op| {
            if op.state.coll == "n" || is_redacted(&op) {
                op
            } else {
                redact(&op)
            }
        })
        .collect()
}

#[test]
fn markers_keep_the_sequence_and_fill_later() {
    let t = tempfile::tempdir().unwrap();
    let (mut a, mut b, mut c) = (store(t.path(), "a"), store(t.path(), "b"), store(t.path(), "c"));
    let (n1, s1, s2) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    put(&mut a, "n", n1, "notă");
    put(&mut a, "s", s1, "secret 1");
    put(&mut a, "s", s2, "secret 2");
    put(&mut a, "n", n1, "notă v2");
    put(&mut a, "s", s1, "secret 1 v2");

    // B may see only "n".
    let r = b.apply_remote(send_only_n(&a, &b.version_vector())).unwrap();
    assert_eq!(r.redacted, 3);
    assert_eq!(text(&b, "n", n1).as_deref(), Some("notă v2"));
    assert_eq!(text(&b, "s", s1), None, "nothing secret on B");
    assert_eq!(b.unfilled().unwrap().len(), 3);
    assert_eq!(b.version_vector()[&a.device()], 5, "the sequence is complete");

    // B forwards to C: the note, and markers for the rest (B has nothing else).
    let r = c.apply_remote(b.changes_since(&c.version_vector()).unwrap()).unwrap();
    assert_eq!((r.created, r.redacted), (1, 3));
    assert_eq!(c.unfilled().unwrap().len(), 3);
    // C may see everything: it asks A for what it is missing.
    let want = c.unfilled().unwrap();
    let r = c.fill(a.changes_at(&want).unwrap()).unwrap();
    assert_eq!(r.filled, 3);
    assert_eq!(text(&c, "s", s1).as_deref(), Some("secret 1 v2"));
    assert_eq!(text(&c, "s", s2).as_deref(), Some("secret 2"));
    assert!(c.unfilled().unwrap().is_empty());
    assert_eq!(c.fill(a.changes_at(&want).unwrap()).unwrap().filled, 0, "never twice");

    // A fresh copy D syncing from C gets the real changes, in order, no gaps.
    let mut d = store(t.path(), "d");
    let ops = c.changes_since(&d.version_vector()).unwrap();
    assert!(
        ops.iter().all(|o| !is_redacted(o)),
        "filled markers go out as the real change"
    );
    let seqs: Vec<u64> = ops
        .iter()
        .filter(|o| o.origin.0 == a.device())
        .map(|o| o.origin.1)
        .collect();
    assert_eq!(seqs, [1, 2, 3, 4, 5]);
    d.apply_remote(ops).unwrap();
    assert_eq!(text(&d, "s", s1).as_deref(), Some("secret 1 v2"));

    // A keeps writing; B (still only "n") stays in sequence.
    put(&mut a, "s", s2, "secret 2 v2");
    put(&mut a, "n", n1, "notă v3");
    let r = b.apply_remote(send_only_n(&a, &b.version_vector())).unwrap();
    assert_eq!((r.redacted, r.fast_forward), (1, 1));

    // B's role is widened: it fills from C (which has everything but the
    // newest secret) and then from A.
    let r = b.fill(c.changes_at(&b.unfilled().unwrap()).unwrap()).unwrap();
    assert_eq!(r.filled, 3);
    let r = b.fill(a.changes_at(&b.unfilled().unwrap()).unwrap()).unwrap();
    assert_eq!(r.filled, 1);
    assert_eq!(text(&b, "s", s2).as_deref(), Some("secret 2 v2"));
    assert_eq!(text(&b, "s", s1).as_deref(), Some("secret 1 v2"));

    // Reopening keeps all of it.
    let dir = t.path().join("b");
    drop(b);
    let b = Store::open(&dir, Options::default()).unwrap();
    assert!(b.unfilled().unwrap().is_empty());
    assert_eq!(text(&b, "s", s2).as_deref(), Some("secret 2 v2"));
    let mut e = store(t.path(), "e");
    e.apply_remote(b.changes_since(&e.version_vector()).unwrap()).unwrap();
    assert_eq!(text(&e, "s", s2).as_deref(), Some("secret 2 v2"));
    assert_eq!(text(&e, "n", n1).as_deref(), Some("notă v3"));
    assert!(e.unfilled().unwrap().is_empty());
}
