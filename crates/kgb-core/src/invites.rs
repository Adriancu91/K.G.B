//! Invitations and device approval (Etapa 6, step 6.2; Master Plan §8.5).
//!
//! 1. An administrator invites a person: the invitation is a text code with a
//!    random one-time token, an expiry, the organization and the inviting
//!    administrator's public key, signed by that device. **It contains no
//!    private key and no permanent credential.** Only a hash of the token is
//!    kept on the administrator's PC.
//! 2. On the new PC, K.G.B. checks the code and answers with a **request**:
//!    the token, the new device's public key and name, signed with the new
//!    device's own key (generated on that PC, never leaving it).
//! 3. The administrator's PC accepts a request only for a valid, unexpired,
//!    unused invitation, with a correct signature; the invitation is then used
//!    up, in the same write. The device waits for approval.
//! 4. The administrator compares the fingerprint shown on both PCs and
//!    approves (or refuses). Approval adds the device to the person, signed
//!    in the registry (D-058).
//!
//! The codes travel however the people choose (message, e-mail, USB) until
//! the network transport arrives in step 6.5. A leaked invitation is useless
//! once used or expired, and a request still needs the administrator's
//! approval.

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use kgb_store::{Fields, Store, Write};
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::identity::{self, DeviceIdentity};
use crate::org;
use crate::registry::{self, canon};
use crate::workspace::{now_ms, validate_name};

pub const INVITES_COLLECTION: &str = "core.invitations";
pub const REQUESTS_COLLECTION: &str = "core.device_requests";
const INVITE_PREFIX: &str = "KGB-INVITATIE-1:";
const REQUEST_PREFIX: &str = "KGB-CERERE-1:";
const INVITE_DOMAIN: &[u8] = b"KGB-INV1\n";
const REQUEST_DOMAIN: &[u8] = b"KGB-REQ1\n";
pub const MAX_HOURS: u64 = 7 * 24;
const HOUR_MS: u64 = 3_600_000;

fn bad(what: &str, detail: impl Into<String>) -> CoreError {
    CoreError::invalid(what, detail)
}

fn sign(dev: &DeviceIdentity, domain: &[u8], body: &Value) -> String {
    let mut m = domain.to_vec();
    m.extend_from_slice(canon(body).as_bytes());
    identity::hex(&dev.sign(&m).to_bytes())
}

fn check_sig(domain: &[u8], body: &Value, key_hex: &str, sig_hex: &str) -> bool {
    let mut m = domain.to_vec();
    m.extend_from_slice(canon(body).as_bytes());
    match (registry::parse_key(key_hex), registry::parse_sig(sig_hex)) {
        (Some(k), Some(s)) => identity::verify(&k, &m, &s),
        _ => false,
    }
}

fn encode(prefix: &str, body: &Value, sig: String) -> String {
    let mut v = body.clone();
    v["sig"] = json!(sig);
    format!("{prefix}{}", URL_SAFE_NO_PAD.encode(canon(&v)))
}

/// Splits a code into (body without `sig`, sig).
fn decode(prefix: &str, what: &str, code: &str) -> CoreResult<(Value, String)> {
    let raw = code.trim();
    let b64 = raw
        .strip_prefix(prefix)
        .ok_or_else(|| bad(what, "codul nu e recunoscut (lipsește începutul sau e alt tip de cod)"))?;
    let bytes = URL_SAFE_NO_PAD
        .decode(b64.trim())
        .map_err(|_| bad(what, "codul e incomplet sau a fost modificat"))?;
    let mut v: Value = serde_json::from_slice(&bytes).map_err(|_| bad(what, "codul e incomplet sau a fost modificat"))?;
    let sig = v
        .as_object_mut()
        .and_then(|o| o.remove("sig"))
        .and_then(|s| s.as_str().map(String::from))
        .ok_or_else(|| bad(what, "codul nu e semnat"))?;
    Ok((v, sig))
}

fn s(v: &Value, k: &str) -> String {
    v.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn token_hash(token: &str) -> String {
    blake3::hash(token.as_bytes()).to_hex().to_string()
}

fn org_uuid(store: &Store) -> CoreResult<(Uuid, String)> {
    registry::verify(store)?
        .org
        .ok_or_else(|| bad("organizația", "nu există; creeaz-o întâi"))
}

/// A new invitation (shown once to the administrator).
#[derive(Clone, Debug, Serialize)]
pub struct NewInvite {
    pub id: Uuid,
    pub code: String,
    pub member: String,
    pub expires_ms: u64,
}

/// Invites `member_id` for `hours` (1 … 168).
pub fn create(store: &mut Store, dev: &DeviceIdentity, member_id: Uuid, hours: u64) -> CoreResult<NewInvite> {
    if !(1..=MAX_HOURS).contains(&hours) {
        return Err(bad("invitația", format!("valabilitatea trebuie să fie între 1 și {MAX_HOURS} de ore")));
    }
    create_until(store, dev, member_id, now_ms() + hours * HOUR_MS)
}

/// Same as [`create`] with an exact expiry (tests use one in the past).
#[doc(hidden)]
pub fn create_until(store: &mut Store, dev: &DeviceIdentity, member_id: Uuid, expires_ms: u64) -> CoreResult<NewInvite> {
    org::require_admin(store, Some(&dev.fingerprint()), "invitația")?;
    let (org_id, org_name) = org_uuid(store)?;
    let m = org::member_by_id(store, member_id)?;
    if !m.active {
        return Err(bad("invitația", "persoana a fost scoasă din organizație"));
    }
    let mut t = [0u8; 16];
    getrandom::fill(&mut t).map_err(|e| bad("generatorul de numere aleatoare", e.to_string()))?;
    let token = identity::hex(&t);
    let id = Uuid::new_v4();
    let body = json!({
        "v": 1, "org": org_id.to_string(), "org_name": org_name, "member": m.name,
        "token": token, "expires_ms": expires_ms, "admin_key": dev.public_hex(),
    });
    let code = encode(INVITE_PREFIX, &body, sign(dev, INVITE_DOMAIN, &body));
    let mut f = Fields::new();
    f.insert("member".into(), json!(member_id.to_string()));
    f.insert("token_hash".into(), json!(token_hash(&token)));
    f.insert("expires_ms".into(), json!(expires_ms));
    f.insert("used".into(), json!(false));
    f.insert("created_ms".into(), json!(now_ms()));
    store.write(vec![Write::put(INVITES_COLLECTION, id, f).expect(0)])?;
    Ok(NewInvite { id, code, member: m.name, expires_ms })
}

/// An invitation as the administrator sees it later (never the token).
#[derive(Clone, Debug, Serialize)]
pub struct InviteView {
    pub id: Uuid,
    pub member: String,
    pub expires_ms: u64,
    /// "activă", "folosită" or "expirată".
    pub stare: String,
}

pub fn list(store: &Store) -> CoreResult<Vec<InviteView>> {
    let now = now_ms();
    let mut v: Vec<InviteView> = store
        .scan(INVITES_COLLECTION, |_| true)?
        .into_iter()
        .map(|r| {
            let f = &r.fields;
            let exp = f.get("expires_ms").and_then(Value::as_u64).unwrap_or(0);
            let used = f.get("used").and_then(Value::as_bool).unwrap_or(false);
            let member = s(&json!(f), "member")
                .parse()
                .ok()
                .and_then(|id| org::member_by_id(store, id).ok())
                .map(|m| m.name)
                .unwrap_or_default();
            InviteView {
                id: r.id,
                member,
                expires_ms: exp,
                stare: if used { "folosită" } else if exp <= now { "expirată" } else { "activă" }.into(),
            }
        })
        .collect();
    v.sort_by_key(|i| std::cmp::Reverse(i.expires_ms));
    Ok(v)
}

/// Cancels an unused invitation.
pub fn cancel(store: &mut Store, dev: &DeviceIdentity, id: Uuid) -> CoreResult<()> {
    org::require_admin(store, Some(&dev.fingerprint()), "invitația")?;
    let r = store.get(INVITES_COLLECTION, id)?.ok_or_else(|| bad("invitația", "nu există"))?;
    store.write(vec![Write::delete(INVITES_COLLECTION, id).expect(r.version)])?;
    Ok(())
}

/// What the new PC learns from an invitation, after checking it.
#[derive(Clone, Debug, Serialize)]
pub struct InviteInfo {
    pub org_name: String,
    pub member: String,
    pub expires_ms: u64,
    /// Fingerprint of the administrator's PC that signed the invitation.
    pub admin_fingerprint: String,
}

fn read_body(code: &str, now: u64) -> CoreResult<(Value, InviteInfo)> {
    let (body, sig) = decode(INVITE_PREFIX, "invitația", code)?;
    let admin_key = s(&body, "admin_key");
    if !check_sig(INVITE_DOMAIN, &body, &admin_key, &sig) {
        return Err(bad("invitația", "semnătura nu se potrivește: codul a fost modificat"));
    }
    if body.get("v").and_then(Value::as_u64) != Some(1) || s(&body, "token").len() != 32 {
        return Err(bad("invitația", "format necunoscut"));
    }
    let expires_ms = body.get("expires_ms").and_then(Value::as_u64).unwrap_or(0);
    if expires_ms <= now {
        return Err(bad("invitația", "a expirat; cere administratorului una nouă"));
    }
    let key = registry::parse_key(&admin_key).ok_or_else(|| bad("invitația", "cheie greșită"))?;
    let info = InviteInfo {
        org_name: s(&body, "org_name"),
        member: s(&body, "member"),
        expires_ms,
        admin_fingerprint: identity::fingerprint(&key),
    };
    Ok((body, info))
}

/// Checks an invitation on the new PC (signature, format, expiry).
pub fn read(code: &str) -> CoreResult<InviteInfo> {
    Ok(read_body(code, now_ms())?.1)
}

/// The new PC's answer to an invitation, to send back to the administrator.
#[derive(Clone, Debug, Serialize)]
pub struct JoinRequest {
    pub code: String,
    pub info: InviteInfo,
    /// This PC's fingerprint: the administrator must see the same one.
    pub fingerprint: String,
}

pub fn request(invite_code: &str, dev: &DeviceIdentity, device_label: &str) -> CoreResult<JoinRequest> {
    let (inv, info) = read_body(invite_code, now_ms())?;
    let label = validate_name("numele dispozitivului", device_label)?;
    let body = json!({
        "v": 1, "org": s(&inv, "org"), "token": s(&inv, "token"),
        "key": dev.public_hex(), "label": label, "ts_ms": now_ms(),
    });
    Ok(JoinRequest {
        code: encode(REQUEST_PREFIX, &body, sign(dev, REQUEST_DOMAIN, &body)),
        info,
        fingerprint: dev.fingerprint(),
    })
}

/// A device waiting for the administrator's approval.
#[derive(Clone, Debug, Serialize)]
pub struct Pending {
    pub id: Uuid,
    pub member_id: Uuid,
    pub member: String,
    pub label: String,
    pub fingerprint: String,
    pub received_ms: u64,
    pub version: u64,
}

/// Accepts a request on the administrator's PC: valid signature, matching
/// organization, an unexpired and unused invitation. The invitation is used
/// up in the same write; the device waits for approval.
pub fn receive(store: &mut Store, dev: &DeviceIdentity, request_code: &str) -> CoreResult<Pending> {
    org::require_admin(store, Some(&dev.fingerprint()), "cererea")?;
    let (body, sig) = decode(REQUEST_PREFIX, "cererea", request_code)?;
    let key = s(&body, "key");
    if !check_sig(REQUEST_DOMAIN, &body, &key, &sig) {
        return Err(bad("cererea", "semnătura nu se potrivește: codul a fost modificat"));
    }
    let (org_id, _) = org_uuid(store)?;
    if s(&body, "org") != org_id.to_string() {
        return Err(bad("cererea", "este pentru altă organizație"));
    }
    let hash = token_hash(&s(&body, "token"));
    let inv = store
        .scan(INVITES_COLLECTION, |r| r.fields.get("token_hash").and_then(Value::as_str) == Some(hash.as_str()))?
        .into_iter()
        .next()
        .ok_or_else(|| bad("cererea", "invitația nu există (anulată sau din alt spațiu de lucru)"))?;
    if inv.fields.get("used").and_then(Value::as_bool) == Some(true) {
        return Err(bad("cererea", "invitația a fost deja folosită"));
    }
    if inv.fields.get("expires_ms").and_then(Value::as_u64).unwrap_or(0) <= now_ms() {
        return Err(bad("cererea", "invitația a expirat"));
    }
    let pk = registry::parse_key(&key).ok_or_else(|| bad("cererea", "cheie greșită"))?;
    let fingerprint = identity::fingerprint(&pk);
    if registry::verify(store)?.devices.contains_key(&key) {
        return Err(bad("cererea", "dispozitivul face deja parte din organizație"));
    }
    let member_id: Uuid = s(&json!(inv.fields), "member")
        .parse()
        .map_err(|_| bad("invitația", "persoană lipsă"))?;
    let member = org::member_by_id(store, member_id)?;
    let label = validate_name("numele dispozitivului", &s(&body, "label"))?;
    let mut used = inv.fields.clone();
    used.insert("used".into(), json!(true));
    let id = Uuid::new_v4();
    let received_ms = now_ms();
    let mut f = Fields::new();
    f.insert("member".into(), json!(member_id.to_string()));
    f.insert("key".into(), json!(key));
    f.insert("label".into(), json!(label));
    f.insert("fingerprint".into(), json!(fingerprint));
    f.insert("received_ms".into(), json!(received_ms));
    store.write(vec![
        Write::put(INVITES_COLLECTION, inv.id, used).expect(inv.version),
        Write::put(REQUESTS_COLLECTION, id, f).expect(0),
    ])?;
    Ok(Pending { id, member_id, member: member.name, label, fingerprint, received_ms, version: 1 })
}

pub fn pending(store: &Store) -> CoreResult<Vec<Pending>> {
    let mut v: Vec<Pending> = store
        .scan(REQUESTS_COLLECTION, |_| true)?
        .into_iter()
        .map(|r| {
            let f = json!(r.fields);
            let member_id: Uuid = s(&f, "member").parse().unwrap_or_default();
            Pending {
                id: r.id,
                member_id,
                member: org::member_by_id(store, member_id).map(|m| m.name).unwrap_or_default(),
                label: s(&f, "label"),
                fingerprint: s(&f, "fingerprint"),
                received_ms: f.get("received_ms").and_then(Value::as_u64).unwrap_or(0),
                version: r.version,
            }
        })
        .collect();
    v.sort_by_key(|p| p.received_ms);
    Ok(v)
}

/// Approves a waiting device: it joins the person, signed in the registry.
pub fn approve(store: &mut Store, dev: &DeviceIdentity, id: Uuid) -> CoreResult<()> {
    let r = store.get(REQUESTS_COLLECTION, id)?.ok_or_else(|| bad("cererea", "nu există"))?;
    let f = json!(r.fields);
    let member: Uuid = s(&f, "member").parse().map_err(|_| bad("cererea", "persoană lipsă"))?;
    org::add_device(
        store,
        dev,
        member,
        &s(&f, "key"),
        &s(&f, "label"),
        vec![Write::delete(REQUESTS_COLLECTION, id).expect(r.version)],
    )
}

/// Refuses a waiting device (its invitation stays used).
pub fn refuse(store: &mut Store, dev: &DeviceIdentity, id: Uuid) -> CoreResult<()> {
    org::require_admin(store, Some(&dev.fingerprint()), "cererea")?;
    let r = store.get(REQUESTS_COLLECTION, id)?.ok_or_else(|| bad("cererea", "nu există"))?;
    store.write(vec![Write::delete(REQUESTS_COLLECTION, id).expect(r.version)])?;
    Ok(())
}
