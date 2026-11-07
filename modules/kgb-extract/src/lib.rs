//! `kgb.extract` — initial data extraction (Etapa 3, step 3.9; Master Plan
//! §6.4): invoices from PDFs that contain text and from spreadsheets.
//!
//! The flow of §6.4: choose the file → the module finds the fields → each
//! value shows its source (page and line, or cell) and a confidence → the
//! user confirms or corrects the uncertain ones → import into the module's
//! invoice register → a journal entry records what came from where and what
//! the user confirmed or corrected.
//!
//! Rules:
//! - Nothing uncertain is imported silently: every field below "sigur", every
//!   corrected value and every value typed by hand must be confirmed.
//! - Required fields (number, date, supplier, total) must be present.
//! - The same invoice (number + supplier) is not imported twice by accident.
//! - Only intact PDFs (strict check, D-032) and readable spreadsheets (zip-bomb
//!   guard, D-033); scanned PDFs need OCR, which is not part of this step
//!   (D-035).
//!
//! Commands: `list`, `import {name, data}`, `extract {id, version?}`,
//! `confirm {id, version?, values, confirmed, allow_duplicate?}`, `records`,
//! `journal`, `export_records {dest, style}`, `delete {id}`.

pub mod fields;

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::notifications::{Level, Notice};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_sheets::book::{self, Format};
use kgb_store::{Fields, Query, Sort, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

use fields::{FIELDS, Field, Line, Source};

pub const ID: &str = "kgb.extract";
const INVOICES: &str = "facturi";
const JOURNAL: &str = "jurnal";
const MAX_LINES: usize = 20_000;

pub struct Extract {
    manifest: Manifest,
}

impl Extract {
    pub fn new() -> Extract {
        Extract {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Extract {
    fn default() -> Self {
        Extract::new()
    }
}

fn args<T: DeserializeOwned>(v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid("comanda", e.to_string()))
}

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("extragerea", detail)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Import {
    name: String,
    data: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Which {
    id: Uuid,
    #[serde(default)]
    version: Option<u64>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Confirm {
    id: Uuid,
    #[serde(default)]
    version: Option<u64>,
    /// Final values by field key (as shown or corrected by the user).
    values: BTreeMap<String, String>,
    /// Fields the user explicitly confirmed.
    confirmed: Vec<String>,
    #[serde(default)]
    allow_duplicate: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ExportRecords {
    dest: PathBuf,
    style: String,
}

fn is_pdf(name: &str) -> bool {
    name.to_lowercase().ends_with(".pdf")
}

/// The text lines of a document, each with its position.
fn lines_of(name: &str, data: &[u8]) -> CoreResult<Vec<Line>> {
    if is_pdf(name) {
        match kgb_pdf::check::check(data) {
            kgb_pdf::check::Status::Intact(_) => {}
            s => return Err(bad(format!("{} — nu se pot extrage date", s.reason()))),
        }
        let doc = lopdf::Document::load_mem(data).map_err(|e| bad(e.to_string()))?;
        let mut out = Vec::new();
        for (page, _) in doc.get_pages() {
            let text = doc.extract_text(&[page]).unwrap_or_default();
            for (i, t) in text.lines().enumerate() {
                if !t.trim().is_empty() {
                    out.push(Line {
                        text: t.to_string(),
                        source: Source::Pagina {
                            page,
                            line: i as u32 + 1,
                        },
                    });
                }
            }
        }
        if out.iter().map(|l| l.text.trim().len()).sum::<usize>() < 20 {
            return Err(bad(
                "PDF-ul nu conține text (pare scanat); citirea scanărilor (OCR) nu face parte din acest pas",
            ));
        }
        out.truncate(MAX_LINES);
        return Ok(out);
    }
    let format = Format::from_name(name)
        .ok_or_else(|| bad("formatul nu este acceptat (.pdf, .xlsx, .xlsm, .xls, .ods, .csv)"))?;
    let b = book::read(data, format).map_err(bad)?;
    let mut out = Vec::new();
    for s in &b.sheets {
        let (h, w) = s.size();
        for r in 0..h {
            for c in 0..w {
                if let Some((t, _)) = s.values.get_value((r, c)).and_then(book::show)
                    && !t.trim().is_empty()
                {
                    out.push(Line {
                        text: t,
                        source: Source::Celula {
                            sheet: s.name.clone(),
                            cell: format!("{}{}", kgb_sheets::save::col_name(c + 1), r + 1),
                        },
                    });
                }
                if out.len() >= MAX_LINES {
                    return Ok(out);
                }
            }
        }
    }
    Ok(out)
}

/// Checks a final value of a field; returns it normalised.
fn normalise(key: &str, v: &str) -> Result<Value, String> {
    let v = v.trim();
    if v.is_empty() {
        return Ok(Value::Null);
    }
    match key {
        "data" | "scadenta" => fields::date(v)
            .map(|d| json!(d.1))
            .ok_or_else(|| format!("„{v}” nu este o dată (zz.ll.aaaa)")),
        "total_fara_tva" | "tva" | "total" => fields::amount(v)
            .map(|n| json!((n * 100.0).round() / 100.0))
            .ok_or_else(|| format!("„{v}” nu este o sumă")),
        _ => Ok(json!(v.chars().take(300).collect::<String>())),
    }
}

/// `dd.mm.yyyy` → `yyyy-mm-dd` (the form compared with today).
fn iso_of(ro: &str) -> Option<String> {
    let p: Vec<&str> = ro.split('.').collect();
    match p.as_slice() {
        [d, m, y] if d.len() == 2 && m.len() == 2 && y.len() == 4 => Some(format!("{y}-{m}-{d}")),
        _ => None,
    }
}

/// The day after `iso` (yyyy-mm-dd), without a date library.
fn next_day(iso: &str) -> Option<String> {
    let p: Vec<u32> = iso.split('-').map(|x| x.parse().ok()).collect::<Option<_>>()?;
    let [y, m, d] = p[..] else { return None };
    let dim = match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 => 29,
        2 => 28,
        _ => return None,
    };
    Some(match (d < dim, m < 12) {
        (true, _) => format!("{y:04}-{m:02}-{:02}", d + 1),
        (false, true) => format!("{y:04}-{:02}-01", m + 1),
        (false, false) => format!("{:04}-01-01", y + 1),
    })
}

impl Extract {
    /// Invoice due dates (step 4.5): a reminder the day before and on the
    /// day. The app does not know whether an invoice was paid, so there is
    /// no „overdue” reminder; the text says what it knows.
    fn reminders(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        let tomorrow = next_day(today).ok_or_else(|| bad(format!("„{today}” nu este o dată")))?;
        let invoices = ctx.scan(INVOICES, |r| r.fields.get("scadenta").and_then(Value::as_str).is_some())?;
        let mut sent = 0;
        for f in invoices {
            let scad = f.fields["scadenta"].as_str().unwrap_or_default();
            let Some(iso) = iso_of(scad) else { continue };
            let (kind, level, when) = if iso == today {
                ("azi", Level::Urgent, "azi")
            } else if iso == tomorrow {
                ("maine", Level::Atentie, "mâine")
            } else {
                continue;
            };
            let key = format!("scadenta-{kind}:{}:{iso}", f.id);
            if sent >= 10 || ctx.notify_key_used(&key)? {
                continue;
            }
            let s = |k: &str| f.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
            let total = f
                .fields
                .get("total")
                .and_then(Value::as_f64)
                .map(|t| format!("Total {t:.2} · "))
                .unwrap_or_default();
            ctx.notify(
                &Notice::new(
                    format!("Factura {} scade {when}", s("numar")),
                    format!("{}: {total}scadență {scad}.", s("furnizor")),
                )
                .level(level)
                .key(key),
            )?;
            sent += 1;
        }
        Ok(())
    }
}

impl Module for Extract {
    fn remind(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        self.reminders(ctx, today)
    }

    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "list" => Ok(serde_json::to_value(ctx.list_documents()?).expect("serialisable")),
            "import" => {
                let a: Import = args(a)?;
                let data = B64
                    .decode(a.data.as_bytes())
                    .map_err(|_| bad("conținutul nu este valid (base64)"))?;
                // Refuse at once what cannot be read (the line reader checks it).
                lines_of(&a.name, &data)?;
                let d = ctx.import_document(&a.name, &data)?;
                Ok(json!({"document": d}))
            }
            "extract" => {
                let a: Which = args(a)?;
                let doc = ctx
                    .list_documents()?
                    .into_iter()
                    .find(|d| d.id == a.id)
                    .ok_or_else(|| bad("documentul nu există"))?;
                let (v, data) = ctx.read_document(a.id, a.version)?;
                let lines = lines_of(&doc.name, &data)?;
                let found = fields::extract(&lines);
                let list: Vec<Value> = FIELDS
                    .iter()
                    .map(|(key, label, required)| match found.iter().find(|f| f.key == *key) {
                        Some(f) => {
                            let mut j = serde_json::to_value(f).expect("serialisable");
                            j["required"] = json!(required);
                            j
                        }
                        None => json!({"key": key, "label": label, "required": required, "value": "", "level": "lipsă",
                                       "confidence": 0, "note": "negăsit: completează de mână dacă e cazul"}),
                    })
                    .collect();
                Ok(json!({"document": doc.name, "version": v.number, "fields": list, "lines": lines.len()}))
            }
            "confirm" => self.confirm(ctx, args(a)?),
            "records" => {
                let q = Query {
                    sort: Some(Sort {
                        field: "importat_ms".into(),
                        desc: true,
                    }),
                    ..Query::default()
                };
                let r = ctx.query(INVOICES, &q)?;
                Ok(json!(
                    r.records
                        .iter()
                        .map(|x| {
                            let mut f = Value::Object(x.fields.clone());
                            f["id"] = json!(x.id);
                            f
                        })
                        .collect::<Vec<_>>()
                ))
            }
            "journal" => {
                let q = Query {
                    sort: Some(Sort {
                        field: "la_ms".into(),
                        desc: true,
                    }),
                    ..Query::default()
                };
                let r = ctx.query(JOURNAL, &q)?;
                Ok(json!(
                    r.records
                        .iter()
                        .map(|x| Value::Object(x.fields.clone()))
                        .collect::<Vec<_>>()
                ))
            }
            "export_records" => {
                let a: ExportRecords = args(a)?;
                let ro = match a.style.as_str() {
                    "ro" => true,
                    "standard" => false,
                    other => return Err(bad(format!("stilul CSV „{other}” nu există (ro, standard)"))),
                };
                let q = Query {
                    sort: Some(Sort {
                        field: "importat_ms".into(),
                        desc: false,
                    }),
                    ..Query::default()
                };
                let recs = ctx.query(INVOICES, &q)?.records;
                let mut w = csv::WriterBuilder::new()
                    .delimiter(if ro { b';' } else { b',' })
                    .terminator(csv::Terminator::CRLF)
                    .from_writer(b"\xEF\xBB\xBF".to_vec());
                w.write_record(FIELDS.iter().map(|f| f.1))
                    .map_err(|e| bad(e.to_string()))?;
                for r in &recs {
                    let row: Vec<String> = FIELDS
                        .iter()
                        .map(|(k, _, _)| match r.fields.get(*k) {
                            Some(Value::Number(n)) => {
                                let s = format!("{:.2}", n.as_f64().unwrap_or_default());
                                if ro { s.replace('.', ",") } else { s }
                            }
                            Some(Value::String(s)) => s.clone(),
                            _ => String::new(),
                        })
                        .collect();
                    w.write_record(&row).map_err(|e| bad(e.to_string()))?;
                }
                let bytes = w.into_inner().map_err(|e| bad(e.to_string()))?;
                ctx.export_bytes(&a.dest, &bytes, true)?;
                Ok(json!({"records": recs.len()}))
            }
            "delete" => {
                let a: Which = args(a)?;
                ctx.delete_document(a.id)?;
                Ok(json!({"deleted": a.id}))
            }
            other => Err(CoreError::invalid(
                "comanda",
                format!("„{other}” nu există în modulul Extragere date"),
            )),
        }
    }
}

impl Extract {
    fn confirm(&self, ctx: &mut ModuleContext<'_>, a: Confirm) -> CoreResult<Value> {
        let doc = ctx
            .list_documents()?
            .into_iter()
            .find(|d| d.id == a.id)
            .ok_or_else(|| bad("documentul nu există"))?;
        let (v, data) = ctx.read_document(a.id, a.version)?;
        let found: Vec<Field> = fields::extract(&lines_of(&doc.name, &data)?);
        let confirmed: BTreeSet<&str> = a.confirmed.iter().map(String::as_str).collect();
        let (mut auto, mut corrected) = (Vec::new(), Vec::new());
        let mut rec = Fields::new();
        let mut problems = Vec::new();
        for (key, label, required) in FIELDS {
            let extracted = found.iter().find(|f| f.key == *key);
            let given = a.values.get(*key).map(|s| s.trim().to_string());
            let final_value = given
                .clone()
                .unwrap_or_else(|| extracted.map(|f| f.value.clone()).unwrap_or_default());
            let value = match normalise(key, &final_value) {
                Ok(v) => v,
                Err(e) => {
                    problems.push(format!("{label}: {e}"));
                    continue;
                }
            };
            if *required && value.is_null() {
                problems.push(format!("{label}: lipsește"));
                continue;
            }
            if value.is_null() {
                rec.insert((*key).into(), Value::Null);
                continue;
            }
            let changed = match extracted {
                Some(f) => normalise(key, &f.value).ok() != Some(value.clone()),
                None => true,
            };
            let sure = extracted.is_some_and(|f| f.level == "sigur") && !changed;
            if sure {
                auto.push(json!(key));
            } else if !confirmed.contains(key) {
                problems.push(format!(
                    "{label}: trebuie confirmat ({})",
                    if changed {
                        "valoare corectată sau scrisă de mână"
                    } else {
                        extracted.map(|f| f.level).unwrap_or("lipsă")
                    }
                ));
                continue;
            } else if changed {
                corrected.push(json!(key));
            }
            rec.insert((*key).into(), value);
        }
        if !problems.is_empty() {
            return Err(bad(format!("nu s-a importat nimic: {}", problems.join("; "))));
        }
        let confirmed_list: Vec<Value> = FIELDS
            .iter()
            .filter(|(k, _, _)| confirmed.contains(k) && !auto.contains(&json!(k)))
            .map(|(k, _, _)| json!(k))
            .collect();
        // The same invoice twice is almost always a mistake.
        let numar = rec.get("numar").cloned().unwrap_or(Value::Null);
        let furnizor_key = rec
            .get("cui_furnizor")
            .filter(|v| !v.is_null())
            .map(|v| ("cui_furnizor", v.clone()))
            .unwrap_or(("furnizor", rec.get("furnizor").cloned().unwrap_or(Value::Null)));
        let dup = ctx.scan(INVOICES, |r| {
            r.fields.get("numar") == Some(&numar) && r.fields.get(furnizor_key.0) == Some(&furnizor_key.1)
        })?;
        if !dup.is_empty() && !a.allow_duplicate {
            return Err(bad(format!(
                "factura {} de la acest furnizor a fost deja importată",
                numar.as_str().unwrap_or("")
            )));
        }
        let now = now_ms();
        rec.insert("sursa_document".into(), json!(doc.id.to_string()));
        rec.insert("sursa_versiune".into(), json!(v.number));
        rec.insert("importat_ms".into(), json!(now));
        let id = Uuid::now_v7();
        let mut j = Fields::new();
        j.insert("actiune".into(), json!("import"));
        j.insert("factura".into(), json!(id.to_string()));
        j.insert("sursa_document".into(), json!(doc.id.to_string()));
        j.insert("sursa_versiune".into(), json!(v.number));
        j.insert("automate".into(), json!(auto));
        j.insert("confirmate".into(), json!(confirmed_list));
        j.insert("corectate".into(), json!(corrected));
        j.insert("la_ms".into(), json!(now));
        // Record and journal entry in one atomic write.
        ctx.write(vec![
            Write::put(INVOICES, id, rec.clone()).expect(0),
            Write::put(JOURNAL, Uuid::now_v7(), j).expect(0),
        ])?;
        ctx.log("factură importată după confirmare");
        let mut out = Value::Object(rec);
        out["id"] = json!(id);
        Ok(json!({"record": out, "automate": auto, "confirmate": confirmed_list, "corectate": corrected}))
    }
}
