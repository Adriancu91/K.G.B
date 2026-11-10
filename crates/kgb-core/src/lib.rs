//! K.G.B. core services (Master Plan §4, Etapa 1).
//!
//! Everything here is UI-free and testable without a window. The desktop app
//! (`app/src-tauri`) is a thin command layer over this crate.

/// Version of the core API that modules declare compatibility with.
pub const CORE_VERSION: &str = env!("CARGO_PKG_VERSION");

pub mod activities;
pub mod anaf;
pub mod backup;
pub mod blobs;
pub mod chat;
pub mod conflicts;
pub mod documents;
pub mod error;
pub mod files;
pub mod fx;
pub mod identity;
pub mod ids;
pub mod invites;
pub mod log;
pub mod manifest;
pub mod modules;
pub mod news;
pub mod notifications;
pub mod org;
pub mod partners;
pub mod peers;
pub mod phones;
pub mod presence;
pub mod profiles;
pub mod registry;
pub mod replication;
pub mod schema;
pub mod settings;
pub mod sources;
pub mod weather;
pub mod workspace;

pub use error::{CoreError, CoreResult};
