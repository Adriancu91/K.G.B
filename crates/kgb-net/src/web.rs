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

/// What a GET brought back.
#[derive(Clone, Debug)]
pub struct Answer {
    pub status: u16,
    pub body: String,
    /// `Expires` and `Last-Modified`, as sent (for sources that ask to be
    /// asked again only after a time, like MET Norway).
    pub expires: Option<String>,
    pub last_modified: Option<String>,
}

/// GETs `url`, naming the app as `user_agent`; with `if_modified_since`, an
/// unchanged answer comes back as status 304 with an empty body.
pub async fn get(url: &str, user_agent: &str, if_modified_since: Option<&str>) -> Result<Answer, String> {
    crypto();
    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(TOTAL_TIMEOUT)
        .user_agent(user_agent)
        .build()
        .map_err(|e| format!("clientul web nu a pornit ({e})"))?;
    let mut req = client.get(url);
    if let Some(t) = if_modified_since {
        req = req.header("If-Modified-Since", t);
    }
    let r = req.send().await.map_err(|e| why(&e))?;
    let status = r.status().as_u16();
    let header = |k: &str| r.headers().get(k).and_then(|v| v.to_str().ok()).map(String::from);
    let expires = header("expires");
    let last_modified = header("last-modified");
    let bytes = r.bytes().await.map_err(|e| why(&e))?;
    if bytes.len() > MAX_ANSWER {
        return Err("răspunsul e prea mare".into());
    }
    Ok(Answer { status, body: String::from_utf8_lossy(&bytes).into_owned(), expires, last_modified })
}
