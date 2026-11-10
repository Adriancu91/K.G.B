//! Step 1.5: typed settings — defaults, validation, migration, concurrency,
//! persistence.

use kgb_core::settings::{self, Density, SETTINGS_COLLECTION, SETTINGS_ID, Settings, Theme};
use kgb_core::{CoreError, workspace::Workspace};
use kgb_store::{Error as StoreError, Write};
use serde_json::json;

const PROFILES: &[&str] = &["birou", "management"];

fn ws(tmp: &tempfile::TempDir) -> Workspace {
    Workspace::create(&tmp.path().join("ws"), "T").unwrap()
}

fn raw_put(ws: &mut Workspace, v: serde_json::Value) {
    let f = v.as_object().unwrap().clone();
    ws.store_mut()
        .write(vec![Write::put(SETTINGS_COLLECTION, SETTINGS_ID, f)])
        .unwrap();
}

#[test]
fn defaults_when_nothing_stored() {
    let tmp = tempfile::tempdir().unwrap();
    let w = ws(&tmp);
    let l = settings::load(w.store()).unwrap();
    assert_eq!(l.settings, Settings::default());
    assert_eq!(l.version, 0);
    assert!(!l.migrated);
}

#[test]
fn save_and_reload_after_reopen() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("ws");
    {
        let mut w = Workspace::create(&dir, "T").unwrap();
        let mut s = Settings {
            theme: Theme::Dark,
            density: Density::Compact,
            profile: "management".into(),
            ..Settings::default()
        };
        s.layout.sidebar_width = 300;
        assert_eq!(settings::save(w.store_mut(), &s, 0, PROFILES).unwrap(), 1);
    }
    let w = Workspace::open(&dir).unwrap();
    let l = settings::load(w.store()).unwrap();
    assert_eq!(l.version, 1);
    assert_eq!(l.settings.theme, Theme::Dark);
    assert_eq!(l.settings.layout.sidebar_width, 300);
    assert_eq!(l.settings.profile, "management");
}

#[test]
fn invalid_values_are_refused_and_nothing_written() {
    let tmp = tempfile::tempdir().unwrap();
    let mut w = ws(&tmp);
    let mut s = Settings::default();
    s.layout.sidebar_width = 50;
    assert!(matches!(
        settings::save(w.store_mut(), &s, 0, PROFILES),
        Err(CoreError::Invalid { .. })
    ));
    s.layout.sidebar_width = 240;
    s.profile = "nu-exista".into();
    assert!(matches!(
        settings::save(w.store_mut(), &s, 0, PROFILES),
        Err(CoreError::Invalid { .. })
    ));
    assert_eq!(settings::load(w.store()).unwrap().version, 0);
}

#[test]
fn unknown_values_in_storage_are_an_error_not_a_silent_default() {
    let tmp = tempfile::tempdir().unwrap();
    let mut w = ws(&tmp);
    raw_put(
        &mut w,
        json!({"schema": 1, "theme": "purple", "density": "normal", "language": "ro", "profile": "birou",
               "layout": {"sidebar_width": 240, "sidebar_collapsed": false}}),
    );
    assert!(matches!(settings::load(w.store()), Err(CoreError::Invalid { .. })));
}

#[test]
fn stale_version_is_a_conflict() {
    let tmp = tempfile::tempdir().unwrap();
    let mut w = ws(&tmp);
    let s = Settings::default();
    settings::save(w.store_mut(), &s, 0, PROFILES).unwrap();
    // A second writer that still believes nothing is stored.
    match settings::save(w.store_mut(), &s, 0, PROFILES) {
        Err(CoreError::Store(StoreError::VersionConflict { .. })) => {}
        other => panic!("{other:?}"),
    }
    // Writing identical settings is a no-op (version unchanged); a real change bumps it.
    assert_eq!(settings::save(w.store_mut(), &s, 1, PROFILES).unwrap(), 1);
    let mut s2 = s.clone();
    s2.theme = Theme::Light;
    assert_eq!(settings::save(w.store_mut(), &s2, 1, PROFILES).unwrap(), 2);
}

#[test]
fn s3_prototype_shape_is_migrated() {
    let tmp = tempfile::tempdir().unwrap();
    let mut w = ws(&tmp);
    raw_put(&mut w, json!({"theme": "dark"}));
    let l = settings::load(w.store()).unwrap();
    assert!(l.migrated);
    assert_eq!(l.settings.theme, Theme::Dark);
    assert_eq!(l.settings.density, Density::Normal);
    // Saving writes the current schema.
    settings::save(w.store_mut(), &l.settings, l.version, PROFILES).unwrap();
    let r = w.store().get(SETTINGS_COLLECTION, SETTINGS_ID).unwrap().unwrap();
    assert_eq!(r.fields["schema"], kgb_core::settings::SETTINGS_SCHEMA);
    assert!(!settings::load(w.store()).unwrap().migrated);
}

#[test]
fn newer_schema_is_refused() {
    let tmp = tempfile::tempdir().unwrap();
    let mut w = ws(&tmp);
    raw_put(&mut w, json!({"schema": 7, "theme": "dark"}));
    assert!(matches!(settings::load(w.store()), Err(CoreError::Invalid { .. })));
}

/// Step 4.10 (D-047) and 7.4d: the start page's arrangement is part of the
/// settings; schema-1 settings get the default arrangement; the old 3-column
/// grid (schema 2) becomes free placement with the same order and sizes;
/// panels that leave the page or are unknown are refused.
#[test]
fn home_panels_saved_migrated_and_checked() {
    use kgb_core::settings::{Home, Panel};
    let p = |id: &str, x: u16, y: u32, w: u16, h: u16| Panel {
        id: id.into(),
        x,
        y,
        w,
        h,
    };
    let tmp = tempfile::tempdir().unwrap();
    let mut w = ws(&tmp);
    raw_put(
        &mut w,
        json!({"schema": 1, "theme": "dark", "density": "normal", "language": "ro", "profile": "birou",
               "layout": {"sidebar_width": 240, "sidebar_collapsed": false}}),
    );
    let l = settings::load(w.store()).unwrap();
    assert!(l.migrated);
    assert_eq!(l.settings.theme, Theme::Dark);
    assert_eq!(l.settings.home, Home::default());

    // Schema 2: [azi 2×1][notificari 1×1] / [documente 1×2]
    raw_put(
        &mut w,
        json!({"schema": 2, "theme": "dark", "density": "normal", "language": "ro", "profile": "birou",
               "layout": {"sidebar_width": 240, "sidebar_collapsed": false},
               "home": {"panels": [{"id": "azi", "w": 2, "h": 1}, {"id": "notificari", "w": 1, "h": 1}, {"id": "documente", "w": 1, "h": 2}]}}),
    );
    let l = settings::load(w.store()).unwrap();
    assert!(l.migrated);
    let got: Vec<(String, u16, u32, u16, u16)> = l
        .settings
        .home
        .panels
        .iter()
        .map(|q| (q.id.clone(), q.x, q.y, q.w, q.h))
        .collect();
    assert_eq!(
        got,
        [
            ("azi".to_string(), 0, 0, 656, 200),
            ("notificari".to_string(), 666, 0, 334, 200),
            ("documente".to_string(), 0, 212, 323, 412),
        ]
    );
    l.settings.validate(PROFILES).unwrap();

    let mut s = l.settings.clone();
    s.home.panels = vec![
        p("notificari", 100, 40, 900, 300),
        p("azi", 0, 400, 300, 200),
        p("fix:kgb.business", 400, 400, 300, 120),
    ];
    s.home.amanate.insert("factura:12".into(), "2026-11-15".into());
    let v = settings::save(w.store_mut(), &s, l.version, PROFILES).unwrap();
    let back = settings::load(w.store()).unwrap();
    assert!(!back.migrated);
    assert_eq!(back.settings.home, s.home);
    assert_eq!(back.settings.home.pinned().collect::<Vec<_>>(), ["kgb.business"]);

    for bad in [
        vec![p("spion", 0, 0, 300, 200)],
        vec![p("azi", 0, 0, 300, 200), p("azi", 400, 0, 300, 200)],
        vec![p("azi", 800, 0, 300, 200)],
        vec![p("azi", 0, 0, 50, 200)],
        vec![p("azi", 0, 0, 300, 10)],
        vec![p("azi", 0, 30_000, 300, 200)],
        vec![p("fix:../x", 0, 0, 300, 200)],
    ] {
        let mut b = s.clone();
        b.home.panels = bad;
        assert!(matches!(
            settings::save(w.store_mut(), &b, v, PROFILES),
            Err(CoreError::Invalid { .. })
        ));
    }
    let mut b = s.clone();
    b.home.amanate.insert("x".into(), "mâine".into());
    assert!(settings::save(w.store_mut(), &b, v, PROFILES).is_err());

    // All panels hidden is allowed (an empty start page with a way back).
    let mut none = s.clone();
    none.home.panels.clear();
    settings::save(w.store_mut(), &none, v, PROFILES).unwrap();
    // Two built-in starts: by role.
    assert!(Home::for_staff().panels.iter().all(|q| q.id != "bani"));
    assert_eq!(Home::for_admin().panels[0].id, "bani");
}
