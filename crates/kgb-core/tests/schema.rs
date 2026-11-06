//! Step 2.6: collection schemas are validated in the manifest and enforced by
//! the core on every module write.

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext, ModuleManager};
use kgb_core::schema::CollectionSchema;
use kgb_core::workspace::Workspace;
use kgb_core::{CoreError, CoreResult};
use kgb_store::Write;
use serde_json::{Value, json};
use uuid::Uuid;

fn schema() -> Value {
    json!({
        "fields": {
            "name": {"type": "string", "required": true, "max_len": 5},
            "qty": {"type": "integer", "min": 0, "max": 100},
            "price": {"type": "number", "nullable": true},
            "unit": {"type": "string", "enum": ["buc", "kg"]},
            "tags": {"type": "array", "max_len": 2},
            "ok": {"type": "bool"},
            "extra": {"type": "any"}
        },
        "additional": false
    })
}

fn check(v: Value) -> Result<(), String> {
    let s: CollectionSchema = serde_json::from_value(schema()).unwrap();
    s.check(v.as_object().unwrap()).map_err(|e| e.to_string())
}

#[test]
fn record_checks() {
    assert!(check(json!({"name": "ab"})).is_ok());
    assert!(
        check(json!({"name": "ab", "qty": 5, "price": null, "unit": "kg", "tags": [1], "ok": true, "extra": {"x": 1}}))
            .is_ok()
    );
    for bad in [
        json!({}),                               // required missing
        json!({"name": null}),                   // required, not nullable
        json!({"name": 5}),                      // wrong type
        json!({"name": "abcdef"}),               // too long
        json!({"name": "a", "qty": 1.5}),        // not an integer
        json!({"name": "a", "qty": -1}),         // below min
        json!({"name": "a", "qty": 101}),        // above max
        json!({"name": "a", "qty": null}),       // optional but not nullable
        json!({"name": "a", "unit": "litru"}),   // not in enum
        json!({"name": "a", "tags": [1, 2, 3]}), // too many items
        json!({"name": "a", "other": 1}),        // undeclared field
    ] {
        assert!(check(bad.clone()).is_err(), "{bad}");
    }
    assert!(
        check(json!({"name": "ăîșțâ"})).is_ok(),
        "length counts characters, not bytes"
    );
}

fn manifest_with(schema: Value) -> Result<Manifest, CoreError> {
    let v = json!({
        "manifest_format": 1, "id": "t.s", "name": "T", "description": "d", "version": "0.1.0",
        "core": ">=0.1.0, <0.2.0", "status": "beta", "permissions": ["storage.own"], "services": ["storage"],
        "data_types": [{"collection": "items", "description": "x", "schema": schema}],
        "data_format": 1, "on_disable": "datele rămân"
    });
    Manifest::parse(&v.to_string())
}

#[test]
fn bad_schemas_are_refused_in_the_manifest() {
    assert!(manifest_with(schema()).is_ok());
    for bad in [
        json!({"fields": {"a": {"type": "string", "min": 1}}}),
        json!({"fields": {"a": {"type": "number", "min": 5, "max": 1}}}),
        json!({"fields": {"a": {"type": "number", "max_len": 3}}}),
        json!({"fields": {"a": {"type": "number", "enum": ["x"]}}}),
        json!({"fields": {"a": {"type": "string", "enum": []}}}),
        json!({"fields": {"a": {"type": "date"}}}),
        json!({"fields": {"a": {"type": "string", "unknown": 1}}}),
        json!({"fields": {"": {"type": "string"}}}),
    ] {
        assert!(manifest_with(bad.clone()).is_err(), "{bad}");
    }
}

/// A module that tries to store whatever it is given.
struct Careless(Manifest);
impl Module for Careless {
    fn manifest(&self) -> &Manifest {
        &self.0
    }
    fn handle(&self, ctx: &mut ModuleContext<'_>, _: &str, args: Value) -> CoreResult<Value> {
        let f = args.as_object().cloned().unwrap_or_default();
        ctx.write(vec![Write::put("items", Uuid::now_v7(), f)])?;
        Ok(Value::Null)
    }
}

#[test]
fn core_enforces_the_schema_on_module_writes() {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Careless(manifest_with(schema()).unwrap()))], "0.1.0").unwrap();
    mm.enable(&mut ws, "t.s", &["storage.own".to_string()]).unwrap();
    mm.call(&mut ws, None, "t.s", "put", json!({"name": "ok"})).unwrap();
    let err = mm
        .call(&mut ws, None, "t.s", "put", json!({"name": "ok", "qty": "multe"}))
        .unwrap_err();
    assert!(err.to_string().contains("qty"), "{err}");
    assert!(mm.call(&mut ws, None, "t.s", "put", json!({"qty": 1})).is_err());
    assert_eq!(ws.store().count("mod.t.s.items"), 1, "only the valid record was stored");
}

fn manifest_with_indexes(indexes: Value, schema: Option<Value>) -> Result<Manifest, CoreError> {
    let mut dt = json!({"collection": "items", "description": "x", "indexes": indexes});
    if let Some(s) = schema {
        dt["schema"] = s;
    }
    let v = json!({
        "manifest_format": 1, "id": "t.s", "name": "T", "description": "d", "version": "0.1.0",
        "core": ">=0.1.0, <0.2.0", "status": "beta", "permissions": ["storage.own"], "services": ["storage"],
        "data_types": [dt], "data_format": 1, "on_disable": "datele rămân"
    });
    Manifest::parse(&v.to_string())
}

#[test]
fn index_declarations_are_validated() {
    assert!(manifest_with_indexes(json!(["unit"]), Some(schema())).is_ok());
    assert!(
        manifest_with_indexes(json!(["anything"]), None).is_ok(),
        "no schema: any field"
    );
    assert!(
        manifest_with_indexes(json!(["nope"]), Some(schema())).is_err(),
        "not in schema"
    );
    assert!(
        manifest_with_indexes(json!(["unit", "unit"]), Some(schema())).is_err(),
        "duplicate"
    );
    assert!(manifest_with_indexes(json!([""]), None).is_err(), "empty");
}

/// Step 2.7: declared indexes are created by the core and used by queries.
struct Indexed(Manifest);
impl Module for Indexed {
    fn manifest(&self) -> &Manifest {
        &self.0
    }
    fn handle(&self, ctx: &mut ModuleContext<'_>, cmd: &str, args: Value) -> CoreResult<Value> {
        match cmd {
            "put" => {
                let f = args.as_object().cloned().unwrap_or_default();
                ctx.write(vec![Write::put("items", Uuid::now_v7(), f)])?;
                Ok(Value::Null)
            }
            _ => {
                let q: kgb_store::Query =
                    serde_json::from_value(args).map_err(|e| CoreError::invalid("q", e.to_string()))?;
                let r = ctx.query("items", &q)?;
                Ok(json!({"n": r.total, "index": r.used_index}))
            }
        }
    }
}

#[test]
fn declared_indexes_are_built_and_used_after_reopen() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    let mk = || {
        let m = manifest_with_indexes(json!(["unit"]), Some(schema())).unwrap();
        ModuleManager::new(vec![Box::new(Indexed(m)) as Box<dyn Module>], "0.1.0").unwrap()
    };
    let q = json!({"filter": {"op": "eq", "field": "unit", "value": "kg"}});
    {
        let mut ws = Workspace::create(&dir, "T").unwrap();
        let mm = mk();
        for (i, unit) in ["kg", "buc", "kg"].iter().enumerate() {
            let name = format!("n{i}");
            // Data written before enabling would be impossible (module disabled), so enable first.
            if i == 0 {
                mm.enable(&mut ws, "t.s", &["storage.own".to_string()]).unwrap();
            }
            mm.call(&mut ws, None, "t.s", "put", json!({"name": name, "unit": unit}))
                .unwrap();
        }
        assert_eq!(
            mm.call(&mut ws, None, "t.s", "q", q.clone()).unwrap(),
            json!({"n": 2, "index": true})
        );
    }
    let mut ws = Workspace::open(&dir).unwrap();
    let mm = mk();
    assert_eq!(
        mm.call(&mut ws, None, "t.s", "q", q).unwrap(),
        json!({"n": 2, "index": true}),
        "index rebuilt on open"
    );
    let range = json!({"filter": {"op": "contains", "field": "name", "text": "N1"}});
    assert_eq!(
        mm.call(&mut ws, None, "t.s", "q", range).unwrap(),
        json!({"n": 1, "index": false})
    );
}
