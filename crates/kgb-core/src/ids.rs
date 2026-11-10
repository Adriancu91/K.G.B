//! The Romanian codes (7.4m-2): CUI / CIF, IBAN and CNP, checked in one place for the whole app, with the same
//! rules as the spreadsheet window's =VALIDCUI / =VALIDIBAN / =VALIDCNP (cos/src/sheets/ids.ts, D-078). The
//! shared list `tests/data/ids.json` is checked by both (crates/kgb-core/tests/ids.rs and
//! app/cos/tests/kgb-ids-parity.test.mjs), so the two cannot drift apart.
//!
//! Only the check digits and the shape are checked, not whether the firm, the account or the person exists.
//! A CNP is personal data: these functions only say yes / no and never log it.

/// The code without whitespace (anywhere), upper-case.
pub fn compact(code: &str) -> String {
    code.chars().filter(|c| !c.is_whitespace()).collect::<String>().to_uppercase()
}

/// CUI / CIF: 2–10 digits, with or without `RO` in front (and spaces anywhere), the last one the check digit
/// (key 753217532).
pub fn cui_valid(code: &str) -> bool {
    let s = compact(code);
    let s = s.strip_prefix("RO").unwrap_or(&s);
    if !(2..=10).contains(&s.len()) || !s.bytes().all(|b| b.is_ascii_digit()) {
        return false;
    }
    let d: Vec<u32> = s.bytes().map(|b| u32::from(b - b'0')).collect();
    let (body, control) = d.split_at(d.len() - 1);
    let key = [7, 5, 3, 2, 1, 7, 5, 3, 2];
    let pad = 9 - body.len();
    let sum: u32 = body.iter().enumerate().map(|(i, v)| v * key[pad + i]).sum();
    let c = (sum * 10) % 11;
    (if c == 10 { 0 } else { c }) == control[0]
}

/// The CUI as it is stored: without spaces, upper-case (`RO` kept if it was written).
pub fn cui_clean(code: &str) -> String {
    compact(code)
}

/// IBAN: two letters, two check digits, 11–30 letters or digits (24 characters in all for RO), and the
/// standard mod-97 check; spaces do not matter.
pub fn iban_valid(code: &str) -> bool {
    let s = compact(code);
    let b = s.as_bytes();
    if !(15..=34).contains(&b.len())
        || !b[..2].iter().all(u8::is_ascii_uppercase)
        || !b[2..4].iter().all(u8::is_ascii_digit)
        || !b[4..].iter().all(|c| c.is_ascii_digit() || c.is_ascii_uppercase())
    {
        return false;
    }
    if s.starts_with("RO") && b.len() != 24 {
        return false;
    }
    let mut rest: u32 = 0;
    for &c in b[4..].iter().chain(&b[..4]) {
        let v = if c.is_ascii_digit() { u32::from(c - b'0') } else { u32::from(c - b'A') + 10 };
        rest = if v >= 10 { (rest * 100 + v) % 97 } else { (rest * 10 + v) % 97 };
    }
    rest == 1
}

fn leap(y: u32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

/// CNP: 13 digits, the first 1–9, a possible month and day (for 1–6 the century is known, so 29 February
/// only in leap years; for foreigners, 7–9, the day is at most 31), a known county (01–48, 51, 52, 70) and
/// the check digit (key 279146358279).
pub fn cnp_valid(code: &str) -> bool {
    let s = compact(code);
    let b = s.as_bytes();
    if b.len() != 13 || !b.iter().all(u8::is_ascii_digit) || b[0] == b'0' {
        return false;
    }
    let n = |i: usize| u32::from(b[i] - b'0');
    let two = |i: usize| n(i) * 10 + n(i + 1);
    let (month, day, county) = (two(3), two(5), two(7));
    if !(1..=12).contains(&month) || day < 1 {
        return false;
    }
    let century = match n(0) {
        1 | 2 => Some(1900),
        3 | 4 => Some(1800),
        5 | 6 => Some(2000),
        _ => None,
    };
    let days_in = match century {
        Some(c) => match month {
            4 | 6 | 9 | 11 => 30,
            2 if leap(c + two(1)) => 29,
            2 => 28,
            _ => 31,
        },
        None => 31,
    };
    if day > days_in {
        return false;
    }
    if !((1..=48).contains(&county) || county == 51 || county == 52 || county == 70) {
        return false;
    }
    let key = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
    let sum: u32 = (0..12).map(|i| n(i) * key[i]).sum();
    let ctrl = if sum % 11 == 10 { 1 } else { sum % 11 };
    ctrl == n(12)
}
