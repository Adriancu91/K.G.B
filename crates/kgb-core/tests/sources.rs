//! Step 7.1 (D-062, D-063): the register of external sources and licences.
//! - a source is active only with terms of use, a licence and a date;
//! - changing an active source's terms switches it off (approve again);
//! - modules see only active sources, and only with `sources.read`;
//! - nothing is active by default; everything survives reopening.

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext, ModuleManager};
use kgb_core::sources::{self, SourceInput};
use kgb_core::workspace::Workspace;
use kgb_core::{CoreError, CoreResult};
use serde_json::{Value, json};

struct Reader(Manifest);

impl Module for Reader {
    fn manifest(&self) -> &Manifest {
        &self.0
    }
    fn handle(&self, ctx: &mut ModuleContext<'_>, cmd: &str, _a: Value) -> CoreResult<Value> {
        match cmd {
            "rss" => Ok(json!(
                ctx.sources(Some("rss"))?
                    .iter()
                    .map(|s| s.nume.clone())
                    .collect::<Vec<_>>()
            )),
            _ => Err(CoreError::invalid("cmd", "necunoscut")),
        }
    }
}

fn manager(perms: &[&str]) -> ModuleManager {
    let services: Vec<&str> = perms.iter().map(|p| p.split('.').next().unwrap()).collect();
    let v = json!({
        "manifest_format": 1, "id": "t.reader", "name": "R", "description": "d", "version": "0.1.0",
        "core": ">=0.1.0, <0.2.0", "status": "beta", "data_format": 1, "on_disable": "nimic",
        "permissions": perms, "services": services
    });
    ModuleManager::new(
        vec![Box::new(Reader(Manifest::parse(&v.to_string()).unwrap()))],
        "0.1.0",
    )
    .unwrap()
}

fn input(nume: &str, tip: &str) -> SourceInput {
    SourceInput {
        id: None,
        nume: nume.into(),
        url: "https://example.org/feed.xml".into(),
        tip: tip.into(),
        termeni: String::new(),
        termeni_url: String::new(),
        licenta: String::new(),
        verificat: String::new(),
        note: String::new(),
        version: 0,
    }
}

#[test]
fn activation_needs_terms_licence_and_date() {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    assert!(
        sources::active(ws.store(), None).unwrap().is_empty(),
        "nothing active by default"
    );

    // Bad input.
    let mut bad = input("X", "rss");
    bad.url = "ftp://x".into();
    assert!(sources::save(ws.store_mut(), bad).is_err());
    assert!(sources::save(ws.store_mut(), input("X", "necunoscut")).is_err());
    let mut bad = input("X", "rss");
    bad.verificat = "8.11.2026".into();
    assert!(sources::save(ws.store_mut(), bad).is_err());

    let id = sources::save(ws.store_mut(), input("Știri test", "rss")).unwrap();
    assert!(
        sources::save(ws.store_mut(), input("știri TEST", "api")).is_err(),
        "same name"
    );
    let e = sources::set_active(ws.store_mut(), id, true, "Ana")
        .unwrap_err()
        .to_string();
    assert!(
        e.contains("condițiile de folosire") && e.contains("licența") && e.contains("data verificării"),
        "{e}"
    );
    assert!(sources::usable(ws.store(), id).is_err());

    let s = sources::get(ws.store(), id).unwrap();
    let mut ok = input("Știri test", "rss");
    ok.id = Some(id);
    ok.version = s.version;
    ok.termeni_url = "https://example.org/termeni".into();
    ok.licenta = "folosire personală, cu atribuire".into();
    ok.verificat = "2026-11-08".into();
    sources::save(ws.store_mut(), ok).unwrap();
    sources::set_active(ws.store_mut(), id, true, "Ana").unwrap();
    let s = sources::usable(ws.store(), id).unwrap();
    assert_eq!(s.aprobata_de, "Ana");
    assert!(sources::delete(ws.store_mut(), id).is_err(), "switch it off first");

    // A note change keeps it active; a terms change switches it off.
    let mut edit = input("Știri test", "rss");
    edit.id = Some(id);
    edit.version = s.version;
    edit.termeni_url = s.termeni_url.clone();
    edit.licenta = s.licenta.clone();
    edit.verificat = s.verificat.clone();
    edit.note = "verificat de Ana".into();
    sources::save(ws.store_mut(), edit).unwrap();
    assert!(sources::get(ws.store(), id).unwrap().activa);
    let s = sources::get(ws.store(), id).unwrap();
    let mut edit = input("Știri test", "rss");
    edit.id = Some(id);
    edit.version = s.version;
    edit.termeni_url = s.termeni_url.clone();
    edit.licenta = "alta".into();
    edit.verificat = s.verificat.clone();
    sources::save(ws.store_mut(), edit).unwrap();
    let s = sources::get(ws.store(), id).unwrap();
    assert!(
        !s.activa && s.aprobata_de.is_empty(),
        "approve again after a terms change"
    );

    // Survives reopening.
    sources::set_active(ws.store_mut(), id, true, "Ana").unwrap();
    let dir = ws.dir().to_path_buf();
    drop(ws);
    let mut ws = Workspace::open(&dir).unwrap();
    assert_eq!(sources::active(ws.store(), Some("rss")).unwrap().len(), 1);
    assert!(sources::active(ws.store(), Some("api")).unwrap().is_empty());
    sources::set_active(ws.store_mut(), id, false, "Ana").unwrap();
    sources::delete(ws.store_mut(), id).unwrap();
    assert!(sources::list(ws.store()).unwrap().is_empty());
}

#[test]
fn modules_see_only_active_sources_with_permission() {
    let t = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&t.path().join("ws"), "T").unwrap();
    let mut on = input("Activă", "rss");
    on.termeni = "Fluxul public poate fi citit; se arată sursa.".into();
    on.licenta = "termenii sursei".into();
    on.verificat = "2026-11-08".into();
    let id = sources::save(ws.store_mut(), on).unwrap();
    sources::set_active(ws.store_mut(), id, true, "Ana").unwrap();
    let mut off = input("Oprită", "rss");
    off.url = "https://example.org/alt.xml".into();
    sources::save(ws.store_mut(), off).unwrap();

    let mm = manager(&["sources.read"]);
    mm.enable(&mut ws, "t.reader", &["sources.read".into()]).unwrap();
    assert_eq!(
        mm.call(&mut ws, None, "t.reader", "rss", json!({})).unwrap(),
        json!(["Activă"])
    );

    // A module that did not ask for (and was not granted) the permission.
    let mm = manager(&[]);
    let t2 = tempfile::tempdir().unwrap();
    let mut ws2 = Workspace::create(&t2.path().join("ws"), "T").unwrap();
    mm.enable(&mut ws2, "t.reader", &[]).unwrap();
    let e = mm.call(&mut ws2, None, "t.reader", "rss", json!({})).unwrap_err();
    assert!(e.to_string().contains("sources.read"), "{e}");
}
