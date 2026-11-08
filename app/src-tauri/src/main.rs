//! K.G.B. desktop app (Etapa 1). A thin command layer: every command locks the
//! session and delegates to `kgb-core`. The UI never touches files directly.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

mod net;
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
}

#[tauri::command]
fn get_settings(app: State<AppState>) -> CmdResult<SettingsReply> {
    with_session(&app, |s| {
        let l = settings::load(s.ws.store())?;
        Ok(SettingsReply {
            settings: l.settings,
            version: l.version,
            profiles: PROFILES.iter().map(|(id, name)| Profile { id, name }).collect(),
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
    let new = with_session(&app, |s| {
        let fp = s.device.fingerprint();
        s.mm.remind_for(&mut s.ws, Some(&fp), &azi)
    })?;
    desktop_notify(&handle, &new);
    Ok(new.len())
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
            source_save,
            source_set_active,
            source_delete,
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
