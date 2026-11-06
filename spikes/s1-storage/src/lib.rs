//! K.G.B. Storage Engine — Etapa 0 spike (S1).
//!
//! PROTOTYPE. Its purpose is to measure and to test failure behaviour of a
//! database-free store (Master Plan §9, decisions D-005, D-006). It is not the
//! production engine and must not be used for real data.
//!
//! Design: append-only framed journal (CRC32 per frame, atomic multi-op
//! transactions) + in-memory key directory and secondary indexes rebuilt on open
//! + compaction into fresh segments + content-addressed blobs. See FORMAT.md.

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
