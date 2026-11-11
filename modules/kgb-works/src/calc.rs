//! The arithmetic of a payment statement, pure: quantities in thousandths, prices in bani; the values of the lines
//! keep their precision (f64 bani) and the totals are rounded to the ban once, at the end.

/// One item of the estimate, as a statement sees it.
#[derive(Clone, Debug, PartialEq)]
pub struct ItemCalc {
    /// The estimate's quantity with the supplements (thousandths).
    pub deviz: i64,
    /// Executed in the issued statements before this one (thousandths).
    pub anterior: i64,
    /// Executed in this statement (thousandths).
    pub curent: i64,
    pub cumulat: i64,
    pub rest: i64,
    /// Values without VAT, in bani, not rounded.
    pub valoare_curent: f64,
    pub valoare_cumulat: f64,
}

/// One item: `price` in bani per unit, quantities in thousandths.
pub fn item(deviz: i64, anterior: i64, curent: i64, price: i64) -> ItemCalc {
    let cumulat = anterior + curent;
    ItemCalc {
        deviz,
        anterior,
        curent,
        cumulat,
        rest: deviz - cumulat,
        valoare_curent: curent as f64 * price as f64 / 1000.0,
        valoare_cumulat: cumulat as f64 * price as f64 / 1000.0,
    }
}

/// The totals of a statement, in bani.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Totals {
    pub valoare: i64,
    pub tva: i64,
    pub retinere: i64,
    pub de_plata: i64,
}

/// The totals of the lines' values (not rounded): VAT `vat` percent, retention `retention` percent × 100, on the
/// value without VAT or with it.
pub fn totals(values: &[f64], vat: i64, retention: i64, with_vat: bool) -> Totals {
    let v: f64 = values.iter().sum();
    let tva = v * vat as f64 / 100.0;
    let base = if with_vat { v + tva } else { v };
    let r = base * retention as f64 / 10_000.0;
    let (valoare, tva, retinere) = (v.round() as i64, tva.round() as i64, r.round() as i64);
    Totals {
        valoare,
        tva,
        retinere,
        de_plata: valoare + tva - retinere,
    }
}

/// A number as written in a table: „1.234,56”, „1234.56”, „1 234,5”, „12” → with `decimals` decimals (as an integer).
pub fn parse_number(t: &str, decimals: u32) -> Option<i64> {
    let s: String = t
        .trim()
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '\u{a0}')
        .collect();
    if s.is_empty() {
        return None;
    }
    let (neg, s) = match s.strip_prefix('-') {
        Some(r) => (true, r.to_string()),
        None => (false, s),
    };
    // A comma is the decimal mark (and the dots thousands); without a comma, „1.234.567” is thousands, „12.5” decimals.
    let norm = if s.contains(',') {
        s.replace('.', "").replace(',', ".")
    } else if s.matches('.').count() > 1 || s.split('.').nth(1).is_some_and(|d| d.len() == 3 && s.len() > 4) {
        s.replace('.', "")
    } else {
        s
    };
    let (int, frac) = norm.split_once('.').unwrap_or((&norm, ""));
    if int.is_empty() && frac.is_empty()
        || !int.chars().all(|c| c.is_ascii_digit())
        || !frac.chars().all(|c| c.is_ascii_digit())
    {
        return None;
    }
    if frac.len() > decimals as usize {
        return None;
    }
    let scale = 10_i64.pow(decimals);
    let i: i64 = if int.is_empty() { 0 } else { int.parse().ok()? };
    let f: i64 = if frac.is_empty() {
        0
    } else {
        format!("{frac:0<width$}", width = decimals as usize).parse().ok()?
    };
    let v = i.checked_mul(scale)?.checked_add(f)?;
    Some(if neg { -v } else { v })
}

/// A row pasted from a spreadsheet: code, name, unit, quantity, unit price.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PastedRow {
    pub cod: String,
    pub denumire: String,
    pub um: String,
    /// Thousandths.
    pub cantitate: i64,
    /// Bani.
    pub pret_unitar: i64,
}

/// Rows pasted from a spreadsheet (tab, or „;”), with the refused ones and why (line numbers from 1). A header row
/// whose quantity and price are not numbers is skipped without being called refused when it is the first one.
pub fn parse_rows(text: &str) -> (Vec<PastedRow>, Vec<(usize, String)>) {
    let mut ok = Vec::new();
    let mut bad = Vec::new();
    for (n, line) in text.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let cells: Vec<&str> = if line.contains('\t') {
            line.split('\t').collect()
        } else {
            line.split(';').collect()
        };
        let cells: Vec<&str> = cells.into_iter().map(str::trim).collect();
        if cells.len() < 5 {
            bad.push((
                n + 1,
                "are mai puțin de 5 coloane (cod, denumire, UM, cantitate, preț)".to_string(),
            ));
            continue;
        }
        let (q, p) = (parse_number(cells[3], 3), parse_number(cells[4], 2));
        if n == 0 && q.is_none() && p.is_none() {
            continue;
        }
        let denumire = cells[1].chars().take(300).collect::<String>();
        let reason = if denumire.is_empty() {
            Some("fără denumire".to_string())
        } else if q.is_none_or(|q| q <= 0) {
            Some(format!(
                "cantitatea „{}” nu e un număr pozitiv (cel mult 3 zecimale)",
                cells[3]
            ))
        } else if p.is_none_or(|p| p < 0) {
            Some(format!("prețul „{}” nu e un număr (cel mult 2 zecimale)", cells[4]))
        } else {
            None
        };
        match reason {
            Some(r) => bad.push((n + 1, r)),
            None => ok.push(PastedRow {
                cod: cells[0].chars().take(40).collect(),
                denumire,
                um: cells[2].chars().take(20).collect(),
                cantitate: q.unwrap_or_default(),
                pret_unitar: p.unwrap_or_default(),
            }),
        }
    }
    (ok, bad)
}

/// Bani → „1.234,56”.
pub fn lei(b: i64) -> String {
    let neg = b < 0;
    let a = b.unsigned_abs();
    let int = (a / 100).to_string();
    let mut g = String::new();
    for (i, ch) in int.chars().enumerate() {
        if i > 0 && (int.len() - i).is_multiple_of(3) {
            g.push('.');
        }
        g.push(ch);
    }
    format!("{}{g},{:02}", if neg { "-" } else { "" }, a % 100)
}

/// Thousandths → „1.500,5” (the decimals that are not zero, at most 3).
pub fn qty(q: i64) -> String {
    let neg = q < 0;
    let a = q.unsigned_abs();
    let int = (a / 1000).to_string();
    let mut g = String::new();
    for (i, ch) in int.chars().enumerate() {
        if i > 0 && (int.len() - i).is_multiple_of(3) {
            g.push('.');
        }
        g.push(ch);
    }
    let frac = format!("{:03}", a % 1000);
    let frac = frac.trim_end_matches('0');
    format!(
        "{}{g}{}{frac}",
        if neg { "-" } else { "" },
        if frac.is_empty() { "" } else { "," }
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_as_written() {
        assert_eq!(parse_number("1.234,56", 2), Some(123_456));
        assert_eq!(parse_number("1234.56", 2), Some(123_456));
        assert_eq!(parse_number("1 500,5", 3), Some(1_500_500));
        assert_eq!(parse_number("1.500.000", 2), Some(150_000_000));
        assert_eq!(parse_number("12", 3), Some(12_000));
        assert_eq!(parse_number("1,2345", 3), None, "too many decimals");
        assert_eq!(parse_number("abc", 2), None);
        assert_eq!(lei(184_130_900), "1.841.309,00");
        assert_eq!(qty(1_500_500), "1.500,5");
        assert_eq!(qty(3_000), "3");
    }

    #[test]
    fn rows_from_a_spreadsheet() {
        let t = "Cod\tDenumire\tUM\tCantitate\tPreț\n\
                 1.1\tSăpătură\tm3\t100\t250,00\n\
                 1.2;Tencuială;m2;1.500,5;12,35\n\
                 1.3\t\tbuc\t3\t1000\n\
                 1.4\tUșă\tbuc\t-1\t1000\n\
                 doar două\tcoloane\n";
        let (ok, bad) = parse_rows(t);
        assert_eq!(ok.len(), 2);
        assert_eq!(ok[1].cantitate, 1_500_500);
        assert_eq!(ok[1].pret_unitar, 1235);
        assert_eq!(bad.iter().map(|(n, _)| *n).collect::<Vec<_>>(), [4, 5, 6]);
        assert!(bad[0].1.contains("denumire"));
    }
}
