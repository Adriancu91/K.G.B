// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Toate imaginile dintr-un PDF (ca Acrobat → Export → Imagini): pozele puse în pagini, fiecare o singură dată, la mărimea
// lor reală (nu cât se văd pe pagină). Le citește pdf.js; se salvează ca PNG (cu transparență) sau JPG (pozele mari, fără transparență).
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export interface PdfImage {
  page: number;
  width: number;
  height: number;
  /** Poza ca pânză, gata de salvat sau de arătat. */
  canvas: HTMLCanvasElement;
  alpha: boolean;
}

interface ImgObj { width: number; height: number; kind?: number; data?: Uint8ClampedArray | Uint8Array; bitmap?: ImageBitmap }

export const getObj = (pg: PDFPageProxy, id: string): Promise<ImgObj | null> => new Promise((ok) => {
  const store = id.startsWith('g_') ? pg.commonObjs : pg.objs;
  const timer = setTimeout(() => ok(null), 5000);
  try { store.get(id, (o: ImgObj) => { clearTimeout(timer); ok(o ?? null); }); } catch { clearTimeout(timer); ok(null); }
});

/** Pixelii unei imagini pdf.js (RGBA, RGB sau alb-negru pe 1 bit) pe o pânză. */
export function toCanvas(o: ImgObj): { canvas: HTMLCanvasElement; alpha: boolean } | null {
  const c = document.createElement('canvas');
  c.width = o.width;
  c.height = o.height;
  const ctx = c.getContext('2d');
  if (!ctx || !o.width || !o.height) return null;
  if (o.bitmap) {
    ctx.drawImage(o.bitmap, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let alpha = false;
    for (let i = 3; i < d.length; i += 4 * 97) if (d[i] < 255) { alpha = true; break; }
    return { canvas: c, alpha };
  }
  if (!o.data) return null;
  const img = ctx.createImageData(o.width, o.height);
  const out = img.data, src = o.data, n = o.width * o.height;
  let alpha = false;
  if (o.kind === 3) { // RGBA_32BPP
    out.set(src.subarray(0, n * 4));
    for (let i = 3; i < out.length; i += 4) if (out[i] < 255) { alpha = true; break; }
  } else if (o.kind === 2) { // RGB_24BPP
    for (let i = 0, j = 0; i < n; i++, j += 3) { out[i * 4] = src[j]; out[i * 4 + 1] = src[j + 1]; out[i * 4 + 2] = src[j + 2]; out[i * 4 + 3] = 255; }
  } else if (o.kind === 1) { // GRAYSCALE_1BPP: rânduri de biți, 1 = alb
    const row = (o.width + 7) >> 3;
    for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) {
      const v = (src[y * row + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0;
      const k = (y * o.width + x) * 4;
      out[k] = out[k + 1] = out[k + 2] = v; out[k + 3] = 255;
    }
  } else return null;
  ctx.putImageData(img, 0, 0);
  return { canvas: c, alpha };
}

/** Amprenta unei poze: 256 de pixeli luați pe o grilă 16 × 16. */
function sample(c: HTMLCanvasElement): string {
  const ctx = c.getContext('2d')!;
  const parts: number[] = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = ctx.getImageData(Math.floor(((x + 0.5) * c.width) / 16), Math.floor(((y + 0.5) * c.height) / 16), 1, 1).data;
    parts.push((d[0] << 24) ^ (d[1] << 16) ^ (d[2] << 8) ^ d[3]);
  }
  return parts.join(',');
}

/**
 * Caută imaginile pe toate paginile. Aceeași poză folosită pe mai multe pagini (sigla din antet) apare o singură dată;
 * imaginile foarte mici (sub `min` pixeli pe latură: linii, puncte, fundaluri de 1 pixel) se sar.
 */
export async function findImages(doc: PDFDocumentProxy, progress?: (n: number) => void, min = 16, limit = 500): Promise<PdfImage[]> {
  const out: PdfImage[] = [];
  const seen = new Set<string>();
  const paint = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintImageXObjectRepeat]);
  for (let n = 1; n <= doc.numPages && out.length < limit; n++) {
    progress?.(n);
    const pg = await doc.getPage(n);
    const ops = await pg.getOperatorList();
    for (let i = 0; i < ops.fnArray.length && out.length < limit; i++) {
      if (!paint.has(ops.fnArray[i])) continue;
      const id = ops.argsArray[i]?.[0];
      if (typeof id !== 'string') continue;
      const o = await getObj(pg, id);
      if (!o || o.width < min || o.height < min) continue;
      if (seen.has(id)) continue;
      const c = toCanvas(o);
      if (!c) continue;
      // Aceeași poză pusă din nou pe altă pagină (sigla din antet) are alt id: o recunoaștem după mărime și 256 de pixeli.
      const key = `${o.width}x${o.height}:${sample(c.canvas)}`;
      seen.add(id);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ page: n, width: o.width, height: o.height, ...c });
    }
    pg.cleanup();
  }
  return out;
}

/** Octeții unei imagini de salvat: PNG dacă are transparență sau e mică / grafică, altfel JPG de calitate mare. */
export async function encodeImage(img: PdfImage): Promise<{ ext: 'png' | 'jpg'; data: Uint8Array }> {
  const ext = img.alpha || img.width * img.height < 250_000 ? 'png' : 'jpg';
  const blob = await new Promise<Blob | null>((ok) => img.canvas.toBlob(ok, ext === 'png' ? 'image/png' : 'image/jpeg', 0.92));
  if (!blob) throw new Error('Imaginea nu a putut fi salvată.');
  return { ext, data: new Uint8Array(await blob.arrayBuffer()) };
}
