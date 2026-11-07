//! Spike S4 (Etapa 3, pasul 3.2): biblioteci PDF evaluate pe `testdata/etapa3`.
//!
//! ```text
//! s4 read <testdata> <out.json>   fiecare bibliotecă deschide fiecare PDF, într-un proces separat
//! s4 ops  <testdata> <out-dir>    operații cu lopdf + verificare de necorupere
//! s4 one  <lib> <file>            (intern) un singur fișier, o singură bibliotecă
//! ```
//! Bibliotecile rulează în procese separate: un fișier ostil care prăbușește
//! procesul (de exemplu prin depășirea stivei) apare ca „prăbușit”, nu oprește spike-ul.

use std::io::Write as _;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use lopdf::{Dictionary, Document, Object, ObjectId};
use serde::Serialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

static LENIENT: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
const LIBS: [&str; 4] = ["lopdf", "pdf-rs", "pdf-extract", "hayro"];
const CHILD_TIMEOUT: Duration = Duration::from_secs(60);

fn main() {
    let a: Vec<String> = std::env::args().collect();
    match a.get(1).map(String::as_str) {
        Some("one") => one(&a[2], Path::new(&a[3])),
        Some("read") => read_all(Path::new(&a[2]), Path::new(&a[3])),
        Some("ops") => ops(Path::new(&a[2]), Path::new(&a[3])),
        Some("probe") => probe(Path::new(&a[2])),
        Some("strict") => strict_all(Path::new(&a[2])),
        Some("scan") => scan(Path::new(&a[2])),
        Some("render") => render_png(Path::new(&a[2]), Path::new(&a[3])),
        Some("repair") => repair(Path::new(&a[2]), Path::new(&a[3])),
        _ => eprintln!("folosire: s4 read|ops <testdata> <ieșire>"),
    }
}

// ------------------------------------------------------------ util

fn sha(b: &[u8]) -> String {
    let h = Sha256::digest(b);
    h.iter().map(|x| format!("{x:02x}")).collect()
}

fn norm(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(windows)]
fn peak_mb() -> f64 {
    use windows_sys::Win32::System::ProcessStatus::{K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
    use windows_sys::Win32::System::Threading::GetCurrentProcess;
    let mut c: PROCESS_MEMORY_COUNTERS = unsafe { std::mem::zeroed() };
    c.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
    unsafe { K32GetProcessMemoryInfo(GetCurrentProcess(), &mut c, c.cb) };
    c.PeakWorkingSetSize as f64 / 1_048_576.0
}
#[cfg(not(windows))]
fn peak_mb() -> f64 {
    0.0
}

fn manifest(td: &Path) -> Vec<Value> {
    let m: Value = serde_json::from_slice(&std::fs::read(td.join("MANIFEST.json")).unwrap()).unwrap();
    m["files"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|f| f["kind"] == "pdf" && td.join(f["path"].as_str().unwrap()).exists())
        .cloned()
        .collect()
}

// ------------------------------------------------- citire, per bibliotecă

#[derive(Serialize, Default)]
struct OneResult {
    ok: bool,
    pages: Option<usize>,
    text: Option<String>,
    rendered: Option<usize>,
    open_ms: f64,
    total_ms: f64,
    peak_mb: f64,
    error: Option<String>,
}

fn one(lib: &str, file: &Path) {
    let bytes = std::fs::read(file).unwrap();
    let t0 = Instant::now();
    let mut r = OneResult::default();
    let res: Result<(), String> = (|| {
        match lib {
            "lopdf" => {
                let doc = Document::load_mem(&bytes).map_err(|e| e.to_string())?;
                r.open_ms = ms(t0);
                let pages: Vec<u32> = doc.get_pages().keys().copied().collect();
                r.pages = Some(pages.len());
                r.text = Some(doc.extract_text(&pages).map_err(|e| e.to_string())?);
            }
            "pdf-rs" => {
                let f = pdf::file::FileOptions::cached()
                    .load(bytes.clone())
                    .map_err(|e| e.to_string())?;
                r.open_ms = ms(t0);
                let mut n = 0;
                for p in f.pages() {
                    p.map_err(|e| e.to_string())?;
                    n += 1;
                }
                r.pages = Some(n);
            }
            "pdf-extract" => {
                let pages = pdf_extract::extract_text_from_mem_by_pages(&bytes).map_err(|e| e.to_string())?;
                r.open_ms = ms(t0);
                r.pages = Some(pages.len());
                r.text = Some(pages.join("\n"));
            }
            "hayro" => {
                let pdf = hayro::hayro_syntax::Pdf::new(bytes.clone()).map_err(|e| format!("{e:?}"))?;
                r.open_ms = ms(t0);
                r.pages = Some(pdf.pages().len());
                let cache = hayro::RenderCache::new();
                let mut n = 0;
                for p in pdf.pages().iter().take(50) {
                    let _ = render_page(p, &cache, 1.0);
                    n += 1;
                }
                r.rendered = Some(n);
            }
            _ => return Err("bibliotecă necunoscută".into()),
        }
        Ok(())
    })();
    r.total_ms = ms(t0);
    r.ok = res.is_ok();
    r.error = res.err();
    r.peak_mb = peak_mb();
    println!("{}", serde_json::to_string(&r).unwrap());
}

fn ms(t: Instant) -> f64 {
    (t.elapsed().as_secs_f64() * 10_000.0).round() / 10.0
}

fn render_page<'a>(p: &'a hayro::hayro_syntax::page::Page<'a>, cache: &hayro::RenderCache<'a>, scale: f32) -> String {
    let px = hayro::render(
        p,
        cache,
        &hayro::hayro_interpret::InterpreterSettings::default(),
        &hayro::RenderSettings::default(),
        &hayro::PixmapSettings {
            x_scale: scale,
            y_scale: scale,
            bg_color: hayro::vello_cpu::color::palette::css::WHITE,
        },
    );
    format!("{}x{}:{}", px.width(), px.height(), &sha(px.data_as_u8_slice())[..16])
}

fn run_child(lib: &str, file: &Path) -> Value {
    let exe = std::env::current_exe().unwrap();
    let mut child = Command::new(exe)
        .args(["one", lib])
        .arg(file)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    // Citim ieșirea în paralel: un text lung umple altfel conducta și blochează copilul.
    let mut stdout = child.stdout.take().unwrap();
    let reader = std::thread::spawn(move || {
        let mut out = String::new();
        std::io::Read::read_to_string(&mut stdout, &mut out).ok();
        out
    });
    let t0 = Instant::now();
    loop {
        if let Some(st) = child.try_wait().unwrap() {
            let out = reader.join().unwrap();
            return match serde_json::from_str::<Value>(out.trim()) {
                Ok(v) => v,
                Err(_) => json!({"ok": false, "crashed": true, "error": format!("procesul s-a prăbușit ({st})")}),
            };
        }
        if t0.elapsed() > CHILD_TIMEOUT {
            let _ = child.kill();
            return json!({"ok": false, "timeout": true, "error": "peste 60 s"});
        }
        std::thread::sleep(Duration::from_millis(5));
    }
}

fn read_all(td: &Path, out: &Path) {
    let mut rows = Vec::new();
    for f in manifest(td) {
        let path = td.join(f["path"].as_str().unwrap());
        let mut row = json!({"file": f["path"], "expect": f});
        for lib in LIBS {
            let mut r = run_child(lib, &path);
            // Așteptările din manifest: pagini și text.
            let broken = f["broken"].as_bool().unwrap_or(false) && !f["recoverable"].as_bool().unwrap_or(false);
            let pages_ok = if broken {
                !r["ok"].as_bool().unwrap_or(false)
            } else {
                r["pages"].as_u64() == f["pages"].as_u64()
            };
            let text_ok = r["text"].as_str().map(|t| {
                let t = norm(t);
                f["text"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .all(|s| t.contains(&norm(s.as_str().unwrap())))
                    && f["text_absent"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .all(|s| !t.contains(s.as_str().unwrap()))
            });
            r["verdict"] = json!(if pages_ok { "corect" } else { "GREȘIT" });
            r["text_ok"] = json!(text_ok);
            if let Some(t) = r["text"].as_str() {
                r["text"] = json!(t.chars().take(120).collect::<String>());
            }
            print!(
                "{:<45} {:<12} {:<7} pagini={:<5} text={:<6} {:>8} ms {:>6} MB {}\n",
                f["path"].as_str().unwrap(),
                lib,
                r["verdict"].as_str().unwrap(),
                r["pages"].to_string(),
                text_ok.map(|b| b.to_string()).unwrap_or("-".into()),
                r["total_ms"].to_string(),
                r["peak_mb"].as_f64().map(|m| format!("{m:.0}")).unwrap_or("-".into()),
                r["error"]
                    .as_str()
                    .map(|e| e.chars().take(60).collect::<String>())
                    .unwrap_or_default()
            );
            row[lib] = r;
        }
        rows.push(row);
    }
    std::fs::write(out, serde_json::to_vec_pretty(&rows).unwrap()).unwrap();
}

// ------------------------------------------------------------ operații

/// Copiază pe fiecare pagină atributele moștenite din arborele Pages, ca
/// pagina să rămână corectă când e mutată în alt document.
fn flatten_inherited(doc: &mut Document) {
    let pages: Vec<ObjectId> = doc.get_pages().values().copied().collect();
    for id in pages {
        let mut add = Vec::new();
        for key in [b"Resources".as_slice(), b"MediaBox", b"CropBox", b"Rotate"] {
            if doc.get_dictionary(id).unwrap().has(key) {
                continue;
            }
            let mut cur = doc
                .get_dictionary(id)
                .unwrap()
                .get(b"Parent")
                .and_then(Object::as_reference)
                .ok();
            while let Some(pid) = cur {
                let p = doc.get_dictionary(pid).unwrap();
                if let Ok(v) = p.get(key) {
                    add.push((key.to_vec(), v.clone()));
                    break;
                }
                cur = p.get(b"Parent").and_then(Object::as_reference).ok();
            }
        }
        let d = doc.get_object_mut(id).unwrap().as_dict_mut().unwrap();
        for (k, v) in add {
            d.set(k, v);
        }
    }
}

fn merge(docs: Vec<Document>) -> Document {
    let mut out = Document::with_version("1.7");
    let mut max_id = 1;
    let mut page_ids = Vec::new();
    for mut d in docs {
        flatten_inherited(&mut d);
        d.renumber_objects_with(max_id);
        max_id = d.max_id + 1;
        let pages: Vec<ObjectId> = d.get_pages().values().copied().collect();
        let skip: Vec<ObjectId> = d
            .objects
            .iter()
            .filter(|(_, o)| {
                o.as_dict()
                    .ok()
                    .and_then(|x| x.get(b"Type").ok())
                    .and_then(|t| t.as_name().ok())
                    .is_some_and(|n| n == b"Catalog" || n == b"Pages")
            })
            .map(|(id, _)| *id)
            .collect();
        for (id, o) in d.objects {
            if !skip.contains(&id) {
                out.objects.insert(id, o);
            }
        }
        page_ids.extend(pages);
    }
    out.max_id = max_id;
    let pages_id = out.new_object_id();
    for id in &page_ids {
        out.get_object_mut(*id)
            .unwrap()
            .as_dict_mut()
            .unwrap()
            .set("Parent", pages_id);
    }
    let kids: Vec<Object> = page_ids.iter().map(|id| Object::Reference(*id)).collect();
    let mut pages = Dictionary::new();
    pages.set("Type", "Pages");
    pages.set("Count", page_ids.len() as i64);
    pages.set("Kids", kids);
    out.objects.insert(pages_id, Object::Dictionary(pages));
    let mut cat = Dictionary::new();
    cat.set("Type", "Catalog");
    cat.set("Pages", pages_id);
    let cat_id = out.add_object(cat);
    out.trailer.set("Root", cat_id);
    out.prune_objects();
    out
}

fn keep_pages(doc: &Document, keep: &[u32]) -> Document {
    let mut d = doc.clone();
    let all: Vec<u32> = d.get_pages().keys().copied().collect();
    let del: Vec<u32> = all.into_iter().filter(|p| !keep.contains(p)).collect();
    d.delete_pages(&del);
    d.prune_objects();
    d
}

fn rotate(doc: &Document, by: i64) -> Document {
    let mut d = doc.clone();
    flatten_inherited(&mut d);
    for id in d.get_pages().values().copied().collect::<Vec<_>>() {
        let p = d.get_object_mut(id).unwrap().as_dict_mut().unwrap();
        let cur = p.get(b"Rotate").and_then(Object::as_i64).unwrap_or(0);
        p.set("Rotate", (cur + by).rem_euclid(360));
    }
    d
}

fn save(d: &mut Document) -> Vec<u8> {
    let mut v = Vec::new();
    d.save_to(&mut v).unwrap();
    v
}

/// O pagină, așa cum o văd trei cititori independenți.
#[derive(Clone, PartialEq, Debug)]
struct PageView {
    text: String,
    render: Option<String>,
}

fn view(bytes: &[u8], render: &[usize]) -> Result<(usize, Vec<PageView>, Vec<i64>), String> {
    // 1) lopdf trebuie să-l poată redeschide; 2) pdf-rs, cititor independent; 3) hayro randează.
    let doc = Document::load_mem(bytes).map_err(|e| format!("lopdf: {e}"))?;
    let n = doc.get_pages().len();
    let rot: Vec<i64> = doc
        .get_pages()
        .values()
        .map(|id| {
            doc.get_dictionary(*id)
                .unwrap()
                .get(b"Rotate")
                .and_then(Object::as_i64)
                .unwrap_or(0)
        })
        .collect();
    match pdf::file::FileOptions::cached().load(bytes.to_vec()) {
        Ok(f) if f.num_pages() as usize != n => {
            return Err(format!("pdf-rs vede {} pagini, lopdf {n}", f.num_pages()));
        }
        Ok(_) => {}
        // Pe corpusul extern pdf-rs refuză și originale valide: acolo e doar a doua opinie.
        Err(e) if !LENIENT.load(std::sync::atomic::Ordering::Relaxed) => return Err(format!("pdf-rs: {e}")),
        Err(_) => {}
    }
    let texts = std::panic::catch_unwind(|| pdf_extract::extract_text_from_mem_by_pages(bytes))
        .map_err(|_| "pdf-extract: panică".to_string())?
        .map_err(|e| format!("pdf-extract: {e}"))?;
    let pdf = hayro::hayro_syntax::Pdf::new(bytes.to_vec()).map_err(|e| format!("hayro: {e:?}"))?;
    let cache = hayro::RenderCache::new();
    let pages = pdf.pages();
    let views = (0..n)
        .map(|i| PageView {
            text: norm(texts.get(i).map(String::as_str).unwrap_or("")),
            render: render.contains(&i).then(|| render_page(&pages[i], &cache, 0.5)),
        })
        .collect();
    Ok((n, views, rot))
}

#[derive(Serialize)]
struct OpRow {
    file: String,
    op: String,
    ok: bool,
    ms: f64,
    out_bytes: usize,
    detail: String,
}

fn ops(td: &Path, out: &Path) {
    std::fs::create_dir_all(out).unwrap();
    let mut rows: Vec<OpRow> = Vec::new();
    let mut merge_inputs = Vec::new();
    let mut merge_expect: Vec<PageView> = Vec::new();
    let push = |rows: &mut Vec<OpRow>, file: &str, op: &str, ms: f64, out_bytes: usize, r: Result<String, String>| {
        let ok = r.is_ok();
        let detail = r.unwrap_or_else(|e| e);
        println!(
            "{:<42} {:<14} {:<5} {:>8.1} ms  {}",
            file,
            op,
            if ok { "OK" } else { "EȘEC" },
            ms,
            detail
        );
        rows.push(OpRow {
            file: file.into(),
            op: op.into(),
            ok,
            ms,
            out_bytes,
            detail,
        });
    };

    for f in manifest(td) {
        let rel = f["path"].as_str().unwrap().to_string();
        if f["broken"].as_bool().unwrap_or(false) && !f["recoverable"].as_bool().unwrap_or(false) {
            continue;
        }
        let path = td.join(&rel);
        let original = std::fs::read(&path).unwrap();
        let h0 = sha(&original);
        let name = Path::new(&rel).file_stem().unwrap().to_string_lossy().to_string();
        let big = f["large"].as_bool().unwrap_or(false);

        let t = Instant::now();
        let doc = match Document::load_mem(&original) {
            Ok(d) => d,
            Err(e) => {
                push(&mut rows, &rel, "deschidere", ms(t), 0, Err(e.to_string()));
                continue;
            }
        };
        let n = doc.get_pages().len();
        let sample: Vec<usize> = if big { vec![0, n - 1] } else { (0..n.min(20)).collect() };
        let (_, before, rot0) = match view(&original, &sample) {
            Ok(v) => v,
            Err(e) => {
                push(&mut rows, &rel, "referință", 0.0, 0, Err(e));
                continue;
            }
        };

        // a) deschidere → salvare fără modificări
        let t = Instant::now();
        let mut d = doc.clone();
        let rt = save(&mut d);
        let el = ms(t);
        let r = view(&rt, &sample).and_then(|(m, v, _)| {
            if m != n {
                return Err(format!("{m} pagini în loc de {n}"));
            }
            compare(&before, &v, &sample)?;
            let mut lost = Vec::new();
            let has = |b: &[u8], k: &[u8]| {
                Document::load_mem(b)
                    .ok()
                    .and_then(|d| d.catalog().ok().map(|c| c.has(k)))
                    .unwrap_or(false)
            };
            for k in [b"AcroForm".as_slice(), b"Outlines"] {
                if has(&original, k) && !has(&rt, k) {
                    lost.push(String::from_utf8_lossy(k).to_string());
                }
            }
            if lost.is_empty() {
                Ok("pagini, text și randare identice".into())
            } else {
                Err(format!("pierdut: {lost:?}"))
            }
        });
        std::fs::write(out.join(format!("rt-{name}.pdf")), &rt).unwrap();
        push(&mut rows, &rel, "salvare", el, rt.len(), r);

        // b) rotire +90
        let t = Instant::now();
        let mut d = rotate(&doc, 90);
        let b = save(&mut d);
        let el = ms(t);
        let r = view(&b, &[]).and_then(|(m, v, rot)| {
            let want: Vec<i64> = rot0.iter().map(|r| (r + 90) % 360).collect();
            if m != n || rot != want {
                return Err(format!("rotiri {rot:?} în loc de {want:?}"));
            }
            compare(&before, &v, &[])?;
            Ok("rotire corectă, text păstrat".into())
        });
        std::fs::write(out.join(format!("rot-{name}.pdf")), &b).unwrap();
        push(&mut rows, &rel, "rotire +90", el, b.len(), r);

        if n >= 2 {
            // c) extragerea primei și ultimei pagini
            let t = Instant::now();
            let mut d = keep_pages(&doc, &[1, n as u32]);
            let b = save(&mut d);
            let el = ms(t);
            let exp = vec![before[0].clone(), before[n - 1].clone()];
            let r = view(&b, &[0, 1]).and_then(|(m, v, _)| {
                if m != 2 {
                    return Err(format!("{m} pagini în loc de 2"));
                }
                let mut want = exp.clone();
                for (w, i) in want.iter_mut().zip([0, n - 1]) {
                    if !sample.contains(&i) {
                        w.render = None;
                    }
                }
                let got: Vec<PageView> = v
                    .into_iter()
                    .zip(&want)
                    .map(|(mut g, w)| {
                        if w.render.is_none() {
                            g.render = None;
                        }
                        g
                    })
                    .collect();
                if got != want {
                    return Err("paginile extrase diferă de original".into());
                }
                Ok(format!(
                    "2 pagini din {n}, identice cu originalul, {} KB",
                    b.len() / 1024
                ))
            });
            std::fs::write(out.join(format!("extract-{name}.pdf")), &b).unwrap();
            push(&mut rows, &rel, "extragere 1+N", el, b.len(), r);

            // d) separare: câte un fișier pe pagină (primele 3)
            let t = Instant::now();
            let mut sizes = 0;
            let mut res = Ok(());
            for p in 1..=n.min(3) {
                let mut d = keep_pages(&doc, &[p as u32]);
                let b = save(&mut d);
                sizes += b.len();
                if let Err(e) = view(&b, &[]).and_then(|(m, v, _)| {
                    if m != 1 || v[0].text != before[p - 1].text {
                        Err(format!("pagina {p} diferă"))
                    } else {
                        Ok(())
                    }
                }) {
                    res = Err(e);
                }
            }
            push(
                &mut rows,
                &rel,
                "separare",
                ms(t),
                sizes,
                res.map(|_| format!("{} fișiere corecte", n.min(3))),
            );
        }

        if !big {
            merge_inputs.push(doc);
            merge_expect.extend(before);
        }
        let after = sha(&std::fs::read(&path).unwrap());
        push(
            &mut rows,
            &rel,
            "original",
            0.0,
            0,
            if after == h0 {
                Ok("neschimbat (SHA-256)".into())
            } else {
                Err("MODIFICAT!".into())
            },
        );
    }

    // e) unire: toate PDF-urile valide mici într-unul singur
    let t = Instant::now();
    let total = merge_expect.len();
    let mut d = merge(merge_inputs);
    let b = save(&mut d);
    let el = ms(t);
    let all: Vec<usize> = (0..total).collect();
    let r = view(&b, &all).and_then(|(m, v, _)| {
        if m != total {
            return Err(format!("{m} pagini în loc de {total}"));
        }
        let want: Vec<PageView> = merge_expect
            .iter()
            .map(|p| PageView {
                text: p.text.clone(),
                render: None,
            })
            .collect();
        let got: Vec<PageView> = v
            .iter()
            .map(|p| PageView {
                text: p.text.clone(),
                render: None,
            })
            .collect();
        let bad = want.iter().zip(&got).filter(|(a, b)| a != b).count();
        if bad > 0 {
            return Err(format!("{bad} pagini cu text diferit"));
        }
        Ok(format!("{total} pagini, text identic"))
    });
    std::fs::write(out.join("unire-toate.pdf"), &b).unwrap();
    push(&mut rows, "(toate valide)", "unire", el, b.len(), r);
    std::fs::write(out.join("ops.json"), serde_json::to_vec_pretty(&rows).unwrap()).unwrap();
    let bad = rows.iter().filter(|r| !r.ok).count();
    println!("\n{} operații, {} eșecuri", rows.len(), bad);
    let _ = std::io::stdout().flush();
}

fn compare(before: &[PageView], after: &[PageView], rendered: &[usize]) -> Result<(), String> {
    for (i, (a, b)) in before.iter().zip(after).enumerate() {
        if a.text != b.text {
            return Err(format!("textul paginii {} diferă", i + 1));
        }
        if rendered.contains(&i) && a.render != b.render {
            return Err(format!(
                "randarea paginii {} diferă: {:?} vs {:?}",
                i + 1,
                a.render,
                b.render
            ));
        }
    }
    Ok(())
}

/// Unde se duce timpul lopdf pe un fișier mare.
fn probe(file: &Path) {
    let bytes = std::fs::read(file).unwrap();
    let t = Instant::now();
    let doc = Document::load_mem(&bytes).unwrap();
    println!("lopdf load: {} ms", ms(t));
    let t = Instant::now();
    let pages: Vec<u32> = doc.get_pages().keys().copied().collect();
    println!("get_pages ({}): {} ms", pages.len(), ms(t));
    for n in [1usize, 10, 50, 100] {
        let t = Instant::now();
        doc.extract_text(&pages[..n]).unwrap();
        println!("extract_text {n} pagini: {} ms", ms(t));
    }
    let t = Instant::now();
    for p in &pages[..100] {
        doc.extract_text(&[*p]).unwrap();
    }
    println!("extract_text pe rând, 100 pagini: {} ms", ms(t));
}

/// Verificare strictă: un fișier trece doar dacă structura lui e intactă.
/// Bibliotecile tolerante „recuperează” în tăcere fișiere trunchiate sau
/// alterate; K.G.B. trebuie să știe și să-i spună utilizatorului.
fn strict_check(b: &[u8]) -> Result<usize, String> {
    if !b.starts_with(b"%PDF-") {
        return Err("nu începe cu %PDF-".into());
    }
    let tail = &b[b.len().saturating_sub(1024)..];
    let tail_s = String::from_utf8_lossy(tail);
    if !tail_s.trim_end().ends_with("%%EOF") {
        return Err("lipsește %%EOF la final (fișier trunchiat?)".into());
    }
    let sx = tail_s.rfind("startxref").ok_or("lipsește startxref")?;
    let off: usize = tail_s[sx + 9..]
        .split_whitespace()
        .next()
        .and_then(|x| x.parse().ok())
        .ok_or("startxref invalid")?;
    // Fiecare secțiune xref (urmând /Prev) trebuie să fie exact unde spune fișierul.
    let mut next = Some(off);
    let mut seen = 0;
    while let Some(o) = next {
        seen += 1;
        if seen > 1000 || o >= b.len() {
            return Err("lanț xref invalid".into());
        }
        let at = &b[o..];
        if at.starts_with(b"xref") {
            // offseturile din tabel trebuie să indice „N G obj”
            let text = String::from_utf8_lossy(&at[..at.len().min(64 * 1024 * 1024)]);
            let mut lines = text.lines().skip(1);
            loop {
                let Some(h) = lines.next() else {
                    return Err("tabel xref neterminat".into());
                };
                let h = h.trim();
                if h.is_empty() {
                    continue;
                }
                if h.starts_with("trailer") {
                    break;
                }
                let mut it = h.split_whitespace();
                let (start, count): (usize, usize) = match (
                    it.next().and_then(|x| x.parse().ok()),
                    it.next().and_then(|x| x.parse().ok()),
                ) {
                    (Some(a), Some(c)) => (a, c),
                    _ => return Err(format!("antet xref invalid: {h}")),
                };
                for k in 0..count {
                    let e = lines.next().ok_or("intrare xref lipsă")?;
                    if e.trim_end().ends_with('n') {
                        let eo: usize = e[..10].parse().map_err(|_| "offset xref invalid")?;
                        let want = format!("{} ", start + k);
                        if eo >= b.len() || !b[eo..].starts_with(want.as_bytes()) {
                            return Err(format!("obiectul {} nu e la offsetul din xref", start + k));
                        }
                    }
                }
            }
            let tr = &text[text.find("trailer").unwrap()..];
            let tr = &tr[..tr.find("startxref").unwrap_or(tr.len())]; // doar trailerul acestei secțiuni
            next = tr.find("/Prev").and_then(|i| {
                tr[i + 5..]
                    .split_whitespace()
                    .next()?
                    .trim_end_matches(">>")
                    .parse()
                    .ok()
            });
        } else if at.first().is_some_and(u8::is_ascii_digit)
            && String::from_utf8_lossy(&at[..at.len().min(400)]).contains("/XRef")
        {
            next = None; // flux xref: verificat mai jos de parser
        } else {
            return Err("startxref nu indică un tabel xref".into());
        }
    }
    // Toate obiectele se parsează și toate fluxurile se decomprimă.
    let doc = Document::load_mem(b).map_err(|e| format!("parsare: {e}"))?;
    if doc.is_encrypted() || doc.was_encrypted() {
        return Err("criptat: protejat (cu sau fără parolă); doar citire".into());
    }
    for (id, o) in &doc.objects {
        // Filtrele de imagine (JPEG, JPEG 2000, CCITT, JBIG2) nu sunt compresie
        // generală; le verifică cititorul de imagini, nu lopdf.
        if let Object::Stream(st) = o
            && let Ok(f) = st.dict.get(b"Filter")
            && filters(f).iter().all(|n| GENERAL_FILTERS.contains(&n.as_slice()))
            && !filters(f).is_empty()
            && st.decompressed_content().is_err()
        {
            return Err(format!("fluxul {} {} nu se decomprimă", id.0, id.1));
        }
    }
    let n = doc.get_pages().len();
    if n == 0 {
        return Err("documentul nu are nicio pagină".into());
    }
    Ok(n)
}

const GENERAL_FILTERS: [&[u8]; 4] = [b"FlateDecode", b"LZWDecode", b"ASCIIHexDecode", b"ASCII85Decode"];

fn filters(f: &Object) -> Vec<Vec<u8>> {
    match f {
        Object::Name(n) => vec![n.clone()],
        Object::Array(a) => a.iter().filter_map(|x| x.as_name().ok().map(<[u8]>::to_vec)).collect(),
        _ => vec![],
    }
}

fn strict_all(td: &Path) {
    for f in manifest(td) {
        let rel = f["path"].as_str().unwrap();
        let b = std::fs::read(td.join(rel)).unwrap();
        let broken = f["broken"].as_bool().unwrap_or(false);
        let r = strict_check(&b);
        let good = r.is_ok() != broken;
        println!(
            "{:<45} {:<7} {}",
            rel,
            if good { "corect" } else { "GREȘIT" },
            match r {
                Ok(n) => format!("intact, {n} pagini"),
                Err(e) => format!("refuzat: {e}"),
            }
        );
    }
}

/// Recuperare ca fișier NOU: cititorul tolerant reconstruiește, salvăm o copie,
/// copia trebuie să treacă verificarea strictă. Originalul nu se atinge.
fn repair(input: &Path, output: &Path) {
    let b = std::fs::read(input).unwrap();
    println!("original strict: {:?}", strict_check(&b));
    let mut d = Document::load_mem(&b).unwrap();
    let out = save(&mut d);
    std::fs::write(output, &out).unwrap();
    println!("copie strictă:   {:?}", strict_check(&out));
    println!(
        "original neschimbat: {}",
        sha(&std::fs::read(input).unwrap()) == sha(&b)
    );
}

/// Prima pagină ca PNG (scara 2), pentru miniaturi și pentru testul OCR.
fn render_png(input: &Path, output: &Path) {
    let pdf = hayro::hayro_syntax::Pdf::new(std::fs::read(input).unwrap()).unwrap();
    let cache = hayro::RenderCache::new();
    let t = Instant::now();
    let px = hayro::render(
        &pdf.pages()[0],
        &cache,
        &hayro::hayro_interpret::InterpreterSettings::default(),
        &hayro::RenderSettings::default(),
        &hayro::PixmapSettings {
            x_scale: 2.0,
            y_scale: 2.0,
            bg_color: hayro::vello_cpu::color::palette::css::WHITE,
        },
    );
    println!("randare {}x{} în {} ms", px.width(), px.height(), ms(t));
    std::fs::write(output, px.into_png().unwrap()).unwrap();
}

/// Corpus extern (fără așteptări în manifest): verificare strictă, câte pagini
/// vede fiecare bibliotecă și dacă salvarea cu lopdf păstrează textul și randarea.
fn scan(dir: &Path) {
    LENIENT.store(true, std::sync::atomic::Ordering::Relaxed);
    std::panic::set_hook(Box::new(|_| {}));
    let mut files: Vec<_> = std::fs::read_dir(dir).unwrap().flatten().map(|e| e.path()).collect();
    files.sort();
    let (mut agree, mut rt_ok, mut n) = (0, 0, 0);
    for p in files.iter().filter(|p| p.extension().is_some_and(|e| e.eq_ignore_ascii_case("pdf"))) {
        n += 1;
        let b = std::fs::read(p).unwrap();
        let strict = strict_check(&b);
        let counts: Vec<String> = LIBS
            .iter()
            .filter(|l| **l != "pdf-extract")
            .map(|l| {
                let r = run_child(l, p);
                if r["ok"].as_bool() == Some(true) {
                    r["pages"].to_string()
                } else if r["crashed"].as_bool() == Some(true) {
                    "PRĂBUȘIT".into()
                } else if r["timeout"].as_bool() == Some(true) {
                    "TIMP".into()
                } else {
                    "refuz".into()
                }
            })
            .collect();
        let same = counts.windows(2).all(|w| w[0] == w[1]) && counts[0] != "refuz";
        agree += same as usize;
        // salvare cu lopdf → aceleași pagini, text și randarea primelor 3 pagini
        let rt = std::panic::catch_unwind(|| {
            let doc = Document::load_mem(&b).map_err(|e| e.to_string())?;
            let pages = doc.get_pages().len();
            let sample: Vec<usize> = (0..pages.min(3)).collect();
            let before = view(&b, &sample)?;
            let mut d = doc.clone();
            let out = save(&mut d);
            let after = view(&out, &sample)?;
            if before.0 != after.0 {
                return Err(format!("{} → {} pagini", before.0, after.0));
            }
            compare(&before.1, &after.1, &sample)?;
            Ok::<_, String>(())
        })
        .unwrap_or_else(|_| Err("panică".into()));
        rt_ok += rt.is_ok() as usize;
        println!(
            "{:<58} strict={:<6} pagini lopdf/pdf-rs/hayro={:<22} salvare={}",
            p.file_name().unwrap().to_string_lossy().chars().take(58).collect::<String>(),
            if strict.is_ok() { "intact" } else { "NU" },
            counts.join("/"),
            match &rt {
                Ok(()) => "identică".to_string(),
                Err(e) => format!("— {}", e.chars().take(70).collect::<String>()),
            }
        );
        if let Err(e) = strict {
            println!("{:<58}   strict: {e}", "");
        }
    }
    println!("
{n} PDF-uri; pagini la fel în toate bibliotecile: {agree}; salvare identică (pagini, text, randare): {rt_ok}");
}
