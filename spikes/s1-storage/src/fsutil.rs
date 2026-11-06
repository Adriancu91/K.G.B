//! Filesystem primitives: atomic replace, positional reads, location safety.

use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use crate::error::{Error, Result};

/// Write `bytes` to `path` atomically: temp file → flush to disk → replace.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let tmp = tmp_path(path);
    {
        let mut f = File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
    }
    replace(&tmp, path)
}

pub fn tmp_path(path: &Path) -> PathBuf {
    let mut s = path.as_os_str().to_owned();
    s.push(".tmp~");
    PathBuf::from(s)
}

/// Atomically move `from` over `to`, durable once it returns.
#[cfg(windows)]
pub fn replace(from: &Path, to: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH, MoveFileExW};
    let w = |p: &Path| p.as_os_str().encode_wide().chain(Some(0)).collect::<Vec<u16>>();
    let (a, b) = (w(from), w(to));
    // SAFETY: both buffers are NUL-terminated UTF-16 strings that outlive the call.
    let ok = unsafe {
        MoveFileExW(
            a.as_ptr(),
            b.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if ok == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
pub fn replace(from: &Path, to: &Path) -> io::Result<()> {
    fs::rename(from, to)?;
    if let Some(dir) = to.parent() {
        File::open(dir)?.sync_all()?;
    }
    Ok(())
}

pub fn read_exact_at(file: &File, buf: &mut [u8], mut off: u64) -> io::Result<()> {
    let mut done = 0;
    while done < buf.len() {
        #[cfg(windows)]
        let n = std::os::windows::fs::FileExt::seek_read(file, &mut buf[done..], off)?;
        #[cfg(unix)]
        let n = std::os::unix::fs::FileExt::read_at(file, &mut buf[done..], off)?;
        if n == 0 {
            return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "short read"));
        }
        done += n;
        off += n as u64;
    }
    Ok(())
}

pub fn write_all_at(file: &File, mut buf: &[u8], mut off: u64) -> io::Result<()> {
    while !buf.is_empty() {
        #[cfg(windows)]
        let n = std::os::windows::fs::FileExt::seek_write(file, buf, off)?;
        #[cfg(unix)]
        let n = std::os::unix::fs::FileExt::write_at(file, buf, off)?;
        if n == 0 {
            return Err(io::Error::new(io::ErrorKind::WriteZero, "short write"));
        }
        buf = &buf[n..];
        off += n as u64;
    }
    Ok(())
}

/// Refuse workspaces inside cloud-synchronised folders: sync clients rewrite files
/// behind our back and break the atomic-replace guarantees.
pub fn check_location(dir: &Path) -> Result<()> {
    let abs = std::path::absolute(dir)?;
    let lower = abs.to_string_lossy().to_lowercase();
    for var in ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"] {
        if let Ok(root) = std::env::var(var)
            && !root.is_empty()
            && lower.starts_with(&root.to_lowercase())
        {
            return Err(Error::UnsafeLocation(abs));
        }
    }
    let unsafe_part = abs.components().any(|c| {
        let s = c.as_os_str().to_string_lossy().to_lowercase();
        s == "onedrive"
            || s.starts_with("onedrive -")
            || s == "dropbox"
            || s == "google drive"
            || s == "icloud drive"
            || s == "iclouddrive"
    });
    if unsafe_part {
        Err(Error::UnsafeLocation(abs))
    } else {
        Ok(())
    }
}

/// Recursively copy a directory tree (used by backup/restore).
pub fn copy_tree(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), &target)?;
            sync_path(&target)?;
        }
    }
    Ok(())
}

/// Flush an existing file to disk. On Windows FlushFileBuffers needs write access,
/// so a read-only handle (`File::open`) fails with "Access is denied".
pub fn sync_path(path: &Path) -> io::Result<()> {
    std::fs::OpenOptions::new().write(true).open(path)?.sync_all()
}
