//! Step 4.1: the planner — create, assign, track; filters; references and
//! dates checked; concurrent edits refused, not lost; data kept on disable.

use kgb_core::modules::ModuleManager;
use kgb_core::workspace::Workspace;
use kgb_core::{CORE_VERSION, CoreResult};
use kgb_planner::{ID, Planner, dates};
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

fn titles(v: &Value) -> Vec<String> {
    v.as_array()
        .unwrap()
        .iter()
        .map(|t| t["titlu"].as_str().unwrap().to_string())
        .collect()
}

#[test]
fn create_assign_track_and_filter() {
    let (_t, mut ws, mm) = setup();
    let ana = call(
        &mut ws,
        &mm,
        "person_save",
        json!({"nume": "Ana Popescu", "rol": "Contabil", "email": "ana@firma.ro"}),
    )
    .unwrap();
    let ion = call(
        &mut ws,
        &mm,
        "person_save",
        json!({"nume": "Ion Ionescu", "rol": "Depozit"}),
    )
    .unwrap();
    let p = call(&mut ws, &mm, "project_save", json!({"nume": "Inventar decembrie"})).unwrap();
    let mk = |ws: &mut Workspace, titlu: &str, resp: &Value, termen: Option<&str>, prio: &str| {
        call(ws, &mm, "task_save", json!({"titlu": titlu, "responsabil": resp["id"], "proiect": p["id"], "termen": termen, "prioritate": prio})).unwrap()
    };
    let t1 = mk(&mut ws, "Numără paleții", &ion, Some("2026-11-05"), "normala");
    mk(&mut ws, "Facturile lunii", &ana, Some("2026-11-20"), "urgenta");
    mk(&mut ws, "Raport inventar", &ana, Some("2026-11-20"), "normala");
    call(&mut ws, &mm, "task_save", json!({"titlu": "Fără termen", "termen": ""})).unwrap();

    // Sorted by due date, then priority (urgent first); no date last.
    let all = call(&mut ws, &mm, "tasks", json!({"azi": "2026-11-07"})).unwrap();
    assert_eq!(
        titles(&all),
        ["Numără paleții", "Facturile lunii", "Raport inventar", "Fără termen"]
    );
    assert_eq!(all[0]["intarziat"], true, "5 Nov is before today");
    assert_eq!(all[1]["intarziat"], false);
    assert_eq!(all[3]["responsabil"], Value::Null);

    // Filters: by person, unassigned, overdue, text, due before.
    assert_eq!(
        titles(&call(&mut ws, &mm, "tasks", json!({"responsabil": ana["id"]})).unwrap()),
        ["Facturile lunii", "Raport inventar"]
    );
    assert_eq!(
        titles(&call(&mut ws, &mm, "tasks", json!({"responsabil": ""})).unwrap()),
        ["Fără termen"]
    );
    assert_eq!(
        titles(&call(&mut ws, &mm, "tasks", json!({"azi": "2026-11-07", "intarziate": true})).unwrap()),
        ["Numără paleții"]
    );
    assert_eq!(
        titles(&call(&mut ws, &mm, "tasks", json!({"text": "FACTURI"})).unwrap()),
        ["Facturile lunii"]
    );
    // A calendar range: from the 6th to the 30th.
    assert_eq!(
        titles(
            &call(
                &mut ws,
                &mm,
                "tasks",
                json!({"de_la": "2026-11-06", "pana_la": "2026-11-30"})
            )
            .unwrap()
        ),
        ["Facturile lunii", "Raport inventar"]
    );
    assert_eq!(
        call(&mut ws, &mm, "tasks", json!({"pana_la": "10.11.2026"}))
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        1
    );

    // Track: status changes; done records when; a done task is not overdue.
    let done = call(
        &mut ws,
        &mm,
        "task_status",
        json!({"id": t1["id"], "version": t1["version"], "stare": "gata"}),
    )
    .unwrap();
    assert!(done["finalizat_ms"].as_u64().unwrap() > 0);
    let late = call(&mut ws, &mm, "tasks", json!({"azi": "2026-11-07", "intarziate": true})).unwrap();
    assert!(late.as_array().unwrap().is_empty());
    let s = call(&mut ws, &mm, "summary", json!({"azi": "2026-11-07"})).unwrap();
    assert_eq!(s["pe_stare"]["gata"], 1);
    assert_eq!(s["pe_stare"]["de_facut"], 3);
    let a = s["pe_persoana"]
        .as_array()
        .unwrap()
        .iter()
        .find(|x| x["responsabil"] == ana["id"])
        .unwrap();
    assert_eq!(a["deschise"], 2);
    // Reopening clears the completion time.
    let reopened = call(
        &mut ws,
        &mm,
        "task_status",
        json!({"id": t1["id"], "version": done["version"], "stare": "in_lucru"}),
    )
    .unwrap();
    assert_eq!(reopened["finalizat_ms"], Value::Null);
}

#[test]
fn checklists_edit_and_concurrent_changes() {
    let (_t, mut ws, mm) = setup();
    let t = call(&mut ws, &mm, "task_save", json!({"titlu": "Pregătire audit", "checklist": [
        {"text": "Extrase bancare", "gata": true}, {"text": "  ", "gata": false}, {"text": "Facturi furnizori", "gata": false}]})).unwrap();
    assert_eq!(
        t["checklist"],
        json!([{"text": "Extrase bancare", "gata": true}, {"text": "Facturi furnizori", "gata": false}]),
        "empty items dropped"
    );
    let v1 = t["version"].clone();
    let edited = call(
        &mut ws,
        &mm,
        "task_save",
        json!({"id": t["id"], "version": v1, "titlu": "Pregătire audit 2026", "checklist": t["checklist"]}),
    )
    .unwrap();
    assert_eq!(edited["titlu"], "Pregătire audit 2026");
    assert_eq!(edited["creat_ms"], t["creat_ms"]);
    // A second window still holding version 1 is refused, not silently overwriting.
    let err = call(
        &mut ws,
        &mm,
        "task_save",
        json!({"id": t["id"], "version": v1, "titlu": "Altă modificare"}),
    )
    .unwrap_err();
    assert!(err.to_string().to_lowercase().contains("vers"), "{err}");
}

#[test]
fn bad_input_is_refused_clearly() {
    let (_t, mut ws, mm) = setup();
    for (a, why) in [
        (json!({"titlu": "  "}), "nu poate fi gol"),
        (json!({"titlu": "x", "termen": "31.02.2026"}), "nu este o dată"),
        (json!({"titlu": "x", "prioritate": "maxima"}), "nu este una dintre"),
        (json!({"titlu": "x", "stare": "aproape"}), "nu este una dintre"),
        (
            json!({"titlu": "x", "responsabil": "00000000-0000-0000-0000-000000000001"}),
            "nu există",
        ),
        (json!({"titlu": "x", "proiect": "nu-e-id"}), "identificator invalid"),
        (json!({"titlu": "x".repeat(201)}), "mai mult de 200"),
    ] {
        let err = call(&mut ws, &mm, "task_save", a.clone()).unwrap_err().to_string();
        assert!(err.contains(why), "{a}: {err}");
    }
    assert!(
        call(&mut ws, &mm, "person_save", json!({"nume": "A", "email": "nu e email"}))
            .unwrap_err()
            .to_string()
            .contains("adresă de email")
    );
    assert!(call(&mut ws, &mm, "task_save", json!({"titlu": "x", "extra": 1})).is_err());
}

#[test]
fn people_and_projects_in_use_are_protected() {
    let (_t, mut ws, mm) = setup();
    let ion = call(&mut ws, &mm, "person_save", json!({"nume": "Ion"})).unwrap();
    let p = call(&mut ws, &mm, "project_save", json!({"nume": "P"})).unwrap();
    let t = call(
        &mut ws,
        &mm,
        "task_save",
        json!({"titlu": "x", "responsabil": ion["id"], "proiect": p["id"]}),
    )
    .unwrap();
    let err = call(
        &mut ws,
        &mm,
        "person_delete",
        json!({"id": ion["id"], "version": ion["version"]}),
    )
    .unwrap_err()
    .to_string();
    assert!(err.contains("1 taskuri nefinalizate"), "{err}");
    assert!(
        call(
            &mut ws,
            &mm,
            "project_delete",
            json!({"id": p["id"], "version": p["version"]})
        )
        .unwrap_err()
        .to_string()
        .contains("are 1 taskuri")
    );
    // An inactive person cannot receive new tasks, but keeps the old ones.
    let off = call(
        &mut ws,
        &mm,
        "person_save",
        json!({"id": ion["id"], "version": ion["version"], "nume": "Ion", "activ": false}),
    )
    .unwrap();
    assert!(
        call(
            &mut ws,
            &mm,
            "task_save",
            json!({"titlu": "y", "responsabil": ion["id"]})
        )
        .unwrap_err()
        .to_string()
        .contains("nu mai este activă")
    );
    assert_eq!(
        call(&mut ws, &mm, "tasks", json!({"responsabil": ion["id"]}))
            .unwrap()
            .as_array()
            .unwrap()
            .len(),
        1
    );
    // When the task is done, the person can be removed.
    call(
        &mut ws,
        &mm,
        "task_status",
        json!({"id": t["id"], "version": t["version"], "stare": "gata"}),
    )
    .unwrap();
    call(
        &mut ws,
        &mm,
        "person_delete",
        json!({"id": ion["id"], "version": off["version"]}),
    )
    .unwrap();
    assert_eq!(call(&mut ws, &mm, "persons", json!({})).unwrap(), json!([]));
}

#[test]
fn data_survives_disable_and_reopen() {
    let (_t, mut ws, mm) = setup();
    call(&mut ws, &mm, "task_save", json!({"titlu": "Rămâne"})).unwrap();
    mm.disable(&mut ws, ID).unwrap();
    assert!(call(&mut ws, &mm, "tasks", json!({})).is_err());
    let dir = ws.dir().to_path_buf();
    drop(ws);
    let mut ws = Workspace::open(&dir).unwrap();
    mm.enable(
        &mut ws,
        ID,
        &["storage.own".into(), "notify.send".into(), "files.own".into()],
    )
    .unwrap();
    assert_eq!(titles(&call(&mut ws, &mm, "tasks", json!({})).unwrap()), ["Rămâne"]);
}

#[test]
fn dates_are_real_calendar_days() {
    assert_eq!(dates::parse("2028-02-29").map(|d| d.ro()), Some("29.02.2028".into()));
    assert_eq!(dates::parse("29.02.2027"), None);
    assert_eq!(dates::parse("07.11.2026").map(|d| d.iso()), Some("2026-11-07".into()));
    assert_eq!(dates::parse("2026-13-01"), None);
    assert_eq!(dates::parse("ieri"), None);
}
