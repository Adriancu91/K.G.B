//! The phone page (Etapa 7, step 7.4m; D-068): phones of the firm, paired
//! once with this PC, send what they collect — reception sheets, photos of
//! the documents brought by drivers, bank statements — into an inbox on this
//! PC, where someone with the right role processes them.
//!
//! - A phone pairs with a short code shown on this PC (valid 10 minutes) and
//!   then waits until an administrator (or the single user) approves it and
//!   chooses whose phone it is. It can be revoked at any time.
//! - The phone gets a random token; only its BLAKE3 hash is stored.
//! - A phone only adds to the inbox: it cannot read or change anything else.
//! - Phones, the inbox and its photos stay on this PC (they are not
//!   synchronised to the organization's other PCs).

use kgb_store::{Fields, RecordState, Write};
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::files;
use crate::workspace::{Workspace, now_ms};

pub const PHONES_COLLECTION: &str = "core.phones";
pub const INBOX_COLLECTION: &str = "core.phone_inbox";
/// Owner of the inbox's files; never synchronised (see `replication`).
pub const PHONE_MODULE: &str = "core.phone";
pub const KINDS: &[(&str, &str)] = &[
    ("receptie", "fișă de recepție"),
    ("document", "documente de la șofer"),
    ("extras", "extras de cont"),
];
pub const MAX_FILES: usize = 6;
pub const MAX_FILE_BYTES: usize = 8 * 1024 * 1024;

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("telefonul", detail)
}

fn hash(token: &str) -> String {
    blake3::hash(token.as_bytes()).to_hex().to_string()
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Phone {
    pub id: Uuid,
    pub nume: String,
    /// `asteapta`, `aprobat` or `revocat`.
    pub stare: String,
    pub membru_nume: String,
    pub creat_ms: u64,
    pub vazut_ms: u64,
    pub version: u64,
}

fn phone(r: &RecordState) -> Phone {
    let s = |k: &str| r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    let n = |k: &str| r.fields.get(k).and_then(Value::as_u64).unwrap_or(0);
    Phone { id: r.id, nume: s("nume"), stare: s("stare"), membru_nume: s("membru_nume"), creat_ms: n("creat_ms"), vazut_ms: n("vazut_ms"), version: r.version }
}

pub fn list(ws: &Workspace) -> CoreResult<Vec<Phone>> {
    let mut v: Vec<Phone> = ws.store().scan(PHONES_COLLECTION, |_| true)?.iter().map(phone).collect();
    v.sort_by_key(|p| std::cmp::Reverse(p.creat_ms));
    Ok(v)
}

/// A phone asks to pair (the code was already checked by the caller).
/// Returns its id and the token it must keep.
pub fn pair(ws: &mut Workspace, name: &str) -> CoreResult<(Uuid, String)> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 60 {
        return Err(bad("numele telefonului are 1–60 de caractere"));
    }
    let mut raw = [0u8; 32];
    getrandom::fill(&mut raw).map_err(|_| bad("nu s-a putut genera cheia"))?;
    let token: String = raw.iter().map(|b| format!("{b:02x}")).collect();
    let mut f = Fields::new();
    f.insert("nume".into(), json!(name));
    f.insert("token".into(), json!(hash(&token)));
    f.insert("stare".into(), json!("asteapta"));
    f.insert("membru_nume".into(), json!(""));
    f.insert("creat_ms".into(), json!(now_ms()));
    f.insert("vazut_ms".into(), json!(now_ms()));
    let id = Uuid::now_v7();
    ws.store_mut().write(vec![Write::put(PHONES_COLLECTION, id, f).expect(0)])?;
    Ok((id, token))
}

/// Approves a waiting phone as `member` (the person who will use it).
pub fn approve(ws: &mut Workspace, id: Uuid, member: &str) -> CoreResult<()> {
    let r = ws.store().get(PHONES_COLLECTION, id)?.ok_or_else(|| bad("nu există"))?;
    let member = member.trim();
    if member.is_empty() || member.chars().count() > 100 {
        return Err(bad("alege cine folosește telefonul"));
    }
    if r.fields.get("stare").and_then(Value::as_str) != Some("asteapta") {
        return Err(bad("nu mai așteaptă aprobare"));
    }
    let mut f = r.fields.clone();
    f.insert("stare".into(), json!("aprobat"));
    f.insert("membru_nume".into(), json!(member));
    ws.store_mut().write(vec![Write::put(PHONES_COLLECTION, id, f).expect(r.version)])?;
    Ok(())
}

pub fn revoke(ws: &mut Workspace, id: Uuid) -> CoreResult<()> {
    let r = ws.store().get(PHONES_COLLECTION, id)?.ok_or_else(|| bad("nu există"))?;
    let mut f = r.fields.clone();
    f.insert("stare".into(), json!("revocat"));
    ws.store_mut().write(vec![Write::put(PHONES_COLLECTION, id, f).expect(r.version)])?;
    Ok(())
}

/// The phone holding `token`, whatever its state (None for an unknown token).
pub fn by_token(ws: &Workspace, token: &str) -> CoreResult<Option<Phone>> {
    if token.len() != 64 {
        return Ok(None);
    }
    let h = json!(hash(token));
    Ok(ws.store().scan(PHONES_COLLECTION, |r| r.fields.get("token") == Some(&h))?.first().map(phone))
}

/// Marks a phone as seen now (at most once a minute).
pub fn seen(ws: &mut Workspace, id: Uuid) -> CoreResult<()> {
    if let Some(r) = ws.store().get(PHONES_COLLECTION, id)? {
        if now_ms().saturating_sub(r.fields.get("vazut_ms").and_then(Value::as_u64).unwrap_or(0)) < 60_000 {
            return Ok(());
        }
        let mut f = r.fields.clone();
        f.insert("vazut_ms".into(), json!(now_ms()));
        ws.store_mut().write(vec![Write::put(PHONES_COLLECTION, r.id, f).expect(r.version)])?;
    }
    Ok(())
}

/// One file sent by a phone.
pub struct Upload {
    pub name: String,
    pub mime: String,
    pub data: Vec<u8>,
}

/// What an approved phone sends: a kind, text fields, files.
pub fn submit(ws: &mut Workspace, from: &Phone, kind: &str, fields: serde_json::Map<String, Value>, uploads: Vec<Upload>) -> CoreResult<Uuid> {
    if from.stare != "aprobat" {
        return Err(bad("nu e aprobat pe PC"));
    }
    if !KINDS.iter().any(|(k, _)| *k == kind) {
        return Err(bad("tip necunoscut"));
    }
    if uploads.len() > MAX_FILES {
        return Err(bad(format!("cel mult {MAX_FILES} fișiere")));
    }
    // Text fields: short strings only.
    let mut clean = serde_json::Map::new();
    for (k, v) in fields.into_iter().take(20) {
        let t = v.as_str().unwrap_or_default().trim().to_string();
        if k.len() > 40 || t.chars().count() > 1000 {
            return Err(bad("un câmp e prea lung"));
        }
        if !t.is_empty() {
            clean.insert(k, json!(t));
        }
    }
    if clean.is_empty() && uploads.is_empty() {
        return Err(bad("nimic de trimis"));
    }
    if kind == "extras" && uploads.is_empty() {
        return Err(bad("alege fișierul extrasului"));
    }
    let mut files_out = Vec::new();
    for u in uploads {
        if u.data.is_empty() || u.data.len() > MAX_FILE_BYTES {
            return Err(bad(format!("„{}”: gol sau mai mare de 8 MB", u.name)));
        }
        let allowed = u.mime.starts_with("image/") || ["text/csv", "application/vnd.ms-excel", "application/pdf", "text/plain", "application/octet-stream"].contains(&u.mime.as_str());
        if !allowed {
            return Err(bad(format!("„{}”: tipul {} nu e acceptat", u.name, u.mime)));
        }
        let fr = files::put(ws, PHONE_MODULE, &u.name, &u.data)?;
        files_out.push(json!({"id": fr.id.to_string(), "nume": fr.name, "mime": u.mime, "octeti": u.data.len()}));
    }
    let mut f = Fields::new();
    f.insert("tip".into(), json!(kind));
    f.insert("telefon".into(), json!(from.id.to_string()));
    f.insert("telefon_nume".into(), json!(from.nume));
    f.insert("membru_nume".into(), json!(from.membru_nume));
    f.insert("campuri".into(), Value::Object(clean));
    f.insert("fisiere".into(), json!(files_out));
    f.insert("procesat".into(), json!(false));
    f.insert("creat_ms".into(), json!(now_ms()));
    let id = Uuid::now_v7();
    ws.store_mut().write(vec![Write::put(INBOX_COLLECTION, id, f).expect(0)])?;
    Ok(id)
}

/// The inbox, newest first.
pub fn inbox(ws: &Workspace) -> CoreResult<Vec<Value>> {
    let mut v = ws.store().scan(INBOX_COLLECTION, |_| true)?;
    v.sort_by_key(|r| std::cmp::Reverse(r.id));
    Ok(v.iter()
        .map(|r| {
            let mut o = Value::Object(r.fields.clone());
            o["id"] = json!(r.id);
            o["version"] = json!(r.version);
            o
        })
        .collect())
}

pub fn mark_done(ws: &mut Workspace, id: Uuid, done: bool) -> CoreResult<()> {
    let r = ws.store().get(INBOX_COLLECTION, id)?.ok_or_else(|| bad("nu există"))?;
    let mut f = r.fields.clone();
    f.insert("procesat".into(), json!(done));
    ws.store_mut().write(vec![Write::put(INBOX_COLLECTION, id, f).expect(r.version)])?;
    Ok(())
}

/// A file of the inbox (name, bytes).
pub fn file(ws: &Workspace, id: Uuid) -> CoreResult<(String, Vec<u8>)> {
    let (fr, data) = files::get(ws, PHONE_MODULE, id)?;
    Ok((fr.name, data))
}
