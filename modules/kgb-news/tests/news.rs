//! 7.5: the module „Știri” keeps the items the person wants to find again.

use kgb_core::CORE_VERSION;
use kgb_core::modules::{Module, ModuleManager};
use kgb_core::workspace::Workspace;
use kgb_news::{ID, News};
use serde_json::json;

fn enabled(tmp: &tempfile::TempDir) -> (Workspace, ModuleManager) {
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(News::new()) as Box<dyn Module>], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".to_string()]).unwrap();
    (ws, mm)
}

#[test]
fn manifest_is_valid() {
    let m = News::new();
    assert_eq!(m.manifest().id, ID);
}

#[test]
fn an_item_is_kept_once_and_forgotten() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut ws, mm) = enabled(&tmp);
    let item = json!({"titlu": "Ședință", "link": "https://example.ro/a", "ms": 1_794_000_000_000_i64, "sursa": "Test", "rezumat": "text"});
    let a = mm.call(&mut ws, None, ID, "pastreaza", item.clone()).unwrap();
    let b = mm.call(&mut ws, None, ID, "pastreaza", item).unwrap();
    assert_eq!(a["id"], b["id"], "the same link is kept once");
    let list = mm.call(&mut ws, None, ID, "pastrate", json!({})).unwrap();
    assert_eq!(list.as_array().unwrap().len(), 1);
    assert_eq!(list[0]["sursa"], "Test");
    mm.call(
        &mut ws,
        None,
        ID,
        "uita",
        json!({"id": a["id"], "version": a["version"]}),
    )
    .unwrap();
    assert_eq!(
        mm.call(&mut ws, None, ID, "pastrate", json!({}))
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        0
    );
}

#[test]
fn bad_items_are_refused() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut ws, mm) = enabled(&tmp);
    for bad in [
        json!({"titlu": "", "link": "https://example.ro/a", "sursa": "T"}),
        json!({"titlu": "X", "link": "javascript:alert(1)", "sursa": "T"}),
        json!({"titlu": "X", "link": "file:///C:/Windows", "sursa": "T"}),
        json!({"titlu": "X", "link": "https://a b", "sursa": "T"}),
    ] {
        assert!(mm.call(&mut ws, None, ID, "pastreaza", bad.clone()).is_err(), "{bad}");
    }
}
