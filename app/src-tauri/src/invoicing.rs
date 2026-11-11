//! The online invoicing program, read only (D-089, step 7.10c).
//!
//! - The key is typed by the person, sealed with DPAPI for the Windows user of this PC (`facturare-online.json`
//!   next to the data, like `desktop.json`): not in the workspace, not synchronised, never in a log or a backup.
//!   The request signature that contains it is computed here only; the page never sees the key again.
//! - Only two reading requests exist here, both by invoice: `factura/getstatus` (value and amount paid) and
//!   `factura/print` (the link of the PDF); nothing else can be asked (the address is built from [`READS`] and
//!   refused otherwise; a test reads this file and fails on any writing request of the API).
//! - A run reads at most [`MAX_NUMBERS`] numbers of one series, one request a second, and without an end number
//!   stops after [`MISSING_IN_A_ROW`] numbers in a row that do not exist (a deleted invoice in the middle does not
//!   end it).
//! - The PDF is fetched only from the program's own site (`https`, a host ending in `fgo.ro`), and only when it
//!   starts as a PDF; what comes back goes to „Depozitul de documente” through the page, as any file.
//! - Only at the person's click, with the internet switched on (D-086) and the source approved in „Surse
//!   externe” (D-062): an active source of kind „api” whose address is the program's.

use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use zeroize::Zeroizing;

const FILE: &str = "facturare-online.json";
const ENTROPY: &[u8] = b"K.G.B. online invoicing key v1";
/// The reading requests, the only ones this file can make.
pub const READS: [&str; 2] = ["factura/getstatus", "factura/print"];
pub const MAX_NUMBERS: u64 = 500;
pub const MISSING_IN_A_ROW: u32 = 5;
const PAUSE: Duration = Duration::from_millis(1100);

#[derive(Serialize, Deserialize)]
struct Stored {
    cod_unic: String,
    platforma_url: String,
    /// `productie` (api.fgo.ro) or `test` (api-testuat.fgo.ro).
    mediu: String,
    /// The key sealed with DPAPI, base64.
    sealed: String,
}

#[derive(Serialize)]
pub struct Status {
    pub configurat: bool,
    pub cod_unic: String,
    pub platforma_url: String,
    pub mediu: String,
}

fn path(root: &Path) -> PathBuf {
    root.join(FILE)
}

fn host(mediu: &str) -> &'static str {
    if mediu == "test" {
        "api-testuat.fgo.ro"
    } else {
        "api.fgo.ro"
    }
}

/// Tests only, from the environment (never from a page): the small server the e2e starts on 127.0.0.1, answering
/// like the API (`http://127.0.0.1:<port>`).
fn test_base() -> Option<String> {
    std::env::var("KGB_TEST_INVOICING_BASE")
        .ok()
        .filter(|b| b.starts_with("http://127.0.0.1:"))
}

/// The address of a reading request; anything not in [`READS`] is refused before any network.
pub fn endpoint(mediu: &str, request: &str) -> Result<String, String> {
    if !READS.contains(&request) {
        return Err("cererea nu e una de citire".into());
    }
    Ok(match test_base() {
        Some(b) => format!("{b}/v1/{request}"),
        None => format!("https://{}/v1/{request}", host(mediu)),
    })
}

/// The request signature of the API: SHA-1 of CUI + key + invoice number, upper-case hex.
pub fn signature(cod_unic: &str, key: &str, number: &str) -> String {
    let mut h = sha1_smol::Sha1::new();
    h.update(cod_unic.as_bytes());
    h.update(key.as_bytes());
    h.update(number.as_bytes());
    h.digest().to_string().to_uppercase()
}

/// The host of an `https://` address (lower case), or nothing for any other address or one with a user, a
/// password or a port in it.
fn https_host(url: &str) -> Option<String> {
    let rest = url.trim().strip_prefix("https://")?;
    let host = rest.split(['/', '?', '#']).next()?.to_lowercase();
    (!host.is_empty() && !host.contains(['@', ':', ' ', '\\'])).then_some(host)
}

/// An address of the program's own site (`https`, a host that is `fgo.ro` or ends in `.fgo.ro`).
pub fn program_address(url: &str) -> bool {
    https_host(url).is_some_and(|h| h == "fgo.ro" || h.ends_with(".fgo.ro"))
}

/// A PDF link of the program's own site.
pub fn pdf_link_ok(link: &str) -> bool {
    program_address(link)
}

pub fn status(root: &Path) -> Status {
    match std::fs::read(path(root))
        .ok()
        .and_then(|b| serde_json::from_slice::<Stored>(&b).ok())
    {
        Some(s) => Status {
            configurat: true,
            cod_unic: s.cod_unic,
            platforma_url: s.platforma_url,
            mediu: s.mediu,
        },
        None => Status {
            configurat: false,
            cod_unic: String::new(),
            platforma_url: String::new(),
            mediu: "productie".into(),
        },
    }
}

pub fn set(root: &Path, cod_unic: &str, key: &str, platforma_url: &str, mediu: &str) -> Result<(), String> {
    let cod = kgb_core::ids::cui_clean(cod_unic);
    let cod = cod.strip_prefix("RO").unwrap_or(&cod).to_string();
    if !kgb_core::ids::cui_valid(&cod) {
        return Err("CUI-ul nu are cifra de control corectă".into());
    }
    let key = Zeroizing::new(key.trim().to_string());
    if key.is_empty() || key.chars().count() > 200 || key.chars().any(char::is_control) {
        return Err("cheia nu e bună (goală, prea lungă sau cu caractere de control)".into());
    }
    let url = platforma_url.trim();
    if !url.is_empty()
        && (!(url.starts_with("https://") || url.starts_with("http://"))
            || url.contains(char::is_whitespace)
            || url.len() > 200)
    {
        return Err("adresa aplicației (PlatformaUrl) nu e o adresă validă".into());
    }
    if mediu != "productie" && mediu != "test" {
        return Err("mediul e „productie” sau „test”".into());
    }
    let sealed =
        kgb_core::identity::seal(key.as_bytes(), ENTROPY).map_err(|e| format!("cheia nu s-a putut proteja: {e}"))?;
    let s = Stored {
        cod_unic: cod,
        platforma_url: url.to_string(),
        mediu: mediu.into(),
        sealed: base64::engine::general_purpose::STANDARD.encode(sealed),
    };
    let bytes = serde_json::to_vec_pretty(&s).map_err(|e| e.to_string())?;
    let tmp = path(root).with_extension("tmp");
    std::fs::write(&tmp, bytes).map_err(|e| format!("cheia nu s-a putut scrie: {e}"))?;
    std::fs::rename(&tmp, path(root)).map_err(|e| format!("cheia nu s-a putut scrie: {e}"))
}

pub fn forget(root: &Path) -> Result<(), String> {
    match std::fs::remove_file(path(root)) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("cheia nu s-a putut șterge: {e}")),
    }
}

fn load(root: &Path) -> Result<(Stored, Zeroizing<String>), String> {
    let b = std::fs::read(path(root))
        .map_err(|_| "cheia programului de facturare nu e pusă pe acest calculator".to_string())?;
    let s: Stored =
        serde_json::from_slice(&b).map_err(|_| "fișierul cheii e stricat; pune cheia din nou".to_string())?;
    let sealed = base64::engine::general_purpose::STANDARD
        .decode(&s.sealed)
        .map_err(|_| "fișierul cheii e stricat; pune cheia din nou".to_string())?;
    let key = kgb_core::identity::unseal(&sealed, ENTROPY).map_err(|_| {
        "cheia nu se poate deschide pe acest calculator (alt utilizator Windows?); pune-o din nou".to_string()
    })?;
    let key = Zeroizing::new(String::from_utf8(key).map_err(|_| "cheia e stricată".to_string())?);
    Ok((s, key))
}

/// One reading request; `Ok(None)` when the API answers that there is no such invoice.
async fn ask(s: &Stored, key: &str, request: &str, serie: &str, numar: &str) -> Result<Option<Value>, String> {
    let url = endpoint(&s.mediu, request)?;
    let body = json!({
        "CodUnic": s.cod_unic, "Hash": signature(&s.cod_unic, key, numar), "Numar": numar, "Serie": serie,
        "PlatformaUrl": s.platforma_url,
    })
    .to_string();
    let (status, text) = kgb_net::web::post_json(&url, body).await?;
    tracing::info!("programul de facturare online, la cererea omului: {request} {serie} {numar} → {status}");
    let v: Value =
        serde_json::from_str(&text).map_err(|_| format!("răspunsul programului nu e citibil (HTTP {status})"))?;
    if v.get("Success").and_then(Value::as_bool) == Some(true) {
        Ok(Some(v))
    } else if (200..500).contains(&status) {
        Ok(None)
    } else {
        Err(format!("programul a răspuns cu eroare (HTTP {status})"))
    }
}

fn bani(v: Option<&Value>) -> Option<i64> {
    match v? {
        Value::Number(n) => n.as_f64().map(|f| (f * 100.0).round() as i64),
        Value::String(s) => s
            .replace(',', ".")
            .trim()
            .parse::<f64>()
            .ok()
            .map(|f| (f * 100.0).round() as i64),
        _ => None,
    }
}

#[derive(Serialize)]
pub struct Found {
    pub serie: String,
    pub numar: String,
    pub valoare: Option<i64>,
    pub achitat: Option<i64>,
    /// The PDF, base64, when the program gave a link of its site and the file is a PDF.
    pub pdf: Option<String>,
    pub nota: String,
}

#[derive(Serialize)]
pub struct Run {
    pub facturi: Vec<Found>,
    pub citite: u64,
    pub oprit: String,
}

/// Reads the invoices `serie` `de_la`…`pana_la` (or until [`MISSING_IN_A_ROW`] missing in a row), at most
/// [`MAX_NUMBERS`] numbers, one request a second. `progress(n)` is told the number being read.
pub async fn read(
    root: &Path,
    serie: &str,
    de_la: u64,
    pana_la: Option<u64>,
    progress: impl Fn(u64),
) -> Result<Run, String> {
    let (s, key) = load(root)?;
    let serie = serie.trim().to_uppercase();
    if serie.is_empty() || serie.len() > 50 || !serie.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("seria e formată din litere, cifre și „-”".into());
    }
    if de_la == 0 {
        return Err("primul număr e cel puțin 1".into());
    }
    let last = pana_la.unwrap_or(u64::MAX).min(de_la.saturating_add(MAX_NUMBERS - 1));
    if last < de_la {
        return Err("ultimul număr e înaintea primului".into());
    }
    let mut out = Vec::new();
    let mut missing = 0;
    let mut n = de_la;
    let mut oprit = String::new();
    let mut citite = 0;
    while n <= last {
        progress(n);
        citite += 1;
        let numar = n.to_string();
        let st = ask(&s, &key, READS[0], &serie, &numar).await?;
        tokio::time::sleep(PAUSE).await;
        let Some(st) = st else {
            missing += 1;
            if pana_la.is_none() && missing >= MISSING_IN_A_ROW {
                oprit = format!("{MISSING_IN_A_ROW} numere la rând nu există");
                break;
            }
            n += 1;
            continue;
        };
        missing = 0;
        let f = st.get("Factura");
        let mut found = Found {
            serie: serie.clone(),
            numar: numar.clone(),
            valoare: bani(f.and_then(|f| f.get("Valoare"))),
            achitat: bani(f.and_then(|f| f.get("ValoareAchitata"))),
            pdf: None,
            nota: String::new(),
        };
        let pr = ask(&s, &key, READS[1], &serie, &numar).await?;
        tokio::time::sleep(PAUSE).await;
        match pr
            .as_ref()
            .and_then(|p| p.get("Factura"))
            .and_then(|f| f.get("Link"))
            .and_then(Value::as_str)
        {
            Some(link) if pdf_link_ok(link) || test_base().is_some_and(|b| link.starts_with(&format!("{b}/"))) => {
                let test = test_base().is_some();
                match kgb_net::web::user_fetch(link, kgb_net::web::Purpose::Page, None, test, test).await {
                    Ok(p) if p.data.starts_with(b"%PDF-") => {
                        found.pdf = Some(base64::engine::general_purpose::STANDARD.encode(&p.data));
                    }
                    Ok(_) => found.nota = "linkul nu a adus un PDF".into(),
                    Err(e) => found.nota = format!("PDF-ul nu s-a putut aduce: {e}"),
                }
            }
            Some(_) => found.nota = "linkul PDF nu e al programului; nu l-am deschis".into(),
            None => found.nota = "programul nu a dat linkul PDF".into(),
        }
        out.push(found);
        n += 1;
    }
    if oprit.is_empty() && n > last && pana_la.is_none_or(|p| p > last) {
        oprit = format!("cel mult {MAX_NUMBERS} numere la o citire");
    }
    Ok(Run {
        citite,
        facturi: out,
        oprit,
    })
}
