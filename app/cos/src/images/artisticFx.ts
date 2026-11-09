// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Imagini → 🌀 Filtre → Artistic (Filter Gallery: Artistic), partea a doua: Margini de afiș, Pensulă uscată, Spatulă,
// Burete, Creion colorat și Neon. Spatula și pensula uscată folosesc media celui mai liniștit sfert din jurul fiecărui pixel
// (pete plate cu marginile păstrate), calculată cu sume pe dreptunghiuri, deci la fel de rapid oricât de mare e pensula.

type Px = Uint8ClampedArray;

export const NEON_COLORS: [string, [number, number, number]][] = [
  ['Albastru', [40, 140, 255]], ['Roz', [255, 60, 180]], ['Verde', [60, 255, 120]], ['Galben', [255, 230, 60]], ['Alb', [255, 255, 255]],
];

function hash(x: number, y: number, s = 0) {
  let t = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 1442695041)) | 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

const lumAt = (s: Px, o: number) => 0.299 * s[o] + 0.587 * s[o + 1] + 0.114 * s[o + 2];

/** Media celui mai liniștit dintre cele patru sferturi de rază r din jurul fiecărui pixel (filtru de pictură cu pete plate). */
export function quietMean(src: Px, w: number, h: number, r: number) {
  const W = w + 1, S = [0, 1, 2, 3, 4].map(() => new Float64Array(W * (h + 1)));
  for (let y = 0; y < h; y++) {
    const a = [0, 0, 0, 0, 0];
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, L = lumAt(src, o);
      a[0] += src[o]; a[1] += src[o + 1]; a[2] += src[o + 2]; a[3] += L; a[4] += L * L;
      const q = (y + 1) * W + x + 1;
      for (let k = 0; k < 5; k++) S[k][q] = S[k][q - W] + a[k];
    }
  }
  const box = (k: number, x0: number, y0: number, x1: number, y1: number) => S[k][(y1 + 1) * W + x1 + 1] - S[k][y0 * W + x1 + 1] - S[k][(y1 + 1) * W + x0] + S[k][y0 * W + x0];
  const out = src.slice(), R = Math.max(1, Math.round(r));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = Infinity, bx0 = x, by0 = y, bx1 = x, by1 = y;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x0 = Math.max(0, Math.min(x, x + sx * R)), x1 = Math.min(w - 1, Math.max(x, x + sx * R));
      const y0 = Math.max(0, Math.min(y, y + sy * R)), y1 = Math.min(h - 1, Math.max(y, y + sy * R));
      const n = (x1 - x0 + 1) * (y1 - y0 + 1), m = box(3, x0, y0, x1, y1) / n, va = box(4, x0, y0, x1, y1) / n - m * m;
      if (va < best) { best = va; bx0 = x0; by0 = y0; bx1 = x1; by1 = y1; }
    }
    const n = (bx1 - bx0 + 1) * (by1 - by0 + 1), o = (y * w + x) * 4;
    out[o] = box(0, bx0, by0, bx1, by1) / n; out[o + 1] = box(1, bx0, by0, bx1, by1) / n; out[o + 2] = box(2, bx0, by0, bx1, by1) / n;
  }
  return out;
}

/** Cât de tare se schimbă luminozitatea în jurul pixelului (marginile). */
function edgesOf(src: Px, w: number, h: number) {
  const e = new Float32Array(w * h), L = (x: number, y: number) => lumAt(src, (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) e[y * w + x] = Math.hypot(L(x + 1, y) - L(x - 1, y), L(x, y + 1) - L(x, y - 1));
  return e;
}

/** Margini de afiș: culori în puține trepte și margini negre, ca un afiș tipărit. */
export function posterEdges(src: Px, w: number, h: number, v: Record<string, number>) {
  const e = edgesOf(src, w, h), n = Math.max(2, Math.round(v.n)), st = 255 / (n - 1), out = src.slice();
  const th = 70 - v.t * 6, k = 0.5 + v.i / 4;
  for (let i = 0, o = 0; i < e.length; i++, o += 4) {
    for (let c = 0; c < 3; c++) out[o + c] = Math.round(src[o + c] / st) * st;
    if (e[i] > th) { const d = Math.min(1, ((e[i] - th) / 40) * k); for (let c = 0; c < 3; c++) out[o + c] *= 1 - d; }
  }
  return out;
}

/** Pensulă uscată: pete plate cu urme de pensulă, culori puțin simplificate. */
export function dryBrush(src: Px, w: number, h: number, v: Record<string, number>) {
  const m = quietMean(src, w, h, v.r), tex = v.t / 3, det = v.d / 10, out = m.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    // Urmele pensulei: dungi scurte, oblice.
    const s = (hash(Math.floor((x + y * 0.4) / 3), Math.floor(y / 6), 61) - 0.5) * 40 * tex;
    for (let c = 0; c < 3; c++) out[o + c] = m[o + c] + (src[o + c] - m[o + c]) * det * 0.4 + s;
  }
  return out;
}

/** Spatulă: pete mari și plate de vopsea, cu marginile păstrate. */
export function paletteKnife(src: Px, w: number, h: number, v: Record<string, number>) {
  const m = quietMean(src, w, h, v.r);
  if (v.s <= 0) return m;
  // Moliciunea: o a doua trecere, mai mică, rotunjește marginile petelor.
  return quietMean(m, w, h, Math.max(1, (v.r * v.s) / 20));
}

/** Burete: culori puțin estompate, cu golurile întunecate ale unui burete apăsat pe hârtie. */
export function sponge(src: Px, w: number, h: number, v: Record<string, number>) {
  const sz = Math.max(1, v.r), def = v.d / 25, out = src.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4, gx = x / (sz * 2), gy = y / (sz * 2), x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    // Zgomot neted (valori la colțurile grilei, interpolate), apoi pragul dă găurile buretelui.
    const a = hash(x0, y0, 71), b = hash(x0 + 1, y0, 71), c = hash(x0, y0 + 1, 71), d = hash(x0 + 1, y0 + 1, 71);
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), n = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    const k = n < 0.35 ? 1 - def * (0.35 - n) * 2 : 1 + (n - 0.35) * 0.15 * (v.s / 15 + 0.5);
    for (let ch = 0; ch < 3; ch++) out[o + ch] = src[o + ch] * k;
  }
  return out;
}

/** Creion colorat: hașuri oblice în culorile pozei pe hârtie albă sau colorată; mai dese unde poza e mai închisă. */
export function coloredPencil(src: Px, w: number, h: number, v: Record<string, number>) {
  const wd = Math.max(1, v.r), pr = v.p / 15, paper = 200 + (v.b / 50) * 55, out = src.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4, L = lumAt(src, o) / 255;
    // Fiecare linie oblică are apăsarea ei; pe linie, tușa e plină unde poza e destul de închisă.
    const line = Math.floor((x + y) / wd), str = hash(line, Math.floor((x - y) / (wd * 8)), 81);
    const on = str < (1 - L) * (0.6 + pr * 0.6) + 0.3;
    for (let c = 0; c < 3; c++) out[o + c] = on ? src[o + c] * (0.85 + 0.15 * str) : paper * 0.85 + src[o + c] * 0.15;
  }
  return out;
}

/** Neon: poza în tonuri de gri, cu marginile strălucind în culoarea aleasă. */
export function neonGlow(src: Px, w: number, h: number, v: Record<string, number>) {
  const e = edgesOf(src, w, h), col = (NEON_COLORS[Math.round(v.col)] ?? NEON_COLORS[0])[1], br = v.b / 50;
  // Strălucirea: marginile estompate cu o medie în cutie pe rânduri și coloane.
  const r = Math.max(1, Math.round(v.r)), t = new Float32Array(w * h), g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += e[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { t[y * w + x] = s / (2 * r + 1); s += e[y * w + Math.min(w - 1, x + r + 1)] - e[y * w + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { g[y * w + x] = s / (2 * r + 1); s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
  const out = src.slice();
  for (let i = 0, o = 0; i < g.length; i++, o += 4) {
    const L = lumAt(src, o) * 0.55, a = Math.min(1, (g[i] / 60) * br);
    for (let c = 0; c < 3; c++) out[o + c] = L + (col[c] - L) * a;
  }
  return out;
}
