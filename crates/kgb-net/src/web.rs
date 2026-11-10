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

// ---------- Requests the person asks for (D-086) ----------
//
// „Din web…” in the spreadsheet window and the time stamp of a signature: the address is the person's, the app
// sends nothing on its own. No cookies, no proxy (it would see the local addresses), no address of this PC or of
// the local network — checked after the DNS answer, in the resolver the connection uses, so nothing can slip
// between the check and the connection; every redirect is checked the same way, at most 5.

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;

/// What the request is for: it decides the method, the content and the size allowed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Purpose {
    /// GET of a page or a file („Din web…”), at most 10 MB.
    Page,
    /// POST of an RFC 3161 time-stamp request, answer at most 1 MB.
    Timestamp,
}

impl Purpose {
    fn max(self) -> usize {
        match self {
            Purpose::Page => 10 * 1024 * 1024,
            Purpose::Timestamp => 1024 * 1024,
        }
    }
}

/// What came back.
#[derive(Debug)]
pub struct Fetched {
    pub status: u16,
    pub content_type: String,
    /// The address of the answer, after the redirects.
    pub final_url: String,
    pub data: Vec<u8>,
}

/// An address of this PC, of the local network or not meant for the internet.
pub fn local(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v) => local4(v),
        IpAddr::V6(v) => {
            if let Some(m) = v.to_ipv4_mapped() {
                return local4(m);
            }
            let s = v.segments();
            v.is_loopback()
                || v.is_unspecified()
                || v.is_multicast()
                || (s[0] & 0xfe00) == 0xfc00 // unique local fc00::/7
                || (s[0] & 0xffc0) == 0xfe80 // link-local fe80::/10
                || (s[0] == 0x64 && s[1] == 0xff9b) // NAT64 64:ff9b::/96 (may hide a local v4)
                || (s[0] == 0x2001 && s[1] == 0x0db8) // documentation
        }
    }
}

fn local4(v: Ipv4Addr) -> bool {
    let o = v.octets();
    v.is_loopback()
        || v.is_private()
        || v.is_link_local()
        || v.is_unspecified()
        || v.is_broadcast()
        || v.is_multicast()
        || v.is_documentation()
        || o[0] == 0
        || (o[0] == 100 && (64..128).contains(&o[1])) // carrier-grade NAT 100.64/10 (also Tailscale)
        || (o[0] == 198 && (o[1] == 18 || o[1] == 19)) // benchmarking
        || o[0] >= 240
}

/// The resolver of these requests: the DNS answer without local addresses (only the loopback in tests).
struct OutsideOnly {
    loopback: bool,
}

impl reqwest::dns::Resolve for OutsideOnly {
    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
        let host = name.as_str().to_string();
        let loopback = self.loopback;
        Box::pin(async move {
            let found: Vec<SocketAddr> = tokio::net::lookup_host((host.as_str(), 0))
                .await
                .map_err(|e| -> Box<dyn std::error::Error + Send + Sync> { Box::new(e) })?
                .collect();
            let ok: Vec<SocketAddr> = found
                .into_iter()
                .filter(|a| !local(a.ip()) || (loopback && a.ip().is_loopback()))
                .collect();
            if ok.is_empty() {
                return Err(format!("„{host}” duce la o adresă din rețeaua locală sau de pe acest calculator").into());
            }
            Ok(Box::new(ok.into_iter()) as reqwest::dns::Addrs)
        })
    }
}

/// The address is one the person may ask for: http(s), a name or a public IP, no user / password in it.
pub fn check_url(url: &reqwest::Url, loopback: bool) -> Result<(), String> {
    if url.scheme() != "https" && url.scheme() != "http" {
        return Err("adresa trebuie să înceapă cu https:// sau http://".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("adresa nu poate conține un nume și o parolă".into());
    }
    match url.host() {
        None => Err("adresa nu are un nume de server".into()),
        Some(url::Host::Ipv4(ip)) if local4(ip) && !(loopback && ip.is_loopback()) => {
            Err("adresa duce în rețeaua locală sau la acest calculator".into())
        }
        Some(url::Host::Ipv6(ip)) if local(IpAddr::V6(ip)) && !(loopback && ip.is_loopback()) => {
            Err("adresa duce în rețeaua locală sau la acest calculator".into())
        }
        Some(url::Host::Domain(d)) if d.eq_ignore_ascii_case("localhost") || d.to_ascii_lowercase().ends_with(".localhost") => {
            if loopback { Ok(()) } else { Err("adresa duce la acest calculator".into()) }
        }
        _ => Ok(()),
    }
}

/// Host and path, without the query (it may hold keys): what the log keeps.
pub fn for_log(url: &str) -> String {
    match reqwest::Url::parse(url) {
        Ok(u) => format!("{}{}", u.host_str().unwrap_or("?"), u.path()),
        Err(_) => "(adresă greșită)".into(),
    }
}

/// The request the person asked for. `http` must be allowed by the caller (the person confirmed it, or the
/// answer is signed, as a time stamp is). `loopback` only in tests (KGB_TEST_NET_LOOPBACK, never from a page).
pub async fn user_fetch(url: &str, purpose: Purpose, body: Option<Vec<u8>>, http: bool, loopback: bool) -> Result<Fetched, String> {
    crypto();
    let u = reqwest::Url::parse(url.trim()).map_err(|_| "adresa nu este validă".to_string())?;
    check_url(&u, loopback)?;
    if u.scheme() == "http" && !http {
        return Err("adresa http:// nu e criptată: confirmă înainte".into());
    }
    let redirects = reqwest::redirect::Policy::custom(move |a| {
        if a.previous().len() >= 5 {
            return a.error("prea multe redirecționări");
        }
        match check_url(a.url(), loopback) {
            Ok(()) if a.url().scheme() == "http" && !http => a.error("redirecționare spre o adresă http:// necriptată"),
            Ok(()) => a.follow(),
            Err(e) => a.error(e),
        }
    });
    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(TOTAL_TIMEOUT)
        .user_agent(concat!("K.G.B./", env!("CARGO_PKG_VERSION")))
        .no_proxy()
        .dns_resolver(Arc::new(OutsideOnly { loopback }))
        .redirect(redirects)
        .build()
        .map_err(|e| format!("clientul web nu a pornit ({e})"))?;
    let req = match purpose {
        Purpose::Page => client
            .get(u)
            .header("Accept", "text/html,application/xhtml+xml,text/csv,text/plain;q=0.9,*/*;q=0.5"),
        Purpose::Timestamp => client
            .post(u)
            .header("Content-Type", "application/timestamp-query")
            .header("Accept", "application/timestamp-reply")
            .body(body.unwrap_or_default()),
    };
    let mut r = req.send().await.map_err(|e| why_user(&e))?;
    let status = r.status().as_u16();
    let content_type = r
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_string();
    let final_url = r.url().to_string();
    let max = purpose.max();
    if r.content_length().is_some_and(|n| n as usize > max) {
        return Err(format!("răspunsul are mai mult de {} MB", max / 1024 / 1024));
    }
    let mut data = Vec::new();
    while let Some(chunk) = r.chunk().await.map_err(|e| why_user(&e))? {
        data.extend_from_slice(&chunk);
        if data.len() > max {
            return Err(format!("răspunsul are mai mult de {} MB", max / 1024 / 1024));
        }
    }
    Ok(Fetched { status, content_type, final_url, data })
}

/// Like `why`, with the address rules said plainly (they come back as connection errors).
fn why_user(e: &reqwest::Error) -> String {
    use std::error::Error as _;
    let mut src = e.source();
    while let Some(s) = src {
        let t = s.to_string();
        if t.contains("rețeaua locală") || t.contains("acest calculator") || t.contains("redirecți") || t.contains("adresa") {
            return t;
        }
        src = s.source();
    }
    if e.is_redirect() {
        return "prea multe redirecționări sau o redirecționare nepermisă".into();
    }
    why(e)
}

#[cfg(test)]
mod user_tests {
    use super::*;

    #[test]
    fn local_addresses_are_refused() {
        for a in ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.10", "169.254.1.1", "100.100.1.1", "0.0.0.0", "255.255.255.255", "::1", "fd00::1", "fe80::1", "::ffff:192.168.1.1", "64:ff9b::a00:1"] {
            assert!(local(a.parse().unwrap()), "{a}");
        }
        for a in ["8.8.8.8", "1.1.1.1", "2a00:1450:4001:80b::200e", "172.32.0.1", "100.128.0.1"] {
            assert!(!local(a.parse().unwrap()), "{a}");
        }
    }

    #[test]
    fn addresses_are_checked_before_any_connection() {
        let u = |s: &str| reqwest::Url::parse(s).unwrap();
        assert!(check_url(&u("https://www.bnr.ro/nbrfxrates.xml"), false).is_ok());
        for bad in ["ftp://example.com/x", "file:///C:/Windows/win.ini", "https://user:pw@example.com/", "http://127.0.0.1:8080/", "https://192.168.0.1/", "https://[::1]/", "http://localhost/", "https://x.localhost/", "https://10.0.0.5/admin"] {
            assert!(check_url(&u(bad), false).is_err(), "{bad}");
        }
        assert!(check_url(&u("http://127.0.0.1:9/"), true).is_ok(), "loopback only in tests");
        assert!(check_url(&u("https://192.168.0.1/"), true).is_err(), "not the local network, even in tests");
        assert_eq!(for_log("https://api.example.com/v1/x?key=SECRET&a=1"), "api.example.com/v1/x");
    }
}
