//! Matching payments to invoices (Etapa 7, step 7.4j; idea from the owner's
//! ERP, code written here). For every payment not yet linked (typically from
//! a bank statement), the open documents of the same direction are scored,
//! with the reasons written out: the amount, the invoice number in the
//! payment's details, the partner (chosen, CUI or name in the details). The
//! user confirms; the sure ones can be confirmed together, in one write.
//!
//! - A payment smaller than what is left by at most 1 leu is a match "with a
//!   difference", shown as such: the difference stays to be paid.
//! - A payment larger than what is left is never offered (it would overpay).
//! - Nothing is linked without a confirmation.

use std::collections::{BTreeMap, BTreeSet};

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::cash::{DocRef, LINKS, PAYMENTS};
use crate::invoices::PARTNERS;
use crate::{Business, bad, i, num, s};

/// Differences up to this (in bani) are "small" (1 leu).
pub const SMALL_DIFF: i64 = 100;
/// A suggestion is "sure" from this score, with no close second.
pub const SURE: i64 = 80;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Confirm {
    perechi: Vec<Pair>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Pair {
    plata: Uuid,
    document: DocRef,
}

fn fold(t: &str) -> String {
    t.to_lowercase()
        .chars()
        .map(|c| match c {
            'ă' | 'â' => 'a',
            'î' => 'i',
            'ș' | 'ş' => 's',
            'ț' | 'ţ' => 't',
            _ => c,
        })
        .collect()
}

fn digits(t: &str) -> String {
    t.chars().filter(char::is_ascii_digit).collect()
}

/// Whether `n` appears in `text` as a whole number (not inside a longer one).
fn has_number(text: &str, n: &str) -> bool {
    !n.is_empty()
        && text
            .split(|c: char| !c.is_ascii_digit())
            .any(|w| w.trim_start_matches('0') == n.trim_start_matches('0') && !w.is_empty())
}

impl Business {
    pub(crate) fn match_suggest(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let all = ctx.scan(PAYMENTS, |_| true)?;
        let reversed: BTreeSet<String> = all.iter().map(|p| s(p, "storno_de")).filter(|x| !x.is_empty()).collect();
        let linked: BTreeSet<String> = ctx.scan(LINKS, |_| true)?.iter().map(|l| s(l, "plata")).collect();
        let open = self.open_documents(ctx)?;
        let open = open.as_array().cloned().unwrap_or_default();
        // Partner details for matching by CUI and name.
        let partners: BTreeMap<String, (String, String)> = ctx
            .scan(PARTNERS, |_| true)?
            .iter()
            .map(|p| (p.id.to_string(), (digits(&s(p, "cui")), fold(&s(p, "nume")))))
            .collect();
        // The invoice/expense number of each open document.
        let mut numbers: BTreeMap<String, String> = BTreeMap::new();
        for d in &open {
            let id = d["id"].as_str().unwrap_or_default().to_string();
            let n = match d["tip"].as_str() {
                Some("factura") => ctx.get(crate::invoices::INVOICES, Uuid::parse_str(&id).unwrap_or_default())?.map(|r| i(&r, "numar").to_string()),
                _ => ctx.get(crate::purchases::PURCHASES, Uuid::parse_str(&id).unwrap_or_default())?.map(|r| digits(&s(&r, "numar"))),
            };
            numbers.insert(id, n.unwrap_or_default());
        }
        let mut out = Vec::new();
        for p in &all {
            let pid = p.id.to_string();
            if linked.contains(&pid) || reversed.contains(&pid) || !s(p, "storno_de").is_empty() || !s(p, "avans_persoana").is_empty() {
                continue;
            }
            let amount = i(p, "suma");
            let direction = s(p, "sens");
            let text = fold(&s(p, "explicatie"));
            let mut cands: Vec<(i64, Vec<String>, &Value)> = Vec::new();
            for d in &open {
                let want = if d["tip"] == "factura" { "incasare" } else { "plata" };
                if direction != want {
                    continue;
                }
                let rest = d["rest"].as_i64().unwrap_or(0);
                if amount > rest {
                    continue; // would overpay
                }
                let mut score = 0;
                let mut why = Vec::new();
                if amount == rest {
                    score += 50;
                    why.push("suma e exact restul de plată".to_string());
                } else if rest - amount <= SMALL_DIFF {
                    score += 35;
                    why.push(format!("diferență de {} lei, rămâne de plată", num::fmt_money(rest - amount)));
                } else {
                    score += 5;
                    why.push(format!("plată parțială: rămân {} lei", num::fmt_money(rest - amount)));
                }
                let id = d["id"].as_str().unwrap_or_default();
                if numbers.get(id).is_some_and(|n| has_number(&text, n)) {
                    score += 30;
                    why.push("numărul documentului apare în detaliile plății".into());
                }
                let partner = d["partener"].as_str().unwrap_or_default();
                if !partner.is_empty() && s(p, "partener") == partner {
                    score += 25;
                    why.push("același partener".into());
                } else if let Some((cui, name)) = partners.get(partner) {
                    if cui.len() >= 4 && digits(&s(p, "explicatie")).contains(cui.as_str()) {
                        score += 20;
                        why.push("CUI-ul partenerului apare în detalii".into());
                    }
                    let words: Vec<&str> = name.split(|c: char| !c.is_alphanumeric()).filter(|w| w.len() >= 4 && !["srl", "s.r.l", "pfa"].contains(w)).collect();
                    if !words.is_empty() && words.iter().any(|w| text.contains(w)) {
                        score += 15;
                        why.push("numele partenerului apare în detalii".into());
                    }
                }
                cands.push((score, why, d));
            }
            if cands.is_empty() {
                continue;
            }
            cands.sort_by_key(|c| std::cmp::Reverse(c.0));
            let best = cands[0].0;
            let second = cands.get(1).map_or(0, |c| c.0);
            let sure = best >= SURE && best - second >= 25;
            out.push(json!({
                "plata": {"id": p.id, "data": s(p, "data"), "suma": amount, "suma_text": num::fmt_money(amount), "sens": direction, "explicatie": s(p, "explicatie")},
                "sigur": sure,
                "candidati": cands.iter().take(3).map(|(sc, why, d)| json!({
                    "scor": sc, "motive": why, "document": {"tip": d["tip"], "id": d["id"]}, "eticheta": d["eticheta"], "rest_text": d["rest_text"],
                })).collect::<Vec<_>>(),
            }));
        }
        Ok(json!(out))
    }

    /// Links the confirmed pairs, all in one write (none if one is wrong).
    pub(crate) fn match_confirm(&self, ctx: &mut ModuleContext<'_>, a: Confirm) -> CoreResult<Value> {
        if a.perechi.is_empty() {
            return Err(bad("potrivirea", "nimic de confirmat"));
        }
        let mut seen = BTreeSet::new();
        let mut per_doc: BTreeMap<Uuid, i64> = BTreeMap::new();
        let mut writes = Vec::new();
        for pair in &a.perechi {
            if !seen.insert(pair.plata) {
                return Err(bad("potrivirea", "o plată apare de două ori"));
            }
            let p = crate::live(ctx, PAYMENTS, pair.plata, "plata")?;
            if !s(&p, "storno_de").is_empty() || !s(&p, "avans_persoana").is_empty() {
                return Err(bad("plata", "un storno sau un avans nu se leagă de documente"));
            }
            // Two payments for the same document in one batch must fit together.
            let before = *per_doc.get(&pair.document.id).unwrap_or(&0);
            let amount = i(&p, "suma");
            let (total, _, label) = self.doc_amount(ctx, &pair.document)?;
            let left = total - self.paid_on(ctx, pair.document.id)? - before;
            if amount > left {
                return Err(bad("potrivirea", format!("pe {label} mai sunt de achitat {} lei", num::fmt_money(left))));
            }
            per_doc.insert(pair.document.id, before + amount);
            writes.push(self.link_write(ctx, p.id, amount, &s(&p, "sens"), &pair.document)?);
        }
        let n = writes.len();
        ctx.write(writes)?;
        ctx.log("plăți potrivite cu documente");
        Ok(json!({"legate": n}))
    }
}
