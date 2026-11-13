//! Free music (8.19, D-098): plays an internet radio station found in Radio Browser.
//!
//! - Searching and playing happen only at the person's click, with „Setări › Internet” on and the directory
//!   switched on in „Surse externe”. The click is reported to the directory, as its rules ask.
//! - The station plays in a hidden window (`radio-<n>`) cut off from K.G.B.: every command from it is refused
//!   (the invoke filter in `main.rs`) and it uses an InPrivate profile of its own. The main window's
//!   content rules stay as they are. Only one station plays at a time; „Oprește” closes the window.

use std::sync::Mutex;

use kgb_core::radio::{self, Station};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub const LABEL: &str = "radio-";
const UA: &str = concat!("KGB/", env!("CARGO_PKG_VERSION"));

/// The stations of the last search: only these can be played.
static LAST: Mutex<Vec<Station>> = Mutex::new(Vec::new());
/// What plays now (name), for the page.
pub static PLAYING: Mutex<Option<Station>> = Mutex::new(None);
static OPENED: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

/// Tests only, from the environment (never from a page): the small server the e2e starts on 127.0.0.1.
fn servers() -> Vec<String> {
    match std::env::var("KGB_TEST_RADIO_BASE") {
        Ok(b) if b.starts_with("http://127.0.0.1:") => vec![b],
        _ => radio::SERVERS.iter().map(|s| s.to_string()).collect(),
    }
}

async fn get(path: &str) -> Result<String, String> {
    let mut last = String::from("catalogul de radiouri nu răspunde");
    for base in servers() {
        match kgb_net::web::get(&format!("{base}{path}"), UA, None).await {
            Ok(a) if a.status == 200 => return Ok(a.body),
            Ok(a) => last = format!("catalogul de radiouri a răspuns cu codul {}", a.status),
            Err(e) => last = e,
        }
    }
    Err(last)
}

pub async fn search(name: &str, country: &str) -> Result<Vec<Station>, String> {
    let path = radio::search_path(name, country).map_err(|e| e.to_string())?;
    // Only stations whose stream is a public https address can play here (D-098, `web_guard`).
    let v: Vec<Station> = radio::parse(&get(&path).await?)
        .map_err(|e| e.to_string())?
        .into_iter()
        .filter(|s| crate::web_guard::check(&s.url_resolved).is_ok())
        .collect();
    if let Ok(mut g) = LAST.lock() {
        *g = v.clone();
    }
    Ok(v)
}

pub fn stop(app: &AppHandle) {
    for (l, w) in app.webview_windows() {
        if l.starts_with(LABEL) {
            let _ = w.destroy();
        }
    }
    if let Ok(mut g) = PLAYING.lock() {
        *g = None;
    }
}

/// Sets the volume of the media element the browser makes for the stream (now and as soon as it exists).
fn volume_script(v: f64) -> String {
    format!(
        "(() => {{ if (window.top !== window) return; const set = () => {{ const m = document.querySelector('video, audio'); if (m) {{ m.volume = {v}; return true; }} return false; }}; if (!set()) {{ const t = setInterval(() => {{ if (set()) clearInterval(t); }}, 200); setTimeout(() => clearInterval(t), 10000); }} }})();"
    )
}

pub async fn play(app: &AppHandle, id: &str, volume: f64) -> Result<Station, String> {
    let st = LAST
        .lock()
        .ok()
        .and_then(|g| g.iter().find(|s| s.stationuuid == id).cloned())
        .ok_or("postul nu e în ultima căutare; caută din nou")?;
    crate::web_guard::check(&st.url_resolved)?;
    // The directory asks for every click to be reported; the answer is not needed.
    let _ = get(&format!("/json/url/{}", st.stationuuid)).await;
    stop(app);
    let n = OPENED.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    // The stream itself is opened: the browser plays an audio address on its own.
    let url = crate::web_guard::check(&st.url_resolved)?;
    let w = WebviewWindowBuilder::new(app, format!("{LABEL}{n}"), WebviewUrl::External(url))
        .title("K.G.B. — radio")
        .visible(false)
        .skip_taskbar(true)
        .inner_size(200.0, 100.0)
        .incognito(true)
        .initialization_script(volume_script(volume.clamp(0.0, 1.0)))
        // Only the stream (and its redirects to public https addresses).
        .on_navigation(|u| crate::web_guard::refuse(u).is_none())
        .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
        .on_download(|_, _| false)
        .build()
        .map_err(|e| format!("radioul nu a pornit: {e}"))?;
    crate::web_guard::deny_permissions(&w);
    if let Ok(mut g) = PLAYING.lock() {
        *g = Some(st.clone());
    }
    Ok(st)
}

pub fn volume(app: &AppHandle, v: f64) {
    let v = v.clamp(0.0, 1.0);
    for (l, w) in app.webview_windows() {
        if l.starts_with(LABEL) {
            let _ = w.eval(volume_script(v));
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn volume_is_a_number_in_the_script() {
        let s = super::volume_script(0.5);
        assert!(s.contains("m.volume = 0.5;"), "{s}");
    }
}
