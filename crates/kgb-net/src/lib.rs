//! Network transport for synchronisation (Etapa 6, step 6.5; D-015, D-017,
//! D-057).
//!
//! - **iroh** (QUIC + TLS 1.3, end to end): the endpoint's key **is the
//!   device key**, so every connection proves which device is on the other
//!   side; the server also checks that the signed request comes from that
//!   same device.
//! - The transport only carries messages: one request, one answer, per
//!   connection (ALPN `kgb/sync/1`). What the messages mean — and every
//!   permission check — is the job of the [`Handler`] (`kgb_core::replication`).
//! - **Relay:** off by default (direct connections only, e.g. in the same
//!   local network). The public n0 relay can be switched on **for tests only**
//!   (D-017); production needs the company's own relay (a 🔒 owner decision).
//! - Nothing here blocks the app: every call has a time limit, and when the
//!   network is down the app keeps working locally.

use std::sync::Arc;
use std::time::Duration;

use iroh::endpoint::{Connection, QuicTransportConfig, RecvStream, SendStream, presets};
use iroh::protocol::{AcceptError, ProtocolHandler, Router};
use iroh::{Endpoint, EndpointAddr, RelayMap, RelayMode, RelayUrl, SecretKey};
use serde::Serialize;
use serde_json::Value;

pub mod sync;

pub const ALPN: &[u8] = b"kgb/sync/1";
/// Largest message accepted (a first synchronisation can be big).
pub const MAX_MESSAGE: u32 = 256 * 1024 * 1024;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const EXCHANGE_TIMEOUT: Duration = Duration::from_secs(120);
/// A connection whose other side went silent (PC off, cable out, process
/// killed) is given up after this long (step 6.6), instead of the default.
const IDLE_TIMEOUT: Duration = Duration::from_secs(10);

/// Which relay the endpoint may use.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Relay {
    /// Direct connections only (no outside server).
    Off,
    /// The public n0 relays — **for tests only** (D-017).
    N0Test,
    /// The company's own relay.
    Custom(String),
}

impl Relay {
    pub fn parse(s: &str) -> Relay {
        match s.trim() {
            "" | "off" | "niciunul" => Relay::Off,
            "n0" => Relay::N0Test,
            url => Relay::Custom(url.to_string()),
        }
    }
    pub fn as_str(&self) -> String {
        match self {
            Relay::Off => "off".into(),
            Relay::N0Test => "n0".into(),
            Relay::Custom(u) => u.clone(),
        }
    }
}

/// Answers one request from a peer. `peer` is the hex public key the
/// connection was authenticated with.
pub trait Handler: Send + Sync + 'static {
    fn answer(&self, peer: &str, request: Value) -> Result<Value, String>;
}

/// How the last exchange travelled.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Path {
    Direct,
    Relay,
    Unknown,
}

pub fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// A running endpoint: it answers peers and can ask them.
pub struct Net {
    rt: tokio::runtime::Runtime,
    router: Router,
    relay: Relay,
}

#[derive(Clone)]
struct Server {
    handler: Arc<dyn Handler>,
}

impl std::fmt::Debug for Server {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Server")
    }
}

async fn write_frame(s: &mut SendStream, v: &Value) -> Result<(), String> {
    let b = serde_json::to_vec(v).map_err(|e| e.to_string())?;
    if b.len() as u64 > MAX_MESSAGE as u64 {
        return Err("mesaj prea mare".into());
    }
    s.write_all(&(b.len() as u32).to_le_bytes())
        .await
        .map_err(|e| e.to_string())?;
    s.write_all(&b).await.map_err(|e| e.to_string())?;
    Ok(())
}

async fn read_frame(r: &mut RecvStream) -> Result<Value, String> {
    let mut len = [0u8; 4];
    r.read_exact(&mut len).await.map_err(|e| e.to_string())?;
    let len = u32::from_le_bytes(len);
    if len > MAX_MESSAGE {
        return Err(format!("mesaj prea mare: {len} octeți"));
    }
    let mut b = vec![0u8; len as usize];
    r.read_exact(&mut b).await.map_err(|e| e.to_string())?;
    serde_json::from_slice(&b).map_err(|e| e.to_string())
}

impl Server {
    async fn serve(&self, conn: &Connection) -> Result<(), String> {
        let peer = hex(conn.remote_id().as_bytes());
        let (mut send, mut recv) = conn.accept_bi().await.map_err(|e| e.to_string())?;
        let req = read_frame(&mut recv).await?;
        // The signed request must come from the device that opened the
        // connection (the TLS key), not just carry its name.
        let reply = if req.get("key").and_then(Value::as_str) != Some(peer.as_str()) {
            Err("cererea e semnată de alt dispozitiv decât cel conectat".to_string())
        } else {
            let h = self.handler.clone();
            let p = peer.clone();
            tokio::task::spawn_blocking(move || h.answer(&p, req))
                .await
                .map_err(|e| e.to_string())?
        };
        let msg = match reply {
            Ok(v) => serde_json::json!({"ok": v}),
            Err(e) => {
                tracing::warn!(peer = %&peer[..8.min(peer.len())], "sync request refused: {e}");
                serde_json::json!({"eroare": e})
            }
        };
        write_frame(&mut send, &msg).await?;
        send.finish().map_err(|e| e.to_string())?;
        Ok(())
    }
}

impl ProtocolHandler for Server {
    async fn accept(&self, conn: Connection) -> Result<(), AcceptError> {
        let r = self.serve(&conn).await;
        conn.closed().await;
        r.map_err(|e| AcceptError::from_boxed(Box::<dyn std::error::Error + Send + Sync>::from(e)))
    }
}

impl Net {
    /// Starts the endpoint with the device's secret key. `port` (IPv4) is
    /// the one used last time, so peers find this PC at the same address
    /// after a restart; 0, or a port now taken, picks a free one.
    pub fn start(secret: &[u8; 32], relay: Relay, port: u16, handler: Arc<dyn Handler>) -> Result<Net, String> {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .thread_name("kgb-net")
            .build()
            .map_err(|e| e.to_string())?;
        let mut last = String::new();
        for p in if port == 0 { vec![0] } else { vec![port, 0] } {
            let key = SecretKey::from_bytes(secret);
            let r = relay.clone();
            let h = handler.clone();
            let res = rt.block_on(async move {
                let b = match &r {
                    Relay::Off => Endpoint::builder(presets::Minimal).relay_mode(RelayMode::Disabled),
                    Relay::N0Test => Endpoint::builder(presets::N0),
                    Relay::Custom(url) => {
                        let url: RelayUrl = url.parse().map_err(|_| "adresa relay-ului nu e validă".to_string())?;
                        Endpoint::builder(presets::Minimal).relay_mode(RelayMode::Custom(RelayMap::from(url)))
                    }
                };
                let b = if p == 0 {
                    b
                } else {
                    b.bind_addr(format!("0.0.0.0:{p}").as_str())
                        .map_err(|e| e.to_string())?
                };
                let transport = QuicTransportConfig::builder()
                    .max_idle_timeout(Some(
                        IDLE_TIMEOUT
                            .try_into()
                            .map_err(|_| "timp de așteptare greșit".to_string())?,
                    ))
                    .build();
                let ep = b
                    .transport_config(transport)
                    .secret_key(key)
                    .alpns(vec![ALPN.to_vec()])
                    .bind()
                    .await
                    .map_err(|e| format!("rețeaua nu a putut porni: {e}"))?;
                Ok::<_, String>(Router::builder(ep).accept(ALPN, Server { handler: h }).spawn())
            });
            match res {
                Ok(router) => return Ok(Net { rt, router, relay }),
                Err(e) => last = e,
            }
        }
        Err(last)
    }

    /// The local IPv4 port this endpoint listens on (to reuse next time).
    pub fn port(&self) -> u16 {
        self.router
            .endpoint()
            .bound_sockets()
            .iter()
            .find(|a| a.is_ipv4())
            .map(|a| a.port())
            .unwrap_or(0)
    }

    pub fn relay(&self) -> &Relay {
        &self.relay
    }

    /// This device's public key (hex), the same as its registry key.
    pub fn id(&self) -> String {
        hex(self.router.endpoint().id().as_bytes())
    }

    /// Where peers can reach this device now (JSON of the iroh address:
    /// key, direct addresses, relay). Waits briefly for the addresses.
    pub fn addr(&self) -> String {
        let ep = self.router.endpoint().clone();
        let relay = self.relay != Relay::Off;
        let a = self.rt.block_on(async move {
            if relay {
                let _ = tokio::time::timeout(Duration::from_secs(5), ep.online()).await;
            }
            let t0 = std::time::Instant::now();
            loop {
                let a = ep.addr();
                if a.ip_addrs().next().is_some()
                    || a.relay_urls().next().is_some()
                    || t0.elapsed() > Duration::from_secs(3)
                {
                    return a;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        });
        serde_json::to_string(&a).unwrap_or_default()
    }

    /// Sends `request` to the peer at `addr` (as given by [`Net::addr`]) and
    /// returns its answer and how it travelled.
    pub fn exchange(&self, addr: &str, request: &Value) -> Result<(Value, Path), String> {
        let to: EndpointAddr =
            serde_json::from_str(addr).map_err(|_| "adresa dispozitivului nu e validă".to_string())?;
        let ep = self.router.endpoint().clone();
        let req = request.clone();
        self.rt.block_on(async move {
            let conn = tokio::time::timeout(CONNECT_TIMEOUT, ep.connect(to, ALPN))
                .await
                .map_err(|_| {
                    format!(
                        "dispozitivul nu a răspuns în {} s (oprit, fără rețea sau blocat de firewall)",
                        CONNECT_TIMEOUT.as_secs()
                    )
                })?
                .map_err(|e| format!("conexiune eșuată: {e}"))?;
            let r = tokio::time::timeout(EXCHANGE_TIMEOUT, async {
                let (mut send, mut recv) = conn.open_bi().await.map_err(|e| e.to_string())?;
                write_frame(&mut send, &req).await?;
                send.finish().map_err(|e| e.to_string())?;
                read_frame(&mut recv).await
            })
            .await
            .map_err(|_| "schimbul a durat prea mult".to_string())?;
            let path = conn
                .paths()
                .iter()
                .find(|p| p.is_selected())
                .map(|p| if p.is_relay() { Path::Relay } else { Path::Direct })
                .unwrap_or(Path::Unknown);
            conn.close(0u32.into(), b"gata");
            let v = r?;
            match (v.get("ok"), v.get("eroare").and_then(Value::as_str)) {
                (Some(ok), _) => Ok((ok.clone(), path)),
                (None, Some(e)) => Err(format!("celălalt dispozitiv a refuzat: {e}")),
                _ => Err("răspuns necunoscut".into()),
            }
        })
    }

    /// Stops the endpoint (connections are closed politely).
    pub fn shutdown(self) {
        let Net { rt, router, .. } = self;
        rt.block_on(async move {
            let _ = tokio::time::timeout(Duration::from_secs(3), router.shutdown()).await;
        });
        rt.shutdown_timeout(Duration::from_secs(2));
    }
}
