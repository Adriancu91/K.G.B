//! Due dates and partner statements (step 5.6).
//!
//! - **Aging:** every issued invoice still to be collected and every expense
//!   still to be paid, with the days past its due date, grouped as usual
//!   (not yet due, 1–30, 31–60, 61–90, over 90 days).
//! - **Partner statement:** for one partner, the documents and the money
//!   linked to them, in date order, with the running balance. Its final
//!   balance is the sum of what is left on each document — the same numbers
//!   as the aging, computed the same way.
//! - **Reminders:** an issued invoice due tomorrow or today (to collect) and
//!   an expense due tomorrow or today (to pay), once each.

use std::collections::BTreeMap;

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use kgb_core::notifications::{Level, Notice};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::cash::{LINKS, PAYMENTS, SETTLEMENTS};
use crate::invoices::{INVOICES, PARTNERS};
use crate::num::{self, Money};
use crate::purchases::PURCHASES;
use crate::{Business, bad, date, i, live, s};

pub const BUCKETS: [&str; 5] = [
    "neajunsă la scadență",
    "1–30 zile",
    "31–60 zile",
    "61–90 zile",
    "peste 90 de zile",
];

/// Days from `a` to `b` (both YYYY-MM-DD), without a date library.
pub fn days_between(a: &str, b: &str) -> Option<i64> {
    let days = |iso: &str| -> Option<i64> {
        let p: Vec<i64> = iso.split('-').map(|x| x.parse().ok()).collect::<Option<_>>()?;
        let [y, m, d] = p[..] else { return None };
        let (y, m) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
        let era = y.div_euclid(400);
        let yoe = y - era * 400;
        let doy = (153 * m + 2) / 5 + d - 1;
        Some(era * 146_097 + yoe * 365 + yoe / 4 - yoe / 100 + doy)
    };
    Some(days(b)? - days(a)?)
}

pub fn bucket(late: i64) -> usize {
    match late {
        i64::MIN..=0 => 0,
        1..=30 => 1,
        31..=60 => 2,
        61..=90 => 3,
        _ => 4,
    }
}

impl Business {
    pub(crate) fn aging(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<Value> {
        let today = date(today).ok_or_else(|| bad("ziua de azi", "nu este o dată"))?;
        let open = self.open_documents(ctx)?;
        let mut rows = Vec::new();
        let mut totals: BTreeMap<(&str, usize), Money> = BTreeMap::new();
        for d in open.as_array().into_iter().flatten() {
            let kind = if d["tip"] == "factura" {
                "de_incasat"
            } else {
                "de_platit"
            };
            // Without a due date, the document's date counts as due.
            let id: Uuid = d["id"]
                .as_str()
                .and_then(|x| x.parse().ok())
                .ok_or_else(|| bad("documentul", "referință stricată"))?;
            let rec = if kind == "de_incasat" {
                ctx.get(INVOICES, id)?
            } else {
                ctx.get(PURCHASES, id)?
            };
            let Some(rec) = rec else { continue };
            let due = rec
                .fields
                .get("scadenta")
                .and_then(Value::as_str)
                .map(String::from)
                .unwrap_or_else(|| s(&rec, "data"));
            let late = days_between(&due, &today).unwrap_or(0);
            let b = bucket(late);
            let left = d["rest"].as_i64().unwrap_or_default();
            *totals.entry((kind, b)).or_default() += left;
            rows.push(json!({
                "tip": kind, "id": id, "eticheta": d["eticheta"], "partener": d["partener"],
                "scadenta": due, "zile_intarziere": late.max(0), "interval": BUCKETS[b],
                "rest": left, "rest_text": num::fmt_money(left),
            }));
        }
        rows.sort_by(|a, b| b["zile_intarziere"].as_i64().cmp(&a["zile_intarziere"].as_i64()));
        let summary: Vec<Value> = ["de_incasat", "de_platit"]
            .iter()
            .map(|k| {
                let per: Vec<Value> = (0..BUCKETS.len())
                    .map(|b| {
                        let v = totals.get(&(*k, b)).copied().unwrap_or(0);
                        json!({"interval": BUCKETS[b], "suma": v, "suma_text": num::fmt_money(v)})
                    })
                    .collect();
                let all: Money = (0..BUCKETS.len())
                    .map(|b| totals.get(&(*k, b)).copied().unwrap_or(0))
                    .sum();
                json!({"tip": k, "intervale": per, "total": all, "total_text": num::fmt_money(all)})
            })
            .collect();
        Ok(json!({"randuri": rows, "rezumat": summary}))
    }

    /// One partner's statement: issued invoices (+, to collect), expenses
    /// (+, to pay) and the money linked to them (−), by date.
    pub(crate) fn partner_sheet(&self, ctx: &mut ModuleContext<'_>, id: Uuid) -> CoreResult<Value> {
        let p = live(ctx, PARTNERS, id, "partenerul")?;
        let key = json!(id.to_string());
        let mut entries: Vec<(String, String, String, Money, Money)> = Vec::new(); // (date, kind, label, to collect, to pay)
        let mut doc_ids = Vec::new();
        for f in ctx.scan(INVOICES, |r| r.fields.get("partener") == Some(&key))? {
            doc_ids.push((f.id, "factura"));
            entries.push((
                s(&f, "data"),
                "factura".into(),
                format!("Factura {} {}", s(&f, "serie"), i(&f, "numar")),
                i(&f, "total"),
                0,
            ));
        }
        for e in ctx.scan(PURCHASES, |r| r.fields.get("furnizor") == Some(&key))? {
            doc_ids.push((e.id, "cheltuiala"));
            entries.push((
                s(&e, "data"),
                "cheltuiala".into(),
                format!("{} {}", s(&e, "tip"), s(&e, "numar")),
                0,
                i(&e, "total"),
            ));
        }
        // Money linked to these documents (live and reversed payments alike:
        // a storno appears with the opposite sign, as on paper).
        let docs: BTreeMap<String, &str> = doc_ids.iter().map(|(d, k)| (d.to_string(), *k)).collect();
        let links: Vec<_> = ctx.scan(LINKS, |r| {
            r.fields
                .get("document")
                .and_then(Value::as_str)
                .is_some_and(|d| docs.contains_key(d))
        })?;
        for l in links {
            let Some(pay) = ctx.get(PAYMENTS, Uuid::parse_str(&s(&l, "plata")).unwrap_or_default())? else {
                continue;
            };
            let amount = i(&pay, "suma");
            let label = format!(
                "{} {}",
                if s(&pay, "sens") == "incasare" {
                    "Încasare"
                } else {
                    "Plată"
                },
                s(&pay, "numar")
            )
            .trim()
            .to_string();
            let mut stornos = vec![(pay.clone(), 1)];
            for st in ctx.scan(PAYMENTS, |r| {
                r.fields.get("storno_de") == Some(&json!(pay.id.to_string()))
            })? {
                stornos.push((st, -1));
            }
            for (pm, sign) in stornos {
                let (c, d) = if docs.get(&s(&l, "document")) == Some(&"factura") {
                    (-amount * sign, 0)
                } else {
                    (0, -amount * sign)
                };
                entries.push((
                    s(&pm, "data"),
                    "plata".into(),
                    if sign < 0 {
                        format!("Storno {label}")
                    } else {
                        label.clone()
                    },
                    c,
                    d,
                ));
            }
        }
        // Expenses paid from an advance (its settlement).
        for st in ctx.scan(SETTLEMENTS, |_| true)? {
            for e in st
                .fields
                .get("cheltuieli")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
            {
                let Some(eid) = e.as_str() else { continue };
                if docs.get(eid) == Some(&"cheltuiala") {
                    let total = ctx
                        .get(PURCHASES, Uuid::parse_str(eid).unwrap_or_default())?
                        .map_or(0, |r| i(&r, "total"));
                    entries.push((
                        s(&st, "data"),
                        "decont".into(),
                        "Plătită din avans (decont)".into(),
                        0,
                        -total,
                    ));
                }
            }
        }
        entries.sort_by(|a, b| a.0.cmp(&b.0));
        let (mut collect, mut pay) = (0, 0);
        let rows: Vec<Value> = entries
            .iter()
            .map(|(d, k, l, c, p)| {
                collect += c;
                pay += p;
                json!({"data": d, "tip": k, "document": l, "de_incasat": c, "de_platit": p,
                       "sold_incasat_text": num::fmt_money(collect), "sold_platit_text": num::fmt_money(pay)})
            })
            .collect();
        // The final balances, as left on each document (the aging's numbers).
        let mut left_collect = 0;
        let mut left_pay = 0;
        for (doc, kind) in &doc_ids {
            let total = if *kind == "factura" {
                ctx.get(INVOICES, *doc)?.map_or(0, |r| i(&r, "total"))
            } else {
                ctx.get(PURCHASES, *doc)?.map_or(0, |r| i(&r, "total"))
            };
            let left = total - self.paid_on(ctx, *doc)?;
            if *kind == "factura" {
                left_collect += left
            } else {
                left_pay += left
            }
        }
        Ok(json!({
            "partener": s(&p, "nume"), "randuri": rows,
            "de_incasat": left_collect, "de_incasat_text": num::fmt_money(left_collect),
            "de_platit": left_pay, "de_platit_text": num::fmt_money(left_pay),
        }))
    }

    pub(crate) fn due_reminders(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        let Some(today) = date(today) else { return Ok(()) };
        let open = self.open_documents(ctx)?;
        let mut sent = 0;
        for d in open.as_array().into_iter().flatten() {
            let Some(due) = d["scadenta"].as_str() else { continue };
            let Some(diff) = days_between(&today, due) else {
                continue;
            };
            let when = match diff {
                0 => "azi",
                1 => "mâine",
                _ => continue,
            };
            let collect = d["tip"] == "factura";
            let key = format!(
                "scadenta-{}:{}:{due}:{when}",
                d["tip"].as_str().unwrap_or_default(),
                d["id"].as_str().unwrap_or_default()
            );
            if sent >= 10 || ctx.notify_key_used(&key)? {
                continue;
            }
            let title = format!(
                "{} {when}: {}",
                if collect { "De încasat" } else { "De plătit" },
                d["eticheta"].as_str().unwrap_or_default()
            );
            ctx.notify(
                &Notice::new(
                    title,
                    format!("Rest: {} lei.", d["rest_text"].as_str().unwrap_or_default()),
                )
                .level(if when == "azi" { Level::Urgent } else { Level::Atentie })
                .key(key),
            )?;
            sent += 1;
        }
        Ok(())
    }
}
