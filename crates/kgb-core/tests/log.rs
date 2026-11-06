//! Step 1.3: rotation, redaction, panic logging, diagnostic report.

use kgb_core::log::{LogConfig, RotatingWriter, diagnostic_report, format_utc, layer, recent_problems};
use serde_json::Value;
use tracing::Level;
use tracing_subscriber::layer::SubscriberExt;

fn lines(path: &std::path::Path) -> Vec<Value> {
    std::fs::read_to_string(path)
        .unwrap_or_default()
        .lines()
        .map(|l| serde_json::from_str(l).expect("every log line is JSON"))
        .collect()
}

#[test]
fn rotation_keeps_at_most_max_files_and_bounded_size() {
    let dir = tempfile::tempdir().unwrap();
    let cfg = LogConfig {
        max_file_bytes: 1_000,
        max_files: 3,
        min_level: Level::INFO,
    };
    let mut w = RotatingWriter::open(dir.path(), cfg).unwrap();
    for i in 0..500 {
        w.write_line(&format!("{{\"n\":{i},\"pad\":\"{}\"}}", "x".repeat(40)))
            .unwrap();
    }
    w.flush().unwrap();
    let mut names: Vec<String> = std::fs::read_dir(dir.path())
        .unwrap()
        .map(|e| e.unwrap().file_name().into_string().unwrap())
        .collect();
    names.sort();
    assert_eq!(names, ["kgb.1.log", "kgb.2.log", "kgb.log"]);
    for n in &names {
        let len = std::fs::metadata(dir.path().join(n)).unwrap().len();
        assert!(len <= 1_000, "{n} has {len} bytes");
    }
    // Newest line is in kgb.log, and rotated files hold older, contiguous lines.
    let last = lines(&dir.path().join("kgb.log"));
    assert_eq!(last.last().unwrap()["n"], 499);
    let prev = lines(&dir.path().join("kgb.1.log"));
    assert_eq!(
        prev.last().unwrap()["n"].as_u64().unwrap() + 1,
        last[0]["n"].as_u64().unwrap()
    );
}

#[test]
fn reopening_appends_instead_of_truncating() {
    let dir = tempfile::tempdir().unwrap();
    let cfg = LogConfig::default();
    RotatingWriter::open(dir.path(), cfg)
        .unwrap()
        .write_line("{\"a\":1}")
        .unwrap();
    RotatingWriter::open(dir.path(), cfg)
        .unwrap()
        .write_line("{\"a\":2}")
        .unwrap();
    assert_eq!(lines(&dir.path().join("kgb.log")).len(), 2);
}

#[test]
fn sensitive_fields_are_redacted_and_levels_filtered() {
    let dir = tempfile::tempdir().unwrap();
    let (layer, handle) = layer(dir.path(), LogConfig::default()).unwrap();
    let sub = tracing_subscriber::registry().with(layer);
    tracing::subscriber::with_default(sub, || {
        tracing::info!(
            password = "hunter2",
            api_token = "abc",
            note_text = "secret note",
            records = 42u64,
            "opened"
        );
        tracing::debug!("not written at INFO level");
        tracing::warn!(module = "notes", "permission denied");
    });
    handle.flush();
    let raw = std::fs::read_to_string(dir.path().join("kgb.log")).unwrap();
    assert!(!raw.contains("hunter2") && !raw.contains("abc") && !raw.contains("secret note"));
    let l = lines(&dir.path().join("kgb.log"));
    assert_eq!(l.len(), 2);
    assert_eq!(l[0]["msg"], "opened");
    assert_eq!(l[0]["fields"]["password"], "[redactat]");
    assert_eq!(l[0]["fields"]["note_text"], "[redactat]");
    assert_eq!(l[0]["fields"]["records"], 42);
    assert_eq!(l[1]["level"], "WARN");
    let problems = recent_problems(dir.path(), 10);
    assert_eq!(problems.len(), 1);
    assert_eq!(problems[0]["msg"], "permission denied");
}

#[test]
fn diagnostic_report_contains_versions_and_problems_only() {
    let dir = tempfile::tempdir().unwrap();
    let (layer, handle) = layer(dir.path(), LogConfig::default()).unwrap();
    tracing::subscriber::with_default(tracing_subscriber::registry().with(layer), || {
        tracing::error!(content = "client invoice 123", "import failed");
    });
    handle.flush();
    let r = diagnostic_report("9.9.9", &[("Workspace", "D:/ws".into())], dir.path());
    assert!(r.contains("Versiune aplicație: 9.9.9"));
    assert!(r.contains("Workspace: D:/ws"));
    assert!(r.contains("import failed"));
    assert!(!r.contains("client invoice"));
}

#[test]
fn utc_formatting() {
    assert_eq!(format_utc(0), "1970-01-01T00:00:00.000Z");
    assert_eq!(format_utc(951_782_400_123), "2000-02-29T00:00:00.123Z");
    assert_eq!(format_utc(1_793_923_200_000), "2026-11-06T00:00:00.000Z");
}
