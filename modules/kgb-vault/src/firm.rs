//! The firm's own data read from its papers (7.10b): from a certificat constatator or a certificat de
//! înregistrare kept in the vault, the name, the CUI, the trade register number and the registered office. Only
//! what is written after a known label on the same line is taken, and the CUI only when its check digit is
//! right; nothing is guessed. What is found is a proposal: the page shows it next to what the firm's data says
//! now and the person ticks what to take.

use crate::fold;

/// What was found in one document; an empty field was not found.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct FirmFound {
    pub nume: String,
    pub cui: String,
    pub reg_com: String,
    pub adresa: String,
}

/// The labels, as they read after [`fold`] (no diacritics, lower case), for each field.
const NAME: [&str; 4] = ["denumirea firmei", "denumire firma", "denumire", "firma"];
const CUI: [&str; 6] = [
    "cod unic de inregistrare",
    "codul unic de inregistrare",
    "cod de identificare fiscala",
    "cod fiscal",
    "cui",
    "cif",
];
const REG: [&str; 5] = [
    "numar de ordine in registrul comertului",
    "numar de ordine in registrul comertului (nr. ord. rc)",
    "nr. de ordine in registrul comertului",
    "nr. ord. rc",
    "nr. reg. com.",
];
const SEAT: [&str; 4] = ["sediul social", "adresa sediului social", "sediul", "sediu social"];

/// The value after `label:` on a line whose folded start is one of `labels`; the longest label wins, so
/// „sediul social” is not read as „sediul”.
fn after<'a>(line: &'a str, labels: &[&str]) -> Option<&'a str> {
    let (head, value) = line.split_once(':')?;
    let h = fold(head);
    let h = h.trim_start_matches(|c: char| c.is_ascii_digit() || c == '.' || c == ' ');
    labels.contains(&h).then(|| value.trim())
}

/// A trade register number: the old form `J22/123/2020` (also F, C) or the new one `J2020000123221`.
fn reg_com(v: &str) -> Option<String> {
    let c: String = v
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>()
        .to_uppercase();
    let first = c.chars().next()?;
    if !matches!(first, 'J' | 'F' | 'C') {
        return None;
    }
    let rest = &c[1..];
    let parts: Vec<&str> = rest.split('/').collect();
    let old = parts.len() == 3
        && parts
            .iter()
            .all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
        && parts[0].len() <= 2
        && parts[2].len() == 4;
    let new = rest.len() == 13 && rest.bytes().all(|b| b.is_ascii_digit());
    (old || new).then_some(c)
}

/// One value of a line: control characters out, spaces collapsed, at most 300 characters.
fn clean(v: &str) -> String {
    let s: String = v.split_whitespace().collect::<Vec<_>>().join(" ");
    s.chars().filter(|c| !c.is_control()).take(300).collect()
}

/// The firm's data written in `text` (the text the vault kept of a document).
pub fn firm_from_text(text: &str) -> FirmFound {
    let mut f = FirmFound::default();
    for line in text.lines() {
        if f.nume.is_empty()
            && let Some(v) = after(line, &NAME)
        {
            f.nume = clean(v);
        }
        if f.cui.is_empty()
            && let Some(v) = after(line, &CUI)
        {
            // The digits at the start, after an optional „RO”: „RO 14399840 din data de …” → 14399840.
            let v = v.trim_start();
            let v = v
                .strip_prefix("RO")
                .or_else(|| v.strip_prefix("ro"))
                .unwrap_or(v)
                .trim_start();
            let digits: String = v.chars().take_while(char::is_ascii_digit).collect();
            if kgb_core::ids::cui_valid(&digits) {
                f.cui = digits;
            }
        }
        if f.reg_com.is_empty()
            && let Some(v) = after(line, &REG)
            && let Some(r) = reg_com(v.split_whitespace().next().unwrap_or(""))
        {
            f.reg_com = r;
        }
        if f.adresa.is_empty()
            && let Some(v) = after(line, &SEAT)
        {
            f.adresa = clean(v);
        }
    }
    f
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_certificate_gives_the_firms_data() {
        let t = "OFICIUL NAȚIONAL AL REGISTRULUI COMERȚULUI\nCERTIFICAT CONSTATATOR\n\
                 Denumire: ALFA CONSTRUCT S.R.L.\n\
                 Cod unic de înregistrare: 14399840 din data de 01.03.2002\n\
                 Număr de ordine în registrul comerţului: J22/1234/2002\n\
                 Sediul social: Iaşi, Str. Lăpuşneanu nr. 1, Judeţ Iaşi\n\
                 Capital social: 200 lei\n";
        let f = firm_from_text(t);
        assert_eq!(f.nume, "ALFA CONSTRUCT S.R.L.");
        assert_eq!(f.cui, "14399840");
        assert_eq!(f.reg_com, "J22/1234/2002");
        assert_eq!(f.adresa, "Iaşi, Str. Lăpuşneanu nr. 1, Judeţ Iaşi");
    }

    #[test]
    fn the_new_register_number_and_ro_in_front() {
        let f = firm_from_text("Firma: BETA SRL\nCUI: RO 14399840\nNr. ord. RC: J2002001234220\n");
        assert_eq!(f.cui, "14399840", "RO and the space are not part of the code");
        assert_eq!(f.reg_com, "J2002001234220");
        assert_eq!(f.nume, "BETA SRL");
    }

    #[test]
    fn nothing_is_guessed() {
        // A wrong check digit, a register number that is not one, labels that are not on the list.
        let f = firm_from_text("CUI: 14399841\nNr. reg. com.: 22/1234\nClient: GAMMA SRL\nAdresa: Bacău\n");
        assert_eq!(f, FirmFound::default());
        // A label in the middle of a sentence is not a label.
        assert_eq!(firm_from_text("Am primit de la sediul social: nimic").adresa, "");
    }
}
