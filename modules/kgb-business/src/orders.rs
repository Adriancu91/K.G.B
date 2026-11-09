//! Orders with approval (Etapa 7, step 7.4k-2; idea from the owner's ERP,
//! code written here): sales, purchase and transfer orders.
//!
//! - States: ciornă → așteaptă aprobare → aprobată → în livrare → gata, or
//!   anulată from any state before „gata”. A rejected approval goes back to
//!   ciornă. Rejecting and cancelling need a reason.
//! - Every change of state is kept in the order's history (from, to, when,
//!   reason); who did it is in the app's audit journal.
//! - Only a draft can be changed.
//! - From an accepted offer: the lines (and their prices) come from it; a
//!   line priced empty takes the offer's price; ordering more than the offer
//!   gives a warning, kept with the order (it does not block).

use std::collections::BTreeMap;

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use kgb_core::workspace::now_ms;
use kgb_store::{Fields, Write};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::invoices::PARTNERS;
use crate::offers::{OFFERS, OfferLine};
use crate::{Business, bad, date, i, live, num, s, text};

pub(crate) const ORDERS: &str = "comenzi";
pub const KINDS: [&str; 3] = ["vanzare", "cumparare", "transfer"];
pub const STATES: [&str; 6] = ["ciorna", "asteapta", "aprobata", "livrare", "gata", "anulata"];

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct OrderSave {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: Option<u64>,
    tip: String,
    #[serde(default)]
    partener: Option<Uuid>,
    data: String,
    #[serde(default)]
    oferta: Option<Uuid>,
    #[serde(default)]
    linii: Vec<OfferLine>,
    #[serde(default)]
    nota: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct OrderMove {
    id: Uuid,
    /// The state to go to.
    stare: String,
    #[serde(default)]
    motiv: Option<String>,
}

/// Whether an order may go from `from` to `to`.
pub fn allowed(from: &str, to: &str) -> bool {
    matches!(
        (from, to),
        ("ciorna", "asteapta")
            | ("asteapta", "aprobata")
            | ("asteapta", "ciorna")
            | ("aprobata", "livrare")
            | ("livrare", "gata")
            | ("ciorna" | "asteapta" | "aprobata" | "livrare", "anulata")
    )
}

fn fold(t: &str) -> String {
    t.trim().to_lowercase()
}

impl Business {
    pub(crate) fn order_save(&self, ctx: &mut ModuleContext<'_>, mut a: OrderSave) -> CoreResult<Value> {
        if !KINDS.contains(&a.tip.as_str()) {
            return Err(bad("tipul comenzii", "vanzare, cumparare sau transfer"));
        }
        let d = date(&a.data).ok_or_else(|| bad("data", format!("„{}” nu este o dată", a.data)))?;
        let partner = match (a.tip.as_str(), a.partener) {
            ("transfer", _) => None,
            (_, Some(p)) => Some(live(ctx, PARTNERS, p, "partenerul")?),
            (_, None) => return Err(bad("comanda", "alege clientul sau furnizorul")),
        };
        // From an accepted offer: its lines and prices; more than offered is a warning.
        let mut warnings = Vec::new();
        if let Some(oid) = a.oferta {
            let o = live(ctx, OFFERS, oid, "oferta")?;
            if s(&o, "stare") != "acceptata" {
                return Err(bad("oferta", "doar o ofertă acceptată devine comandă"));
            }
            if a.tip != "vanzare" {
                return Err(bad("oferta", "o ofertă devine comandă de vânzare"));
            }
            if partner.as_ref().map(|p| p.id.to_string()) != Some(s(&o, "partener")) {
                return Err(bad("oferta", "e pentru alt client"));
            }
            let offered: Vec<Value> = o.fields.get("linii").and_then(Value::as_array).cloned().unwrap_or_default();
            if a.linii.is_empty() {
                a.linii = offered
                    .iter()
                    .map(|l| OfferLine::new(
                        l["descriere"].as_str().unwrap_or_default(),
                        l["um"].as_str().unwrap_or("buc"),
                        &num::fmt_qty(l["cantitate"].as_i64().unwrap_or(0)),
                        &num::fmt_money(l["pret_unitar"].as_i64().unwrap_or(0)),
                        l["cota_tva"].as_i64().unwrap_or(21),
                    ))
                    .collect();
            }
            let mut by_desc: BTreeMap<String, (i64, i64)> = BTreeMap::new();
            for l in &offered {
                let e = by_desc.entry(fold(l["descriere"].as_str().unwrap_or_default())).or_insert((0, l["pret_unitar"].as_i64().unwrap_or(0)));
                e.0 += l["cantitate"].as_i64().unwrap_or(0);
            }
            let mut ordered: BTreeMap<String, i64> = BTreeMap::new();
            for l in &mut a.linii {
                let key = fold(l.description());
                if let Some((_, price)) = by_desc.get(&key)
                    && l.price_text().trim().is_empty()
                {
                    l.set_price(&num::fmt_money(*price));
                }
                *ordered.entry(key).or_default() += num::qty(l.quantity_text()).unwrap_or(0);
            }
            for (k, q) in &ordered {
                match by_desc.get(k) {
                    Some((offered_q, _)) if q > offered_q => warnings.push(format!(
                        "„{k}”: comandat {} față de {} în ofertă",
                        num::fmt_qty(*q),
                        num::fmt_qty(*offered_q)
                    )),
                    None => warnings.push(format!("„{k}” nu e în ofertă")),
                    _ => {}
                }
            }
        }
        let (lines, net, vat) = self.offer_lines(ctx, &a.linii)?;
        let nota = text(a.nota, "nota", 500, false)?;
        let (id, numar, history, expected) = match a.id {
            Some(id) => {
                let cur = live(ctx, ORDERS, id, "comanda")?;
                if s(&cur, "stare") != "ciorna" {
                    return Err(bad("comanda", "doar o ciornă se modifică"));
                }
                (id, i(&cur, "numar"), cur.fields.get("istoric").cloned().unwrap_or(json!([])), a.version.unwrap_or(cur.version))
            }
            None => {
                let n = ctx.scan(ORDERS, |_| true)?.iter().map(|o| i(o, "numar")).max().unwrap_or(0) + 1;
                (Uuid::now_v7(), n, json!([{"din": null, "in": "ciorna", "cand_ms": now_ms(), "motiv": null}]), 0)
            }
        };
        let mut f = Fields::new();
        f.insert("numar".into(), json!(numar));
        f.insert("tip".into(), json!(a.tip));
        f.insert("data".into(), json!(d));
        f.insert("partener".into(), partner.as_ref().map_or(Value::Null, |p| json!(p.id.to_string())));
        f.insert("partener_nume".into(), partner.as_ref().map_or(Value::Null, |p| json!(s(p, "nume"))));
        f.insert("oferta".into(), a.oferta.map_or(Value::Null, |o| json!(o.to_string())));
        f.insert("linii".into(), json!(lines));
        f.insert("total_fara_tva".into(), json!(net));
        f.insert("total_tva".into(), json!(vat));
        f.insert("total".into(), json!(net + vat));
        f.insert("stare".into(), json!("ciorna"));
        f.insert("istoric".into(), history);
        f.insert("avertismente".into(), json!(warnings));
        f.insert("nota".into(), nota);
        f.insert("creat_ms".into(), json!(now_ms()));
        ctx.write(vec![Write::put(ORDERS, id, f).expect(expected)])?;
        ctx.log("comandă salvată");
        Ok(json!({"id": id, "numar": format!("CMD {numar}"), "total_text": num::fmt_money(net + vat), "avertismente": warnings}))
    }

    pub(crate) fn order_move(&self, ctx: &mut ModuleContext<'_>, a: OrderMove) -> CoreResult<Value> {
        let o = live(ctx, ORDERS, a.id, "comanda")?;
        let from = s(&o, "stare");
        if !STATES.contains(&a.stare.as_str()) || !allowed(&from, &a.stare) {
            return Err(bad("comanda", format!("din „{from}” nu se poate trece în „{}”", a.stare)));
        }
        let needs_reason = a.stare == "anulata" || (from == "asteapta" && a.stare == "ciorna");
        let motiv = text(a.motiv, "motivul", 300, needs_reason)?;
        let mut hist = o.fields.get("istoric").and_then(Value::as_array).cloned().unwrap_or_default();
        hist.push(json!({"din": from, "in": a.stare, "cand_ms": now_ms(), "motiv": motiv}));
        let mut f = o.fields.clone();
        f.insert("stare".into(), json!(a.stare));
        f.insert("istoric".into(), json!(hist));
        ctx.write(vec![Write::put(ORDERS, o.id, f).expect(o.version)])?;
        ctx.log("comandă: stare schimbată");
        Ok(json!({"id": o.id, "stare": a.stare}))
    }

    pub(crate) fn orders(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let mut list = ctx.scan(ORDERS, |_| true)?;
        list.sort_by_key(|o| std::cmp::Reverse(i(o, "numar")));
        Ok(json!(list
            .iter()
            .map(|o| {
                let mut v = Value::Object(o.fields.clone());
                v["id"] = json!(o.id);
                v["version"] = json!(o.version);
                v["numar_text"] = json!(format!("CMD {}", i(o, "numar")));
                v["total_text"] = json!(num::fmt_money(i(o, "total")));
                v
            })
            .collect::<Vec<_>>()))
    }
}
