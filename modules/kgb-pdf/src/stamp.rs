//! Stamps as in Cyber Office Studio (Etapa 7, step 7.4l-1b2; D-071: taken
//! from the owner's own app, `src/pdf/sign.ts` and `stampAnnot.ts`):
//!
//! - Ready stamps PLĂTIT, PRIMIT, APROBAT, RESPINS, COPIE, CONFIDENȚIAL (or a
//!   text of your own), with a line under them (the date, and on request the
//!   time and the name: „Ion Pop · 09.11.2026 14:30”, fixed when it is put).
//! - The look of COS: a rounded frame (2.5 pt, corners 6 pt), the label in
//!   bold, the line under it smaller; at least 110 × 50 pt; red, blue, green or
//!   black; opacity 20–100 %.
//! - „My stamps”: an image (the company's stamp photographed, its paper
//!   removed in the window, see `stampBg.ts`), with its width in millimetres.
//! - Each stamp is a real `/Stamp` annotation with its appearance (`/AP`), so
//!   any PDF program shows it and can move or delete it; on a rotated page the
//!   drawing turns with the page, so it stands upright on screen.
//! - The page's own content and text are not touched (checked after).

use lopdf::{Dictionary, Object, Stream, StringFormat};
use typst::foundations::{Dict, IntoValue};

use crate::ops::{self, load, save};
use crate::overlay::{self, clean, compile, image_kind, page_box, page_content, place};

pub const PRESETS: [&str; 6] = ["PLĂTIT", "PRIMIT", "APROBAT", "RESPINS", "COPIE", "CONFIDENȚIAL"];
pub const COLORS: [(&str, &str); 4] = [("#c62828", "roșu"), ("#1a237e", "albastru"), ("#2e7d32", "verde"), ("#000000", "negru")];

/// What stamp to put.
#[derive(Clone, Debug, Default)]
pub struct StampSpec {
    /// The label (a preset or a text of your own); for an image, its name.
    pub label: String,
    /// The line under the label (date, time, name), already written.
    pub sub: String,
    /// One of [`COLORS`].
    pub color: String,
    /// 0.2–1.
    pub opacity: f64,
    pub place: String,
    /// An image stamp (PNG/JPEG) instead of the text one.
    pub image: Option<Vec<u8>>,
    pub width_mm: f64,
    /// Who puts it (the annotation's author).
    pub author: String,
}

/// The standard name of a stamp, for programs that show an icon by name.
fn std_name(label: &str, image: bool) -> &'static str {
    if image {
        return "Draft";
    }
    match label {
        "APROBAT" | "PRIMIT" | "PLĂTIT" => "Approved",
        "RESPINS" => "NotApproved",
        "CONFIDENȚIAL" => "Confidential",
        _ => "Draft",
    }
}

/// `D:YYYYMMDDHHmmSSZ` now (UTC), for the annotation's date.
fn pdf_now() -> String {
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0);
    let (days, rem) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    // Civil date from days since 1970-01-01 (H. Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("D:{y:04}{m:02}{d:02}{:02}{:02}{:02}Z", rem / 3600, rem % 3600 / 60, rem % 60)
}

fn utf16(text: &str) -> Object {
    let mut b = vec![0xFE, 0xFF];
    for u in text.encode_utf16() {
        b.extend_from_slice(&u.to_be_bytes());
    }
    Object::String(b, StringFormat::Hexadecimal)
}

/// The stamp's drawing (one page, as big as the stamp), laid out by Typst.
fn appearance(s: &StampSpec) -> Result<Vec<u8>, String> {
    let mut inputs = Dict::new();
    inputs.insert("l".into(), s.label.clone().into_value());
    inputs.insert("s".into(), s.sub.clone().into_value());
    let mut src = String::from("#let i = sys.inputs\n#set page(width: auto, height: auto, margin: 0pt, fill: none)\n#set text(font: \"Libertinus Serif\")\n");
    if let Some(img) = &s.image {
        let kind = image_kind(img).ok_or("imaginea ștampilei trebuie să fie PNG sau JPEG")?;
        src.push_str(&format!("#image(\"/stampila.{kind}\", width: {:.1}mm)\n", s.width_mm));
        return compile(src, inputs, Some((&format!("/stampila.{kind}"), img)));
    }
    let alpha = ((1.0 - s.opacity) * 100.0).round();
    src.push_str(&format!("#let c = rgb(\"{}\").transparentize({alpha}%)\n", s.color));
    let label = "align(center, text(size: 20pt, weight: \"bold\", fill: c)[#i.at(\"l\")])";
    let body = if s.sub.is_empty() {
        label.to_string()
    } else {
        format!("stack(dir: ttb, spacing: 5pt, {label}, align(center, text(size: 10pt, fill: c)[#i.at(\"s\")]))")
    };
    src.push_str(&format!(
        "#context {{
  let body = {body}
  let m = measure(body)
  box(width: calc.max(110pt, m.width + 28pt), height: calc.max(50pt, m.height + 16pt), stroke: 2.5pt + c, radius: 6pt, align(center + horizon, body))
}}
"
    ));
    compile(src, inputs, None)
}

/// Puts the stamp on the chosen pages (1-based; all if empty), as `/Stamp`
/// annotations. Returns the new PDF.
pub fn add(src: &[u8], pages: &[u32], spec: &StampSpec) -> Result<Vec<u8>, String> {
    let mut s = spec.clone();
    s.label = clean(&s.label, "ștampila")?;
    s.sub = clean(&s.sub, "rândul de sub ștampilă")?;
    s.author = clean(&s.author, "numele")?;
    if s.image.is_none() && (s.label.is_empty() || s.label.chars().count() > 40) {
        return Err("textul ștampilei are 1–40 de caractere".into());
    }
    if !COLORS.iter().any(|(c, _)| *c == s.color) {
        return Err("culoarea ștampilei e roșu, albastru, verde sau negru".into());
    }
    if !(0.2..=1.0).contains(&s.opacity) {
        return Err("opacitatea e între 20% și 100%".into());
    }
    if let Some(img) = &s.image {
        if img.is_empty() || img.len() > overlay::MAX_IMAGE {
            return Err("imaginea ștampilei e goală sau mai mare de 5 MB".into());
        }
        if !(5.0..=200.0).contains(&s.width_mm) {
            return Err("lățimea ștampilei e între 5 și 200 mm".into());
        }
    }
    let (al, _, _) = place(&s.place)?;

    let mut doc = load(src)?;
    ops::flatten_inherited(&mut doc);
    let all = doc.get_pages();
    let total = all.len();
    let chosen: Vec<u32> = if pages.is_empty() { all.keys().copied().collect() } else { pages.to_vec() };
    if let Some(p) = chosen.iter().find(|p| !all.contains_key(p)) {
        return Err(format!("pagina {p} nu există (documentul are {total})"));
    }

    // The drawing, once, copied into the document.
    let ap_bytes = appearance(&s)?;
    let mut ap = load(&ap_bytes)?;
    ops::flatten_inherited(&mut ap);
    ap.renumber_objects_with(doc.max_id + 1);
    let ap_page = *ap.get_pages().values().next().ok_or("ștampila nu a ieșit cum trebuia")?;
    let content = page_content(&ap, ap_page)?;
    let ap_box = page_box(&ap, ap_page)?;
    let (aw, ah) = (ap_box.w, ap_box.h);
    let res = ap.get_dictionary(ap_page).ok().and_then(|d| d.get(b"Resources").ok().cloned()).unwrap_or(Object::Dictionary(Dictionary::new()));
    for (id, obj) in std::mem::take(&mut ap.objects) {
        let is_tree = obj.as_dict().ok().and_then(|d| d.get(b"Type").ok()).and_then(|t| t.as_name().ok()).is_some_and(|n| n == b"Catalog" || n == b"Pages" || n == b"Page");
        if !is_tree {
            doc.objects.insert(id, obj);
        }
    }
    doc.max_id = doc.max_id.max(ap.max_id);
    // The drawing's resources: a reference stays one (never an object that only holds a reference).
    let res_obj = match res {
        Object::Reference(r) => Object::Reference(r),
        other => Object::Reference(doc.add_object(other)),
    };

    let when = pdf_now();
    let contents = [s.label.as_str(), s.sub.as_str()].into_iter().filter(|x| !x.is_empty()).collect::<Vec<_>>().join(" ");
    for (k, p) in chosen.iter().enumerate() {
        let page_id = all[p];
        let pb = page_box(&doc, page_id)?;
        let (vw, vh) = pb.shown();
        // Where the stamp stands on the page as shown (origin bottom-left).
        let m = 36.0;
        let sx = if al.contains("left") { m } else if al.contains("right") { vw - m - aw } else { (vw - aw) / 2.0 };
        let sy = if al.starts_with("top") { vh - m - 14.0 - ah } else if al.starts_with("bottom") { m + 14.0 } else { (vh - ah) / 2.0 };
        let mx = pb.matrix();
        let to_page = |x: f64, y: f64| (mx[0] * x + mx[2] * y + mx[4], mx[1] * x + mx[3] * y + mx[5]);
        let corners = [to_page(sx, sy), to_page(sx + aw, sy), to_page(sx, sy + ah), to_page(sx + aw, sy + ah)];
        let (x0, x1) = corners.iter().fold((f64::MAX, f64::MIN), |(a, b), c| (a.min(c.0), b.max(c.0)));
        let (y0, y1) = corners.iter().fold((f64::MAX, f64::MIN), |(a, b), c| (a.min(c.1), b.max(c.1)));

        let mut form = Dictionary::new();
        form.set("Type", "XObject");
        form.set("Subtype", "Form");
        form.set("BBox", vec![0.into(), 0.into(), Object::Real(aw as f32), Object::Real(ah as f32)]);
        // Only the turn of the page: the program fits the turned drawing into /Rect.
        form.set("Matrix", [mx[0], mx[1], mx[2], mx[3], 0.0, 0.0].iter().map(|x| Object::Real(*x as f32)).collect::<Vec<_>>());
        form.set("Resources", res_obj.clone());
        let mut stream = Stream::new(form, content.clone());
        let _ = stream.compress();
        let form_id = doc.add_object(stream);

        let mut annot = Dictionary::new();
        annot.set("Type", "Annot");
        annot.set("Subtype", "Stamp");
        annot.set("Rect", vec![Object::Real(x0 as f32), Object::Real(y0 as f32), Object::Real(x1 as f32), Object::Real(y1 as f32)]);
        annot.set("F", 4);
        annot.set("P", page_id);
        annot.set("M", Object::String(when.clone().into_bytes(), StringFormat::Literal));
        annot.set("NM", Object::String(format!("kgb-stamp-{}-{k}", when.trim_start_matches("D:")).into_bytes(), StringFormat::Literal));
        annot.set("Name", std_name(&s.label, s.image.is_some()));
        annot.set("IT", if s.image.is_some() { "StampImage" } else { "Stamp" });
        annot.set("Subj", utf16("Ștampilă"));
        if !s.author.is_empty() {
            annot.set("T", utf16(&s.author));
        }
        if !contents.is_empty() {
            annot.set("Contents", utf16(&contents));
        }
        let mut apd = Dictionary::new();
        apd.set("N", form_id);
        annot.set("AP", apd);
        let annot_id = doc.add_object(annot);

        let page = doc.get_dictionary(page_id).map_err(|e| e.to_string())?.clone();
        let mut annots = match page.get(b"Annots") {
            Ok(Object::Array(a)) => a.clone(),
            Ok(Object::Reference(r)) => doc.get_object(*r).ok().and_then(|o| o.as_array().ok().cloned()).unwrap_or_default(),
            _ => Vec::new(),
        };
        annots.push(Object::Reference(annot_id));
        doc.get_object_mut(page_id).and_then(Object::as_dict_mut).map_err(|e| e.to_string())?.set("Annots", annots);
    }
    doc.prune_objects();
    save(&mut doc)
}

/// The `/Stamp` annotations on page `n` (their /Contents, for the checks).
pub fn stamps_on(pdf: &[u8], n: u32) -> Vec<String> {
    let Ok(doc) = load(pdf) else { return Vec::new() };
    let Some(id) = doc.get_pages().get(&n).copied() else { return Vec::new() };
    let Ok(d) = doc.get_dictionary(id) else { return Vec::new() };
    let arr = match d.get(b"Annots") {
        Ok(Object::Array(a)) => a.clone(),
        Ok(Object::Reference(r)) => doc.get_object(*r).ok().and_then(|o| o.as_array().ok().cloned()).unwrap_or_default(),
        _ => Vec::new(),
    };
    arr.iter()
        .filter_map(|o| o.as_reference().ok())
        .filter_map(|r| doc.get_dictionary(r).ok())
        .filter(|a| a.get(b"Subtype").ok().and_then(|t| t.as_name().ok()) == Some(b"Stamp".as_slice()))
        .map(|a| match a.get(b"Contents") {
            Ok(Object::String(b, _)) if b.starts_with(&[0xFE, 0xFF]) => String::from_utf16_lossy(&b[2..].chunks(2).map(|c| u16::from_be_bytes([c[0], *c.get(1).unwrap_or(&0)])).collect::<Vec<_>>()),
            Ok(Object::String(b, _)) => String::from_utf8_lossy(b).into_owned(),
            _ => String::new(),
        })
        .collect()
}

/// A PNG's size (width, height), for the library's aspect ratio.
pub fn png_size(b: &[u8]) -> Option<(u32, u32)> {
    if image_kind(b) != Some("png") || b.len() < 24 {
        return None;
    }
    Some((u32::from_be_bytes([b[16], b[17], b[18], b[19]]), u32::from_be_bytes([b[20], b[21], b[22], b[23]])))
}
