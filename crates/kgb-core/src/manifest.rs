//! Module manifest: format and validation (Etapa 1, step 1.7;
//! `MODULE_CONTRACT.md`, Metaprompt §9, Master Plan §4.2).
//!
//! Manifests are JSON. Built-in modules embed theirs with `include_str!`
//! (decision D-024: no code is loaded at run time). Validation is strict:
//! unknown fields, unknown permissions or services, malformed ids and
//! versions are all refused, so a typo can never grant something by accident.

use std::collections::BTreeSet;

use semver::{Version, VersionReq};
use serde::{Deserialize, Serialize};

use crate::error::{CoreError, CoreResult};
use crate::schema::CollectionSchema;

pub const MANIFEST_FORMAT: u32 = 1;

/// Permissions a module may request. Only permissions that the core really
/// enforces are listed; new ones are added together with their check.
pub const PERMISSIONS: &[(&str, &str)] = &[
    ("storage.own", "citește și scrie datele proprii ale modulului"),
    (
        "settings.read",
        "citește setările spațiului de lucru (temă, densitate, profil)",
    ),
    (
        "identity.read",
        "citește numele proprietarului și amprenta dispozitivului",
    ),
    (
        "files.own",
        "salvează și citește fișierele și documentele proprii, cu versiuni (originalul nu se modifică; conținutul e verificat prin amprentă BLAKE3)",
    ),
    (
        "notify.send",
        "trimite notificări în centrul de notificări al aplicației (fiecare trimitere e înregistrată în jurnal)",
    ),
];

/// Core services a module may use.
pub const SERVICES: &[&str] = &["storage", "settings", "identity", "files", "notify", "log"];

/// Which service each permission belongs to (a permission needs its service).
fn service_of(permission: &str) -> &'static str {
    match permission {
        "storage.own" => "storage",
        "settings.read" => "settings",
        "identity.read" => "identity",
        "files.own" => "files",
        "notify.send" => "notify",
        _ => "",
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModuleStatus {
    Stable,
    Beta,
    Experimental,
    /// Shipped but not allowed to be enabled (e.g. withdrawn).
    Disabled,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DataType {
    /// Logical collection name, unique inside the module (`[a-z0-9_]+`).
    pub collection: String,
    pub description: String,
    /// Optional structure of the records; checked by the core on every write.
    #[serde(default)]
    pub schema: Option<CollectionSchema>,
    /// Fields with an equality index, built and kept up to date by the core.
    /// Queries use them automatically.
    #[serde(default)]
    pub indexes: Vec<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Events {
    #[serde(default)]
    pub emits: Vec<String>,
    #[serde(default)]
    pub listens: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Migration {
    pub from: u32,
    pub to: u32,
    pub description: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Manifest {
    pub manifest_format: u32,
    /// Reverse-domain style id, e.g. `kgb.notes`.
    pub id: String,
    pub name: String,
    pub description: String,
    /// Module version (semver).
    pub version: String,
    /// Compatible core versions (semver requirement, e.g. `>=0.1.0, <0.2.0`).
    pub core: String,
    pub status: ModuleStatus,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub services: Vec<String>,
    #[serde(default)]
    pub data_types: Vec<DataType>,
    #[serde(default)]
    pub events: Events,
    /// Current format of the module's data. Starts at 1.
    pub data_format: u32,
    #[serde(default)]
    pub migrations: Vec<Migration>,
    /// What happens to the data when the module is disabled (shown to the user).
    pub on_disable: String,
}

fn bad(id: &str, detail: impl Into<String>) -> CoreError {
    CoreError::invalid(format!("manifestul modulului {id}"), detail)
}

fn is_segment(s: &str) -> bool {
    let mut c = s.chars();
    matches!(c.next(), Some('a'..='z')) && c.all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
}

pub fn is_valid_module_id(id: &str) -> bool {
    let parts: Vec<&str> = id.split('.').collect();
    parts.len() >= 2 && id.len() <= 64 && parts.iter().all(|p| is_segment(p))
}

fn is_collection_name(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 40
        && s.chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

fn unique<'a>(id: &str, what: &str, items: impl Iterator<Item = &'a str>) -> CoreResult<()> {
    let mut seen = BTreeSet::new();
    for i in items {
        if !seen.insert(i) {
            return Err(bad(id, format!("{what} „{i}” apare de două ori")));
        }
    }
    Ok(())
}

impl Manifest {
    /// Parses and validates a manifest.
    pub fn parse(json: &str) -> CoreResult<Manifest> {
        let m: Manifest =
            serde_json::from_str(json).map_err(|e| CoreError::invalid("manifestul modulului", e.to_string()))?;
        m.validate()?;
        Ok(m)
    }

    pub fn validate(&self) -> CoreResult<()> {
        let id = self.id.as_str();
        if self.manifest_format != MANIFEST_FORMAT {
            return Err(bad(
                id,
                format!("manifest_format {} nu este suportat", self.manifest_format),
            ));
        }
        if !is_valid_module_id(id) {
            return Err(bad(id, "id invalid (exemplu corect: kgb.notes)"));
        }
        if self.name.trim().is_empty() || self.description.trim().is_empty() || self.on_disable.trim().is_empty() {
            return Err(bad(id, "name, description și on_disable sunt obligatorii"));
        }
        Version::parse(&self.version).map_err(|e| bad(id, format!("version: {e}")))?;
        VersionReq::parse(&self.core).map_err(|e| bad(id, format!("core: {e}")))?;
        for p in &self.permissions {
            if !PERMISSIONS.iter().any(|(k, _)| k == p) {
                return Err(bad(id, format!("permisiune necunoscută „{p}”")));
            }
            if !self.services.iter().any(|s| s == service_of(p)) {
                return Err(bad(id, format!("permisiunea „{p}” cere serviciul „{}”", service_of(p))));
            }
        }
        for s in &self.services {
            if !SERVICES.contains(&s.as_str()) {
                return Err(bad(id, format!("serviciu necunoscut „{s}”")));
            }
        }
        unique(id, "permisiunea", self.permissions.iter().map(String::as_str))?;
        unique(id, "serviciul", self.services.iter().map(String::as_str))?;
        for d in &self.data_types {
            unique(id, "indexul", d.indexes.iter().map(String::as_str))?;
            for f in &d.indexes {
                if f.is_empty() || f.len() > 64 {
                    return Err(bad(id, format!("index invalid „{f}” în colecția {}", d.collection)));
                }
                if let Some(sc) = &d.schema
                    && !sc.fields.contains_key(f)
                {
                    return Err(bad(
                        id,
                        format!("indexul „{f}” nu este un câmp din schema colecției {}", d.collection),
                    ));
                }
            }
            if let Some(sc) = &d.schema {
                sc.validate_self()
                    .map_err(|e| bad(id, format!("schema colecției {}: {e}", d.collection)))?;
            }
            if !is_collection_name(&d.collection) {
                return Err(bad(
                    id,
                    format!("colecție invalidă „{}” (doar a-z, 0-9, _)", d.collection),
                ));
            }
        }
        unique(id, "colecția", self.data_types.iter().map(|d| d.collection.as_str()))?;
        if !self.data_types.is_empty() && !self.permissions.iter().any(|p| p == "storage.own") {
            return Err(bad(id, "are tipuri de date, dar nu cere permisiunea storage.own"));
        }
        let prefix = format!("{id}.");
        for e in &self.events.emits {
            if !e.starts_with(&prefix) || e.len() == prefix.len() {
                return Err(bad(
                    id,
                    format!("evenimentul emis „{e}” trebuie să înceapă cu „{prefix}”"),
                ));
            }
        }
        if self.data_format == 0 {
            return Err(bad(id, "data_format începe de la 1"));
        }
        // Migrations must form a gap-free chain 1 → 2 → … → data_format.
        let mut expect = 1;
        for mg in &self.migrations {
            if mg.from != expect || mg.to != expect + 1 {
                return Err(bad(
                    id,
                    format!(
                        "migrațiile trebuie să fie consecutive; aștepta {expect} → {}",
                        expect + 1
                    ),
                ));
            }
            expect += 1;
        }
        if expect != self.data_format {
            return Err(bad(
                id,
                format!(
                    "migrațiile ajung la {expect}, dar data_format este {}",
                    self.data_format
                ),
            ));
        }
        Ok(())
    }

    /// True if this module declares compatibility with `core_version`.
    pub fn compatible_with(&self, core_version: &str) -> bool {
        match (VersionReq::parse(&self.core), Version::parse(core_version)) {
            (Ok(req), Ok(v)) => req.matches(&v),
            _ => false,
        }
    }

    /// Schema of a logical collection, if declared.
    pub fn schema(&self, logical: &str) -> Option<&CollectionSchema> {
        self.data_types
            .iter()
            .find(|d| d.collection == logical)?
            .schema
            .as_ref()
    }

    /// Store collection that backs a logical collection of this module.
    pub fn store_collection(&self, logical: &str) -> Option<String> {
        self.data_types
            .iter()
            .any(|d| d.collection == logical)
            .then(|| format!("mod.{}.{logical}", self.id))
    }
}
