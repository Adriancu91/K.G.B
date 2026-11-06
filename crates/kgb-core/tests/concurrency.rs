//! Step 2.10: concurrency. The app shares one workspace between threads
//! behind a mutex (as `app/src-tauri` does); these tests hammer that pattern:
//! optimistic updates with conflicts, invariants visible to concurrent readers,
//! compaction steps and backups running between writes, and a second process
//! (here: a second open) refused.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

use kgb_core::backup::{self, Reason};
use kgb_core::workspace::Workspace;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Error as StoreError, Options, Query, Write};
use serde_json::json;
use uuid::Uuid;

const ACCOUNTS: u128 = 8;
const START: i64 = 1_000;

fn fields(balance: i64) -> kgb_store::Fields {
    json!({"balance": balance, "pad": "z".repeat(300)})
        .as_object()
        .unwrap()
        .clone()
}

fn setup(tmp: &tempfile::TempDir) -> Arc<Mutex<Workspace>> {
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    ws.store_mut()
        .write(
            (0..ACCOUNTS)
                .map(|i| Write::put("acc", Uuid::from_u128(i), fields(START)))
                .collect(),
        )
        .unwrap();
    Arc::new(Mutex::new(ws))
}

fn balance(r: &kgb_store::RecordState) -> i64 {
    r.fields["balance"].as_i64().unwrap()
}

/// Moves 1 unit between two accounts with optimistic concurrency. The read
/// and the write happen under *separate* lock acquisitions on purpose, so other
/// threads can interleave and cause real version conflicts.
fn transfer(ws: &Mutex<Workspace>, from: u128, to: u128) -> CoreResult<bool> {
    let (a, b) = {
        let w = ws.lock().unwrap();
        (
            w.store().get("acc", Uuid::from_u128(from))?.unwrap(),
            w.store().get("acc", Uuid::from_u128(to))?.unwrap(),
        )
    };
    thread::yield_now();
    let mut w = ws.lock().unwrap();
    let r = w.store_mut().write(vec![
        Write::put("acc", a.id, fields(balance(&a) - 1)).expect(a.version),
        Write::put("acc", b.id, fields(balance(&b) + 1)).expect(b.version),
    ]);
    match r {
        Ok(_) => Ok(true),
        Err(StoreError::VersionConflict { .. }) => Ok(false),
        Err(e) => Err(CoreError::from(e)),
    }
}

#[test]
fn concurrent_transfers_conflict_but_never_lose_or_tear() {
    let tmp = tempfile::tempdir().unwrap();
    let ws = setup(&tmp);
    let done = Arc::new(AtomicU64::new(0));
    let conflicts = Arc::new(AtomicU64::new(0));
    let stop = Arc::new(AtomicBool::new(false));
    let bad_reads = Arc::new(AtomicU64::new(0));

    // A reader that keeps checking the invariant: money is never created or lost,
    // and no reader ever sees half of a transaction.
    let reader = {
        let (ws, stop, bad) = (ws.clone(), stop.clone(), bad_reads.clone());
        thread::spawn(move || {
            let mut reads = 0u64;
            while !stop.load(Ordering::Relaxed) {
                let w = ws.lock().unwrap();
                let total: i64 = w
                    .store()
                    .query("acc", &Query::default())
                    .unwrap()
                    .records
                    .iter()
                    .map(balance)
                    .sum();
                if total != START * ACCOUNTS as i64 {
                    bad.fetch_add(1, Ordering::Relaxed);
                }
                reads += 1;
            }
            reads
        })
    };

    let writers: Vec<_> = (0..6u128)
        .map(|t| {
            let (ws, done, conflicts) = (ws.clone(), done.clone(), conflicts.clone());
            thread::spawn(move || {
                let mut seed = t as u64 * 7919 + 1;
                let mut ok = 0;
                while ok < 150 {
                    seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
                    let from = (seed >> 33) as u128 % ACCOUNTS;
                    let to = (from + 1 + (seed >> 40) as u128 % (ACCOUNTS - 1)) % ACCOUNTS;
                    if transfer(&ws, from, to).unwrap() {
                        ok += 1;
                    } else {
                        conflicts.fetch_add(1, Ordering::Relaxed);
                    }
                }
                done.fetch_add(ok, Ordering::Relaxed);
            })
        })
        .collect();

    // Maintenance in parallel: compaction steps and a backup between writes.
    let maint = {
        let (ws, stop) = (ws.clone(), stop.clone());
        let root = tmp.path().join("root");
        thread::spawn(move || {
            let mut steps = 0;
            let mut backups = 0;
            while !stop.load(Ordering::Relaxed) {
                {
                    let mut w = ws.lock().unwrap();
                    if w.store_mut().compact_step(0.0).unwrap().is_some() {
                        steps += 1;
                    }
                }
                if backups < 2 {
                    let mut w = ws.lock().unwrap();
                    backup::create(&mut w, &root, Reason::Manual, "concurență").unwrap();
                    backups += 1;
                }
                thread::sleep(std::time::Duration::from_millis(5));
            }
            (steps, backups)
        })
    };

    for w in writers {
        w.join().unwrap();
    }
    stop.store(true, Ordering::Relaxed);
    let reads = reader.join().unwrap();
    let (_steps, backups) = maint.join().unwrap();

    assert_eq!(done.load(Ordering::Relaxed), 6 * 150);
    assert!(
        conflicts.load(Ordering::Relaxed) > 0,
        "the test must actually produce conflicts"
    );
    assert_eq!(
        bad_reads.load(Ordering::Relaxed),
        0,
        "{reads} reads, none saw a torn state"
    );
    assert_eq!(backups, 2);

    // After reopening, everything adds up and every backup is valid.
    let dir = ws.lock().unwrap().dir().to_path_buf();
    let id = ws.lock().unwrap().manifest().id;
    drop(ws);
    let w = Workspace::open(&dir).unwrap();
    let total: i64 = w
        .store()
        .query("acc", &Query::default())
        .unwrap()
        .records
        .iter()
        .map(balance)
        .sum();
    assert_eq!(total, START * ACCOUNTS as i64);
    for b in backup::list(&tmp.path().join("root"), id).unwrap() {
        backup::verify(&b.dir).unwrap();
    }
}

#[test]
fn second_open_of_the_same_workspace_is_refused_from_another_thread() {
    let tmp = tempfile::tempdir().unwrap();
    let ws = setup(&tmp);
    let dir = ws.lock().unwrap().dir().to_path_buf();
    let h = thread::spawn(move || Workspace::open(&dir).map(|_| ()));
    assert!(matches!(h.join().unwrap(), Err(CoreError::WorkspaceInUse(_))));
    // The raw store refuses too, whatever the options.
    let store_dir = ws.lock().unwrap().dir().join("store");
    assert!(matches!(
        kgb_store::Store::open(&store_dir, Options::default()),
        Err(StoreError::Locked(_))
    ));
}

#[test]
fn same_record_written_by_many_threads_keeps_exactly_one_winner_per_version() {
    let tmp = tempfile::tempdir().unwrap();
    let ws = setup(&tmp);
    let id = Uuid::from_u128(0);
    let v0 = ws.lock().unwrap().store().get("acc", id).unwrap().unwrap().version;
    // Ten threads all try to replace version v0; exactly one may succeed.
    let handles: Vec<_> = (0..10)
        .map(|t| {
            let ws = ws.clone();
            thread::spawn(move || {
                let mut w = ws.lock().unwrap();
                w.store_mut()
                    .write(vec![Write::put("acc", id, fields(t)).expect(v0)])
                    .is_ok()
            })
        })
        .collect();
    let winners = handles.into_iter().map(|h| h.join().unwrap()).filter(|ok| *ok).count();
    assert_eq!(winners, 1);
    assert_eq!(
        ws.lock().unwrap().store().get("acc", id).unwrap().unwrap().version,
        v0 + 1
    );
}
