//! Work profiles (Master Plan §5.2): a profile decides which of the enabled
//! modules appear in the sidebar. It is an interface configuration, not an
//! account and not a separate data space.
//!
//! Stored per profile in `core.profiles` as the list of hidden module ids, so
//! a newly enabled module is visible everywhere until the user hides it.

use std::collections::BTreeSet;

use kgb_store::{Fields, Store, Write};
use serde_json::Value;
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::modules::PROFILES;

pub const PROFILES_COLLECTION: &str = "core.profiles";

fn record_id(profile: &str) -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_OID, format!("kgb-profile:{profile}").as_bytes())
}

fn check(profile: &str) -> CoreResult<()> {
    if PROFILES.iter().any(|(id, _)| *id == profile) {
        Ok(())
    } else {
        Err(CoreError::invalid(
            "profilul de lucru",
            format!("„{profile}” nu există"),
        ))
    }
}

/// Module ids hidden in `profile`.
pub fn hidden(store: &Store, profile: &str) -> CoreResult<BTreeSet<String>> {
    check(profile)?;
    Ok(store
        .get(PROFILES_COLLECTION, record_id(profile))?
        .and_then(|r| r.fields.get("hidden").and_then(Value::as_array).cloned())
        .unwrap_or_default()
        .iter()
        .filter_map(Value::as_str)
        .map(String::from)
        .collect())
}

/// Shows or hides `module` in `profile`.
pub fn set_visible(store: &mut Store, profile: &str, module: &str, visible: bool) -> CoreResult<()> {
    check(profile)?;
    let rid = record_id(profile);
    let (mut set, version) = match store.get(PROFILES_COLLECTION, rid)? {
        Some(r) => (hidden(store, profile)?, r.version),
        None => (BTreeSet::new(), 0),
    };
    if visible {
        set.remove(module);
    } else {
        set.insert(module.to_string());
    }
    let mut f = Fields::new();
    f.insert("profile".into(), Value::String(profile.into()));
    f.insert("hidden".into(), Value::from(set.into_iter().collect::<Vec<_>>()));
    store.write(vec![Write::put(PROFILES_COLLECTION, rid, f).expect(version)])?;
    Ok(())
}
