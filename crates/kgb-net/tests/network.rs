//! Step 6.5: synchronisation over a real network (QUIC over the loopback
//! interface, no relay) — between two endpoints in one process, and between
//! two **processes** (the `kgb-sync-node` test aid). This proves the program
//! works over real sockets; it says nothing about a LAN or the internet,
//! which need two PCs (🔒 6.10).

use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use kgb_core::identity::DeviceIdentity;
use kgb_core::workspace::Workspace;
use kgb_core::{invites, org, peers, replication};
use kgb_net::sync::{Local, SyncHandler, pull, pull_all};
use kgb_net::{Net, Path, Relay};
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

fn start(n: &Arc<Node>, port: u16) -> (Net, String) {
    let h = Arc::new(SyncHandler::new(n.clone()));
    let cell = h.addr.clone();
    let net = Net::start(&n.1.secret_bytes(), Relay::Off, port, h).unwrap();
    let addr = net.addr();
    *cell.lock().unwrap() = Some(addr.clone());
    (net, addr)
}

fn put(ws: &mut Workspace, id: Uuid, text: &str) {
    let mut f = Fields::new();
    f.insert("t".into(), json!(text));
    ws.store_mut().write(vec![Write::put(NOTES, id, f)]).unwrap();
}

fn text(ws: &Workspace, id: Uuid) -> Option<String> {
    ws.store()
        .get(NOTES, id)
        .unwrap()
        .and_then(|r| r.fields.get("t").and_then(Value::as_str).map(String::from))
}

/// A creates the organization and invites Ion; B joins (codes carry the
/// network addresses); A approves.
fn join(a: &Node, b: &Node, addr_a: Option<&str>, addr_b: Option<&str>) {
    let mut wa = a.0.lock().unwrap();
    let mut wb = b.0.lock().unwrap();
    org::create(wa.store_mut(), "Firma Test SRL", "Ana", &a.1, "PC A").unwrap();
    let ion = org::add_member(wa.store_mut(), &a.1, "Ion", org::role_member()).unwrap();
    let inv = invites::create_from(wa.store_mut(), &a.1, ion, 24, addr_a).unwrap();
    let req = invites::request_from(wb.store_mut(), &inv.code, &b.1, "PC B", addr_b).unwrap();
    let p = invites::receive(wa.store_mut(), &a.1, &req.code).unwrap();
    invites::approve(wa.store_mut(), &a.1, p.id).unwrap();
}

#[test]
fn two_endpoints_over_real_sockets() {
    let t = tempfile::tempdir().unwrap();
    let (a, b) = (node(&t, "a"), node(&t, "b"));
    let (net_a, addr_a) = start(&a, 0);
    let (net_b, addr_b) = start(&b, 0);
    join(&a, &b, Some(&addr_a), Some(&addr_b));
    let n1 = Uuid::new_v4();
    put(&mut a.0.lock().unwrap(), n1, "de la Ana");

    // B knows A's address from the invitation; A knows B's from the request.
    let out = pull_all(&net_b, &*b, Some(&addr_b)).unwrap();
    assert_eq!(out.len(), 1, "{out:?}");
    assert!(out[0].error.is_none(), "{out:?}");
    assert_eq!(out[0].path, Some(Path::Direct));
    assert_eq!(text(&b.0.lock().unwrap(), n1).as_deref(), Some("de la Ana"));
    let n2 = Uuid::new_v4();
    put(&mut b.0.lock().unwrap(), n2, "de la Ion");
    let out = pull_all(&net_a, &*a, Some(&addr_a)).unwrap();
    assert!(out[0].error.is_none(), "{out:?}");
    assert_eq!(text(&a.0.lock().unwrap(), n2).as_deref(), Some("de la Ion"));
    let seen = peers::list(a.0.lock().unwrap().store(), &a.1.public_hex()).unwrap();
    assert_eq!(seen[0].path.as_deref(), Some("direct"));
    assert!(seen[0].ok_ms.is_some());

    // A request signed by B but sent from another device's connection.
    let c = node(&t, "c");
    let (net_c, _) = start(&c, 0);
    let forged = replication::request(b.0.lock().unwrap().store(), &b.1).unwrap();
    let e = net_c.exchange(&addr_a, &forged).unwrap_err();
    assert!(e.contains("alt dispozitiv"), "{e}");
    // A device of another organization.
    {
        let mut wc = c.0.lock().unwrap();
        org::create(wc.store_mut(), "Alta SRL", "Cora", &c.1, "PC C").unwrap();
    }
    let req = replication::request(c.0.lock().unwrap().store(), &c.1).unwrap();
    let e = net_c.exchange(&addr_a, &req).unwrap_err();
    assert!(e.contains("altă organizație"), "{e}");

    // A goes offline: B fails cleanly, in bounded time, and keeps working.
    let port_a = net_a.port();
    net_a.shutdown();
    let t0 = Instant::now();
    let e = pull(&net_b, &*b, &a.1.public_hex(), &addr_a, None).unwrap_err();
    assert!(t0.elapsed() < Duration::from_secs(30), "{:?}", t0.elapsed());
    assert!(!e.is_empty());
    let n3 = Uuid::new_v4();
    put(&mut b.0.lock().unwrap(), n3, "scrisă offline");
    let seen = peers::list(b.0.lock().unwrap().store(), &b.1.public_hex()).unwrap();
    assert!(seen[0].error.is_some(), "the failure is recorded");

    // A comes back on the same port: the old address works again.
    let (net_a, _) = start(&a, port_a);
    assert_eq!(net_a.port(), port_a);
    let (s, path) = pull(&net_a, &*a, &b.1.public_hex(), &addr_b, None).unwrap();
    assert_eq!(path, Path::Direct);
    assert!(s.create >= 1, "{s:?}");
    assert_eq!(text(&a.0.lock().unwrap(), n3).as_deref(), Some("scrisă offline"));
    net_a.shutdown();
    net_b.shutdown();
    net_c.shutdown();
}

#[test]
fn two_processes() {
    let exe = env!("CARGO_BIN_EXE_kgb-sync-node");
    let t = tempfile::tempdir().unwrap();
    let (a, b) = (node(&t, "a"), node(&t, "b"));
    let (net_b, addr_b) = start(&b, 0);
    join(&a, &b, None, Some(&addr_b));
    let n1 = Uuid::new_v4();
    put(&mut a.0.lock().unwrap(), n1, "din procesul A");
    let key_a = a.1.public_hex();
    let a_dir = a.0.lock().unwrap().dir().to_path_buf();
    drop(a); // the other process opens A's workspace

    // Process A serves; this process (B) pulls from it.
    let addr_file = t.path().join("addr-a.json");
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
    let t0 = Instant::now();
    while !addr_file.exists() || std::fs::read_to_string(&addr_file).unwrap().is_empty() {
        assert!(t0.elapsed() < Duration::from_secs(30), "the node did not start");
        std::thread::sleep(Duration::from_millis(100));
    }
    std::thread::sleep(Duration::from_millis(200));
    let addr_a = std::fs::read_to_string(&addr_file).unwrap();
    let (s, path) = pull(&net_b, &*b, &key_a, &addr_a, Some(&addr_b)).unwrap();
    assert_eq!(path, Path::Direct);
    assert!(s.create > 0, "{s:?}");
    assert_eq!(text(&b.0.lock().unwrap(), n1).as_deref(), Some("din procesul A"));
    child.kill().unwrap();
    child.wait().unwrap();

    // Now process A pulls from this process (B serves).
    let n2 = Uuid::new_v4();
    put(&mut b.0.lock().unwrap(), n2, "din procesul B");
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
    let v: Value =
        serde_json::from_slice(&out.stdout).unwrap_or_else(|_| panic!("{}", String::from_utf8_lossy(&out.stderr)));
    assert!(v.get("ok").is_some(), "{v}");
    let wa = Workspace::open(&a_dir).unwrap();
    assert_eq!(text(&wa, n2).as_deref(), Some("din procesul B"));
    net_b.shutdown();
}
