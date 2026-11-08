//! Synchronisation protocol between the organization's devices (Etapa 6,
//! step 6.3; decisions D-057, D-059). It knows nothing about the network: it
//! makes and reads signed messages, which any transport can carry (step 6.5
//! uses iroh; the tests pass them in memory).
//!
//! One round, pulled by the device that wants news:
//! 1. **request** — "this is what I have" (version vector) and "these are the
//!    changes I know exist but did not receive" (unfilled redaction markers),
//!    signed with the device key;
//! 2. **answer** — the peer checks the request comes from a device of the
//!    organization (signed registry, D-058) and sends what is missing. What
//!    the requester's role may not read is sent as a **redaction marker**: the
//!    content never leaves the PC (D-059). Each device's local things
//!    (settings, notifications, audit journal, invitations…) are never sent;
//! 3. **apply** — the requester checks the answer's signature and sender, then
//!    every change on its own: who made it (the device behind its journal id,
//!    in the registry), and whether that person's role allowed it *at that
//!    moment*. Organization tables are accepted only from administrators,
//!    module data only from roles that could write in that module. Anything
//!    else becomes a marker too, so nothing unauthorised is stored and the
//!    sequence stays complete.
//!
//! A new PC has no registry yet: for its first round it trusts only the
//! administrator key from the invitation it answered (`invites::request`).
//!
//! Not in this step: attached files (6.8), revocation (6.7), the network
//! (6.5). Changes relayed through a third device are checked against their
//! author's rights, but are not individually signed by the author: a member
//! could pass along a change in another member's name; per-change signatures
//! are a later improvement (documented in `docs/ETAPA6_PLAN.md`).

use std::collections::BTreeMap;

use kgb_store::sync::{is_redacted, redact};
use kgb_store::{Fields, Op, Store, SyncReport, VersionVector};
use serde::Serialize;
use serde_json::{Value, json};

use crate::error::{CoreError, CoreResult};
use crate::identity::{self, DeviceIdentity};
use crate::invites;
use crate::org::Access;
use crate::registry::{self, RegState, canon};
use crate::workspace::now_ms;

const DOMAIN: &[u8] = b"KGB-SYNC1\n";

/// Organization tables: accepted only from administrators.
const ORG_TABLES: &[&str] = &["core.org", "core.roles", "core.members"];

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("sincronizarea", detail)
}

fn sign(dev: &DeviceIdentity, body: &Value) -> Value {
    let mut m = DOMAIN.to_vec();
    m.extend_from_slice(canon(body).as_bytes());
    let mut v = body.clone();
    v["sig"] = json!(identity::hex(&dev.sign(&m).to_bytes()));
    v
}

/// Checks the signature; returns the body without it and the signer's key.
fn open(msg: &Value, kind: &str) -> CoreResult<(Value, String)> {
    let mut body = msg.clone();
    let sig = body
        .as_object_mut()
        .and_then(|o| o.remove("sig"))
        .and_then(|s| s.as_str().map(String::from))
        .ok_or_else(|| bad("mesaj nesemnat"))?;
    if body.get("kind").and_then(Value::as_str) != Some(kind) {
        return Err(bad("mesaj de alt tip decât cel așteptat"));
    }
    let key = body.get("key").and_then(Value::as_str).unwrap_or_default().to_string();
    let mut m = DOMAIN.to_vec();
    m.extend_from_slice(canon(&body).as_bytes());
    let ok = match (registry::parse_key(&key), registry::parse_sig(&sig)) {
        (Some(k), Some(s)) => identity::verify(&k, &m, &s),
        _ => false,
    };
    if !ok {
        return Err(bad(
            "semnătura mesajului nu se potrivește (mesaj modificat sau falsificat)",
        ));
    }
    Ok((body, key))
}

/// The organization this workspace belongs to (or asked to join).
fn my_org(store: &Store) -> CoreResult<String> {
    if let Some((id, _)) = registry::verify(store)?.org {
        return Ok(id.to_string());
    }
    match invites::join_anchor(store)? {
        Some((org, _)) => Ok(org),
        None => Err(bad("acest spațiu de lucru nu face parte dintr-o organizație")),
    }
}

/// The collection a decision collection (`<coll>~conflicts`, step 6.4)
/// belongs to; decisions travel and are checked like their collection.
fn base(coll: &str) -> &str {
    coll.split('~').next().unwrap_or(coll)
}

/// Which module a collection belongs to (`mod.<id>.<collection>`).
fn module_of(coll: &str) -> Option<&str> {
    base(coll).strip_prefix("mod.")?.rsplit_once('.').map(|(m, _)| m)
}

fn org_table(coll: &str) -> bool {
    ORG_TABLES.contains(&base(coll))
}

/// Collections that travel between devices; everything else is local.
fn shared(coll: &str) -> bool {
    coll == registry::REGISTRY_COLLECTION || org_table(coll) || module_of(coll).is_some()
}

/// Whether the device with key `key` may receive `coll`.
fn readable(st: &RegState, key: &str, coll: &str) -> bool {
    if coll == registry::REGISTRY_COLLECTION || org_table(coll) {
        return st.member_of(key).is_some();
    }
    match module_of(coll) {
        Some(m) => st.access(key, m) != Access::Niciunul,
        None => false,
    }
}

/// Step 1: what this device asks a peer for.
pub fn request(store: &Store, dev: &DeviceIdentity) -> CoreResult<Value> {
    let vv: BTreeMap<String, u64> = store
        .version_vector()
        .into_iter()
        .map(|(d, s)| (d.to_string(), s))
        .collect();
    let body = json!({
        "kind": "cerere", "v": 1, "org": my_org(store)?, "key": dev.public_hex(),
        "store": store.device(), "vv": vv, "unfilled": store.unfilled()?, "ts_ms": now_ms(),
    });
    Ok(sign(dev, &body))
}

/// Step 2: a peer's answer to a request.
pub fn answer(store: &Store, dev: &DeviceIdentity, req: &Value) -> CoreResult<Value> {
    let (body, key) = open(req, "cerere")?;
    let st = registry::verify(store)?;
    let org = st
        .org
        .as_ref()
        .ok_or_else(|| bad("acest PC nu are încă organizația; nu poate răspunde"))?;
    if body.get("org").and_then(Value::as_str) != Some(org.0.to_string().as_str()) {
        return Err(bad("cererea vine din altă organizație"));
    }
    let Some(d) = st.devices.get(&key).filter(|_| st.member_of(&key).is_some()) else {
        return Err(bad("cererea vine de la un dispozitiv care nu e aprobat în organizație"));
    };
    let store_id = body.get("store").and_then(Value::as_u64);
    if d.store.is_some() && d.store != store_id {
        return Err(bad("cererea vine dintr-un alt spațiu de lucru decât cel aprobat"));
    }
    let vv: VersionVector = body
        .get("vv")
        .and_then(Value::as_object)
        .map(|m| {
            m.iter()
                .filter_map(|(k, v)| Some((k.parse().ok()?, v.as_u64()?)))
                .collect()
        })
        .unwrap_or_default();
    let unfilled: Vec<(u64, u64)> = serde_json::from_value(body.get("unfilled").cloned().unwrap_or(json!([])))
        .map_err(|_| bad("cerere greșită"))?;
    let ops: Vec<Op> = store
        .changes_since(&vv)?
        .into_iter()
        .map(|op| {
            if is_redacted(&op) || (shared(&op.state.coll) && readable(&st, &key, &op.state.coll)) {
                op
            } else {
                redact(&op)
            }
        })
        .collect();
    let fills: Vec<Op> = store
        .changes_at(&unfilled)?
        .into_iter()
        .filter(|op| shared(&op.state.coll) && readable(&st, &key, &op.state.coll))
        .collect();
    let body = json!({
        "kind": "raspuns", "v": 1, "org": org.0.to_string(), "key": dev.public_hex(),
        "store": store.device(), "ops": ops, "fills": fills, "ts_ms": now_ms(),
    });
    Ok(sign(dev, &body))
}

/// What one round did, for the screen and the audit journal.
#[derive(Clone, Debug, Default, Serialize)]
pub struct Summary {
    pub primite: usize,
    pub create: usize,
    pub actualizate: usize,
    pub conflicte: usize,
    /// Changes this device may not see (markers).
    pub ascunse: usize,
    /// Changes refused because their author had no right to make them.
    pub refuzate: usize,
    pub completate: usize,
    pub motive: BTreeMap<String, usize>,
}

/// Step 3: applies a peer's answer.
pub fn apply(store: &mut Store, dev: &DeviceIdentity, resp: &Value) -> CoreResult<Summary> {
    let (body, key) = open(resp, "raspuns")?;
    let org = my_org(store)?;
    if body.get("org").and_then(Value::as_str) != Some(org.as_str()) {
        return Err(bad("răspunsul vine din altă organizație"));
    }
    let local = registry::verify(store)?;
    let trusted = match &local.org {
        Some(_) => local.member_of(&key).is_some(),
        // First round on a new PC: only the administrator who invited us.
        None => invites::join_anchor(store)?.is_some_and(|(_, admin)| admin == key),
    };
    if !trusted {
        return Err(bad(
            "răspunsul vine de la un dispozitiv care nu e aprobat în organizație",
        ));
    }
    let parse = |k: &str| -> CoreResult<Vec<Op>> {
        serde_json::from_value(body.get(k).cloned().unwrap_or(json!([]))).map_err(|_| bad("răspuns greșit"))
    };
    let (ops, fills) = (parse("ops")?, parse("fills")?);

    // The registry as it will be after this round: ours plus the incoming
    // entries (each one checks its own signature).
    let mut entries = registry::local_entries(store)?;
    for op in ops.iter().chain(&fills) {
        if op.state.coll == registry::REGISTRY_COLLECTION && !is_redacted(op) && !op.state.deleted {
            entries.push(op.state.fields.clone());
        }
    }
    let hist = registry::history(entries);
    let me = dev.public_hex();
    let mut sum = Summary {
        primite: ops.len() + fills.len(),
        ..Summary::default()
    };
    let reason = |sum: &mut Summary, r: &str| {
        sum.refuzate += 1;
        *sum.motive.entry(r.to_string()).or_default() += 1;
    };
    let check = |op: &Op, sum: &mut Summary| -> bool {
        if is_redacted(op) || op.origin.0 == store.device() {
            return true;
        }
        let coll = op.state.coll.as_str();
        if coll == registry::REGISTRY_COLLECTION {
            return true; // self-verifying: bad entries are ignored on replay
        }
        if !shared(coll) {
            reason(sum, "date locale ale altui PC");
            return false;
        }
        if !readable(&hist.last, &me, coll) {
            return false; // not for us (the sender should not have sent it)
        }
        let Some(author) = hist.last.key_of_store(op.origin.0) else {
            reason(sum, "autor necunoscut în registru");
            return false;
        };
        let when = op.state.rev.0 >> 16;
        let Some(then) = hist.at(when) else {
            reason(sum, "făcută înainte ca autorul să fie în organizație");
            return false;
        };
        let ok = if org_table(coll) {
            then.is_admin(author)
        } else {
            module_of(coll).is_some_and(|m| then.access(author, m) == Access::Scriere)
        };
        if !ok {
            reason(sum, "autorul nu avea dreptul să o facă");
        }
        ok
    };
    let ops: Vec<Op> = ops
        .into_iter()
        .map(|op| if check(&op, &mut sum) { op } else { redact(&op) })
        .collect();
    let fills: Vec<Op> = fills
        .into_iter()
        .filter(|op| !is_redacted(op) && check(op, &mut sum))
        .collect();
    let r: SyncReport = store.apply_remote(ops)?;
    let f = store.fill(fills)?;
    sum.create = r.created;
    sum.actualizate = r.fast_forward + r.merged;
    sum.conflicte = r.conflicts + f.conflicts;
    sum.ascunse = r.redacted.saturating_sub(sum.refuzate);
    sum.completate = f.filled;
    Ok(sum)
}

/// Fields of a record, for tests and diagnostics.
pub fn fields_of(store: &Store, coll: &str, id: uuid::Uuid) -> CoreResult<Option<Fields>> {
    Ok(store.get(coll, id)?.map(|r| r.fields))
}
