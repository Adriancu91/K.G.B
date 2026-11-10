//! InfoNews (Etapa 7, step 7.5): the module „Știri”. The feeds are read by the app's core, only from the RSS
//! sources approved and switched on in „Surse externe” (D-062; kgb_core::news parses them, the app fetches them);
//! the module keeps the items the person wants to find again.
//!
//! Commands:
//! - `pastrate` → the kept items, newest kept first
//! - `pastreaza {titlu, link, ms, sursa, rezumat}` → the kept item (the same link is kept once)
//! - `uita {id, version}` → `{uitat: id}`

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, RecordState, Write};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.news";
const KEPT: &str = "pastrate";
/// At most this many kept items.
const KEPT_MAX: usize = 1000;

pub struct News {
    manifest: Manifest,
}

impl News {
    pub fn new() -> News {
        News {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for News {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Serialize)]
struct Kept {
    id: Uuid,
    version: u64,
    titlu: String,
    link: String,
    ms: i64,
    sursa: String,
    rezumat: String,
    pastrat_ms: i64,
}

fn kept(r: &RecordState) -> Kept {
    let s = |k: &str| r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    let i = |k: &str| r.fields.get(k).and_then(Value::as_i64).unwrap_or(0);
    Kept {
        id: r.id,
        version: r.version,
        titlu: s("titlu"),
        link: s("link"),
        ms: i("ms"),
        sursa: s("sursa"),
        rezumat: s("rezumat"),
        pastrat_ms: i("pastrat_ms"),
    }
}

fn args<T: DeserializeOwned>(command: &str, v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid(format!("argumentele comenzii {command}"), e.to_string()))
}

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("știrea", detail)
}

fn cut(s: &str, max: usize) -> String {
    s.trim().chars().filter(|c| !c.is_control()).take(max).collect()
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Keep {
    titlu: String,
    link: String,
    #[serde(default)]
    ms: i64,
    sursa: String,
    #[serde(default)]
    rezumat: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Forget {
    id: Uuid,
    version: u64,
}

impl Module for News {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "pastrate" => {
                let mut v: Vec<Kept> = ctx.scan(KEPT, |r| !r.deleted)?.iter().map(kept).collect();
                v.sort_by_key(|k| std::cmp::Reverse(k.pastrat_ms));
                Ok(json!(v))
            }
            "pastreaza" => {
                let a: Keep = args(command, a)?;
                let titlu = cut(&a.titlu, 300);
                let link = a.link.trim().to_string();
                if titlu.is_empty() {
                    return Err(bad("nu are titlu"));
                }
                let web = link.to_ascii_lowercase();
                if !(web.starts_with("https://") || web.starts_with("http://"))
                    || link.len() > 2000
                    || link.chars().any(char::is_whitespace)
                {
                    return Err(bad("legătura nu e o adresă web"));
                }
                let all = ctx.scan(KEPT, |r| !r.deleted)?;
                if let Some(r) = all
                    .iter()
                    .find(|r| r.fields.get("link").and_then(Value::as_str) == Some(link.as_str()))
                {
                    return Ok(json!(kept(r)));
                }
                if all.len() >= KEPT_MAX {
                    return Err(bad(format!("sunt deja {KEPT_MAX} știri păstrate; uită câteva întâi")));
                }
                let mut f = Fields::new();
                f.insert("titlu".into(), json!(titlu));
                f.insert("link".into(), json!(link));
                f.insert("ms".into(), json!(a.ms));
                f.insert("sursa".into(), json!(cut(&a.sursa, 200)));
                f.insert("rezumat".into(), json!(cut(&a.rezumat, 600)));
                f.insert("pastrat_ms".into(), json!(now_ms() as i64));
                let id = Uuid::now_v7();
                ctx.write(vec![Write::put(KEPT, id, f).expect(0)])?;
                ctx.log("știre păstrată");
                let r = ctx.get(KEPT, id)?.ok_or_else(|| bad("nu s-a păstrat"))?;
                Ok(json!(kept(&r)))
            }
            "uita" => {
                let a: Forget = args(command, a)?;
                ctx.write(vec![Write::delete(KEPT, a.id).expect(a.version)])?;
                Ok(json!({ "uitat": a.id }))
            }
            _ => Err(CoreError::invalid(
                "modulul Știri",
                format!("comandă necunoscută „{command}”"),
            )),
        }
    }
}
