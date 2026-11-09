//! Step 7.4h: presence cards between two PCs of the organization, through
//! the real network layer: the administrator sees a member's card (when
//! K.G.B. was open, what they say they work on); the member does not get
//! the administrator's card; a card forged for another device is refused.

use std::sync::{Arc, Mutex};

use kgb_core::identity::DeviceIdentity;
use kgb_core::workspace::Workspace;
use kgb_core::{invites, org, presence};
use kgb_store::{Fields, Write};
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
fn presence_reaches_admins_only_and_cannot_be_forged() {
    let t = tempfile::tempdir().unwrap();
    let (a, b) = (node(&t, "a"), node(&t, "b"));
    join(&a, &b);
    let (fa, fb) = (a.1.fingerprint(), b.1.fingerprint());
    presence::beat(a.0.lock().unwrap().store_mut(), &fa, "m-ana", "Ana Pop").unwrap();
    {
        let mut wb = b.0.lock().unwrap();
        assert!(presence::beat(wb.store_mut(), &fb, "m-ion", "Ion Ionescu").unwrap());
        assert!(!presence::beat(wb.store_mut(), &fb, "m-ion", "Ion Ionescu").unwrap(), "not again within 10 minutes");
        presence::set_mine(wb.store_mut(), &fb, "m-ion", "Ion Ionescu", "inventarul din depozit", "otel").unwrap();
        assert!(presence::set_mine(wb.store_mut(), &fb, "m-ion", "Ion Ionescu", "x", "roz").is_err());
    }
    let (net_a, addr_a) = start(&a);
    let (net_b, addr_b) = start(&b);
    pull(&net_b, &*b, &a.1.public_hex(), &addr_a, Some(&addr_b)).unwrap();
    pull(&net_a, &*a, &b.1.public_hex(), &addr_b, Some(&addr_a)).unwrap();
    pull(&net_b, &*b, &a.1.public_hex(), &addr_a, Some(&addr_b)).unwrap();

    let on_a = presence::all(a.0.lock().unwrap().store()).unwrap();
    let ion = on_a.iter().find(|c| c.dispozitiv == fb).expect("the admin sees the member");
    assert_eq!((ion.initiale.as_str(), ion.lucrez.as_str(), ion.culoare.as_str(), ion.activ), ("II", "inventarul din depozit", "otel", true));
    let on_b = presence::all(b.0.lock().unwrap().store()).unwrap();
    assert_eq!(on_b.len(), 1, "the member sees only their own card");
    assert_eq!(on_b[0].dispozitiv, fb);

    // B writes a card pretending to be A: A refuses it.
    {
        let mut wb = b.0.lock().unwrap();
        let mut f = Fields::new();
        f.insert("dispozitiv".into(), json!(fa));
        f.insert("nume".into(), json!("Ana Pop"));
        f.insert("lucrez".into(), json!("nimic"));
        f.insert("vazut_ms".into(), json!(1));
        wb.store_mut().write(vec![Write::put(presence::PRESENCE_COLLECTION, uuid::Uuid::new_v4(), f).expect(0)]).unwrap();
    }
    pull(&net_a, &*a, &b.1.public_hex(), &addr_b, Some(&addr_a)).unwrap();
    let on_a = presence::all(a.0.lock().unwrap().store()).unwrap();
    assert!(!on_a.iter().any(|c| c.lucrez == "nimic"), "{on_a:?}");
    assert_eq!(presence::initials("ana maria pop"), "AP");
    net_a.shutdown();
    net_b.shutdown();
}
