//! Compaction, backup/restore, explicit repair, blobs.

use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Write as _};
use std::path::{Path, PathBuf};
use std::time::Instant;

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};
use crate::frame::{self, Decoded, END_OF_TXN};
use crate::fsutil;
use crate::store::{Loc, Manifest, Options, Store, now_ms, seg_path};

#[derive(Debug, Clone)]
pub struct CompactReport {
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
            frame::encode(&serde_json::to_vec(&op)?, END_OF_TXN, &mut buf);
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
            File::open(&to)?.sync_all()?;
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
            File::open(&saved)?.sync_all()?;
            fsutil::write_atomic(&path, &good)?;
            report.bytes_removed += (buf.len() - good.len()) as u64;
            report.segments_rewritten.push(seg);
            report.originals_saved_to.push(saved);
        }
    }
    Ok(report)
}
