//! Organization, people and roles (Etapa 6, step 6.1; decision D-056).
//!
//! - A workspace without an organization is a single-person workspace: the
//!   local user can do everything, exactly as before Etapa 6.
//! - The first administrator creates the organization; this PC becomes that
//!   administrator's device. Three built-in roles exist: Administrator (all
//!   modules, plus the organization itself), Membru (writes in the working
//!   modules, no Business) and Doar citire (reads everything, writes nothing).
//!   Custom roles give each module "fără acces", "citire" or "scriere".
//! - The role is applied in one place, the module call: a role without access
//!   cannot open the module; a read-only role gets a context whose writes are
//!   refused (see `ModuleContext`).
//! - The organization never loses its last administrator: removing or
//!   demoting them is refused.
//!
//! Devices join members through invitations in step 6.2; here a member may
//! have no device yet.

use std::collections::BTreeMap;

use kgb_store::{Fields, RecordState, Store, Write};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::identity::DeviceIdentity;
use crate::registry::{self, RegRole};
use crate::workspace::{now_ms, validate_name};

pub const ORG_COLLECTION: &str = "core.org";
pub const ROLES_COLLECTION: &str = "core.roles";
pub const MEMBERS_COLLECTION: &str = "core.members";

fn fixed(name: &str) -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_OID, format!("kgb-org:{name}").as_bytes())
}
pub fn org_id() -> Uuid {
    fixed("organization")
}
pub fn role_admin() -> Uuid {
    fixed("role:admin")
}
pub fn role_member() -> Uuid {
    fixed("role:membru")
}
pub fn role_reader() -> Uuid {
    fixed("role:citire")
}

/// Modules the built-in Membru role cannot open (financial data).
const MEMBER_NO_ACCESS: &[&str] = &["kgb.business"];

/// What a role may do in one module.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Access {
    /// "fără acces": the module does not open.
    Niciunul,
    /// "citire": the module opens, every write is refused.
    Citire,
    /// "scriere": full use.
    Scriere,
}

impl Access {
    pub fn label(self) -> &'static str {
        match self {
            Access::Niciunul => "fără acces",
            Access::Citire => "doar citire",
            Access::Scriere => "scriere",
        }
    }
    fn parse(v: &Value) -> Option<Access> {
        serde_json::from_value(v.clone()).ok()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Organization {
    pub name: String,
    pub created_ms: u64,
    pub version: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Role {
    pub id: Uuid,
    pub name: String,
    pub builtin: bool,
    /// Administrators manage the organization (people, roles, devices).
    pub admin: bool,
    /// Access for modules not listed in `modules`.
    pub default: Access,
    pub modules: BTreeMap<String, Access>,
    pub version: u64,
}

impl Role {
    pub fn access(&self, module: &str) -> Access {
        if self.admin {
            return Access::Scriere;
        }
        self.modules.get(module).copied().unwrap_or(self.default)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Member {
    pub id: Uuid,
    pub name: String,
    pub role: Uuid,
    /// Fingerprints of the member's devices.
    pub devices: Vec<String>,
    pub active: bool,
    pub created_ms: u64,
    pub version: u64,
}

/// Who is using this PC, with the role that applies.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Current {
    pub member: Member,
    pub role: Role,
}

fn s(f: &Fields, k: &str) -> String {
    f.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn role_from(r: &RecordState) -> Role {
    let f = &r.fields;
    Role {
        id: r.id,
        name: s(f, "name"),
        builtin: f.get("builtin").and_then(Value::as_bool).unwrap_or(false),
        admin: f.get("admin").and_then(Value::as_bool).unwrap_or(false),
        default: f.get("default").and_then(Access::parse).unwrap_or(Access::Niciunul),
        modules: f
            .get("modules")
            .and_then(Value::as_object)
            .map(|m| {
                m.iter()
                    .filter_map(|(k, v)| Access::parse(v).map(|a| (k.clone(), a)))
                    .collect()
            })
            .unwrap_or_default(),
        version: r.version,
    }
}

fn member_from(r: &RecordState) -> Member {
    let f = &r.fields;
    Member {
        id: r.id,
        name: s(f, "name"),
        role: s(f, "role").parse().unwrap_or_default(),
        devices: f
            .get("devices")
            .and_then(Value::as_array)
            .map(|a| a.iter().filter_map(Value::as_str).map(String::from).collect())
            .unwrap_or_default(),
        active: f.get("active").and_then(Value::as_bool).unwrap_or(false),
        created_ms: f.get("created_ms").and_then(Value::as_u64).unwrap_or_default(),
        version: r.version,
    }
}

fn role_fields(name: &str, builtin: bool, admin: bool, default: Access, modules: &BTreeMap<String, Access>) -> Fields {
    let mut f = Fields::new();
    f.insert("name".into(), json!(name));
    f.insert("builtin".into(), json!(builtin));
    f.insert("admin".into(), json!(admin));
    f.insert("default".into(), json!(default));
    f.insert("modules".into(), json!(modules));
    f
}

fn member_payload(m: &Member) -> Value {
    json!({"id": m.id.to_string(), "name": m.name, "role": m.role.to_string(), "active": m.active})
}

fn reg_role(name: &str, admin: bool, default: Access, modules: &BTreeMap<String, Access>) -> RegRole {
    RegRole {
        name: name.into(),
        admin,
        default,
        modules: modules.clone(),
    }
}

/// Signer check shared by every change: the device must be an administrator's.
fn signer_admin(store: &Store, dev: &DeviceIdentity) -> CoreResult<()> {
    require_admin(store, Some(&dev.fingerprint()), "organizația")
}

fn member_fields(m: &Member) -> Fields {
    let mut f = Fields::new();
    f.insert("name".into(), json!(m.name));
    f.insert("role".into(), json!(m.role.to_string()));
    f.insert("devices".into(), json!(m.devices));
    f.insert("active".into(), json!(m.active));
    f.insert("created_ms".into(), json!(m.created_ms));
    f
}

pub fn organization(store: &Store) -> CoreResult<Option<Organization>> {
    Ok(store.get(ORG_COLLECTION, org_id())?.map(|r| Organization {
        name: s(&r.fields, "name"),
        created_ms: r.fields.get("created_ms").and_then(Value::as_u64).unwrap_or_default(),
        version: r.version,
    }))
}

pub fn roles(store: &Store) -> CoreResult<Vec<Role>> {
    let mut v: Vec<Role> = store.scan(ROLES_COLLECTION, |_| true)?.iter().map(role_from).collect();
    // Built-in first (admin, member, reader), then custom by name.
    let rank = |r: &Role| {
        if r.id == role_admin() {
            0
        } else if r.id == role_member() {
            1
        } else if r.id == role_reader() {
            2
        } else {
            3
        }
    };
    v.sort_by(|a, b| {
        rank(a)
            .cmp(&rank(b))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(v)
}

pub fn role(store: &Store, id: Uuid) -> CoreResult<Role> {
    store
        .get(ROLES_COLLECTION, id)?
        .map(|r| role_from(&r))
        .ok_or_else(|| CoreError::invalid("rolul", "nu există"))
}

pub fn members(store: &Store, include_removed: bool) -> CoreResult<Vec<Member>> {
    let mut v: Vec<Member> = store
        .scan(MEMBERS_COLLECTION, |_| true)?
        .iter()
        .map(member_from)
        .filter(|m| include_removed || m.active)
        .collect();
    v.sort_by(|a, b| {
        a.name
            .to_lowercase()
            .cmp(&b.name.to_lowercase())
            .then(a.created_ms.cmp(&b.created_ms))
    });
    Ok(v)
}

fn member(store: &Store, id: Uuid) -> CoreResult<Member> {
    store
        .get(MEMBERS_COLLECTION, id)?
        .map(|r| member_from(&r))
        .ok_or_else(|| CoreError::invalid("persoana", "nu există"))
}

/// Creates the organization: built-in roles and the first administrator,
/// whose device is this PC. Refused if an organization already exists.
pub fn create(
    store: &mut Store,
    name: &str,
    admin_name: &str,
    dev: &DeviceIdentity,
    device_label: &str,
) -> CoreResult<Uuid> {
    let fingerprint = dev.fingerprint();
    let fingerprint = fingerprint.as_str();
    if organization(store)?.is_some() {
        return Err(CoreError::invalid(
            "organizația",
            "există deja în acest spațiu de lucru",
        ));
    }
    let name = validate_name("numele organizației", name)?;
    let admin_name = validate_name("numele administratorului", admin_name)?;
    if fingerprint.trim().is_empty() {
        return Err(CoreError::invalid("dispozitivul", "amprenta lipsește"));
    }
    let now = now_ms();
    let mut org = Fields::new();
    org.insert("name".into(), json!(name));
    org.insert("created_ms".into(), json!(now));
    let none = BTreeMap::new();
    let member_limits: BTreeMap<String, Access> = MEMBER_NO_ACCESS
        .iter()
        .map(|m| (m.to_string(), Access::Niciunul))
        .collect();
    let admin = Member {
        id: Uuid::new_v4(),
        name: admin_name,
        role: role_admin(),
        devices: vec![fingerprint.to_string()],
        active: true,
        created_ms: now,
        version: 0,
    };
    let roles = json!({
        role_admin().to_string(): registry::role_payload(role_admin(), &reg_role("Administrator", true, Access::Scriere, &none)),
        role_member().to_string(): registry::role_payload(role_member(), &reg_role("Membru", false, Access::Scriere, &member_limits)),
        role_reader().to_string(): registry::role_payload(role_reader(), &reg_role("Doar citire", false, Access::Citire, &none)),
    });
    let genesis = json!({
        "org": Uuid::new_v4().to_string(),
        "name": name,
        "roles": roles,
        "admin": {"id": admin.id.to_string(), "name": admin.name, "role": role_admin().to_string(),
                  "device": dev.public_hex(), "label": validate_name("numele dispozitivului", device_label)?,
                  "store": store.device()},
    });
    let mut batch = registry::signed_writes(store, dev, vec![("organizatie", genesis)]);
    batch.extend([
        Write::put(ORG_COLLECTION, org_id(), org).expect(0),
        Write::put(
            ROLES_COLLECTION,
            role_admin(),
            role_fields("Administrator", true, true, Access::Scriere, &none),
        )
        .expect(0),
        Write::put(
            ROLES_COLLECTION,
            role_member(),
            role_fields("Membru", true, false, Access::Scriere, &member_limits),
        )
        .expect(0),
        Write::put(
            ROLES_COLLECTION,
            role_reader(),
            role_fields("Doar citire", true, false, Access::Citire, &none),
        )
        .expect(0),
        Write::put(MEMBERS_COLLECTION, admin.id, member_fields(&admin)).expect(0),
    ]);
    store.write(batch)?;
    Ok(admin.id)
}

/// Renames the organization.
pub fn rename(store: &mut Store, dev: &DeviceIdentity, name: &str, expected_version: u64) -> CoreResult<u64> {
    signer_admin(store, dev)?;
    let org = organization(store)?.ok_or_else(|| CoreError::invalid("organizația", "nu există"))?;
    let name = validate_name("numele organizației", name)?;
    let mut f = Fields::new();
    f.insert("name".into(), json!(name));
    f.insert("created_ms".into(), json!(org.created_ms));
    let mut batch = vec![Write::put(ORG_COLLECTION, org_id(), f).expect(expected_version)];
    batch.extend(registry::signed_writes(
        store,
        dev,
        vec![("redenumire", json!({"name": name}))],
    ));
    Ok(store.write(batch)?[0])
}

/// The member using the device with `fingerprint`, with their role.
/// `None` when there is no organization or the device belongs to nobody.
pub fn current(store: &Store, fingerprint: &str) -> CoreResult<Option<Current>> {
    if organization(store)?.is_none() {
        return Ok(None);
    }
    for m in members(store, false)? {
        if m.devices.iter().any(|d| d == fingerprint) {
            let role = role(store, m.role)?;
            return Ok(Some(Current { member: m, role }));
        }
    }
    Ok(None)
}

/// What the person on this device may do in `module`. Without an
/// organization the workspace belongs to one person, who may do everything.
pub fn access(store: &Store, fingerprint: Option<&str>, module: &str) -> CoreResult<(Access, String)> {
    if organization(store)?.is_none() {
        return Ok((Access::Scriere, String::new()));
    }
    match fingerprint.map(|fp| current(store, fp)).transpose()?.flatten() {
        Some(c) => Ok((c.role.access(module), c.role.name)),
        None => Ok((Access::Niciunul, "dispozitiv fără persoană în organizație".into())),
    }
}

/// Refuses unless the person on this device manages the organization (or
/// there is no organization yet).
pub fn require_admin(store: &Store, fingerprint: Option<&str>, what: &str) -> CoreResult<()> {
    if organization(store)?.is_none() {
        return Ok(());
    }
    match fingerprint.map(|fp| current(store, fp)).transpose()?.flatten() {
        Some(c) if c.role.admin => Ok(()),
        Some(c) => Err(CoreError::invalid(
            what,
            format!("doar un administrator poate face asta (rolul tău: {})", c.role.name),
        )),
        None => Err(CoreError::invalid(
            what,
            "dispozitivul nu aparține nimănui din organizație",
        )),
    }
}

fn active_admins(store: &Store) -> CoreResult<Vec<Member>> {
    let roles = roles(store)?;
    Ok(members(store, false)?
        .into_iter()
        .filter(|m| roles.iter().any(|r| r.id == m.role && r.admin))
        .collect())
}

/// Adds a person (without a device; devices join by invitation, step 6.2).
pub fn add_member(store: &mut Store, dev: &DeviceIdentity, name: &str, role_id: Uuid) -> CoreResult<Uuid> {
    if organization(store)?.is_none() {
        return Err(CoreError::invalid("organizația", "nu există; creeaz-o întâi"));
    }
    signer_admin(store, dev)?;
    let name = validate_name("numele persoanei", name)?;
    role(store, role_id)?;
    if members(store, false)?
        .iter()
        .any(|m| m.name.to_lowercase() == name.to_lowercase())
    {
        return Err(CoreError::invalid("persoana", format!("„{name}” există deja")));
    }
    let m = Member {
        id: Uuid::new_v4(),
        name,
        role: role_id,
        devices: vec![],
        active: true,
        created_ms: now_ms(),
        version: 0,
    };
    let mut batch = vec![Write::put(MEMBERS_COLLECTION, m.id, member_fields(&m)).expect(0)];
    batch.extend(registry::signed_writes(
        store,
        dev,
        vec![("persoana", member_payload(&m))],
    ));
    store.write(batch)?;
    Ok(m.id)
}

/// Changes a person's name and role. Refused if it would leave the
/// organization without an administrator.
pub fn update_member(
    store: &mut Store,
    dev: &DeviceIdentity,
    id: Uuid,
    name: &str,
    role_id: Uuid,
    expected_version: u64,
) -> CoreResult<u64> {
    signer_admin(store, dev)?;
    let mut m = member(store, id)?;
    if !m.active {
        return Err(CoreError::invalid("persoana", "a fost scoasă din organizație"));
    }
    let name = validate_name("numele persoanei", name)?;
    let new_role = role(store, role_id)?;
    if members(store, false)?
        .iter()
        .any(|o| o.id != id && o.name.to_lowercase() == name.to_lowercase())
    {
        return Err(CoreError::invalid("persoana", format!("„{name}” există deja")));
    }
    let admins = active_admins(store)?;
    if !new_role.admin && admins.len() == 1 && admins[0].id == id {
        return Err(CoreError::invalid(
            "rolul",
            "organizația ar rămâne fără administrator; numește întâi alt administrator",
        ));
    }
    m.name = name;
    m.role = role_id;
    let mut batch = vec![Write::put(MEMBERS_COLLECTION, id, member_fields(&m)).expect(expected_version)];
    batch.extend(registry::signed_writes(
        store,
        dev,
        vec![("persoana", member_payload(&m))],
    ));
    Ok(store.write(batch)?[0])
}

/// Removes a person from the organization (kept in history, devices lose
/// access). Refused for the last administrator and for the person on this PC.
pub fn remove_member(store: &mut Store, dev: &DeviceIdentity, id: Uuid, expected_version: u64) -> CoreResult<()> {
    signer_admin(store, dev)?;
    let this = dev.fingerprint();
    let this_fingerprint = Some(this.as_str());
    let mut m = member(store, id)?;
    if !m.active {
        return Ok(());
    }
    if this_fingerprint.is_some_and(|fp| m.devices.iter().any(|d| d == fp)) {
        return Err(CoreError::invalid(
            "persoana",
            "nu te poți scoate singur din organizație de pe acest PC",
        ));
    }
    let admins = active_admins(store)?;
    if admins.len() == 1 && admins[0].id == id {
        return Err(CoreError::invalid("persoana", "este ultimul administrator"));
    }
    m.active = false;
    let mut batch = vec![Write::put(MEMBERS_COLLECTION, id, member_fields(&m)).expect(expected_version)];
    batch.extend(registry::signed_writes(
        store,
        dev,
        vec![("persoana", member_payload(&m))],
    ));
    store.write(batch)?;
    Ok(())
}

/// Role sent by the UI.
#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RoleInput {
    #[serde(default)]
    pub id: Option<Uuid>,
    pub name: String,
    pub default: Access,
    #[serde(default)]
    pub modules: BTreeMap<String, Access>,
    #[serde(default)]
    pub version: u64,
}

/// Creates or changes a role. The Administrator role cannot be changed; the
/// other built-in roles keep their name but their access can be adjusted.
/// `known_modules` are the module ids the app has (anything else is refused).
pub fn save_role(
    store: &mut Store,
    dev: &DeviceIdentity,
    input: RoleInput,
    known_modules: &[String],
) -> CoreResult<Uuid> {
    if organization(store)?.is_none() {
        return Err(CoreError::invalid("organizația", "nu există; creeaz-o întâi"));
    }
    signer_admin(store, dev)?;
    for m in input.modules.keys() {
        if !known_modules.iter().any(|k| k == m) {
            return Err(CoreError::invalid("rolul", format!("modulul „{m}” nu există")));
        }
    }
    let mut name = validate_name("numele rolului", &input.name)?;
    let existing = roles(store)?;
    let (id, builtin, expected) = match input.id {
        Some(id) => {
            let r = existing
                .iter()
                .find(|r| r.id == id)
                .ok_or_else(|| CoreError::invalid("rolul", "nu există"))?;
            if r.admin {
                return Err(CoreError::invalid("rolul", "rolul Administrator nu se poate modifica"));
            }
            if r.builtin {
                name = r.name.clone();
            }
            (id, r.builtin, input.version)
        }
        None => (Uuid::new_v4(), false, 0),
    };
    if existing
        .iter()
        .any(|r| r.id != id && r.name.to_lowercase() == name.to_lowercase())
    {
        return Err(CoreError::invalid("rolul", format!("„{name}” există deja")));
    }
    // Store only the exceptions to the default.
    let modules: BTreeMap<String, Access> = input.modules.into_iter().filter(|(_, a)| *a != input.default).collect();
    let mut batch = vec![
        Write::put(
            ROLES_COLLECTION,
            id,
            role_fields(&name, builtin, false, input.default, &modules),
        )
        .expect(expected),
    ];
    let payload = registry::role_payload(id, &reg_role(&name, false, input.default, &modules));
    batch.extend(registry::signed_writes(store, dev, vec![("rol", payload)]));
    store.write(batch)?;
    Ok(id)
}

/// Deletes a custom role nobody uses.
pub fn delete_role(store: &mut Store, dev: &DeviceIdentity, id: Uuid) -> CoreResult<()> {
    signer_admin(store, dev)?;
    let r = role(store, id)?;
    if r.builtin {
        return Err(CoreError::invalid("rolul", "rolurile implicite nu se pot șterge"));
    }
    let users: Vec<String> = members(store, false)?
        .into_iter()
        .filter(|m| m.role == id)
        .map(|m| m.name)
        .collect();
    if !users.is_empty() {
        return Err(CoreError::invalid(
            "rolul",
            format!("este folosit de: {}", users.join(", ")),
        ));
    }
    let mut batch = vec![Write::delete(ROLES_COLLECTION, id).expect(r.version)];
    batch.extend(registry::signed_writes(
        store,
        dev,
        vec![("rol", json!({"id": id.to_string(), "deleted": true}))],
    ));
    store.write(batch)?;
    Ok(())
}

/// Adds an approved device to a person (from an invitation, see `invites`),
/// signed in the registry, together with `extra` writes in the same batch.
pub(crate) fn add_device(
    store: &mut Store,
    dev: &DeviceIdentity,
    member_id: Uuid,
    key_hex: &str,
    label: &str,
    store_device: Option<u64>,
    extra: Vec<Write>,
) -> CoreResult<()> {
    signer_admin(store, dev)?;
    let mut m = member(store, member_id)?;
    if !m.active {
        return Err(CoreError::invalid("persoana", "a fost scoasă din organizație"));
    }
    let key =
        registry::parse_key(key_hex).ok_or_else(|| CoreError::invalid("dispozitivul", "cheie publică greșită"))?;
    let fp = crate::identity::fingerprint(&key);
    if registry::verify(store)?.devices.get(key_hex).is_some_and(|d| d.revoked) {
        return Err(CoreError::invalid(
            "dispozitivul",
            "a fost revocat; poate intra din nou doar cu o cheie nouă (K.G.B. reinstalat pe acel PC)",
        ));
    }
    if members(store, false)?.iter().any(|o| o.devices.contains(&fp)) {
        return Err(CoreError::invalid(
            "dispozitivul",
            "aparține deja cuiva din organizație",
        ));
    }
    m.devices.push(fp);
    let mut batch = vec![Write::put(MEMBERS_COLLECTION, member_id, member_fields(&m)).expect(m.version)];
    batch.extend(extra);
    batch.extend(registry::signed_writes(
        store,
        dev,
        vec![(
            "dispozitiv",
            json!({"member": member_id.to_string(), "key": key_hex, "label": label, "store": store_device}),
        )],
    ));
    store.write(batch)?;
    Ok(())
}

/// Revokes a device (Etapa 6, step 6.7; D-060): it leaves its person and
/// the signed registry marks it revoked, so every device that learns this
/// refuses it — it can no longer ask for data nor send any. Its person stays
/// in the organization. What the device already copied stays on it: K.G.B.
/// cannot erase another PC from a distance, and says so.
pub fn revoke_device(store: &mut Store, dev: &DeviceIdentity, fingerprint: &str) -> CoreResult<()> {
    signer_admin(store, dev)?;
    if dev.fingerprint() == fingerprint {
        return Err(CoreError::invalid(
            "dispozitivul",
            "nu poți revoca acest PC de pe el însuși",
        ));
    }
    let st = registry::verify(store)?;
    let (key, d) = st
        .devices
        .iter()
        .find(|(_, d)| d.fingerprint == fingerprint)
        .ok_or_else(|| CoreError::invalid("dispozitivul", "nu există în registrul organizației"))?;
    if d.revoked {
        return Err(CoreError::invalid("dispozitivul", "a fost deja revocat"));
    }
    let mut batch = Vec::new();
    if let Ok(mut m) = member(store, d.member) {
        m.devices.retain(|f| f != fingerprint);
        batch.push(Write::put(MEMBERS_COLLECTION, m.id, member_fields(&m)).expect(m.version));
    }
    batch.extend(registry::signed_writes(
        store,
        dev,
        vec![(
            "dispozitiv",
            json!({"member": d.member.to_string(), "key": key, "label": d.label, "store": d.store, "revoked": true}),
        )],
    ));
    store.write(batch)?;
    Ok(())
}

pub(crate) fn member_by_id(store: &Store, id: Uuid) -> CoreResult<Member> {
    member(store, id)
}
