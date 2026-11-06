//! K.G.B. desktop app (Etapa 1). A thin command layer: every command locks the
//! session and delegates to `kgb-core`. The UI never touches files directly.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;

use kgb_core::identity::{self, DeviceIdentity};
use kgb_core::log::{self, LogConfig, LogHandle};
use kgb_core::modules::{self, Module, ModuleManager, ModuleView, PLANNED, PROFILES, Planned};
use kgb_core::settings::{self, Settings};
use kgb_core::workspace::{self, Workspace};
use kgb_core::{CORE_VERSION, CoreError, profiles};
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
    session: Mutex<Option<Session>>,
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
    vec![Box::new(kgb_notes::Notes::new())]
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
    let (mut ws, created) = workspace::open_last_or_create_default(root, DEFAULT_WORKSPACE_NAME)?;
    if created || identity::owner(ws.store())?.is_none() {
        identity::set_owner(ws.store_mut(), DEFAULT_OWNER_NAME, 0)?;
    }
    let label = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Acest PC".into());
    identity::register_this_device(ws.store_mut(), &device, &label)?;
    let mm = ModuleManager::new(builtin_modules(), CORE_VERSION)?;
    tracing::info!(created, records = ws.recovery().records as u64, "workspace opened");
    Ok(Session { ws, mm, device })
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
}

#[tauri::command]
fn list_modules(app: State<AppState>) -> CmdResult<ModulesReply> {
    with_session(&app, |s| {
        let profile = settings::load(s.ws.store())?.settings.profile;
        Ok(ModulesReply {
            modules: s.mm.list(&s.ws, PRE_RELEASE)?,
            planned: PLANNED,
            hidden: profiles::hidden(s.ws.store(), &profile)?.into_iter().collect(),
        })
    })
}

#[tauri::command]
fn enable_module(app: State<AppState>, id: String, grant: Vec<String>) -> CmdResult<()> {
    with_session(&app, |s| s.mm.enable(&mut s.ws, &id, &grant))
}

#[tauri::command]
fn disable_module(app: State<AppState>, id: String) -> CmdResult<()> {
    with_session(&app, |s| s.mm.disable(&mut s.ws, &id))
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
            app.manage(AppState {
                session: Mutex::new(session),
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
            diagnostics,
            export_diagnostics
        ])
        .run(tauri::generate_context!())
        .expect("K.G.B. could not start the window");
}
