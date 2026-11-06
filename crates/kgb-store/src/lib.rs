//! K.G.B. Storage Engine.
//!
//! Database-free store (Master Plan §9, decisions D-005, D-006). Taken over
//! unchanged from the Etapa 0 spike `spikes/s1-storage` (see
//! `docs/spikes/S1_REZULTATE.md`). Etapa 1 uses it as-is; Etapa 2 hardens it
//! (binary format, incremental compaction, unindexed filter target).
//!
//! Design: append-only framed journal (CRC32 per frame, atomic multi-op
//! transactions) + in-memory key directory and secondary indexes rebuilt on open
//! + compaction into fresh segments + content-addressed blobs.

pub mod error;
pub mod frame;
pub mod fsutil;
mod index;
pub mod maintenance;
pub mod model;
pub mod store;
pub mod sync;

pub use error::{Error, Result};
pub use maintenance::{BackupInfo, CompactReport, RepairReport, repair, restore_backup, verify_backup};
pub use model::{DeviceId, Fields, Op, RecordState, Rev};
pub use store::{Durability, Options, RecoveryReport, Store, Write};
pub use sync::{Conflict, SyncReport, VersionVector, sync_pair};
