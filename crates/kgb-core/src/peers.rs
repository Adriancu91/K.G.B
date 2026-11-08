//! The address book of the organization's other devices (Etapa 6, step 6.5).
//!
//! Local to this PC (never synchronised): where each device was last seen on
//! the network, and how the last synchronisation with it went. Addresses are
//! learned from the invitation (the administrator's), from the join request
//! (the new PC's) and from every signed synchronisation message.

use kgb_store::{Fields, Store, Write};
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::error::CoreResult;
use crate::registry;
use crate::workspace::now_ms;

pub const PEERS_COLLECTION: &str = "core.peers";

fn id(key: &str) -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_OID, format!("kgb-peer:{key}").as_bytes())
}

fn s(f: &Fields, k: &str) -> String {
    f.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn update(store: &mut Store, key: &str, f: impl FnOnce(&mut Fields)) -> CoreResult<()> {
    let (mut fields, v) = match store.get(PEERS_COLLECTION, id(key))? {
        Some(r) => (r.fields.clone(), r.version),
        None => {
            let mut f = Fields::new();
            f.insert("key".into(), json!(key));
            (f, 0)
        }
    };
    f(&mut fields);
    store.write(vec![Write::put(PEERS_COLLECTION, id(key), fields).expect(v)])?;
    Ok(())
}

/// Remembers where the device with `key` can be reached.
pub fn remember(store: &mut Store, key: &str, addr: &str) -> CoreResult<()> {
    if key.is_empty() || addr.is_empty() {
        return Ok(());
    }
    if store
        .get(PEERS_COLLECTION, id(key))?
        .is_some_and(|r| r.fields.get("addr").and_then(Value::as_str) == Some(addr))
    {
        return Ok(());
    }
    update(store, key, |f| {
        f.insert("addr".into(), json!(addr));
    })
}

/// Records how a synchronisation with `key` went.
pub fn record(store: &mut Store, key: &str, result: Result<&str, &str>) -> CoreResult<()> {
    update(store, key, |f| {
        f.insert("tried_ms".into(), json!(now_ms()));
        match result {
            Ok(path) => {
                f.insert("ok_ms".into(), json!(now_ms()));
                f.insert("path".into(), json!(path));
                f.insert("error".into(), Value::Null);
            }
            Err(e) => {
                f.insert("error".into(), json!(e.chars().take(300).collect::<String>()));
            }
        }
    })
}

/// One of the organization's other devices, as the screen shows it.
#[derive(Clone, Debug, Serialize)]
pub struct PeerView {
    pub key: String,
    pub fingerprint: String,
    pub label: String,
    pub member: String,
    /// Known network address (iroh JSON), if any.
    pub addr: Option<String>,
    /// Last successful synchronisation and how it travelled ("direct"/"relay").
    pub ok_ms: Option<u64>,
    pub path: Option<String>,
    pub tried_ms: Option<u64>,
    /// Error of the last attempt, if it failed.
    pub error: Option<String>,
}

/// The organization's devices other than `me` (public key hex), with what
/// this PC knows about reaching them.
pub fn list(store: &Store, me: &str) -> CoreResult<Vec<PeerView>> {
    let st = registry::verify(store)?;
    let mut out = Vec::new();
    // A new PC before its first synchronisation knows only the administrator
    // who invited it (the invitation's key and address).
    if st.org.is_none() {
        if let Some((_, admin)) = crate::invites::join_anchor(store)? {
            let f = store
                .get(PEERS_COLLECTION, id(&admin))?
                .map(|r| r.fields)
                .unwrap_or_default();
            let opt = |k: &str| Some(s(&f, k)).filter(|v| !v.is_empty());
            out.push(PeerView {
                fingerprint: registry::parse_key(&admin)
                    .map(|k| crate::identity::fingerprint(&k))
                    .unwrap_or_default(),
                key: admin,
                label: "calculatorul care te-a invitat".into(),
                member: "administratorul".into(),
                addr: opt("addr"),
                ok_ms: f.get("ok_ms").and_then(Value::as_u64),
                path: opt("path"),
                tried_ms: f.get("tried_ms").and_then(Value::as_u64),
                error: opt("error"),
            });
        }
        return Ok(out);
    }
    for (key, d) in &st.devices {
        if key == me || st.member_of(key).is_none() {
            continue;
        }
        let f = store
            .get(PEERS_COLLECTION, id(key))?
            .map(|r| r.fields)
            .unwrap_or_default();
        let opt = |k: &str| Some(s(&f, k)).filter(|v| !v.is_empty());
        out.push(PeerView {
            key: key.clone(),
            fingerprint: d.fingerprint.clone(),
            label: d.label.clone(),
            member: st.members.get(&d.member).map(|m| m.name.clone()).unwrap_or_default(),
            addr: opt("addr"),
            ok_ms: f.get("ok_ms").and_then(Value::as_u64),
            path: opt("path"),
            tried_ms: f.get("tried_ms").and_then(Value::as_u64),
            error: opt("error"),
        });
    }
    out.sort_by(|a, b| (&a.member, &a.label).cmp(&(&b.member, &b.label)));
    Ok(out)
}

/// This PC's network settings (local, never synchronised).
pub const NETWORK_COLLECTION: &str = "core.network";

fn network_id() -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_OID, b"kgb-network")
}

/// (relay, port): relay is "off" (direct connections only, the default),
/// "n0" (public relay, tests only, D-017) or a relay URL; port 0 = any.
pub fn network_settings(store: &Store) -> CoreResult<(String, u16)> {
    let f = store
        .get(NETWORK_COLLECTION, network_id())?
        .map(|r| r.fields)
        .unwrap_or_default();
    let relay = Some(s(&f, "relay"))
        .filter(|r| !r.is_empty())
        .unwrap_or_else(|| "off".into());
    let port = f.get("port").and_then(Value::as_u64).unwrap_or(0) as u16;
    Ok((relay, port))
}

pub fn save_network_settings(store: &mut Store, relay: &str, port: u16) -> CoreResult<()> {
    let relay = relay.trim();
    if !(relay == "off" || relay == "n0" || relay.starts_with("https://")) {
        return Err(crate::error::CoreError::invalid(
            "relay-ul",
            "alege „fără relay”, relay-ul public de test sau o adresă https://",
        ));
    }
    let v = store
        .get(NETWORK_COLLECTION, network_id())?
        .map(|r| r.version)
        .unwrap_or(0);
    let mut f = Fields::new();
    f.insert("relay".into(), json!(relay));
    f.insert("port".into(), json!(port));
    store.write(vec![Write::put(NETWORK_COLLECTION, network_id(), f).expect(v)])?;
    Ok(())
}
