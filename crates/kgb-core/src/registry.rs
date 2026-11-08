//! The organization's signed membership registry (Etapa 6, step 6.2; D-058).
//!
//! Every change to who belongs to the organization — the organization itself,
//! roles, people, devices — is also written here as an entry signed with the
//! Ed25519 key of the device that made it, in the same atomic write as the
//! change. Replaying the entries gives the state every device can check on
//! its own, without a server:
//!
//! - the first entry creates the organization and is signed by the device it
//!   names as the first administrator's;
//! - every later entry counts only if its signer is, at that point, a device
//!   of an active person whose role is Administrator;
//! - an entry with a bad signature, or signed by anybody else, is ignored and
//!   reported.
//!
//! In step 6.3 a device accepts data only from devices this registry lists.
//! The local tables (`core.members`, `core.roles`) remain what the screens
//! read; [`consistency`] checks that they agree with the registry.

use std::collections::BTreeMap;

use ed25519_dalek::{Signature, VerifyingKey};
use kgb_store::{Fields, Store, Write};
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::identity::{self, DeviceIdentity};
use crate::org::{self, Access};
use crate::workspace::now_ms;

pub const REGISTRY_COLLECTION: &str = "core.registry";
const DOMAIN: &[u8] = b"KGB-REG1\n";

/// Canonical JSON: object keys sorted, no spaces. The same value always gives
/// the same bytes, whatever order the fields were stored in.
pub fn canon(v: &Value) -> String {
    match v {
        Value::Object(m) => {
            let mut keys: Vec<&String> = m.keys().collect();
            keys.sort();
            let parts: Vec<String> = keys
                .into_iter()
                .map(|k| format!("{}:{}", Value::String(k.clone()), canon(&m[k])))
                .collect();
            format!("{{{}}}", parts.join(","))
        }
        Value::Array(a) => format!("[{}]", a.iter().map(canon).collect::<Vec<_>>().join(",")),
        other => other.to_string(),
    }
}

fn message(kind: &str, payload: &Value, signer: &str, ts_ms: u64, seq: u64) -> Vec<u8> {
    let body = json!({"kind": kind, "payload": payload, "signer": signer, "ts_ms": ts_ms, "seq": seq});
    let mut m = DOMAIN.to_vec();
    m.extend_from_slice(canon(&body).as_bytes());
    m
}

/// Signed registry entries for `items` (kind, payload), to be written in the
/// same batch as the change they describe.
pub fn signed_writes(store: &Store, dev: &DeviceIdentity, items: Vec<(&str, Value)>) -> Vec<Write> {
    let ts = now_ms();
    let base = store.count(REGISTRY_COLLECTION) as u64;
    let signer = dev.public_hex();
    items
        .into_iter()
        .enumerate()
        .map(|(i, (kind, payload))| {
            let seq = base + i as u64;
            let sig = dev.sign(&message(kind, &payload, &signer, ts, seq));
            let mut f = Fields::new();
            f.insert("kind".into(), json!(kind));
            f.insert("payload".into(), payload);
            f.insert("signer".into(), json!(signer));
            f.insert("ts_ms".into(), json!(ts));
            f.insert("seq".into(), json!(seq));
            f.insert("sig".into(), json!(identity::hex(&sig.to_bytes())));
            Write::put(REGISTRY_COLLECTION, Uuid::now_v7(), f).expect(0)
        })
        .collect()
}

pub fn parse_key(hex: &str) -> Option<VerifyingKey> {
    let b: [u8; 32] = identity::unhex(hex)?.try_into().ok()?;
    VerifyingKey::from_bytes(&b).ok()
}

pub fn parse_sig(hex: &str) -> Option<Signature> {
    let b: [u8; 64] = identity::unhex(hex)?.try_into().ok()?;
    Some(Signature::from_bytes(&b))
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct RegRole {
    pub name: String,
    pub admin: bool,
    pub default: Access,
    pub modules: BTreeMap<String, Access>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct RegMember {
    pub name: String,
    pub role: Uuid,
    pub active: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct RegDevice {
    pub member: Uuid,
    pub label: String,
    pub fingerprint: String,
    pub revoked: bool,
}

/// What the registry says, after checking every signature.
#[derive(Clone, Debug, Default, Serialize)]
pub struct RegState {
    pub org: Option<(Uuid, String)>,
    pub roles: BTreeMap<Uuid, RegRole>,
    pub members: BTreeMap<Uuid, RegMember>,
    /// By public key (hex).
    pub devices: BTreeMap<String, RegDevice>,
    /// Entries that were ignored, and why.
    pub rejected: Vec<String>,
    pub accepted: usize,
}

impl RegState {
    /// The member using the device with public key `key`, if the device is
    /// listed, not revoked, and the member is active.
    pub fn member_of(&self, key: &str) -> Option<(Uuid, &RegMember)> {
        let d = self.devices.get(key).filter(|d| !d.revoked)?;
        let m = self.members.get(&d.member).filter(|m| m.active)?;
        Some((d.member, m))
    }

    pub fn is_admin(&self, key: &str) -> bool {
        self.member_of(key)
            .and_then(|(_, m)| self.roles.get(&m.role))
            .is_some_and(|r| r.admin)
    }
}

fn s(v: &Value, k: &str) -> String {
    v.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}
fn uid(v: &Value, k: &str) -> Option<Uuid> {
    v.get(k).and_then(Value::as_str)?.parse().ok()
}
fn access(v: &Value, k: &str) -> Option<Access> {
    serde_json::from_value(v.get(k)?.clone()).ok()
}
fn role_of(p: &Value) -> Option<RegRole> {
    Some(RegRole {
        name: s(p, "name"),
        admin: p.get("admin").and_then(Value::as_bool).unwrap_or(false),
        default: access(p, "default")?,
        modules: serde_json::from_value(p.get("modules").cloned().unwrap_or(json!({}))).ok()?,
    })
}

/// Replays the registry and checks every entry.
pub fn verify(store: &Store) -> CoreResult<RegState> {
    let mut entries: Vec<Fields> = store
        .scan(REGISTRY_COLLECTION, |_| true)?
        .into_iter()
        .map(|r| r.fields)
        .collect();
    let num = |f: &Fields, k: &str| f.get(k).and_then(Value::as_u64).unwrap_or(0);
    entries.sort_by(|a, b| {
        (num(a, "ts_ms"), num(a, "seq"), s(&json!(a), "signer")).cmp(&(num(b, "ts_ms"), num(b, "seq"), s(&json!(b), "signer")))
    });
    let mut st = RegState::default();
    for f in entries {
        let kind = f.get("kind").and_then(Value::as_str).unwrap_or_default().to_string();
        let payload = f.get("payload").cloned().unwrap_or(Value::Null);
        let signer = f.get("signer").and_then(Value::as_str).unwrap_or_default().to_string();
        let label = format!("{kind} ({})", num(&f, "ts_ms"));
        let ok_sig = match (parse_key(&signer), f.get("sig").and_then(Value::as_str).and_then(parse_sig)) {
            (Some(k), Some(sig)) => identity::verify(&k, &message(&kind, &payload, &signer, num(&f, "ts_ms"), num(&f, "seq")), &sig),
            _ => false,
        };
        if !ok_sig {
            st.rejected.push(format!("{label}: semnătură invalidă"));
            continue;
        }
        if kind == "organizatie" {
            if st.org.is_some() {
                st.rejected.push(format!("{label}: organizația există deja"));
                continue;
            }
            match apply_genesis(&mut st, &payload, &signer) {
                Ok(()) => st.accepted += 1,
                Err(e) => st.rejected.push(format!("{label}: {e}")),
            }
            continue;
        }
        if st.org.is_none() {
            st.rejected.push(format!("{label}: înainte de crearea organizației"));
            continue;
        }
        if !st.is_admin(&signer) {
            st.rejected.push(format!("{label}: semnat de un dispozitiv care nu e al unui administrator"));
            continue;
        }
        match apply(&mut st, &kind, &payload) {
            Ok(()) => st.accepted += 1,
            Err(e) => st.rejected.push(format!("{label}: {e}")),
        }
    }
    Ok(st)
}

fn apply_genesis(st: &mut RegState, p: &Value, signer: &str) -> Result<(), String> {
    let org = uid(p, "org").ok_or("lipsește organizația")?;
    let admin = p.get("admin").ok_or("lipsește administratorul")?;
    let member = uid(admin, "id").ok_or("lipsește persoana")?;
    if s(admin, "device") != signer {
        return Err("nu e semnată de dispozitivul primului administrator".into());
    }
    let roles = p.get("roles").and_then(Value::as_object).ok_or("lipsesc rolurile")?;
    let mut parsed = BTreeMap::new();
    for (id, r) in roles {
        parsed.insert(id.parse::<Uuid>().map_err(|_| "rol greșit")?, role_of(r).ok_or("rol greșit")?);
    }
    let role = uid(admin, "role").ok_or("lipsește rolul")?;
    if !parsed.get(&role).is_some_and(|r| r.admin) {
        return Err("primul administrator nu are rolul Administrator".into());
    }
    let key = parse_key(signer).ok_or("cheie greșită")?;
    st.org = Some((org, s(p, "name")));
    st.roles = parsed;
    st.members.insert(member, RegMember { name: s(admin, "name"), role, active: true });
    st.devices.insert(
        signer.to_string(),
        RegDevice { member, label: s(admin, "label"), fingerprint: identity::fingerprint(&key), revoked: false },
    );
    Ok(())
}

fn apply(st: &mut RegState, kind: &str, p: &Value) -> Result<(), String> {
    match kind {
        "redenumire" => {
            if let Some((_, n)) = &mut st.org {
                *n = s(p, "name");
            }
        }
        "rol" => {
            let id = uid(p, "id").ok_or("rol fără id")?;
            if p.get("deleted").and_then(Value::as_bool) == Some(true) {
                st.roles.remove(&id);
            } else {
                st.roles.insert(id, role_of(p).ok_or("rol greșit")?);
            }
        }
        "persoana" => {
            let id = uid(p, "id").ok_or("persoană fără id")?;
            let role = uid(p, "role").ok_or("persoană fără rol")?;
            if !st.roles.contains_key(&role) {
                return Err("rol necunoscut".into());
            }
            st.members.insert(
                id,
                RegMember { name: s(p, "name"), role, active: p.get("active").and_then(Value::as_bool).unwrap_or(false) },
            );
        }
        "dispozitiv" => {
            let member = uid(p, "member").ok_or("dispozitiv fără persoană")?;
            if !st.members.contains_key(&member) {
                return Err("persoană necunoscută".into());
            }
            let key_hex = s(p, "key");
            let key = parse_key(&key_hex).ok_or("cheie greșită")?;
            st.devices.insert(
                key_hex,
                RegDevice {
                    member,
                    label: s(p, "label"),
                    fingerprint: identity::fingerprint(&key),
                    revoked: p.get("revoked").and_then(Value::as_bool).unwrap_or(false),
                },
            );
        }
        other => return Err(format!("tip necunoscut „{other}”")),
    }
    Ok(())
}

/// Differences between the local tables and the registry (empty = they agree).
pub fn consistency(store: &Store) -> CoreResult<Vec<String>> {
    let st = verify(store)?;
    let mut out: Vec<String> = st.rejected.clone();
    let org = org::organization(store)?;
    match (&org, &st.org) {
        (None, None) => return Ok(out),
        (Some(o), Some((_, n))) if &o.name == n => {}
        _ => out.push("organizația diferă de registru".into()),
    }
    for r in org::roles(store)? {
        let want = RegRole { name: r.name.clone(), admin: r.admin, default: r.default, modules: r.modules.clone() };
        if st.roles.get(&r.id) != Some(&want) {
            out.push(format!("rolul „{}” diferă de registru", r.name));
        }
    }
    if org::roles(store)?.len() != st.roles.len() {
        out.push("numărul de roluri diferă de registru".into());
    }
    for m in org::members(store, true)? {
        let want = RegMember { name: m.name.clone(), role: m.role, active: m.active };
        if st.members.get(&m.id) != Some(&want) {
            out.push(format!("persoana „{}” diferă de registru", m.name));
        }
        for fp in &m.devices {
            if !st.devices.values().any(|d| &d.fingerprint == fp && d.member == m.id && !d.revoked) {
                out.push(format!("un dispozitiv al lui „{}” lipsește din registru", m.name));
            }
        }
    }
    Ok(out)
}

/// Payload helpers used by `org` so the registry and the tables say the same.
pub fn role_payload(id: Uuid, r: &RegRole) -> Value {
    json!({"id": id.to_string(), "name": r.name, "admin": r.admin, "default": r.default, "modules": r.modules})
}

pub fn invalid(detail: &str) -> CoreError {
    CoreError::invalid("registrul organizației", detail)
}
