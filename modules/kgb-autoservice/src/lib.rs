//! `kgb.autoservice` — „Service auto” (Etapa 8, step 8.17).
//!
//! - **Vehicles** (`vehicule`): the clients' cars: the client (from the partner directory or just a name), the phone,
//!   the registration number (kept without spaces, upper case, unique), the VIN (17 characters without I, O, Q, or
//!   empty; unique), make, model, year, fuel.
//! - **Work orders** (`comenzi`): numbered one after another; the car, the day it came in, the odometer, what the
//!   client says and what the workshop finds, the lines (labour in hours, parts in pieces, quantity in thousandths,
//!   price without VAT in bani), the VAT rate, the warranty of the work in months. The values are computed here, never
//!   typed: each line rounded to the ban, the VAT on the total, the total.
//! - **Steps**: deschisă → în lucru → gata → predată, back one step while not delivered; a delivered order needs at
//!   least one line and the delivery day, and never changes again; any order not delivered can be cancelled with a
//!   reason and stays in the history.
//!
//! An odometer lower than an earlier order of the same car is accepted (the clock can be replaced) but the answer
//! says so. Commands: `parteneri {text}`, `vehicule {text?}`, `vehicul {id}`, `vehicul_save`, `vehicul_delete {id,
//! version}`, `comenzi {stare?, text?}`, `comanda {id}`, `comanda_save`, `comanda_stare {id, version, stare, data?,
//! motiv?}`.

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.autoservice";
pub const VEHICLES: &str = "vehicule";
pub const ORDERS: &str = "comenzi";
pub const FUELS: [&str; 7] = ["", "benzina", "motorina", "hibrid", "electric", "gpl", "altul"];
pub const STATES: [&str; 5] = ["deschisa", "in_lucru", "gata", "predata", "anulata"];
const MAX_QTY: i64 = 1_000_000_000;
const MAX_PRICE: i64 = 100_000_000_000;

pub struct AutoService {
    manifest: Manifest,
}

impl AutoService {
    pub fn new() -> AutoService {
        AutoService {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for AutoService {
    fn default() -> Self {
        AutoService::new()
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

fn text(what: &str, t: &str, max: usize, required: bool) -> CoreResult<String> {
    let t = t.trim();
    if (required && t.is_empty()) || t.chars().count() > max {
        return Err(bad(
            what,
            if required {
                format!("are 1–{max} caractere")
            } else {
                format!("are cel mult {max} caractere")
            },
        ));
    }
    Ok(t.to_string())
}

fn fold(t: &str) -> String {
    t.to_lowercase()
        .replace(['ă', 'â'], "a")
        .replace('î', "i")
        .replace(['ș', 'ş'], "s")
        .replace(['ț', 'ţ'], "t")
}

// ---------- days ----------

/// Days since 1970-01-01 of `AAAA-LL-ZZ`, if it is a real date.
pub fn day_number(d: &str) -> Option<i64> {
    let by = d.as_bytes();
    if by.len() != 10 || by[4] != b'-' || by[7] != b'-' {
        return None;
    }
    let (y, m, dd): (i64, i64, i64) = (d[0..4].parse().ok()?, d[5..7].parse().ok()?, d[8..10].parse().ok()?);
    if !(1900..=2200).contains(&y) || !(1..=12).contains(&m) || dd < 1 || dd > days_in_month(y, m) {
        return None;
    }
    let (yy, mm) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
    let era = yy.div_euclid(400);
    let yoe = yy - era * 400;
    let doy = (153 * mm + 2) / 5 + dd - 1;
    Some(era * 146_097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719_468)
}

fn days_in_month(y: i64, m: i64) -> i64 {
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][(m - 1) as usize]
}

/// `AAAA-LL-ZZ` plus `months` calendar months; the day is cut to the month's last (31.01 + 1 = 28/29.02).
pub fn add_months(d: &str, months: i64) -> Option<String> {
    day_number(d)?;
    let (y, m, dd): (i64, i64, i64) = (d[0..4].parse().ok()?, d[5..7].parse().ok()?, d[8..10].parse().ok()?);
    let t = y * 12 + (m - 1) + months;
    let (ny, nm) = (t.div_euclid(12), t.rem_euclid(12) + 1);
    Some(format!("{ny:04}-{nm:02}-{:02}", dd.min(days_in_month(ny, nm))))
}

fn date_arg(what: &str, t: &str) -> CoreResult<String> {
    let t = t.trim();
    day_number(t)
        .map(|_| t.to_string())
        .ok_or_else(|| bad(what, format!("„{t}” nu e o dată AAAA-LL-ZZ")))
}

// ---------- registration number and VIN ----------

/// A registration number without spaces or dashes, upper case: „b 123 abc” → „B123ABC”. 2–10 letters and digits.
pub fn plate(t: &str) -> CoreResult<String> {
    let p: String = t
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .collect::<String>()
        .to_uppercase();
    if !(2..=10).contains(&p.chars().count()) || !p.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(bad(
            "numărul de înmatriculare",
            format!("„{}” are 2–10 litere și cifre", t.trim()),
        ));
    }
    Ok(p)
}

/// A VIN: empty, or 17 letters and digits without I, O and Q (ISO 3779), upper case.
pub fn vin(t: &str) -> CoreResult<String> {
    let v: String = t.trim().to_uppercase().chars().filter(|c| !c.is_whitespace()).collect();
    if v.is_empty() {
        return Ok(v);
    }
    if v.chars().count() != 17
        || !v
            .chars()
            .all(|c| c.is_ascii_alphanumeric() && !matches!(c, 'I' | 'O' | 'Q'))
    {
        return Err(bad(
            "VIN-ul (seria de șasiu)",
            format!("„{v}” are 17 litere și cifre, fără I, O și Q"),
        ));
    }
    Ok(v)
}

// ---------- lines and totals ----------

/// One line of a work order: labour (`manopera`, hours) or a part (`piesa`). Quantity in thousandths, price
/// without VAT in bani.
#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Line {
    pub fel: String,
    #[serde(default)]
    pub cod: String,
    pub denumire: String,
    #[serde(default)]
    pub um: String,
    pub cantitate: i64,
    pub pret: i64,
}

/// The value of a line in bani: quantity (thousandths) × price, rounded half up to the ban.
pub fn line_value(cantitate: i64, pret: i64) -> i64 {
    let v = i128::from(cantitate) * i128::from(pret);
    ((v + 500) / 1000) as i64
}

/// The totals of an order: labour, parts, without VAT, VAT (on the total, half up), with VAT.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Totals {
    pub manopera: i64,
    pub piese: i64,
    pub fara_tva: i64,
    pub tva: i64,
    pub total: i64,
}

pub fn totals(lines: &[Line], cota: i64) -> Totals {
    let (mut manopera, mut piese) = (0, 0);
    for l in lines {
        let v = line_value(l.cantitate, l.pret);
        if l.fel == "manopera" {
            manopera += v;
        } else {
            piese += v;
        }
    }
    let fara_tva = manopera + piese;
    let tva = ((i128::from(fara_tva) * i128::from(cota) + 50) / 100) as i64;
    Totals {
        manopera,
        piese,
        fara_tva,
        tva,
        total: fara_tva + tva,
    }
}

fn check_lines(lines: Vec<Line>) -> CoreResult<Vec<Line>> {
    if lines.len() > 200 {
        return Err(bad("comanda", "are cel mult 200 de linii"));
    }
    lines
        .into_iter()
        .enumerate()
        .map(|(n, l)| {
            let what = format!("linia {}", n + 1);
            if l.fel != "manopera" && l.fel != "piesa" {
                return Err(bad(&what, "e manoperă sau piesă"));
            }
            if l.cantitate <= 0 || l.cantitate > MAX_QTY {
                return Err(bad(&what, "cantitatea trebuie să fie mai mare decât zero"));
            }
            if l.pret < 0 || l.pret > MAX_PRICE {
                return Err(bad(&what, "prețul nu poate fi negativ"));
            }
            let um = text(&what, &l.um, 10, false)?;
            Ok(Line {
                cod: text(&what, &l.cod, 40, false)?,
                denumire: text(&what, &l.denumire, 200, true)?,
                um: if um.is_empty() {
                    if l.fel == "manopera" { "ore" } else { "buc" }.to_string()
                } else {
                    um
                },
                ..l
            })
        })
        .collect()
}

fn lines_of(r: &RecordState) -> Vec<Line> {
    r.fields
        .get("linii")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(|v| serde_json::from_value::<Line>(v.clone()).ok())
                .collect()
        })
        .unwrap_or_default()
}

fn line_json(l: &Line) -> Value {
    json!({"fel": l.fel, "cod": l.cod, "denumire": l.denumire, "um": l.um, "cantitate": l.cantitate, "pret": l.pret})
}

// ---------- arguments ----------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Search {
    #[serde(default)]
    text: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ById {
    id: Uuid,
    #[serde(default)]
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct VehicleIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    #[serde(default)]
    client: Option<Uuid>,
    #[serde(default)]
    client_nume: String,
    #[serde(default)]
    telefon: String,
    nr: String,
    #[serde(default)]
    vin: String,
    #[serde(default)]
    marca: String,
    #[serde(default)]
    model: String,
    #[serde(default)]
    an: i64,
    #[serde(default)]
    combustibil: String,
    #[serde(default)]
    nota: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct OrderList {
    #[serde(default)]
    stare: String,
    #[serde(default)]
    text: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct OrderIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    vehicul: Uuid,
    data_intrare: String,
    #[serde(default = "minus_one")]
    km: i64,
    #[serde(default)]
    reclamatie: String,
    #[serde(default)]
    constatari: String,
    #[serde(default)]
    linii: Vec<Line>,
    #[serde(default = "vat")]
    cota_tva: i64,
    #[serde(default)]
    garantie_luni: i64,
    #[serde(default)]
    nota: String,
}

fn minus_one() -> i64 {
    -1
}

fn vat() -> i64 {
    21
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StateIn {
    id: Uuid,
    version: u64,
    stare: String,
    #[serde(default)]
    data: String,
    #[serde(default)]
    motiv: String,
}

// ---------- the module ----------

impl AutoService {
    fn all(&self, ctx: &mut ModuleContext<'_>, c: &str) -> CoreResult<Vec<RecordState>> {
        ctx.scan(c, |r| !r.deleted)
    }

    fn get(&self, ctx: &mut ModuleContext<'_>, c: &str, id: Uuid, what: &str) -> CoreResult<RecordState> {
        ctx.get(c, id)?
            .filter(|r| !r.deleted)
            .ok_or_else(|| bad(what, "nu există"))
    }

    fn vehicle_view(&self, v: &RecordState, orders: &[RecordState]) -> Value {
        let mine: Vec<&RecordState> = orders.iter().filter(|o| s(o, "vehicul") == v.id.to_string()).collect();
        let last = mine.iter().map(|o| s(o, "data_intrare")).max().unwrap_or_default();
        let km = mine
            .iter()
            .filter(|o| s(o, "stare") != "anulata")
            .map(|o| i(o, "km"))
            .max()
            .unwrap_or(-1);
        json!({
            "id": v.id, "version": v.version, "client": s(v, "client"), "client_nume": s(v, "client_nume"),
            "telefon": s(v, "telefon"), "nr": s(v, "nr"), "vin": s(v, "vin"), "marca": s(v, "marca"),
            "model": s(v, "model"), "an": i(v, "an"), "combustibil": s(v, "combustibil"), "nota": s(v, "nota"),
            "comenzi": mine.len(), "ultima_intrare": last, "km_maxim": km,
        })
    }

    fn order_view(&self, o: &RecordState, vehicles: &[RecordState]) -> Value {
        let lines = lines_of(o);
        let t = totals(&lines, i(o, "cota_tva"));
        let v = vehicles.iter().find(|v| v.id.to_string() == s(o, "vehicul"));
        let delivered = s(o, "data_predare");
        let warranty = if delivered.is_empty() || i(o, "garantie_luni") == 0 {
            String::new()
        } else {
            add_months(&delivered, i(o, "garantie_luni")).unwrap_or_default()
        };
        json!({
            "id": o.id, "version": o.version, "vehicul": s(o, "vehicul"), "numar": i(o, "numar"),
            "data_intrare": s(o, "data_intrare"), "km": i(o, "km"), "reclamatie": s(o, "reclamatie"),
            "constatari": s(o, "constatari"), "linii": lines.iter().map(|l| json!({
                "fel": l.fel, "cod": l.cod, "denumire": l.denumire, "um": l.um, "cantitate": l.cantitate, "pret": l.pret,
                "valoare": line_value(l.cantitate, l.pret),
            })).collect::<Vec<_>>(),
            "cota_tva": i(o, "cota_tva"), "garantie_luni": i(o, "garantie_luni"), "garantie_pana": warranty,
            "stare": s(o, "stare"), "data_predare": delivered, "motiv_anulare": s(o, "motiv_anulare"), "nota": s(o, "nota"),
            "manopera": t.manopera, "piese": t.piese, "fara_tva": t.fara_tva, "tva": t.tva, "total": t.total,
            "nr": v.map(|v| s(v, "nr")).unwrap_or_default(),
            "masina": v.map(|v| format!("{} {}", s(v, "marca"), s(v, "model")).trim().to_string()).unwrap_or_default(),
            "client_nume": v.map(|v| s(v, "client_nume")).unwrap_or_default(),
        })
    }

    fn save_vehicle(&self, ctx: &mut ModuleContext<'_>, a: VehicleIn) -> CoreResult<Value> {
        let nr = plate(&a.nr)?;
        let vin = vin(&a.vin)?;
        if !FUELS.contains(&a.combustibil.as_str()) {
            return Err(bad("combustibilul", "nu e cunoscut"));
        }
        if a.an != 0 && !(1900..=2100).contains(&a.an) {
            return Err(bad("anul fabricației", "e între 1900 și 2100 sau gol"));
        }
        let mut client_nume = text("numele clientului", &a.client_nume, 200, false)?;
        if let Some(pid) = a.client {
            client_nume = ctx.partner(pid)?.denumire;
        }
        if client_nume.is_empty() {
            return Err(bad("clientul", "alege un partener sau scrie numele clientului"));
        }
        for v in self.all(ctx, VEHICLES)? {
            if Some(v.id) == a.id {
                continue;
            }
            if s(&v, "nr") == nr {
                return Err(bad(
                    "numărul de înmatriculare",
                    format!("{nr} e deja la altă mașină ({})", s(&v, "client_nume")),
                ));
            }
            if !vin.is_empty() && s(&v, "vin") == vin {
                return Err(bad(
                    "VIN-ul (seria de șasiu)",
                    format!("{vin} e deja la mașina {}", s(&v, "nr")),
                ));
            }
        }
        let created = match a.id {
            Some(id) => i(&self.get(ctx, VEHICLES, id, "mașina")?, "creat_ms"),
            None => i64::try_from(now_ms()).unwrap_or_default(),
        };
        let mut f = Fields::new();
        f.insert(
            "client".into(),
            json!(a.client.map(|u| u.to_string()).unwrap_or_default()),
        );
        f.insert("client_nume".into(), json!(client_nume));
        f.insert("telefon".into(), json!(text("telefonul", &a.telefon, 40, false)?));
        f.insert("nr".into(), json!(nr));
        f.insert("vin".into(), json!(vin));
        f.insert("marca".into(), json!(text("marca", &a.marca, 60, false)?));
        f.insert("model".into(), json!(text("modelul", &a.model, 60, false)?));
        f.insert("an".into(), json!(a.an));
        f.insert("combustibil".into(), json!(a.combustibil));
        f.insert("nota".into(), json!(text("nota", &a.nota, 1000, false)?));
        f.insert("creat_ms".into(), json!(created));
        let id = a.id.unwrap_or_else(Uuid::new_v4);
        let version = ctx.write(vec![Write::put(VEHICLES, id, f).expect(if a.id.is_some() {
            a.version
        } else {
            0
        })])?[0];
        Ok(json!({"id": id, "version": version, "nr": nr}))
    }

    fn save_order(&self, ctx: &mut ModuleContext<'_>, a: OrderIn) -> CoreResult<Value> {
        let vehicle = self.get(ctx, VEHICLES, a.vehicul, "mașina")?;
        let data = date_arg("data intrării", &a.data_intrare)?;
        if !(-1..=5_000_000).contains(&a.km) {
            return Err(bad("kilometrajul", "e între 0 și 5.000.000 sau necitit"));
        }
        if !(0..=100).contains(&a.cota_tva) {
            return Err(bad("cota de TVA", "e între 0 și 100"));
        }
        if !(0..=60).contains(&a.garantie_luni) {
            return Err(bad("garanția lucrării", "are 0–60 de luni"));
        }
        let lines = check_lines(a.linii)?;
        let orders = self.all(ctx, ORDERS)?;
        let (numar, stare, created) = match a.id {
            Some(id) => {
                let o = orders
                    .iter()
                    .find(|o| o.id == id)
                    .ok_or_else(|| bad("comanda", "nu există"))?;
                match s(o, "stare").as_str() {
                    "predata" => return Err(bad("comanda", "a fost predată și nu se mai schimbă")),
                    "anulata" => return Err(bad("comanda", "e anulată și nu se mai schimbă")),
                    _ => {}
                }
                if s(o, "vehicul") != a.vehicul.to_string() {
                    return Err(bad("comanda", "nu se mută pe altă mașină; anuleaz-o și deschide alta"));
                }
                (i(o, "numar"), s(o, "stare"), i(o, "creat_ms"))
            }
            None => (
                orders.iter().map(|o| i(o, "numar")).max().unwrap_or(0) + 1,
                "deschisa".to_string(),
                i64::try_from(now_ms()).unwrap_or_default(),
            ),
        };
        // An odometer lower than an earlier order of the same car: accepted, said.
        let earlier = orders
            .iter()
            .filter(|o| Some(o.id) != a.id && s(o, "vehicul") == a.vehicul.to_string() && s(o, "stare") != "anulata")
            .filter(|o| s(o, "data_intrare") <= data)
            .map(|o| i(o, "km"))
            .max()
            .unwrap_or(-1);
        let atentie = if a.km >= 0 && earlier > a.km {
            format!(
                "kilometrajul ({} km) e mai mic decât la o comandă anterioară a mașinii {} ({} km)",
                a.km,
                s(&vehicle, "nr"),
                earlier
            )
        } else {
            String::new()
        };
        let mut f = Fields::new();
        f.insert("vehicul".into(), json!(a.vehicul.to_string()));
        f.insert("numar".into(), json!(numar));
        f.insert("data_intrare".into(), json!(data));
        f.insert("km".into(), json!(a.km));
        f.insert(
            "reclamatie".into(),
            json!(text("reclamația clientului", &a.reclamatie, 2000, false)?),
        );
        f.insert(
            "constatari".into(),
            json!(text("constatările", &a.constatari, 2000, false)?),
        );
        f.insert("linii".into(), json!(lines.iter().map(line_json).collect::<Vec<_>>()));
        f.insert("cota_tva".into(), json!(a.cota_tva));
        f.insert("garantie_luni".into(), json!(a.garantie_luni));
        f.insert("stare".into(), json!(stare));
        f.insert("data_predare".into(), json!(""));
        f.insert("motiv_anulare".into(), json!(""));
        f.insert("nota".into(), json!(text("nota", &a.nota, 2000, false)?));
        f.insert("creat_ms".into(), json!(created));
        let id = a.id.unwrap_or_else(Uuid::new_v4);
        let version = ctx.write(vec![Write::put(ORDERS, id, f).expect(if a.id.is_some() {
            a.version
        } else {
            0
        })])?[0];
        let t = totals(&lines, a.cota_tva);
        Ok(json!({"id": id, "version": version, "numar": numar, "total": t.total, "atentie": atentie}))
    }

    fn set_state(&self, ctx: &mut ModuleContext<'_>, a: StateIn) -> CoreResult<Value> {
        let o = self.get(ctx, ORDERS, a.id, "comanda")?;
        let from = s(&o, "stare");
        let to = a.stare.as_str();
        if !STATES.contains(&to) {
            return Err(bad("starea", "nu e cunoscută"));
        }
        let ok = matches!(
            (from.as_str(), to),
            ("deschisa", "in_lucru")
                | ("in_lucru", "gata")
                | ("gata", "predata")
                | ("in_lucru", "deschisa")
                | ("gata", "in_lucru")
                | ("deschisa" | "in_lucru" | "gata", "anulata")
        );
        if !ok {
            return Err(bad(
                "comanda",
                match from.as_str() {
                    "predata" => "a fost predată și nu se mai schimbă".to_string(),
                    "anulata" => "e anulată și nu se mai schimbă".to_string(),
                    _ => format!("nu trece din „{from}” în „{to}”"),
                },
            ));
        }
        let mut f = o.fields.clone();
        f.insert("stare".into(), json!(to));
        if to == "predata" {
            if lines_of(&o).is_empty() {
                return Err(bad("comanda", "nu are nicio linie de manoperă sau piese"));
            }
            let d = date_arg("data predării", &a.data)?;
            if d < s(&o, "data_intrare") {
                return Err(bad("data predării", "e înaintea datei de intrare"));
            }
            f.insert("data_predare".into(), json!(d));
        }
        if to == "anulata" {
            let m = text("motivul anulării", &a.motiv, 500, true)?;
            if m.chars().count() < 3 {
                return Err(bad("motivul anulării", "are cel puțin 3 caractere"));
            }
            f.insert("motiv_anulare".into(), json!(m));
        }
        let version = ctx.write(vec![Write::put(ORDERS, a.id, f).expect(a.version)])?[0];
        Ok(json!({"id": a.id, "version": version, "stare": to}))
    }
}

impl Module for AutoService {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "parteneri" => {
                let a: Search = args(command, a)?;
                Ok(json!(
                    ctx.partners_search(&a.text, 30)?
                        .iter()
                        .map(|p| json!({"id": p.id, "denumire": p.denumire, "cui": p.cui, "telefon": p.telefon}))
                        .collect::<Vec<_>>()
                ))
            }
            "vehicule" => {
                let a: Search = args(command, a)?;
                let q = fold(a.text.trim());
                let qp: String = q.chars().filter(|c| !c.is_whitespace() && *c != '-').collect();
                let orders = self.all(ctx, ORDERS)?;
                let mut l: Vec<RecordState> = self
                    .all(ctx, VEHICLES)?
                    .into_iter()
                    .filter(|v| {
                        q.is_empty()
                            || fold(&s(v, "nr")).contains(&qp)
                            || fold(&s(v, "vin")).contains(&q)
                            || fold(&s(v, "client_nume")).contains(&q)
                            || fold(&format!("{} {}", s(v, "marca"), s(v, "model"))).contains(&q)
                            || s(v, "telefon").contains(a.text.trim())
                    })
                    .collect();
                l.sort_by_key(|v| s(v, "nr"));
                Ok(json!(
                    l.iter().map(|v| self.vehicle_view(v, &orders)).collect::<Vec<_>>()
                ))
            }
            "vehicul" => {
                let a: ById = args(command, a)?;
                let v = self.get(ctx, VEHICLES, a.id, "mașina")?;
                let orders = self.all(ctx, ORDERS)?;
                let vehicles = vec![v.clone()];
                let mut mine: Vec<&RecordState> =
                    orders.iter().filter(|o| s(o, "vehicul") == a.id.to_string()).collect();
                mine.sort_by_key(|o| std::cmp::Reverse((s(o, "data_intrare"), i(o, "numar"))));
                let mut view = self.vehicle_view(&v, &orders);
                view["istoric"] = json!(mine.iter().map(|o| self.order_view(o, &vehicles)).collect::<Vec<_>>());
                Ok(view)
            }
            "vehicul_save" => self.save_vehicle(ctx, args(command, a)?),
            "vehicul_delete" => {
                let a: ById = args(command, a)?;
                let n = self
                    .all(ctx, ORDERS)?
                    .iter()
                    .filter(|o| s(o, "vehicul") == a.id.to_string())
                    .count();
                if n > 0 {
                    return Err(bad("mașina", format!("are {n} comenzi în istoric și nu se șterge")));
                }
                ctx.write(vec![Write::delete(VEHICLES, a.id).expect(a.version)])?;
                Ok(Value::Null)
            }
            "comenzi" => {
                let a: OrderList = args(command, a)?;
                if !a.stare.is_empty() && a.stare != "deschise" && !STATES.contains(&a.stare.as_str()) {
                    return Err(bad("starea", "nu e cunoscută"));
                }
                let vehicles = self.all(ctx, VEHICLES)?;
                let q = fold(a.text.trim());
                let mut l: Vec<Value> = self
                    .all(ctx, ORDERS)?
                    .iter()
                    .filter(|o| match a.stare.as_str() {
                        "" => true,
                        // Everything still in the workshop.
                        "deschise" => matches!(s(o, "stare").as_str(), "deschisa" | "in_lucru" | "gata"),
                        st => s(o, "stare") == st,
                    })
                    .map(|o| self.order_view(o, &vehicles))
                    .filter(|v| {
                        q.is_empty()
                            || fold(v["nr"].as_str().unwrap_or("")).contains(&q.replace(' ', ""))
                            || fold(v["client_nume"].as_str().unwrap_or("")).contains(&q)
                            || fold(v["masina"].as_str().unwrap_or("")).contains(&q)
                            || q.parse::<i64>().ok() == v["numar"].as_i64()
                    })
                    .collect();
                l.sort_by_key(|v| std::cmp::Reverse(v["numar"].as_i64().unwrap_or(0)));
                Ok(json!(l))
            }
            "comanda" => {
                let a: ById = args(command, a)?;
                let o = self.get(ctx, ORDERS, a.id, "comanda")?;
                let vehicles = self.all(ctx, VEHICLES)?;
                Ok(self.order_view(&o, &vehicles))
            }
            "comanda_save" => self.save_order(ctx, args(command, a)?),
            "comanda_stare" => self.set_state(ctx, args(command, a)?),
            other => Err(bad("comanda", format!("„{other}” nu e cunoscută"))),
        }
    }
}
