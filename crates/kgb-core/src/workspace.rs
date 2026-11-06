//! Workspace (Etapa 1, step 1.4).
//!
//! A workspace is one folder holding everything of one user/organisation on
//! this PC:
//! ```text
//! workspace.json   manifest: format, id, name (replaced atomically)
//! store/           kgb-store data (journal, blobs, LOCK)
//! logs/            rotating log files (see `log`)
//! ```
//! Only one process may have a workspace open: the store's `LOCK` enforces it.
//! Workspaces inside cloud-synchronised folders are refused (Metaprompt §7).
//!
//! The registry (`<root>/workspaces.json`) remembers the known workspaces and
//! the one opened last, so the app can reopen it on start.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use kgb_store::fsutil::{check_location, write_atomic};
use kgb_store::{Options, RecoveryReport, Store};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};

pub const WORKSPACE_FORMAT: u32 = 1;
pub const MANIFEST_FILE: &str = "workspace.json";
pub const REGISTRY_FILE: &str = "workspaces.json";
pub const REGISTRY_FORMAT: u32 = 1;
const NAME_MAX_CHARS: usize = 80;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorkspaceManifest {
    pub format: u32,
    pub id: Uuid,
    pub name: String,
    pub created_ms: u64,
}

pub struct Workspace {
    dir: PathBuf,
    manifest: WorkspaceManifest,
    store: Store,
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or_default()
}

/// Trims and validates a user-visible name (workspace, profile…).
pub fn validate_name(what: &str, name: &str) -> CoreResult<String> {
    let n = name.trim();
    if n.is_empty() {
        return Err(CoreError::invalid(what, "numele nu poate fi gol"));
    }
    if n.chars().count() > NAME_MAX_CHARS {
        return Err(CoreError::invalid(
            what,
            format!("numele are mai mult de {NAME_MAX_CHARS} de caractere"),
        ));
    }
    if n.chars().any(char::is_control) {
        return Err(CoreError::invalid(what, "numele conține caractere de control"));
    }
    Ok(n.to_string())
}

fn safe_location(dir: &Path) -> CoreResult<()> {
    check_location(dir).map_err(CoreError::from)
}

fn read_manifest(dir: &Path) -> CoreResult<WorkspaceManifest> {
    let path = dir.join(MANIFEST_FILE);
    let bytes = match fs::read(&path) {
        Ok(b) => b,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Err(CoreError::NotAWorkspace(dir.into())),
        Err(e) => return Err(e.into()),
    };
    // Read the format first so a newer layout is reported as "too new",
    // not as "corrupt".
    let raw: serde_json::Value = serde_json::from_slice(&bytes).map_err(|e| CoreError::WorkspaceManifestCorrupt {
        path: path.clone(),
        detail: e.to_string(),
    })?;
    let format = raw.get("format").and_then(serde_json::Value::as_u64).unwrap_or(0) as u32;
    if format > WORKSPACE_FORMAT {
        return Err(CoreError::WorkspaceTooNew {
            path,
            format,
            supported: WORKSPACE_FORMAT,
        });
    }
    let m: WorkspaceManifest = serde_json::from_value(raw).map_err(|e| CoreError::WorkspaceManifestCorrupt {
        path: path.clone(),
        detail: e.to_string(),
    })?;
    if m.format == 0 {
        return Err(CoreError::WorkspaceManifestCorrupt {
            path,
            detail: "format lipsă".into(),
        });
    }
    Ok(m)
}

impl Workspace {
    /// Creates a new workspace in `dir`, which must not exist or be empty.
    pub fn create(dir: &Path, name: &str) -> CoreResult<Workspace> {
        let name = validate_name("numele spațiului de lucru", name)?;
        safe_location(dir)?;
        if dir.exists() && fs::read_dir(dir)?.next().is_some() {
            return Err(CoreError::AlreadyExists(dir.into()));
        }
        fs::create_dir_all(dir)?;
        let manifest = WorkspaceManifest {
            format: WORKSPACE_FORMAT,
            id: Uuid::now_v7(),
            name,
            created_ms: now_ms(),
        };
        // Open the store first: it takes the lock before the manifest appears.
        let store = Store::open(dir.join("store"), Options::default())?;
        fs::create_dir_all(dir.join("logs"))?;
        write_atomic(
            &dir.join(MANIFEST_FILE),
            &serde_json::to_vec_pretty(&manifest).expect("manifest serialises"),
        )?;
        Ok(Workspace {
            dir: dir.into(),
            manifest,
            store,
        })
    }

    /// Opens an existing workspace. Fails clearly (without changing anything)
    /// if it is in use, damaged, too new or in an unsafe location.
    pub fn open(dir: &Path) -> CoreResult<Workspace> {
        safe_location(dir)?;
        let manifest = read_manifest(dir)?;
        let store = Store::open(dir.join("store"), Options::default())?;
        fs::create_dir_all(dir.join("logs"))?;
        Ok(Workspace {
            dir: dir.into(),
            manifest,
            store,
        })
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }
    pub fn logs_dir(&self) -> PathBuf {
        self.dir.join("logs")
    }
    pub fn manifest(&self) -> &WorkspaceManifest {
        &self.manifest
    }
    pub fn store(&self) -> &Store {
        &self.store
    }
    pub fn store_mut(&mut self) -> &mut Store {
        &mut self.store
    }
    pub fn recovery(&self) -> &RecoveryReport {
        self.store.recovery_report()
    }

    /// Renames the workspace (manifest replaced atomically).
    pub fn rename(&mut self, name: &str) -> CoreResult<()> {
        let mut m = self.manifest.clone();
        m.name = validate_name("numele spațiului de lucru", name)?;
        write_atomic(
            &self.dir.join(MANIFEST_FILE),
            &serde_json::to_vec_pretty(&m).expect("manifest serialises"),
        )?;
        self.manifest = m;
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct KnownWorkspace {
    pub id: Uuid,
    pub name: String,
    pub dir: PathBuf,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Registry {
    pub format: u32,
    pub last_opened: Option<Uuid>,
    pub workspaces: Vec<KnownWorkspace>,
}

impl Default for Registry {
    fn default() -> Self {
        Registry {
            format: REGISTRY_FORMAT,
            last_opened: None,
            workspaces: Vec::new(),
        }
    }
}

impl Registry {
    /// Loads `<root>/workspaces.json`; a missing file means an empty registry.
    /// A damaged file is reported, never overwritten silently.
    pub fn load(root: &Path) -> CoreResult<Registry> {
        let path = root.join(REGISTRY_FILE);
        match fs::read(&path) {
            Ok(b) => {
                let r: Registry = serde_json::from_slice(&b).map_err(|e| CoreError::WorkspaceManifestCorrupt {
                    path: path.clone(),
                    detail: e.to_string(),
                })?;
                if r.format > REGISTRY_FORMAT {
                    return Err(CoreError::WorkspaceTooNew {
                        path,
                        format: r.format,
                        supported: REGISTRY_FORMAT,
                    });
                }
                Ok(r)
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Registry::default()),
            Err(e) => Err(e.into()),
        }
    }

    pub fn save(&self, root: &Path) -> CoreResult<()> {
        fs::create_dir_all(root)?;
        write_atomic(
            &root.join(REGISTRY_FILE),
            &serde_json::to_vec_pretty(self).expect("registry serialises"),
        )?;
        Ok(())
    }

    /// Records `ws` as known and as the last one opened.
    pub fn remember(&mut self, ws: &Workspace) {
        let entry = KnownWorkspace {
            id: ws.manifest.id,
            name: ws.manifest.name.clone(),
            dir: ws.dir.clone(),
        };
        match self.workspaces.iter_mut().find(|w| w.id == entry.id) {
            Some(w) => *w = entry,
            None => self.workspaces.push(entry),
        }
        self.last_opened = Some(ws.manifest.id);
    }
}

/// App start: reopen the last workspace, or create the default one under
/// `<root>/workspaces/<id>` on first run. Returns whether it was created.
pub fn open_last_or_create_default(root: &Path, default_name: &str) -> CoreResult<(Workspace, bool)> {
    let mut reg = Registry::load(root)?;
    let last = reg
        .last_opened
        .and_then(|id| reg.workspaces.iter().find(|w| w.id == id).cloned());
    let (ws, created) = match last {
        Some(k) => (Workspace::open(&k.dir)?, false),
        None => {
            let dir = root.join("workspaces").join(Uuid::now_v7().to_string());
            (Workspace::create(&dir, default_name)?, true)
        }
    };
    reg.remember(&ws);
    reg.save(root)?;
    Ok((ws, created))
}
