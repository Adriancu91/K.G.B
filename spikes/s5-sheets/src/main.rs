//! Spike S5 (Etapa 3, pasul 3.3): biblioteci pentru foi de calcul evaluate pe
//! `testdata/etapa3` (setul propriu) și pe corpusul extern (fișiere reale).
//!
//! ```text
//! s5 read  <testdata>            citire: fiecare bibliotecă, fiecare fișier, proces separat
//! s5 rt    <dir> <out-dir>       deschidere → salvare (umya, IronCalc): ce se pierde
//! s5 calc  <dir>                 IronCalc recalculează; comparăm cu valorile salvate de Excel
//! s5 write <out.xlsx> <rânduri>  scriere mare cu rust_xlsxwriter
//! ```

use std::collections::{BTreeMap, BTreeSet};
use std::io::Read as _;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use calamine::{Data, Reader, open_workbook_auto};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

const READ_LIBS: [&str; 3] = ["calamine", "umya", "ironcalc"];
const TIMEOUT: Duration = Duration::from_secs(120);

fn main() {
    let a: Vec<String> = std::env::args().collect();
    std::panic::set_hook(Box::new(|i| eprintln!("panică: {i}")));
    match a.get(1).map(String::as_str) {
        Some("one") => one(&a[2], Path::new(&a[3]), a.get(4).map(String::as_str).unwrap_or("[]")),
        Some("rt1") => rt1(&a[2], Path::new(&a[3]), Path::new(&a[4])),
        Some("read") => read_all(Path::new(&a[2])),
        Some("rt") => rt_all(Path::new(&a[2]), Path::new(&a[3])),
        Some("calc") => calc_all(Path::new(&a[2])),
        Some("guard") => guard_all(Path::new(&a[2])),
        Some("write") => write_big(Path::new(&a[2]), a[3].parse().unwrap()),
        _ => eprintln!("folosire: s5 read|rt|calc|write ..."),
    }
}

// ------------------------------------------------------------------ util

fn ms(t: Instant) -> f64 {
    (t.elapsed().as_secs_f64() * 10_000.0).round() / 10.0
}

fn sha(b: &[u8]) -> String {
    Sha256::digest(b).iter().map(|x| format!("{x:02x}")).collect()
}

#[cfg(windows)]
fn peak_mb() -> f64 {
    use windows_sys::Win32::System::ProcessStatus::{K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
    use windows_sys::Win32::System::Threading::GetCurrentProcess;
    let mut c: PROCESS_MEMORY_COUNTERS = unsafe { std::mem::zeroed() };
    c.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
    unsafe { K32GetProcessMemoryInfo(GetCurrentProcess(), &mut c, c.cb) };
    (c.PeakWorkingSetSize as f64 / 1_048_576.0).round()
}
#[cfg(not(windows))]
fn peak_mb() -> f64 {
    0.0
}

/// „Foaie!A1” sau „'Foaie cu spații'!A1” → (foaie, rând, coloană), 1-based.
fn parse_ref(r: &str) -> (String, u32, u32) {
    let (s, c) = r.rsplit_once('!').unwrap();
    let s = s.trim_matches('\'').to_string();
    let col_letters: String = c.chars().take_while(|ch| ch.is_ascii_alphabetic()).collect();
    let row: u32 = c[col_letters.len()..].parse().unwrap();
    let col = col_letters
        .bytes()
        .fold(0u32, |acc, b| acc * 26 + (b - b'A' + 1) as u32);
    (s, row, col)
}

/// Valoarea unei celule ca text comparabil între biblioteci.
fn num(f: f64) -> String {
    if f == f.trunc() && f.abs() < 1e15 {
        format!("{}", f as i64)
    } else {
        format!("{:.9}", f).trim_end_matches('0').to_string()
    }
}

fn cal_value(d: &Data) -> Option<String> {
    Some(match d {
        Data::Empty => return None,
        Data::Int(i) => i.to_string(),
        Data::Float(f) => num(*f),
        Data::String(s) => s.clone(),
        Data::Bool(b) => b.to_string(),
        Data::DateTime(dt) => num(dt.as_f64()),
        Data::DateTimeIso(s) | Data::DurationIso(s) => s.clone(),
        Data::Error(e) => format!("{e}"),
    })
}

/// Toate celulele nevide (valori salvate în fișier) și formulele, citite cu calamine.
type Snapshot = (
    BTreeMap<(String, u32, u32), String>,
    BTreeMap<(String, u32, u32), String>,
);

fn snapshot(path: &Path) -> Result<Snapshot, String> {
    let mut wb = open_workbook_auto(path).map_err(|e| e.to_string())?;
    let (mut vals, mut fs) = (BTreeMap::new(), BTreeMap::new());
    for name in wb.sheet_names() {
        let r = wb.worksheet_range(&name).map_err(|e| e.to_string())?;
        let (r0, c0) = r.start().unwrap_or((0, 0));
        for (i, j, d) in r.cells() {
            if let Some(v) = cal_value(d) {
                vals.insert((name.clone(), r0 + i as u32 + 1, c0 + j as u32 + 1), v);
            }
        }
        if let Ok(f) = wb.worksheet_formula(&name) {
            let (r0, c0) = f.start().unwrap_or((0, 0));
            for (i, j, s) in f.cells() {
                if !s.is_empty() {
                    fs.insert(
                        (name.clone(), r0 + i as u32 + 1, c0 + j as u32 + 1),
                        s.trim_start_matches('=').to_string(),
                    );
                }
            }
        }
    }
    Ok((vals, fs))
}

fn run_child(args: &[&str]) -> Value {
    let exe = std::env::current_exe().unwrap();
    let mut child = Command::new(exe)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let mut so = child.stdout.take().unwrap();
    let mut se = child.stderr.take().unwrap();
    let out = std::thread::spawn(move || {
        let mut s = String::new();
        so.read_to_string(&mut s).ok();
        s
    });
    let err = std::thread::spawn(move || {
        let mut s = String::new();
        se.read_to_string(&mut s).ok();
        s
    });
    let t0 = Instant::now();
    loop {
        if let Some(st) = child.try_wait().unwrap() {
            let o = out.join().unwrap();
            let e = err.join().unwrap();
            return serde_json::from_str::<Value>(o.trim()).unwrap_or_else(|_| {
                json!({"ok": false, "crashed": true,
                       "error": format!("prăbușit ({st}): {}", e.lines().next().unwrap_or("").chars().take(90).collect::<String>())})
            });
        }
        if t0.elapsed() > TIMEOUT {
            let _ = child.kill();
            return json!({"ok": false, "timeout": true, "error": "peste 120 s"});
        }
        std::thread::sleep(Duration::from_millis(5));
    }
}

fn files_in(dir: &Path, exts: &[&str]) -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = walk(dir)
        .into_iter()
        .filter(|p| {
            p.extension()
                .and_then(|e| e.to_str())
                .is_some_and(|e| exts.contains(&e.to_ascii_lowercase().as_str()))
        })
        .collect();
    v.sort();
    v
}

fn walk(d: &Path) -> Vec<PathBuf> {
    let mut v = Vec::new();
    for e in std::fs::read_dir(d).into_iter().flatten().flatten() {
        let p = e.path();
        if p.is_dir() { v.extend(walk(&p)) } else { v.push(p) }
    }
    v
}

// ------------------------------------------------------------- citire

fn one(lib: &str, path: &Path, want: &str) {
    let want: Vec<String> = serde_json::from_str(want).unwrap();
    let t0 = Instant::now();
    let mut out = json!({"ok": false});
    let r: Result<(), String> = (|| {
        let mut got = serde_json::Map::new();
        let (sheets, cells) = match lib {
            "calamine" => {
                let (vals, fs) = snapshot(path)?;
                for w in &want {
                    let k = parse_ref(w);
                    got.insert(w.clone(), json!(vals.get(&k)));
                }
                out["formulas"] = json!(fs.len());
                let names: BTreeSet<&String> = vals.keys().map(|k| &k.0).collect();
                (names.len(), vals.len())
            }
            "umya" => {
                let wb = umya_spreadsheet::reader::xlsx::read(path).map_err(|e| e.to_string())?;
                let mut n = 0;
                for s in wb.sheet_collection() {
                    n += s
                        .collection_to_hashmap()
                        .values()
                        .filter(|c| !c.value().is_empty())
                        .count();
                }
                for w in &want {
                    let (s, r, c) = parse_ref(w);
                    let v = wb
                        .sheet_by_name(&s)
                        .ok()
                        .and_then(|ws| ws.cell((c, r)).map(|x| x.value().to_string()));
                    got.insert(w.clone(), json!(v));
                }
                (wb.sheet_count(), n)
            }
            "ironcalc" => {
                let p = path.to_str().unwrap();
                let m = ironcalc::import::load_from_xlsx(p, "en", "UTC", "en").map_err(|e| format!("{e:?}"))?;
                let props = m.get_worksheets_properties();
                for w in &want {
                    let (s, r, c) = parse_ref(w);
                    let v = props.iter().position(|p| p.name == s).and_then(|i| {
                        match m.get_cell_value_by_index(i as u32, r as i32, c as i32).ok()? {
                            ironcalc::base::cell::CellValue::None => None,
                            ironcalc::base::cell::CellValue::Number(f) => Some(num(f)),
                            ironcalc::base::cell::CellValue::String(s) => Some(s),
                            ironcalc::base::cell::CellValue::Boolean(b) => Some(b.to_string()),
                        }
                    });
                    got.insert(w.clone(), json!(v));
                }
                (props.len(), m.get_all_cells().len())
            }
            _ => return Err("bibliotecă necunoscută".into()),
        };
        out["sheets"] = json!(sheets);
        out["cells"] = json!(cells);
        out["got"] = Value::Object(got);
        Ok(())
    })();
    out["ok"] = json!(r.is_ok());
    if let Err(e) = r {
        out["error"] = json!(e.chars().take(120).collect::<String>());
    }
    out["ms"] = json!(ms(t0));
    out["peak_mb"] = json!(peak_mb());
    println!("{out}");
}

fn expected_value(v: &Value) -> String {
    match v {
        Value::Number(n) => num(n.as_f64().unwrap()),
        Value::Bool(b) => b.to_string(),
        Value::String(s) => s.clone(),
        _ => v.to_string(),
    }
}

fn read_all(td: &Path) {
    // Setul propriu: cu așteptări din manifest.
    let m: Value = serde_json::from_slice(&std::fs::read(td.join("MANIFEST.json")).unwrap()).unwrap();
    let mut rows = Vec::new();
    for f in m["files"].as_array().unwrap().iter().filter(|f| f["kind"] == "xlsx") {
        let path = td.join(f["path"].as_str().unwrap());
        if !path.exists() {
            continue;
        }
        let want: Vec<String> = f["cells"]
            .as_object()
            .map(|o| o.keys().cloned().collect())
            .unwrap_or_default();
        let broken = f["broken"].as_bool().unwrap_or(false);
        for lib in READ_LIBS {
            let r = run_child(&[
                "one",
                lib,
                path.to_str().unwrap(),
                &serde_json::to_string(&want).unwrap(),
            ]);
            let ok = r["ok"].as_bool() == Some(true);
            let mut bad = Vec::new();
            for w in &want {
                let exp = expected_value(&f["cells"][w]);
                let got = r["got"][w].as_str().map(str::to_string);
                // umya întoarce booleenii ca TRUE/FALSE
                let same = got.as_deref().is_some_and(|g| {
                    g == exp
                        || g.eq_ignore_ascii_case(&exp)
                        || (g
                            .parse::<f64>()
                            .ok()
                            .zip(exp.parse::<f64>().ok())
                            .is_some_and(|(a, b)| (a - b).abs() < 1e-6 * b.abs().max(1.0)))
                });
                if !same {
                    bad.push(format!("{w}: {got:?}≠{exp}"));
                }
            }
            let verdict = if broken { !ok } else { ok && bad.is_empty() };
            println!(
                "{:<44} {:<9} {:<7} foi={:<3} celule={:<7} {:>8} ms {:>5} MB {}",
                f["path"].as_str().unwrap(),
                lib,
                if verdict { "corect" } else { "GREȘIT" },
                r["sheets"].to_string(),
                r["cells"].to_string(),
                r["ms"].to_string(),
                r["peak_mb"].to_string(),
                if ok {
                    bad.join("; ")
                } else {
                    r["error"].as_str().unwrap_or("").chars().take(70).collect()
                }
            );
            rows.push(json!({"file": f["path"], "lib": lib, "verdict": verdict, "r": r, "bad": bad}));
        }
    }
    // Corpusul extern: fără așteptări; numărăm ce se deschide.
    let ext = td.join("extern");
    if ext.exists() {
        let mut stats: BTreeMap<(String, &str), (u32, u32, u32)> = BTreeMap::new();
        for p in files_in(&ext, &["xlsx", "xlsm", "xlsb", "xls", "ods"]) {
            let kind = p.extension().unwrap().to_string_lossy().to_lowercase();
            let mut line = format!(
                "{:<60}",
                p.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .chars()
                    .take(60)
                    .collect::<String>()
            );
            for lib in READ_LIBS {
                if lib != "calamine" && kind != "xlsx" && kind != "xlsm" {
                    continue;
                }
                let r = run_child(&["one", lib, p.to_str().unwrap(), "[]"]);
                let e = stats.entry((kind.clone(), lib)).or_default();
                e.0 += 1;
                if r["ok"].as_bool() == Some(true) {
                    e.1 += 1;
                    line += &format!(" {lib}={}c/{}ms", r["cells"], r["ms"]);
                } else {
                    if r["crashed"].as_bool() == Some(true) || r["timeout"].as_bool() == Some(true) {
                        e.2 += 1;
                    }
                    line += &format!(
                        " {lib}=EȘEC({})",
                        r["error"].as_str().unwrap_or("").chars().take(50).collect::<String>()
                    );
                }
                rows.push(json!({"file": p.file_name().unwrap().to_string_lossy(), "lib": lib, "r": r}));
            }
            println!("{line}");
        }
        println!("\nCorpus extern — deschise / total (prăbușiri sau blocaje):");
        for ((k, lib), (n, ok, cr)) in stats {
            println!("  {k:<5} {lib:<9} {ok}/{n}  ({cr})");
        }
    }
    std::fs::write("read.json", serde_json::to_vec_pretty(&rows).unwrap()).unwrap();
}

// --------------------------------------------- deschidere → salvare

/// Ce conține pachetul XLSX: părți și elemente care se pierd ușor la salvare.
fn features(path: &Path) -> BTreeMap<String, usize> {
    let mut m = BTreeMap::new();
    let Ok(f) = std::fs::File::open(path) else { return m };
    let Ok(mut z) = zip::ZipArchive::new(f) else { return m };
    let names: Vec<String> = z.file_names().filter_map(|n| n.ok().map(|s| s.to_string())).collect();
    for (key, prefix) in [
        ("grafice", "xl/charts/chart"),
        ("desene", "xl/drawings/drawing"),
        ("imagini", "xl/media/"),
        ("comentarii", "xl/comments"),
        ("tabele", "xl/tables/"),
        ("pivot", "xl/pivotTables/"),
        ("macro", "xl/vbaProject.bin"),
        ("date-externe", "xl/externalLinks/"),
    ] {
        let n = names.iter().filter(|x| x.starts_with(prefix)).count();
        if n > 0 {
            m.insert(key.to_string(), n);
        }
    }
    for name in names
        .iter()
        .filter(|n| n.starts_with("xl/worksheets/sheet") || *n == "xl/workbook.xml" || *n == "xl/styles.xml")
    {
        let mut s = String::new();
        if z.by_name(name)
            .ok()
            .and_then(|mut e| e.read_to_string(&mut s).ok())
            .is_none()
        {
            continue;
        }
        for (key, tag) in [
            ("formatare-condiționată", "<conditionalFormatting"),
            ("validare", "<dataValidation "),
            ("legături", "<hyperlink "),
            ("celule-unite", "<mergeCell "),
            ("nume-definite", "<definedName "),
            ("panou-înghețat", "state=\"frozen\""),
            ("filtru", "<autoFilter"),
            ("protecție", "<sheetProtection"),
            ("formate-număr", "<numFmt "),
            ("lățimi-coloane", "<col "),
        ] {
            let n = s.matches(tag).count();
            if n > 0 {
                *m.entry(key.to_string()).or_default() += n;
            }
        }
    }
    m
}

fn rt1(lib: &str, input: &Path, out: &Path) {
    let t0 = Instant::now();
    let r: Result<(), String> = (|| {
        match lib {
            "umya" => {
                let wb = umya_spreadsheet::reader::xlsx::read(input).map_err(|e| e.to_string())?;
                umya_spreadsheet::writer::xlsx::write(&wb, out).map_err(|e| e.to_string())?;
            }
            "ironcalc" => {
                let m = ironcalc::import::load_from_xlsx(input.to_str().unwrap(), "en", "UTC", "en")
                    .map_err(|e| format!("{e:?}"))?;
                let _ = std::fs::remove_file(out);
                ironcalc::export::save_to_xlsx(&m, out.to_str().unwrap()).map_err(|e| format!("{e:?}"))?;
            }
            _ => return Err("?".into()),
        }
        Ok(())
    })();
    println!(
        "{}",
        json!({"ok": r.is_ok(), "error": r.err(), "ms": ms(t0), "peak_mb": peak_mb()})
    );
}

fn rt_all(dir: &Path, out_dir: &Path) {
    std::fs::create_dir_all(out_dir).unwrap();
    let mut summary: BTreeMap<&str, (u32, u32, u32, u32, BTreeMap<String, u32>)> = BTreeMap::new();
    let mut rows = Vec::new();
    for p in files_in(dir, &["xlsx", "xlsm"]) {
        let original = std::fs::read(&p).unwrap();
        let Ok(before) = snapshot(&p) else { continue }; // fișierele stricate nu au ce păstra
        let fb = features(&p);
        let name = p.file_name().unwrap().to_string_lossy().to_string();
        for lib in ["umya", "ironcalc"] {
            let out = out_dir.join(format!("{lib}-{name}"));
            let r = run_child(&["rt1", lib, p.to_str().unwrap(), out.to_str().unwrap()]);
            let s = summary.entry(lib).or_default();
            s.0 += 1;
            let mut msg = String::new();
            if r["ok"].as_bool() != Some(true) {
                msg = format!(
                    "EȘEC: {}",
                    r["error"].as_str().unwrap_or("").chars().take(60).collect::<String>()
                );
            } else {
                s.1 += 1;
                match snapshot(&out) {
                    Err(e) => msg = format!("rezultatul nu se mai deschide: {e}"),
                    Ok(after) => {
                        let lost_vals = before.0.iter().filter(|(k, v)| after.0.get(*k) != Some(*v)).count();
                        let extra_vals = after.0.keys().filter(|k| !before.0.contains_key(*k)).count();
                        let lost_f = before
                            .1
                            .iter()
                            .filter(|(k, v)| {
                                after.1.get(*k).map(|a| a.replace(' ', "").to_uppercase())
                                    != Some(v.replace(' ', "").to_uppercase())
                            })
                            .count();
                        if lost_vals == 0 && lost_f == 0 && extra_vals == 0 {
                            s.2 += 1;
                        } else {
                            msg += &format!(
                                "valori schimbate {lost_vals}/{}, formule {lost_f}/{}, celule noi {extra_vals}; ",
                                before.0.len(),
                                before.1.len()
                            );
                            if let Some((k, v)) = before.0.iter().find(|(k, v)| after.0.get(*k) != Some(*v)) {
                                msg += &format!("ex. {}!R{}C{} {:?}→{:?}; ", k.0, k.1, k.2, v, after.0.get(k));
                            }
                        }
                        let fa = features(&out);
                        let lost: Vec<String> = fb
                            .iter()
                            .filter(|(k, n)| fa.get(*k).copied().unwrap_or(0) < **n)
                            .map(|(k, n)| format!("{k} {n}→{}", fa.get(k).copied().unwrap_or(0)))
                            .collect();
                        if lost.is_empty() {
                            s.3 += 1;
                        } else {
                            for l in &lost {
                                *s.4.entry(l.split(' ').next().unwrap().to_string()).or_default() += 1;
                            }
                            msg += &format!("pierdut: {}", lost.join(", "));
                        }
                    }
                }
            }
            if sha(&std::fs::read(&p).unwrap()) != sha(&original) {
                msg += " ORIGINAL MODIFICAT!";
            }
            println!(
                "{:<52} {:<9} {:>8} ms  {}",
                name.chars().take(52).collect::<String>(),
                lib,
                r["ms"].to_string(),
                if msg.is_empty() {
                    "identic (valori, formule, elemente)".into()
                } else {
                    msg.clone()
                }
            );
            rows.push(json!({"file": name, "lib": lib, "r": r, "msg": msg}));
        }
    }
    println!(
        "\nRezumat: fișiere / salvate / valori+formule identice / fără elemente pierdute; ce se pierde (în câte fișiere)"
    );
    for (lib, (n, ok, same, nolost, lost)) in summary {
        println!("  {lib:<9} {n} / {ok} / {same} / {nolost}   {lost:?}");
    }
    std::fs::write(out_dir.join("rt.json"), serde_json::to_vec_pretty(&rows).unwrap()).unwrap();
}

// ------------------------------------------------------------ formule

fn calc_all(dir: &Path) {
    let (mut total, mut same, mut diff, mut files) = (0usize, 0usize, 0usize, 0usize);
    let mut examples: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for p in files_in(dir, &["xlsx", "xlsm"]) {
        let name = p.file_name().unwrap().to_string_lossy().to_string();
        let r = std::panic::catch_unwind(|| ironcalc::import::load_from_xlsx(p.to_str().unwrap(), "en", "UTC", "en"));
        let Ok(Ok(mut m)) = r else { continue };
        files += 1;
        let cells = m.get_all_cells();
        let formula_cells: Vec<_> = cells
            .iter()
            .filter(|c| m.get_cell_formula(c.index, c.row, c.column).ok().flatten().is_some())
            .map(|c| {
                let v = m.get_cell_value_by_index(c.index, c.row, c.column).unwrap();
                (c.index, c.row, c.column, v)
            })
            .collect();
        if formula_cells.is_empty() {
            continue;
        }
        let t0 = Instant::now();
        if std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| m.evaluate())).is_err() {
            println!("{name}: panică la calcul");
            continue;
        }
        let el = ms(t0);
        let (mut s, mut d) = (0, 0);
        for (sh, r, c, before) in &formula_cells {
            let after = m.get_cell_value_by_index(*sh, *r, *c).unwrap();
            use ironcalc::base::cell::CellValue as V;
            let eq = match (before, &after) {
                (V::Number(a), V::Number(b)) => (a - b).abs() <= 1e-9 * a.abs().max(1.0),
                (a, b) => a == b,
            };
            if eq {
                s += 1;
            } else {
                d += 1;
                let f = m.get_cell_formula(*sh, *r, *c).ok().flatten().unwrap_or_default();
                let fname: String = f
                    .trim_start_matches('=')
                    .chars()
                    .take_while(|ch| ch.is_ascii_alphanumeric() || *ch == '.')
                    .collect();
                let e = examples
                    .entry(if fname.is_empty() { "(expresie)".into() } else { fname })
                    .or_default();
                if e.len() < 2 {
                    e.push(format!("{name} R{r}C{c} {f} : salvat {before:?} → IronCalc {after:?}"));
                }
            }
        }
        total += formula_cells.len();
        same += s;
        diff += d;
        println!(
            "{:<55} formule={:<6} identice={:<6} diferite={:<5} calcul {} ms",
            name.chars().take(55).collect::<String>(),
            formula_cells.len(),
            s,
            d,
            el
        );
    }
    println!(
        "\n{files} fișiere deschise; {total} formule; {same} cu același rezultat ca în fișier ({:.1}%); {diff} diferite",
        100.0 * same as f64 / total.max(1) as f64
    );
    println!("Diferențe pe funcții (cel mult 2 exemple fiecare):");
    for (k, v) in examples {
        println!("  {k}:");
        for e in v {
            println!("    {}", e.chars().take(160).collect::<String>());
        }
    }
}

// ------------------------------------------------------------ scriere

fn write_big(out: &Path, n: u32) {
    let t0 = Instant::now();
    let mut wb = rust_xlsxwriter::Workbook::new();
    let ws = wb.add_worksheet();
    ws.write_row(0, 0, ["id", "client", "suma", "tva", "total"]).unwrap();
    for i in 1..=n {
        let suma = (i * 37 % 10_000) as f64 / 100.0;
        ws.write_number(i, 0, i).unwrap();
        ws.write_string(i, 1, format!("Client {}", i % 977)).unwrap();
        ws.write_number(i, 2, suma).unwrap();
        ws.write_formula(i, 3, format!("=ROUND(C{}*0.19,2)", i + 1).as_str())
            .unwrap();
        ws.write_formula(i, 4, format!("=C{0}+D{0}", i + 1).as_str()).unwrap();
    }
    wb.save(out).unwrap();
    println!(
        "rust_xlsxwriter: {n} rânduri în {} ms, {} KB, memorie maximă {} MB",
        ms(t0),
        std::fs::metadata(out).unwrap().len() / 1024,
        peak_mb()
    );
}

// ------------------------------------------------- protecție la deschidere

const MAX_UNPACKED: u64 = 256 * 1024 * 1024;
const MAX_RATIO: u64 = 200;

/// Verificare înainte de a da fișierul unei biblioteci: mărimea după
/// dezarhivare declarată în arhivă și raportul de comprimare. Bibliotecile
/// testate încarcă bomba zip de 200 MB fără nicio limită (umya: 625 MB RAM).
/// Limita declarată nu e de încredere singură: la citire, fluxul se taie oricum
/// la MAX_UNPACKED (aici verificăm doar ce declară arhiva).
fn guard(path: &Path) -> Result<(u64, u64), String> {
    let f = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let packed = f.metadata().map_err(|e| e.to_string())?.len();
    let mut z = zip::ZipArchive::new(f).map_err(|e| format!("nu e o arhivă validă: {e}"))?;
    let mut total = 0u64;
    for i in 0..z.len() {
        let e = z.by_index_raw(i).map_err(|e| e.to_string())?;
        total = total.saturating_add(e.size());
        if e.compressed_size() > 0 && e.size() / e.compressed_size().max(1) > MAX_RATIO && e.size() > 16 * 1024 * 1024 {
            return Err(format!(
                "{}: comprimat de {}× (posibilă „bombă zip”)",
                e.name().map(|n| n.to_string()).unwrap_or_default(),
                e.size() / e.compressed_size().max(1)
            ));
        }
    }
    if total > MAX_UNPACKED {
        return Err(format!(
            "{} MB după dezarhivare (limita {} MB)",
            total >> 20,
            MAX_UNPACKED >> 20
        ));
    }
    Ok((packed, total))
}

fn guard_all(dir: &Path) {
    let (mut ok, mut no) = (0, 0);
    for p in files_in(dir, &["xlsx", "xlsm"]) {
        match guard(&p) {
            Ok(_) => ok += 1,
            Err(e) => {
                no += 1;
                println!("{:<60} REFUZ: {e}", p.file_name().unwrap().to_string_lossy());
            }
        }
    }
    println!("{ok} acceptate, {no} refuzate");
}
