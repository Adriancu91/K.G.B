//! Web clips (8.20, D-099): a small window with a web page, cut to the part the person chose and frozen there,
//! so a table of rates, a quote board or a news list is seen live without opening a browser.
//!
//! - Each clip is a separate window (`clip-<id>`) showing the page itself, like a browser would: nothing is read
//!   out of the page or saved by K.G.B., so there is no scraping.
//! - The window is cut off from K.G.B.: it is not in the `main` capability, every command from it is refused
//!   (see the invoke filter in `main.rs`), and it uses an InPrivate profile of its own, so the page's cookies and
//!   storage never mix with the app's and nothing stays on disk.
//! - The page is loaded only when the person opens the clip (with „Setări › Internet” on); it is reloaded on its
//!   own only if the person set an interval.
//! - Choosing the part: the window opens with the whole page; the person scrolls to the part and sizes the window
//!   around it, then „Îngheață” keeps the scroll position (reported by a small script through the page title,
//!   numbers only), the window's size and place and the zoom. Live, the page is held at that position with its
//!   scrollbars hidden. Clips are kept per PC (`ferestre-web.json`), since windows belong to this screen.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::webview::WebviewBuilder;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, PhysicalPosition, Url, WebviewUrl, WebviewWindowBuilder};

pub const LABEL: &str = "clip-";
const FILE: &str = "ferestre-web.json";
const MAX: usize = 30;
const TITLE_PREFIX: &str = "kgbclip:";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Clip {
    pub id: String,
    pub nume: String,
    pub url: String,
    /// Scroll position of the frozen part, in page pixels.
    #[serde(default)]
    pub x: i64,
    #[serde(default)]
    pub y: i64,
    /// Zoom of the page (1 = 100 %).
    #[serde(default = "one")]
    pub zoom: f64,
    /// Inner size of the window, logical pixels.
    #[serde(default = "w0")]
    pub latime: u32,
    #[serde(default = "h0")]
    pub inaltime: u32,
    /// Place of the window on the screen (physical pixels); none = let Windows choose.
    #[serde(default)]
    pub pozitie: Option<(i32, i32)>,
    #[serde(default)]
    pub deasupra: bool,
    /// Reload every this many minutes (0 = never; the page may update itself).
    #[serde(default)]
    pub reincarcare_min: u32,
    #[serde(default)]
    pub inghetata: bool,
}

fn one() -> f64 {
    1.0
}
fn w0() -> u32 {
    480
}
fn h0() -> u32 {
    320
}

/// Last scroll position each open clip reported (pick mode).
#[derive(Default)]
pub struct Positions(Mutex<HashMap<String, (i64, i64)>>);

fn path(root: &Path) -> PathBuf {
    root.join(FILE)
}

pub fn load(root: &Path) -> Vec<Clip> {
    std::fs::read(path(root))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn store(root: &Path, clips: &[Clip]) -> Result<(), String> {
    let tmp = root.join(format!("{FILE}.tmp"));
    let bytes = serde_json::to_vec_pretty(clips).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, bytes).map_err(|e| format!("ferestrele web nu s-au putut salva: {e}"))?;
    std::fs::rename(&tmp, path(root)).map_err(|e| format!("ferestrele web nu s-au putut salva: {e}"))
}

/// A web address the window may open: a public https page (D-099, rules in `web_guard`).
pub fn check_url(url: &str) -> Result<Url, String> {
    crate::web_guard::check(url)
}

/// A scroll position reported through the page title: `kgbclip:<x>,<y>`, numbers only, bounded.
pub fn parse_title(t: &str) -> Option<(i64, i64)> {
    let rest = t.strip_prefix(TITLE_PREFIX)?;
    let (a, b) = rest.split_once(',')?;
    let ok = |s: &str| s.len() <= 7 && !s.is_empty() && s.bytes().all(|c| c.is_ascii_digit());
    if !ok(a) || !ok(b) {
        return None;
    }
    Some((a.parse().ok()?, b.parse().ok()?))
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 32 && id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-')
}

pub fn save(root: &Path, mut c: Clip) -> Result<Clip, String> {
    let mut all = load(root);
    c.nume = c.nume.trim().chars().take(80).collect();
    if c.nume.is_empty() {
        return Err("dă un nume ferestrei".into());
    }
    c.url = check_url(&c.url)?.to_string();
    if !(0.25..=4.0).contains(&c.zoom) {
        c.zoom = 1.0;
    }
    c.latime = c.latime.clamp(120, 4000);
    c.inaltime = c.inaltime.clamp(80, 3000);
    c.x = c.x.clamp(0, 1_000_000);
    c.y = c.y.clamp(0, 1_000_000);
    c.reincarcare_min = c.reincarcare_min.min(24 * 60);
    if c.id.is_empty() {
        c.id = format!("{:x}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0));
    } else if !valid_id(&c.id) {
        return Err("fereastra nu există".into());
    }
    let n = all.len();
    match all.iter_mut().find(|x| x.id == c.id) {
        Some(x) => *x = c.clone(),
        None if n >= MAX => return Err(format!("cel mult {MAX} ferestre web")),
        None => all.push(c.clone()),
    }
    store(root, &all)?;
    Ok(c)
}

pub fn delete(app: &AppHandle, root: &Path, id: &str) -> Result<(), String> {
    close(app, id);
    unembed(app, id);
    let mut all = load(root);
    all.retain(|x| x.id != id);
    store(root, &all)
}

/// Every opening gets a new label (`clip-<id>-<n>`): a window being destroyed may still hold the old one.
static OPENED: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

fn new_label(id: &str) -> String {
    let n = OPENED.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    format!("{LABEL}{id}-{n}")
}

fn clip_of(label: &str) -> Option<&str> {
    label.strip_prefix(LABEL).and_then(|r| r.rsplit_once('-')).map(|(id, _)| id)
}

fn window(app: &AppHandle, id: &str) -> Option<tauri::WebviewWindow> {
    app.webview_windows().into_iter().find(|(l, _)| clip_of(l) == Some(id)).map(|(_, w)| w)
}

pub fn close(app: &AppHandle, id: &str) {
    while let Some(w) = window(app, id) {
        if w.destroy().is_err() {
            break;
        }
    }
}

/// The script put in the page (main frame only). Pick mode reports the scroll position through the title; live
/// mode holds the page at the frozen position with the scrollbars hidden and reloads it if the person asked.
fn script(c: &Clip, pick: bool) -> String {
    let cfg = format!("{{x:{},y:{},reload:{}}}", c.x, c.y, if pick { 0 } else { c.reincarcare_min });
    let body = if pick {
        r#"let first = true;
  const rep = () => { document.title = "kgbclip:" + Math.max(0, Math.round(window.scrollX)) + "," + Math.max(0, Math.round(window.scrollY)); };
  window.addEventListener("load", () => { if (first) { first = false; window.scrollTo(C.x, C.y); } rep(); setInterval(rep, 400); });
  window.addEventListener("scroll", rep, { passive: true });"#
    } else {
        r#"const css = "html,body{overflow:hidden!important;scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}";
  const hold = () => {
    try {
      if (!document.getElementById("kgb-clip-css") && document.head) {
        const s = document.createElement("style"); s.id = "kgb-clip-css"; s.textContent = css; document.head.appendChild(s);
      }
      if (Math.round(window.scrollX) !== C.x || Math.round(window.scrollY) !== C.y) window.scrollTo(C.x, C.y);
    } catch (e) {}
  };
  document.addEventListener("DOMContentLoaded", hold);
  window.addEventListener("load", () => { hold(); setInterval(hold, 1000); });
  window.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  window.addEventListener("keydown", (e) => {
    const t = (e.target && e.target.tagName) || "";
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", " "].includes(e.key) && !/INPUT|TEXTAREA|SELECT/.test(t)) e.preventDefault();
  }, true);
  if (C.reload > 0) setTimeout(() => location.reload(), C.reload * 60000);"#
    };
    format!("(() => {{\n  if (window.top !== window) return;\n  const C = {cfg};\n  {body}\n}})();")
}

/// The page a web window shows, once it has loaded the first time.
type Shown = std::sync::Arc<Mutex<Option<Url>>>;

/// After the page has loaded once, a click on a link does not move the frozen page: the link opens in the
/// computer's browser. Before that, redirects of the address are followed; a reload of the same page is allowed.
fn may_go(shown: &Shown, u: &Url) -> bool {
    let same = |a: &Url, b: &Url| {
        let (mut a, mut b) = (a.clone(), b.clone());
        a.set_fragment(None);
        b.set_fragment(None);
        a == b
    };
    match shown.lock().ok().and_then(|g| g.clone()) {
        None => crate::web_guard::refuse(u).is_none(),
        Some(cur) if same(&cur, u) => true,
        Some(_) => {
            crate::web_guard::open_outside(u);
            false
        }
    }
}

fn loaded(shown: &Shown, p: &tauri::webview::PageLoadPayload<'_>) {
    if matches!(p.event(), tauri::webview::PageLoadEvent::Finished)
        && let Ok(mut g) = shown.lock()
        && g.is_none()
    {
        *g = Some(p.url().clone());
    }
}

/// Label of a web window shown on the start page (a webview inside the main window): `clip-acasa_<id>`. It starts
/// with [`LABEL`], so every command from it is refused, as from the separate windows.
fn home_label(id: &str) -> String {
    format!("{LABEL}acasa_{id}")
}

/// Shows a frozen web window on the start page, inside the main window, over its panel: `rect` is `[x, y, w, h]`
/// in logical pixels of the window. It is moved if it is there already; a size under 20 hides it (the panel is not
/// fully on screen, or a dialog is over it).
pub fn embed(app: &AppHandle, root: &Path, id: &str, rect: [f64; 4]) -> Result<(), String> {
    let [x, y, w, h] = rect;
    let label = home_label(id);
    if let Some(v) = app.get_webview(&label) {
        if w < 20.0 || h < 20.0 {
            let _ = v.hide();
        } else {
            let _ = v.set_position(LogicalPosition::new(x, y));
            let _ = v.set_size(LogicalSize::new(w, h));
            let _ = v.show();
        }
        return Ok(());
    }
    if w < 20.0 || h < 20.0 {
        return Ok(());
    }
    let c = load(root).into_iter().find(|x| x.id == id).ok_or("fereastra nu există")?;
    if !c.inghetata {
        return Err("alege întâi zona și apasă „Îngheață” în „Ferestre web”".into());
    }
    let url = check_url(&c.url)?;
    let main = app.get_window("main").ok_or("fereastra principală nu e deschisă")?;
    let shown: Shown = Default::default();
    let (shown_nav, shown_load) = (shown.clone(), shown.clone());
    let b = WebviewBuilder::new(label, WebviewUrl::External(url))
        .incognito(true)
        .initialization_script(script(&c, false))
        .on_navigation(move |u| may_go(&shown_nav, u))
        .on_page_load(move |_v, p| loaded(&shown_load, &p))
        .on_new_window(|u, _| {
            crate::web_guard::open_outside(&u);
            tauri::webview::NewWindowResponse::Deny
        })
        .on_download(|_, _| false);
    let v = main
        .add_child(b, LogicalPosition::new(x, y), LogicalSize::new(w, h))
        .map_err(|e| format!("fereastra web nu a pornit: {e}"))?;
    let _ = v.with_webview(crate::web_guard::deny_on);
    if (c.zoom - 1.0).abs() > f64::EPSILON {
        let _ = v.set_zoom(c.zoom);
    }
    Ok(())
}

/// Takes a web window off the start page (the person left the page, or removed the panel).
pub fn unembed(app: &AppHandle, id: &str) {
    if let Some(v) = app.get_webview(&home_label(id)) {
        let _ = v.close();
    }
}

pub fn open(app: &AppHandle, root: &Path, id: &str, pick: bool) -> Result<(), String> {
    let c = load(root).into_iter().find(|x| x.id == id).ok_or("fereastra nu există")?;
    let url = check_url(&c.url)?;
    close(app, id);
    let positions = app.state::<Positions>();
    if let Ok(mut g) = positions.0.lock() {
        g.insert(id.to_string(), (c.x, c.y));
    }
    let key = id.to_string();
    let handle = app.clone();
    // After the page has loaded once, a click on a link does not move the frozen page: the link opens in the
    // computer's browser. Before that, redirects of the address are followed; a reload of the same page is allowed.
    let shown: Shown = Default::default();
    let (shown_nav, shown_load) = (shown.clone(), shown.clone());
    let mut b = WebviewWindowBuilder::new(app, new_label(id), WebviewUrl::External(url))
        .title(if pick { format!("{} — alege zona, apoi „Îngheață” în K.G.B.", c.nume) } else { c.nume.clone() })
        .inner_size(f64::from(c.latime), f64::from(c.inaltime))
        .always_on_top(c.deasupra && !pick)
        // An InPrivate profile of its own: the page's cookies and storage never mix with the app's and nothing of
        // it stays on disk. (A separate WebView2 data folder would need a second browser process, which WebView2
        // refuses next to the app's.)
        .incognito(true)
        .zoom_hotkeys_enabled(false)
        .initialization_script(script(&c, pick))
        .on_navigation(move |u| may_go(&shown_nav, u))
        .on_page_load(move |_w, p| loaded(&shown_load, &p))
        .on_new_window(|u, _| {
            crate::web_guard::open_outside(&u);
            tauri::webview::NewWindowResponse::Deny
        })
        .on_download(|_, _| false)
        .on_document_title_changed(move |_w, title| {
            if let Some(p) = parse_title(&title)
                && let Ok(mut g) = handle.state::<Positions>().0.lock()
            {
                g.insert(key.clone(), p);
            }
        });
    if c.pozitie.is_none() {
        b = b.center();
    }
    let w = b.build().map_err(|e| format!("fereastra web nu a pornit: {e}"))?;
    crate::web_guard::deny_permissions(&w);
    if let Some((x, y)) = c.pozitie {
        let _ = w.set_position(PhysicalPosition::new(x, y));
    }
    if (c.zoom - 1.0).abs() > f64::EPSILON {
        let _ = w.set_zoom(c.zoom);
    }
    Ok(())
}

/// Keeps what the person sees now: the scroll position, the window's size and place, the zoom.
pub fn freeze(app: &AppHandle, root: &Path, id: &str, zoom: Option<f64>) -> Result<Clip, String> {
    let mut c = load(root).into_iter().find(|x| x.id == id).ok_or("fereastra nu există")?;
    let w = window(app, id).ok_or("deschide întâi fereastra și alege zona")?;
    let scale = w.scale_factor().unwrap_or(1.0);
    if let Ok(s) = w.inner_size() {
        let l = s.to_logical::<f64>(scale);
        c.latime = l.width.round() as u32;
        c.inaltime = l.height.round() as u32;
    }
    if let Ok(p) = w.outer_position() {
        c.pozitie = Some((p.x, p.y));
    }
    if let Some((x, y)) = app.state::<Positions>().0.lock().ok().and_then(|g| g.get(id).copied()) {
        c.x = x;
        c.y = y;
    }
    if let Some(z) = zoom {
        c.zoom = z;
    }
    c.inghetata = true;
    let c = save(root, c)?;
    close(app, id);
    open(app, root, id, false)?;
    Ok(c)
}

/// Zoom while choosing the part (the page's own Ctrl+wheel zoom is off).
pub fn zoom(app: &AppHandle, root: &Path, id: &str, z: f64) -> Result<Clip, String> {
    let mut c = load(root).into_iter().find(|x| x.id == id).ok_or("fereastra nu există")?;
    c.zoom = (z * 100.0).round() / 100.0;
    let c = save(root, c)?;
    if let Some(w) = window(app, id) {
        let _ = w.set_zoom(c.zoom);
    }
    Ok(c)
}

/// Which clips have their window open now.
pub fn open_ids(app: &AppHandle) -> Vec<String> {
    app.webview_windows()
        .keys()
        .filter_map(|l| clip_of(l).map(str::to_string))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_positions_are_numbers_only() {
        assert_eq!(parse_title("kgbclip:0,1200"), Some((0, 1200)));
        assert_eq!(parse_title("kgbclip:12,-3"), None);
        assert_eq!(parse_title("kgbclip:1e9,3"), None);
        assert_eq!(parse_title("kgbclip:99999999,3"), None);
        assert_eq!(parse_title("Cursuri valutare"), None);
        assert_eq!(parse_title("kgbclip:,5"), None);
    }

    #[test]
    fn only_web_pages() {
        assert!(check_url("https://www.bnr.ro/curs").is_ok());
        assert!(check_url("http://www.bnr.ro/curs").is_err());
        assert!(check_url("https://intranet.firma.local/raport.php?x=1").is_err());
        assert!(check_url("file:///C:/Windows/win.ini").is_err());
        assert!(check_url("javascript:alert(1)").is_err());
        assert!(check_url("https://a b").is_err());
    }

    #[test]
    fn saved_per_pc_with_sane_values() {
        let d = tempfile::tempdir().unwrap();
        let c = save(
            d.path(),
            Clip {
                id: String::new(),
                nume: "  Curs  ".into(),
                url: "https://example.com/".into(),
                x: -5,
                y: 300,
                zoom: 9.0,
                latime: 10,
                inaltime: 10_000,
                pozitie: None,
                deasupra: true,
                reincarcare_min: 99_999,
                inghetata: false,
            },
        )
        .unwrap();
        assert_eq!((c.nume.as_str(), c.x, c.y, c.zoom, c.latime, c.inaltime, c.reincarcare_min), ("Curs", 0, 300, 1.0, 120, 3000, 1440));
        assert_eq!(load(d.path()), vec![c.clone()]);
        let mut bad = c.clone();
        bad.id = "../x".into();
        assert!(save(d.path(), bad).is_err());
    }
}
