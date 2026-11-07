//! Step 3.10: a module that panics (a library on a hostile file) never closes
//! the app — the call returns an error, the event is audited, and the module
//! keeps working for the next call.

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext, ModuleManager, audit_log};
use kgb_core::workspace::Workspace;
use kgb_core::{CoreError, CoreResult};
use serde_json::{Value, json};

struct Fragile(Manifest);

impl Module for Fragile {
    fn manifest(&self) -> &Manifest {
        &self.0
    }
    fn handle(&self, _: &mut ModuleContext<'_>, cmd: &str, _: Value) -> CoreResult<Value> {
        match cmd {
            "boom" => panic!("index out of bounds in a parser"),
            _ => Ok(json!("ok")),
        }
    }
}

#[test]
fn a_panicking_module_call_becomes_an_audited_error() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let v = json!({
        "manifest_format": 1, "id": "t.fragile", "name": "F", "description": "d", "version": "0.1.0",
        "core": ">=0.1.0, <0.2.0", "status": "beta", "data_format": 1, "on_disable": "nimic"
    });
    let mm = ModuleManager::new(
        vec![Box::new(Fragile(Manifest::parse(&v.to_string()).unwrap()))],
        "0.1.0",
    )
    .unwrap();
    mm.enable(&mut ws, "t.fragile", &[]).unwrap();
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {})); // keep the test output clean
    let err = mm.call(&mut ws, None, "t.fragile", "boom", json!({}));
    std::panic::set_hook(prev);
    assert!(matches!(err, Err(CoreError::Invalid { .. })), "{err:?}");
    assert!(err.unwrap_err().to_string().contains("eroare internă"));
    let log = audit_log(&ws, 10).unwrap();
    assert!(
        log.iter()
            .any(|e| e.get("outcome").and_then(Value::as_str) == Some("eroare internă")),
        "{log:?}"
    );
    // The module still answers the next call.
    assert_eq!(
        mm.call(&mut ws, None, "t.fragile", "ping", json!({})).unwrap(),
        json!("ok")
    );
}
