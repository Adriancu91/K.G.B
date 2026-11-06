//! K.G.B. Etapa 0 spike S3: a Tauri 2 window whose UI reads and writes through the
//! S1 store. PROTOTYPE — measures build, installer size, startup and memory.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use kgb_store_spike::{Fields, Options, RecordState, Store, Write};
use serde::Serialize;
use serde_json::Value;
use tauri::{Manager, State};
use uuid::Uuid;

const NOTES: &str = "notes";

struct App {
    store: Mutex<Store>,
    main_to_ready_ms: u128,
}

#[derive(Serialize)]
struct Note {
    id: Uuid,
    version: u64,
    text: String,
    created_ms: u64,
}

impl Note {
    fn from_state(r: &RecordState) -> Note {
        Note {
            id: r.id,
            version: r.version,
            text: r.fields.get("text").and_then(Value::as_str).unwrap_or_default().to_string(),
            created_ms: r.fields.get("created_ms").and_then(Value::as_u64).unwrap_or_default(),
        }
    }
}

#[derive(Serialize)]
struct Status {
    store_dir: String,
    records: usize,
    open_ms: u128,
    frames: u64,
    torn_tail: Option<String>,
    process_start_to_ready_ms: u128,
    working_set_mb: f64,
}

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command]
fn status(app: State<App>) -> CmdResult<Status> {
    let store = app.store.lock().map_err(err)?;
    let rep = store.recovery_report();
    Ok(Status {
        store_dir: store.dir().display().to_string(),
        records: store.count(NOTES),
        open_ms: rep.open_ms,
        frames: rep.frames,
        torn_tail: rep
            .torn_tail
            .as_ref()
            .map(|t| format!("{} octeți mutați în carantină: {}", t.bytes, t.saved_to.display())),
        process_start_to_ready_ms: app.main_to_ready_ms,
        working_set_mb: working_set_mb(),
    })
}

#[tauri::command]
fn list_notes(app: State<App>) -> CmdResult<Vec<Note>> {
    let store = app.store.lock().map_err(err)?;
    let mut notes: Vec<Note> = store.scan(NOTES, |_| true).map_err(err)?.iter().map(Note::from_state).collect();
    notes.sort_by_key(|n| std::cmp::Reverse(n.created_ms));
    Ok(notes)
}

#[tauri::command]
fn add_note(app: State<App>, text: String) -> CmdResult<Note> {
    let text = text.trim();
    if text.is_empty() || text.len() > 10_000 {
        return Err("textul trebuie să aibă între 1 și 10.000 de caractere".into());
    }
    let created_ms = SystemTime::now().duration_since(UNIX_EPOCH).map_err(err)?.as_millis() as u64;
    let mut fields = Fields::new();
    fields.insert("text".into(), text.into());
    fields.insert("created_ms".into(), created_ms.into());
    let id = Uuid::now_v7();
    let mut store = app.store.lock().map_err(err)?;
    store.write(vec![Write::put(NOTES, id, fields).expect(0)]).map_err(err)?;
    let saved = store.get(NOTES, id).map_err(err)?.ok_or("nota nu a fost găsită după salvare")?;
    Ok(Note::from_state(&saved))
}

#[tauri::command]
fn delete_note(app: State<App>, id: Uuid, version: u64) -> CmdResult<()> {
    let mut store = app.store.lock().map_err(err)?;
    store.write(vec![Write::delete(NOTES, id).expect(version)]).map_err(err)?;
    Ok(())
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
            let dir = app.path().app_local_data_dir()?.join("workspace");
            let store = Store::open(&dir, Options::default())?;
            app.manage(App {
                store: Mutex::new(store),
                main_to_ready_ms: t0.elapsed().as_millis(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![status, list_notes, add_note, delete_note])
        .run(tauri::generate_context!())
        .expect("error while running the S3 prototype");
}
