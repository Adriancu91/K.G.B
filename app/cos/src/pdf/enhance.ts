// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Curăță scanarea”: paginile scanate sau fotografiate cu telefonul devin ca o fotocopie bună: îndreptate (dacă sunt
// puțin strâmbe), fundal alb (fără umbre și fără hârtia gri-gălbuie), text negru și clar. Pagina se desenează din nou ca imagine gri.
import * as pdfjs from 'pdfjs-dist';
import { open } from './edit';
import { dropUnreachable, replacePage } from './redact';
import { defuse } from './guard';

const DPI = 200;

/** Fundalul (lumina hârtiei) în jurul fiecărui punct: media pe pătrate mari, netezită, din imaginea gri. */
function background(gray: Uint8ClampedArray, w: number, h: number, pad: Uint8Array): Float32Array {
  const cell = 32, cw = Math.ceil(w / cell), ch = Math.ceil(h / cell);
  // În fiecare pătrat luăm un procent mare (nu media), ca textul negru să nu întunece fundalul.
  // Albul de umplutură (colțurile rămase după îndreptare) nu se numără; pătratele aproape numai umplutură primesc
  // valoarea vecinilor, altfel la marginea pozei ar ieși o dâră gri.
  const cells = new Float32Array(cw * ch).fill(-1);
  const hist = new Uint32Array(256);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      hist.fill(0);
      let n = 0, all = 0;
      for (let y = cy * cell; y < Math.min(h, (cy + 1) * cell); y += 2) {
        for (let x = cx * cell; x < Math.min(w, (cx + 1) * cell); x += 2) {
          all++;
          if (pad[y * w + x]) continue;
          hist[gray[y * w + x]]++;
          n++;
        }
      }
      if (n < all * 0.25) continue;
      let k = 0, acc = 0;
      for (k = 255; k > 0; k--) { acc += hist[k]; if (acc >= n * 0.1) break; }
      cells[cy * cw + cx] = Math.max(k, 40);
    }
  }
  // Pătratele necunoscute iau media vecinilor cunoscuți, în valuri; dacă nu e niciunul, fundalul e alb.
  for (let changed = true; changed;) {
    changed = false;
    const prev = cells.slice();
    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        if (prev[cy * cw + cx] >= 0) continue;
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && y >= 0 && x < cw && y < ch && prev[y * cw + x] >= 0) { s += prev[y * cw + x]; n++; }
        }
        if (n) { cells[cy * cw + cx] = s / n; changed = true; }
      }
    }
  }
  for (let i = 0; i < cells.length; i++) if (cells[i] < 0) cells[i] = 255;
  // Netezire: media cu vecinii (3×3), apoi interpolare la fiecare pixel.
  const smooth = new Float32Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && y >= 0 && x < cw && y < ch) { s += cells[y * cw + x]; n++; }
      }
      smooth[cy * cw + cx] = s / n;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(ch - 1, Math.max(0, y / cell - 0.5)), y0 = Math.floor(fy), y1 = Math.min(ch - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(cw - 1, Math.max(0, x / cell - 0.5)), x0 = Math.floor(fx), x1 = Math.min(cw - 1, x0 + 1), tx = fx - x0;
      const top = smooth[y0 * cw + x0] * (1 - tx) + smooth[y0 * cw + x1] * tx;
      const bot = smooth[y1 * cw + x0] * (1 - tx) + smooth[y1 * cw + x1] * tx;
      out[y * w + x] = top * (1 - ty) + bot * ty;
    }
  }
  return out;
}

/**
 * Cât de strâmbe sunt rândurile de text (grade, între -6 și 6): unghiul la care punctele închise se adună pe cele mai
 * puține rânduri, deci „profilul” orizontal e cel mai ascuțit. Se lucrează pe o copie micșorată, ca să fie rapid.
 */
export function detectSkew(src: HTMLCanvasElement): number {
  const k = Math.min(1, 900 / src.width);
  const w = Math.max(1, Math.round(src.width * k)), h = Math.max(1, Math.round(src.height * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  let sum = 0;
  for (let i = 0; i < w * h; i++) sum += d[i * 4 + 1];
  const limit = (sum / (w * h)) * 0.6;
  const xs: number[] = [], ys: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 1] < limit) { xs.push(x); ys.push(y); }
  c.width = 0;
  if (xs.length < 200) return 0;
  const score = (deg: number) => {
    const a = (deg * Math.PI) / 180, sin = Math.sin(a), cos = Math.cos(a);
    const rows = new Float64Array(h * 2 + w);
    for (let i = 0; i < xs.length; i++) rows[Math.round(ys[i] * cos - xs[i] * sin + w)]++;
    let s = 0;
    for (const r of rows) s += r * r;
    return s;
  };
  let best = 0, bestScore = score(0);
  for (let deg = -6; deg <= 6.001; deg += 0.25) { const v = score(deg); if (v > bestScore) { bestScore = v; best = deg; } }
  // A doua trecere, mai fină, în jurul celui mai bun unghi.
  for (let deg = best - 0.25; deg <= best + 0.25; deg += 0.05) { const v = score(deg); if (v > bestScore) { bestScore = v; best = deg; } }
  return Math.round(best * 100) / 100;
}

/** Umplutura albă: punctele aproape albe legate de marginea pozei (colțurile goale după rotire, marginile A4). */
function padding(gray: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const pad = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let top = 0;
  const push = (i: number) => { if (!pad[i] && gray[i] >= 250) { pad[i] = 1; stack[top++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (top) {
    const i = stack[--top], x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  return pad;
}

/** Aplică „curățarea” pe pânza dată (pe loc). */
export function cleanScan(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
  // Zona pozei: marginile albe pure din jur (de la încadrarea pe A4) nu intră la calculul fundalului,
  // altfel lângă ele ar rămâne o dungă gri.
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (gray[y * w + x] < 250) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  const out = new Uint8ClampedArray(w * h).fill(255);
  if (x1 >= 0) {
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const crop = new Uint8ClampedArray(cw * ch);
    for (let y = 0; y < ch; y++) crop.set(gray.subarray((y0 + y) * w + x0, (y0 + y) * w + x1 + 1), y * cw);
    const pad = padding(crop, cw, ch);
    const bg = background(crop, cw, ch, pad);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (pad[y * cw + x]) continue;
        // Împărțirea la fundal scoate umbrele; apoi întindem contrastul: ce e aproape de hârtie devine alb, textul mai negru.
        const v = (crop[y * cw + x] / bg[y * cw + x]) * 255;
        out[(y0 + y) * w + x0 + x] = ((v - 110) / (235 - 110)) * 255;
      }
    }
  }
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = out[i];
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Curăță paginile date (de la 1); cele cu text adevărat (nu scanări) se sar. */
export async function enhancePages(bytes: Uint8Array, pages: number[]): Promise<{ data: Uint8Array; done: number; skipped: number; straightened: number }> {
  const doc = await open(bytes);
  const view = await pdfjs.getDocument({ data: defuse(bytes.slice()).data, isEvalSupported: false }).promise;
  const canvas = document.createElement('canvas');
  let done = 0, skipped = 0, straightened = 0;
  try {
    for (const n of pages) {
      if (n < 1 || n > doc.getPageCount()) continue;
      const pg = await view.getPage(n);
      const tc = await pg.getTextContent();
      if (tc.items.map((it) => ('str' in it ? it.str : '')).join('').replace(/\s/g, '').length > 20) { skipped++; continue; }
      const base = pg.getViewport({ scale: 1 });
      const scale = Math.min(DPI / 72, 3400 / Math.max(base.width, base.height));
      const vp = pg.getViewport({ scale });
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pg.render({ canvasContext: ctx, viewport: vp, intent: 'print', annotationMode: pdfjs.AnnotationMode.ENABLE_STORAGE }).promise;
      // Îndreptare: rândurile înclinate cu cel puțin 0,3° se rotesc înapoi (marginile goale rămase devin albe).
      const skew = detectSkew(canvas);
      if (Math.abs(skew) >= 0.3) {
        const copy = document.createElement('canvas');
        copy.width = canvas.width;
        copy.height = canvas.height;
        copy.getContext('2d')!.drawImage(canvas, 0, 0);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((-skew * Math.PI) / 180);
        ctx.drawImage(copy, -canvas.width / 2, -canvas.height / 2);
        ctx.restore();
        copy.width = 0;
        straightened++;
      }
      cleanScan(ctx, canvas.width, canvas.height);
      const jpg = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
      if (!jpg) continue;
      replacePage(doc, n - 1, await doc.embedJpg(new Uint8Array(await jpg.arrayBuffer())), vp.width / scale, vp.height / scale);
      done++;
    }
  } finally {
    canvas.width = 0;
    await view.loadingTask.destroy();
  }
  if (!done) return { data: bytes, done, skipped, straightened };
  dropUnreachable(doc);
  return { data: await doc.save(), done, skipped, straightened };
}
