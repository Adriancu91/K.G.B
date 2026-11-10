//! 7.4l-2b: the notebook of the Notes window copied from Cyber Office Studio, kept note by note.
//! Two PCs: a save made with an old load never deletes or overwrites what another PC wrote since.

use kgb_core::CORE_VERSION;
use kgb_core::modules::{Module, ModuleManager};
use kgb_core::workspace::Workspace;
use kgb_notes::{ID, Notes};
use serde_json::{Value, json};

fn enabled(tmp: &tempfile::TempDir) -> (Workspace, ModuleManager) {
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Notes::new()) as Box<dyn Module>], CORE_VERSION).unwrap();
    mm.enable(&mut ws, ID, &["storage.own".to_string(), "files.own".to_string()])
        .unwrap();
    (ws, mm)
}

/// The notebook as the window would hold it, and what the load saw.
fn load(ws: &mut Workspace, mm: &ModuleManager) -> (Value, Value) {
    let r = mm.call(ws, None, ID, "notebook_load", json!({})).unwrap();
    (
        serde_json::from_str(r["content"].as_str().unwrap()).unwrap(),
        r["seen"].clone(),
    )
}

fn save(ws: &mut Workspace, mm: &ModuleManager, book: &Value, seen: &Value) -> Value {
    mm.call(
        ws,
        None,
        ID,
        "notebook_save",
        json!({"content": book.to_string(), "seen": seen}),
    )
    .unwrap()
}

fn note(id: &str, title: &str, updated: &str) -> Value {
    json!({"id": id, "title": title, "body": format!("textul {title}"), "created": "2026-11-01T10:00:00.000Z", "updated": updated})
}

fn titles(book: &Value) -> Vec<String> {
    book["notes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|n| n["title"].as_str().unwrap().to_string())
        .collect()
}

/// A picture over 16 KB, as the window stores one (data:image/…).
fn picture(seed: u8) -> String {
    format!(
        "data:image/jpeg;base64,{}",
        std::iter::repeat_n(char::from(b'A' + seed), 40_000).collect::<String>()
    )
}

#[test]
fn a_notebook_goes_through_the_core_and_comes_back_the_same() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut ws, mm) = enabled(&tmp);
    let r = mm.call(&mut ws, None, ID, "notebook_load", json!({})).unwrap();
    assert_eq!(r["empty"], true);
    let book = json!({
        "format": "suite-notes", "version": 1,
        "notes": [note("n1", "Cumpărături", "2026-11-10T10:00:00.000Z"), note("n2", "Ședință", "2026-11-10T11:00:00.000Z")],
        "trash": [ {"id": "n3", "title": "Veche", "body": "", "created": "2026-11-01T10:00:00.000Z", "updated": "2026-11-02T10:00:00.000Z", "deleted": "2026-11-09T10:00:00.000Z"} ],
        "sections": ["Acasă", "Birou"], "sectionColors": {"Birou": "blue"}
    });
    let rep = save(&mut ws, &mm, &book, &json!({}));
    assert_eq!(rep["written"], 3);
    let (back, seen) = load(&mut ws, &mm);
    assert_eq!(back["notes"], book["notes"]);
    assert_eq!(back["trash"], book["trash"]);
    assert_eq!(back["sections"], book["sections"]);
    assert_eq!(back["sectionColors"], book["sectionColors"]);
    assert_eq!(seen["notes"].as_object().unwrap().len(), 3);

    // Saving the same notebook again writes nothing.
    assert_eq!(save(&mut ws, &mm, &back, &seen)["written"], 0);
    // One note changed: only that one is written.
    let mut changed = back.clone();
    changed["notes"][0]["body"] = json!("lapte, pâine");
    changed["notes"][0]["updated"] = json!("2026-11-10T12:00:00.000Z");
    assert_eq!(save(&mut ws, &mm, &changed, &seen)["written"], 1);
    assert_eq!(load(&mut ws, &mm).0["notes"][0]["body"], "lapte, pâine");
}

#[test]
fn a_note_written_on_another_pc_after_the_load_stays() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut ws, mm) = enabled(&tmp);
    let first = json!({"format": "suite-notes", "version": 1, "notes": [note("a", "A", "2026-11-10T10:00:00.000Z")]});
    save(&mut ws, &mm, &first, &json!({}));
    // This PC's window loads the notebook…
    let (mine, my_seen) = load(&mut ws, &mm);
    // …meanwhile the other PC adds a note and a section (its own load, its own save).
    let (mut other, other_seen) = load(&mut ws, &mm);
    other["notes"]
        .as_array_mut()
        .unwrap()
        .push(note("b", "B de pe alt PC", "2026-11-10T10:05:00.000Z"));
    other["sections"] = json!(["Proiect"]);
    save(&mut ws, &mm, &other, &other_seen);
    // This PC saves its old notebook (without B, without the section): B and the section stay.
    let rep = save(&mut ws, &mm, &mine, &my_seen);
    assert_eq!(rep["deleted"], 0);
    assert_eq!(rep["kept_from_elsewhere"], 1);
    let (now, seen) = load(&mut ws, &mm);
    assert_eq!(titles(&now), vec!["A", "B de pe alt PC"]);
    assert_eq!(now["sections"], json!(["Proiect"]));

    // A note this window saw and nobody changed since is deleted when the window drops it.
    let mut without_a = now.clone();
    without_a["notes"].as_array_mut().unwrap().remove(0);
    assert_eq!(save(&mut ws, &mm, &without_a, &seen)["deleted"], 1);
    assert_eq!(titles(&load(&mut ws, &mm).0), vec!["B de pe alt PC"]);
}

#[test]
fn when_both_pcs_change_a_note_the_newer_one_stays() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut ws, mm) = enabled(&tmp);
    save(
        &mut ws,
        &mm,
        &json!({"format": "suite-notes", "version": 1, "notes": [note("a", "A", "2026-11-10T10:00:00.000Z")]}),
        &json!({}),
    );
    let (mut mine, my_seen) = load(&mut ws, &mm);
    let (mut other, other_seen) = load(&mut ws, &mm);
    other["notes"][0]["body"] = json!("de pe alt PC, mai nou");
    other["notes"][0]["updated"] = json!("2026-11-10T12:00:00.000Z");
    save(&mut ws, &mm, &other, &other_seen);
    mine["notes"][0]["body"] = json!("de aici, mai vechi");
    mine["notes"][0]["updated"] = json!("2026-11-10T11:00:00.000Z");
    assert_eq!(save(&mut ws, &mm, &mine, &my_seen)["conflicts"], 1);
    assert_eq!(load(&mut ws, &mm).0["notes"][0]["body"], "de pe alt PC, mai nou");
}

#[test]
fn large_pictures_are_stored_once_and_removed_when_unused() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut ws, mm) = enabled(&tmp);
    let pic = picture(0);
    let mut a = note("a", "A", "2026-11-10T10:00:00.000Z");
    a["images"] = json!([pic, "data:image/png;base64,mic"]);
    let mut b = note("b", "B", "2026-11-10T10:00:00.000Z");
    b["images"] = json!([pic]);
    let rep = save(
        &mut ws,
        &mm,
        &json!({"format": "suite-notes", "version": 1, "notes": [a, b]}),
        &json!({}),
    );
    assert_eq!(rep["pictures"], 1, "the same picture is one file");
    let files = mm.call(&mut ws, None, ID, "notebook_load", json!({})).unwrap();
    let book: Value = serde_json::from_str(files["content"].as_str().unwrap()).unwrap();
    assert_eq!(book["notes"][0]["images"][0], pic, "the picture comes back whole");
    assert_eq!(
        book["notes"][0]["images"][1], "data:image/png;base64,mic",
        "a small picture stays in the note"
    );
    // Both notes drop the picture: the file goes.
    let seen = files["seen"].clone();
    let mut book2 = book.clone();
    book2["notes"][0]["images"] = json!([]);
    book2["notes"][0]["updated"] = json!("2026-11-10T11:00:00.000Z");
    book2["notes"][1]["images"] = json!([]);
    book2["notes"][1]["updated"] = json!("2026-11-10T11:00:00.000Z");
    let rep = save(&mut ws, &mm, &book2, &seen);
    assert_eq!(rep["pictures_removed"], 1);
    assert_eq!(rep["pictures"], 0);
}

#[test]
fn oversized_notes_and_broken_notebooks_are_refused() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut ws, mm) = enabled(&tmp);
    let mut big = note("a", "Foarte mare", "2026-11-10T10:00:00.000Z");
    big["body"] = json!("x".repeat(2 * 1024 * 1024 + 10));
    let e = mm
        .call(
            &mut ws,
            None,
            ID,
            "notebook_save",
            json!({"content": json!({"format": "suite-notes", "version": 1, "notes": [big]}).to_string()}),
        )
        .unwrap_err();
    assert!(
        e.to_string().contains("Foarte mare") && e.to_string().contains("MB"),
        "{e}"
    );
    for bad in [
        "nu e json",
        r#"{"format":"suite-sheet","version":1,"notes":[]}"#,
        r#"{"format":"suite-notes","version":1}"#,
        r#"{"format":"suite-notes","version":1,"notes":[{"title":"fără id"}]}"#,
    ] {
        assert!(
            mm.call(&mut ws, None, ID, "notebook_save", json!({"content": bad}))
                .is_err(),
            "{bad}"
        );
    }
    // Attachments: stored as module files and read back.
    let id = mm
        .call(
            &mut ws,
            None,
            ID,
            "attachment_add",
            json!({"data": "JVBERi0=", "ext": "pdf"}),
        )
        .unwrap()["id"]
        .clone();
    assert_eq!(
        mm.call(&mut ws, None, ID, "attachment_read", json!({"id": id}))
            .unwrap()["data"],
        "JVBERi0="
    );
    assert!(
        mm.call(
            &mut ws,
            None,
            ID,
            "attachment_add",
            json!({"data": "AA==", "ext": "exe"})
        )
        .is_err()
    );
}

/// The window keeps the `seen` of its last save (cosBridge.ts), not only the one of its load: its later
/// saves delete what it deleted, drop the sections it dropped and report no false conflicts.
#[test]
fn the_window_saving_again_and_again_with_the_seen_of_its_last_save() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut ws, mm) = enabled(&tmp);
    let (_, mut seen) = load(&mut ws, &mm);
    let mut book = json!({"format": "suite-notes", "version": 1,
        "notes": [note("a", "A", "2026-11-10T10:00:00.000Z"), note("b", "B", "2026-11-10T10:00:00.000Z")],
        "sections": ["Acasă", "Birou"]});
    let rep = save(&mut ws, &mm, &book, &seen);
    assert_eq!(rep["written"], 2);
    seen = rep["seen"].clone();
    // B changed twice in a row: written each time, never a conflict.
    for (i, t) in ["2026-11-10T11:00:00.000Z", "2026-11-10T12:00:00.000Z"].iter().enumerate() {
        book["notes"][1]["body"] = json!(format!("schimbarea {i}"));
        book["notes"][1]["updated"] = json!(t);
        let rep = save(&mut ws, &mm, &book, &seen);
        assert_eq!((rep["written"].as_u64(), rep["conflicts"].as_u64()), (Some(1), Some(0)), "{rep}");
        seen = rep["seen"].clone();
    }
    // A deleted and the section Birou dropped in the window: both gone from the core.
    book["notes"].as_array_mut().unwrap().remove(0);
    book["sections"] = json!(["Acasă"]);
    let rep = save(&mut ws, &mm, &book, &seen);
    assert_eq!(rep["deleted"], 1, "{rep}");
    let (now, _) = load(&mut ws, &mm);
    assert_eq!(titles(&now), vec!["B"]);
    assert_eq!(now["sections"], json!(["Acasă"]));
    assert_eq!(now["notes"][0]["body"], "schimbarea 1");
}
