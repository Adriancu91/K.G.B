//! Secondary equality indexes. Kept in memory only and always rebuilt from the
//! journal, so a lost or damaged index can never lose data.

use std::collections::{BTreeMap, HashMap, HashSet};

use serde_json::Value;
use uuid::Uuid;

use crate::model::Fields;

#[derive(Default)]
struct FieldIndex {
    by_value: BTreeMap<String, HashSet<Uuid>>,
    by_id: HashMap<Uuid, String>,
}

#[derive(Default)]
pub(crate) struct Indexes {
    fields: HashMap<String, Vec<String>>,
    data: HashMap<(String, String), FieldIndex>,
}

impl Indexes {
    pub fn define(&mut self, coll: &str, field: &str) {
        let names = self.fields.entry(coll.to_string()).or_default();
        if !names.iter().any(|f| f == field) {
            names.push(field.to_string());
        }
        self.data.entry((coll.to_string(), field.to_string())).or_default();
    }

    pub fn has(&self, coll: &str) -> bool {
        self.fields.contains_key(coll)
    }

    pub fn is_defined(&self, coll: &str, field: &str) -> bool {
        self.fields.get(coll).is_some_and(|f| f.iter().any(|x| x == field))
    }

    /// Re-index one record. `fields = None` removes it (deleted or gone).
    pub fn update(&mut self, coll: &str, id: Uuid, fields: Option<&Fields>) {
        let Some(names) = self.fields.get(coll) else { return };
        for name in names {
            let Some(ix) = self.data.get_mut(&(coll.to_string(), name.clone())) else {
                continue;
            };
            if let Some(old) = ix.by_id.remove(&id)
                && let Some(set) = ix.by_value.get_mut(&old)
            {
                set.remove(&id);
                if set.is_empty() {
                    ix.by_value.remove(&old);
                }
            }
            if let Some(v) = fields.and_then(|f| f.get(name)) {
                let key = v.to_string();
                ix.by_value.entry(key.clone()).or_default().insert(id);
                ix.by_id.insert(id, key);
            }
        }
    }

    pub fn lookup(&self, coll: &str, field: &str, value: &Value) -> Option<Vec<Uuid>> {
        let ix = self.data.get(&(coll.to_string(), field.to_string()))?;
        Some(
            ix.by_value
                .get(&value.to_string())
                .map(|s| s.iter().copied().collect())
                .unwrap_or_default(),
        )
    }

    pub fn clear(&mut self) {
        for ix in self.data.values_mut() {
            *ix = FieldIndex::default();
        }
    }
}
