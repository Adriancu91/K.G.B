//! Hiding data for good (Etapa 7, step 7.4l-1c; the safe path of Cyber
//! Office Studio's `redact.ts`, D-071): a page with zones to hide is drawn
//! as an image (200 DPI), black is painted over the zones, and the image
//! replaces the page. The page's text, pictures and drawings leave the file
//! entirely, so nothing under a zone can be read, copied or recovered; the
//! other pages stay as they were. Comments and form fields that touch a zone
//! are removed with their values.
//!
//! COS also has a finer path that keeps the rest of the page as text; it
//! needs pdf-lib (not in K.G.B.), so it is not taken here.

use std::collections::BTreeMap;

use lopdf::{Dictionary, Object, ObjectId, Stream};

use crate::ops::{self, load, save};

/// Pixels per point at 200 DPI.
const SCALE: f32 = 200.0 / 72.0;

/// A zone on a page as shown (points, origin top-left): x, y, w, h.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Zone {
    pub page: u32,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

fn render(pdf: &[u8], page: u32) -> Result<(u32, u32, Vec<u8>, f64, f64), String> {
    let doc = hayro::hayro_syntax::Pdf::new(pdf.to_vec()).map_err(|_| "PDF-ul nu se poate desena".to_string())?;
    let pages = doc.pages();
    let p = pages.get(page as usize - 1).ok_or_else(|| format!("pagina {page} nu există"))?;
    let (vw, vh) = p.render_dimensions();
    let cache = hayro::RenderCache::new();
    let px = hayro::render(
        p,
        &cache,
        &hayro::hayro_interpret::InterpreterSettings::default(),
        &hayro::RenderSettings::default(),
        &hayro::PixmapSettings { x_scale: SCALE, y_scale: SCALE, bg_color: hayro::vello_cpu::color::palette::css::WHITE },
    );
    let (w, h) = (u32::from(px.width()), u32::from(px.height()));
    // Opaque (white background): the premultiplied colours are the colours.
    let rgba = px.data_as_u8_slice();
    let mut rgb = Vec::with_capacity((w * h * 3) as usize);
    for c in rgba.as_chunks::<4>().0 {
        rgb.extend_from_slice(&c[..3]);
    }
    Ok((w, h, rgb, f64::from(vw), f64::from(vh)))
}

fn overlaps(a: [f64; 4], b: [f64; 4]) -> bool {
    a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
}

fn num(o: &Object) -> Option<f64> {
    match o {
        Object::Integer(i) => Some(*i as f64),
        Object::Real(r) => Some(f64::from(*r)),
        _ => None,
    }
}

/// Hides the zones. Returns the new PDF and the pages turned into images.
pub fn redact(src: &[u8], zones: &[Zone]) -> Result<(Vec<u8>, Vec<u32>), String> {
    if zones.is_empty() {
        return Err("trage cel puțin o zonă de ascuns".into());
    }
    let mut doc = load(src)?;
    ops::flatten_inherited(&mut doc);
    let all = doc.get_pages();
    let mut by_page: BTreeMap<u32, Vec<Zone>> = BTreeMap::new();
    for z in zones {
        if !all.contains_key(&z.page) {
            return Err(format!("pagina {} nu există (documentul are {})", z.page, all.len()));
        }
        if z.w < 2.0 || z.h < 2.0 || ![z.x, z.y, z.w, z.h].iter().all(|v| v.is_finite()) {
            return Err("o zonă e prea mică".into());
        }
        by_page.entry(z.page).or_default().push(*z);
    }
    let mut gone_fields: Vec<ObjectId> = Vec::new();
    for (page, zs) in &by_page {
        let page_id = all[page];
        let (iw, ih, rgb, vw, vh) = render(src, *page)?;
        let mut rgb = rgb;
        // Black over every zone (with a pixel of margin).
        for z in zs {
            let x0 = ((z.x * f64::from(SCALE)).floor() as i64 - 1).clamp(0, i64::from(iw)) as u32;
            let y0 = ((z.y * f64::from(SCALE)).floor() as i64 - 1).clamp(0, i64::from(ih)) as u32;
            let x1 = (((z.x + z.w) * f64::from(SCALE)).ceil() as i64 + 1).clamp(0, i64::from(iw)) as u32;
            let y1 = (((z.y + z.h) * f64::from(SCALE)).ceil() as i64 + 1).clamp(0, i64::from(ih)) as u32;
            for y in y0..y1 {
                let row = (y * iw * 3) as usize;
                rgb[row + (x0 * 3) as usize..row + (x1 * 3) as usize].fill(0);
            }
        }
        let mut img = Dictionary::new();
        img.set("Type", "XObject");
        img.set("Subtype", "Image");
        img.set("Width", i64::from(iw));
        img.set("Height", i64::from(ih));
        img.set("ColorSpace", "DeviceRGB");
        img.set("BitsPerComponent", 8);
        let mut stream = Stream::new(img, rgb);
        stream.compress().map_err(|e| format!("imaginea paginii nu s-a putut comprima: {e}"))?;
        let img_id = doc.add_object(stream);
        let content = doc.add_object(Stream::new(Dictionary::new(), format!("q {vw:.3} 0 0 {vh:.3} 0 0 cm /KGBred Do Q\n").into_bytes()));

        // Comments and fields touching a zone go too (shown coordinates → page space).
        let page_dict = doc.get_dictionary(page_id).map_err(|e| e.to_string())?.clone();
        let mb: Vec<f64> = page_dict.get(b"MediaBox").ok().and_then(|o| o.as_array().ok()).map(|a| a.iter().filter_map(num).collect()).unwrap_or_default();
        let (px0, py0, pw, ph) = if mb.len() == 4 { (mb[0].min(mb[2]), mb[1].min(mb[3]), (mb[2] - mb[0]).abs(), (mb[3] - mb[1]).abs()) } else { (0.0, 0.0, vw, vh) };
        let rot = page_dict.get(b"Rotate").ok().and_then(|o| o.as_i64().ok()).unwrap_or(0).rem_euclid(360);
        // A point of the shown page (origin top-left) in the page's own space.
        let to_page = |x: f64, y: f64| -> (f64, f64) {
            let (sx, sy) = (x, vh - y); // shown, origin bottom-left
            match rot {
                90 => (px0 + pw - sy, py0 + sx),
                180 => (px0 + pw - sx, py0 + ph - sy),
                270 => (px0 + sy, py0 + ph - sx),
                _ => (px0 + sx, py0 + sy),
            }
        };
        let page_zones: Vec<[f64; 4]> = zs
            .iter()
            .map(|z| {
                let (a, b) = (to_page(z.x, z.y), to_page(z.x + z.w, z.y + z.h));
                [a.0.min(b.0), a.1.min(b.1), a.0.max(b.0), a.1.max(b.1)]
            })
            .collect();
        let annots: Vec<Object> = match page_dict.get(b"Annots") {
            Ok(Object::Array(a)) => a.clone(),
            Ok(Object::Reference(r)) => doc.get_object(*r).ok().and_then(|o| o.as_array().ok().cloned()).unwrap_or_default(),
            _ => Vec::new(),
        };
        let mut keep = Vec::new();
        for a in annots {
            let Ok(r) = a.as_reference() else { continue };
            let rect: Vec<f64> = doc.get_dictionary(r).ok().and_then(|d| d.get(b"Rect").ok()).and_then(|o| o.as_array().ok()).map(|v| v.iter().filter_map(num).collect()).unwrap_or_default();
            let touches = rect.len() == 4 && page_zones.iter().any(|z| overlaps([rect[0].min(rect[2]), rect[1].min(rect[3]), rect[0].max(rect[2]), rect[1].max(rect[3])], *z));
            if touches {
                gone_fields.push(r);
            } else {
                keep.push(Object::Reference(r));
            }
        }

        let mut xo = Dictionary::new();
        xo.set("KGBred", img_id);
        let mut res = Dictionary::new();
        res.set("XObject", xo);
        let pd = doc.get_object_mut(page_id).and_then(Object::as_dict_mut).map_err(|e| e.to_string())?;
        pd.set("MediaBox", vec![0.into(), 0.into(), Object::Real(vw as f32), Object::Real(vh as f32)]);
        pd.remove(b"CropBox");
        pd.remove(b"Rotate");
        pd.set("Resources", res);
        pd.set("Contents", content);
        if keep.is_empty() {
            pd.remove(b"Annots");
        } else {
            pd.set("Annots", keep);
        }
        // Kept annotations keep their place only on an unturned page.
        if rot != 0 || px0 != 0.0 || py0 != 0.0 {
            pd.remove(b"Annots");
        }
    }
    // Form fields whose boxes went: out of the form too (their values would stay in the file).
    if !gone_fields.is_empty()
        && let Ok(cat) = doc.catalog()
        && let Ok(acro) = cat.get(b"AcroForm").and_then(Object::as_reference)
        && let Ok(form) = doc.get_object_mut(acro).and_then(Object::as_dict_mut)
        && let Ok(Object::Array(fields)) = form.get_mut(b"Fields")
    {
        fields.retain(|f| f.as_reference().map_or(true, |r| !gone_fields.contains(&r)));
    }
    doc.prune_objects();
    let out = save(&mut doc)?;
    Ok((out, by_page.keys().copied().collect()))
}
