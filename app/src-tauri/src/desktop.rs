//! K.G.B. always available on the PC that serves phones (step 7.4m-3,
//! asked by the owner):
//! - an icon next to the clock (tray) with „Deschide K.G.B.” and „Ieșire”;
//! - closing the window keeps K.G.B. running there (can be switched off);
//! - start with Windows, off by default, switched on from Settings by the
//!   person using the PC (an entry in their own user's „Run” list, the way
//!   any program does it; nothing system-wide, no administrator rights);
//! - one K.G.B. per data folder: opening it again shows the running one.
//!
//! The preferences of this PC stay in a small file next to the data
//! (`desktop.json`), not in the workspace: they belong to the PC.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// The argument used when Windows starts K.G.B.: start next to the clock,
/// without opening the window.
pub const HIDDEN_ARG: &str = "--langa-ceas";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Prefs {
    /// Closing the window keeps K.G.B. running next to the clock.
    #[serde(default = "yes")]
    pub langa_ceas: bool,
    /// The language of the window on this PC: "ro" or "en" (7.4l-0f). Kept here, not in the
    /// WebView's storage, which reaches the disk only some time later and is shared by every
    /// K.G.B. on the computer.
    #[serde(default = "ro")]
    pub limba: String,
}

fn yes() -> bool {
    true
}

fn ro() -> String {
    "ro".into()
}

impl Default for Prefs {
    fn default() -> Self {
        Prefs {
            langa_ceas: true,
            limba: ro(),
        }
    }
}

fn prefs_path(root: &Path) -> PathBuf {
    root.join("desktop.json")
}

pub fn load(root: &Path) -> Prefs {
    std::fs::read(prefs_path(root))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

pub fn save(root: &Path, p: &Prefs) -> Result<(), String> {
    let tmp = prefs_path(root).with_extension("json.tmp");
    std::fs::write(&tmp, serde_json::to_vec_pretty(p).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, prefs_path(root)).map_err(|e| e.to_string())
}

/// The name of the entry in the user's „Run” list. Automated tests (with
/// their own data folder) use another name, so they never touch the real one.
fn run_value() -> &'static str {
    if std::env::var_os("KGB_DATA_DIR").is_some() {
        "K.G.B. (test)"
    } else {
        "K.G.B."
    }
}

#[cfg(windows)]
mod reg {
    use windows_sys::Win32::Foundation::ERROR_SUCCESS;
    use windows_sys::Win32::System::Registry::{
        HKEY_CURRENT_USER, REG_SZ, RRF_RT_REG_SZ, RegDeleteKeyValueW, RegGetValueW, RegSetKeyValueW,
    };

    const RUN: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn get(name: &str) -> Option<String> {
        let (key, val) = (wide(RUN), wide(name));
        let mut buf = vec![0u16; 1024];
        let mut len = (buf.len() * 2) as u32;
        // SAFETY: the buffers live for the call; `len` is their size in bytes.
        let r = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                key.as_ptr(),
                val.as_ptr(),
                RRF_RT_REG_SZ,
                std::ptr::null_mut(),
                buf.as_mut_ptr().cast(),
                &mut len,
            )
        };
        if r != ERROR_SUCCESS {
            return None;
        }
        let n = (len as usize / 2).saturating_sub(1);
        Some(String::from_utf16_lossy(&buf[..n.min(buf.len())]))
    }

    pub fn set(name: &str, command: &str) -> Result<(), String> {
        let (key, val, data) = (wide(RUN), wide(name), wide(command));
        // SAFETY: as above; the data is a NUL-terminated UTF-16 string.
        let r = unsafe {
            RegSetKeyValueW(
                HKEY_CURRENT_USER,
                key.as_ptr(),
                val.as_ptr(),
                REG_SZ,
                data.as_ptr().cast(),
                (data.len() * 2) as u32,
            )
        };
        if r == ERROR_SUCCESS {
            Ok(())
        } else {
            Err(format!("Windows a refuzat (cod {r})"))
        }
    }

    pub fn delete(name: &str) -> Result<(), String> {
        let (key, val) = (wide(RUN), wide(name));
        // SAFETY: as above.
        let r = unsafe { RegDeleteKeyValueW(HKEY_CURRENT_USER, key.as_ptr(), val.as_ptr()) };
        // Already missing is fine.
        if r == ERROR_SUCCESS || r == 2 {
            Ok(())
        } else {
            Err(format!("Windows a refuzat (cod {r})"))
        }
    }
}

#[cfg(not(windows))]
mod reg {
    pub fn get(_: &str) -> Option<String> {
        None
    }
    pub fn set(_: &str, _: &str) -> Result<(), String> {
        Err("doar pe Windows".into())
    }
    pub fn delete(_: &str) -> Result<(), String> {
        Ok(())
    }
}

fn command() -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok(format!("\"{}\" {HIDDEN_ARG}", exe.display()))
}

/// Whether K.G.B. starts with Windows (this program, for this user).
pub fn autostart() -> bool {
    reg::get(run_value()).is_some()
}

pub fn set_autostart(on: bool) -> Result<(), String> {
    if on {
        reg::set(run_value(), &command()?)
    } else {
        reg::delete(run_value())
    }
}

/// The command written in the „Run” list (for the test and diagnostics).
pub fn autostart_command() -> Option<String> {
    reg::get(run_value())
}

/// Started by Windows (next to the clock, window closed)?
pub fn started_hidden() -> bool {
    std::env::args().any(|a| a == HIDDEN_ARG)
}

/// One K.G.B. per data folder. Returns false if one is already running (it
/// was asked to show its window); otherwise calls `show` whenever another
/// start asks.
#[cfg(windows)]
pub fn single_instance(root: &Path, show: impl Fn() + Send + 'static) -> bool {
    use std::hash::{Hash, Hasher};
    use windows_sys::Win32::Foundation::{ERROR_ALREADY_EXISTS, GetLastError};
    use windows_sys::Win32::System::Threading::{CreateEventW, INFINITE, SetEvent, WaitForSingleObject};
    // Fixed keys: the same folder gives the same name in every start.
    let mut h = std::hash::DefaultHasher::new();
    root.to_string_lossy().to_lowercase().hash(&mut h);
    let name: Vec<u16> = format!("Local\\KGB-arata-{:016x}", h.finish())
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    // SAFETY: a named auto-reset event; the name lives for the call.
    let ev = unsafe { CreateEventW(std::ptr::null(), 0, 0, name.as_ptr()) };
    if ev.is_null() {
        return true; // cannot tell: let it start
    }
    // SAFETY: read right after the call that set it.
    if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
        // SAFETY: a valid handle from CreateEventW.
        unsafe { SetEvent(ev) };
        return false;
    }
    let ev = ev as usize;
    std::thread::Builder::new()
        .name("kgb-arata".into())
        .spawn(move || {
            loop {
                // SAFETY: the handle stays open for the life of the process.
                unsafe { WaitForSingleObject(ev as _, INFINITE) };
                show();
            }
        })
        .is_ok()
}

#[cfg(not(windows))]
pub fn single_instance(_: &Path, _: impl Fn() + Send + 'static) -> bool {
    true
}
