use std::fmt;
use std::io;
use std::path::PathBuf;

use uuid::Uuid;

use crate::model::DeviceId;

/// Every error the store can report. Nothing is silently ignored.
#[derive(Debug)]
pub enum Error {
    Io(io::Error),
    /// Another process holds the workspace lock.
    Locked(PathBuf),
    /// A damaged frame was found that is not a torn tail. The store refuses to open
    /// for writing; nothing was modified. Use `repair` explicitly.
    Corruption {
        segment: u32,
        offset: u64,
        detail: String,
    },
    ManifestCorrupt(String),
    /// Segment files exist but the manifest is missing — refuse to guess.
    ManifestMissing(PathBuf),
    VersionConflict {
        coll: String,
        id: Uuid,
        expected: u64,
        actual: u64,
    },
    NotFound {
        coll: String,
        id: Uuid,
    },
    RecordDeleted {
        coll: String,
        id: Uuid,
    },
    NotDeleted {
        coll: String,
        id: Uuid,
    },
    NotIndexed {
        coll: String,
        field: String,
    },
    /// The peer asked for history older than the last compaction; full resync needed.
    HistoryCompacted {
        device: DeviceId,
        have_from: u64,
        asked_from: u64,
    },
    /// Remote changes from one device must arrive in order without gaps.
    SyncGap {
        device: DeviceId,
        expected: u64,
        got: u64,
    },
    UnsafeLocation(PathBuf),
    Serde(String),
    BlobMismatch(String),
    BackupInvalid(String),
    InvalidInput(String),
    /// A previous write failed and could not be rolled back; reopen the store.
    Poisoned,
}

pub type Result<T> = std::result::Result<T, Error>;

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Io(e) => write!(f, "I/O error: {e}"),
            Error::Locked(p) => write!(f, "workspace is locked by another process: {}", p.display()),
            Error::Corruption {
                segment,
                offset,
                detail,
            } => {
                write!(f, "corruption in segment {segment} at offset {offset}: {detail}")
            }
            Error::ManifestCorrupt(d) => write!(f, "manifest is corrupt: {d}"),
            Error::ManifestMissing(p) => write!(f, "manifest missing but data files exist in {}", p.display()),
            Error::VersionConflict {
                coll,
                id,
                expected,
                actual,
            } => {
                write!(
                    f,
                    "version conflict on {coll}/{id}: expected {expected}, found {actual}"
                )
            }
            Error::NotFound { coll, id } => write!(f, "record not found: {coll}/{id}"),
            Error::RecordDeleted { coll, id } => write!(f, "record is deleted: {coll}/{id}"),
            Error::NotDeleted { coll, id } => write!(f, "record is not deleted: {coll}/{id}"),
            Error::NotIndexed { coll, field } => write!(f, "no index on {coll}.{field}"),
            Error::HistoryCompacted {
                device,
                have_from,
                asked_from,
            } => write!(
                f,
                "history for device {device:016x} compacted up to {have_from}, asked from {asked_from}"
            ),
            Error::SyncGap { device, expected, got } => {
                write!(
                    f,
                    "sync gap for device {device:016x}: expected seq {expected}, got {got}"
                )
            }
            Error::UnsafeLocation(p) => write!(
                f,
                "workspace must not live in a cloud-synchronised folder: {}",
                p.display()
            ),
            Error::Serde(d) => write!(f, "serialisation error: {d}"),
            Error::BlobMismatch(h) => write!(f, "blob content does not match hash {h}"),
            Error::BackupInvalid(d) => write!(f, "backup invalid: {d}"),
            Error::InvalidInput(d) => write!(f, "invalid input: {d}"),
            Error::Poisoned => write!(f, "store poisoned by a failed write; reopen it"),
        }
    }
}

impl std::error::Error for Error {}

impl From<io::Error> for Error {
    fn from(e: io::Error) -> Self {
        Error::Io(e)
    }
}

impl From<serde_json::Error> for Error {
    fn from(e: serde_json::Error) -> Self {
        Error::Serde(e.to_string())
    }
}
