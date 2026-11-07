//! Spike S6 (Etapa 4, step 4.7): generating documents from models.
//!
//! - `model <out.docx>`: a DOCX model made with docx-rs, with placeholders
//!   deliberately split over runs, in a header and in a table.
//! - `selftest <dir>`: model → fill → checks (values present, other parts
//!   byte-identical, missing fields reported, special characters escaped).
//! - `corpus <dir>`: every DOCX of a corpus through the filler with no values:
//!   nothing may change, nothing may crash.
//! - `pdf <out.pdf>`: an invoice from a Typst model, checked by reading it back.

mod fill;
#[cfg(feature = "typst")]
mod pdf;

use std::collections::BTreeMap;
use std::io::{Cursor, Read};
use std::path::Path;
use std::time::Instant;

fn values() -> BTreeMap<String, String> {
    [
        ("firma.nume", "Kronos Global Business SRL"),
        ("firma.cui", "RO12345678"),
        ("client", "Școala Gimnazială „Ion Creangă” Iași"),
        ("data", "07.11.2026"),
        ("total", "1.673,14 lei"),
        ("obiect", "Furnizare <echipamente> & servicii; preț \"fix\""),
    ]
    .into_iter()
    .map(|(k, v)| (k.to_string(), v.to_string()))
    .collect()
}

#[cfg(feature = "docxrs")]
fn model() -> Vec<u8> {
    use docx_rs::*;
    // Runs split the way Word splits them after editing.
    let p1 = Paragraph::new()
        .add_run(Run::new().add_text("Către: {{"))
        .add_run(Run::new().add_text("cli").bold())
        .add_run(Run::new().add_text("ent}}, data {{data}}."));
    let p2 = Paragraph::new()
        .add_run(Run::new().add_text("Obiectul contractului: "))
        .add_run(Run::new().add_text("{{obiect}}").italic());
    let p3 = Paragraph::new().add_run(Run::new().add_text("Câmp fără valoare: {{iban}}."));
    let table = Table::new(vec![TableRow::new(vec![
        TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text("Total de plată"))),
        TableCell::new().add_paragraph(
            Paragraph::new()
                .add_run(Run::new().add_text("{{to"))
                .add_run(Run::new().add_text("tal}}").bold()),
        ),
    ])]);
    let header = Header::new()
        .add_paragraph(Paragraph::new().add_run(Run::new().add_text("{{firma.nume}} · CUI {{firma.cui}}")));
    let mut buf = Cursor::new(Vec::new());
    Docx::new()
        .header(header)
        .add_paragraph(Paragraph::new().add_run(Run::new().add_text("CONTRACT DE FURNIZARE").bold().size(32)))
        .add_paragraph(p1)
        .add_paragraph(p2)
        .add_table(table)
        .add_paragraph(p3)
        .build()
        .pack(&mut buf)
        .expect("docx-rs pack");
    buf.into_inner()
}

/// The built-in models of the documents module (step 4.8), written once with
/// docx-rs and committed as files; docx-rs itself does not go into the app.
#[cfg(feature = "docxrs")]
fn models(dir: &Path) {
    use docx_rs::*;
    let p = |t: &str| Paragraph::new().add_run(Run::new().add_text(t));
    let title = |t: &str| Paragraph::new().align(AlignmentType::Center).add_run(Run::new().add_text(t).bold().size(28));
    let right = |t: &str| Paragraph::new().align(AlignmentType::Right).add_run(Run::new().add_text(t));
    let head = || {
        Header::new()
            .add_paragraph(Paragraph::new().add_run(Run::new().add_text("{{firma.nume}}").bold()))
            .add_paragraph(Paragraph::new().add_run(
                Run::new().add_text("CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} · {{firma.adresa}}").size(16),
            ))
    };
    let cell = |t: &str, bold: bool| {
        let r = Run::new().add_text(t);
        TableCell::new().add_paragraph(Paragraph::new().add_run(if bold { r.bold() } else { r }))
    };
    let save = |name: &str, d: Docx| {
        let mut f = std::fs::File::create(dir.join(name)).unwrap();
        d.build().pack(&mut f).unwrap();
        println!("{name}");
    };
    let sign = || {
        vec![
            p(""),
            p("Data: {{data}}"),
            p("{{firma.reprezentant}}, {{firma.functie_reprezentant}}"),
            p("Semnătura și ștampila: ______________________"),
        ]
    };

    // Administrativ
    let mut d = Docx::new()
        .header(head())
        .add_paragraph(right("Nr. înregistrare: {{numar}} / {{data}}"))
        .add_paragraph(p("Către: {{destinatar}}"))
        .add_paragraph(title("CERERE"))
        .add_paragraph(p(
            "Subsemnatul {{firma.reprezentant}}, în calitate de {{firma.functie_reprezentant}} al {{firma.nume}}, cu sediul în {{firma.adresa}}, CUI {{firma.cui}}, vă rog să aprobați următoarea solicitare:",
        ))
        .add_paragraph(p("{{solicitare}}"))
        .add_paragraph(p("Motivul solicitării: {{motiv}}"))
        .add_paragraph(p("Vă mulțumesc."));
    for x in sign() {
        d = d.add_paragraph(x);
    }
    save("administrativ-cerere.docx", d);

    // Comercial: ofertă
    let t = Table::new(vec![
        TableRow::new(vec![cell("Descriere", true), cell("Valoare", true)]),
        TableRow::new(vec![cell("{{obiect}}", false), cell("{{valoare}}", false)]),
    ]);
    let mut d = Docx::new()
        .header(head())
        .add_paragraph(title("OFERTĂ COMERCIALĂ"))
        .add_paragraph(right("Nr. {{numar}} din {{data}}"))
        .add_paragraph(p("Către: {{client}}"))
        .add_paragraph(p("Vă transmitem oferta noastră pentru:"))
        .add_table(t)
        .add_paragraph(p("Termen de livrare: {{termen_livrare}}"))
        .add_paragraph(p("Condiții de plată: {{conditii_plata}}"))
        .add_paragraph(p("Oferta este valabilă până la {{valabil_pana_la}}."))
        .add_paragraph(p("Persoană de contact: {{firma.telefon}} · {{firma.email}}"));
    for x in sign() {
        d = d.add_paragraph(x);
    }
    save("comercial-oferta.docx", d);

    // Comercial: contract
    let mut d = Docx::new()
        .header(head())
        .add_paragraph(title("CONTRACT DE PRESTĂRI SERVICII"))
        .add_paragraph(right("Nr. {{numar}} din {{data}}"))
        .add_paragraph(p("1. PĂRȚILE").bold())
        .add_paragraph(p(
            "{{firma.nume}}, cu sediul în {{firma.adresa}}, CUI {{firma.cui}}, Reg. Com. {{firma.reg_com}}, cont {{firma.iban}} deschis la {{firma.banca}}, reprezentată de {{firma.reprezentant}}, în calitate de prestator,",
        ))
        .add_paragraph(p(
            "și {{client}}, cu sediul în {{client.adresa}}, CUI {{client.cui}}, reprezentată de {{client.reprezentant}}, în calitate de beneficiar,",
        ))
        .add_paragraph(p("au convenit încheierea prezentului contract."))
        .add_paragraph(p("2. OBIECTUL CONTRACTULUI").bold())
        .add_paragraph(p("Prestatorul se obligă să presteze următoarele servicii: {{obiect}}."))
        .add_paragraph(p("3. PREȚUL ȘI PLATA").bold())
        .add_paragraph(p("Prețul serviciilor este de {{pret}}. Plata se face în {{termen_plata}} de la emiterea facturii."))
        .add_paragraph(p("4. DURATA").bold())
        .add_paragraph(p("Contractul intră în vigoare la data semnării și este valabil {{durata}}."))
        .add_paragraph(p("5. DISPOZIȚII FINALE").bold())
        .add_paragraph(p("Prezentul contract s-a încheiat în două exemplare, câte unul pentru fiecare parte."))
        .add_paragraph(p(""))
        .add_table(Table::new(vec![
            TableRow::new(vec![cell("PRESTATOR", true), cell("BENEFICIAR", true)]),
            TableRow::new(vec![cell("{{firma.nume}}", false), cell("{{client}}", false)]),
            TableRow::new(vec![cell("{{firma.reprezentant}}", false), cell("{{client.reprezentant}}", false)]),
        ]));
    save("comercial-contract-servicii.docx", d);

    // HR
    let mut d = Docx::new()
        .header(head())
        .add_paragraph(right("Nr. {{numar}} / {{data}}"))
        .add_paragraph(title("ADEVERINȚĂ"))
        .add_paragraph(p(
            "Prin prezenta se adeverește că {{angajat}} este angajat(ă) al(a) {{firma.nume}}, CUI {{firma.cui}}, în funcția de {{functie}}, cu contract individual de muncă pe durată {{durata_contract}}, începând cu data de {{data_angajarii}}.",
        ))
        .add_paragraph(p("Adeverința se eliberează pentru a-i servi la {{scop}}."));
    for x in sign() {
        d = d.add_paragraph(x);
    }
    save("hr-adeverinta-salariat.docx", d);

    // Tehnic
    let t = Table::new(vec![
        TableRow::new(vec![cell("Lucrare / echipament", true), cell("Constatări", true)]),
        TableRow::new(vec![cell("{{obiect}}", false), cell("{{constatari}}", false)]),
    ]);
    let d = Docx::new()
        .header(head())
        .add_paragraph(title("PROCES-VERBAL DE RECEPȚIE"))
        .add_paragraph(right("Nr. {{numar}} din {{data}}"))
        .add_paragraph(p("Încheiat astăzi, {{data}}, la {{locatie}}, între {{firma.nume}}, reprezentată de {{firma.reprezentant}}, și {{client}}, reprezentată de {{client.reprezentant}}."))
        .add_paragraph(p("Comisia a verificat:"))
        .add_table(t)
        .add_paragraph(p("Concluzie: {{concluzie}}"))
        .add_paragraph(p(""))
        .add_table(Table::new(vec![
            TableRow::new(vec![cell("Am predat,", true), cell("Am primit,", true)]),
            TableRow::new(vec![cell("{{firma.reprezentant}}", false), cell("{{client.reprezentant}}", false)]),
        ]));
    save("tehnic-pv-receptie.docx", d);
}

fn entries(data: &[u8]) -> BTreeMap<String, Vec<u8>> {
    let mut z = zip::ZipArchive::new(Cursor::new(data)).expect("zip");
    let mut out = BTreeMap::new();
    for i in 0..z.len() {
        let mut f = z.by_index(i).expect("entry");
        let mut b = Vec::new();
        f.read_to_end(&mut b).expect("read");
        out.insert(f.name().unwrap_or_default().to_string(), b);
    }
    out
}

fn check(name: &str, ok: bool, detail: impl std::fmt::Display) -> bool {
    println!("{}  {name} — {detail}", if ok { "PASS" } else { "FAIL" });
    ok
}

#[cfg(feature = "docxrs")]
fn selftest(dir: &Path) -> bool {
    let m = model();
    std::fs::write(dir.join("model.docx"), &m).unwrap();
    let t = Instant::now();
    let f = fill::fill(&m, &values()).unwrap();
    let ms = t.elapsed().as_secs_f64() * 1000.0;
    std::fs::write(dir.join("completat.docx"), &f.bytes).unwrap();
    let body = fill::text_of(&f.bytes, "word/document.xml").unwrap();
    let head_part = f
        .parts_changed
        .iter()
        .find(|p| p.starts_with("word/header"))
        .cloned()
        .unwrap_or_default();
    let head = fill::text_of(&f.bytes, &head_part).unwrap_or_default();
    let mut ok = true;
    ok &= check(
        "înlocuiri",
        f.replaced == 6,
        format!("{} în {:?}, {ms:.1} ms", f.replaced, f.parts_changed),
    );
    ok &= check(
        "câmp împărțit în 3 bucăți",
        body.contains("Către: Școala Gimnazială „Ion Creangă” Iași, data 07.11.2026."),
        body.lines().nth(1).unwrap_or_default(),
    );
    ok &= check("câmp în tabel", body.contains("1.673,14 lei"), "");
    ok &= check(
        "câmpuri în antet",
        head.contains("Kronos Global Business SRL · CUI RO12345678"),
        head.trim(),
    );
    ok &= check(
        "caractere speciale scrise corect (< & \")",
        body.contains("Furnizare <echipamente> & servicii; preț \"fix\""),
        "",
    );
    ok &= check(
        "câmpul fără valoare e raportat, nu golit",
        f.missing.iter().map(String::as_str).eq(["iban"]) && body.contains("{{iban}}"),
        format!("{:?}", f.missing),
    );
    let (a, b) = (entries(&m), entries(&f.bytes));
    let same: Vec<&String> = a.keys().filter(|k| a[*k] == b[*k]).collect();
    ok &= check(
        "celelalte părți ale fișierului, identice",
        a.keys().eq(b.keys()) && same.len() == a.len() - f.parts_changed.len(),
        format!("{} din {} neatinse", same.len(), a.len()),
    );
    // Another DOCX reader (docx-rs) opens the result.
    ok &= check(
        "rezultatul se deschide cu alt cititor DOCX (docx-rs)",
        docx_rs::read_docx(&f.bytes).is_ok(),
        "",
    );
    // The result is still a valid model: filling it again changes nothing more.
    let again = fill::fill(&f.bytes, &values()).unwrap();
    ok &= check("al doilea pas nu mai găsește nimic", again.replaced == 0, "");
    ok
}

fn corpus(dir: &Path) {
    let mut files: Vec<_> = std::fs::read_dir(dir)
        .unwrap()
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|e| e.eq_ignore_ascii_case("docx")))
        .collect();
    files.sort();
    let (mut same, mut refused, mut crashed, mut changed) = (0, 0, 0, 0);
    let mut slowest = (0.0f64, String::new());
    std::panic::set_hook(Box::new(|_| {}));
    for p in &files {
        let data = std::fs::read(p).unwrap();
        let name = p.file_name().unwrap().to_string_lossy().to_string();
        let t = Instant::now();
        let r = std::panic::catch_unwind(|| fill::fill(&data, &BTreeMap::new()));
        let ms = t.elapsed().as_secs_f64() * 1000.0;
        if ms > slowest.0 {
            slowest = (ms, name.clone());
        }
        match r {
            Err(_) => {
                crashed += 1;
                println!("CRASH   {name}");
            }
            Ok(Err(e)) => {
                refused += 1;
                println!("REFUZAT {name}: {e}");
            }
            Ok(Ok(f)) => {
                if entries(&data) == entries(&f.bytes) {
                    same += 1;
                } else {
                    changed += 1;
                    println!("SCHIMBAT {name}");
                }
            }
        }
    }
    println!(
        "\ncorpus: {} fișiere — {same} neschimbate, {refused} refuzate, {changed} schimbate, {crashed} prăbușiri; cel mai lent {:.0} ms ({})",
        files.len(),
        slowest.0,
        slowest.1
    );
}

#[cfg(feature = "typst")]
const INVOICE: &str = r#"
#let d = sys.inputs
#set page(paper: "a4", margin: 2cm, footer: context align(center)[Pagina #counter(page).display() din #counter(page).final().first()])
#set text(lang: "ro", size: 10.5pt)
#grid(columns: (1fr, 1fr),
  [*#d.at("firma.nume")* \ CUI #d.at("firma.cui")],
  align(right)[*FACTURĂ* nr. #d.numar \ Data: #d.data])
#v(1cm)
Cumpărător: *#d.client* \
Obiect: #d.obiect
#v(0.5cm)
#table(columns: (auto, 1fr, auto, auto), align: (center, left, right, right),
  [*Nr.*], [*Denumire*], [*Cant.*], [*Valoare*],
  ..range(1, 41).map(i => ([#i], [Serviciu de mentenanță, poziția #i — țiglă, șurub, ață], [1], [41,83])).flatten())
#align(right)[*Total de plată: #d.total*]
"#;

#[cfg(feature = "typst")]
fn pdf_test(out: &Path) -> bool {
    let mut inputs = values();
    inputs.insert("numar".into(), "#panic(\"x\") ]* _".into());
    let mut ok = true;
    let t = Instant::now();
    // Without Typst's built-in fonts: the Windows fonts already on the computer
    // (read at run time, never shipped with the app).
    let system: Vec<Vec<u8>> = if cfg!(feature = "typst-fonts") {
        Vec::new()
    } else {
        ["arial.ttf", "arialbd.ttf", "ariali.ttf"]
            .iter()
            .filter_map(|f| std::fs::read(format!("C:/Windows/Fonts/{f}")).ok())
            .collect()
    };
    let bytes = match pdf::render(INVOICE, &inputs, &system) {
        Ok(b) => b,
        Err(e) => return check("PDF generat", false, e),
    };
    let first = t.elapsed().as_secs_f64() * 1000.0;
    let t = Instant::now();
    let _ = pdf::render(INVOICE, &inputs, &system).unwrap();
    let second = t.elapsed().as_secs_f64() * 1000.0;
    std::fs::write(out, &bytes).unwrap();
    ok &= check(
        "PDF generat",
        bytes.starts_with(b"%PDF-"),
        format!(
            "{} KB, prima dată {first:.0} ms, a doua oară {second:.0} ms",
            bytes.len() / 1024
        ),
    );
    let doc = lopdf::Document::load_mem(&bytes).unwrap();
    let pages = doc.get_pages().len();
    ok &= check(
        "40 de rânduri de tabel → mai multe pagini",
        pages >= 2,
        format!("{pages} pagini"),
    );
    let text = doc.extract_text(&[1]).unwrap_or_default();
    ok &= check(
        "diacriticele se pot căuta în PDF (ș ț ă î â)",
        text.contains("Școala") && text.contains("Iași") && text.contains("țiglă") && text.contains("FACTURĂ"),
        text.lines().find(|l| l.contains("Școala")).unwrap_or("(lipsă)"),
    );
    ok &= check(
        "o valoare cu cod Typst e tipărită ca text, nu rulată",
        text.contains("#panic(\"x\") ]* _"),
        text.lines().find(|l| l.contains("panic")).unwrap_or("(lipsă)"),
    );
    // A model that tries to read a file from the computer is refused.
    let r = pdf::render("#read(\"C:/Windows/win.ini\")", &inputs, &[]);
    ok &= check(
        "modelul nu poate citi fișiere de pe calculator",
        r.is_err(),
        r.err().unwrap_or_default(),
    );
    ok
}

/// Checks a PDF made elsewhere (the WebView2 variant): pages, searchable
/// diacritics, the code-like value printed as text.
fn check_pdf(path: &Path) -> bool {
    let doc = lopdf::Document::load(path).unwrap();
    let pages = doc.get_pages().len();
    let text = doc.extract_text(&[1]).unwrap_or_default();
    let mut ok = check("pagini", pages >= 2, pages);
    ok &= check(
        "diacriticele se pot căuta în PDF (ș ț ă î â)",
        text.contains("Școala") && text.contains("Iași") && text.contains("țiglă") && text.contains("FACTURĂ"),
        text.lines().find(|l| l.contains("coala")).unwrap_or("(lipsă)"),
    );
    ok &= check(
        "valoarea cu cod e text",
        text.contains("#panic(\"x\")") && text.contains("<b>nu e bold</b>"),
        text.lines().find(|l| l.contains("panic")).unwrap_or("(lipsă)"),
    );
    ok
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let ok = match args.get(1).map(String::as_str) {
        #[cfg(feature = "docxrs")]
        Some("model") => {
            std::fs::write(&args[2], model()).unwrap();
            true
        }
        #[cfg(feature = "docxrs")]
        Some("models") => {
            models(Path::new(&args[2]));
            true
        }
        #[cfg(feature = "docxrs")]
        Some("selftest") => selftest(Path::new(&args[2])),
        Some("corpus") => {
            corpus(Path::new(&args[2]));
            true
        }
        #[cfg(feature = "typst")]
        Some("pdf") => pdf_test(Path::new(&args[2])),
        Some("checkpdf") => check_pdf(Path::new(&args[2])),
        _ => {
            eprintln!("usage: s6 model|selftest|corpus|pdf|checkpdf <path>");
            false
        }
    };
    std::process::exit(if ok { 0 } else { 1 });
}
