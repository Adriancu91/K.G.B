//! Audit and consistency (step 5.8).
//!
//! - **Verification:** everything the module shows is recomputed from the
//!   records and checked against the rules of the stage. Each check says
//!   what it looked at and lists every problem it finds (none are expected:
//!   the rules are enforced when writing; this proves it, and would show any
//!   damage done outside the app).
//! - **Journal:** every recorded operation, newest first, in one list.

use std::collections::{BTreeMap, BTreeSet};

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use serde_json::{Value, json};

use crate::cash::{ACCOUNTS, LINKS, PAYMENTS, SETTLEMENTS};
use crate::invoices::{INVOICES, SERIES, line_amounts};
use crate::num::{self, Money};
use crate::purchases::PURCHASES;
use crate::valuation;
use crate::{Business, DOCS, MOVES, i, s};

struct Check {
    name: &'static str,
    looked_at: usize,
    problems: Vec<String>,
}

impl Check {
    fn new(name: &'static str) -> Check {
        Check {
            name,
            looked_at: 0,
            problems: Vec::new(),
        }
    }
    fn json(&self) -> Value {
        json!({"verificare": self.name, "verificate": self.looked_at, "ok": self.problems.is_empty(), "probleme": self.problems.iter().take(20).collect::<Vec<_>>(), "numar_probleme": self.problems.len()})
    }
}

/// Every id that appears as `storno_de` more than once (reversed twice).
fn reversed_twice(records: &[kgb_store::RecordState]) -> Vec<String> {
    let mut count: BTreeMap<String, usize> = BTreeMap::new();
    for r in records {
        let x = s(r, "storno_de");
        if !x.is_empty() {
            *count.entry(x).or_default() += 1;
        }
    }
    count.into_iter().filter(|(_, n)| *n > 1).map(|(k, _)| k).collect()
}

impl Business {
    pub(crate) fn verify(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let docs = ctx.scan(DOCS, |_| true)?;
        let moves = ctx.scan(MOVES, |_| true)?;
        let invoices = ctx.scan(INVOICES, |_| true)?;
        let series = ctx.scan(SERIES, |_| true)?;
        let purchases = ctx.scan(PURCHASES, |_| true)?;
        let payments = ctx.scan(PAYMENTS, |_| true)?;
        let accounts = ctx.scan(ACCOUNTS, |_| true)?;
        let links = ctx.scan(LINKS, |_| true)?;
        let settlements = ctx.scan(SETTLEMENTS, |_| true)?;
        let mut checks = Vec::new();

        // 1. Stock: never below zero at any moment, value exactly 0 when empty.
        let mut c = Check::new("stocul nu e negativ în niciun moment, iar un stoc gol valorează 0");
        let mut ordered: Vec<_> = moves.iter().collect();
        ordered.sort_by_key(|m| m.id);
        let mut running: BTreeMap<(String, String), i64> = BTreeMap::new();
        for m in &ordered {
            c.looked_at += 1;
            let q = running.entry((s(m, "produs"), s(m, "depozit"))).or_default();
            *q += i(m, "cantitate");
            if *q < 0 {
                c.problems
                    .push(format!("mișcarea {} duce stocul la {}", m.id, num::fmt_qty(*q)));
            }
        }
        for ((p, w), pos) in valuation::replay(&moves).positions {
            if pos.qty == 0 && pos.value != 0 || pos.value < 0 {
                c.problems.push(format!(
                    "produsul {p} în depozitul {w}: cantitate {}, valoare {}",
                    num::fmt_qty(pos.qty),
                    num::fmt_money(pos.value)
                ));
            }
        }
        checks.push(c);

        // 2. Every movement belongs to a stock document; nothing reversed twice.
        let mut c = Check::new("fiecare mișcare aparține unui document; niciun document stornat de două ori");
        let doc_ids: BTreeSet<String> = docs.iter().map(|d| d.id.to_string()).collect();
        for m in &moves {
            c.looked_at += 1;
            if !doc_ids.contains(&s(m, "document")) {
                c.problems.push(format!("mișcarea {} nu are document", m.id));
            }
        }
        for x in reversed_twice(&docs) {
            c.problems
                .push(format!("documentul de stoc {x} e stornat de mai multe ori"));
        }
        checks.push(c);

        // 3. Invoices: every line recomputed; totals = sums of the lines.
        let mut c = Check::new("facturile: fiecare linie și totalurile, recalculate");
        for f in &invoices {
            c.looked_at += 1;
            let sign = if s(f, "storno_de").is_empty() { 1 } else { -1 };
            let (mut net, mut vat) = (0, 0);
            for l in f.fields.get("linii").and_then(Value::as_array).into_iter().flatten() {
                let q = l["cantitate"].as_i64().unwrap_or_default() * sign;
                let (v, t) = line_amounts(
                    q,
                    l["pret_unitar"].as_i64().unwrap_or_default(),
                    l["cota_tva"].as_i64().unwrap_or_default(),
                );
                if (v * sign, t * sign)
                    != (
                        l["valoare"].as_i64().unwrap_or_default(),
                        l["tva"].as_i64().unwrap_or_default(),
                    )
                {
                    c.problems.push(format!(
                        "factura {} {}: o linie nu se recalculează la fel",
                        s(f, "serie"),
                        i(f, "numar")
                    ));
                }
                net += l["valoare"].as_i64().unwrap_or_default();
                vat += l["tva"].as_i64().unwrap_or_default();
            }
            if (net, vat, net + vat) != (i(f, "total_fara_tva"), i(f, "total_tva"), i(f, "total")) {
                c.problems.push(format!(
                    "factura {} {}: totalurile nu sunt suma liniilor",
                    s(f, "serie"),
                    i(f, "numar")
                ));
            }
        }
        for x in reversed_twice(&invoices) {
            c.problems.push(format!("factura {x} e stornată de mai multe ori"));
        }
        checks.push(c);

        // 4. Numbering: per series, the used numbers are consecutive, without
        //    duplicates, and end just before the series' next number.
        let mut c = Check::new("numerotarea facturilor: fără goluri și fără dubluri");
        for sr in &series {
            c.looked_at += 1;
            let code = s(sr, "cod");
            let mut used: Vec<i64> = invoices
                .iter()
                .filter(|f| s(f, "serie") == code)
                .map(|f| i(f, "numar"))
                .collect();
            let receipts = payments.iter().filter_map(|p| {
                s(p, "numar")
                    .strip_prefix(&format!("Chitanța {code} "))
                    .and_then(|n| n.parse::<i64>().ok())
            });
            used.extend(receipts);
            used.sort_unstable();
            let next = i(sr, "urmator");
            if let Some(first) = used.first().copied() {
                let expect: Vec<i64> = (first..next).collect();
                if used != expect {
                    c.problems.push(format!(
                        "seria {code}: numerele folosite nu sunt consecutive (de la {first} la {})",
                        next - 1
                    ));
                }
            }
        }
        checks.push(c);

        // 5. Cash and bank: a cash register is never below zero at any moment.
        let mut c = Check::new("casa nu e pe minus în niciun moment");
        let cash: BTreeSet<String> = accounts
            .iter()
            .filter(|a| s(a, "tip") == "casa")
            .map(|a| a.id.to_string())
            .collect();
        let mut ordered: Vec<_> = payments.iter().collect();
        ordered.sort_by_key(|p| p.id);
        let mut bal: BTreeMap<String, Money> = BTreeMap::new();
        for p in ordered {
            c.looked_at += 1;
            let b = bal.entry(s(p, "cont")).or_default();
            *b += if s(p, "sens") == "incasare" {
                i(p, "suma")
            } else {
                -i(p, "suma")
            };
            if cash.contains(&s(p, "cont")) && *b < 0 {
                c.problems
                    .push(format!("după operația {}, casa are {}", p.id, num::fmt_money(*b)));
            }
        }
        for x in reversed_twice(&payments) {
            c.problems.push(format!("operația {x} e stornată de mai multe ori"));
        }
        checks.push(c);

        // 6. Links: one per payment; never more paid than a document's total.
        let mut c = Check::new("plățile legate de documente: o dată fiecare, niciodată peste total");
        let live_pay: BTreeMap<String, Money> = {
            let reversed: BTreeSet<String> = payments
                .iter()
                .map(|p| s(p, "storno_de"))
                .filter(|x| !x.is_empty())
                .collect();
            payments
                .iter()
                .filter(|p| s(p, "storno_de").is_empty() && !reversed.contains(&p.id.to_string()))
                .map(|p| (p.id.to_string(), i(p, "suma")))
                .collect()
        };
        let mut per_payment: BTreeMap<String, usize> = BTreeMap::new();
        let mut per_doc: BTreeMap<String, Money> = BTreeMap::new();
        for l in &links {
            c.looked_at += 1;
            *per_payment.entry(s(l, "plata")).or_default() += 1;
            *per_doc.entry(s(l, "document")).or_default() += live_pay.get(&s(l, "plata")).copied().unwrap_or(0);
        }
        for (p, n) in per_payment.iter().filter(|(_, n)| **n > 1) {
            c.problems.push(format!("plata {p} e legată de {n} documente"));
        }
        let totals: BTreeMap<String, Money> = invoices
            .iter()
            .map(|f| (f.id.to_string(), i(f, "total")))
            .chain(purchases.iter().map(|p| (p.id.to_string(), i(p, "total"))))
            .collect();
        for (d, paid) in &per_doc {
            if totals.get(d).is_some_and(|t| paid > t) {
                c.problems.push(format!(
                    "pe documentul {d} s-a plătit {} peste total",
                    num::fmt_money(paid - totals[d])
                ));
            }
        }
        checks.push(c);

        // 7. Expenses and settlements add up.
        let mut c = Check::new("cheltuielile (net + TVA = total) și deconturile (cheltuieli + restituit = avans)");
        for p in &purchases {
            c.looked_at += 1;
            if let (Some(n), Some(v)) = (
                p.fields.get("total_fara_tva").and_then(Value::as_i64),
                p.fields.get("tva").and_then(Value::as_i64),
            ) && n + v != i(p, "total")
            {
                c.problems
                    .push(format!("cheltuiala {}: net + TVA ≠ total", s(p, "numar")));
            }
        }
        for x in reversed_twice(&purchases) {
            c.problems.push(format!("cheltuiala {x} e stornată de mai multe ori"));
        }
        for st in &settlements {
            c.looked_at += 1;
            let adv = payments
                .iter()
                .find(|p| p.id.to_string() == s(st, "avans"))
                .map(|p| i(p, "suma"))
                .unwrap_or(-1);
            if i(st, "cheltuit") + i(st, "restituit") != adv {
                c.problems
                    .push(format!("decontul avansului {} nu dă suma avansului", s(st, "avans")));
            }
        }
        checks.push(c);

        let problems: usize = checks.iter().map(|c| c.problems.len()).sum();
        Ok(json!({"verificari": checks.iter().map(Check::json).collect::<Vec<_>>(), "probleme": problems}))
    }

    /// Every recorded operation, newest first.
    pub(crate) fn journal(&self, ctx: &mut ModuleContext<'_>, limit: usize) -> CoreResult<Value> {
        let mut out: Vec<(u64, Value)> = Vec::new();
        let tip = |t: &str| match t {
            "receptie" => "Recepție",
            "iesire" => "Ieșire",
            "transfer" => "Transfer",
            "inventar" => "Inventar",
            _ => "Storno stoc",
        };
        for d in ctx.scan(DOCS, |_| true)? {
            out.push((i(&d, "creat_ms") as u64, json!({"tip": tip(&s(&d, "tip")), "document": s(&d, "numar"), "data": s(&d, "data"), "suma": Value::Null})));
        }
        for f in ctx.scan(INVOICES, |_| true)? {
            let t = if s(&f, "storno_de").is_empty() {
                "Factură emisă"
            } else {
                "Factură de stornare"
            };
            out.push((i(&f, "creat_ms") as u64, json!({"tip": t, "document": format!("{} {} · {}", s(&f, "serie"), i(&f, "numar"), f.fields["client"]["nume"].as_str().unwrap_or_default()), "data": s(&f, "data"), "suma": num::fmt_money(i(&f, "total"))})));
        }
        for p in ctx.scan(PURCHASES, |_| true)? {
            let t = if s(&p, "storno_de").is_empty() {
                "Cheltuială"
            } else {
                "Storno cheltuială"
            };
            out.push((i(&p, "creat_ms") as u64, json!({"tip": t, "document": format!("{} {} · {}", crate::cash::kind_label(&s(&p, "tip")), s(&p, "numar"), s(&p, "furnizor_nume")), "data": s(&p, "data"), "suma": num::fmt_money(i(&p, "total"))})));
        }
        for p in ctx.scan(PAYMENTS, |_| true)? {
            let t = match (s(&p, "sens").as_str(), s(&p, "storno_de").is_empty()) {
                ("incasare", true) => "Încasare",
                ("plata", true) => "Plată",
                _ => "Storno operație",
            };
            let detail = [s(&p, "numar"), s(&p, "explicatie")]
                .into_iter()
                .filter(|x| !x.is_empty())
                .collect::<Vec<_>>()
                .join(" · ");
            out.push((
                i(&p, "creat_ms") as u64,
                json!({"tip": t, "document": detail, "data": s(&p, "data"), "suma": num::fmt_money(i(&p, "suma"))}),
            ));
        }
        out.sort_by(|a, b| b.0.cmp(&a.0));
        Ok(json!(
            out.into_iter()
                .take(limit)
                .map(|(ms, mut v)| {
                    v["creat_ms"] = json!(ms);
                    v
                })
                .collect::<Vec<_>>()
        ))
    }
}
