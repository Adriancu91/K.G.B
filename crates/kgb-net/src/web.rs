//! HTTPS requests to external sources (Etapa 7). Only the app calls this, and
//! only for a source switched on in the register (D-062); this file does not
//! decide what may be called.
//!
//! - TLS with rustls (the same library iroh uses) and the certificates trusted
//!   by Windows; no certificate check is ever switched off.
//! - Short timeouts: the screen must not hang when the internet is down.

use std::sync::Once;
use std::time::Duration;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const TOTAL_TIMEOUT: Duration = Duration::from_secs(20);
/// Answers larger than this are refused (the ANAF answer for one CUI is a few KB).
const MAX_ANSWER: usize = 2 * 1024 * 1024;

fn crypto() {
    static ONCE: Once = Once::new();
    ONCE.call_once(|| {
        // Errors only when a provider was already installed, which is fine.
        let _ = rustls::crypto::ring::default_provider().install_default();
    });
}

/// Why a request failed, in words for the screen.
fn why(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        "serviciul nu a răspuns la timp".into()
    } else if e.is_connect() {
        "nu există conexiune la internet sau serviciul nu poate fi contactat".into()
    } else {
        format!("cererea nu a reușit ({e})")
    }
}

/// POSTs a JSON body; returns the HTTP status and the answer as text.
pub async fn post_json(url: &str, body: String) -> Result<(u16, String), String> {
    crypto();
    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(TOTAL_TIMEOUT)
        .user_agent(concat!("K.G.B./", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("clientul web nu a pornit ({e})"))?;
    let r = client
        .post(url)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| why(&e))?;
    let status = r.status().as_u16();
    let bytes = r.bytes().await.map_err(|e| why(&e))?;
    if bytes.len() > MAX_ANSWER {
        return Err("răspunsul e prea mare".into());
    }
    Ok((status, String::from_utf8_lossy(&bytes).into_owned()))
}
