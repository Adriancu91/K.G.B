//! Step 1.7: manifest validation is strict.

use kgb_core::manifest::{Manifest, is_valid_module_id};
use serde_json::{Value, json};

fn base() -> Value {
    json!({
        "manifest_format": 1,
        "id": "test.mod",
        "name": "Test",
        "description": "d",
        "version": "1.2.3",
        "core": ">=0.1.0, <0.2.0",
        "status": "beta",
        "permissions": ["storage.own"],
        "services": ["storage"],
        "data_types": [{"collection": "items", "description": "x"}],
        "events": {"emits": ["test.mod.created"], "listens": []},
        "data_format": 1,
        "migrations": [],
        "on_disable": "datele rămân"
    })
}

fn parse(v: &Value) -> Result<Manifest, String> {
    Manifest::parse(&v.to_string()).map_err(|e| e.to_string())
}

type Change = Box<dyn FnOnce(&mut Value)>;

#[test]
fn valid_manifest_parses() {
    let m = parse(&base()).unwrap();
    assert_eq!(m.store_collection("items").as_deref(), Some("mod.test.mod.items"));
    assert_eq!(m.store_collection("other"), None);
    assert!(m.compatible_with("0.1.0"));
    assert!(m.compatible_with("0.1.9"));
    assert!(!m.compatible_with("0.2.0"));
    assert!(!m.compatible_with("garbage"));
}

#[test]
fn ids() {
    for ok in ["kgb.notes", "a.b", "kgb.finance-inventory", "x1.y2.z3"] {
        assert!(is_valid_module_id(ok), "{ok}");
    }
    for bad in [
        "kgb",
        "Kgb.notes",
        "kgb..notes",
        "1kgb.notes",
        "kgb.notes!",
        "kgb.Notes",
        "",
    ] {
        assert!(!is_valid_module_id(bad), "{bad}");
    }
}

#[test]
fn every_invalid_variant_is_refused() {
    let cases: Vec<(&str, Change)> = vec![
        ("unknown field", Box::new(|v| v["extra"] = json!(1))),
        ("format", Box::new(|v| v["manifest_format"] = json!(2))),
        ("id", Box::new(|v| v["id"] = json!("Bad"))),
        ("empty name", Box::new(|v| v["name"] = json!("  "))),
        ("version", Box::new(|v| v["version"] = json!("1.2"))),
        ("core req", Box::new(|v| v["core"] = json!("not a req"))),
        ("status", Box::new(|v| v["status"] = json!("ready"))),
        (
            "unknown permission",
            Box::new(|v| v["permissions"] = json!(["storage.own", "network.all"])),
        ),
        ("permission without service", Box::new(|v| v["services"] = json!([]))),
        (
            "unknown service",
            Box::new(|v| v["services"] = json!(["storage", "shell"])),
        ),
        (
            "dup permission",
            Box::new(|v| v["permissions"] = json!(["storage.own", "storage.own"])),
        ),
        (
            "bad collection",
            Box::new(|v| v["data_types"] = json!([{"collection": "Items!", "description": "x"}])),
        ),
        (
            "dup collection",
            Box::new(|v| {
                v["data_types"] =
                    json!([{"collection": "a", "description": "x"}, {"collection": "a", "description": "y"}])
            }),
        ),
        (
            "data without storage permission",
            Box::new(|v| v["permissions"] = json!([])),
        ),
        (
            "foreign event",
            Box::new(|v| v["events"]["emits"] = json!(["other.mod.created"])),
        ),
        ("data_format 0", Box::new(|v| v["data_format"] = json!(0))),
        ("missing migration", Box::new(|v| v["data_format"] = json!(2))),
        (
            "gap in migrations",
            Box::new(|v| {
                v["data_format"] = json!(3);
                v["migrations"] =
                    json!([{"from": 1, "to": 2, "description": "a"}, {"from": 1, "to": 3, "description": "b"}]);
            }),
        ),
        (
            "missing on_disable",
            Box::new(|v| {
                v.as_object_mut().unwrap().remove("on_disable");
            }),
        ),
    ];
    for (name, change) in cases {
        let mut v = base();
        change(&mut v);
        assert!(parse(&v).is_err(), "{name} should be refused");
    }
}

#[test]
fn migrations_chain_is_accepted() {
    let mut v = base();
    v["data_format"] = json!(3);
    v["migrations"] = json!([{"from": 1, "to": 2, "description": "a"}, {"from": 2, "to": 3, "description": "b"}]);
    assert!(parse(&v).is_ok());
}
