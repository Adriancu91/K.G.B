//! The official BNR exchange rates (Etapa 7, step 7.4e): EUR/RON and USD/RON
//! on the start page, with the day of the rate.
//!
//! - Source: the BNR daily XML (`https://curs.bnr.ro/nbrfxrates.xml`, from
//!   BNR's page for developers, read on 9 Nov 2026), only
//!   while that source is switched on in „Surse externe” (D-062). K.G.B. adds
//!   it filled in but switched off (D-063).
//! - Rates are kept as text and as whole ten-thousandths of a leu (no
//!   floating point, D-065), for the units BNR publishes them for (1, or 100
//!   with `multiplier="100"`, e.g. HUF).
//! - This file only reads the XML; the app fetches it.

use kgb_store::Store;
use serde::Serialize;
use uuid::Uuid;

use crate::error::{CoreError, CoreResult};
use crate::sources::{self, Source, SourceInput};

pub const BNR_URL: &str = "https://curs.bnr.ro/nbrfxrates.xml";
pub const BNR_TERMS_URL: &str = "https://www.bnr.ro/2281-termeni-si-conditii";
pub const BNR_TERMS: &str = "Termenii BNR (citiți pe 9 nov. 2026): acces liber; redistribuirea doar cu indicarea sursei; dacă datele sunt modificate, se spune explicit; la folosirea în servicii sau documente cu plată, clienții finali sunt informați că datele vin de pe site-ul BNR, unde sunt gratuite; fără sigla BNR. Recomandările BNR pentru preluarea automată: doar HTTPS, păstrare locală, cursul se actualizează după ora 13:00 în zilele bancare. Lista BNR nu obligă la folosirea cursurilor în tranzacții sau înregistrări contabile.";
pub const BNR_LICENCE: &str = "date publice BNR, cu mențiunea „Sursa: Banca Națională a României (www.bnr.ro)”";
pub const BNR_CHECKED: &str = "2026-11-09";
/// Credit shown with the rates.
pub const BNR_CREDIT: &str = "Sursa: Banca Națională a României (www.bnr.ro), unde cursul e disponibil gratuit";
const SOURCE_NAME: &str = "BNR — cursul oficial al zilei";

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("cursul BNR", detail)
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Rate {
    pub moneda: String,
    /// As published, e.g. "4.9771".
    pub text: String,
    /// Lei for `multiplicator` units, in ten-thousandths (53408 = 5,3408 lei).
    pub zecimi_de_mii: i64,
    /// Units the published rate is for (1, or 100 for HUF, JPY…).
    pub multiplicator: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Day {
    /// The day the rates are for (AAAA-LL-ZZ).
    pub data: String,
    pub cursuri: Vec<Rate>,
}

impl Day {
    pub fn rate(&self, moneda: &str) -> Option<&Rate> {
        self.cursuri.iter().find(|r| r.moneda == moneda)
    }
}

fn attr(tag: &str, name: &str) -> Option<String> {
    let key = format!("{name}=\"");
    let i = tag.find(&key)? + key.len();
    let j = tag[i..].find('"')? + i;
    Some(tag[i..j].to_string())
}

/// "4.9771" → 49771 (exactly four decimals, as BNR publishes).
fn ten_thousandths(t: &str) -> Option<i64> {
    let (whole, frac) = t.split_once('.').unwrap_or((t, ""));
    if whole.is_empty()
        || !whole.bytes().all(|b| b.is_ascii_digit())
        || frac.len() > 4
        || !frac.bytes().all(|b| b.is_ascii_digit())
    {
        return None;
    }
    let mut f = frac.to_string();
    while f.len() < 4 {
        f.push('0');
    }
    Some(whole.parse::<i64>().ok()? * 10_000 + f.parse::<i64>().ok()?)
}

/// Reads the BNR XML: the last `<Cube date="…">` and its `<Rate>` elements.
pub fn parse(xml: &str) -> CoreResult<Day> {
    let cube = xml
        .rfind("<Cube ")
        .ok_or_else(|| bad("fișierul nu are cursul zilei (<Cube>)"))?;
    let rest = &xml[cube..];
    let head_end = rest.find('>').ok_or_else(|| bad("fișier stricat"))?;
    let data = attr(&rest[..head_end], "date").ok_or_else(|| bad("cursul nu are dată"))?;
    if data.len() != 10 || data.as_bytes()[4] != b'-' || data.as_bytes()[7] != b'-' {
        return Err(bad(format!("data „{data}” nu e AAAA-LL-ZZ")));
    }
    let body = &rest[head_end + 1..rest.find("</Cube>").unwrap_or(rest.len())];
    let mut cursuri = Vec::new();
    let mut at = 0;
    while let Some(i) = body[at..].find("<Rate") {
        let s = at + i;
        let gt = body[s..].find('>').ok_or_else(|| bad("fișier stricat"))? + s;
        let end = body[gt..].find("</Rate>").ok_or_else(|| bad("fișier stricat"))? + gt;
        let tag = &body[s..gt];
        let moneda = attr(tag, "currency").ok_or_else(|| bad("un curs nu are moneda"))?;
        let multiplicator: u32 = attr(tag, "multiplier").and_then(|m| m.parse().ok()).unwrap_or(1);
        let text = body[gt + 1..end].trim().to_string();
        let v = ten_thousandths(&text).ok_or_else(|| bad(format!("cursul „{text}” pentru {moneda} nu e un număr")))?;
        cursuri.push(Rate {
            zecimi_de_mii: v,
            moneda,
            text,
            multiplicator,
        });
        at = end + 7;
    }
    if cursuri.is_empty() {
        return Err(bad("fișierul nu are niciun curs"));
    }
    Ok(Day { data, cursuri })
}

/// The same id on every PC.
pub fn source_id() -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_URL, BNR_URL.as_bytes())
}

pub fn source(store: &Store) -> CoreResult<Option<Source>> {
    Ok(sources::list(store)?.into_iter().find(|s| s.url == BNR_URL))
}

/// Adds the BNR source, filled in but switched off, when there is none.
pub fn ensure_source(store: &mut Store) -> CoreResult<Uuid> {
    if let Some(s) = source(store)? {
        return Ok(s.id);
    }
    sources::add_fixed(
        store,
        source_id(),
        SourceInput {
            id: None,
            nume: SOURCE_NAME.into(),
            url: BNR_URL.into(),
            tip: "oficial".into(),
            termeni: BNR_TERMS.into(),
            termeni_url: BNR_TERMS_URL.into(),
            licenta: BNR_LICENCE.into(),
            verificat: BNR_CHECKED.into(),
            note: "Adăugată de K.G.B. completată, dar oprită: o pornește proprietarul (D-063). Cursul se citește cel mult o dată pe oră.".into(),
            version: 0,
        },
    )
}

pub fn usable(store: &Store) -> CoreResult<Source> {
    match source(store)? {
        Some(s) if s.activa => Ok(s),
        Some(_) => Err(bad("sursa BNR e oprită; o poți porni din „Surse externe”")),
        None => Err(bad("sursa BNR nu e în „Surse externe”")),
    }
}
