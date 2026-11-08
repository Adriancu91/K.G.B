//! Replication between two copies of a workspace by exchanging journal ops.
//!
//! Rules (Master Plan §8.6):
//! - each change carries its origin (device, seq) and the revisions it was based on;
//! - a change based on exactly our current state is applied as is (fast-forward);
//! - concurrent changes to *different* fields merge deterministically;
//! - concurrent changes to the *same* field, or edit vs delete, are conflicts:
//!   a deterministic provisional value is kept (highest revision) and a conflict
//!   record is stored for the user to decide. Nothing is overwritten silently.
//!
//! **Partial replication (Etapa 6, step 6.3).** A device may not be allowed to
//! see every change (its role). Instead of the change it receives a
//! *redaction marker*: an op with the same origin (device, seq) in the system
//! collection [`REDACTED`], carrying only the original collection name. The
//! per-device sequence stays complete (no gaps), markers are forwarded like
//! any change, and the real change can arrive later ([`Store::fill`]) — for
//! example when the role is widened, or from a peer that is allowed to send
//! it. A filled marker is then sent as the real change.

use std::collections::BTreeMap;
use std::fs;

use serde_json::{Value, json};
use uuid::Uuid;

use crate::error::{Error, Result};
use crate::frame::{self, Decoded};
use crate::model::{DELETED_FIELD, DeviceId, Op, Origin, RecordState, Rev};
use crate::store::{Durability, Store};

pub const CONFLICTS: &str = "_conflicts";
/// Decision records live in `<collection>~conflicts`, with the conflict's id.
pub const DECISIONS_SUFFIX: &str = "~conflicts";

pub fn decisions_coll(coll: &str) -> String {
    format!("{coll}{DECISIONS_SUFFIX}")
}

/// Redaction markers (see the module documentation).
pub const REDACTED: &str = "_sync.redacted";

/// The marker that stands in for `op`: same origin and revision, no content
/// except the original collection name.
pub fn redact(op: &Op) -> Op {
    if op.state.coll == REDACTED {
        return op.clone();
    }
    let Origin(dev, seq) = op.origin;
    let id = Uuid::from_bytes(
        *blake3::hash(format!("redacted|{dev}|{seq}").as_bytes())
            .as_bytes()
            .first_chunk::<16>()
            .unwrap(),
    );
    let mut fields = crate::model::Fields::new();
    fields.insert("coll".into(), Value::String(op.state.coll.clone()));
    fields.insert("dev".into(), Value::from(dev));
    fields.insert("seq".into(), Value::from(seq));
    Op {
        state: RecordState {
            coll: REDACTED.into(),
            id,
            version: 1,
            rev: op.state.rev,
            deleted: false,
            fields,
            field_revs: BTreeMap::new(),
        },
        origin: op.origin,
        record_base: None,
        changed: BTreeMap::new(),
        compacted: false,
    }
}

/// Whether `op` is a redaction marker.
pub fn is_redacted(op: &Op) -> bool {
    op.state.coll == REDACTED
}

pub type VersionVector = BTreeMap<DeviceId, u64>;

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct SyncReport {
    pub created: usize,
    pub fast_forward: usize,
    pub merged: usize,
    pub identical: usize,
    pub skipped: usize,
    pub conflicts: usize,
    /// Redaction markers stored (changes this copy may not see, or not yet).
    pub redacted: usize,
    /// Markers replaced by the real change.
    pub filled: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Conflict {
    pub id: Uuid,
    pub coll: String,
    pub record: Uuid,
    pub field: String,
    pub local: Value,
    pub remote: Value,
    pub provisional: String,
    pub resolved: bool,
}

struct FieldConflict {
    field: String,
    local: Value,
    local_rev: Option<Rev>,
    remote: Value,
    remote_rev: Option<Rev>,
}

enum Outcome {
    Created,
    FastForward,
    Merged,
    Identical,
}

impl Store {
    /// What this copy has seen from every device (including itself).
    pub fn version_vector(&self) -> VersionVector {
        let mut v = self.applied.clone();
        v.insert(self.device(), self.local_seq);
        v
    }

    /// All synchronisable changes the peer with version vector `vv` has not seen,
    /// in journal order (which preserves causality).
    pub fn changes_since(&self, vv: &VersionVector) -> Result<Vec<Op>> {
        for (&dev, &floor) in &self.manifest.compaction_floor {
            let have = vv.get(&dev).copied().unwrap_or(0);
            if have < floor {
                return Err(Error::HistoryCompacted {
                    device: dev,
                    have_from: floor,
                    asked_from: have,
                });
            }
        }
        let mut out = Vec::new();
        // Late fills are sent in place of their marker, so every device's
        // changes stay in sequence order.
        let mut fills: BTreeMap<(DeviceId, u64), Op> = BTreeMap::new();
        for &seg in &self.manifest.segments {
            let buf = fs::read(self.seg_path(seg))?;
            let mut off = 0;
            while let Decoded::Frame { payload, next, .. } = frame::decode_at(&buf, off) {
                let op: Op = crate::codec::decode_op(payload)?;
                let Origin(dev, seq) = op.origin;
                if !op.compacted && seq > 0 && seq > vv.get(&dev).copied().unwrap_or(0) {
                    if dev != self.device() && !is_redacted(&op) && self.late.contains(&(dev, seq)) {
                        fills.insert((dev, seq), op);
                    } else {
                        out.push(op);
                    }
                }
                off = next;
            }
        }
        for op in &mut out {
            if is_redacted(op) {
                let Origin(dev, seq) = op.origin;
                if let Some(real) = fills.remove(&(dev, seq)) {
                    *op = real;
                }
            }
        }
        Ok(out)
    }

    /// Redaction markers not yet filled: the (device, seq) of changes this
    /// copy knows exist but has not received.
    pub fn unfilled(&self) -> Result<Vec<(DeviceId, u64)>> {
        let mut v = Vec::new();
        for id in self.ids(REDACTED) {
            let Some(st) = self.get(REDACTED, id)? else { continue };
            let dev = st.fields.get("dev").and_then(Value::as_u64).unwrap_or(0);
            let seq = st.fields.get("seq").and_then(Value::as_u64).unwrap_or(0);
            if !self.late.contains(&(dev, seq)) {
                v.push((dev, seq));
            }
        }
        v.sort();
        Ok(v)
    }

    /// The real changes for the given (device, seq), if this copy has them
    /// (not as a marker). Used to answer a peer's unfilled markers.
    pub fn changes_at(&self, wanted: &[(DeviceId, u64)]) -> Result<Vec<Op>> {
        if wanted.is_empty() {
            return Ok(vec![]);
        }
        let want: std::collections::BTreeSet<_> = wanted.iter().copied().collect();
        let mut found: BTreeMap<(DeviceId, u64), Op> = BTreeMap::new();
        for &seg in &self.manifest.segments {
            let buf = fs::read(self.seg_path(seg))?;
            let mut off = 0;
            while let Decoded::Frame { payload, next, .. } = frame::decode_at(&buf, off) {
                let op: Op = crate::codec::decode_op(payload)?;
                let Origin(dev, seq) = op.origin;
                if !op.compacted && !is_redacted(&op) && want.contains(&(dev, seq)) {
                    found.insert((dev, seq), op);
                }
                off = next;
            }
        }
        Ok(found.into_values().collect())
    }

    /// Replaces unfilled markers with the real changes (merged like any remote
    /// change). Changes without an unfilled marker here are ignored.
    pub fn fill(&mut self, ops: Vec<Op>) -> Result<SyncReport> {
        let mut report = SyncReport::default();
        let open: std::collections::BTreeSet<_> = self.unfilled()?.into_iter().collect();
        for op in ops {
            let Origin(dev, seq) = op.origin;
            if is_redacted(&op) || op.compacted || !open.contains(&(dev, seq)) || self.late.contains(&(dev, seq)) {
                report.skipped += 1;
                continue;
            }
            self.hlc.observe(op.state.rev.0);
            let local = match self.keydir.get(&op.state.coll, &op.state.id) {
                Some(l) => Some(self.read_state_at(l)?),
                None => None,
            };
            let (state, _, conflicts) = merge(local.as_ref(), &op);
            let stored = Op {
                state,
                origin: op.origin,
                record_base: op.record_base,
                changed: op.changed.clone(),
                compacted: false,
            };
            self.append_txn(std::slice::from_ref(&stored), false)?;
            self.note_decision(&stored)?;
            report.filled += 1;
            for c in conflicts {
                if self.record_conflict(&stored.state, c)? {
                    report.conflicts += 1;
                }
            }
        }
        if self.opts.durability == Durability::Sync {
            self.flush()?;
        }
        Ok(report)
    }

    /// Apply changes received from a peer. Each change becomes a local journal entry
    /// keeping its original origin, so it is never applied twice.
    pub fn apply_remote(&mut self, ops: Vec<Op>) -> Result<SyncReport> {
        let mut report = SyncReport::default();
        let me = self.device();
        for op in ops {
            let Origin(dev, seq) = op.origin;
            if dev == me {
                report.skipped += 1;
                continue;
            }
            if seq == 0 || op.compacted {
                return Err(Error::InvalidInput(
                    "local-only or compacted op cannot be synchronised".into(),
                ));
            }
            let have = self.applied.get(&dev).copied().unwrap_or(0);
            if seq <= have {
                report.skipped += 1;
                continue;
            }
            if seq != have + 1 {
                return Err(Error::SyncGap {
                    device: dev,
                    expected: have + 1,
                    got: seq,
                });
            }
            self.hlc.observe(op.state.rev.0);
            let key = (op.state.coll.clone(), op.state.id);
            let local = match self.keydir.get(&key.0, &key.1) {
                Some(l) => Some(self.read_state_at(l)?),
                None => None,
            };
            let (state, outcome, conflicts) = merge(local.as_ref(), &op);
            if is_redacted(&op) {
                report.redacted += 1;
            } else {
                match outcome {
                    Outcome::Created => report.created += 1,
                    Outcome::FastForward => report.fast_forward += 1,
                    Outcome::Merged => report.merged += 1,
                    Outcome::Identical => report.identical += 1,
                }
            }
            let stored = Op {
                state,
                origin: op.origin,
                record_base: op.record_base,
                changed: op.changed.clone(),
                compacted: false,
            };
            self.append_txn(std::slice::from_ref(&stored), false)?;
            self.note_decision(&stored)?;
            for c in conflicts {
                if self.record_conflict(&stored.state, c)? {
                    report.conflicts += 1;
                }
            }
        }
        if self.opts.durability == Durability::Sync {
            self.flush()?;
        }
        Ok(report)
    }

    /// Store a conflict record; the id is derived from the conflict itself so both
    /// copies name the same conflict identically. Returns false if already known.
    fn record_conflict(&mut self, rec: &RecordState, c: FieldConflict) -> Result<bool> {
        let (lo, hi) = if c.local_rev <= c.remote_rev {
            (c.local_rev, c.remote_rev)
        } else {
            (c.remote_rev, c.local_rev)
        };
        let h = blake3::hash(format!("{}|{}|{}|{:?}|{:?}", rec.coll, rec.id, c.field, lo, hi).as_bytes());
        let id = Uuid::from_bytes(h.as_bytes()[..16].try_into().unwrap());
        if self.keydir.contains(CONFLICTS, &id) {
            return Ok(false);
        }
        // Already decided on another copy (the decision arrived first).
        let decided = self.keydir.contains(&decisions_coll(&rec.coll), &id);
        let provisional = if c.remote_rev > c.local_rev { "remote" } else { "local" };
        let fields = json!({
            "coll": rec.coll, "record": rec.id.to_string(), "field": c.field,
            "local": c.local, "remote": c.remote, "provisional": provisional, "resolved": decided,
        });
        let Value::Object(fields) = fields else { unreachable!() };
        self.put_system(CONFLICTS, id, fields)?;
        Ok(!decided)
    }

    pub fn conflicts(&self, include_resolved: bool) -> Result<Vec<Conflict>> {
        let mut out = Vec::new();
        for id in self.ids(CONFLICTS) {
            let Some(st) = self.get(CONFLICTS, id)? else { continue };
            let f = &st.fields;
            let resolved = f.get("resolved").and_then(Value::as_bool).unwrap_or(false);
            if resolved && !include_resolved {
                continue;
            }
            out.push(Conflict {
                id,
                coll: f["coll"].as_str().unwrap_or_default().into(),
                record: f["record"].as_str().and_then(|s| s.parse().ok()).unwrap_or_default(),
                field: f["field"].as_str().unwrap_or_default().into(),
                local: f["local"].clone(),
                remote: f["remote"].clone(),
                provisional: f["provisional"].as_str().unwrap_or_default().into(),
                resolved,
            });
        }
        Ok(out)
    }

    /// The user's decision: keep `value` for the conflicting field. The data
    /// change and a **decision record** (`<collection>~conflicts`, same id as
    /// the conflict) are written together and synchronised; every copy that
    /// has the same conflict marks it resolved when the decision arrives
    /// (Etapa 6, step 6.4).
    pub fn resolve_conflict(&mut self, conflict: Uuid, value: Option<Value>) -> Result<()> {
        let st = self.get(CONFLICTS, conflict)?.ok_or(Error::NotFound {
            coll: CONFLICTS.into(),
            id: conflict,
        })?;
        let f = st.fields.clone();
        let coll = f["coll"].as_str().unwrap_or_default().to_string();
        let record: Uuid = f["record"].as_str().and_then(|s| s.parse().ok()).unwrap_or_default();
        let field = f["field"].as_str().unwrap_or_default().to_string();
        let mut batch = Vec::new();
        if field == DELETED_FIELD {
            // The chosen whole record: {"deleted": bool, "fields": {...}}.
            let chosen = value.clone().unwrap_or(Value::Null);
            let deleted = chosen.get("deleted").and_then(Value::as_bool).unwrap_or(false);
            let live = self.get(&coll, record)?.is_some();
            if deleted && live {
                batch.push(crate::store::Write::delete(&coll, record));
            } else if !deleted {
                if !live && self.get_any(&coll, record)?.is_some() {
                    batch.push(crate::store::Write::restore(&coll, record));
                }
                if let Some(Value::Object(fields)) = chosen.get("fields") {
                    batch.push(crate::store::Write::put(&coll, record, fields.clone()));
                }
            }
        } else if let Some(cur) = self.get(&coll, record)? {
            let mut fields = cur.fields.clone();
            match value.clone() {
                Some(Value::Null) | None => fields.remove(&field),
                Some(v) => fields.insert(field.clone(), v),
            };
            batch.push(crate::store::Write::put(&coll, record, fields));
        }
        let mut d = crate::model::Fields::new();
        d.insert("field".into(), Value::String(field));
        d.insert("value".into(), value.unwrap_or(Value::Null));
        batch.push(crate::store::Write::put(&decisions_coll(&coll), conflict, d));
        self.write(batch)?;
        let mut done = f;
        done.insert("resolved".into(), Value::Bool(true));
        self.put_system(CONFLICTS, conflict, done)?;
        Ok(())
    }

    /// Keeps one side of a conflict: the value on this copy, or the one that
    /// came from the other copy.
    pub fn decide_conflict(&mut self, conflict: Uuid, keep_local: bool) -> Result<()> {
        let st = self.get(CONFLICTS, conflict)?.ok_or(Error::NotFound {
            coll: CONFLICTS.into(),
            id: conflict,
        })?;
        let v = st.fields[if keep_local { "local" } else { "remote" }].clone();
        self.resolve_conflict(conflict, Some(v))
    }

    /// A decision record arrived: the conflict it names is resolved here too.
    fn note_decision(&mut self, op: &Op) -> Result<()> {
        if !op.state.coll.ends_with(DECISIONS_SUFFIX) || is_redacted(op) {
            return Ok(());
        }
        if let Some(st) = self.get(CONFLICTS, op.state.id)?
            && st.fields.get("resolved").and_then(Value::as_bool) != Some(true)
        {
            let mut done = st.fields.clone();
            done.insert("resolved".into(), Value::Bool(true));
            self.put_system(CONFLICTS, op.state.id, done)?;
        }
        Ok(())
    }
}

fn to_value(v: Option<&Value>) -> Value {
    v.cloned().unwrap_or(Value::Null)
}

fn set_field(s: &mut RecordState, f: &str, v: Option<&Value>, rev: Option<Rev>) {
    match v {
        Some(v) => s.fields.insert(f.to_string(), v.clone()),
        None => s.fields.remove(f),
    };
    if let Some(r) = rev {
        s.field_revs.insert(f.to_string(), r);
    }
}

fn whole(s: &RecordState) -> Value {
    json!({ "deleted": s.deleted, "fields": Value::Object(s.fields.clone()) })
}

fn merge(local: Option<&RecordState>, r: &Op) -> (RecordState, Outcome, Vec<FieldConflict>) {
    let Some(l) = local else {
        let mut s = r.state.clone();
        s.version = 1;
        return (s, Outcome::Created, vec![]);
    };
    if l.rev == r.state.rev {
        let mut s = l.clone();
        s.version += 1;
        return (s, Outcome::Identical, vec![]);
    }
    if r.record_base == Some(l.rev) {
        let mut s = r.state.clone();
        s.version = l.version + 1;
        return (s, Outcome::FastForward, vec![]);
    }
    // Concurrent edits.
    if l.deleted != r.state.deleted {
        let mut s = if r.state.rev > l.rev {
            r.state.clone()
        } else {
            l.clone()
        };
        s.version = l.version + 1;
        s.rev = l.rev.max(r.state.rev);
        let c = FieldConflict {
            field: DELETED_FIELD.into(),
            local: whole(l),
            local_rev: Some(l.rev),
            remote: whole(&r.state),
            remote_rev: Some(r.state.rev),
        };
        return (s, Outcome::Merged, vec![c]);
    }
    let mut s = l.clone();
    s.version += 1;
    let mut conflicts = Vec::new();
    for (f, base) in &r.changed {
        let lrev = l.field_revs.get(f).copied();
        let rrev = r.state.field_revs.get(f).copied();
        if f == DELETED_FIELD {
            if let Some(m) = lrev.max(rrev) {
                s.field_revs.insert(f.clone(), m);
            }
            continue;
        }
        let (lv, rv) = (l.fields.get(f), r.state.fields.get(f));
        if lrev == *base {
            set_field(&mut s, f, rv, rrev);
        } else if lrev == rrev {
            // already have exactly this change
        } else if lv == rv {
            if let Some(m) = lrev.max(rrev) {
                s.field_revs.insert(f.clone(), m);
            }
        } else {
            let (wv, wrev) = if rrev > lrev { (rv, rrev) } else { (lv, lrev) };
            let wv = wv.cloned();
            set_field(&mut s, f, wv.as_ref(), wrev);
            conflicts.push(FieldConflict {
                field: f.clone(),
                local: to_value(lv),
                local_rev: lrev,
                remote: to_value(rv),
                remote_rev: rrev,
            });
        }
    }
    s.rev = l.rev.max(r.state.rev);
    (s, Outcome::Merged, conflicts)
}

/// Convenience for tests and demos: one round of two-way sync between copies.
pub fn sync_pair(a: &mut Store, b: &mut Store) -> Result<(SyncReport, SyncReport)> {
    let to_b = a.changes_since(&b.version_vector())?;
    let to_a = b.changes_since(&a.version_vector())?;
    let rb = b.apply_remote(to_b)?;
    let ra = a.apply_remote(to_a)?;
    Ok((ra, rb))
}
