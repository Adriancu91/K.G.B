// Original: src/pdf/compress.ts din Cyber Office Studio, aplicația proprietarului (D-071, D-072), fără schimbări de logică.
// @ts-nocheck — K.G.B. verifică tablourile mai strict (noUncheckedIndexedAccess) decât proiectul de origine; testat în tests/.
// Comprimare (Top 10 PDF, „Comprimă pentru portal”): pozele din PDF (scanări, fotografii, capturi PNG) se micșorează și se
// salvează din nou ca JPEG mai mic; textul și desenele rămân neatinse, deci textul se poate căuta în continuare.
import { decodePDFRawStream, PDFArray, PDFDict, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import { open } from './edit';

export interface Level {
  label: string;
  /** Latura cea mai lungă a unei poze, în pixeli (o pagină A4 la 150 dpi are ~1750). */
  maxPx: number;
  quality: number;
}

export const LEVELS: Level[] = [
  { label: 'Ușoară (calitate foarte bună)', maxPx: 2500, quality: 0.85 },
  { label: 'Medie (bună pentru e-mail)', maxPx: 1750, quality: 0.72 },
  { label: 'Puternică (cel mai mic fișier)', maxPx: 1150, quality: 0.55 },
];

const N = (s: string) => PDFName.of(s);

function isJpeg(filter: unknown): boolean {
  if (filter === N('DCTDecode')) return true;
  return filter instanceof PDFArray && filter.size() === 1 && filter.get(0) === N('DCTDecode');
}

function isFlate(filter: unknown): boolean {
  if (filter === N('FlateDecode')) return true;
  return filter instanceof PDFArray && filter.size() === 1 && filter.get(0) === N('FlateDecode');
}

/** Câte culori are o poză necomprimată: 1 (gri) sau 3 (RGB); 0 pentru ce nu știm citi (CMYK, palete…). */
function colorCount(d: PDFDict): number {
  const cs = d.lookup(N('ColorSpace'));
  if (cs === N('DeviceRGB')) return 3;
  if (cs === N('DeviceGray')) return 1;
  if (cs instanceof PDFArray && cs.lookup(0) === N('ICCBased')) {
    const n = (cs.lookup(1) as PDFRawStream | undefined)?.dict?.lookup(N('N'));
    if (n instanceof PDFNumber && (n.asNumber() === 1 || n.asNumber() === 3)) return n.asNumber();
  }
  return 0;
}

/** Desface filtrele PNG de pe fiecare rând (predictorii 10–15 din PDF). */
export function unpredictPng(data: Uint8Array, w: number, h: number, bpp: number): Uint8Array | null {
  const row = w * bpp;
  if (data.length < (row + 1) * h) return null;
  const out = new Uint8Array(row * h);
  for (let y = 0; y < h; y++) {
    const t = data[y * (row + 1)], src = y * (row + 1) + 1, o = y * row;
    for (let x = 0; x < row; x++) {
      const raw = data[src + x];
      const a = x >= bpp ? out[o + x - bpp] : 0;
      const b = y ? out[o - row + x] : 0;
      const c = x >= bpp && y ? out[o - row + x - bpp] : 0;
      let v: number;
      if (t === 0) v = raw;
      else if (t === 1) v = raw + a;
      else if (t === 2) v = raw + b;
      else if (t === 3) v = raw + ((a + b) >> 1);
      else if (t === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else return null;
      out[o + x] = v & 255;
    }
  }
  return out;
}

/** Pixelii unei poze Flate (PNG) cu 8 biți pe culoare, ca imagine pentru pânză; `null` dacă nu o putem citi. */
async function flateImage(obj: PDFRawStream): Promise<ImageData | null> {
  const d = obj.dict;
  const w = (d.lookup(N('Width')) as PDFNumber | undefined)?.asNumber() ?? 0;
  const h = (d.lookup(N('Height')) as PDFNumber | undefined)?.asNumber() ?? 0;
  const bpc = (d.lookup(N('BitsPerComponent')) as PDFNumber | undefined)?.asNumber() ?? 0;
  const n = colorCount(d);
  // Doar pozele mari merită (pictogramele mici rămân cum sunt); 8 biți, fără „Decode” (culori inversate).
  if (!n || bpc !== 8 || w * h < 250000 || d.get(N('Decode'))) return null;
  const parms = d.lookup(N('DecodeParms'));
  const pred = parms instanceof PDFDict ? ((parms.lookup(N('Predictor')) as PDFNumber | undefined)?.asNumber() ?? 1) : 1;
  if (pred !== 1 && pred < 10) return null;
  let raw: Uint8Array;
  try {
    // Decomprimarea din browser e rapidă; dacă nu merge, folosim pe cea din pdf-lib.
    raw = new Uint8Array(await new Response(new Blob([obj.contents as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  } catch {
    try { raw = decodePDFRawStream(obj).decode(); } catch { return null; }
  }
  const px = pred >= 10 ? unpredictPng(raw, w, h, n) : raw;
  if (!px || px.length < w * h * n) return null;
  const img = new ImageData(w, h);
  for (let i = 0, j = 0; i < w * h; i++, j += n) {
    img.data[i * 4] = px[j];
    img.data[i * 4 + 1] = px[j + (n === 3 ? 1 : 0)];
    img.data[i * 4 + 2] = px[j + (n === 3 ? 2 : 0)];
    img.data[i * 4 + 3] = 255;
  }
  return img;
}

/** Comprimă pozele (JPEG și PNG); întoarce noul PDF și câte poze s-au micșorat. */
export async function compressPdf(bytes: Uint8Array, level: Level): Promise<{ data: Uint8Array; images: number }> {
  const doc = await open(bytes);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  let images = 0;
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const d = obj.dict;
    if (d.get(N('Subtype')) !== N('Image') || d.get(N('ImageMask'))) continue;
    let bmp: ImageBitmap;
    if (isJpeg(d.get(N('Filter')))) {
      try {
        bmp = await createImageBitmap(new Blob([obj.contents as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }));
      } catch {
        continue; // un JPEG pe care browserul nu-l înțelege rămâne cum e
      }
    } else if (isFlate(d.get(N('Filter')))) {
      const img = await flateImage(obj);
      if (!img) continue;
      bmp = await createImageBitmap(img);
    } else continue;
    const s = Math.min(1, level.maxPx / Math.max(bmp.width, bmp.height));
    canvas.width = Math.max(1, Math.round(bmp.width * s));
    canvas.height = Math.max(1, Math.round(bmp.height * s));
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', level.quality));
    if (!blob) continue;
    const out = new Uint8Array(await blob.arrayBuffer());
    // Păstrăm poza nouă doar dacă e clar mai mică.
    if (out.length > obj.contents.length * 0.9) continue;
    const nd = d.clone(doc.context);
    nd.set(N('Width'), PDFNumber.of(canvas.width));
    nd.set(N('Height'), PDFNumber.of(canvas.height));
    // Browserul dă înapoi culori RGB (și pentru scanările CMYK sau gri), deci așa o și descriem.
    nd.set(N('ColorSpace'), N('DeviceRGB'));
    nd.set(N('BitsPerComponent'), PDFNumber.of(8));
    nd.set(N('Filter'), N('DCTDecode'));
    nd.delete(N('Decode'));
    nd.delete(N('DecodeParms'));
    doc.context.assign(ref, PDFRawStream.of(nd, out));
    images++;
  }
  canvas.width = 0;
  return { data: await doc.save({ useObjectStreams: true }), images };
}

/** 1536000 → „1,5 MB”. */
export function sizeText(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toLocaleString('ro-RO', { maximumFractionDigits: 1 })} MB`;
}
