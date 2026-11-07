//! Notifications (Etapa 4, step 4.4; decision D-043): a core service. Modules
//! send through `ModuleContext::notify` (permission `notify.send`); the core
//! keeps them, shows them in the notification centre and audits every send.
//!
//! - A notification may carry a **key**: the same module sending the same key
//!   again does not create a second one (reminders survive restarts without
//!   repeating themselves).
//! - The list is bounded: past [`MAX_KEPT`], the oldest read ones go first.
//!   Unread notifications are never dropped to make room.
//! - Text is plain text, length-limited; the UI never renders it as HTML.

use kgb_store::{Fields, RecordState, Write};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::workspace::{Workspace, now_ms};

pub const NOTIFICATIONS_COLLECTION: &str = "core.notifications";
pub const MAX_KEPT: usize = 500;
const TITLE_MAX: usize = 120;
const BODY_MAX: usize = 500;
const KEY_MAX: usize = 120;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Info,
    Atentie,
    Urgent,
}

/// What a module sends.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Notice {
    pub titlu: String,
    #[serde(default)]
    pub text: String,
    #[serde(default = "info")]
    pub nivel: Level,
    /// Same module + same key = the same notification (no duplicates).
    #[serde(default)]
    pub cheie: Option<String>,
}

fn info() -> Level {
    Level::Info
}

impl Notice {
    pub fn new(titlu: impl Into<String>, text: impl Into<String>) -> Notice {
        Notice {
            titlu: titlu.into(),
            text: text.into(),
            nivel: Level::Info,
            cheie: None,
        }
    }
    pub fn level(mut self, nivel: Level) -> Notice {
        self.nivel = nivel;
        self
    }
    pub fn key(mut self, cheie: impl Into<String>) -> Notice {
        self.cheie = Some(cheie.into());
        self
    }
}

/// What the notification centre shows.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct NotificationView {
    pub id: Uuid,
    pub version: u64,
    pub module: String,
    pub titlu: String,
    pub text: String,
    pub nivel: Level,
    pub creat_ms: u64,
    pub citit_ms: Option<u64>,
}

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("notificarea", detail)
}

fn clean(s: &str, max: usize, what: &str, required: bool) -> CoreResult<String> {
    // Control and bidi-override characters out: what is shown is what was sent.
    let t: String = s
        .chars()
        .filter(|c| (!c.is_control() || *c == '\n') && !matches!(c, '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}'))
        .collect();
    let t = t.trim().to_string();
    if required && t.is_empty() {
        return Err(bad(format!("{what} nu poate fi gol")));
    }
    if t.chars().count() > max {
        return Err(bad(format!("{what} are mai mult de {max} de caractere")));
    }
    Ok(t)
}

fn view(r: &RecordState) -> NotificationView {
    let s = |k: &str| r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    NotificationView {
        id: r.id,
        version: r.version,
        module: s("module"),
        titlu: s("titlu"),
        text: s("text"),
        nivel: r
            .fields
            .get("nivel")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or(Level::Info),
        creat_ms: r.fields.get("creat_ms").and_then(Value::as_u64).unwrap_or_default(),
        citit_ms: r.fields.get("citit_ms").and_then(Value::as_u64),
    }
}

/// Stores a notification from `module`. Returns its id and whether it is new
/// (`false` = a notification with the same key already existed).
pub fn send(ws: &mut Workspace, module: &str, n: &Notice) -> CoreResult<(Uuid, bool)> {
    let titlu = clean(&n.titlu, TITLE_MAX, "titlul", true)?;
    let text = clean(&n.text, BODY_MAX, "textul", false)?;
    let cheie = match &n.cheie {
        Some(k) => Some(clean(k, KEY_MAX, "cheia", true)?),
        None => None,
    };
    if let Some(k) = &cheie {
        let existing = ws.store().scan(NOTIFICATIONS_COLLECTION, |r| {
            r.fields.get("module").and_then(Value::as_str) == Some(module)
                && r.fields.get("cheie").and_then(Value::as_str) == Some(k)
        })?;
        if let Some(r) = existing.first() {
            return Ok((r.id, false));
        }
    }
    let mut f = Fields::new();
    f.insert("module".into(), json!(module));
    f.insert("titlu".into(), json!(titlu));
    f.insert("text".into(), json!(text));
    f.insert("nivel".into(), json!(n.nivel));
    f.insert("cheie".into(), cheie.map_or(Value::Null, Value::from));
    f.insert("creat_ms".into(), json!(now_ms()));
    f.insert("citit_ms".into(), Value::Null);
    let id = Uuid::now_v7();
    let mut batch = vec![Write::put(NOTIFICATIONS_COLLECTION, id, f).expect(0)];
    batch.extend(prune(ws)?);
    ws.store_mut().write(batch)?;
    Ok((id, true))
}

/// Deletes for the oldest read notifications once the list is full (one
/// more is about to be added).
fn prune(ws: &Workspace) -> CoreResult<Vec<Write>> {
    let n = ws.store().count(NOTIFICATIONS_COLLECTION);
    if n < MAX_KEPT {
        return Ok(vec![]);
    }
    let mut read = ws.store().scan(NOTIFICATIONS_COLLECTION, |r| {
        r.fields.get("citit_ms").is_some_and(|v| !v.is_null())
    })?;
    read.sort_by_key(|r| r.id);
    Ok(read
        .into_iter()
        .take(n + 1 - MAX_KEPT)
        .map(|r| Write::delete(NOTIFICATIONS_COLLECTION, r.id).expect(r.version))
        .collect())
}

/// Newest first.
pub fn list(ws: &Workspace, unread_only: bool, limit: usize) -> CoreResult<Vec<NotificationView>> {
    let mut all = ws.store().scan(NOTIFICATIONS_COLLECTION, |r| {
        !unread_only || r.fields.get("citit_ms").is_none_or(Value::is_null)
    })?;
    all.sort_by_key(|r| std::cmp::Reverse(r.id));
    Ok(all.iter().take(limit).map(view).collect())
}

pub fn unread_count(ws: &Workspace) -> CoreResult<usize> {
    Ok(list(ws, true, usize::MAX)?.len())
}

/// Marks one notification read (idempotent).
pub fn mark_read(ws: &mut Workspace, id: Uuid) -> CoreResult<()> {
    let Some(r) = ws.store().get(NOTIFICATIONS_COLLECTION, id)? else {
        return Err(bad("nu mai există"));
    };
    if r.fields.get("citit_ms").is_some_and(|v| !v.is_null()) {
        return Ok(());
    }
    let mut f = r.fields.clone();
    f.insert("citit_ms".into(), json!(now_ms()));
    ws.store_mut()
        .write(vec![Write::put(NOTIFICATIONS_COLLECTION, id, f).expect(r.version)])?;
    Ok(())
}

/// Marks all read in one atomic write; returns how many changed.
pub fn mark_all_read(ws: &mut Workspace) -> CoreResult<usize> {
    let now = now_ms();
    let unread = ws.store().scan(NOTIFICATIONS_COLLECTION, |r| {
        r.fields.get("citit_ms").is_none_or(Value::is_null)
    })?;
    let n = unread.len();
    if n > 0 {
        let batch = unread
            .into_iter()
            .map(|r| {
                let mut f = r.fields;
                f.insert("citit_ms".into(), json!(now));
                Write::put(NOTIFICATIONS_COLLECTION, r.id, f).expect(r.version)
            })
            .collect();
        ws.store_mut().write(batch)?;
    }
    Ok(n)
}

/// Deletes the read notifications; returns how many.
pub fn clear_read(ws: &mut Workspace) -> CoreResult<usize> {
    let read = ws.store().scan(NOTIFICATIONS_COLLECTION, |r| {
        r.fields.get("citit_ms").is_some_and(|v| !v.is_null())
    })?;
    let n = read.len();
    if n > 0 {
        ws.store_mut().write(
            read.into_iter()
                .map(|r| Write::delete(NOTIFICATIONS_COLLECTION, r.id).expect(r.version))
                .collect(),
        )?;
    }
    Ok(n)
}
