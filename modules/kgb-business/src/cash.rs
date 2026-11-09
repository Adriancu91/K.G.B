//! Cash and bank (step 5.5).
//!
//! - **Accounts:** cash registers and bank accounts. A balance is the sum of
//!   its payments, never a stored number.
//! - **Payments** (money in or out) are written once (D-051); a mistake is
//!   cancelled by a storno payment, visible.
//! - **A cash register never goes below zero:** a payment out of cash that
//!   would do it is refused.
//! - **Receipts (chitanțe):** money into cash can get a receipt number from a
//!   series, allocated in the same atomic write (no gaps, D-054).
//! - **Links:** a payment is linked to one document (an issued invoice, an
//!   expense or an advance) once, for at most what is still unpaid. Links
//!   are records of their own, so bank lines imported first can be matched
//!   later without changing the payment.
//! - **Bank statements:** a CSV with date, description and amounts (debit /
//!   credit columns or one signed amount) is imported into a bank account;
//!   lines already imported are skipped.
//! - **Advances and settlements:** an advance is money out of cash to a
//!   person; its settlement lists the expenses paid from it and the cash
//!   returned, and must add up to the advance exactly.

use std::collections::{BTreeMap, BTreeSet};

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use kgb_core::workspace::now_ms;
use kgb_sheets::book::{self, Format};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::invoices::{INVOICES, PARTNERS, SERIES};
use crate::num::{self, Money};
use crate::purchases::PURCHASES;
use crate::{Business, bad, date, i, live, s, text};

pub(crate) const ACCOUNTS: &str = "conturi";
pub(crate) const PAYMENTS: &str = "plati";
pub(crate) const LINKS: &str = "potriviri";
pub(crate) const SETTLEMENTS: &str = "deconturi";

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct AccountSave {
    tip: String,
    nume: String,
    #[serde(default)]
    iban: Option<String>,
}

#[derive(Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub(crate) struct DocRef {
    /// `factura` (issued invoice), `cheltuiala` (expense) or `avans`.
    pub(crate) tip: String,
    pub(crate) id: Uuid,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct PaymentSave {
    cont: Uuid,
    data: String,
    /// `incasare` (in) or `plata` (out).
    sens: String,
    suma: String,
    #[serde(default)]
    partener: Option<Uuid>,
    #[serde(default)]
    document: Option<DocRef>,
    /// An advance to a person (money out of cash, settled later).
    #[serde(default)]
    avans_persoana: Option<String>,
    #[serde(default)]
    numar: Option<String>,
    #[serde(default)]
    explicatie: Option<String>,
    /// Receipts: the series that numbers the receipt.
    #[serde(default)]
    chitanta_serie: Option<Uuid>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct PaymentLink {
    plata: Uuid,
    document: DocRef,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct PaymentStorno {
    id: Uuid,
    data: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Settlement {
    avans: Uuid,
    data: String,
    /// Expenses paid from the advance.
    #[serde(default)]
    cheltuieli: Vec<Uuid>,
    /// Cash returned, as typed (`0` when everything was spent).
    restituit: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct BankImport {
    cont: Uuid,
    name: String,
    data: String,
}

/// „Factură”, „Bon fiscal”, „Alt document”.
pub(crate) fn kind_label(tip: &str) -> &'static str {
    crate::purchases::KINDS
        .iter()
        .find(|(k, _)| *k == tip)
        .map_or("Document", |(_, l)| l)
}

impl Business {
    /// Live (not reversed) payments.
    fn live_payments(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Vec<RecordState>> {
        let all = ctx.scan(PAYMENTS, |_| true)?;
        let reversed: BTreeSet<String> = all
            .iter()
            .map(|p| s(p, "storno_de"))
            .filter(|x| !x.is_empty())
            .collect();
        Ok(all
            .into_iter()
            .filter(|p| s(p, "storno_de").is_empty() && !reversed.contains(&p.id.to_string()))
            .collect())
    }

    /// Balance of every account (bani).
    pub(crate) fn account_balances(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<BTreeMap<String, Money>> {
        let mut out = BTreeMap::new();
        for p in ctx.scan(PAYMENTS, |_| true)? {
            let signed = if s(&p, "sens") == "incasare" {
                i(&p, "suma")
            } else {
                -i(&p, "suma")
            };
            *out.entry(s(&p, "cont")).or_default() += signed;
        }
        Ok(out)
    }

    /// Paid so far on a document (through links of live payments, and for
    /// expenses also through settled advances).
    pub(crate) fn paid_on(&self, ctx: &mut ModuleContext<'_>, doc: Uuid) -> CoreResult<Money> {
        let live: BTreeMap<String, Money> = self
            .live_payments(ctx)?
            .iter()
            .map(|p| (p.id.to_string(), i(p, "suma")))
            .collect();
        let key = json!(doc.to_string());
        let mut paid: Money = ctx
            .scan(LINKS, |r| r.fields.get("document") == Some(&key))?
            .iter()
            .filter_map(|l| live.get(&s(l, "plata")).copied())
            .sum();
        for st in ctx.scan(SETTLEMENTS, |_| true)? {
            if st
                .fields
                .get("cheltuieli")
                .and_then(Value::as_array)
                .is_some_and(|a| a.contains(&key))
            {
                paid += ctx.get(PURCHASES, doc)?.map_or(0, |p| i(&p, "total"));
            }
        }
        Ok(paid)
    }

    /// What a document is worth, and which direction pays it.
    pub(crate) fn doc_amount(&self, ctx: &mut ModuleContext<'_>, d: &DocRef) -> CoreResult<(Money, &'static str, String)> {
        match d.tip.as_str() {
            "factura" => {
                let f = live(ctx, INVOICES, d.id, "factura")?;
                if f.fields.get("storno_de").is_some_and(|v| !v.is_null()) {
                    return Err(bad("factura", "o factură de stornare nu se încasează"));
                }
                Ok((
                    i(&f, "total"),
                    "incasare",
                    format!("factura {} {}", s(&f, "serie"), i(&f, "numar")),
                ))
            }
            "cheltuiala" => {
                let p = live(ctx, PURCHASES, d.id, "cheltuiala")?;
                if p.fields.get("storno_de").is_some_and(|v| !v.is_null()) {
                    return Err(bad("cheltuiala", "un storno nu se plătește"));
                }
                Ok((
                    i(&p, "total"),
                    "plata",
                    format!("{} {}", kind_label(&s(&p, "tip")), s(&p, "numar")),
                ))
            }
            other => Err(bad(
                "documentul",
                format!("tipul „{other}” nu se leagă de o plată (factura, cheltuiala)"),
            )),
        }
    }

    pub(crate) fn link_write(
        &self,
        ctx: &mut ModuleContext<'_>,
        payment: Uuid,
        amount: Money,
        sens: &str,
        d: &DocRef,
    ) -> CoreResult<Write> {
        let (total, direction, label) = self.doc_amount(ctx, d)?;
        if sens != direction {
            return Err(bad(
                "legătura",
                format!(
                    "{label} se leagă de o {}",
                    if direction == "incasare" { "încasare" } else { "plată" }
                ),
            ));
        }
        let left = total - self.paid_on(ctx, d.id)?;
        if amount > left {
            return Err(bad(
                "legătura",
                format!(
                    "pe {label} mai sunt de achitat {} lei; suma e {} lei",
                    num::fmt_money(left),
                    num::fmt_money(amount)
                ),
            ));
        }
        let key = json!(payment.to_string());
        if !ctx.scan(LINKS, |r| r.fields.get("plata") == Some(&key))?.is_empty() {
            return Err(bad("legătura", "plata este deja legată de un document"));
        }
        let mut f = Fields::new();
        f.insert("plata".into(), key);
        f.insert("document".into(), json!(d.id.to_string()));
        f.insert("tip_document".into(), json!(d.tip));
        f.insert("creat_ms".into(), json!(now_ms()));
        Ok(Write::put(LINKS, Uuid::now_v7(), f).expect(0))
    }

    pub(crate) fn account_save(&self, ctx: &mut ModuleContext<'_>, a: AccountSave) -> CoreResult<Value> {
        if !["casa", "banca"].contains(&a.tip.as_str()) {
            return Err(bad("tipul contului", "este „casa” sau „banca”"));
        }
        let mut f = Fields::new();
        f.insert("tip".into(), json!(a.tip));
        f.insert("nume".into(), text(Some(a.nume), "numele contului", 100, true)?);
        f.insert("iban".into(), text(a.iban, "IBAN-ul", 40, false)?);
        f.insert("creat_ms".into(), json!(now_ms()));
        let id = Uuid::now_v7();
        ctx.write(vec![Write::put(ACCOUNTS, id, f).expect(0)])?;
        Ok(json!({"id": id}))
    }

    pub(crate) fn accounts(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let balances = self.account_balances(ctx)?;
        let mut list = ctx.scan(ACCOUNTS, |_| true)?;
        list.sort_by_key(|r| (s(r, "tip"), s(r, "nume").to_lowercase()));
        Ok(json!(
            list.iter()
                .map(|r| {
                    let b = balances.get(&r.id.to_string()).copied().unwrap_or(0);
                    let mut v = Value::Object(r.fields.clone());
                    v["id"] = json!(r.id);
                    v["sold"] = json!(b);
                    v["sold_text"] = json!(num::fmt_money(b));
                    v
                })
                .collect::<Vec<_>>()
        ))
    }

    pub(crate) fn payment_save(&self, ctx: &mut ModuleContext<'_>, a: PaymentSave) -> CoreResult<Value> {
        let acc = live(ctx, ACCOUNTS, a.cont, "contul")?;
        if !["incasare", "plata"].contains(&a.sens.as_str()) {
            return Err(bad("sensul", "este „incasare” sau „plata”"));
        }
        let data = date(&a.data).ok_or_else(|| bad("data", format!("„{}” nu este o dată", a.data)))?;
        let amount = num::money(&a.suma)
            .filter(|m| *m > 0)
            .ok_or_else(|| bad("suma", format!("„{}” nu este o sumă pozitivă", a.suma)))?;
        let cash = s(&acc, "tip") == "casa";
        if cash && a.sens == "plata" {
            let have = self
                .account_balances(ctx)?
                .get(&a.cont.to_string())
                .copied()
                .unwrap_or(0);
            if amount > have {
                return Err(bad(
                    "plata",
                    format!(
                        "în „{}” sunt {} lei; casa nu poate avea sold negativ",
                        s(&acc, "nume"),
                        num::fmt_money(have)
                    ),
                ));
            }
        }
        let advance = a.avans_persoana.as_deref().map(str::trim).filter(|x| !x.is_empty());
        if advance.is_some() && (!cash || a.sens != "plata" || a.document.is_some()) {
            return Err(bad("avansul", "se dă din casă, ca plată, fără alt document legat"));
        }
        let partner = match a.partener {
            Some(p) => Some(live(ctx, PARTNERS, p, "partenerul")?),
            None => None,
        };
        let id = Uuid::now_v7();
        let mut batch = Vec::new();
        let mut numar = text(a.numar, "numărul documentului", 60, false)?;
        if let Some(sid) = a.chitanta_serie {
            if !(cash && a.sens == "incasare") {
                return Err(bad("chitanța", "se emite doar pentru încasări în casă"));
            }
            let series = live(ctx, SERIES, sid, "seria chitanțelor")?;
            let n = i(&series, "urmator");
            numar = json!(format!("Chitanța {} {n}", s(&series, "cod")));
            let mut sf = series.fields.clone();
            sf.insert("urmator".into(), json!(n + 1));
            batch.push(Write::put(SERIES, series.id, sf).expect(series.version));
        }
        if let Some(d) = &a.document {
            batch.push(self.link_write(ctx, id, amount, &a.sens, d)?);
        }
        let mut f = Fields::new();
        f.insert("cont".into(), json!(a.cont.to_string()));
        f.insert("data".into(), json!(data));
        f.insert("sens".into(), json!(a.sens));
        f.insert("suma".into(), json!(amount));
        f.insert(
            "partener".into(),
            partner.as_ref().map_or(Value::Null, |p| json!(p.id.to_string())),
        );
        f.insert(
            "partener_nume".into(),
            partner.as_ref().map_or(Value::Null, |p| json!(s(p, "nume"))),
        );
        f.insert(
            "avans_persoana".into(),
            advance.map_or(Value::Null, |p| json!(p.chars().take(100).collect::<String>())),
        );
        f.insert("numar".into(), numar.clone());
        f.insert("explicatie".into(), text(a.explicatie, "explicația", 300, false)?);
        f.insert("sursa".into(), json!("manual"));
        f.insert("cheie_extras".into(), Value::Null);
        f.insert("storno_de".into(), Value::Null);
        f.insert("creat_ms".into(), json!(now_ms()));
        batch.push(Write::put(PAYMENTS, id, f).expect(0));
        ctx.write(batch)?;
        Ok(json!({"id": id, "numar": numar}))
    }

    pub(crate) fn payment_link(&self, ctx: &mut ModuleContext<'_>, a: PaymentLink) -> CoreResult<Value> {
        let p = live(ctx, PAYMENTS, a.plata, "plata")?;
        if !s(&p, "storno_de").is_empty() || !s(&p, "avans_persoana").is_empty() {
            return Err(bad("plata", "un storno sau un avans nu se leagă de documente"));
        }
        let w = self.link_write(ctx, p.id, i(&p, "suma"), &s(&p, "sens"), &a.document)?;
        ctx.write(vec![w])?;
        Ok(json!({"plata": p.id}))
    }

    pub(crate) fn payment_storno(&self, ctx: &mut ModuleContext<'_>, a: PaymentStorno) -> CoreResult<Value> {
        let p = live(ctx, PAYMENTS, a.id, "plata")?;
        if !s(&p, "storno_de").is_empty() {
            return Err(bad("plata", "un storno nu se stornează"));
        }
        let idv = json!(a.id.to_string());
        if !ctx
            .scan(PAYMENTS, |r| r.fields.get("storno_de") == Some(&idv))?
            .is_empty()
        {
            return Err(bad("plata", "a fost deja stornată"));
        }
        if !s(&p, "avans_persoana").is_empty()
            && !ctx
                .scan(SETTLEMENTS, |r| r.fields.get("avans") == Some(&idv))?
                .is_empty()
        {
            return Err(bad("avansul", "are deja decont; nu se mai stornează"));
        }
        let data = date(&a.data).ok_or_else(|| bad("data", format!("„{}” nu este o dată", a.data)))?;
        // Reversing money that came in cannot take a cash register below zero.
        let acc = live(
            ctx,
            ACCOUNTS,
            Uuid::parse_str(&s(&p, "cont")).map_err(|_| bad("contul", "referință stricată"))?,
            "contul",
        )?;
        if s(&acc, "tip") == "casa" && s(&p, "sens") == "incasare" {
            let have = self
                .account_balances(ctx)?
                .get(&acc.id.to_string())
                .copied()
                .unwrap_or(0);
            if i(&p, "suma") > have {
                return Err(bad("stornoul", "casa ar ajunge la sold negativ"));
            }
        }
        let mut f = p.fields.clone();
        f.insert(
            "sens".into(),
            json!(if s(&p, "sens") == "incasare" {
                "plata"
            } else {
                "incasare"
            }),
        );
        f.insert("data".into(), json!(data));
        f.insert("storno_de".into(), idv);
        f.insert("cheie_extras".into(), Value::Null);
        f.insert(
            "numar".into(),
            json!(
                format!("Storno {}", s(&p, "numar"))
                    .trim()
                    .chars()
                    .take(60)
                    .collect::<String>()
            ),
        );
        f.insert("creat_ms".into(), json!(now_ms()));
        let id = Uuid::now_v7();
        ctx.write(vec![Write::put(PAYMENTS, id, f).expect(0)])?;
        Ok(json!({"id": id}))
    }

    pub(crate) fn payments(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let all = ctx.scan(PAYMENTS, |_| true)?;
        let reversed: BTreeSet<String> = all
            .iter()
            .map(|p| s(p, "storno_de"))
            .filter(|x| !x.is_empty())
            .collect();
        let links: BTreeMap<String, String> = ctx
            .scan(LINKS, |_| true)?
            .iter()
            .map(|l| (s(l, "plata"), format!("{}:{}", s(l, "tip_document"), s(l, "document"))))
            .collect();
        let settled: BTreeSet<String> = ctx.scan(SETTLEMENTS, |_| true)?.iter().map(|d| s(d, "avans")).collect();
        let mut list: Vec<Value> = all
            .iter()
            .map(|p| {
                let mut v = Value::Object(p.fields.clone());
                v["id"] = json!(p.id);
                v["suma_text"] = json!(num::fmt_money(i(p, "suma")));
                v["stornata"] = json!(reversed.contains(&p.id.to_string()));
                v["legata_de"] = links.get(&p.id.to_string()).map_or(Value::Null, |x| json!(x));
                v["decontat"] = json!(settled.contains(&p.id.to_string()));
                v
            })
            .collect();
        list.sort_by(|a, b| b["id"].as_str().cmp(&a["id"].as_str()));
        Ok(json!(list))
    }

    /// Unpaid issued invoices and expenses, with what is left (for linking).
    pub(crate) fn open_documents(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let mut out = Vec::new();
        for f in ctx.scan(INVOICES, |r| r.fields.get("storno_de").is_none_or(Value::is_null))? {
            let idv = json!(f.id.to_string());
            if !ctx
                .scan(INVOICES, |r| r.fields.get("storno_de") == Some(&idv))?
                .is_empty()
            {
                continue;
            }
            let left = i(&f, "total") - self.paid_on(ctx, f.id)?;
            if left > 0 {
                out.push(json!({"tip": "factura", "id": f.id, "eticheta": format!("Factura {} {} · {}", s(&f, "serie"), i(&f, "numar"), f.fields["client"]["nume"].as_str().unwrap_or_default()), "rest": left, "rest_text": num::fmt_money(left), "scadenta": f.fields.get("scadenta").cloned().unwrap_or(Value::Null), "partener": s(&f, "partener")}));
            }
        }
        for p in ctx.scan(PURCHASES, |r| r.fields.get("storno_de").is_none_or(Value::is_null))? {
            let idv = json!(p.id.to_string());
            if !ctx
                .scan(PURCHASES, |r| r.fields.get("storno_de") == Some(&idv))?
                .is_empty()
            {
                continue;
            }
            let left = i(&p, "total") - self.paid_on(ctx, p.id)?;
            if left > 0 {
                out.push(json!({"tip": "cheltuiala", "id": p.id, "eticheta": format!("{} {} · {}", kind_label(&s(&p, "tip")), s(&p, "numar"), s(&p, "furnizor_nume")), "rest": left, "rest_text": num::fmt_money(left), "scadenta": p.fields.get("scadenta").cloned().unwrap_or(Value::Null), "partener": s(&p, "furnizor")}));
            }
        }
        Ok(json!(out))
    }

    /// Settles an advance: the expenses paid from it plus the cash returned
    /// must be exactly the advance. The returned cash comes back into the
    /// same cash register, in the same atomic write.
    pub(crate) fn settle(&self, ctx: &mut ModuleContext<'_>, a: Settlement) -> CoreResult<Value> {
        let adv = live(ctx, PAYMENTS, a.avans, "avansul")?;
        if s(&adv, "avans_persoana").is_empty() {
            return Err(bad("avansul", "plata aleasă nu este un avans"));
        }
        let idv = json!(a.avans.to_string());
        if !ctx
            .scan(SETTLEMENTS, |r| r.fields.get("avans") == Some(&idv))?
            .is_empty()
        {
            return Err(bad("avansul", "are deja decont"));
        }
        if !ctx
            .scan(PAYMENTS, |r| r.fields.get("storno_de") == Some(&idv))?
            .is_empty()
        {
            return Err(bad("avansul", "a fost stornat"));
        }
        let data = date(&a.data).ok_or_else(|| bad("data", format!("„{}” nu este o dată", a.data)))?;
        let back = num::money(&a.restituit)
            .filter(|m| *m >= 0)
            .ok_or_else(|| bad("suma restituită", format!("„{}” nu este o sumă", a.restituit)))?;
        let mut spent = 0;
        let mut seen = BTreeSet::new();
        for e in &a.cheltuieli {
            if !seen.insert(*e) {
                return Err(bad("decontul", "o cheltuială apare de două ori"));
            }
            let d = DocRef {
                tip: "cheltuiala".into(),
                id: *e,
            };
            let (total, _, label) = self.doc_amount(ctx, &d)?;
            if self.paid_on(ctx, *e)? > 0 {
                return Err(bad("decontul", format!("{label} este deja plătită")));
            }
            spent += total;
        }
        let advance = i(&adv, "suma");
        if spent + back != advance {
            return Err(bad(
                "decontul",
                format!(
                    "cheltuielile ({} lei) + restituit ({} lei) trebuie să fie egale cu avansul ({} lei)",
                    num::fmt_money(spent),
                    num::fmt_money(back),
                    num::fmt_money(advance)
                ),
            ));
        }
        let now = now_ms();
        let mut batch = Vec::new();
        let mut f = Fields::new();
        f.insert("avans".into(), idv);
        f.insert("data".into(), json!(data));
        f.insert(
            "cheltuieli".into(),
            json!(a.cheltuieli.iter().map(|x| x.to_string()).collect::<Vec<_>>()),
        );
        f.insert("cheltuit".into(), json!(spent));
        f.insert("restituit".into(), json!(back));
        f.insert("creat_ms".into(), json!(now));
        batch.push(Write::put(SETTLEMENTS, Uuid::now_v7(), f).expect(0));
        if back > 0 {
            let mut p = Fields::new();
            p.insert("cont".into(), adv.fields["cont"].clone());
            p.insert("data".into(), json!(data));
            p.insert("sens".into(), json!("incasare"));
            p.insert("suma".into(), json!(back));
            p.insert("partener".into(), Value::Null);
            p.insert("partener_nume".into(), Value::Null);
            p.insert("avans_persoana".into(), Value::Null);
            p.insert("numar".into(), json!("Restituire avans"));
            p.insert(
                "explicatie".into(),
                json!(format!("Rest din avansul dat lui {}", s(&adv, "avans_persoana"))),
            );
            p.insert("sursa".into(), json!("manual"));
            p.insert("cheie_extras".into(), Value::Null);
            p.insert("storno_de".into(), Value::Null);
            p.insert("creat_ms".into(), json!(now));
            batch.push(Write::put(PAYMENTS, Uuid::now_v7(), p).expect(0));
        }
        ctx.write(batch)?;
        Ok(json!({"cheltuit": spent, "restituit": back}))
    }

    /// A bank statement CSV: date, description, and either debit/credit or
    /// one signed amount. Lines already imported (same account, date, amount
    /// and description) are skipped; anything unreadable refuses the file.
    pub(crate) fn bank_import(&self, ctx: &mut ModuleContext<'_>, a: BankImport) -> CoreResult<Value> {
        use base64::Engine as _;
        let acc = live(ctx, ACCOUNTS, a.cont, "contul")?;
        if s(&acc, "tip") != "banca" {
            return Err(bad("contul", "extrasele se importă într-un cont bancar"));
        }
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(a.data.as_bytes())
            .map_err(|_| bad("fișierul", "conținutul nu este valid (base64)"))?;
        if !a.name.to_lowercase().ends_with(".csv") {
            return Err(bad("extrasul", "se importă ca CSV (din internet banking: export CSV)"));
        }
        let b = book::read(&bytes, Format::Csv).map_err(|e| bad("extrasul", e))?;
        let sheet = b.sheets.first().ok_or_else(|| bad("extrasul", "este gol"))?;
        let (h, w) = sheet.size();
        let cell = |r: u32, c: u32| {
            sheet
                .values
                .get_value((r, c))
                .and_then(book::show)
                .map(|x| x.0)
                .unwrap_or_default()
        };
        let norm = |x: &str| {
            x.trim()
                .trim_start_matches('\u{feff}')
                .to_lowercase()
                .replace(['ă', 'â'], "a")
                .replace('î', "i")
                .replace(['ș', 'ş'], "s")
                .replace(['ț', 'ţ'], "t")
        };
        let find = |names: &[&str]| (0..w).find(|c| names.iter().any(|n| norm(&cell(0, *c)).contains(n)));
        let c_date = find(&["data"]).ok_or_else(|| bad("extrasul", "nu găsesc coloana „Data”"))?;
        let c_desc = find(&["descriere", "detalii", "explicatie", "beneficiar"]);
        let (c_debit, c_credit, c_amount) = (
            find(&["debit"]),
            find(&["credit"]),
            find(&["suma", "valoare", "amount"]),
        );
        if !(c_debit.is_some() && c_credit.is_some()) && c_amount.is_none() {
            return Err(bad("extrasul", "nu găsesc coloanele „Debit”/„Credit” sau „Sumă”"));
        }
        let existing: BTreeSet<String> = ctx
            .scan(PAYMENTS, |r| r.fields.get("cont") == Some(&json!(a.cont.to_string())))?
            .iter()
            .map(|p| s(p, "cheie_extras"))
            .collect();
        let mut batch = Vec::new();
        let (mut added, mut skipped, mut errs) = (0, 0, Vec::new());
        let mut seen = BTreeSet::new();
        for r in 1..h {
            let raw_date = cell(r, c_date);
            if raw_date.trim().is_empty() {
                continue;
            }
            let Some(d) = date(&raw_date) else {
                errs.push(format!("rândul {}: „{raw_date}” nu este o dată", r + 1));
                continue;
            };
            let money = |c: Option<u32>| {
                c.map(|c| cell(r, c))
                    .filter(|x| !x.trim().is_empty())
                    .map(|x| num::money(&x).ok_or(x))
            };
            let signed = match (money(c_debit), money(c_credit), money(c_amount)) {
                (Some(Ok(db)), _, _) if db != 0 => -db.abs(),
                (_, Some(Ok(cr)), _) if cr != 0 => cr.abs(),
                (_, _, Some(Ok(v))) => v,
                (Some(Err(x)), _, _) | (_, Some(Err(x)), _) | (_, _, Some(Err(x))) => {
                    errs.push(format!("rândul {}: „{x}” nu este o sumă", r + 1));
                    continue;
                }
                _ => continue,
            };
            if signed == 0 {
                continue;
            }
            let desc: String = c_desc
                .map(|c| cell(r, c))
                .unwrap_or_default()
                .chars()
                .take(300)
                .collect();
            let key = format!("{d}|{signed}|{}", desc.trim().to_lowercase());
            if existing.contains(&key) || !seen.insert(key.clone()) {
                skipped += 1;
                continue;
            }
            let mut f = Fields::new();
            f.insert("cont".into(), json!(a.cont.to_string()));
            f.insert("data".into(), json!(d));
            f.insert("sens".into(), json!(if signed > 0 { "incasare" } else { "plata" }));
            f.insert("suma".into(), json!(signed.abs()));
            f.insert("partener".into(), Value::Null);
            f.insert("partener_nume".into(), Value::Null);
            f.insert("avans_persoana".into(), Value::Null);
            f.insert("numar".into(), json!("extras"));
            f.insert(
                "explicatie".into(),
                if desc.trim().is_empty() {
                    Value::Null
                } else {
                    json!(desc.trim())
                },
            );
            f.insert("sursa".into(), json!("extras"));
            f.insert("cheie_extras".into(), json!(key));
            f.insert("storno_de".into(), Value::Null);
            f.insert("creat_ms".into(), json!(now_ms()));
            batch.push(Write::put(PAYMENTS, Uuid::now_v7(), f).expect(0));
            added += 1;
        }
        if !errs.is_empty() {
            return Err(bad(
                "extrasul",
                format!("nimic nu a fost importat; {}", errs.join("; ")),
            ));
        }
        if !batch.is_empty() {
            ctx.write(batch)?;
        }
        Ok(json!({"importate": added, "sarite": skipped}))
    }
}
