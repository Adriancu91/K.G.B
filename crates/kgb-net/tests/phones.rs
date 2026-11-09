//! Step 7.4m-4 (D-069), through the real network layer: the phone page works
//! on every PC of the organization.
//! - A phone that pairs on a member's PC reaches the administrator, who
//!   approves it; the approval comes back, so the phone can send from there.
//! - What it sends (with its photo) reaches the administrator; another
//!   member's PC does not receive it.
//! - The switch and the approval come only from an administrator; each PC
//!   writes only its own card with its addresses.

use std::sync::{Arc, Mutex};

use kgb_core::identity::DeviceIdentity;
use kgb_core::workspace::Workspace;
use kgb_core::{blobs, invites, org, phones};
use kgb_store::{Fields, Write};
use kgb_net::sync::{Local, SyncHandler, fetch_missing, pull};
use kgb_net::{Net, Relay};
use serde_json::json;

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

/// A is the administrator's PC; B and C belong to two members.
fn join(a: &Node, others: &[(&Node, &str)]) {
    let mut wa = a.0.lock().unwrap();
    org::create(wa.store_mut(), "Firma Test SRL", "Ana", &a.1, "PC A").unwrap();
    for (n, who) in others {
        let mut wn = n.0.lock().unwrap();
        let m = org::add_member(wa.store_mut(), &a.1, who, org::role_member()).unwrap();
        let inv = invites::create(wa.store_mut(), &a.1, m, 24).unwrap();
        let req = invites::request(wn.store_mut(), &inv.code, &n.1, &format!("PC {who}")).unwrap();
        let p = invites::receive(wa.store_mut(), &a.1, &req.code).unwrap();
        invites::approve(wa.store_mut(), &a.1, p.id).unwrap();
    }
}

fn fields(v: serde_json::Value) -> serde_json::Map<String, serde_json::Value> {
    v.as_object().unwrap().clone()
}

#[test]
fn phone_page_works_on_every_pc() {
    let t = tempfile::tempdir().unwrap();
    let (a, b, c) = (node(&t, "a"), node(&t, "b"), node(&t, "c"));
    join(&a, &[(&b, "Ion"), (&c, "Maria")]);
    let (net_a, addr_a) = start(&a);
    let (net_b, addr_b) = start(&b);
    let (net_c, addr_c) = start(&c);
    let (ka, kb) = (a.1.public_hex(), b.1.public_hex());
    // The members' PCs learn the organization first.
    pull(&net_b, &*b, &ka, &addr_a, Some(&addr_b)).unwrap();
    pull(&net_c, &*c, &ka, &addr_a, Some(&addr_c)).unwrap();

    // On Ion's PC: a phone pairs; the PC publishes its card. Ion's PC also
    // tries what only an administrator may do.
    let fb = b.1.fingerprint();
    let token = {
        let mut wb = b.0.lock().unwrap();
        let (_, token) = phones::pair(&mut wb, "Telefon depozit").unwrap();
        assert!(phones::publish_host(&mut wb, &fb, "PC Ion", &["http://192.168.1.20:8737/m".into()], true).unwrap());
        assert!(!phones::publish_host(&mut wb, &fb, "PC Ion", &["http://192.168.1.20:8737/m".into()], true).unwrap(), "unchanged: no new write");
        phones::set_service(&mut wb, true).unwrap();
        let mut forged = Fields::new();
        forged.insert("nume".into(), json!("Telefon fals"));
        forged.insert("token".into(), json!("0".repeat(64)));
        forged.insert("stare".into(), json!("aprobat"));
        forged.insert("membru_nume".into(), json!("Ana"));
        let fake_card_of_a = {
            let mut f = Fields::new();
            f.insert("dispozitiv".into(), json!(a.1.fingerprint()));
            f.insert("adrese".into(), json!(["http://10.0.0.66:8737/m"]));
            f
        };
        wb.store_mut()
            .write(vec![
                Write::put(phones::PHONES_COLLECTION, uuid::Uuid::now_v7(), forged).expect(0),
                Write::put(phones::HOSTS_COLLECTION, uuid::Uuid::now_v7(), fake_card_of_a).expect(0),
            ])
            .unwrap();
        token
    };

    // The administrator receives the waiting phone and Ion's card, nothing forged.
    pull(&net_a, &*a, &kb, &addr_b, Some(&addr_a)).unwrap();
    let pid = {
        let mut wa = a.0.lock().unwrap();
        let list = phones::list(&wa).unwrap();
        assert_eq!(list.iter().map(|p| (p.nume.as_str(), p.stare.as_str())).collect::<Vec<_>>(), vec![("Telefon depozit", "asteapta")]);
        assert!(!phones::service_on(&wa).unwrap(), "a member does not switch the page on");
        let hosts = phones::hosts(&wa, None).unwrap();
        assert_eq!(hosts.len(), 1, "{hosts:?}");
        assert_eq!((hosts[0].nume.as_str(), hosts[0].adrese.clone()), ("PC Ion", vec!["http://192.168.1.20:8737/m".to_string()]));
        phones::approve(&mut wa, list[0].id, "Ion").unwrap();
        phones::set_service(&mut wa, true).unwrap();
        list[0].id
    };

    // The approval and the switch come back to Ion's PC: the phone sends from there.
    pull(&net_b, &*b, &ka, &addr_a, Some(&addr_b)).unwrap();
    {
        let mut wb = b.0.lock().unwrap();
        assert!(phones::service_on(&wb).unwrap());
        let p = phones::by_token(&wb, &token).unwrap().unwrap();
        assert_eq!((p.id, p.stare.as_str(), p.membru_nume.as_str()), (pid, "aprobat", "Ion"));
        phones::seen(&mut wb, p.id).unwrap();
        let up = phones::Upload { name: "aviz.jpg".into(), mime: "image/jpeg".into(), data: vec![9; 1000] };
        phones::submit(&mut wb, &p, "document", fields(json!({"sofer": "Vasile", "nota": "aviz"})), vec![up]).unwrap();
    }

    // The administrator gets it, with the photo.
    pull(&net_a, &*a, &kb, &addr_b, Some(&addr_a)).unwrap();
    fetch_missing(&net_a, &*a, &addr_b, None).unwrap();
    {
        let mut wa = a.0.lock().unwrap();
        assert!(blobs::missing(wa.store()).unwrap().is_empty(), "the photo arrived");
        let inbox = phones::inbox(&wa).unwrap();
        assert_eq!(inbox.len(), 1);
        assert_eq!((inbox[0]["campuri"]["sofer"].as_str(), inbox[0]["membru_nume"].as_str()), (Some("Vasile"), Some("Ion")));
        let fid: uuid::Uuid = inbox[0]["fisiere"][0]["id"].as_str().unwrap().parse().unwrap();
        assert_eq!(phones::file(&wa, fid).unwrap().1, vec![9; 1000]);
        let id: uuid::Uuid = inbox[0]["id"].as_str().unwrap().parse().unwrap();
        phones::mark_done(&mut wa, id, true).unwrap();
        // „Last seen” stays on Ion's PC.
        assert_eq!(phones::list(&wa).unwrap()[0].vazut_ms, phones::list(&wa).unwrap()[0].creat_ms);
    }

    // Maria's PC knows the phone (it may answer it too) but not what it sent.
    pull(&net_c, &*c, &ka, &addr_a, Some(&addr_c)).unwrap();
    pull(&net_c, &*c, &kb, &addr_b, Some(&addr_c)).unwrap();
    {
        let wc = c.0.lock().unwrap();
        assert_eq!(phones::by_token(&wc, &token).unwrap().map(|p| p.stare), Some("aprobat".into()));
        assert!(phones::inbox(&wc).unwrap().is_empty());
        assert!(blobs::missing(wc.store()).unwrap().is_empty(), "no photo record either");
        assert_eq!(phones::hosts(&wc, None).unwrap().len(), 1);
    }

    // Removed by the administrator: refused on every PC after the next round.
    {
        let mut wa = a.0.lock().unwrap();
        phones::revoke(&mut wa, pid).unwrap();
    }
    pull(&net_b, &*b, &ka, &addr_a, Some(&addr_b)).unwrap();
    {
        let mut wb = b.0.lock().unwrap();
        let p = phones::by_token(&wb, &token).unwrap().unwrap();
        assert!(phones::submit(&mut wb, &p, "document", fields(json!({"nota": "y"})), vec![]).is_err());
    }
    net_a.shutdown();
    net_b.shutdown();
    net_c.shutdown();
}
