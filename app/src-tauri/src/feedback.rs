//! "Trimite o observație" (7.4l-0e), as in Cyber Office Studio (electron/main.cjs, feedback:*): the person writes
//! what does not work; a picture of the window (WebView2's own CapturePreview of this window), the page and the
//! version are kept with it. Everything is saved only on this computer, in Documents\K.G.B\Observații; nothing goes
//! to the internet: the person sends the files themself. With KGB_DATA_DIR (the tests' throw-away data folder)
//! the notes go to <that folder>\Observatii.

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use serde::Serialize;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tokio::sync::oneshot;

/// The largest picture accepted from the page (a full-HD PNG is a few MB).
const MAX_PNG: usize = 32 * 1024 * 1024;
const MAX_TEXT: usize = 20_000;

fn dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(d) = std::env::var_os("KGB_DATA_DIR") {
        return Ok(PathBuf::from(d).join("Observatii"));
    }
    let docs = app
        .path()
        .document_dir()
        .map_err(|_| "dosarul Documente nu a fost găsit".to_string())?;
    Ok(docs.join("K.G.B").join("Observații"))
}

/// A PNG picture of this window, as the person sees it (base64), or nothing when it cannot be taken.
#[tauri::command]
pub async fn feedback_capture(window: tauri::WebviewWindow) -> Result<Option<String>, String> {
    let (tx, rx) = oneshot::channel::<Result<Vec<u8>, String>>();
    window
        .with_webview(move |wv| {
            if let Err(e) = capture(&wv, tx) {
                tracing::warn!("feedback capture: {e}");
            }
        })
        .map_err(|e| format!("poza ferestrei nu s-a putut face: {e}"))?;
    match tokio::time::timeout(Duration::from_secs(10), rx).await {
        Ok(Ok(Ok(png))) if !png.is_empty() => Ok(Some(B64.encode(png))),
        _ => Ok(None),
    }
}

#[cfg(windows)]
fn capture(wv: &tauri::webview::PlatformWebview, tx: oneshot::Sender<Result<Vec<u8>, String>>) -> Result<(), String> {
    use webview2_com::CapturePreviewCompletedHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG;
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::Com::STREAM_SEEK_SET;
    use windows::Win32::System::Com::StructuredStorage::CreateStreamOnHGlobal;

    let e = |e: windows::core::Error| e.message().to_string();
    // SAFETY: COM calls on the webview's own thread (with_webview); the stream lives until the handler ran.
    unsafe {
        let core = wv.controller().CoreWebView2().map_err(e)?;
        let stream = CreateStreamOnHGlobal(HGLOBAL::default(), true).map_err(e)?;
        let held = stream.clone();
        let handler = CapturePreviewCompletedHandler::create(Box::new(move |hr| {
            let out = hr.map_err(|e| e.message().to_string()).and_then(|()| {
                held.Seek(0, STREAM_SEEK_SET, None)
                    .map_err(|e| e.message().to_string())?;
                crate::print::read_all(&held)
            });
            let _ = tx.send(out);
            Ok(())
        }));
        core.CapturePreview(COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG, &stream, &handler)
            .map_err(e)?;
    }
    Ok(())
}

#[cfg(not(windows))]
fn capture(_: &tauri::webview::PlatformWebview, tx: oneshot::Sender<Result<Vec<u8>, String>>) -> Result<(), String> {
    let _ = tx.send(Ok(Vec::new()));
    Ok(())
}

#[derive(Serialize)]
pub struct Saved {
    dir: String,
    txt: String,
    png: Option<String>,
}

/// Writes the note (and the picture, if kept) as „Observație <date> <time>.txt / .png”.
#[tauri::command]
pub fn feedback_save(
    app: AppHandle,
    text: String,
    module: String,
    file: String,
    png: Option<String>,
    stamp: String,
    date: String,
) -> Result<Saved, String> {
    // The local time comes from the page (`2026-11-10 15-04-05` and as it reads in Romanian), checked here.
    let ok_stamp = stamp.len() == 19
        && stamp.bytes().enumerate().all(|(i, b)| match i {
            4 | 7 | 13 | 16 => b == b'-',
            10 => b == b' ',
            _ => b.is_ascii_digit(),
        });
    if !ok_stamp {
        return Err("data observației nu e bună".into());
    }
    let text = text.trim();
    if text.is_empty() {
        return Err("observația e goală".into());
    }
    if text.len() > MAX_TEXT {
        return Err("observația e prea lungă".into());
    }
    let png = match png.filter(|p| !p.is_empty()) {
        Some(p) => {
            let b = B64
                .decode(p.as_bytes())
                .map_err(|_| "poza nu a ajuns întreagă".to_string())?;
            if b.len() > MAX_PNG || !b.starts_with(b"\x89PNG\r\n\x1a\n") {
                return Err("poza nu e bună".into());
            }
            Some(b)
        }
        None => None,
    };
    let dir = dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("dosarul observațiilor nu s-a putut face: {e}"))?;
    let base = dir.join(format!("Observație {stamp}"));
    let txt = base.with_extension("txt");
    let pic = base.with_extension("png");
    let one = |s: &str| s.chars().filter(|c| !c.is_control()).take(300).collect::<String>();
    let lines = [
        "Observație K.G.B.".to_string(),
        format!("Data: {}", one(&date)),
        format!("Versiunea K.G.B.: {}", env!("CARGO_PKG_VERSION")),
        format!("Pagina: {}", one(&module)),
        format!(
            "Fișierul: {}",
            if file.trim().is_empty() {
                "(niciunul)".into()
            } else {
                one(&file)
            }
        ),
        format!(
            "Captura: {}",
            if png.is_some() {
                format!("Observație {stamp}.png")
            } else {
                "(fără)".into()
            }
        ),
        String::new(),
        text.replace("\r\n", "\n").replace('\n', "\r\n"),
        String::new(),
    ];
    std::fs::write(&txt, lines.join("\r\n")).map_err(|e| format!("observația nu s-a putut scrie: {e}"))?;
    if let Some(b) = &png {
        std::fs::write(&pic, b).map_err(|e| format!("poza nu s-a putut scrie: {e}"))?;
    }
    Ok(Saved {
        dir: dir.display().to_string(),
        txt: txt.display().to_string(),
        png: png.map(|_| pic.display().to_string()),
    })
}

/// Opens the folder of the notes in Windows Explorer.
#[tauri::command]
pub fn feedback_open_dir(app: AppHandle) -> Result<(), String> {
    let dir = dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("dosarul observațiilor nu s-a putut face: {e}"))?;
    std::process::Command::new("explorer.exe")
        .arg(&dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("dosarul nu s-a putut deschide: {e}"))
}
