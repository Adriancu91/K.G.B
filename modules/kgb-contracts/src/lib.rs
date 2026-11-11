//! `kgb.contracts` — „Contracte și abonamente” (Etapa 7, step 7.9e): contracts with clients and suppliers and
//! the lines billed every month, quarter, half-year or year.
//!
//! - **Contracts** (`contracte`): number, title, side (client / supplier), the partner (the id of a card in the
//!   core's directory, D-066, plus a copy of its name), start, end (empty = indefinite), automatic renewal for
//!   so many months, notice in days, state.
//! - **Subscriptions** (`abonamente`): the billed lines of a contract — name, unit, quantity (thousandths), price
//!   without VAT (bani), VAT rate (whole percent, as in Business), period, the day of the month of the invoice
//!   (1–28), from / until, the yearly indexation (percent × 100, applied at each anniversary of the contract).
//! - **Billings** (`facturari`): what was invoiced (with the invoice's series and number) or skipped, per
//!   subscription and period (the period's first month, `AAAA-LL`).
//!
//! Nothing is written in the background: the renewed end, the indexed price and the periods due are computed
//! when asked. So two PCs never disagree on a value one of them changed by itself. One period is marked once on
//! this PC; two PCs offline can still mark the same one, which meets at synchronisation and is shown (`dubla`).
//!
//! Modules do not call each other: the page asks Business to issue the invoice, then marks the period here.
//!
//! Commands: `parteneri {text}`, `contracte {azi, text?, stare?, parte?}`, `contract {id, azi}`, `contract_save`,
//! `contract_stare {id, version, stare}`, `contract_delete {id, version}`, `abonament_save`,
//! `abonament_delete {id, version}`, `de_facturat {pana_la, azi?}`, `facturare_marcheaza {...}`,
//! `facturare_sterge {id, version}`, `calendar {de_la, pana_la}`.

use std::collections::BTreeMap;

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::notifications::{Level, Notice};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.contracts";
pub const CONTRACTS: &str = "contracte";
pub const SUBSCRIPTIONS: &str = "abonamente";
pub const BILLINGS: &str = "facturari";
pub const STATES: [&str; 5] = ["ciorna", "activ", "suspendat", "incheiat", "reziliat"];
pub const PERIODS: [(&str, i64); 4] = [("lunar", 1), ("trimestrial", 3), ("semestrial", 6), ("anual", 12)];
/// At most this many periods of one subscription are looked at (50 years of months).
const MAX_PERIODS: i64 = 600;

pub struct Contracts {
    manifest: Manifest,
}

impl Contracts {
    pub fn new() -> Contracts {
        Contracts {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Contracts {
    fn default() -> Self {
        Contracts::new()
    }
}

fn args<T: DeserializeOwned>(command: &str, v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid(format!("argumentele comenzii {command}"), e.to_string()))
}

fn bad(what: &str, detail: impl Into<String>) -> CoreError {
    CoreError::invalid(what, detail)
}

fn s(r: &RecordState, k: &str) -> String {
    r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn i(r: &RecordState, k: &str) -> i64 {
    r.fields.get(k).and_then(Value::as_i64).unwrap_or_default()
}

fn b(r: &RecordState, k: &str) -> bool {
    r.fields.get(k) == Some(&json!(true))
}

fn div_round(a: i128, d: i128) -> i128 {
    let (q, r) = (a / d, a % d);
    if 2 * r.abs() >= d { q + a.signum() } else { q }
}

// ---------- days and months ----------

fn days_in(y: i64, m: i64) -> i64 {
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][(m - 1) as usize]
}

fn ymd(d: &str) -> Option<(i64, i64, i64)> {
    let by = d.as_bytes();
    if by.len() != 10 || by[4] != b'-' || by[7] != b'-' {
        return None;
    }
    let (y, m, dd): (i64, i64, i64) = (d[0..4].parse().ok()?, d[5..7].parse().ok()?, d[8..10].parse().ok()?);
    ((1900..=2200).contains(&y) && (1..=12).contains(&m) && dd >= 1 && dd <= days_in(y, m)).then_some((y, m, dd))
}

/// Days since 1970-01-01 of `AAAA-LL-ZZ`, if it is a real date.
pub fn day_number(d: &str) -> Option<i64> {
    let (y, m, dd) = ymd(d)?;
    Some(civil(y, m, dd))
}

fn civil(y: i64, m: i64, dd: i64) -> i64 {
    let (yy, mm) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
    let era = yy.div_euclid(400);
    let yoe = yy - era * 400;
    let doy = (153 * mm + 2) / 5 + dd - 1;
    era * 146_097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719_468
}

/// `AAAA-LL-ZZ` of a day number.
pub fn date_of(z: i64) -> String {
    let (y, m, d) = parts(z);
    format!("{y:04}-{m:02}-{d:02}")
}

fn parts(z: i64) -> (i64, i64, i64) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (yoe + era * 400 + i64::from(m <= 2), m, d)
}

/// The month index (year × 12 + month − 1) of a day.
fn month_of(z: i64) -> i64 {
    let (y, m, _) = parts(z);
    y * 12 + m - 1
}

/// The day `day` of a month index, clamped to the month's last day.
fn day_in_month(mi: i64, day: i64) -> i64 {
    let (y, m) = (mi.div_euclid(12), mi.rem_euclid(12) + 1);
    civil(y, m, day.min(days_in(y, m)))
}

/// A day plus `n` months (the 31st becomes the month's last day).
pub fn add_months(z: i64, n: i64) -> i64 {
    let (_, _, d) = parts(z);
    day_in_month(month_of(z) + n, d)
}

fn month_text(mi: i64) -> String {
    format!("{:04}-{:02}", mi.div_euclid(12), mi.rem_euclid(12) + 1)
}

fn month_index(t: &str) -> Option<i64> {
    day_number(&format!("{t}-01")).map(month_of)
}

/// Full years from `from` to `to` (an anniversary on 29 February counts on 28 February).
fn full_years(from: i64, to: i64) -> i64 {
    if to < from {
        return 0;
    }
    let mut n = (month_of(to) - month_of(from)) / 12;
    while n > 0 && add_months(from, 12 * n) > to {
        n -= 1;
    }
    while add_months(from, 12 * (n + 1)) <= to {
        n += 1;
    }
    n
}

/// The price after `years` yearly indexations of `rate` (percent × 100), rounded each year to the ban.
pub fn indexed(price: i64, rate: i64, years: i64) -> i64 {
    let mut p = price as i128;
    for _ in 0..years.clamp(0, 100) {
        p = div_round(p * (10_000 + rate as i128), 10_000);
    }
    p as i64
}

/// The value of a line: quantity in thousandths × price in bani, rounded to the ban (as Business does).
pub fn line_value(qty: i64, price: i64) -> i64 {
    div_round(qty as i128 * price as i128, 1000) as i64
}

fn period_months(p: &str) -> Option<i64> {
    PERIODS.iter().find(|(n, _)| *n == p).map(|(_, m)| *m)
}

// ---------- contracts ----------

/// The end of a contract as of `reference`: the written end, or for an active contract with automatic renewal
/// the end after as many renewals as needed to reach `reference`. `None` = indefinite.
fn effective_end(c: &RecordState, reference: i64) -> Option<(i64, bool)> {
    let mut e = day_number(&s(c, "sfarsit"))?;
    let mut renewed = false;
    if b(c, "prelungire_auto") && s(c, "stare") == "activ" {
        let months = i(c, "prelungire_luni").max(1);
        let mut n = 0;
        while e < reference && n < 10_000 {
            e = add_months(e + 1, months) - 1;
            renewed = true;
            n += 1;
        }
    }
    Some((e, renewed))
}

/// The renewal ends of a contract with automatic renewal that fall in `from..=to`.
fn renewals_in(c: &RecordState, from: i64, to: i64) -> Vec<i64> {
    let Some(mut e) = day_number(&s(c, "sfarsit")) else {
        return Vec::new();
    };
    let months = i(c, "prelungire_luni").max(1);
    let mut out = Vec::new();
    let mut n = 0;
    while e <= to && n < 10_000 {
        if e >= from {
            out.push(e);
        }
        e = add_months(e + 1, months) - 1;
        n += 1;
    }
    out
}

/// States in which a contract's periods are billed.
fn billed_state(st: &str) -> bool {
    matches!(st, "activ" | "incheiat" | "reziliat")
}

/// One period of a subscription.
#[derive(Clone, Debug)]
struct Period {
    month: i64,
    start: i64,
    end: i64,
    billing: i64,
    unit_price: i64,
    amount: i64,
}

/// The periods of a subscription whose invoice date is at most `until`.
fn periods(c: &RecordState, sub: &RecordState, until: i64) -> Vec<Period> {
    let (Some(from), Some(p)) = (day_number(&s(sub, "de_la")), period_months(&s(sub, "perioada"))) else {
        return Vec::new();
    };
    let start_contract = day_number(&s(c, "inceput")).unwrap_or(from);
    let limit = [day_number(&s(sub, "pana_la")), effective_end(c, until).map(|(e, _)| e)]
        .into_iter()
        .flatten()
        .min();
    let m0 = month_of(from);
    let day = i(sub, "zi_facturare").clamp(1, 28);
    let mut out = Vec::new();
    for k in 0..MAX_PERIODS {
        let month = m0 + k * p;
        let start = if k == 0 { from } else { day_in_month(month, 1) };
        if limit.is_some_and(|l| start > l) {
            break;
        }
        let billing = day_in_month(month, day).max(start);
        if billing > until {
            break;
        }
        let end_full = day_in_month(month + p, 1) - 1;
        let end = limit.map_or(end_full, |l| end_full.min(l));
        let unit_price = indexed(i(sub, "pret"), i(sub, "indexare"), full_years(start_contract, start));
        out.push(Period {
            month,
            start,
            end,
            billing,
            unit_price,
            amount: line_value(i(sub, "cantitate"), unit_price),
        });
    }
    out
}

// ---------- arguments ----------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PartnerSearch {
    #[serde(default)]
    text: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct List {
    azi: String,
    #[serde(default)]
    text: String,
    #[serde(default)]
    stare: Option<String>,
    #[serde(default)]
    parte: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct One {
    id: Uuid,
    azi: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ContractSave {
    id: Option<Uuid>,
    version: Option<u64>,
    #[serde(default)]
    numar: String,
    titlu: String,
    parte: String,
    #[serde(default)]
    partener: Option<Uuid>,
    #[serde(default)]
    partener_nume: String,
    inceput: String,
    #[serde(default)]
    sfarsit: String,
    #[serde(default)]
    prelungire_auto: bool,
    #[serde(default = "twelve")]
    prelungire_luni: i64,
    #[serde(default)]
    preaviz_zile: i64,
    #[serde(default)]
    stare: Option<String>,
    #[serde(default)]
    nota: String,
}

fn twelve() -> i64 {
    12
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ByIdVersion {
    id: Uuid,
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StateSet {
    id: Uuid,
    version: u64,
    stare: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SubscriptionSave {
    id: Option<Uuid>,
    version: Option<u64>,
    contract: Uuid,
    denumire: String,
    #[serde(default)]
    um: String,
    /// Thousandths: 1000 = 1.
    cantitate: i64,
    /// Bani, without VAT.
    pret: i64,
    #[serde(default = "standard_vat")]
    tva: i64,
    perioada: String,
    #[serde(default = "first")]
    zi_facturare: i64,
    de_la: String,
    #[serde(default)]
    pana_la: String,
    #[serde(default)]
    indexare: i64,
    #[serde(default = "yes")]
    activ: bool,
}

fn standard_vat() -> i64 {
    21
}

fn first() -> i64 {
    1
}

fn yes() -> bool {
    true
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Due {
    pana_la: String,
    #[serde(default)]
    azi: Option<String>,
    #[serde(default)]
    contract: Option<Uuid>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Mark {
    abonament: Uuid,
    perioada: String,
    stare: String,
    #[serde(default)]
    factura: String,
    data: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Range {
    de_la: String,
    pana_la: String,
}

fn date_arg(what: &str, t: &str) -> CoreResult<i64> {
    day_number(t.trim()).ok_or_else(|| bad(what, format!("„{t}” nu e o dată AAAA-LL-ZZ")))
}

fn fold(t: &str) -> String {
    t.to_lowercase()
        .replace(['ă', 'â'], "a")
        .replace('î', "i")
        .replace(['ș', 'ş'], "s")
        .replace(['ț', 'ţ'], "t")
}

// ---------- the module ----------

impl Contracts {
    fn live(&self, ctx: &mut ModuleContext<'_>, c: &str, id: Uuid, what: &str) -> CoreResult<RecordState> {
        ctx.get(c, id)?
            .filter(|r| !r.deleted)
            .ok_or_else(|| bad(what, "nu mai există"))
    }

    fn all(&self, ctx: &mut ModuleContext<'_>, c: &str) -> CoreResult<Vec<RecordState>> {
        ctx.scan(c, |r| !r.deleted)
    }

    fn of_contract(&self, ctx: &mut ModuleContext<'_>, c: &str, id: Uuid) -> CoreResult<Vec<RecordState>> {
        let key = json!(id.to_string());
        ctx.scan(c, |r| !r.deleted && r.fields.get("contract") == Some(&key))
    }

    fn contract_view(c: &RecordState, today: i64, subs: usize) -> Value {
        let end = effective_end(c, today);
        let notice = match end {
            Some((e, _)) if b(c, "prelungire_auto") && i(c, "preaviz_zile") > 0 => date_of(e - i(c, "preaviz_zile")),
            _ => String::new(),
        };
        json!({
            "id": c.id, "version": c.version, "numar": s(c, "numar"), "titlu": s(c, "titlu"), "parte": s(c, "parte"),
            "partener": s(c, "partener"), "partener_nume": s(c, "partener_nume"), "inceput": s(c, "inceput"),
            "sfarsit": s(c, "sfarsit"), "prelungire_auto": b(c, "prelungire_auto"), "prelungire_luni": i(c, "prelungire_luni"),
            "preaviz_zile": i(c, "preaviz_zile"), "stare": s(c, "stare"), "nota": s(c, "nota"),
            "sfarsit_efectiv": end.map(|(e, _)| date_of(e)).unwrap_or_default(),
            "prelungit": end.is_some_and(|(_, r)| r),
            "zile_ramase": end.map(|(e, _)| e - today),
            "preaviz_pana": notice,
            "abonamente": subs,
        })
    }

    fn sub_view(r: &RecordState) -> Value {
        json!({
            "id": r.id, "version": r.version, "contract": s(r, "contract"), "denumire": s(r, "denumire"), "um": s(r, "um"),
            "cantitate": i(r, "cantitate"), "pret": i(r, "pret"), "tva": i(r, "tva"), "perioada": s(r, "perioada"),
            "zi_facturare": i(r, "zi_facturare"), "de_la": s(r, "de_la"), "pana_la": s(r, "pana_la"),
            "indexare": i(r, "indexare"), "activ": b(r, "activ"),
        })
    }

    /// The billings, each marked when the same period of the same subscription was marked more than once
    /// (as after two PCs did it offline).
    fn billing_views(list: &[RecordState]) -> Vec<Value> {
        let mut count: BTreeMap<(String, String), usize> = BTreeMap::new();
        for r in list {
            *count.entry((s(r, "abonament"), s(r, "perioada"))).or_default() += 1;
        }
        let mut sorted: Vec<&RecordState> = list.iter().collect();
        sorted.sort_by_key(|r| (s(r, "perioada"), i(r, "creat_ms")));
        sorted
            .iter()
            .map(|r| {
                json!({
                    "id": r.id, "version": r.version, "contract": s(r, "contract"), "abonament": s(r, "abonament"),
                    "perioada": s(r, "perioada"), "suma": i(r, "suma"), "stare": s(r, "stare"), "factura": s(r, "factura"),
                    "data": s(r, "data"),
                    "dubla": count.get(&(s(r, "abonament"), s(r, "perioada"))).copied().unwrap_or(0) > 1,
                })
            })
            .collect()
    }

    fn list(&self, ctx: &mut ModuleContext<'_>, a: List) -> CoreResult<Value> {
        let today = date_arg("data de azi", &a.azi)?;
        let q = fold(a.text.trim());
        let subs = self.all(ctx, SUBSCRIPTIONS)?;
        let mut l: Vec<RecordState> = self
            .all(ctx, CONTRACTS)?
            .into_iter()
            .filter(|c| a.stare.as_ref().is_none_or(|x| x.is_empty() || *x == s(c, "stare")))
            .filter(|c| a.parte.as_ref().is_none_or(|x| x.is_empty() || *x == s(c, "parte")))
            .filter(|c| {
                q.is_empty()
                    || fold(&s(c, "titlu")).contains(&q)
                    || fold(&s(c, "numar")).contains(&q)
                    || fold(&s(c, "partener_nume")).contains(&q)
            })
            .collect();
        l.sort_by_key(|c| (s(c, "partener_nume").to_lowercase(), s(c, "inceput")));
        Ok(json!(
            l.iter()
                .map(|c| {
                    let n = subs.iter().filter(|x| s(x, "contract") == c.id.to_string()).count();
                    Self::contract_view(c, today, n)
                })
                .collect::<Vec<_>>()
        ))
    }

    fn one(&self, ctx: &mut ModuleContext<'_>, a: One) -> CoreResult<Value> {
        let today = date_arg("data de azi", &a.azi)?;
        let c = self.live(ctx, CONTRACTS, a.id, "contractul")?;
        let mut subs = self.of_contract(ctx, SUBSCRIPTIONS, a.id)?;
        subs.sort_by_key(|r| (s(r, "de_la"), s(r, "denumire")));
        let bills = self.of_contract(ctx, BILLINGS, a.id)?;
        let mut v = Self::contract_view(&c, today, subs.len());
        // The partner's card (for its CUI, to find it among the partners of Business).
        let card = match s(&c, "partener").parse::<Uuid>() {
            Ok(pid) => ctx.partner(pid).ok(),
            Err(_) => None,
        };
        v["partener_cui"] = json!(card.as_ref().map(|p| p.cui.clone()).unwrap_or_default());
        v["linii"] = json!(subs.iter().map(Self::sub_view).collect::<Vec<_>>());
        v["facturari"] = json!(Self::billing_views(&bills));
        Ok(v)
    }

    fn contract_save(&self, ctx: &mut ModuleContext<'_>, a: ContractSave) -> CoreResult<Value> {
        let titlu = a.titlu.trim().to_string();
        if titlu.is_empty() || titlu.chars().count() > 200 {
            return Err(bad("titlul", "are 1–200 de caractere"));
        }
        if a.numar.trim().chars().count() > 40 {
            return Err(bad("numărul", "are cel mult 40 de caractere"));
        }
        if !matches!(a.parte.as_str(), "client" | "furnizor") {
            return Err(bad("partea", "e client sau furnizor"));
        }
        let mut name = a.partener_nume.trim().to_string();
        if let Some(pid) = a.partener {
            name = ctx.partner(pid)?.denumire;
        }
        if name.is_empty() || name.chars().count() > 200 {
            return Err(bad(
                "partenerul",
                "alege-l din agendă sau scrie-i numele (cel mult 200 de caractere)",
            ));
        }
        let start = date_arg("începutul", &a.inceput)?;
        let end = a.sfarsit.trim();
        if !end.is_empty() && date_arg("sfârșitul", end)? < start {
            return Err(bad("sfârșitul", "e înaintea începutului"));
        }
        if a.prelungire_auto && end.is_empty() {
            return Err(bad(
                "prelungirea automată",
                "are nevoie de o dată de sfârșit (un contract pe durată nedeterminată nu se prelungește)",
            ));
        }
        if !(1..=120).contains(&a.prelungire_luni) || !(0..=365).contains(&a.preaviz_zile) {
            return Err(bad(
                "contractul",
                "prelungirea are 1–120 de luni, preavizul 0–365 de zile",
            ));
        }
        if a.nota.chars().count() > 2000 {
            return Err(bad("nota", "are cel mult 2000 de caractere"));
        }
        let (id, expect, state, created) = match a.id {
            Some(id) => {
                let old = self.live(ctx, CONTRACTS, id, "contractul")?;
                (
                    id,
                    a.version.unwrap_or(old.version),
                    s(&old, "stare"),
                    i(&old, "creat_ms"),
                )
            }
            None => (Uuid::now_v7(), 0, "ciorna".to_string(), now_ms() as i64),
        };
        let state = a.stare.unwrap_or(state);
        if !STATES.contains(&state.as_str()) {
            return Err(bad(
                "starea",
                format!("„{state}” nu e una dintre {}", STATES.join(", ")),
            ));
        }
        let mut f = Fields::new();
        f.insert("numar".into(), json!(a.numar.trim()));
        f.insert("titlu".into(), json!(titlu));
        f.insert("parte".into(), json!(a.parte));
        f.insert(
            "partener".into(),
            json!(a.partener.map(|x| x.to_string()).unwrap_or_default()),
        );
        f.insert("partener_nume".into(), json!(name));
        f.insert("inceput".into(), json!(date_of(start)));
        f.insert("sfarsit".into(), json!(end));
        f.insert("prelungire_auto".into(), json!(a.prelungire_auto));
        f.insert("prelungire_luni".into(), json!(a.prelungire_luni));
        f.insert("preaviz_zile".into(), json!(a.preaviz_zile));
        f.insert("stare".into(), json!(state));
        f.insert("nota".into(), json!(a.nota.trim()));
        f.insert("creat_ms".into(), json!(created));
        ctx.write(vec![Write::put(CONTRACTS, id, f).expect(expect)])?;
        ctx.log(&format!("contract {id} salvat"));
        Ok(json!({"id": id}))
    }

    fn contract_state(&self, ctx: &mut ModuleContext<'_>, a: StateSet) -> CoreResult<Value> {
        if !STATES.contains(&a.stare.as_str()) {
            return Err(bad(
                "starea",
                format!("„{}” nu e una dintre {}", a.stare, STATES.join(", ")),
            ));
        }
        let old = self.live(ctx, CONTRACTS, a.id, "contractul")?;
        if a.stare == "ciorna" && s(&old, "stare") != "ciorna" {
            return Err(bad("contractul", "a fost deja activat: nu mai redevine ciornă"));
        }
        let mut f = old.fields.clone();
        f.insert("stare".into(), json!(a.stare));
        ctx.write(vec![Write::put(CONTRACTS, a.id, f).expect(a.version)])?;
        ctx.log(&format!("contract {}: {} → {}", a.id, s(&old, "stare"), a.stare));
        Ok(json!({"id": a.id, "stare": a.stare}))
    }

    fn contract_delete(&self, ctx: &mut ModuleContext<'_>, a: ByIdVersion) -> CoreResult<Value> {
        let c = self.live(ctx, CONTRACTS, a.id, "contractul")?;
        if s(&c, "stare") != "ciorna" {
            return Err(bad(
                "contractul",
                "se șterge doar o ciornă; unul activat se marchează încheiat sau reziliat",
            ));
        }
        if !self.of_contract(ctx, BILLINGS, a.id)?.is_empty() {
            return Err(bad("contractul", "are facturări marcate și nu se mai șterge"));
        }
        let mut w = vec![Write::delete(CONTRACTS, a.id).expect(a.version)];
        for sub in self.of_contract(ctx, SUBSCRIPTIONS, a.id)? {
            w.push(Write::delete(SUBSCRIPTIONS, sub.id).expect(sub.version));
        }
        ctx.write(w)?;
        Ok(json!({"deleted": a.id}))
    }

    fn sub_save(&self, ctx: &mut ModuleContext<'_>, a: SubscriptionSave) -> CoreResult<Value> {
        let c = self.live(ctx, CONTRACTS, a.contract, "contractul")?;
        let denumire = a.denumire.trim().to_string();
        if denumire.is_empty() || denumire.chars().count() > 200 {
            return Err(bad("denumirea", "are 1–200 de caractere"));
        }
        let um = if a.um.trim().is_empty() {
            "buc".to_string()
        } else {
            a.um.trim().to_string()
        };
        if um.chars().count() > 20 {
            return Err(bad("unitatea de măsură", "are cel mult 20 de caractere"));
        }
        if !(1..=1_000_000_000).contains(&a.cantitate) {
            return Err(bad("cantitatea", "e un număr pozitiv"));
        }
        if !(0..=100_000_000_000).contains(&a.pret) {
            return Err(bad("prețul", "nu poate fi negativ"));
        }
        if !(0..=100).contains(&a.tva) {
            return Err(bad("cota de TVA", "e un procent între 0 și 100"));
        }
        if period_months(&a.perioada).is_none() {
            return Err(bad("perioada", "e lunar, trimestrial, semestrial sau anual"));
        }
        if !(1..=28).contains(&a.zi_facturare) {
            return Err(bad("ziua facturării", "e între 1 și 28 (ca să existe în fiecare lună)"));
        }
        if !(0..=10_000).contains(&a.indexare) {
            return Err(bad("indexarea", "e între 0% și 100% pe an"));
        }
        let from = date_arg("începutul facturării", &a.de_la)?;
        if day_number(&s(&c, "inceput")).is_some_and(|st| from < st) {
            return Err(bad("începutul facturării", "e înaintea începutului contractului"));
        }
        let until = a.pana_la.trim();
        if !until.is_empty() && date_arg("sfârșitul facturării", until)? < from {
            return Err(bad("sfârșitul facturării", "e înaintea începutului"));
        }
        let (id, expect) = match a.id {
            Some(id) => {
                let old = self.live(ctx, SUBSCRIPTIONS, id, "linia")?;
                if s(&old, "contract") != a.contract.to_string() {
                    return Err(bad("linia", "nu se mută la alt contract"));
                }
                let billed = self
                    .of_contract(ctx, BILLINGS, a.contract)?
                    .iter()
                    .any(|r| s(r, "abonament") == id.to_string());
                if billed && (s(&old, "perioada") != a.perioada || s(&old, "de_la") != date_of(from)) {
                    return Err(bad(
                        "linia",
                        "are perioade facturate: perioada și începutul nu se mai schimbă; oprește-o și fă una nouă",
                    ));
                }
                (id, a.version.unwrap_or(old.version))
            }
            None => (Uuid::now_v7(), 0),
        };
        let mut f = Fields::new();
        f.insert("contract".into(), json!(a.contract.to_string()));
        f.insert("denumire".into(), json!(denumire));
        f.insert("um".into(), json!(um));
        f.insert("cantitate".into(), json!(a.cantitate));
        f.insert("pret".into(), json!(a.pret));
        f.insert("tva".into(), json!(a.tva));
        f.insert("perioada".into(), json!(a.perioada));
        f.insert("zi_facturare".into(), json!(a.zi_facturare));
        f.insert("de_la".into(), json!(date_of(from)));
        f.insert("pana_la".into(), json!(until));
        f.insert("indexare".into(), json!(a.indexare));
        f.insert("activ".into(), json!(a.activ));
        ctx.write(vec![Write::put(SUBSCRIPTIONS, id, f).expect(expect)])?;
        Ok(json!({"id": id}))
    }

    fn sub_delete(&self, ctx: &mut ModuleContext<'_>, a: ByIdVersion) -> CoreResult<Value> {
        let sub = self.live(ctx, SUBSCRIPTIONS, a.id, "linia")?;
        let key = json!(a.id.to_string());
        if !ctx
            .scan(BILLINGS, |r| !r.deleted && r.fields.get("abonament") == Some(&key))?
            .is_empty()
        {
            return Err(bad(
                "linia",
                "are perioade facturate: nu se șterge, se oprește (inactivă)",
            ));
        }
        ctx.write(vec![Write::delete(SUBSCRIPTIONS, sub.id).expect(a.version)])?;
        Ok(json!({"deleted": a.id}))
    }

    /// The periods not yet marked whose invoice date is at most `until`.
    fn due(
        &self,
        ctx: &mut ModuleContext<'_>,
        until: i64,
        only: Option<Uuid>,
    ) -> CoreResult<Vec<(RecordState, RecordState, Period)>> {
        let contracts: BTreeMap<String, RecordState> = self
            .all(ctx, CONTRACTS)?
            .into_iter()
            .filter(|c| billed_state(&s(c, "stare")) && only.is_none_or(|x| x == c.id))
            .map(|c| (c.id.to_string(), c))
            .collect();
        let marked: std::collections::BTreeSet<(String, String)> = self
            .all(ctx, BILLINGS)?
            .iter()
            .map(|r| (s(r, "abonament"), s(r, "perioada")))
            .collect();
        let mut out = Vec::new();
        for sub in self.all(ctx, SUBSCRIPTIONS)? {
            let Some(c) = contracts.get(&s(&sub, "contract")) else {
                continue;
            };
            if !b(&sub, "activ") {
                continue;
            }
            for p in periods(c, &sub, until) {
                if !marked.contains(&(sub.id.to_string(), month_text(p.month))) {
                    out.push((c.clone(), sub.clone(), p));
                }
            }
        }
        out.sort_by_key(|(c, sub, p)| (p.billing, s(c, "partener_nume"), s(sub, "denumire")));
        Ok(out)
    }

    fn due_view(&self, ctx: &mut ModuleContext<'_>, a: Due) -> CoreResult<Value> {
        let until = date_arg("data", &a.pana_la)?;
        let today = match &a.azi {
            Some(t) => Some(date_arg("data de azi", t)?),
            None => None,
        };
        let list = self.due(ctx, until, a.contract)?;
        Ok(json!(
            list.iter()
                .map(|(c, sub, p)| json!({
                    "contract": c.id, "numar": s(c, "numar"), "titlu": s(c, "titlu"), "parte": s(c, "parte"),
                    "partener": s(c, "partener"), "partener_nume": s(c, "partener_nume"),
                    "abonament": sub.id, "denumire": s(sub, "denumire"), "um": s(sub, "um"), "cantitate": i(sub, "cantitate"),
                    "tva": i(sub, "tva"), "perioada": month_text(p.month), "de_la": date_of(p.start), "pana_la": date_of(p.end),
                    "data_facturare": date_of(p.billing), "pret_unitar": p.unit_price, "suma": p.amount,
                    "indexat": p.unit_price != i(sub, "pret"),
                    "intarziata": today.is_some_and(|t| p.billing < t),
                }))
                .collect::<Vec<_>>()
        ))
    }

    fn mark(&self, ctx: &mut ModuleContext<'_>, a: Mark) -> CoreResult<Value> {
        if !matches!(a.stare.as_str(), "emisa" | "sarita") {
            return Err(bad("marcajul", "e „emisă” sau „sărită”"));
        }
        let factura = a.factura.trim().to_string();
        if a.stare == "emisa" && (factura.is_empty() || factura.chars().count() > 40) {
            return Err(bad(
                "factura",
                "scrie seria și numărul facturii (cel mult 40 de caractere)",
            ));
        }
        let data = date_arg("data", &a.data)?;
        let sub = self.live(ctx, SUBSCRIPTIONS, a.abonament, "linia")?;
        let cid: Uuid = s(&sub, "contract")
            .parse()
            .map_err(|_| bad("linia", "nu are contract"))?;
        let c = self.live(ctx, CONTRACTS, cid, "contractul")?;
        let month =
            month_index(&a.perioada).ok_or_else(|| bad("perioada", format!("„{}” nu e o lună AAAA-LL", a.perioada)))?;
        // The period must be one of the subscription's (its invoice date may be in the future: invoiced early).
        let far = day_in_month(month + 12, 28);
        let p = periods(&c, &sub, far)
            .into_iter()
            .find(|p| p.month == month)
            .ok_or_else(|| {
                bad(
                    "perioada",
                    format!("{} nu e o perioadă a liniei „{}”", a.perioada, s(&sub, "denumire")),
                )
            })?;
        let key = json!(a.abonament.to_string());
        let per = json!(month_text(month));
        if !ctx
            .scan(BILLINGS, |r| {
                !r.deleted && r.fields.get("abonament") == Some(&key) && r.fields.get("perioada") == Some(&per)
            })?
            .is_empty()
        {
            return Err(bad(
                "perioada",
                format!(
                    "{} a liniei „{}” e deja marcată",
                    month_text(month),
                    s(&sub, "denumire")
                ),
            ));
        }
        let id = Uuid::now_v7();
        let mut f = Fields::new();
        f.insert("contract".into(), json!(cid.to_string()));
        f.insert("abonament".into(), json!(a.abonament.to_string()));
        f.insert("perioada".into(), per);
        f.insert("suma".into(), json!(if a.stare == "emisa" { p.amount } else { 0 }));
        f.insert("stare".into(), json!(a.stare));
        f.insert(
            "factura".into(),
            json!(if a.stare == "emisa" { factura } else { String::new() }),
        );
        f.insert("data".into(), json!(date_of(data)));
        f.insert("creat_ms".into(), json!(now_ms() as i64));
        ctx.write(vec![Write::put(BILLINGS, id, f).expect(0)])?;
        ctx.log(&format!(
            "contract {cid}: perioada {} marcată {}",
            month_text(month),
            a.stare
        ));
        Ok(json!({"id": id, "perioada": month_text(month), "suma": p.amount}))
    }

    fn calendar(&self, ctx: &mut ModuleContext<'_>, a: Range) -> CoreResult<Value> {
        let (from, to) = (date_arg("data", &a.de_la)?, date_arg("data", &a.pana_la)?);
        if to < from || to - from > 3 * 366 {
            return Err(bad("intervalul", "are cel mult 3 ani, cu sfârșitul după început"));
        }
        let mut ev: Vec<(i64, Value)> = Vec::new();
        for c in self.all(ctx, CONTRACTS)? {
            if s(&c, "stare") != "activ" {
                continue;
            }
            let base = json!({"contract": c.id, "numar": s(&c, "numar"), "titlu": s(&c, "titlu"), "partener_nume": s(&c, "partener_nume")});
            let with = |kind: &str, d: i64| {
                let mut v = base.clone();
                v["fel"] = json!(kind);
                v["data"] = json!(date_of(d));
                v
            };
            if b(&c, "prelungire_auto") {
                let notice = i(&c, "preaviz_zile");
                // A notice deadline can fall in the range for a renewal just after it.
                for e in renewals_in(&c, from, to + notice) {
                    if e <= to {
                        ev.push((e, with("prelungire", e)));
                    }
                    if notice > 0 && (from..=to).contains(&(e - notice)) {
                        ev.push((e - notice, with("preaviz", e - notice)));
                    }
                }
            } else if let Some(e) = day_number(&s(&c, "sfarsit"))
                && (from..=to).contains(&e)
            {
                ev.push((e, with("expira", e)));
            }
        }
        ev.sort_by_key(|(d, _)| *d);
        Ok(json!(ev.into_iter().map(|(_, v)| v).collect::<Vec<_>>()))
    }

    /// Counts only, no partners' names: what is due to be invoiced, the contracts that expire within 30 days
    /// (once a week), the last days of notice before an automatic renewal (7 days before and on the day).
    fn reminders(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        let Some(t) = day_number(today) else { return Ok(()) };
        let due = self.due(ctx, t, None)?.len();
        let key = format!("azi:{}", date_of(t));
        if due > 0 && !ctx.notify_key_used(&key)? {
            let title = if due == 1 {
                "Azi: o facturare de emis".to_string()
            } else {
                format!("Azi: {due} facturări de emis")
            };
            ctx.notify(
                &Notice::new(title, "Vezi lista „De facturat” în Contracte și abonamente.")
                    .level(Level::Atentie)
                    .key(key),
            )?;
        }
        let contracts: Vec<RecordState> = self
            .all(ctx, CONTRACTS)?
            .into_iter()
            .filter(|c| s(c, "stare") == "activ")
            .collect();
        let expiring = contracts
            .iter()
            .filter(|c| !b(c, "prelungire_auto"))
            .filter_map(|c| day_number(&s(c, "sfarsit")))
            .filter(|e| (t..=t + 30).contains(e))
            .count();
        // Once a week: the key is the week's Monday.
        let monday = t - (t + 3).rem_euclid(7);
        let key = format!("exp:{}", date_of(monday));
        if expiring > 0 && !ctx.notify_key_used(&key)? {
            let title = if expiring == 1 {
                "Un contract expiră în 30 de zile".to_string()
            } else {
                format!("{expiring} contracte expiră în 30 de zile")
            };
            ctx.notify(
                &Notice::new(title, "Vezi „Calendar” în Contracte și abonamente.")
                    .level(Level::Info)
                    .key(key),
            )?;
        }
        let mut notice: BTreeMap<i64, usize> = BTreeMap::new();
        for c in contracts
            .iter()
            .filter(|c| b(c, "prelungire_auto") && i(c, "preaviz_zile") > 0)
        {
            let n = i(c, "preaviz_zile");
            for e in renewals_in(c, t, t + 7 + n) {
                let d = e - n;
                if (t..=t + 7).contains(&d) {
                    *notice.entry(d).or_default() += 1;
                }
            }
        }
        for (d, n) in notice {
            let phase = if d == t { "0" } else { "7" };
            let key = format!("preaviz:{}:{phase}", date_of(d));
            if ctx.notify_key_used(&key)? {
                continue;
            }
            let what = if n == 1 {
                "un contract".to_string()
            } else {
                format!("{n} contracte")
            };
            let title = if d == t {
                format!("Azi e ultima zi de preaviz: {what}")
            } else {
                format!("Ultima zi de preaviz pe {}: {what}", date_of(d))
            };
            ctx.notify(
                &Notice::new(
                    title,
                    "După această zi contractul se prelungește automat. Vezi „Calendar”.",
                )
                .level(Level::Atentie)
                .key(key),
            )?;
        }
        Ok(())
    }
}

impl Module for Contracts {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn remind(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<()> {
        self.reminders(ctx, today)
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "parteneri" => {
                let a: PartnerSearch = args(command, a)?;
                Ok(json!(
                    ctx.partners_search(&a.text, 30)?
                        .iter()
                        .map(|p| json!({"id": p.id, "denumire": p.denumire, "cui": p.cui, "tip": p.tip}))
                        .collect::<Vec<_>>()
                ))
            }
            "contracte" => self.list(ctx, args(command, a)?),
            "contract" => self.one(ctx, args(command, a)?),
            "contract_save" => self.contract_save(ctx, args(command, a)?),
            "contract_stare" => self.contract_state(ctx, args(command, a)?),
            "contract_delete" => self.contract_delete(ctx, args(command, a)?),
            "abonament_save" => self.sub_save(ctx, args(command, a)?),
            "abonament_delete" => self.sub_delete(ctx, args(command, a)?),
            "de_facturat" => self.due_view(ctx, args(command, a)?),
            "facturare_marcheaza" => self.mark(ctx, args(command, a)?),
            "facturare_sterge" => {
                let a: ByIdVersion = args(command, a)?;
                self.live(ctx, BILLINGS, a.id, "marcajul")?;
                ctx.write(vec![Write::delete(BILLINGS, a.id).expect(a.version)])?;
                Ok(json!({"deleted": a.id}))
            }
            "calendar" => self.calendar(ctx, args(command, a)?),
            other => Err(CoreError::invalid("comanda", format!("„{other}” nu există în {ID}"))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(t: &str) -> i64 {
        day_number(t).unwrap()
    }

    #[test]
    fn months_years_and_indexation() {
        assert_eq!(date_of(add_months(d("2026-01-31"), 1)), "2026-02-28");
        assert_eq!(date_of(add_months(d("2028-01-31"), 1)), "2028-02-29");
        assert_eq!(date_of(add_months(d("2026-11-15"), 3)), "2027-02-15");
        assert_eq!(full_years(d("2028-02-29"), d("2029-02-27")), 0);
        assert_eq!(
            full_years(d("2028-02-29"), d("2029-02-28")),
            1,
            "the 29th counts on the 28th"
        );
        assert_eq!(full_years(d("2026-03-15"), d("2028-03-14")), 1);
        assert_eq!(full_years(d("2026-03-15"), d("2028-03-15")), 2);
        assert_eq!(indexed(10_000, 500, 0), 10_000);
        assert_eq!(indexed(10_000, 500, 2), 11_025);
        assert_eq!(indexed(333, 1_000, 1), 366, "rounded to the ban each year");
        assert_eq!(line_value(1_500, 10_001), 15_002);
        assert_eq!(month_text(month_index("2026-12").unwrap() + 1), "2027-01");
    }
}
