//! The phone page (Etapa 7, step 7.4m; D-068): phones of the firm, paired
//! once with this PC, send what they collect — reception sheets, photos of
//! the documents brought by drivers, bank statements — into an inbox on this
//! PC, where someone with the right role processes them.
//!
//! - A phone pairs with a short code shown on this PC (valid 10 minutes) and
//!   then waits until an administrator (or the single user) approves it and
//!   chooses whose phone it is. It can be revoked at any time.
//! - The phone gets a random token; only its BLAKE3 hash is stored.
//! - A phone only adds to the inbox: it cannot read or change anything else.
//! - Every PC of the organization serves the page (7.4m-4, D-069): approved
//!   phones travel to every member's PC (only the hash of their key), so a
//!   phone paired once works on any of them; what phones send travels to the
//!   administrators (and stays on the PC that received it). Approving and
//!   removing a phone stay with administrators (checked by `replication`).
//! - Whether the page is on is one switch for the whole organization
//!   (`core.phone_service`, written by administrators); each PC publishes the
//!   addresses where it answers (`core.phone_hosts`, its own card only), so the
//!   page can move to another PC when one is switched off.
//! - When a phone was last seen stays local (`core.phone_seen`): one write
//!   per phone and PC, not a synchronised change every minute.

use kgb_store::{Fields, RecordState, Write};
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::files;
use crate::workspace::{Workspace, now_ms};

pub const PHONES_COLLECTION: &str = "core.phones";
pub const INBOX_COLLECTION: &str = "core.phone_inbox";
/// Owner of the inbox's files (they travel like the inbox, see `replication`).
pub const PHONE_MODULE: &str = "core.phone";
/// The organization-wide switch (one record, written by administrators).
pub const SERVICE_COLLECTION: &str = "core.phone_service";
/// Where each PC answers phones (one card per device, written by itself).
pub const HOSTS_COLLECTION: &str = "core.phone_hosts";
/// When a phone was last seen by this PC (local only).
pub const SEEN_COLLECTION: &str = "core.phone_seen";
/// The name every PC answers to on the office network (mDNS).
pub const COMMON_NAME: &str = "kgb.local";
const SERVICE_ID: Uuid = Uuid::from_u128(0x6b67_6270_686f_6e65_7365_7276_6963_6501);
pub const KINDS: &[(&str, &str)] = &[
    ("receptie", "fișă de recepție"),
    ("document", "documente de la șofer"),
    ("extras", "extras de cont"),
    // 7.4m-6: an inventory counted in the warehouse, a photo of an expense receipt.
    ("inventar", "inventar numărat"),
    ("bon", "bon de cheltuială"),
    // 7.4m-6b: entry or exit, declared by the person (D-064: no location).
    ("pontaj", "pontaj"),
    // 7.4m-6c: the driver's stage of a delivery (applied on the PC).
    ("livrare", "etapă de livrare"),
    // 7.4m-6d: "I finished this task" (marked done on the PC).
    ("task", "task terminat"),
    // 7.4m-7: the team leader's daily report (present, extra hours).
    ("pontaj_echipa", "raport de prezență"),
];

/// The stages a driver reports from the phone, and the field each needs.
pub const DRIVER_STAGES: &[(&str, &str, &str)] = &[("in_drum", "aviz", "numărul avizului"), ("livrat", "primit_de", "cine a primit marfa")];

/// A time of day "HH:MM" (00:00–23:59).
fn clock(t: &str) -> bool {
    let b = t.as_bytes();
    b.len() == 5
        && b[2] == b':'
        && t[..2].parse::<u8>().is_ok_and(|h| h < 24)
        && t[3..].parse::<u8>().is_ok_and(|m| m < 60)
        && b.iter().enumerate().all(|(i, c)| i == 2 || c.is_ascii_digit())
}

/// A date "AAAA-LL-ZZ" (shape and ranges; enough for a declared day).
fn iso_day(t: &str) -> bool {
    let b = t.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b.iter().enumerate().all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit())
        && t[5..7].parse::<u8>().is_ok_and(|m| (1..=12).contains(&m))
        && t[8..].parse::<u8>().is_ok_and(|d| (1..=31).contains(&d))
}
pub const MAX_FILES: usize = 6;
pub const MAX_FILE_BYTES: usize = 8 * 1024 * 1024;

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("telefonul", detail)
}

fn hash(token: &str) -> String {
    blake3::hash(token.as_bytes()).to_hex().to_string()
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Phone {
    pub id: Uuid,
    pub nume: String,
    /// `asteapta`, `aprobat` or `revocat`.
    pub stare: String,
    pub membru_nume: String,
    pub creat_ms: u64,
    pub vazut_ms: u64,
    pub version: u64,
}

fn phone(r: &RecordState) -> Phone {
    let s = |k: &str| r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    let n = |k: &str| r.fields.get(k).and_then(Value::as_u64).unwrap_or(0);
    Phone { id: r.id, nume: s("nume"), stare: s("stare"), membru_nume: s("membru_nume"), creat_ms: n("creat_ms"), vazut_ms: n("vazut_ms"), version: r.version }
}

pub fn list(ws: &Workspace) -> CoreResult<Vec<Phone>> {
    let mut v: Vec<Phone> = ws.store().scan(PHONES_COLLECTION, |_| true)?.iter().map(phone).collect();
    for p in &mut v {
        if let Some(r) = ws.store().get(SEEN_COLLECTION, p.id)? {
            p.vazut_ms = p.vazut_ms.max(r.fields.get("vazut_ms").and_then(Value::as_u64).unwrap_or(0));
        }
    }
    v.sort_by_key(|p| std::cmp::Reverse(p.creat_ms));
    Ok(v)
}

/// A phone asks to pair (the code was already checked by the caller).
/// Returns its id and the token it must keep.
pub fn pair(ws: &mut Workspace, name: &str) -> CoreResult<(Uuid, String)> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 60 {
        return Err(bad("numele telefonului are 1–60 de caractere"));
    }
    let mut raw = [0u8; 32];
    getrandom::fill(&mut raw).map_err(|_| bad("nu s-a putut genera cheia"))?;
    let token: String = raw.iter().map(|b| format!("{b:02x}")).collect();
    let mut f = Fields::new();
    f.insert("nume".into(), json!(name));
    f.insert("token".into(), json!(hash(&token)));
    f.insert("stare".into(), json!("asteapta"));
    f.insert("membru_nume".into(), json!(""));
    f.insert("creat_ms".into(), json!(now_ms()));
    f.insert("vazut_ms".into(), json!(now_ms()));
    let id = Uuid::now_v7();
    ws.store_mut().write(vec![Write::put(PHONES_COLLECTION, id, f).expect(0)])?;
    Ok((id, token))
}

/// Approves a waiting phone as `member` (the person who will use it).
pub fn approve(ws: &mut Workspace, id: Uuid, member: &str) -> CoreResult<()> {
    let r = ws.store().get(PHONES_COLLECTION, id)?.ok_or_else(|| bad("nu există"))?;
    let member = member.trim();
    if member.is_empty() || member.chars().count() > 100 {
        return Err(bad("alege cine folosește telefonul"));
    }
    if r.fields.get("stare").and_then(Value::as_str) != Some("asteapta") {
        return Err(bad("nu mai așteaptă aprobare"));
    }
    let mut f = r.fields.clone();
    f.insert("stare".into(), json!("aprobat"));
    f.insert("membru_nume".into(), json!(member));
    ws.store_mut().write(vec![Write::put(PHONES_COLLECTION, id, f).expect(r.version)])?;
    Ok(())
}

pub fn revoke(ws: &mut Workspace, id: Uuid) -> CoreResult<()> {
    let r = ws.store().get(PHONES_COLLECTION, id)?.ok_or_else(|| bad("nu există"))?;
    let mut f = r.fields.clone();
    f.insert("stare".into(), json!("revocat"));
    ws.store_mut().write(vec![Write::put(PHONES_COLLECTION, id, f).expect(r.version)])?;
    Ok(())
}

/// The phone holding `token`, whatever its state (None for an unknown token).
pub fn by_token(ws: &Workspace, token: &str) -> CoreResult<Option<Phone>> {
    if token.len() != 64 {
        return Ok(None);
    }
    let h = json!(hash(token));
    Ok(ws.store().scan(PHONES_COLLECTION, |r| r.fields.get("token") == Some(&h))?.first().map(phone))
}

/// Marks a phone as seen now by this PC (at most once a minute; local).
pub fn seen(ws: &mut Workspace, id: Uuid) -> CoreResult<()> {
    let r = ws.store().get(SEEN_COLLECTION, id)?;
    let last = r.as_ref().and_then(|r| r.fields.get("vazut_ms")).and_then(Value::as_u64).unwrap_or(0);
    if now_ms().saturating_sub(last) < 60_000 {
        return Ok(());
    }
    let mut f = Fields::new();
    f.insert("vazut_ms".into(), json!(now_ms()));
    ws.store_mut().write(vec![Write::put(SEEN_COLLECTION, id, f).expect(r.map_or(0, |r| r.version))])?;
    Ok(())
}

/// Whether the phone page is switched on (for the whole organization).
pub fn service_on(ws: &Workspace) -> CoreResult<bool> {
    Ok(ws.store().get(SERVICE_COLLECTION, SERVICE_ID)?.is_some_and(|r| r.fields.get("pornit") == Some(&json!(true))))
}

/// Switches the phone page on or off on every PC (the caller checks that an
/// administrator asks; other PCs accept it only from an administrator).
pub fn set_service(ws: &mut Workspace, on: bool) -> CoreResult<()> {
    let r = ws.store().get(SERVICE_COLLECTION, SERVICE_ID)?;
    if r.as_ref().is_some_and(|r| r.fields.get("pornit") == Some(&json!(on))) {
        return Ok(());
    }
    let mut f = Fields::new();
    f.insert("pornit".into(), json!(on));
    f.insert("schimbat_ms".into(), json!(now_ms()));
    ws.store_mut().write(vec![Write::put(SERVICE_COLLECTION, SERVICE_ID, f).expect(r.map_or(0, |r| r.version))])?;
    Ok(())
}

/// A PC that serves the phone page, and where it answers.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Host {
    pub dispozitiv: String,
    pub nume: String,
    /// Full addresses of the page (`http://<ip>:<port>/m`).
    pub adrese: Vec<String>,
    pub pornit: bool,
    pub ts_ms: u64,
}

fn host_id(fingerprint: &str) -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_OID, format!("kgb-phone-host:{fingerprint}").as_bytes())
}

/// Checks a received host card against its author (used by replication):
/// a device writes only its own card.
pub fn host_written_by_itself(fields: &Fields, author_fingerprint: &str) -> bool {
    fields.get("dispozitiv").and_then(Value::as_str) == Some(author_fingerprint)
}

/// Publishes this PC's card; written only when something changed, so it
/// does not make a change every time the page is checked.
pub fn publish_host(ws: &mut Workspace, fingerprint: &str, name: &str, addresses: &[String], on: bool) -> CoreResult<bool> {
    let id = host_id(fingerprint);
    let r = ws.store().get(HOSTS_COLLECTION, id)?;
    let mut f = Fields::new();
    f.insert("dispozitiv".into(), json!(fingerprint));
    f.insert("nume".into(), json!(name.chars().take(60).collect::<String>()));
    f.insert("adrese".into(), json!(addresses.iter().take(4).collect::<Vec<_>>()));
    f.insert("pornit".into(), json!(on));
    if let Some(r) = &r {
        let same = ["dispozitiv", "nume", "adrese", "pornit"].iter().all(|k| r.fields.get(*k) == f.get(*k));
        if same {
            return Ok(false);
        }
    }
    f.insert("ts_ms".into(), json!(now_ms()));
    ws.store_mut().write(vec![Write::put(HOSTS_COLLECTION, id, f).expect(r.map_or(0, |r| r.version))])?;
    Ok(true)
}

/// The PCs that serve (or served) the phone page, this one first if listed.
pub fn hosts(ws: &Workspace, me: Option<&str>) -> CoreResult<Vec<Host>> {
    let mut v: Vec<Host> = ws
        .store()
        .scan(HOSTS_COLLECTION, |_| true)?
        .iter()
        .map(|r| {
            let s = |k: &str| r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
            Host {
                dispozitiv: s("dispozitiv"),
                nume: s("nume"),
                adrese: r.fields.get("adrese").and_then(Value::as_array).into_iter().flatten().filter_map(Value::as_str).map(String::from).collect(),
                pornit: r.fields.get("pornit") == Some(&json!(true)),
                ts_ms: r.fields.get("ts_ms").and_then(Value::as_u64).unwrap_or(0),
            }
        })
        .collect();
    v.sort_by_key(|h| (Some(h.dispozitiv.as_str()) != me, h.nume.clone()));
    Ok(v)
}

/// One file sent by a phone.
pub struct Upload {
    pub name: String,
    pub mime: String,
    pub data: Vec<u8>,
}

/// At most this many lines on a reception sheet (7.4m-5), each with its photo.
pub const MAX_LINES: usize = 40;

/// "1.234,5" or "1234.5" → thousandths (1 234 500); None if not a number ≥ 0.
pub fn qty_thousandths(t: &str) -> Option<i64> {
    let t = t.trim().replace(' ', "");
    if t.is_empty() {
        return None;
    }
    // Romanian style: a comma is the decimal mark and dots group thousands;
    // without a comma, dots followed by exactly three digits group thousands
    // too ("12.450" = 12450), any other dot is a decimal mark ("1234.5").
    let groups_only = !t.contains(',') && t.contains('.') && t.split('.').skip(1).all(|g| g.len() == 3);
    let norm = if t.contains(',') {
        t.replace('.', "").replace(',', ".")
    } else if groups_only {
        t.replace('.', "")
    } else {
        t
    };
    let (w, f) = norm.split_once('.').unwrap_or((&norm, ""));
    if w.is_empty() || !w.bytes().all(|b| b.is_ascii_digit()) || f.len() > 3 || !f.bytes().all(|b| b.is_ascii_digit()) || w.len() > 12 {
        return None;
    }
    let mut frac = f.to_string();
    while frac.len() < 3 {
        frac.push('0');
    }
    Some(w.parse::<i64>().ok()? * 1000 + frac.parse::<i64>().ok()?)
}

/// 1 234 500 → "1.234,5".
pub fn fmt_thousandths(v: i64) -> String {
    let w = v / 1000;
    let f = v % 1000;
    let ws = w.to_string();
    let mut grouped = String::new();
    for (i, c) in ws.chars().enumerate() {
        if i > 0 && (ws.len() - i).is_multiple_of(3) {
            grouped.push('.');
        }
        grouped.push(c);
    }
    if f == 0 {
        grouped
    } else {
        format!("{grouped},{}", format!("{f:03}").trim_end_matches('0'))
    }
}

/// What an approved phone sends: a kind, text fields, files.
pub fn submit(ws: &mut Workspace, from: &Phone, kind: &str, fields: serde_json::Map<String, Value>, uploads: Vec<Upload>) -> CoreResult<Uuid> {
    submit_with_lines(ws, from, kind, fields, Vec::new(), uploads)
}

/// Like [`submit`], with the lines of a reception sheet (7.4m-5): each
/// `{categorie, produs?, cantitate, um?, brut?, tara?, foto?}` where `foto` is
/// the index of its photo among `uploads`; with gross and tare the quantity
/// must be gross − tare.
pub fn submit_with_lines(ws: &mut Workspace, from: &Phone, kind: &str, fields: serde_json::Map<String, Value>, mut lines: Vec<Value>, uploads: Vec<Upload>) -> CoreResult<Uuid> {
    // The team leader's report: one line per worker (7.4m-7).
    let mut team_lines = Vec::new();
    if kind == "pontaj_echipa" {
        if lines.is_empty() || lines.len() > 200 {
            return Err(bad("raportul are 1–200 de muncitori"));
        }
        for (n, l) in lines.iter().enumerate() {
            let id = l["angajat"].as_str().filter(|x| Uuid::parse_str(x).is_ok()).ok_or_else(|| bad(format!("rândul {}: muncitorul nu e ales", n + 1)))?;
            let nume: String = l["nume"].as_str().unwrap_or_default().trim().chars().take(100).collect();
            let prezent = l["prezent"].as_bool().ok_or_else(|| bad(format!("rândul {}: prezent sau absent", n + 1)))?;
            let extra = l["extra"].as_i64().unwrap_or(0);
            if !(-12..=12).contains(&extra) {
                return Err(bad(format!("{nume}: orele extra sunt între −12 și +12")));
            }
            team_lines.push(json!({"angajat": id, "nume": nume, "prezent": prezent, "extra": if prezent { extra } else { 0 }}));
        }
        lines = Vec::new();
    }
    if from.stare != "aprobat" {
        return Err(bad("nu e aprobat pe PC"));
    }
    if !KINDS.iter().any(|(k, _)| *k == kind) {
        return Err(bad("tip necunoscut"));
    }
    let with_lines = kind == "receptie" || kind == "inventar";
    if !lines.is_empty() && !with_lines && kind != "pontaj_echipa" {
        return Err(bad("liniile sunt doar pentru fișa de recepție și pentru inventar"));
    }
    if kind == "inventar" && lines.is_empty() {
        return Err(bad("inventarul are nevoie de cel puțin o linie: produsul și cât s-a numărat"));
    }
    if lines.len() > MAX_LINES {
        return Err(bad(format!("cel mult {MAX_LINES} linii")));
    }
    if uploads.len() > MAX_FILES + lines.len() {
        return Err(bad(format!("cel mult {MAX_FILES} fișiere, plus câte o poză pe linie")));
    }
    // The lines, checked before anything is written.
    let mut clean_lines = Vec::with_capacity(lines.len());
    for (n, l) in lines.iter().enumerate() {
        let label = format!("linia {}", n + 1);
        let txt = |k: &str, max: usize| -> CoreResult<String> {
            let t = l[k].as_str().unwrap_or_default().trim().to_string();
            if t.chars().count() > max {
                return Err(bad(format!("{label}: „{k}” e prea lung")));
            }
            Ok(t)
        };
        let categorie = txt("categorie", 100)?;
        if categorie.is_empty() {
            return Err(bad(format!("{label}: scrie categoria sau produsul")));
        }
        let produs = txt("produs", 36)?;
        if kind == "inventar" && Uuid::parse_str(&produs).is_err() {
            return Err(bad(format!("{label}: alege produsul din lista din Business (inventarul se face pe produse)")));
        }
        let um = txt("um", 10)?;
        // Counted zero is a real count; a received quantity is positive.
        let min = if kind == "inventar" { 0 } else { 1 };
        let (brut, tara) = (txt("brut", 20)?, txt("tara", 20)?);
        let q = match (brut.is_empty(), tara.is_empty()) {
            (true, true) => qty_thousandths(&txt("cantitate", 20)?).filter(|q| *q >= min).ok_or_else(|| bad(format!("{label}: cantitatea nu e un număr {}", if min == 0 { "(0 sau mai mult)" } else { "pozitiv" })))?,
            (false, false) => {
                let b = qty_thousandths(&brut).ok_or_else(|| bad(format!("{label}: brutul nu e un număr")))?;
                let t = qty_thousandths(&tara).ok_or_else(|| bad(format!("{label}: tara nu e un număr")))?;
                if t >= b {
                    return Err(bad(format!("{label}: tara trebuie să fie mai mică decât brutul")));
                }
                b - t
            }
            _ => return Err(bad(format!("{label}: scrie și brutul, și tara (sau doar cantitatea)"))),
        };
        let foto = match &l["foto"] {
            Value::Number(x) => {
                let i = x.as_u64().filter(|i| (*i as usize) < uploads.len()).ok_or_else(|| bad(format!("{label}: poza nu există")))?;
                Some(i as usize)
            }
            _ => None,
        };
        clean_lines.push((categorie, produs, um, brut, tara, q, foto));
    }
    // Text fields: short strings only.
    let mut clean = serde_json::Map::new();
    for (k, v) in fields.into_iter().take(20) {
        let t = v.as_str().unwrap_or_default().trim().to_string();
        if k.len() > 40 || t.chars().count() > 1000 {
            return Err(bad("un câmp e prea lung"));
        }
        if !t.is_empty() {
            clean.insert(k, json!(t));
        }
    }
    if clean.is_empty() && uploads.is_empty() && clean_lines.is_empty() {
        return Err(bad("nimic de trimis"));
    }
    if kind == "extras" && uploads.is_empty() {
        return Err(bad("alege fișierul extrasului"));
    }
    if kind == "pontaj" {
        let field = |k: &str| clean.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
        if !["intrare", "iesire"].contains(&field("miscare").as_str()) {
            return Err(bad("pontajul e „intrare” sau „iesire”"));
        }
        if !clock(&field("ora")) {
            return Err(bad("ora pontajului e de forma HH:MM"));
        }
        if !iso_day(&field("data")) {
            return Err(bad("data pontajului e de forma AAAA-LL-ZZ"));
        }
        if !uploads.is_empty() {
            return Err(bad("pontajul nu are fișiere"));
        }
    }
    if kind == "livrare" {
        let field = |k: &str| clean.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
        if Uuid::parse_str(&field("livrare")).is_err() {
            return Err(bad("livrarea nu e aleasă"));
        }
        let Some((_, need, label)) = DRIVER_STAGES.iter().find(|(st, _, _)| *st == field("etapa")) else {
            return Err(bad("de pe telefon se trimite doar „în drum” sau „livrat”"));
        };
        if field(need).is_empty() || field(need).chars().count() > 200 {
            return Err(bad(format!("scrie {label}")));
        }
    }
    if kind == "pontaj_echipa" {
        let field = |k: &str| clean.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
        if Uuid::parse_str(&field("punct")).is_err() || !iso_day(&field("data")) {
            return Err(bad("raportul are nevoie de punctul de lucru și de data zilei"));
        }
    }
    if kind == "task" {
        let field = |k: &str| clean.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
        if Uuid::parse_str(&field("task")).is_err() || field("titlu").is_empty() {
            return Err(bad("taskul nu e ales"));
        }
    }
    if kind == "bon" {
        if !uploads.iter().any(|u| u.mime.starts_with("image/")) {
            return Err(bad("fotografiază bonul"));
        }
        let suma = clean.get("suma").and_then(Value::as_str).unwrap_or_default();
        if qty_thousandths(suma).is_none_or(|v| v <= 0) {
            return Err(bad("scrie suma de pe bon (de ex. 125,50)"));
        }
    }
    let mut files_out = Vec::new();
    for u in uploads {
        if u.data.is_empty() || u.data.len() > MAX_FILE_BYTES {
            return Err(bad(format!("„{}”: gol sau mai mare de 8 MB", u.name)));
        }
        let allowed = u.mime.starts_with("image/")
            || [
                "text/csv",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/pdf",
                "text/plain",
                "application/octet-stream",
            ]
            .contains(&u.mime.as_str());
        if !allowed {
            return Err(bad(format!("„{}”: tipul {} nu e acceptat", u.name, u.mime)));
        }
        let fr = files::put(ws, PHONE_MODULE, &u.name, &u.data)?;
        files_out.push(json!({"id": fr.id.to_string(), "nume": fr.name, "mime": u.mime, "octeti": u.data.len()}));
    }
    let lines_out: Vec<Value> = clean_lines
        .into_iter()
        .map(|(categorie, produs, um, brut, tara, q, foto)| {
            json!({
                "categorie": categorie, "produs": if produs.is_empty() { Value::Null } else { json!(produs) },
                "um": if um.is_empty() { json!("buc") } else { json!(um) },
                "cantitate": q, "cantitate_text": fmt_thousandths(q),
                "brut": if brut.is_empty() { Value::Null } else { json!(brut) },
                "tara": if tara.is_empty() { Value::Null } else { json!(tara) },
                "foto": foto.and_then(|i| files_out.get(i)).map(|f| f["id"].clone()).unwrap_or(Value::Null),
            })
        })
        .collect();
    let mut f = Fields::new();
    f.insert("tip".into(), json!(kind));
    f.insert("linii".into(), if kind == "pontaj_echipa" { json!(team_lines) } else { json!(lines_out) });
    f.insert("telefon".into(), json!(from.id.to_string()));
    f.insert("telefon_nume".into(), json!(from.nume));
    f.insert("membru_nume".into(), json!(from.membru_nume));
    f.insert("campuri".into(), Value::Object(clean));
    f.insert("fisiere".into(), json!(files_out));
    f.insert("procesat".into(), json!(false));
    f.insert("creat_ms".into(), json!(now_ms()));
    let id = Uuid::now_v7();
    ws.store_mut().write(vec![Write::put(INBOX_COLLECTION, id, f).expect(0)])?;
    Ok(id)
}

/// The inbox, newest first.
pub fn inbox(ws: &Workspace) -> CoreResult<Vec<Value>> {
    let mut v = ws.store().scan(INBOX_COLLECTION, |_| true)?;
    v.sort_by_key(|r| std::cmp::Reverse(r.id));
    Ok(v.iter()
        .map(|r| {
            let mut o = Value::Object(r.fields.clone());
            o["id"] = json!(r.id);
            o["version"] = json!(r.version);
            o
        })
        .collect())
}

pub fn mark_done(ws: &mut Workspace, id: Uuid, done: bool) -> CoreResult<()> {
    let r = ws.store().get(INBOX_COLLECTION, id)?.ok_or_else(|| bad("nu există"))?;
    let mut f = r.fields.clone();
    f.insert("procesat".into(), json!(done));
    ws.store_mut().write(vec![Write::put(INBOX_COLLECTION, id, f).expect(r.version)])?;
    Ok(())
}

/// A file of the inbox (name, bytes).
pub fn file(ws: &Workspace, id: Uuid) -> CoreResult<(String, Vec<u8>)> {
    let (fr, data) = files::get(ws, PHONE_MODULE, id)?;
    Ok((fr.name, data))
}
