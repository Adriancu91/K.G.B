//! Step 6.8: attached files between devices — the records travel with the
//! data, the bytes separately; a cut transfer resumes where it stopped; the
//! result is checked against its BLAKE3 hash (an altered piece is detected
//! and fetched again); a file is sent only to a role that may read its
//! module; the sending process killed mid-transfer is survived.

use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use kgb_core::identity::DeviceIdentity;
use kgb_core::workspace::Workspace;
use kgb_core::{blobs, files, invites, org};
use kgb_net::sync::{Local, SyncHandler, fetch_missing, pull};
use kgb_net::{Net, Relay};

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

/// Deterministic pseudo-random bytes (incompressible enough for a transfer test).
fn bytes(n: usize, seed: u64) -> Vec<u8> {
    let mut x = seed.wrapping_mul(0x9E3779B97F4A7C15) | 1;
    (0..n)
        .map(|_| {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            x as u8
        })
        .collect()
}

#[test]
fn resume_verify_and_rights() {
    let t = tempfile::tempdir().unwrap();
    let (a, b) = (node(&t, "a"), node(&t, "b"));
    join(&a, &b);
    let big = bytes(20 * 1024 * 1024, 1);
    let secret = bytes(100_000, 2);
    let (fbig, fsecret) = {
        let mut wa = a.0.lock().unwrap();
        (
            files::put(&mut wa, "kgb.notes", "mare.bin", &big).unwrap(),
            files::put(&mut wa, "kgb.business", "factura.pdf", &secret).unwrap(),
        )
    };
    let (net_a, addr_a) = start(&a);
    let (net_b, addr_b) = start(&b);
    pull(&net_b, &*b, &a.1.public_hex(), &addr_a, Some(&addr_b)).unwrap();

    // The note's file is known on B, the business one is not even listed.
    let missing = blobs::missing(b.0.lock().unwrap().store()).unwrap();
    assert_eq!(missing.len(), 1, "{missing:?}");
    assert_eq!(missing[0].hash, fbig.hash);
    assert!(!b.0.lock().unwrap().store().has_blob(&fsecret.hash));

    // The transfer is cut after 5 MB: what arrived is kept…
    let out = fetch_missing(&net_b, &*b, &addr_a, Some(5 * 1024 * 1024)).unwrap();
    assert_eq!((out.primite, out.lipsa), (0, 1), "{out:?}");
    let part = b.0.lock().unwrap().store().incoming_blob_path(&fbig.hash).unwrap();
    let have = std::fs::metadata(&part).unwrap().len();
    assert_eq!(have, 5 * 1024 * 1024);
    // …and the next round continues from there and checks the whole file.
    let out = fetch_missing(&net_b, &*b, &addr_a, None).unwrap();
    assert_eq!((out.primite, out.lipsa), (1, 0), "{out:?}");
    assert!(!part.exists(), "the partial file was moved into place");
    assert_eq!(b.0.lock().unwrap().store().get_blob(&fbig.hash).unwrap(), big);

    // B may not have the business file, even when asking for it directly.
    let dest = t.path().join("furat.part");
    let e = net_b.fetch_blob(&addr_a, &fsecret.hash, &dest, None).unwrap_err();
    assert!(e.contains("nu are acces"), "{e}");

    // An altered piece is detected, thrown away, and fetched again.
    let other = bytes(3 * 1024 * 1024, 3);
    let fother = files::put(&mut a.0.lock().unwrap(), "kgb.notes", "alt.bin", &other).unwrap();
    pull(&net_b, &*b, &a.1.public_hex(), &addr_a, Some(&addr_b)).unwrap();
    fetch_missing(&net_b, &*b, &addr_a, Some(1024 * 1024)).unwrap();
    let part = b.0.lock().unwrap().store().incoming_blob_path(&fother.hash).unwrap();
    let mut p = std::fs::read(&part).unwrap();
    p[1000] ^= 0xFF;
    std::fs::write(&part, &p).unwrap();
    let out = fetch_missing(&net_b, &*b, &addr_a, None).unwrap();
    assert_eq!(out.primite, 0);
    assert!(out.erori.iter().any(|e| e.contains("nu corespunde")), "{out:?}");
    assert!(!part.exists(), "the bad piece is deleted");
    let out = fetch_missing(&net_b, &*b, &addr_a, None).unwrap();
    assert_eq!(out.primite, 1, "{out:?}");
    assert_eq!(b.0.lock().unwrap().store().get_blob(&fother.hash).unwrap(), other);
    net_a.shutdown();
    net_b.shutdown();
}

#[test]
fn sender_killed_mid_transfer_then_resumed() {
    let exe = env!("CARGO_BIN_EXE_kgb-sync-node");
    let t = tempfile::tempdir().unwrap();
    let (a, b) = (node(&t, "a"), node(&t, "b"));
    join(&a, &b);
    let big = bytes(60 * 1024 * 1024, 9);
    let f = files::put(&mut a.0.lock().unwrap(), "kgb.notes", "foarte-mare.bin", &big).unwrap();
    let key_a = a.1.public_hex();
    let a_dir = a.0.lock().unwrap().dir().to_path_buf();
    drop(a);
    let (net_b, addr_b) = start(&b);
    let serve = |file: &std::path::Path| {
        let c = Command::new(exe)
            .args([
                "serve",
                a_dir.to_str().unwrap(),
                t.path().join("key-a").to_str().unwrap(),
                file.to_str().unwrap(),
            ])
            .stdout(Stdio::null())
            .spawn()
            .unwrap();
        let t0 = Instant::now();
        while !file.exists() || std::fs::read_to_string(file).unwrap().is_empty() {
            assert!(t0.elapsed() < Duration::from_secs(30));
            std::thread::sleep(Duration::from_millis(50));
        }
        std::thread::sleep(Duration::from_millis(100));
        c
    };
    let f1 = t.path().join("addr1.json");
    let mut child = serve(&f1);
    let addr_a = std::fs::read_to_string(&f1).unwrap();
    pull(&net_b, &*b, &key_a, &addr_a, Some(&addr_b)).unwrap();
    let part = b.0.lock().unwrap().store().incoming_blob_path(&f.hash).unwrap();

    // Kill the sender once a few MB arrived.
    let p2 = part.clone();
    let killer = std::thread::spawn(move || {
        let t0 = Instant::now();
        while std::fs::metadata(&p2).map(|m| m.len()).unwrap_or(0) < 3 * 1024 * 1024
            && t0.elapsed() < Duration::from_secs(60)
        {
            std::thread::sleep(Duration::from_millis(2));
        }
        child.kill().unwrap();
        child.wait().unwrap();
    });
    let out = fetch_missing(&net_b, &*b, &addr_a, None).unwrap();
    killer.join().unwrap();
    assert_eq!(out.primite, 0, "{out:?}");
    let kept = std::fs::metadata(&part).unwrap().len();
    assert!(kept > 0 && kept < big.len() as u64, "kept {kept}");

    // The sender comes back (same port, so the same address).
    let f2 = t.path().join("addr2.json");
    let mut child = serve(&f2);
    let out = fetch_missing(&net_b, &*b, &addr_a, None).unwrap();
    assert_eq!(out.primite, 1, "{out:?}");
    assert_eq!(b.0.lock().unwrap().store().get_blob(&f.hash).unwrap(), big);
    println!("killed after {kept} bytes; resumed and verified {} bytes", big.len());
    child.kill().unwrap();
    child.wait().unwrap();
    net_b.shutdown();
}
