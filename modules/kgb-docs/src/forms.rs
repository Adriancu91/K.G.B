//! Forms (Etapa 4, step 4.9; Master Plan §6.5): define fields (text, number,
//! date, list), fill them in, keep the answers with their schema, export.
//!
//! - **The form is the schema.** Every answer is checked against the form's
//!   definition before it is saved, and records the version it was made with.
//! - **Editing a form that has answers creates a new version**; old versions
//!   are kept inside the form, so every answer can always be read with the
//!   definition it was given against.
//! - **Export** (CSV or XLSX) goes through the Sheets module's converters,
//!   which read the file back and compare it cell by cell.

use std::collections::{BTreeMap, BTreeSet};

use kgb_core::modules::ModuleContext;
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_sheets::book::{Book, Sheet};
use kgb_sheets::convert::{Cell, CsvStyle, table, to_csv, to_xlsx};
use kgb_store::{Fields, RecordState, Write};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

pub const FORMS: &str = "formulare";
pub const ANSWERS: &str = "raspunsuri";
const MAX_FIELDS: usize = 100;
const MAX_OPTIONS: usize = 100;
const MAX_TEXT: usize = 2_000;
const MAX_VERSIONS: usize = 50;

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("formularul", detail)
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Text,
    Numar,
    Data,
    Lista,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FieldDef {
    /// Stable key, made from the label when the field is created.
    #[serde(default)]
    pub cheie: String,
    pub eticheta: String,
    pub tip: Kind,
    #[serde(default)]
    pub obligatoriu: bool,
    /// List: the allowed values.
    #[serde(default)]
    pub optiuni: Vec<String>,
    /// Number: limits.
    #[serde(default)]
    pub min: Option<f64>,
    #[serde(default)]
    pub max: Option<f64>,
}

/// A key from a label: lower-case ASCII letters, digits and `_`.
fn key_of(label: &str) -> String {
    let map = |c: char| match c {
        'ă' | 'â' | 'Ă' | 'Â' => 'a',
        'î' | 'Î' => 'i',
        'ș' | 'ş' | 'Ș' | 'Ş' => 's',
        'ț' | 'ţ' | 'Ț' | 'Ţ' => 't',
        c if c.is_ascii_alphanumeric() => c.to_ascii_lowercase(),
        _ => '_',
    };
    let k: String = label.chars().map(map).collect();
    let k = k.split('_').filter(|p| !p.is_empty()).collect::<Vec<_>>().join("_");
    if k.is_empty() {
        "camp".into()
    } else {
        k.chars().take(40).collect()
    }
}

/// Checks a definition; fills in missing keys (unique, never one used by an
/// older version of the form for another field), keeps existing ones.
pub fn check_defs(mut defs: Vec<FieldDef>, reserved: &BTreeSet<String>) -> CoreResult<Vec<FieldDef>> {
    if defs.is_empty() {
        return Err(bad("are nevoie de cel puțin un câmp"));
    }
    if defs.len() > MAX_FIELDS {
        return Err(bad(format!("are mai mult de {MAX_FIELDS} de câmpuri")));
    }
    let given: BTreeSet<String> = defs.iter().map(|d| d.cheie.clone()).filter(|k| !k.is_empty()).collect();
    let defs_has_key = |k: &str| given.contains(k);
    let mut keys = BTreeSet::new();
    for d in &mut defs {
        d.eticheta = d.eticheta.trim().to_string();
        if d.eticheta.is_empty() || d.eticheta.chars().count() > 200 {
            return Err(bad("fiecare câmp are nevoie de o etichetă (1–200 de caractere)"));
        }
        if d.cheie.is_empty() {
            let base = key_of(&d.eticheta);
            let mut k = base.clone();
            let mut n = 2;
            while keys.contains(&k) || reserved.contains(&k) || defs_has_key(&k) {
                k = format!("{base}_{n}");
                n += 1;
            }
            d.cheie = k;
        }
        if !keys.insert(d.cheie.clone()) {
            return Err(bad(format!("două câmpuri au aceeași cheie „{}”", d.cheie)));
        }
        match d.tip {
            Kind::Lista => {
                d.optiuni = d
                    .optiuni
                    .iter()
                    .map(|o| o.trim().to_string())
                    .filter(|o| !o.is_empty())
                    .collect();
                let uniq: BTreeSet<&String> = d.optiuni.iter().collect();
                if d.optiuni.is_empty() || d.optiuni.len() > MAX_OPTIONS || uniq.len() != d.optiuni.len() {
                    return Err(bad(format!(
                        "lista „{}” are nevoie de 1–{MAX_OPTIONS} opțiuni diferite",
                        d.eticheta
                    )));
                }
            }
            _ => d.optiuni.clear(),
        }
        if d.tip == Kind::Numar {
            if let (Some(a), Some(b)) = (d.min, d.max)
                && a > b
            {
                return Err(bad(format!("la „{}” minimul e mai mare decât maximul", d.eticheta)));
            }
        } else {
            d.min = None;
            d.max = None;
        }
    }
    Ok(defs)
}

/// A number as typed in Romania or in the standard form: `1.234,5`, `1234.5`, `-3`.
fn number(s: &str) -> Option<f64> {
    let t: String = s.trim().chars().filter(|c| !c.is_whitespace()).collect();
    if t.is_empty() {
        return None;
    }
    // With a comma, the comma is the decimal mark (`1.234,5`). Without one,
    // dots in groups of three are thousands (`1.500` = 1500); otherwise the
    // dot is the decimal mark (`12.5`).
    let thousands = |x: &str| {
        let mut g = x.trim_start_matches('-').split('.');
        x.contains('.') && g.next().is_some_and(|h| (1..=3).contains(&h.len())) && g.all(|p| p.len() == 3)
    };
    let normal = if t.contains(',') {
        t.replace('.', "").replace(',', ".")
    } else if thousands(&t) {
        t.replace('.', "")
    } else {
        t
    };
    normal.parse::<f64>().ok().filter(|n| n.is_finite())
}

/// `YYYY-MM-DD` or `dd.mm.yyyy` → `YYYY-MM-DD`, only real dates.
fn date(s: &str) -> Option<String> {
    let s = s.trim();
    let (y, m, d) = if let Some((d, rest)) = s.split_once('.') {
        let (m, y) = rest.split_once('.')?;
        (y, m, d)
    } else {
        let mut p = s.split('-');
        (p.next()?, p.next()?, p.next()?)
    };
    let (y, m, d): (i32, u32, u32) = (y.parse().ok()?, m.parse().ok()?, d.parse().ok()?);
    let dim = match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 => 29,
        2 => 28,
        _ => return None,
    };
    ((1900..=2200).contains(&y) && (1..=dim).contains(&d)).then(|| format!("{y:04}-{m:02}-{d:02}"))
}

/// Validates the values typed for a form; returns them normalised (numbers
/// as numbers, dates as YYYY-MM-DD) or every problem at once.
pub fn validate(defs: &[FieldDef], given: &BTreeMap<String, Value>) -> CoreResult<Fields> {
    let mut out = Fields::new();
    let mut errs = Vec::new();
    if let Some(k) = given.keys().find(|k| !defs.iter().any(|d| &d.cheie == *k)) {
        return Err(bad(format!("câmpul „{k}” nu face parte din formular")));
    }
    for d in defs {
        let raw = match given.get(&d.cheie) {
            None | Some(Value::Null) => String::new(),
            Some(Value::String(s)) => s.trim().to_string(),
            Some(Value::Number(n)) => n.to_string(),
            Some(other) => other.to_string(),
        };
        if raw.is_empty() {
            if d.obligatoriu {
                errs.push(format!("„{}” e obligatoriu", d.eticheta));
            }
            out.insert(d.cheie.clone(), Value::Null);
            continue;
        }
        let v = match d.tip {
            Kind::Text => {
                if raw.chars().count() > MAX_TEXT {
                    errs.push(format!("„{}” are mai mult de {MAX_TEXT} de caractere", d.eticheta));
                    continue;
                }
                json!(raw)
            }
            Kind::Numar => match number(&raw) {
                None => {
                    errs.push(format!("„{}”: „{raw}” nu este un număr", d.eticheta));
                    continue;
                }
                Some(n) if d.min.is_some_and(|m| n < m) || d.max.is_some_and(|m| n > m) => {
                    let lim = match (d.min, d.max) {
                        (Some(a), Some(b)) => format!("între {a} și {b}"),
                        (Some(a), None) => format!("cel puțin {a}"),
                        (None, Some(b)) => format!("cel mult {b}"),
                        _ => String::new(),
                    };
                    errs.push(format!("„{}” trebuie să fie {lim}", d.eticheta));
                    continue;
                }
                Some(n) => json!(n),
            },
            Kind::Data => match date(&raw) {
                Some(iso) => json!(iso),
                None => {
                    errs.push(format!("„{}”: „{raw}” nu este o dată (zz.ll.aaaa)", d.eticheta));
                    continue;
                }
            },
            Kind::Lista => {
                if d.optiuni.contains(&raw) {
                    json!(raw)
                } else {
                    errs.push(format!("„{}”: „{raw}” nu este una dintre opțiuni", d.eticheta));
                    continue;
                }
            }
        };
        out.insert(d.cheie.clone(), v);
    }
    if errs.is_empty() {
        Ok(out)
    } else {
        Err(bad(errs.join("; ")))
    }
}

/// The form's versions: `[{versiune, campuri}]`, oldest first.
fn versions(r: &RecordState) -> Vec<(u64, Vec<FieldDef>)> {
    r.fields
        .get("versiuni")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(|v| {
                    Some((
                        v.get("versiune")?.as_u64()?,
                        serde_json::from_value(v.get("campuri")?.clone()).ok()?,
                    ))
                })
                .collect()
        })
        .unwrap_or_default()
}

fn current(r: &RecordState) -> CoreResult<(u64, Vec<FieldDef>)> {
    versions(r).pop().ok_or_else(|| bad("definiția formularului lipsește"))
}

pub fn view(r: &RecordState, answers: usize) -> CoreResult<Value> {
    let (v, defs) = current(r)?;
    Ok(json!({
        "id": r.id, "version": r.version,
        "nume": r.fields.get("nume").cloned().unwrap_or(Value::Null),
        "descriere": r.fields.get("descriere").cloned().unwrap_or(Value::Null),
        "versiune": v, "campuri": defs, "raspunsuri": answers,
    }))
}

fn live(ctx: &mut ModuleContext<'_>, coll: &str, id: Uuid, what: &str) -> CoreResult<RecordState> {
    ctx.get(coll, id)?
        .filter(|r| !r.deleted)
        .ok_or_else(|| bad(format!("{what} nu mai există")))
}

fn count_answers(ctx: &mut ModuleContext<'_>, form: Uuid) -> CoreResult<usize> {
    let id = json!(form.to_string());
    Ok(ctx.scan(ANSWERS, |r| r.fields.get("formular") == Some(&id))?.len())
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FormSave {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: Option<u64>,
    nume: String,
    #[serde(default)]
    descriere: Option<String>,
    campuri: Vec<FieldDef>,
}

pub fn form_save(ctx: &mut ModuleContext<'_>, a: FormSave) -> CoreResult<Value> {
    let nume = a.nume.trim().to_string();
    if nume.is_empty() || nume.chars().count() > 200 {
        return Err(bad("numele trebuie să aibă între 1 și 200 de caractere"));
    }
    let descriere = a.descriere.map(|d| d.trim().to_string()).filter(|d| !d.is_empty());
    if descriere.as_ref().is_some_and(|d| d.chars().count() > 2_000) {
        return Err(bad("descrierea are mai mult de 2000 de caractere"));
    }
    let now = now_ms();
    let (id, w) = match a.id {
        None => {
            let defs = check_defs(a.campuri, &BTreeSet::new())?;
            let mut f = Fields::new();
            f.insert("nume".into(), json!(nume));
            f.insert("descriere".into(), json!(descriere));
            f.insert("versiuni".into(), json!([{"versiune": 1, "campuri": defs}]));
            f.insert("creat_ms".into(), json!(now));
            f.insert("actualizat_ms".into(), json!(now));
            let id = Uuid::now_v7();
            (id, Write::put(FORMS, id, f).expect(0))
        }
        Some(id) => {
            let cur = live(ctx, FORMS, id, "formularul")?;
            let mut all = versions(&cur);
            let (last_v, last_defs) = all
                .last()
                .cloned()
                .ok_or_else(|| bad("definiția formularului lipsește"))?;
            // Keys of fields kept from the previous version stay the same; a new
            // field never reuses the key of a field from an older version.
            let reserved: BTreeSet<String> = all
                .iter()
                .flat_map(|(_, d)| d.iter().map(|x| x.cheie.clone()))
                .collect();
            let defs = check_defs(a.campuri, &reserved)?;
            let answered = count_answers(ctx, id)? > 0;
            if defs != last_defs {
                if answered {
                    if all.len() >= MAX_VERSIONS {
                        return Err(bad(format!(
                            "formularul are deja {MAX_VERSIONS} de versiuni; fă unul nou"
                        )));
                    }
                    all.push((last_v + 1, defs));
                } else if let Some(l) = all.last_mut() {
                    // No answers yet: the current version is simply corrected.
                    l.1 = defs;
                }
            }
            let mut f = cur.fields.clone();
            f.insert("nume".into(), json!(nume));
            f.insert("descriere".into(), json!(descriere));
            f.insert(
                "versiuni".into(),
                json!(
                    all.iter()
                        .map(|(v, c)| json!({"versiune": v, "campuri": c}))
                        .collect::<Vec<_>>()
                ),
            );
            f.insert("actualizat_ms".into(), json!(now));
            (id, Write::put(FORMS, id, f).expect(a.version.unwrap_or(cur.version)))
        }
    };
    ctx.write(vec![w])?;
    let r = live(ctx, FORMS, id, "formularul")?;
    let n = count_answers(ctx, id)?;
    view(&r, n)
}

pub fn forms(ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
    let mut list = ctx.scan(FORMS, |_| true)?;
    list.sort_by_key(|r| {
        r.fields
            .get("nume")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_lowercase()
    });
    let mut out = Vec::new();
    for r in &list {
        let n = count_answers(ctx, r.id)?;
        out.push(view(r, n)?);
    }
    Ok(json!(out))
}

pub fn form_delete(ctx: &mut ModuleContext<'_>, id: Uuid) -> CoreResult<Value> {
    let r = live(ctx, FORMS, id, "formularul")?;
    let n = count_answers(ctx, id)?;
    if n > 0 {
        return Err(bad(format!(
            "are {n} răspunsuri; exportă-le și șterge-le întâi, ca să nu se piardă nimic din greșeală"
        )));
    }
    ctx.write(vec![Write::delete(FORMS, id).expect(r.version)])?;
    Ok(json!({"deleted": id}))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AnswerSave {
    formular: Uuid,
    valori: BTreeMap<String, Value>,
}

pub fn answer_save(ctx: &mut ModuleContext<'_>, a: AnswerSave) -> CoreResult<Value> {
    let form = live(ctx, FORMS, a.formular, "formularul")?;
    let (v, defs) = current(&form)?;
    let values = validate(&defs, &a.valori)?;
    let mut f = Fields::new();
    f.insert("formular".into(), json!(a.formular.to_string()));
    f.insert("formular_versiune".into(), json!(v));
    f.insert("valori".into(), Value::Object(values));
    f.insert("creat_ms".into(), json!(now_ms()));
    let id = Uuid::now_v7();
    ctx.write(vec![Write::put(ANSWERS, id, f).expect(0)])?;
    Ok(json!({"id": id, "formular_versiune": v}))
}

pub fn answers(ctx: &mut ModuleContext<'_>, form: Uuid) -> CoreResult<Vec<RecordState>> {
    let id = json!(form.to_string());
    let mut list = ctx.scan(ANSWERS, |r| r.fields.get("formular") == Some(&id))?;
    list.sort_by_key(|r| r.id);
    Ok(list)
}

pub fn answer_delete(ctx: &mut ModuleContext<'_>, id: Uuid) -> CoreResult<Value> {
    let r = live(ctx, ANSWERS, id, "răspunsul")?;
    ctx.write(vec![Write::delete(ANSWERS, id).expect(r.version)])?;
    Ok(json!({"deleted": id}))
}

fn ro_date(iso: &str) -> String {
    let p: Vec<&str> = iso.split('-').collect();
    match p.as_slice() {
        [y, m, d] => format!("{d}.{m}.{y}"),
        _ => iso.to_string(),
    }
}

fn when(ms: u64) -> String {
    // Days since 1970 → civil date (UTC), as in the planner's calendar maths.
    let z = (ms / 86_400_000) as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{d:02}.{m:02}.{y}")
}

/// The answers as one table: every field of every version (current ones
/// first), plus the date and the form version each answer was given with.
pub fn answers_sheet(ctx: &mut ModuleContext<'_>, form: Uuid, csv: bool) -> CoreResult<(Sheet, usize)> {
    let f = live(ctx, FORMS, form, "formularul")?;
    let mut cols: Vec<FieldDef> = Vec::new();
    for (_, defs) in versions(&f).into_iter().rev() {
        for d in defs {
            if !cols.iter().any(|c| c.cheie == d.cheie) {
                cols.push(d);
            }
        }
    }
    let list = answers(ctx, form)?;
    let mut rows = vec![{
        let mut h = vec![Cell::from("Data răspunsului"), Cell::from("Versiunea formularului")];
        h.extend(cols.iter().map(|c| Cell::from(c.eticheta.as_str())));
        h
    }];
    for r in &list {
        let vals = r
            .fields
            .get("valori")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        let mut row = vec![
            Cell::from(when(
                r.fields.get("creat_ms").and_then(Value::as_u64).unwrap_or_default(),
            )),
            Cell::Number(r.fields.get("formular_versiune").and_then(Value::as_u64).unwrap_or(1) as f64),
        ];
        for c in &cols {
            row.push(match (vals.get(&c.cheie), &c.tip) {
                (Some(Value::Number(n)), _) => Cell::Number(n.as_f64().unwrap_or_default()),
                (Some(Value::String(s)), Kind::Data) => Cell::from(ro_date(s)),
                (Some(Value::String(s)), _) => {
                    // CSV: text that a spreadsheet would run as a formula stays text.
                    if csv && s.starts_with(['=', '+', '-', '@', '\t', '\r']) {
                        Cell::Text(format!("'{s}"))
                    } else {
                        Cell::from(s.as_str())
                    }
                }
                _ => Cell::Empty,
            });
        }
        rows.push(row);
    }
    let name = f.fields.get("nume").and_then(Value::as_str).unwrap_or("Răspunsuri");
    Ok((table(name, &rows), list.len()))
}

pub fn export(ctx: &mut ModuleContext<'_>, form: Uuid, format: &str, style: &str) -> CoreResult<(Vec<u8>, usize)> {
    let (sheet, n) = answers_sheet(ctx, form, format == "csv")?;
    let bytes = match format {
        "xlsx" => to_xlsx(&Book { sheets: vec![sheet] }).map_err(bad)?.bytes,
        "csv" => {
            let st = match style {
                "ro" => CsvStyle::Ro,
                "standard" => CsvStyle::Standard,
                other => return Err(bad(format!("stilul CSV „{other}” nu există (ro, standard)"))),
            };
            to_csv(&sheet, st, true).map_err(bad)?
        }
        other => return Err(bad(format!("formatul „{other}” nu există (xlsx, csv)"))),
    };
    Ok((bytes, n))
}
