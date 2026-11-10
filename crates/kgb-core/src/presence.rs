//! "Echipa pe scurt" (Etapa 7, step 7.4h): who in the organization has
//! K.G.B. open now, when the others were last seen, and what each one says
//! they are working on. Only administrators see everyone; every member sees
//! exactly what is shown about them.
//!
//! What is recorded, per device, and nothing else (D-064, Master Plan §6.8):
//! - the member's name, initials and a colour chosen by the member;
//! - when K.G.B. was last open on that PC (a signal written at most every
//!   10 minutes while the app runs);
//! - „la ce lucrez”: a short text the member writes themselves.
//!
//! No screen, window, keyboard, application or location is ever watched.
//! The records travel through the synchronisation of Etapa 6 only to the
//! organization's administrators and to the device they describe; a device
//! may only write its own record (checked on every PC that receives it).

use kgb_store::{Fields, RecordState, Store, Write};
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::workspace::now_ms;

pub const PRESENCE_COLLECTION: &str = "core.presence";
/// The signal is written again only after this long.
pub const BEAT_MS: u64 = 10 * 60 * 1000;
/// Seen within this long = „activ acum”.
pub const ACTIVE_MS: u64 = 15 * 60 * 1000;
pub const WORK_MAX: usize = 200;
pub const COLORS: &[&str] = &["grafit", "otel", "nisip", "masliniu", "caramiziu", "violet"];

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("echipa", detail)
}

/// The record id of a device (the same on every PC).
pub fn id_of(fingerprint: &str) -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_OID, format!("kgb-presence:{fingerprint}").as_bytes())
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Card {
    pub dispozitiv: String,
    pub membru: String,
    pub nume: String,
    pub initiale: String,
    pub culoare: String,
    pub lucrez: String,
    pub vazut_ms: u64,
    pub activ: bool,
}

/// „Ana Maria Pop” → „AP”; „ion” → „I”.
pub fn initials(name: &str) -> String {
    let words: Vec<&str> = name.split_whitespace().collect();
    let pick = |w: &str| {
        w.chars()
            .next()
            .map(|c| c.to_uppercase().collect::<String>())
            .unwrap_or_default()
    };
    match words.as_slice() {
        [] => "?".into(),
        [one] => pick(one),
        [first, .., last] => format!("{}{}", pick(first), pick(last)),
    }
}

fn from(r: &RecordState, now: u64) -> Card {
    let f = &r.fields;
    let s = |k: &str| f.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    let vazut_ms = f.get("vazut_ms").and_then(Value::as_u64).unwrap_or(0);
    Card {
        dispozitiv: s("dispozitiv"),
        membru: s("membru"),
        nume: s("nume"),
        initiale: s("initiale"),
        culoare: s("culoare"),
        lucrez: s("lucrez"),
        vazut_ms,
        activ: now.saturating_sub(vazut_ms) <= ACTIVE_MS,
    }
}

/// This device's own card, if written yet.
pub fn mine(store: &Store, fingerprint: &str) -> CoreResult<Option<Card>> {
    Ok(store
        .get(PRESENCE_COLLECTION, id_of(fingerprint))?
        .map(|r| from(&r, now_ms())))
}

/// Every card on this PC, active first, then by name.
pub fn all(store: &Store) -> CoreResult<Vec<Card>> {
    let now = now_ms();
    let mut v: Vec<Card> = store
        .scan(PRESENCE_COLLECTION, |_| true)?
        .iter()
        .map(|r| from(r, now))
        .collect();
    v.sort_by_key(|c| (!c.activ, c.nume.to_lowercase()));
    Ok(v)
}

fn write(
    store: &mut Store,
    fingerprint: &str,
    membru: &str,
    nume: &str,
    culoare: &str,
    lucrez: &str,
    vazut_ms: u64,
) -> CoreResult<()> {
    let id = id_of(fingerprint);
    let version = store.get(PRESENCE_COLLECTION, id)?.map_or(0, |r| r.version);
    let mut f = Fields::new();
    f.insert("dispozitiv".into(), json!(fingerprint));
    f.insert("membru".into(), json!(membru));
    f.insert("nume".into(), json!(nume));
    f.insert("initiale".into(), json!(initials(nume)));
    f.insert("culoare".into(), json!(culoare));
    f.insert("lucrez".into(), json!(lucrez));
    f.insert("vazut_ms".into(), json!(vazut_ms));
    store.write(vec![Write::put(PRESENCE_COLLECTION, id, f).expect(version)])?;
    Ok(())
}

/// The "K.G.B. is open here" signal: written when the last one is older than
/// [`BEAT_MS`] or the name changed. Returns whether it wrote.
pub fn beat(store: &mut Store, fingerprint: &str, membru: &str, nume: &str) -> CoreResult<bool> {
    let now = now_ms();
    let cur = mine(store, fingerprint)?;
    if let Some(c) = &cur
        && c.nume == nume
        && c.membru == membru
        && now.saturating_sub(c.vazut_ms) < BEAT_MS
    {
        return Ok(false);
    }
    let (culoare, lucrez) = cur
        .map(|c| (c.culoare, c.lucrez))
        .unwrap_or_else(|| (COLORS[0].to_string(), String::new()));
    write(store, fingerprint, membru, nume, &culoare, &lucrez, now)?;
    Ok(true)
}

/// What the member writes about themselves: „la ce lucrez” and a colour.
pub fn set_mine(
    store: &mut Store,
    fingerprint: &str,
    membru: &str,
    nume: &str,
    lucrez: &str,
    culoare: &str,
) -> CoreResult<()> {
    let lucrez = lucrez.trim();
    if lucrez.chars().count() > WORK_MAX {
        return Err(bad(format!("„la ce lucrez” are mai mult de {WORK_MAX} de caractere")));
    }
    if !COLORS.contains(&culoare) {
        return Err(bad("culoarea nu e în listă"));
    }
    write(store, fingerprint, membru, nume, culoare, lucrez, now_ms())
}

/// Checks a received presence record against its author (used by
/// replication): a device writes only its own card.
pub fn written_by_itself(fields: &Fields, author_fingerprint: &str) -> bool {
    fields.get("dispozitiv").and_then(Value::as_str) == Some(author_fingerprint)
}
