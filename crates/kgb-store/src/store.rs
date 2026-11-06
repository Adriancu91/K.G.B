//! Core store: open/recovery, reads, local writes.
//!
//! Layout of a workspace directory:
//! ```text
//! LOCK              held exclusively by the single writer process
//! MANIFEST          JSON, replaced atomically; lists the live segments
//! journal/NNNNNNNN.kjl   append-only segments of framed ops (frame.rs)
//! blobs/xx/<blake3>      content-addressed attachments
//! quarantine/       torn tails and leftovers — never deleted automatically
//! retired/          segments replaced by the last compaction
//! ```

use std::collections::{BTreeMap, HashMap};
use std::fs::{self, File, OpenOptions};
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::codec;
use crate::error::{Error, Result};
use crate::frame::{self, Decoded, END_OF_TXN};
use crate::fsutil;
use crate::index::Indexes;
use crate::keydir::Keydir;
use crate::model::{DELETED_FIELD, DeviceId, Fields, Hlc, Op, Origin, RecordState, Rev, is_system_collection};

/// Journal format written by new stores and by compaction (see `codec`).
pub const FORMAT_VERSION: u32 = 2;
/// Oldest journal format this build still reads (D-029).
pub const MIN_FORMAT_VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Durability {
    /// Flush to disk before a write call returns (FlushFileBuffers).
    Sync,
    /// Leave flushing to the OS; call `flush()` explicitly. For bulk imports.
    Buffered,
}

#[derive(Clone, Debug)]
pub struct Options {
    pub durability: Durability,
    pub segment_max_bytes: u64,
    pub check_location: bool,
}

impl Default for Options {
    fn default() -> Self {
        Options {
            durability: Durability::Sync,
            segment_max_bytes: 64 * 1024 * 1024,
            check_location: true,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub(crate) struct Manifest {
    pub format: u32,
    pub device: DeviceId,
    pub segments: Vec<u32>,
    pub next_segment: u32,
    #[serde(default)]
    pub indexes: Vec<(String, String)>,
    /// Version vector at the last compaction; older history is gone.
    #[serde(default)]
    pub compaction_floor: BTreeMap<DeviceId, u64>,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Loc {
    pub seg: u32,
    pub off: u64,
    pub len: u32,
    pub version: u64,
    pub deleted: bool,
}

pub(crate) type Key = (String, Uuid);

#[derive(Debug, Clone)]
pub struct TornTail {
    pub segment: u32,
    pub offset: u64,
    pub bytes: u64,
    pub reason: String,
    pub saved_to: PathBuf,
}

/// What `open` found and did. Every repair action is listed here.
#[derive(Debug, Default, Clone)]
pub struct RecoveryReport {
    pub segments: usize,
    pub frames: u64,
    pub records: usize,
    pub torn_tail: Option<TornTail>,
    pub quarantined_tmp: Vec<PathBuf>,
    pub orphan_segments: Vec<PathBuf>,
    pub open_ms: u128,
}

/// One requested change inside an atomic batch.
#[derive(Clone, Debug)]
pub enum Write {
    /// Create or replace the record's fields. `expected`: `Some(0)` = must not exist,
    /// `Some(v)` = current version must be `v`, `None` = no check.
    Put {
        coll: String,
        id: Uuid,
        fields: Fields,
        expected: Option<u64>,
    },
    /// Logical delete (the data stays and can be restored).
    Delete {
        coll: String,
        id: Uuid,
        expected: Option<u64>,
    },
    Restore {
        coll: String,
        id: Uuid,
        expected: Option<u64>,
    },
}

impl Write {
    pub fn put(coll: &str, id: Uuid, fields: Fields) -> Self {
        Write::Put {
            coll: coll.into(),
            id,
            fields,
            expected: None,
        }
    }
    pub fn delete(coll: &str, id: Uuid) -> Self {
        Write::Delete {
            coll: coll.into(),
            id,
            expected: None,
        }
    }
    pub fn restore(coll: &str, id: Uuid) -> Self {
        Write::Restore {
            coll: coll.into(),
            id,
            expected: None,
        }
    }
    pub fn expect(mut self, v: u64) -> Self {
        match &mut self {
            Write::Put { expected, .. } | Write::Delete { expected, .. } | Write::Restore { expected, .. } => {
                *expected = Some(v)
            }
        }
        self
    }
    fn key(&self) -> (&str, Uuid, Option<u64>) {
        match self {
            Write::Put { coll, id, expected, .. }
            | Write::Delete { coll, id, expected }
            | Write::Restore { coll, id, expected } => (coll, *id, *expected),
        }
    }
}

/// What replay needs from an op. Fields are decoded only when some
/// collection has an index (they are needed to rebuild it).
struct OpMeta {
    coll: String,
    id: Uuid,
    version: u64,
    rev: Rev,
    deleted: bool,
    origin: Origin,
    fields: Option<Fields>,
}

impl OpMeta {
    fn parse(payload: &[u8], want_fields: bool) -> Result<OpMeta> {
        let v = codec::View::parse(payload)?;
        let h = &v.header;
        Ok(OpMeta {
            coll: h.coll.to_string(),
            id: h.id,
            version: h.version,
            rev: h.rev,
            deleted: h.deleted,
            origin: h.origin,
            fields: if want_fields && !h.deleted {
                Some(v.fields()?)
            } else {
                None
            },
        })
    }
}

pub struct Store {
    pub(crate) dir: PathBuf,
    _lock: File,
    pub(crate) opts: Options,
    pub(crate) manifest: Manifest,
    pub(crate) hlc: Hlc,
    pub(crate) local_seq: u64,
    pub(crate) applied: BTreeMap<DeviceId, u64>,
    pub(crate) keydir: Keydir,
    pub(crate) indexes: Indexes,
    readers: BTreeMap<u32, File>,
    active: Option<File>,
    active_len: u64,
    poisoned: bool,
    report: RecoveryReport,
    buf: Vec<u8>,
}

pub(crate) fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

impl Store {
    /// Open (or create) a workspace. Runs recovery and rebuilds all in-memory indexes.
    pub fn open(dir: impl AsRef<Path>, opts: Options) -> Result<Store> {
        let t0 = Instant::now();
        let dir = dir.as_ref().to_path_buf();
        if opts.check_location {
            fsutil::check_location(&dir)?;
        }
        fs::create_dir_all(dir.join("journal"))?;
        let lock = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(dir.join("LOCK"))?;
        match lock.try_lock() {
            Ok(()) => {}
            Err(fs::TryLockError::WouldBlock) => return Err(Error::Locked(dir)),
            Err(fs::TryLockError::Error(e)) => return Err(e.into()),
        }
        let report = RecoveryReport {
            quarantined_tmp: quarantine_tmp_files(&dir)?,
            ..Default::default()
        };
        let manifest = load_or_init_manifest(&dir)?;
        let mut store = Store {
            dir,
            _lock: lock,
            opts,
            manifest,
            hlc: Hlc::default(),
            local_seq: 0,
            applied: BTreeMap::new(),
            keydir: Keydir::default(),
            indexes: Indexes::default(),
            readers: BTreeMap::new(),
            active: None,
            active_len: 0,
            poisoned: false,
            report,
            buf: Vec::new(),
        };
        store.load()?;
        store.report.open_ms = t0.elapsed().as_millis();
        Ok(store)
    }

    pub fn recovery_report(&self) -> &RecoveryReport {
        &self.report
    }

    pub fn device(&self) -> DeviceId {
        self.manifest.device
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    pub(crate) fn seg_path(&self, id: u32) -> PathBuf {
        seg_path(&self.dir, id)
    }

    /// (Re)build all in-memory state from the manifest's segments.
    pub(crate) fn load(&mut self) -> Result<()> {
        self.keydir.clear();
        self.indexes = Indexes::default();
        for (c, f) in self.manifest.indexes.clone() {
            self.indexes.define(&c, &f);
        }
        self.readers.clear();
        self.active = None;
        self.applied.clear();
        self.local_seq = 0;
        let mut frames = 0u64;
        let segs = self.manifest.segments.clone();
        for (i, &seg) in segs.iter().enumerate() {
            let last = i + 1 == segs.len();
            let path = self.seg_path(seg);
            let buf = fs::read(&path).map_err(|e| Error::Corruption {
                segment: seg,
                offset: 0,
                detail: format!("segment listed in manifest cannot be read: {e}"),
            })?;
            let (valid_end, why) = self.replay_segment(seg, &buf, last, &mut frames)?;
            if let Some(reason) = why {
                self.report.torn_tail = Some(quarantine_tail(&self.dir, seg, &path, &buf, valid_end, reason)?);
            }
            self.readers.insert(seg, File::open(&path)?);
            if last {
                self.active = Some(OpenOptions::new().read(true).write(true).open(&path)?);
                self.active_len = valid_end as u64;
            }
        }
        for (&dev, &seq) in &self.manifest.compaction_floor {
            if dev == self.manifest.device {
                self.local_seq = self.local_seq.max(seq);
            } else {
                let e = self.applied.entry(dev).or_default();
                *e = (*e).max(seq);
            }
        }
        self.report.orphan_segments = orphan_segments(&self.dir, &self.manifest)?;
        self.report.segments = segs.len();
        self.report.frames = frames;
        self.report.records = self.keydir.len();
        Ok(())
    }

    /// Returns the end of the last complete transaction and, if the tail had to be
    /// cut, why. A damaged frame anywhere except the tail of the last segment is an error.
    fn replay_segment(
        &mut self,
        seg: u32,
        buf: &[u8],
        last: bool,
        frames: &mut u64,
    ) -> Result<(usize, Option<String>)> {
        let mut off = 0usize;
        let mut txn_start = 0usize;
        let mut pending: Vec<(usize, usize, OpMeta)> = Vec::new();
        loop {
            match frame::decode_at(buf, off) {
                Decoded::End => break,
                Decoded::Frame { payload, flags, next } => {
                    let meta = OpMeta::parse(payload, self.indexes.has_any()).map_err(|e| Error::Corruption {
                        segment: seg,
                        offset: off as u64,
                        detail: format!("frame passes CRC but does not parse: {e}"),
                    })?;
                    pending.push((off, next - off, meta));
                    *frames += 1;
                    if flags & END_OF_TXN != 0 {
                        for (o, l, m) in pending.drain(..) {
                            self.apply_meta(seg, o, l, m)?;
                        }
                        txn_start = next;
                    }
                    off = next;
                }
                Decoded::Invalid(why) => {
                    if last && frame::find_next_valid(buf, off + 1).is_none() {
                        return Ok((txn_start, Some(why.to_string())));
                    }
                    return Err(Error::Corruption {
                        segment: seg,
                        offset: off as u64,
                        detail: why.to_string(),
                    });
                }
            }
        }
        if !pending.is_empty() {
            if last {
                return Ok((txn_start, Some("incomplete transaction".into())));
            }
            return Err(Error::Corruption {
                segment: seg,
                offset: txn_start as u64,
                detail: "incomplete transaction in a sealed segment".into(),
            });
        }
        Ok((buf.len(), None))
    }

    fn apply_meta(&mut self, seg: u32, off: usize, len: usize, m: OpMeta) -> Result<()> {
        let fields = if self.indexes.has(&m.coll) && !m.deleted {
            match m.fields {
                Some(f) => Some(f),
                None => {
                    return Err(Error::Corruption {
                        segment: seg,
                        offset: off as u64,
                        detail: "fields missing for an indexed collection".into(),
                    });
                }
            }
        } else {
            None
        };
        let loc = Loc {
            seg,
            off: off as u64,
            len: len as u32,
            version: m.version,
            deleted: m.deleted,
        };
        self.track(m.coll, m.id, m.rev, m.origin, loc, fields.as_ref());
        Ok(())
    }

    /// Update keydir, indexes, clocks and version vector for a stored op.
    fn track(&mut self, coll: String, id: Uuid, rev: Rev, origin: Origin, loc: Loc, fields: Option<&Fields>) {
        if loc.deleted {
            self.indexes.update(&coll, id, None);
        } else if fields.is_some() {
            self.indexes.update(&coll, id, fields);
        }
        self.keydir.insert(&coll, id, loc);
        self.hlc.observe(rev.0);
        let Origin(dev, seq) = origin;
        if seq > 0 {
            if dev == self.manifest.device {
                self.local_seq = self.local_seq.max(seq);
            } else {
                let e = self.applied.entry(dev).or_default();
                *e = (*e).max(seq);
            }
        }
    }

    pub(crate) fn save_manifest(&self, m: &Manifest) -> Result<()> {
        let bytes = serde_json::to_vec_pretty(m)?;
        fsutil::write_atomic(&self.dir.join("MANIFEST"), &bytes)?;
        Ok(())
    }

    // ---------------------------------------------------------------- reads

    pub(crate) fn read_op(&self, loc: &Loc) -> Result<Op> {
        let file = self.readers.get(&loc.seg).ok_or_else(|| Error::Corruption {
            segment: loc.seg,
            offset: loc.off,
            detail: "segment not open".into(),
        })?;
        let mut buf = vec![0u8; loc.len as usize];
        fsutil::read_exact_at(file, &mut buf, loc.off)?;
        match frame::decode_at(&buf, 0) {
            Decoded::Frame { payload, .. } => codec::decode_op(payload),
            Decoded::Invalid(why) => Err(Error::Corruption {
                segment: loc.seg,
                offset: loc.off,
                detail: why.into(),
            }),
            Decoded::End => Err(Error::Corruption {
                segment: loc.seg,
                offset: loc.off,
                detail: "empty frame".into(),
            }),
        }
    }

    pub(crate) fn read_state_at(&self, loc: &Loc) -> Result<RecordState> {
        Ok(self.read_op(loc)?.state)
    }

    /// Live record, or `None` if missing or logically deleted.
    pub fn get(&self, coll: &str, id: Uuid) -> Result<Option<RecordState>> {
        match self.keydir.get(coll, &id) {
            Some(l) if !l.deleted => self.read_state_at(l).map(Some),
            _ => Ok(None),
        }
    }

    /// Record including logically deleted ones.
    pub fn get_any(&self, coll: &str, id: Uuid) -> Result<Option<RecordState>> {
        match self.keydir.get(coll, &id) {
            Some(l) => self.read_state_at(l).map(Some),
            None => Ok(None),
        }
    }

    pub fn version_of(&self, coll: &str, id: Uuid) -> Option<u64> {
        self.keydir.get(coll, &id).map(|l| l.version)
    }

    pub fn count(&self, coll: &str) -> usize {
        self.keydir.count_live(coll)
    }

    pub fn ids(&self, coll: &str) -> Vec<Uuid> {
        self.keydir.live(coll).map(|(id, _)| id).collect()
    }

    /// Declare an equality index (persisted in the manifest, contents rebuilt on open).
    pub fn create_index(&mut self, coll: &str, field: &str) -> Result<()> {
        if self.indexes.is_defined(coll, field) {
            return Ok(());
        }
        let mut m = self.manifest.clone();
        m.indexes.push((coll.to_string(), field.to_string()));
        self.save_manifest(&m)?;
        self.manifest = m;
        self.indexes.define(coll, field);
        self.rebuild_index_for(coll)
    }

    fn rebuild_index_for(&mut self, coll: &str) -> Result<()> {
        let locs: Vec<Loc> = self.keydir.live(coll).map(|(_, l)| l).collect();
        // Index while streaming: never hold every record in memory at once.
        let mut idx = std::mem::take(&mut self.indexes);
        let r = self.read_states(locs, |st| {
            idx.update(coll, st.id, Some(&st.fields));
            Ok(())
        });
        self.indexes = idx;
        r
    }

    /// Drop and rebuild every index from the journal (used to prove indexes are regenerable).
    pub fn rebuild_indexes(&mut self) -> Result<()> {
        self.indexes.clear();
        let colls: Vec<String> = self.manifest.indexes.iter().map(|(c, _)| c.clone()).collect();
        for c in colls {
            self.rebuild_index_for(&c)?;
        }
        Ok(())
    }

    pub fn find_by(&self, coll: &str, field: &str, value: &Value) -> Result<Vec<RecordState>> {
        let ids = self
            .indexes
            .lookup(coll, field, value)
            .ok_or_else(|| Error::NotIndexed {
                coll: coll.into(),
                field: field.into(),
            })?;
        let locs: Vec<Loc> = ids
            .iter()
            .filter_map(|id| self.keydir.get(coll, id))
            .filter(|l| !l.deleted)
            .copied()
            .collect();
        let mut out = Vec::with_capacity(locs.len());
        self.read_states(locs, |st| {
            out.push(st);
            Ok(())
        })?;
        Ok(out)
    }

    /// Unindexed filter over the live records of one collection only. Records
    /// are read in on-disk order, in large contiguous chunks, decoded once.
    pub fn scan(&self, coll: &str, mut pred: impl FnMut(&RecordState) -> bool) -> Result<Vec<RecordState>> {
        let locs: Vec<Loc> = self.keydir.live(coll).map(|(_, l)| l).collect();
        let mut out = Vec::new();
        self.read_states(locs, |st| {
            if pred(&st) {
                out.push(st);
            }
            Ok(())
        })?;
        Ok(out)
    }

    /// Reads the record states at `locs` (see [`Store::read_payloads`]).
    pub(crate) fn read_states(&self, locs: Vec<Loc>, mut f: impl FnMut(RecordState) -> Result<()>) -> Result<()> {
        self.read_payloads(locs, |p| f(Store::decode_state(p)?))
    }

    pub(crate) fn decode_state(payload: &[u8]) -> Result<RecordState> {
        codec::decode_state(payload)
    }

    /// Calls `f` with the frame payload at each of `locs`, in on-disk order.
    /// Neighbouring frames are read together, at most `READ_CHUNK` bytes per read.
    pub(crate) fn read_payloads(&self, mut locs: Vec<Loc>, mut f: impl FnMut(&[u8]) -> Result<()>) -> Result<()> {
        const READ_CHUNK: u64 = 4 * 1024 * 1024;
        const MAX_GAP: u64 = 64 * 1024;
        locs.sort_unstable_by_key(|l| (l.seg, l.off));
        let mut buf = Vec::new();
        let mut i = 0;
        while i < locs.len() {
            let first = locs[i];
            let mut end = first.off + first.len as u64;
            let mut j = i + 1;
            while j < locs.len() {
                let l = locs[j];
                if l.seg != first.seg || l.off > end + MAX_GAP || l.off + l.len as u64 - first.off > READ_CHUNK {
                    break;
                }
                end = end.max(l.off + l.len as u64);
                j += 1;
            }
            let file = self.readers.get(&first.seg).ok_or_else(|| Error::Corruption {
                segment: first.seg,
                offset: first.off,
                detail: "segment not open".into(),
            })?;
            buf.resize((end - first.off) as usize, 0);
            fsutil::read_exact_at(file, &mut buf, first.off)?;
            for l in &locs[i..j] {
                let at = (l.off - first.off) as usize;
                match frame::decode_at(&buf[..at + l.len as usize], at) {
                    Decoded::Frame { payload, .. } => f(payload)?,
                    Decoded::Invalid(why) => {
                        return Err(Error::Corruption {
                            segment: l.seg,
                            offset: l.off,
                            detail: why.into(),
                        });
                    }
                    Decoded::End => {
                        return Err(Error::Corruption {
                            segment: l.seg,
                            offset: l.off,
                            detail: "empty frame".into(),
                        });
                    }
                }
            }
            i = j;
        }
        Ok(())
    }

    // ---------------------------------------------------------------- writes

    /// Apply a batch atomically: either every change is durable or none is.
    /// Returns the resulting version of each item (unchanged puts keep their version).
    pub fn write(&mut self, batch: Vec<Write>) -> Result<Vec<u64>> {
        for w in &batch {
            let (coll, _, _) = w.key();
            if coll.is_empty() || is_system_collection(coll) {
                return Err(Error::InvalidInput(format!("collection name not allowed: {coll:?}")));
            }
        }
        self.write_internal(batch)
    }

    pub(crate) fn write_internal(&mut self, batch: Vec<Write>) -> Result<Vec<u64>> {
        if self.poisoned {
            return Err(Error::Poisoned);
        }
        let device = self.device();
        let mut overlay: HashMap<Key, RecordState> = HashMap::new();
        let mut ops: Vec<Op> = Vec::with_capacity(batch.len());
        let mut versions = Vec::with_capacity(batch.len());
        for w in batch {
            let (coll, id, expected) = w.key();
            let key = (coll.to_string(), id);
            let cur = match overlay.get(&key) {
                Some(s) => Some(s.clone()),
                None => match self.keydir.get(&key.0, &key.1) {
                    Some(l) => Some(self.read_state_at(l)?),
                    None => None,
                },
            };
            let cur_version = cur.as_ref().map_or(0, |s| s.version);
            if let Some(e) = expected
                && e != cur_version
            {
                return Err(Error::VersionConflict {
                    coll: key.0,
                    id,
                    expected: e,
                    actual: cur_version,
                });
            }
            let rev = Rev(self.hlc.now(), device);
            let deleting = matches!(w, Write::Delete { .. });
            let op = match w {
                Write::Put { coll, id, fields, .. } => {
                    if fields.contains_key(DELETED_FIELD) {
                        return Err(Error::InvalidInput(format!("field name {DELETED_FIELD} is reserved")));
                    }
                    if cur.as_ref().is_some_and(|c| c.deleted) {
                        return Err(Error::RecordDeleted { coll, id });
                    }
                    let empty = Fields::new();
                    let old = cur.as_ref().map_or(&empty, |c| &c.fields);
                    let mut field_revs = cur.as_ref().map(|c| c.field_revs.clone()).unwrap_or_default();
                    let mut changed = BTreeMap::new();
                    for (k, v) in &fields {
                        if old.get(k) != Some(v) {
                            changed.insert(k.clone(), field_revs.get(k).copied());
                        }
                    }
                    for k in old.keys() {
                        if !fields.contains_key(k) {
                            changed.insert(k.clone(), field_revs.get(k).copied());
                        }
                    }
                    if changed.is_empty() && cur.is_some() {
                        versions.push(cur_version);
                        continue;
                    }
                    for k in changed.keys() {
                        field_revs.insert(k.clone(), rev);
                    }
                    let state = RecordState {
                        coll,
                        id,
                        version: cur_version + 1,
                        rev,
                        deleted: false,
                        fields,
                        field_revs,
                    };
                    Op {
                        state,
                        origin: Origin(device, 0),
                        record_base: cur.map(|c| c.rev),
                        changed,
                        compacted: false,
                    }
                }
                Write::Delete { coll, id, .. } | Write::Restore { coll, id, .. } => {
                    let Some(c) = cur else {
                        return Err(Error::NotFound { coll, id });
                    };
                    if deleting && c.deleted {
                        return Err(Error::RecordDeleted { coll, id });
                    }
                    if !deleting && !c.deleted {
                        return Err(Error::NotDeleted { coll, id });
                    }
                    let base = c.field_revs.get(DELETED_FIELD).copied();
                    let mut state = c.clone();
                    state.version = cur_version + 1;
                    state.rev = rev;
                    state.deleted = deleting;
                    state.field_revs.insert(DELETED_FIELD.into(), rev);
                    let changed = BTreeMap::from([(DELETED_FIELD.to_string(), base)]);
                    Op {
                        state,
                        origin: Origin(device, 0),
                        record_base: Some(c.rev),
                        changed,
                        compacted: false,
                    }
                }
            };
            versions.push(op.state.version);
            overlay.insert(key, op.state.clone());
            ops.push(op);
        }
        // Sequence numbers are assigned only once the whole batch is valid, so a
        // rejected batch never leaves a gap that peers would see.
        let mut seq = self.local_seq;
        for op in &mut ops {
            if !is_system_collection(&op.state.coll) {
                seq += 1;
                op.origin = Origin(device, seq);
            }
        }
        let sync = self.opts.durability == Durability::Sync;
        self.append_txn(&ops, sync)?;
        Ok(versions)
    }

    /// Append ops as one transaction. In-memory state changes only after the bytes
    /// (and, with `sync`, the flush) succeeded.
    pub(crate) fn append_txn(&mut self, ops: &[Op], sync: bool) -> Result<()> {
        if ops.is_empty() {
            return Ok(());
        }
        let mut buf = std::mem::take(&mut self.buf);
        buf.clear();
        let mut spans = Vec::with_capacity(ops.len());
        for (i, op) in ops.iter().enumerate() {
            let payload = codec::encode(op, self.manifest.format)?;
            let start = buf.len();
            frame::encode(&payload, if i + 1 == ops.len() { END_OF_TXN } else { 0 }, &mut buf);
            spans.push((start, buf.len() - start));
        }
        if self.active_len > 0 && self.active_len + buf.len() as u64 > self.opts.segment_max_bytes {
            self.roll_segment()?;
        }
        let base = self.active_len;
        let active = self.active.as_ref().ok_or(Error::Poisoned)?;
        let res = fsutil::write_all_at(active, &buf, base).and_then(|_| if sync { active.sync_data() } else { Ok(()) });
        if let Err(e) = res {
            if active.set_len(base).and_then(|_| active.sync_data()).is_err() {
                self.poisoned = true;
            }
            self.buf = buf;
            return Err(e.into());
        }
        self.active_len += buf.len() as u64;
        let seg = *self.manifest.segments.last().expect("at least one segment");
        for (op, (start, len)) in ops.iter().zip(spans) {
            let loc = Loc {
                seg,
                off: base + start as u64,
                len: len as u32,
                version: op.state.version,
                deleted: op.state.deleted,
            };
            let s = &op.state;
            let fields = if s.deleted { None } else { Some(&s.fields) };
            self.track(s.coll.clone(), s.id, s.rev, op.origin, loc, fields);
        }
        self.buf = buf;
        Ok(())
    }

    /// Flush buffered writes to disk.
    pub fn flush(&mut self) -> Result<()> {
        if let Some(a) = &self.active {
            a.sync_data()?;
        }
        Ok(())
    }

    fn roll_segment(&mut self) -> Result<()> {
        if let Some(a) = &self.active {
            a.sync_all()?;
        }
        let id = self.manifest.next_segment;
        let path = self.seg_path(id);
        File::create(&path)?.sync_all()?;
        let mut m = self.manifest.clone();
        m.segments.push(id);
        m.next_segment += 1;
        self.save_manifest(&m)?;
        self.manifest = m;
        self.readers.insert(id, File::open(&path)?);
        self.active = Some(OpenOptions::new().read(true).write(true).open(&path)?);
        self.active_len = 0;
        Ok(())
    }

    /// Write a local-only record (system collections such as `_conflicts`).
    pub(crate) fn put_system(&mut self, coll: &str, id: Uuid, fields: Fields) -> Result<u64> {
        debug_assert!(is_system_collection(coll));
        Ok(self.write_internal(vec![Write::put(coll, id, fields)])?[0])
    }
}

pub(crate) fn seg_path(dir: &Path, id: u32) -> PathBuf {
    dir.join("journal").join(format!("{id:08}.kjl"))
}

fn load_or_init_manifest(dir: &Path) -> Result<Manifest> {
    let path = dir.join("MANIFEST");
    match fs::read(&path) {
        Ok(bytes) => {
            let m: Manifest = serde_json::from_slice(&bytes).map_err(|e| Error::ManifestCorrupt(e.to_string()))?;
            if !(MIN_FORMAT_VERSION..=FORMAT_VERSION).contains(&m.format) {
                return Err(Error::ManifestCorrupt(format!(
                    "unsupported format version {} (this build reads {MIN_FORMAT_VERSION}–{FORMAT_VERSION})",
                    m.format
                )));
            }
            if m.segments.is_empty() {
                return Err(Error::ManifestCorrupt("no segments listed".into()));
            }
            Ok(m)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            let has_segments = fs::read_dir(dir.join("journal"))?
                .filter_map(|e| e.ok())
                .any(|e| e.path().extension().is_some_and(|x| x == "kjl"));
            if has_segments {
                return Err(Error::ManifestMissing(dir.to_path_buf()));
            }
            let device = Uuid::new_v4().as_u64_pair().0;
            let m = Manifest {
                format: FORMAT_VERSION,
                device,
                segments: vec![1],
                next_segment: 2,
                indexes: vec![],
                compaction_floor: BTreeMap::new(),
            };
            File::create(seg_path(dir, 1))?.sync_all()?;
            fsutil::write_atomic(&path, &serde_json::to_vec_pretty(&m)?)?;
            Ok(m)
        }
        Err(e) => Err(e.into()),
    }
}

fn quarantine_dir(dir: &Path) -> Result<PathBuf> {
    let q = dir.join("quarantine");
    fs::create_dir_all(&q)?;
    Ok(q)
}

/// Save the bytes after `from` to quarantine, then cut the segment there.
fn quarantine_tail(dir: &Path, seg: u32, path: &Path, buf: &[u8], from: usize, reason: String) -> Result<TornTail> {
    let saved_to = quarantine_dir(dir)?.join(format!("{seg:08}-at-{from}-{}.bin", now_ms()));
    {
        let f = File::create(&saved_to)?;
        fsutil::write_all_at(&f, &buf[from..], 0)?;
        f.sync_all()?;
    }
    let f = OpenOptions::new().write(true).open(path)?;
    f.set_len(from as u64)?;
    f.sync_all()?;
    Ok(TornTail {
        segment: seg,
        offset: from as u64,
        bytes: (buf.len() - from) as u64,
        reason,
        saved_to,
    })
}

/// Leftover `*.tmp~` files are interrupted atomic writes; move them aside, never delete.
fn quarantine_tmp_files(dir: &Path) -> Result<Vec<PathBuf>> {
    fn walk(d: &Path, out: &mut Vec<PathBuf>) -> std::io::Result<()> {
        if !d.exists() {
            return Ok(());
        }
        for e in fs::read_dir(d)? {
            let e = e?;
            let p = e.path();
            if e.file_type()?.is_dir() {
                walk(&p, out)?;
            } else if p.to_string_lossy().ends_with(".tmp~") {
                out.push(p);
            }
        }
        Ok(())
    }
    let mut found = Vec::new();
    for sub in ["", "journal", "blobs"] {
        let d = if sub.is_empty() {
            dir.to_path_buf()
        } else {
            dir.join(sub)
        };
        if sub.is_empty() {
            if d.exists() {
                for e in fs::read_dir(&d)? {
                    let p = e?.path();
                    if p.is_file() && p.to_string_lossy().ends_with(".tmp~") {
                        found.push(p);
                    }
                }
            }
        } else {
            walk(&d, &mut found)?;
        }
    }
    let mut moved = Vec::new();
    if !found.is_empty() {
        let q = quarantine_dir(dir)?;
        for p in found {
            let name = format!("{}-{}", now_ms(), p.file_name().unwrap().to_string_lossy());
            let target = q.join(name);
            fs::rename(&p, &target)?;
            moved.push(target);
        }
    }
    Ok(moved)
}

fn orphan_segments(dir: &Path, m: &Manifest) -> Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    for e in fs::read_dir(dir.join("journal"))? {
        let p = e?.path();
        if p.extension().is_some_and(|x| x == "kjl") {
            let id = p
                .file_stem()
                .and_then(|s| s.to_str())
                .and_then(|s| s.parse::<u32>().ok());
            if id.is_none_or(|id| !m.segments.contains(&id)) {
                out.push(p);
            }
        }
    }
    Ok(out)
}
