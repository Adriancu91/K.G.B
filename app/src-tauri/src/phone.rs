//! The phone page (Etapa 7, step 7.4m; D-068): a small web page served by
//! K.G.B. on the firm's network while it is switched on from the PC.
//!
//! - Off by default; switched on and off from the „Telefon” page, for the
//!   whole organization (7.4m-4, D-069): every PC with K.G.B. open then
//!   serves the page, answers to `kgb.local` on the office network (see
//!   `mdns`) and publishes its addresses, so a phone moves to another PC
//!   when one is switched off. The switch is remembered: the page comes back
//!   when K.G.B. starts again.
//! - Pairing: the phone types the 8-digit code shown on the PC (valid 10
//!   minutes, 5 wrong tries end it), then waits for approval on the PC.
//! - An approved phone only adds to the inbox (reception sheets, driver
//!   documents, bank statements…); it reads back only the product names
//!   (for the sheets) and its own person's deliveries on the road (7.4m-6c).
//! - Plain HTTP inside the local network (the firm's Wi-Fi): anyone on that
//!   network can see the traffic. Fine for an office Wi-Fi with a password;
//!   not for public Wi-Fi. From outside the office, through a private network
//!   such as Tailscale (encrypted), or later through the relay.
//! - The page may call another PC of the firm (CORS open to any page): the
//!   API needs the phone's key in a header, never a cookie, so another web
//!   page cannot use a phone's access.
//! - Windows may ask once whether K.G.B. may accept connections (firewall);
//!   the app does not change that setting by itself.

use std::convert::Infallible;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use base64::Engine as _;
use bytes::Bytes;
use http_body_util::{BodyExt, Full, Limited};
use hyper::body::Incoming;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use kgb_core::phones;
use serde_json::{Value, json};

use crate::Session;

pub const PORT: u16 = 8737;
const CODE_VALID: Duration = Duration::from_secs(600);
const MAX_BODY: usize = 50 * 1024 * 1024;
const PAGE: &str = include_str!("phone.html");

struct Running {
    stop: tokio::sync::watch::Sender<bool>,
    address: String,
}

struct Code {
    code: String,
    made: Instant,
    wrong: u32,
}

static RUNNING: Mutex<Option<Running>> = Mutex::new(None);
static CODE: Mutex<Option<Code>> = Mutex::new(None);

/// This PC's address on the local network (no packet is sent).
pub fn lan_ip() -> IpAddr {
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| {
            s.connect("192.0.2.1:9")?;
            s.local_addr()
        })
        .map(|a| a.ip())
        .unwrap_or(IpAddr::V4(Ipv4Addr::LOCALHOST))
}

/// The addresses where phones reach this PC: the office network and, if
/// present, a private network such as Tailscale (no packet is sent).
pub fn addresses() -> Vec<String> {
    let mut ips = vec![lan_ip()];
    // Tailscale's own address: the route to its DNS server goes through it.
    if let Ok(ip) = UdpSocket::bind("0.0.0.0:0").and_then(|s| {
        s.connect("100.100.100.100:53")?;
        s.local_addr()
    }) {
        ips.push(ip.ip());
    }
    let mut out: Vec<String> = Vec::new();
    for ip in ips {
        let u = format!("http://{ip}:{PORT}/m");
        if !ip.is_loopback() && !ip.is_unspecified() && !out.contains(&u) {
            out.push(u);
        }
    }
    out
}

/// The common address on the office network.
pub fn common_address() -> String {
    format!("http://{}:{PORT}/m", phones::COMMON_NAME)
}

/// Keeps this PC in step with the organization's switch: serves the page
/// and answers to `kgb.local` while it is on, and publishes where it
/// answers. Checked every few seconds (a change made on another PC arrives
/// with the next synchronisation).
pub fn supervise(session: Arc<Mutex<Option<Session>>>) {
    std::thread::Builder::new()
        .name("kgb-phone".into())
        .spawn(move || {
            let mut last_error = String::new();
            loop {
                let on = session.lock().ok().and_then(|g| g.as_ref().map(|s| phones::service_on(&s.ws).unwrap_or(false)));
                let on = on.unwrap_or(false);
                let mut problem = String::new();
                if on {
                    if address().is_none()
                        && let Err(e) = start(session.clone())
                    {
                        problem = e;
                    }
                    if let Err(e) = crate::mdns::start(phones::COMMON_NAME) {
                        problem = e;
                    }
                } else {
                    stop();
                    crate::mdns::stop();
                }
                if problem != last_error {
                    if !problem.is_empty() {
                        tracing::warn!("phone page: {problem}");
                    }
                    last_error = problem;
                }
                let serving = address().is_some();
                let here = if serving { addresses() } else { Vec::new() };
                if let Ok(mut g) = session.lock()
                    && let Some(s) = g.as_mut()
                {
                    let fp = s.device.fingerprint();
                    let name = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "PC".into());
                    let known = phones::hosts(&s.ws, None).map(|h| h.iter().any(|h| h.dispozitiv == fp)).unwrap_or(false);
                    // A PC that never served writes nothing.
                    if serving || known {
                        let _ = phones::publish_host(&mut s.ws, &fp, &name, &here, serving);
                    }
                }
                if let Ok(mut e) = PROBLEM.lock() {
                    e.clone_from(&last_error);
                }
                std::thread::sleep(Duration::from_secs(5));
            }
        })
        .expect("phone thread");
}

static PROBLEM: Mutex<String> = Mutex::new(String::new());

/// Why the page could not start here, if it could not.
pub fn problem() -> Option<String> {
    PROBLEM.lock().ok().map(|p| p.clone()).filter(|p| !p.is_empty())
}

/// A new 8-digit pairing code (the old one stops working).
pub fn new_code() -> String {
    let mut raw = [0u8; 8];
    let _ = getrandom::fill(&mut raw);
    let n = u64::from_le_bytes(raw) % 100_000_000;
    let code = format!("{:04}-{:04}", n / 10_000, n % 10_000);
    if let Ok(mut c) = CODE.lock() {
        *c = Some(Code { code: code.clone(), made: Instant::now(), wrong: 0 });
    }
    code
}

/// The current code and the seconds it is still valid, if any.
pub fn current_code() -> Option<(String, u64)> {
    let c = CODE.lock().ok()?;
    let c = c.as_ref()?;
    let left = CODE_VALID.checked_sub(c.made.elapsed())?;
    (c.wrong < 5).then(|| (c.code.clone(), left.as_secs()))
}

fn check_code(given: &str) -> bool {
    let Ok(mut g) = CODE.lock() else { return false };
    let Some(c) = g.as_mut() else { return false };
    if c.made.elapsed() > CODE_VALID || c.wrong >= 5 {
        return false;
    }
    let clean: String = given.chars().filter(char::is_ascii_digit).collect();
    if clean == c.code.replace('-', "") {
        // Used once.
        *g = None;
        true
    } else {
        c.wrong += 1;
        false
    }
}

pub fn address() -> Option<String> {
    RUNNING.lock().ok()?.as_ref().map(|r| r.address.clone())
}

pub fn stop() {
    if let Ok(mut r) = RUNNING.lock()
        && let Some(run) = r.take()
    {
        let _ = run.stop.send(true);
    }
}

/// Starts the server; returns the address phones open.
pub fn start(session: Arc<Mutex<Option<Session>>>) -> Result<String, String> {
    if let Some(a) = address() {
        return Ok(a);
    }
    let listener = std::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], PORT)))
        .map_err(|e| format!("portul {PORT} nu poate fi deschis ({e}); poate e folosit de alt program"))?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let address = format!("http://{}:{PORT}/m", lan_ip());
    // Stopping closes the listener and every open connection (no keep-alive left behind).
    let (tx, mut rx) = tokio::sync::watch::channel(false);
    tauri::async_runtime::spawn(async move {
        let Ok(listener) = tokio::net::TcpListener::from_std(listener) else { return };
        loop {
            tokio::select! {
                _ = rx.changed() => break,
                acc = listener.accept() => {
                    let Ok((stream, _)) = acc else { continue };
                    let session = session.clone();
                    let mut stop = rx.clone();
                    tokio::spawn(async move {
                        let svc = service_fn(move |req| handle(req, session.clone()));
                        // hyper needs a timer for the header timeout, or it drops the connection.
                        let conn = http1::Builder::new()
                            .timer(hyper_util::rt::TokioTimer::new())
                            .max_buf_size(64 * 1024)
                            .header_read_timeout(Duration::from_secs(10))
                            .serve_connection(TokioIo::new(stream), svc);
                        tokio::select! {
                            _ = conn => {}
                            _ = stop.changed() => {}
                        }
                    });
                }
            }
        }
    });
    if let Ok(mut r) = RUNNING.lock() {
        *r = Some(Running { stop: tx, address: address.clone() });
    }
    Ok(address)
}

fn reply(status: StatusCode, ctype: &str, body: impl Into<Bytes>) -> Response<Full<Bytes>> {
    Response::builder()
        .status(status)
        .header("Content-Type", ctype)
        .header("Cache-Control", "no-store")
        .header("X-Content-Type-Options", "nosniff")
        .header("Referrer-Policy", "no-referrer")
        .header("Access-Control-Allow-Origin", "*")
        .header("Content-Security-Policy", "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http:; form-action 'none'; frame-ancestors 'none'")
        .body(Full::new(body.into()))
        .expect("valid response")
}

fn json_reply(status: StatusCode, v: Value) -> Response<Full<Bytes>> {
    reply(status, "application/json; charset=utf-8", v.to_string())
}

fn err(status: StatusCode, msg: &str) -> Response<Full<Bytes>> {
    json_reply(status, json!({"eroare": msg}))
}

async fn handle(req: Request<Incoming>, session: Arc<Mutex<Option<Session>>>) -> Result<Response<Full<Bytes>>, Infallible> {
    let path = req.uri().path().to_string();
    let method = req.method().clone();
    let token = req.headers().get("x-kgb-token").and_then(|v| v.to_str().ok()).unwrap_or_default().to_string();
    if method == Method::GET && (path == "/m" || path == "/m/" || path == "/") {
        return Ok(reply(StatusCode::OK, "text/html; charset=utf-8", PAGE));
    }
    // The page on one PC may call another PC of the firm (7.4m-4).
    if method == Method::OPTIONS && path.starts_with("/m/api/") {
        let mut r = reply(StatusCode::NO_CONTENT, "text/plain", Bytes::new());
        let h = r.headers_mut();
        h.insert("Access-Control-Allow-Methods", hyper::header::HeaderValue::from_static("GET, POST"));
        h.insert("Access-Control-Allow-Headers", hyper::header::HeaderValue::from_static("content-type, x-kgb-token"));
        h.insert("Access-Control-Max-Age", hyper::header::HeaderValue::from_static("600"));
        return Ok(r);
    }
    if method == Method::GET && path == "/m/api/ping" {
        return Ok(json_reply(StatusCode::OK, json!({"kgb": true})));
    }
    if method != Method::POST && !(method == Method::GET && (path == "/m/api/eu" || path == "/m/api/produse" || path == "/m/api/livrari")) {
        return Ok(err(StatusCode::NOT_FOUND, "nu există"));
    }
    let body: Value = if method == Method::POST {
        match Limited::new(req.into_body(), MAX_BODY).collect().await {
            Ok(b) => serde_json::from_slice(&b.to_bytes()).unwrap_or(Value::Null),
            Err(_) => return Ok(err(StatusCode::PAYLOAD_TOO_LARGE, "trimiterea e prea mare")),
        }
    } else {
        Value::Null
    };
    // Every answer from the workspace goes through the session lock, briefly.
    let with = |f: &mut dyn FnMut(&mut Session) -> Response<Full<Bytes>>| -> Response<Full<Bytes>> {
        match session.lock() {
            Ok(mut g) => match g.as_mut() {
                Some(s) => f(s),
                None => err(StatusCode::SERVICE_UNAVAILABLE, "K.G.B. nu are spațiul de lucru deschis"),
            },
            Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "eroare internă"),
        }
    };
    let out = match path.as_str() {
        "/m/api/asociere" => {
            let code = body["cod"].as_str().unwrap_or_default();
            let name = body["nume"].as_str().unwrap_or_default().to_string();
            if !check_code(code) {
                err(StatusCode::FORBIDDEN, "codul nu e bun sau a expirat; cere unul nou pe PC (pagina Telefon)")
            } else {
                with(&mut |s| match phones::pair(&mut s.ws, &name) {
                    Ok((_, token)) => json_reply(StatusCode::OK, json!({"token": token})),
                    Err(e) => err(StatusCode::BAD_REQUEST, &e.to_string()),
                })
            }
        }
        "/m/api/eu" => with(&mut |s| match phones::by_token(&s.ws, &token) {
            Ok(Some(p)) => {
                let _ = phones::seen(&mut s.ws, p.id);
                // Where else the page answers: the other PCs that serve it.
                let fp = s.device.fingerprint();
                let mut adrese: Vec<String> = Vec::new();
                for h in phones::hosts(&s.ws, Some(&fp)).unwrap_or_default().into_iter().filter(|h| h.pornit) {
                    for a in h.adrese {
                        if !adrese.contains(&a) {
                            adrese.push(a);
                        }
                    }
                }
                json_reply(
                    StatusCode::OK,
                    json!({"stare": p.stare, "nume": p.nume, "membru": p.membru_nume, "firma": s.ws.manifest().name, "adrese": adrese, "comun": common_address()}),
                )
            }
            _ => err(StatusCode::UNAUTHORIZED, "telefonul nu e asociat"),
        }),
        // The products of Business, for the reception sheet (7.4m-5); names and units only.
        "/m/api/produse" => with(&mut |s| match phones::by_token(&s.ws, &token) {
            Ok(Some(p)) if p.stare == "aprobat" => {
                let list = s.mm.call(&mut s.ws, None, "kgb.business", "products", json!({})).unwrap_or(json!([]));
                let items: Vec<Value> = list
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter(|x| x["activ"] != json!(false))
                    .map(|x| json!({"id": x["id"], "nume": x["nume"], "um": x["um"], "cod": x["cod"]}))
                    .collect();
                json_reply(StatusCode::OK, json!({"produse": items}))
            }
            _ => err(StatusCode::UNAUTHORIZED, "telefonul nu e aprobat"),
        }),
        // The driver's own deliveries still on the road (7.4m-6c): the ones
        // whose driver is the phone's person; what they need, nothing else.
        "/m/api/livrari" => with(&mut |s| match phones::by_token(&s.ws, &token) {
            Ok(Some(p)) if p.stare == "aprobat" => {
                let me = p.membru_nume.trim().to_lowercase();
                let list = s.mm.call(&mut s.ws, None, "kgb.business", "deliveries", json!({})).unwrap_or(json!([]));
                let items: Vec<Value> = list
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter(|d| {
                        ["incarcat", "in_drum"].contains(&d["etapa"].as_str().unwrap_or_default())
                            && !me.is_empty()
                            && d["campuri"]["sofer"].as_str().is_some_and(|x| x.trim().to_lowercase() == me)
                    })
                    .map(|d| {
                        let linii: Vec<Value> = d["linii"]
                            .as_array()
                            .into_iter()
                            .flatten()
                            .map(|l| json!({"descriere": l["descriere"], "cantitate": l["cantitate_text"], "um": l["um"]}))
                            .collect();
                        json!({"id": d["id"], "numar": d["numar_text"], "destinatar": d["destinatar"], "adresa": d["adresa"], "data": d["data"], "etapa": d["etapa"], "vehicul": d["campuri"]["vehicul"], "linii": linii})
                    })
                    .collect();
                json_reply(StatusCode::OK, json!({"livrari": items}))
            }
            _ => err(StatusCode::UNAUTHORIZED, "telefonul nu e aprobat"),
        }),
        "/m/api/trimite" => {
            let kind = body["tip"].as_str().unwrap_or_default().to_string();
            let mut lines = Some(body["linii"].as_array().cloned().unwrap_or_default());
            let fields = body["campuri"].as_object().cloned().unwrap_or_default();
            let mut uploads = Vec::new();
            let mut bad_file = None;
            for f in body["fisiere"].as_array().into_iter().flatten().take(phones::MAX_FILES + phones::MAX_LINES + 1) {
                match base64::engine::general_purpose::STANDARD.decode(f["date"].as_str().unwrap_or_default()) {
                    Ok(data) => uploads.push(phones::Upload {
                        name: f["nume"].as_str().unwrap_or("fisier").chars().take(100).collect(),
                        mime: f["mime"].as_str().unwrap_or("application/octet-stream").to_string(),
                        data,
                    }),
                    Err(_) => bad_file = Some("un fișier nu a ajuns întreg"),
                }
            }
            if let Some(m) = bad_file {
                err(StatusCode::BAD_REQUEST, m)
            } else {
                let mut uploads = Some(uploads);
                let fields = Some(fields);
                let mut fields = fields;
                with(&mut |s| match phones::by_token(&s.ws, &token) {
                    Ok(Some(p)) => match phones::submit_with_lines(&mut s.ws, &p, &kind, fields.take().unwrap_or_default(), lines.take().unwrap_or_default(), uploads.take().unwrap_or_default()) {
                        Ok(id) => json_reply(StatusCode::OK, json!({"id": id})),
                        Err(e) => err(StatusCode::BAD_REQUEST, &e.to_string()),
                    },
                    _ => err(StatusCode::UNAUTHORIZED, "telefonul nu e asociat"),
                })
            }
        }
        _ => err(StatusCode::NOT_FOUND, "nu există"),
    };
    Ok(out)
}
