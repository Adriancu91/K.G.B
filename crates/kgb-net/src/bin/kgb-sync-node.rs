//! Test aid for step 6.5: a K.G.B. synchronisation node without a window, to
//! test the network between two **processes** (tests/network.rs).
//!
//!   kgb-sync-node serve <workspace> <key-dir> <addr-file> [port]
//!       answers peers until killed; writes its address to <addr-file>
//!   kgb-sync-node pull <workspace> <key-dir> <peer-key> <peer-addr-file>
//!       one synchronisation from the peer; prints the summary as JSON
//!   kgb-sync-node join <workspace> <key-dir> <invite-file> <request-out>
//!       (creates the workspace) answers an invitation, writes the request
//!   kgb-sync-node pull-all <workspace> <key-dir>
//!       one round with every known device; prints the outcomes as JSON
//!   kgb-sync-node note <workspace> <text>
//!       writes a note (as the Notes module stores them)
//!
//! The port is kept in the workspace's network settings, like the app does,
//! so `serve` listens where `join` said it would.
//!
//! Direct connections only (no relay). Only for throw-away test folders.

use std::sync::{Arc, Mutex};

use kgb_core::identity::DeviceIdentity;
use kgb_core::workspace::Workspace;
use kgb_core::{invites, peers};
use kgb_net::sync::{Local, SyncHandler, pull, pull_all};
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

/// Starts the network on the port saved in the workspace (and saves it).
fn start(node: &Arc<Node>) -> (Net, String, Arc<SyncHandler<Node>>) {
    let port = peers::network_settings(node.0.lock().unwrap().store()).unwrap().1;
    let handler = Arc::new(SyncHandler::new(node.clone()));
    let net = Net::start(&node.1.secret_bytes(), Relay::Off, port, handler.clone()).expect("network");
    let addr = net.addr();
    *handler.addr.lock().unwrap() = Some(addr.clone());
    peers::save_network_settings(node.0.lock().unwrap().store_mut(), "off", net.port()).unwrap();
    (net, addr, handler)
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let open = |ws: &str, key: &str| {
        let w = Workspace::open(ws.as_ref()).expect("workspace");
        let d = DeviceIdentity::load_or_create(key.as_ref()).expect("device key");
        Arc::new(Node(Mutex::new(w), d))
    };
    match args.iter().map(String::as_str).collect::<Vec<_>>().as_slice() {
        ["serve", ws, key, out] => {
            let node = open(ws, key);
            let (net, addr, _h) = start(&node);
            std::fs::write(out, &addr).expect("addr file");
            println!("ready {}", net.port());
            loop {
                std::thread::sleep(std::time::Duration::from_secs(3600));
            }
        }
        ["pull", ws, key, peer, peer_addr_file] => {
            let node = open(ws, key);
            let net = Net::start(
                &node.1.secret_bytes(),
                Relay::Off,
                0,
                Arc::new(SyncHandler::new(node.clone())),
            )
            .expect("network");
            let addr = std::fs::read_to_string(peer_addr_file).expect("peer addr");
            let my = net.addr();
            match pull(&net, &*node, peer, &addr, Some(&my)) {
                Ok((s, path)) => println!("{}", serde_json::json!({"ok": s, "path": path})),
                Err(e) => println!("{}", serde_json::json!({"eroare": e})),
            }
            net.shutdown();
        }
        ["join", ws, key, invite, out] => {
            if !std::path::Path::new(ws).join("workspace.json").exists() {
                Workspace::create(ws.as_ref(), "PC nou").expect("workspace");
            }
            let node = open(ws, key);
            let (net, addr, _h) = start(&node);
            let code = std::fs::read_to_string(invite).expect("invite file");
            let r = invites::request_from(
                node.0.lock().unwrap().store_mut(),
                code.trim(),
                &node.1,
                "PC-TEST-B",
                Some(&addr),
            )
            .expect("request");
            std::fs::write(out, &r.code).expect("request file");
            println!("{}", r.fingerprint);
            net.shutdown();
        }
        ["pull-all", ws, key] => {
            let node = open(ws, key);
            let (net, addr, _h) = start(&node);
            let out = pull_all(&net, &*node, Some(&addr)).expect("round");
            println!("{}", serde_json::to_string(&out).unwrap());
            net.shutdown();
        }
        ["note", ws, text] => {
            let mut w = Workspace::open(ws.as_ref()).expect("workspace");
            let now = kgb_core::workspace::now_ms();
            let mut f = kgb_store::Fields::new();
            f.insert("text".into(), serde_json::json!(text));
            f.insert("created_ms".into(), serde_json::json!(now));
            f.insert("updated_ms".into(), serde_json::json!(now));
            w.store_mut()
                .write(vec![kgb_store::Write::put(
                    "mod.kgb.notes.notes",
                    uuid::Uuid::new_v4(),
                    f,
                )])
                .expect("note");
        }
        _ => {
            eprintln!(
                "usage: kgb-sync-node serve <ws> <key-dir> <addr-file> [port] | pull <ws> <key-dir> <peer-key> <peer-addr-file>"
            );
            std::process::exit(2);
        }
    }
}
