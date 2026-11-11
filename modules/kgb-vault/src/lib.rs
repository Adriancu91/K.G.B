//! `kgb.vault` — „Depozitul de documente” (Etapa 7, step 7.10a): every document of the firm in one place.
//!
//! A whole folder (the page lists it and sends the files one by one) or chosen files enter the workspace as the
//! module's documents (`files.own`: the original is version 1 and is never changed; the bytes are kept once per
//! BLAKE3 hash and synchronised by role). The same bytes a second time are not added again: the answer names the
//! document already there.
//!
//! Each document gets a category with a confidence and a reason, from its text (a PDF with text, a workbook, a
//! .docx, an e-Factura XML) and from the names of its folder and file. Below [`SURE`] the person confirms it.
//! Scanned PDFs (no text) are sorted by their names only, with a low confidence.
//!
//! Invoices are recognised the same way whatever their source (here, the online invoicing program, e-Factura,
//! Business — 7.10c / 7.10d): issuer CUI (no „RO”, no spaces), series and number (upper-case, no spaces, the
//! number without leading zeros), date (`AAAA-LL-ZZ`), total with VAT (bani). Sales or purchases follow from the
//! firm's CUI, set once in the vault's settings.
//!
//! The kept text is the first 4000 characters, with any run of 13 digits (a CNP) hidden.
//!
//! Commands: `adauga {name, data, cale?}`, `lista {categorie?, text?, de_confirmat?}`, `rezumat`,
//! `confirma {id, version, categorie}`, `factura_save {id, version, factura}`, `sterge {id, version}`,
//! `salveaza_copie {id, dest}`, `setari`, `setari_save {cui_firma, version?}`, `profil_firma` (7.10b: the firm's
//! data read from the documents of „Actele firmei”, as proposals with the documents they come from),
//! `autorizatii_propuse` (7.10b: what each document of „Autorizații și avize” says about its permit).

use std::collections::BTreeMap;
use std::io::Read;
use std::path::PathBuf;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Map, Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.vault";
pub const DOCUMENTS: &str = "documente";
pub const SETTINGS: &str = "setari";
/// The categories, in display order, with their names on screen.
pub mod firm;
pub mod permit;

pub const CATEGORIES: [(&str, &str); 11] = [
    ("identitate", "Actele firmei"),
    ("autorizatii", "Autorizații și avize"),
    ("contracte_clienti", "Contracte cu clienți"),
    ("contracte_furnizori", "Contracte cu furnizori"),
    ("contracte_munca", "Contracte de muncă"),
    ("facturi_vanzare", "Facturi de vânzare"),
    ("facturi_achizitie", "Facturi de achiziție"),
    ("extrase", "Extrase de cont"),
    ("chitante_nir", "Chitanțe, NIR, dispoziții"),
    ("personal", "Personal (HR)"),
    ("altele", "Altele"),
];
/// From this confidence a category needs no confirmation.
pub const SURE: i64 = 75;
const TEXT_KEPT: usize = 4000;
/// A .docx whose parts would unpack to more than this is not read (a zip bomb).
const MAX_UNPACKED: u64 = 64 * 1024 * 1024;
/// The settings record has a fixed id.
const SETTINGS_ID: Uuid = Uuid::from_u128(0x6b67_6276_6175_6c74_0000_0000_0000_0001);

pub struct Vault {
    manifest: Manifest,
}

impl Vault {
    pub fn new() -> Vault {
        Vault {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Vault {
    fn default() -> Self {
        Vault::new()
    }
}

fn args<T: DeserializeOwned>(command: &str, v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid(format!("argumentele comenzii {command}"), e.to_string()))
}

fn bad(what: &str, detail: impl Into<String>) -> CoreError {
    CoreError::invalid(what, detail)
}

fn s(r: &RecordState, k: &str) -> String {
    r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn i(r: &RecordState, k: &str) -> i64 {
    r.fields.get(k).and_then(Value::as_i64).unwrap_or_default()
}

// ---------- normalising ----------

/// Lower-case, without Romanian diacritics, whitespace collapsed.
pub fn fold(t: &str) -> String {
    let mut out = String::with_capacity(t.len());
    let mut space = false;
    for c in t.chars() {
        let c = match c {
            'ă' | 'â' | 'Ă' | 'Â' => 'a',
            'î' | 'Î' => 'i',
            'ș' | 'ş' | 'Ș' | 'Ş' => 's',
            'ț' | 'ţ' | 'Ț' | 'Ţ' => 't',
            c => c,
        };
        if c.is_whitespace() {
            if !space && !out.is_empty() {
                out.push(' ');
            }
            space = true;
        } else {
            out.extend(c.to_lowercase());
            space = false;
        }
    }
    out.trim_end().to_string()
}

/// The CUI as compared: no whitespace, upper-case, no „RO” in front.
pub fn cui_key(code: &str) -> String {
    let c: String = code
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>()
        .to_uppercase();
    c.strip_prefix("RO").map(String::from).unwrap_or(c)
}

/// An invoice's number as written („KGB 0012”, „ABC-12”) → (series, number): the trailing digits are the number,
/// without leading zeros; what is before them, letters and digits only, upper-case, is the series.
pub fn split_number(raw: &str, series_hint: &str) -> (String, String) {
    let t = raw.trim().to_uppercase();
    let digits_at = t
        .char_indices()
        .rev()
        .take_while(|(_, c)| c.is_ascii_digit())
        .last()
        .map_or(t.len(), |(i, _)| i);
    let (series, number) = t.split_at(digits_at);
    let alnum = |x: &str| x.chars().filter(|c| c.is_alphanumeric()).collect::<String>();
    let number = number.trim_start_matches('0');
    let number = if number.is_empty() && digits_at < t.len() {
        "0"
    } else {
        number
    };
    let series = alnum(series);
    let series = if series.is_empty() {
        alnum(series_hint).to_uppercase()
    } else {
        series
    };
    (series, number.to_string())
}

/// „1.210,00”, „1210.00”, „1 210,5” → bani.
pub fn bani(t: &str) -> Option<i64> {
    let f = kgb_extract::fields::amount(t)?;
    (f.is_finite() && f.abs() < 1e13).then(|| (f * 100.0).round() as i64)
}

/// zz.ll.aaaa or aaaa-ll-zz → aaaa-ll-zz.
pub fn iso_date(t: &str) -> Option<String> {
    let t = t.trim();
    let (y, m, d) = if t.len() >= 10 && t.as_bytes()[4] == b'-' {
        (&t[0..4], &t[5..7], &t[8..10])
    } else {
        let p: Vec<&str> = t.split(['.', '/', '-']).collect();
        if p.len() != 3 {
            return None;
        }
        (p[2], p[1], p[0])
    };
    let (y, m, d): (u32, u32, u32) = (y.parse().ok()?, m.parse().ok()?, d.parse().ok()?);
    ((1990..=2200).contains(&y) && (1..=12).contains(&m) && (1..=31).contains(&d))
        .then(|| format!("{y:04}-{m:02}-{d:02}"))
}

/// Any run of exactly 13 digits (a CNP) hidden, except right after the letter of a trade register number
/// (`J2002001234220`, the form used since 2024: J, F or C glued to the digits), which no CNP has.
pub fn hide_cnp(t: &str) -> String {
    let chars: Vec<char> = t.chars().collect();
    let mut out = String::with_capacity(t.len());
    let mut k = 0;
    while k < chars.len() {
        if chars[k].is_ascii_digit() && (k == 0 || !chars[k - 1].is_ascii_digit()) {
            let mut e = k;
            while e < chars.len() && chars[e].is_ascii_digit() {
                e += 1;
            }
            let register = k > 0 && matches!(chars[k - 1], 'J' | 'F' | 'C');
            if e - k == 13 && !register {
                out.push_str("•••••••••••••");
            } else {
                out.extend(&chars[k..e]);
            }
            k = e;
        } else {
            out.push(chars[k]);
            k += 1;
        }
    }
    out
}

// ---------- reading ----------

/// An invoice as compared everywhere (7.10d).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Invoice {
    pub emitent_cui: String,
    pub emitent: String,
    pub client_cui: String,
    pub serie: String,
    pub numar: String,
    pub data: String,
    pub total: Option<i64>,
}

impl Invoice {
    pub fn to_json(&self) -> Value {
        json!({"emitent_cui": self.emitent_cui, "emitent": self.emitent, "client_cui": self.client_cui,
               "serie": self.serie, "numar": self.numar, "data": self.data, "total": self.total})
    }
}

/// Issuer CUI, series, number.
pub type InvoiceKey = (String, String, String);

/// The key of an invoice (7.10d, D-089): issuer CUI + series + number. `None` without a number or an issuer.
pub fn invoice_key(inv: &Invoice) -> Option<InvoiceKey> {
    (!inv.numar.is_empty() && !inv.emitent_cui.is_empty())
        .then(|| (inv.emitent_cui.clone(), inv.serie.clone(), inv.numar.clone()))
}

/// Whether two invoices with the same key are the same one: `true` when the date and the total agree (where both
/// are known), `false` for „posibil dublură” (same number, another date or total).
pub fn same_invoice(a: &Invoice, b: &Invoice) -> bool {
    let date = a.data.is_empty() || b.data.is_empty() || a.data == b.data;
    let total = a.total.is_none() || b.total.is_none() || a.total == b.total;
    date && total
}

/// Groups of invoices sharing a key; each group says whether it is surely one invoice or only possibly.
pub fn duplicate_groups<T: Clone>(items: &[(T, Invoice)]) -> Vec<(Vec<T>, bool)> {
    let mut by: BTreeMap<InvoiceKey, Vec<&(T, Invoice)>> = BTreeMap::new();
    for it in items {
        if let Some(k) = invoice_key(&it.1) {
            by.entry(k).or_default().push(it);
        }
    }
    by.into_values()
        .filter(|g| g.len() > 1)
        .map(|g| {
            let sure = g.iter().all(|x| same_invoice(&x.1, &g[0].1));
            (g.iter().map(|x| x.0.clone()).collect(), sure)
        })
        .collect()
}

/// The text of an XML element's first occurrence after `from` (`<cbc:ID>…</cbc:ID>`, attributes allowed).
fn xml_tag<'a>(xml: &'a str, tag: &str, from: usize) -> Option<(&'a str, usize)> {
    let open = format!("<{tag}");
    let mut at = from;
    loop {
        let start = at + xml.get(at..)?.find(&open)?;
        let after = start + open.len();
        let next = xml.as_bytes().get(after).copied()?;
        if next == b'>' || next == b' ' {
            let body = after + xml[after..].find('>')? + 1;
            let end = body + xml[body..].find(&format!("</{tag}>"))?;
            return Some((xml[body..end].trim(), end));
        }
        at = after;
    }
}

/// An e-Factura (UBL) invoice: its ID, issue date, supplier and customer, payable amount.
pub fn ubl_invoice(xml: &str) -> Option<Invoice> {
    if !xml.contains("<Invoice") && !xml.contains(":Invoice") {
        return None;
    }
    // The invoice's own ID is the first cbc:ID before the first party.
    let parties = xml.find("<cac:AccountingSupplierParty").unwrap_or(xml.len());
    let (id, _) = xml_tag(&xml[..parties], "cbc:ID", 0)?;
    let date = xml_tag(xml, "cbc:IssueDate", 0)
        .map(|(d, _)| d.to_string())
        .unwrap_or_default();
    let party = |name: &str| -> (String, String) {
        let Some(p) = xml.find(&format!("<cac:{name}")) else {
            return Default::default();
        };
        let end = xml[p..].find(&format!("</cac:{name}>")).map_or(xml.len(), |e| p + e);
        let part = &xml[p..end];
        let cui = xml_tag(part, "cbc:CompanyID", 0)
            .map(|(c, _)| c.to_string())
            .unwrap_or_default();
        let name = xml_tag(part, "cbc:RegistrationName", 0)
            .or_else(|| xml_tag(part, "cbc:Name", 0))
            .map(|(n, _)| n.to_string())
            .unwrap_or_default();
        (cui, name)
    };
    let (sup_cui, sup) = party("AccountingSupplierParty");
    let (cus_cui, _) = party("AccountingCustomerParty");
    let total = xml_tag(xml, "cbc:PayableAmount", 0).and_then(|(t, _)| bani(t));
    let (serie, numar) = split_number(id, "");
    Some(Invoice {
        emitent_cui: cui_key(&sup_cui),
        emitent: sup,
        client_cui: cui_key(&cus_cui),
        serie,
        numar,
        data: iso_date(&date).unwrap_or_default(),
        total,
    })
}

/// An invoice found in the lines of a PDF or a workbook: a number and a total at least.
fn text_invoice(lines: &[kgb_extract::fields::Line], folded: &str) -> Option<Invoice> {
    let f = kgb_extract::fields::extract(lines);
    let get = |k: &str| f.iter().find(|x| x.key == k).map(|x| x.value.clone());
    let raw_number = get("numar")?;
    let total = get("total").and_then(|t| bani(&t))?;
    if !folded.contains("factur") {
        return None;
    }
    // „seria ABC nr. 12”: the series written apart.
    let hint = folded
        .split("seria")
        .nth(1)
        .and_then(|r| r.split_whitespace().next())
        .unwrap_or("")
        .trim_matches(|c: char| !c.is_alphanumeric());
    let (serie, numar) = split_number(&raw_number, hint);
    Some(Invoice {
        emitent_cui: cui_key(&get("cui_furnizor").unwrap_or_default()),
        emitent: get("furnizor").unwrap_or_default(),
        client_cui: String::new(),
        serie,
        numar,
        data: get("data").and_then(|d| iso_date(&d)).unwrap_or_default(),
        total: Some(total),
    })
}

/// The text of a .docx, refusing one that would unpack to too much.
fn docx_text(data: &[u8]) -> Option<String> {
    let mut z = zip::ZipArchive::new(std::io::Cursor::new(data)).ok()?;
    let mut total = 0_u64;
    for k in 0..z.len() {
        total += z.by_index(k).ok()?.size();
    }
    if total > MAX_UNPACKED {
        return None;
    }
    kgb_docs::fill::text(data).ok()
}

/// What could be read from a file: its text (maybe empty) and an invoice (maybe).
pub fn read_file(name: &str, data: &[u8]) -> (String, Option<Invoice>, &'static str) {
    let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "xml" => {
            let mut xml = String::new();
            let _ = std::io::Cursor::new(data).take(MAX_UNPACKED).read_to_string(&mut xml);
            let inv = ubl_invoice(&xml);
            let text = if inv.is_some() {
                String::new()
            } else {
                xml.chars().take(20_000).collect()
            };
            let how = if inv.is_some() {
                "factură e-Factura (XML)"
            } else {
                "XML"
            };
            (text, inv, how)
        }
        "docx" => (docx_text(data).unwrap_or_default(), None, "document .docx"),
        "txt" => (
            String::from_utf8_lossy(&data[..data.len().min(200_000)]).into_owned(),
            None,
            "text",
        ),
        "pdf" | "xlsx" | "xlsm" | "xls" | "ods" | "csv" => match kgb_extract::lines_of(name, data) {
            Ok(lines) => {
                let text = lines.iter().map(|l| l.text.as_str()).collect::<Vec<_>>().join("\n");
                let folded = fold(&text);
                let inv = text_invoice(&lines, &folded);
                (text, inv, if ext == "pdf" { "PDF cu text" } else { "foaie de calcul" })
            }
            Err(_) => (
                String::new(),
                None,
                if ext == "pdf" {
                    "PDF fără text (scanat)"
                } else {
                    "fișier necitit"
                },
            ),
        },
        _ => (String::new(), None, "fișier fără text citit (imagine sau alt format)"),
    }
}

// ---------- sorting ----------

/// (category, phrase, weight): the phrases are folded (no diacritics, lower-case).
const PHRASES: &[(&str, &str, i64)] = &[
    ("identitate", "certificat de inregistrare", 4),
    ("identitate", "certificat constatator", 4),
    ("identitate", "act constitutiv", 4),
    ("identitate", "actul constitutiv", 4),
    ("identitate", "statutul societatii", 3),
    ("identitate", "oficiul registrului comertului", 2),
    ("identitate", "registrul comertului", 1),
    ("identitate", "cod unic de inregistrare", 1),
    ("autorizatii", "autorizatie", 3),
    ("autorizatii", "autorizatia", 3),
    ("autorizatii", "aviz ", 2),
    ("autorizatii", "avizul", 2),
    ("autorizatii", "acord de mediu", 3),
    ("autorizatii", "certificat de urbanism", 3),
    ("autorizatii", "licenta", 2),
    ("autorizatii", "inspectoratul pentru situatii de urgenta", 3),
    ("autorizatii", "sanitar veterinar", 2),
    ("autorizatii", "valabil pana la", 1),
    ("contracte_munca", "contract individual de munca", 6),
    ("contracte_munca", "angajator", 2),
    ("contracte_munca", "salariat", 2),
    ("contracte", "contract", 2),
    ("contracte", "partile contractante", 3),
    ("contracte", "obiectul contractului", 3),
    ("contracte", "durata contractului", 2),
    ("contracte", "prestator", 1),
    ("contracte", "beneficiar", 1),
    ("factura", "factura", 2),
    ("factura", "total de plata", 2),
    ("factura", "cota tva", 1),
    ("extrase", "extras de cont", 5),
    ("extrase", "sold initial", 2),
    ("extrase", "sold final", 2),
    ("extrase", "iban", 1),
    ("chitante_nir", "chitanta", 4),
    ("chitante_nir", "nota de receptie", 4),
    ("chitante_nir", "dispozitie de plata", 4),
    ("chitante_nir", "dispozitie de incasare", 4),
    ("chitante_nir", "bon de consum", 3),
    ("chitante_nir", "aviz de insotire", 3),
    ("personal", "fisa postului", 5),
    ("personal", "cerere de concediu", 5),
    ("personal", "adeverinta de salariat", 4),
    ("personal", "stat de plata", 4),
    ("personal", "foaie colectiva de prezenta", 4),
    ("personal", "pontaj", 2),
    ("personal", "decizie de angajare", 4),
];

/// Hints in the names of the folders and of the file (folded), worth 3 each.
const NAME_HINTS: &[(&str, &str)] = &[
    ("constatator", "identitate"),
    ("certificat inregistrare", "identitate"),
    ("act constitutiv", "identitate"),
    ("statut", "identitate"),
    ("autoriza", "autorizatii"),
    ("aviz", "autorizatii"),
    ("licent", "autorizatii"),
    ("contract de munca", "contracte_munca"),
    ("contracte de munca", "contracte_munca"),
    ("cim", "contracte_munca"),
    ("contract", "contracte"),
    ("factur", "factura"),
    ("vanzari", "facturi_vanzare"),
    ("emise", "facturi_vanzare"),
    ("achizitii", "facturi_achizitie"),
    ("primite", "facturi_achizitie"),
    ("furnizori", "facturi_achizitie"),
    ("extras", "extrase"),
    ("banca", "extrase"),
    ("chitant", "chitante_nir"),
    ("nir", "chitante_nir"),
    ("personal", "personal"),
    ("resurse umane", "personal"),
    ("hr", "personal"),
    ("salari", "personal"),
];

/// A proposed category with its confidence (0–100) and the reason in words.
#[derive(Clone, Debug, PartialEq)]
pub struct Sorting {
    pub category: &'static str,
    pub confidence: i64,
    pub reason: String,
}

fn words_of(path: &str) -> Vec<String> {
    let f = fold(&path.replace(['\\', '/', '_', '-', '.'], " "));
    f.split(' ').map(String::from).collect()
}

/// Sorts a document: from its invoice (if one was recognised), its text and the names of its folder and file.
/// `firm` is the firm's CUI (as `cui_key`), or empty when not set yet.
pub fn sort(path: &str, text: &str, invoice: Option<&Invoice>, firm: &str) -> Sorting {
    // An invoice: sales when the firm issued it, purchases otherwise.
    if let Some(inv) = invoice {
        return match (firm.is_empty(), inv.emitent_cui.is_empty()) {
            (false, false) if inv.emitent_cui == firm => Sorting {
                category: "facturi_vanzare",
                confidence: 95,
                reason: "factură emisă de firmă (CUI-ul emitentului e al firmei)".into(),
            },
            (false, false) => Sorting {
                category: "facturi_achizitie",
                confidence: 90,
                reason: "factură de la alt emitent (CUI-ul emitentului nu e al firmei)".into(),
            },
            // Without the firm's CUI (or the issuer's), the folder's name proposes the side; still to confirm.
            (true, _) | (false, true) => {
                let no_firm = firm.is_empty();
                match (side_by_folder(path), no_firm) {
                    (Some((true, hint)), true) => Sorting {
                        category: "facturi_vanzare",
                        confidence: 50,
                        reason: format!(
                            "factură de vânzare după numele folderului („{hint}”); nu știu CUI-ul firmei (Setări)"
                        ),
                    },
                    (Some((true, hint)), false) => Sorting {
                        category: "facturi_vanzare",
                        confidence: 50,
                        reason: format!(
                            "factură de vânzare după numele folderului („{hint}”); CUI-ul emitentului nu s-a putut citi"
                        ),
                    },
                    (Some((false, hint)), true) => Sorting {
                        category: "facturi_achizitie",
                        confidence: 50,
                        reason: format!(
                            "factură de achiziție după numele folderului („{hint}”); nu știu CUI-ul firmei (Setări)"
                        ),
                    },
                    (Some((false, hint)), false) => Sorting {
                        category: "facturi_achizitie",
                        confidence: 50,
                        reason: format!(
                            "factură de achiziție după numele folderului („{hint}”); CUI-ul emitentului nu s-a putut citi"
                        ),
                    },
                    (None, true) => Sorting {
                        category: "facturi_achizitie",
                        confidence: 45,
                        reason: "factură; nu știu CUI-ul firmei, deci nici dacă e de vânzare sau de achiziție (Setări)"
                            .into(),
                    },
                    (None, false) => Sorting {
                        category: "facturi_achizitie",
                        confidence: 45,
                        reason: "factură fără CUI-ul emitentului citit".into(),
                    },
                }
            }
        };
    }
    let folded: String = fold(text).chars().take(30_000).collect();
    let mut score: BTreeMap<&'static str, (i64, Vec<String>)> = BTreeMap::new();
    for (cat, phrase, w) in PHRASES {
        let n = folded.matches(phrase).count().min(3) as i64;
        if n > 0 {
            let e = score.entry(cat).or_default();
            e.0 += w * n;
            e.1.push(format!("„{}”", phrase.trim()));
        }
    }
    let names = words_of(path).join(" ");
    let names = format!(" {names} ");
    for (hint, cat) in NAME_HINTS {
        let hit = if hint.len() <= 3 {
            names.contains(&format!(" {hint} "))
        } else {
            names.contains(hint)
        };
        if hit {
            let e = score.entry(cat).or_default();
            e.0 += 3;
            e.1.push(format!("„{hint}” în nume"));
        }
    }
    // A labour contract is a contract too: the general one only when nothing more precise was found.
    if score.contains_key("contracte_munca") {
        score.remove("contracte");
    }
    let best = score
        .iter()
        .max_by_key(|(c, (n, _))| (*n, std::cmp::Reverse(**c)))
        .map(|(c, (n, why))| (*c, *n, why.clone()));
    let Some((cat, n, why)) = best else {
        return Sorting {
            category: "altele",
            confidence: if folded.is_empty() { 20 } else { 30 },
            reason: if folded.is_empty() {
                "fără text citit și fără indicii în nume".into()
            } else {
                "niciun indiciu cunoscut".into()
            },
        };
    };
    let confidence = match n {
        n if n >= 8 => 90,
        n if n >= 5 => 80,
        n if n >= 3 => 65,
        _ => 45,
    };
    let reason = format!("am găsit {}", why.into_iter().take(4).collect::<Vec<_>>().join(", "));
    let (category, confidence, reason): (&'static str, i64, String) = match cat {
        // A contract: with a client when the firm is the provider, with a supplier when it is the beneficiary.
        "contracte" => {
            let side = contract_side(&folded, firm);
            match side {
                Some(true) => (
                    "contracte_clienti",
                    confidence.min(70),
                    format!("{reason}; firma apare ca prestator / vânzător"),
                ),
                Some(false) => (
                    "contracte_furnizori",
                    confidence.min(70),
                    format!("{reason}; firma apare ca beneficiar / cumpărător"),
                ),
                None => (
                    "contracte_clienti",
                    confidence.min(50),
                    format!("{reason}; nu știu dacă firma e prestator sau beneficiar"),
                ),
            }
        }
        "factura" => (
            "facturi_achizitie",
            confidence.min(50),
            format!("{reason}; numărul sau totalul facturii nu s-au putut citi"),
        ),
        c => (
            CATEGORIES.iter().find(|(k, _)| *k == c).map_or("altele", |(k, _)| *k),
            confidence,
            reason,
        ),
    };
    Sorting {
        category,
        confidence,
        reason: reason.chars().take(300).collect(),
    }
}

/// Sales (`true`) or purchases (`false`) from the names of the folders („Facturi/emise”, „Achiziții”), with the
/// word found; the last folder that says it wins.
fn side_by_folder(path: &str) -> Option<(bool, &'static str)> {
    const SALES: [&str; 6] = ["emise", "vanzari", "vanzare", "iesire", "iesiri", "clienti"];
    const PURCHASES: [&str; 7] = [
        "primite",
        "achizitii",
        "achizitie",
        "furnizori",
        "intrare",
        "intrari",
        "cheltuieli",
    ];
    let words = words_of(path);
    words.iter().rev().find_map(|w| {
        SALES
            .iter()
            .find(|x| *x == w)
            .map(|x| (true, *x))
            .or_else(|| PURCHASES.iter().find(|x| *x == w).map(|x| (false, *x)))
    })
}

/// Whether the firm (by its CUI) is the provider (`true`) or the beneficiary (`false`) of a contract: the role
/// word written closest before the firm's CUI.
fn contract_side(folded: &str, firm: &str) -> Option<bool> {
    if firm.is_empty() {
        return None;
    }
    let at = folded.find(&firm.to_lowercase())?;
    let before = &folded[..at];
    let window: String = before
        .chars()
        .rev()
        .take(400)
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    let last = |words: &[&str]| words.iter().filter_map(|w| window.rfind(w)).max();
    let provider = last(&["prestator", "vanzator", "furnizor", "locator", "executant"]);
    let beneficiary = last(&["beneficiar", "cumparator", "client", "locatar", "chirias", "achizitor"]);
    match (provider, beneficiary) {
        (Some(p), Some(b)) => Some(p > b),
        (Some(_), None) => Some(true),
        (None, Some(_)) => Some(false),
        (None, None) => None,
    }
}

// ---------- the module ----------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Add {
    name: String,
    data: String,
    #[serde(default)]
    cale: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ListArgs {
    #[serde(default)]
    categorie: Option<String>,
    #[serde(default)]
    text: String,
    #[serde(default)]
    de_confirmat: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Confirm {
    id: Uuid,
    version: u64,
    categorie: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct InvoiceSave {
    id: Uuid,
    version: u64,
    factura: Map<String, Value>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ByIdVersion {
    id: Uuid,
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SaveCopy {
    id: Uuid,
    dest: PathBuf,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SettingsSave {
    cui_firma: String,
    #[serde(default)]
    version: Option<u64>,
}

fn known(cat: &str) -> bool {
    CATEGORIES.iter().any(|(k, _)| *k == cat)
}

fn view(r: &RecordState) -> Value {
    json!({
        "id": r.id, "version": r.version, "doc": s(r, "doc"), "nume": s(r, "nume"), "cale": s(r, "cale"), "tip": s(r, "tip"),
        "hash": s(r, "hash"), "marime": i(r, "marime"), "categorie": s(r, "categorie"), "incredere": i(r, "incredere"),
        "motiv": s(r, "motiv"), "confirmata": r.fields.get("confirmata") == Some(&json!(true)),
        "factura": r.fields.get("factura").cloned().unwrap_or(Value::Null), "sursa": s(r, "sursa"), "nota": s(r, "nota"),
        "adaugat_ms": i(r, "adaugat_ms"),
    })
}

fn invoice_of(r: &RecordState) -> Option<Invoice> {
    let f = r.fields.get("factura")?.as_object()?;
    let g = |k: &str| f.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    if g("numar").is_empty() {
        return None;
    }
    Some(Invoice {
        emitent_cui: g("emitent_cui"),
        emitent: g("emitent"),
        client_cui: g("client_cui"),
        serie: g("serie"),
        numar: g("numar"),
        data: g("data"),
        total: f.get("total").and_then(Value::as_i64),
    })
}

impl Vault {
    fn all(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Vec<RecordState>> {
        ctx.scan(DOCUMENTS, |r| !r.deleted)
    }

    fn live(&self, ctx: &mut ModuleContext<'_>, id: Uuid) -> CoreResult<RecordState> {
        ctx.get(DOCUMENTS, id)?
            .filter(|r| !r.deleted)
            .ok_or_else(|| bad("documentul", "nu mai există în depozit"))
    }

    fn firm(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<(String, Option<u64>)> {
        Ok(match ctx.get(SETTINGS, SETTINGS_ID)?.filter(|r| !r.deleted) {
            Some(r) => (cui_key(&s(&r, "cui_firma")), Some(r.version)),
            None => (String::new(), None),
        })
    }

    fn add(&self, ctx: &mut ModuleContext<'_>, a: Add) -> CoreResult<Value> {
        let name = a.name.trim().to_string();
        if name.is_empty() || name.chars().count() > 255 {
            return Err(bad("numele fișierului", "are 1–255 de caractere"));
        }
        let data = B64
            .decode(a.data.as_bytes())
            .map_err(|e| bad("fișierul", e.to_string()))?;
        if data.is_empty() {
            return Err(bad("fișierul", format!("„{name}” e gol")));
        }
        let hash = blake3::hash(&data).to_hex().to_string();
        // The same bytes are kept once: the answer names the document already there.
        let key = json!(hash);
        if let Some(r) = ctx
            .scan(DOCUMENTS, |r| !r.deleted && r.fields.get("hash") == Some(&key))?
            .into_iter()
            .next()
        {
            return Ok(json!({"exista": true, "id": r.id, "nume": s(&r, "nume"), "categorie": s(&r, "categorie")}));
        }
        let cale: String = a.cale.trim().chars().take(500).collect();
        let (text, invoice, how) = read_file(&name, &data);
        let (firm, _) = self.firm(ctx)?;
        let path = if cale.is_empty() { name.clone() } else { cale.clone() };
        let mut sorting = sort(&path, &text, invoice.as_ref(), &firm);
        if text.is_empty() && invoice.is_none() {
            sorting.confidence = sorting.confidence.min(50);
            sorting.reason = format!("{how}: doar după nume; {}", sorting.reason)
                .chars()
                .take(300)
                .collect();
        }
        // The same invoice from another file (a PDF and its XML): kept, and named in the answer.
        let twin = match invoice.as_ref().and_then(invoice_key) {
            Some(k) => self
                .all(ctx)?
                .into_iter()
                .find(|r| invoice_of(r).and_then(|i| invoice_key(&i)) == Some(k.clone()))
                .map(|r| json!({"id": r.id, "nume": s(&r, "nume"), "sigur": invoice_of(&r).is_some_and(|i| same_invoice(&i, invoice.as_ref().expect("has a key")))})),
            None => None,
        };
        let doc = ctx.import_document(&name, &data)?;
        let id = Uuid::now_v7();
        let kept: String = hide_cnp(&text.chars().take(TEXT_KEPT + 200).collect::<String>())
            .chars()
            .take(TEXT_KEPT)
            .collect();
        let mut f = Fields::new();
        f.insert("doc".into(), json!(doc.id.to_string()));
        f.insert("nume".into(), json!(name));
        f.insert("cale".into(), json!(cale));
        f.insert("tip".into(), json!(doc.kind.chars().take(10).collect::<String>()));
        f.insert("hash".into(), json!(hash));
        f.insert("marime".into(), json!(data.len()));
        f.insert("categorie".into(), json!(sorting.category));
        f.insert("incredere".into(), json!(sorting.confidence));
        f.insert("motiv".into(), json!(sorting.reason));
        f.insert("confirmata".into(), json!(sorting.confidence >= SURE));
        f.insert("factura".into(), invoice.as_ref().map_or(json!({}), Invoice::to_json));
        f.insert("text".into(), json!(kept));
        f.insert("sursa".into(), json!("depozit"));
        f.insert("nota".into(), json!(""));
        f.insert("adaugat_ms".into(), json!(now_ms() as i64));
        ctx.write(vec![Write::put(DOCUMENTS, id, f).expect(0)])?;
        ctx.log(&format!("document {id} adăugat în depozit ({})", sorting.category));
        Ok(
            json!({"exista": false, "id": id, "nume": name, "categorie": sorting.category, "incredere": sorting.confidence,
                  "motiv": sorting.reason, "factura": invoice.as_ref().map(Invoice::to_json), "dublura_de": twin}),
        )
    }

    fn list(&self, ctx: &mut ModuleContext<'_>, a: ListArgs) -> CoreResult<Value> {
        let q = fold(a.text.trim());
        let mut l: Vec<RecordState> = self
            .all(ctx)?
            .into_iter()
            .filter(|r| {
                a.categorie
                    .as_ref()
                    .is_none_or(|c| c.is_empty() || *c == s(r, "categorie"))
            })
            .filter(|r| !a.de_confirmat || r.fields.get("confirmata") != Some(&json!(true)))
            .filter(|r| {
                q.is_empty()
                    || fold(&s(r, "nume")).contains(&q)
                    || fold(&s(r, "cale")).contains(&q)
                    || fold(&s(r, "text")).contains(&q)
            })
            .collect();
        l.sort_by_key(|r| (s(r, "categorie"), fold(&s(r, "cale")), fold(&s(r, "nume"))));
        Ok(json!(l.iter().map(view).collect::<Vec<_>>()))
    }

    /// The invoices of the vault found more than once (another file of the same invoice, or the same number with
    /// another date or total).
    fn duplicates(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let all = self.all(ctx)?;
        let items: Vec<(Uuid, Invoice)> = all.iter().filter_map(|r| invoice_of(r).map(|i| (r.id, i))).collect();
        let groups = duplicate_groups(&items);
        Ok(json!(
            groups
                .iter()
                .map(|(ids, sure)| {
                    let docs: Vec<Value> = all.iter().filter(|r| ids.contains(&r.id)).map(view).collect();
                    json!({"sigur": sure, "documente": docs})
                })
                .collect::<Vec<_>>()
        ))
    }

    /// 7.10b: what the firm's papers say about the firm, field by field, each value with the documents it was
    /// read from; two documents that disagree give two proposals, and the person chooses.
    fn firm_profile(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let mut found: Vec<(&'static str, String, Vec<String>)> = Vec::new();
        let mut docs = self.all(ctx)?;
        docs.retain(|r| s(r, "categorie") == "identitate");
        docs.sort_by_key(|r| std::cmp::Reverse(i(r, "adaugat_ms")));
        for r in &docs {
            let f = firm::firm_from_text(&s(r, "text"));
            for (camp, v) in [
                ("nume", f.nume),
                ("cui", f.cui),
                ("reg_com", f.reg_com),
                ("adresa", f.adresa),
            ] {
                if v.is_empty() {
                    continue;
                }
                match found.iter_mut().find(|(c, x, _)| *c == camp && *x == v) {
                    Some((_, _, from)) => from.push(s(r, "nume")),
                    None => found.push((camp, v, vec![s(r, "nume")])),
                }
            }
        }
        Ok(json!({
            "documente": docs.len(),
            "propuneri": found.iter().map(|(c, v, from)| json!({"camp": c, "valoare": v, "din": from})).collect::<Vec<_>>(),
        }))
    }

    /// 7.10b: for each document of „Autorizații și avize”, what its text says about the permit (title, number,
    /// issue day, end of validity, institution), for the permit's form in „Permise și autorizații”.
    fn permit_proposals(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let mut docs = self.all(ctx)?;
        docs.retain(|r| s(r, "categorie") == "autorizatii");
        docs.sort_by_key(|r| std::cmp::Reverse(i(r, "adaugat_ms")));
        Ok(json!(
            docs.iter()
                .map(|r| {
                    let p = permit::permit_from_text(&s(r, "text"));
                    json!({"doc": r.id, "nume": s(r, "nume"), "titlu": p.titlu, "numar": p.numar, "emisa": p.emisa,
                       "valabila_pana": p.valabila_pana, "institutie": p.institutie})
                })
                .collect::<Vec<_>>()
        ))
    }

    fn summary(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let all = self.all(ctx)?;
        let (firm, version) = self.firm(ctx)?;
        Ok(json!({
            "total": all.len(),
            "de_confirmat": all.iter().filter(|r| r.fields.get("confirmata") != Some(&json!(true))).count(),
            "cui_firma": firm, "setari_version": version,
            "categorii": CATEGORIES.iter().map(|(k, n)| json!({"id": k, "nume": n,
                "documente": all.iter().filter(|r| s(r, "categorie") == *k).count()})).collect::<Vec<_>>(),
        }))
    }

    fn confirm(&self, ctx: &mut ModuleContext<'_>, a: Confirm) -> CoreResult<Value> {
        if !known(&a.categorie) {
            return Err(bad("categoria", format!("„{}” nu există", a.categorie)));
        }
        let r = self.live(ctx, a.id)?;
        let mut f = r.fields.clone();
        if s(&r, "categorie") != a.categorie {
            f.insert("motiv".into(), json!("aleasă de om"));
            f.insert("incredere".into(), json!(100));
        }
        f.insert("categorie".into(), json!(a.categorie));
        f.insert("confirmata".into(), json!(true));
        ctx.write(vec![Write::put(DOCUMENTS, a.id, f).expect(a.version)])?;
        Ok(json!({"id": a.id, "categorie": a.categorie}))
    }

    fn invoice_save(&self, ctx: &mut ModuleContext<'_>, a: InvoiceSave) -> CoreResult<Value> {
        let r = self.live(ctx, a.id)?;
        let g = |k: &str| {
            a.factura
                .get(k)
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim()
                .to_string()
        };
        let (serie, numar) = split_number(&format!("{}{}", g("serie"), g("numar")), "");
        if numar.is_empty() {
            return Err(bad("factura", "are nevoie de un număr"));
        }
        let data = if g("data").is_empty() {
            String::new()
        } else {
            iso_date(&g("data")).ok_or_else(|| bad("data facturii", format!("„{}” nu e o dată", g("data"))))?
        };
        let total = match a.factura.get("total") {
            Some(Value::Number(n)) => n.as_i64(),
            Some(Value::String(t)) if !t.trim().is_empty() => {
                Some(bani(t).ok_or_else(|| bad("totalul", format!("„{t}” nu e o sumă")))?)
            }
            _ => None,
        };
        let inv = Invoice {
            emitent_cui: cui_key(&g("emitent_cui")),
            emitent: g("emitent").chars().take(200).collect(),
            client_cui: cui_key(&g("client_cui")),
            serie,
            numar,
            data,
            total,
        };
        let (firm, _) = self.firm(ctx)?;
        let mut f = r.fields.clone();
        f.insert("factura".into(), inv.to_json());
        if r.fields.get("confirmata") != Some(&json!(true)) || s(&r, "categorie").starts_with("facturi") {
            let so = sort("", "", Some(&inv), &firm);
            f.insert("categorie".into(), json!(so.category));
            f.insert("incredere".into(), json!(so.confidence));
            f.insert(
                "motiv".into(),
                json!(
                    format!("datele facturii scrise de om; {}", so.reason)
                        .chars()
                        .take(300)
                        .collect::<String>()
                ),
            );
        }
        ctx.write(vec![Write::put(DOCUMENTS, a.id, f).expect(a.version)])?;
        Ok(json!({"id": a.id, "factura": inv.to_json()}))
    }

    /// The firm's CUI; the documents not yet confirmed are sorted again with it.
    fn settings_save(&self, ctx: &mut ModuleContext<'_>, a: SettingsSave) -> CoreResult<Value> {
        let cui = cui_key(&a.cui_firma);
        if !cui.is_empty() && (!cui.chars().all(|c| c.is_ascii_digit()) || !kgb_extract::fields::cui_valid(&cui)) {
            return Err(bad("CUI-ul firmei", format!("„{}” nu e un CUI valid", a.cui_firma)));
        }
        let (_, version) = self.firm(ctx)?;
        let mut f = Fields::new();
        f.insert("cui_firma".into(), json!(cui));
        let mut w = vec![Write::put(SETTINGS, SETTINGS_ID, f).expect(a.version.or(version).unwrap_or(0))];
        let mut again = 0;
        for r in self.all(ctx)? {
            if r.fields.get("confirmata") == Some(&json!(true)) {
                continue;
            }
            let so = sort(
                &if s(&r, "cale").is_empty() {
                    s(&r, "nume")
                } else {
                    s(&r, "cale")
                },
                &s(&r, "text"),
                invoice_of(&r).as_ref(),
                &cui,
            );
            if so.category != s(&r, "categorie") || so.confidence != i(&r, "incredere") {
                let mut f = r.fields.clone();
                f.insert("categorie".into(), json!(so.category));
                f.insert("incredere".into(), json!(so.confidence));
                f.insert("motiv".into(), json!(so.reason));
                f.insert("confirmata".into(), json!(so.confidence >= SURE));
                w.push(Write::put(DOCUMENTS, r.id, f).expect(r.version));
                again += 1;
            }
        }
        ctx.write(w)?;
        Ok(json!({"cui_firma": cui, "resortate": again}))
    }
}

impl Module for Vault {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "adauga" => self.add(ctx, args(command, a)?),
            "lista" => self.list(ctx, args(command, a)?),
            "rezumat" => self.summary(ctx),
            "dubluri" => self.duplicates(ctx),
            "profil_firma" => self.firm_profile(ctx),
            "autorizatii_propuse" => self.permit_proposals(ctx),
            "confirma" => self.confirm(ctx, args(command, a)?),
            "factura_save" => self.invoice_save(ctx, args(command, a)?),
            "sterge" => {
                let a: ByIdVersion = args(command, a)?;
                let r = self.live(ctx, a.id)?;
                ctx.write(vec![Write::delete(DOCUMENTS, a.id).expect(a.version)])?;
                if let Ok(doc) = s(&r, "doc").parse::<Uuid>() {
                    ctx.delete_document(doc)?;
                }
                Ok(json!({"deleted": a.id}))
            }
            "salveaza_copie" => {
                let a: SaveCopy = args(command, a)?;
                let r = self.live(ctx, a.id)?;
                let doc: Uuid = s(&r, "doc").parse().map_err(|_| bad("documentul", "nu are fișier"))?;
                ctx.export_document(doc, Some(1), &a.dest, false)?;
                Ok(json!({"salvat": a.dest}))
            }
            "setari" => {
                let (cui, version) = self.firm(ctx)?;
                Ok(json!({"cui_firma": cui, "version": version}))
            }
            "setari_save" => self.settings_save(ctx, args(command, a)?),
            other => Err(CoreError::invalid("comanda", format!("„{other}” nu există în {ID}"))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalising() {
        assert_eq!(cui_key(" ro 143 998 40 "), "14399840");
        assert_eq!(split_number("KGB 0012", ""), ("KGB".into(), "12".into()));
        assert_eq!(split_number("0012", "abc"), ("ABC".into(), "12".into()));
        assert_eq!(split_number("F-2026-007", ""), ("F2026".into(), "7".into()));
        assert_eq!(split_number("000", ""), ("".into(), "0".into()));
        assert_eq!(bani("1.210,00"), Some(121_000));
        assert_eq!(bani("1210.5"), Some(121_050));
        assert_eq!(iso_date("05.11.2026").as_deref(), Some("2026-11-05"));
        assert_eq!(iso_date("2026-11-05").as_deref(), Some("2026-11-05"));
        assert_eq!(
            hide_cnp("CNP 1960101123456, tel 0722000111"),
            "CNP •••••••••••••, tel 0722000111"
        );
        assert_eq!(hide_cnp("12345678901234"), "12345678901234", "14 digits are not a CNP");
        assert_eq!(
            hide_cnp("Nr. ord. RC: J2002001234220"),
            "Nr. ord. RC: J2002001234220",
            "a trade register number"
        );
        assert_eq!(hide_cnp("CNP:1960101123456"), "CNP:•••••••••••••");
        assert_eq!(fold("Contract  Individual\nde MUNCĂ"), "contract individual de munca");
    }
}
