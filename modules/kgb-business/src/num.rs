//! Exact numbers for business records (D-049): money in bani (1 leu = 100
//! bani) and quantities in thousandths, both as integers. No floating point
//! anywhere in a calculation; every rounding is written here and tested.

/// Thousandths of a unit (3 decimals): 1,5 kg = 1500.
pub type Qty = i64;
/// Bani: 12,34 lei = 1234.
pub type Money = i64;

pub const QTY_SCALE: i64 = 1000;
pub const MONEY_SCALE: i64 = 100;
/// Large enough for any real company, small enough that products never overflow.
pub const MAX_QTY: Qty = 1_000_000_000 * QTY_SCALE;
pub const MAX_MONEY: Money = 1_000_000_000_000 * MONEY_SCALE;

/// A decimal number as typed in Romania or in the standard form, with at most
/// `decimals` decimals: `1.234,5`, `1234.5`, `1500` (and `1.500` = 1500).
fn parse_fixed(s: &str, decimals: u32) -> Option<i64> {
    let t: String = s.trim().chars().filter(|c| !c.is_whitespace()).collect();
    if t.is_empty() {
        return None;
    }
    let (neg, t) = match t.strip_prefix('-') {
        Some(r) => (true, r.to_string()),
        None => (false, t),
    };
    let thousands = |x: &str| {
        let mut g = x.split('.');
        x.contains('.') && g.next().is_some_and(|h| (1..=3).contains(&h.len())) && g.all(|p| p.len() == 3)
    };
    let normal = if t.contains(',') {
        t.replace('.', "").replace(',', ".")
    } else if thousands(&t) {
        t.replace('.', "")
    } else {
        t
    };
    let (int, frac) = match normal.split_once('.') {
        Some((i, f)) => (i.to_string(), f.to_string()),
        None => (normal, String::new()),
    };
    if int.is_empty() && frac.is_empty()
        || !int.chars().all(|c| c.is_ascii_digit())
        || !frac.chars().all(|c| c.is_ascii_digit())
        || frac.len() > decimals as usize
        || int.len() > 15
    {
        return None;
    }
    let scale = 10_i64.pow(decimals);
    let i: i64 = if int.is_empty() { 0 } else { int.parse().ok()? };
    let mut f = frac.clone();
    while f.len() < decimals as usize {
        f.push('0');
    }
    let f: i64 = if f.is_empty() { 0 } else { f.parse().ok()? };
    let v = i.checked_mul(scale)?.checked_add(f)?;
    Some(if neg { -v } else { v })
}

pub fn qty(s: &str) -> Option<Qty> {
    parse_fixed(s, 3).filter(|q| q.abs() <= MAX_QTY)
}

pub fn money(s: &str) -> Option<Money> {
    parse_fixed(s, 2).filter(|m| m.abs() <= MAX_MONEY)
}

fn fmt_fixed(v: i64, decimals: u32, min_decimals: u32) -> String {
    let scale = 10_i64.pow(decimals) as u64;
    let neg = v < 0;
    let a = v.unsigned_abs();
    let (int, frac) = (a / scale, a % scale);
    let digits = int.to_string();
    let mut grouped = String::new();
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            grouped.push('.');
        }
        grouped.push(ch);
    }
    let mut f = format!("{frac:0width$}", width = decimals as usize);
    while f.len() > min_decimals as usize && f.ends_with('0') {
        f.pop();
    }
    let sign = if neg { "-" } else { "" };
    if f.is_empty() {
        format!("{sign}{grouped}")
    } else {
        format!("{sign}{grouped},{f}")
    }
}

/// Romanian display: `1.234,5`.
pub fn fmt_qty(q: Qty) -> String {
    fmt_fixed(q, 3, 0)
}

/// Romanian display with 2 decimals: `1.234,50`.
pub fn fmt_money(m: Money) -> String {
    fmt_fixed(m, 2, 2)
}

/// Rounds a/b to the nearest integer, halves away from zero (the usual
/// commercial rounding). `b` is positive.
pub fn div_round(a: i128, b: i128) -> i128 {
    debug_assert!(b > 0);
    let q = a / b;
    let r = a % b;
    if 2 * r.abs() >= b { q + a.signum() } else { q }
}

/// Value of a quantity at a unit price: qty (thousandths) × price (bani per
/// unit) → bani, rounded to the ban.
pub fn value(q: Qty, unit_price: Money) -> Money {
    div_round(q as i128 * unit_price as i128, QTY_SCALE as i128) as Money
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_and_format() {
        assert_eq!(qty("1,5"), Some(1500));
        assert_eq!(qty("1.5"), Some(1500));
        assert_eq!(qty("1.500"), Some(1_500_000), "thousands");
        assert_eq!(qty("1.234,567"), Some(1_234_567));
        assert_eq!(qty("0,0001"), None, "more than 3 decimals");
        assert_eq!(qty("abc"), None);
        assert_eq!(qty(""), None);
        assert_eq!(qty("-2"), Some(-2000));
        assert_eq!(money("12,34"), Some(1234));
        assert_eq!(money("1.673,14"), Some(167_314));
        assert_eq!(money("12,345"), None);
        assert_eq!(fmt_qty(1_234_500), "1.234,5");
        assert_eq!(fmt_qty(2000), "2");
        assert_eq!(fmt_money(167_314), "1.673,14");
        assert_eq!(fmt_money(-5), "-0,05");
        assert_eq!(fmt_money(100_000_000), "1.000.000,00");
    }

    #[test]
    fn rounding_is_commercial() {
        assert_eq!(div_round(5, 10), 1);
        assert_eq!(div_round(4, 10), 0);
        assert_eq!(div_round(-5, 10), -1);
        assert_eq!(div_round(15, 10), 2);
        // 1,5 kg × 3,33 lei = 4,995 → 5,00 lei
        assert_eq!(value(1500, 333), 500);
        // 0,333 buc × 10,00 lei = 3,33 lei
        assert_eq!(value(333, 1000), 333);
    }
}
