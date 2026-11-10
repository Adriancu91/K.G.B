//! Reminders of the Notes window (7.4l-2b-rem): a note with `remind` (ISO date and time) and maybe `repeat`
//! (`zilnic`, `saptamanal`, `lunar`, `anual`) is announced through the app's notifications at that moment,
//! with the same rule as Cyber Office Studio: repetitions keep the wall-clock time of the first one in local
//! time (a daily 09:00 stays 09:00 after the clocks change), and a monthly reminder set on the 31st falls on
//! the last day of a shorter month.
//!
//! The app calls [`send_due`] about once a minute while it runs. The latest moment that has come is
//! announced if it came at most [`GRACE_MS`] ago; the key `<note id>@<moment>` makes sure every moment is
//! announced once, also after a restart or from the other PC of the same workspace. Like in COS, a moment
//! that passed while the app was closed is not announced later. Notes in the trash are not announced.

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use kgb_core::notifications::{Level, Notice};
use serde_json::Value;

use crate::notebook::PAGES;

/// How late a moment may still be announced (the app ticks about once a minute; a sleeping PC wakes late).
pub const GRACE_MS: i64 = 10 * 60 * 1000;
/// At most this many reminders per round (a notebook of old daily reminders does not flood the centre).
const ROUND_MAX: usize = 20;

/// A local date and time.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Wall {
    pub y: i64,
    /// 1–12
    pub mo: u32,
    pub d: u32,
    pub h: u32,
    pub mi: u32,
    pub s: u32,
    pub ms: u32,
}

/// The clock's time zone: UTC instant ↔ local wall-clock time.
pub trait Zone {
    fn local(&self, utc_ms: i64) -> Wall;
    fn utc(&self, w: Wall) -> i64;
}

/// A fixed offset from UTC, in minutes (tests; and the fallback away from Windows).
pub struct Fixed(pub i64);

impl Zone for Fixed {
    fn local(&self, utc_ms: i64) -> Wall {
        naive_wall(utc_ms + self.0 * 60_000)
    }
    fn utc(&self, w: Wall) -> i64 {
        naive_ms(w) - self.0 * 60_000
    }
}

/// The time zone of this PC, with its summer time (Windows' own rules, as the window's clock uses).
pub struct System;

#[cfg(windows)]
mod win {
    use super::{Wall, naive_ms, naive_wall};
    use windows_sys::Win32::Foundation::SYSTEMTIME;
    use windows_sys::Win32::System::Time::{SystemTimeToTzSpecificLocalTime, TzSpecificLocalTimeToSystemTime};

    fn st(w: Wall) -> SYSTEMTIME {
        SYSTEMTIME {
            wYear: w.y.clamp(1601, 30827) as u16,
            wMonth: w.mo as u16,
            wDayOfWeek: 0,
            wDay: w.d as u16,
            wHour: w.h as u16,
            wMinute: w.mi as u16,
            wSecond: w.s as u16,
            wMilliseconds: w.ms as u16,
        }
    }
    fn wall(s: &SYSTEMTIME) -> Wall {
        Wall {
            y: s.wYear as i64,
            mo: s.wMonth as u32,
            d: s.wDay as u32,
            h: s.wHour as u32,
            mi: s.wMinute as u32,
            s: s.wSecond as u32,
            ms: s.wMilliseconds as u32,
        }
    }
    pub fn local(utc_ms: i64) -> Option<Wall> {
        let u = st(naive_wall(utc_ms));
        let mut l = st(naive_wall(0));
        // SAFETY: both pointers are to live SYSTEMTIME values; a null zone means this PC's zone.
        let ok = unsafe { SystemTimeToTzSpecificLocalTime(std::ptr::null(), &u, &mut l) };
        (ok != 0).then(|| wall(&l))
    }
    pub fn utc(w: Wall) -> Option<i64> {
        let l = st(w);
        let mut u = st(naive_wall(0));
        // SAFETY: as above.
        let ok = unsafe { TzSpecificLocalTimeToSystemTime(std::ptr::null(), &l, &mut u) };
        (ok != 0).then(|| naive_ms(wall(&u)))
    }
}

impl Zone for System {
    #[cfg(windows)]
    fn local(&self, utc_ms: i64) -> Wall {
        win::local(utc_ms).unwrap_or_else(|| naive_wall(utc_ms))
    }
    #[cfg(windows)]
    fn utc(&self, w: Wall) -> i64 {
        win::utc(w).unwrap_or_else(|| naive_ms(w))
    }
    #[cfg(not(windows))]
    fn local(&self, utc_ms: i64) -> Wall {
        Fixed(0).local(utc_ms)
    }
    #[cfg(not(windows))]
    fn utc(&self, w: Wall) -> i64 {
        Fixed(0).utc(w)
    }
}

/// Days since 1970-01-01 of a civil date (H. Hinnant's method).
fn days_from_civil(y: i64, mo: u32, d: u32) -> i64 {
    let (y, m) = if mo <= 2 {
        (y - 1, mo as i64 + 9)
    } else {
        (y, mo as i64 - 3)
    };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let doy = (153 * m + 2) / 5 + d as i64 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// The civil date of a day count since 1970-01-01.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let mo = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (yoe + era * 400 + i64::from(mo <= 2), mo, d)
}

fn naive_ms(w: Wall) -> i64 {
    let days = days_from_civil(w.y, w.mo, w.d);
    (((days * 24 + w.h as i64) * 60 + w.mi as i64) * 60 + w.s as i64) * 1000 + w.ms as i64
}

fn naive_wall(ms: i64) -> Wall {
    let days = ms.div_euclid(86_400_000);
    let rest = ms.rem_euclid(86_400_000);
    let (y, mo, d) = civil_from_days(days);
    Wall {
        y,
        mo,
        d,
        h: (rest / 3_600_000) as u32,
        mi: (rest / 60_000 % 60) as u32,
        s: (rest / 1000 % 60) as u32,
        ms: (rest % 1000) as u32,
    }
}

fn days_in_month(y: i64, mo: u32) -> u32 {
    let (ny, nm) = if mo == 12 { (y + 1, 1) } else { (y, mo + 1) };
    (days_from_civil(ny, nm, 1) - days_from_civil(y, mo, 1)) as u32
}

/// `2026-11-10T09:00:00.000Z` (or with `+02:00`) → milliseconds since 1970; `None` if it cannot be read.
pub fn parse_iso(s: &str) -> Option<i64> {
    let s = s.trim();
    let num = |a: usize, n: usize| -> Option<i64> {
        let t = s.get(a..a + n)?;
        t.bytes().all(|c| c.is_ascii_digit()).then(|| t.parse().ok())?
    };
    let b = s.as_bytes();
    if b.len() < 16 || b[4] != b'-' || b[7] != b'-' || b[10] != b'T' || b[13] != b':' {
        return None;
    }
    let (y, mo, d, h, mi) = (num(0, 4)?, num(5, 2)?, num(8, 2)?, num(11, 2)?, num(14, 2)?);
    let mut i = 16;
    let mut sec = 0;
    let mut ms = 0;
    if b.get(i) == Some(&b':') {
        sec = num(17, 2)?;
        i = 19;
        if b.get(i) == Some(&b'.') {
            let digits = s[i + 1..].bytes().take_while(u8::is_ascii_digit).count();
            if digits == 0 {
                return None;
            }
            let frac: String = s[i + 1..i + 1 + digits].chars().chain("000".chars()).take(3).collect();
            ms = frac.parse().ok()?;
            i += 1 + digits;
        }
    }
    let offset_min = match &s[i..] {
        "Z" | "z" => 0,
        o if o.len() == 6 && (o.starts_with('+') || o.starts_with('-')) && &o[3..4] == ":" => {
            let v = num(i + 1, 2)? * 60 + num(i + 4, 2)?;
            if o.starts_with('-') { -v } else { v }
        }
        _ => return None,
    };
    if !(1..=12).contains(&mo) || d < 1 || d > days_in_month(y, mo as u32) as i64 || h > 23 || mi > 59 || sec > 59 {
        return None;
    }
    let w = Wall {
        y,
        mo: mo as u32,
        d: d as u32,
        h: h as u32,
        mi: mi as u32,
        s: sec as u32,
        ms: ms as u32,
    };
    Some(naive_ms(w) - offset_min * 60_000)
}

/// Milliseconds since 1970 → `2026-11-10T09:00:00.000Z`, as the window writes `remind`.
pub fn to_iso(ms: i64) -> String {
    let w = naive_wall(ms);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        w.y, w.mo, w.d, w.h, w.mi, w.s, w.ms
    )
}

/// The step of a repeat, in days (only for the first estimate, as in COS).
fn step_days(repeat: &str) -> Option<i64> {
    match repeat {
        "zilnic" => Some(1),
        "saptamanal" => Some(7),
        "lunar" => Some(31),
        "anual" => Some(366),
        _ => None,
    }
}

/// The k-th repetition (k = 0 is the chosen moment).
pub fn occurrence(first: i64, repeat: &str, k: i64, z: &dyn Zone) -> i64 {
    let a = z.local(first);
    match repeat {
        "zilnic" | "saptamanal" => {
            let step = if repeat == "zilnic" { 1 } else { 7 };
            let (y, mo, d) = civil_from_days(days_from_civil(a.y, a.mo, a.d) + k * step);
            z.utc(Wall { y, mo, d, ..a })
        }
        _ => {
            let months = (a.mo as i64 - 1) + k * if repeat == "lunar" { 1 } else { 12 };
            let y = a.y + months.div_euclid(12);
            let mo = months.rem_euclid(12) as u32 + 1;
            let d = a.d.min(days_in_month(y, mo));
            z.utc(Wall { y, mo, d, ms: 0, ..a })
        }
    }
}

/// The latest moment that has come (or `None`) and the next one, for a note's `remind` and `repeat`.
pub fn remind_times(remind: &str, repeat: Option<&str>, now: i64, z: &dyn Zone) -> (Option<i64>, Option<i64>) {
    let Some(first) = parse_iso(remind) else {
        return (None, None);
    };
    let Some(step) = repeat.and_then(step_days) else {
        return if first > now {
            (None, Some(first))
        } else {
            (Some(first), None)
        };
    };
    let repeat = repeat.unwrap_or_default();
    if first > now {
        return (None, Some(first));
    }
    let mut k = ((now - first) / 86_400_000 / step - 2).max(0);
    while occurrence(first, repeat, k + 1, z) <= now {
        k += 1;
    }
    (
        Some(occurrence(first, repeat, k, z)),
        Some(occurrence(first, repeat, k + 1, z)),
    )
}

/// The note's title as the reminder shows it (as in COS: the title, else the first line of the text).
fn shown_title(note: &Value) -> String {
    let title = note.get("title").and_then(Value::as_str).unwrap_or_default().trim();
    if !title.is_empty() {
        return title.to_string();
    }
    let body = note.get("body").and_then(Value::as_str).unwrap_or_default().trim();
    let first: String = body.lines().next().unwrap_or_default().chars().take(80).collect();
    if first.is_empty() {
        "Notiță".to_string()
    } else {
        first
    }
}

/// Announces the reminders due at `now`; returns how many were new.
pub fn send_due(ctx: &mut ModuleContext<'_>, now: i64, z: &dyn Zone) -> CoreResult<usize> {
    let pages = ctx.scan(PAGES, |r| {
        !r.deleted
            && r.fields.get("trashed").and_then(Value::as_bool) != Some(true)
            && r.fields
                .get("note")
                .and_then(|n| n.get("remind"))
                .and_then(Value::as_str)
                .is_some()
    })?;
    let mut due: Vec<(i64, String, &Value)> = Vec::new();
    for p in &pages {
        let note = &p.fields["note"];
        let remind = note["remind"].as_str().unwrap_or_default();
        let repeat = note.get("repeat").and_then(Value::as_str);
        let (Some(last), _) = remind_times(remind, repeat, now, z) else {
            continue;
        };
        if now - last > GRACE_MS {
            continue;
        }
        let id = note.get("id").and_then(Value::as_str).unwrap_or_default();
        due.push((last, format!("{id}@{last}"), note));
    }
    due.sort_by_key(|d| d.0);
    let mut sent = 0;
    for (_, key, note) in due.into_iter().take(ROUND_MAX) {
        if ctx.notify_key_used(&key)? {
            continue;
        }
        let body: String = note
            .get("body")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .chars()
            .take(200)
            .collect();
        let notice = Notice::new(format!("Memento: {}", shown_title(note)), body)
            .level(Level::Atentie)
            .key(key);
        if ctx.notify(&notice)?.1 {
            sent += 1;
        }
    }
    Ok(sent)
}

#[cfg(test)]
mod tests {
    use super::*;

    const RO_WINTER: Fixed = Fixed(120);

    fn at(s: &str) -> i64 {
        parse_iso(s).unwrap()
    }

    #[test]
    fn dates_round_trip() {
        for ms in [
            0,
            1_762_765_200_000,
            at("2028-02-29T23:59:59.999Z"),
            at("1999-12-31T00:00:00Z"),
        ] {
            assert_eq!(naive_ms(naive_wall(ms)), ms);
        }
        assert_eq!(at("2026-11-10T09:00:00.000Z"), at("2026-11-10T11:00:00+02:00"));
        assert_eq!(at("2026-11-10T09:00Z"), at("2026-11-10T09:00:00.000Z"));
        for bad in [
            "",
            "azi",
            "2026-13-01T00:00:00Z",
            "2026-02-30T00:00:00Z",
            "2026-11-10T09:00:00",
            "2026-11-10T09:00:00.Z",
        ] {
            assert_eq!(parse_iso(bad), None, "{bad}");
        }
    }

    #[test]
    fn repetitions_as_in_the_window() {
        let z = &RO_WINTER;
        let first = at("2026-01-31T08:00:00.000Z"); // 31 ianuarie, 10:00 la București
        assert_eq!(occurrence(first, "lunar", 1, z), at("2026-02-28T08:00:00.000Z"));
        assert_eq!(occurrence(first, "lunar", 2, z), at("2026-03-31T08:00:00.000Z"));
        assert_eq!(occurrence(first, "anual", 2, z), at("2028-01-31T08:00:00.000Z"));
        assert_eq!(occurrence(first, "saptamanal", 1, z), at("2026-02-07T08:00:00.000Z"));
        // A daily reminder, ten days later: the last and the next moment around "now".
        let now = at("2026-02-10T09:00:00.000Z");
        assert_eq!(
            remind_times("2026-01-31T08:00:00.000Z", Some("zilnic"), now, z),
            (
                Some(at("2026-02-10T08:00:00.000Z")),
                Some(at("2026-02-11T08:00:00.000Z"))
            )
        );
        // Once only: before and after the moment.
        assert_eq!(
            remind_times("2026-02-10T08:00:00.000Z", None, now, z),
            (Some(at("2026-02-10T08:00:00.000Z")), None)
        );
        assert_eq!(
            remind_times("2026-02-11T08:00:00.000Z", None, now, z),
            (None, Some(at("2026-02-11T08:00:00.000Z")))
        );
        assert_eq!(remind_times("ieri", None, now, z), (None, None));
        // An unknown repeat counts as once only, as in the window.
        assert_eq!(remind_times("2026-02-10T08:00:00.000Z", Some("orar"), now, z).1, None);
    }

    /// A zone with summer time from 29 March: the daily 09:00 stays 09:00 on the wall clock.
    struct Summer;
    impl Zone for Summer {
        fn local(&self, utc_ms: i64) -> Wall {
            let off = if utc_ms >= at("2026-03-29T01:00:00Z") { 180 } else { 120 };
            Fixed(off).local(utc_ms)
        }
        fn utc(&self, w: Wall) -> i64 {
            let winter = Fixed(120).utc(w);
            if winter >= at("2026-03-29T01:00:00Z") {
                Fixed(180).utc(w)
            } else {
                winter
            }
        }
    }

    #[test]
    fn the_clock_change_keeps_the_wall_time() {
        let first = at("2026-03-27T07:00:00.000Z"); // 09:00 iarna
        assert_eq!(occurrence(first, "zilnic", 3, &Summer), at("2026-03-30T06:00:00.000Z")); // 09:00 vara
    }

    #[cfg(windows)]
    #[test]
    fn this_pcs_zone_round_trips() {
        let z = System;
        for s in [
            "2026-01-15T10:00:00.000Z",
            "2026-07-15T10:00:00.000Z",
            "2026-11-10T07:13:00.000Z",
        ] {
            let ms = at(s);
            assert_eq!(z.utc(z.local(ms)), ms, "{s}");
        }
    }
}
