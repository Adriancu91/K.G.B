//! Workspace backup and restore (Etapa 2, step 2.9; Master Plan §11, §12.2;
//! decision D-030).
//!
//! A backup is a folder `<root>/backups/<workspace id>/<time>-<reason>/`:
//! ```text
//! KGB_BACKUP.json   what, when, why, versions, hash of workspace.json
//! workspace.json    copy of the workspace manifest
//! store/            consistent store copy with a BLAKE3 hash of every file
//! ```
//! - Backups are verified file by file before any restore.
//! - **Restore never overwrites** the current workspace: it creates a new
//!   workspace (new id, name "… (restaurat …)") next to it (D-030).
//! - Automatic backups are made before risky changes: a module's data
//!   migration and the journal format upgrade (D-029). Only the newest
//!   [`KEEP_AUTOMATIC`] automatic backups are kept; manual ones are kept
//!   until the user removes them.

use std::fs;
use std::path::{Path, PathBuf};

use kgb_store::fsutil::write_atomic;
use kgb_store::{FORMAT_VERSION, Options, restore_backup, verify_backup};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::log::format_utc;
use crate::workspace::{MANIFEST_FILE, Registry, Workspace, WorkspaceManifest, now_ms, validate_name};

pub const BACKUP_META: &str = "KGB_BACKUP.json";
pub const KEEP_AUTOMATIC: usize = 5;
/// Daily backups kept (step 7.4j): the last 14 days.
pub const KEEP_DAILY: usize = 14;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Reason {
    /// Asked for by the user.
    Manual,
    /// Before a module's data migration.
    BeforeMigration,
    /// Before the journal moves to a newer format.
    BeforeFormatUpgrade,
    /// Once a day while K.G.B. runs (step 7.4j); `detail` is the day.
    Daily,
}

impl Reason {
    fn slug(self) -> &'static str {
        match self {
            Reason::Manual => "manual",
            Reason::BeforeMigration => "inainte-de-migrare",
            Reason::BeforeFormatUpgrade => "inainte-de-conversie",
            Reason::Daily => "zilnic",
        }
    }
    pub fn automatic(self) -> bool {
        self != Reason::Manual
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BackupMeta {
    pub format: u32,
    pub workspace_id: Uuid,
    pub workspace_name: String,
    pub reason: Reason,
    pub detail: String,
    pub created_ms: u64,
    pub core_version: String,
    pub records: usize,
    pub workspace_json_blake3: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct BackupEntry {
    pub dir: PathBuf,
    pub meta: BackupMeta,
}

pub fn backups_dir(root: &Path, workspace: Uuid) -> PathBuf {
    root.join("backups").join(workspace.to_string())
}

/// Makes a verified backup of the open workspace.
pub fn create(ws: &mut Workspace, root: &Path, reason: Reason, detail: &str) -> CoreResult<BackupEntry> {
    let m = ws.manifest().clone();
    let base = backups_dir(root, m.id);
    fs::create_dir_all(&base)?;
    let stamp = format_utc(now_ms()).replace([':', '.'], "-");
    let mut dir = base.join(format!("{stamp}-{}", reason.slug()));
    let mut n = 1;
    while dir.exists() {
        n += 1;
        dir = base.join(format!("{stamp}-{}-{n}", reason.slug()));
    }
    // Build in a temporary folder; it becomes a backup only when complete.
    let tmp = base.join(format!(".partial-{}", Uuid::now_v7()));
    fs::create_dir_all(&tmp)?;
    let info = ws.store_mut().backup_to(&tmp.join("store"))?;
    let ws_json = fs::read(ws.dir().join(MANIFEST_FILE))?;
    write_atomic(&tmp.join(MANIFEST_FILE), &ws_json)?;
    let meta = BackupMeta {
        format: 1,
        workspace_id: m.id,
        workspace_name: m.name.clone(),
        reason,
        detail: detail.to_string(),
        created_ms: now_ms(),
        core_version: crate::CORE_VERSION.to_string(),
        records: info.records,
        workspace_json_blake3: blake3::hash(&ws_json).to_hex().to_string(),
    };
    write_atomic(
        &tmp.join(BACKUP_META),
        &serde_json::to_vec_pretty(&meta).expect("meta serialises"),
    )?;
    verify(&tmp)?;
    fs::rename(&tmp, &dir)?;
    tracing::info!(reason = reason.slug(), records = info.records as u64, "backup created");
    if reason.automatic() {
        prune(&base, reason == Reason::Daily)?;
    }
    Ok(BackupEntry { dir, meta })
}

fn read_meta(dir: &Path) -> CoreResult<BackupMeta> {
    let bytes = fs::read(dir.join(BACKUP_META))?;
    serde_json::from_slice(&bytes).map_err(|e| CoreError::invalid("backupul", format!("{BACKUP_META}: {e}")))
}

/// Checks every file of a backup against its recorded hash.
pub fn verify(dir: &Path) -> CoreResult<BackupMeta> {
    let meta = read_meta(dir)?;
    let ws_json = fs::read(dir.join(MANIFEST_FILE))?;
    if blake3::hash(&ws_json).to_hex().as_str() != meta.workspace_json_blake3 {
        return Err(CoreError::invalid("backupul", "workspace.json a fost modificat"));
    }
    verify_backup(&dir.join("store"))?;
    Ok(meta)
}

/// Backups of one workspace, newest first. Folders that are not readable
/// backups are skipped (a partial one from an interrupted run, for example).
pub fn list(root: &Path, workspace: Uuid) -> CoreResult<Vec<BackupEntry>> {
    let base = backups_dir(root, workspace);
    let mut out = Vec::new();
    if !base.exists() {
        return Ok(out);
    }
    for e in fs::read_dir(&base)? {
        let p = e?.path();
        if p.file_name().is_some_and(|n| n.to_string_lossy().starts_with('.')) || !p.is_dir() {
            continue;
        }
        if let Ok(meta) = read_meta(&p) {
            out.push(BackupEntry { dir: p, meta });
        }
    }
    out.sort_by_key(|b| std::cmp::Reverse(b.meta.created_ms));
    Ok(out)
}

/// Keeps the last [`KEEP_DAILY`] daily backups, or the last
/// [`KEEP_AUTOMATIC`] other automatic ones; manual backups are never removed.
fn prune(base: &Path, daily: bool) -> CoreResult<()> {
    let mut autos: Vec<(u64, PathBuf)> = Vec::new();
    for e in fs::read_dir(base)? {
        let p = e?.path();
        if let Ok(m) = read_meta(&p)
            && m.reason.automatic()
            && (m.reason == Reason::Daily) == daily
        {
            autos.push((m.created_ms, p));
        }
    }
    autos.sort_by_key(|(t, _)| std::cmp::Reverse(*t));
    for (_, p) in autos.into_iter().skip(if daily { KEEP_DAILY } else { KEEP_AUTOMATIC }) {
        fs::remove_dir_all(p)?;
    }
    Ok(())
}

/// The daily backup (step 7.4j): made once for `day` (AAAA-LL-ZZ, the PC's
/// local day); `None` when today's already exists.
pub fn daily_if_due(ws: &mut Workspace, root: &Path, day: &str) -> CoreResult<Option<BackupEntry>> {
    let done = list(root, ws.manifest().id)?
        .iter()
        .any(|b| b.meta.reason == Reason::Daily && b.meta.detail == day);
    if done {
        return Ok(None);
    }
    create(ws, root, Reason::Daily, day).map(Some)
}

/// Restores a backup as a **new** workspace under `<root>/workspaces/<new id>`
/// and records it in the registry. The original workspace is not touched.
pub fn restore(backup: &Path, root: &Path) -> CoreResult<Workspace> {
    let meta = verify(backup)?;
    let new_id = Uuid::now_v7();
    let dir = root.join("workspaces").join(new_id.to_string());
    if dir.exists() {
        return Err(CoreError::AlreadyExists(dir));
    }
    fs::create_dir_all(&dir)?;
    drop(restore_backup(
        &backup.join("store"),
        &dir.join("store"),
        Options::default(),
    )?);
    let old: WorkspaceManifest = serde_json::from_slice(&fs::read(backup.join(MANIFEST_FILE))?)
        .map_err(|e| CoreError::invalid("backupul", format!("workspace.json: {e}")))?;
    let label = format_utc(meta.created_ms)[..16].replace('T', " ");
    let mut name = format!("{} (restaurat {label})", old.name);
    if validate_name("numele", &name).is_err() {
        name = format!("Restaurat {label}");
    }
    let m = WorkspaceManifest {
        format: old.format,
        id: new_id,
        name,
        created_ms: now_ms(),
    };
    write_atomic(
        &dir.join(MANIFEST_FILE),
        &serde_json::to_vec_pretty(&m).expect("manifest serialises"),
    )?;
    let ws = Workspace::open(&dir)?;
    let mut reg = Registry::load(root)?;
    reg.remember(&ws);
    reg.save(root)?;
    tracing::info!("backup restored as a new workspace");
    Ok(ws)
}

/// Upgrades an older journal format (D-029): automatic backup, then a full
/// compaction. Returns the backup made, if any.
pub fn upgrade_format_if_needed(ws: &mut Workspace, root: &Path) -> CoreResult<Option<BackupEntry>> {
    if ws.store().format() >= FORMAT_VERSION {
        return Ok(None);
    }
    let from = ws.store().format();
    let b = create(
        ws,
        root,
        Reason::BeforeFormatUpgrade,
        &format!("jurnal format {from} → {FORMAT_VERSION}"),
    )?;
    ws.store_mut().compact()?;
    tracing::info!(
        from = from as u64,
        to = FORMAT_VERSION as u64,
        "journal format upgraded"
    );
    Ok(Some(b))
}
