//! Collection schemas: structured records (Etapa 2, step 2.6).
//!
//! A module may declare, per collection in its manifest, which fields a record
//! has, their types, which are required and their limits. The core checks every
//! write of the module against it (`ModuleContext::write`), so a module bug
//! cannot store malformed records. Schemas change only together with the
//! module's `data_format` and a migration.

use std::collections::BTreeMap;

use kgb_store::Fields;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{CoreError, CoreResult};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldType {
    String,
    /// Any JSON number.
    Number,
    /// A whole number (no fractional part).
    Integer,
    Bool,
    Array,
    Object,
    /// No type check (still subject to `required`).
    Any,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FieldSchema {
    #[serde(rename = "type")]
    pub ty: FieldType,
    #[serde(default)]
    pub required: bool,
    /// May the value be `null`?
    #[serde(default)]
    pub nullable: bool,
    /// Strings: maximum length in characters. Arrays: maximum items.
    #[serde(default)]
    pub max_len: Option<usize>,
    /// Numbers: inclusive bounds.
    #[serde(default)]
    pub min: Option<f64>,
    #[serde(default)]
    pub max: Option<f64>,
    /// Strings: allowed values.
    #[serde(default, rename = "enum")]
    pub one_of: Option<Vec<String>>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CollectionSchema {
    pub fields: BTreeMap<String, FieldSchema>,
    /// Are fields not listed in `fields` allowed?
    #[serde(default)]
    pub additional: bool,
}

fn bad(field: &str, detail: impl Into<String>) -> CoreError {
    CoreError::invalid(format!("câmpul „{field}”"), detail)
}

impl CollectionSchema {
    /// Checks the schema itself (used when the manifest is validated).
    pub fn validate_self(&self) -> Result<(), String> {
        for (name, f) in &self.fields {
            if name.is_empty() || name.len() > 64 {
                return Err(format!("numele câmpului „{name}” trebuie să aibă 1–64 de caractere"));
            }
            let numeric = matches!(f.ty, FieldType::Number | FieldType::Integer);
            if (f.min.is_some() || f.max.is_some()) && !numeric {
                return Err(format!("„{name}”: min/max doar pentru numere"));
            }
            if let (Some(a), Some(b)) = (f.min, f.max)
                && a > b
            {
                return Err(format!("„{name}”: min > max"));
            }
            if f.max_len.is_some() && !matches!(f.ty, FieldType::String | FieldType::Array) {
                return Err(format!("„{name}”: max_len doar pentru text sau liste"));
            }
            if f.one_of.is_some() && f.ty != FieldType::String {
                return Err(format!("„{name}”: enum doar pentru text"));
            }
            if f.one_of.as_ref().is_some_and(Vec::is_empty) {
                return Err(format!("„{name}”: enum gol"));
            }
        }
        Ok(())
    }

    /// Checks one record against the schema.
    pub fn check(&self, fields: &Fields) -> CoreResult<()> {
        for (name, f) in &self.fields {
            match fields.get(name) {
                None if f.required => return Err(bad(name, "lipsește, dar e obligatoriu")),
                None => {}
                Some(Value::Null) if f.nullable => {}
                Some(Value::Null) => return Err(bad(name, "nu poate fi gol (null)")),
                Some(v) => check_value(name, f, v)?,
            }
        }
        if !self.additional
            && let Some(extra) = fields.keys().find(|k| !self.fields.contains_key(*k))
        {
            return Err(bad(extra, "nu este declarat în schema colecției"));
        }
        Ok(())
    }
}

fn check_value(name: &str, f: &FieldSchema, v: &Value) -> CoreResult<()> {
    let type_ok = match f.ty {
        FieldType::String => v.is_string(),
        FieldType::Number => v.is_number(),
        FieldType::Integer => v.is_i64() || v.is_u64(),
        FieldType::Bool => v.is_boolean(),
        FieldType::Array => v.is_array(),
        FieldType::Object => v.is_object(),
        FieldType::Any => true,
    };
    if !type_ok {
        return Err(bad(name, format!("trebuie să fie de tipul {:?}", f.ty).to_lowercase()));
    }
    if let Some(max) = f.max_len {
        let len = match v {
            Value::String(s) => s.chars().count(),
            Value::Array(a) => a.len(),
            _ => 0,
        };
        if len > max {
            return Err(bad(name, format!("are {len} elemente/caractere, maximum {max}")));
        }
    }
    if let Some(n) = v.as_f64()
        && (f.min.is_some_and(|m| n < m) || f.max.is_some_and(|m| n > m))
    {
        return Err(bad(name, format!("{n} nu este între {:?} și {:?}", f.min, f.max)));
    }
    if let (Some(allowed), Some(s)) = (&f.one_of, v.as_str())
        && !allowed.iter().any(|a| a == s)
    {
        return Err(bad(name, format!("„{s}” nu este una dintre valorile permise")));
    }
    Ok(())
}
