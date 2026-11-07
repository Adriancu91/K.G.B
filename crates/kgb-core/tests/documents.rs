//! Step 3.4: versioned documents (D-034) — the original never changes, every
//! save is a new version, concurrent saves are refused instead of lost, export
//! writes a copy, and a forced kill during saves never leaves half a version.

use std::path::Path;
use std::process::Command;
use std::time::Duration;

use kgb_core::documents::{DOCUMENTS_COLLECTION, VERSIONS_COLLECTION};
use kgb_core::files::collect_unreferenced;
use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext, ModuleManager};
use kgb_core::workspace::Workspace;
use kgb_core::{CoreError, CoreResult};
use serde_json::{Value, json};
use uuid::Uuid;

struct Docs(Manifest);

fn uuid(v: &Value) -> Uuid {
    v.as_str().and_then(|s| Uuid::parse_str(s).ok()).unwrap_or_default()
}

impl Module for Docs {
    fn manifest(&self) -> &Manifest {
        &self.0
    }
    fn handle(&self, ctx: &mut ModuleContext<'_>, cmd: &str, a: Value) -> CoreResult<Value> {
        let data = || a["data"].as_str().unwrap_or_default().as_bytes().to_vec();
        let ver = a["version"].as_u64();
        match cmd {
            "import" => Ok(
                serde_json::to_value(ctx.import_document(a["name"].as_str().unwrap_or_default(), &data())?).unwrap(),
            ),
            "save" => Ok(serde_json::to_value(ctx.save_document(
                uuid(&a["id"]),
                a["based_on"].as_u64().unwrap_or_default(),
                &data(),
                a["note"].as_str().unwrap_or_default(),
            )?)
            .unwrap()),
            "read" => {
                let (v, d) = ctx.read_document(uuid(&a["id"]), ver)?;
                Ok(json!({"number": v.number, "note": v.note, "data": String::from_utf8_lossy(&d)}))
            }
            "versions" => Ok(serde_json::to_value(ctx.document_versions(uuid(&a["id"]))?).unwrap()),
            "restore" => Ok(serde_json::to_value(ctx.restore_document_version(uuid(&a["id"]), ver.unwrap())?).unwrap()),
            "list" => Ok(serde_json::to_value(ctx.list_documents()?).unwrap()),
            "delete" => ctx.delete_document(uuid(&a["id"])).map(|_| Value::Null),
            "export" => Ok(serde_json::to_value(ctx.export_document(
                uuid(&a["id"]),
                ver,
                Path::new(a["dest"].as_str().unwrap()),
                a["overwrite"].as_bool().unwrap_or(false),
            )?)
            .unwrap()),
            _ => Err(CoreError::invalid("cmd", cmd)),
        }
    }
}

fn module(id: &str, perms: &[&str]) -> Box<dyn Module> {
    let services: Vec<&str> = perms.iter().map(|p| p.split('.').next().unwrap()).collect();
    let v = json!({
        "manifest_format": 1, "id": id, "name": "D", "description": "d", "version": "0.1.0",
        "core": ">=0.1.0, <0.2.0", "status": "beta", "permissions": perms, "services": services,
        "data_format": 1, "on_disable": "documentele rămân"
    });
    Box::new(Docs(Manifest::parse(&v.to_string()).unwrap()))
}

fn manager() -> ModuleManager {
    ModuleManager::new(
        vec![
            module("t.a", &["files.own"]),
            module("t.b", &["files.own"]),
            module("t.c", &[]),
        ],
        "0.1.0",
    )
    .unwrap()
}

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = manager();
    mm.enable(&mut ws, "t.a", &["files.own".to_string()]).unwrap();
    mm.enable(&mut ws, "t.b", &["files.own".to_string()]).unwrap();
    mm.enable(&mut ws, "t.c", &[]).unwrap();
    (tmp, ws, mm)
}

fn call(ws: &mut Workspace, mm: &ModuleManager, m: &str, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, m, cmd, a)
}

#[test]
fn original_stays_identical_through_saves_and_restores() {
    let (_t, mut ws, mm) = setup();
    let original = "Factura FCT-0042 — conținut original ăîșț";
    let d = call(
        &mut ws,
        &mm,
        "t.a",
        "import",
        json!({"name": "Factura 42.PDF", "data": original}),
    )
    .unwrap();
    assert_eq!(d["current"], 1);
    assert_eq!(d["kind"], "pdf");
    let id = d["id"].clone();
    for (k, text) in ["v2 rotită", "v3 cu pagina 2 scoasă"].iter().enumerate() {
        let v = call(
            &mut ws,
            &mm,
            "t.a",
            "save",
            json!({"id": id, "based_on": k + 1, "data": text, "note": "rotire"}),
        )
        .unwrap();
        assert_eq!(v["number"], k + 2);
    }
    // The original is still version 1, byte for byte.
    let v1 = call(&mut ws, &mm, "t.a", "read", json!({"id": id, "version": 1})).unwrap();
    assert_eq!(v1["data"], original);
    assert_eq!(v1["note"], "original importat");
    assert_eq!(
        call(&mut ws, &mm, "t.a", "read", json!({"id": id})).unwrap()["data"],
        "v3 cu pagina 2 scoasă"
    );
    // Restoring v1 creates v4; nothing older disappears.
    let r = call(&mut ws, &mm, "t.a", "restore", json!({"id": id, "version": 1})).unwrap();
    assert_eq!(r["number"], 4);
    assert_eq!(r["note"], "restaurat din versiunea 1");
    let all = call(&mut ws, &mm, "t.a", "versions", json!({"id": id})).unwrap();
    let texts: Vec<Value> = (1..=4)
        .map(|n| call(&mut ws, &mm, "t.a", "read", json!({"id": id, "version": n})).unwrap()["data"].clone())
        .collect();
    assert_eq!(all.as_array().unwrap().len(), 4);
    assert_eq!(
        texts,
        json!([original, "v2 rotită", "v3 cu pagina 2 scoasă", original])
            .as_array()
            .unwrap()
            .clone()
    );
    // Survives reopening.
    let dir = ws.dir().to_path_buf();
    drop(ws);
    let mut ws = Workspace::open(&dir).unwrap();
    assert_eq!(
        call(&mut ws, &mm, "t.a", "read", json!({"id": id, "version": 1})).unwrap()["data"],
        original
    );
    assert_eq!(call(&mut ws, &mm, "t.a", "list", json!({})).unwrap()[0]["current"], 4);
}

#[test]
fn a_stale_save_is_refused_and_nothing_is_lost() {
    let (_t, mut ws, mm) = setup();
    let id = call(&mut ws, &mm, "t.a", "import", json!({"name": "a.xlsx", "data": "v1"})).unwrap()["id"].clone();
    // Two editors opened version 1; the first saves.
    call(
        &mut ws,
        &mm,
        "t.a",
        "save",
        json!({"id": id, "based_on": 1, "data": "de la Ana"}),
    )
    .unwrap();
    // The second is refused instead of silently replacing Ana's work.
    let err = call(
        &mut ws,
        &mm,
        "t.a",
        "save",
        json!({"id": id, "based_on": 1, "data": "de la Ion"}),
    )
    .unwrap_err();
    assert!(err.to_string().contains("salvat între timp"), "{err}");
    assert_eq!(
        call(&mut ws, &mm, "t.a", "read", json!({"id": id})).unwrap()["data"],
        "de la Ana"
    );
    assert_eq!(
        call(&mut ws, &mm, "t.a", "versions", json!({"id": id}))
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        2
    );
}

#[test]
fn documents_belong_to_their_module() {
    let (_t, mut ws, mm) = setup();
    let id = call(&mut ws, &mm, "t.a", "import", json!({"name": "a.pdf", "data": "x"})).unwrap()["id"].clone();
    for cmd in ["read", "versions", "delete"] {
        assert!(call(&mut ws, &mm, "t.b", cmd, json!({"id": id})).is_err(), "{cmd}");
    }
    assert!(
        call(
            &mut ws,
            &mm,
            "t.b",
            "save",
            json!({"id": id, "based_on": 1, "data": "y"})
        )
        .is_err()
    );
    assert_eq!(call(&mut ws, &mm, "t.b", "list", json!({})).unwrap(), json!([]));
    assert!(matches!(
        call(&mut ws, &mm, "t.c", "import", json!({"name": "a.pdf", "data": "x"})),
        Err(CoreError::PermissionDenied { .. })
    ));
}

#[test]
fn every_version_keeps_its_bytes_until_the_document_is_deleted() {
    let (_t, mut ws, mm) = setup();
    let id = call(&mut ws, &mm, "t.a", "import", json!({"name": "a.pdf", "data": "unu"})).unwrap()["id"].clone();
    call(
        &mut ws,
        &mm,
        "t.a",
        "save",
        json!({"id": id, "based_on": 1, "data": "doi"}),
    )
    .unwrap();
    let r = collect_unreferenced(&mut ws).unwrap();
    assert_eq!(r.blobs_retired, 0, "versions protect their blobs");
    assert_eq!(
        call(&mut ws, &mm, "t.a", "read", json!({"id": id, "version": 1})).unwrap()["data"],
        "unu"
    );
    call(&mut ws, &mm, "t.a", "delete", json!({"id": id})).unwrap();
    assert!(call(&mut ws, &mm, "t.a", "read", json!({"id": id})).is_err());
    assert_eq!(ws.store().count(DOCUMENTS_COLLECTION), 0);
    assert_eq!(ws.store().count(VERSIONS_COLLECTION), 0);
    assert_eq!(collect_unreferenced(&mut ws).unwrap().blobs_retired, 2);
}

#[test]
fn export_writes_a_copy_and_never_replaces_silently() {
    let (tmp, mut ws, mm) = setup();
    let id = call(&mut ws, &mm, "t.a", "import", json!({"name": "a.csv", "data": "v1"})).unwrap()["id"].clone();
    call(
        &mut ws,
        &mm,
        "t.a",
        "save",
        json!({"id": id, "based_on": 1, "data": "v2"}),
    )
    .unwrap();
    let dest = tmp.path().join("export.csv");
    call(&mut ws, &mm, "t.a", "export", json!({"id": id, "dest": dest})).unwrap();
    assert_eq!(std::fs::read_to_string(&dest).unwrap(), "v2");
    // An existing file is not replaced without explicit confirmation.
    let err = call(
        &mut ws,
        &mm,
        "t.a",
        "export",
        json!({"id": id, "version": 1, "dest": dest}),
    )
    .unwrap_err();
    assert!(matches!(err, CoreError::AlreadyExists(_)), "{err}");
    assert_eq!(std::fs::read_to_string(&dest).unwrap(), "v2");
    call(
        &mut ws,
        &mm,
        "t.a",
        "export",
        json!({"id": id, "version": 1, "dest": dest, "overwrite": true}),
    )
    .unwrap();
    assert_eq!(std::fs::read_to_string(&dest).unwrap(), "v1");
    // Exporting changed nothing inside the workspace.
    assert_eq!(
        call(&mut ws, &mm, "t.a", "read", json!({"id": id})).unwrap()["number"],
        2
    );
}

#[test]
fn damaged_version_content_is_detected() {
    let (tmp, mut ws, mm) = setup();
    let d = call(
        &mut ws,
        &mm,
        "t.a",
        "import",
        json!({"name": "a.pdf", "data": "original"}),
    )
    .unwrap();
    let v = call(&mut ws, &mm, "t.a", "versions", json!({"id": d["id"]})).unwrap();
    let hash = v[0]["hash"].as_str().unwrap();
    let path = tmp
        .path()
        .join("ws")
        .join("store")
        .join("blobs")
        .join(&hash[..2])
        .join(hash);
    std::fs::write(&path, b"altered!").unwrap();
    assert!(call(&mut ws, &mm, "t.a", "read", json!({"id": d["id"]})).is_err());
}

// ---------------------------------------------- forced kill during saves

const CHILD_ENV: &str = "KGB_DOC_CRASH_CHILD";

/// Child half of the crash test: saves versions as fast as it can until killed.
#[test]
#[ignore]
fn crash_child_saves_forever() {
    let Ok(dir) = std::env::var(CHILD_ENV) else { return };
    let mut ws = Workspace::open(Path::new(&dir)).unwrap();
    let mm = manager();
    let id = call(&mut ws, &mm, "t.a", "list", json!({})).unwrap()[0]["id"].clone();
    loop {
        let cur = call(&mut ws, &mm, "t.a", "list", json!({})).unwrap()[0]["current"]
            .as_u64()
            .unwrap();
        let body = format!("versiunea {} {}", cur + 1, "x".repeat(4096 + (cur as usize % 7) * 1000));
        call(
            &mut ws,
            &mm,
            "t.a",
            "save",
            json!({"id": id, "based_on": cur, "data": body}),
        )
        .unwrap();
    }
}

#[test]
fn a_forced_kill_during_saves_never_leaves_half_a_version() {
    let (_t, mut ws, mm) = setup();
    let original = "ORIGINALUL care nu trebuie atins";
    let id = call(
        &mut ws,
        &mm,
        "t.a",
        "import",
        json!({"name": "a.pdf", "data": original}),
    )
    .unwrap()["id"]
        .clone();
    let dir = ws.dir().to_path_buf();
    drop(ws);
    let exe = std::env::current_exe().unwrap();
    let mut last = 1;
    for round in 0..25u64 {
        let mut child = Command::new(&exe)
            .args([
                "crash_child_saves_forever",
                "--exact",
                "--ignored",
                "--nocapture",
                "--test-threads=1",
            ])
            .env(CHILD_ENV, &dir)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .unwrap();
        std::thread::sleep(Duration::from_millis(150 + (round * 37) % 250));
        child.kill().unwrap();
        child.wait().unwrap();

        let mut ws = Workspace::open(&dir).unwrap();
        let cur = call(&mut ws, &mm, "t.a", "list", json!({})).unwrap()[0]["current"]
            .as_u64()
            .unwrap();
        assert!(
            cur >= last,
            "round {round}: the document went back from {last} to {cur}"
        );
        last = cur;
        // Every version up to `current` exists and reads back intact …
        for n in 2..=cur {
            let v = call(&mut ws, &mm, "t.a", "read", json!({"id": id, "version": n})).unwrap();
            assert!(
                v["data"].as_str().unwrap().starts_with(&format!("versiunea {n} ")),
                "round {round} v{n}"
            );
        }
        // … no version beyond it was recorded, and the original is untouched.
        assert_eq!(ws.store().count(VERSIONS_COLLECTION) as u64, cur, "round {round}");
        assert_eq!(
            call(&mut ws, &mm, "t.a", "read", json!({"id": id, "version": 1})).unwrap()["data"],
            original
        );
    }
    assert!(last > 25, "the child really saved versions ({last})");
}
