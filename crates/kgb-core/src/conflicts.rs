//! Synchronisation conflicts in the app (Etapa 6, step 6.4; Master Plan §8.6).
//!
//! The same field changed on two PCs, or a record edited on one and deleted
//! on the other: the store keeps a provisional value (the same on every copy)
//! and a conflict for a person to decide. Here the conflicts become something
//! the screen can show — per module, with both values — and a decision that
//! respects roles: only someone who may write in the module decides (the
//! organization's own tables: administrators). The decision is synchronised
//! and resolves the conflict on every PC that has it.

use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::modules;
use crate::org::{self, Access};
use crate::workspace::Workspace;

#[derive(Clone, Debug, Serialize)]
pub struct ConflictView {
    pub id: Uuid,
    /// Module id, or `None` for the organization's tables.
    pub modul: Option<String>,
    pub colectie: String,
    pub inregistrare: Uuid,
    /// The field, or `null` for "edited on one PC, deleted on the other".
    pub camp: Option<String>,
    /// The value on this PC and the one that came from the other PC, as text.
    pub aici: String,
    pub venit: String,
    /// Which one is shown for now: "aici" or "venit".
    pub provizoriu: String,
    /// Whether the person on this PC may decide.
    pub poate_decide: bool,
}

fn module_of(coll: &str) -> Option<String> {
    coll.strip_prefix("mod.")?.rsplit_once('.').map(|(m, _)| m.to_string())
}

fn text(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => "(gol)".into(),
        other => other.to_string(),
    }
}

/// A whole record in an edit-versus-delete conflict.
fn whole(v: &Value) -> String {
    if v.get("deleted").and_then(Value::as_bool) == Some(true) {
        return "ștearsă".into();
    }
    let fields = v.get("fields").and_then(Value::as_object);
    let first = fields.and_then(|f| f.values().find_map(Value::as_str));
    match first {
        Some(s) => format!("păstrată: {}", s.chars().take(120).collect::<String>()),
        None => "păstrată".into(),
    }
}

/// What the person on this PC may do with a conflict in `coll`.
fn access(ws: &Workspace, fingerprint: Option<&str>, coll: &str) -> CoreResult<Access> {
    match module_of(coll) {
        Some(m) => Ok(org::access(ws.store(), fingerprint, &m)?.0),
        None => Ok(if org::require_admin(ws.store(), fingerprint, "").is_ok() {
            Access::Scriere
        } else {
            Access::Niciunul
        }),
    }
}

/// Open conflicts the person on this PC may see.
pub fn list(ws: &Workspace, fingerprint: Option<&str>) -> CoreResult<Vec<ConflictView>> {
    let mut out = Vec::new();
    for c in ws.store().conflicts(false)? {
        let a = access(ws, fingerprint, &c.coll)?;
        if a == Access::Niciunul {
            continue;
        }
        let deleted = c.field == kgb_store::model::DELETED_FIELD;
        out.push(ConflictView {
            id: c.id,
            modul: module_of(&c.coll),
            colectie: c.coll.clone(),
            inregistrare: c.record,
            camp: (!deleted).then(|| c.field.clone()),
            aici: if deleted { whole(&c.local) } else { text(&c.local) },
            venit: if deleted { whole(&c.remote) } else { text(&c.remote) },
            provizoriu: if c.provisional == "local" { "aici" } else { "venit" }.into(),
            poate_decide: a == Access::Scriere,
        });
    }
    out.sort_by(|a, b| (&a.modul, &a.colectie, a.inregistrare).cmp(&(&b.modul, &b.colectie, b.inregistrare)));
    Ok(out)
}

/// Decides a conflict: keep the value on this PC (`keep_here`) or the one
/// that came from the other PC. Audited; synchronised to every PC.
pub fn decide(ws: &mut Workspace, fingerprint: Option<&str>, id: Uuid, keep_here: bool) -> CoreResult<()> {
    let c = ws
        .store()
        .conflicts(false)?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| CoreError::invalid("conflictul", "nu există sau a fost deja rezolvat"))?;
    if access(ws, fingerprint, &c.coll)? != Access::Scriere {
        return Err(CoreError::invalid(
            "conflictul",
            "rolul tău nu poate modifica datele acestui modul, deci nu poate decide",
        ));
    }
    ws.store_mut().decide_conflict(id, keep_here)?;
    let what = if keep_here {
        "păstrat valoarea de aici"
    } else {
        "păstrat valoarea venită"
    };
    modules::audit(
        ws,
        &module_of(&c.coll).unwrap_or_else(|| "core.org".into()),
        "conflict rezolvat",
        "ok",
        what,
    )
}
