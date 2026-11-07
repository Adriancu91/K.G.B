//! Typed, versioned workspace settings (Etapa 1, step 1.5).
//!
//! Stored as one record in `core.settings` of the workspace store. Every value
//! is validated before it is written; unknown enum values are refused by serde.
//! Older on-disk shapes are migrated on load; newer ones are refused so an old
//! app never overwrites settings it does not understand.
//!
//! Which settings follow the user to other PCs is decided with selective sync
//! in Etapa 6; for now they belong to the workspace on this PC.

use kgb_store::{Fields, Store, Write};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};

pub const SETTINGS_COLLECTION: &str = "core.settings";
pub const SETTINGS_ID: Uuid = Uuid::from_u128(1);
pub const SETTINGS_SCHEMA: u32 = 2;

pub const SIDEBAR_MIN: u16 = 160;
pub const SIDEBAR_MAX: u16 = 480;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Density {
    Compact,
    #[default]
    Normal,
    Comfortable,
}

/// Only Romanian exists today; other languages are added when translated.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    #[default]
    Ro,
}

/// Panel sizes of the desktop shell.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Layout {
    pub sidebar_width: u16,
    pub sidebar_collapsed: bool,
}

impl Default for Layout {
    fn default() -> Self {
        Layout {
            sidebar_width: 240,
            sidebar_collapsed: false,
        }
    }
}

/// Panels the start page can show (Etapa 4, step 4.10; D-047).
pub const HOME_PANELS: &[&str] = &["azi", "notificari", "documente", "module", "despre"];
pub const HOME_COLUMNS: u8 = 3;
pub const HOME_ROWS_MAX: u8 = 3;

/// One panel of the start page: which one, how many columns (of 3) and rows.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Panel {
    pub id: String,
    pub w: u8,
    pub h: u8,
}

/// The start page's arrangement: panels in order (hidden ones are absent).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Home {
    pub panels: Vec<Panel>,
}

impl Default for Home {
    fn default() -> Self {
        let p = |id: &str, w, h| Panel { id: id.into(), w, h };
        Home {
            panels: vec![
                p("azi", 2, 1),
                p("notificari", 1, 1),
                p("documente", 1, 1),
                p("module", 1, 1),
                p("despre", 1, 1),
            ],
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Settings {
    pub theme: Theme,
    pub density: Density,
    pub language: Language,
    /// Id of the active work profile (see `modules::PROFILES`).
    pub profile: String,
    pub layout: Layout,
    /// Start page panels (schema 2).
    #[serde(default)]
    pub home: Home,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            theme: Theme::default(),
            density: Density::default(),
            language: Language::default(),
            profile: "birou".into(),
            layout: Layout::default(),
            home: Home::default(),
        }
    }
}

impl Settings {
    /// Checks ranges and references. `known_profiles` comes from the module
    /// manager so a removed profile cannot stay selected.
    pub fn validate(&self, known_profiles: &[&str]) -> CoreResult<()> {
        let w = self.layout.sidebar_width;
        if !(SIDEBAR_MIN..=SIDEBAR_MAX).contains(&w) {
            return Err(CoreError::invalid(
                "lățimea panoului lateral",
                format!("{w} nu este între {SIDEBAR_MIN} și {SIDEBAR_MAX}"),
            ));
        }
        let mut seen = std::collections::BTreeSet::new();
        for p in &self.home.panels {
            if !HOME_PANELS.contains(&p.id.as_str()) {
                return Err(CoreError::invalid(
                    "ecranul de start",
                    format!("panoul „{}” nu există", p.id),
                ));
            }
            if !seen.insert(p.id.as_str()) {
                return Err(CoreError::invalid(
                    "ecranul de start",
                    format!("panoul „{}” apare de două ori", p.id),
                ));
            }
            if !(1..=HOME_COLUMNS).contains(&p.w) || !(1..=HOME_ROWS_MAX).contains(&p.h) {
                return Err(CoreError::invalid(
                    "ecranul de start",
                    format!(
                        "panoul „{}” are mărimea {}×{} (permis: 1–{HOME_COLUMNS} × 1–{HOME_ROWS_MAX})",
                        p.id, p.w, p.h
                    ),
                ));
            }
        }
        if !known_profiles.contains(&self.profile.as_str()) {
            return Err(CoreError::invalid(
                "profilul de lucru",
                format!("„{}” nu există", self.profile),
            ));
        }
        Ok(())
    }
}

/// Settings plus the store version they were read at (for optimistic writes).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Loaded {
    pub settings: Settings,
    /// 0 when nothing is stored yet.
    pub version: u64,
    /// True when the stored shape was older and was upgraded in memory.
    pub migrated: bool,
}

/// Upgrades an older stored shape to the current one.
///
/// - schema 0: written by the Etapa 0 S3 prototype — `{"theme": "..."}` only.
/// - schema 1: no start-page arrangement yet; it gets the default one.
fn migrate(mut fields: Fields) -> CoreResult<(Settings, bool)> {
    let schema = fields.get("schema").and_then(Value::as_u64).unwrap_or(0) as u32;
    if schema > SETTINGS_SCHEMA {
        return Err(CoreError::invalid(
            "setările",
            format!("au schema {schema}, mai nouă decât {SETTINGS_SCHEMA}; actualizează aplicația"),
        ));
    }
    let migrated = schema < SETTINGS_SCHEMA;
    if schema == 0 {
        let theme = fields.remove("theme").unwrap_or(Value::String("system".into()));
        let mut v = serde_json::to_value(Settings::default()).expect("defaults serialise");
        v["theme"] = theme;
        let s = serde_json::from_value(v).map_err(|e| CoreError::invalid("setările (schema 0)", e.to_string()))?;
        return Ok((s, migrated));
    }
    fields.remove("schema");
    let s = serde_json::from_value(Value::Object(fields)).map_err(|e| CoreError::invalid("setările", e.to_string()))?;
    Ok((s, migrated))
}

pub fn load(store: &Store) -> CoreResult<Loaded> {
    match store.get(SETTINGS_COLLECTION, SETTINGS_ID)? {
        None => Ok(Loaded {
            settings: Settings::default(),
            version: 0,
            migrated: false,
        }),
        Some(r) => {
            let (settings, migrated) = migrate(r.fields)?;
            Ok(Loaded {
                settings,
                version: r.version,
                migrated,
            })
        }
    }
}

/// Validates and writes `settings` if the stored version is still
/// `expected_version` (0 = nothing stored yet). Returns the new version.
pub fn save(store: &mut Store, settings: &Settings, expected_version: u64, known_profiles: &[&str]) -> CoreResult<u64> {
    settings.validate(known_profiles)?;
    let mut fields = match serde_json::to_value(settings).expect("settings serialise") {
        Value::Object(m) => m,
        _ => unreachable!("settings is a struct"),
    };
    fields.insert("schema".into(), Value::from(SETTINGS_SCHEMA));
    let v = store.write(vec![
        Write::put(SETTINGS_COLLECTION, SETTINGS_ID, fields).expect(expected_version),
    ])?;
    Ok(v[0])
}
