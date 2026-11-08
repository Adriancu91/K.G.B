//! Team messages (Etapa 7, step 7.4f): a small chat of the organization,
//! with voice messages.
//!
//! - Every member may read and write (like the partner directory, D-066); the
//!   messages and the recordings travel only between the organization's PCs,
//!   through the synchronisation of Etapa 6, end-to-end encrypted.
//! - A voice message is a recording made in K.G.B. (Windows asks for the
//!   microphone permission); its bytes are a file of the core, owned by
//!   `core.chat`, so they reach the other PCs like any attached file.
//! - A message from someone else becomes a notification on this PC, once.
//! - Each message records who wrote it (name) and from which device
//!   (fingerprint); there is no editing: a message can only be deleted by
//!   its author.

use kgb_store::{Fields, RecordState, Store, Write};
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::files;
use crate::workspace::{Workspace, now_ms};

pub const CHAT_COLLECTION: &str = "core.chat";
/// Owner of the recordings in `core.files`.
pub const CHAT_MODULE: &str = "core.chat";
pub const TEXT_MAX: usize = 2000;
/// A voice message: at most 2 minutes and 3 MB.
pub const VOICE_MAX_MS: u64 = 120_000;
pub const VOICE_MAX_BYTES: usize = 3 * 1024 * 1024;
const MIMES: &[&str] = &["audio/webm", "audio/ogg", "audio/mp4", "audio/wav"];

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("mesajul", detail)
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Message {
    pub id: Uuid,
    pub autor: String,
    /// Fingerprint of the device it was written on.
    pub dispozitiv: String,
    pub text: String,
    /// The recording's file, for a voice message.
    pub voce: Option<Uuid>,
    pub durata_ms: u64,
    pub tip_audio: String,
    pub creat_ms: u64,
    pub version: u64,
}

fn from(r: &RecordState) -> Message {
    let f = &r.fields;
    let s = |k: &str| f.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    Message {
        id: r.id,
        autor: s("autor"),
        dispozitiv: s("dispozitiv"),
        text: s("text"),
        voce: f.get("voce").and_then(Value::as_str).and_then(|v| v.parse().ok()),
        durata_ms: f.get("durata_ms").and_then(Value::as_u64).unwrap_or(0),
        tip_audio: s("tip_audio"),
        creat_ms: f.get("creat_ms").and_then(Value::as_u64).unwrap_or(0),
        version: r.version,
    }
}

fn author(name: &str) -> CoreResult<String> {
    let n = name.trim();
    if n.is_empty() || n.chars().count() > 100 {
        return Err(bad("autorul nu are un nume"));
    }
    Ok(n.to_string())
}

/// The last `limit` messages, oldest first.
pub fn list(store: &Store, limit: usize) -> CoreResult<Vec<Message>> {
    let mut v: Vec<Message> = store.scan(CHAT_COLLECTION, |_| true)?.iter().map(from).collect();
    v.sort_by_key(|m| (m.creat_ms, m.id));
    let skip = v.len().saturating_sub(limit);
    Ok(v.into_iter().skip(skip).collect())
}

/// A text message.
pub fn send(ws: &mut Workspace, autor: &str, device: &str, text: &str) -> CoreResult<Uuid> {
    let text = text.trim();
    if text.is_empty() {
        return Err(bad("e gol"));
    }
    if text.chars().count() > TEXT_MAX {
        return Err(bad(format!("are mai mult de {TEXT_MAX} de caractere")));
    }
    let mut f = Fields::new();
    f.insert("autor".into(), json!(author(autor)?));
    f.insert("dispozitiv".into(), json!(device));
    f.insert("text".into(), json!(text));
    f.insert("creat_ms".into(), json!(now_ms()));
    let id = Uuid::now_v7();
    ws.store_mut().write(vec![Write::put(CHAT_COLLECTION, id, f).expect(0)])?;
    Ok(id)
}

/// A voice message: the recording (`data`, of type `mime`) and its length.
pub fn send_voice(ws: &mut Workspace, autor: &str, device: &str, data: &[u8], mime: &str, durata_ms: u64) -> CoreResult<Uuid> {
    let autor = author(autor)?;
    let mime = mime.split(';').next().unwrap_or(mime).trim();
    if !MIMES.contains(&mime) {
        return Err(bad(format!("înregistrarea are un format necunoscut ({mime})")));
    }
    if data.is_empty() || durata_ms == 0 {
        return Err(bad("înregistrarea e goală"));
    }
    if data.len() > VOICE_MAX_BYTES || durata_ms > VOICE_MAX_MS {
        return Err(bad("un mesaj vocal are cel mult 2 minute"));
    }
    let ext = mime.rsplit('/').next().unwrap_or("webm");
    let file = files::put(ws, CHAT_MODULE, &format!("mesaj-vocal-{}.{ext}", now_ms()), data)?;
    let mut f = Fields::new();
    f.insert("autor".into(), json!(autor));
    f.insert("dispozitiv".into(), json!(device));
    f.insert("text".into(), json!(""));
    f.insert("voce".into(), json!(file.id.to_string()));
    f.insert("durata_ms".into(), json!(durata_ms));
    f.insert("tip_audio".into(), json!(mime));
    f.insert("creat_ms".into(), json!(now_ms()));
    let id = Uuid::now_v7();
    ws.store_mut().write(vec![Write::put(CHAT_COLLECTION, id, f).expect(0)])?;
    Ok(id)
}

/// The recording of a voice message, when its bytes are on this PC
/// (`None` while they are still on their way from another PC).
pub fn voice(ws: &Workspace, id: Uuid) -> CoreResult<Option<(String, Vec<u8>)>> {
    let m = ws.store().get(CHAT_COLLECTION, id)?.map(|r| from(&r)).ok_or_else(|| bad("nu există"))?;
    let file = m.voce.ok_or_else(|| bad("nu e un mesaj vocal"))?;
    match files::get(ws, CHAT_MODULE, file) {
        Ok((_, bytes)) => Ok(Some((m.tip_audio, bytes))),
        Err(_) if !crate::blobs::missing(ws.store())?.is_empty() => Ok(None),
        Err(e) => Err(e),
    }
}

/// Deletes a message; only on the device it was written on.
pub fn delete(ws: &mut Workspace, device: &str, id: Uuid) -> CoreResult<()> {
    let r = ws.store().get(CHAT_COLLECTION, id)?.ok_or_else(|| bad("nu există"))?;
    let m = from(&r);
    if m.dispozitiv != device {
        return Err(bad("doar autorul își poate șterge mesajul"));
    }
    ws.store_mut().write(vec![Write::delete(CHAT_COLLECTION, id).expect(r.version)])?;
    if let Some(file) = m.voce {
        let _ = files::delete(ws, CHAT_MODULE, file);
    }
    Ok(())
}

/// Notifications for messages from other devices, once each. Returns how many.
pub fn notify(ws: &mut Workspace, device: &str) -> CoreResult<usize> {
    use crate::notifications::{self, Notice};
    let mut n = 0;
    for m in list(ws.store(), 200)? {
        if m.dispozitiv == device {
            continue;
        }
        let (title, text) = if m.voce.is_some() {
            (format!("Mesaj vocal de la {}", m.autor), format!("{} secunde", m.durata_ms.div_ceil(1000)))
        } else {
            let t: String = m.text.chars().take(140).collect();
            (format!("Mesaj de la {}", m.autor), t)
        };
        let (_, new) = notifications::send(ws, CHAT_MODULE, &Notice::new(title, text).key(format!("chat:{}", m.id)))?;
        if new {
            n += 1;
        }
    }
    Ok(n)
}
