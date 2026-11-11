//! Step 2.8: module file attachments — ownership, hash verification, limits,
//! deletion only marks, collection of unreferenced blobs.

use kgb_core::files::{FILES_COLLECTION, MAX_FILE_BYTES, clean_name, collect_unreferenced};
use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext, ModuleManager};
use kgb_core::workspace::Workspace;
use kgb_core::{CoreError, CoreResult};
use serde_json::{Value, json};
use uuid::Uuid;

struct Filer(Manifest);

impl Module for Filer {
    fn manifest(&self) -> &Manifest {
        &self.0
    }
    fn handle(&self, ctx: &mut ModuleContext<'_>, cmd: &str, a: Value) -> CoreResult<Value> {
        let id = || {
            a["id"]
                .as_str()
                .and_then(|s| Uuid::parse_str(s).ok())
                .unwrap_or_default()
        };
        match cmd {
            "put" => {
                let data = a["data"].as_str().unwrap_or_default().as_bytes().to_vec();
                let size = a["size"].as_u64().map(|n| vec![b'x'; n as usize]).unwrap_or(data);
                Ok(serde_json::to_value(ctx.put_file(a["name"].as_str().unwrap_or_default(), &size)?).unwrap())
            }
            "get" => {
                let (f, data) = ctx.get_file(id())?;
                Ok(json!({"name": f.name, "data": String::from_utf8_lossy(&data)}))
            }
            "delete" => ctx.delete_file(id()).map(|_| Value::Null),
            "list" => Ok(json!(
                ctx.list_files()?.iter().map(|f| f.name.clone()).collect::<Vec<_>>()
            )),
            _ => Err(CoreError::invalid("cmd", cmd)),
        }
    }
}

fn module(id: &str, perms: &[&str]) -> Box<dyn Module> {
    let services: Vec<&str> = perms.iter().map(|p| p.split('.').next().unwrap()).collect();
    let v = json!({
        "manifest_format": 1, "id": id, "name": "F", "description": "d", "version": "0.1.0",
        "core": ">=0.1.0, <0.2.0", "status": "beta", "permissions": perms, "services": services,
        "data_format": 1, "on_disable": "fișierele rămân"
    });
    Box::new(Filer(Manifest::parse(&v.to_string()).unwrap()))
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(
        vec![
            module("t.a", &["files.own"]),
            module("t.b", &["files.own"]),
            module("t.c", &[]),
        ],
        "0.1.0",
    )
    .unwrap();
    mm.enable(&mut ws, "t.a", &["files.own".to_string()]).unwrap();
    mm.enable(&mut ws, "t.b", &["files.own".to_string()]).unwrap();
    mm.enable(&mut ws, "t.c", &[]).unwrap();
    (tmp, ws, mm)
}

fn put(ws: &mut Workspace, mm: &ModuleManager, m: &str, name: &str, data: &str) -> CoreResult<Value> {
    mm.call(ws, None, m, "put", json!({"name": name, "data": data}))
}

#[test]
fn put_get_list_and_ownership() {
    let (_t, mut ws, mm) = setup();
    let f = put(&mut ws, &mm, "t.a", "factura 12.pdf", "conținut ăîș").unwrap();
    let got = mm.call(&mut ws, None, "t.a", "get", json!({"id": f["id"]})).unwrap();
    assert_eq!(got, json!({"name": "factura 12.pdf", "data": "conținut ăîș"}));
    // Same bytes stored by another module: one blob, two separate owners.
    put(&mut ws, &mm, "t.b", "copie.pdf", "conținut ăîș").unwrap();
    assert_eq!(ws.store().blob_hashes().unwrap().len(), 1);
    assert_eq!(
        mm.call(&mut ws, None, "t.b", "list", json!({})).unwrap(),
        json!(["copie.pdf"])
    );
    // Module B cannot read module A's file by id.
    assert!(mm.call(&mut ws, None, "t.b", "get", json!({"id": f["id"]})).is_err());
    assert!(mm.call(&mut ws, None, "t.b", "delete", json!({"id": f["id"]})).is_err());
    // Without the permission: refused (and audited by the permission framework).
    assert!(matches!(
        put(&mut ws, &mm, "t.c", "x.txt", "x"),
        Err(CoreError::PermissionDenied { .. })
    ));
}

#[test]
fn damaged_file_is_detected_on_read() {
    let (tmp, mut ws, mm) = setup();
    let f = put(&mut ws, &mm, "t.a", "a.txt", "original").unwrap();
    let hash = f["hash"].as_str().unwrap();
    let path = tmp
        .path()
        .join("ws")
        .join("store")
        .join("blobs")
        .join(&hash[..2])
        .join(hash);
    std::fs::write(&path, b"altered!").unwrap();
    let err = mm
        .call(&mut ws, None, "t.a", "get", json!({"id": f["id"]}))
        .unwrap_err();
    assert!(err.to_string().to_lowercase().contains("blob"), "{err}");
}

#[test]
fn names_and_size_are_validated() {
    for bad in ["", "   ", "a/b.txt", "..\\x", "c:x", "a?b", "..", &"x".repeat(201)] {
        assert!(clean_name(bad).is_err(), "{bad:?}");
    }
    assert_eq!(
        clean_name("  Raport final (2026).xlsx ").unwrap(),
        "Raport final (2026).xlsx"
    );
    let (_t, mut ws, mm) = setup();
    let too_big = mm.call(
        &mut ws,
        None,
        "t.a",
        "put",
        json!({"name": "mare.bin", "size": MAX_FILE_BYTES + 1}),
    );
    assert!(too_big.is_err());
    assert!(
        ws.store().blob_hashes().unwrap().is_empty(),
        "nothing stored for a refused file"
    );
}

#[test]
fn delete_marks_and_collection_retires_only_unreferenced_blobs() {
    let (tmp, mut ws, mm) = setup();
    let a = put(&mut ws, &mm, "t.a", "a.txt", "doar a").unwrap();
    put(&mut ws, &mm, "t.a", "shared-a.txt", "comun").unwrap();
    put(&mut ws, &mm, "t.b", "shared-b.txt", "comun").unwrap();
    mm.call(&mut ws, None, "t.a", "delete", json!({"id": a["id"]})).unwrap();
    // Deleted: gone from the list, record still in the store, bytes still there.
    assert_eq!(
        mm.call(&mut ws, None, "t.a", "list", json!({})).unwrap(),
        json!(["shared-a.txt"])
    );
    assert!(
        ws.store()
            .get_any(FILES_COLLECTION, Uuid::parse_str(a["id"].as_str().unwrap()).unwrap())
            .unwrap()
            .is_some()
    );
    assert_eq!(ws.store().blob_hashes().unwrap().len(), 2);
    let r = collect_unreferenced(&mut ws).unwrap();
    assert_eq!(r.blobs_retired, 1);
    assert_eq!(ws.store().blob_hashes().unwrap().len(), 1, "the shared blob stays");
    let retired = tmp.path().join("ws").join("store").join("retired").join("blobs");
    assert!(
        retired.join(a["hash"].as_str().unwrap()).exists(),
        "kept one generation"
    );
    assert_eq!(collect_unreferenced(&mut ws).unwrap().blobs_retired, 0);
    assert!(!retired.exists() || std::fs::read_dir(&retired).unwrap().count() == 0);
}


/// D-090: after `forget_history`, what a record and an attachment were before (a note's text before it was
/// locked, the attachment replaced by its encrypted copy) is nowhere in the workspace's folder; the current state
/// stays readable.
#[test]
fn forget_history_leaves_no_old_bytes_on_disk() {
    use kgb_store::{Fields, Write};
    let (tmp, mut ws, mm) = setup();
    let dir = tmp.path().join("ws");
    let has = |marker: &[u8]| -> bool {
        fn walk(p: &std::path::Path, m: &[u8]) -> bool {
            std::fs::read_dir(p).unwrap().flatten().any(|e| {
                let q = e.path();
                if q.is_dir() {
                    walk(&q, m)
                } else {
                    std::fs::read(&q).unwrap_or_default().windows(m.len()).any(|w| w == m)
                }
            })
        }
        walk(&dir, marker)
    };
    // A note in clear, then the same note locked (its text replaced); an attachment in clear, then deleted.
    let id = uuid::Uuid::now_v7();
    let mut f = Fields::new();
    f.insert("text".into(), json!("TEXT-INAINTE-DE-BLOCARE-7Q"));
    ws.store_mut().write(vec![Write::put("t.note", id, f)]).unwrap();
    let att = put(&mut ws, &mm, "t.a", "atasament.pdf", "ATASAMENT-IN-CLAR-9Z").unwrap();
    let mut g = Fields::new();
    g.insert("text".into(), json!("criptat"));
    let v = ws.store().get("t.note", id).unwrap().unwrap().version;
    ws.store_mut().write(vec![Write::put("t.note", id, g).expect(v)]).unwrap();
    mm.call(&mut ws, None, "t.a", "delete", json!({"id": att["id"]})).unwrap();
    ws.store_mut().flush().unwrap();
    assert!(has(b"TEXT-INAINTE-DE-BLOCARE-7Q"), "the old text is in the journal before (the test means something)");
    assert!(has(b"ATASAMENT-IN-CLAR-9Z"), "the old attachment is a blob before");

    let r = kgb_core::files::forget_history(&mut ws).unwrap();
    assert_eq!(r.blobs, 1);
    assert!(r.bytes > 0);
    assert!(!has(b"TEXT-INAINTE-DE-BLOCARE-7Q"), "old text gone from the disk");
    assert!(!has(b"ATASAMENT-IN-CLAR-9Z"), "old attachment gone from the disk");
    assert_eq!(ws.store().get("t.note", id).unwrap().unwrap().fields["text"], json!("criptat"));
    // Quarantine is left alone.
    assert!(!dir.join("store").join("retired").exists());
}
