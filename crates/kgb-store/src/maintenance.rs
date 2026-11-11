//! Compaction, backup/restore, explicit repair, blobs.

use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Write as _};
use std::path::{Path, PathBuf};
use std::time::Instant;

use serde::{Deserialize, Serialize};

use crate::codec;
use crate::error::{Error, Result};
use crate::frame::{self, Decoded, END_OF_TXN};
use crate::fsutil;
use crate::store::{FORMAT_VERSION, Loc, Manifest, Options, Store, now_ms, seg_path};

#[derive(Debug, Clone)]
pub struct CompactReport {
    pub bytes_before: u64,
    pub bytes_after: u64,
    pub records: usize,
    pub ms: u128,
}

/// What [`Store::purge_leftovers`] removed.
#[derive(Debug, Clone, Default, Serialize)]
pub struct PurgeReport {
    pub files: usize,
    pub bytes: u64,
}

/// Result of one incremental compaction step.
#[derive(Debug, Clone)]
pub struct StepReport {
    /// Segment that was rewritten.
    pub segment: u32,
    /// Its replacement (same position in the replay order).
    pub replaced_by: u32,
    pub bytes_before: u64,
    pub bytes_after: u64,
    pub records: usize,
    pub ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupInfo {
    pub format: u32,
    pub created_ms: u128,
    pub records: usize,
    /// Relative path → BLAKE3 hex of every file in the backup.
    pub files: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Default)]
pub struct RepairReport {
    pub segments_rewritten: Vec<u32>,
    pub bytes_removed: u64,
    pub originals_saved_to: Vec<PathBuf>,
}

impl Store {
    fn segment_bytes(&self) -> Result<u64> {
        let mut n = 0;
        for &s in &self.manifest.segments {
            n += fs::metadata(self.seg_path(s))?.len();
        }
        Ok(n)
    }

    pub fn disk_bytes(&self) -> Result<u64> {
        self.segment_bytes()
    }

    /// Live bytes per sealed segment, and each segment's size on disk.
    fn segment_usage(&self) -> Result<Vec<(u32, u64, u64)>> {
        let mut live: BTreeMap<u32, u64> = BTreeMap::new();
        for l in self.keydir.values() {
            *live.entry(l.seg).or_default() += l.len as u64;
        }
        let sealed = &self.manifest.segments[..self.manifest.segments.len().saturating_sub(1)];
        let mut out = Vec::with_capacity(sealed.len());
        for &seg in sealed {
            let size = fs::metadata(self.seg_path(seg))?.len();
            out.push((seg, live.get(&seg).copied().unwrap_or(0), size));
        }
        Ok(out)
    }

    /// One bounded step of incremental compaction (Etapa 2, step 2.5).
    ///
    /// Picks the sealed segment with the largest share of dead bytes (at least
    /// `min_garbage`, e.g. 0.3), rewrites only its live records into a new
    /// segment placed at the **same position** in the replay order, and commits
    /// by replacing the manifest atomically. The work per step is bounded by one
    /// segment, so callers can release their lock between steps. Returns `None`
    /// when no segment is worth rewriting.
    ///
    /// Only stores already in the current format compact incrementally; an older
    /// journal is upgraded by a full [`Store::compact`] (D-029).
    pub fn compact_step(&mut self, min_garbage: f64) -> Result<Option<StepReport>> {
        if self.manifest.format != FORMAT_VERSION {
            return Err(Error::InvalidInput(format!(
                "incremental compaction needs journal format {FORMAT_VERSION}; run a full compaction first"
            )));
        }
        let t0 = Instant::now();
        self.flush()?;
        let pick = self
            .segment_usage()?
            .into_iter()
            .filter(|(_, live, size)| *size > 0 && 1.0 - (*live as f64 / *size as f64) >= min_garbage)
            .max_by(|a, b| {
                let ga = 1.0 - a.1 as f64 / a.2 as f64;
                let gb = 1.0 - b.1 as f64 / b.2 as f64;
                ga.partial_cmp(&gb).unwrap_or(std::cmp::Ordering::Equal)
            });
        let Some((seg, _, bytes_before)) = pick else {
            return Ok(None);
        };

        let mut locs: Vec<Loc> = self.keydir.values().filter(|l| l.seg == seg).copied().collect();
        locs.sort_by_key(|l| l.off);
        let new_id = self.manifest.next_segment;
        let final_path = seg_path(&self.dir, new_id);
        let tmp = fsutil::tmp_path(&final_path);
        let mut w = BufWriter::new(File::create(&tmp)?);
        let mut moved: Vec<(String, uuid::Uuid, Loc)> = Vec::with_capacity(locs.len());
        let mut off = 0u64;
        let mut buf = Vec::new();
        for loc in &locs {
            let mut op = self.read_op(loc)?;
            op.compacted = true;
            op.changed.clear();
            op.record_base = None;
            buf.clear();
            frame::encode(&codec::encode(&op, FORMAT_VERSION)?, END_OF_TXN, &mut buf);
            w.write_all(&buf)?;
            moved.push((
                op.state.coll,
                op.state.id,
                Loc {
                    seg: new_id,
                    off,
                    len: buf.len() as u32,
                    version: loc.version,
                    deleted: loc.deleted,
                },
            ));
            off += buf.len() as u64;
        }
        w.into_inner().map_err(|e| e.into_error())?.sync_all()?;
        fsutil::replace(&tmp, &final_path)?;

        // Commit point: the manifest now lists the new segment where the old one was.
        let mut m = self.manifest.clone();
        for s in m.segments.iter_mut() {
            if *s == seg {
                *s = new_id;
            }
        }
        m.next_segment = new_id + 1;
        m.compaction_floor = self.version_vector();
        self.save_manifest(&m)?;
        self.manifest = m;

        // In-memory state follows without a full reload.
        self.readers.insert(new_id, File::open(&final_path)?);
        for (coll, id, loc) in &moved {
            self.keydir.insert(coll, *id, *loc);
        }
        self.readers.remove(&seg);

        // Keep the replaced segment as the previous generation, like `compact`.
        let retired = self.dir.join("retired");
        fs::create_dir_all(&retired)?;
        for e in fs::read_dir(&retired)? {
            let p = e?.path();
            if p.extension().is_some_and(|x| x == "kjl") {
                fs::remove_file(p)?;
            }
        }
        fs::rename(seg_path(&self.dir, seg), retired.join(format!("{seg:08}.kjl")))?;
        Ok(Some(StepReport {
            segment: seg,
            replaced_by: new_id,
            bytes_before,
            bytes_after: off,
            records: moved.len(),
            ms: t0.elapsed().as_millis(),
        }))
    }

    /// Rewrite only the newest state of every record into fresh segments.
    /// Older history is dropped; peers behind the new floor must do a full resync.
    /// The previous generation is kept in `retired/` until the next compaction.
    pub fn compact(&mut self) -> Result<CompactReport> {
        let t0 = Instant::now();
        self.flush()?;
        let bytes_before = self.segment_bytes()?;
        let mut locs: Vec<Loc> = self.keydir.values().copied().collect();
        locs.sort_by_key(|l| (l.seg, l.off));
        let mut next = self.manifest.next_segment;
        let mut written: Vec<(u32, PathBuf)> = Vec::new();
        let mut cur: Option<(u32, PathBuf, BufWriter<File>, u64)> = None;
        let mut buf = Vec::new();
        for loc in &locs {
            let mut op = self.read_op(loc)?;
            op.compacted = true;
            op.changed.clear();
            op.record_base = None;
            buf.clear();
            frame::encode(&codec::encode(&op, FORMAT_VERSION)?, END_OF_TXN, &mut buf);
            let full = cur
                .as_ref()
                .is_some_and(|c| c.3 > 0 && c.3 + buf.len() as u64 > self.opts.segment_max_bytes);
            if cur.is_none() || full {
                if let Some((id, tmp, w, _)) = cur.take() {
                    w.into_inner().map_err(|e| e.into_error())?.sync_all()?;
                    written.push((id, tmp));
                }
                let id = next;
                next += 1;
                let tmp = fsutil::tmp_path(&seg_path(&self.dir, id));
                cur = Some((id, tmp.clone(), BufWriter::new(File::create(&tmp)?), 0));
            }
            let c = cur.as_mut().unwrap();
            c.2.write_all(&buf)?;
            c.3 += buf.len() as u64;
        }
        if let Some((id, tmp, w, _)) = cur.take() {
            w.into_inner().map_err(|e| e.into_error())?.sync_all()?;
            written.push((id, tmp));
        }
        for (id, tmp) in &written {
            fsutil::replace(tmp, &seg_path(&self.dir, *id))?;
        }
        let active = next;
        next += 1;
        File::create(seg_path(&self.dir, active))?.sync_all()?;

        let old: Vec<u32> = self.manifest.segments.clone();
        let mut m: Manifest = self.manifest.clone();
        m.segments = written.iter().map(|(id, _)| *id).chain(Some(active)).collect();
        m.next_segment = next;
        m.compaction_floor = self.version_vector();
        // Compaction is the only place where a journal moves to the current
        // format (D-029); the manifest switch is the commit point.
        m.format = FORMAT_VERSION;
        self.save_manifest(&m)?;
        self.manifest = m;
        self.load()?;

        let retired = self.dir.join("retired");
        if retired.exists() {
            fs::remove_dir_all(&retired)?;
        }
        fs::create_dir_all(&retired)?;
        for id in old {
            fs::rename(seg_path(&self.dir, id), retired.join(format!("{id:08}.kjl")))?;
        }
        Ok(CompactReport {
            bytes_before,
            bytes_after: self.segment_bytes()?,
            records: self.keydir.len(),
            ms: t0.elapsed().as_millis(),
        })
    }

    /// Consistent copy of the workspace into an empty directory, with a hash of every file.
    pub fn backup_to(&mut self, dest: &Path) -> Result<BackupInfo> {
        if dest.exists() && fs::read_dir(dest)?.next().is_some() {
            return Err(Error::InvalidInput(format!(
                "backup destination not empty: {}",
                dest.display()
            )));
        }
        self.flush()?;
        let partial = fsutil::tmp_path(dest);
        if partial.exists() {
            return Err(Error::InvalidInput(format!(
                "leftover partial backup: {}",
                partial.display()
            )));
        }
        fs::create_dir_all(partial.join("journal"))?;
        let copy = |rel: &str| -> Result<()> {
            let to = partial.join(rel);
            fs::copy(self.dir.join(rel), &to)?;
            fsutil::sync_path(&to)?;
            Ok(())
        };
        copy("MANIFEST")?;
        for &s in &self.manifest.segments.clone() {
            copy(&format!("journal/{s:08}.kjl"))?;
        }
        if self.dir.join("blobs").exists() {
            fsutil::copy_tree(&self.dir.join("blobs"), &partial.join("blobs"))?;
        }
        let info = BackupInfo {
            format: 1,
            created_ms: now_ms(),
            records: self.keydir.len(),
            files: hash_tree(&partial)?,
        };
        fsutil::write_atomic(&partial.join("BACKUP.json"), &serde_json::to_vec_pretty(&info)?)?;
        if dest.exists() {
            fs::remove_dir(dest)?;
        }
        fs::rename(&partial, dest)?;
        Ok(info)
    }

    /// Put a blob (attachment) into content-addressed storage; returns its BLAKE3 hex.
    pub fn put_blob(&self, data: &[u8]) -> Result<String> {
        let hash = blake3::hash(data).to_hex().to_string();
        let path = blob_path(&self.dir, &hash);
        if !path.exists() {
            fs::create_dir_all(path.parent().unwrap())?;
            fsutil::write_atomic(&path, data)?;
        }
        Ok(hash)
    }

    /// Whether a blob is present (not checked; see [`Store::get_blob`]).
    pub fn has_blob(&self, hash: &str) -> bool {
        valid_hash(hash) && blob_path(&self.dir, hash).is_file()
    }

    /// The blob's file, for streaming it to another device (Etapa 6, 6.8).
    pub fn blob_file(&self, hash: &str) -> Result<PathBuf> {
        if !valid_hash(hash) {
            return Err(Error::InvalidInput(format!("not a blob hash: {hash}")));
        }
        let p = blob_path(&self.dir, hash);
        if !p.is_file() {
            return Err(Error::InvalidInput(format!("blob not here: {hash}")));
        }
        Ok(p)
    }

    /// Where a blob being received is kept until it is complete. A transfer
    /// that stops keeps what arrived and continues from there.
    pub fn incoming_blob_path(&self, hash: &str) -> Result<PathBuf> {
        if !valid_hash(hash) {
            return Err(Error::InvalidInput(format!("not a blob hash: {hash}")));
        }
        let d = self.dir.join("incoming");
        fs::create_dir_all(&d)?;
        Ok(d.join(format!("{hash}.part")))
    }

    /// Checks a fully received blob against its hash (BLAKE3, read in pieces)
    /// and moves it into the blob store. On a mismatch the partial file is
    /// deleted, so the next transfer starts over.
    pub fn adopt_incoming_blob(&self, hash: &str) -> Result<()> {
        let part = self.incoming_blob_path(hash)?;
        let mut h = blake3::Hasher::new();
        let mut f = fs::File::open(&part)?;
        let mut buf = vec![0u8; 1 << 20];
        loop {
            let n = std::io::Read::read(&mut f, &mut buf)?;
            if n == 0 {
                break;
            }
            h.update(&buf[..n]);
        }
        drop(f);
        if h.finalize().to_hex().as_str() != hash {
            let _ = fs::remove_file(&part);
            return Err(Error::BlobMismatch(hash.into()));
        }
        let dest = blob_path(&self.dir, hash);
        if dest.exists() {
            fs::remove_file(&part)?;
            return Ok(());
        }
        fs::create_dir_all(dest.parent().unwrap())?;
        fsutil::sync_path(&part)?;
        fs::rename(&part, &dest)?;
        Ok(())
    }

    /// Read a blob and verify it still matches its hash.
    pub fn get_blob(&self, hash: &str) -> Result<Vec<u8>> {
        if hash.len() != 64 || !hash.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(Error::InvalidInput(format!("not a blob hash: {hash}")));
        }
        let data = fs::read(blob_path(&self.dir, hash))?;
        if blake3::hash(&data).to_hex().as_str() != hash {
            return Err(Error::BlobMismatch(hash.into()));
        }
        Ok(data)
    }
}

impl Store {
    /// Bytes held by leftovers: `quarantine/`, `retired/` and journal segments
    /// the manifest does not list. Nothing here is needed by the live data.
    pub fn leftover_bytes(&self) -> Result<u64> {
        let mut n = 0;
        for d in ["quarantine", "retired"] {
            n += tree_bytes(&self.dir.join(d))?;
        }
        for p in crate::store::orphan_segments(&self.dir, &self.manifest)? {
            n += fs::metadata(p).map(|m| m.len()).unwrap_or(0);
        }
        Ok(n)
    }

    /// Permanently removes the leftovers counted by [`Store::leftover_bytes`].
    /// **Only on an explicit user request** (after a backup): quarantine holds
    /// the raw bytes of anything recovery cut away, kept for diagnosis.
    pub fn purge_leftovers(&mut self) -> Result<PurgeReport> {
        let mut r = PurgeReport::default();
        for d in ["quarantine", "retired"] {
            let dir = self.dir.join(d);
            if dir.exists() {
                r.bytes += tree_bytes(&dir)?;
                r.files += tree_files(&dir)?;
                fs::remove_dir_all(&dir)?;
            }
        }
        for p in crate::store::orphan_segments(&self.dir, &self.manifest)? {
            r.bytes += fs::metadata(&p)?.len();
            r.files += 1;
            fs::remove_file(p)?;
        }
        self.report.orphan_segments.clear();
        Ok(r)
    }

    /// Permanently removes `retired/`: the journal generation before the last compaction and the blobs retired
    /// by the last collection (D-090). Unlike [`Store::purge_leftovers`] it keeps `quarantine/` (what recovery cut
    /// away, kept for diagnosis) and touches nothing the live data needs.
    pub fn drop_retired(&mut self) -> Result<PurgeReport> {
        let mut r = PurgeReport::default();
        let dir = self.dir.join("retired");
        if dir.exists() {
            r.bytes = tree_bytes(&dir)?;
            r.files = tree_files(&dir)?;
            fs::remove_dir_all(&dir)?;
        }
        Ok(r)
    }

    /// Hashes of every stored blob.
    pub fn blob_hashes(&self) -> Result<Vec<String>> {
        let root = self.dir.join("blobs");
        let mut out = Vec::new();
        if !root.exists() {
            return Ok(out);
        }
        for d in fs::read_dir(&root)? {
            let d = d?;
            if !d.file_type()?.is_dir() {
                continue;
            }
            for f in fs::read_dir(d.path())? {
                let name = f?.file_name().to_string_lossy().to_string();
                if name.len() == 64 && name.bytes().all(|b| b.is_ascii_hexdigit()) {
                    out.push(name);
                }
            }
        }
        out.sort();
        Ok(out)
    }

    /// Moves the given blobs to `retired/blobs/` (the previous generation there
    /// is removed first), like segments after compaction. Returns bytes moved.
    /// Callers decide what is unreferenced; the store never guesses.
    pub fn retire_blobs(&self, hashes: &[String]) -> Result<u64> {
        let retired = self.dir.join("retired").join("blobs");
        if retired.exists() {
            fs::remove_dir_all(&retired)?;
        }
        if hashes.is_empty() {
            return Ok(0);
        }
        fs::create_dir_all(&retired)?;
        let mut bytes = 0;
        for h in hashes {
            if h.len() != 64 || !h.bytes().all(|b| b.is_ascii_hexdigit()) {
                return Err(Error::InvalidInput(format!("not a blob hash: {h}")));
            }
            let p = blob_path(&self.dir, h);
            if p.exists() {
                bytes += fs::metadata(&p)?.len();
                fs::rename(&p, retired.join(h))?;
            }
        }
        Ok(bytes)
    }
}

fn valid_hash(hash: &str) -> bool {
    hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit())
}

fn blob_path(dir: &Path, hash: &str) -> PathBuf {
    dir.join("blobs").join(&hash[..2]).join(hash)
}

fn hash_tree(root: &Path) -> Result<BTreeMap<String, String>> {
    fn walk(root: &Path, d: &Path, out: &mut BTreeMap<String, String>) -> Result<()> {
        for e in fs::read_dir(d)? {
            let e = e?;
            let p = e.path();
            if e.file_type()?.is_dir() {
                walk(root, &p, out)?;
            } else {
                let rel = p.strip_prefix(root).unwrap().to_string_lossy().replace('\\', "/");
                if rel != "BACKUP.json" {
                    out.insert(rel, blake3::hash(&fs::read(&p)?).to_hex().to_string());
                }
            }
        }
        Ok(())
    }
    let mut out = BTreeMap::new();
    walk(root, root, &mut out)?;
    Ok(out)
}

/// Check that every file of a backup is present, unchanged, and nothing extra exists.
pub fn verify_backup(dir: &Path) -> Result<BackupInfo> {
    let info: BackupInfo = serde_json::from_slice(&fs::read(dir.join("BACKUP.json"))?)
        .map_err(|e| Error::BackupInvalid(format!("BACKUP.json: {e}")))?;
    let actual = hash_tree(dir)?;
    if actual != info.files {
        let bad: Vec<&String> = info
            .files
            .keys()
            .chain(actual.keys())
            .filter(|k| info.files.get(*k) != actual.get(*k))
            .collect();
        return Err(Error::BackupInvalid(format!("files differ: {bad:?}")));
    }
    Ok(info)
}

/// Verify a backup, copy it into an empty `target`, then open it (full recovery pass).
pub fn restore_backup(backup: &Path, target: &Path, opts: Options) -> Result<Store> {
    verify_backup(backup)?;
    if target.exists() && fs::read_dir(target)?.next().is_some() {
        return Err(Error::InvalidInput(format!(
            "restore target not empty: {}",
            target.display()
        )));
    }
    fsutil::copy_tree(backup, target)?;
    fs::remove_file(target.join("BACKUP.json"))?;
    Store::open(target, opts)
}

/// Explicit, user-triggered repair after `Error::Corruption`: keeps only complete,
/// valid transactions. Each original segment is saved to `quarantine/` first.
/// Data in damaged regions is lost — that is why this never runs automatically.
pub fn repair(dir: &Path) -> Result<RepairReport> {
    let lock = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(dir.join("LOCK"))?;
    match lock.try_lock() {
        Ok(()) => {}
        Err(fs::TryLockError::WouldBlock) => return Err(Error::Locked(dir.to_path_buf())),
        Err(fs::TryLockError::Error(e)) => return Err(e.into()),
    }
    let m: Manifest =
        serde_json::from_slice(&fs::read(dir.join("MANIFEST"))?).map_err(|e| Error::ManifestCorrupt(e.to_string()))?;
    let q = dir.join("quarantine");
    fs::create_dir_all(&q)?;
    let mut report = RepairReport::default();
    for &seg in &m.segments {
        let path = seg_path(dir, seg);
        let buf = fs::read(&path)?;
        let mut good = Vec::with_capacity(buf.len());
        let mut txn = Vec::new();
        let mut off = 0;
        while off < buf.len() {
            match frame::decode_at(&buf, off) {
                Decoded::End => break,
                Decoded::Frame { flags, next, .. } => {
                    txn.extend_from_slice(&buf[off..next]);
                    if flags & END_OF_TXN != 0 {
                        good.append(&mut txn);
                    }
                    off = next;
                }
                Decoded::Invalid(_) => {
                    txn.clear();
                    match frame::find_next_valid(&buf, off + 1) {
                        Some(n) => off = n,
                        None => break,
                    }
                }
            }
        }
        if good.len() != buf.len() {
            let saved = q.join(format!("{seg:08}-original-{}.kjl", now_ms()));
            fs::copy(&path, &saved)?;
            fsutil::sync_path(&saved)?;
            fsutil::write_atomic(&path, &good)?;
            report.bytes_removed += (buf.len() - good.len()) as u64;
            report.segments_rewritten.push(seg);
            report.originals_saved_to.push(saved);
        }
    }
    Ok(report)
}

fn tree_bytes(d: &Path) -> Result<u64> {
    if !d.exists() {
        return Ok(0);
    }
    let mut n = 0;
    for e in fs::read_dir(d)? {
        let e = e?;
        n += if e.file_type()?.is_dir() {
            tree_bytes(&e.path())?
        } else {
            e.metadata()?.len()
        };
    }
    Ok(n)
}

fn tree_files(d: &Path) -> Result<usize> {
    let mut n = 0;
    for e in fs::read_dir(d)? {
        let e = e?;
        n += if e.file_type()?.is_dir() {
            tree_files(&e.path())?
        } else {
            1
        };
    }
    Ok(n)
}
