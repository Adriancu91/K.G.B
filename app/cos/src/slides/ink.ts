// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// ✏ Desenează (ca fila Draw): liniile trase de mână pe slide, cu creionul sau markerul, în coordonatele slide-ului.
// Desenul se pune pe slide ca poză transparentă; liniile rămân ținute în poză (câmpul ink), ca desenul să poată fi
// schimbat mai târziu (alte linii, radieră), chiar dacă poza a fost mutată sau mărită între timp.

/** O linie: punctele x, y la rând, culoarea, grosimea și opacitatea (markerul e pe jumătate transparent). */
export interface InkLine { p: number[]; c: string; w: number; o: number; /** Cu ◇ În formă: forma recunoscută (devine formă la ✓ Gata). */ sh?: import('./inkShape').InkShape;
  /** Apăsarea creionului (0–1) la fiecare punct, când linia e trasă cu creionul unei tablete: grosimea urmează apăsarea. */ q?: number[] }
/** Desenul unei poze: liniile și locul pozei pe slide când a fost făcută (ca liniile să se potrivească după mutare). */
export interface Ink { lines: InkLine[]; x: number; y: number; w: number; h: number }

export const MAX_LINES = 500;
export const MAX_PTS = 4000;
export const PEN_WIDTHS: [number, string][] = [[2, 'subțire'], [5, 'mediu'], [10, 'gros']];
export const MARK_WIDTHS: [number, string][] = [[14, 'subțire'], [24, 'mediu'], [40, 'gros']];

const r1 = (v: number) => Math.round(v * 10) / 10;
const isColor = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

/** Traseul SVG al liniei (un singur punct devine un punct rotund). */
export function lineD(l: InkLine): string {
  const p = l.p;
  if (p.length < 2) return '';
  let d = `M${p[0]} ${p[1]}`;
  if (p.length === 2) return d + ` L${p[0]} ${p[1]}`;
  for (let k = 2; k + 1 < p.length; k += 2) d += ` L${p[k]} ${p[k + 1]}`;
  return d;
}

/** Adaugă un punct la linie, doar dacă e destul de departe de cel dinainte (liniile rămân mici); `pr` = apăsarea creionului. */
export function addPoint(l: InkLine, x: number, y: number, pr?: number): InkLine {
  const n = l.p.length;
  if (n >= MAX_PTS * 2) return l;
  if (n >= 2 && Math.hypot(x - l.p[n - 2], y - l.p[n - 1]) < 1.5) return l;
  const q = l.q && pr !== undefined ? { q: [...l.q, Math.round(Math.min(1, Math.max(0, pr)) * 100) / 100] } : {};
  return { ...l, p: [...l.p, r1(x), r1(y)], ...q };
}

/** Grosimea la apăsarea q (0–1): apăsat ușor = un sfert din grosimea aleasă, apăsat tare = toată. */
export const pressW = (w: number, q: number) => w * (0.25 + 0.75 * q);

/**
 * Linia pentru desenare: fără apăsare, un singur traseu cu grosimea ei; cu apăsare, bucăți de traseu, fiecare cu grosimea
 * ei (rotunjită la 0,5 px, ca bucățile la fel de groase să rămână una singură și desenul să fie ușor).
 */
export function inkSegs(l: InkLine): { d: string; w: number }[] {
  const p = l.p, q = l.q;
  if (!q || q.length * 2 !== p.length || p.length < 2) return [{ d: lineD(l), w: l.w }];
  const wq = (v: number) => Math.max(0.5, Math.round(pressW(l.w, v) * 2) / 2);
  if (p.length === 2) return [{ d: lineD(l), w: wq(q[0]) }];
  const out: { d: string; w: number }[] = [];
  for (let k = 1; k < q.length; k++) {
    const w = wq((q[k - 1] + q[k]) / 2), seg = ` L${p[2 * k]} ${p[2 * k + 1]}`, last = out[out.length - 1];
    if (last && last.w === w) last.d += seg;
    else out.push({ d: `M${p[2 * k - 2]} ${p[2 * k - 1]}` + seg, w });
  }
  return out;
}

/** Dreptunghiul ocupat de linii (cu grosimea lor), tăiat la marginile slide-ului; null dacă nu e nimic de arătat. */
export function inkBox(lines: InkLine[], W: number, H: number): { x: number; y: number; w: number; h: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of lines) {
    const pad = l.w / 2 + 2;
    for (let k = 0; k + 1 < l.p.length; k += 2) {
      x0 = Math.min(x0, l.p[k] - pad); x1 = Math.max(x1, l.p[k] + pad);
      y0 = Math.min(y0, l.p[k + 1] - pad); y1 = Math.max(y1, l.p[k + 1] + pad);
    }
  }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/** Distanța de la un punct la segmentul a–b. */
function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/** Radiera: scoate liniile atinse (ca radiera de linii: linia întreagă dispare). r = cât de mare e radiera. */
export function eraseAt(lines: InkLine[], x: number, y: number, r: number): InkLine[] {
  const hit = (l: InkLine) => {
    const lim = r + l.w / 2;
    if (l.p.length === 2) return Math.hypot(x - l.p[0], y - l.p[1]) <= lim;
    for (let k = 0; k + 3 < l.p.length; k += 2) if (segDist(x, y, l.p[k], l.p[k + 1], l.p[k + 2], l.p[k + 3]) <= lim) return true;
    return false;
  };
  const out = lines.filter((l) => !hit(l));
  return out.length === lines.length ? lines : out;
}

/** Liniile desenului mutate și întinse acolo unde e poza acum (poza poate fi mutată sau mărită după desenare). */
export function placeInk(ink: Ink, at: { x: number; y: number; w: number; h: number }): InkLine[] {
  const sx = at.w / ink.w, sy = at.h / ink.h, sw = Math.sqrt(sx * sy);
  return ink.lines.map((l) => ({
    ...l,
    w: r1(Math.max(0.5, l.w * sw)),
    p: l.p.map((v, k) => r1(k % 2 ? at.y + (v - ink.y) * sy : at.x + (v - ink.x) * sx)),
  }));
}

/** Desenul citit dintr-un fișier: doar linii cu numere, culori și grosimi valide; undefined dacă nu rămâne nimic. */
export function cleanInk(v: unknown): Ink | undefined {
  const o = v as Partial<Ink> | null;
  if (!o || typeof o !== 'object' || !Array.isArray(o.lines)) return undefined;
  const n = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  if (![o.x, o.y].every(n) || !n(o.w) || !n(o.h) || !(o.w! > 0) || !(o.h! > 0)) return undefined;
  const lines: InkLine[] = [];
  for (const l of o.lines.slice(0, MAX_LINES)) {
    if (!l || !Array.isArray(l.p) || !isColor(l.c) || !n(l.w) || !n(l.o)) continue;
    const p = l.p.slice(0, MAX_PTS * 2).filter(n);
    if (p.length < 2 || p.length % 2) continue;
    const q = Array.isArray(l.q) && l.q.length * 2 === p.length && l.q.every((v) => n(v) && v >= 0 && v <= 1) ? { q: l.q.slice() } : {};
    lines.push({ p, c: l.c.toLowerCase(), w: Math.min(80, Math.max(0.5, l.w)), o: Math.min(1, Math.max(0.05, l.o)), ...q });
  }
  return lines.length ? { lines, x: o.x!, y: o.y!, w: o.w!, h: o.h! } : undefined;
}

/** Punctul (x, y) e în poligonul dat (punctele x, y la rând)? */
function inPoly(x: number, y: number, poly: number[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i + 1 < poly.length; j = i, i += 2) {
    const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** ⬚ Lasoul: liniile cu cel puțin jumătate din puncte în bucla trasă (indicii lor). */
export function lassoPick(lines: InkLine[], poly: number[]): number[] {
  if (poly.length < 6) return [];
  const out: number[] = [];
  lines.forEach((l, k) => {
    let n = 0;
    for (let q = 0; q + 1 < l.p.length; q += 2) if (inPoly(l.p[q], l.p[q + 1], poly)) n++;
    if (n * 2 >= l.p.length / 2) out.push(k);
  });
  return out;
}

/** Liniile alese (indicii) mutate cu dx, dy; forma recunoscută (◇ În formă) se mută odată cu ele. */
export function moveLines(lines: InkLine[], pick: number[], dx: number, dy: number): InkLine[] {
  const set = new Set(pick);
  return lines.map((l, k) => (set.has(k)
    ? { ...l, p: l.p.map((v, q) => r1(v + (q % 2 ? dy : dx))), ...(l.sh ? { sh: { ...l.sh, x: r1(l.sh.x + dx), y: r1(l.sh.y + dy) } } : {}) }
    : l));
}
