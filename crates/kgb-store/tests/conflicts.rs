//! Step 6.4: a conflict decided on one copy is resolved on every copy that
//! has it — field conflicts and edit-versus-delete — also when the decision
//! arrives through a third copy and after reopening.

use kgb_store::{Fields, Options, Store, Write, sync_pair};
use serde_json::{Value, json};
use uuid::Uuid;

fn store(dir: &std::path::Path, name: &str) -> Store {
    Store::open(dir.join(name), Options::default()).unwrap()
}

fn obj(v: Value) -> Fields {
    match v {
        Value::Object(m) => m,
        _ => unreachable!(),
    }
}

#[test]
fn a_decision_resolves_the_conflict_everywhere() {
    let t = tempfile::tempdir().unwrap();
    let (mut a, mut b, mut c) = (store(t.path(), "a"), store(t.path(), "b"), store(t.path(), "c"));
    let id = Uuid::new_v4();
    a.write(vec![Write::put("n", id, obj(json!({"t": "start", "x": 1})))])
        .unwrap();
    sync_pair(&mut a, &mut b).unwrap();
    sync_pair(&mut b, &mut c).unwrap();
    a.write(vec![Write::put("n", id, obj(json!({"t": "Ana", "x": 1})))])
        .unwrap();
    b.write(vec![Write::put("n", id, obj(json!({"t": "Ion", "x": 1})))])
        .unwrap();
    sync_pair(&mut a, &mut b).unwrap();
    sync_pair(&mut b, &mut c).unwrap();
    let ca = a.conflicts(false).unwrap();
    assert_eq!((ca.len(), b.conflicts(false).unwrap().len()), (1, 1));
    assert_eq!(ca[0].local, json!("Ana"));

    // Ana keeps Ion's value (the one that came from the other PC).
    a.decide_conflict(ca[0].id, false).unwrap();
    assert!(a.conflicts(false).unwrap().is_empty());
    // The decision reaches C through B, and B directly.
    sync_pair(&mut a, &mut b).unwrap();
    sync_pair(&mut b, &mut c).unwrap();
    for s in [&a, &b, &c] {
        assert_eq!(s.get("n", id).unwrap().unwrap().fields["t"], json!("Ion"));
        assert!(s.conflicts(false).unwrap().is_empty(), "resolved on every copy");
    }
    // Choosing the provisional value still propagates the decision.
    a.write(vec![Write::put("n", id, obj(json!({"t": "Ion", "x": 2})))])
        .unwrap();
    b.write(vec![Write::put("n", id, obj(json!({"t": "Ion", "x": 3})))])
        .unwrap();
    sync_pair(&mut a, &mut b).unwrap();
    let cb = b.conflicts(false).unwrap();
    assert_eq!(cb.len(), 1);
    let keep = cb[0].provisional == "local";
    b.decide_conflict(cb[0].id, keep).unwrap();
    sync_pair(&mut a, &mut b).unwrap();
    assert!(a.conflicts(false).unwrap().is_empty());
    assert_eq!(
        a.get("n", id).unwrap().unwrap().fields,
        b.get("n", id).unwrap().unwrap().fields
    );

    // Reopening keeps the conflicts resolved.
    let dir = t.path().join("b");
    drop(b);
    let b = Store::open(&dir, Options::default()).unwrap();
    assert!(b.conflicts(false).unwrap().is_empty());
    assert_eq!(b.conflicts(true).unwrap().len(), 2, "both, resolved");
    let _ = c;
}

#[test]
fn edit_versus_delete_decided_both_ways() {
    let t = tempfile::tempdir().unwrap();
    let (mut a, mut b) = (store(t.path(), "a"), store(t.path(), "b"));
    let (keep, gone) = (Uuid::new_v4(), Uuid::new_v4());
    a.write(vec![
        Write::put("n", keep, obj(json!({"t": "păstrează"}))),
        Write::put("n", gone, obj(json!({"t": "șterge"}))),
    ])
    .unwrap();
    sync_pair(&mut a, &mut b).unwrap();
    // A deletes both, B edits both.
    a.write(vec![Write::delete("n", keep), Write::delete("n", gone)])
        .unwrap();
    b.write(vec![
        Write::put("n", keep, obj(json!({"t": "păstrează v2"}))),
        Write::put("n", gone, obj(json!({"t": "șterge v2"}))),
    ])
    .unwrap();
    sync_pair(&mut a, &mut b).unwrap();
    let cs = a.conflicts(false).unwrap();
    assert_eq!(cs.len(), 2);
    for c in cs {
        // On A, "local" is the deletion: keep the edit for `keep`, the deletion for `gone`.
        a.decide_conflict(c.id, c.record == gone).unwrap();
    }
    sync_pair(&mut a, &mut b).unwrap();
    for s in [&a, &b] {
        assert_eq!(s.get("n", keep).unwrap().unwrap().fields["t"], json!("păstrează v2"));
        assert!(s.get("n", gone).unwrap().is_none());
        assert!(s.conflicts(false).unwrap().is_empty());
    }
}
