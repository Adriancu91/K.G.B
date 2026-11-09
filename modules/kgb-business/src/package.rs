//! The monthly package for the accountant (Etapa 7, step 7.4j; idea from
//! the owner's ERP, code written here): one ZIP with what the accountant asks
//! for every month — the issued invoices as PDF, the sales and purchase
//! journals, the money in and out, the due list at the end of the month and
//! the month's report — plus a note saying what is inside. It is a copy of
//! K.G.B.'s records, not a tax return.

use std::io::{Cursor, Write as _};

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::cash::{ACCOUNTS, LINKS, PAYMENTS};
use crate::invoices::INVOICES;
use crate::purchases::PURCHASES;
use crate::{Business, bad, i, num, s};

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct PackageArgs {
    /// AAAA-LL.
    luna: String,
    dest: String,
}

fn csv_cell(v: &str) -> String {
    if v.contains([';', '"', '\n', '\r']) {
        format!("\"{}\"", v.replace('"', "\"\""))
    } else {
        v.to_string()
    }
}

/// A Romanian-style CSV (`;`, UTF-8 with BOM, decimals with comma).
fn csv(head: &[&str], rows: &[Vec<String>]) -> Vec<u8> {
    let mut out = String::from("\u{FEFF}");
    out.push_str(&head.join(";"));
    out.push_str("\r\n");
    for r in rows {
        out.push_str(&r.iter().map(|c| csv_cell(c)).collect::<Vec<_>>().join(";"));
        out.push_str("\r\n");
    }
    out.into_bytes()
}

/// The last day of a month "AAAA-LL".
fn last_day(month: &str) -> Option<String> {
    let (y, m) = month.split_once('-')?;
    let (y, m): (i32, u32) = (y.parse().ok()?, m.parse().ok()?);
    if !(1..=12).contains(&m) || !(2000..=2100).contains(&y) {
        return None;
    }
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    let d = match m {
        2 if leap => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    };
    Some(format!("{y:04}-{m:02}-{d:02}"))
}

fn ro(iso: &str) -> String {
    iso.split('-').rev().collect::<Vec<_>>().join(".")
}

impl Business {
    /// Builds the package for `luna` and writes it to `dest`; returns what is inside.
    pub(crate) fn accountant_package(&self, ctx: &mut ModuleContext<'_>, a: PackageArgs) -> CoreResult<Value> {
        let to = last_day(&a.luna).ok_or_else(|| bad("luna", format!("„{}” nu e de forma AAAA-LL", a.luna)))?;
        let from = format!("{}-01", a.luna);
        let in_month = |d: &str| d >= from.as_str() && d <= to.as_str();
        let mut zip_buf = Vec::new();
        let mut z = zip::ZipWriter::new(Cursor::new(&mut zip_buf));
        let opt = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        let err = |e: zip::result::ZipError| bad("pachetul", e.to_string());
        let werr = |e: std::io::Error| bad("pachetul", e.to_string());

        // 1. Sales journal and the invoices as PDF.
        let mut invoices: Vec<_> = ctx.scan(INVOICES, |r| r.fields.get("data").and_then(Value::as_str).is_some_and(in_month))?;
        invoices.sort_by_key(|r| (s(r, "serie"), i(r, "numar")));
        let mut sales = Vec::new();
        for inv in &invoices {
            let nr = format!("{} {}", s(inv, "serie"), i(inv, "numar"));
            sales.push(vec![
                nr.clone(),
                ro(&s(inv, "data")),
                inv.fields["client"]["nume"].as_str().unwrap_or_default().to_string(),
                inv.fields["client"]["cui"].as_str().unwrap_or_default().to_string(),
                num::fmt_money(i(inv, "total_fara_tva")),
                num::fmt_money(i(inv, "total_tva")),
                num::fmt_money(i(inv, "total")),
                if s(inv, "storno_de").is_empty() { String::new() } else { "stornare".into() },
            ]);
            let pdf = self.invoice_pdf(ctx, inv.id)?;
            let file: String = nr.chars().map(|c| if c.is_alphanumeric() || c == '-' { c } else { '_' }).collect();
            z.start_file(format!("facturi-emise/Factura_{file}.pdf"), opt).map_err(err)?;
            z.write_all(&pdf).map_err(werr)?;
        }
        z.start_file("jurnal-vanzari.csv", opt).map_err(err)?;
        z.write_all(&csv(&["Factura", "Data", "Client", "CUI client", "Valoare fără TVA", "TVA", "Total", "Observații"], &sales)).map_err(werr)?;

        // 2. Purchase journal.
        let mut purchases: Vec<_> = ctx.scan(PURCHASES, |r| r.fields.get("data").and_then(Value::as_str).is_some_and(in_month))?;
        purchases.sort_by_key(|r| (s(r, "data"), s(r, "numar")));
        let buys: Vec<Vec<String>> = purchases
            .iter()
            .map(|p| {
                vec![
                    s(p, "numar"),
                    ro(&s(p, "data")),
                    s(p, "furnizor_nume"),
                    s(p, "furnizor_cui"),
                    s(p, "categorie"),
                    num::fmt_money(i(p, "total_fara_tva")),
                    num::fmt_money(i(p, "tva")),
                    num::fmt_money(i(p, "total")),
                    if s(p, "storno_de").is_empty() { String::new() } else { "stornare".into() },
                ]
            })
            .collect();
        z.start_file("jurnal-cumparari.csv", opt).map_err(err)?;
        z.write_all(&csv(&["Document", "Data", "Furnizor", "CUI furnizor", "Categorie", "Valoare fără TVA", "TVA", "Total", "Observații"], &buys)).map_err(werr)?;

        // 3. Money in and out, with what each payment is linked to.
        let accounts: std::collections::BTreeMap<String, String> = ctx.scan(ACCOUNTS, |_| true)?.iter().map(|a| (a.id.to_string(), s(a, "nume"))).collect();
        let links: std::collections::BTreeMap<String, String> = ctx.scan(LINKS, |_| true)?.iter().map(|l| (s(l, "plata"), s(l, "document"))).collect();
        let mut pays: Vec<_> = ctx.scan(PAYMENTS, |r| r.fields.get("data").and_then(Value::as_str).is_some_and(in_month))?;
        pays.sort_by_key(|p| (s(p, "data"), p.id));
        let mut money_rows = Vec::new();
        for p in &pays {
            let linked = match links.get(&p.id.to_string()) {
                Some(doc) => {
                    let id = Uuid::parse_str(doc).unwrap_or_default();
                    if let Some(f) = ctx.get(INVOICES, id)? {
                        format!("factura {} {}", s(&f, "serie"), i(&f, "numar"))
                    } else if let Some(c) = ctx.get(PURCHASES, id)? {
                        format!("{} {}", s(&c, "furnizor_nume"), s(&c, "numar"))
                    } else {
                        String::new()
                    }
                }
                None => String::new(),
            };
            money_rows.push(vec![
                ro(&s(p, "data")),
                accounts.get(&s(p, "cont")).cloned().unwrap_or_default(),
                if s(p, "sens") == "incasare" { "încasare".into() } else { "plată".into() },
                num::fmt_money(i(p, "suma")),
                s(p, "numar"),
                s(p, "explicatie"),
                linked,
                if s(p, "storno_de").is_empty() { String::new() } else { "stornare".into() },
            ]);
        }
        z.start_file("incasari-si-plati.csv", opt).map_err(err)?;
        z.write_all(&csv(&["Data", "Cont", "Sens", "Sumă", "Document", "Explicație", "Legată de", "Observații"], &money_rows)).map_err(werr)?;

        // 4. Due list at the end of the month.
        let aging = self.aging(ctx, &to)?;
        let due: Vec<Vec<String>> = aging["randuri"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|r| {
                vec![
                    if r["tip"] == "de_incasat" { "de încasat".into() } else { "de plătit".into() },
                    r["eticheta"].as_str().unwrap_or_default().to_string(),
                    r["partener"].as_str().unwrap_or_default().to_string(),
                    ro(r["scadenta"].as_str().unwrap_or_default()),
                    r["zile_intarziere"].to_string(),
                    r["rest_text"].as_str().unwrap_or_default().to_string(),
                ]
            })
            .collect();
        z.start_file("scadentar.csv", opt).map_err(err)?;
        z.write_all(&csv(&["Tip", "Document", "Partener", "Scadență", "Zile de întârziere", "Rest"], &due)).map_err(werr)?;

        // 5. The month's report (sales, expenses, VAT, by client and supplier).
        let report = self.report_export(ctx, &from, &to, "xlsx", None)?;
        z.start_file(format!("raport-{}.xlsx", a.luna), opt).map_err(err)?;
        z.write_all(&report).map_err(werr)?;

        // 6. What is inside.
        let note = format!(
            "Pachetul lunar pentru contabil — {luna}\r\nGenerat de K.G.B. din înregistrările firmei, pentru perioada {f} – {t}.\r\n\r\n\
             facturi-emise/       facturile emise în lună, PDF ({n_inv})\r\n\
             jurnal-vanzari.csv   facturile emise: număr, dată, client, CUI, valori\r\n\
             jurnal-cumparari.csv cheltuielile înregistrate: document, furnizor, CUI, valori ({n_buy})\r\n\
             incasari-si-plati.csv încasările și plățile din casă și bancă ({n_pay})\r\n\
             scadentar.csv        ce era de încasat și de plătit la {t}\r\n\
             raport-{luna}.xlsx    raportul lunii (vânzări, cheltuieli, TVA, pe clienți și furnizori)\r\n\r\n\
             Fișierele CSV folosesc „;” și virgula zecimală (Excel în română). Este o copie a înregistrărilor din K.G.B., nu o declarație fiscală; \
             verificarea și declarațiile rămân la contabil.\r\n",
            luna = a.luna,
            f = ro(&from),
            t = ro(&to),
            n_inv = invoices.len(),
            n_buy = purchases.len(),
            n_pay = pays.len(),
        );
        z.start_file("CITESTE.txt", opt).map_err(err)?;
        z.write_all(note.as_bytes()).map_err(werr)?;
        z.finish().map_err(err)?;
        ctx.export_bytes(std::path::Path::new(&a.dest), &zip_buf, true)?;
        ctx.log("pachet lunar pentru contabil");
        Ok(json!({"facturi": invoices.len(), "cheltuieli": purchases.len(), "plati": pays.len(), "scadente": due.len(), "octeti": zip_buf.len()}))
    }
}
