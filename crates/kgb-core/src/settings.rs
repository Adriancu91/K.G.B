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
pub const SETTINGS_SCHEMA: u32 = 3;

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

/// Panels the start page can show (Etapa 4, D-047; the control centre of
/// step 7.4d added `bani`, `cifre` and `rezolvat`). A page pinned to the
/// start page is a panel `fix:<page id>`.
pub const HOME_PANELS: &[&str] = &[
    "azi",
    "notificari",
    "documente",
    "module",
    "despre",
    "bani",
    "cifre",
    "rezolvat",
    "alerta",
    "curs",
    "vreme",
    "media",
];
/// Prefix of a page pinned to the start page.
pub const PINNED_PREFIX: &str = "fix:";
/// Horizontal position and width are in thousandths of the page width, so a
/// panel never leaves a narrower window; vertical ones are in pixels.
pub const HOME_WIDTH: u16 = 1000;
pub const PANEL_MIN_W: u16 = 120;
pub const PANEL_MIN_H: u16 = 80;
pub const PANEL_MAX_H: u16 = 2000;
pub const HOME_MAX_Y: u32 = 20_000;
/// At most this many postponed or hidden items in „De rezolvat”.
pub const SNOOZE_MAX: usize = 500;

/// One panel of the start page, placed freely: `x`, `w` in thousandths of
/// the page width, `y`, `h` in pixels. Later panels are drawn on top.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Panel {
    pub id: String,
    pub x: u16,
    pub y: u32,
    pub w: u16,
    pub h: u16,
}

/// The start page's arrangement: panels (hidden ones are absent) and the
/// items of „De rezolvat” postponed until a day (`9999-12-31` = hidden).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Home {
    pub panels: Vec<Panel>,
    #[serde(default)]
    pub amanate: std::collections::BTreeMap<String, String>,
    /// The town of the weather panel (a key of `weather::TOWNS`), empty = not chosen (7.4e).
    #[serde(default)]
    pub vreme: String,
}

fn panel(id: &str, x: u16, y: u32, w: u16, h: u16) -> Panel {
    Panel {
        id: id.into(),
        x,
        y,
        w,
        h,
    }
}

impl Home {
    /// The start page for someone who manages the firm (owner, administrator,
    /// or a single user without an organization): money first.
    pub fn for_admin() -> Home {
        Home {
            panels: vec![
                panel("bani", 0, 0, 660, 200),
                panel("cifre", 670, 0, 330, 200),
                panel("rezolvat", 0, 212, 660, 320),
                panel("azi", 670, 212, 330, 320),
                panel("notificari", 0, 544, 495, 240),
                panel("documente", 505, 544, 495, 240),
                panel("curs", 0, 796, 240, 190),
                panel("vreme", 250, 796, 330, 190),
                panel("media", 590, 796, 410, 190),
            ],
            amanate: Default::default(),
            vreme: String::new(),
        }
    }

    /// The start page for the other roles: their day first.
    pub fn for_staff() -> Home {
        Home {
            panels: vec![
                panel("rezolvat", 0, 0, 600, 340),
                panel("azi", 610, 0, 390, 340),
                panel("notificari", 0, 352, 495, 260),
                panel("documente", 505, 352, 495, 260),
            ],
            amanate: Default::default(),
            vreme: String::new(),
        }
    }

    /// The page ids of the pinned panels.
    pub fn pinned(&self) -> impl Iterator<Item = &str> {
        self.panels.iter().filter_map(|p| p.id.strip_prefix(PINNED_PREFIX))
    }
}

impl Default for Home {
    fn default() -> Self {
        Home::for_admin()
    }
}

fn valid_day(d: &str) -> bool {
    let b = d.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && d.chars()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
}

fn valid_page_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '.' | '-' | '_'))
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
    /// Requests to the internet that the person asks for (D-086: „Din web…”, the time stamp of a signature).
    /// On by default: nothing goes out on its own. In an organization only an administrator changes it.
    #[serde(default = "yes")]
    pub internet: bool,
    /// The kind of activity chosen (7.4n, `activities::ACTIVITIES`); empty = none chosen.
    #[serde(default)]
    pub activitate: String,
}

fn yes() -> bool {
    true
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
            internet: true,
            activitate: String::new(),
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
        let bad = |d: String| Err(CoreError::invalid("ecranul de start", d));
        let mut seen = std::collections::BTreeSet::new();
        for p in &self.home.panels {
            let known =
                HOME_PANELS.contains(&p.id.as_str()) || p.id.strip_prefix(PINNED_PREFIX).is_some_and(valid_page_id);
            if !known {
                return bad(format!("panoul „{}” nu există", p.id));
            }
            if !seen.insert(p.id.as_str()) {
                return bad(format!("panoul „{}” apare de două ori", p.id));
            }
            if p.w < PANEL_MIN_W || p.x.checked_add(p.w).is_none_or(|e| e > HOME_WIDTH) {
                return bad(format!("panoul „{}” iese din pagină pe lățime", p.id));
            }
            if !(PANEL_MIN_H..=PANEL_MAX_H).contains(&p.h) || p.y > HOME_MAX_Y {
                return bad(format!("panoul „{}” are o înălțime sau o poziție nepermisă", p.id));
            }
        }
        if self.home.amanate.len() > SNOOZE_MAX {
            return bad(format!("prea multe elemente amânate (cel mult {SNOOZE_MAX})"));
        }
        if !self.home.vreme.is_empty() && crate::weather::town_name(&self.home.vreme).is_none() {
            return bad(format!("orașul „{}” nu e în lista pentru vreme", self.home.vreme));
        }
        for (k, d) in &self.home.amanate {
            if k.is_empty() || k.len() > 200 || !valid_day(d) {
                return bad("un element amânat nu are o cheie sau o dată validă".into());
            }
        }
        if !self.activitate.is_empty() && crate::activities::find(&self.activitate).is_none() {
            return Err(CoreError::invalid(
                "tipul de activitate",
                format!("„{}” nu există", self.activitate),
            ));
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
/// - schema 2: panels on a 3-column grid; placed freely since schema 3 (7.4d).
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
    if schema == 2
        && let Some(home) = fields.get_mut("home")
    {
        *home = grid_to_free(home);
    }
    let s = serde_json::from_value(Value::Object(fields)).map_err(|e| CoreError::invalid("setările", e.to_string()))?;
    Ok((s, migrated))
}

/// Schema 2 kept panels in order on a 3-column grid (`w` columns, `h` rows
/// of 200 px); schema 3 places them freely. The old order and sizes are kept.
fn grid_to_free(home: &Value) -> Value {
    const COL: u16 = HOME_WIDTH / 3;
    const ROW: u32 = 212;
    let mut out = Vec::new();
    let (mut col, mut row_y, mut row_h) = (0u16, 0u32, 0u32);
    for p in home["panels"].as_array().into_iter().flatten() {
        let w = p["w"].as_u64().unwrap_or(1).clamp(1, 3) as u16;
        let h = p["h"].as_u64().unwrap_or(1).clamp(1, 3) as u32;
        if col + w > 3 {
            col = 0;
            row_y += row_h;
            row_h = 0;
        }
        let width = if col + w == 3 {
            HOME_WIDTH - col * COL
        } else {
            w * COL - 10
        };
        out.push(serde_json::json!({
            "id": p["id"], "x": col * COL, "y": row_y, "w": width, "h": h * ROW - 12,
        }));
        col += w;
        row_h = row_h.max(h * ROW);
    }
    serde_json::json!({"panels": out})
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
