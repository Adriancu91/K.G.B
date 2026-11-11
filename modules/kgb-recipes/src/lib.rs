//! `kgb.recipes` — „Rețete și costuri” (Etapa 7, step 7.9e): recipes and technical sheets for HoReCa and production.
//!
//! - **Ingredients** (`ingrediente`): base unit (kg, l, buc), the price without VAT per base unit written by the person
//!   with its date, the loss when cleaning (percent × 100), the allergens ticked by the person (the 14 of
//!   Reg. (EU) 1169/2011, annex II).
//! - **Recipes** (`retete`): how much comes out (`lot`, in thousandths of `unitate_lot`), lines of ingredients or
//!   semi-finished recipes with the NET quantity (what goes into the dish, thousandths of the base unit); gross =
//!   net / (1 − loss), and the cost is taken from the gross. Mark-up (percent × 100), the VAT rate chosen by the person,
//!   the sale price (0 = the proposed one), an optional yield after cooking (display only).
//!
//! Everything is computed when asked, nothing written: line costs keep their precision (f64 bani); the proposed price
//! is rounded to the ban once, at the end. A recipe may not contain itself (directly or through semi-finished ones);
//! at most [`MAX_DEPTH`] levels. The allergens of a recipe are those of its ingredients, through the semi-finished
//! ones — as ticked by the person, never guessed.
//!
//! Commands: `ingrediente {text?}`, `ingredient_save`, `ingredient_delete {id, version}`, `retete {text?, fel?}`,
//! `reteta {id, azi}`, `reteta_save`, `reteta_delete {id, version}`, `reteta_copie {id}`, `consum {linii}`,
//! `consum_export {linii, dest}` (CSV, UTF-8 with BOM, „;”).

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.recipes";
pub const INGREDIENTS: &str = "ingrediente";
pub const RECIPES: &str = "retete";
pub const UNITS: [&str; 3] = ["kg", "l", "buc"];
pub const KINDS: [&str; 3] = ["preparat", "produs", "semipreparat"];
/// The allergens of Reg. (EU) 1169/2011, annex II, by code (the names are on the page).
pub const ALLERGENS: [&str; 14] = [
    "gluten",
    "crustacee",
    "oua",
    "peste",
    "arahide",
    "soia",
    "lapte",
    "fructe_coaja",
    "telina",
    "mustar",
    "susan",
    "sulfiti",
    "lupin",
    "moluste",
];
pub const VAT_RATES: [i64; 3] = [21, 11, 0];
pub const MAX_DEPTH: usize = 5;
/// A price older than this many days is shown as old.
pub const OLD_PRICE_DAYS: i64 = 90;

pub struct Recipes {
    manifest: Manifest,
}

impl Recipes {
    pub fn new() -> Recipes {
        Recipes {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Recipes {
    fn default() -> Self {
        Recipes::new()
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

fn day_number(d: &str) -> Option<i64> {
    let by = d.as_bytes();
    if by.len() != 10 || by[4] != b'-' || by[7] != b'-' {
        return None;
    }
    let (y, m, dd): (i64, i64, i64) = (d[0..4].parse().ok()?, d[5..7].parse().ok()?, d[8..10].parse().ok()?);
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    let dim = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if !(1900..=2200).contains(&y) || !(1..=12).contains(&m) || dd < 1 || dd > dim[(m - 1) as usize] {
        return None;
    }
    let (yy, mm) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
    let era = yy.div_euclid(400);
    let yoe = yy - era * 400;
    let doy = (153 * mm + 2) / 5 + dd - 1;
    Some(era * 146_097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719_468)
}

fn fold(t: &str) -> String {
    t.to_lowercase()
        .replace(['ă', 'â'], "a")
        .replace('î', "i")
        .replace(['ș', 'ş'], "s")
        .replace(['ț', 'ţ'], "t")
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

// ---------- the arithmetic ----------

/// Gross from net with a loss in percent × 100: 0,800 kg at 20 % → 1,000 kg.
pub fn gross(net: f64, loss: i64) -> f64 {
    net / (1.0 - loss.clamp(0, 9000) as f64 / 10_000.0)
}

/// The proposed price with VAT, in bani, rounded once: cost × (1 + mark-up) × (1 + VAT).
pub fn proposed_price(cost_bani: f64, markup: i64, vat: i64) -> i64 {
    (cost_bani * (1.0 + markup as f64 / 10_000.0) * (1.0 + vat as f64 / 100.0)).round() as i64
}

/// Margin and food cost (both percent × 100) of a price with VAT for a cost without VAT.
pub fn margin(cost_bani: f64, price_with_vat: i64, vat: i64) -> Option<(i64, i64)> {
    let net = price_with_vat as f64 / (1.0 + vat as f64 / 100.0);
    (net > 0.0).then(|| {
        (
            ((net - cost_bani) / net * 10_000.0).round() as i64,
            (cost_bani / net * 10_000.0).round() as i64,
        )
    })
}

/// One line as computed.
#[derive(Clone, Debug)]
struct LineCalc {
    tip: String,
    id: String,
    name: String,
    unit: String,
    net: f64,
    gross: f64,
    cost: f64,
}

/// A recipe as computed: the cost of its lot (bani, unrounded), the net weight in kg of its lines, the allergens,
/// the warnings and the lines.
#[derive(Clone, Debug, Default)]
struct Calc {
    cost_lot: f64,
    net_kg: f64,
    allergens: BTreeSet<String>,
    warnings: Vec<String>,
    lines: Vec<LineCalc>,
}

struct Book {
    ingredients: BTreeMap<String, RecordState>,
    recipes: BTreeMap<String, RecordState>,
    today: Option<i64>,
}

fn lines_of(r: &RecordState) -> Vec<(String, String, i64)> {
    r.fields
        .get("linii")
        .and_then(Value::as_array)
        .map(|l| {
            l.iter()
                .map(|x| {
                    (
                        x.get("tip").and_then(Value::as_str).unwrap_or_default().to_string(),
                        x.get("id").and_then(Value::as_str).unwrap_or_default().to_string(),
                        x.get("cantitate").and_then(Value::as_i64).unwrap_or_default(),
                    )
                })
                .collect()
        })
        .unwrap_or_default()
}

impl Book {
    fn calc(&self, id: &str, depth: usize) -> CoreResult<Calc> {
        let r = self.recipes.get(id).ok_or_else(|| bad("rețeta", "nu mai există"))?;
        if depth > MAX_DEPTH {
            return Err(bad(
                "rețeta",
                format!(
                    "„{}” are prea multe niveluri de semipreparate (cel mult {MAX_DEPTH})",
                    s(r, "nume")
                ),
            ));
        }
        let mut c = Calc::default();
        for (tip, lid, qty) in lines_of(r) {
            let net = qty as f64 / 1000.0;
            if tip == "ingredient" {
                let Some(ing) = self.ingredients.get(&lid) else {
                    c.warnings.push("o linie are un ingredient șters".into());
                    continue;
                };
                let g = gross(net, i(ing, "pierdere"));
                let cost = g * i(ing, "pret") as f64;
                let name = s(ing, "nume");
                if i(ing, "pret") == 0 {
                    c.warnings.push(format!("„{name}” nu are preț"));
                } else if let (Some(t), Some(d)) = (self.today, day_number(&s(ing, "pret_data")))
                    && t - d > OLD_PRICE_DAYS
                {
                    c.warnings
                        .push(format!("prețul lui „{name}” e mai vechi de {OLD_PRICE_DAYS} de zile"));
                }
                if ing.fields.get("activ") != Some(&json!(true)) {
                    c.warnings.push(format!("„{name}” e inactiv"));
                }
                for a in ing
                    .fields
                    .get("alergeni")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                {
                    if let Some(a) = a.as_str() {
                        c.allergens.insert(a.to_string());
                    }
                }
                if s(ing, "um") == "kg" {
                    c.net_kg += net;
                }
                c.cost_lot += cost;
                c.lines.push(LineCalc {
                    tip,
                    id: lid,
                    name,
                    unit: s(ing, "um"),
                    net,
                    gross: g,
                    cost,
                });
            } else {
                let Some(sub) = self.recipes.get(&lid) else {
                    c.warnings.push("o linie are un semipreparat șters".into());
                    continue;
                };
                let inner = self.calc(&lid, depth + 1)?;
                let per_unit = inner.cost_lot / (i(sub, "lot").max(1) as f64 / 1000.0);
                let cost = net * per_unit;
                c.allergens.extend(inner.allergens.iter().cloned());
                for w in inner.warnings {
                    if !c.warnings.contains(&w) {
                        c.warnings.push(w);
                    }
                }
                if s(sub, "unitate_lot") == "kg" {
                    c.net_kg += net;
                }
                c.cost_lot += cost;
                c.lines.push(LineCalc {
                    tip,
                    id: lid,
                    name: s(sub, "nume"),
                    unit: s(sub, "unitate_lot"),
                    net,
                    gross: net,
                    cost,
                });
            }
        }
        Ok(c)
    }

    /// Whether `target` is reachable from `from` (a recipe containing itself).
    fn reaches(&self, from: &[(String, String, i64)], target: &str, depth: usize) -> bool {
        if depth > MAX_DEPTH + 1 {
            return true;
        }
        from.iter().any(|(tip, id, _)| {
            tip == "reteta"
                && (id == target
                    || self
                        .recipes
                        .get(id)
                        .is_some_and(|r| self.reaches(&lines_of(r), target, depth + 1)))
        })
    }

    /// The gross quantities of ingredients (base units) for `units` of a recipe's lot unit, through the semi-finished.
    fn consume(&self, id: &str, units: f64, out: &mut BTreeMap<String, f64>, depth: usize) -> CoreResult<()> {
        let r = self.recipes.get(id).ok_or_else(|| bad("rețeta", "nu mai există"))?;
        if depth > MAX_DEPTH {
            return Err(bad("rețeta", "prea multe niveluri de semipreparate"));
        }
        let factor = units / (i(r, "lot").max(1) as f64 / 1000.0);
        for (tip, lid, qty) in lines_of(r) {
            let net = qty as f64 / 1000.0 * factor;
            if tip == "ingredient" {
                if let Some(ing) = self.ingredients.get(&lid) {
                    *out.entry(lid).or_default() += gross(net, i(ing, "pierdere"));
                }
            } else {
                self.consume(&lid, net, out, depth + 1)?;
            }
        }
        Ok(())
    }
}

// ---------- arguments ----------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Search {
    #[serde(default)]
    text: String,
    #[serde(default)]
    fel: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct IngredientSave {
    id: Option<Uuid>,
    version: Option<u64>,
    nume: String,
    um: String,
    #[serde(default)]
    pret: i64,
    #[serde(default)]
    pret_data: String,
    #[serde(default)]
    furnizor_nume: String,
    #[serde(default)]
    pierdere: i64,
    #[serde(default)]
    alergeni: Vec<String>,
    #[serde(default)]
    nota: String,
    #[serde(default = "yes")]
    activ: bool,
}

fn yes() -> bool {
    true
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LineIn {
    tip: String,
    id: Uuid,
    /// Thousandths of the base unit (net).
    cantitate: i64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RecipeSave {
    id: Option<Uuid>,
    version: Option<u64>,
    nume: String,
    fel: String,
    #[serde(default)]
    categorie: String,
    /// Thousandths of `unitate_lot`.
    lot: i64,
    unitate_lot: String,
    #[serde(default)]
    linii: Vec<LineIn>,
    #[serde(default)]
    randament_preparare: i64,
    #[serde(default)]
    adaos: i64,
    #[serde(default = "standard_vat")]
    tva: i64,
    #[serde(default)]
    pret_vanzare: i64,
    #[serde(default)]
    preparare: String,
    #[serde(default)]
    nota: String,
    #[serde(default = "yes")]
    activ: bool,
}

fn standard_vat() -> i64 {
    21
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ByIdVersion {
    id: Uuid,
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct One {
    id: Uuid,
    #[serde(default)]
    azi: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct UseLine {
    reteta: Uuid,
    /// Thousandths of the recipe's lot unit (1000 = one portion).
    portii: i64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Use {
    linii: Vec<UseLine>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct UseExport {
    linii: Vec<UseLine>,
    dest: PathBuf,
}

// ---------- the module ----------

impl Recipes {
    fn book(&self, ctx: &mut ModuleContext<'_>, today: Option<i64>) -> CoreResult<Book> {
        Ok(Book {
            ingredients: ctx
                .scan(INGREDIENTS, |r| !r.deleted)?
                .into_iter()
                .map(|r| (r.id.to_string(), r))
                .collect(),
            recipes: ctx
                .scan(RECIPES, |r| !r.deleted)?
                .into_iter()
                .map(|r| (r.id.to_string(), r))
                .collect(),
            today,
        })
    }

    fn live(&self, ctx: &mut ModuleContext<'_>, c: &str, id: Uuid, what: &str) -> CoreResult<RecordState> {
        ctx.get(c, id)?
            .filter(|r| !r.deleted)
            .ok_or_else(|| bad(what, "nu mai există"))
    }

    fn ingredient_save(&self, ctx: &mut ModuleContext<'_>, a: IngredientSave) -> CoreResult<Value> {
        if !UNITS.contains(&a.um.as_str()) {
            return Err(bad("unitatea", "e kg, l sau buc"));
        }
        if a.pret < 0 || !(0..=9000).contains(&a.pierdere) {
            return Err(bad(
                "ingredientul",
                "prețul nu poate fi negativ, iar pierderea e între 0% și 90%",
            ));
        }
        let mut allergens: Vec<String> = Vec::new();
        for x in &a.alergeni {
            if !ALLERGENS.contains(&x.as_str()) {
                return Err(bad("alergenii", format!("„{x}” nu e unul dintre cei 14")));
            }
            if !allergens.contains(x) {
                allergens.push(x.clone());
            }
        }
        let date = a.pret_data.trim();
        if !date.is_empty() && day_number(date).is_none() {
            return Err(bad("data prețului", format!("„{date}” nu e o dată AAAA-LL-ZZ")));
        }
        let (id, expect) = match a.id {
            Some(id) => (
                id,
                a.version
                    .unwrap_or(self.live(ctx, INGREDIENTS, id, "ingredientul")?.version),
            ),
            None => (Uuid::now_v7(), 0),
        };
        let mut f = Fields::new();
        f.insert("nume".into(), json!(text("numele", &a.nume, 120, true)?));
        f.insert("um".into(), json!(a.um));
        f.insert("pret".into(), json!(a.pret));
        f.insert("pret_data".into(), json!(date));
        f.insert(
            "furnizor_nume".into(),
            json!(text("furnizorul", &a.furnizor_nume, 200, false)?),
        );
        f.insert("pierdere".into(), json!(a.pierdere));
        f.insert("alergeni".into(), json!(allergens));
        f.insert("nota".into(), json!(text("nota", &a.nota, 1000, false)?));
        f.insert("activ".into(), json!(a.activ));
        ctx.write(vec![Write::put(INGREDIENTS, id, f).expect(expect)])?;
        Ok(json!({"id": id}))
    }

    fn recipe_save(&self, ctx: &mut ModuleContext<'_>, a: RecipeSave) -> CoreResult<Value> {
        if !KINDS.contains(&a.fel.as_str()) {
            return Err(bad("felul", "e preparat, produs sau semipreparat"));
        }
        if !(1..=100_000_000).contains(&a.lot) {
            return Err(bad("lotul", "e cel puțin o porție (sau o unitate)"));
        }
        if !VAT_RATES.contains(&a.tva) {
            return Err(bad("cota de TVA", "e 21, 11 sau 0"));
        }
        if a.adaos < 0 || a.pret_vanzare < 0 || !(0..=50_000).contains(&a.randament_preparare) || a.linii.len() > 200 {
            return Err(bad(
                "rețeta",
                "adaosul, prețul și randamentul nu pot fi negative; cel mult 200 de linii",
            ));
        }
        let book = self.book(ctx, None)?;
        let id = a.id.unwrap_or_else(Uuid::now_v7);
        let mut lines = Vec::new();
        for l in &a.linii {
            if l.cantitate <= 0 {
                return Err(bad("o linie", "are nevoie de o cantitate pozitivă"));
            }
            let lid = l.id.to_string();
            match l.tip.as_str() {
                "ingredient" if book.ingredients.contains_key(&lid) => {}
                "reteta" if book.recipes.contains_key(&lid) => {
                    if l.id == id {
                        return Err(bad("rețeta", "nu se poate conține pe ea însăși"));
                    }
                }
                _ => return Err(bad("o linie", "ingredientul sau semipreparatul nu mai există")),
            }
            lines.push((l.tip.clone(), lid, l.cantitate));
        }
        if book.reaches(&lines, &id.to_string(), 0) {
            return Err(bad("rețeta", "s-ar conține pe ea însăși printr-un semipreparat"));
        }
        let expect = match a.id {
            Some(x) => a.version.unwrap_or(self.live(ctx, RECIPES, x, "rețeta")?.version),
            None => 0,
        };
        let mut f = Fields::new();
        f.insert("nume".into(), json!(text("numele", &a.nume, 160, true)?));
        f.insert("fel".into(), json!(a.fel));
        f.insert("categorie".into(), json!(text("categoria", &a.categorie, 80, false)?));
        f.insert("lot".into(), json!(a.lot));
        f.insert(
            "unitate_lot".into(),
            json!(text("unitatea lotului", &a.unitate_lot, 20, true)?),
        );
        f.insert(
            "linii".into(),
            json!(
                lines
                    .iter()
                    .map(|(t, i, q)| json!({"tip": t, "id": i, "cantitate": q}))
                    .collect::<Vec<_>>()
            ),
        );
        f.insert("randament_preparare".into(), json!(a.randament_preparare));
        f.insert("adaos".into(), json!(a.adaos));
        f.insert("tva".into(), json!(a.tva));
        f.insert("pret_vanzare".into(), json!(a.pret_vanzare));
        f.insert(
            "preparare".into(),
            json!(text("prepararea", &a.preparare, 4000, false)?),
        );
        f.insert("nota".into(), json!(text("nota", &a.nota, 1000, false)?));
        f.insert("activ".into(), json!(a.activ));
        ctx.write(vec![Write::put(RECIPES, id, f).expect(expect)])?;
        Ok(json!({"id": id}))
    }

    fn recipe_view(&self, ctx: &mut ModuleContext<'_>, a: One) -> CoreResult<Value> {
        let today = day_number(a.azi.trim());
        let book = self.book(ctx, today)?;
        let r = book
            .recipes
            .get(&a.id.to_string())
            .ok_or_else(|| bad("rețeta", "nu mai există"))?;
        let c = book.calc(&a.id.to_string(), 0)?;
        let lot = i(r, "lot").max(1) as f64 / 1000.0;
        let cost_unit = c.cost_lot / lot;
        let (markup, vat, sale) = (i(r, "adaos"), i(r, "tva"), i(r, "pret_vanzare"));
        let proposed = proposed_price(cost_unit, markup, vat);
        let price = if sale > 0 { sale } else { proposed };
        let m = margin(cost_unit, price, vat);
        let yield_ = i(r, "randament_preparare");
        let net_after = (yield_ > 0 && c.net_kg > 0.0).then(|| c.net_kg * yield_ as f64 / 10_000.0);
        let mut v = Value::Object(r.fields.clone());
        v["id"] = json!(r.id);
        v["version"] = json!(r.version);
        v["calcul"] = json!({
            "linii": c.lines.iter().map(|l| json!({"tip": l.tip, "id": l.id, "nume": l.name, "um": l.unit,
                "net": l.net, "brut": l.gross, "cost": l.cost})).collect::<Vec<_>>(),
            "cost_lot": c.cost_lot, "cost_unitate": cost_unit,
            "pret_propus": proposed, "pret": price, "pret_scris": sale > 0,
            "marja": m.map(|x| x.0), "food_cost": m.map(|x| x.1),
            "alergeni": ALLERGENS.iter().filter(|x| c.allergens.contains(**x)).collect::<Vec<_>>(),
            "avertismente": c.warnings,
            "net_kg": c.net_kg, "net_dupa_preparare_kg": net_after,
            "cost_kg_preparat": net_after.filter(|n| *n > 0.0 && s(r, "unitate_lot") == "kg").map(|n| c.cost_lot / n),
        });
        Ok(v)
    }

    fn consumption(&self, ctx: &mut ModuleContext<'_>, lines: &[UseLine]) -> CoreResult<Vec<Value>> {
        let book = self.book(ctx, None)?;
        let mut out: BTreeMap<String, f64> = BTreeMap::new();
        for l in lines {
            if l.portii <= 0 {
                return Err(bad("porțiile", "sunt un număr pozitiv"));
            }
            book.consume(&l.reteta.to_string(), l.portii as f64 / 1000.0, &mut out, 0)?;
        }
        let mut rows: Vec<Value> = out
            .iter()
            .filter_map(|(id, q)| {
                let ing = book.ingredients.get(id)?;
                Some(
                    json!({"ingredient": id, "nume": s(ing, "nume"), "um": s(ing, "um"), "cantitate": q,
                            "cost": q * i(ing, "pret") as f64}),
                )
            })
            .collect();
        rows.sort_by_key(|r| fold(r["nume"].as_str().unwrap_or_default()));
        Ok(rows)
    }
}

/// The consumption as CSV for a spreadsheet: UTF-8 with BOM, „;”, decimal comma.
pub fn consumption_csv(rows: &[Value]) -> String {
    let num = |x: f64, d: usize| format!("{x:.d$}").replace('.', ",");
    let quote = |t: &str| format!("\"{}\"", t.replace('"', "\"\""));
    let mut out = String::from("\u{feff}Ingredient;Cantitate brută;UM;Cost fără TVA (lei)\r\n");
    let mut total = 0.0;
    for r in rows {
        let cost = r["cost"].as_f64().unwrap_or_default() / 100.0;
        total += cost;
        out.push_str(&format!(
            "{};{};{};{}\r\n",
            quote(r["nume"].as_str().unwrap_or_default()),
            num(r["cantitate"].as_f64().unwrap_or_default(), 3),
            quote(r["um"].as_str().unwrap_or_default()),
            num(cost, 2)
        ));
    }
    out.push_str(&format!("\"Total\";;;{}\r\n", num(total, 2)));
    out
}

impl Module for Recipes {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "ingrediente" => {
                let a: Search = args(command, a)?;
                let q = fold(a.text.trim());
                let mut l: Vec<RecordState> = ctx
                    .scan(INGREDIENTS, |r| !r.deleted)?
                    .into_iter()
                    .filter(|r| q.is_empty() || fold(&s(r, "nume")).contains(&q))
                    .collect();
                l.sort_by_key(|r| fold(&s(r, "nume")));
                Ok(json!(
                    l.iter()
                        .map(|r| {
                            let mut v = Value::Object(r.fields.clone());
                            v["id"] = json!(r.id);
                            v["version"] = json!(r.version);
                            v
                        })
                        .collect::<Vec<_>>()
                ))
            }
            "ingredient_save" => self.ingredient_save(ctx, args(command, a)?),
            "ingredient_delete" => {
                let a: ByIdVersion = args(command, a)?;
                let key = a.id.to_string();
                let used = ctx
                    .scan(RECIPES, |r| !r.deleted)?
                    .iter()
                    .filter(|r| lines_of(r).iter().any(|(t, id, _)| t == "ingredient" && *id == key))
                    .count();
                if used > 0 {
                    return Err(bad(
                        "ingredientul",
                        format!("e folosit în {used} rețete: nu se șterge, se marchează inactiv"),
                    ));
                }
                ctx.write(vec![Write::delete(INGREDIENTS, a.id).expect(a.version)])?;
                Ok(json!({"deleted": a.id}))
            }
            "retete" => {
                let a: Search = args(command, a)?;
                let q = fold(a.text.trim());
                let mut l: Vec<RecordState> = ctx
                    .scan(RECIPES, |r| !r.deleted)?
                    .into_iter()
                    .filter(|r| a.fel.as_ref().is_none_or(|f| f.is_empty() || *f == s(r, "fel")))
                    .filter(|r| {
                        q.is_empty() || fold(&s(r, "nume")).contains(&q) || fold(&s(r, "categorie")).contains(&q)
                    })
                    .collect();
                l.sort_by_key(|r| (fold(&s(r, "categorie")), fold(&s(r, "nume"))));
                Ok(json!(
                    l.iter()
                        .map(
                            |r| json!({"id": r.id, "version": r.version, "nume": s(r, "nume"), "fel": s(r, "fel"),
                            "categorie": s(r, "categorie"), "lot": i(r, "lot"), "unitate_lot": s(r, "unitate_lot"),
                            "activ": r.fields.get("activ") == Some(&json!(true))})
                        )
                        .collect::<Vec<_>>()
                ))
            }
            "reteta" => self.recipe_view(ctx, args(command, a)?),
            "reteta_save" => self.recipe_save(ctx, args(command, a)?),
            "reteta_delete" => {
                let a: ByIdVersion = args(command, a)?;
                let key = a.id.to_string();
                let used = ctx
                    .scan(RECIPES, |r| !r.deleted)?
                    .iter()
                    .filter(|r| lines_of(r).iter().any(|(t, id, _)| t == "reteta" && *id == key))
                    .count();
                if used > 0 {
                    return Err(bad(
                        "rețeta",
                        format!("e semipreparat în {used} rețete: nu se șterge, se marchează inactivă"),
                    ));
                }
                ctx.write(vec![Write::delete(RECIPES, a.id).expect(a.version)])?;
                Ok(json!({"deleted": a.id}))
            }
            "reteta_copie" => {
                let a: One = args(command, a)?;
                let r = self.live(ctx, RECIPES, a.id, "rețeta")?;
                let mut f = r.fields.clone();
                let name: String = format!("{} (copie)", s(&r, "nume")).chars().take(160).collect();
                f.insert("nume".into(), json!(name));
                let id = Uuid::now_v7();
                ctx.write(vec![Write::put(RECIPES, id, f).expect(0)])?;
                Ok(json!({"id": id}))
            }
            "consum" => {
                let a: Use = args(command, a)?;
                Ok(json!(self.consumption(ctx, &a.linii)?))
            }
            "consum_export" => {
                let a: UseExport = args(command, a)?;
                let rows = self.consumption(ctx, &a.linii)?;
                ctx.export_bytes(&a.dest, consumption_csv(&rows).as_bytes(), true)?;
                Ok(json!({"salvat": a.dest, "randuri": rows.len()}))
            }
            other => Err(CoreError::invalid("comanda", format!("„{other}” nu există în {ID}"))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gross_price_and_margin() {
        assert!(
            (gross(0.8, 2000) - 1.0).abs() < 1e-12,
            "0,800 kg net at 20 % loss = 1,000 kg gross"
        );
        // 3 × 0,333… lei stays precise; the price is rounded once: 99,9999 bani × 1,5 × 1,11 = 166,4998 → 166.
        let cost = 3.0 * (100.0 / 3.0) - 0.0001;
        assert_eq!(proposed_price(cost, 5000, 11), 166);
        // A line rounded early would have given 33 × 3 = 99 bani → 164,835 → 165.
        assert_ne!(proposed_price(99.0, 5000, 11), 166);
        let (m, fc) = margin(1000.0, 2420, 21).unwrap();
        assert_eq!(
            (m, fc),
            (5000, 5000),
            "2000 net, cost 1000: margin 50 %, food cost 50 %"
        );
        assert!(margin(1.0, 0, 21).is_none());
    }
}
