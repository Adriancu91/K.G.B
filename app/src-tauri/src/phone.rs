//! The phone page (Etapa 7, step 7.4m; D-068): a small web page served by
//! K.G.B. on the firm's network while it is switched on from the PC.
//!
//! - Off by default; started and stopped from the „Telefon” page.
//! - Pairing: the phone types the 8-digit code shown on the PC (valid 10
//!   minutes, 5 wrong tries end it), then waits for approval on the PC.
//! - An approved phone only adds to the inbox (reception sheets, driver
//!   documents, bank statements); it reads nothing back.
//! - Plain HTTP inside the local network (the firm's Wi-Fi): anyone on that
//!   network can see the traffic. Fine for an office Wi-Fi with a password;
//!   not for public Wi-Fi. Access from outside comes later, through the relay.
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
        .header("Content-Security-Policy", "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; form-action 'none'; frame-ancestors 'none'")
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
    if method != Method::POST && !(method == Method::GET && (path == "/m/api/eu" || path == "/m/api/produse")) {
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
                json_reply(StatusCode::OK, json!({"stare": p.stare, "nume": p.nume, "membru": p.membru_nume, "firma": s.ws.manifest().name}))
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
