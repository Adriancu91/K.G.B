//! Test helper for the end-to-end test of step 6.4 (app/e2e/conflicts.mjs):
//! makes a real synchronisation conflict in the last workspace under a data
//! folder. A second copy of the workspace's store is made in a temporary
//! folder, both copies change the text of the first note offline, and the
//! two are synchronised — exactly what two PCs would do.
//!
//! Usage (the app must be closed): cargo run -p kgb-core --example make_conflict -- <KGB_DATA_DIR>
//! Only for throw-away test folders.

use kgb_core::workspace::{Registry, Workspace};
use kgb_store::{Options, Write, sync_pair};
use serde_json::json;

fn main() {
    let root = std::env::args().nth(1).expect("usage: make_conflict <data dir>");
    let reg = Registry::load(root.as_ref()).expect("registry");
    let last = reg.last_opened.expect("a workspace");
    let dir = reg.workspaces.iter().find(|w| w.id == last).expect("known").dir.clone();
    let mut ws = Workspace::open(&dir).expect("workspace (is the app closed?)");
    let tmp = tempfile::tempdir().expect("temp");
    let mut other = kgb_store::Store::open(tmp.path().join("alt-pc"), Options::default()).expect("copy");
    sync_pair(ws.store_mut(), &mut other).expect("first sync");
    let coll = "mod.kgb.notes.notes";
    let id = *ws.store().ids(coll).first().expect("a note");
    let edit = |s: &mut kgb_store::Store, text: &str| {
        let r = s.get(coll, id).unwrap().unwrap();
        let mut f = r.fields.clone();
        f.insert("text".into(), json!(text));
        s.write(vec![Write::put(coll, id, f).expect(r.version)]).unwrap();
    };
    edit(ws.store_mut(), "Versiunea de pe acest PC");
    edit(&mut other, "Versiunea de pe celălalt PC");
    sync_pair(ws.store_mut(), &mut other).expect("second sync");
    println!("conflicte: {}", ws.store().conflicts(false).unwrap().len());
}
