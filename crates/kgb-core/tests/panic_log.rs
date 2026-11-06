//! Step 1.3: a panic is written to the log before the process continues
//! unwinding. Separate test binary because `init` installs global state.

use kgb_core::log::{LogConfig, init, recent_problems};

#[test]
fn panic_is_logged() {
    let dir = tempfile::tempdir().unwrap();
    init(dir.path(), LogConfig::default()).unwrap();
    assert!(
        init(dir.path(), LogConfig::default()).is_err(),
        "second init is refused"
    );
    let r = std::thread::spawn(|| panic!("boom in worker")).join();
    assert!(r.is_err());
    let p = recent_problems(dir.path(), 10);
    assert_eq!(p.len(), 1, "{p:?}");
    assert_eq!(p[0]["level"], "ERROR");
    assert!(p[0]["msg"].as_str().unwrap().contains("boom in worker"));
    assert!(p[0]["fields"]["location"].as_str().unwrap().contains("panic_log.rs"));
}
