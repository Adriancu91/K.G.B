//! Module manager (Etapa 1, step 1.7) and the permission framework that every
//! module call goes through (step 1.8).
//!
//! - Modules are built into the app (D-024) and implement [`Module`].
//! - Their state (enabled, granted permissions, data format, history) lives in
//!   `core.modules`. Disabling a module never touches its data.
//! - A module sees the workspace only through a [`ModuleContext`], which checks
//!   the granted permissions on every operation and confines storage to the
//!   collections the manifest declares (`mod.<id>.<collection>`). Every denial
//!   and every enable/disable is written to the audit journal `core.audit`.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use kgb_store::{Fields, Query, QueryResult, RecordState, Write};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::backup;
use crate::documents::{self, DocumentRef, VersionRef};
use crate::error::{CoreError, CoreResult};
use crate::files;
use crate::identity;
use crate::manifest::{Manifest, ModuleStatus};
use crate::settings::{self, Settings};
use crate::workspace::{Workspace, now_ms};

pub const MODULES_COLLECTION: &str = "core.modules";
pub const AUDIT_COLLECTION: &str = "core.audit";
const HISTORY_MAX: usize = 50;

/// Work profiles (Master Plan §5.2): which enabled modules the sidebar shows.
pub const PROFILES: &[(&str, &str)] = &[
    ("birou", "Birou"),
    ("management", "Management"),
    ("depozit", "Depozit"),
    ("investitii", "Investiții"),
    ("proiecte", "Proiecte"),
    ("personal", "Personal"),
];

pub fn profile_ids() -> Vec<&'static str> {
    PROFILES.iter().map(|(id, _)| *id).collect()
}

/// Modules of later stages, shown in the catalog as "not implemented".
/// They have no code and cannot be enabled.
#[derive(Clone, Copy, Debug, Serialize)]
pub struct Planned {
    pub id: &'static str,
    pub name: &'static str,
    pub stage: &'static str,
}

pub const PLANNED: &[Planned] = &[
    Planned {
        id: "documents",
        name: "Document Studio",
        stage: "Etapa 3",
    },
    Planned {
        id: "sheets",
        name: "Foi de calcul",
        stage: "Etapa 3",
    },
    Planned {
        id: "tasks",
        name: "Planner și taskuri",
        stage: "Etapa 4",
    },
    Planned {
        id: "business",
        name: "Stocuri și financiar",
        stage: "Etapa 5",
    },
    Planned {
        id: "devices",
        name: "Dispozitive și sincronizare",
        stage: "Etapa 6",
    },
    Planned {
        id: "news",
        name: "Informații și InfoNews",
        stage: "Etapa 7",
    },
];

/// A built-in module. UI and domain logic stay separate: the module answers
/// commands with JSON; the React side renders it.
pub trait Module: Send + Sync {
    fn manifest(&self) -> &Manifest;

    /// Upgrades the module's data from format `from` to `from + 1`.
    /// Called once per step, in order, before the module is enabled.
    fn migrate(&self, ctx: &mut ModuleContext<'_>, from: u32) -> CoreResult<()> {
        let _ = ctx;
        Err(CoreError::invalid(
            format!("modulul {}", self.manifest().id),
            format!("nu are migrare de la formatul {from}"),
        ))
    }

    /// Handles one command from the UI.
    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, args: Value) -> CoreResult<Value>;
}

/// Stored state of one module.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ModuleState {
    pub enabled: bool,
    pub granted: BTreeSet<String>,
    /// Format of the data on disk (0 = the module never ran here).
    pub data_format: u32,
    pub version: u64,
}

/// What the catalog shows for one module.
#[derive(Clone, Debug, Serialize)]
pub struct ModuleView {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub status: ModuleStatus,
    pub permissions: Vec<PermissionView>,
    pub on_disable: String,
    pub compatible: bool,
    pub enabled: bool,
    /// Records the module holds (kept when disabled).
    pub records: usize,
}

#[derive(Clone, Debug, Serialize)]
pub struct PermissionView {
    pub id: String,
    pub description: String,
    pub granted: bool,
}

fn state_id(module_id: &str) -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_OID, format!("kgb-module:{module_id}").as_bytes())
}

pub fn audit(ws: &mut Workspace, module: &str, action: &str, outcome: &str, detail: &str) -> CoreResult<()> {
    let mut f = Fields::new();
    f.insert("ts_ms".into(), Value::from(now_ms()));
    f.insert("module".into(), Value::String(module.into()));
    f.insert("action".into(), Value::String(action.into()));
    f.insert("outcome".into(), Value::String(outcome.into()));
    f.insert("detail".into(), Value::String(detail.into()));
    ws.store_mut()
        .write(vec![Write::put(AUDIT_COLLECTION, Uuid::now_v7(), f).expect(0)])?;
    Ok(())
}

/// Audit entries, newest first.
pub fn audit_log(ws: &Workspace, limit: usize) -> CoreResult<Vec<Fields>> {
    let mut all = ws.store().scan(AUDIT_COLLECTION, |_| true)?;
    // v7 ids sort by creation time.
    all.sort_by_key(|r| std::cmp::Reverse(r.id));
    Ok(all.into_iter().take(limit).map(|r| r.fields).collect())
}

pub struct ModuleManager {
    modules: Vec<Box<dyn Module>>,
    core_version: String,
    /// Where automatic backups go before a data migration (`None` = no backup,
    /// used only by tests that do not care).
    backup_root: Option<PathBuf>,
}

impl ModuleManager {
    /// Validates every built-in manifest. A built-in module with a bad
    /// manifest is a programming error and is refused at start.
    pub fn new(modules: Vec<Box<dyn Module>>, core_version: &str) -> CoreResult<ModuleManager> {
        let mut ids = BTreeSet::new();
        for m in &modules {
            m.manifest().validate()?;
            if !ids.insert(m.manifest().id.clone()) {
                return Err(CoreError::invalid(
                    "modulele",
                    format!("id duplicat {}", m.manifest().id),
                ));
            }
        }
        Ok(ModuleManager {
            modules,
            core_version: core_version.into(),
            backup_root: None,
        })
    }

    /// Makes an automatic workspace backup under `root` before any module data
    /// migration (Master Plan §12.2).
    pub fn with_backup_root(mut self, root: &Path) -> ModuleManager {
        self.backup_root = Some(root.to_path_buf());
        self
    }

    fn find(&self, id: &str) -> CoreResult<&dyn Module> {
        self.modules
            .iter()
            .find(|m| m.manifest().id == id)
            .map(|b| b.as_ref())
            .ok_or_else(|| CoreError::ModuleNotFound(id.into()))
    }

    pub fn state(&self, ws: &Workspace, id: &str) -> CoreResult<ModuleState> {
        self.find(id)?;
        Ok(match ws.store().get(MODULES_COLLECTION, state_id(id))? {
            None => ModuleState {
                enabled: false,
                granted: BTreeSet::new(),
                data_format: 0,
                version: 0,
            },
            Some(r) => ModuleState {
                enabled: r.fields.get("enabled").and_then(Value::as_bool).unwrap_or(false),
                granted: r
                    .fields
                    .get("granted")
                    .and_then(Value::as_array)
                    .map(|a| a.iter().filter_map(Value::as_str).map(String::from).collect())
                    .unwrap_or_default(),
                data_format: r.fields.get("data_format").and_then(Value::as_u64).unwrap_or(0) as u32,
                version: r.version,
            },
        })
    }

    fn write_state(&self, ws: &mut Workspace, id: &str, st: &ModuleState, event: &str) -> CoreResult<()> {
        let mut history = match ws.store().get(MODULES_COLLECTION, state_id(id))? {
            Some(r) => r
                .fields
                .get("history")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default(),
            None => Vec::new(),
        };
        history.push(serde_json::json!({"ts_ms": now_ms(), "event": event}));
        let skip = history.len().saturating_sub(HISTORY_MAX);
        let mut f = Fields::new();
        f.insert("module_id".into(), Value::String(id.into()));
        f.insert("enabled".into(), Value::Bool(st.enabled));
        f.insert(
            "granted".into(),
            Value::from(st.granted.iter().cloned().collect::<Vec<_>>()),
        );
        f.insert("data_format".into(), Value::from(st.data_format));
        f.insert("history".into(), Value::Array(history.split_off(skip)));
        ws.store_mut()
            .write(vec![Write::put(MODULES_COLLECTION, state_id(id), f).expect(st.version)])?;
        Ok(())
    }

    /// Catalog entries. Experimental modules are listed only when
    /// `include_experimental` is set (pre-release builds); the UI labels them.
    pub fn list(&self, ws: &Workspace, include_experimental: bool) -> CoreResult<Vec<ModuleView>> {
        let mut out = Vec::new();
        for m in &self.modules {
            let mf = m.manifest();
            if mf.status == ModuleStatus::Experimental && !include_experimental {
                continue;
            }
            let st = self.state(ws, &mf.id)?;
            let records = mf
                .data_types
                .iter()
                .filter_map(|d| mf.store_collection(&d.collection))
                .map(|c| ws.store().count(&c))
                .sum();
            out.push(ModuleView {
                id: mf.id.clone(),
                name: mf.name.clone(),
                description: mf.description.clone(),
                version: mf.version.clone(),
                status: mf.status,
                permissions: mf
                    .permissions
                    .iter()
                    .map(|p| PermissionView {
                        id: p.clone(),
                        description: crate::manifest::PERMISSIONS
                            .iter()
                            .find(|(k, _)| k == p)
                            .map(|(_, d)| d.to_string())
                            .unwrap_or_default(),
                        granted: st.granted.contains(p),
                    })
                    .collect(),
                on_disable: mf.on_disable.clone(),
                compatible: mf.compatible_with(&self.core_version),
                enabled: st.enabled,
                records,
            });
        }
        Ok(out)
    }

    /// Enables a module, granting exactly the permissions it requests (the UI
    /// shows them first). Runs pending data migrations before enabling.
    pub fn enable(&self, ws: &mut Workspace, id: &str, grant: &[String]) -> CoreResult<()> {
        let m = self.find(id)?;
        let mf = m.manifest();
        if mf.status == ModuleStatus::Disabled {
            return Err(CoreError::ModuleUnavailable(id.into()));
        }
        if !mf.compatible_with(&self.core_version) {
            return Err(CoreError::ModuleIncompatible {
                module: id.into(),
                requires: mf.core.clone(),
                core: self.core_version.clone(),
            });
        }
        let requested: BTreeSet<String> = mf.permissions.iter().cloned().collect();
        let granted: BTreeSet<String> = grant.iter().cloned().collect();
        if granted != requested {
            return Err(CoreError::invalid(
                format!("activarea modulului {id}"),
                "trebuie acordate exact permisiunile cerute de modul",
            ));
        }
        let mut st = self.state(ws, id)?;
        if st.data_format > mf.data_format {
            return Err(CoreError::invalid(
                format!("modulul {id}"),
                format!(
                    "datele au formatul {}, mai nou decât {} al modulului; actualizează aplicația",
                    st.data_format, mf.data_format
                ),
            ));
        }
        st.granted = granted;
        if st.data_format == 0 {
            // First run here: nothing to migrate.
            st.data_format = mf.data_format;
        }
        if st.data_format < mf.data_format
            && let Some(root) = &self.backup_root
        {
            let detail = format!("{id}: date {} → {}", st.data_format, mf.data_format);
            backup::create(ws, root, backup::Reason::BeforeMigration, &detail)?;
        }
        while st.data_format < mf.data_format {
            let from = st.data_format;
            {
                let mut ctx = ModuleContext {
                    manifest: mf,
                    granted: &st.granted,
                    ws: &mut *ws,
                    fingerprint: None,
                };
                m.migrate(&mut ctx, from)?;
            }
            st.data_format = from + 1;
            self.write_state(ws, id, &st, &format!("migrat {from} → {}", from + 1))?;
            st.version = self.state(ws, id)?.version;
            audit(ws, id, "migrate", "ok", &format!("{from} → {}", from + 1))?;
        }
        // Declared indexes: idempotent, persisted by the store, rebuilt on open.
        for d in &mf.data_types {
            if let Some(physical) = mf.store_collection(&d.collection) {
                for field in &d.indexes {
                    ws.store_mut().create_index(&physical, field)?;
                }
            }
        }
        st.enabled = true;
        self.write_state(ws, id, &st, "activat")?;
        audit(
            ws,
            id,
            "enable",
            "ok",
            &st.granted.iter().cloned().collect::<Vec<_>>().join(","),
        )?;
        tracing::info!(module = id, "module enabled");
        Ok(())
    }

    /// Disables a module. Its data stays where it is.
    pub fn disable(&self, ws: &mut Workspace, id: &str) -> CoreResult<()> {
        self.find(id)?;
        let mut st = self.state(ws, id)?;
        if !st.enabled {
            return Ok(());
        }
        st.enabled = false;
        self.write_state(ws, id, &st, "dezactivat")?;
        audit(ws, id, "disable", "ok", "datele au fost păstrate")?;
        tracing::info!(module = id, "module disabled");
        Ok(())
    }

    /// Runs a module command through the permission framework.
    pub fn call(
        &self,
        ws: &mut Workspace,
        fingerprint: Option<&str>,
        id: &str,
        command: &str,
        args: Value,
    ) -> CoreResult<Value> {
        let m = self.find(id)?;
        let st = self.state(ws, id)?;
        if !st.enabled {
            audit(ws, id, command, "refuzat", "modulul nu este activat")?;
            return Err(CoreError::ModuleNotEnabled(id.into()));
        }
        let mut ctx = ModuleContext {
            manifest: m.manifest(),
            granted: &st.granted,
            ws,
            fingerprint,
        };
        // A module that panics (for example a library on a hostile file) must
        // never close the app: the panic becomes an error and an audit entry.
        // The store's writes are atomic batches, so nothing is left half-written.
        let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| m.handle(&mut ctx, command, args)));
        match r {
            Ok(r) => r,
            Err(p) => {
                let what = p
                    .downcast_ref::<&str>()
                    .map(|s| s.to_string())
                    .or_else(|| p.downcast_ref::<String>().cloned())
                    .unwrap_or_default();
                tracing::error!(module = id, command, "module panicked: {what}");
                audit(
                    ws,
                    id,
                    command,
                    "eroare internă",
                    &what.chars().take(200).collect::<String>(),
                )?;
                Err(CoreError::invalid(
                    "modulul",
                    "a întâlnit o eroare internă la această operație (fișier neobișnuit?); nimic nu a fost modificat",
                ))
            }
        }
    }
}

/// The only door from a module to the workspace.
pub struct ModuleContext<'a> {
    manifest: &'a Manifest,
    granted: &'a BTreeSet<String>,
    ws: &'a mut Workspace,
    fingerprint: Option<&'a str>,
}

impl ModuleContext<'_> {
    pub fn module_id(&self) -> &str {
        &self.manifest.id
    }

    fn deny(&mut self, permission: &str, detail: String) -> CoreError {
        let id = self.manifest.id.clone();
        tracing::warn!(module = %id, permission, "permission denied");
        if let Err(e) = audit(self.ws, &id, permission, "refuzat", &detail) {
            tracing::error!(module = %id, "audit write failed: {e}");
        }
        CoreError::PermissionDenied {
            module: id,
            permission: permission.into(),
            detail,
        }
    }

    fn require(&mut self, permission: &str) -> CoreResult<()> {
        if self.granted.contains(permission) {
            Ok(())
        } else {
            Err(self.deny(permission, "permisiune neacordată".into()))
        }
    }

    fn collection(&mut self, logical: &str) -> CoreResult<String> {
        self.require("storage.own")?;
        match self.manifest.store_collection(logical) {
            Some(c) => Ok(c),
            None => Err(self.deny(
                "storage.own",
                format!("colecția „{logical}” nu este declarată în manifest"),
            )),
        }
    }

    pub fn get(&mut self, coll: &str, id: Uuid) -> CoreResult<Option<RecordState>> {
        let c = self.collection(coll)?;
        Ok(self.ws.store().get(&c, id)?)
    }

    pub fn scan(&mut self, coll: &str, pred: impl FnMut(&RecordState) -> bool) -> CoreResult<Vec<RecordState>> {
        let c = self.collection(coll)?;
        Ok(self.ws.store().scan(&c, pred)?)
    }

    /// Structured query on one of the module's collections. Declared indexes
    /// are used automatically.
    pub fn query(&mut self, coll: &str, q: &Query) -> CoreResult<QueryResult> {
        let c = self.collection(coll)?;
        Ok(self.ws.store().query(&c, q)?)
    }

    pub fn count(&mut self, coll: &str) -> CoreResult<usize> {
        let c = self.collection(coll)?;
        Ok(self.ws.store().count(&c))
    }

    /// Atomic batch on the module's own collections. Collection names in the
    /// batch are logical (as declared in the manifest).
    pub fn write(&mut self, batch: Vec<Write>) -> CoreResult<Vec<u64>> {
        let mut mapped = Vec::with_capacity(batch.len());
        for w in batch {
            mapped.push(match w {
                Write::Put {
                    coll,
                    id,
                    fields,
                    expected,
                } => Write::Put {
                    coll: {
                        let physical = self.collection(&coll)?;
                        if let Some(schema) = self.manifest.schema(&coll) {
                            schema.check(&fields)?;
                        }
                        physical
                    },
                    id,
                    fields,
                    expected,
                },
                Write::Delete { coll, id, expected } => Write::Delete {
                    coll: self.collection(&coll)?,
                    id,
                    expected,
                },
                Write::Restore { coll, id, expected } => Write::Restore {
                    coll: self.collection(&coll)?,
                    id,
                    expected,
                },
            });
        }
        Ok(self.ws.store_mut().write(mapped)?)
    }

    pub fn settings(&mut self) -> CoreResult<Settings> {
        self.require("settings.read")?;
        Ok(settings::load(self.ws.store())?.settings)
    }

    pub fn owner_name(&mut self) -> CoreResult<Option<String>> {
        self.require("identity.read")?;
        Ok(identity::owner(self.ws.store())?.map(|o| o.display_name))
    }

    pub fn device_fingerprint(&mut self) -> CoreResult<Option<String>> {
        self.require("identity.read")?;
        Ok(self.fingerprint.map(String::from))
    }

    /// Stores a file owned by this module (permission `files.own`).
    pub fn put_file(&mut self, name: &str, data: &[u8]) -> CoreResult<files::FileRef> {
        self.require("files.own")?;
        let id = self.manifest.id.clone();
        files::put(self.ws, &id, name, data)
    }

    /// Reads one of this module's files; the bytes are verified against their hash.
    pub fn get_file(&mut self, id: Uuid) -> CoreResult<(files::FileRef, Vec<u8>)> {
        self.require("files.own")?;
        let m = self.manifest.id.clone();
        files::get(self.ws, &m, id)
    }

    pub fn delete_file(&mut self, id: Uuid) -> CoreResult<()> {
        self.require("files.own")?;
        let m = self.manifest.id.clone();
        files::delete(self.ws, &m, id)
    }

    pub fn list_files(&mut self) -> CoreResult<Vec<files::FileRef>> {
        self.require("files.own")?;
        let m = self.manifest.id.clone();
        files::list(self.ws, &m)
    }

    /// Imports a versioned document (permission `files.own`): the bytes
    /// become version 1, the original, which is never changed (D-034).
    pub fn import_document(&mut self, name: &str, data: &[u8]) -> CoreResult<DocumentRef> {
        self.require("files.own")?;
        let m = self.manifest.id.clone();
        documents::import(self.ws, &m, name, data)
    }

    /// Saves new content as the next version; refused if `based_on` is not
    /// the current version (someone saved in the meantime).
    pub fn save_document(&mut self, id: Uuid, based_on: u64, data: &[u8], note: &str) -> CoreResult<VersionRef> {
        self.require("files.own")?;
        let m = self.manifest.id.clone();
        documents::save_version(self.ws, &m, id, based_on, data, note)
    }

    /// Reads a version (`None` = current); bytes verified against their hash.
    pub fn read_document(&mut self, id: Uuid, version: Option<u64>) -> CoreResult<(VersionRef, Vec<u8>)> {
        self.require("files.own")?;
        let m = self.manifest.id.clone();
        documents::read(self.ws, &m, id, version)
    }

    pub fn document_versions(&mut self, id: Uuid) -> CoreResult<Vec<VersionRef>> {
        self.require("files.own")?;
        let m = self.manifest.id.clone();
        documents::versions(self.ws, &m, id)
    }

    /// Creates a new version with the content of an older one.
    pub fn restore_document_version(&mut self, id: Uuid, version: u64) -> CoreResult<VersionRef> {
        self.require("files.own")?;
        let m = self.manifest.id.clone();
        documents::restore_version(self.ws, &m, id, version)
    }

    pub fn list_documents(&mut self) -> CoreResult<Vec<DocumentRef>> {
        self.require("files.own")?;
        let m = self.manifest.id.clone();
        documents::list(self.ws, &m)
    }

    pub fn delete_document(&mut self, id: Uuid) -> CoreResult<()> {
        self.require("files.own")?;
        let m = self.manifest.id.clone();
        documents::delete(self.ws, &m, id)
    }

    /// Writes a copy of a version to a path the user chose (export). The
    /// stored document is untouched; an existing file is replaced only with
    /// `overwrite`.
    pub fn export_document(
        &mut self,
        id: Uuid,
        version: Option<u64>,
        dest: &Path,
        overwrite: bool,
    ) -> CoreResult<VersionRef> {
        self.require("files.own")?;
        let m = self.manifest.id.clone();
        documents::export(self.ws, &m, id, version, dest, overwrite)
    }

    /// Writes a file the module produced (for example a conversion) to a
    /// path the user chose; an existing file is replaced only with `overwrite`.
    pub fn export_bytes(&mut self, dest: &Path, data: &[u8], overwrite: bool) -> CoreResult<()> {
        self.require("files.own")?;
        documents::export_bytes(dest, data, overwrite)
    }

    /// Structured log line tagged with the module id (no permission needed:
    /// modules must use the core log instead of their own, Master Plan §4.1).
    pub fn log(&self, message: &str) {
        tracing::info!(module = %self.manifest.id, "{message}");
    }
}
