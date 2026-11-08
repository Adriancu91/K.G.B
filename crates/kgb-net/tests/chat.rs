//! Step 7.4f: team messages between two PCs of the organization, through
//! the real network layer of Etapa 6: text and voice messages travel both
//! ways, the recording arrives whole, a member with no access to any module
//! still gets them, and each new message from the other PC becomes one
//! notification. (The test with two real PCs is step 🔒 6.10.)

use std::sync::{Arc, Mutex};

use kgb_core::identity::DeviceIdentity;
use kgb_core::workspace::Workspace;
use kgb_core::{blobs, chat, invites, notifications, org};
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
fn messages_and_voice_between_two_pcs() {
    let t = tempfile::tempdir().unwrap();
    let (a, b) = (node(&t, "a"), node(&t, "b"));
    join(&a, &b);
    let rec = bytes(40_000, 7);
    let (fa, fb) = (a.1.fingerprint(), b.1.fingerprint());
    {
        let mut wa = a.0.lock().unwrap();
        chat::send(&mut wa, "Ana", &fa, "Bună dimineața! Camionul vine la 10.").unwrap();
        chat::send_voice(&mut wa, "Ana", &fa, &rec, "audio/webm;codecs=opus", 4200).unwrap();
        // Refused input.
        assert!(chat::send(&mut wa, "Ana", &fa, "   ").is_err());
        assert!(chat::send_voice(&mut wa, "Ana", &fa, &rec, "video/mp4", 1000).is_err());
        assert!(chat::send_voice(&mut wa, "Ana", &fa, &rec, "audio/webm", 200_000).is_err());
        assert_eq!(chat::notify(&mut wa, &fa).unwrap(), 0, "own messages are not notified");
    }
    let (net_a, addr_a) = start(&a);
    let (net_b, addr_b) = start(&b);
    pull(&net_b, &*b, &a.1.public_hex(), &addr_a, Some(&addr_b)).unwrap();
    let out = fetch_missing(&net_b, &*b, &addr_a, None).unwrap();
    assert_eq!((out.primite, out.lipsa), (1, 0), "{out:?}");
    {
        let mut wb = b.0.lock().unwrap();
        let msgs = chat::list(wb.store(), 50).unwrap();
        assert_eq!(msgs.len(), 2);
        assert_eq!((msgs[0].autor.as_str(), msgs[0].text.as_str()), ("Ana", "Bună dimineața! Camionul vine la 10."));
        let (mime, got) = chat::voice(&wb, msgs[1].id).unwrap().expect("the recording arrived");
        assert_eq!((mime.as_str(), got), ("audio/webm", rec.clone()));
        assert_eq!(chat::notify(&mut wb, &fb).unwrap(), 2);
        assert_eq!(chat::notify(&mut wb, &fb).unwrap(), 0, "once");
        let titles: Vec<String> = notifications::list(&wb, false, 10).unwrap().into_iter().map(|n| n.titlu).collect();
        assert!(titles.contains(&"Mesaj vocal de la Ana".to_string()), "{titles:?}");
        // Only the author deletes.
        assert!(chat::delete(&mut wb, &fb, msgs[0].id).is_err());
        chat::send(&mut wb, "Ion", &fb, "Am înțeles, îl aștept.").unwrap();
    }
    assert!(blobs::missing(b.0.lock().unwrap().store()).unwrap().is_empty());
    pull(&net_a, &*a, &b.1.public_hex(), &addr_b, Some(&addr_a)).unwrap();
    {
        let mut wa = a.0.lock().unwrap();
        let msgs = chat::list(wa.store(), 50).unwrap();
        assert_eq!(msgs.last().unwrap().text, "Am înțeles, îl aștept.");
        assert_eq!(chat::notify(&mut wa, &fa).unwrap(), 1);
    }
    net_a.shutdown();
    net_b.shutdown();
}
