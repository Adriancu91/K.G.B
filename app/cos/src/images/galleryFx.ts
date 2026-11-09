// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Imagini → 🌀 Filtre: ultimele filtre din Galeria de filtre: Frescă și Pastel (Artistic), Crom, Pix grafic și Ipsos (Schiță),
// Sumi-e și Tușe oblice (Tușe de pensulă). Folosesc ajutoarele din sketchFx.ts și artisticFx.ts.

import { quietMean } from './artisticFx';
import { blur1, lumOf, paint } from './sketchFx';

type Px = Uint8ClampedArray;

export const PEN_DIRS = ['Diagonală spre dreapta', 'Orizontală', 'Diagonală spre stânga', 'Verticală'];

function hash(x: number, y: number, s = 0) {
  let t = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 1442695041)) | 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

/** Zgomot întins de-a lungul direcției (dx, dy): tușe de lungime len, valori în jurul lui 0. */
function strokes(w: number, h: number, len: number, dx: number, dy: number, seed: number) {
  const n = new Float32Array(w * h), L = Math.max(1, Math.round(len));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let i = -L; i <= L; i++) s += hash(Math.round(x + i * dx), Math.round(y + i * dy), seed);
    n[y * w + x] = (s / (2 * L + 1) - 0.5) * Math.sqrt(2 * L + 1) * 3.4;
  }
  return n;
}

/** Frescă: pete scurte și plate, contrast mare și margini închise, ca pictura pe tencuială udă. */
export function fresco(src: Px, w: number, h: number, v: Record<string, number>) {
  const m = quietMean(src, w, h, v.r), L = lumOf(m, w, h), det = v.d / 10, tex = v.t / 3, out = m.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = i * 4;
    const e = Math.min(1, Math.hypot(L[Math.min(i + 1, L.length - 1)] - L[i], L[Math.min(i + w, L.length - 1)] - L[i]) / 40);
    const k = (1 - e * 0.6 * det) * (1 + (hash(x >> 1, y >> 1, 91) - 0.5) * 0.15 * tex);
    for (let c = 0; c < 3; c++) out[o + c] = (128 + (m[o + c] - 128) * 1.35) * k;
  }
  return out;
}

/** Pastel: tușe lungi, oblice, de cretă colorată, pe o hârtie cu granulație. */
export function roughPastels(src: Px, w: number, h: number, v: Record<string, number>) {
  const n = strokes(w, h, v.r, 0.7, -0.7, 93), amt = v.v / 40, out = src.slice();
  for (let i = 0, o = 0; i < n.length; i++, o += 4) {
    const k = 1 + n[i] * 0.18 * amt, paper = (hash(i % w, (i / w) | 0, 95) - 0.5) * 18;
    for (let c = 0; c < 3; c++) out[o + c] = src[o + c] * k + paper;
  }
  return out;
}

/** Crom: poza devine metal lustruit, cu dungi luminoase și întunecate după formele ei. */
export function chrome(src: Px, w: number, h: number, v: Record<string, number>) {
  const L = blur1(lumOf(src, w, h), w, h, Math.max(0.5, v.s)), f = 1.5 + v.d / 2, out = src.slice();
  for (let i = 0, o = 0; i < L.length; i++, o += 4) {
    const g = 128 + 127 * Math.sin((L[i] / 255) * Math.PI * f);
    out[o] = out[o + 1] = out[o + 2] = g;
  }
  return out;
}

/** Pix grafic: linii subțiri de cerneală, toate în aceeași direcție, mai dese unde poza e mai închisă. */
export function graphicPen(src: Px, w: number, h: number, v: Record<string, number>) {
  const dir = Math.round(v.dir), [dx, dy] = [[0.7, -0.7], [1, 0], [0.7, 0.7], [0, 1]][dir] ?? [0.7, -0.7];
  const n = strokes(w, h, v.r, dx, dy, 97), L = lumOf(src, w, h), th = v.b / 100, t = new Float32Array(w * h);
  for (let i = 0; i < t.length; i++) t[i] = L[i] / 255 + n[i] * 0.12 > 1 - th ? 1 : 0;
  return paint(src, t, v.ink);
}

/** Ipsos: poza în două culori, umflată și luminată ca o formă turnată în ipsos. */
export function plaster(src: Px, w: number, h: number, v: Record<string, number>) {
  const L = blur1(lumOf(src, w, h), w, h, Math.max(0.5, v.s)), th = (v.b / 100) * 255, mask = new Float32Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = L[i] < th ? 1 : 0;
  // Forma umflată: masca estompată dă înălțimea; lumina din stânga sus dă relieful.
  const hgt = blur1(mask, w, h, Math.max(1.5, v.s)), t = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = hgt[Math.max(0, y - 1) * w + Math.max(0, x - 1)], b = hgt[Math.min(h - 1, y + 1) * w + Math.min(w - 1, x + 1)];
    t[i] = (mask[i] ? 0.25 : 0.8) + (a - b) * 2.2;
  }
  return paint(src, t, v.ink);
}

/** Sumi-e: tușe late de pensulă cu tuș: umbrele foarte închise, contrast mare, contururi moi. */
export function sumie(src: Px, w: number, h: number, v: Record<string, number>) {
  const m = quietMean(src, w, h, v.r), pr = v.p / 10, con = 1 + v.c / 20, out = m.slice();
  for (let i = 0; i < out.length; i += 4) {
    const L = (0.299 * m[i] + 0.587 * m[i + 1] + 0.114 * m[i + 2]) / 255, k = Math.pow(L, 1 + pr) / (L || 1);
    for (let c = 0; c < 3; c++) out[i + c] = 128 + (m[i + c] * k - 128) * con;
  }
  return out;
}

/** Tușe oblice: luminile pictate cu tușe într-o diagonală, umbrele în cealaltă. */
export function angledStrokes(src: Px, w: number, h: number, v: Record<string, number>) {
  const len = Math.max(1, Math.round(v.r)), bal = v.b / 100, out = src.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4, L = (0.299 * src[o] + 0.587 * src[o + 1] + 0.114 * src[o + 2]) / 255;
    const dy = L > bal ? -1 : 1;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = -len; i <= len; i++) {
      const xx = x + i, yy = y + i * dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const q = (yy * w + xx) * 4; r += src[q]; g += src[q + 1]; b += src[q + 2]; n++;
    }
    out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n;
  }
  return out;
}
