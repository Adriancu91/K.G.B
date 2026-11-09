//! Reserved and blocked stock (Etapa 7, step 7.4k-3; idea from the owner's
//! ERP, code written here).
//!
//! - A reservation keeps a quantity of a product in a warehouse for an order
//!   (not finished, not cancelled); a block keeps it aside for a reason
//!   (damaged, under inspection, disputed…).
//! - Neither can be more than what is free (stock − reserved − blocked).
//! - Stock that is reserved or blocked does not leave through an ordinary
//!   issue or transfer: the issue would take what is free only.
//! - A reservation is released by itself when its order goes into delivery,
//!   is finished or is cancelled (in the same write as the order's change);
//!   anything can be released by hand, with a reason for a block.
//! - Every hold keeps its history (made, released, when, why).

use std::collections::BTreeMap;

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use kgb_core::workspace::now_ms;
use kgb_store::{Fields, Write};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::orders::ORDERS;
use crate::{Business, PRODUCTS, WAREHOUSES, bad, i, live, num, s, text};

pub(crate) const HOLDS: &str = "rezervari";

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct HoldSave {
    produs: Uuid,
    depozit: Uuid,
    cantitate: String,
    /// `rezervare` (for an order) or `blocare` (with a reason).
    tip: String,
    #[serde(default)]
    comanda: Option<Uuid>,
    #[serde(default)]
    motiv: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct HoldRelease {
    id: Uuid,
    #[serde(default)]
    motiv: Option<String>,
}

/// Reserved and blocked quantities per (product, warehouse).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Held {
    pub reserved: i64,
    pub blocked: i64,
}

impl Held {
    pub fn total(self) -> i64 {
        self.reserved + self.blocked
    }
}

impl Business {
    /// What is held (active reservations and blocks) per (product, warehouse).
    pub(crate) fn held(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<BTreeMap<(String, String), Held>> {
        let mut out: BTreeMap<(String, String), Held> = BTreeMap::new();
        for h in ctx.scan(HOLDS, |r| r.fields.get("activa") == Some(&json!(true)))? {
            let e = out.entry((s(&h, "produs"), s(&h, "depozit"))).or_default();
            if s(&h, "tip") == "blocare" {
                e.blocked += i(&h, "cantitate");
            } else {
                e.reserved += i(&h, "cantitate");
            }
        }
        Ok(out)
    }

    pub(crate) fn hold_save(&self, ctx: &mut ModuleContext<'_>, a: HoldSave) -> CoreResult<Value> {
        let p = live(ctx, PRODUCTS, a.produs, "produsul")?;
        let w = live(ctx, WAREHOUSES, a.depozit, "depozitul")?;
        let q = num::qty(&a.cantitate).filter(|q| *q > 0).ok_or_else(|| bad("cantitatea", format!("„{}” nu e un număr pozitiv", a.cantitate)))?;
        let (comanda, motiv) = match a.tip.as_str() {
            "rezervare" => {
                let oid = a.comanda.ok_or_else(|| bad("rezervarea", "alege comanda pentru care se rezervă"))?;
                let o = live(ctx, ORDERS, oid, "comanda")?;
                if ["gata", "anulata"].contains(&s(&o, "stare").as_str()) {
                    return Err(bad("rezervarea", "comanda e terminată sau anulată"));
                }
                (json!(oid.to_string()), text(a.motiv, "motivul", 300, false)?)
            }
            "blocare" => (Value::Null, text(a.motiv, "motivul blocării", 300, true)?),
            _ => return Err(bad("tipul", "rezervare sau blocare")),
        };
        let have = self.balances(ctx)?.get(&(p.id.to_string(), w.id.to_string())).copied().unwrap_or(0);
        let held = self.held(ctx)?.get(&(p.id.to_string(), w.id.to_string())).copied().unwrap_or_default();
        let free = have - held.total();
        if q > free {
            return Err(bad(
                "stocul",
                format!("„{}” în „{}”: liber {} (stoc {}, rezervat {}, blocat {}), se cer {}", s(&p, "nume"), s(&w, "nume"), num::fmt_qty(free), num::fmt_qty(have), num::fmt_qty(held.reserved), num::fmt_qty(held.blocked), num::fmt_qty(q)),
            ));
        }
        let mut f = Fields::new();
        f.insert("tip".into(), json!(a.tip));
        f.insert("produs".into(), json!(p.id.to_string()));
        f.insert("depozit".into(), json!(w.id.to_string()));
        f.insert("cantitate".into(), json!(q));
        f.insert("comanda".into(), comanda);
        f.insert("motiv".into(), motiv.clone());
        f.insert("activa".into(), json!(true));
        f.insert("istoric".into(), json!([{"actiune": if a.tip == "blocare" { "blocat" } else { "rezervat" }, "cand_ms": now_ms(), "motiv": motiv}]));
        f.insert("creat_ms".into(), json!(now_ms()));
        let id = Uuid::now_v7();
        ctx.write(vec![Write::put(HOLDS, id, f).expect(0)])?;
        ctx.log(if a.tip == "blocare" { "stoc blocat" } else { "stoc rezervat" });
        Ok(json!({"id": id, "liber_ramas": free - q}))
    }

    /// The write that releases one hold (not written yet).
    pub(crate) fn release_write(&self, h: &kgb_store::RecordState, why: Value) -> Write {
        let mut f = h.fields.clone();
        let mut hist = f.get("istoric").and_then(Value::as_array).cloned().unwrap_or_default();
        hist.push(json!({"actiune": "eliberat", "cand_ms": now_ms(), "motiv": why}));
        f.insert("activa".into(), json!(false));
        f.insert("istoric".into(), json!(hist));
        Write::put(HOLDS, h.id, f).expect(h.version)
    }

    pub(crate) fn hold_release(&self, ctx: &mut ModuleContext<'_>, a: HoldRelease) -> CoreResult<Value> {
        let h = live(ctx, HOLDS, a.id, "rezervarea")?;
        if h.fields.get("activa") != Some(&json!(true)) {
            return Err(bad("rezervarea", "e deja eliberată"));
        }
        let why = text(a.motiv, "motivul", 300, s(&h, "tip") == "blocare")?;
        let w = self.release_write(&h, why);
        ctx.write(vec![w])?;
        ctx.log("stoc eliberat");
        Ok(json!({"id": h.id}))
    }

    /// The active reservations of an order, released when it moves on.
    pub(crate) fn order_release_writes(&self, ctx: &mut ModuleContext<'_>, order: Uuid, why: &str) -> CoreResult<Vec<Write>> {
        let key = json!(order.to_string());
        let holds = ctx.scan(HOLDS, |r| r.fields.get("comanda") == Some(&key) && r.fields.get("activa") == Some(&json!(true)))?;
        Ok(holds.iter().map(|h| self.release_write(h, json!(why))).collect())
    }

    pub(crate) fn holds(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let products: BTreeMap<String, String> = ctx.scan(PRODUCTS, |_| true)?.iter().map(|p| (p.id.to_string(), s(p, "nume"))).collect();
        let warehouses: BTreeMap<String, String> = ctx.scan(WAREHOUSES, |_| true)?.iter().map(|w| (w.id.to_string(), s(w, "nume"))).collect();
        let orders: BTreeMap<String, i64> = ctx.scan(ORDERS, |_| true)?.iter().map(|o| (o.id.to_string(), i(o, "numar"))).collect();
        let mut list = ctx.scan(HOLDS, |_| true)?;
        list.sort_by_key(|h| std::cmp::Reverse(h.id));
        Ok(json!(list
            .iter()
            .map(|h| {
                let mut v = Value::Object(h.fields.clone());
                v["id"] = json!(h.id);
                v["produs_nume"] = json!(products.get(&s(h, "produs")).cloned().unwrap_or_default());
                v["depozit_nume"] = json!(warehouses.get(&s(h, "depozit")).cloned().unwrap_or_default());
                v["cantitate_text"] = json!(num::fmt_qty(i(h, "cantitate")));
                v["comanda_text"] = orders.get(&s(h, "comanda")).map_or(Value::Null, |n| json!(format!("CMD {n}")));
                v
            })
            .collect::<Vec<_>>()))
    }
}
