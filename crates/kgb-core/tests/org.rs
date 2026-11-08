//! Step 6.1 (D-056): organization, people and roles per module.
//! - Without an organization nothing changes (one person, full access).
//! - A role without access cannot use the module; a read-only role reads but
//!   every write is refused (and audited); nothing is written.
//! - The organization never loses its last administrator.
//! - Roles survive reopening the workspace.

use std::collections::BTreeMap;

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext, ModuleManager, audit_log};
use kgb_core::org::{self, Access, RoleInput};
use kgb_core::workspace::Workspace;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, Write};
use serde_json::{Value, json};
use uuid::Uuid;

struct Notes(Manifest);

impl Module for Notes {
    fn manifest(&self) -> &Manifest {
        &self.0
    }
    fn handle(&self, ctx: &mut ModuleContext<'_>, cmd: &str, a: Value) -> CoreResult<Value> {
        match cmd {
            "add" => {
                let mut f = Fields::new();
                f.insert("t".into(), a["t"].clone());
                ctx.write(vec![Write::put("items", Uuid::new_v4(), f)])?;
                Ok(Value::Null)
            }
            "count" => Ok(json!(ctx.count("items")?)),
            "can_write" => Ok(json!(ctx.can_write())),
            _ => Err(CoreError::invalid("cmd", "necunoscut")),
        }
    }
}

fn manifest(id: &str) -> Manifest {
    let v = json!({
        "manifest_format": 1, "id": id, "name": id, "description": "d", "version": "0.1.0",
        "core": ">=0.1.0, <0.2.0", "status": "beta", "data_format": 1, "on_disable": "nimic",
        "permissions": ["storage.own"], "services": ["storage"],
        "data_types": [{"collection": "items", "description": "x"}]
    });
    Manifest::parse(&v.to_string()).unwrap()
}

fn manager() -> ModuleManager {
    ModuleManager::new(
        vec![
            Box::new(Notes(manifest("kgb.notes"))),
            Box::new(Notes(manifest("kgb.business"))),
        ],
        "0.1.0",
    )
    .unwrap()
}

const ADMIN_PC: &str = "aa:aa";
const OTHER_PC: &str = "bb:bb";

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = manager();
    for id in ["kgb.notes", "kgb.business"] {
        mm.enable(&mut ws, id, &["storage.own".into()]).unwrap();
    }
    (tmp, ws, mm)
}

/// Puts `fp` on member `id` (devices join by invitation in 6.2; the test
/// writes the record directly).
fn give_device(ws: &mut Workspace, id: Uuid, fp: &str) {
    let r = ws.store().get(org::MEMBERS_COLLECTION, id).unwrap().unwrap();
    let mut f = r.fields.clone();
    f.insert("devices".into(), json!([fp]));
    ws.store_mut()
        .write(vec![Write::put(org::MEMBERS_COLLECTION, id, f).expect(r.version)])
        .unwrap();
}

#[test]
fn without_organization_everything_is_allowed() {
    let (_t, mut ws, mm) = setup();
    assert!(org::organization(ws.store()).unwrap().is_none());
    mm.call(&mut ws, None, "kgb.business", "add", json!({"t": "x"})).unwrap();
    mm.call(&mut ws, Some(OTHER_PC), "kgb.notes", "add", json!({"t": "x"})).unwrap();
    org::require_admin(ws.store(), None, "test").unwrap();
}

#[test]
fn roles_limit_modules_and_writes() {
    let (_t, mut ws, mm) = setup();
    let admin = org::create(ws.store_mut(), "Firma Test SRL", "Ana", ADMIN_PC).unwrap();
    assert!(org::create(ws.store_mut(), "Alta", "Ion", ADMIN_PC).is_err(), "only one organization");
    let names: Vec<_> = org::roles(ws.store()).unwrap().into_iter().map(|r| r.name).collect();
    assert_eq!(names, ["Administrator", "Membru", "Doar citire"]);

    // Administrator: everything.
    mm.call(&mut ws, Some(ADMIN_PC), "kgb.business", "add", json!({"t": "f1"})).unwrap();
    org::require_admin(ws.store(), Some(ADMIN_PC), "test").unwrap();
    let cur = org::current(ws.store(), ADMIN_PC).unwrap().unwrap();
    assert_eq!(cur.member.id, admin);

    // A device that belongs to nobody: nothing opens.
    let e = mm.call(&mut ws, Some(OTHER_PC), "kgb.notes", "count", json!({})).unwrap_err();
    assert!(e.to_string().contains("nu are acces"), "{e}");

    // Membru: notes yes, business no.
    let ion = org::add_member(ws.store_mut(), "Ion", org::role_member()).unwrap();
    give_device(&mut ws, ion, OTHER_PC);
    mm.call(&mut ws, Some(OTHER_PC), "kgb.notes", "add", json!({"t": "n1"})).unwrap();
    let e = mm.call(&mut ws, Some(OTHER_PC), "kgb.business", "count", json!({})).unwrap_err();
    assert!(e.to_string().contains("Membru"), "{e}");
    assert!(org::require_admin(ws.store(), Some(OTHER_PC), "organizația").is_err());

    // Doar citire: reads, every write refused, nothing written, audited.
    let v = org::members(ws.store(), false).unwrap().into_iter().find(|m| m.id == ion).unwrap();
    org::update_member(ws.store_mut(), ion, "Ion", org::role_reader(), v.version).unwrap();
    assert_eq!(mm.call(&mut ws, Some(OTHER_PC), "kgb.notes", "count", json!({})).unwrap(), json!(1));
    assert_eq!(mm.call(&mut ws, Some(OTHER_PC), "kgb.notes", "can_write", json!({})).unwrap(), json!(false));
    let e = mm.call(&mut ws, Some(OTHER_PC), "kgb.notes", "add", json!({"t": "n2"})).unwrap_err();
    assert!(e.to_string().contains("poate doar citi"), "{e}");
    assert_eq!(mm.call(&mut ws, Some(ADMIN_PC), "kgb.notes", "count", json!({})).unwrap(), json!(1));
    let log = audit_log(&ws, 20).unwrap();
    assert!(log.iter().any(|f| f.get("outcome") == Some(&json!("refuzat")) && f.get("action") == Some(&json!("rol"))), "{log:?}");

    // A custom role: business read-only, notes none.
    let mut modules = BTreeMap::new();
    modules.insert("kgb.business".to_string(), Access::Citire);
    let contabil = org::save_role(
        ws.store_mut(),
        RoleInput { id: None, name: "Contabil".into(), default: Access::Niciunul, modules, version: 0 },
        &["kgb.notes".into(), "kgb.business".into()],
    )
    .unwrap();
    let v = org::members(ws.store(), false).unwrap().into_iter().find(|m| m.id == ion).unwrap();
    org::update_member(ws.store_mut(), ion, "Ion", contabil, v.version).unwrap();
    assert_eq!(mm.call(&mut ws, Some(OTHER_PC), "kgb.business", "count", json!({})).unwrap(), json!(1));
    assert!(mm.call(&mut ws, Some(OTHER_PC), "kgb.business", "add", json!({"t": "x"})).is_err());
    assert!(mm.call(&mut ws, Some(OTHER_PC), "kgb.notes", "count", json!({})).is_err());
    // Unknown module in a role: refused.
    let mut bad = BTreeMap::new();
    bad.insert("kgb.nimic".to_string(), Access::Scriere);
    assert!(org::save_role(
        ws.store_mut(),
        RoleInput { id: None, name: "X".into(), default: Access::Citire, modules: bad, version: 0 },
        &["kgb.notes".into()],
    )
    .is_err());
    // A role in use cannot be deleted; the Administrator role cannot change.
    assert!(org::delete_role(ws.store_mut(), contabil).unwrap_err().to_string().contains("Ion"));
    assert!(org::delete_role(ws.store_mut(), org::role_reader()).is_err());
    assert!(org::save_role(
        ws.store_mut(),
        RoleInput { id: Some(org::role_admin()), name: "A".into(), default: Access::Citire, modules: BTreeMap::new(), version: 1 },
        &[],
    )
    .is_err());

    // Removed person: their device loses access.
    let v = org::members(ws.store(), false).unwrap().into_iter().find(|m| m.id == ion).unwrap();
    org::remove_member(ws.store_mut(), ion, Some(ADMIN_PC), v.version).unwrap();
    assert!(mm.call(&mut ws, Some(OTHER_PC), "kgb.business", "count", json!({})).is_err());
    org::delete_role(ws.store_mut(), contabil).unwrap();
}

#[test]
fn never_without_an_administrator_and_survives_reopen() {
    let (t, mut ws, _mm) = setup();
    let ana = org::create(ws.store_mut(), "Firma Test SRL", "Ana", ADMIN_PC).unwrap();
    let ver = |ws: &Workspace, id| org::members(ws.store(), false).unwrap().into_iter().find(|m| m.id == id).unwrap().version;

    let e = { let v = ver(&ws, ana); org::update_member(ws.store_mut(), ana, "Ana", org::role_member(), v) }.unwrap_err();
    assert!(e.to_string().contains("fără administrator"), "{e}");
    let e = { let v = ver(&ws, ana); org::remove_member(ws.store_mut(), ana, Some(OTHER_PC), v) }.unwrap_err();
    assert!(e.to_string().contains("ultimul administrator"), "{e}");

    // With a second administrator, Ana can step down to Membru.
    let ion = org::add_member(ws.store_mut(), "Ion", org::role_admin()).unwrap();
    assert!(org::add_member(ws.store_mut(), "ion", org::role_member()).is_err(), "same name");
    { let v = ver(&ws, ana); org::update_member(ws.store_mut(), ana, "Ana", org::role_member(), v) }.unwrap();
    // But Ion, now the only administrator, cannot be removed.
    assert!({ let v = ver(&ws, ion); org::remove_member(ws.store_mut(), ion, Some(ADMIN_PC), v) }.is_err());
    // Nobody removes themselves from this PC.
    let e = { let v = ver(&ws, ana); org::remove_member(ws.store_mut(), ana, Some(ADMIN_PC), v) }.unwrap_err();
    assert!(e.to_string().contains("singur"), "{e}");

    let dir = ws.dir().to_path_buf();
    drop(ws);
    let ws = Workspace::open(&dir).unwrap();
    let cur = org::current(ws.store(), ADMIN_PC).unwrap().unwrap();
    assert_eq!(cur.member.name, "Ana");
    assert_eq!(cur.role.name, "Membru");
    assert_eq!(cur.role.access("kgb.business"), Access::Niciunul);
    assert_eq!(org::organization(ws.store()).unwrap().unwrap().name, "Firma Test SRL");
    drop(t);
}
