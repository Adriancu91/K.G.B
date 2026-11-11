//! A cash receipt read from its paper (7.10b): from a document of „Chitanțe, NIR, dispoziții” whose text is a
//! chitanță, the series and number, the day, the sum, who paid („Am primit de la …”), what for („reprezentând …”)
//! and the CUI of the one who issued it. From the firm's CUI the page knows whether the firm received the money
//! (its own receipt: an „încasare”) or paid it (a supplier's receipt: a „plată”). Only what is written is taken;
//! it is a proposal for the cash register of Business, saved by the person.

use crate::fold;

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ReceiptFound {
    pub serie: String,
    pub numar: String,
    /// `AAAA-LL-ZZ`
    pub data: String,
    /// bani
    pub suma: Option<i64>,
    pub de_la: String,
    pub reprezentand: String,
    /// The first CUI with a right check digit (the issuer's, written at the top).
    pub emitent_cui: String,
}

/// `1.234,56` / `1234,56` / `1234.56` / `1 234,56` at the start of `s` → bani.
fn money(s: &str) -> Option<i64> {
    let t: String = s
        .trim_start()
        .chars()
        .take_while(|c| c.is_ascii_digit() || matches!(c, '.' | ',' | ' '))
        .collect();
    let t = t.trim().replace(' ', "");
    if t.is_empty() {
        return None;
    }
    // The decimal separator: a comma followed by one or two digits (as written in Romanian), or a point
    // followed by exactly two; any other separator groups thousands.
    let dec_at = t.rfind([',', '.']).filter(|&i| {
        let after = t.len() - i - 1;
        (t.as_bytes()[i] == b',' && (1..=2).contains(&after)) || after == 2
    });
    let (int, dec) = match dec_at {
        Some(i) => (&t[..i], format!("{:0<2}", &t[i + 1..])),
        None => (t.as_str(), "00".to_string()),
    };
    let int: String = int.chars().filter(char::is_ascii_digit).collect();
    let v: i64 = int.parse().ok()?;
    let d: i64 = dec.parse().ok()?;
    let b = v.checked_mul(100)?.checked_add(d)?;
    (b > 0).then_some(b)
}

fn clean(v: &str, max: usize) -> String {
    let s: String = v.split_whitespace().collect::<Vec<_>>().join(" ");
    s.trim_matches(|c: char| c == ',' || c == ';' || c == ' ')
        .chars()
        .filter(|c| !c.is_control())
        .take(max)
        .collect()
}

/// What a chitanță says; `None` when the text is not a receipt (no „chitanță” and no sum).
pub fn receipt_from_text(text: &str) -> Option<ReceiptFound> {
    let all = fold(text);
    if !all.contains("chitanta") {
        return None;
    }
    let mut r = ReceiptFound::default();
    for line in text.lines().map(str::trim).filter(|l| !l.is_empty()) {
        let f = fold(line);
        if r.emitent_cui.is_empty() {
            for w in f.split(|c: char| !c.is_ascii_alphanumeric()) {
                let d = w.strip_prefix("ro").unwrap_or(w);
                if d.len() >= 6 && d.bytes().all(|b| b.is_ascii_digit()) && kgb_core::ids::cui_valid(d) {
                    r.emitent_cui = d.to_string();
                    break;
                }
            }
        }
        if f.contains("chitanta") && r.numar.is_empty() {
            // „CHITANȚĂ seria AB nr. 0012 din 05.11.2026”
            let words: Vec<&str> = f.split_whitespace().collect();
            for (i, w) in words.iter().enumerate() {
                let next = words.get(i + 1).map(|x| x.trim_end_matches(['.', ','])).unwrap_or("");
                if (*w == "seria" || *w == "serie") && !next.is_empty() {
                    r.serie = next.to_uppercase();
                }
                if (*w == "nr." || *w == "nr" || *w == "numar") && next.chars().any(|c| c.is_ascii_digit()) {
                    r.numar = next.to_uppercase();
                }
            }
        }
        if r.data.is_empty()
            && (f.contains(" din ") || f.starts_with("data"))
            && let Some(d) = crate::permit::first_date(line)
        {
            r.data = d;
        }
        if r.de_la.is_empty()
            && let Some(i) = f.find("am primit de la")
        {
            let rest: String = line
                .chars()
                .skip(f[..i + "am primit de la".len()].chars().count())
                .collect();
            let stop = rest.find([',', ';']).unwrap_or(rest.len());
            r.de_la = clean(&rest[..stop], 200);
        }
        if r.suma.is_none()
            && let Some(i) = f.find("suma de")
        {
            let rest: String = f.chars().skip(f[..i + "suma de".len()].chars().count()).collect();
            r.suma = money(&rest);
        }
        if r.reprezentand.is_empty()
            && let Some(i) = f.find("reprezentand")
        {
            let rest: String = line
                .chars()
                .skip(f[..i + "reprezentand".len()].chars().count())
                .collect();
            r.reprezentand = clean(rest.trim_start_matches(':'), 300);
        }
    }
    (r.suma.is_some() || !r.numar.is_empty()).then_some(r)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_suppliers_receipt() {
        let t = "BETA MATERIALE SRL\nCUI RO18547290, J22/11/2010\nCHITANȚĂ seria BM nr. 0045 din 05.11.2026\n\
                 Am primit de la NOI CONSTRUCT S.R.L., CUI 14399840,\nsuma de 1.234,56 lei, adică una mie...\n\
                 reprezentând contravaloarea facturii BM 77\nCasier,\n";
        let r = receipt_from_text(t).unwrap();
        assert_eq!(r.serie, "BM");
        assert_eq!(r.numar, "0045");
        assert_eq!(r.data, "2026-11-05");
        assert_eq!(r.suma, Some(123_456));
        assert_eq!(r.de_la, "NOI CONSTRUCT S.R.L.");
        assert_eq!(r.reprezentand, "contravaloarea facturii BM 77");
        assert_eq!(r.emitent_cui, "18547290", "the issuer's CUI is the first one");
    }

    #[test]
    fn sums_and_what_is_not_a_receipt() {
        assert_eq!(money("250 lei"), Some(25_000));
        assert_eq!(money("1 500,5"), Some(150_050), "one decimal after a comma");
        assert_eq!(
            money("1.234"),
            Some(123_400),
            "a point and three digits groups thousands"
        );
        assert_eq!(money("99.90 RON"), Some(9_990));
        assert_eq!(money("zero"), None);
        assert!(receipt_from_text("Factura nr. 12 din 05.11.2026\nTotal 100 lei").is_none());
        let r = receipt_from_text("Chitanța nr. 7\nsuma de 50 lei").unwrap();
        assert_eq!((r.numar.as_str(), r.suma, r.data.as_str()), ("7", Some(5_000), ""));
    }
}
