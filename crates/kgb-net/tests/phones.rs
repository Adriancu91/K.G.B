//! Step 7.4m: what phones send stays on the PC that received it — the
//! phones, the inbox and its photos are not synchronised to another PC of
//! the organization, through the real network layer.

use std::sync::{Arc, Mutex};

use kgb_core::identity::DeviceIdentity;
use kgb_core::workspace::Workspace;
use kgb_core::{blobs, invites, org, phones};
use serde_json::json;
use kgb_net::sync::{Local, SyncHandler, pull};
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

#[test]
fn phone_inbox_stays_on_its_pc() {
    let t = tempfile::tempdir().unwrap();
    let (a, b) = (node(&t, "a"), node(&t, "b"));
    join(&a, &b);
    {
        let mut wa = a.0.lock().unwrap();
        let (id, token) = phones::pair(&mut wa, "Telefon").unwrap();
        phones::approve(&mut wa, id, "Ana").unwrap();
        let p = phones::by_token(&wa, &token).unwrap().unwrap();
        let up = phones::Upload { name: "aviz.jpg".into(), mime: "image/jpeg".into(), data: vec![9; 1000] };
        phones::submit(&mut wa, &p, "document", json!({"nota": "x"}).as_object().unwrap().clone(), vec![up]).unwrap();
    }
    let (net_a, addr_a) = start(&a);
    let (net_b, addr_b) = start(&b);
    pull(&net_b, &*b, &a.1.public_hex(), &addr_a, Some(&addr_b)).unwrap();
    let wb = b.0.lock().unwrap();
    assert!(phones::list(&wb).unwrap().is_empty());
    assert!(phones::inbox(&wb).unwrap().is_empty());
    assert!(blobs::missing(wb.store()).unwrap().is_empty(), "the photo's record did not travel either");
    drop(wb);
    net_a.shutdown();
    net_b.shutdown();
}
