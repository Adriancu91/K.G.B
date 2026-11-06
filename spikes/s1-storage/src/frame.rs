//! Journal frame encoding.
//!
//! ```text
//! | magic "KGB1" (4) | payload len u32 LE (4) | flags u32 LE (4) | crc32 u32 LE (4) | payload |
//! ```
//! The CRC covers len, flags and payload. Flag `END_OF_TXN` marks the last frame of a
//! transaction; frames after the last END frame at the tail are an incomplete transaction.

pub const MAGIC: [u8; 4] = *b"KGB1";
pub const HEADER: usize = 16;
pub const MAX_PAYLOAD: u32 = 64 * 1024 * 1024;
pub const END_OF_TXN: u32 = 1;

pub fn encode(payload: &[u8], flags: u32, out: &mut Vec<u8>) {
    let len = payload.len() as u32;
    let mut h = crc32fast::Hasher::new();
    h.update(&len.to_le_bytes());
    h.update(&flags.to_le_bytes());
    h.update(payload);
    out.extend_from_slice(&MAGIC);
    out.extend_from_slice(&len.to_le_bytes());
    out.extend_from_slice(&flags.to_le_bytes());
    out.extend_from_slice(&h.finalize().to_le_bytes());
    out.extend_from_slice(payload);
}

#[derive(Debug, PartialEq)]
pub enum Decoded<'a> {
    /// Clean end of buffer.
    End,
    Frame {
        payload: &'a [u8],
        flags: u32,
        next: usize,
    },
    /// Bad magic, impossible length, truncated or CRC mismatch.
    Invalid(&'static str),
}

pub fn decode_at(buf: &[u8], off: usize) -> Decoded<'_> {
    let rest = &buf[off..];
    if rest.is_empty() {
        return Decoded::End;
    }
    if rest.len() < HEADER {
        return Decoded::Invalid("truncated header");
    }
    if rest[0..4] != MAGIC {
        return Decoded::Invalid("bad magic");
    }
    let len = u32::from_le_bytes(rest[4..8].try_into().unwrap());
    let flags = u32::from_le_bytes(rest[8..12].try_into().unwrap());
    let crc = u32::from_le_bytes(rest[12..16].try_into().unwrap());
    if len > MAX_PAYLOAD {
        return Decoded::Invalid("impossible length");
    }
    let end = HEADER + len as usize;
    if rest.len() < end {
        return Decoded::Invalid("truncated payload");
    }
    let payload = &rest[HEADER..end];
    let mut h = crc32fast::Hasher::new();
    h.update(&len.to_le_bytes());
    h.update(&flags.to_le_bytes());
    h.update(payload);
    if h.finalize() != crc {
        return Decoded::Invalid("crc mismatch");
    }
    Decoded::Frame {
        payload,
        flags,
        next: off + end,
    }
}

/// Offset of the next valid frame strictly after `from`, if any.
pub fn find_next_valid(buf: &[u8], from: usize) -> Option<usize> {
    let mut pos = from;
    while pos + HEADER <= buf.len() {
        match buf[pos..].windows(4).position(|w| w == MAGIC) {
            None => return None,
            Some(rel) => {
                let cand = pos + rel;
                if let Decoded::Frame { .. } = decode_at(buf, cand) {
                    return Some(cand);
                }
                pos = cand + 1;
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_and_damage() {
        let mut buf = Vec::new();
        encode(b"hello", END_OF_TXN, &mut buf);
        encode(b"world", 0, &mut buf);
        let Decoded::Frame { payload, flags, next } = decode_at(&buf, 0) else {
            panic!()
        };
        assert_eq!((payload, flags), (&b"hello"[..], END_OF_TXN));
        assert!(matches!(decode_at(&buf, next), Decoded::Frame { .. }));
        let mut bad = buf.clone();
        bad[HEADER + 1] ^= 0xFF;
        assert_eq!(decode_at(&bad, 0), Decoded::Invalid("crc mismatch"));
        assert_eq!(find_next_valid(&bad, 1), Some(next));
        assert_eq!(
            decode_at(&buf[..buf.len() - 2], next),
            Decoded::Invalid("truncated payload")
        );
    }
}
