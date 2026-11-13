//! `kgb.rentals` — „Spații și chiriași” (Etapa 8, step 8.17).
//!
//! - **Premises** (`spatii`): flats, offices, shops, storage, land; the area in hundredths of m², the people living or
//!   working there, whether they share the common utilities (`activ`).
//! - **Leases** (`inchirieri`): a premises, the tenant (from the partner directory or a name), the period, the rent per
//!   month in bani, the deposit, the payment day. Two leases of the same premises cannot overlap.
//! - **Utilities** (`utilitati`): the common costs of a month (water, heating, cleaning, administration…), each split
//!   by area, by people or equally among the premises that share them. The split is exact to the ban: the parts are
//!   rounded down and the bani left go one by one to the largest remainders. The part of a free premises stays the
//!   owner's and is shown as such.
//! - **Payments** (`incasari`): for a lease and a month; never deleted, a wrong one is cancelled with a reason.
//!
//! What a lease owes for a month is computed, never written: the whole rent when the lease runs any day of that month,
//! plus the utilities' part of its premises when it is the lease running on the month's last day (else the one that
//! ended last). Commands: `parteneri`, `spatii`, `spatiu_save`, `spatiu_delete`, `inchirieri`, `inchiriere_save`,
//! `inchiriere_incheie {id, version, data}`, `utilitati {luna}`, `utilitate_save`, `utilitate_delete`,
//! `repartizare {luna}`, `incasare_save`, `incasare_anuleaza`, `situatie {luna}`, `restante {azi}`.

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.rentals";
pub const PREMISES: &str = "spatii";
pub const LEASES: &str = "inchirieri";
pub const UTILITIES: &str = "utilitati";
pub const PAYMENTS: &str = "incasari";
pub const KINDS: [&str; 6] = ["apartament", "birou", "comercial", "depozit", "teren", "altul"];
pub const KEYS: [&str; 3] = ["suprafata", "persoane", "egal"];
pub const PAY_KINDS: [&str; 3] = ["numerar", "card", "transfer"];

pub struct Rentals {
    manifest: Manifest,
}

impl Rentals {
    pub fn new() -> Rentals {
        Rentals {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Rentals {
    fn default() -> Self {
        Rentals::new()
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

fn now() -> i64 {
    i64::try_from(now_ms()).unwrap_or_default()
}

fn text(what: &str, t: &str, max: usize, required: bool) -> CoreResult<String> {
    let t = t.trim();
    if (required && t.is_empty()) || t.chars().count() > max {
        return Err(bad(
            what,
            if required {
                format!("are 1–{max} caractere")
            } else {
                format!("are cel mult {max} caractere")
            },
        ));
    }
    Ok(t.to_string())
}

fn fold(t: &str) -> String {
    t.to_lowercase()
        .replace(['ă', 'â'], "a")
        .replace('î', "i")
        .replace(['ș', 'ş'], "s")
        .replace(['ț', 'ţ'], "t")
}

fn days_in_month(y: i64, m: i64) -> i64 {
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][(m - 1) as usize]
}

/// Whether `AAAA-LL-ZZ` is a real date.
pub fn is_date(d: &str) -> bool {
    let by = d.as_bytes();
    if by.len() != 10 || by[4] != b'-' || by[7] != b'-' {
        return false;
    }
    let (Ok(y), Ok(m), Ok(dd)) = (d[0..4].parse::<i64>(), d[5..7].parse::<i64>(), d[8..10].parse::<i64>()) else {
        return false;
    };
    (1900..=2200).contains(&y) && (1..=12).contains(&m) && dd >= 1 && dd <= days_in_month(y, m)
}

fn date_arg(what: &str, t: &str) -> CoreResult<String> {
    let t = t.trim();
    if is_date(t) {
        Ok(t.to_string())
    } else {
        Err(bad(what, format!("„{t}” nu e o dată AAAA-LL-ZZ")))
    }
}

/// The first and last day of `AAAA-LL`.
pub fn month_bounds(m: &str) -> Option<(String, String)> {
    let y: i64 = m.get(0..4)?.parse().ok()?;
    let mm: i64 = m.get(5..7)?.parse().ok()?;
    if m.len() != 7 || m.as_bytes()[4] != b'-' || !(1900..=2200).contains(&y) || !(1..=12).contains(&mm) {
        return None;
    }
    Some((
        format!("{y:04}-{mm:02}-01"),
        format!("{y:04}-{mm:02}-{:02}", days_in_month(y, mm)),
    ))
}

fn month_arg(t: &str) -> CoreResult<(String, String)> {
    month_bounds(t.trim()).ok_or_else(|| bad("luna", format!("„{t}” nu e AAAA-LL")))
}

/// The months `AAAA-LL` from `from` to `to` (both `AAAA-LL…`), inclusive.
pub fn months_between(from: &str, to: &str) -> Vec<String> {
    let idx = |d: &str| -> Option<i64> {
        Some(d.get(0..4)?.parse::<i64>().ok()? * 12 + d.get(5..7)?.parse::<i64>().ok()? - 1)
    };
    let (Some(a), Some(z)) = (idx(from), idx(to)) else {
        return Vec::new();
    };
    (a..=z)
        .map(|k| format!("{:04}-{:02}", k.div_euclid(12), k.rem_euclid(12) + 1))
        .collect()
}

/// Splits `total` bani by `weights`, exact to the ban: every part rounded down, then the bani left given one by one
/// to the largest remainders (the earlier one first when equal). `None` when every weight is zero.
pub fn split(total: i64, weights: &[i64]) -> Option<Vec<i64>> {
    let sum: i128 = weights.iter().map(|w| i128::from(*w)).sum();
    if sum <= 0 {
        return None;
    }
    let mut parts: Vec<i64> = Vec::with_capacity(weights.len());
    let mut rest: Vec<(i128, usize)> = Vec::with_capacity(weights.len());
    for (k, w) in weights.iter().enumerate() {
        let x = i128::from(total) * i128::from(*w);
        parts.push((x / sum) as i64);
        rest.push((x % sum, k));
    }
    let mut left = total - parts.iter().sum::<i64>();
    rest.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
    for (_, k) in rest {
        if left == 0 {
            break;
        }
        parts[k] += 1;
        left -= 1;
    }
    Some(parts)
}

// ---------- arguments ----------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Search {
    #[serde(default)]
    text: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ById {
    id: Uuid,
    #[serde(default)]
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Month {
    luna: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Today {
    azi: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PremisesIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    nume: String,
    #[serde(default)]
    cladire: String,
    #[serde(default = "flat")]
    fel: String,
    #[serde(default)]
    suprafata: i64,
    #[serde(default)]
    persoane: i64,
    #[serde(default = "yes")]
    activ: bool,
    #[serde(default)]
    nota: String,
}

fn flat() -> String {
    "apartament".into()
}

fn yes() -> bool {
    true
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LeaseIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    spatiu: Uuid,
    #[serde(default)]
    chirias: Option<Uuid>,
    #[serde(default)]
    chirias_nume: String,
    #[serde(default)]
    numar: String,
    de_la: String,
    #[serde(default)]
    pana_la: String,
    chirie: i64,
    #[serde(default)]
    garantie: i64,
    #[serde(default = "first")]
    zi_plata: i64,
    #[serde(default)]
    nota: String,
}

fn first() -> i64 {
    1
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EndIn {
    id: Uuid,
    version: u64,
    data: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct UtilityIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    luna: String,
    fel: String,
    suma: i64,
    #[serde(default = "by_area")]
    cheie: String,
    #[serde(default)]
    document: String,
}

fn by_area() -> String {
    "suprafata".into()
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PaymentIn {
    inchiriere: Uuid,
    luna: String,
    data: String,
    suma: i64,
    #[serde(default = "transfer")]
    fel: String,
    #[serde(default)]
    document: String,
}

fn transfer() -> String {
    "transfer".into()
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CancelIn {
    id: Uuid,
    version: u64,
    motiv: String,
}

// ---------- the module ----------

/// Whether a lease runs any day between `first` and `last`.
fn runs(l: &RecordState, first: &str, last: &str) -> bool {
    s(l, "de_la").as_str() <= last && (s(l, "pana_la").is_empty() || s(l, "pana_la").as_str() >= first)
}

/// One month's split: per premises, its part of every utility and who carries it.
struct MonthSplit {
    /// (premises id, the lease that carries it or None, the part per utility in order, the total)
    rows: Vec<(Uuid, Option<Uuid>, Vec<i64>, i64)>,
    utilities: Vec<RecordState>,
}

impl Rentals {
    fn all(&self, ctx: &mut ModuleContext<'_>, c: &str) -> CoreResult<Vec<RecordState>> {
        ctx.scan(c, |r| !r.deleted)
    }

    fn get(&self, ctx: &mut ModuleContext<'_>, c: &str, id: Uuid, what: &str) -> CoreResult<RecordState> {
        ctx.get(c, id)?
            .filter(|r| !r.deleted)
            .ok_or_else(|| bad(what, "nu există"))
    }

    /// The utilities of `month` split among the sharing premises; the lease carrying each premises' part is the one
    /// running on the month's last day, else the one that ended last in the month.
    fn month_split(&self, ctx: &mut ModuleContext<'_>, month: &str) -> CoreResult<MonthSplit> {
        let (first, last) = month_arg(month)?;
        let mut premises: Vec<RecordState> = self.all(ctx, PREMISES)?.into_iter().filter(|p| b(p, "activ")).collect();
        premises.sort_by_key(|p| fold(&s(p, "nume")));
        let leases = self.all(ctx, LEASES)?;
        let mut utilities: Vec<RecordState> = self
            .all(ctx, UTILITIES)?
            .into_iter()
            .filter(|u| s(u, "luna") == month)
            .collect();
        utilities.sort_by_key(|u| fold(&s(u, "fel")));
        let mut parts = vec![vec![0i64; utilities.len()]; premises.len()];
        for (k, u) in utilities.iter().enumerate() {
            let weights: Vec<i64> = premises
                .iter()
                .map(|p| match s(u, "cheie").as_str() {
                    "suprafata" => i(p, "suprafata"),
                    "persoane" => i(p, "persoane"),
                    _ => 1,
                })
                .collect();
            let shares = split(i(u, "suma"), &weights).ok_or_else(|| {
                bad(
                    &format!("utilitatea „{}”", s(u, "fel")),
                    "spațiile care împart utilitățile nu au nicio suprafață sau persoană trecută",
                )
            })?;
            for (row, share) in parts.iter_mut().zip(shares) {
                row[k] = share;
            }
        }
        let rows = premises
            .iter()
            .zip(parts)
            .map(|(p, row)| {
                let pid = p.id.to_string();
                let mut mine: Vec<&RecordState> = leases
                    .iter()
                    .filter(|l| s(l, "spatiu") == pid && runs(l, &first, &last))
                    .collect();
                mine.sort_by_key(|l| {
                    let end = s(l, "pana_la");
                    if end.is_empty() || end >= last {
                        "9999-12-31".to_string()
                    } else {
                        end
                    }
                });
                let total = row.iter().sum();
                (p.id, mine.last().map(|l| l.id), row, total)
            })
            .collect();
        Ok(MonthSplit { rows, utilities })
    }

    /// What one lease owes for one month: (rent, utilities).
    fn owed(&self, l: &RecordState, month: &str, split: &MonthSplit) -> (i64, i64) {
        let Some((first, last)) = month_bounds(month) else {
            return (0, 0);
        };
        if !runs(l, &first, &last) {
            return (0, 0);
        }
        let util = split
            .rows
            .iter()
            .find(|(_, carrier, _, _)| *carrier == Some(l.id))
            .map_or(0, |(_, _, _, t)| *t);
        (i(l, "chirie"), util)
    }

    fn lease_view(l: &RecordState, premises: &[RecordState]) -> Value {
        let p = premises.iter().find(|p| p.id.to_string() == s(l, "spatiu"));
        json!({"id": l.id, "version": l.version, "spatiu": s(l, "spatiu"), "spatiu_nume": p.map(|p| s(p, "nume")).unwrap_or_default(),
            "chirias": s(l, "chirias"), "chirias_nume": s(l, "chirias_nume"), "numar": s(l, "numar"), "de_la": s(l, "de_la"),
            "pana_la": s(l, "pana_la"), "chirie": i(l, "chirie"), "garantie": i(l, "garantie"), "zi_plata": i(l, "zi_plata"),
            "stare": s(l, "stare"), "nota": s(l, "nota")})
    }

    fn save_premises(&self, ctx: &mut ModuleContext<'_>, a: PremisesIn) -> CoreResult<Value> {
        if !KINDS.contains(&a.fel.as_str()) {
            return Err(bad("felul spațiului", "nu e cunoscut"));
        }
        if !(0..=100_000_000).contains(&a.suprafata) {
            return Err(bad("suprafața", "nu poate fi negativă"));
        }
        if !(0..=1000).contains(&a.persoane) {
            return Err(bad("persoanele", "sunt 0–1000"));
        }
        let nume = text("numele spațiului", &a.nume, 80, true)?;
        let cladire = text("clădirea", &a.cladire, 120, false)?;
        let taken = self.all(ctx, PREMISES)?.iter().any(|p| {
            Some(p.id) != a.id && fold(&s(p, "nume")) == fold(&nume) && fold(&s(p, "cladire")) == fold(&cladire)
        });
        if taken {
            return Err(bad("spațiul", format!("„{nume}” există deja în clădirea aceasta")));
        }
        let created = match a.id {
            Some(id) => i(&self.get(ctx, PREMISES, id, "spațiul")?, "creat_ms"),
            None => now(),
        };
        let mut f = Fields::new();
        f.insert("nume".into(), json!(nume));
        f.insert("cladire".into(), json!(cladire));
        f.insert("fel".into(), json!(a.fel));
        f.insert("suprafata".into(), json!(a.suprafata));
        f.insert("persoane".into(), json!(a.persoane));
        f.insert("activ".into(), json!(a.activ));
        f.insert("nota".into(), json!(text("nota", &a.nota, 1000, false)?));
        f.insert("creat_ms".into(), json!(created));
        let id = a.id.unwrap_or_else(Uuid::new_v4);
        let version = ctx.write(vec![Write::put(PREMISES, id, f).expect(if a.id.is_some() {
            a.version
        } else {
            0
        })])?[0];
        Ok(json!({"id": id, "version": version}))
    }

    fn save_lease(&self, ctx: &mut ModuleContext<'_>, a: LeaseIn) -> CoreResult<Value> {
        let p = self.get(ctx, PREMISES, a.spatiu, "spațiul")?;
        let de_la = date_arg("începutul contractului", &a.de_la)?;
        let pana_la = if a.pana_la.trim().is_empty() {
            String::new()
        } else {
            date_arg("sfârșitul contractului", &a.pana_la)?
        };
        if !pana_la.is_empty() && pana_la < de_la {
            return Err(bad("contractul", "se termină înainte să înceapă"));
        }
        if !(0..=100_000_000).contains(&a.chirie) || !(0..=100_000_000).contains(&a.garantie) {
            return Err(bad("chiria și garanția", "nu pot fi negative"));
        }
        if !(1..=28).contains(&a.zi_plata) {
            return Err(bad("ziua de plată", "e între 1 și 28"));
        }
        let mut nume = text("numele chiriașului", &a.chirias_nume, 200, false)?;
        if let Some(pid) = a.chirias {
            nume = ctx.partner(pid)?.denumire;
        }
        if nume.is_empty() {
            return Err(bad("chiriașul", "alege un partener sau scrie numele chiriașului"));
        }
        // Two leases of the same premises never overlap.
        let far = "9999-12-31".to_string();
        let end = if pana_la.is_empty() {
            far.clone()
        } else {
            pana_la.clone()
        };
        for l in self.all(ctx, LEASES)? {
            if Some(l.id) == a.id || s(&l, "spatiu") != a.spatiu.to_string() {
                continue;
            }
            let other_end = if s(&l, "pana_la").is_empty() {
                far.clone()
            } else {
                s(&l, "pana_la")
            };
            if s(&l, "de_la") <= end && de_la <= other_end {
                return Err(bad(
                    "contractul",
                    format!(
                        "se suprapune cu contractul lui {} pe „{}”",
                        s(&l, "chirias_nume"),
                        s(&p, "nume")
                    ),
                ));
            }
        }
        let (stare, created) = match a.id {
            Some(id) => {
                let l = self.get(ctx, LEASES, id, "contractul")?;
                (s(&l, "stare"), i(&l, "creat_ms"))
            }
            None => ("activ".to_string(), now()),
        };
        let mut f = Fields::new();
        f.insert("spatiu".into(), json!(a.spatiu.to_string()));
        f.insert(
            "chirias".into(),
            json!(a.chirias.map(|u| u.to_string()).unwrap_or_default()),
        );
        f.insert("chirias_nume".into(), json!(nume));
        f.insert(
            "numar".into(),
            json!(text("numărul contractului", &a.numar, 40, false)?),
        );
        f.insert("de_la".into(), json!(de_la));
        f.insert("pana_la".into(), json!(pana_la));
        f.insert("chirie".into(), json!(a.chirie));
        f.insert("garantie".into(), json!(a.garantie));
        f.insert("zi_plata".into(), json!(a.zi_plata));
        f.insert("stare".into(), json!(stare));
        f.insert("nota".into(), json!(text("nota", &a.nota, 1000, false)?));
        f.insert("creat_ms".into(), json!(created));
        let id = a.id.unwrap_or_else(Uuid::new_v4);
        let version = ctx.write(vec![Write::put(LEASES, id, f).expect(if a.id.is_some() {
            a.version
        } else {
            0
        })])?[0];
        Ok(json!({"id": id, "version": version}))
    }

    fn situation(&self, ctx: &mut ModuleContext<'_>, month: &str) -> CoreResult<Value> {
        let (first, last) = month_arg(month)?;
        let split = self.month_split(ctx, month)?;
        let premises = self.all(ctx, PREMISES)?;
        let payments = self.all(ctx, PAYMENTS)?;
        let mut rows: Vec<Value> = self
            .all(ctx, LEASES)?
            .iter()
            .filter(|l| runs(l, &first, &last))
            .map(|l| {
                let (rent, util) = self.owed(l, month, &split);
                let paid: i64 = payments
                    .iter()
                    .filter(|p| s(p, "inchiriere") == l.id.to_string() && s(p, "luna") == month && !b(p, "anulata"))
                    .map(|p| i(p, "suma"))
                    .sum();
                let mut v = Self::lease_view(l, &premises);
                v["chirie_luna"] = json!(rent);
                v["utilitati_luna"] = json!(util);
                v["total"] = json!(rent + util);
                v["incasat"] = json!(paid);
                v["rest"] = json!(rent + util - paid);
                v
            })
            .collect();
        rows.sort_by_key(|v| fold(v["spatiu_nume"].as_str().unwrap_or("")));
        let sum = |k: &str| rows.iter().map(|v| v[k].as_i64().unwrap_or(0)).sum::<i64>();
        let owner: i64 = split
            .rows
            .iter()
            .filter(|(_, c, _, _)| c.is_none())
            .map(|(_, _, _, t)| *t)
            .sum();
        Ok(
            json!({"luna": month, "total": sum("total"), "incasat": sum("incasat"), "rest": sum("rest"),
            "utilitati_proprietar": owner, "contracte": rows}),
        )
    }

    fn arrears(&self, ctx: &mut ModuleContext<'_>, today: &str) -> CoreResult<Value> {
        let leases = self.all(ctx, LEASES)?;
        let premises = self.all(ctx, PREMISES)?;
        let payments = self.all(ctx, PAYMENTS)?;
        let mut splits: std::collections::BTreeMap<String, MonthSplit> = std::collections::BTreeMap::new();
        let mut out = Vec::new();
        for l in &leases {
            let end = if s(l, "pana_la").is_empty() || s(l, "pana_la").as_str() > today {
                today.to_string()
            } else {
                s(l, "pana_la")
            };
            let mut due = 0;
            for m in months_between(&s(l, "de_la"), &end) {
                if !splits.contains_key(&m) {
                    let sp = self.month_split(ctx, &m)?;
                    splits.insert(m.clone(), sp);
                }
                let (rent, util) = self.owed(l, &m, &splits[&m]);
                due += rent + util;
            }
            let paid: i64 = payments
                .iter()
                .filter(|p| s(p, "inchiriere") == l.id.to_string() && !b(p, "anulata"))
                .map(|p| i(p, "suma"))
                .sum();
            if due > paid {
                let mut v = Self::lease_view(l, &premises);
                v["datorat"] = json!(due);
                v["incasat"] = json!(paid);
                v["rest"] = json!(due - paid);
                out.push(v);
            }
        }
        out.sort_by_key(|v| std::cmp::Reverse(v["rest"].as_i64().unwrap_or(0)));
        let total: i64 = out.iter().map(|v| v["rest"].as_i64().unwrap_or(0)).sum();
        Ok(json!({"total": total, "restante": out}))
    }
}

impl Module for Rentals {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "parteneri" => {
                let a: Search = args(command, a)?;
                Ok(json!(
                    ctx.partners_search(&a.text, 30)?
                        .iter()
                        .map(|p| json!({"id": p.id, "denumire": p.denumire, "cui": p.cui}))
                        .collect::<Vec<_>>()
                ))
            }
            "spatii" => {
                let leases = self.all(ctx, LEASES)?;
                let mut l = self.all(ctx, PREMISES)?;
                l.sort_by_key(|p| (fold(&s(p, "cladire")), fold(&s(p, "nume"))));
                Ok(json!(
                    l.iter()
                        .map(|p| {
                            let current = leases
                                .iter()
                                .find(|x| s(x, "spatiu") == p.id.to_string() && s(x, "stare") == "activ")
                                .map(|x| s(x, "chirias_nume"))
                                .unwrap_or_default();
                            json!({"id": p.id, "version": p.version, "nume": s(p, "nume"), "cladire": s(p, "cladire"), "fel": s(p, "fel"),
                                "suprafata": i(p, "suprafata"), "persoane": i(p, "persoane"), "activ": b(p, "activ"), "nota": s(p, "nota"),
                                "chirias": current})
                        })
                        .collect::<Vec<_>>()
                ))
            }
            "spatiu_save" => self.save_premises(ctx, args(command, a)?),
            "spatiu_delete" => {
                let a: ById = args(command, a)?;
                if self
                    .all(ctx, LEASES)?
                    .iter()
                    .any(|l| s(l, "spatiu") == a.id.to_string())
                {
                    return Err(bad(
                        "spațiul",
                        "are contracte și nu se șterge; scoate-l de la utilități",
                    ));
                }
                ctx.write(vec![Write::delete(PREMISES, a.id).expect(a.version)])?;
                Ok(Value::Null)
            }
            "inchirieri" => {
                let premises = self.all(ctx, PREMISES)?;
                let mut l = self.all(ctx, LEASES)?;
                l.sort_by_key(|x| (s(x, "stare") != "activ", std::cmp::Reverse(s(x, "de_la"))));
                Ok(json!(
                    l.iter().map(|x| Self::lease_view(x, &premises)).collect::<Vec<_>>()
                ))
            }
            "inchiriere_save" => self.save_lease(ctx, args(command, a)?),
            "inchiriere_incheie" => {
                let a: EndIn = args(command, a)?;
                let l = self.get(ctx, LEASES, a.id, "contractul")?;
                if s(&l, "stare") != "activ" {
                    return Err(bad("contractul", "e deja încheiat"));
                }
                let d = date_arg("data încheierii", &a.data)?;
                if d < s(&l, "de_la") {
                    return Err(bad("data încheierii", "e înaintea începutului contractului"));
                }
                let mut f = l.fields.clone();
                f.insert("pana_la".into(), json!(d));
                f.insert("stare".into(), json!("incheiat"));
                let version = ctx.write(vec![Write::put(LEASES, a.id, f).expect(a.version)])?[0];
                Ok(json!({"id": a.id, "version": version}))
            }
            "utilitati" => {
                let a: Month = args(command, a)?;
                month_arg(&a.luna)?;
                let mut l: Vec<RecordState> = self
                    .all(ctx, UTILITIES)?
                    .into_iter()
                    .filter(|u| s(u, "luna") == a.luna)
                    .collect();
                l.sort_by_key(|u| fold(&s(u, "fel")));
                Ok(json!(
                    l.iter()
                        .map(|u| json!({"id": u.id, "version": u.version, "luna": s(u, "luna"), "fel": s(u, "fel"), "suma": i(u, "suma"),
                            "cheie": s(u, "cheie"), "document": s(u, "document")}))
                        .collect::<Vec<_>>()
                ))
            }
            "utilitate_save" => {
                let a: UtilityIn = args(command, a)?;
                month_arg(&a.luna)?;
                if !KEYS.contains(&a.cheie.as_str()) {
                    return Err(bad("împărțirea", "e pe suprafață, pe persoane sau egal"));
                }
                if !(1..=1_000_000_000).contains(&a.suma) {
                    return Err(bad("suma", "trebuie să fie mai mare decât zero"));
                }
                let mut f = Fields::new();
                f.insert("luna".into(), json!(a.luna.trim()));
                f.insert("fel".into(), json!(text("felul utilității", &a.fel, 60, true)?));
                f.insert("suma".into(), json!(a.suma));
                f.insert("cheie".into(), json!(a.cheie));
                f.insert("document".into(), json!(text("documentul", &a.document, 60, false)?));
                let id = a.id.unwrap_or_else(Uuid::new_v4);
                let version = ctx.write(vec![Write::put(UTILITIES, id, f).expect(if a.id.is_some() {
                    a.version
                } else {
                    0
                })])?[0];
                // The split must work: every key needs some area or people among the sharing premises.
                if let Err(e) = self.month_split(ctx, a.luna.trim()) {
                    ctx.write(vec![Write::delete(UTILITIES, id).expect(version)])?;
                    return Err(e);
                }
                Ok(json!({"id": id, "version": version}))
            }
            "utilitate_delete" => {
                let a: ById = args(command, a)?;
                ctx.write(vec![Write::delete(UTILITIES, a.id).expect(a.version)])?;
                Ok(Value::Null)
            }
            "repartizare" => {
                let a: Month = args(command, a)?;
                let split = self.month_split(ctx, &a.luna)?;
                let premises = self.all(ctx, PREMISES)?;
                let leases = self.all(ctx, LEASES)?;
                let rows: Vec<Value> = split
                    .rows
                    .iter()
                    .map(|(pid, carrier, parts, total)| {
                        let p = premises.iter().find(|p| p.id == *pid);
                        let tenant = carrier.and_then(|c| leases.iter().find(|l| l.id == c)).map(|l| s(l, "chirias_nume"));
                        json!({"spatiu": pid, "nume": p.map(|p| s(p, "nume")).unwrap_or_default(),
                            "suprafata": p.map(|p| i(p, "suprafata")).unwrap_or(0), "persoane": p.map(|p| i(p, "persoane")).unwrap_or(0),
                            "chirias": tenant.clone().unwrap_or_default(), "liber": tenant.is_none(), "parti": parts, "total": total})
                    })
                    .collect();
                Ok(
                    json!({"luna": a.luna, "utilitati": split.utilities.iter().map(|u| json!({"fel": s(u, "fel"), "suma": i(u, "suma"), "cheie": s(u, "cheie")})).collect::<Vec<_>>(),
                    "spatii": rows}),
                )
            }
            "incasare_save" => {
                let a: PaymentIn = args(command, a)?;
                self.get(ctx, LEASES, a.inchiriere, "contractul")?;
                month_arg(&a.luna)?;
                if !(1..=1_000_000_000).contains(&a.suma) {
                    return Err(bad("suma", "trebuie să fie mai mare decât zero"));
                }
                if !PAY_KINDS.contains(&a.fel.as_str()) {
                    return Err(bad("felul plății", "e numerar, card sau transfer"));
                }
                let mut f = Fields::new();
                f.insert("inchiriere".into(), json!(a.inchiriere.to_string()));
                f.insert("luna".into(), json!(a.luna.trim()));
                f.insert("data".into(), json!(date_arg("data încasării", &a.data)?));
                f.insert("suma".into(), json!(a.suma));
                f.insert("fel".into(), json!(a.fel));
                f.insert("document".into(), json!(text("documentul", &a.document, 60, false)?));
                f.insert("anulata".into(), json!(false));
                f.insert("motiv".into(), json!(""));
                f.insert("creat_ms".into(), json!(now()));
                let id = Uuid::new_v4();
                let version = ctx.write(vec![Write::put(PAYMENTS, id, f).expect(0)])?[0];
                Ok(json!({"id": id, "version": version}))
            }
            "incasare_anuleaza" => {
                let a: CancelIn = args(command, a)?;
                let p = self.get(ctx, PAYMENTS, a.id, "încasarea")?;
                if b(&p, "anulata") {
                    return Err(bad("încasarea", "e deja anulată"));
                }
                let m = text("motivul", &a.motiv, 300, true)?;
                if m.chars().count() < 3 {
                    return Err(bad("motivul", "are cel puțin 3 caractere"));
                }
                let mut f = p.fields.clone();
                f.insert("anulata".into(), json!(true));
                f.insert("motiv".into(), json!(m));
                let version = ctx.write(vec![Write::put(PAYMENTS, a.id, f).expect(a.version)])?[0];
                Ok(json!({"id": a.id, "version": version}))
            }
            "situatie" => {
                let a: Month = args(command, a)?;
                self.situation(ctx, a.luna.trim())
            }
            "restante" => {
                let a: Today = args(command, a)?;
                let today = date_arg("ziua de azi", &a.azi)?;
                self.arrears(ctx, &today)
            }
            other => Err(bad("comanda", format!("„{other}” nu e cunoscută"))),
        }
    }
}
