//! Attached files between devices (Etapa 6, step 6.8; Master Plan §8.6:
//! "large files travel separately, with integrity checks and resume").
//!
//! The records of files and document versions synchronise like any data
//! (only to roles that may read their module). The bytes travel separately:
//! after a round, a device asks the peer for every file it has the record of
//! but not the content. A transfer that stops keeps what arrived and
//! continues from there; a finished file is checked against its BLAKE3 hash
//! before it is used. A peer sends a file only to a device of the
//! organization whose role may read a module that holds that file.

use std::collections::BTreeMap;
use std::path::PathBuf;

use kgb_store::Store;
use serde::Serialize;
use serde_json::Value;

use crate::documents::VERSIONS_COLLECTION;
use crate::error::{CoreError, CoreResult};
use crate::files::FILES_COLLECTION;
use crate::org::Access;
use crate::registry;

/// A file this device knows of but has not received yet.
#[derive(Clone, Debug, Serialize)]
pub struct Missing {
    pub hash: String,
    pub size: u64,
    pub name: String,
    pub module: String,
}

fn records(store: &Store) -> CoreResult<Vec<(String, u64, String, String)>> {
    let mut out = Vec::new();
    for coll in [FILES_COLLECTION, VERSIONS_COLLECTION] {
        for r in store.scan(coll, |_| true)? {
            let f = &r.fields;
            let s = |k: &str| f.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
            let name = if coll == FILES_COLLECTION {
                s("name")
            } else {
                format!(
                    "document, versiunea {}",
                    f.get("number").and_then(Value::as_u64).unwrap_or(0)
                )
            };
            out.push((
                s("hash"),
                f.get("size").and_then(Value::as_u64).unwrap_or(0),
                name,
                s("module"),
            ));
        }
    }
    Ok(out)
}

/// Files whose record is here but whose content is not.
pub fn missing(store: &Store) -> CoreResult<Vec<Missing>> {
    let mut by_hash: BTreeMap<String, Missing> = BTreeMap::new();
    for (hash, size, name, module) in records(store)? {
        if hash.is_empty() || store.has_blob(&hash) {
            continue;
        }
        by_hash.entry(hash.clone()).or_insert(Missing {
            hash,
            size,
            name,
            module,
        });
    }
    Ok(by_hash.into_values().collect())
}

/// The file to send to the device with key `peer`, if it may have it.
pub fn may_serve(store: &Store, peer: &str, hash: &str) -> CoreResult<PathBuf> {
    let st = registry::verify(store)?;
    if st.member_of(peer).is_none() {
        return Err(CoreError::invalid(
            "fișierul",
            "cererea vine de la un dispozitiv care nu e aprobat în organizație",
        ));
    }
    let allowed = records(store)?
        .into_iter()
        .any(|(h, _, _, module)| h == hash && st.access(peer, &module) != Access::Niciunul);
    if !allowed {
        return Err(CoreError::invalid(
            "fișierul",
            "nu există aici sau rolul celui care îl cere nu are acces la el",
        ));
    }
    Ok(store.blob_file(hash)?)
}
