//! Steps 1.7 and 1.8: enable/disable keeps data, compatibility, migrations,
//! and the permission framework (denials are refused and audited).

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext, ModuleManager, ModuleView, audit_log};
use kgb_core::workspace::Workspace;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, Write};
use serde_json::{Value, json};
use uuid::Uuid;

struct TestModule {
    manifest: Manifest,
}

fn manifest(id: &str, status: &str, perms: &[&str], data_format: u32) -> Manifest {
    let migrations: Vec<Value> = (1..data_format)
        .map(|f| json!({"from": f, "to": f + 1, "description": "test"}))
        .collect();
    let mut services: Vec<&str> = Vec::new();
    for p in perms {
        let s = p.split('.').next().unwrap();
        if !services.contains(&s) {
            services.push(s);
        }
    }
    let data_types = if perms.contains(&"storage.own") {
        json!([{"collection": "items", "description": "x"}])
    } else {
        json!([])
    };
    let v = json!({
        "manifest_format": 1, "id": id, "name": "T", "description": "d", "version": "0.1.0",
        "core": ">=0.1.0, <0.2.0", "status": status, "permissions": perms, "services": services,
        "data_types": data_types, "data_format": data_format, "migrations": migrations,
        "on_disable": "datele rămân"
    });
    Manifest::parse(&v.to_string()).unwrap()
}

fn module(m: Manifest) -> Box<dyn Module> {
    Box::new(TestModule { manifest: m })
}

impl Module for TestModule {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }
    fn migrate(&self, ctx: &mut ModuleContext<'_>, from: u32) -> CoreResult<()> {
        // Upgrade every item: add a field named after the new format.
        for r in ctx.scan("items", |_| true)? {
            let mut f = r.fields.clone();
            f.insert(format!("f{}", from + 1), Value::Bool(true));
            ctx.write(vec![Write::put("items", r.id, f).expect(r.version)])?;
        }
        Ok(())
    }
    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, args: Value) -> CoreResult<Value> {
        match command {
            "add" => {
                let mut f = Fields::new();
                f.insert("n".into(), args["n"].clone());
                let id = Uuid::now_v7();
                ctx.write(vec![Write::put("items", id, f).expect(0)])?;
                Ok(json!({"id": id}))
            }
            "count" => Ok(json!(ctx.count("items")?)),
            "foreign" => Ok(json!(ctx.count("not_declared")?)),
            "settings" => Ok(json!(ctx.settings()?.profile)),
            "owner" => Ok(json!(ctx.owner_name()?)),
            _ => Err(CoreError::invalid("comanda", command)),
        }
    }
}

fn setup(modules: Vec<Box<dyn Module>>) -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(modules, "0.1.0").unwrap();
    (tmp, ws, mm)
}

fn perms(p: &[&str]) -> Vec<String> {
    p.iter().map(|s| s.to_string()).collect()
}

#[test]
fn disabled_module_keeps_its_data_and_refuses_calls() {
    let (_tmp, mut ws, mm) = setup(vec![module(manifest("t.a", "beta", &["storage.own"], 1))]);
    let p = perms(&["storage.own"]);
    assert!(matches!(
        mm.call(&mut ws, None, "t.a", "count", json!({})),
        Err(CoreError::ModuleNotEnabled(_))
    ));
    mm.enable(&mut ws, "t.a", &p).unwrap();
    for n in 0..3 {
        mm.call(&mut ws, None, "t.a", "add", json!({"n": n})).unwrap();
    }
    mm.disable(&mut ws, "t.a").unwrap();
    assert!(matches!(
        mm.call(&mut ws, None, "t.a", "count", json!({})),
        Err(CoreError::ModuleNotEnabled(_))
    ));
    let view = &mm.list(&ws, true).unwrap()[0];
    assert!(!view.enabled);
    assert_eq!(view.records, 3, "data kept while disabled");
    // Survives reopening the workspace, then re-enabling.
    let dir = ws.dir().to_path_buf();
    drop(ws);
    let mut ws = Workspace::open(&dir).unwrap();
    mm.enable(&mut ws, "t.a", &p).unwrap();
    assert_eq!(mm.call(&mut ws, None, "t.a", "count", json!({})).unwrap(), json!(3));
}

#[test]
fn enable_requires_exactly_the_requested_permissions() {
    let (_t, mut ws, mm) = setup(vec![module(manifest(
        "t.a",
        "beta",
        &["storage.own", "settings.read"],
        1,
    ))]);
    assert!(mm.enable(&mut ws, "t.a", &perms(&["storage.own"])).is_err());
    assert!(
        mm.enable(
            &mut ws,
            "t.a",
            &perms(&["storage.own", "settings.read", "identity.read"])
        )
        .is_err()
    );
    assert!(!mm.state(&ws, "t.a").unwrap().enabled);
    mm.enable(&mut ws, "t.a", &perms(&["settings.read", "storage.own"]))
        .unwrap();
    assert!(mm.state(&ws, "t.a").unwrap().enabled);
}

#[test]
fn missing_permission_is_denied_and_audited() {
    let (_t, mut ws, mm) = setup(vec![module(manifest("t.a", "beta", &["storage.own"], 1))]);
    mm.enable(&mut ws, "t.a", &perms(&["storage.own"])).unwrap();
    match mm.call(&mut ws, None, "t.a", "settings", json!({})) {
        Err(CoreError::PermissionDenied { permission, .. }) => assert_eq!(permission, "settings.read"),
        other => panic!("{other:?}"),
    }
    assert!(matches!(
        mm.call(&mut ws, None, "t.a", "owner", json!({})),
        Err(CoreError::PermissionDenied { .. })
    ));
    let log = audit_log(&ws, 10).unwrap();
    assert_eq!(log[0]["outcome"], "refuzat");
    assert_eq!(log[0]["action"], "identity.read");
    assert_eq!(log[1]["action"], "settings.read");
    assert_eq!(log[2]["action"], "enable");
}

#[test]
fn undeclared_collection_is_denied() {
    let (_t, mut ws, mm) = setup(vec![module(manifest("t.a", "beta", &["storage.own"], 1))]);
    mm.enable(&mut ws, "t.a", &perms(&["storage.own"])).unwrap();
    assert!(matches!(
        mm.call(&mut ws, None, "t.a", "foreign", json!({})),
        Err(CoreError::PermissionDenied { .. })
    ));
}

#[test]
fn modules_cannot_see_each_other() {
    let (_t, mut ws, mm) = setup(vec![
        module(manifest("t.a", "beta", &["storage.own"], 1)),
        module(manifest("t.b", "beta", &["storage.own"], 1)),
    ]);
    let p = perms(&["storage.own"]);
    mm.enable(&mut ws, "t.a", &p).unwrap();
    mm.enable(&mut ws, "t.b", &p).unwrap();
    mm.call(&mut ws, None, "t.a", "add", json!({"n": 1})).unwrap();
    // Same logical name "items", different physical collections.
    assert_eq!(mm.call(&mut ws, None, "t.b", "count", json!({})).unwrap(), json!(0));
    assert_eq!(ws.store().count("mod.t.a.items"), 1);
}

#[test]
fn incompatible_withdrawn_and_unknown_modules_are_refused() {
    let mut old = manifest("t.old", "beta", &[], 1);
    old.core = ">=0.2.0".into();
    let (_t, mut ws, mm) = setup(vec![module(old), module(manifest("t.gone", "disabled", &[], 1))]);
    assert!(matches!(
        mm.enable(&mut ws, "t.old", &[]),
        Err(CoreError::ModuleIncompatible { .. })
    ));
    assert!(matches!(
        mm.enable(&mut ws, "t.gone", &[]),
        Err(CoreError::ModuleUnavailable(_))
    ));
    assert!(matches!(
        mm.enable(&mut ws, "t.none", &[]),
        Err(CoreError::ModuleNotFound(_))
    ));
    assert!(!mm.list(&ws, true).unwrap()[0].compatible);
}

#[test]
fn experimental_modules_are_hidden_from_final_catalog() {
    let (_t, ws, mm) = setup(vec![
        module(manifest("t.exp", "experimental", &[], 1)),
        module(manifest("t.ok", "stable", &[], 1)),
    ]);
    let ids = |v: Vec<ModuleView>| v.into_iter().map(|m| m.id).collect::<Vec<_>>();
    assert_eq!(ids(mm.list(&ws, false).unwrap()), ["t.ok"]);
    assert_eq!(ids(mm.list(&ws, true).unwrap()), ["t.exp", "t.ok"]);
}

#[test]
fn data_migrations_run_in_order_once() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    let p = perms(&["storage.own"]);
    {
        let mut ws = Workspace::create(&dir, "T").unwrap();
        let mm = ModuleManager::new(vec![module(manifest("t.a", "beta", &["storage.own"], 1))], "0.1.0").unwrap();
        mm.enable(&mut ws, "t.a", &p).unwrap();
        mm.call(&mut ws, None, "t.a", "add", json!({"n": 1})).unwrap();
        mm.disable(&mut ws, "t.a").unwrap();
    }
    // A newer build of the module with data format 3.
    let mut ws = Workspace::open(&dir).unwrap();
    let mm = ModuleManager::new(vec![module(manifest("t.a", "beta", &["storage.own"], 3))], "0.1.0").unwrap();
    mm.enable(&mut ws, "t.a", &p).unwrap();
    assert_eq!(mm.state(&ws, "t.a").unwrap().data_format, 3);
    let items = ws.store().scan("mod.t.a.items", |_| true).unwrap();
    assert_eq!(items[0].fields["f2"], true);
    assert_eq!(items[0].fields["f3"], true);
    let v = items[0].version;
    // Enabling again does not migrate again.
    mm.disable(&mut ws, "t.a").unwrap();
    mm.enable(&mut ws, "t.a", &p).unwrap();
    assert_eq!(ws.store().scan("mod.t.a.items", |_| true).unwrap()[0].version, v);
    // An older build cannot open newer data.
    let old = ModuleManager::new(vec![module(manifest("t.a", "beta", &["storage.own"], 1))], "0.1.0").unwrap();
    old.disable(&mut ws, "t.a").unwrap();
    assert!(old.enable(&mut ws, "t.a", &p).is_err());
}

#[test]
fn duplicate_module_ids_are_refused() {
    let r = ModuleManager::new(
        vec![
            module(manifest("t.a", "beta", &[], 1)),
            module(manifest("t.a", "beta", &[], 1)),
        ],
        "0.1.0",
    );
    assert!(r.is_err());
}
