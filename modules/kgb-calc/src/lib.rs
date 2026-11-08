//! `kgb.calc` — calculator and conversions (Etapa 7, step 7.4; Master Plan
//! §6.12; D-065).
//!
//! - **Calculator**: `+ - × ÷ ( ) %` evaluated exactly (rational numbers), so
//!   0,1 + 0,2 is 0,3; the shown value is rounded to 10 decimals and marked
//!   „≈” when that rounding changed it. A short history is kept.
//! - **Conversions**: length, area, volume, mass, energy, temperature, with
//!   exact factors.
//! - **Everyday money calculations** in whole bani: VAT from net or from gross,
//!   markup and margin, percentages, simple interest. Each rounding is half
//!   away from zero, to the ban, and stated.
//!
//! Commands: `calc {expresie}`, `istoric`, `istoric_sterge`, `unitati`,
//! `convert {categorie, valoare, din, in}`, `tva {suma, cota, din: "net"|"brut"}`,
//! `adaos {cost, pret?, adaos?}`, `procent {tip, a, b}`, `dobanda {suma, rata, zile}`.

pub mod exact;
pub mod units;

use exact::{Q, eval};
use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.calc";
pub const HISTORY: &str = "istoric";
const HISTORY_MAX: usize = 200;
/// Decimals shown by the calculator.
pub const SHOWN: u32 = 10;

pub struct Calc {
    manifest: Manifest,
}

impl Calc {
    pub fn new() -> Calc {
        Calc {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Calc {
    fn default() -> Self {
        Calc::new()
    }
}

fn args<T: DeserializeOwned>(command: &str, v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid(format!("argumentele comenzii {command}"), e.to_string()))
}

fn bad(what: &str, detail: impl Into<String>) -> CoreError {
    CoreError::invalid(what, detail)
}

fn q(what: &str, s: &str) -> CoreResult<Q> {
    Q::parse(s).map_err(|e| bad(what, e))
}

fn e(what: &str) -> impl Fn(String) -> CoreError + '_ {
    move |x| bad(what, x)
}

/// Shown value: rounded to [`SHOWN`] decimals, with whether it is exact.
pub fn show(v: &Q) -> Result<(String, bool), String> {
    Ok((v.ro(SHOWN, false)?, v.exact_at(SHOWN)))
}

/// An amount in lei, rounded to the ban (half away from zero), as bani.
fn bani(v: &Q) -> Result<i128, String> {
    v.round_scaled(2)
}

fn lei(b: i128) -> String {
    Q::new(b, 100).and_then(|x| x.ro(2, true)).unwrap_or_default()
}

fn pct(v: &Q) -> Result<String, String> {
    v.ro(2, false)
}

impl Calc {
    fn calc(&self, ctx: &mut ModuleContext<'_>, expr: &str) -> CoreResult<Value> {
        let v = eval(expr).map_err(e("expresia"))?;
        let (shown, exact) = show(&v).map_err(e("rezultatul"))?;
        let mut f = Fields::new();
        f.insert(
            "expresie".into(),
            json!(expr.trim().chars().take(500).collect::<String>()),
        );
        f.insert("rezultat".into(), json!(shown));
        f.insert("exact".into(), json!(exact));
        f.insert("creat_ms".into(), json!(now_ms()));
        let mut batch = vec![Write::put(HISTORY, Uuid::now_v7(), f).expect(0)];
        // Keep the history short: the oldest go first.
        let mut all = ctx.scan(HISTORY, |_| true)?;
        if all.len() >= HISTORY_MAX {
            all.sort_by_key(|r| r.id);
            for r in all.iter().take(all.len() + 1 - HISTORY_MAX) {
                batch.push(Write::delete(HISTORY, r.id).expect(r.version));
            }
        }
        ctx.write(batch)?;
        Ok(json!({"rezultat": shown, "exact": exact}))
    }

    fn vat(&self, a: Value) -> CoreResult<Value> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct A {
            suma: String,
            cota: String,
            din: String,
        }
        let a: A = args("tva", a)?;
        let amount = bani(&q("suma", &a.suma)?).map_err(e("suma"))?;
        let rate = q("cota", &a.cota)?;
        if rate < Q::int(0) || rate > Q::int(100) {
            return Err(bad("cota", "trebuie să fie între 0 și 100%"));
        }
        let hundred = Q::int(100);
        let (net, vat, gross) = match a.din.as_str() {
            "net" => {
                let vat = bani(
                    &Q::new(amount, 100)
                        .and_then(|x| x.times(rate))
                        .and_then(|x| x.over(hundred))
                        .map_err(e("tva"))?,
                )
                .map_err(e("tva"))?;
                (amount, vat, amount + vat)
            }
            "brut" => {
                let net = bani(
                    &Q::new(amount, 100)
                        .and_then(|x| x.times(hundred))
                        .and_then(|x| x.over(hundred.plus(rate)?))
                        .map_err(e("tva"))?,
                )
                .map_err(e("tva"))?;
                (net, amount - net, amount)
            }
            _ => return Err(bad("tva", "pornește de la „net” sau „brut”")),
        };
        Ok(
            json!({"net": lei(net), "tva": lei(vat), "brut": lei(gross), "net_bani": net, "tva_bani": vat, "brut_bani": gross}),
        )
    }

    fn markup(&self, a: Value) -> CoreResult<Value> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct A {
            cost: String,
            #[serde(default)]
            pret: Option<String>,
            #[serde(default)]
            adaos: Option<String>,
        }
        let a: A = args("adaos", a)?;
        let cost = Q::new(bani(&q("costul", &a.cost)?).map_err(e("costul"))?, 100).map_err(e("costul"))?;
        if cost <= Q::int(0) {
            return Err(bad("costul", "trebuie să fie mai mare decât zero"));
        }
        let price = match (
            a.pret.as_deref().filter(|p| !p.trim().is_empty()),
            a.adaos.as_deref().filter(|p| !p.trim().is_empty()),
        ) {
            (Some(p), _) => Q::new(bani(&q("prețul", p)?).map_err(e("prețul"))?, 100).map_err(e("prețul"))?,
            (None, Some(m)) => {
                let m = q("adaosul", m)?;
                let p = cost
                    .times(Q::int(100).plus(m).map_err(e("adaosul"))?)
                    .and_then(|x| x.over(Q::int(100)))
                    .map_err(e("adaosul"))?;
                Q::new(bani(&p).map_err(e("prețul"))?, 100).map_err(e("prețul"))?
            }
            (None, None) => return Err(bad("adaosul", "dă prețul de vânzare sau procentul de adaos")),
        };
        if price <= Q::int(0) {
            return Err(bad("prețul", "trebuie să fie mai mare decât zero"));
        }
        let profit = price.minus(cost).map_err(e("adaosul"))?;
        let markup = profit
            .times(Q::int(100))
            .and_then(|x| x.over(cost))
            .map_err(e("adaosul"))?;
        let margin = profit
            .times(Q::int(100))
            .and_then(|x| x.over(price))
            .map_err(e("marja"))?;
        Ok(json!({
            "cost": lei(bani(&cost).map_err(e("costul"))?),
            "pret": lei(bani(&price).map_err(e("prețul"))?),
            "profit": lei(bani(&profit).map_err(e("profitul"))?),
            "adaos_pct": pct(&markup).map_err(e("adaosul"))?,
            "marja_pct": pct(&margin).map_err(e("marja"))?,
        }))
    }

    fn percent(&self, a: Value) -> CoreResult<Value> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct A {
            tip: String,
            a: String,
            b: String,
        }
        let a: A = args("procent", a)?;
        let (x, y) = (q("primul număr", &a.a)?, q("al doilea număr", &a.b)?);
        let hundred = Q::int(100);
        let r = match a.tip.as_str() {
            // x% din y
            "din" => x.times(y).and_then(|v| v.over(hundred)),
            // x reprezintă ce % din y
            "cat_la_suta" => x.times(hundred).and_then(|v| v.over(y)),
            // creșterea de la x la y, în %
            "variatie" => y.minus(x).and_then(|v| v.times(hundred)).and_then(|v| v.over(x)),
            _ => return Err(bad("procentul", "tipul nu există (din, cat_la_suta, variatie)")),
        }
        .map_err(e("procentul"))?;
        let (shown, exact) = show(&r).map_err(e("procentul"))?;
        Ok(json!({"rezultat": shown, "exact": exact}))
    }

    fn interest(&self, a: Value) -> CoreResult<Value> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct A {
            suma: String,
            rata: String,
            zile: i64,
        }
        let a: A = args("dobanda", a)?;
        if !(0..=36_500).contains(&a.zile) {
            return Err(bad("zilele", "trebuie să fie între 0 și 36.500"));
        }
        let principal = bani(&q("suma", &a.suma)?).map_err(e("suma"))?;
        let rate = q("rata", &a.rata)?;
        // Simple interest, actual days / 365.
        let i = Q::new(principal, 100)
            .and_then(|p| p.times(rate))
            .and_then(|v| v.times(Q::int(a.zile as i128)))
            .and_then(|v| v.over(Q::int(100 * 365)))
            .map_err(e("dobânda"))?;
        let ib = bani(&i).map_err(e("dobânda"))?;
        Ok(json!({"dobanda": lei(ib), "total": lei(principal + ib), "dobanda_bani": ib}))
    }
}

impl Module for Calc {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "calc" => {
                #[derive(Deserialize)]
                struct A {
                    expresie: String,
                }
                let a: A = args(command, a)?;
                self.calc(ctx, &a.expresie)
            }
            "istoric" => {
                let mut v = ctx.scan(HISTORY, |_| true)?;
                v.sort_by_key(|r| std::cmp::Reverse(r.id));
                Ok(json!(v.iter().take(50).map(|r| Value::Object(r.fields.clone())).collect::<Vec<_>>()))
            }
            "istoric_sterge" => {
                let all = ctx.scan(HISTORY, |_| true)?;
                let n = all.len();
                if n > 0 {
                    ctx.write(all.iter().map(|r| Write::delete(HISTORY, r.id).expect(r.version)).collect())?;
                }
                Ok(json!({"sterse": n}))
            }
            "unitati" => Ok(json!(
                units::CATEGORIES
                    .iter()
                    .map(|(c, l, us)| json!({"id": c, "nume": l, "unitati": us.iter().map(|(u, n, _)| json!({"id": u, "nume": n})).collect::<Vec<_>>()}))
                    .collect::<Vec<_>>()
            )),
            "convert" => {
                #[derive(Deserialize)]
                #[serde(deny_unknown_fields)]
                struct A {
                    categorie: String,
                    valoare: String,
                    din: String,
                    #[serde(rename = "in")]
                    catre: String,
                }
                let a: A = args(command, a)?;
                let v = units::convert(&a.categorie, q("valoarea", &a.valoare)?, &a.din, &a.catre).map_err(e("conversia"))?;
                let (shown, exact) = show(&v).map_err(e("conversia"))?;
                Ok(json!({"rezultat": shown, "exact": exact}))
            }
            "tva" => self.vat(a),
            "adaos" => self.markup(a),
            "procent" => self.percent(a),
            "dobanda" => self.interest(a),
            _ => Err(bad("comanda", format!("„{command}” nu există în modulul {ID}"))),
        }
    }
}
