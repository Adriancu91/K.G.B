//! Offers to clients (Etapa 7, step 7.4k-1; idea from the owner's ERP, code
//! written here).
//!
//! - An offer has lines with VAT (computed like an invoice, in bani), a date
//!   and a "valid until" date. It is never changed after it is made: a new
//!   version is a copy.
//! - It expires by itself: an open offer past its date is shown "expirată"
//!   and can no longer be accepted (only copied as a new one).
//! - It is accepted, refused or closed with a reason (refused and closed need
//!   one); the day is recorded.
//! - The PDF is made from the offer's own data.

use std::collections::BTreeMap;

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::invoices::{COMPANY, PARTNERS, line_amounts};
use crate::{Business, PRODUCTS, bad, date, i, live, num, s, text};

pub(crate) const OFFERS: &str = "oferte";
pub const MAX_OFFER_LINES: usize = 200;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct OfferLine {
    #[serde(default)]
    produs: Option<Uuid>,
    #[serde(default)]
    descriere: Option<String>,
    #[serde(default)]
    um: Option<String>,
    cantitate: String,
    pret_unitar: String,
    cota_tva: i64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct OfferSave {
    partener: Uuid,
    data: String,
    valabil_pana: String,
    linii: Vec<OfferLine>,
    #[serde(default)]
    nota: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct OfferClose {
    id: Uuid,
    /// `acceptata`, `respinsa` or `inchisa`.
    stare: String,
    #[serde(default)]
    motiv: Option<String>,
    /// The day (AAAA-LL-ZZ).
    azi: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct OfferCopy {
    id: Uuid,
    data: String,
    valabil_pana: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct OfferList {
    azi: String,
}

/// A new offer, before it is numbered and written.
struct Draft {
    d: String,
    v: String,
    lines: Vec<Value>,
    net: i64,
    vat: i64,
    nota: Value,
    copy_of: Option<Uuid>,
}

/// What the screen shows: the stored state, or „expirata” for an open offer
/// past its date.
pub fn shown_state(stare: &str, valabil_pana: &str, azi: &str) -> &'static str {
    match stare {
        "acceptata" => "acceptata",
        "respinsa" => "respinsa",
        "inchisa" => "inchisa",
        _ if valabil_pana < azi => "expirata",
        _ => "deschisa",
    }
}

impl Business {
    fn offer_lines(&self, ctx: &mut ModuleContext<'_>, linii: &[OfferLine]) -> CoreResult<(Vec<Value>, i64, i64)> {
        let (_, rates) = self.settings(ctx)?;
        if linii.is_empty() || linii.len() > MAX_OFFER_LINES {
            return Err(bad("oferta", format!("are nevoie de 1–{MAX_OFFER_LINES} linii")));
        }
        let (mut lines, mut net, mut vat, mut errs) = (Vec::new(), 0_i64, 0_i64, Vec::new());
        for (n, l) in linii.iter().enumerate() {
            let label = format!("linia {}", n + 1);
            let product = match l.produs {
                Some(p) => Some(live(ctx, PRODUCTS, p, "produsul")?),
                None => None,
            };
            let desc = l.descriere.clone().filter(|d| !d.trim().is_empty()).or_else(|| product.as_ref().map(|p| s(p, "nume"))).unwrap_or_default();
            let um = l.um.clone().filter(|u| !u.trim().is_empty()).or_else(|| product.as_ref().map(|p| s(p, "um"))).unwrap_or_else(|| "buc".into());
            if desc.trim().is_empty() || desc.chars().count() > 300 {
                errs.push(format!("{label}: descrierea are 1–300 de caractere"));
                continue;
            }
            let Some(q) = num::qty(&l.cantitate).filter(|q| *q > 0) else {
                errs.push(format!("{label}: cantitatea „{}” nu e un număr pozitiv", l.cantitate));
                continue;
            };
            let Some(price) = num::money(&l.pret_unitar).filter(|p| *p >= 0) else {
                errs.push(format!("{label}: prețul „{}” nu e valid", l.pret_unitar));
                continue;
            };
            if !rates.contains(&l.cota_tva) {
                errs.push(format!("{label}: cota de TVA {}% nu e în lista din setări", l.cota_tva));
                continue;
            }
            let (value, tva) = line_amounts(q, price, l.cota_tva);
            net += value;
            vat += tva;
            lines.push(json!({
                "produs": product.as_ref().map(|p| p.id), "descriere": desc.trim(), "um": um.trim(),
                "cantitate": q, "pret_unitar": price, "cota_tva": l.cota_tva, "valoare": value, "tva": tva,
            }));
        }
        if !errs.is_empty() {
            return Err(bad("oferta", errs.join("; ")));
        }
        Ok((lines, net, vat))
    }

    fn next_offer_number(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<i64> {
        Ok(ctx.scan(OFFERS, |_| true)?.iter().map(|o| i(o, "numar")).max().unwrap_or(0) + 1)
    }

    fn offer_dates(data: &str, valabil: &str) -> CoreResult<(String, String)> {
        let d = date(data).ok_or_else(|| bad("data", format!("„{data}” nu este o dată")))?;
        let v = date(valabil).ok_or_else(|| bad("valabilă până la", format!("„{valabil}” nu este o dată")))?;
        if v < d {
            return Err(bad("valabilă până la", "nu poate fi înaintea datei ofertei"));
        }
        Ok((d, v))
    }

    fn offer_write(&self, ctx: &mut ModuleContext<'_>, partner: &RecordState, o: Draft) -> CoreResult<Value> {
        let Draft { d, v, lines, net, vat, nota, copy_of } = o;
        let numar = self.next_offer_number(ctx)?;
        let mut f = Fields::new();
        f.insert("numar".into(), json!(numar));
        f.insert("data".into(), json!(d));
        f.insert("valabil_pana".into(), json!(v));
        f.insert("partener".into(), json!(partner.id.to_string()));
        f.insert("client".into(), json!({"nume": s(partner, "nume"), "cui": s(partner, "cui"), "reg_com": s(partner, "reg_com"), "adresa": s(partner, "adresa")}));
        f.insert("linii".into(), json!(lines));
        f.insert("total_fara_tva".into(), json!(net));
        f.insert("total_tva".into(), json!(vat));
        f.insert("total".into(), json!(net + vat));
        f.insert("stare".into(), json!("deschisa"));
        f.insert("motiv".into(), Value::Null);
        f.insert("inchisa_la".into(), Value::Null);
        f.insert("copie_dupa".into(), copy_of.map_or(Value::Null, |c| json!(c.to_string())));
        f.insert("nota".into(), nota);
        f.insert("creat_ms".into(), json!(kgb_core::workspace::now_ms()));
        let id = Uuid::now_v7();
        ctx.write(vec![Write::put(OFFERS, id, f).expect(0)])?;
        ctx.log("ofertă nouă");
        Ok(json!({"id": id, "numar": format!("OF {numar}"), "total": net + vat, "total_text": num::fmt_money(net + vat)}))
    }

    pub(crate) fn offer_save(&self, ctx: &mut ModuleContext<'_>, a: OfferSave) -> CoreResult<Value> {
        let partner = live(ctx, PARTNERS, a.partener, "clientul")?;
        let (d, v) = Self::offer_dates(&a.data, &a.valabil_pana)?;
        let (lines, net, vat) = self.offer_lines(ctx, &a.linii)?;
        let nota = text(a.nota, "nota", 500, false)?;
        self.offer_write(ctx, &partner, Draft { d, v, lines, net, vat, nota, copy_of: None })
    }

    /// A new offer with the same client and lines, new dates (a new version).
    pub(crate) fn offer_copy(&self, ctx: &mut ModuleContext<'_>, a: OfferCopy) -> CoreResult<Value> {
        let o = live(ctx, OFFERS, a.id, "oferta")?;
        let partner = live(ctx, PARTNERS, Uuid::parse_str(&s(&o, "partener")).unwrap_or_default(), "clientul")?;
        let (d, v) = Self::offer_dates(&a.data, &a.valabil_pana)?;
        let lines = o.fields.get("linii").and_then(Value::as_array).cloned().unwrap_or_default();
        let nota = o.fields.get("nota").cloned().unwrap_or(Value::Null);
        self.offer_write(ctx, &partner, Draft { d, v, lines, net: i(&o, "total_fara_tva"), vat: i(&o, "total_tva"), nota, copy_of: Some(o.id) })
    }

    pub(crate) fn offer_close(&self, ctx: &mut ModuleContext<'_>, a: OfferClose) -> CoreResult<Value> {
        let o = live(ctx, OFFERS, a.id, "oferta")?;
        let azi = date(&a.azi).ok_or_else(|| bad("ziua de azi", "nu este o dată"))?;
        let now = shown_state(&s(&o, "stare"), &s(&o, "valabil_pana"), &azi);
        if !["acceptata", "respinsa", "inchisa"].contains(&a.stare.as_str()) {
            return Err(bad("starea", "acceptata, respinsa sau inchisa"));
        }
        if now != "deschisa" && now != "expirata" {
            return Err(bad("oferta", "e deja închisă"));
        }
        if a.stare == "acceptata" && now == "expirata" {
            return Err(bad("oferta", "a expirat; copiaz-o ca ofertă nouă, cu altă valabilitate"));
        }
        let motiv = text(a.motiv, "motivul", 300, a.stare != "acceptata")?;
        let mut f = o.fields.clone();
        f.insert("stare".into(), json!(a.stare));
        f.insert("motiv".into(), motiv);
        f.insert("inchisa_la".into(), json!(azi));
        ctx.write(vec![Write::put(OFFERS, o.id, f).expect(o.version)])?;
        ctx.log("ofertă închisă");
        Ok(json!({"id": o.id, "stare": a.stare}))
    }

    pub(crate) fn offers(&self, ctx: &mut ModuleContext<'_>, a: OfferList) -> CoreResult<Value> {
        let azi = date(&a.azi).ok_or_else(|| bad("ziua de azi", "nu este o dată"))?;
        let mut list = ctx.scan(OFFERS, |_| true)?;
        list.sort_by_key(|o| std::cmp::Reverse(i(o, "numar")));
        Ok(json!(list
            .iter()
            .map(|o| {
                let mut v = Value::Object(o.fields.clone());
                v["id"] = json!(o.id);
                v["version"] = json!(o.version);
                v["numar_text"] = json!(format!("OF {}", i(o, "numar")));
                v["total_text"] = json!(num::fmt_money(i(o, "total")));
                v["stare_afisata"] = json!(shown_state(&s(o, "stare"), &s(o, "valabil_pana"), &azi));
                v
            })
            .collect::<Vec<_>>()))
    }

    pub(crate) fn offer_pdf(&self, ctx: &mut ModuleContext<'_>, id: Uuid) -> CoreResult<Vec<u8>> {
        let o = live(ctx, OFFERS, id, "oferta")?;
        let (settings, _) = self.settings(ctx)?;
        let mut v = BTreeMap::new();
        let ro = |iso: &str| iso.split('-').rev().collect::<Vec<_>>().join(".");
        v.insert("numar".to_string(), format!("OF {}", i(&o, "numar")));
        v.insert("data".into(), ro(&s(&o, "data")));
        v.insert("valabil_pana".into(), ro(&s(&o, "valabil_pana")));
        for (k, _) in COMPANY {
            v.insert(k.into(), settings.as_ref().map(|st| s(st, k)).unwrap_or_default());
        }
        for k in ["nume", "cui", "reg_com", "adresa"] {
            v.insert(format!("client_{k}"), o.fields["client"][k].as_str().unwrap_or_default().to_string());
        }
        let lines: Vec<Value> = o.fields["linii"]
            .as_array()
            .cloned()
            .unwrap_or_default()
            .iter()
            .map(|l| {
                json!([
                    l["descriere"],
                    l["um"],
                    num::fmt_qty(l["cantitate"].as_i64().unwrap_or_default()),
                    num::fmt_money(l["pret_unitar"].as_i64().unwrap_or_default()),
                    format!("{}%", l["cota_tva"].as_i64().unwrap_or_default()),
                    num::fmt_money(l["valoare"].as_i64().unwrap_or_default()),
                    num::fmt_money(l["tva"].as_i64().unwrap_or_default()),
                ])
            })
            .collect();
        v.insert("linii".into(), serde_json::to_string(&lines).unwrap_or_default());
        v.insert("total_fara_tva".into(), num::fmt_money(i(&o, "total_fara_tva")));
        v.insert("total_tva".into(), num::fmt_money(i(&o, "total_tva")));
        v.insert("total".into(), num::fmt_money(i(&o, "total")));
        v.insert("nota".into(), s(&o, "nota"));
        kgb_docs::pdf::render(include_str!("../models/oferta.typ"), &v).map_err(|e| bad("PDF-ul ofertei", e))
    }
}
