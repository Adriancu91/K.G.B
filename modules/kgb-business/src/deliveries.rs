//! Tracked deliveries (Etapa 7, step 7.4k-4; idea from the owner's ERP, code
//! written here).
//!
//! - Stages, in order: pregătire → încărcat → în drum → livrat → confirmat;
//!   or anulată (with a reason) before „livrat”.
//! - Each stage needs its fields before it can be reached:
//!   încărcat: vehicle and driver; în drum: the transport document (aviz);
//!   livrat: who received it; confirmat: the quantity the client confirms on
//!   every line (a difference is kept and shown, it does not block).
//! - Every stage keeps its time and fields in the delivery's history.
//! - A delivery can be made from an approved order (its lines are taken).

use kgb_core::CoreResult;
use kgb_core::modules::ModuleContext;
use kgb_core::workspace::now_ms;
use kgb_store::{Fields, Write};
use serde::Deserialize;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use crate::orders::ORDERS;
use crate::{Business, bad, date, i, live, num, s, text};

pub(crate) const DELIVERIES: &str = "livrari";
pub const STAGES: [&str; 5] = ["pregatire", "incarcat", "in_drum", "livrat", "confirmat"];

/// The fields a stage needs, with their labels.
pub fn required(stage: &str) -> &'static [(&'static str, &'static str)] {
    match stage {
        "incarcat" => &[("vehicul", "numărul vehiculului"), ("sofer", "șoferul")],
        "in_drum" => &[("aviz", "avizul / documentul de transport")],
        "livrat" => &[("primit_de", "cine a primit marfa")],
        _ => &[],
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct DeliveryLine {
    descriere: String,
    cantitate: String,
    #[serde(default)]
    um: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct DeliverySave {
    #[serde(default)]
    comanda: Option<Uuid>,
    #[serde(default)]
    destinatar: Option<String>,
    adresa: String,
    data: String,
    #[serde(default)]
    linii: Vec<DeliveryLine>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct DeliveryStep {
    id: Uuid,
    /// The next stage, or `anulata`.
    etapa: String,
    #[serde(default)]
    campuri: Map<String, Value>,
    /// For „confirmat”: the quantity confirmed on each line, as typed.
    #[serde(default)]
    confirmat: Vec<String>,
    #[serde(default)]
    motiv: Option<String>,
}

impl Business {
    pub(crate) fn delivery_save(&self, ctx: &mut ModuleContext<'_>, a: DeliverySave) -> CoreResult<Value> {
        let d = date(&a.data).ok_or_else(|| bad("data", format!("„{}” nu este o dată", a.data)))?;
        let adresa = text(Some(a.adresa), "adresa de livrare", 300, true)?;
        let (order, who, lines) = match a.comanda {
            Some(oid) => {
                let o = live(ctx, ORDERS, oid, "comanda")?;
                if !["aprobata", "livrare"].contains(&s(&o, "stare").as_str()) {
                    return Err(bad("comanda", "doar o comandă aprobată sau în livrare se livrează"));
                }
                let lines: Vec<Value> = o
                    .fields
                    .get("linii")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .map(|l| json!({"descriere": l["descriere"], "um": l["um"], "cantitate": l["cantitate"], "confirmat": null}))
                    .collect();
                (json!(oid.to_string()), json!(s(&o, "partener_nume")), lines)
            }
            None => {
                let who = text(a.destinatar, "destinatarul", 200, true)?;
                if a.linii.is_empty() || a.linii.len() > 200 {
                    return Err(bad("livrarea", "are nevoie de 1–200 linii"));
                }
                let mut lines = Vec::new();
                for (n, l) in a.linii.iter().enumerate() {
                    let q = num::qty(&l.cantitate).filter(|q| *q > 0).ok_or_else(|| bad("cantitatea", format!("linia {}: „{}” nu e un număr pozitiv", n + 1, l.cantitate)))?;
                    if l.descriere.trim().is_empty() {
                        return Err(bad("livrarea", format!("linia {}: lipsește descrierea", n + 1)));
                    }
                    lines.push(json!({"descriere": l.descriere.trim(), "um": l.um.clone().unwrap_or_else(|| "buc".into()), "cantitate": q, "confirmat": null}));
                }
                (Value::Null, who, lines)
            }
        };
        let numar = ctx.scan(DELIVERIES, |_| true)?.iter().map(|x| i(x, "numar")).max().unwrap_or(0) + 1;
        let mut f = Fields::new();
        f.insert("numar".into(), json!(numar));
        f.insert("comanda".into(), order);
        f.insert("destinatar".into(), who);
        f.insert("adresa".into(), adresa);
        f.insert("data".into(), json!(d));
        f.insert("linii".into(), json!(lines));
        f.insert("etapa".into(), json!("pregatire"));
        f.insert("campuri".into(), json!({}));
        f.insert("istoric".into(), json!([{"etapa": "pregatire", "cand_ms": now_ms(), "campuri": {}, "motiv": null}]));
        f.insert("diferente".into(), json!(false));
        f.insert("creat_ms".into(), json!(now_ms()));
        let id = Uuid::now_v7();
        ctx.write(vec![Write::put(DELIVERIES, id, f).expect(0)])?;
        ctx.log("livrare nouă");
        Ok(json!({"id": id, "numar": format!("LIV {numar}")}))
    }

    pub(crate) fn delivery_step(&self, ctx: &mut ModuleContext<'_>, a: DeliveryStep) -> CoreResult<Value> {
        let dl = live(ctx, DELIVERIES, a.id, "livrarea")?;
        let now = s(&dl, "etapa");
        let mut f = dl.fields.clone();
        let mut hist = f.get("istoric").and_then(Value::as_array).cloned().unwrap_or_default();
        if a.etapa == "anulata" {
            if !["pregatire", "incarcat", "in_drum"].contains(&now.as_str()) {
                return Err(bad("livrarea", "o livrare predată nu se mai anulează"));
            }
            let motiv = text(a.motiv, "motivul", 300, true)?;
            hist.push(json!({"etapa": "anulata", "cand_ms": now_ms(), "campuri": {}, "motiv": motiv}));
            f.insert("etapa".into(), json!("anulata"));
            f.insert("istoric".into(), json!(hist));
            ctx.write(vec![Write::put(DELIVERIES, dl.id, f).expect(dl.version)])?;
            return Ok(json!({"etapa": "anulata"}));
        }
        let pos = STAGES.iter().position(|x| *x == now).ok_or_else(|| bad("livrarea", "e anulată"))?;
        if STAGES.get(pos + 1) != Some(&a.etapa.as_str()) {
            return Err(bad("livrarea", format!("după „{now}” urmează „{}”", STAGES.get(pos + 1).unwrap_or(&"nimic"))));
        }
        // The stage's fields must be filled in.
        let mut given = Map::new();
        let mut missing = Vec::new();
        for (k, label) in required(&a.etapa) {
            match a.campuri.get(*k).and_then(Value::as_str).map(str::trim).filter(|v| !v.is_empty()) {
                Some(v) if v.chars().count() <= 200 => {
                    given.insert((*k).into(), json!(v));
                }
                Some(_) => missing.push(format!("{label} (prea lung)")),
                None => missing.push((*label).to_string()),
            }
        }
        if !missing.is_empty() {
            return Err(bad("etapa", format!("lipsește: {}", missing.join(", "))));
        }
        let mut differ = false;
        if a.etapa == "confirmat" {
            let mut lines = f.get("linii").and_then(Value::as_array).cloned().unwrap_or_default();
            if a.confirmat.len() != lines.len() {
                return Err(bad("confirmarea", format!("scrie cantitatea confirmată pe fiecare din cele {} linii", lines.len())));
            }
            for (n, (l, c)) in lines.iter_mut().zip(&a.confirmat).enumerate() {
                let q = num::qty(c).filter(|q| *q >= 0).ok_or_else(|| bad("confirmarea", format!("linia {}: „{c}” nu e o cantitate", n + 1)))?;
                if q != l["cantitate"].as_i64().unwrap_or(0) {
                    differ = true;
                }
                l["confirmat"] = json!(q);
            }
            f.insert("linii".into(), json!(lines));
            f.insert("diferente".into(), json!(differ));
        }
        let mut all = f.get("campuri").and_then(Value::as_object).cloned().unwrap_or_default();
        all.extend(given.clone());
        f.insert("campuri".into(), Value::Object(all));
        hist.push(json!({"etapa": a.etapa, "cand_ms": now_ms(), "campuri": given, "motiv": null}));
        f.insert("etapa".into(), json!(a.etapa));
        f.insert("istoric".into(), json!(hist));
        ctx.write(vec![Write::put(DELIVERIES, dl.id, f).expect(dl.version)])?;
        ctx.log("livrare: etapă nouă");
        Ok(json!({"etapa": a.etapa, "diferente": differ}))
    }

    pub(crate) fn deliveries(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Value> {
        let orders: std::collections::BTreeMap<String, i64> = ctx.scan(ORDERS, |_| true)?.iter().map(|o| (o.id.to_string(), i(o, "numar"))).collect();
        let mut list = ctx.scan(DELIVERIES, |_| true)?;
        list.sort_by_key(|d| std::cmp::Reverse(i(d, "numar")));
        Ok(json!(list
            .iter()
            .map(|d| {
                let mut v = Value::Object(d.fields.clone());
                v["id"] = json!(d.id);
                v["numar_text"] = json!(format!("LIV {}", i(d, "numar")));
                v["comanda_text"] = orders.get(&s(d, "comanda")).map_or(Value::Null, |n| json!(format!("CMD {n}")));
                if let Some(lines) = v["linii"].as_array_mut() {
                    for l in lines {
                        l["cantitate_text"] = json!(num::fmt_qty(l["cantitate"].as_i64().unwrap_or(0)));
                        l["confirmat_text"] = l["confirmat"].as_i64().map_or(Value::Null, |q| json!(num::fmt_qty(q)));
                    }
                }
                v
            })
            .collect::<Vec<_>>()))
    }
}
