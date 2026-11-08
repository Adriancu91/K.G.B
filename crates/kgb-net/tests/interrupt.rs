//! Step 6.6: offline work and interrupted synchronisation, with real
//! processes killed abruptly (TerminateProcess) at random moments:
//! - the **receiving** process killed while it applies a large answer: its
//!   workspace always opens, nothing is lost, nothing is applied twice, and
//!   the next round finishes the job;
//! - the **answering** process killed while it sends: the receiver applies
//!   all of an answer or none of it;
//! - changes made while the other PC is away wait in the journal and all go
//!   out, in order, at the next round.

use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use kgb_core::identity::DeviceIdentity;
use kgb_core::workspace::Workspace;
use kgb_core::{invites, org};
use kgb_net::sync::{Local, SyncHandler, pull};
use kgb_net::{Net, Relay};
use kgb_store::{Fields, Write};
use serde_json::{Value, json};
use uuid::Uuid;

const NOTES: &str = "mod.kgb.notes.items";

struct Node(Mutex<Workspace>, DeviceIdentity);

impl Local for Node {
    fn run(&self, f: &mut dyn FnMut(&mut Workspace, &DeviceIdentity)) -> bool {
        match self.0.lock() {
            Ok(mut ws) => {
                f(&mut ws, &self.1);
                true
            }
            Err(_) => false,
        }
    }
}

fn node(t: &tempfile::TempDir, name: &str) -> Arc<Node> {
    let ws = Workspace::create(&t.path().join(name), name).unwrap();
    let dev = DeviceIdentity::load_or_create(&t.path().join(format!("key-{name}"))).unwrap();
    Arc::new(Node(Mutex::new(ws), dev))
}

fn start(n: &Arc<Node>) -> (Net, String) {
    let h = Arc::new(SyncHandler::new(n.clone()));
    let cell = h.addr.clone();
    let net = Net::start(&n.1.secret_bytes(), Relay::Off, 0, h).unwrap();
    let addr = net.addr();
    *cell.lock().unwrap() = Some(addr.clone());
    (net, addr)
}

/// Ana (A) creates the organization; Ion's PC (B) joins.
fn join(a: &Node, b: &Node) {
    let mut wa = a.0.lock().unwrap();
    let mut wb = b.0.lock().unwrap();
    org::create(wa.store_mut(), "Firma Test SRL", "Ana", &a.1, "PC A").unwrap();
    let ion = org::add_member(wa.store_mut(), &a.1, "Ion", org::role_member()).unwrap();
    let inv = invites::create(wa.store_mut(), &a.1, ion, 24).unwrap();
    let req = invites::request(wb.store_mut(), &inv.code, &b.1, "PC B").unwrap();
    let p = invites::receive(wa.store_mut(), &a.1, &req.code).unwrap();
    invites::approve(wa.store_mut(), &a.1, p.id).unwrap();
}

/// Writes `n` notes in batches; returns their ids.
fn notes(ws: &mut Workspace, n: usize, prefix: &str) -> Vec<Uuid> {
    let ids: Vec<Uuid> = (0..n).map(|_| Uuid::new_v4()).collect();
    for chunk in ids.chunks(500) {
        let batch = chunk
            .iter()
            .enumerate()
            .map(|(i, id)| {
                let mut f = Fields::new();
                f.insert("t".into(), json!(format!("{prefix} {i}")));
                f.insert("umplutura".into(), json!("x".repeat(200)));
                Write::put(NOTES, *id, f)
            })
            .collect();
        ws.store_mut().write(batch).unwrap();
    }
    ids
}

/// A small deterministic random sequence (no extra dependency).
struct Lcg(u64);
impl Lcg {
    fn next(&mut self, max: u64) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        (self.0 >> 33) % max
    }
}

/// Total size of a workspace's journal segments.
fn journal_bytes(dir: &std::path::Path) -> u64 {
    fn walk(d: &std::path::Path, acc: &mut u64) {
        for e in std::fs::read_dir(d).into_iter().flatten().flatten() {
            let p = e.path();
            if p.is_dir() {
                walk(&p, acc);
            } else if p.extension().is_some_and(|x| x == "kjl") {
                *acc += e.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
    }
    let mut n = 0;
    walk(dir, &mut n);
    n
}

fn wait_file(path: &std::path::Path) {
    let t0 = Instant::now();
    while !path.exists() || std::fs::read_to_string(path).unwrap().is_empty() {
        assert!(t0.elapsed() < Duration::from_secs(30), "the node did not start");
        std::thread::sleep(Duration::from_millis(50));
    }
    std::thread::sleep(Duration::from_millis(100));
}

#[test]
fn receiver_killed_while_applying() {
    let exe = env!("CARGO_BIN_EXE_kgb-sync-node");
    let t = tempfile::tempdir().unwrap();
    let (a, b) = (node(&t, "a"), node(&t, "b"));
    join(&a, &b);
    const N: usize = 12000;
    let ids = notes(&mut a.0.lock().unwrap(), N, "nota");
    let (net_a, addr_a) = start(&a);
    let addr_file = t.path().join("addr-a.json");
    std::fs::write(&addr_file, &addr_a).unwrap();
    let key_a = a.1.public_hex();
    let b_dir = b.0.lock().unwrap().dir().to_path_buf();
    drop(b); // the child process is PC B

    let mut rng = Lcg(42);
    let (mut killed, mut partial, mut done) = (0, 0, false);
    for round in 0..80 {
        let mut child = Command::new(exe)
            .args([
                "pull",
                b_dir.to_str().unwrap(),
                t.path().join("key-b").to_str().unwrap(),
                &key_a,
                addr_file.to_str().unwrap(),
            ])
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        // Delays grow step by step (with a little noise), so some stop lands
        // while the answer is being applied, whatever this PC's speed.
        // Most rounds: stop the process as soon as its journal starts to grow
        // (it is applying the answer); some rounds: stop it at a random moment.
        let base = journal_bytes(&b_dir);
        let grow = 2_000 + rng.next(400_000);
        let delay = 100 + rng.next(3000);
        let random_stop = round % 4 == 3;
        let t0 = Instant::now();
        let mut finished = false;
        loop {
            if child.try_wait().unwrap().is_some() {
                finished = true;
                break;
            }
            if random_stop && t0.elapsed() > Duration::from_millis(delay) {
                break;
            }
            if !random_stop && journal_bytes(&b_dir) > base + grow {
                break;
            }
            if t0.elapsed() > Duration::from_secs(60) {
                break;
            }
            std::thread::sleep(Duration::from_millis(1));
        }
        if !finished {
            child.kill().unwrap();
            killed += 1;
        }
        let out = child.wait_with_output().unwrap();
        // Whatever happened, B's workspace opens and holds a prefix of A's notes.
        let wb = Workspace::open(&b_dir).unwrap_or_else(|e| panic!("round {round}: B does not open: {e}"));
        let have = ids
            .iter()
            .filter(|id| wb.store().get(NOTES, **id).unwrap().is_some())
            .count();
        for id in &ids {
            if let Some(r) = wb.store().get(NOTES, *id).unwrap() {
                assert_eq!(r.version, 1, "round {round}: a note was applied twice");
            }
        }
        if have > 0 && have < N {
            partial += 1;
        }
        drop(wb);
        if finished {
            let v: Value = serde_json::from_slice(&out.stdout).unwrap();
            assert!(v.get("ok").is_some(), "round {round}: {v}");
            done = true;
            break;
        }
    }
    assert!(done, "the synchronisation never finished");
    assert!(killed >= 3, "too few interruptions to mean anything: {killed}");
    assert!(
        partial >= 1,
        "no interruption landed in the middle of applying (killed {killed})"
    );
    let wb = Workspace::open(&b_dir).unwrap();
    for (i, id) in ids.iter().enumerate() {
        let r = wb.store().get(NOTES, *id).unwrap().expect("every note arrived");
        assert_eq!(r.fields["t"], json!(format!("nota {}", i % 500)));
        assert_eq!(r.version, 1);
    }
    println!("killed {killed} times, {partial} times in the middle; all {N} notes arrived once");
    net_a.shutdown();
}

#[test]
fn answerer_killed_while_sending_and_offline_queue() {
    let exe = env!("CARGO_BIN_EXE_kgb-sync-node");
    let t = tempfile::tempdir().unwrap();
    let (a, b) = (node(&t, "a"), node(&t, "b"));
    join(&a, &b);
    const N: usize = 6000;
    let ids = notes(&mut a.0.lock().unwrap(), N, "nota");
    let key_a = a.1.public_hex();
    let a_dir = a.0.lock().unwrap().dir().to_path_buf();
    drop(a); // the child process is PC A
    let (net_b, addr_b) = start(&b);

    let count = |b: &Node| {
        ids.iter()
            .filter(|id| b.0.lock().unwrap().store().get(NOTES, **id).unwrap().is_some())
            .count()
    };
    let mut rng = Lcg(7);
    let (mut failed, mut ok) = (0, false);
    for round in 0..15 {
        let addr_file = t.path().join(format!("addr-a-{round}.json"));
        let mut child = Command::new(exe)
            .args([
                "serve",
                a_dir.to_str().unwrap(),
                t.path().join("key-a").to_str().unwrap(),
                addr_file.to_str().unwrap(),
            ])
            .stdout(Stdio::null())
            .spawn()
            .unwrap();
        wait_file(&addr_file);
        let addr_a = std::fs::read_to_string(&addr_file).unwrap();
        let delay = rng.next(1500);
        let killer = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(delay));
            let _ = child.kill();
            child.wait().unwrap();
        });
        let r = pull(&net_b, &*b, &key_a, &addr_a, Some(&addr_b));
        killer.join().unwrap();
        let have = count(&b);
        assert!(
            have == 0 || have == N,
            "round {round}: a partial answer was applied ({have})"
        );
        match r {
            Ok(_) => {
                assert_eq!(have, N);
                ok = true;
                break;
            }
            Err(_) => failed += 1,
        }
    }
    assert!(ok, "never got a complete answer");
    assert!(failed >= 1, "no answer was interrupted");

    // Offline queue: A is away; B keeps working; then A pulls everything, in order.
    let mut mine = Vec::new();
    for i in 0..200 {
        let id = Uuid::new_v4();
        let mut f = Fields::new();
        f.insert("t".into(), json!(format!("offline {i}")));
        b.0.lock()
            .unwrap()
            .store_mut()
            .write(vec![Write::put(NOTES, id, f)])
            .unwrap();
        mine.push(id);
    }
    let first = mine[0];
    let mut f = Fields::new();
    f.insert("t".into(), json!("offline 0, modificată"));
    let v = b.0.lock().unwrap().store().get(NOTES, first).unwrap().unwrap().version;
    b.0.lock()
        .unwrap()
        .store_mut()
        .write(vec![Write::put(NOTES, first, f).expect(v)])
        .unwrap();
    let b_file = t.path().join("addr-b.json");
    std::fs::write(&b_file, &addr_b).unwrap();
    let out = Command::new(exe)
        .args([
            "pull",
            a_dir.to_str().unwrap(),
            t.path().join("key-a").to_str().unwrap(),
            &b.1.public_hex(),
            b_file.to_str().unwrap(),
        ])
        .output()
        .unwrap();
    let v: Value = serde_json::from_slice(&out.stdout).unwrap();
    assert!(v.get("ok").is_some(), "{v}");
    let wa = Workspace::open(&a_dir).unwrap();
    for (i, id) in mine.iter().enumerate() {
        let want = if i == 0 {
            "offline 0, modificată".to_string()
        } else {
            format!("offline {i}")
        };
        assert_eq!(wa.store().get(NOTES, *id).unwrap().unwrap().fields["t"], json!(want));
    }
    println!("{failed} interrupted answers, none applied in part; 201 offline changes arrived");
    net_b.shutdown();
}
