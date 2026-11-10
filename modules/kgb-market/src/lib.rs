//! `kgb.market` — „Piață”, part 1 (Etapa 7, step 7.6; D-087): a watch list kept by hand. A record, not
//! investment advice: K.G.B. fetches no prices (that is part 2, with a provider the owner chooses) and says
//! nothing about buying or selling.
//!
//! - **Instruments**: symbol (unique), name, kind, currency, a note.
//! - **Quotes**: one price at one moment, with its source (typed in, or the CSV file it came from). The moment
//!   is Romania's local time as written (`AAAA-LL-ZZTHH:MM`), so nothing moves when the clocks change. Prices
//!   are signed whole numbers in ten-thousandths (a price can be negative: oil, 2020). The same instrument and
//!   moment never come in twice.
//! - **Alerts**: above / under a level; only the **last** quote is compared, so importing a year of history
//!   gives at most one notice per alert; the key `alerta:<id>@<moment>` keeps it from repeating.
//!
//! Commands (JSON in, JSON out):
//! - `list` → instruments with their last quote, the change since the one before and their alerts
//! - `instrument_save {id?, version?, simbol, nume, fel, moneda, nota?}`, `instrument_delete {id, version}`
//! - `quote_add {instrument, moment, pret, sursa?}`, `quote_delete {id, version}`
//! - `quotes {instrument, de_la?, pana_la?}` → oldest first
//! - `import_csv {instrument, name, data}` (base64) → `{adaugate, existente, refuzate: [{rand, motiv}]}`
//! - `alert_save {id?, version?, instrument, directie, nivel, activa?}`, `alert_delete {id, version}`

use std::collections::BTreeMap;

use base64::Engine;
use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::notifications::{Level, Notice};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.market";
pub const INSTRUMENTS: &str = "instruments";
pub const QUOTES: &str = "quotes";
pub const ALERTS: &str = "alerts";
pub const KINDS: [&str; 5] = ["actiune", "fond", "valuta", "marfa", "altul"];
/// Prices are kept in ten-thousandths.
pub const SCALE: i64 = 10_000;
const MAX_PRICE: i64 = 1_000_000_000_000 * SCALE;
/// The largest CSV accepted (a few years of daily quotes are well under it).
const MAX_CSV: usize = 8 * 1024 * 1024;
const MAX_ROWS: usize = 100_000;

pub struct Market {
    manifest: Manifest,
}

impl Market {
    pub fn new() -> Market {
        Market {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Market {
    fn default() -> Self {
        Market::new()
    }
}

fn args<T: DeserializeOwned>(command: &str, v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid(format!("argumentele comenzii {command}"), e.to_string()))
}

fn bad(what: &str, detail: impl Into<String>) -> CoreError {
    CoreError::invalid(what, detail)
}

fn s(r: &RecordState, k: &str) -> String {
    r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn i(r: &RecordState, k: &str) -> i64 {
    r.fields.get(k).and_then(Value::as_i64).unwrap_or_default()
}

// ---------- numbers and moments ----------

/// "1.234,5678", "1234.5678", "-37,63", "1 250" → ten-thousandths; at most 4 decimals (more is refused, not
/// rounded). A lone "." or "," with exactly 3 digits after it and no other separator is read as thousands
/// only when it is followed by nothing else (`1.250` = 1250, as Romanian lists write it).
pub fn price(t: &str) -> Option<i64> {
    let t: String = t
        .trim()
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '\u{a0}')
        .collect();
    let (neg, t) = match t.strip_prefix('-') {
        Some(r) => (true, r.to_string()),
        None => (false, t.strip_prefix('+').unwrap_or(&t).to_string()),
    };
    if t.is_empty() || !t.chars().all(|c| c.is_ascii_digit() || c == '.' || c == ',') {
        return None;
    }
    let (dots, commas) = (t.matches('.').count(), t.matches(',').count());
    // The decimal mark is the last separator; the other one groups thousands.
    let dec = match (t.rfind('.'), t.rfind(',')) {
        (Some(d), Some(c)) => Some(d.max(c)),
        (Some(d), None) if dots == 1 && t.len() - d - 1 != 3 => Some(d),
        (None, Some(c)) if commas == 1 => Some(c),
        (Some(_), None) | (None, Some(_)) => None,
        (None, None) => None,
    };
    let (whole, frac) = match dec {
        // The decimal mark appears once; the other separator only groups thousands, before it.
        Some(p) if t.matches(&t[p..=p]).count() == 1 => (&t[..p], &t[p + 1..]),
        Some(_) => return None,
        None => (t.as_str(), ""),
    };
    let whole: String = whole.chars().filter(char::is_ascii_digit).collect();
    if frac.len() > 4 || frac.contains(['.', ',']) || (whole.is_empty() && frac.is_empty()) {
        return None;
    }
    let w: i64 = if whole.is_empty() { 0 } else { whole.parse().ok()? };
    let f: i64 = format!("{frac:0<4}").parse().ok()?;
    let v = w.checked_mul(SCALE)?.checked_add(f)?;
    if v > MAX_PRICE {
        return None;
    }
    Some(if neg { -v } else { v })
}

/// Ten-thousandths → "1.234,5678" (trailing zeros after the second decimal dropped: "32,50").
pub fn price_text(v: i64) -> String {
    let neg = v < 0;
    let a = v.unsigned_abs();
    let (w, f) = (a / SCALE as u64, a % SCALE as u64);
    let digits = w.to_string();
    let mut grouped = String::new();
    for (k, ch) in digits.chars().enumerate() {
        if k > 0 && (digits.len() - k) % 3 == 0 {
            grouped.push('.');
        }
        grouped.push(ch);
    }
    let mut frac = format!("{f:04}");
    while frac.len() > 2 && frac.ends_with('0') {
        frac.pop();
    }
    format!("{}{grouped},{frac}", if neg { "-" } else { "" })
}

fn days_in(y: u32, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if (y.is_multiple_of(4) && !y.is_multiple_of(100)) || y.is_multiple_of(400) => 29,
        _ => 28,
    }
}

/// A date (`AAAA-LL-ZZ`, `ZZ.LL.AAAA`, `ZZ/LL/AAAA`, `ZZ-LL-AAAA`) and an optional time (`HH:MM`, `HH:MM:SS`), as
/// written in Romania → `AAAA-LL-ZZTHH:MM` (midnight when there is no time).
pub fn moment(date: &str, time: &str) -> Option<String> {
    let d = date.trim();
    let parts: Vec<&str> = d.split(['-', '.', '/']).collect();
    if parts.len() != 3
        || !parts
            .iter()
            .all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
    {
        return None;
    }
    let (y, m, day) = if parts[0].len() == 4 {
        (parts[0], parts[1], parts[2])
    } else if parts[2].len() == 4 {
        (parts[2], parts[1], parts[0])
    } else {
        return None;
    };
    let (y, m, day): (u32, u32, u32) = (y.parse().ok()?, m.parse().ok()?, day.parse().ok()?);
    if !(1900..=2200).contains(&y) || !(1..=12).contains(&m) || day < 1 || day > days_in(y, m) {
        return None;
    }
    let t = time.trim();
    let (h, mi) = if t.is_empty() {
        (0, 0)
    } else {
        let tp: Vec<&str> = t.split(':').collect();
        if !(2..=3).contains(&tp.len())
            || !tp
                .iter()
                .all(|p| !p.is_empty() && p.len() <= 2 && p.bytes().all(|b| b.is_ascii_digit()))
        {
            return None;
        }
        let (h, mi): (u32, u32) = (tp[0].parse().ok()?, tp[1].parse().ok()?);
        if h > 23 || mi > 59 {
            return None;
        }
        (h, mi)
    };
    Some(format!("{y:04}-{m:02}-{day:02}T{h:02}:{mi:02}"))
}

/// A moment as written by the page (`AAAA-LL-ZZTHH:MM` or with a space, or a date alone).
fn moment_arg(t: &str) -> CoreResult<String> {
    let t = t.trim();
    let (d, h) = t.split_once(['T', ' ']).unwrap_or((t, ""));
    moment(d, h).ok_or_else(|| bad("momentul", format!("„{t}” nu e o dată (și oră) validă")))
}

// ---------- the CSV ----------

/// One row of a quotes CSV: the date (with the time in the same cell or the next one), the price, and the
/// rest as the source.
fn csv_row(cells: &[String]) -> Result<(String, i64, String), String> {
    let first = cells.first().map(|c| c.trim()).unwrap_or_default();
    let (date, mut time) = first
        .split_once(['T', ' '])
        .map(|(a, b)| (a, b.to_string()))
        .unwrap_or((first, String::new()));
    let mut k = 1;
    if time.is_empty() {
        match cells.get(1).map(|c| c.trim()) {
            // A time column: a time, or empty (no time that day) when more cells follow.
            Some(c) if c.contains(':') && moment("2000-01-01", c).is_some() => {
                time = c.to_string();
                k = 2;
            }
            Some("") if cells.len() > 2 => k = 2,
            _ => {}
        }
    }
    let m = moment(date, &time).ok_or_else(|| format!("„{first}” nu e o dată"))?;
    let raw = cells.get(k).map(|c| c.trim()).unwrap_or_default();
    let p = price(raw).ok_or_else(|| format!("„{raw}” nu e un preț (cel mult 4 zecimale)"))?;
    let src = cells
        .get(k + 1..)
        .map(|r| {
            r.iter()
                .map(|c| c.trim())
                .filter(|c| !c.is_empty())
                .collect::<Vec<_>>()
                .join(" ")
        })
        .unwrap_or_default();
    Ok((m, p, src.chars().take(200).collect()))
}

/// Splits a CSV line on `sep`, with "quoted" cells.
fn split(line: &str, sep: char) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut q = false;
    let mut chars = line.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '"' if q && chars.peek() == Some(&'"') => {
                cur.push('"');
                chars.next();
            }
            '"' => q = !q,
            c if c == sep && !q => out.push(std::mem::take(&mut cur)),
            c => cur.push(c),
        }
    }
    out.push(cur);
    out
}

/// The separator: the one that splits most lines into the same number (≥ 2) of cells.
fn separator(lines: &[&str]) -> char {
    let mut best = (';', 0usize);
    for sep in [';', '\t', ','] {
        let n = lines.iter().take(20).filter(|l| split(l, sep).len() >= 2).count();
        if n > best.1 {
            best = (sep, n);
        }
    }
    best.0
}

fn text_of(data: &[u8]) -> String {
    let data = data.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(data);
    match std::str::from_utf8(data) {
        Ok(t) => t.to_string(),
        // Older Windows exports: Windows-1250 / Latin-1; digits, dates and separators read the same.
        Err(_) => data.iter().map(|&b| b as char).collect(),
    }
}

// ---------- the module ----------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct InstrumentSave {
    id: Option<Uuid>,
    version: Option<u64>,
    simbol: String,
    nume: String,
    fel: String,
    moneda: String,
    #[serde(default)]
    nota: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ByIdVersion {
    id: Uuid,
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct QuoteAdd {
    instrument: Uuid,
    moment: String,
    pret: String,
    #[serde(default)]
    sursa: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Quotes {
    instrument: Uuid,
    #[serde(default)]
    de_la: Option<String>,
    #[serde(default)]
    pana_la: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ImportCsv {
    instrument: Uuid,
    name: String,
    data: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct AlertSave {
    id: Option<Uuid>,
    version: Option<u64>,
    instrument: Uuid,
    directie: String,
    nivel: String,
    #[serde(default = "yes")]
    activa: bool,
}

fn yes() -> bool {
    true
}

impl Market {
    fn instrument(&self, ctx: &mut ModuleContext<'_>, id: Uuid) -> CoreResult<RecordState> {
        ctx.get(INSTRUMENTS, id)?
            .filter(|r| !r.deleted)
            .ok_or_else(|| bad("instrumentul", "nu mai există"))
    }

    /// The quotes of an instrument, oldest first.
    fn quotes_of(&self, ctx: &mut ModuleContext<'_>, id: Uuid) -> CoreResult<Vec<RecordState>> {
        let key = json!(id.to_string());
        let mut q = ctx.scan(QUOTES, |r| !r.deleted && r.fields.get("instrument") == Some(&key))?;
        q.sort_by_key(|a| s(a, "moment"));
        Ok(q)
    }

    fn quote_view(r: &RecordState) -> Value {
        json!({"id": r.id, "version": r.version, "moment": s(r, "moment"), "pret": i(r, "pret"),
               "pret_text": price_text(i(r, "pret")), "sursa": s(r, "sursa")})
    }

    fn list(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let mut ins = ctx.scan(INSTRUMENTS, |r| !r.deleted)?;
        ins.sort_by_key(|r| s(r, "simbol").to_lowercase());
        let alerts = ctx.scan(ALERTS, |r| !r.deleted)?;
        let mut out = Vec::new();
        for r in &ins {
            let q = self.quotes_of(ctx, r.id)?;
            let last = q.last();
            let prev = q.len().checked_sub(2).and_then(|k| q.get(k));
            // The change since the quote before, in hundredths of a percent.
            let change = match (last, prev) {
                (Some(l), Some(p)) if i(p, "pret") != 0 => {
                    Some(((i(l, "pret") - i(p, "pret")) as i128 * 10_000 / (i(p, "pret") as i128).abs()) as i64)
                }
                _ => None,
            };
            let mine: Vec<Value> = alerts
                .iter()
                .filter(|a| s(a, "instrument") == r.id.to_string())
                .map(|a| json!({"id": a.id, "version": a.version, "directie": s(a, "directie"), "nivel": i(a, "nivel"),
                                "nivel_text": price_text(i(a, "nivel")), "activa": a.fields.get("activa") == Some(&json!(true))}))
                .collect();
            out.push(json!({
                "id": r.id, "version": r.version, "simbol": s(r, "simbol"), "nume": s(r, "nume"), "fel": s(r, "fel"),
                "moneda": s(r, "moneda"), "nota": s(r, "nota"), "cotatii": q.len(),
                "ultima": last.map(Self::quote_view), "variatie": change, "alerte": mine,
            }));
        }
        Ok(json!(out))
    }

    fn instrument_save(&self, ctx: &mut ModuleContext<'_>, a: InstrumentSave) -> CoreResult<Value> {
        let simbol = a.simbol.trim().to_uppercase();
        if simbol.is_empty() || simbol.chars().count() > 20 || simbol.chars().any(char::is_whitespace) {
            return Err(bad(
                "simbolul",
                "are 1–20 caractere, fără spații (de exemplu TLV, EURRON, BRENT)",
            ));
        }
        let nume = a.nume.trim().to_string();
        if nume.is_empty() || nume.chars().count() > 200 {
            return Err(bad("numele", "are 1–200 de caractere"));
        }
        if !KINDS.contains(&a.fel.as_str()) {
            return Err(bad(
                "felul",
                format!("„{}” nu e unul dintre {}", a.fel, KINDS.join(", ")),
            ));
        }
        let moneda = a.moneda.trim().to_uppercase();
        if moneda.len() != 3 || !moneda.bytes().all(|b| b.is_ascii_uppercase()) {
            return Err(bad("moneda", "se scrie cu codul de 3 litere (RON, EUR, USD…)"));
        }
        if a.nota.chars().count() > 1000 {
            return Err(bad("nota", "are cel mult 1000 de caractere"));
        }
        let same = json!(simbol);
        if ctx
            .scan(INSTRUMENTS, |r| !r.deleted && r.fields.get("simbol") == Some(&same))?
            .iter()
            .any(|r| Some(r.id) != a.id)
        {
            return Err(bad("simbolul", format!("„{simbol}” e deja în listă")));
        }
        let (id, expect, created) = match a.id {
            Some(id) => {
                let r = self.instrument(ctx, id)?;
                (id, a.version.unwrap_or(r.version), i(&r, "creat_ms"))
            }
            None => (Uuid::now_v7(), 0, now_ms() as i64),
        };
        let mut f = Fields::new();
        f.insert("simbol".into(), json!(simbol));
        f.insert("nume".into(), json!(nume));
        f.insert("fel".into(), json!(a.fel));
        f.insert("moneda".into(), json!(moneda));
        f.insert("nota".into(), json!(a.nota.trim()));
        f.insert("creat_ms".into(), json!(created));
        ctx.write(vec![Write::put(INSTRUMENTS, id, f).expect(expect)])?;
        Ok(json!({"id": id}))
    }

    fn quote_write(id: Uuid, moment: &str, pret: i64, sursa: &str) -> Write {
        let mut f = Fields::new();
        f.insert("instrument".into(), json!(id.to_string()));
        f.insert("moment".into(), json!(moment));
        f.insert("pret".into(), json!(pret));
        f.insert("sursa".into(), json!(sursa));
        f.insert("creat_ms".into(), json!(now_ms()));
        Write::put(QUOTES, Uuid::now_v7(), f).expect(0)
    }

    fn quote_add(&self, ctx: &mut ModuleContext<'_>, a: QuoteAdd) -> CoreResult<Value> {
        self.instrument(ctx, a.instrument)?;
        let m = moment_arg(&a.moment)?;
        let p =
            price(&a.pret).ok_or_else(|| bad("prețul", format!("„{}” nu e un preț (cel mult 4 zecimale)", a.pret)))?;
        let sursa = if a.sursa.trim().is_empty() {
            "scris de mână".to_string()
        } else {
            a.sursa.trim().chars().take(200).collect()
        };
        if let Some(old) = self.quotes_of(ctx, a.instrument)?.iter().find(|q| s(q, "moment") == m) {
            return Err(bad(
                "cotația",
                format!(
                    "există deja una la {} ({})",
                    m.replace('T', " "),
                    price_text(i(old, "pret"))
                ),
            ));
        }
        ctx.write(vec![Self::quote_write(a.instrument, &m, p, &sursa)])?;
        Ok(json!({"moment": m, "pret_text": price_text(p)}))
    }

    fn import_csv(&self, ctx: &mut ModuleContext<'_>, a: ImportCsv) -> CoreResult<Value> {
        self.instrument(ctx, a.instrument)?;
        let data = base64::engine::general_purpose::STANDARD
            .decode(a.data.as_bytes())
            .map_err(|_| bad("fișierul", "nu a ajuns întreg"))?;
        if data.len() > MAX_CSV {
            return Err(bad("fișierul", format!("are mai mult de {} MB", MAX_CSV / 1024 / 1024)));
        }
        let name: String = a.name.trim().chars().take(120).collect();
        let text = text_of(&data);
        let lines: Vec<&str> = text.lines().filter(|l| !l.trim().is_empty()).collect();
        if lines.len() > MAX_ROWS {
            return Err(bad("fișierul", format!("are mai mult de {MAX_ROWS} de rânduri")));
        }
        let sep = separator(&lines);
        let existing: BTreeMap<String, i64> = self
            .quotes_of(ctx, a.instrument)?
            .iter()
            .map(|q| (s(q, "moment"), i(q, "pret")))
            .collect();
        let mut seen = BTreeMap::new();
        let (mut writes, mut existente, mut refuzate) = (Vec::new(), Vec::new(), Vec::new());
        for (n, line) in lines.iter().enumerate() {
            let cells = split(line, sep);
            match csv_row(&cells) {
                Ok((m, p, src)) => {
                    if let Some(old) = existing.get(&m).or_else(|| seen.get(&m)) {
                        existente.push(if *old == p {
                            json!({"rand": n + 1, "moment": m, "motiv": "există deja"})
                        } else {
                            json!({"rand": n + 1, "moment": m, "motiv": format!("există deja, cu alt preț ({} în listă, {} în fișier)", price_text(*old), price_text(p))})
                        });
                        continue;
                    }
                    seen.insert(m.clone(), p);
                    let sursa = if src.is_empty() {
                        format!("CSV: {name}")
                    } else {
                        format!("{src} (CSV: {name})")
                    };
                    writes.push(Self::quote_write(
                        a.instrument,
                        &m,
                        p,
                        &sursa.chars().take(200).collect::<String>(),
                    ));
                }
                // The header row (no date in its first cell) is not an error.
                Err(_) if n == 0 => {}
                Err(e) => refuzate.push(json!({"rand": n + 1, "motiv": e})),
            }
        }
        let added = writes.len();
        if !writes.is_empty() {
            ctx.write(writes)?;
        }
        ctx.log(&format!("cotații din CSV: {added} adăugate"));
        Ok(json!({"adaugate": added, "existente": existente, "refuzate": refuzate,
                  "separator": match sep { ';' => "„;”", ',' => "„,”", _ => "Tab" }}))
    }

    fn alert_save(&self, ctx: &mut ModuleContext<'_>, a: AlertSave) -> CoreResult<Value> {
        self.instrument(ctx, a.instrument)?;
        if a.directie != "peste" && a.directie != "sub" {
            return Err(bad("alerta", "e „peste” sau „sub” un prag"));
        }
        let nivel = price(&a.nivel)
            .ok_or_else(|| bad("pragul", format!("„{}” nu e un preț (cel mult 4 zecimale)", a.nivel)))?;
        let (id, expect) = match a.id {
            Some(id) => {
                let r = ctx
                    .get(ALERTS, id)?
                    .filter(|r| !r.deleted)
                    .ok_or_else(|| bad("alerta", "nu mai există"))?;
                (id, a.version.unwrap_or(r.version))
            }
            None => (Uuid::now_v7(), 0),
        };
        let mut f = Fields::new();
        f.insert("instrument".into(), json!(a.instrument.to_string()));
        f.insert("directie".into(), json!(a.directie));
        f.insert("nivel".into(), json!(nivel));
        f.insert("activa".into(), json!(a.activa));
        ctx.write(vec![Write::put(ALERTS, id, f).expect(expect)])?;
        Ok(json!({"id": id}))
    }

    /// Alerts: only the last quote of each instrument is compared with the level; once per quote.
    fn reminders(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<()> {
        let alerts = ctx.scan(ALERTS, |r| !r.deleted && r.fields.get("activa") == Some(&json!(true)))?;
        for a in alerts {
            let Ok(id) = s(&a, "instrument").parse::<Uuid>() else {
                continue;
            };
            let Ok(ins) = self.instrument(ctx, id) else { continue };
            let Some(last) = self.quotes_of(ctx, id)?.pop() else {
                continue;
            };
            let (p, level, up) = (i(&last, "pret"), i(&a, "nivel"), s(&a, "directie") == "peste");
            if !(if up { p >= level } else { p <= level }) {
                continue;
            }
            let key = format!("alerta:{}@{}", a.id, s(&last, "moment"));
            if ctx.notify_key_used(&key)? {
                continue;
            }
            let titlu = format!(
                "{}: {} {} {}",
                s(&ins, "simbol"),
                price_text(p),
                if up { "peste" } else { "sub" },
                price_text(level)
            );
            let text = format!(
                "Cotația din {} ({}). Evidență, nu sfat de investiții.",
                s(&last, "moment").replace('T', " "),
                s(&last, "sursa")
            );
            ctx.notify(&Notice::new(titlu, text).level(Level::Atentie).key(key))?;
        }
        Ok(())
    }
}

impl Module for Market {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn remind(&self, ctx: &mut ModuleContext<'_>, _today: &str) -> CoreResult<()> {
        self.reminders(ctx)
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "list" => self.list(ctx),
            "instrument_save" => self.instrument_save(ctx, args(command, a)?),
            "instrument_delete" => {
                let a: ByIdVersion = args(command, a)?;
                self.instrument(ctx, a.id)?;
                let key = json!(a.id.to_string());
                let mut writes = vec![Write::delete(INSTRUMENTS, a.id).expect(a.version)];
                for c in [QUOTES, ALERTS] {
                    for r in ctx.scan(c, |r| !r.deleted && r.fields.get("instrument") == Some(&key))? {
                        writes.push(Write::delete(c, r.id).expect(r.version));
                    }
                }
                ctx.write(writes)?;
                Ok(json!({"deleted": a.id}))
            }
            "quote_add" => self.quote_add(ctx, args(command, a)?),
            "quote_delete" => {
                let a: ByIdVersion = args(command, a)?;
                ctx.write(vec![Write::delete(QUOTES, a.id).expect(a.version)])?;
                Ok(json!({"deleted": a.id}))
            }
            "quotes" => {
                let a: Quotes = args(command, a)?;
                self.instrument(ctx, a.instrument)?;
                let from = a.de_la.as_deref().map(moment_arg).transpose()?;
                let to = a.pana_la.as_deref().map(moment_arg).transpose()?;
                let q: Vec<Value> = self
                    .quotes_of(ctx, a.instrument)?
                    .iter()
                    .filter(|r| {
                        let m = s(r, "moment");
                        from.as_ref().is_none_or(|f| &m >= f) && to.as_ref().is_none_or(|t| m[..10] <= t[..10])
                    })
                    .map(Self::quote_view)
                    .collect();
                Ok(json!(q))
            }
            "import_csv" => self.import_csv(ctx, args(command, a)?),
            "alert_save" => self.alert_save(ctx, args(command, a)?),
            "alert_delete" => {
                let a: ByIdVersion = args(command, a)?;
                ctx.write(vec![Write::delete(ALERTS, a.id).expect(a.version)])?;
                Ok(json!({"deleted": a.id}))
            }
            other => Err(CoreError::invalid("comanda", format!("„{other}” nu există în {ID}"))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prices_as_written_in_romania_and_in_english() {
        assert_eq!(price("32,50"), Some(325_000));
        assert_eq!(price("1.234,5678"), Some(12_345_678));
        assert_eq!(price("1,234.5678"), Some(12_345_678));
        assert_eq!(price("1234.5"), Some(12_345_000));
        assert_eq!(
            price("1.250"),
            Some(12_500_000),
            "thousands, as Romanian lists write it"
        );
        assert_eq!(price("1 250,75"), Some(12_507_500));
        assert_eq!(price("-37,63"), Some(-376_300), "negative prices exist (oil, 2020)");
        assert_eq!(price("0,0001"), Some(1));
        for bad in ["", "abc", "1,23456", "1.2.3,4,5", "--1", "12a"] {
            assert_eq!(price(bad), None, "{bad}");
        }
        assert_eq!(price_text(325_000), "32,50");
        assert_eq!(price_text(12_345_678), "1.234,5678");
        assert_eq!(price_text(-376_300), "-37,63");
        assert_eq!(price_text(1), "0,0001");
    }

    #[test]
    fn moments_in_romanian_and_iso_forms() {
        assert_eq!(moment("10.11.2026", "14:30").as_deref(), Some("2026-11-10T14:30"));
        assert_eq!(moment("2026-11-10", "").as_deref(), Some("2026-11-10T00:00"));
        assert_eq!(moment("29/02/2028", "09:05:59").as_deref(), Some("2028-02-29T09:05"));
        for (d, t) in [
            ("29.02.2026", ""),
            ("2026-13-01", ""),
            ("10.11.26", ""),
            ("2026-11-10", "25:00"),
            ("ieri", ""),
        ] {
            assert_eq!(moment(d, t), None, "{d} {t}");
        }
    }
}
