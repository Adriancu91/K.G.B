//! Logging and diagnostics (Etapa 1, step 1.3; decision D-026).
//!
//! - Events from `tracing` are written as JSON lines to `<dir>/kgb.log`.
//! - Size-based rotation: when the current file would exceed `max_file_bytes`
//!   it becomes `kgb.1.log`, older files shift up, and at most `max_files`
//!   files are kept (Master Plan §10: logs must not grow without bound).
//! - Redaction: fields whose name looks sensitive (passwords, tokens, keys,
//!   user content) are written as `"[redactat]"`. This is a safety net; code
//!   must still never log secrets or user content (Metaprompt §12).
//! - Panics are logged at ERROR before the previous panic hook runs.

use std::fmt::Write as _;
use std::fs::{self, File, OpenOptions};
use std::io::{self, BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::{Map, Value};
use tracing::field::{Field, Visit};
use tracing::{Event, Level, Subscriber};
use tracing_subscriber::Layer;
use tracing_subscriber::layer::{Context, SubscriberExt};
use tracing_subscriber::util::SubscriberInitExt;

pub const LOG_FILE: &str = "kgb.log";
const REDACTED: &str = "[redactat]";

/// Field names (lower-case substrings) whose values are never written.
const SENSITIVE: &[&str] = &[
    "password",
    "parola",
    "secret",
    "token",
    "key",
    "cheie",
    "credential",
    "content",
    "continut",
    "text",
    "body",
];

#[derive(Debug, Clone, Copy)]
pub struct LogConfig {
    pub max_file_bytes: u64,
    pub max_files: usize,
    pub min_level: Level,
}

impl Default for LogConfig {
    fn default() -> Self {
        LogConfig {
            max_file_bytes: 2 * 1024 * 1024,
            max_files: 5,
            min_level: Level::INFO,
        }
    }
}

/// Appends lines to `kgb.log` and rotates by size.
pub struct RotatingWriter {
    dir: PathBuf,
    cfg: LogConfig,
    file: File,
    len: u64,
}

impl RotatingWriter {
    pub fn open(dir: &Path, cfg: LogConfig) -> io::Result<RotatingWriter> {
        assert!(cfg.max_files >= 1 && cfg.max_file_bytes > 0);
        fs::create_dir_all(dir)?;
        let file = OpenOptions::new().create(true).append(true).open(dir.join(LOG_FILE))?;
        let len = file.metadata()?.len();
        Ok(RotatingWriter {
            dir: dir.to_path_buf(),
            cfg,
            file,
            len,
        })
    }

    fn rotated(&self, n: usize) -> PathBuf {
        self.dir.join(format!("kgb.{n}.log"))
    }

    fn rotate(&mut self) -> io::Result<()> {
        self.file.flush()?;
        let current = self.dir.join(LOG_FILE);
        let oldest = self.cfg.max_files - 1;
        if oldest > 0 {
            let _ = fs::remove_file(self.rotated(oldest));
            for n in (1..oldest).rev() {
                let from = self.rotated(n);
                if from.exists() {
                    fs::rename(&from, self.rotated(n + 1))?;
                }
            }
            // Rust opens files with FILE_SHARE_DELETE on Windows, so the
            // current file can be renamed while our handle is still open.
            fs::rename(&current, self.rotated(1))?;
        }
        // With a single allowed file, truncating it is the rotation.
        self.file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&current)?;
        self.len = 0;
        Ok(())
    }

    /// Writes one line (a trailing newline is added).
    pub fn write_line(&mut self, line: &str) -> io::Result<()> {
        let n = line.len() as u64 + 1;
        if self.len > 0 && self.len + n > self.cfg.max_file_bytes {
            self.rotate()?;
        }
        self.file.write_all(line.as_bytes())?;
        self.file.write_all(b"\n")?;
        self.len += n;
        Ok(())
    }

    pub fn flush(&mut self) -> io::Result<()> {
        self.file.flush()
    }
}

fn is_sensitive(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    SENSITIVE.iter().any(|s| n.contains(s))
}

struct JsonVisitor {
    fields: Map<String, Value>,
    message: Option<String>,
}

impl JsonVisitor {
    fn put(&mut self, field: &Field, v: Value) {
        let name = field.name();
        if name == "message" {
            self.message = Some(match v {
                Value::String(s) => s,
                other => other.to_string(),
            });
        } else if is_sensitive(name) {
            self.fields.insert(name.to_string(), Value::String(REDACTED.into()));
        } else {
            self.fields.insert(name.to_string(), v);
        }
    }
}

impl Visit for JsonVisitor {
    fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
        self.put(field, Value::String(format!("{value:?}")));
    }
    fn record_str(&mut self, field: &Field, value: &str) {
        self.put(field, Value::String(value.to_string()));
    }
    fn record_i64(&mut self, field: &Field, value: i64) {
        self.put(field, Value::from(value));
    }
    fn record_u64(&mut self, field: &Field, value: u64) {
        self.put(field, Value::from(value));
    }
    fn record_bool(&mut self, field: &Field, value: bool) {
        self.put(field, Value::from(value));
    }
    fn record_f64(&mut self, field: &Field, value: f64) {
        self.put(field, Value::from(value));
    }
}

/// `tracing` layer that writes JSON lines through a [`RotatingWriter`].
pub struct FileLayer {
    writer: Arc<Mutex<RotatingWriter>>,
    min_level: Level,
}

impl<S: Subscriber> Layer<S> for FileLayer {
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        let meta = event.metadata();
        if *meta.level() > self.min_level {
            return;
        }
        let mut v = JsonVisitor {
            fields: Map::new(),
            message: None,
        };
        event.record(&mut v);
        let mut obj = Map::new();
        obj.insert("ts".into(), Value::String(utc_now()));
        obj.insert("level".into(), Value::String(meta.level().to_string()));
        obj.insert("target".into(), Value::String(meta.target().to_string()));
        obj.insert("msg".into(), Value::String(v.message.unwrap_or_default()));
        if !v.fields.is_empty() {
            obj.insert("fields".into(), Value::Object(v.fields));
        }
        let line = Value::Object(obj).to_string();
        if let Ok(mut w) = self.writer.lock() {
            // A failing log write must never take the app down.
            let _ = w.write_line(&line);
            if *meta.level() <= Level::WARN {
                let _ = w.flush();
            }
        }
    }
}

/// Handle returned by [`init`]; keeps the writer reachable for flushing.
#[derive(Clone)]
pub struct LogHandle {
    writer: Arc<Mutex<RotatingWriter>>,
    dir: PathBuf,
}

impl LogHandle {
    pub fn dir(&self) -> &Path {
        &self.dir
    }
    pub fn flush(&self) {
        if let Ok(mut w) = self.writer.lock() {
            let _ = w.flush();
        }
    }
}

/// Builds the layer without installing it (used by tests and by [`init`]).
pub fn layer(dir: &Path, cfg: LogConfig) -> io::Result<(FileLayer, LogHandle)> {
    let writer = Arc::new(Mutex::new(RotatingWriter::open(dir, cfg)?));
    Ok((
        FileLayer {
            writer: writer.clone(),
            min_level: cfg.min_level,
        },
        LogHandle {
            writer,
            dir: dir.to_path_buf(),
        },
    ))
}

/// Installs the global subscriber and the panic hook. Call once at startup.
pub fn init(dir: &Path, cfg: LogConfig) -> io::Result<LogHandle> {
    let (layer, handle) = layer(dir, cfg)?;
    tracing_subscriber::registry()
        .with(layer)
        .try_init()
        .map_err(|e| io::Error::other(format!("logging already initialised: {e}")))?;
    install_panic_hook(handle.clone());
    Ok(handle)
}

fn install_panic_hook(handle: LogHandle) {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_default();
        let payload = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "panic".into());
        tracing::error!(location = %location, "panic: {payload}");
        handle.flush();
        previous(info);
    }));
}

/// Reads the last `limit` WARN/ERROR entries from the current and rotated
/// files (newest last). Lines that are not valid JSON are skipped.
pub fn recent_problems(dir: &Path, limit: usize) -> Vec<Value> {
    let mut files: Vec<PathBuf> = (1..100)
        .map(|n| dir.join(format!("kgb.{n}.log")))
        .filter(|p| p.exists())
        .collect();
    files.reverse();
    files.push(dir.join(LOG_FILE));
    let mut out = Vec::new();
    for f in files {
        let Ok(file) = File::open(&f) else { continue };
        for line in BufReader::new(file).lines().map_while(Result::ok) {
            if let Ok(v) = serde_json::from_str::<Value>(&line)
                && matches!(v.get("level").and_then(Value::as_str), Some("WARN" | "ERROR"))
            {
                out.push(v);
            }
        }
    }
    let skip = out.len().saturating_sub(limit);
    out.split_off(skip)
}

/// What the diagnostic package must never carry (8.10), hidden from a text:
/// - runs of 10 or more digits (a CNP has 13, a card 16, a phone 10);
/// - IBANs (`RO49AAAA…`) and e-mail addresses;
/// - long tokens (keys, tokens, hashes: 32 or more letters and digits in a row, with digits);
/// - the Windows user's name in paths (`C:\Users\<nume>\…`).
pub fn scrub(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out: Vec<char> = Vec::with_capacity(chars.len());
    let mail = |c: char| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '+');
    let mut k = 0;
    while k < chars.len() {
        let c = chars[k];
        // A Windows user folder: keep `\Users\`, hide the name.
        if matches!(c, '\\' | '/') && k + 7 <= chars.len() {
            let seg: String = chars[k + 1..k + 6].iter().collect();
            if seg.eq_ignore_ascii_case("users") && matches!(chars[k + 6], '\\' | '/') {
                out.extend(&chars[k..k + 7]);
                k += 7;
                while k < chars.len() && !matches!(chars[k], '\\' | '/' | '"' | ' ' | '\n') {
                    k += 1;
                }
                out.extend("[utilizator]".chars());
                continue;
            }
        }
        // An e-mail: hide the local part already written and the domain.
        if c == '@' && k > 0 && mail(chars[k - 1]) && k + 1 < chars.len() && mail(chars[k + 1]) {
            while out.last().is_some_and(|x| mail(*x)) {
                out.pop();
            }
            k += 1;
            while k < chars.len() && mail(chars[k]) {
                k += 1;
            }
            out.extend("[e-mail]".chars());
            continue;
        }
        if c.is_ascii_alphanumeric() && (k == 0 || !chars[k - 1].is_ascii_alphanumeric()) {
            let mut e = k;
            while e < chars.len() && chars[e].is_ascii_alphanumeric() {
                e += 1;
            }
            if e < chars.len() && chars[e] == '@' {
                // the e-mail branch above takes it
                out.extend(&chars[k..e]);
                k = e;
                continue;
            }
            let tok = &chars[k..e];
            let digits = tok.iter().filter(|x| x.is_ascii_digit()).count();
            let iban = (15..=34).contains(&tok.len())
                && tok[..2].iter().all(char::is_ascii_uppercase)
                && tok[2..4].iter().all(char::is_ascii_digit);
            if iban {
                out.extend("[IBAN]".chars());
            } else if tok.len() >= 32 && digits > 0 {
                out.extend("[ascuns]".chars());
            } else if tok.len() >= 10 && digits == tok.len() {
                out.extend("[număr ascuns]".chars());
            } else {
                out.extend(tok);
            }
            k = e;
            continue;
        }
        out.push(c);
        k += 1;
    }
    out.into_iter().collect()
}

/// Plain-text diagnostic report. Contains versions, paths and recent
/// problems only — never records or document content.
pub fn diagnostic_report(app_version: &str, sections: &[(&str, String)], log_dir: &Path) -> String {
    let mut r = String::new();
    let _ = writeln!(r, "K.G.B. — raport de diagnostic");
    let _ = writeln!(r, "Generat (UTC): {}", utc_now());
    let _ = writeln!(r, "Versiune aplicație: {app_version}");
    let _ = writeln!(r, "Versiune nucleu: {}", crate::CORE_VERSION);
    let _ = writeln!(r, "Sistem: {} {}", std::env::consts::OS, std::env::consts::ARCH);
    for (k, v) in sections {
        let _ = writeln!(r, "{k}: {v}");
    }
    let _ = writeln!(r, "Folder loguri: {}", log_dir.display());
    let problems = recent_problems(log_dir, 50);
    let _ = writeln!(r, "\nUltimele avertismente și erori ({}):", problems.len());
    for p in problems {
        let _ = writeln!(r, "{p}");
    }
    // 8.10: nothing personal leaves in the package (CNP, IBAN, e-mail, keys, the Windows user's name).
    scrub(&r)
}

/// Current UTC time as `YYYY-MM-DDTHH:MM:SS.mmmZ` (no time-zone crate needed).
pub fn utc_now() -> String {
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format_utc(d.as_millis() as u64)
}

pub fn format_utc(ms: u64) -> String {
    let secs = ms / 1000;
    let days = (secs / 86_400) as i64;
    let sod = secs % 86_400;
    // Civil-from-days (H. Hinnant), valid for the proleptic Gregorian calendar.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{:03}Z",
        sod / 3600,
        (sod / 60) % 60,
        sod % 60,
        ms % 1000
    )
}

#[cfg(test)]
mod scrub_tests {
    use super::scrub;

    #[test]
    fn nothing_personal_is_left() {
        let t = "eroare la 1850101123456 (CNP) pe card 4111111111111111, tel 0722123456, IBAN RO49AAAA1B31007593840000, \
                 scris de ion.popescu+test@firma.ro în C:\\Users\\krono\\AppData\\Local\\kgb și /Users/ana/x, \
                 cheia a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8 \
                 la 2026-11-13T04:12:00.123Z, CUI 14399840, J40/1234/2020, versiunea 0.1.0";
        let s = scrub(t);
        for gone in ["1850101123456", "4111111111111111", "0722123456", "RO49AAAA1B31007593840000", "ion.popescu", "firma.ro", "krono", "ana/x", "a1b2c3d4e5f6"] {
            assert!(!s.contains(gone), "{gone} in {s}");
        }
        for kept in ["2026-11-13T04:12:00.123Z", "CUI 14399840", "J40/1234/2020", "0.1.0", "C:\\Users\\[utilizator]\\AppData", "[e-mail]", "[IBAN]", "[număr ascuns]", "[ascuns]"] {
            assert!(s.contains(kept), "{kept} not in {s}");
        }
    }
}
