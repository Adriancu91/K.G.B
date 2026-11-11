//! `kgb.docs` — library of document models (Etapa 4, step 4.8; Master Plan
//! §6.5; D-045).
//!
//! - **Models** are Word files (DOCX) with `{{fields}}`. Five are built in
//!   (administrative, commercial ×2, HR, technical); the user can import their
//!   own. Each model is a versioned document (D-034): its original is version
//!   1 and never changes; an edited model is saved as a new version.
//! - **Company data** (`{{firma.*}}`) is entered once, in „Date firmă”. When a
//!   document is generated these fields come only from there: values typed in
//!   the form for `firma.*` are refused.
//! - **Generating** fills the model's current version, refuses missing values
//!   (it never leaves a field empty silently), checks the result and keeps it
//!   as a new document, together with the model, its version and the values.
//!
//! Commands: `company`, `company_save`, `models`, `import` (from the file
//! dialog), `model_import`, `model_set`,
//! `model_update`, `model_versions`, `model_delete`, `generate`, `generated`, `text`,
//! `export`, `delete_generated`; forms (step 4.9): `forms`, `form_save`,
//! `form_delete`, `answer_save`, `answers`, `answer_delete`, `export_answers`.

pub mod fill;
pub mod forms;
pub mod pdf;

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.docs";
const COMPANY: &str = "firma";
const MODELS: &str = "modele";
const GENERATED: &str = "generate";
const MAX_VALUE: usize = 2_000;

/// Company fields, in the order the form shows them.
pub const COMPANY_FIELDS: [(&str, &str); 10] = [
    ("nume", "Denumire"),
    ("cui", "CUI"),
    ("reg_com", "Nr. Registrul Comerțului"),
    ("adresa", "Sediu"),
    ("iban", "IBAN"),
    ("banca", "Banca"),
    ("telefon", "Telefon"),
    ("email", "E-mail"),
    ("reprezentant", "Reprezentant legal"),
    ("functie_reprezentant", "Funcția reprezentantului"),
];

/// The built-in Word models (key, name, category, file).
const BUILT_IN: [(&str, &str, &str, &[u8]); 5] = [
    (
        "cerere",
        "Cerere",
        "administrativ",
        include_bytes!("../models/administrativ-cerere.docx"),
    ),
    (
        "oferta",
        "Ofertă comercială",
        "comercial",
        include_bytes!("../models/comercial-oferta.docx"),
    ),
    (
        "contract-servicii",
        "Contract de prestări servicii",
        "comercial",
        include_bytes!("../models/comercial-contract-servicii.docx"),
    ),
    (
        "adeverinta-salariat",
        "Adeverință de salariat",
        "hr",
        include_bytes!("../models/hr-adeverinta-salariat.docx"),
    ),
    (
        "pv-receptie",
        "Proces-verbal de recepție",
        "tehnic",
        include_bytes!("../models/tehnic-pv-receptie.docx"),
    ),
];
/// The built-in PDF models, written in Typst (step 4.8b; D-045).
const BUILT_IN_PDF: [(&str, &str, &str, &str); 17] = [
    (
        "pdf-oferta",
        "Ofertă comercială (PDF)",
        "comercial",
        include_str!("../models/pdf-oferta.typ"),
    ),
    (
        "pdf-pv-receptie",
        "Proces-verbal de recepție (PDF)",
        "tehnic",
        include_str!("../models/pdf-pv-receptie.typ"),
    ),
    (
        "pdf-adeverinta-salariat",
        "Adeverință de salariat (PDF)",
        "hr",
        include_str!("../models/pdf-adeverinta-salariat.typ"),
    ),
    // Step 7.4i: more models, written by K.G.B.; parties fill from the partner directory.
    (
        "pdf-contract-vanzare",
        "Contract de vânzare-cumpărare (PDF)",
        "comercial",
        include_str!("../models/pdf-contract-vanzare.typ"),
    ),
    (
        "pdf-contract-inchiriere",
        "Contract de închiriere (PDF)",
        "comercial",
        include_str!("../models/pdf-contract-inchiriere.typ"),
    ),
    (
        "pdf-pv-predare-primire",
        "Proces-verbal de predare-primire (PDF)",
        "tehnic",
        include_str!("../models/pdf-pv-predare-primire.typ"),
    ),
    (
        "pdf-decizie",
        "Decizie (PDF)",
        "administrativ",
        include_str!("../models/pdf-decizie.typ"),
    ),
    (
        "pdf-imputernicire",
        "Împuternicire (PDF)",
        "administrativ",
        include_str!("../models/pdf-imputernicire.typ"),
    ),
    (
        "pdf-nir",
        "Notă de intrare-recepție (NIR) (PDF)",
        "tehnic",
        include_str!("../models/pdf-nir.typ"),
    ),
    // Step 7.9d: models by category, for institutions, partners and the team.
    (
        "pdf-adresa",
        "Adresă oficială (PDF)",
        "administrativ",
        include_str!("../models/pdf-adresa.typ"),
    ),
    (
        "pdf-pv-sedinta",
        "Proces-verbal de ședință (PDF)",
        "administrativ",
        include_str!("../models/pdf-pv-sedinta.typ"),
    ),
    (
        "pdf-cerere-concediu",
        "Cerere de concediu de odihnă (PDF)",
        "hr",
        include_str!("../models/pdf-cerere-concediu.typ"),
    ),
    (
        "pdf-pv-constatare",
        "Proces-verbal de constatare (PDF)",
        "tehnic",
        include_str!("../models/pdf-pv-constatare.typ"),
    ),
    (
        "pdf-notificare",
        "Notificare (PDF)",
        "juridic",
        include_str!("../models/pdf-notificare.typ"),
    ),
    (
        "pdf-somatie-plata",
        "Somație de plată (PDF)",
        "juridic",
        include_str!("../models/pdf-somatie-plata.typ"),
    ),
    (
        "pdf-cerere-institutie",
        "Cerere pentru aviz sau autorizație (PDF)",
        "avize",
        include_str!("../models/pdf-cerere-institutie.typ"),
    ),
    (
        "pdf-declaratie-proprie-raspundere",
        "Declarație pe propria răspundere (PDF)",
        "avize",
        include_str!("../models/pdf-declaratie-proprie-raspundere.typ"),
    ),
];
const CATEGORIES: [&str; 7] = [
    "administrativ",
    "comercial",
    "hr",
    "tehnic",
    "juridic",
    "avize",
    "altele",
];

pub struct Docs {
    manifest: Manifest,
}

impl Docs {
    pub fn new() -> Docs {
        Docs {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Docs {
    fn default() -> Self {
        Self::new()
    }
}

fn bad(detail: impl Into<String>) -> CoreError {
    CoreError::invalid("documentul", detail)
}

fn args<T: DeserializeOwned>(v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid("argumentele comenzii", e.to_string()))
}

fn s(r: &RecordState, k: &str) -> String {
    r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn uuid_of(r: &RecordState, k: &str) -> CoreResult<Uuid> {
    s(r, k).parse().map_err(|_| bad("referință stricată la document"))
}

/// Romanian names for the usual field words (field names stay ASCII).
const WORDS: [(&str, &str); 22] = [
    ("numar", "Număr"),
    ("pret", "Preț"),
    ("cui", "CUI"),
    ("adresa", "adresa"),
    ("termen_plata", "Termen de plată"),
    ("termen_livrare", "Termen de livrare"),
    ("conditii_plata", "Condiții de plată"),
    ("valabil_pana_la", "Valabil până la"),
    ("data_angajarii", "Data angajării"),
    ("durata_contract", "Durata contractului"),
    ("functie", "Funcția"),
    ("constatari", "Constatări"),
    ("locatie", "Locația"),
    ("solicitare", "Solicitarea"),
    ("destinatar", "Destinatar"),
    ("concluzie", "Concluzia"),
    ("valoare", "Valoarea"),
    ("durata", "Durata"),
    ("obiect", "Obiectul"),
    ("scop", "Scopul"),
    ("angajat", "Angajat"),
    ("reprezentant", "reprezentant"),
];

/// A readable label for a field: `client.adresa` → „Client · adresa”,
/// `termen_plata` → „Termen de plată”.
pub fn label(field: &str) -> String {
    if let Some(k) = field.strip_prefix("firma.")
        && let Some((_, l)) = COMPANY_FIELDS.iter().find(|(f, _)| *f == k)
    {
        return format!("Firma · {l}");
    }
    let word = |w: &str| {
        WORDS
            .iter()
            .find(|(k, _)| *k == w)
            .map(|(_, v)| v.to_string())
            .unwrap_or_else(|| w.replace('_', " "))
    };
    let mut parts = field.split('.').map(word);
    let first = parts.next().unwrap_or_default();
    let mut c = first.chars();
    let head = c
        .next()
        .map(|x| x.to_uppercase().collect::<String>() + c.as_str())
        .unwrap_or_default();
    std::iter::once(head).chain(parts).collect::<Vec<_>>().join(" · ")
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CompanySave {
    #[serde(default)]
    version: Option<u64>,
    valori: BTreeMap<String, String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ModelImport {
    name: String,
    data: String,
    categorie: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct FromDialog {
    name: String,
    data: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ModelSet {
    id: Uuid,
    #[serde(default)]
    nume: Option<String>,
    #[serde(default)]
    categorie: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ModelUpdate {
    id: Uuid,
    data: String,
    #[serde(default)]
    nota: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ById {
    id: Uuid,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Generate {
    model: Uuid,
    valori: BTreeMap<String, String>,
    #[serde(default)]
    nume: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ExportAnswers {
    formular: Uuid,
    format: String,
    #[serde(default)]
    stil: Option<String>,
    dest: PathBuf,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Export {
    id: Uuid,
    dest: PathBuf,
}

fn decode(data: &str) -> CoreResult<Vec<u8>> {
    B64.decode(data.as_bytes())
        .map_err(|_| bad("conținutul nu este valid (base64)"))
}

/// `docx` (Word) or `pdf` (built-in Typst model); older records are Word.
fn format_of(r: &RecordState) -> String {
    r.fields
        .get("format")
        .and_then(Value::as_str)
        .unwrap_or("docx")
        .to_string()
}

fn fields_of(r: &RecordState, data: &[u8]) -> CoreResult<BTreeSet<String>> {
    if format_of(r) == "pdf" {
        Ok(pdf::fields_in(
            std::str::from_utf8(data).map_err(|_| bad("modelul PDF nu este text UTF-8"))?,
        ))
    } else {
        fill::fields_in(data).map_err(bad)
    }
}

/// A model must be a readable DOCX with at least one `{{field}}`.
fn check_model(data: &[u8]) -> CoreResult<BTreeSet<String>> {
    let fields = fill::fields_in(data).map_err(bad)?;
    if fields.is_empty() {
        return Err(bad("modelul nu are niciun câmp de forma {{nume_camp}}"));
    }
    Ok(fields)
}

impl Docs {
    fn company(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<Option<RecordState>> {
        Ok(ctx.scan(COMPANY, |_| true)?.into_iter().next())
    }

    /// Built-in models are added once, the first time the list is shown.
    fn ensure_built_in(&self, ctx: &mut ModuleContext<'_>) -> CoreResult<()> {
        let have: BTreeSet<String> = ctx
            .scan(MODELS, |r| r.fields.get("sursa") == Some(&json!("inclus")))?
            .iter()
            .map(|r| s(r, "cheie"))
            .collect();
        let all = BUILT_IN.iter().map(|(k, n, c, d)| (*k, *n, *c, *d, "docx")).chain(
            BUILT_IN_PDF
                .iter()
                .map(|(k, n, c, d)| (*k, *n, *c, d.as_bytes(), "pdf")),
        );
        for (key, name, cat, data, format) in all {
            if have.contains(key) {
                continue;
            }
            let file = if format == "pdf" {
                format!("{name}.typ")
            } else {
                format!("{name}.docx")
            };
            let d = ctx.import_document(&file, data)?;
            let mut f = Fields::new();
            f.insert("nume".into(), json!(name));
            f.insert("categorie".into(), json!(cat));
            f.insert("sursa".into(), json!("inclus"));
            f.insert("cheie".into(), json!(key));
            f.insert("format".into(), json!(format));
            f.insert("document".into(), json!(d.id.to_string()));
            f.insert("creat_ms".into(), json!(now_ms()));
            ctx.write(vec![Write::put(MODELS, Uuid::now_v7(), f).expect(0)])?;
        }
        Ok(())
    }

    fn model_view(&self, ctx: &mut ModuleContext<'_>, r: &RecordState) -> CoreResult<Value> {
        let doc = uuid_of(r, "document")?;
        let (v, data) = ctx.read_document(doc, None)?;
        let fields: Vec<Value> = fields_of(r, &data)?
            .into_iter()
            .map(|f| json!({"camp": f, "eticheta": label(&f), "din_firma": f.starts_with("firma.")}))
            .collect();
        Ok(json!({
            "id": r.id, "version": r.version, "nume": s(r, "nume"), "categorie": s(r, "categorie"),
            "sursa": s(r, "sursa"), "cheie": s(r, "cheie"), "document": doc, "versiune": v.number, "campuri": fields,
            "format": format_of(r),
        }))
    }

    fn generate(&self, ctx: &mut ModuleContext<'_>, a: Generate) -> CoreResult<Value> {
        let m = ctx
            .get(MODELS, a.model)?
            .filter(|r| !r.deleted)
            .ok_or_else(|| bad("modelul nu mai există"))?;
        let (ver, data) = ctx.read_document(uuid_of(&m, "document")?, None)?;
        let wanted = fields_of(&m, &data)?;
        let format = format_of(&m);

        // Company fields come only from „Date firmă”.
        if let Some(k) = a.valori.keys().find(|k| k.starts_with("firma.")) {
            return Err(bad(format!(
                "„{}” se completează doar din Date firmă, nu din formular",
                label(k)
            )));
        }
        let company = self.company(ctx)?;
        let mut values: BTreeMap<String, String> = BTreeMap::new();
        let mut missing = Vec::new();
        for f in &wanted {
            let v = match f.strip_prefix("firma.") {
                Some(k) => company.as_ref().map(|c| s(c, k)).unwrap_or_default(),
                None => a.valori.get(f).cloned().unwrap_or_default(),
            };
            let v = v.trim().to_string();
            if v.is_empty() {
                missing.push(label(f));
            } else if v.chars().count() > MAX_VALUE {
                return Err(bad(format!("„{}” are mai mult de {MAX_VALUE} de caractere", label(f))));
            } else {
                values.insert(f.clone(), v);
            }
        }
        if !missing.is_empty() {
            return Err(bad(format!("lipsesc valori pentru: {}", missing.join(", "))));
        }
        let (bytes, replaced) = if format == "pdf" {
            let src = String::from_utf8(data).map_err(|_| bad("modelul PDF nu este text UTF-8"))?;
            let pdf = pdf::render(&src, &values).map_err(|e| bad(format!("PDF-ul nu a putut fi generat: {e}")))?;
            // The check before keeping it: the PDF opens and every word of
            // every value is in its text (lines may wrap differently).
            let text: String = pdf::text(&pdf)
                .map_err(bad)?
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            if let Some((k, _)) = values
                .iter()
                .find(|(_, v)| !v.split_whitespace().all(|w| text.contains(w)))
            {
                return Err(bad(format!(
                    "verificarea a eșuat: valoarea „{}” nu apare în PDF",
                    label(k)
                )));
            }
            (pdf, wanted.len())
        } else {
            let filled = fill::fill(&data, &values).map_err(bad)?;
            // The check before keeping it: a readable DOCX, no field left, and
            // every value present in the text.
            let left = fill::fields_in(&filled.bytes).map_err(|e| bad(format!("verificarea a eșuat: {e}")))?;
            if !left.is_empty() {
                return Err(bad(format!(
                    "verificarea a eșuat: au rămas câmpuri ({})",
                    left.into_iter().collect::<Vec<_>>().join(", ")
                )));
            }
            let text = fill::text(&filled.bytes).map_err(bad)?;
            if let Some((k, _)) = values.iter().find(|(_, v)| !v.lines().all(|l| text.contains(l))) {
                return Err(bad(format!(
                    "verificarea a eșuat: valoarea „{}” nu apare în document",
                    label(k)
                )));
            }
            (filled.bytes, filled.replaced)
        };

        let model_name = s(&m, "nume");
        let name = a
            .nume
            .map(|n| n.trim().to_string())
            .filter(|n| !n.is_empty())
            .unwrap_or_else(|| model_name.clone());
        let name: String = name.chars().filter(|c| !"\\/:*?\"<>|".contains(*c)).take(150).collect();
        let doc = ctx.import_document(&format!("{name}.{format}"), &bytes)?;
        let mut f = Fields::new();
        f.insert("nume".into(), json!(name));
        f.insert("model".into(), json!(m.id.to_string()));
        f.insert("model_nume".into(), json!(model_name));
        f.insert("model_versiune".into(), json!(ver.number));
        f.insert("document".into(), json!(doc.id.to_string()));
        f.insert("valori".into(), json!(values));
        f.insert("format".into(), json!(format));
        f.insert("creat_ms".into(), json!(now_ms()));
        let id = Uuid::now_v7();
        ctx.write(vec![Write::put(GENERATED, id, f).expect(0)])?;
        ctx.log("document generat");
        Ok(
            json!({"id": id, "document": doc.id, "nume": name, "inlocuiri": replaced, "model_versiune": ver.number, "format": format}),
        )
    }
}

impl Module for Docs {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "company" => {
                let c = self.company(ctx)?;
                let fields: Vec<Value> = COMPANY_FIELDS
                    .iter()
                    .map(|(k, l)| json!({"camp": k, "eticheta": l, "valoare": c.as_ref().map(|r| s(r, k)).unwrap_or_default()}))
                    .collect();
                Ok(json!({"campuri": fields, "version": c.as_ref().map(|r| r.version)}))
            }
            "company_save" => {
                let a: CompanySave = args(a)?;
                if let Some(k) = a.valori.keys().find(|k| !COMPANY_FIELDS.iter().any(|(f, _)| f == k)) {
                    return Err(bad(format!("câmpul „{k}” nu face parte din datele firmei")));
                }
                let cur = self.company(ctx)?;
                let mut f = Fields::new();
                for (k, _) in COMPANY_FIELDS {
                    let v = a.valori.get(k).map(|v| v.trim().to_string()).unwrap_or_default();
                    if v.chars().count() > 300 {
                        return Err(bad(format!("„{k}” are mai mult de 300 de caractere")));
                    }
                    f.insert(k.into(), if v.is_empty() { Value::Null } else { json!(v) });
                }
                f.insert("actualizat_ms".into(), json!(now_ms()));
                let (id, w) = match cur {
                    Some(c) => (
                        c.id,
                        Write::put(COMPANY, c.id, f).expect(a.version.unwrap_or(c.version)),
                    ),
                    None => {
                        let id = Uuid::now_v7();
                        (id, Write::put(COMPANY, id, f).expect(0))
                    }
                };
                ctx.write(vec![w])?;
                Ok(json!({"id": id}))
            }
            "models" => {
                self.ensure_built_in(ctx)?;
                let mut list = ctx.scan(MODELS, |_| true)?;
                list.sort_by_key(|r| {
                    (
                        CATEGORIES
                            .iter()
                            .position(|c| r.fields.get("categorie") == Some(&json!(c))),
                        s(r, "nume").to_lowercase(),
                    )
                });
                let mut out = Vec::new();
                for r in &list {
                    out.push(self.model_view(ctx, r)?);
                }
                Ok(json!(out))
            }
            // From the system file dialog (the app passes {name, data}); the
            // category can be changed afterwards with `model_set`.
            "import" => {
                let a: FromDialog = args(a)?;
                self.handle(
                    ctx,
                    "model_import",
                    json!({"name": a.name, "data": a.data, "categorie": "altele"}),
                )
            }
            "model_set" => {
                let a: ModelSet = args(a)?;
                let m = ctx
                    .get(MODELS, a.id)?
                    .filter(|r| !r.deleted)
                    .ok_or_else(|| bad("modelul nu mai există"))?;
                let mut f = m.fields.clone();
                if let Some(n) = a.nume.map(|n| n.trim().to_string()) {
                    if n.is_empty() || n.chars().count() > 200 {
                        return Err(bad("numele modelului trebuie să aibă între 1 și 200 de caractere"));
                    }
                    f.insert("nume".into(), json!(n));
                }
                if let Some(c) = a.categorie {
                    if !CATEGORIES.contains(&c.as_str()) {
                        return Err(bad(format!("categoria „{c}” nu există")));
                    }
                    f.insert("categorie".into(), json!(c));
                }
                ctx.write(vec![Write::put(MODELS, a.id, f).expect(m.version)])?;
                Ok(json!({"id": a.id}))
            }
            // „Folosește în editor” (7.4l-5b, D-080): the model's .docx as it is (with its {{fields}}), for the page
            // to save a copy as a new document of kgb.write. Only reading: the model stays as it is.
            "model_read" => {
                let a: ById = args(a)?;
                let m = ctx
                    .get(MODELS, a.id)?
                    .filter(|r| !r.deleted)
                    .ok_or_else(|| bad("modelul nu mai există"))?;
                if format_of(&m) != "docx" {
                    return Err(bad("doar modelele .docx se deschid în editorul de documente"));
                }
                let (_, data) = ctx.read_document(uuid_of(&m, "document")?, None)?;
                let name: String = s(&m, "nume")
                    .chars()
                    .map(|c| if "\\/:*?\"<>|".contains(c) || c.is_control() { '-' } else { c })
                    .collect();
                let name = if name.trim().is_empty() { "Model".to_string() } else { name.trim().to_string() };
                Ok(json!({"name": format!("{name}.docx"), "data": B64.encode(&data)}))
            }
            "model_import" => {
                let a: ModelImport = args(a)?;
                if !CATEGORIES.contains(&a.categorie.as_str()) {
                    return Err(bad(format!("categoria „{}” nu există", a.categorie)));
                }
                if !a.name.to_lowercase().ends_with(".docx") {
                    return Err(bad("modelele sunt fișiere Word .docx"));
                }
                let data = decode(&a.data)?;
                check_model(&data)?;
                let d = ctx.import_document(&a.name, &data)?;
                let mut f = Fields::new();
                f.insert(
                    "nume".into(),
                    json!(a.name.trim_end_matches(".docx").trim_end_matches(".DOCX")),
                );
                f.insert("categorie".into(), json!(a.categorie));
                f.insert("sursa".into(), json!("importat"));
                f.insert("cheie".into(), Value::Null);
                f.insert("document".into(), json!(d.id.to_string()));
                f.insert("creat_ms".into(), json!(now_ms()));
                let id = Uuid::now_v7();
                ctx.write(vec![Write::put(MODELS, id, f).expect(0)])?;
                let r = ctx.get(MODELS, id)?.ok_or_else(|| bad("modelul nu a fost salvat"))?;
                self.model_view(ctx, &r)
            }
            "model_update" => {
                let a: ModelUpdate = args(a)?;
                let m = ctx
                    .get(MODELS, a.id)?
                    .filter(|r| !r.deleted)
                    .ok_or_else(|| bad("modelul nu mai există"))?;
                if format_of(&m) == "pdf" {
                    return Err(bad(
                        "modelele PDF incluse nu se înlocuiesc; folosește un model Word propriu",
                    ));
                }
                let data = decode(&a.data)?;
                check_model(&data)?;
                let doc = uuid_of(&m, "document")?;
                let (cur, _) = ctx.read_document(doc, None)?;
                let note = if a.nota.trim().is_empty() {
                    "model actualizat"
                } else {
                    a.nota.trim()
                };
                let v = ctx.save_document(doc, cur.number, &data, note)?;
                Ok(json!({"versiune": v.number}))
            }
            "model_versions" => {
                let a: ById = args(a)?;
                let m = ctx
                    .get(MODELS, a.id)?
                    .filter(|r| !r.deleted)
                    .ok_or_else(|| bad("modelul nu mai există"))?;
                Ok(json!(ctx.document_versions(uuid_of(&m, "document")?)?))
            }
            "model_delete" => {
                let a: ById = args(a)?;
                let m = ctx
                    .get(MODELS, a.id)?
                    .filter(|r| !r.deleted)
                    .ok_or_else(|| bad("modelul nu mai există"))?;
                if s(&m, "sursa") == "inclus" {
                    return Err(bad("modelele incluse în aplicație nu se șterg"));
                }
                // The model's file stays while documents generated from it exist.
                ctx.write(vec![Write::delete(MODELS, a.id).expect(m.version)])?;
                Ok(json!({"deleted": a.id}))
            }
            "generate" => self.generate(ctx, args(a)?),
            "generated" => {
                let mut list = ctx.scan(GENERATED, |_| true)?;
                list.sort_by_key(|r| std::cmp::Reverse(r.id));
                Ok(json!(
                    list.iter()
                        .map(|r| {
                            let mut v = Value::Object(r.fields.clone());
                            v["id"] = json!(r.id);
                            v
                        })
                        .collect::<Vec<_>>()
                ))
            }
            "text" => {
                let a: ById = args(a)?;
                let r = ctx
                    .get(GENERATED, a.id)?
                    .filter(|r| !r.deleted)
                    .ok_or_else(|| bad("documentul nu mai există"))?;
                let (_, data) = ctx.read_document(uuid_of(&r, "document")?, None)?;
                let text = if format_of(&r) == "pdf" {
                    pdf::text(&data).map_err(bad)?
                } else {
                    fill::text(&data).map_err(bad)?
                };
                Ok(json!({"text": text}))
            }
            "export" => {
                let a: Export = args(a)?;
                let r = ctx
                    .get(GENERATED, a.id)?
                    .filter(|r| !r.deleted)
                    .ok_or_else(|| bad("documentul nu mai există"))?;
                // The user confirmed replacing an existing file in the save dialog.
                let v = ctx.export_document(uuid_of(&r, "document")?, None, &a.dest, true)?;
                Ok(json!({"octeti": v.size}))
            }
            "delete_generated" => {
                let a: ById = args(a)?;
                let r = ctx
                    .get(GENERATED, a.id)?
                    .filter(|r| !r.deleted)
                    .ok_or_else(|| bad("documentul nu mai există"))?;
                ctx.delete_document(uuid_of(&r, "document")?)?;
                ctx.write(vec![Write::delete(GENERATED, a.id).expect(r.version)])?;
                Ok(json!({"deleted": a.id}))
            }
            // Forms (step 4.9).
            "forms" => forms::forms(ctx),
            "form_save" => forms::form_save(ctx, args(a)?),
            "form_delete" => forms::form_delete(ctx, args::<ById>(a)?.id),
            "answer_save" => forms::answer_save(ctx, args(a)?),
            "answers" => {
                let a: ById = args(a)?;
                let list = forms::answers(ctx, a.id)?;
                Ok(json!(
                    list.iter()
                        .map(|r| {
                            let mut v = Value::Object(r.fields.clone());
                            v["id"] = json!(r.id);
                            v
                        })
                        .collect::<Vec<_>>()
                ))
            }
            "answer_delete" => forms::answer_delete(ctx, args::<ById>(a)?.id),
            "export_answers" => {
                let a: ExportAnswers = args(a)?;
                let (bytes, n) = forms::export(ctx, a.formular, &a.format, a.stil.as_deref().unwrap_or("ro"))?;
                // The user confirmed replacing an existing file in the save dialog.
                ctx.export_bytes(&a.dest, &bytes, true)?;
                Ok(json!({"raspunsuri": n, "octeti": bytes.len()}))
            }
            other => Err(CoreError::invalid(
                "modulul Documente",
                format!("comandă necunoscută „{other}”"),
            )),
        }
    }
}

#[cfg(test)]
mod activity_models {
    /// The models the activity profiles recommend (kgb_core::activities, 7.4n) are built in here.
    #[test]
    fn every_recommended_model_is_built_in() {
        let keys: Vec<&str> = super::BUILT_IN.iter().map(|m| m.0).chain(super::BUILT_IN_PDF.iter().map(|m| m.0)).collect();
        for a in kgb_core::activities::ACTIVITIES {
            for m in a.models {
                assert!(keys.contains(m), "{}: modelul {m} nu e inclus", a.id);
            }
        }
    }
}
