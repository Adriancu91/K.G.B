//! Stock value at weighted average cost (step 5.2; D-050), recomputed from
//! the movements every time — never stored, so it cannot drift.
//!
//! Per product and warehouse the replay keeps the quantity Q and the total
//! value V (bani). In time order (movement ids are time-ordered):
//! - a **receipt** adds q at its unit price: V += q × price;
//! - an **outflow** (issue, transfer out, inventory minus) takes its share of
//!   the value: q × V / Q, rounded to the ban; the last unit out takes all
//!   of what is left, so V is exactly 0 when Q is 0 (no stray bani);
//! - a **transfer in** brings the exact value that left the source;
//! - an **inventory plus** comes in at the current average (0 if none);
//! - a **storno** movement reverses exactly the value of the movement it
//!   cancels.
//!
//! The average cost shown is V / Q, rounded to the ban, for display only.

use std::collections::BTreeMap;

use kgb_store::RecordState;
use serde_json::Value;
use uuid::Uuid;

use crate::num::{self, Money, Qty};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Position {
    pub qty: Qty,
    pub value: Money,
}

impl Position {
    /// Average cost per unit (bani), when there is stock.
    pub fn average(&self) -> Option<Money> {
        (self.qty > 0).then(|| num::div_round(self.value as i128 * num::QTY_SCALE as i128, self.qty as i128) as Money)
    }
}

pub struct Replay {
    /// (product, warehouse) → position.
    pub positions: BTreeMap<(String, String), Position>,
    /// Value of each movement (bani, signed like its quantity).
    pub moves: BTreeMap<Uuid, Money>,
}

fn s(r: &RecordState, k: &str) -> String {
    r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn id(r: &RecordState, k: &str) -> Option<Uuid> {
    r.fields.get(k).and_then(Value::as_str).and_then(|x| x.parse().ok())
}

pub fn replay(moves: &[RecordState]) -> Replay {
    let mut ordered: Vec<&RecordState> = moves.iter().filter(|m| !m.deleted).collect();
    ordered.sort_by_key(|m| m.id);
    let mut positions: BTreeMap<(String, String), Position> = BTreeMap::new();
    let mut values: BTreeMap<Uuid, Money> = BTreeMap::new();
    for m in ordered {
        let q: Qty = m.fields.get("cantitate").and_then(Value::as_i64).unwrap_or_default();
        let key = (s(m, "produs"), s(m, "depozit"));
        let pos = positions.entry(key).or_default();
        let value: Money = if let Some(orig) = id(m, "storno_de_miscare") {
            -values.get(&orig).copied().unwrap_or(0)
        } else if q > 0 {
            if let Some(price) = m.fields.get("pret_unitar").and_then(Value::as_i64) {
                num::value(q, price)
            } else if let Some(out) = id(m, "pereche") {
                -values.get(&out).copied().unwrap_or(0)
            } else if pos.qty > 0 {
                num::div_round(q as i128 * pos.value as i128, pos.qty as i128) as Money
            } else {
                0
            }
        } else if q < 0 {
            if -q >= pos.qty {
                -pos.value
            } else if pos.qty > 0 {
                -(num::div_round(-q as i128 * pos.value as i128, pos.qty as i128) as Money)
            } else {
                0
            }
        } else {
            0
        };
        pos.qty += q;
        pos.value += value;
        values.insert(m.id, value);
    }
    Replay {
        positions,
        moves: values,
    }
}
