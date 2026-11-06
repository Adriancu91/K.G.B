//! Data model. Field names are shortened on disk (see FORMAT.md) to limit overhead.

use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use uuid::Uuid;

pub type DeviceId = u64;
pub type Fields = Map<String, Value>;

/// Pseudo-field that carries the deleted flag's own revision.
pub const DELETED_FIELD: &str = "_deleted";

/// Causal identity of a change: (hybrid logical clock, device). Totally ordered,
/// so "highest revision wins" is deterministic on every device.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Rev(pub u64, pub DeviceId);

/// Where a change was born: (device, per-device sequence number).
/// Sequence 0 marks a local-only change that is never synchronised.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Origin(pub DeviceId, pub u64);

/// Full state of a record as stored in one journal frame.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct RecordState {
    #[serde(rename = "c")]
    pub coll: String,
    #[serde(rename = "i")]
    pub id: Uuid,
    /// Local, monotonically increasing version; used for optimistic concurrency.
    #[serde(rename = "v")]
    pub version: u64,
    /// Revision of the last change to any field.
    #[serde(rename = "r")]
    pub rev: Rev,
    #[serde(rename = "d", default, skip_serializing_if = "is_false")]
    pub deleted: bool,
    #[serde(rename = "f")]
    pub fields: Fields,
    /// Revision of the last change of each field (including removed fields and `_deleted`).
    #[serde(rename = "fr")]
    pub field_revs: BTreeMap<String, Rev>,
}

/// One journal entry: the new full state plus what changed, for synchronisation.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Op {
    #[serde(rename = "s")]
    pub state: RecordState,
    #[serde(rename = "o")]
    pub origin: Origin,
    /// Record revision the author edited from (None = creation).
    #[serde(rename = "b", default, skip_serializing_if = "Option::is_none")]
    pub record_base: Option<Rev>,
    /// Changed fields and the field revision each was edited from.
    #[serde(rename = "ch", default, skip_serializing_if = "BTreeMap::is_empty")]
    pub changed: BTreeMap<String, Option<Rev>>,
    /// Written by compaction: carries state only, not a change to replay remotely.
    #[serde(rename = "k", default, skip_serializing_if = "is_false")]
    pub compacted: bool,
}

fn is_false(b: &bool) -> bool {
    !*b
}

/// Hybrid logical clock: physical milliseconds in the high 48 bits, counter in the low 16.
#[derive(Debug, Default)]
pub struct Hlc {
    last: u64,
}

impl Hlc {
    pub fn now(&mut self) -> u64 {
        let ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let phys = ms << 16;
        self.last = phys.max(self.last + 1);
        self.last
    }

    pub fn observe(&mut self, remote: u64) {
        if remote > self.last {
            self.last = remote;
        }
    }
}

/// Collections whose name starts with `_` are local-only (e.g. `_conflicts`).
pub fn is_system_collection(coll: &str) -> bool {
    coll.starts_with('_')
}
