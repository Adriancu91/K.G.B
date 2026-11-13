//! Rules shared by the windows that show something from the internet: the web clips (D-099) and the radio
//! (D-098), agreed with the COS session on 13 nov. 2026.
//! - Only `https://` addresses of the public internet: never `localhost`, `.local`, a loopback, private,
//!   link-local or shared address, so a page can never reach this PC or the local network through them.
//! - No downloads, no pop-ups (wired in each window's builder).
//! - Every permission asked by the page (camera, microphone, location, notifications, clipboard…) is refused.
//!
//! Tests only: `KGB_TEST_WEB_LOCAL=1` in the environment (never from a page) lets the e2e use `http://127.0.0.1:…`.

use std::net::IpAddr;

use tauri::Url;

fn test_local() -> bool {
    std::env::var("KGB_TEST_WEB_LOCAL").as_deref() == Ok("1")
}

fn private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v) => {
            let o = v.octets();
            v.is_loopback()
                || v.is_private()
                || v.is_link_local()
                || v.is_unspecified()
                || v.is_broadcast()
                || v.is_documentation()
                || o[0] == 0
                || (o[0] == 100 && (64..128).contains(&o[1]))
                || (o[0] == 192 && o[1] == 0 && o[2] == 0)
                || o[0] >= 240
        }
        IpAddr::V6(v) => {
            let s = v.segments();
            v.is_loopback()
                || v.is_unspecified()
                || (s[0] & 0xfe00) == 0xfc00
                || (s[0] & 0xffc0) == 0xfe80
                || v.to_ipv4_mapped().is_some_and(|m| private_ip(IpAddr::V4(m)))
        }
    }
}

/// Why an address may not be opened, if it may not.
pub fn refuse(u: &Url) -> Option<&'static str> {
    if test_local() && u.scheme() == "http" && u.host_str() == Some("127.0.0.1") {
        return None;
    }
    if u.scheme() != "https" {
        return Some("doar adrese https:// se pot deschide");
    }
    let host = match u.host() {
        Some(h) => h,
        None => return Some("adresa nu are un site"),
    };
    let bad = match host {
        url::Host::Ipv4(v) => private_ip(IpAddr::V4(v)),
        url::Host::Ipv6(v) => private_ip(IpAddr::V6(v)),
        url::Host::Domain(d) => {
            let d = d.trim_end_matches('.').to_ascii_lowercase();
            d == "localhost" || d.ends_with(".localhost") || d.ends_with(".local") || d.ends_with(".internal") || !d.contains('.')
        }
    };
    bad.then_some("adresele acestui PC sau ale rețelei locale nu se deschid aici")
}

pub fn check(url: &str) -> Result<Url, String> {
    let u = url.trim();
    if u.len() > 2000 || u.chars().any(char::is_whitespace) {
        return Err("adresa nu e o pagină web validă".into());
    }
    let parsed = Url::parse(u).map_err(|_| "adresa nu e o pagină web validă".to_string())?;
    match refuse(&parsed) {
        Some(why) => Err(why.into()),
        None => Ok(parsed),
    }
}

/// Refuses, in this window, every permission a page asks for.
pub fn deny_permissions(w: &tauri::WebviewWindow) {
    let _ = w.with_webview(|wv| {
        use webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_PERMISSION_STATE_DENY;
        use webview2_com::PermissionRequestedEventHandler;
        unsafe {
            let Ok(core) = wv.controller().CoreWebView2() else { return };
            let handler = PermissionRequestedEventHandler::create(Box::new(|_sender, args| {
                if let Some(a) = args {
                    a.SetState(COREWEBVIEW2_PERMISSION_STATE_DENY)?;
                }
                Ok(())
            }));
            let mut token = 0i64;
            if let Err(e) = core.add_PermissionRequested(&handler, &mut token) {
                tracing::warn!("web window: permissions not hooked: {e}");
            }
        }
    });
}

/// Opens an address in the computer's browser (a link clicked in a web window), only a public https page.
pub fn open_outside(u: &Url) {
    if refuse(u).is_none() && u.scheme() == "https" {
        let _ = std::process::Command::new("explorer.exe").arg(u.as_str()).spawn();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_public_https() {
        assert!(check("https://www.bnr.ro/curs").is_ok());
        assert!(check("https://[2a00:1450:4001:80b::200e]/").is_ok());
        for bad in [
            "http://www.bnr.ro/",
            "https://localhost/",
            "https://LOCALHOST./x",
            "https://printer.local/",
            "https://intranet/",
            "https://127.0.0.1/",
            "https://10.0.0.5/",
            "https://172.20.1.1/",
            "https://192.168.1.1/",
            "https://169.254.1.1/",
            "https://100.100.1.1/",
            "https://0.0.0.0/",
            "https://[::1]/",
            "https://[fd00::1]/",
            "https://[fe80::1]/",
            "https://[::ffff:192.168.1.1]/",
            "file:///C:/Windows/win.ini",
            "javascript:alert(1)",
        ] {
            assert!(check(bad).is_err(), "{bad}");
        }
        assert!(check("https://172.32.0.1/").is_ok());
    }
}
