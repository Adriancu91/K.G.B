//! Calculation templates (Etapa 3, step 3.7; Master Plan §6.3; D-036).
//!
//! The originals are code: they cannot be edited, only copied. "Use" builds
//! the workbook and imports it as a new document — the user's copy, with its
//! own versions. Each template is built twice: first with the formulas only,
//! which IronCalc evaluates; then again with those results stored, so the
//! file shows correct values in any program, even one that does not
//! recalculate. Every formula is documented in `docs/etapa3/SABLOANE.md` and
//! checked against values computed by hand (`tests/templates.rs`).

use std::collections::HashMap;

use ironcalc::base::cell::CellValue as V;
use rust_xlsxwriter::{Format, Formula, Workbook, Worksheet};
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct TemplateInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub category: &'static str,
    pub description: &'static str,
    /// What to fill in, in plain words.
    pub how: &'static str,
}

pub const TEMPLATES: &[TemplateInfo] = &[
    TemplateInfo {
        id: "buget-lunar",
        name: "Buget lunar",
        category: "Financiar",
        description: "Venituri și cheltuieli planificate față de realizate, diferențe, procent de realizare, sold.",
        how: "Scrie sumele în coloanele Planificat și Realizat; totalurile, diferențele și soldul se calculează.",
    },
    TemplateInfo {
        id: "factura",
        name: "Factură",
        category: "Facturare",
        description: "Linii de factură cu valoare și TVA pe linie, totaluri fără TVA, TVA și de plată.",
        how: "Completează antetul și liniile (cantitate, preț fără TVA). Cota TVA e într-o singură celulă (21%), modificabilă.",
    },
    TemplateInfo {
        id: "registru-casa",
        name: "Registru de casă",
        category: "Contabilitate primară",
        description: "Încasări și plăți în numerar cu sold după fiecare operațiune și verificarea soldului final.",
        how: "Scrie soldul inițial și operațiunile (dată, document, încasare sau plată); soldul curge singur.",
    },
    TemplateInfo {
        id: "cost-km",
        name: "Cost pe kilometru",
        category: "Transport",
        description: "Costul unei curse: combustibil după consum și preț, taxe, alte costuri, cost pe kilometru.",
        how: "Completează distanța, consumul, prețul combustibilului și costurile; restul se calculează.",
    },
    TemplateInfo {
        id: "rate-credit",
        name: "Rate credit",
        category: "Credite",
        description: "Rata lunară constantă și graficul de rambursare: dobândă, principal și sold pentru fiecare lună.",
        how: "Scrie suma, dobânda anuală și numărul de luni (cel mult 360); rata și graficul se calculează.",
    },
];

pub const NOTE: &str = "Model orientativ generat de K.G.B. Verificați cifrele înainte de a le folosi oficial; nu înlocuiește un program de contabilitate autorizat.";

type Key = (u32, u32, u16);

/// Writes cells, storing a formula's result when it is known.
struct W<'a> {
    ws: &'a mut Worksheet,
    sheet: u32,
    results: Option<&'a HashMap<Key, String>>,
}

impl W<'_> {
    fn text(&mut self, r: u32, c: u16, s: &str, f: &Format) {
        self.ws.write_string_with_format(r, c, s, f).expect("valid cell");
    }
    fn num(&mut self, r: u32, c: u16, n: f64, f: &Format) {
        self.ws.write_number_with_format(r, c, n, f).expect("valid cell");
    }
    fn formula(&mut self, r: u32, c: u16, f: &str, fmt: &Format) {
        let mut formula = Formula::new(f);
        if let Some(v) = self.results.and_then(|m| m.get(&(self.sheet, r, c))) {
            formula = formula.set_result(v.clone());
        }
        self.ws
            .write_formula_with_format(r, c, formula, fmt)
            .expect("valid cell");
    }
}

struct Formats {
    title: Format,
    head: Format,
    bold: Format,
    money: Format,
    money_bold: Format,
    pct: Format,
    num: Format,
    date: Format,
    plain: Format,
    note: Format,
}

fn formats() -> Formats {
    let money = "#,##0.00";
    Formats {
        title: Format::new().set_bold().set_font_size(14),
        head: Format::new().set_bold().set_background_color("#DDE6F2"),
        bold: Format::new().set_bold(),
        money: Format::new().set_num_format(money),
        money_bold: Format::new().set_bold().set_num_format(money),
        pct: Format::new().set_num_format("0.00%"),
        num: Format::new().set_num_format("#,##0.00"),
        date: Format::new().set_num_format("dd.mm.yyyy"),
        plain: Format::new(),
        note: Format::new().set_italic().set_font_color("#666666"),
    }
}

fn build(id: &str, results: Option<&HashMap<Key, String>>) -> Result<Vec<u8>, String> {
    let f = formats();
    let mut wb = Workbook::new();
    let ws = wb.add_worksheet();
    if results.is_some() {
        // A formula whose result is empty ("") must stay empty, not show 0.
        ws.set_formula_result_default("");
    }
    let mut w = W { ws, sheet: 0, results };
    match id {
        "buget-lunar" => buget(&mut w, &f),
        "factura" => factura(&mut w, &f),
        "registru-casa" => registru(&mut w, &f),
        "cost-km" => cost_km(&mut w, &f),
        "rate-credit" => rate(&mut w, &f),
        _ => return Err(format!("șablonul „{id}” nu există")),
    }
    wb.save_to_buffer().map_err(|e| e.to_string())
}

fn buget(w: &mut W<'_>, f: &Formats) {
    w.ws.set_name("Buget").expect("valid name");
    w.ws.set_column_width(0, 26).expect("col");
    for c in 1..=4 {
        w.ws.set_column_width(c, 14).expect("col");
    }
    w.text(0, 0, "Buget lunar", &f.title);
    w.text(1, 0, NOTE, &f.note);
    for (c, h) in ["Categorie", "Planificat", "Realizat", "Diferență", "% realizat"]
        .iter()
        .enumerate()
    {
        w.text(3, c as u16, h, &f.head);
    }
    let block = |w: &mut W<'_>, start: u32, title: &str, rows: &[(&str, f64, f64)], total: &str| -> u32 {
        w.text(start, 0, title, &f.bold);
        let first = start + 1;
        for (i, (name, plan, real)) in rows.iter().enumerate() {
            let r = first + i as u32;
            w.text(r, 0, name, &f.plain);
            w.num(r, 1, *plan, &f.money);
            w.num(r, 2, *real, &f.money);
            w.formula(r, 3, &format!("=C{0}-B{0}", r + 1), &f.money);
            w.formula(r, 4, &format!("=IF(B{0}=0,\"\",C{0}/B{0})", r + 1), &f.pct);
        }
        let last = first + rows.len() as u32 - 1;
        let t = last + 1;
        w.text(t, 0, total, &f.bold);
        for (c, col) in [(1u16, 'B'), (2, 'C'), (3, 'D')] {
            w.formula(
                t,
                c,
                &format!("=SUM({col}{}:{col}{})", first + 1, last + 1),
                &f.money_bold,
            );
        }
        w.formula(t, 4, &format!("=IF(B{0}=0,\"\",C{0}/B{0})", t + 1), &f.pct);
        t
    };
    let tv = block(
        w,
        4,
        "Venituri",
        &[("Salarii", 8000.0, 8200.0), ("Alte venituri", 500.0, 300.0)],
        "Total venituri",
    );
    let tc = block(
        w,
        tv + 2,
        "Cheltuieli",
        &[
            ("Chirie / rată locuință", 2000.0, 2000.0),
            ("Utilități", 600.0, 650.0),
            ("Alimente", 1800.0, 1700.0),
            ("Transport", 500.0, 560.0),
            ("Altele", 700.0, 400.0),
        ],
        "Total cheltuieli",
    );
    let s = tc + 2;
    w.text(s, 0, "Sold (venituri − cheltuieli)", &f.bold);
    for (c, col) in [(1u16, 'B'), (2, 'C'), (3, 'D')] {
        w.formula(s, c, &format!("={col}{}-{col}{}", tv + 1, tc + 1), &f.money_bold);
    }
}

fn factura(w: &mut W<'_>, f: &Formats) {
    w.ws.set_name("Factură").expect("valid name");
    for (c, wd) in [
        (0u16, 6.0),
        (1, 34.0),
        (2, 8.0),
        (3, 10.0),
        (4, 14.0),
        (5, 14.0),
        (6, 12.0),
    ] {
        w.ws.set_column_width(c, wd).expect("col");
    }
    w.text(0, 0, "FACTURĂ", &f.title);
    w.text(1, 0, NOTE, &f.note);
    for (r, label, val) in [
        (3u32, "Furnizor:", "Denumire SRL, CUI RO…, adresă"),
        (4, "Client:", "Denumire client, CUI, adresă"),
        (5, "Număr:", "FCT-0001"),
        (6, "Data:", "zz.ll.aaaa"),
    ] {
        w.text(r, 0, label, &f.bold);
        w.text(r, 1, val, &f.plain);
    }
    w.text(7, 0, "Cota TVA:", &f.bold);
    w.num(7, 1, 0.21, &f.pct);
    for (c, h) in [
        "Nr.",
        "Denumire produs / serviciu",
        "U.M.",
        "Cantitate",
        "Preț unitar",
        "Valoare",
        "TVA",
    ]
    .iter()
    .enumerate()
    {
        w.text(9, c as u16, h, &f.head);
    }
    let lines: [(&str, &str, f64, f64); 3] = [
        ("Perdele bumbac", "buc", 12.0, 85.5),
        ("Montaj și transport", "serv", 1.0, 250.0),
        ("Șnur decorativ", "m", 40.0, 3.25),
    ];
    for i in 0..8u32 {
        let r = 10 + i;
        w.num(r, 0, f64::from(i + 1), &f.plain);
        if let Some((name, um, q, p)) = lines.get(i as usize) {
            w.text(r, 1, name, &f.plain);
            w.text(r, 2, um, &f.plain);
            w.num(r, 3, *q, &f.num);
            w.num(r, 4, *p, &f.money);
        }
        w.formula(r, 5, &format!("=ROUND(D{0}*E{0},2)", r + 1), &f.money);
        w.formula(r, 6, &format!("=ROUND(F{0}*$B$8,2)", r + 1), &f.money);
    }
    w.text(19, 4, "Total fără TVA", &f.bold);
    w.formula(19, 5, "=SUM(F11:F18)", &f.money_bold);
    w.text(20, 4, "TVA", &f.bold);
    w.formula(20, 5, "=SUM(G11:G18)", &f.money_bold);
    w.text(21, 4, "Total de plată", &f.bold);
    w.formula(21, 5, "=F20+F21", &f.money_bold);
}

fn registru(w: &mut W<'_>, f: &Formats) {
    w.ws.set_name("Registru").expect("valid name");
    for (c, wd) in [(0u16, 12.0), (1, 14.0), (2, 32.0), (3, 13.0), (4, 13.0), (5, 13.0)] {
        w.ws.set_column_width(c, wd).expect("col");
    }
    w.text(0, 0, "Registru de casă", &f.title);
    w.text(1, 0, NOTE, &f.note);
    w.text(2, 0, "Sold inițial", &f.bold);
    w.num(2, 3, 1000.0, &f.money);
    for (c, h) in ["Data", "Document", "Explicație", "Încasări", "Plăți", "Sold"]
        .iter()
        .enumerate()
    {
        w.text(3, c as u16, h, &f.head);
    }
    // 03.11.2026 = 46329 (serial date).
    let ops: [(f64, &str, &str, f64, f64); 6] = [
        (46329.0, "Chitanța 1", "Încasare client A", 500.0, 0.0),
        (46329.0, "Bon 23", "Rechizite", 0.0, 200.0),
        (46330.0, "Chitanța 2", "Încasare client B", 1200.0, 0.0),
        (46331.0, "Factura 88", "Plată furnizor", 0.0, 350.5),
        (46332.0, "Dispoziție 4", "Avans deplasare", 0.0, 100.0),
        (46333.0, "Chitanța 3", "Încasare client C", 75.25, 0.0),
    ];
    let first = 4u32;
    let last = first + 29;
    for i in 0..30u32 {
        let r = first + i;
        if let Some((d, doc, ex, inc, pl)) = ops.get(i as usize) {
            w.num(r, 0, *d, &f.date);
            w.text(r, 1, doc, &f.plain);
            w.text(r, 2, ex, &f.plain);
            if *inc > 0.0 {
                w.num(r, 3, *inc, &f.money);
            }
            if *pl > 0.0 {
                w.num(r, 4, *pl, &f.money);
            }
        }
        let prev = if i == 0 { "$D$3".to_string() } else { format!("F{}", r) };
        w.formula(r, 5, &format!("={prev}+D{0}-E{0}", r + 1), &f.money);
    }
    let t = last + 1;
    w.text(t, 2, "Total", &f.bold);
    w.formula(t, 3, &format!("=SUM(D{}:D{})", first + 1, last + 1), &f.money_bold);
    w.formula(t, 4, &format!("=SUM(E{}:E{})", first + 1, last + 1), &f.money_bold);
    w.text(t + 1, 2, "Sold final", &f.bold);
    w.formula(t + 1, 5, &format!("=F{}", last + 1), &f.money_bold);
    w.text(t + 2, 2, "Verificare (sold inițial + încasări − plăți)", &f.bold);
    w.formula(t + 2, 5, &format!("=D3+D{0}-E{0}", t + 1), &f.money_bold);
    w.formula(
        t + 3,
        5,
        &format!("=IF(ROUND(F{}-F{},2)=0,\"corect\",\"DIFERENȚĂ\")", t + 2, t + 3),
        &f.bold,
    );
}

fn cost_km(w: &mut W<'_>, f: &Formats) {
    w.ws.set_name("Cost km").expect("valid name");
    w.ws.set_column_width(0, 34).expect("col");
    w.ws.set_column_width(1, 14).expect("col");
    w.text(0, 0, "Cost pe kilometru", &f.title);
    w.text(1, 0, NOTE, &f.note);
    let inputs: [(&str, f64); 5] = [
        ("Distanță (km)", 450.0),
        ("Consum (litri la 100 km)", 7.5),
        ("Preț combustibil (lei/litru)", 7.2),
        ("Taxe de drum (lei)", 35.0),
        ("Alte costuri (lei)", 40.0),
    ];
    w.text(3, 0, "Date de intrare", &f.head);
    for (i, (label, v)) in inputs.iter().enumerate() {
        w.text(4 + i as u32, 0, label, &f.plain);
        w.num(4 + i as u32, 1, *v, &f.num);
    }
    w.text(10, 0, "Rezultate", &f.head);
    for (r, label, formula) in [
        (11u32, "Combustibil consumat (litri)", "=ROUND(B5*B6/100,2)"),
        (12, "Cost combustibil (lei)", "=ROUND(B12*B7,2)"),
        (13, "Cost total (lei)", "=B13+B8+B9"),
        (14, "Cost pe kilometru (lei/km)", "=IF(B5=0,\"\",ROUND(B14/B5,2))"),
    ] {
        w.text(r, 0, label, &f.bold);
        w.formula(r, 1, formula, &f.money_bold);
    }
}

pub const MAX_MONTHS: u32 = 360;

fn rate(w: &mut W<'_>, f: &Formats) {
    w.ws.set_name("Rate").expect("valid name");
    for (c, wd) in [(0u16, 26.0), (1, 14.0), (2, 14.0), (3, 14.0), (4, 14.0), (5, 14.0)] {
        w.ws.set_column_width(c, wd).expect("col");
    }
    w.text(0, 0, "Rate credit (rată constantă)", &f.title);
    w.text(1, 0, NOTE, &f.note);
    w.text(3, 0, "Suma împrumutată (lei)", &f.bold);
    w.num(3, 1, 50000.0, &f.money);
    w.text(4, 0, "Dobânda anuală", &f.bold);
    w.num(4, 1, 0.08, &f.pct);
    w.text(5, 0, "Număr de luni", &f.bold);
    w.num(5, 1, 60.0, &f.plain);
    w.text(7, 0, "Rata lunară (lei)", &f.bold);
    w.formula(7, 1, "=ROUND(PMT(B5/12,B6,-B4),2)", &f.money_bold);
    w.text(8, 0, "Total de plată (lei)", &f.bold);
    w.formula(8, 1, "=SUM(C13:C372)", &f.money_bold);
    w.text(9, 0, "Total dobândă (lei)", &f.bold);
    w.formula(9, 1, "=SUM(D13:D372)", &f.money_bold);
    for (c, h) in [
        "Luna",
        "Sold la început",
        "Rată",
        "Dobândă",
        "Principal",
        "Sold la final",
    ]
    .iter()
    .enumerate()
    {
        w.text(11, c as u16, h, &f.head);
    }
    // One row per possible month (up to 360); months after the term stay empty ("").
    for m in 1..=MAX_MONTHS {
        let r = 11 + m; // 0-based row; Excel row = r + 1
        let x = r + 1;
        w.formula(r, 0, &format!("=IF({m}<=$B$6,{m},\"\")"), &f.plain);
        let start = if m == 1 {
            "$B$4".to_string()
        } else {
            format!("F{}", x - 1)
        };
        w.formula(r, 1, &format!("=IF(A{x}=\"\",\"\",{start})"), &f.money);
        w.formula(r, 3, &format!("=IF(A{x}=\"\",\"\",ROUND(B{x}*$B$5/12,2))"), &f.money);
        // The last month repays exactly what is left (no rounding remainder).
        w.formula(
            r,
            4,
            &format!("=IF(A{x}=\"\",\"\",IF(A{x}=$B$6,B{x},$B$8-D{x}))"),
            &f.money,
        );
        w.formula(r, 2, &format!("=IF(A{x}=\"\",\"\",D{x}+E{x})"), &f.money);
        w.formula(r, 5, &format!("=IF(A{x}=\"\",\"\",ROUND(B{x}-E{x},2))"), &f.money);
    }
}

fn evaluate(bytes: &[u8]) -> Result<HashMap<Key, String>, String> {
    let wb = ironcalc::import::load_from_xlsx_bytes(bytes, "template", "en", "UTC").map_err(|e| format!("{e:?}"))?;
    let mut m = ironcalc::base::Model::from_workbook(wb, "en")?;
    m.evaluate();
    let mut out = HashMap::new();
    for c in m.get_all_cells() {
        if m.get_cell_formula(c.index, c.row, c.column).ok().flatten().is_none() {
            continue;
        }
        let v = match m.get_cell_value_by_index(c.index, c.row, c.column)? {
            V::Number(n) => format!("{n}"),
            V::Boolean(b) => (if b { "TRUE" } else { "FALSE" }).to_string(),
            V::String(s) => s,
            V::None => String::new(),
        };
        out.insert((c.index, (c.row - 1) as u32, (c.column - 1) as u16), v);
    }
    Ok(out)
}

/// The finished workbook of a template, with every formula's result stored.
pub fn workbook(id: &str) -> Result<Vec<u8>, String> {
    let draft = build(id, None)?;
    let results = evaluate(&draft)?;
    build(id, Some(&results))
}
