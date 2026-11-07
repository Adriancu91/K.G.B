//! Reports (Etapa 4, step 4.6): tasks counted per person and per project,
//! by state, with overdue ones; exported as XLSX (three sheets) or CSV (one
//! table). The files are written by the Sheets module's converters, which
//! read every result back and compare it cell by cell before handing it out.

use std::collections::BTreeMap;

use kgb_sheets::book::{Book, Sheet};
use kgb_sheets::convert::{Cell, table};
use serde_json::{Value, json};

use crate::STATES;

const STATE_LABELS: [&str; 4] = ["De făcut", "În lucru", "Blocat", "Gata"];
const PRIORITY_LABELS: [(&str, &str); 4] = [
    ("scazuta", "Scăzută"),
    ("normala", "Normală"),
    ("ridicata", "Ridicată"),
    ("urgenta", "Urgentă"),
];

/// Counts for one row: per state, total, overdue.
#[derive(Clone, Copy, Default, Debug, PartialEq, Eq)]
pub struct Counts {
    pub stare: [usize; 4],
    pub total: usize,
    pub intarziate: usize,
}

impl Counts {
    fn add(&mut self, t: &Value) {
        if let Some(i) = STATES.iter().position(|s| t["stare"] == *s) {
            self.stare[i] += 1;
        }
        self.total += 1;
        self.intarziate += usize::from(t["intarziat"] == true);
    }
    fn json(&self, name: &str) -> Value {
        json!({
            "nume": name, "de_facut": self.stare[0], "in_lucru": self.stare[1],
            "blocat": self.stare[2], "gata": self.stare[3],
            "total": self.total, "intarziate": self.intarziate,
        })
    }
    fn cells(&self, name: &str) -> Vec<Cell> {
        let mut row = vec![Cell::from(name)];
        row.extend(self.stare.iter().map(|n| Cell::from(*n)));
        row.push(Cell::from(self.total));
        row.push(Cell::from(self.intarziate));
        row
    }
}

pub struct Report {
    /// (name, counts), sorted by name; „Neatribuit” / „Fără proiect” last.
    pub people: Vec<(String, Counts)>,
    pub projects: Vec<(String, Counts)>,
    pub total: Counts,
    pub tasks: Vec<Value>,
    names: BTreeMap<String, String>,
}

const NO_PERSON: &str = "Neatribuit";
const NO_PROJECT: &str = "Fără proiect";

fn group(tasks: &[Value], field: &str, names: &BTreeMap<String, String>, none: &str) -> Vec<(String, Counts)> {
    let mut by: BTreeMap<String, Counts> = BTreeMap::new();
    let mut empty = Counts::default();
    for t in tasks {
        match t[field].as_str().and_then(|id| names.get(id)) {
            Some(n) => by.entry(n.clone()).or_default().add(t),
            None => empty.add(t),
        }
    }
    let mut out: Vec<(String, Counts)> = by.into_iter().collect();
    out.sort_by_key(|(n, _)| n.to_lowercase());
    if empty.total > 0 {
        out.push((none.to_string(), empty));
    }
    out
}

/// `names`: id → name, for people and projects.
pub fn build(tasks: Vec<Value>, names: BTreeMap<String, String>) -> Report {
    let mut total = Counts::default();
    for t in &tasks {
        total.add(t);
    }
    Report {
        people: group(&tasks, "responsabil", &names, NO_PERSON),
        projects: group(&tasks, "proiect", &names, NO_PROJECT),
        total,
        tasks,
        names,
    }
}

impl Report {
    pub fn json(&self) -> Value {
        let rows = |v: &[(String, Counts)]| v.iter().map(|(n, c)| c.json(n)).collect::<Vec<_>>();
        json!({
            "pe_persoana": rows(&self.people),
            "pe_proiect": rows(&self.projects),
            "total": self.total.json("Total"),
        })
    }

    fn counts_sheet(&self, name: &str, first: &str, rows: &[(String, Counts)], csv: bool) -> Sheet {
        let mut out = vec![header(first, csv)];
        out.extend(rows.iter().map(|(n, c)| safe(c.cells(n), csv)));
        out.push(self.total.cells("Total"));
        table(name, &out)
    }

    fn tasks_sheet(&self, csv: bool) -> Sheet {
        let head = [
            "Task",
            "Responsabil",
            "Proiect",
            "Termen",
            "Prioritate",
            "Stare",
            "Checklist",
            "Întârziat",
            "Se repetă",
        ];
        let mut out = vec![head.iter().map(|h| Cell::from(*h)).collect::<Vec<_>>()];
        for t in &self.tasks {
            let s = |k: &str| t[k].as_str().unwrap_or_default().to_string();
            let name = |k: &str| {
                t[k].as_str()
                    .and_then(|id| self.names.get(id))
                    .cloned()
                    .unwrap_or_default()
            };
            let termen = t["termen"]
                .as_str()
                .and_then(crate::dates::parse)
                .map(|d| d.ro())
                .unwrap_or_default();
            let prio = PRIORITY_LABELS
                .iter()
                .find(|(k, _)| t["prioritate"] == *k)
                .map(|p| p.1)
                .unwrap_or_default();
            let stare = STATES
                .iter()
                .position(|x| t["stare"] == *x)
                .map(|i| STATE_LABELS[i])
                .unwrap_or_default();
            let list = t["checklist"].as_array().cloned().unwrap_or_default();
            // „2 din 3”, not „2/3”: spreadsheet programs would read that as a date.
            let check = if list.is_empty() {
                String::new()
            } else {
                format!(
                    "{} din {}",
                    list.iter().filter(|c| c["gata"] == true).count(),
                    list.len()
                )
            };
            out.push(safe(
                vec![
                    Cell::from(s("titlu")),
                    Cell::from(name("responsabil")),
                    Cell::from(name("proiect")),
                    Cell::from(termen),
                    Cell::from(prio),
                    Cell::from(stare),
                    Cell::from(check),
                    Cell::from(if t["intarziat"] == true { "da" } else { "" }),
                    Cell::from(s("repetare")),
                ],
                csv,
            ));
        }
        table("Taskuri", &out)
    }

    /// The workbook: per person, per project, the task list.
    pub fn book(&self) -> Book {
        Book {
            sheets: vec![
                self.counts_sheet("Pe persoane", "Persoană", &self.people, false),
                self.counts_sheet("Pe proiecte", "Proiect", &self.projects, false),
                self.tasks_sheet(false),
            ],
        }
    }

    /// One table for CSV: `persoane`, `proiecte` or `taskuri`.
    pub fn csv_sheet(&self, which: &str) -> Option<Sheet> {
        Some(match which {
            "persoane" => self.counts_sheet("Pe persoane", "Persoană", &self.people, true),
            "proiecte" => self.counts_sheet("Pe proiecte", "Proiect", &self.projects, true),
            "taskuri" => self.tasks_sheet(true),
            _ => return None,
        })
    }
}

fn header(first: &str, _csv: bool) -> Vec<Cell> {
    let mut h = vec![Cell::from(first)];
    h.extend(STATE_LABELS.iter().map(|s| Cell::from(*s)));
    h.push(Cell::from("Total"));
    h.push(Cell::from("Întârziate"));
    h
}

/// CSV only: text that a spreadsheet program would run as a formula
/// (starting with = + - @) gets a leading apostrophe, so a task title can
/// never become a formula on the user's computer. XLSX stores text as text.
fn safe(row: Vec<Cell>, csv: bool) -> Vec<Cell> {
    if !csv {
        return row;
    }
    row.into_iter()
        .map(|c| match c {
            Cell::Text(t) if t.starts_with(['=', '+', '-', '@', '\t', '\r']) => Cell::Text(format!("'{t}")),
            other => other,
        })
        .collect()
}
