//! A contract's data read from its text (7.10b, „Propune contractul…”): the number and the date, when it starts and
//! ends (an end date, a length in months or years, or an indefinite term), the automatic renewal, the notice in days,
//! and the other party (a CUI with a right check digit that is not the firm's, with the name written before it).
//! Only what the usual phrases of Romanian contracts say is taken; nothing is guessed. What is found is a proposal:
//! the Contracts page opens it as a new contract, and the person checks it and saves it.

use crate::fold;

/// What was found; an empty field (or `None`) was not found.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ContractFound {
    pub numar: String,
    /// The contract's date, `AAAA-LL-ZZ`.
    pub data: String,
    /// When it starts (a date written as such, else the contract's date).
    pub inceput: String,
    pub sfarsit: String,
    pub durata_luni: Option<i64>,
    pub nedeterminata: bool,
    pub prelungire_auto: bool,
    pub preaviz_zile: Option<i64>,
    pub partener_cui: String,
    pub partener_nume: String,
}

/// `dd.mm.yyyy` (or with `/` or `-`) at the start of `s` → `AAAA-LL-ZZ`.
fn date_at(s: &str) -> Option<String> {
    let t: String = s.trim_start().chars().take(10).collect();
    let p: Vec<&str> = t.split(['.', '/', '-']).collect();
    if p.len() != 3 || p[2].len() != 4 {
        return None;
    }
    let (d, m, y): (u32, u32, u32) = (p[0].parse().ok()?, p[1].parse().ok()?, p[2].parse().ok()?);
    ((1..=31).contains(&d) && (1..=12).contains(&m) && (1990..=2200).contains(&y))
        .then(|| format!("{y:04}-{m:02}-{d:02}"))
}

/// The date right after one of `phrases` (folded), anywhere in the text.
fn date_after(text: &str, phrases: &[&str]) -> Option<String> {
    phrases.iter().find_map(|p| {
        text.match_indices(p).find_map(|(i, _)| {
            let rest = &text[i + p.len()..];
            let rest = rest.trim_start_matches([' ', ':']);
            date_at(rest)
        })
    })
}

/// The whole number right after one of `phrases` (folded), with the word that follows it.
fn number_after<'a>(text: &'a str, phrases: &[&str]) -> Option<(i64, &'a str)> {
    phrases.iter().find_map(|p| {
        text.match_indices(p).find_map(|(i, _)| {
            let rest = text[i + p.len()..].trim_start();
            let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
            let n: i64 = digits.parse().ok()?;
            // „12 (douăsprezece) luni”: the number in words between brackets is skipped.
            let mut tail = rest[digits.len()..].trim_start();
            if tail.starts_with('(') {
                tail = tail.split_once(')').map_or(tail, |(_, r)| r.trim_start());
            }
            // „30 de zile”: the „de” of Romanian numbers from 20 on.
            let tail = tail.strip_prefix("de ").unwrap_or(tail);
            Some((n, tail))
        })
    })
}

/// The CUIs written after a known label, with a right check digit, in the order they appear, with the line.
fn cuis(text: &str) -> Vec<(String, usize)> {
    const LABELS: [&str; 6] = [
        "cod unic de inregistrare",
        "cod de identificare fiscala",
        "cod fiscal",
        "cui",
        "cif",
        "c.u.i.",
    ];
    let mut out: Vec<(String, usize)> = Vec::new();
    for (n, line) in text.lines().enumerate() {
        let f = fold(line);
        for l in LABELS {
            for (i, _) in f.match_indices(l) {
                // A label, not part of a word („acuitate”).
                let before_ok = i == 0 || !f.as_bytes()[i - 1].is_ascii_alphanumeric();
                let after = &f[i + l.len()..];
                if !before_ok || after.chars().next().is_some_and(|c| c.is_ascii_alphanumeric()) {
                    continue;
                }
                let v = after.trim_start_matches([' ', ':', '.', '-']);
                let v = v.strip_prefix("ro").unwrap_or(v).trim_start();
                let digits: String = v.chars().take_while(char::is_ascii_digit).collect();
                if kgb_core::ids::cui_valid(&digits) && !out.iter().any(|(c, _)| *c == digits) {
                    out.push((digits, n));
                }
            }
        }
    }
    out
}

/// The name of a party written on its line before „cu sediul”, „CUI”, „, ” (or the label „Beneficiar:” before it).
fn name_on(line: &str) -> String {
    let mut s = line.trim();
    // „Prestator: ALFA SRL, cu sediul…” / „1. ALFA SRL, …”.
    if let Some((head, rest)) = s.split_once(':')
        && head.chars().count() <= 30
    {
        s = rest.trim();
    }
    let s = s.trim_start_matches(|c: char| c.is_ascii_digit() || c == '.' || c == ')' || c == ' ');
    let f = fold(s);
    let cut = ["cu sediul", ", cui", ", cif", ", cod", " cui", " cif", ","]
        .iter()
        .filter_map(|m| f.find(m))
        .min()
        .unwrap_or(f.len());
    // `fold` keeps the characters (lower-cased, no diacritics): the same number of characters in the original.
    let end = s
        .char_indices()
        .nth(f[..cut].chars().count())
        .map_or(s.len(), |(i, _)| i);
    s[..end].trim().trim_end_matches(',').trim().chars().take(200).collect()
}

/// The contract's data in `text`; `firm` is the firm's own CUI (its party is not the partner), empty when unknown.
pub fn contract_from_text(text: &str, firm: &str) -> ContractFound {
    let folded: String = text.lines().map(fold).collect::<Vec<_>>().join("\n");
    let mut c = ContractFound::default();

    // „CONTRACT DE PRESTĂRI SERVICII nr. 12/2026 din 05.01.2026”.
    for line in folded.lines().filter(|l| l.contains("contract")).take(5) {
        if c.numar.is_empty()
            && let Some(i) = line.find("nr")
        {
            let rest = line[i + 2..].trim_start_matches(['.', ':', ' ']);
            let num: String = rest
                .chars()
                .take_while(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '/' | '-' | '.'))
                .collect();
            let num = num.trim_end_matches('.');
            if num.chars().any(|ch| ch.is_ascii_digit()) {
                c.numar = num.to_uppercase();
            }
        }
        if c.data.is_empty()
            && let Some(i) = line.find(" din ")
            && let Some(d) = date_at(&line[i + 5..])
        {
            c.data = d;
        }
    }
    if c.data.is_empty() {
        c.data =
            date_after(&folded, &["incheiat astazi", "incheiat la data de", "data incheierii:"]).unwrap_or_default();
    }
    c.inceput = date_after(
        &folded,
        &[
            "incepand cu data de",
            "incepand cu",
            "intra in vigoare la data de",
            "intra in vigoare la",
            "de la data de",
        ],
    )
    .unwrap_or_else(|| c.data.clone());
    c.sfarsit = date_after(&folded, &["pana la data de", "valabil pana la", "pana la"]).unwrap_or_default();
    c.nedeterminata = folded.contains("durata nedeterminata") || folded.contains("perioada nedeterminata");
    if !c.nedeterminata
        && let Some((n, unit)) = number_after(
            &folded,
            &[
                "pe o durata de",
                "pe o perioada de",
                "durata contractului este de",
                "durata de",
            ],
        )
    {
        if unit.starts_with("luni") || unit.starts_with("luna") {
            c.durata_luni = Some(n);
        } else if unit.starts_with("ani")
            || unit.starts_with("an ")
            || unit.starts_with("an,")
            || unit.starts_with("an.")
        {
            c.durata_luni = Some(n * 12);
        }
    }
    c.prelungire_auto = [
        "se prelungeste automat",
        "prelungire automata",
        "tacita reconductiune",
        "se prelungeste de drept",
    ]
    .iter()
    .any(|p| folded.contains(p));
    if let Some((n, unit)) = number_after(
        &folded,
        &["preaviz de", "cu un preaviz de", "cu cel putin", "notificare scrisa cu"],
    ) && unit.starts_with("zile")
        && (0..=365).contains(&n)
    {
        c.preaviz_zile = Some(n);
    }

    // The other party: the first right CUI that is not the firm's, with its name on its line.
    let lines: Vec<&str> = text.lines().collect();
    if let Some((cui, n)) = cuis(text).into_iter().find(|(cu, _)| cu.as_str() != firm) {
        c.partener_nume = name_on(lines[n]);
        c.partener_cui = cui;
    }
    c
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIRM: &str = "14399840";

    #[test]
    fn a_service_contract() {
        let t = "CONTRACT DE PRESTĂRI SERVICII nr. 12/2026 din 05.01.2026\n\
                 Între:\n\
                 Prestator: ALFA CONSTRUCT S.R.L., cu sediul în Iași, CUI RO14399840\n\
                 Beneficiar: BETA SERVICII S.R.L., cu sediul în Cluj, CUI 18547290\n\
                 Art. 3. Contractul se încheie pe o durată de 12 (douăsprezece) luni, începând cu data de 01.02.2026.\n\
                 Art. 4. Contractul se prelungește automat cu perioade egale dacă niciuna dintre părți nu îl denunță \
                 cu un preaviz de 30 de zile.\n";
        let c = contract_from_text(t, FIRM);
        assert_eq!(c.numar, "12/2026");
        assert_eq!(c.data, "2026-01-05");
        assert_eq!(c.inceput, "2026-02-01");
        assert_eq!(c.durata_luni, Some(12));
        assert!(c.prelungire_auto);
        assert_eq!(c.preaviz_zile, Some(30));
        assert_eq!(c.partener_cui, "18547290", "the firm's own CUI is not the partner");
        assert_eq!(c.partener_nume, "BETA SERVICII S.R.L.");
        assert!(!c.nedeterminata);
    }

    #[test]
    fn a_rent_until_a_date_and_years() {
        let t = "Contract de închiriere nr. C-7 din 15.03.2025\n\
                 Locator: IMOBIL VEST SRL, CIF 18547290, cu sediul în Arad\n\
                 Locatar: Alfa Construct SRL, cod fiscal 14399840\n\
                 Durata contractului este de 2 ani, până la data de 14.03.2027.\n";
        let c = contract_from_text(t, FIRM);
        assert_eq!(c.numar, "C-7");
        assert_eq!(c.inceput, "2025-03-15", "no start written: the contract's date");
        assert_eq!(c.sfarsit, "2027-03-14");
        assert_eq!(c.durata_luni, Some(24));
        assert!(!c.prelungire_auto);
        assert_eq!(c.preaviz_zile, None);
        assert_eq!(c.partener_nume, "IMOBIL VEST SRL");
    }

    #[test]
    fn indefinite_and_nothing_guessed() {
        let t = "CONTRACT nr. 5 din 01.06.2026\nContractul se încheie pe durată nedeterminată.\n\
                 Client: GAMMA SRL, CUI 18547291\n";
        let c = contract_from_text(t, FIRM);
        assert!(c.nedeterminata);
        assert_eq!(c.durata_luni, None);
        assert_eq!(c.partener_cui, "", "a wrong check digit is not a CUI");
        // Without the firm's CUI the first right CUI is taken (the page asks the person anyway).
        let c = contract_from_text("Contract nr. 1 din 01.01.2026\nPrestator: ALFA SRL, CUI 14399840\n", "");
        assert_eq!(c.partener_cui, "14399840");
        assert_eq!(
            contract_from_text("Acuitate vizuală: 14399840", "").partener_cui,
            "",
            "a label inside a word"
        );
    }
}
