//! A permit read from its paper (7.10b): from a document of „Autorizații și avize”, the title (the line that
//! names an authorization, an approval, an agreement, a licence or a certificate), the number, the day it was
//! issued, the day it stops being valid (written, or computed from „valabil N ani” and the issue day) and the
//! institution. Only what is written is taken; what is not found stays empty. It is a proposal: the page fills in
//! the permit's form in „Permise și autorizații” and the person saves it.

use crate::fold;

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PermitFound {
    pub titlu: String,
    pub numar: String,
    /// `AAAA-LL-ZZ`
    pub emisa: String,
    /// `AAAA-LL-ZZ`
    pub valabila_pana: String,
    pub institutie: String,
}

const KINDS: [&str; 8] = [
    "autorizatie",
    "autorizatia",
    "aviz",
    "acord",
    "licenta",
    "certificat",
    "atestat",
    "permis",
];
const BODIES: [&str; 9] = [
    "inspectoratul",
    "directia",
    "agentia",
    "primaria",
    "oficiul",
    "ministerul",
    "autoritatea",
    "consiliul judetean",
    "garda",
];

/// `dd.mm.yyyy` (or with `/` or `-`) anywhere in `s` → the first such date as `AAAA-LL-ZZ`, if it exists.
fn first_date(s: &str) -> Option<String> {
    let b: Vec<char> = s.chars().collect();
    for i in 0..b.len() {
        let take = |from: usize, n: usize| -> Option<u32> {
            let t: String = b.get(from..from + n)?.iter().collect();
            t.bytes().all(|c| c.is_ascii_digit()).then(|| t.parse().ok()).flatten()
        };
        if i > 0 && b[i - 1].is_ascii_digit() {
            continue;
        }
        // d or dd, sep, m or mm, sep, yyyy
        for dl in [2usize, 1] {
            let Some(d) = take(i, dl) else { continue };
            let sep = *b.get(i + dl)?;
            if !matches!(sep, '.' | '/' | '-') {
                continue;
            }
            for ml in [2usize, 1] {
                let Some(m) = take(i + dl + 1, ml) else { continue };
                if b.get(i + dl + 1 + ml) != Some(&sep) {
                    continue;
                }
                let Some(y) = take(i + dl + ml + 2, 4) else { continue };
                if b.get(i + dl + ml + 6).is_some_and(char::is_ascii_digit) {
                    continue;
                }
                let iso = format!("{y:04}-{m:02}-{d:02}");
                if valid(&iso) {
                    return Some(iso);
                }
            }
        }
    }
    None
}

fn valid(iso: &str) -> bool {
    let p: Vec<i64> = iso.split('-').filter_map(|x| x.parse().ok()).collect();
    let [y, m, d] = p[..] else { return false };
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    let dim = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    (1900..=2200).contains(&y) && (1..=12).contains(&m) && d >= 1 && d <= dim[(m - 1) as usize]
}

/// The same day `years` later (29 February → 28 February when the year is not a leap year).
fn plus_years(iso: &str, years: i64) -> Option<String> {
    let y: i64 = iso.get(..4)?.parse().ok()?;
    let rest = iso.get(4..)?;
    let out = format!("{:04}{rest}", y + years);
    if valid(&out) {
        Some(out)
    } else {
        let alt = format!("{:04}{}", y + years, rest.replace("-02-29", "-02-28"));
        valid(&alt).then_some(alt)
    }
}

/// A number after „nr.” / „numărul”: letters, digits and / - . (as `123/2024`, `AC-45`).
fn number_after(line: &str) -> Option<String> {
    let f = fold(line);
    let at = ["nr. ", "nr.", "nr ", "numarul ", "numar "]
        .iter()
        .find_map(|k| f.find(k).map(|i| i + k.len()))?;
    let n: String = f[at..]
        .trim_start()
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '-' | '.'))
        .collect();
    let n = n.trim_end_matches(['.', '-', '/']).to_uppercase();
    n.chars().any(|c| c.is_ascii_digit()).then_some(n)
}

fn clean(v: &str) -> String {
    let s: String = v.split_whitespace().collect::<Vec<_>>().join(" ");
    s.chars().filter(|c| !c.is_control()).take(200).collect()
}

/// What a permit's paper says about it.
pub fn permit_from_text(text: &str) -> PermitFound {
    let mut p = PermitFound::default();
    let lines: Vec<&str> = text.lines().map(str::trim).filter(|l| !l.is_empty()).collect();
    for (i, line) in lines.iter().enumerate() {
        let f = fold(line);
        let first = f.split(|c: char| !c.is_alphanumeric()).next().unwrap_or("");
        if p.titlu.is_empty() && KINDS.contains(&first) && line.chars().count() <= 200 {
            // The title line, without the number and date that may follow on it.
            let cut = f.find(" nr").or_else(|| f.find(" din ")).unwrap_or(f.len());
            let title: String = line.chars().take(f[..cut].chars().count()).collect();
            p.titlu = clean(title.trim_end_matches([',', '-', ' ']));
            if p.numar.is_empty() {
                p.numar = number_after(line).unwrap_or_default();
            }
            // The number and the date are often on the title line or the one below.
            if p.numar.is_empty()
                && let Some(next) = lines.get(i + 1)
            {
                p.numar = number_after(next).unwrap_or_default();
            }
        }
        if p.numar.is_empty() && (f.starts_with("nr") || f.starts_with("numar")) {
            p.numar = number_after(line).unwrap_or_default();
        }
        if p.emisa.is_empty()
            && (f.contains(" din ")
                || f.starts_with("din ")
                || f.contains("emis")
                || f.contains("data eliberarii")
                || f.contains("eliberat"))
            && !f.contains("valabil")
            && let Some(d) = first_date(line)
        {
            p.emisa = d;
        }
        if p.valabila_pana.is_empty() && f.contains("valabil") {
            if let Some(d) =
                first_date(line).filter(|_| f.contains("pana") || f.contains("pina") || f.contains("expir"))
            {
                p.valabila_pana = d;
            } else if let Some(n) = years_in(&f) {
                // „valabil 5 ani”, computed below once the issue day is known.
                p.valabila_pana = format!("+{n}");
            }
        }
        if p.institutie.is_empty() && BODIES.iter().any(|b| f.starts_with(b)) {
            p.institutie = clean(line);
        }
    }
    if let Some(n) = p.valabila_pana.strip_prefix('+') {
        let n: i64 = n.parse().unwrap_or(0);
        p.valabila_pana = if p.emisa.is_empty() {
            String::new()
        } else {
            plus_years(&p.emisa, n).unwrap_or_default()
        };
    }
    p
}

/// „valabil(ă) 5 ani” / „pe o perioadă de 3 ani” → 5 / 3 (1–50).
fn years_in(f: &str) -> Option<i64> {
    let words: Vec<&str> = f.split_whitespace().collect();
    words.windows(2).find_map(|w| {
        let n: i64 = w[0].parse().ok()?;
        (w[1].starts_with("an") && (1..=50).contains(&n)).then_some(n)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_isu_authorization() {
        let t = "INSPECTORATUL PENTRU SITUAȚII DE URGENȚĂ „MIHAIL GRIGORE STURDZA” AL JUDEȚULUI IAȘI\n\
                 AUTORIZAȚIE DE SECURITATE LA INCENDIU\n\
                 Nr. 123/24/SU-IS din 15.03.2024\n\
                 Pentru: depozit materiale, Str. Lăpușneanu nr. 1\n";
        let p = permit_from_text(t);
        assert_eq!(p.titlu, "AUTORIZAȚIE DE SECURITATE LA INCENDIU");
        assert_eq!(p.numar, "123/24/SU-IS");
        assert_eq!(p.emisa, "2024-03-15");
        assert_eq!(p.valabila_pana, "", "an ISU authorization has no end written here");
        assert!(p.institutie.starts_with("INSPECTORATUL PENTRU SITUAȚII DE URGENȚĂ"));
    }

    #[test]
    fn a_dsp_one_valid_until_a_day_and_one_valid_for_years() {
        let p = permit_from_text(
            "Direcția de Sănătate Publică Iași\nAutorizație sanitară de funcționare nr. 45 din 02/01/2025\nValabilă până la 01.01.2030\n",
        );
        assert_eq!(
            (p.numar.as_str(), p.emisa.as_str(), p.valabila_pana.as_str()),
            ("45", "2025-01-02", "2030-01-01")
        );
        assert_eq!(p.titlu, "Autorizație sanitară de funcționare");
        let q = permit_from_text(
            "ACORD DE FUNCȚIONARE\nNr. AF-7\nEmis la data de 29.02.2024\nValabil 5 ani de la emitere\n",
        );
        assert_eq!(
            (q.numar.as_str(), q.emisa.as_str(), q.valabila_pana.as_str()),
            ("AF-7", "2024-02-29", "2029-02-28")
        );
    }

    #[test]
    fn nothing_is_guessed() {
        let p = permit_from_text("Factura nr. 12 din 31.02.2026\nTotal 100 lei\n");
        assert_eq!(p.titlu, "");
        assert_eq!(p.emisa, "", "31 February is not a day");
        assert_eq!(p.valabila_pana, "");
        assert_eq!(
            permit_from_text("Aviz\nvalabil 3 ani").valabila_pana,
            "",
            "years without an issue day give no end"
        );
    }
}
