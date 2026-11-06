//! K.G.B. Etapa 0 spike S2: peer-to-peer connectivity with iroh. PROTOTYPE.
//!
//! One binary, four commands:
//!   peer listen <dir> [--relay n0|none|<url>]   print an invitation, accept peers
//!   peer pair   <dir> <invitation> [--relay …]  pair with a listener using a one-time token
//!   peer msg    <dir> <text>                    send an (encrypted) message to the paired peer
//!   peer send   <dir> <file> [--abort-after N]  send a file; resumes, verified with BLAKE3
//!
//! Every connection is QUIC + TLS 1.3 authenticated by the endpoint keys (iroh). On top of that
//! the listener only serves peers that paired with a valid one-time invitation token.
//! State is a few small JSON files in <dir>; no database.

use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use anyhow::{Context, Result, anyhow, bail};
use iroh::endpoint::{Connection, RecvStream, SendStream, presets};
use iroh::protocol::{AcceptError, ProtocolHandler, Router};
use iroh::{Endpoint, EndpointAddr, EndpointId, RelayMap, RelayMode, RelayUrl, SecretKey};
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;
use tokio::sync::Notify;

const ALPN: &[u8] = b"kgb/s2/0";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const CHUNK: usize = 64 * 1024;
const MAX_FRAME: u32 = 1024 * 1024;

#[derive(Serialize, Deserialize)]
struct Invitation {
    addr: EndpointAddr,
    token: String,
}

#[derive(Serialize, Deserialize, Default, Debug)]
struct State {
    /// Peers allowed to talk to us (paired).
    trusted: BTreeSet<EndpointId>,
    /// Unused one-time invitation tokens.
    invites: BTreeSet<String>,
    /// The peer we paired with as a client, and how to reach it.
    remote: Option<EndpointAddr>,
}

#[derive(Serialize, Deserialize, Debug)]
enum Request {
    Pair { token: String },
    Msg { text: String },
    FileOffer { name: String, size: u64, hash: String },
}

#[derive(Serialize, Deserialize, Debug)]
enum Reply {
    Paired,
    Delivered,
    /// How many bytes of this file the receiver already has.
    Have {
        bytes: u64,
    },
    FileOk {
        verified: bool,
    },
    Error {
        reason: String,
    },
}

// ---------- local state ----------

fn state_path(dir: &Path) -> PathBuf {
    dir.join("state.json")
}

fn load_state(dir: &Path) -> Result<State> {
    match std::fs::read(state_path(dir)) {
        Ok(b) => Ok(serde_json::from_slice(&b).context("state.json is corrupt")?),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(State::default()),
        Err(e) => Err(e.into()),
    }
}

fn save_state(dir: &Path, s: &State) -> Result<()> {
    let tmp = dir.join("state.json.tmp~");
    std::fs::write(&tmp, serde_json::to_vec_pretty(s)?)?;
    std::fs::rename(&tmp, state_path(dir))?;
    Ok(())
}

/// The device identity. PROTOTYPE: stored as a plain file; Etapa 1 moves it under DPAPI.
fn load_or_create_key(dir: &Path) -> Result<SecretKey> {
    let p = dir.join("device.key");
    if let Ok(b) = std::fs::read(&p) {
        let arr: [u8; 32] = b.try_into().map_err(|_| anyhow!("device.key has wrong length"))?;
        return Ok(SecretKey::from_bytes(&arr));
    }
    let k = SecretKey::generate();
    std::fs::write(&p, k.to_bytes())?;
    Ok(k)
}

async fn bind(dir: &Path, relay: &str) -> Result<Endpoint> {
    std::fs::create_dir_all(dir)?;
    let key = load_or_create_key(dir)?;
    let b = match relay {
        "n0" => Endpoint::builder(presets::N0),
        "none" => Endpoint::builder(presets::Minimal).relay_mode(RelayMode::Disabled),
        url => {
            let url: RelayUrl = url.parse().context("invalid relay URL")?;
            Endpoint::builder(presets::Minimal).relay_mode(RelayMode::Custom(RelayMap::from(url)))
        }
    };
    Ok(b.secret_key(key).alpns(vec![ALPN.to_vec()]).bind().await?)
}

/// Wait until the endpoint knows at least one way to be reached (bounded).
async fn wait_reachable(ep: &Endpoint, relay: &str) -> EndpointAddr {
    if relay != "none" {
        let _ = tokio::time::timeout(Duration::from_secs(10), ep.online()).await;
    }
    let t0 = Instant::now();
    loop {
        let a = ep.addr();
        if a.ip_addrs().next().is_some() || a.relay_urls().next().is_some() || t0.elapsed() > Duration::from_secs(5) {
            return a;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

// ---------- framing ----------

async fn write_frame<T: Serialize>(s: &mut SendStream, v: &T) -> Result<()> {
    let b = serde_json::to_vec(v)?;
    s.write_all(&(b.len() as u32).to_le_bytes()).await?;
    s.write_all(&b).await?;
    Ok(())
}

async fn read_frame<T: for<'de> Deserialize<'de>>(r: &mut RecvStream) -> Result<T> {
    let mut len = [0u8; 4];
    r.read_exact(&mut len).await?;
    let len = u32::from_le_bytes(len);
    if len > MAX_FRAME {
        bail!("frame too large: {len}");
    }
    let mut b = vec![0u8; len as usize];
    r.read_exact(&mut b).await?;
    Ok(serde_json::from_slice(&b)?)
}

// ---------- listener ----------

#[derive(Clone, Debug)]
struct Server {
    dir: PathBuf,
    state: Arc<Mutex<State>>,
    /// Transfers in progress, by file hash. A resumed transfer stops the stale one first
    /// (an abruptly closed connection stays half-open until the QUIC idle timeout, ~30 s).
    active: Arc<Mutex<HashMap<String, Arc<Notify>>>>,
}

/// Removes this transfer from `active` when it ends, whatever the exit path.
struct ActiveGuard {
    active: Arc<Mutex<HashMap<String, Arc<Notify>>>>,
    hash: String,
    me: Arc<Notify>,
}

impl Drop for ActiveGuard {
    fn drop(&mut self) {
        let mut a = self.active.lock().unwrap();
        if a.get(&self.hash).is_some_and(|n| Arc::ptr_eq(n, &self.me)) {
            a.remove(&self.hash);
        }
    }
}

impl ProtocolHandler for Server {
    async fn accept(&self, conn: Connection) -> Result<(), AcceptError> {
        let peer = conn.remote_id();
        let r = self.serve(&conn, peer).await;
        if let Err(e) = &r {
            println!("EVENT error from {}: {e:#}", short(peer));
        }
        conn.closed().await;
        r.map_err(|e| AcceptError::from_boxed(e.into()))
    }
}

impl Server {
    async fn serve(&self, conn: &Connection, peer: EndpointId) -> Result<()> {
        let (mut send, mut recv) = conn.accept_bi().await?;
        let req: Request = read_frame(&mut recv).await?;
        if let Request::Pair { token } = &req {
            let ok = {
                let mut s = self.state.lock().unwrap();
                let ok = s.invites.remove(token);
                if ok {
                    s.trusted.insert(peer);
                    save_state(&self.dir, &s)?;
                }
                ok
            };
            let reply = if ok {
                println!("EVENT paired {}", short(peer));
                Reply::Paired
            } else {
                println!("EVENT pairing refused for {} (bad or used token)", short(peer));
                Reply::Error {
                    reason: "invitație invalidă sau deja folosită".into(),
                }
            };
            write_frame(&mut send, &reply).await?;
            send.finish()?;
            return Ok(());
        }
        if !self.state.lock().unwrap().trusted.contains(&peer) {
            println!("EVENT refused unpaired {}", short(peer));
            write_frame(
                &mut send,
                &Reply::Error {
                    reason: "dispozitiv neasociat".into(),
                },
            )
            .await?;
            send.finish()?;
            return Ok(());
        }
        match req {
            Request::Pair { .. } => unreachable!(),
            Request::Msg { text } => {
                println!("EVENT msg from {}: {text}", short(peer));
                write_frame(&mut send, &Reply::Delivered).await?;
            }
            Request::FileOffer { name, size, hash } => {
                self.receive_file(&mut send, &mut recv, &name, size, &hash).await?
            }
        }
        send.finish()?;
        Ok(())
    }

    async fn receive_file(
        &self,
        send: &mut SendStream,
        recv: &mut RecvStream,
        name: &str,
        size: u64,
        hash: &str,
    ) -> Result<()> {
        if hash.len() != 64 || !hash.bytes().all(|b| b.is_ascii_hexdigit()) {
            bail!("bad hash");
        }
        let safe = Path::new(name)
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| anyhow!("bad name"))?
            .to_string();
        let inbox = self.dir.join("incoming");
        tokio::fs::create_dir_all(&inbox).await?;
        let part = inbox.join(format!("{hash}.part"));
        let stop = Arc::new(Notify::new());
        let t0 = Instant::now();
        loop {
            let old = {
                let mut a = self.active.lock().unwrap();
                match a.get(hash) {
                    Some(n) => Some(n.clone()),
                    None => {
                        a.insert(hash.to_string(), stop.clone());
                        None
                    }
                }
            };
            match old {
                None => break,
                Some(_) if t0.elapsed() > Duration::from_secs(5) => bail!("previous transfer of {safe} did not stop"),
                Some(n) => {
                    n.notify_one();
                    tokio::time::sleep(Duration::from_millis(20)).await;
                }
            }
        }
        if t0.elapsed() > Duration::from_millis(5) {
            println!("EVENT file {safe}: stopped a stale transfer before resuming");
        }
        let _guard = ActiveGuard {
            active: self.active.clone(),
            hash: hash.to_string(),
            me: stop.clone(),
        };
        let have = match tokio::fs::metadata(&part).await {
            Ok(m) => m.len().min(size),
            Err(_) => 0,
        };
        write_frame(send, &Reply::Have { bytes: have }).await?;
        // Not `append`: on Windows an append-only handle cannot `set_len` (Access denied).
        let mut f = tokio::fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .write(true)
            .open(&part)
            .await?;
        f.set_len(have).await?;
        tokio::io::AsyncSeekExt::seek(&mut f, std::io::SeekFrom::Start(have)).await?;
        let mut got = have;
        let mut buf = vec![0u8; CHUNK];
        while got < size {
            let want = ((size - got) as usize).min(CHUNK);
            let n = tokio::select! {
                r = recv.read(&mut buf[..want]) => match r {
                    Ok(Some(n)) => n,
                    Ok(None) => break,
                    Err(e) => {
                        println!("EVENT file {safe}: connection lost at {got}/{size} bytes ({e}), kept for resume");
                        break;
                    }
                },
                _ = stop.notified() => {
                    println!("EVENT file {safe}: superseded by a resumed transfer at {got}/{size} bytes");
                    break;
                }
            };
            f.write_all(&buf[..n]).await?;
            got += n as u64;
        }
        f.sync_all().await?;
        // Close the handle deterministically: a tokio File dropped while idle can keep the OS
        // handle alive in the blocking pool, which blocks other readers on Windows.
        drop(f.into_std().await);
        if got < size {
            println!("EVENT file {safe}: interrupted at {got}/{size} bytes, kept for resume");
            return Ok(());
        }
        let data = tokio::fs::read(&part).await?;
        let verified = blake3::hash(&data).to_hex().as_str() == hash;
        if verified {
            tokio::fs::rename(&part, inbox.join(&safe)).await?;
            println!("EVENT file {safe}: {size} bytes, BLAKE3 ok (resumed from {have})");
        } else {
            let q = self.dir.join("quarantine");
            tokio::fs::create_dir_all(&q).await?;
            tokio::fs::rename(&part, q.join(format!("{hash}.bad"))).await?;
            println!("EVENT file {safe}: HASH MISMATCH, moved to quarantine");
        }
        write_frame(send, &Reply::FileOk { verified }).await?;
        Ok(())
    }
}

/// `relay_only`: test aid for S2.2 — the invitation carries only the relay URL, no direct
/// addresses, to check what happens when the relay is the only path and it is down.
async fn listen(dir: &Path, relay: &str, relay_only: bool) -> Result<()> {
    let t0 = Instant::now();
    let ep = bind(dir, relay).await?;
    let mut st = load_state(dir)?;
    let token = data_encoding::HEXLOWER.encode(&rand::random::<[u8; 16]>());
    st.invites.insert(token.clone());
    save_state(dir, &st)?;
    let addr = if relay_only {
        let url: RelayUrl = relay.parse().context("--relay-only needs --relay <url>")?;
        EndpointAddr::new(ep.id()).with_relay_url(url)
    } else {
        wait_reachable(&ep, relay).await
    };
    println!("STARTUP {} ms", t0.elapsed().as_millis());
    let inv = Invitation { addr, token };
    println!("ID {}", ep.id());
    println!(
        "INVITE {}",
        data_encoding::BASE32_NOPAD.encode(&serde_json::to_vec(&inv)?)
    );
    println!("READY");
    let server = Server {
        dir: dir.to_path_buf(),
        state: Arc::new(Mutex::new(st)),
        active: Default::default(),
    };
    let router = Router::builder(ep).accept(ALPN, server).spawn();
    tokio::signal::ctrl_c().await?;
    router.shutdown().await?;
    Ok(())
}

// ---------- client ----------

async fn request(ep: &Endpoint, to: EndpointAddr, req: &Request) -> Result<(Connection, SendStream, RecvStream)> {
    let conn = tokio::time::timeout(CONNECT_TIMEOUT, ep.connect(to, ALPN))
        .await
        .map_err(|_| {
            anyhow!(
                "conexiune eșuată: peer-ul nu a răspuns în {}s",
                CONNECT_TIMEOUT.as_secs()
            )
        })?
        .context("conexiune eșuată")?;
    let (mut send, recv) = conn.open_bi().await?;
    write_frame(&mut send, req).await?;
    Ok((conn, send, recv))
}

async fn finish(ep: Endpoint, conn: Connection) {
    conn.close(0u32.into(), b"done");
    ep.close().await;
}

fn remote(dir: &Path) -> Result<EndpointAddr> {
    load_state(dir)?
        .remote
        .ok_or_else(|| anyhow!("nu există un peer asociat; rulează întâi `pair`"))
}

async fn pair(dir: &Path, invitation: &str, relay: &str) -> Result<()> {
    let raw = data_encoding::BASE32_NOPAD
        .decode(invitation.trim().as_bytes())
        .context("invitație ilizibilă")?;
    let inv: Invitation = serde_json::from_slice(&raw).context("invitație ilizibilă")?;
    let ep = bind(dir, relay).await?;
    let t0 = Instant::now();
    let (conn, mut send, mut recv) = request(&ep, inv.addr.clone(), &Request::Pair { token: inv.token }).await?;
    send.finish()?;
    let reply: Reply = read_frame(&mut recv).await?;
    let ms = t0.elapsed().as_millis();
    let path = describe_path(&conn);
    finish(ep, conn).await;
    match reply {
        Reply::Paired => {
            let mut st = load_state(dir)?;
            st.trusted.insert(inv.addr.id);
            st.remote = Some(inv.addr);
            save_state(dir, &st)?;
            println!("OK paired in {ms} ms via {path}");
            Ok(())
        }
        Reply::Error { reason } => bail!("asociere refuzată: {reason}"),
        r => bail!("răspuns neașteptat: {r:?}"),
    }
}

async fn msg(dir: &Path, text: &str, relay: &str) -> Result<()> {
    let ep = bind(dir, relay).await?;
    let t0 = Instant::now();
    let (conn, mut send, mut recv) = request(&ep, remote(dir)?, &Request::Msg { text: text.into() }).await?;
    send.finish()?;
    let reply: Reply = read_frame(&mut recv).await?;
    let ms = t0.elapsed().as_millis();
    let path = describe_path(&conn);
    finish(ep, conn).await;
    match reply {
        Reply::Delivered => {
            println!("OK delivered in {ms} ms via {path}");
            Ok(())
        }
        Reply::Error { reason } => bail!("refuzat: {reason}"),
        r => bail!("răspuns neașteptat: {r:?}"),
    }
}

async fn send_file(dir: &Path, file: &Path, abort_after: Option<u64>, relay: &str) -> Result<()> {
    let data = tokio::fs::read(file)
        .await
        .with_context(|| format!("nu pot citi {}", file.display()))?;
    let hash = blake3::hash(&data).to_hex().to_string();
    let name = file.file_name().and_then(|n| n.to_str()).unwrap_or("file").to_string();
    let size = data.len() as u64;
    let ep = bind(dir, relay).await?;
    let t0 = Instant::now();
    let (conn, mut send, mut recv) = request(&ep, remote(dir)?, &Request::FileOffer { name, size, hash }).await?;
    let have = match read_frame::<Reply>(&mut recv).await? {
        Reply::Have { bytes } => bytes,
        Reply::Error { reason } => bail!("refuzat: {reason}"),
        r => bail!("răspuns neașteptat: {r:?}"),
    };
    let mut off = have;
    for chunk in data[have as usize..].chunks(CHUNK) {
        if let Some(limit) = abort_after
            && off >= have + limit
        {
            println!(
                "ABORTED after sending {} bytes (total at receiver {off}/{size})",
                off - have
            );
            std::process::exit(3);
        }
        send.write_all(chunk).await?;
        off += chunk.len() as u64;
    }
    send.finish()?;
    let reply: Reply = read_frame(&mut recv).await?;
    let secs = t0.elapsed().as_secs_f64();
    let path = describe_path(&conn);
    finish(ep, conn).await;
    match reply {
        Reply::FileOk { verified: true } => {
            let sent = size - have;
            println!(
                "OK file {size} bytes, resumed from {have}, sent {sent} in {secs:.2}s ({:.1} MB/s) via {path}, BLAKE3 verified",
                sent as f64 / secs / 1e6
            );
            Ok(())
        }
        Reply::FileOk { verified: false } => bail!("hash greșit la destinație; fișierul a fost pus în carantină"),
        Reply::Error { reason } => bail!("refuzat: {reason}"),
        r => bail!("răspuns neașteptat: {r:?}"),
    }
}

fn describe_path(conn: &Connection) -> String {
    format!("{:?}", conn.paths())
        .lines()
        .next()
        .unwrap_or("?")
        .chars()
        .take(160)
        .collect()
}

fn short(id: EndpointId) -> String {
    id.to_string().chars().take(10).collect()
}

// ---------- CLI ----------

fn opt(args: &mut Vec<String>, name: &str) -> Option<String> {
    let i = args.iter().position(|a| a == name)?;
    let v = args.get(i + 1).cloned();
    args.drain(i..(i + 2).min(args.len()));
    v
}

#[tokio::main]
async fn main() {
    let mut args: Vec<String> = std::env::args().skip(1).collect();
    let relay = opt(&mut args, "--relay").unwrap_or_else(|| "n0".into());
    let abort_after = opt(&mut args, "--abort-after").and_then(|v| v.parse().ok());
    let relay_only = args
        .iter()
        .position(|a| a == "--relay-only")
        .map(|i| args.remove(i))
        .is_some();
    let a: Vec<&str> = args.iter().map(String::as_str).collect();
    let r = match a.as_slice() {
        ["listen", dir] => listen(Path::new(dir), &relay, relay_only).await,
        ["pair", dir, inv] => pair(Path::new(dir), inv, &relay).await,
        ["msg", dir, text] => msg(Path::new(dir), text, &relay).await,
        ["send", dir, file] => send_file(Path::new(dir), Path::new(file), abort_after, &relay).await,
        _ => {
            eprintln!("usage: peer listen|pair|msg|send <dir> … [--relay n0|none|<url>] [--abort-after BYTES]");
            std::process::exit(2);
        }
    };
    if let Err(e) = r {
        println!("FAIL {e:#}");
        std::process::exit(1);
    }
}
