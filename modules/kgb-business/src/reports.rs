//! Reports (step 5.7), rebuilt from the records every time:
//!
//! - **Sales:** issued invoices in the period (stornos included, with their
//!   negative amounts), per client and per product (other lines together).
//! - **Expenses:** received invoices and receipts in the period, per category
//!   and per supplier; when only the total is known, it counts as net.
//! - **Cost of goods sold:** the stock value that left the warehouses with
//!   the invoices of the period, at weighted average cost (D-050).
//! - **Simple profit:** net sales − cost of goods sold − net expenses. It is
//!   an indicator for the owner, not an accounting result (D-052).
//! - **Stock value** at the end of the period, from the movements up to that
//!   day.
//!
//! The export writes the same tables (XLSX with one sheet each, or one table
//! as CSV) through the spreadsheet module's converters, which read the file
//! back and compare it cell by cell.

use std::collections::BTreeMap;

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use kgb_sheets::book::{Book, Sheet};
use kgb_sheets::convert::{Cell, CsvStyle, table, to_csv, to_xlsx};
use serde_json::{Value, json};

use crate::invoices::INVOICES;
use crate::num::{self, Money, Qty};
use crate::purchases::PURCHASES;
use crate::valuation;
use crate::{Business, MOVES, PRODUCTS, bad, date, i, s};

#[derive(Default, Clone, Copy)]
struct Sums {
    net: Money,
    vat: Money,
    total: Money,
}

pub struct Report {
    pub de_la: String,
    pub pana_la: String,
    sales: Sums,
    by_client: BTreeMap<String, Sums>,
    /// product name → (quantity, net)
    by_product: BTreeMap<String, (Qty, Money)>,
    expenses: Sums,
    by_category: BTreeMap<String, Sums>,
    by_supplier: BTreeMap<String, Sums>,
    cogs: Money,
    stock: Vec<(String, String, Qty, Money)>,
    stock_value: Money,
}

impl Report {
    pub fn profit(&self) -> Money {
        self.sales.net - self.cogs - self.expenses.net
    }

    pub fn json(&self) -> Value {
        let m = num::fmt_money;
        let sums = |x: &Sums| json!({"net": x.net, "tva": x.vat, "total": x.total, "net_text": m(x.net), "tva_text": m(x.vat), "total_text": m(x.total)});
        let map = |b: &BTreeMap<String, Sums>| {
            b.iter()
                .map(|(k, v)| json!({"nume": k, "valori": sums(v)}))
                .collect::<Vec<_>>()
        };
        json!({
            "de_la": self.de_la, "pana_la": self.pana_la,
            "vanzari": sums(&self.sales), "pe_clienti": map(&self.by_client),
            "pe_produse": self.by_product.iter().map(|(k, (q, n))| json!({"nume": k, "cantitate_text": num::fmt_qty(*q), "net": n, "net_text": m(*n)})).collect::<Vec<_>>(),
            "cheltuieli": sums(&self.expenses), "pe_categorii": map(&self.by_category), "pe_furnizori": map(&self.by_supplier),
            "cost_marfuri": self.cogs, "cost_marfuri_text": m(self.cogs),
            "profit": self.profit(), "profit_text": m(self.profit()),
            "stoc_valoare": self.stock_value, "stoc_valoare_text": m(self.stock_value),
            "stoc": self.stock.iter().map(|(p, w, q, v)| json!({"produs": p, "depozit": w, "cantitate_text": num::fmt_qty(*q), "valoare_text": m(*v)})).collect::<Vec<_>>(),
        })
    }

    fn sums_table(name: &str, first: &str, rows: &BTreeMap<String, Sums>) -> Sheet {
        let money = |v: Money| Cell::Number(v as f64 / 100.0);
        let mut out = vec![vec![
            Cell::from(first),
            Cell::from("Fără TVA"),
            Cell::from("TVA"),
            Cell::from("Total"),
        ]];
        for (k, v) in rows {
            out.push(vec![Cell::from(k.as_str()), money(v.net), money(v.vat), money(v.total)]);
        }
        table(name, &out)
    }

    pub fn sheets(&self) -> Vec<Sheet> {
        let money = |v: Money| Cell::Number(v as f64 / 100.0);
        let summary = table(
            "Rezumat",
            &[
                vec![
                    Cell::from("Perioada"),
                    Cell::from(format!("{} – {}", ro(&self.de_la), ro(&self.pana_la))),
                ],
                vec![Cell::from("Vânzări fără TVA"), money(self.sales.net)],
                vec![Cell::from("Costul mărfurilor vândute"), money(self.cogs)],
                vec![Cell::from("Cheltuieli fără TVA"), money(self.expenses.net)],
                vec![
                    Cell::from("Rezultat simplu (nu este rezultat contabil)"),
                    money(self.profit()),
                ],
                vec![
                    Cell::from("Valoarea stocului la sfârșitul perioadei"),
                    money(self.stock_value),
                ],
            ],
        );
        let mut products = vec![vec![
            Cell::from("Produs / serviciu"),
            Cell::from("Cantitate"),
            Cell::from("Fără TVA"),
        ]];
        for (k, (q, n)) in &self.by_product {
            products.push(vec![
                Cell::from(k.as_str()),
                Cell::Number(*q as f64 / 1000.0),
                money(*n),
            ]);
        }
        let mut stock = vec![vec![
            Cell::from("Produs"),
            Cell::from("Depozit"),
            Cell::from("Cantitate"),
            Cell::from("Valoare"),
        ]];
        for (p, w, q, v) in &self.stock {
            stock.push(vec![
                Cell::from(p.as_str()),
                Cell::from(w.as_str()),
                Cell::Number(*q as f64 / 1000.0),
                money(*v),
            ]);
        }
        vec![
            summary,
            Self::sums_table("Vânzări pe clienți", "Client", &self.by_client),
            table("Vânzări pe produse", &products),
            Self::sums_table("Cheltuieli pe categorii", "Categorie", &self.by_category),
            Self::sums_table("Cheltuieli pe furnizori", "Furnizor", &self.by_supplier),
            table("Stoc", &stock),
        ]
    }
}

fn ro(iso: &str) -> String {
    iso.split('-').rev().collect::<Vec<_>>().join(".")
}

fn add(s: &mut Sums, net: Money, vat: Money, total: Money) {
    s.net += net;
    s.vat += vat;
    s.total += total;
}

impl Business {
    pub(crate) fn report(&self, ctx: &mut ModuleContext<'_>, from: &str, to: &str) -> CoreResult<Report> {
        let from = date(from).ok_or_else(|| bad("începutul perioadei", "nu este o dată"))?;
        let to = date(to).ok_or_else(|| bad("sfârșitul perioadei", "nu este o dată"))?;
        if from > to {
            return Err(bad("perioada", "începutul e după sfârșit"));
        }
        let within = |d: &str| d >= from.as_str() && d <= to.as_str();
        let mut r = Report {
            de_la: from.clone(),
            pana_la: to.clone(),
            sales: Sums::default(),
            by_client: BTreeMap::new(),
            by_product: BTreeMap::new(),
            expenses: Sums::default(),
            by_category: BTreeMap::new(),
            by_supplier: BTreeMap::new(),
            cogs: 0,
            stock: Vec::new(),
            stock_value: 0,
        };
        let all_moves = ctx.scan(MOVES, |_| true)?;
        let move_values = valuation::replay(&all_moves).moves;
        let mut stock_docs = std::collections::BTreeSet::new();
        for f in ctx.scan(INVOICES, |_| true)? {
            if !within(&s(&f, "data")) {
                continue;
            }
            let (net, vat, total) = (i(&f, "total_fara_tva"), i(&f, "total_tva"), i(&f, "total"));
            add(&mut r.sales, net, vat, total);
            add(
                r.by_client
                    .entry(f.fields["client"]["nume"].as_str().unwrap_or_default().to_string())
                    .or_default(),
                net,
                vat,
                total,
            );
            for l in f.fields.get("linii").and_then(Value::as_array).into_iter().flatten() {
                let name = if l["produs"].is_null() {
                    "Servicii și altele".to_string()
                } else {
                    l["descriere"].as_str().unwrap_or_default().to_string()
                };
                let e = r.by_product.entry(name).or_default();
                e.0 += l["cantitate"].as_i64().unwrap_or_default();
                e.1 += l["valoare"].as_i64().unwrap_or_default();
            }
            if let Some(d) = f.fields.get("document_stoc").and_then(Value::as_str) {
                stock_docs.insert(d.to_string());
            }
        }
        // Goods that left with the invoices (outflows are negative values).
        r.cogs = all_moves
            .iter()
            .filter(|m| stock_docs.contains(&s(m, "document")))
            .map(|m| -move_values.get(&m.id).copied().unwrap_or(0))
            .sum();
        for p in ctx.scan(PURCHASES, |_| true)? {
            if !within(&s(&p, "data")) {
                continue;
            }
            let total = i(&p, "total");
            let net = p.fields.get("total_fara_tva").and_then(Value::as_i64).unwrap_or(total);
            let vat = p.fields.get("tva").and_then(Value::as_i64).unwrap_or(0);
            add(&mut r.expenses, net, vat, total);
            let cat = p
                .fields
                .get("categorie")
                .and_then(Value::as_str)
                .unwrap_or("fără categorie")
                .to_string();
            add(r.by_category.entry(cat).or_default(), net, vat, total);
            add(
                r.by_supplier.entry(s(&p, "furnizor_nume")).or_default(),
                net,
                vat,
                total,
            );
        }
        // Stock at the end of the period: the movements up to that day.
        let until: Vec<_> = all_moves.iter().filter(|m| s(m, "data") <= to).cloned().collect();
        let positions = valuation::replay(&until).positions;
        let names: BTreeMap<String, String> = ctx
            .scan(PRODUCTS, |_| true)?
            .iter()
            .map(|p| (p.id.to_string(), s(p, "nume")))
            .collect();
        let whs: BTreeMap<String, String> = ctx
            .scan(crate::WAREHOUSES, |_| true)?
            .iter()
            .map(|w| (w.id.to_string(), s(w, "nume")))
            .collect();
        for ((p, w), pos) in positions {
            if pos.qty == 0 && pos.value == 0 {
                continue;
            }
            r.stock_value += pos.value;
            r.stock.push((
                names.get(&p).cloned().unwrap_or_default(),
                whs.get(&w).cloned().unwrap_or_default(),
                pos.qty,
                pos.value,
            ));
        }
        r.stock.sort();
        Ok(r)
    }

    pub(crate) fn report_export(
        &self,
        ctx: &mut ModuleContext<'_>,
        from: &str,
        to: &str,
        format: &str,
        which: Option<&str>,
    ) -> CoreResult<Vec<u8>> {
        let r = self.report(ctx, from, to)?;
        let sheets = r.sheets();
        match format {
            "xlsx" => Ok(to_xlsx(&Book { sheets }).map_err(|e| bad("exportul", e))?.bytes),
            "csv" => {
                let name = which.unwrap_or("Rezumat");
                let sheet = sheets
                    .into_iter()
                    .find(|s| s.name == name)
                    .ok_or_else(|| bad("exportul", format!("tabelul „{name}” nu există")))?;
                to_csv(&sheet, CsvStyle::Ro, true).map_err(|e| bad("exportul", e))
            }
            other => Err(bad("exportul", format!("formatul „{other}” nu există (xlsx, csv)"))),
        }
    }
}
