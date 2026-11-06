//! Encoding of one journal op inside a frame (Etapa 2, step 2.4; D-028, D-029).
//!
//! Two formats are read; the store writes the one its manifest declares:
//! - **v1** (Etapa 0/1): the op as JSON. Payload starts with `{`.
//! - **v2**: binary header + length-prefixed fields. Payload starts with `0xB2`.
//!
//! v2 layout (little-endian; frames already carry a CRC):
//! ```text
//! u8   tag = 0xB2
//! u16  coll length, coll bytes (UTF-8)
//! [16] record id
//! u64  version
//! u64  rev.hlc, u64 rev.device
//! u8   flags: bit0 deleted, bit1 compacted
//! u64  origin.device, u64 origin.seq
//! u32  meta length, meta bytes   JSON {"b": record_base, "ch": changed, "fr": field_revs}
//! u32  field count, then per field:
//!      u16 name length, name bytes, u32 value length, value bytes (JSON of the value)
//! ```
//! Values stay JSON, so their meaning never changes; what v2 adds is that a
//! reader can jump over any field by its length without scanning it. Queries
//! parse only the fields they test.

use std::borrow::Cow;
use std::collections::{BTreeMap, HashMap};

use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use uuid::Uuid;

use crate::error::{Error, Result};
use crate::model::{DeviceId, Fields, Op, Origin, RecordState, Rev};

pub const TAG_V2: u8 = 0xB2;

#[derive(Serialize, Deserialize, Default)]
struct Meta {
    #[serde(rename = "b", default, skip_serializing_if = "Option::is_none")]
    record_base: Option<Rev>,
    #[serde(rename = "ch", default, skip_serializing_if = "BTreeMap::is_empty")]
    changed: BTreeMap<String, Option<Rev>>,
    #[serde(rename = "fr", default)]
    field_revs: BTreeMap<String, Rev>,
}

fn bad(detail: impl Into<String>) -> Error {
    Error::Serde(format!("v2 payload: {}", detail.into()))
}

/// Encodes `op` in the given journal format (1 = JSON, 2 = binary).
pub fn encode(op: &Op, format: u32) -> Result<Vec<u8>> {
    if format < 2 {
        return Ok(serde_json::to_vec(op)?);
    }
    let s = &op.state;
    let mut out = Vec::with_capacity(256);
    out.push(TAG_V2);
    put_str16(&mut out, &s.coll)?;
    out.extend_from_slice(s.id.as_bytes());
    out.extend_from_slice(&s.version.to_le_bytes());
    out.extend_from_slice(&s.rev.0.to_le_bytes());
    out.extend_from_slice(&s.rev.1.to_le_bytes());
    out.push(u8::from(s.deleted) | (u8::from(op.compacted) << 1));
    out.extend_from_slice(&op.origin.0.to_le_bytes());
    out.extend_from_slice(&op.origin.1.to_le_bytes());
    let meta = serde_json::to_vec(&Meta {
        record_base: op.record_base,
        changed: op.changed.clone(),
        field_revs: s.field_revs.clone(),
    })?;
    put_bytes32(&mut out, &meta)?;
    out.extend_from_slice(
        &u32::try_from(s.fields.len())
            .map_err(|_| bad("too many fields"))?
            .to_le_bytes(),
    );
    for (name, value) in &s.fields {
        put_str16(&mut out, name)?;
        put_bytes32(&mut out, &serde_json::to_vec(value)?)?;
    }
    Ok(out)
}

fn put_str16(out: &mut Vec<u8>, s: &str) -> Result<()> {
    let n = u16::try_from(s.len()).map_err(|_| bad("name longer than 65535 bytes"))?;
    out.extend_from_slice(&n.to_le_bytes());
    out.extend_from_slice(s.as_bytes());
    Ok(())
}

fn put_bytes32(out: &mut Vec<u8>, b: &[u8]) -> Result<()> {
    let n = u32::try_from(b.len()).map_err(|_| bad("value larger than 4 GiB"))?;
    out.extend_from_slice(&n.to_le_bytes());
    out.extend_from_slice(b);
    Ok(())
}

/// Bounds-checked reader over a v2 payload.
struct Reader<'a> {
    b: &'a [u8],
    at: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8]> {
        let end = self
            .at
            .checked_add(n)
            .filter(|e| *e <= self.b.len())
            .ok_or_else(|| bad("truncated"))?;
        let s = &self.b[self.at..end];
        self.at = end;
        Ok(s)
    }
    fn u8(&mut self) -> Result<u8> {
        Ok(self.take(1)?[0])
    }
    fn u16(&mut self) -> Result<u16> {
        Ok(u16::from_le_bytes(self.take(2)?.try_into().expect("2 bytes")))
    }
    fn u32(&mut self) -> Result<u32> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().expect("4 bytes")))
    }
    fn u64(&mut self) -> Result<u64> {
        Ok(u64::from_le_bytes(self.take(8)?.try_into().expect("8 bytes")))
    }
    fn str16(&mut self) -> Result<&'a str> {
        let n = self.u16()? as usize;
        std::str::from_utf8(self.take(n)?).map_err(|_| bad("name is not UTF-8"))
    }
    fn bytes32(&mut self) -> Result<&'a [u8]> {
        let n = self.u32()? as usize;
        self.take(n)
    }
}

/// The fixed header of an op: everything except fields and metadata.
pub struct Header<'a> {
    pub coll: Cow<'a, str>,
    pub id: Uuid,
    pub version: u64,
    pub rev: Rev,
    pub deleted: bool,
    pub compacted: bool,
    pub origin: Origin,
}

/// Borrowed, undecoded view of one op.
pub struct View<'a> {
    pub header: Header<'a>,
    meta: &'a [u8],
    fields: Fields_<'a>,
}

enum Fields_<'a> {
    Bin(Vec<(&'a str, &'a [u8])>),
    Json(HashMap<Cow<'a, str>, &'a RawValue>),
}

/// v1 (JSON) view, borrowed where possible.
#[derive(Deserialize)]
struct JsonOp<'a> {
    #[serde(borrow)]
    s: JsonState<'a>,
    o: Origin,
    #[serde(default)]
    k: bool,
}

#[derive(Deserialize)]
struct JsonState<'a> {
    #[serde(borrow)]
    c: Cow<'a, str>,
    i: Uuid,
    v: u64,
    r: Rev,
    #[serde(default)]
    d: bool,
    #[serde(borrow)]
    f: HashMap<Cow<'a, str>, &'a RawValue>,
}

impl<'a> View<'a> {
    pub fn parse(payload: &'a [u8]) -> Result<View<'a>> {
        if payload.first() == Some(&TAG_V2) {
            let mut r = Reader { b: payload, at: 1 };
            let coll = Cow::Borrowed(r.str16()?);
            let id = Uuid::from_bytes(r.take(16)?.try_into().expect("16 bytes"));
            let version = r.u64()?;
            let rev = Rev(r.u64()?, r.u64()? as DeviceId);
            let flags = r.u8()?;
            let origin = Origin(r.u64()? as DeviceId, r.u64()?);
            let meta = r.bytes32()?;
            let n = r.u32()? as usize;
            let mut fields = Vec::with_capacity(n.min(1024));
            for _ in 0..n {
                let name = r.str16()?;
                fields.push((name, r.bytes32()?));
            }
            if r.at != payload.len() {
                return Err(bad("trailing bytes"));
            }
            let header = Header {
                coll,
                id,
                version,
                rev,
                deleted: flags & 1 != 0,
                compacted: flags & 2 != 0,
                origin,
            };
            Ok(View {
                header,
                meta,
                fields: Fields_::Bin(fields),
            })
        } else {
            let j: JsonOp<'a> = serde_json::from_slice(payload)?;
            let header = Header {
                coll: j.s.c,
                id: j.s.i,
                version: j.s.v,
                rev: j.s.r,
                deleted: j.s.d,
                compacted: j.k,
                origin: j.o,
            };
            Ok(View {
                header,
                meta: payload,
                fields: Fields_::Json(j.s.f),
            })
        }
    }

    /// Raw JSON bytes of one field, if present.
    pub fn field(&self, name: &str) -> Option<&'a [u8]> {
        match &self.fields {
            Fields_::Bin(v) => v.iter().find(|(n, _)| *n == name).map(|(_, b)| *b),
            Fields_::Json(m) => m.get(name).map(|r| r.get().as_bytes()),
        }
    }

    /// Decodes all fields.
    pub fn fields(&self) -> Result<Fields> {
        let mut out = Fields::new();
        match &self.fields {
            Fields_::Bin(v) => {
                for (n, b) in v {
                    out.insert((*n).to_string(), serde_json::from_slice(b)?);
                }
            }
            Fields_::Json(m) => {
                for (n, r) in m {
                    out.insert(n.to_string(), serde_json::from_str(r.get())?);
                }
            }
        }
        Ok(out)
    }

    fn is_v2(&self) -> bool {
        matches!(self.fields, Fields_::Bin(_))
    }
}

/// Full decode of an op (any format).
pub fn decode_op(payload: &[u8]) -> Result<Op> {
    if payload.first() != Some(&TAG_V2) {
        return Ok(serde_json::from_slice(payload)?);
    }
    let v = View::parse(payload)?;
    debug_assert!(v.is_v2());
    let meta: Meta = serde_json::from_slice(v.meta)?;
    let h = &v.header;
    Ok(Op {
        state: RecordState {
            coll: h.coll.to_string(),
            id: h.id,
            version: h.version,
            rev: h.rev,
            deleted: h.deleted,
            fields: v.fields()?,
            field_revs: meta.field_revs,
        },
        origin: h.origin,
        record_base: meta.record_base,
        changed: meta.changed,
        compacted: h.compacted,
    })
}

/// Only the record state (any format).
pub fn decode_state(payload: &[u8]) -> Result<RecordState> {
    if payload.first() != Some(&TAG_V2) {
        #[derive(Deserialize)]
        struct StateOnly {
            s: RecordState,
        }
        let only: StateOnly = serde_json::from_slice(payload)?;
        return Ok(only.s);
    }
    Ok(decode_op(payload)?.state)
}

/// Whether a payload is in the binary format.
pub fn is_v2(payload: &[u8]) -> bool {
    payload.first() == Some(&TAG_V2)
}
