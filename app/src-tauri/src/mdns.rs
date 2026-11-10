//! `kgb.local` on the office network (step 7.4m-4, D-069): a minimal mDNS
//! responder (RFC 6762) that answers one name, `kgb.local`, with this PC's
//! address, while the phone page is on. Every PC with K.G.B. answers, so a
//! phone that opens `http://kgb.local:8737/m` reaches whichever PC is on;
//! there is no central server (D-004).
//!
//! - Answers only questions for `kgb.local` (type A or ANY); it never asks
//!   anything and sends nothing else.
//! - Several PCs answer the same name with their own address; the answers
//!   are not marked as unique ("cache-flush"), so a phone keeps them all and
//!   tries another when one does not answer. A short TTL (30 s) makes a PC
//!   that was switched off disappear quickly.
//! - Shares UDP port 5353 with Windows' own mDNS (address reuse); Windows may
//!   ask once whether K.G.B. may receive on the network (the firewall).

use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4, UdpSocket};
use std::sync::Arc;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use socket2::{Domain, Protocol, Socket, Type};

const GROUP: Ipv4Addr = Ipv4Addr::new(224, 0, 0, 251);
const PORT: u16 = 5353;
const TTL: u32 = 30;

static STOP: Mutex<Option<Arc<AtomicBool>>> = Mutex::new(None);

/// Starts answering `name` with this PC's LAN address (no-op if running).
pub fn start(name: &'static str) -> Result<(), String> {
    let Ok(mut g) = STOP.lock() else {
        return Err("eroare internă".into());
    };
    if g.is_some() {
        return Ok(());
    }
    let sock = open().map_err(|e| format!("numele {name} nu poate fi anunțat în rețea ({e})"))?;
    let stop = Arc::new(AtomicBool::new(false));
    *g = Some(stop.clone());
    std::thread::Builder::new()
        .name("kgb-mdns".into())
        .spawn(move || serve(sock, name, &stop))
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn stop() {
    if let Ok(mut g) = STOP.lock()
        && let Some(s) = g.take()
    {
        s.store(true, Ordering::Relaxed);
    }
}

fn lan_v4() -> Ipv4Addr {
    match crate::phone::lan_ip() {
        std::net::IpAddr::V4(a) => a,
        std::net::IpAddr::V6(_) => Ipv4Addr::UNSPECIFIED,
    }
}

fn open() -> std::io::Result<UdpSocket> {
    let s = Socket::new(Domain::IPV4, Type::DGRAM, Some(Protocol::UDP))?;
    s.set_reuse_address(true)?;
    s.bind(&SocketAddr::from(SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, PORT)).into())?;
    let s: UdpSocket = s.into();
    s.join_multicast_v4(&GROUP, &lan_v4())?;
    s.set_multicast_loop_v4(true)?;
    s.set_read_timeout(Some(Duration::from_secs(1)))?;
    Ok(s)
}

fn serve(sock: UdpSocket, name: &str, stop: &AtomicBool) {
    let mut buf = [0u8; 1500];
    while !stop.load(Ordering::Relaxed) {
        let Ok((n, from)) = sock.recv_from(&mut buf) else {
            continue;
        };
        let Some(q) = asked(&buf[..n], name) else { continue };
        let ip = lan_v4();
        if ip.is_unspecified() || ip.is_loopback() {
            continue;
        }
        // A "legacy" resolver (not from port 5353) wants a normal DNS answer
        // to itself; a QU question wants it to itself; otherwise to the group.
        let legacy = from.port() != PORT;
        let reply = answer(name, ip, legacy.then_some(&q));
        let to = if legacy || q.unicast {
            from
        } else {
            SocketAddr::from(SocketAddrV4::new(GROUP, PORT))
        };
        let _ = sock.send_to(&reply, to);
    }
}

/// A question for our name found in a query.
#[derive(Debug, PartialEq, Eq)]
pub struct Question {
    pub id: u16,
    pub qtype: u16,
    /// The "QU" bit: the asker wants a unicast answer.
    pub unicast: bool,
}

/// Reads a name at `pos` (labels, with compression); returns it in lower
/// case and the position after it.
fn read_name(p: &[u8], mut pos: usize) -> Option<(String, usize)> {
    let mut out = String::new();
    let mut end = None;
    for _ in 0..64 {
        let len = *p.get(pos)? as usize;
        if len == 0 {
            return Some((out, end.unwrap_or(pos + 1)));
        }
        if len & 0xC0 == 0xC0 {
            let ptr = ((len & 0x3F) << 8) | *p.get(pos + 1)? as usize;
            end.get_or_insert(pos + 2);
            pos = ptr;
            continue;
        }
        let label = p.get(pos + 1..pos + 1 + len)?;
        if !out.is_empty() {
            out.push('.');
        }
        out.push_str(&String::from_utf8_lossy(label).to_ascii_lowercase());
        pos += 1 + len;
    }
    None
}

/// The question for `name` (type A or ANY, class IN) in a query packet.
pub fn asked(p: &[u8], name: &str) -> Option<Question> {
    if p.len() < 12 || p[2] & 0x80 != 0 {
        return None; // too short, or an answer
    }
    let id = u16::from_be_bytes([p[0], p[1]]);
    let qd = u16::from_be_bytes([p[4], p[5]]) as usize;
    let mut pos = 12;
    for _ in 0..qd.min(16) {
        let (n, after) = read_name(p, pos)?;
        let qtype = u16::from_be_bytes([*p.get(after)?, *p.get(after + 1)?]);
        let class = u16::from_be_bytes([*p.get(after + 2)?, *p.get(after + 3)?]);
        pos = after + 4;
        if n == name && (qtype == 1 || qtype == 255) && class & 0x7FFF == 1 {
            return Some(Question {
                id,
                qtype,
                unicast: class & 0x8000 != 0,
            });
        }
    }
    None
}

fn put_name(out: &mut Vec<u8>, name: &str) {
    for label in name.split('.') {
        out.push(label.len() as u8);
        out.extend_from_slice(label.as_bytes());
    }
    out.push(0);
}

/// The answer packet: one A record for `name`; a legacy query also gets its
/// id and question back.
pub fn answer(name: &str, ip: Ipv4Addr, legacy: Option<&Question>) -> Vec<u8> {
    let mut out = Vec::with_capacity(64);
    out.extend_from_slice(&legacy.map_or(0, |q| q.id).to_be_bytes());
    out.extend_from_slice(&[0x84, 0x00]); // response, authoritative
    out.extend_from_slice(&u16::from(legacy.is_some()).to_be_bytes());
    out.extend_from_slice(&[0, 1, 0, 0, 0, 0]);
    if let Some(q) = legacy {
        put_name(&mut out, name);
        out.extend_from_slice(&q.qtype.to_be_bytes());
        out.extend_from_slice(&[0, 1]);
    }
    put_name(&mut out, name);
    out.extend_from_slice(&[0, 1, 0, 1]); // A, IN (shared: no cache-flush bit)
    out.extend_from_slice(&TTL.to_be_bytes());
    out.extend_from_slice(&[0, 4]);
    out.extend_from_slice(&ip.octets());
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn query(name: &str, qtype: u16, class: u16) -> Vec<u8> {
        let mut p = vec![0x12, 0x34, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0];
        put_name(&mut p, name);
        p.extend_from_slice(&qtype.to_be_bytes());
        p.extend_from_slice(&class.to_be_bytes());
        p
    }

    #[test]
    fn answers_only_its_name() {
        let q = asked(&query("KGB.local", 1, 1), "kgb.local").unwrap();
        assert_eq!(
            q,
            Question {
                id: 0x1234,
                qtype: 1,
                unicast: false
            }
        );
        assert!(asked(&query("kgb.local", 1, 0x8001), "kgb.local").unwrap().unicast);
        assert!(asked(&query("kgb.local", 255, 1), "kgb.local").is_some());
        assert!(
            asked(&query("kgb.local", 28, 1), "kgb.local").is_none(),
            "AAAA: not answered"
        );
        assert!(asked(&query("alt.local", 1, 1), "kgb.local").is_none());
        let mut resp = query("kgb.local", 1, 1);
        resp[2] = 0x84;
        assert!(asked(&resp, "kgb.local").is_none(), "answers are ignored");
        assert!(asked(&[0; 5], "kgb.local").is_none());
        // A compressed second question pointing at the first name.
        let mut p = query("x.local", 1, 1);
        p[5] = 2;
        p.extend_from_slice(&[0x03, b'k', b'g', b'b', 0xC0, 14, 0, 1, 0, 1]);
        assert!(asked(&p, "kgb.local").is_some());
        // A pointer loop does not hang.
        let mut l = vec![0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0xC0, 12, 0, 1, 0, 1];
        assert!(asked(&l, "kgb.local").is_none());
        l.truncate(13);
        assert!(asked(&l, "kgb.local").is_none());
    }

    #[test]
    fn answer_packet() {
        let ip = Ipv4Addr::new(192, 168, 1, 20);
        let a = answer("kgb.local", ip, None);
        assert_eq!(&a[..12], &[0, 0, 0x84, 0, 0, 0, 0, 1, 0, 0, 0, 0]);
        assert_eq!(&a[a.len() - 4..], &[192, 168, 1, 20]);
        assert_eq!(read_name(&a, 12).unwrap().0, "kgb.local");
        let q = Question {
            id: 7,
            qtype: 1,
            unicast: false,
        };
        let l = answer("kgb.local", ip, Some(&q));
        assert_eq!(&l[..6], &[0, 7, 0x84, 0, 0, 1]);
        assert_eq!(&l[l.len() - 4..], &[192, 168, 1, 20]);
    }
}
