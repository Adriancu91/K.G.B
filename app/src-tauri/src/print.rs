//! PDF of the pages of a window copied from Cyber Office Studio (D-081): the print preview, Page layout
//! and the header / footer of Docs. COS made it with Electron's printToPDF; here a hidden window of the
//! app (label `print-<id>`) shows a cleaned snapshot of the document and WebView2 prints it with
//! `PrintToPdfStream`. The PDF goes back to the frame; saving it goes through the module's `export_file`.
//!
//! The hidden window loads only the app's own page (`cos-sheets.html#print=<id>`), gets the snapshot once
//! (`print_job_take`), says when it is laid out (`print_job_ready`) and is closed after every job. It can
//! call nothing else (see `allowed` and the invoke guard in main.rs) and has no capability of its own.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use base64::Engine as _;
use serde::Deserialize;
use serde_json::Value;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::oneshot;

/// A job that does not finish in this time is abandoned and its window closed.
const TIMEOUT: Duration = Duration::from_secs(30);
/// The largest snapshot accepted from the frame.
const MAX_SNAPSHOT: usize = 64 * 1024 * 1024;
/// The prefix of the hidden windows' labels.
pub const LABEL: &str = "print-";

#[derive(Default)]
pub struct PrintJobs(Mutex<HashMap<String, Job>>);

struct Job {
    /// The snapshot and page settings, handed out once.
    payload: Option<Value>,
    ready: Option<oneshot::Sender<Result<(), String>>>,
}

/// The paper, in millimetres (A4 by default), and its orientation.
#[derive(Deserialize)]
pub struct Paper {
    #[serde(default = "a4w")]
    width_mm: f64,
    #[serde(default = "a4h")]
    height_mm: f64,
    #[serde(default)]
    landscape: bool,
    /// Margins in millimetres: top, right, bottom, left.
    #[serde(default = "margins")]
    margins_mm: [f64; 4],
}
fn a4w() -> f64 {
    210.0
}
fn a4h() -> f64 {
    297.0
}
fn margins() -> [f64; 4] {
    [20.0, 20.0, 20.0, 20.0]
}

/// The commands the hidden window may call: nothing else (no modules, no files, no dialogs).
pub fn allowed(command: &str) -> bool {
    matches!(command, "print_job_take" | "print_job_ready")
}

const MM: f64 = 25.4;

/// The frame asks for the PDF of its snapshot: a hidden window lays it out and WebView2 prints it.
#[tauri::command]
pub async fn print_pdf(app: AppHandle, snapshot: Value, paper: Paper) -> Result<String, String> {
    let size = serde_json::to_vec(&snapshot).map(|v| v.len()).unwrap_or(usize::MAX);
    if size > MAX_SNAPSHOT {
        return Err("documentul este prea mare pentru tipărire".into());
    }
    let id = uuid::Uuid::now_v7().simple().to_string();
    let label = format!("{LABEL}{id}");
    let (tx, rx) = oneshot::channel();
    app.state::<PrintJobs>()
        .0
        .lock()
        .map_err(|_| "tipărirea nu este disponibilă")?
        .insert(id.clone(), Job { payload: Some(snapshot), ready: Some(tx) });
    let out = run(&app, &label, rx, &paper).await;
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.destroy();
    }
    if let Ok(mut jobs) = app.state::<PrintJobs>().0.lock() {
        jobs.remove(&id);
    }
    out
}

async fn run(
    app: &AppHandle,
    label: &str,
    ready: oneshot::Receiver<Result<(), String>>,
    paper: &Paper,
) -> Result<String, String> {
    let id = &label[LABEL.len()..];
    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App(format!("cos-sheets.html#print={id}").into()))
        .title("K.G.B. — tipărire")
        .visible(false)
        .skip_taskbar(true)
        .inner_size(900.0, 1200.0)
        .build()
        .map_err(|e| format!("fereastra de tipărire nu a pornit: {e}"))?;
    match tokio::time::timeout(TIMEOUT, ready).await {
        Ok(Ok(Ok(()))) => {}
        Ok(Ok(Err(e))) => return Err(format!("pagina de tipărit nu s-a putut pregăti: {e}")),
        Ok(Err(_)) => return Err("pagina de tipărit s-a închis".into()),
        Err(_) => return Err("tipărirea a durat prea mult și a fost oprită".into()),
    }
    let (tx, rx) = oneshot::channel::<Result<Vec<u8>, String>>();
    let (w, h) = if paper.landscape {
        (paper.width_mm.max(paper.height_mm), paper.width_mm.min(paper.height_mm))
    } else {
        (paper.width_mm.min(paper.height_mm), paper.width_mm.max(paper.height_mm))
    };
    let [mt, mr, mb, ml] = paper.margins_mm;
    let landscape = paper.landscape;
    window
        .with_webview(move |wv| {
            if let Err(e) = pdf_stream(&wv, [w, h], [mt, mr, mb, ml], landscape, tx) {
                tracing::warn!("print: {e}");
            }
        })
        .map_err(|e| format!("tipărirea nu a pornit: {e}"))?;
    match tokio::time::timeout(TIMEOUT, rx).await {
        Ok(Ok(Ok(bytes))) => Ok(base64::engine::general_purpose::STANDARD.encode(bytes)),
        Ok(Ok(Err(e))) => Err(format!("PDF-ul nu s-a putut face: {e}")),
        Ok(Err(_)) => Err("PDF-ul nu s-a putut face".into()),
        Err(_) => Err("tipărirea a durat prea mult și a fost oprită".into()),
    }
}

/// WebView2's own PDF of the page, without its header and footer (the frame adds the document's own).
#[cfg(windows)]
fn pdf_stream(
    wv: &tauri::webview::PlatformWebview,
    size_mm: [f64; 2],
    margins_mm: [f64; 4],
    landscape: bool,
    tx: oneshot::Sender<Result<Vec<u8>, String>>,
) -> Result<(), String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE, COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT, ICoreWebView2_16,
        ICoreWebView2Environment6,
    };
    use webview2_com::PrintToPdfStreamCompletedHandler;
    use windows::Win32::System::Com::IStream;
    use windows::core::Interface as _;

    let e = |e: windows::core::Error| e.message().to_string();
    unsafe {
        let core = wv.controller().CoreWebView2().map_err(e)?;
        let core16: ICoreWebView2_16 = core.cast().map_err(e)?;
        let env6: ICoreWebView2Environment6 = wv.environment().cast().map_err(e)?;
        let s = env6.CreatePrintSettings().map_err(e)?;
        s.SetOrientation(if landscape {
            COREWEBVIEW2_PRINT_ORIENTATION_LANDSCAPE
        } else {
            COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT
        })
        .map_err(e)?;
        // WebView2 takes the paper as portrait and turns it for landscape.
        s.SetPageWidth(size_mm[0].min(size_mm[1]) / MM).map_err(e)?;
        s.SetPageHeight(size_mm[0].max(size_mm[1]) / MM).map_err(e)?;
        s.SetMarginTop(margins_mm[0] / MM).map_err(e)?;
        s.SetMarginRight(margins_mm[1] / MM).map_err(e)?;
        s.SetMarginBottom(margins_mm[2] / MM).map_err(e)?;
        s.SetMarginLeft(margins_mm[3] / MM).map_err(e)?;
        s.SetShouldPrintBackgrounds(true).map_err(e)?;
        s.SetShouldPrintHeaderAndFooter(false).map_err(e)?;
        let handler = PrintToPdfStreamCompletedHandler::create(Box::new(move |hr, stream: Option<IStream>| {
            let out = hr.map_err(|e| e.message().to_string()).and_then(|()| match stream {
                Some(st) => read_all(&st),
                None => Err("WebView2 nu a întors niciun PDF".to_string()),
            });
            let _ = tx.send(out);
            Ok(())
        }));
        core16.PrintToPdfStream(&s, &handler).map_err(e)?;
    }
    Ok(())
}

#[cfg(windows)]
fn read_all(st: &windows::Win32::System::Com::IStream) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let mut n = 0u32;
        // SAFETY: the buffer is valid for its length and `n` receives the bytes read.
        let hr = unsafe { st.Read(buf.as_mut_ptr().cast(), buf.len() as u32, Some(&mut n)) };
        if hr.is_err() {
            return Err(format!("PDF-ul nu s-a putut citi ({hr:?})"));
        }
        if n == 0 {
            return Ok(out);
        }
        out.extend_from_slice(&buf[..n as usize]);
        if out.len() > 512 * 1024 * 1024 {
            return Err("PDF-ul este prea mare".into());
        }
    }
}

#[cfg(not(windows))]
fn pdf_stream(
    _: &tauri::webview::PlatformWebview,
    _: [f64; 2],
    _: [f64; 4],
    _: bool,
    tx: oneshot::Sender<Result<Vec<u8>, String>>,
) -> Result<(), String> {
    let _ = tx.send(Err("tipărirea în PDF există doar pe Windows".into()));
    Ok(())
}

/// The hidden window takes its snapshot, once.
#[tauri::command]
pub fn print_job_take(window: tauri::WebviewWindow, jobs: tauri::State<'_, PrintJobs>, id: String) -> Result<Value, String> {
    if window.label() != format!("{LABEL}{id}") {
        return Err("lucrarea nu este a acestei ferestre".into());
    }
    let mut jobs = jobs.0.lock().map_err(|_| "tipărirea nu este disponibilă")?;
    jobs.get_mut(&id)
        .and_then(|j| j.payload.take())
        .ok_or_else(|| "lucrarea de tipărit nu există sau a fost deja luată".into())
}

/// The hidden window has laid the snapshot out (fonts and pictures loaded), or could not.
#[tauri::command]
pub fn print_job_ready(
    window: tauri::WebviewWindow,
    jobs: tauri::State<'_, PrintJobs>,
    id: String,
    error: Option<String>,
) -> Result<(), String> {
    if window.label() != format!("{LABEL}{id}") {
        return Err("lucrarea nu este a acestei ferestre".into());
    }
    let mut jobs = jobs.0.lock().map_err(|_| "tipărirea nu este disponibilă")?;
    if let Some(tx) = jobs.get_mut(&id).and_then(|j| j.ready.take()) {
        let _ = tx.send(match error {
            Some(e) => Err(e.chars().take(300).collect()),
            None => Ok(()),
        });
    }
    Ok(())
}
