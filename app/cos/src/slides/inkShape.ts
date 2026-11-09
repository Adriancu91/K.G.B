// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// ✏ Desenează → ◇ În formă (ca „Cerneală în formă”): o linie trasă de mână se recunoaște ca linie dreaptă, dreptunghi,
// elipsă sau triunghi și devine o formă adevărată pe slide (contur în culoarea și grosimea creionului, fără umplere).
// Recunoașterea e geometrică, pe punctele liniei: cât de departe sunt de forma potrivită (raportat la mărimea ei).
import type { InkLine } from './ink';
import type { SlideEl } from './model';

/** Forma recunoscută, în coordonatele slide-ului; `flipV` la linii = urcă de la stânga la dreapta; `path` la triunghiurile oarecare (0–1). */
export interface InkShape { shape: 'line' | 'rect' | 'ellipse' | 'triangle'; x: number; y: number; w: number; h: number; flipV?: boolean; path?: string }

const r1 = (v: number) => Math.round(v * 10) / 10;
const pts = (p: number[]) => { const o: [number, number][] = []; for (let k = 0; k + 1 < p.length; k += 2) o.push([p[k], p[k + 1]]); return o; };
function segDist(x: number, y: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len)) : 0;
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / (v.length || 1);

/** Forma recunoscută dintr-o linie (punctele x, y la rând) sau null dacă nu seamănă destul cu niciuna. */
export function recognizeInk(p: number[]): InkShape | null {
  const P = pts(p);
  if (P.length < 4) return null;
  const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
  const w = x1 - x0, h = y1 - y0, diag = Math.hypot(w, h);
  if (diag < 20) return null;
  let L = 0;
  for (let k = 1; k < P.length; k++) L += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]);
  const a = P[0], b = P[P.length - 1], ends = Math.hypot(b[0] - a[0], b[1] - a[1]);
  // Linie: capetele departe unul de altul și toate punctele aproape de dreapta dintre ele.
  if (ends > 0.8 * L && Math.max(...P.map((q) => segDist(q[0], q[1], a, b))) < Math.max(4, 0.06 * ends)) {
    let [ax, ay] = a, [bx, by] = b;
    // Aproape orizontală / verticală (sub 8°) = dreaptă de-a binelea.
    const ang = Math.abs(Math.atan2(by - ay, bx - ax) * 180 / Math.PI) % 180;
    if (ang < 8 || ang > 172) { const m = (ay + by) / 2; ay = m; by = m; }
    else if (Math.abs(ang - 90) < 8) { const m = (ax + bx) / 2; ax = m; bx = m; }
    return { shape: 'line', x: r1(Math.min(ax, bx)), y: r1(Math.min(ay, by)), w: r1(Math.abs(bx - ax)), h: r1(Math.abs(by - ay)), ...((bx - ax) * (by - ay) < 0 ? { flipV: true } : {}) };
  }
  // Formele închise: capătul ajunge înapoi lângă început, iar forma nu e o linie subțire.
  if (ends > 0.25 * Math.max(w, h) || Math.min(w, h) < 0.12 * Math.max(w, h)) return null;
  const s = Math.min(w, h);
  const box = { x: r1(x0), y: r1(y0), w: r1(w), h: r1(h) };
  // Dreptunghi: punctele stau pe laturile chenarului și ajung în toate cele 4 colțuri.
  const edge = mean(P.map(([x, y]) => Math.min(x - x0, x1 - x, y - y0, y1 - y))) / s;
  const corner = Math.max(...[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([cx, cy]) => Math.min(...P.map(([x, y]) => Math.hypot(x - cx, y - cy))))) / s;
  if (edge < 0.06 && corner < 0.15) return { shape: 'rect', ...box };
  // Triunghi: cele mai depărtate două puncte și punctul cel mai departe de dreapta lor; punctele stau pe cele 3 laturi.
  let A = P[0], B = P[0], far = -1;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j += 2) { const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]); if (d > far) { far = d; A = P[i]; B = P[j]; } }
  let C = P[0], cd = -1;
  for (const q of P) { const d = segDist(q[0], q[1], A, B); if (d > cd) { cd = d; C = q; } }
  const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
  const tri = mean(P.map(([x, y]) => Math.min(segDist(x, y, A, B), segDist(x, y, B, C), segDist(x, y, C, A)))) / Math.sqrt(w * h);
  if (area > 0.3 * w * h && tri < 0.035) {
    // Vârful sus la mijloc și baza jos = triunghiul obișnuit; altfel un contur liber cu cele 3 colțuri.
    const V = [A, B, C].map(([x, y]) => [(x - x0) / w, (y - y0) / h]);
    const top = V.filter((v) => v[1] < 0.15), bottom = V.filter((v) => v[1] > 0.85);
    if (top.length === 1 && bottom.length === 2 && Math.abs(top[0][0] - 0.5) < 0.12) return { shape: 'triangle', ...box };
    const f = (v: number) => String(Math.round(v * 1000) / 1000);
    return { shape: 'triangle', ...box, path: `M${f(V[0][0])} ${f(V[0][1])} L${f(V[1][0])} ${f(V[1][1])} L${f(V[2][0])} ${f(V[2][1])} Z` };
  }
  // Elipsă: distanța „normalizată” față de centru e aproape 1 peste tot.
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = w / 2, ry = h / 2;
  const ell = mean(P.map(([x, y]) => Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1)));
  if (ell < 0.12) return { shape: 'ellipse', ...box };
  return null;
}

/** Punctele formei, ca linie de desen (previzualizarea din stratul de desen; radiera și Anulează merg ca la orice linie). */
export function shapeLine(sh: InkShape): number[] {
  const { x, y, w, h } = sh;
  if (sh.shape === 'line') return sh.flipV ? [x, y + h, x + w, y] : [x, y, x + w, y + h];
  if (sh.shape === 'rect') return [x, y, x + w, y, x + w, y + h, x, y + h, x, y];
  if (sh.shape === 'ellipse') {
    const o: number[] = [];
    for (let k = 0; k <= 48; k++) { const t = (k / 48) * Math.PI * 2; o.push(r1(x + w / 2 + (w / 2) * Math.cos(t)), r1(y + h / 2 + (h / 2) * Math.sin(t))); }
    return o;
  }
  const v = sh.path ? (sh.path.match(/-?[\d.]+/g) ?? []).map(Number) : [0.5, 0, 1, 1, 0, 1];
  const o: number[] = [];
  for (let k = 0; k + 1 < v.length; k += 2) o.push(r1(x + v[k] * w), r1(y + v[k + 1] * h));
  return [...o, o[0], o[1]];
}

/** Forma de pe slide făcută dintr-o linie recunoscută: contur în culoarea și grosimea ei, fără umplere. */
export function inkShapeEl(l: InkLine & { sh: InkShape }, id: string): SlideEl {
  const { sh } = l;
  const lineW = Math.min(20, Math.max(1, Math.round(l.w * 10) / 10));
  if (sh.shape === 'line') return { id, kind: 'shape', shape: 'line', fill: 'accent', text: '', x: sh.x, y: sh.y, w: sh.w, h: sh.h, line: l.c, lineW, ...(sh.flipV ? { flipV: true } : {}) };
  return { id, kind: 'shape', shape: sh.shape, fill: l.c, transp: 100, text: '', x: sh.x, y: sh.y, w: Math.max(1, sh.w), h: Math.max(1, sh.h), line: l.c, lineW, ...(sh.path ? { path: sh.path } : {}) };
}
