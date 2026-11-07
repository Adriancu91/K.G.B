//! Step 4.6: reports per person and per project, with correct totals; the
//! XLSX and CSV exports reopen with exactly the report's values; a task title
//! that looks like a formula stays text.

use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_planner::{ID, Planner};
use kgb_sheets::book::{self, Format};
use serde_json::{Value, json};

fn setup() -> (tempfile::TempDir, Workspace, ModuleManager) {
    let tmp = tempfile::tempdir().unwrap();
    let mut ws = Workspace::create(&tmp.path().join("ws"), "T").unwrap();
    let mm = ModuleManager::new(vec![Box::new(Planner::new())], CORE_VERSION).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &["storage.own".into(), "notify.send".into(), "files.own".into()],
    )
    .unwrap();
    (tmp, ws, mm)
}

fn call(ws: &mut Workspace, mm: &ModuleManager, cmd: &str, a: Value) -> CoreResult<Value> {
    mm.call(ws, None, ID, cmd, a)
}

/// Ana: 3 tasks (1 done, 1 overdue); Ion: 1 blocked; unassigned: 1.
/// Project „Inventar”: 2; no project: 3.
fn data(ws: &mut Workspace, mm: &ModuleManager) {
    let ana = call(ws, mm, "person_save", json!({"nume": "Ana"})).unwrap();
    let ion = call(ws, mm, "person_save", json!({"nume": "Ion"})).unwrap();
    let inv = call(ws, mm, "project_save", json!({"nume": "Inventar"})).unwrap();
    let mk = |ws: &mut Workspace, t: Value| call(ws, mm, "task_save", t).unwrap();
    mk(
        ws,
        json!({"titlu": "Numără paleții", "responsabil": ana["id"], "proiect": inv["id"], "termen": "2026-11-01"}),
    );
    mk(
        ws,
        json!({"titlu": "Etichete", "responsabil": ana["id"], "proiect": inv["id"], "stare": "gata", "termen": "2026-11-01",
                  "checklist": [{"text": "a", "gata": true}, {"text": "b", "gata": false}]}),
    );
    mk(
        ws,
        json!({"titlu": "=HYPERLINK(\"http://x\")", "responsabil": ana["id"], "termen": "2026-12-01", "prioritate": "urgenta"}),
    );
    mk(
        ws,
        json!({"titlu": "Comandă", "responsabil": ion["id"], "stare": "blocat"}),
    );
    mk(ws, json!({"titlu": "Fără nimeni"}));
}

fn cell(s: &book::Sheet, r: u32, c: u32) -> String {
    s.values
        .get_value((r, c))
        .and_then(book::show)
        .map(|x| x.0)
        .unwrap_or_default()
}

#[test]
fn totals_are_correct() {
    let (_t, mut ws, mm) = setup();
    data(&mut ws, &mm);
    let r = call(&mut ws, &mm, "report", json!({"azi": "2026-11-07"})).unwrap();
    let people = r["pe_persoana"].as_array().unwrap();
    let names: Vec<&str> = people.iter().map(|p| p["nume"].as_str().unwrap()).collect();
    assert_eq!(names, ["Ana", "Ion", "Neatribuit"]);
    assert_eq!(people[0]["total"], 3);
    assert_eq!(people[0]["gata"], 1);
    assert_eq!(people[0]["de_facut"], 2);
    assert_eq!(people[0]["intarziate"], 1, "done tasks are never overdue");
    assert_eq!(people[1]["blocat"], 1);
    assert_eq!(r["total"]["total"], 5);
    assert_eq!(r["total"]["intarziate"], 1);
    let projects: Vec<(String, u64)> = r["pe_proiect"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| (p["nume"].as_str().unwrap().to_string(), p["total"].as_u64().unwrap()))
        .collect();
    assert_eq!(projects, [("Inventar".into(), 2), ("Fără proiect".into(), 3)]);
    // The sums of the rows are the total.
    let sum: u64 = people.iter().map(|p| p["total"].as_u64().unwrap()).sum();
    assert_eq!(sum, 5);
    // With a filter: only Ana's.
    let ana = people[0].clone();
    let only = call(
        &mut ws,
        &mm,
        "report",
        json!({"azi": "2026-11-07", "filtru": {"stare": "gata"}}),
    )
    .unwrap();
    assert_eq!(only["total"]["total"], 1);
    assert_eq!(ana["nume"], "Ana");
}

#[test]
fn xlsx_and_csv_reopen_identical() {
    let (tmp, mut ws, mm) = setup();
    data(&mut ws, &mm);
    let x = tmp.path().join("raport.xlsx");
    let out = call(
        &mut ws,
        &mm,
        "export_report",
        json!({"azi": "2026-11-07", "format": "xlsx", "dest": x}),
    )
    .unwrap();
    assert_eq!(out["taskuri"], 5);
    let b = book::read(&std::fs::read(&x).unwrap(), Format::Xlsx).unwrap();
    let names: Vec<&str> = b.sheets.iter().map(|s| s.name.as_str()).collect();
    assert_eq!(names, ["Pe persoane", "Pe proiecte", "Taskuri"]);
    let p = &b.sheets[0];
    assert_eq!(
        (0..7).map(|c| cell(p, 0, c)).collect::<Vec<_>>(),
        [
            "Persoană",
            "De făcut",
            "În lucru",
            "Blocat",
            "Gata",
            "Total",
            "Întârziate"
        ]
    );
    assert_eq!(
        (0..7).map(|c| cell(p, 1, c)).collect::<Vec<_>>(),
        ["Ana", "2", "0", "0", "1", "3", "1"]
    );
    assert_eq!(
        (0..7).map(|c| cell(p, 4, c)).collect::<Vec<_>>(),
        ["Total", "3", "0", "1", "1", "5", "1"]
    );
    // Numbers are numbers (sums work in the spreadsheet program).
    assert_eq!(p.values.get_value((1, 1)).and_then(book::show).map(|x| x.1), Some('n'));
    let t = &b.sheets[2];
    let row = (1..=5).find(|r| cell(t, *r, 0) == "Etichete").expect("task row");
    assert_eq!(cell(t, row, 3), "01.11.2026");
    assert_eq!(cell(t, row, 5), "Gata");
    assert_eq!(cell(t, row, 6), "1 din 2");
    // In XLSX the formula-looking title is plain text, unchanged.
    assert!((1..=5).any(|r| cell(t, r, 0) == "=HYPERLINK(\"http://x\")"));

    // CSV, Romanian style: `;`, UTF-8 with BOM, the formula-looking title neutralised.
    let c = tmp.path().join("taskuri.csv");
    call(
        &mut ws,
        &mm,
        "export_report",
        json!({"azi": "2026-11-07", "format": "csv", "tabel": "taskuri", "dest": c}),
    )
    .unwrap();
    let bytes = std::fs::read(&c).unwrap();
    assert!(bytes.starts_with(b"\xEF\xBB\xBF"));
    let text = String::from_utf8(bytes[3..].to_vec()).unwrap();
    assert!(text.starts_with("Task;Responsabil;Proiect;Termen;"), "{text}");
    assert!(text.contains("'=HYPERLINK"), "{text}");
    assert!(!text.contains(";=HYPERLINK") && !text.contains("\n=HYPERLINK"));
    let back = book::read(&std::fs::read(&c).unwrap(), Format::Csv).unwrap();
    assert_eq!(back.sheets[0].size().0, 6, "header + 5 tasks");

    // Bad arguments are refused, nothing written.
    let bad = tmp.path().join("nu.csv");
    assert!(
        call(
            &mut ws,
            &mm,
            "export_report",
            json!({"azi": "2026-11-07", "format": "pdf", "dest": bad})
        )
        .is_err()
    );
    assert!(
        call(
            &mut ws,
            &mm,
            "export_report",
            json!({"azi": "2026-11-07", "format": "csv", "tabel": "x", "dest": bad})
        )
        .is_err()
    );
    assert!(!bad.exists());
}
