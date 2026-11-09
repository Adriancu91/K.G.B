//! Invoices received through RO e-Factura (Etapa 7, step 7.4j; idea from the
//! owner's ERP, code written here): the UBL 2.1 XML (CIUS-RO) a supplier sent,
//! or the ZIP archive downloaded from SPV (the invoice XML plus ANAF's
//! signature file). Each invoice becomes an expense in Business, with its
//! supplier found by CUI or added to the Business partners.
//!
//! - Only reading: nothing is sent to ANAF; the XML is not validated against
//!   the official schema, only read; a credit note (`CreditNote`) is refused
//!   for now, with a message.
//! - Money is read from the decimal text exactly, into bani (no floating point).
//! - The same invoice twice is refused by the expense rules (same supplier and
//!   number), so importing the same archive again adds nothing.

use std::io::{Cursor, Read};

use quick_xml::Reader;
use quick_xml::events::Event;
use serde::Serialize;

/// What K.G.B. takes from one e-Factura invoice.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct EInvoice {
    pub numar: String,
    pub data: String,
    pub scadenta: String,
    pub moneda: String,
    pub furnizor_nume: String,
    pub furnizor_cui: String,
    /// In bani.
    pub total_fara_tva: i64,
    pub tva: i64,
    pub total: i64,
    pub linii: Vec<Line>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct Line {
    pub denumire: String,
    pub cantitate: String,
    pub valoare: i64,
    pub cota_tva: String,
}

/// "1210.5" → 121050 bani; at most 2 decimals (more is refused, not rounded).
pub fn money(t: &str) -> Result<i64, String> {
    let t = t.trim();
    let (neg, t) = t.strip_prefix('-').map_or((false, t), |r| (true, r));
    let (w, f) = t.split_once('.').unwrap_or((t, ""));
    if w.is_empty() || !w.bytes().all(|b| b.is_ascii_digit()) || f.len() > 2 || !f.bytes().all(|b| b.is_ascii_digit()) {
        return Err(format!("suma „{t}” nu e scrisă ca în e-Factura (de ex. 1210.50)"));
    }
    let mut cents = f.to_string();
    while cents.len() < 2 {
        cents.push('0');
    }
    let v = w.parse::<i64>().map_err(|_| format!("suma „{t}” e prea mare"))? * 100 + cents.parse::<i64>().unwrap_or(0);
    Ok(if neg { -v } else { v })
}

fn text(ev: &Event<'_>) -> String {
    match ev {
        Event::Text(t) => t.xml10_content().into_owned(),
        Event::GeneralRef(r) => match r.as_ref() {
            "amp" => "&".into(),
            "lt" => "<".into(),
            "gt" => ">".into(),
            "quot" => "\"".into(),
            "apos" => "'".into(),
            _ => String::new(),
        },
        _ => String::new(),
    }
}

/// Reads one UBL invoice.
pub fn parse(xml: &str) -> Result<EInvoice, String> {
    let mut r = Reader::from_str(xml);
    // Not trimmed: "Test &amp; Co" must keep its spaces; values are trimmed below.
    r.config_mut().trim_text(false);
    let mut path: Vec<String> = Vec::new();
    let mut inv = EInvoice::default();
    let mut root = String::new();
    let mut line: Option<Line> = None;
    let mut tax_total_seen = false;
    let mut in_tax_total = 0;
    loop {
        let ev = r.read_event().map_err(|e| format!("XML-ul nu se poate citi: {e}"))?;
        match &ev {
            Event::Eof => break,
            Event::Start(s) => {
                let name = s.local_name().as_ref().to_string();
                if path.is_empty() {
                    root = name.clone();
                }
                if path.len() == 1 && name == "InvoiceLine" {
                    line = Some(Line::default());
                }
                if path.len() == 1 && name == "TaxTotal" {
                    in_tax_total += 1;
                }
                path.push(name);
            }
            Event::End(_) => {
                let closed = path.pop().unwrap_or_default();
                if path.len() == 1
                    && closed == "InvoiceLine"
                    && let Some(l) = line.take()
                {
                    inv.linii.push(l);
                }
                if path.len() == 1 && closed == "TaxTotal" {
                    tax_total_seen = true;
                }
            }
            Event::Text(_) | Event::GeneralRef(_) => {
                let t = text(&ev);
                let p: Vec<&str> = path.iter().map(String::as_str).collect();
                match p.as_slice() {
                    [_, "ID"] => inv.numar.push_str(&t),
                    [_, "IssueDate"] => inv.data = t.trim().to_string(),
                    [_, "DueDate"] => inv.scadenta = t.trim().to_string(),
                    [_, "DocumentCurrencyCode"] => inv.moneda = t.trim().to_string(),
                    [_, "AccountingSupplierParty", "Party", "PartyLegalEntity", "RegistrationName"] => inv.furnizor_nume.push_str(&t),
                    [_, "AccountingSupplierParty", "Party", "PartyTaxScheme", "CompanyID"] => inv.furnizor_cui = t.trim().to_string(),
                    [_, "AccountingSupplierParty", "Party", "PartyLegalEntity", "CompanyID"] if inv.furnizor_cui.is_empty() => inv.furnizor_cui = t.trim().to_string(),
                    [_, "TaxTotal", "TaxAmount"] if !tax_total_seen && in_tax_total == 1 => inv.tva = money(&t)?,
                    [_, "LegalMonetaryTotal", "TaxExclusiveAmount"] => inv.total_fara_tva = money(&t)?,
                    [_, "LegalMonetaryTotal", "PayableAmount"] => inv.total = money(&t)?,
                    [_, "InvoiceLine", "Item", "Name"] => {
                        if let Some(l) = line.as_mut() {
                            l.denumire.push_str(&t);
                        }
                    }
                    [_, "InvoiceLine", "InvoicedQuantity"] => {
                        if let Some(l) = line.as_mut() {
                            l.cantitate = t.trim().to_string();
                        }
                    }
                    [_, "InvoiceLine", "LineExtensionAmount"] => {
                        if let Some(l) = line.as_mut() {
                            l.valoare = money(&t)?;
                        }
                    }
                    [_, "InvoiceLine", "Item", "ClassifiedTaxCategory", "Percent"] => {
                        if let Some(l) = line.as_mut() {
                            l.cota_tva = t.trim().to_string();
                        }
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    }
    match root.as_str() {
        "Invoice" => {}
        "CreditNote" => return Err("este o notă de credit; acestea nu se importă încă (se trec de mână ca storno)".into()),
        _ => return Err("nu este o factură e-Factura (UBL)".into()),
    }
    if inv.numar.trim().is_empty() || inv.data.is_empty() || inv.furnizor_nume.trim().is_empty() {
        return Err("factura nu are număr, dată sau furnizor".into());
    }
    if !inv.moneda.is_empty() && inv.moneda != "RON" {
        return Err(format!("factura e în {}; deocamdată se importă doar facturi în lei", inv.moneda));
    }
    // What is payable is kept as the total (it can differ from net + VAT by prepaid amounts).
    inv.numar = inv.numar.trim().to_string();
    inv.furnizor_nume = inv.furnizor_nume.trim().to_string();
    for l in &mut inv.linii {
        l.denumire = l.denumire.trim().to_string();
    }
    Ok(inv)
}

/// The invoices in a file: one XML, or a ZIP from SPV (the signature file
/// `semnatura_*.xml` is skipped).
pub fn read_file(data: &[u8], name: &str) -> Result<Vec<Result<EInvoice, String>>, String> {
    const MAX_XML: u64 = 10 * 1024 * 1024;
    if name.to_lowercase().ends_with(".zip") || data.starts_with(b"PK") {
        let mut z = zip::ZipArchive::new(Cursor::new(data)).map_err(|_| "arhiva nu se poate deschide".to_string())?;
        let mut out = Vec::new();
        for i in 0..z.len().min(200) {
            let mut f = z.by_index(i).map_err(|e| e.to_string())?;
            let fname = f.name().map_err(|e| e.to_string())?.to_lowercase();
            if !fname.ends_with(".xml") || fname.rsplit('/').next().is_some_and(|b| b.starts_with("semnatura")) {
                continue;
            }
            if f.size() > MAX_XML {
                out.push(Err(format!("{fname}: prea mare")));
                continue;
            }
            let mut xml = String::new();
            f.by_ref().take(MAX_XML).read_to_string(&mut xml).map_err(|_| format!("{fname}: nu e text UTF-8"))?;
            out.push(parse(&xml).map_err(|e| format!("{fname}: {e}")));
        }
        if out.is_empty() {
            return Err("arhiva nu conține nicio factură XML".into());
        }
        return Ok(out);
    }
    let xml = std::str::from_utf8(data.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(data)).map_err(|_| "fișierul nu e XML în UTF-8".to_string())?;
    Ok(vec![parse(xml)])
}

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use serde_json::{Value, json};

use crate::invoices::PARTNERS;
use crate::{Business, bad, num, s as field};

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Import {
    name: String,
    /// The file, base64.
    data: String,
    #[serde(default)]
    categorie: Option<String>,
}

fn digits(t: &str) -> String {
    t.chars().filter(char::is_ascii_digit).collect()
}

impl Business {
    /// Imports e-Factura invoices as expenses; returns what happened to each.
    pub(crate) fn efactura_import(&self, ctx: &mut ModuleContext<'_>, a: Import) -> CoreResult<Value> {
        use base64::Engine as _;
        let data = base64::engine::general_purpose::STANDARD
            .decode(a.data.as_bytes())
            .map_err(|_| bad("fișierul", "nu a ajuns întreg"))?;
        if data.len() > 20 * 1024 * 1024 {
            return Err(bad("fișierul", "e prea mare (cel mult 20 MB)"));
        }
        let invoices = read_file(&data, &a.name).map_err(|e| bad("e-Factura", e))?;
        let mut out = Vec::new();
        for r in invoices {
            let inv = match r {
                Ok(i) => i,
                Err(e) => {
                    out.push(json!({"ok": false, "motiv": e}));
                    continue;
                }
            };
            // The supplier: found by CUI among the Business partners, or added.
            let cui = digits(&inv.furnizor_cui);
            let found = if cui.is_empty() {
                None
            } else {
                ctx.scan(PARTNERS, |_| true)?.into_iter().find(|p| digits(&field(p, "cui")) == cui)
            };
            let partner = match found {
                Some(p) => p.id,
                None => {
                    let cui_text = if inv.furnizor_cui.trim().is_empty() { Value::Null } else { json!(inv.furnizor_cui.trim()) };
                    let v = self.partner_save(ctx, serde_json::from_value(json!({"nume": inv.furnizor_nume, "cui": cui_text, "tip": "furnizor"})).map_err(|e| bad("furnizorul", e.to_string()))?);
                    match v {
                        Ok(v) => v["id"].as_str().and_then(|x| x.parse().ok()).ok_or_else(|| bad("furnizorul", "nu s-a putut adăuga"))?,
                        Err(e) => {
                            out.push(json!({"ok": false, "numar": inv.numar, "furnizor": inv.furnizor_nume, "motiv": e.to_string()}));
                            continue;
                        }
                    }
                }
            };
            let save = json!({
                "furnizor": partner,
                "tip": "factura",
                "numar": inv.numar,
                "data": inv.data,
                "scadenta": if inv.scadenta.is_empty() { Value::Null } else { json!(inv.scadenta) },
                "categorie": a.categorie,
                "total_fara_tva": num::fmt_money(inv.total_fara_tva),
                "tva": num::fmt_money(inv.tva),
                "total": num::fmt_money(inv.total),
                "nota": format!("Importată din e-Factura ({}; {} linii)", a.name, inv.linii.len()),
            });
            let res = serde_json::from_value(save).map_err(|e| bad("cheltuiala", e.to_string())).and_then(|p| self.purchase_save(ctx, p));
            match res {
                Ok(v) => out.push(json!({"ok": true, "numar": inv.numar, "furnizor": inv.furnizor_nume, "total_text": num::fmt_money(inv.total), "cheltuiala": v["id"]})),
                Err(e) => out.push(json!({"ok": false, "numar": inv.numar, "furnizor": inv.furnizor_nume, "motiv": e.to_string()})),
            }
        }
        ctx.log("facturi importate din e-Factura");
        Ok(json!(out))
    }
}
