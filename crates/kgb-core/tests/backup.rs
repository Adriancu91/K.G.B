//! Step 2.9: workspace backup/restore, automatic backups before risky changes,
//! explicit cleanup of leftovers.

use kgb_core::backup::{self, KEEP_AUTOMATIC, Reason};
use kgb_core::files::collect_unreferenced;
use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext, ModuleManager};
use kgb_core::workspace::{Registry, Workspace};
use kgb_core::{CoreError, CoreResult};
use kgb_store::{FORMAT_VERSION, Write};
use serde_json::{Value, json};
use uuid::Uuid;

fn obj(v: Value) -> kgb_store::Fields {
    v.as_object().unwrap().clone()
}

fn setup() -> (tempfile::TempDir, std::path::PathBuf, Workspace) {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path().join("KGB");
    let mut ws = Workspace::create(&root.join("workspaces").join("w1"), "Firma").unwrap();
    for i in 0..30u128 {
        ws.store_mut()
            .write(vec![Write::put("t", Uuid::from_u128(i), obj(json!({"i": i as u64})))])
            .unwrap();
    }
    ws.store().put_blob(b"atasament").unwrap();
    (tmp, root, ws)
}

#[test]
fn backup_then_changes_then_restore_as_new_workspace() {
    let (_t, root, mut ws) = setup();
    let b = backup::create(&mut ws, &root, Reason::Manual, "").unwrap();
    assert_eq!(b.meta.records, 30);
    backup::verify(&b.dir).unwrap();
    // Changes after the backup.
    ws.store_mut()
        .write(vec![Write::delete("t", Uuid::from_u128(1))])
        .unwrap();
    ws.store_mut()
        .write(vec![Write::put("t", Uuid::from_u128(99), obj(json!({"i": 99})))])
        .unwrap();
    let original_id = ws.manifest().id;

    let restored = backup::restore(&b.dir, &root).unwrap();
    assert_ne!(restored.manifest().id, original_id, "restore creates a new workspace");
    assert!(restored.manifest().name.starts_with("Firma (restaurat "));
    assert!(
        restored.store().get("t", Uuid::from_u128(1)).unwrap().is_some(),
        "state of the backup"
    );
    assert!(restored.store().get("t", Uuid::from_u128(99)).unwrap().is_none());
    assert!(restored.store().get_blob(&blake3::hash(b"atasament").to_hex()).is_ok());
    // The current workspace is untouched.
    assert!(ws.store().get("t", Uuid::from_u128(1)).unwrap().is_none());
    assert!(ws.store().get("t", Uuid::from_u128(99)).unwrap().is_some());
    let reg = Registry::load(&root).unwrap();
    assert_eq!(reg.last_opened, Some(restored.manifest().id));
    assert_eq!(backup::list(&root, original_id).unwrap().len(), 1);
}

#[test]
fn damaged_backup_is_refused() {
    let (_t, root, mut ws) = setup();
    let b = backup::create(&mut ws, &root, Reason::Manual, "").unwrap();
    let seg = std::fs::read_dir(b.dir.join("store").join("journal"))
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path();
    let mut bytes = std::fs::read(&seg).unwrap();
    let mid = bytes.len() / 2;
    bytes[mid] ^= 0xFF;
    std::fs::write(&seg, bytes).unwrap();
    assert!(backup::verify(&b.dir).is_err());
    assert!(backup::restore(&b.dir, &root).is_err());
    let ws_count = std::fs::read_dir(root.join("workspaces")).unwrap().count();
    assert_eq!(ws_count, 1, "nothing created from a damaged backup");
}

#[test]
fn only_the_newest_automatic_backups_are_kept_manual_ones_stay() {
    let (_t, root, mut ws) = setup();
    backup::create(&mut ws, &root, Reason::Manual, "").unwrap();
    for _ in 0..KEEP_AUTOMATIC + 3 {
        backup::create(&mut ws, &root, Reason::BeforeMigration, "test").unwrap();
    }
    let all = backup::list(&root, ws.manifest().id).unwrap();
    assert_eq!(all.iter().filter(|b| b.meta.reason == Reason::Manual).count(), 1);
    assert_eq!(all.iter().filter(|b| b.meta.reason.automatic()).count(), KEEP_AUTOMATIC);
    assert!(
        all.windows(2).all(|w| w[0].meta.created_ms >= w[1].meta.created_ms),
        "newest first"
    );
}

#[test]
fn old_journal_format_is_upgraded_after_an_automatic_backup() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path().join("KGB");
    let dir = root.join("workspaces").join("w1");
    drop(Workspace::create(&dir, "Veche").unwrap());
    // Pretend the journal was written by Etapa 1 (format 1).
    let mpath = dir.join("store").join("MANIFEST");
    let mut m: Value = serde_json::from_slice(&std::fs::read(&mpath).unwrap()).unwrap();
    m["format"] = json!(1);
    std::fs::write(&mpath, serde_json::to_vec(&m).unwrap()).unwrap();
    let mut ws = Workspace::open(&dir).unwrap();
    ws.store_mut()
        .write(vec![Write::put("t", Uuid::from_u128(1), obj(json!({"a": 1})))])
        .unwrap();
    assert_eq!(ws.store().format(), 1);

    let b = backup::upgrade_format_if_needed(&mut ws, &root)
        .unwrap()
        .expect("a backup was made");
    assert_eq!(b.meta.reason, Reason::BeforeFormatUpgrade);
    assert_eq!(ws.store().format(), FORMAT_VERSION);
    assert_eq!(ws.store().get("t", Uuid::from_u128(1)).unwrap().unwrap().fields["a"], 1);
    assert!(
        backup::upgrade_format_if_needed(&mut ws, &root).unwrap().is_none(),
        "only once"
    );
    // The backup still holds the old format, so an older app could use it.
    let bm: Value = serde_json::from_slice(&std::fs::read(b.dir.join("store").join("MANIFEST")).unwrap()).unwrap();
    assert_eq!(bm["format"], 1);
}

struct Migrating(Manifest);
impl Module for Migrating {
    fn manifest(&self) -> &Manifest {
        &self.0
    }
    fn migrate(&self, _: &mut ModuleContext<'_>, _: u32) -> CoreResult<()> {
        Ok(())
    }
    fn handle(&self, _: &mut ModuleContext<'_>, _: &str, _: Value) -> CoreResult<Value> {
        Err(CoreError::invalid("x", "x"))
    }
}

fn migrating(data_format: u32) -> Box<dyn Module> {
    let migrations: Vec<Value> = (1..data_format)
        .map(|f| json!({"from": f, "to": f + 1, "description": "m"}))
        .collect();
    let v = json!({
        "manifest_format": 1, "id": "t.m", "name": "M", "description": "d", "version": "0.1.0",
        "core": ">=0.1.0, <0.2.0", "status": "beta", "data_format": data_format, "migrations": migrations,
        "on_disable": "datele rămân"
    });
    Box::new(Migrating(Manifest::parse(&v.to_string()).unwrap()))
}

#[test]
fn module_data_migration_is_preceded_by_an_automatic_backup() {
    let (_t, root, mut ws) = setup();
    let id = ws.manifest().id;
    let v1 = ModuleManager::new(vec![migrating(1)], "0.1.0")
        .unwrap()
        .with_backup_root(&root);
    v1.enable(&mut ws, "t.m", &[]).unwrap();
    assert!(
        backup::list(&root, id).unwrap().is_empty(),
        "first enable: nothing to migrate, no backup"
    );
    v1.disable(&mut ws, "t.m").unwrap();
    let v2 = ModuleManager::new(vec![migrating(2)], "0.1.0")
        .unwrap()
        .with_backup_root(&root);
    v2.enable(&mut ws, "t.m", &[]).unwrap();
    let b = backup::list(&root, id).unwrap();
    assert_eq!(b.len(), 1);
    assert_eq!(b[0].meta.reason, Reason::BeforeMigration);
    assert!(b[0].meta.detail.contains("t.m"));
}

#[test]
fn leftovers_are_counted_and_purged_only_on_request() {
    let (_t, _root, mut ws) = setup();
    let qdir = ws.dir().join("store").join("quarantine");
    std::fs::create_dir_all(&qdir).unwrap();
    std::fs::write(qdir.join("x.tmp~"), vec![0u8; 1000]).unwrap();
    std::fs::write(
        ws.dir().join("store").join("journal").join("09999999.kjl"),
        vec![0u8; 500],
    )
    .unwrap();
    collect_unreferenced(&mut ws).unwrap(); // retires the unreferenced test blob
    let before = ws.store().leftover_bytes().unwrap();
    assert!(before >= 1500, "{before}");
    let r = ws.store_mut().purge_leftovers().unwrap();
    assert_eq!(r.bytes, before);
    assert_eq!(ws.store().leftover_bytes().unwrap(), 0);
    assert_eq!(ws.store().count("t"), 30, "live data untouched");
}

/// Step 7.4j: one daily backup per day, the last 14 kept; manual backups
/// and the ones made before migrations are never removed by them.
#[test]
fn daily_backups_once_a_day_last_14_kept() {
    let (_t, root, mut ws) = setup();
    let manual = backup::create(&mut ws, &root, Reason::Manual, "").unwrap();
    let before = backup::create(&mut ws, &root, Reason::BeforeMigration, "m").unwrap();
    assert!(backup::daily_if_due(&mut ws, &root, "2026-11-01").unwrap().is_some());
    assert!(
        backup::daily_if_due(&mut ws, &root, "2026-11-01").unwrap().is_none(),
        "once a day"
    );
    for d in 2..=20 {
        backup::daily_if_due(&mut ws, &root, &format!("2026-11-{d:02}"))
            .unwrap()
            .unwrap();
    }
    let all = backup::list(&root, ws.manifest().id).unwrap();
    let days: Vec<&str> = all
        .iter()
        .filter(|b| b.meta.reason == Reason::Daily)
        .map(|b| b.meta.detail.as_str())
        .collect();
    assert_eq!(days.len(), backup::KEEP_DAILY);
    assert_eq!(days.first(), Some(&"2026-11-20"));
    assert_eq!(days.last(), Some(&"2026-11-07"));
    assert!(manual.dir.exists() && before.dir.exists());
    // Each one is a full, checked backup.
    backup::verify(&all[0].dir).unwrap();
    const { assert!(KEEP_AUTOMATIC < backup::KEEP_DAILY) };
}
