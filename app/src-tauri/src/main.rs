//! K.G.B. desktop app (Etapa 1). A thin command layer: every command locks the
//! session and delegates to `kgb-core`. The UI never touches files directly.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

mod external;
mod media;
mod net;
mod phone;
use std::time::Instant;

use kgb_core::identity::{self, DeviceIdentity};
use kgb_core::log::{self, LogConfig, LogHandle};
use kgb_core::modules::{self, Module, ModuleManager, ModuleView, PLANNED, PROFILES, Planned};
use kgb_core::notifications::{self, NotificationView};
use kgb_core::org::{self, Access};
use kgb_core::settings::{self, Settings};
use kgb_core::workspace::{self, Workspace};
use kgb_core::{CORE_VERSION, CoreError, profiles};
use kgb_core::{backup, files};
use kgb_core::{conflicts, invites, registry};
use serde::Serialize;
use serde_json::Value;
use tauri::{Manager, State};

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
/// Etapa 1 builds are pre-release: experimental modules are listed, labelled.
const PRE_RELEASE: bool = true;
const DEFAULT_WORKSPACE_NAME: &str = "Spațiul meu";
const DEFAULT_OWNER_NAME: &str = "Proprietar";

struct Session {
    ws: Workspace,
    mm: ModuleManager,
    device: DeviceIdentity,
}

struct AppState {
    session: net::SharedSession,
    /// The network (Etapa 6, step 6.5).
    net: Arc<net::NetSlot>,
    startup_error: Option<String>,
    root: PathBuf,
    log: Option<LogHandle>,
    ready_ms: u128,
}

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn builtin_modules() -> Vec<Box<dyn Module>> {
    vec![
        Box::new(kgb_notes::Notes::new()),
        Box::new(kgb_pdf::Pdf::new()),
        Box::new(kgb_sheets::Sheets::new()),
        Box::new(kgb_extract::Extract::new()),
        Box::new(kgb_planner::Planner::new()),
        Box::new(kgb_docs::Docs::new()),
        Box::new(kgb_business::Business::new()),
        Box::new(kgb_permits::Permits::new()),
        Box::new(kgb_team::Team::new()),
        Box::new(kgb_calc::Calc::new()),
    ]
}

fn known_profiles() -> Vec<&'static str> {
    modules::profile_ids()
}

/// Runs `f` with the open session, or explains why there is none.
fn with_session<T>(app: &State<AppState>, f: impl FnOnce(&mut Session) -> Result<T, CoreError>) -> CmdResult<T> {
    let mut guard = app
        .session
        .lock()
        .map_err(|_| "starea aplicației este blocată după o eroare".to_string())?;
    let s = guard.as_mut().ok_or_else(|| {
        app.startup_error
            .clone()
            .unwrap_or_else(|| "spațiul de lucru nu este deschis".into())
    })?;
    f(s).map_err(|e| {
        tracing::warn!("command failed: {e}");
        e.to_string()
    })
}

fn open_session(root: &Path) -> Result<Session, CoreError> {
    let device = DeviceIdentity::load_or_create(&root.join("device"))?;
    let (ws, created) = workspace::open_last_or_create_default(root, DEFAULT_WORKSPACE_NAME)?;
    session_for(root, ws, device, created)
}

/// Prepares an opened workspace: owner, this device, journal format upgrade
/// (with an automatic backup first), module manager.
fn session_for(root: &Path, mut ws: Workspace, device: DeviceIdentity, created: bool) -> Result<Session, CoreError> {
    if created || identity::owner(ws.store())?.is_none() {
        identity::set_owner(ws.store_mut(), DEFAULT_OWNER_NAME, 0)?;
    }
    let label = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Acest PC".into());
    identity::register_this_device(ws.store_mut(), &device, &label)?;
    backup::upgrade_format_if_needed(&mut ws, root)?;
    let mm = ModuleManager::new(builtin_modules(), CORE_VERSION)?.with_backup_root(root);
    tracing::info!(created, records = ws.recovery().records as u64, "workspace opened");
    Ok(Session { ws, mm, device })
}

/// Closes the current workspace and opens another one in its place.
/// If opening fails, the previous workspace is reopened.
fn switch_to(app: &State<AppState>, open: impl FnOnce(&Path) -> Result<Workspace, CoreError>) -> CmdResult<()> {
    let mut guard = app.session.lock().map_err(err)?;
    let old = guard.take().ok_or("spațiul de lucru nu este deschis")?;
    let previous_dir = old.ws.dir().to_path_buf();
    let device = old.device;
    drop(old.ws); // releases the workspace lock
    let opened = open(&app.root).and_then(|ws| {
        let mut reg = workspace::Registry::load(&app.root)?;
        reg.remember(&ws);
        reg.save(&app.root)?;
        Ok(ws)
    });
    match opened {
        Ok(ws) => {
            *guard = Some(session_for(&app.root, ws, device, false).map_err(err)?);
            Ok(())
        }
        Err(e) => {
            let back = Workspace::open(&previous_dir).map_err(err)?;
            *guard = Some(session_for(&app.root, back, device, false).map_err(err)?);
            Err(e.to_string())
        }
    }
}

// ---------- data, backups, maintenance ----------

#[derive(Serialize)]
struct DataInfo {
    format: u32,
    disk_bytes: u64,
    leftover_bytes: u64,
    backups: Vec<BackupView>,
    workspaces: Vec<workspace::KnownWorkspace>,
    current: String,
}

#[derive(Serialize)]
struct BackupView {
    /// Folder name; the only handle the UI gets (never a free path).
    id: String,
    meta: backup::BackupMeta,
}

fn folder_name(p: &Path) -> String {
    p.file_name().unwrap_or_default().to_string_lossy().to_string()
}

#[tauri::command]
fn data_info(app: State<AppState>) -> CmdResult<DataInfo> {
    let root = app.root.clone();
    with_session(&app, |s| {
        let backups = backup::list(&root, s.ws.manifest().id)?
            .into_iter()
            .map(|b| BackupView {
                id: folder_name(&b.dir),
                meta: b.meta,
            })
            .collect();
        Ok(DataInfo {
            format: s.ws.store().format(),
            disk_bytes: s.ws.store().disk_bytes()?,
            leftover_bytes: s.ws.store().leftover_bytes()?,
            backups,
            workspaces: workspace::Registry::load(&root)?.workspaces,
            current: s.ws.manifest().id.to_string(),
        })
    })
}

/// Resolves a backup id coming from the UI to a folder inside this
/// workspace's backup directory, refusing anything else.
fn backup_dir(root: &Path, s: &Session, id: &str) -> Result<PathBuf, CoreError> {
    let unsafe_id = id.is_empty() || id.starts_with('.') || id.contains("..") || id.contains(['/', '\\', ':']);
    if unsafe_id {
        return Err(CoreError::invalid("backupul", "identificator invalid"));
    }
    let dir = backup::backups_dir(root, s.ws.manifest().id).join(id);
    if !dir.is_dir() {
        return Err(CoreError::invalid("backupul", "nu există"));
    }
    Ok(dir)
}

#[tauri::command]
fn create_backup(app: State<AppState>) -> CmdResult<String> {
    let root = app.root.clone();
    with_session(&app, |s| {
        let b = backup::create(&mut s.ws, &root, backup::Reason::Manual, "")?;
        Ok(folder_name(&b.dir))
    })
}

#[tauri::command]
fn verify_backup(app: State<AppState>, id: String) -> CmdResult<usize> {
    let root = app.root.clone();
    with_session(&app, |s| Ok(backup::verify(&backup_dir(&root, s, &id)?)?.records))
}

/// Restores a backup as a new workspace and switches to it (D-030).
#[tauri::command]
fn restore_backup(app: State<AppState>, id: String) -> CmdResult<()> {
    let root = app.root.clone();
    let dir = with_session(&app, |s| backup_dir(&root, s, &id))?;
    net::stop(&app.net);
    let r = switch_to(&app, |root| backup::restore(&dir, root));
    let _ = net::ensure(&app.net, &app.session, false);
    r
}

#[tauri::command]
fn open_workspace(app: State<AppState>, id: String) -> CmdResult<()> {
    let reg = workspace::Registry::load(&app.root).map_err(err)?;
    let k = reg
        .workspaces
        .iter()
        .find(|w| w.id.to_string() == id)
        .cloned()
        .ok_or("spațiul de lucru nu există")?;
    net::stop(&app.net);
    let r = switch_to(&app, |_| Workspace::open(&k.dir));
    let _ = net::ensure(&app.net, &app.session, false);
    r
}

#[derive(Serialize)]
struct CompactView {
    steps: usize,
    bytes_freed: u64,
    ms: u128,
}

/// Incremental compaction until nothing is worth rewriting (or 5 s passed).
/// The lock is released between steps.
#[tauri::command]
fn compact_now(app: State<AppState>) -> CmdResult<CompactView> {
    let t0 = std::time::Instant::now();
    let mut v = CompactView {
        steps: 0,
        bytes_freed: 0,
        ms: 0,
    };
    while t0.elapsed().as_secs() < 5 {
        match with_session(&app, |s| Ok(s.ws.store_mut().compact_step(0.3)?))? {
            Some(r) => {
                v.steps += 1;
                v.bytes_freed += r.bytes_before.saturating_sub(r.bytes_after);
            }
            None => break,
        }
    }
    v.ms = t0.elapsed().as_millis();
    Ok(v)
}

#[tauri::command]
fn collect_files(app: State<AppState>) -> CmdResult<files::CollectReport> {
    with_session(&app, |s| files::collect_unreferenced(&mut s.ws))
}

/// Permanently removes quarantine, retired generations and orphan segments.
/// The UI asks for confirmation and recommends a backup first.
#[tauri::command]
fn purge_leftovers(app: State<AppState>) -> CmdResult<kgb_store::PurgeReport> {
    with_session(&app, |s| Ok(s.ws.store_mut().purge_leftovers()?))
}

// ---------- app info ----------

#[derive(Serialize)]
struct WorkspaceInfo {
    id: String,
    name: String,
    dir: String,
}

#[derive(Serialize)]
struct Recovery {
    records: usize,
    open_ms: u128,
    note: Option<String>,
}

#[derive(Serialize)]
struct AppInfo {
    app_version: &'static str,
    core_version: &'static str,
    pre_release: bool,
    startup_error: Option<String>,
    workspace: Option<WorkspaceInfo>,
    owner: Option<identity::Owner>,
    device_fingerprint: Option<String>,
    recovery: Option<Recovery>,
    ready_ms: u128,
    log_dir: String,
}

#[tauri::command]
fn app_info(app: State<AppState>) -> CmdResult<AppInfo> {
    let guard = app.session.lock().map_err(err)?;
    let mut info = AppInfo {
        app_version: APP_VERSION,
        core_version: CORE_VERSION,
        pre_release: PRE_RELEASE,
        startup_error: app.startup_error.clone(),
        workspace: None,
        owner: None,
        device_fingerprint: None,
        recovery: None,
        ready_ms: app.ready_ms,
        log_dir: app.root.join("logs").display().to_string(),
    };
    if let Some(s) = guard.as_ref() {
        let m = s.ws.manifest();
        info.workspace = Some(WorkspaceInfo {
            id: m.id.to_string(),
            name: m.name.clone(),
            dir: s.ws.dir().display().to_string(),
        });
        info.owner = identity::owner(s.ws.store()).map_err(err)?;
        info.device_fingerprint = Some(s.device.fingerprint());
        let r = s.ws.recovery();
        let note = r.torn_tail.as_ref().map(|t| {
            format!(
                "{} octeți incompleți de la ultima oprire au fost mutați în carantină",
                t.bytes
            )
        });
        info.recovery = Some(Recovery {
            records: r.records,
            open_ms: r.open_ms,
            note,
        });
    }
    Ok(info)
}

// ---------- settings ----------

#[derive(Serialize)]
struct Profile {
    id: &'static str,
    name: &'static str,
}

#[derive(Serialize)]
struct SettingsReply {
    settings: Settings,
    version: u64,
    profiles: Vec<Profile>,
    /// The start page for this person's role (step 7.4d): the one used until
    /// they arrange their own, and what „Revino la implicit” brings back.
    home_implicit: settings::Home,
}

/// Owner, administrators and a single user get the money-first start page;
/// the other roles get their day first.
fn home_for_role(s: &Session) -> Result<settings::Home, CoreError> {
    let admin = match org::current(s.ws.store(), &s.device.fingerprint())? {
        Some(c) => c.role.admin,
        None => true,
    };
    Ok(if admin { settings::Home::for_admin() } else { settings::Home::for_staff() })
}

#[tauri::command]
fn get_settings(app: State<AppState>) -> CmdResult<SettingsReply> {
    with_session(&app, |s| {
        let mut l = settings::load(s.ws.store())?;
        let home_implicit = home_for_role(s)?;
        if l.version == 0 {
            l.settings.home = home_implicit.clone();
        }
        Ok(SettingsReply {
            settings: l.settings,
            version: l.version,
            profiles: PROFILES.iter().map(|(id, name)| Profile { id, name }).collect(),
            home_implicit,
        })
    })
}

#[tauri::command]
fn save_settings(app: State<AppState>, settings: Settings, version: u64) -> CmdResult<u64> {
    with_session(&app, |s| {
        settings::save(s.ws.store_mut(), &settings, version, &known_profiles())
    })
}

#[tauri::command]
fn rename_owner(app: State<AppState>, name: String, version: u64) -> CmdResult<u64> {
    with_session(&app, |s| identity::set_owner(s.ws.store_mut(), &name, version))
}

#[tauri::command]
fn rename_workspace(app: State<AppState>, name: String) -> CmdResult<()> {
    let root = app.root.clone();
    with_session(&app, |s| {
        s.ws.rename(&name)?;
        let mut reg = workspace::Registry::load(&root)?;
        reg.remember(&s.ws);
        reg.save(&root)
    })
}

// ---------- modules ----------

#[derive(Serialize)]
struct ModulesReply {
    modules: Vec<ModuleView>,
    planned: &'static [Planned],
    /// Ids hidden in the active profile.
    hidden: Vec<String>,
    /// What the person on this PC may do per module (D-056); every module
    /// has "scriere" when there is no organization.
    access: std::collections::BTreeMap<String, Access>,
    /// Whether the person on this PC manages modules and the organization.
    admin: bool,
}

#[tauri::command]
fn list_modules(app: State<AppState>) -> CmdResult<ModulesReply> {
    with_session(&app, |s| {
        let profile = settings::load(s.ws.store())?.settings.profile;
        let fp = s.device.fingerprint();
        let modules = s.mm.list(&s.ws, PRE_RELEASE)?;
        let mut access = std::collections::BTreeMap::new();
        for m in &modules {
            access.insert(m.id.clone(), org::access(s.ws.store(), Some(&fp), &m.id)?.0);
        }
        Ok(ModulesReply {
            modules,
            planned: PLANNED,
            hidden: profiles::hidden(s.ws.store(), &profile)?.into_iter().collect(),
            access,
            admin: org::require_admin(s.ws.store(), Some(&fp), "").is_ok(),
        })
    })
}

#[tauri::command]
fn enable_module(app: State<AppState>, id: String, grant: Vec<String>) -> CmdResult<()> {
    with_session(&app, |s| {
        org::require_admin(s.ws.store(), Some(&s.device.fingerprint()), "activarea modulelor")?;
        s.mm.enable(&mut s.ws, &id, &grant)
    })
}

#[tauri::command]
fn disable_module(app: State<AppState>, id: String) -> CmdResult<()> {
    with_session(&app, |s| {
        org::require_admin(s.ws.store(), Some(&s.device.fingerprint()), "dezactivarea modulelor")?;
        s.mm.disable(&mut s.ws, &id)
    })
}

#[tauri::command]
fn set_module_visible(app: State<AppState>, id: String, visible: bool) -> CmdResult<()> {
    with_session(&app, |s| {
        let profile = settings::load(s.ws.store())?.settings.profile;
        profiles::set_visible(s.ws.store_mut(), &profile, &id, visible)
    })
}

#[tauri::command]
fn module_call(app: State<AppState>, id: String, command: String, args: Value) -> CmdResult<Value> {
    with_session(&app, |s| {
        let fp = s.device.fingerprint();
        s.mm.call(&mut s.ws, Some(&fp), &id, &command, args)
    })
}

// ---------- organization (Etapa 6, step 6.1, D-056) ----------

#[derive(Serialize)]
struct OrgReply {
    organization: Option<org::Organization>,
    /// The person on this PC (None without an organization).
    current: Option<org::Current>,
    roles: Vec<org::Role>,
    members: Vec<org::Member>,
    /// Modules a role can be given access to: (id, name).
    modules: Vec<(String, String)>,
    fingerprint: String,
    owner_name: Option<String>,
    /// Invitations (administrators only; never the codes).
    invites: Vec<invites::InviteView>,
    /// Devices waiting for approval.
    pending: Vec<invites::Pending>,
    /// Differences between the tables and the signed registry (empty = fine).
    registry_problems: Vec<String>,
}

/// This PC's name, used as the device name in requests and the registry.
fn device_label() -> String {
    std::env::var("COMPUTERNAME")
        .ok()
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| "PC".into())
}

#[tauri::command]
fn org_info(app: State<AppState>) -> CmdResult<OrgReply> {
    with_session(&app, |s| {
        let fp = s.device.fingerprint();
        Ok(OrgReply {
            organization: org::organization(s.ws.store())?,
            current: org::current(s.ws.store(), &fp)?,
            roles: org::roles(s.ws.store())?,
            members: org::members(s.ws.store(), false)?,
            modules: s
                .mm
                .list(&s.ws, PRE_RELEASE)?
                .into_iter()
                .map(|m| (m.id, m.name))
                .collect(),
            fingerprint: fp,
            owner_name: identity::owner(s.ws.store())?.map(|o| o.display_name),
            invites: invites::list(s.ws.store())?,
            pending: invites::pending(s.ws.store())?,
            registry_problems: registry::consistency(s.ws.store())?,
        })
    })
}

#[tauri::command]
fn org_create(app: State<AppState>, name: String, admin: String) -> CmdResult<()> {
    with_session(&app, |s| {
        org::create(s.ws.store_mut(), &name, &admin, &s.device, &device_label())?;
        modules::audit(&mut s.ws, "core.org", "creare organizație", "ok", &name)
    })?;
    // The organization needs the network: start it now (step 6.5).
    let _ = net::ensure(&app.net, &app.session, false);
    Ok(())
}

/// Runs an organization change after checking that the person on this PC is
/// an administrator; every change is written to the audit journal.
fn org_admin<T>(
    app: &State<AppState>,
    what: &str,
    f: impl FnOnce(&mut Session, &str) -> Result<T, CoreError>,
) -> CmdResult<T> {
    with_session(app, |s| {
        let fp = s.device.fingerprint();
        org::require_admin(s.ws.store(), Some(&fp), "organizația")?;
        let r = f(s, &fp)?;
        modules::audit(&mut s.ws, "core.org", what, "ok", "")?;
        Ok(r)
    })
}

#[tauri::command]
fn org_rename(app: State<AppState>, name: String, version: u64) -> CmdResult<u64> {
    org_admin(&app, "redenumire organizație", |s, _| {
        org::rename(s.ws.store_mut(), &s.device, &name, version)
    })
}

#[tauri::command]
fn org_member_add(app: State<AppState>, name: String, role: uuid::Uuid) -> CmdResult<uuid::Uuid> {
    org_admin(&app, "persoană adăugată", |s, _| {
        org::add_member(s.ws.store_mut(), &s.device, &name, role)
    })
}

#[tauri::command]
fn org_member_update(
    app: State<AppState>,
    id: uuid::Uuid,
    name: String,
    role: uuid::Uuid,
    version: u64,
) -> CmdResult<u64> {
    org_admin(&app, "persoană modificată", |s, _| {
        org::update_member(s.ws.store_mut(), &s.device, id, &name, role, version)
    })
}

#[tauri::command]
fn org_member_remove(app: State<AppState>, id: uuid::Uuid, version: u64) -> CmdResult<()> {
    org_admin(&app, "persoană scoasă", |s, _| {
        org::remove_member(s.ws.store_mut(), &s.device, id, version)
    })
}

#[tauri::command]
fn org_role_save(app: State<AppState>, role: org::RoleInput) -> CmdResult<uuid::Uuid> {
    org_admin(&app, "rol salvat", |s, _| {
        let known: Vec<String> = s.mm.list(&s.ws, PRE_RELEASE)?.into_iter().map(|m| m.id).collect();
        org::save_role(s.ws.store_mut(), &s.device, role, &known)
    })
}

#[tauri::command]
fn org_role_delete(app: State<AppState>, id: uuid::Uuid) -> CmdResult<()> {
    org_admin(&app, "rol șters", |s, _| {
        org::delete_role(s.ws.store_mut(), &s.device, id)
    })
}

/// Revokes another device of the organization (step 6.7, D-060).
#[tauri::command]
fn org_device_revoke(app: State<AppState>, fingerprint: String) -> CmdResult<()> {
    org_admin(&app, "dispozitiv revocat", |s, _| {
        org::revoke_device(s.ws.store_mut(), &s.device, &fingerprint)
    })
}

// ---------- external sources and licences (Etapa 7, step 7.1, D-062) ----------

#[derive(Serialize)]
struct SourcesReply {
    items: Vec<kgb_core::sources::Source>,
    kinds: &'static [(&'static str, &'static str)],
    /// Whether the person on this PC may change the register.
    poate_modifica: bool,
}

#[tauri::command]
fn sources_list(app: State<AppState>) -> CmdResult<SourcesReply> {
    with_session(&app, |s| {
        // ANAF (step 7.4b) is added filled in but switched off; only an
        // administrator's PC adds it (the register is theirs).
        // So are BNR and MET Norway (step 7.4e).
        if org::require_admin(s.ws.store(), Some(&s.device.fingerprint()), "").is_ok() {
            if kgb_core::anaf::source(s.ws.store())?.is_none() {
                kgb_core::anaf::ensure_source(s.ws.store_mut())?;
                modules::audit(&mut s.ws, "core.sources", "sursa ANAF adăugată (oprită)", "ok", "")?;
            }
            if kgb_core::fx::source(s.ws.store())?.is_none() {
                kgb_core::fx::ensure_source(s.ws.store_mut())?;
                modules::audit(&mut s.ws, "core.sources", "sursa BNR adăugată (oprită)", "ok", "")?;
            }
            if kgb_core::weather::source(s.ws.store())?.is_none() {
                kgb_core::weather::ensure_source(s.ws.store_mut())?;
                modules::audit(&mut s.ws, "core.sources", "sursa MET Norway adăugată (oprită)", "ok", "")?;
            }
        }
        Ok(SourcesReply {
            items: kgb_core::sources::list(s.ws.store())?,
            kinds: kgb_core::sources::KINDS,
            poate_modifica: org::require_admin(s.ws.store(), Some(&s.device.fingerprint()), "").is_ok(),
        })
    })
}

/// The register changes only by an administrator (or the single user
/// without an organization); every change is audited.
fn sources_admin<T>(
    app: &State<AppState>,
    what: &str,
    f: impl FnOnce(&mut Session) -> Result<T, CoreError>,
) -> CmdResult<T> {
    with_session(app, |s| {
        org::require_admin(s.ws.store(), Some(&s.device.fingerprint()), "registrul de surse")?;
        let r = f(s)?;
        modules::audit(&mut s.ws, "core.sources", what, "ok", "")?;
        Ok(r)
    })
}

#[tauri::command]
fn source_save(app: State<AppState>, source: kgb_core::sources::SourceInput) -> CmdResult<uuid::Uuid> {
    sources_admin(&app, "sursă salvată", |s| {
        kgb_core::sources::save(s.ws.store_mut(), source)
    })
}

#[tauri::command]
fn source_set_active(app: State<AppState>, id: uuid::Uuid, active: bool) -> CmdResult<()> {
    sources_admin(&app, if active { "sursă activată" } else { "sursă oprită" }, |s| {
        let fp = s.device.fingerprint();
        let by = match org::current(s.ws.store(), &fp)? {
            Some(c) => c.member.name,
            None => identity::owner(s.ws.store())?
                .map(|o| o.display_name)
                .unwrap_or_default(),
        };
        kgb_core::sources::set_active(s.ws.store_mut(), id, active, &by)
    })
}

#[tauri::command]
fn source_delete(app: State<AppState>, id: uuid::Uuid) -> CmdResult<()> {
    sources_admin(&app, "sursă ștearsă", |s| {
        kgb_core::sources::delete(s.ws.store_mut(), id)
    })
}

// ---------- partner directory (Etapa 7, step 7.4a, D-066) ----------

/// Who may change the shared partner directory: everyone without an
/// organization; in one, a person whose role can write somewhere.
fn partners_writable(store: &kgb_store::Store, fp: &str) -> Result<bool, CoreError> {
    if org::organization(store)?.is_none() {
        return Ok(true);
    }
    Ok(org::current(store, fp)?.is_some_and(|c| {
        c.role.admin || c.role.default == Access::Scriere || c.role.modules.values().any(|a| *a == Access::Scriere)
    }))
}

fn partners_readable(store: &kgb_store::Store, fp: &str) -> Result<bool, CoreError> {
    Ok(org::organization(store)?.is_none() || org::current(store, fp)?.is_some())
}

#[derive(Serialize)]
struct PartnersReply {
    items: Vec<kgb_core::partners::Partner>,
    poate_modifica: bool,
    expira: Vec<kgb_core::partners::Expiring>,
}

#[tauri::command]
fn partners_list(app: State<AppState>, cauta: String, inactivi: bool, azi: String) -> CmdResult<PartnersReply> {
    with_session(&app, |s| {
        let fp = s.device.fingerprint();
        if !partners_readable(s.ws.store(), &fp)? {
            return Err(CoreError::invalid("agenda de parteneri", "acest PC nu aparține nimănui din organizație"));
        }
        let items = if cauta.trim().is_empty() {
            kgb_core::partners::list(s.ws.store(), inactivi)?
        } else {
            kgb_core::partners::search(s.ws.store(), &cauta, 200)?
        };
        Ok(PartnersReply {
            items,
            poate_modifica: partners_writable(s.ws.store(), &fp)?,
            expira: kgb_core::partners::expiring(s.ws.store(), &azi, 60).unwrap_or_default(),
        })
    })
}

#[tauri::command]
fn partner_save(app: State<AppState>, partner: kgb_core::partners::Partner) -> CmdResult<uuid::Uuid> {
    with_session(&app, |s| {
        if !partners_writable(s.ws.store(), &s.device.fingerprint())? {
            return Err(CoreError::invalid("agenda de parteneri", "rolul tău nu poate modifica agenda"));
        }
        let name = partner.denumire.clone();
        let id = kgb_core::partners::save(s.ws.store_mut(), partner)?;
        modules::audit(&mut s.ws, kgb_core::partners::PARTNERS_SOURCE, "fișă salvată", "ok", &name)?;
        Ok(id)
    })
}

/// Keeps what a form had (a document, a Business partner) in the directory
/// for next time (step 7.4c); never overwrites a card's values. Nothing is
/// kept (`None`) when the person's role cannot change the directory.
#[tauri::command]
fn partner_remember(
    app: State<AppState>,
    partner: kgb_core::partners::Partner,
    sursa: String,
    azi: String,
) -> CmdResult<Option<kgb_core::partners::Remembered>> {
    with_session(&app, |s| {
        if !partners_writable(s.ws.store(), &s.device.fingerprint())? {
            return Ok(None);
        }
        let sursa = if ["document", "business"].contains(&sursa.as_str()) { sursa } else { "manual".into() };
        let r = kgb_core::partners::remember(s.ws.store_mut(), partner, &sursa, &azi)?;
        if r.noua || !r.completate.is_empty() {
            modules::audit(&mut s.ws, "core.partners", "fișă completată dintr-un formular", "ok", "")?;
        }
        Ok(Some(r))
    })
}

/// The partner import model (step 7.4j): an XLSX with the columns and one example row.
#[tauri::command]
fn partners_import_model(dest: String) -> CmdResult<()> {
    let head: Vec<String> = kgb_core::partners::IMPORT_COLUMNS.iter().map(|c| c.to_string()).collect();
    let mut example = vec![String::new(); head.len()];
    for (i, v) in ["Exemplu Client SRL", "client", "RO14399840", "J12/345/2001", "Str. Exemplu 1", "Cluj-Napoca", "Cluj", "România", "0264 000 000", "office@exemplu.ro"]
        .iter()
        .enumerate()
    {
        example[i] = v.to_string();
    }
    let mut extra = head.clone();
    extra.push("Licență transport".into());
    let mut ex2 = example.clone();
    ex2.push("LT-1234".into());
    let bytes = kgb_sheets::convert::text_table_xlsx("Parteneri", &[extra, ex2]).map_err(|e| format!("modelul nu s-a putut face: {e}"))?;
    std::fs::write(&dest, bytes).map_err(|e| format!("nu s-a putut salva: {e}"))?;
    Ok(())
}

/// Imports partners from an XLSX/XLS/ODS/CSV file (step 7.4j).
#[tauri::command]
fn partners_import(app: State<AppState>, path: String, azi: String) -> CmdResult<kgb_core::partners::ImportReport> {
    let data = std::fs::read(&path).map_err(|e| format!("fișierul nu se poate citi: {e}"))?;
    if data.len() > 20 * 1024 * 1024 {
        return Err("fișierul e prea mare (cel mult 20 MB)".into());
    }
    let name = std::path::Path::new(&path).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let rows = kgb_sheets::convert::first_sheet_rows(&data, &name)?;
    with_session(&app, |s| {
        if !partners_writable(s.ws.store(), &s.device.fingerprint())? {
            return Err(CoreError::invalid("agenda de parteneri", "rolul tău nu poate modifica agenda"));
        }
        let r = kgb_core::partners::import_rows(s.ws.store_mut(), &rows, &azi)?;
        modules::audit(&mut s.ws, "core.partners", "import parteneri", "ok", &format!("{} noi, {} completați, {} erori", r.adaugate, r.completate, r.erori.len()))?;
        Ok(r)
    })
}

#[tauri::command]
fn partner_set_active(app: State<AppState>, id: uuid::Uuid, active: bool) -> CmdResult<()> {
    with_session(&app, |s| {
        if !partners_writable(s.ws.store(), &s.device.fingerprint())? {
            return Err(CoreError::invalid("agenda de parteneri", "rolul tău nu poate modifica agenda"));
        }
        kgb_core::partners::set_active(s.ws.store_mut(), id, active)
    })
}

// ---------- conflicts (Etapa 6, step 6.4) ----------

#[derive(Serialize)]
struct ConflictsReply {
    items: Vec<conflicts::ConflictView>,
    /// Module names, to show "Note" instead of "kgb.notes".
    modules: Vec<(String, String)>,
}

#[tauri::command]
fn conflicts_list(app: State<AppState>) -> CmdResult<ConflictsReply> {
    with_session(&app, |s| {
        let fp = s.device.fingerprint();
        Ok(ConflictsReply {
            items: conflicts::list(&s.ws, Some(&fp))?,
            modules: s
                .mm
                .list(&s.ws, PRE_RELEASE)?
                .into_iter()
                .map(|m| (m.id, m.name))
                .collect(),
        })
    })
}

#[tauri::command]
fn conflict_decide(app: State<AppState>, id: uuid::Uuid, keep_here: bool) -> CmdResult<()> {
    with_session(&app, |s| {
        let fp = s.device.fingerprint();
        conflicts::decide(&mut s.ws, Some(&fp), id, keep_here)
    })
}

// ---------- invitations (Etapa 6, step 6.2, D-058) ----------

#[tauri::command]
fn invite_create(app: State<AppState>, member: uuid::Uuid, hours: u64) -> CmdResult<invites::NewInvite> {
    // The invitation carries this PC's address, for the new PC's first
    // synchronisation (none if the network could not start).
    let addr = net::ensure(&app.net, &app.session, false).ok().flatten();
    org_admin(&app, "invitație creată", |s, _| {
        invites::create_from(s.ws.store_mut(), &s.device, member, hours, addr.as_deref())
    })
}

#[tauri::command]
fn invite_cancel(app: State<AppState>, id: uuid::Uuid) -> CmdResult<()> {
    org_admin(&app, "invitație anulată", |s, _| {
        invites::cancel(s.ws.store_mut(), &s.device, id)
    })
}

/// On the new PC: checks an invitation and makes the signed request.
#[tauri::command]
fn invite_answer(app: State<AppState>, code: String) -> CmdResult<invites::JoinRequest> {
    // The new PC starts its network to tell the administrator where it is.
    let addr = net::ensure(&app.net, &app.session, true).ok().flatten();
    with_session(&app, |s| {
        invites::request_from(s.ws.store_mut(), &code, &s.device, &device_label(), addr.as_deref())
    })
}

// ---------- network (Etapa 6, step 6.5) ----------

#[derive(Serialize)]
struct NetStatus {
    pornita: bool,
    /// Why it is not running, if it is not.
    motiv: Option<String>,
    relay: String,
    port: u16,
    /// This device's key fingerprint.
    amprenta: String,
    peers: Vec<kgb_core::peers::PeerView>,
    ultima_runda_ms: Option<u64>,
    /// Attached files known here whose content has not arrived yet (6.8).
    fisiere_lipsa: usize,
    /// Every device of the organization, this PC and revoked ones too (6.9).
    dispozitive: Vec<kgb_core::peers::DeviceRow>,
    /// Open synchronisation conflicts this person may see.
    conflicte: usize,
}

#[tauri::command]
fn net_status(app: State<AppState>) -> CmdResult<NetStatus> {
    let running = app.net.running.lock().ok().and_then(|g| g.clone());
    let motiv = app.net.why_not.lock().ok().and_then(|w| w.clone());
    let last = app.net.last.lock().ok().and_then(|l| l.as_ref().map(|(t, _)| *t));
    with_session(&app, |s| {
        let (relay, port) = kgb_core::peers::network_settings(s.ws.store())?;
        Ok(NetStatus {
            pornita: running.is_some(),
            motiv: if running.is_some() { None } else { motiv },
            relay,
            port,
            amprenta: s.device.fingerprint(),
            peers: kgb_core::peers::list(s.ws.store(), &s.device.public_hex())?,
            ultima_runda_ms: last,
            fisiere_lipsa: kgb_core::blobs::missing(s.ws.store())?.len(),
            dispozitive: kgb_core::peers::all_devices(s.ws.store(), &s.device.public_hex())?,
            conflicte: conflicts::list(&s.ws, Some(&s.device.fingerprint()))?.len(),
        })
    })
}

/// Changes the relay ("off", "n0" for tests, or an https:// URL) and
/// restarts the network.
#[tauri::command]
fn net_set_relay(app: State<AppState>, relay: String) -> CmdResult<()> {
    with_session(&app, |s| {
        let (_, port) = kgb_core::peers::network_settings(s.ws.store())?;
        kgb_core::peers::save_network_settings(s.ws.store_mut(), &relay, port)?;
        modules::audit(&mut s.ws, "core.sync", "relay schimbat", "ok", &relay)
    })?;
    net::stop(&app.net);
    net::ensure(&app.net, &app.session, false).map(|_| ())
}

#[derive(Serialize)]
struct RatesReply {
    curs: kgb_core::fx::Day,
    sursa: &'static str,
}

/// EUR/RON and USD/RON for the start page (step 7.4e), only with the BNR source on.
#[tauri::command]
async fn fx_rates(app: State<'_, AppState>) -> CmdResult<RatesReply> {
    with_session(&app, |s| kgb_core::fx::usable(s.ws.store()).map(|_| ()))?;
    Ok(RatesReply { curs: external::rates().await?, sursa: kgb_core::fx::BNR_CREDIT })
}

#[derive(Serialize)]
struct WeatherReply {
    vreme: kgb_core::weather::Today,
    sursa: &'static str,
}

/// Today's weather in the town chosen on the start page, only with the MET Norway source on.
#[tauri::command]
async fn weather_today(app: State<'_, AppState>, azi: String, offset_min: i64) -> CmdResult<WeatherReply> {
    let town = with_session(&app, |s| {
        kgb_core::weather::usable(s.ws.store())?;
        Ok(settings::load(s.ws.store())?.settings.home.vreme)
    })?;
    if town.is_empty() {
        return Err("alege orașul".into());
    }
    Ok(WeatherReply { vreme: external::today(&town, &azi, offset_min).await?, sursa: kgb_core::weather::MET_CREDIT })
}

/// The towns the weather panel offers: (key, name).
#[tauri::command]
fn weather_towns() -> Vec<(&'static str, &'static str)> {
    kgb_core::weather::TOWNS.iter().map(|t| (t.0, t.1)).collect()
}

/// The player shown in Windows' media controls (step 7.4e), off the window's thread.
#[tauri::command]
async fn media_now() -> CmdResult<Option<media::NowPlaying>> {
    tauri::async_runtime::spawn_blocking(media::now).await.map_err(err)?
}

/// Play/pause, next or previous on that player.
#[tauri::command]
async fn media_control(action: String) -> CmdResult<bool> {
    tauri::async_runtime::spawn_blocking(move || media::control(&action)).await.map_err(err)?
}

/// When the last ANAF request left (the service allows one per second).
static ANAF_LAST: std::sync::Mutex<Option<std::time::Instant>> = std::sync::Mutex::new(None);

/// Company data by CUI from ANAF (step 7.4b), only while the ANAF source is
/// switched on. Only the CUI and the day are sent.
#[tauri::command]
async fn anaf_lookup(app: State<'_, AppState>, cui: String, azi: String) -> CmdResult<kgb_core::anaf::Company> {
    let body = with_session(&app, |s| {
        kgb_core::anaf::usable(s.ws.store())?;
        kgb_core::anaf::request_body(&[cui.trim()], azi.trim())
    })?;
    // At most one request per second, from this PC.
    let wait = {
        let mut last = ANAF_LAST.lock().map_err(|_| "starea aplicației este blocată".to_string())?;
        let now = std::time::Instant::now();
        let gap = std::time::Duration::from_millis(kgb_core::anaf::MIN_INTERVAL_MS);
        let wait = last.map(|t| gap.saturating_sub(now.duration_since(t))).unwrap_or_default();
        *last = Some(now + wait);
        wait
    };
    if !wait.is_zero() {
        std::thread::sleep(wait);
    }
    let (status, answer) = kgb_net::web::post_json(kgb_core::anaf::ANAF_URL, body).await.map_err(|e| format!("ANAF: {e}; completează de mână"))?;
    let audit = |what: &str, outcome: &str| {
        let _ = with_session(&app, |s| modules::audit(&mut s.ws, "core.sources", what, outcome, ""));
    };
    if status != 200 {
        audit("căutare ANAF", "eroare");
        return Err(format!("ANAF: serviciul a răspuns cu codul HTTP {status}; încearcă mai târziu sau completează de mână"));
    }
    let (found, _) = kgb_core::anaf::parse(&answer).map_err(|e| e.to_string())?;
    audit("căutare ANAF după CUI", "ok");
    found
        .into_iter()
        .next()
        .ok_or_else(|| format!("ANAF: CUI-ul {} nu a fost găsit", cui.trim()))
}

/// One synchronisation round now, off the window's thread.
#[tauri::command]
async fn sync_now(app: State<'_, AppState>) -> CmdResult<Vec<kgb_net::sync::Outcome>> {
    let slot = app.net.clone();
    let session = app.session.clone();
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let r = net::ensure(&slot, &session, false).and_then(|_| net::round(&slot));
        let _ = tx.send(r);
    });
    tauri::async_runtime::spawn_blocking(move || rx.recv().unwrap_or_else(|_| Err("sincronizarea s-a oprit".into())))
        .await
        .map_err(err)?
}

#[tauri::command]
fn request_receive(app: State<AppState>, code: String) -> CmdResult<invites::Pending> {
    org_admin(&app, "cerere de dispozitiv primită", |s, _| {
        invites::receive(s.ws.store_mut(), &s.device, &code)
    })
}

#[tauri::command]
fn request_approve(app: State<AppState>, id: uuid::Uuid) -> CmdResult<()> {
    org_admin(&app, "dispozitiv aprobat", |s, _| {
        invites::approve(s.ws.store_mut(), &s.device, id)
    })
}

#[tauri::command]
fn request_refuse(app: State<AppState>, id: uuid::Uuid) -> CmdResult<()> {
    org_admin(&app, "dispozitiv refuzat", |s, _| {
        invites::refuse(s.ws.store_mut(), &s.device, id)
    })
}

#[derive(Serialize)]
struct NotificationsReply {
    items: Vec<NotificationView>,
    unread: usize,
}

/// The notification centre (D-043): newest first, at most 100 shown.
#[tauri::command]
fn notifications_list(app: State<AppState>) -> CmdResult<NotificationsReply> {
    with_session(&app, |s| {
        Ok(NotificationsReply {
            items: notifications::list(&s.ws, false, 100)?,
            unread: notifications::unread_count(&s.ws)?,
        })
    })
}

/// Reminders round (step 4.5, D-044): the page calls this about once a minute
/// with the user's local date. New reminders also go to Windows as desktop
/// notifications — only while the app runs; Windows' own settings (Focus
/// assist / „Nu deranja”) still decide whether they pop up.
#[tauri::command]
fn reminders_tick(app: State<AppState>, handle: tauri::AppHandle, azi: String) -> CmdResult<usize> {
    let root = app.root.clone();
    let new = with_session(&app, |s| {
        // The daily backup (step 7.4j): once a day while K.G.B. runs; the last 14 are kept.
        if let Err(e) = backup::daily_if_due(&mut s.ws, &root, &azi) {
            tracing::warn!("daily backup failed: {e}");
        }
        let fp = s.device.fingerprint();
        let before: std::collections::BTreeSet<uuid::Uuid> =
            notifications::list(&s.ws, false, usize::MAX)?.into_iter().map(|n| n.id).collect();
        // Partner documents that expire (D-066), for people who can see the directory.
        if partners_readable(s.ws.store(), &fp)? {
            kgb_core::partners::remind(&mut s.ws, &azi)?;
        }
        // Team messages from the other PCs (step 7.4f).
        kgb_core::chat::notify(&mut s.ws, &fp)?;
        // "K.G.B. is open on this PC", at most every 10 minutes, in an organization (7.4h).
        if let Some(c) = org::current(s.ws.store(), &fp)? {
            kgb_core::presence::beat(s.ws.store_mut(), &fp, &c.member.id.to_string(), &c.member.name)?;
        }
        let mut new = s.mm.remind_for(&mut s.ws, Some(&fp), &azi)?;
        let known: std::collections::BTreeSet<uuid::Uuid> = new.iter().map(|n| n.id).collect();
        for n in notifications::list(&s.ws, false, usize::MAX)? {
            if !before.contains(&n.id) && !known.contains(&n.id) {
                new.push(n);
            }
        }
        Ok(new)
    })?;
    desktop_notify(&handle, &new);
    Ok(new.len())
}

// ---------- „Echipa pe scurt” (Etapa 7, step 7.4h; D-064) ----------

#[derive(Serialize)]
struct TeamReply {
    /// Administrators see every card; the others only their own.
    admin: bool,
    carduri: Vec<kgb_core::presence::Card>,
    eu: Option<kgb_core::presence::Card>,
    culori: &'static [&'static str],
    organizatie: bool,
}

#[tauri::command]
fn team_overview(app: State<AppState>) -> CmdResult<TeamReply> {
    with_session(&app, |s| {
        let fp = s.device.fingerprint();
        let organizatie = org::organization(s.ws.store())?.is_some();
        let admin = organizatie && org::require_admin(s.ws.store(), Some(&fp), "").is_ok();
        Ok(TeamReply {
            admin,
            carduri: if admin { kgb_core::presence::all(s.ws.store())? } else { vec![] },
            eu: kgb_core::presence::mine(s.ws.store(), &fp)?,
            culori: kgb_core::presence::COLORS,
            organizatie,
        })
    })
}

/// What the member writes about themselves („la ce lucrez”, colour).
#[tauri::command]
fn team_set_mine(app: State<AppState>, lucrez: String, culoare: String) -> CmdResult<()> {
    with_session(&app, |s| {
        let fp = s.device.fingerprint();
        let Some(c) = org::current(s.ws.store(), &fp)? else {
            return Err(CoreError::invalid("echipa", "acest PC nu e într-o organizație"));
        };
        kgb_core::presence::set_mine(s.ws.store_mut(), &fp, &c.member.id.to_string(), &c.member.name, &lucrez, &culoare)
    })
}

// ---------- the phone page (Etapa 7, step 7.4m; D-068) ----------

#[derive(Serialize)]
struct PhoneReply {
    pornit: bool,
    adresa: Option<String>,
    /// The pairing code and the seconds it is still valid.
    cod: Option<(String, u64)>,
    telefoane: Vec<kgb_core::phones::Phone>,
    primite: Vec<Value>,
    /// Only administrators start the page and approve phones.
    admin: bool,
    /// Who may be chosen as a phone's user: the organization's members, or the owner.
    persoane: Vec<String>,
}

fn phone_admin(s: &Session) -> Result<(), CoreError> {
    org::require_admin(s.ws.store(), Some(&s.device.fingerprint()), "pagina de telefon")
}

#[tauri::command]
fn phone_status(app: State<AppState>) -> CmdResult<PhoneReply> {
    with_session(&app, |s| {
        let persoane = if org::organization(s.ws.store())?.is_some() {
            org::members(s.ws.store(), false)?.into_iter().filter(|m| m.active).map(|m| m.name).collect()
        } else {
            vec![my_name(s)?]
        };
        Ok(PhoneReply {
            pornit: phone::address().is_some(),
            adresa: phone::address(),
            cod: phone::current_code(),
            telefoane: kgb_core::phones::list(&s.ws)?,
            primite: kgb_core::phones::inbox(&s.ws)?,
            admin: phone_admin(s).is_ok(),
            persoane,
        })
    })
}

#[tauri::command]
fn phone_start(app: State<AppState>) -> CmdResult<String> {
    with_session(&app, |s| {
        phone_admin(s)?;
        modules::audit(&mut s.ws, "core.phones", "pagina de telefon pornită", "ok", "")
    })?;
    let a = phone::start(app.session.clone())?;
    phone::new_code();
    Ok(a)
}

#[tauri::command]
fn phone_stop(app: State<AppState>) -> CmdResult<()> {
    with_session(&app, |s| {
        phone_admin(s)?;
        modules::audit(&mut s.ws, "core.phones", "pagina de telefon oprită", "ok", "")
    })?;
    phone::stop();
    Ok(())
}

#[tauri::command]
fn phone_new_code(app: State<AppState>) -> CmdResult<String> {
    with_session(&app, |s| phone_admin(s))?;
    Ok(phone::new_code())
}

#[tauri::command]
fn phone_approve(app: State<AppState>, id: uuid::Uuid, membru: String) -> CmdResult<()> {
    with_session(&app, |s| {
        phone_admin(s)?;
        kgb_core::phones::approve(&mut s.ws, id, &membru)?;
        modules::audit(&mut s.ws, "core.phones", "telefon aprobat", "ok", &membru)
    })
}

#[tauri::command]
fn phone_revoke(app: State<AppState>, id: uuid::Uuid) -> CmdResult<()> {
    with_session(&app, |s| {
        phone_admin(s)?;
        kgb_core::phones::revoke(&mut s.ws, id)?;
        modules::audit(&mut s.ws, "core.phones", "telefon scos", "ok", "")
    })
}

#[tauri::command]
fn phone_done(app: State<AppState>, id: uuid::Uuid, gata: bool) -> CmdResult<()> {
    with_session(&app, |s| kgb_core::phones::mark_done(&mut s.ws, id, gata))
}

#[derive(Serialize)]
struct PhoneFile {
    nume: String,
    data: String,
}

/// A photo or file received from a phone (base64, to show or save).
#[tauri::command]
fn phone_file(app: State<AppState>, id: uuid::Uuid) -> CmdResult<PhoneFile> {
    use base64::Engine as _;
    with_session(&app, |s| {
        let (nume, bytes) = kgb_core::phones::file(&s.ws, id)?;
        Ok(PhoneFile { nume, data: base64::engine::general_purpose::STANDARD.encode(bytes) })
    })
}

/// A bank statement received from a phone, imported into Business (the
/// person on this PC needs the right to write in Business).
#[tauri::command]
fn phone_import_statement(app: State<AppState>, id: uuid::Uuid, fisier: uuid::Uuid, cont: uuid::Uuid) -> CmdResult<Value> {
    use base64::Engine as _;
    with_session(&app, |s| {
        let (nume, bytes) = kgb_core::phones::file(&s.ws, fisier)?;
        let fp = s.device.fingerprint();
        let r = s.mm.call(
            &mut s.ws,
            Some(&fp),
            "kgb.business",
            "bank_import",
            serde_json::json!({"cont": cont, "name": nume, "data": base64::engine::general_purpose::STANDARD.encode(bytes)}),
        )?;
        kgb_core::phones::mark_done(&mut s.ws, id, true)?;
        Ok(r)
    })
}

// ---------- team messages (Etapa 7, step 7.4f) ----------

/// The name messages from this PC are signed with: the member's name in an
/// organization, the owner's name otherwise.
fn my_name(s: &Session) -> Result<String, CoreError> {
    if let Some(c) = org::current(s.ws.store(), &s.device.fingerprint())? {
        return Ok(c.member.name);
    }
    Ok(identity::owner(s.ws.store())?.map(|o| o.display_name).unwrap_or_else(|| "Proprietar".into()))
}

#[derive(Serialize)]
struct ChatReply {
    mesaje: Vec<kgb_core::chat::Message>,
    /// This PC's fingerprint: messages written here are shown as "eu".
    eu: String,
    nume: String,
    /// Whether this PC is in an organization (otherwise nobody else sees the messages).
    organizatie: bool,
}

#[tauri::command]
fn chat_list(app: State<AppState>) -> CmdResult<ChatReply> {
    with_session(&app, |s| {
        Ok(ChatReply {
            mesaje: kgb_core::chat::list(s.ws.store(), 300)?,
            eu: s.device.fingerprint(),
            nume: my_name(s)?,
            organizatie: org::organization(s.ws.store())?.is_some(),
        })
    })
}

#[tauri::command]
fn chat_send(app: State<AppState>, text: String) -> CmdResult<uuid::Uuid> {
    with_session(&app, |s| {
        let name = my_name(s)?;
        kgb_core::chat::send(&mut s.ws, &name, &s.device.fingerprint(), &text)
    })
}

/// A voice message recorded in the window (base64 of the recording).
#[tauri::command]
fn chat_send_voice(app: State<AppState>, data: String, mime: String, durata_ms: u64) -> CmdResult<uuid::Uuid> {
    use base64::Engine as _;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data.as_bytes())
        .map_err(|_| "înregistrarea nu a ajuns întreagă".to_string())?;
    with_session(&app, |s| {
        let name = my_name(s)?;
        kgb_core::chat::send_voice(&mut s.ws, &name, &s.device.fingerprint(), &bytes, &mime, durata_ms)
    })
}

#[derive(Serialize)]
struct VoiceReply {
    mime: String,
    data: String,
}

/// The recording of a voice message, or None while it is still on its way.
#[tauri::command]
fn chat_voice(app: State<AppState>, id: uuid::Uuid) -> CmdResult<Option<VoiceReply>> {
    use base64::Engine as _;
    with_session(&app, |s| {
        Ok(kgb_core::chat::voice(&s.ws, id)?.map(|(mime, bytes)| VoiceReply {
            mime,
            data: base64::engine::general_purpose::STANDARD.encode(bytes),
        }))
    })
}

#[tauri::command]
fn chat_delete(app: State<AppState>, id: uuid::Uuid) -> CmdResult<()> {
    with_session(&app, |s| {
        let fp = s.device.fingerprint();
        kgb_core::chat::delete(&mut s.ws, &fp, id)
    })
}

/// At most 3 separate pop-ups; more become one summary (no burst on screen).
fn desktop_notify(handle: &tauri::AppHandle, new: &[NotificationView]) {
    use tauri_plugin_notification::NotificationExt as _;
    let show = |title: &str, body: &str| {
        if let Err(e) = handle.notification().builder().title(title).body(body).show() {
            tracing::warn!("desktop notification failed: {e}");
        }
    };
    if new.len() <= 3 {
        for n in new {
            show(&n.titlu, &n.text);
        }
    } else {
        let first: Vec<&str> = new.iter().take(3).map(|n| n.titlu.as_str()).collect();
        show(
            &format!("K.G.B.: {} memento-uri noi", new.len()),
            &format!(
                "{} … Deschide clopoțelul din aplicație pentru toate.",
                first.join(" · ")
            ),
        );
    }
}

#[tauri::command]
fn notification_read(app: State<AppState>, id: uuid::Uuid) -> CmdResult<()> {
    with_session(&app, |s| notifications::mark_read(&mut s.ws, id))
}

#[tauri::command]
fn notifications_read_all(app: State<AppState>) -> CmdResult<usize> {
    with_session(&app, |s| notifications::mark_all_read(&mut s.ws))
}

#[tauri::command]
fn notifications_clear_read(app: State<AppState>) -> CmdResult<usize> {
    with_session(&app, |s| notifications::clear_read(&mut s.ws))
}

/// Reads a file the user picked in the system dialog and hands it to the
/// module's `import` command (name + base64 contents). The module never gets
/// file system access itself; the size limit is the core's (64 MB).
#[tauri::command]
fn module_import_file(app: State<AppState>, id: String, path: PathBuf) -> CmdResult<Value> {
    module_import_file_with(app, id, path, "import".into(), Value::Object(Default::default()))
}

/// Like `module_import_file`, for a module command other than `import`, with
/// extra arguments (e.g. the bank account a statement goes into). The file's
/// name and contents are added as `name` and `data`.
#[tauri::command]
fn module_import_file_with(
    app: State<AppState>,
    id: String,
    path: PathBuf,
    command: String,
    args: Value,
) -> CmdResult<Value> {
    use base64::Engine as _;
    let meta = std::fs::metadata(&path).map_err(err)?;
    if meta.len() > kgb_core::files::MAX_FILE_BYTES as u64 {
        return Err(format!(
            "fișierul are {} MB; limita este {} MB",
            meta.len() >> 20,
            kgb_core::files::MAX_FILE_BYTES >> 20
        ));
    }
    let data = std::fs::read(&path).map_err(err)?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let mut args = match args {
        Value::Object(m) => m,
        _ => return Err("argumentele trebuie să fie un obiect".into()),
    };
    args.insert("name".into(), Value::String(name));
    args.insert(
        "data".into(),
        Value::String(base64::engine::general_purpose::STANDARD.encode(&data)),
    );
    with_session(&app, |s| {
        let fp = s.device.fingerprint();
        s.mm.call(&mut s.ws, Some(&fp), &id, &command, Value::Object(args))
    })
}

// ---------- diagnostics ----------

#[derive(Serialize)]
struct Diagnostics {
    report: String,
    audit: Vec<serde_json::Map<String, Value>>,
    memory_mb: f64,
}

fn report(app: &State<AppState>, s: Option<&Session>) -> String {
    let mut sections = vec![("Pornire până la gata (ms)", app.ready_ms.to_string())];
    sections.push(("Memorie proces principal (MB)", format!("{:.1}", working_set_mb())));
    if let Some(e) = &app.startup_error {
        sections.push(("Eroare la pornire", e.clone()));
    }
    if let Some(s) = s {
        let r = s.ws.recovery();
        sections.push(("Spațiu de lucru", s.ws.dir().display().to_string()));
        sections.push(("Înregistrări la deschidere", r.records.to_string()));
        sections.push(("Deschidere stocare (ms)", r.open_ms.to_string()));
        sections.push((
            "Recuperare",
            r.torn_tail
                .as_ref()
                .map_or("nimic de reparat".into(), |t| t.reason.clone()),
        ));
        sections.push(("Amprentă dispozitiv", s.device.fingerprint()));
    }
    if let Some(l) = &app.log {
        l.flush();
    }
    log::diagnostic_report(APP_VERSION, &sections, &app.root.join("logs"))
}

#[tauri::command]
fn diagnostics(app: State<AppState>) -> CmdResult<Diagnostics> {
    let guard = app.session.lock().map_err(err)?;
    let audit = match guard.as_ref() {
        Some(s) => modules::audit_log(&s.ws, 30).map_err(err)?,
        None => Vec::new(),
    };
    Ok(Diagnostics {
        report: report(&app, guard.as_ref()),
        audit,
        memory_mb: working_set_mb(),
    })
}

/// Saves the diagnostic report to `<root>/diagnostics/` and returns the path.
#[tauri::command]
fn export_diagnostics(app: State<AppState>) -> CmdResult<String> {
    let text = {
        let guard = app.session.lock().map_err(err)?;
        report(&app, guard.as_ref())
    };
    let dir = app.root.join("diagnostics");
    std::fs::create_dir_all(&dir).map_err(err)?;
    let name = format!("diagnostic-{}.txt", log::utc_now().replace([':', '.'], "-"));
    let path = dir.join(name);
    std::fs::write(&path, text).map_err(err)?;
    tracing::info!("diagnostic report exported");
    Ok(path.display().to_string())
}

#[cfg(windows)]
fn working_set_mb() -> f64 {
    use windows_sys::Win32::System::ProcessStatus::{K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
    use windows_sys::Win32::System::Threading::GetCurrentProcess;
    // SAFETY: plain FFI call with a correctly sized, zeroed out-struct.
    unsafe {
        let mut c: PROCESS_MEMORY_COUNTERS = std::mem::zeroed();
        c.cb = size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
        if K32GetProcessMemoryInfo(GetCurrentProcess(), &mut c, c.cb) == 0 {
            return -1.0;
        }
        c.WorkingSetSize as f64 / (1024.0 * 1024.0)
    }
}

#[cfg(not(windows))]
fn working_set_mb() -> f64 {
    -1.0
}

fn main() {
    let t0 = Instant::now();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(move |app| {
            // KGB_DATA_DIR lets automated tests use a throw-away folder instead
            // of the user's real data (%LOCALAPPDATA%\ro.kronos.kgb).
            let root = match std::env::var_os("KGB_DATA_DIR") {
                Some(d) => PathBuf::from(d),
                None => app.path().app_local_data_dir()?,
            };
            let log = log::init(&root.join("logs"), LogConfig::default()).ok();
            tracing::info!(version = APP_VERSION, "K.G.B. starting");
            let (session, startup_error) = match open_session(&root) {
                Ok(s) => (Some(s), None),
                Err(e) => {
                    tracing::error!("startup failed: {e}");
                    (None, Some(e.to_string()))
                }
            };
            let session = Arc::new(Mutex::new(session));
            let slot = Arc::new(net::NetSlot::default());
            net::background(slot.clone(), session.clone());
            app.manage(AppState {
                session,
                net: slot,
                startup_error,
                root,
                log,
                ready_ms: t0.elapsed().as_millis(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            get_settings,
            save_settings,
            rename_owner,
            rename_workspace,
            list_modules,
            enable_module,
            disable_module,
            set_module_visible,
            module_call,
            org_info,
            org_create,
            org_rename,
            org_member_add,
            org_member_update,
            org_member_remove,
            org_role_save,
            org_role_delete,
            org_device_revoke,
            sources_list,
            anaf_lookup,
            media_now,
            phone_status,
            phone_start,
            phone_stop,
            phone_new_code,
            phone_approve,
            phone_revoke,
            phone_done,
            phone_file,
            phone_import_statement,
            team_overview,
            team_set_mine,
            chat_list,
            chat_send,
            chat_send_voice,
            chat_voice,
            chat_delete,
            fx_rates,
            weather_today,
            weather_towns,
            media_control,
            source_save,
            source_set_active,
            source_delete,
            partners_list,
            partner_save,
            partner_set_active,
            partner_remember,
            partners_import_model,
            partners_import,
            conflicts_list,
            net_status,
            net_set_relay,
            sync_now,
            conflict_decide,
            invite_create,
            invite_cancel,
            invite_answer,
            request_receive,
            request_approve,
            request_refuse,
            module_import_file,
            module_import_file_with,
            notifications_list,
            reminders_tick,
            notification_read,
            notifications_read_all,
            notifications_clear_read,
            diagnostics,
            export_diagnostics,
            data_info,
            create_backup,
            verify_backup,
            restore_backup,
            open_workspace,
            compact_now,
            collect_files,
            purge_leftovers
        ])
        .run(tauri::generate_context!())
        .expect("K.G.B. could not start the window");
}
