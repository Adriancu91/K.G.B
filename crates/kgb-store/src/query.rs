//! Structured queries (Etapa 2, step 2.3).
//!
//! A [`Query`] is plain data (serialisable), so modules and the UI can build
//! it without running code inside the store. It is evaluated with **partial
//! decoding**: each candidate record is parsed only far enough to borrow its
//! raw fields, and only the fields the filter mentions are decoded. Records
//! that match are then decoded fully. An equality on an indexed field narrows
//! the candidates through the index first.

use std::borrow::Cow;
use std::cmp::Ordering;
use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use serde_json::value::RawValue;
use uuid::Uuid;

use crate::error::{Error, Result};
use crate::model::RecordState;
use crate::store::{Loc, Store};

/// One condition on a record's fields.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
pub enum Cond {
    Eq {
        field: String,
        value: Value,
    },
    Ne {
        field: String,
        value: Value,
    },
    Lt {
        field: String,
        value: Value,
    },
    Le {
        field: String,
        value: Value,
    },
    Gt {
        field: String,
        value: Value,
    },
    Ge {
        field: String,
        value: Value,
    },
    In {
        field: String,
        values: Vec<Value>,
    },
    /// Case-insensitive substring match on a text field.
    Contains {
        field: String,
        text: String,
    },
    /// The field is present and not null.
    Exists {
        field: String,
    },
    And {
        all: Vec<Cond>,
    },
    Or {
        any: Vec<Cond>,
    },
    Not {
        cond: Box<Cond>,
    },
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Sort {
    pub field: String,
    #[serde(default)]
    pub desc: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Query {
    #[serde(default)]
    pub filter: Option<Cond>,
    #[serde(default)]
    pub sort: Option<Sort>,
    #[serde(default)]
    pub offset: usize,
    #[serde(default)]
    pub limit: Option<usize>,
}

#[derive(Debug)]
pub struct QueryResult {
    /// The requested page of matching records.
    pub records: Vec<RecordState>,
    /// All matches before `offset`/`limit`.
    pub total: usize,
    /// True if an index narrowed the candidates.
    pub used_index: bool,
}

/// Raw view of an op: only the record id and its fields, borrowed.
#[derive(Deserialize)]
struct RawOp<'a> {
    #[serde(borrow)]
    s: RawState<'a>,
}

#[derive(Deserialize)]
struct RawState<'a> {
    #[serde(borrow)]
    f: HashMap<Cow<'a, str>, &'a RawValue>,
}

const MAX_DEPTH: usize = 16;

impl Cond {
    fn check_depth(&self, depth: usize) -> Result<()> {
        if depth > MAX_DEPTH {
            return Err(Error::InvalidInput(format!("query nested deeper than {MAX_DEPTH}")));
        }
        match self {
            Cond::And { all: v } | Cond::Or { any: v } => v.iter().try_for_each(|c| c.check_depth(depth + 1)),
            Cond::Not { cond } => cond.check_depth(depth + 1),
            _ => Ok(()),
        }
    }

    /// An equality usable with an index: the filter itself, or a direct child of a top-level `And`.
    /// Only text and boolean values: the index keys numbers by their text form, so
    /// `1` and `1.0` would differ there while the filter treats them as equal.
    fn index_candidates(&self) -> Vec<(&str, &Value)> {
        let all = match self {
            Cond::Eq { field, value } => vec![(field.as_str(), value)],
            Cond::And { all } => all
                .iter()
                .filter_map(|c| match c {
                    Cond::Eq { field, value } => Some((field.as_str(), value)),
                    _ => None,
                })
                .collect(),
            _ => Vec::new(),
        };
        all.into_iter()
            .filter(|(_, v)| v.is_string() || v.is_boolean())
            .collect()
    }
}

/// Field values of one record, decoded on first use.
struct Lazy<'a> {
    raw: &'a HashMap<Cow<'a, str>, &'a RawValue>,
    cache: Vec<(&'a str, Option<Value>)>,
}

impl<'a> Lazy<'a> {
    fn get(&mut self, field: &'a str) -> Result<Option<&Value>> {
        if let Some(i) = self.cache.iter().position(|(f, _)| *f == field) {
            return Ok(self.cache[i].1.as_ref());
        }
        let v = match self.raw.get(field) {
            Some(r) => Some(serde_json::from_str::<Value>(r.get())?),
            None => None,
        };
        self.cache.push((field, v));
        Ok(self.cache.last().and_then(|(_, v)| v.as_ref()))
    }
}

fn num(v: &Value) -> Option<f64> {
    v.as_f64()
}

/// Ordering used by comparisons and sorting: numbers numerically, strings
/// lexicographically, booleans false < true. Mixed types do not compare.
pub fn compare(a: &Value, b: &Value) -> Option<Ordering> {
    match (a, b) {
        (Value::Number(_), Value::Number(_)) => num(a)?.partial_cmp(&num(b)?),
        (Value::String(x), Value::String(y)) => Some(x.cmp(y)),
        (Value::Bool(x), Value::Bool(y)) => Some(x.cmp(y)),
        (Value::Null, Value::Null) => Some(Ordering::Equal),
        _ => None,
    }
}

fn equal(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Number(_), Value::Number(_)) => num(a) == num(b),
        _ => a == b,
    }
}

fn eval<'a>(c: &'a Cond, rec: &mut Lazy<'a>) -> Result<bool> {
    let cmp = |rec: &mut Lazy<'a>, field: &'a str, value: &Value, ok: fn(Ordering) -> bool| -> Result<bool> {
        Ok(rec.get(field)?.and_then(|v| compare(v, value)).is_some_and(ok))
    };
    Ok(match c {
        Cond::Eq { field, value } => rec.get(field)?.is_some_and(|v| equal(v, value)),
        Cond::Ne { field, value } => !rec.get(field)?.is_some_and(|v| equal(v, value)),
        Cond::Lt { field, value } => cmp(rec, field, value, |o| o == Ordering::Less)?,
        Cond::Le { field, value } => cmp(rec, field, value, |o| o != Ordering::Greater)?,
        Cond::Gt { field, value } => cmp(rec, field, value, |o| o == Ordering::Greater)?,
        Cond::Ge { field, value } => cmp(rec, field, value, |o| o != Ordering::Less)?,
        Cond::In { field, values } => rec.get(field)?.is_some_and(|v| values.iter().any(|x| equal(v, x))),
        Cond::Contains { field, text } => rec
            .get(field)?
            .and_then(Value::as_str)
            .is_some_and(|s| s.to_lowercase().contains(&text.to_lowercase())),
        Cond::Exists { field } => rec.get(field)?.is_some_and(|v| !v.is_null()),
        Cond::And { all } => {
            for c in all {
                if !eval(c, rec)? {
                    return Ok(false);
                }
            }
            true
        }
        Cond::Or { any } => {
            for c in any {
                if eval(c, rec)? {
                    return Ok(true);
                }
            }
            false
        }
        Cond::Not { cond } => !eval(cond, rec)?,
    })
}

/// Evaluates `filter` against a record that is already fully decoded.
pub fn matches(filter: &Cond, state: &RecordState) -> bool {
    let raw: HashMap<Cow<'_, str>, Box<RawValue>> = state
        .fields
        .iter()
        .filter_map(|(k, v)| {
            serde_json::value::to_raw_value(v)
                .ok()
                .map(|r| (Cow::Borrowed(k.as_str()), r))
        })
        .collect();
    let borrowed: HashMap<Cow<'_, str>, &RawValue> = raw.iter().map(|(k, v)| (k.clone(), v.as_ref())).collect();
    let mut lazy = Lazy {
        raw: &borrowed,
        cache: Vec::new(),
    };
    eval(filter, &mut lazy).unwrap_or(false)
}

/// Total order for sorting: numbers, then text, then booleans; null, missing,
/// lists and objects always last (in either direction).
fn sort_order(a: Option<&Value>, b: Option<&Value>, desc: bool) -> Ordering {
    fn rank(v: Option<&Value>) -> u8 {
        match v {
            Some(Value::Number(_)) => 0,
            Some(Value::String(_)) => 1,
            Some(Value::Bool(_)) => 2,
            _ => 3,
        }
    }
    let (ra, rb) = (rank(a), rank(b));
    if ra != rb {
        return ra.cmp(&rb);
    }
    if ra == 3 {
        return Ordering::Equal;
    }
    let o = compare(a.expect("ranked"), b.expect("ranked")).unwrap_or(Ordering::Equal);
    if desc { o.reverse() } else { o }
}

impl Store {
    /// Runs a structured query on one collection.
    pub fn query(&self, coll: &str, q: &Query) -> Result<QueryResult> {
        if let Some(f) = &q.filter {
            f.check_depth(0)?;
        }
        // Narrow through an index when an indexed equality is available.
        let mut used_index = false;
        let mut candidates: Option<Vec<Uuid>> = None;
        if let Some(f) = &q.filter {
            for (field, value) in f.index_candidates() {
                if let Some(ids) = self.indexes.lookup(coll, field, value) {
                    used_index = true;
                    candidates = Some(match candidates {
                        None => ids,
                        Some(prev) => {
                            let set: std::collections::HashSet<Uuid> = ids.into_iter().collect();
                            prev.into_iter().filter(|id| set.contains(id)).collect()
                        }
                    });
                }
            }
        }
        let locs: Vec<Loc> = match candidates {
            Some(ids) => ids
                .iter()
                .filter_map(|id| self.keydir.get(coll, id))
                .filter(|l| !l.deleted)
                .copied()
                .collect(),
            None => self.keydir.live(coll).map(|(_, l)| l).collect(),
        };

        let mut records = Vec::new();
        self.read_payloads(locs, |payload| {
            let keep = match &q.filter {
                None => true,
                Some(f) => {
                    let raw: RawOp<'_> = serde_json::from_slice(payload)?;
                    let mut lazy = Lazy {
                        raw: &raw.s.f,
                        cache: Vec::new(),
                    };
                    eval(f, &mut lazy)?
                }
            };
            if keep {
                records.push(Store::decode_state(payload)?);
            }
            Ok(())
        })?;

        if let Some(s) = &q.sort {
            records.sort_by(|a, b| {
                sort_order(a.fields.get(&s.field), b.fields.get(&s.field), s.desc).then(a.id.cmp(&b.id))
            });
        } else {
            records.sort_by_key(|r| r.id);
        }
        let total = records.len();
        let page: Vec<RecordState> = records
            .into_iter()
            .skip(q.offset)
            .take(q.limit.unwrap_or(usize::MAX))
            .collect();
        Ok(QueryResult {
            records: page,
            total,
            used_index,
        })
    }
}
