//! In-memory key directory, grouped by collection (Etapa 2, step 2.2).
//!
//! The Etapa 0 spike keyed one flat map by `(collection, id)`, which stored the
//! collection name again for every record (386 MB at 1M records) and made
//! `count`/`ids`/`scan` walk every collection. Grouping by collection keeps one
//! copy of each name and lets per-collection operations touch only their own
//! records.

use std::collections::HashMap;

use uuid::Uuid;

use crate::store::Loc;

#[derive(Default)]
pub(crate) struct Keydir {
    colls: HashMap<String, HashMap<Uuid, Loc>>,
    len: usize,
}

impl Keydir {
    pub fn clear(&mut self) {
        self.colls.clear();
        self.len = 0;
    }

    /// Number of keys, including logically deleted records.
    pub fn len(&self) -> usize {
        self.len
    }

    pub fn get(&self, coll: &str, id: &Uuid) -> Option<&Loc> {
        self.colls.get(coll)?.get(id)
    }

    pub fn contains(&self, coll: &str, id: &Uuid) -> bool {
        self.get(coll, id).is_some()
    }

    pub fn insert(&mut self, coll: &str, id: Uuid, loc: Loc) {
        let m = match self.colls.get_mut(coll) {
            Some(m) => m,
            None => self.colls.entry(coll.to_string()).or_default(),
        };
        if m.insert(id, loc).is_none() {
            self.len += 1;
        }
    }

    pub fn values(&self) -> impl Iterator<Item = &Loc> {
        self.colls.values().flat_map(|m| m.values())
    }

    /// Live (not deleted) records of one collection.
    pub fn live(&self, coll: &str) -> impl Iterator<Item = (Uuid, Loc)> + '_ {
        self.colls
            .get(coll)
            .into_iter()
            .flat_map(|m| m.iter().filter(|(_, l)| !l.deleted).map(|(id, l)| (*id, *l)))
    }

    pub fn count_live(&self, coll: &str) -> usize {
        self.colls
            .get(coll)
            .map_or(0, |m| m.values().filter(|l| !l.deleted).count())
    }
}
