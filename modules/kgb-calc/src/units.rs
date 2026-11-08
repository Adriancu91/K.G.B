//! Unit conversions with exact factors (D-065). Every factor is the exact
//! definition (the inch is 0,0254 m exactly, the pound 0,45359237 kg, the US
//! gallon 3,785411784 L, the calorie 4,184 J, the IT BTU 1055,05585262 J), so
//! a conversion is exact and only the display rounds.

use crate::exact::{Q, R};

/// A unit: (id, label, exact factor to the category's base unit).
pub type Unit = (&'static str, &'static str, &'static str);

/// (category, label, units).
pub const CATEGORIES: &[(&str, &str, &[Unit])] = &[
    (
        "lungime",
        "Lungime",
        &[
            ("mm", "milimetru", "0.001"),
            ("cm", "centimetru", "0.01"),
            ("m", "metru", "1"),
            ("km", "kilometru", "1000"),
            ("in", "țol (inch)", "0.0254"),
            ("ft", "picior (foot)", "0.3048"),
            ("yd", "yard", "0.9144"),
            ("mi", "milă terestră", "1609.344"),
            ("nmi", "milă marină", "1852"),
        ],
    ),
    (
        "suprafata",
        "Suprafață",
        &[
            ("mm2", "mm²", "0.000001"),
            ("cm2", "cm²", "0.0001"),
            ("m2", "m²", "1"),
            ("ar", "ar", "100"),
            ("ha", "hectar", "10000"),
            ("km2", "km²", "1000000"),
            ("ft2", "picior²", "0.09290304"),
            ("acru", "acru", "4046.8564224"),
        ],
    ),
    (
        "volum",
        "Volum",
        &[
            ("ml", "mililitru", "0.001"),
            ("l", "litru", "1"),
            ("m3", "m³", "1000"),
            ("cm3", "cm³", "0.001"),
            ("gal", "galon american", "3.785411784"),
            ("galuk", "galon britanic", "4.54609"),
        ],
    ),
    (
        "masa",
        "Masă",
        &[
            ("mg", "miligram", "0.000001"),
            ("g", "gram", "0.001"),
            ("kg", "kilogram", "1"),
            ("q", "chintal (100 kg)", "100"),
            ("t", "tonă", "1000"),
            ("lb", "livră (pound)", "0.45359237"),
            ("oz", "uncie", "0.028349523125"),
        ],
    ),
    (
        "energie",
        "Energie",
        &[
            ("j", "joule", "1"),
            ("kj", "kilojoule", "1000"),
            ("mj", "megajoule", "1000000"),
            ("wh", "watt-oră", "3600"),
            ("kwh", "kilowatt-oră", "3600000"),
            ("mwh", "megawatt-oră", "3600000000"),
            ("cal", "calorie", "4.184"),
            ("kcal", "kilocalorie", "4184"),
            ("btu", "BTU", "1055.05585262"),
        ],
    ),
    (
        "temperatura",
        "Temperatură",
        &[
            ("c", "grade Celsius", ""),
            ("f", "grade Fahrenheit", ""),
            ("k", "kelvin", ""),
        ],
    ),
];

fn factor(cat: &str, unit: &str) -> Result<Q, String> {
    let (_, _, units) = CATEGORIES
        .iter()
        .find(|(c, _, _)| *c == cat)
        .ok_or("categoria nu există")?;
    let (_, _, f) = units
        .iter()
        .find(|(u, _, _)| *u == unit)
        .ok_or_else(|| format!("unitatea „{unit}” nu există în această categorie"))?;
    Q::parse(&f.replace('.', ","))
}

/// Temperature to kelvin and back (affine, exact: °F = °C × 9/5 + 32).
fn to_kelvin(unit: &str, v: Q) -> R {
    let k0 = Q::new(27315, 100)?;
    match unit {
        "c" => v.plus(k0),
        "k" => Ok(v),
        "f" => v.minus(Q::int(32))?.times(Q::new(5, 9)?)?.plus(k0),
        _ => Err("unitatea de temperatură nu există".into()),
    }
}
fn from_kelvin(unit: &str, k: Q) -> R {
    let k0 = Q::new(27315, 100)?;
    match unit {
        "c" => k.minus(k0),
        "k" => Ok(k),
        "f" => k.minus(k0)?.times(Q::new(9, 5)?)?.plus(Q::int(32)),
        _ => Err("unitatea de temperatură nu există".into()),
    }
}

/// Converts `value` from `from` to `to` within `category`.
pub fn convert(category: &str, value: Q, from: &str, to: &str) -> R {
    if category == "temperatura" {
        let k = to_kelvin(from, value)?;
        if k < Q::int(0) {
            return Err("sub zero absolut (0 K)".into());
        }
        return from_kelvin(to, k);
    }
    value.times(factor(category, from)?)?.over(factor(category, to)?)
}
