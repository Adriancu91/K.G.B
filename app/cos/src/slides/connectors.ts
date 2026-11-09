// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Conectorii: capătul unei linii lăsat lângă mijlocul unei laturi a altei forme se lipește de ea (punct de conexiune),
// iar când forma se mută, se mărește sau se rotește, linia o urmează. Mutarea liniei întregi o dezlipește.
// Linia e caseta (x, y, w, h) desenată de la colțul din stânga-sus la cel din dreapta-jos; flipH / flipV o întorc.
// Punctele de conexiune, ca în .pptx: 0 = sus, 1 = stânga, 2 = jos, 3 = dreapta (mijlocul fiecărei laturi).
// Elipsa are încă 4, pe margine la 45°: 4 = stânga-sus, 5 = stânga-jos, 6 = dreapta-jos, 7 = dreapta-sus
// (în .pptx elipsa le numără altfel, de sus spre stânga, vezi ELLIPSE_PPTX).
// Triunghiurile au 6: 0 = vârful de sus, 1 = mijlocul laturii din stânga, 2 = mijlocul bazei, 3 = mijlocul laturii din dreapta
// (la cel dreptunghic: ipotenuza), 4 = colțul stânga-jos, 5 = colțul dreapta-jos (în .pptx în altă ordine, vezi TRI_PPTX).
// Formele cu laturi înclinate (paralelogram, trapez, câteva scheme) au tot 4, dar pe laturile lor, nu pe caseta formei (vezi QUAD).
// Poligoanele regulate, stelele, săgețile și alte forme cu vârfuri au punctele lor, numerotate ca în .pptx (vezi POINTS).

import { isLine, type LineAxes, type LineRoute, type SlideEl } from './model';

export type Cxn = { id: string; idx: number };
type P = { x: number; y: number };
type Box = Pick<SlideEl, 'x' | 'y' | 'w' | 'h'>;

/** Cât de aproape (în pixeli de slide) trebuie lăsat capătul ca să se lipească. */
export const CXN_SNAP = 14;

export const isCxn = (c: unknown): c is Cxn =>
  !!c && typeof (c as Cxn).id === 'string' && Number.isInteger((c as Cxn).idx) && (c as Cxn).idx >= 0 && (c as Cxn).idx <= 7;

/** Capetele liniei: [început, sfârșit], ținând cont de oglindiri. */
export function lineEnds(e: Box & Pick<SlideEl, 'flipH' | 'flipV'>): [P, P] {
  const x1 = e.flipH ? e.x + e.w : e.x, x2 = e.flipH ? e.x : e.x + e.w;
  const y1 = e.flipV ? e.y + e.h : e.y, y2 = e.flipV ? e.y : e.y + e.h;
  return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
}

/** Caseta și oglindirile unei linii de la `a` la `b`. */
export function lineBox(a: P, b: P): Box & { flipH: boolean; flipV: boolean } {
  return {
    x: Math.round(Math.min(a.x, b.x)), y: Math.round(Math.min(a.y, b.y)),
    w: Math.round(Math.abs(b.x - a.x)), h: Math.round(Math.abs(b.y - a.y)),
    flipH: b.x < a.x, flipV: b.y < a.y,
  };
}

/** Pune caseta nouă pe linie; oglindirile lipsă înseamnă „fără”, ca în restul modelului. */
function withBox(e: SlideEl, a: P, b: P): SlideEl {
  const { flipH, flipV, ...g } = lineBox(a, b);
  const { flipH: _h, flipV: _v, ...rest } = e;
  return { ...rest, ...g, ...(flipH ? { flipH: true } : {}), ...(flipV ? { flipV: true } : {}) };
}

const isEllipse = (e: SlideEl) => e.kind === 'shape' && e.shape === 'ellipse';
const isTri = (e: SlideEl) => e.kind === 'shape' && (e.shape === 'triangle' || e.shape === 'rtTriangle');

/** Punctele triunghiurilor, în caseta formei (vezi ordinea de sus). */
function triSites(e: SlideEl): P[] {
  const { x, y, w, h } = e, cy = y + h / 2, b = y + h;
  const pts = e.shape === 'rtTriangle'
    ? [{ x, y }, { x, y: cy }, { x: x + w / 2, y: b }, { x: x + w / 2, y: cy }, { x, y: b }, { x: x + w, y: b }]
    : [{ x: x + w / 2, y }, { x: x + w / 4, y: cy }, { x: x + w / 2, y: b }, { x: x + (3 * w) / 4, y: cy }, { x, y: b }, { x: x + w, y: b }];
  // Oglindit, triunghiul își duce punctele cu el.
  return pts.map((p) => ({ x: e.flipH ? 2 * x + w - p.x : p.x, y: e.flipV ? 2 * y + h - p.y : p.y }));
}

/**
 * Formele cu laturi înclinate: sus, stânga, jos, dreapta (ca la dreptunghi și în aceeași ordine ca în .pptx), dar puse pe mijlocul
 * laturii adevărate, în fracțiuni din casetă (aceleași proporții ca POLYGONS din model.ts).
 */
const QUAD: Record<string, [number, number][]> = {
  parallelogram: [[0.5, 0], [0.125, 0.5], [0.5, 1], [0.875, 0.5]],
  trapezoid: [[0.5, 0], [0.125, 0.5], [0.5, 1], [0.875, 0.5]],
  flowChartInputOutput: [[0.5, 0], [0.1, 0.5], [0.5, 1], [0.9, 0.5]],
  flowChartManualOperation: [[0.5, 0], [0.1, 0.5], [0.5, 1], [0.9, 0.5]],
  flowChartManualInput: [[0.5, 0.1], [0, 0.5], [0.5, 1], [1, 0.5]],
  flowChartMerge: [[0.5, 0], [0.25, 0.5], [0.5, 1], [0.75, 0.5]],
  flowChartExtract: [[0.5, 0], [0.25, 0.5], [0.5, 1], [0.75, 0.5]],
};
const quadOf = (e: SlideEl) => (e.kind === 'shape' && e.shape ? QUAD[e.shape] : undefined);

/**
 * Poligoanele regulate, stelele, săgețile și alte forme cu vârfuri: punctele de conexiune în ordinea și pe locurile din .pptx
 * (definițiile standard ale formelor, ECMA-376), puse pe vârfurile / laturile poligoanelor noastre din model.ts (POLYGONS),
 * în fracțiuni din casetă. Numărul punctului la noi e chiar cel din .pptx.
 */
const POINTS: Record<string, [number, number][]> = {
  pentagon: [[0.5, 0], [0, 0.38], [0.19, 1], [0.5, 1], [0.81, 1], [1, 0.38]],
  hexagon: [[1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5], [0.25, 0], [0.75, 0]],
  heptagon: [[0.901, 0.198], [1, 0.643], [0.723, 1], [0.277, 1], [0, 0.643], [0.099, 0.198], [0.5, 0]],
  octagon: [[1, 0.29], [1, 0.71], [0.71, 1], [0.29, 1], [0, 0.71], [0, 0.29], [0.29, 0], [0.71, 0]],
  decagon: [[0.905, 0.191], [1, 0.5], [0.905, 0.809], [0.655, 1], [0.345, 1], [0.095, 0.809], [0, 0.5], [0.095, 0.191], [0.345, 0], [0.655, 0]],
  dodecagon: [[0.866, 0.134], [1, 0.366], [1, 0.634], [0.866, 0.866], [0.634, 1], [0.366, 1], [0.134, 0.866], [0, 0.634], [0, 0.366], [0.134, 0.134], [0.366, 0], [0.634, 0]],
  // Stelele: vârfurile din afară.
  star4: [[0.5, 0], [0, 0.5], [0.5, 1], [1, 0.5]],
  star5: [[0.5, 0], [0.02, 0.35], [0.21, 0.91], [0.79, 0.91], [0.98, 0.35]],
  star6: [[1, 0.25], [1, 0.75], [0.5, 1], [0, 0.75], [0, 0.25], [0.5, 0]],
  star7: [[0.901, 0.198], [1, 0.643], [0.723, 1], [0.277, 1], [0, 0.643], [0.099, 0.198], [0.5, 0]],
  star8: [[1, 0.5], [0.854, 0.854], [0.5, 1], [0.146, 0.854], [0, 0.5], [0.146, 0.146], [0.5, 0], [0.854, 0.146]],
  star10: [[1, 0.345], [1, 0.655], [0.809, 0.905], [0.5, 1], [0.191, 0.905], [0, 0.655], [0, 0.345], [0.191, 0.095], [0.5, 0], [0.809, 0.095]],
  star12: [[0.933, 0.25], [1, 0.5], [0.933, 0.75], [0.75, 0.933], [0.5, 1], [0.25, 0.933], [0.067, 0.75], [0, 0.5], [0.067, 0.25], [0.25, 0.067], [0.5, 0], [0.75, 0.067]],
  plus: [[0.5, 0], [0, 0.5], [0.5, 1], [1, 0.5]],
  // Săgețile: colțurile vârfului (unde începe vârful) și capetele.
  rightArrow: [[0.6, 0], [0, 0.5], [0.6, 1], [1, 0.5]],
  leftArrow: [[0.4, 0], [0, 0.5], [0.4, 1], [1, 0.5]],
  upArrow: [[0.5, 0], [0, 0.4], [0.5, 1], [1, 0.4]],
  downArrow: [[0.5, 0], [0, 0.6], [0.5, 1], [1, 0.6]],
  leftRightArrow: [[1, 0.5], [0.8, 1], [0.2, 1], [0, 0.5], [0.2, 0], [0.8, 0]],
  upDownArrow: [[0.5, 0], [0, 0.3], [0.25, 0.5], [0, 0.7], [0.5, 1], [1, 0.7], [0.75, 0.5], [1, 0.3]],
  notchedRightArrow: [[0.6, 0], [0.15, 0.5], [0.6, 1], [1, 0.5]],
  quadArrow: [[0.5, 0], [0, 0.5], [0.5, 1], [1, 0.5]],
  homePlate: [[0.4, 0], [0, 0.5], [0.8, 1], [1, 0.5]],
  chevron: [[0.375, 0], [0.25, 0.5], [0.375, 1], [1, 0.5]],
  snip1Rect: [[1, 0.5], [0.5, 1], [0, 0.5], [0.5, 0]],
  lightningBolt: [[0.39, 0], [0, 0.18], [0.23, 0.45], [0.46, 0.69], [1, 1], [0.77, 0.56], [0.59, 0.28]],
  heart: [[0.5, 0.239], [0.5, 1]],
  cloud: [[0.963, 0.516], [0.494, 0.993], [0, 0.5], [0.511, 0.015]],
};
/** Tabelul de puncte al formei (doar formele cu numele lor, nu cele desenate liber). */
const pointsOf = (e: SlideEl) => (e.kind === 'shape' && e.shape && !e.path ? POINTS[e.shape] : undefined);

/** Punctele formelor cu laturi înclinate; oglindită, forma își duce punctele cu ea. */
function quadSites(e: SlideEl, q: [number, number][]): P[] {
  return q.map(([fx, fy]) => ({ x: e.x + (e.flipH ? 1 - fx : fx) * e.w, y: e.y + (e.flipV ? 1 - fy : fy) * e.h }));
}

/** Punctele de conexiune ale unei forme (mijlocul laturilor; la elipsă și cele 4 de la 45°; la triunghiuri 6), rotite odată cu ea în jurul centrului. */
export function sites(e: SlideEl): P[] {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  const q = quadOf(e) ?? pointsOf(e);
  const raw: P[] = isTri(e) ? triSites(e) : q ? quadSites(e, q) :[{ x: cx, y: e.y }, { x: e.x, y: cy }, { x: cx, y: e.y + e.h }, { x: e.x + e.w, y: cy }];
  if (isEllipse(e)) {
    const dx = (e.w / 2) * Math.SQRT1_2, dy = (e.h / 2) * Math.SQRT1_2;
    raw.push({ x: cx - dx, y: cy - dy }, { x: cx - dx, y: cy + dy }, { x: cx + dx, y: cy + dy }, { x: cx + dx, y: cy - dy });
  }
  const r = ((e.rot ?? 0) * Math.PI) / 180;
  if (!r) return raw;
  const cos = Math.cos(r), sin = Math.sin(r);
  return raw.map((p) => ({ x: cx + (p.x - cx) * cos - (p.y - cy) * sin, y: cy + (p.x - cx) * sin + (p.y - cy) * cos }));
}

/** Formele de care se poate lipi o linie: casetele vizibile, nu alte linii și nu linia însăși. */
const canHold = (e: SlideEl, skip: string) => e.id !== skip && !isLine(e) && e.w > 0 && e.h > 0;

/** Cel mai apropiat punct de conexiune de `p`, mai aproape de `tol`; null dacă nu e niciunul. */
export function nearestSite(els: SlideEl[], p: P, skip: string, tol = CXN_SNAP): (Cxn & P) | null {
  let best: (Cxn & P) | null = null, bd = tol;
  for (const e of els) {
    if (!canHold(e, skip)) continue;
    sites(e).forEach((s, idx) => {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d <= bd) { bd = d; best = { id: e.id, idx, x: s.x, y: s.y }; }
    });
  }
  return best;
}

/** Fără un capăt lipit (stCxn = început, endCxn = sfârșit). */
function drop(e: SlideEl, which: 'stCxn' | 'endCxn'): SlideEl {
  if (!e[which]) return e;
  const { [which]: _x, ...rest } = e;
  return rest as SlideEl;
}

/**
 * Liniile lipite urmează formele: capătul lipit se mută în punctul de conexiune de acum al formei.
 * Dacă forma a dispărut (ștearsă), capătul rămâne unde era și se dezlipește. Liniile fără conexiuni rămân aceleași obiecte.
 */
export function followConnectors(els: SlideEl[]): SlideEl[] {
  if (!els.some((e) => e.stCxn || e.endCxn)) return els;
  const by = new Map(els.map((e) => [e.id, e]));
  let changed = false;
  const out = els.map((e) => {
    if (!isLine(e) || (!e.stCxn && !e.endCxn)) return e;
    let [a, b] = lineEnds(e), n = e;
    const at = (c: Cxn | undefined) => { const s = c && by.get(c.id); return s && canHold(s, e.id) ? sites(s)[c.idx] ?? null : null; };
    const sa = at(e.stCxn), sb = at(e.endCxn);
    if (e.stCxn && !sa) n = drop(n, 'stCxn');
    if (e.endCxn && !sb) n = drop(n, 'endCxn');
    if (sa) a = sa;
    if (sb) b = sb;
    n = withAxes(n);
    const g = lineBox(a, b);
    if (n === e && g.x === e.x && g.y === e.y && g.w === e.w && g.h === e.h && g.flipH === !!e.flipH && g.flipV === !!e.flipV) return e;
    changed = true;
    return withBox(n, a, b);
  });
  return changed ? out : els;
}

/**
 * O linie trasă cu mouse-ul (caseta nouă `g`): dacă s-a mutat toată, se dezlipește de ambele forme; dacă s-a tras doar un capăt,
 * acel capăt se lipește de cel mai apropiat punct de conexiune (sau se dezlipește, dacă nu e niciunul aproape).
 */
export function dragLine(els: SlideEl[], id: string, g: Box): SlideEl[] {
  const e = els.find((o) => o.id === id);
  if (!e || !isLine(e)) return els.map((o) => (o.id === id ? { ...o, ...g } : o));
  const [a0, b0] = lineEnds(e), [a1, b1] = lineEnds({ ...e, ...g });
  const movedA = a0.x !== a1.x || a0.y !== a1.y, movedB = b0.x !== b1.x || b0.y !== b1.y;
  let n: SlideEl = { ...e, ...g };
  if (movedA && movedB) n = drop(drop(n, 'stCxn'), 'endCxn');
  else if (movedA || movedB) {
    const which = movedA ? 'stCxn' : 'endCxn';
    const s = nearestSite(els, movedA ? a1 : b1, id);
    n = drop(n, which);
    if (s) {
      n = withBox(n, movedA ? s : a1, movedA ? b1 : s);
      n = { ...n, [which]: { id: s.id, idx: s.idx } };
    }
  }
  n = withAxes(n);
  return els.map((o) => (o.id === id ? n : o));
}

/**
 * Traseul liniei în caseta ei (w × h, de la colțul stânga-sus la dreapta-jos, înainte de oglindiri):
 * dreaptă, frântă (orizontal până la mijloc, vertical, apoi orizontal; ca bentConnector3) sau curbată în S (ca curvedConnector3).
 * `ta` / `tb` scurtează linia la început / la sfârșit (locul vârfurilor de săgeată). Întoarce și direcția de mers la cele două capete.
 */
export function routeGeom(w: number, h: number, route: LineRoute | undefined, ta = 0, tb = 0, axes?: LineAxes, bend = 0.5): { d: string; da: P; db: P } {
  const r = (v: number) => Math.round(v * 100) / 100;
  const X = { x: 1, y: 0 }, Y = { x: 0, y: 1 };
  if (route && axes === 'vv' && h > 0) {
    // Vertical până la mijloc, orizontal, apoi vertical (conectorul frânt întors cu 90°).
    const m = h * bend, a = Math.min(ta, m), b = Math.min(tb, h - m);
    const d = route === 'elbow' ? `M0,${r(a)}V${r(m)}H${r(w)}V${r(h - b)}` : `M0,${r(a)}C0,${r(m)} ${r(w)},${r(m)} ${r(w)},${r(h - b)}`;
    return { d, da: Y, db: Y };
  }
  if (route && (axes === 'hv' || axes === 'vh')) {
    // Un singur cot (în formă de L): orizontal, apoi vertical, sau invers.
    const hv = axes === 'hv', a = Math.min(ta, hv ? w : h), b = Math.min(tb, hv ? h : w);
    const d = hv
      ? (route === 'elbow' ? `M${r(a)},0H${r(w)}V${r(h - b)}` : `M${r(a)},0C${r(w * 0.55)},0 ${r(w)},${r(h * 0.45)} ${r(w)},${r(h - b)}`)
      : (route === 'elbow' ? `M0,${r(a)}V${r(h)}H${r(w - b)}` : `M0,${r(a)}C0,${r(h * 0.55)} ${r(w * 0.45)},${r(h)} ${r(w - b)},${r(h)}`);
    return { d, da: hv ? X : Y, db: hv ? Y : X };
  }
  if (!route || w <= 0) {
    // Linia dreaptă (și conectorul cu lățimea 0, care e tot o linie verticală).
    const len = Math.hypot(w, h) || 1, u = { x: w / len, y: h / len };
    return { d: `M${r(u.x * ta)},${r(u.y * ta)}L${r(w - u.x * tb)},${r(h - u.y * tb)}`, da: u, db: u };
  }
  const x = { x: 1, y: 0 }, m = w * bend;
  const a = Math.min(ta, m), b = Math.min(tb, w - m);
  const d = route === 'elbow'
    ? `M${r(a)},0H${r(m)}V${r(h)}H${r(w - b)}`
    : `M${r(a)},0C${r(m)},0 ${r(m)},${r(h)} ${r(w - b)},${r(h)}`;
  return { d, da: x, db: x };
}

/** Cum pleacă linia de la capete: de pe latura de sus / jos a unei forme pleacă vertical, de pe stânga / dreapta orizontal. */
export function withAxes(e: SlideEl): SlideEl {
  if (!isLine(e) || !e.route || (!e.stCxn && !e.endCxn)) return e;
  // Punctele de la 45° ale elipsei și colțurile de jos ale triunghiurilor pleacă în sus / în jos, ca în .pptx.
  const v = (c: Cxn | undefined, old: boolean) => (c ? c.idx % 2 === 0 || c.idx > 3 : old);
  const a = v(e.stCxn, e.axes === 'vh' || e.axes === 'vv'), b = v(e.endCxn, e.axes === 'hv' || e.axes === 'vv');
  const axes: LineAxes | undefined = a && b ? 'vv' : a ? 'vh' : b ? 'hv' : undefined;
  if (axes === e.axes) return e;
  const { axes: _a, ...rest } = e;
  return axes ? { ...rest, axes } : rest;
}

/** Conectorul are segment în mijloc, care se poate muta (mânerul galben): cel cu două coturi, nu cel în formă de L. */
export const hasBend = (e: SlideEl) => isLine(e) && !!e.route && (!e.axes || e.axes === 'vv') && (e.axes === 'vv' ? e.h > 0 : e.w > 0);

/** Segmentul din mijloc mutat la `bend` (0…1); la jumătate nu se mai scrie. */
export function withBend(e: SlideEl, bend: number): SlideEl {
  const b = Math.round(Math.min(1, Math.max(0, bend)) * 1000) / 1000;
  const { bend: _b, ...rest } = e;
  return b === 0.5 ? rest : { ...rest, bend: b };
}

/** Conectorii care pleacă vertical se scriu în .pptx întorși cu 90° (geometria conectorului pleacă mereu orizontal). */
export const transposed = (e: SlideEl) => isLine(e) && !!e.route && (e.axes === 'vv' || e.axes === 'vh');

/** .pptx: liniile frânte / curbate au geometria conectorului (biblioteca scrie doar prst="line"); cu un singur cot, cea cu 2 segmente. */
export function routeXml(xml: string, els: SlideEl[]): string {
  for (const e of els) {
    if (!isLine(e) || !e.route) continue;
    const at = xml.indexOf(`name="el-${e.id}"`);
    const g = at < 0 ? -1 : xml.indexOf('<a:prstGeom prst="line">', at);
    const next = at < 0 ? -1 : xml.indexOf('name="el-', at + 1);
    if (g < 0 || (next >= 0 && g > next)) continue;
    const two = e.axes === 'hv' || e.axes === 'vh';
    const prst = (e.route === 'elbow' ? 'bentConnector' : 'curvedConnector') + (two ? '2' : '3');
    // Segmentul din mijloc mutat: a:gd adj1, în miimi de procent din lățimea casetei (ca la noi, de la început spre sfârșit).
    const adj = !two && e.bend !== undefined ? `<a:gd name="adj1" fmla="val ${Math.round(e.bend * 100000)}"/>` : '';
    let rest = xml.slice(g + '<a:prstGeom prst="line">'.length);
    if (adj && rest.startsWith('<a:avLst>')) rest = '<a:avLst>' + adj + rest.slice('<a:avLst>'.length);
    else if (adj && rest.startsWith('<a:avLst/>')) rest = '<a:avLst>' + adj + '</a:avLst>' + rest.slice('<a:avLst/>'.length);
    xml = xml.slice(0, g) + `<a:prstGeom prst="${prst}">` + rest;
  }
  return xml;
}

/**
 * La deschiderea unui .pptx: conectorul frânt / curbat întors cu 90°, 180° sau 270° se scrie la noi fără rotire,
 * cu oglindiri și cu felul în care pleacă de la capete (invers față de deckToPptx). `two` = geometria cu un singur cot.
 */
export function untransposed(e: SlideEl, two: boolean): SlideEl {
  if (!isLine(e) || !e.route) return e;
  const rot = ((Math.round(e.rot ?? 0) % 360) + 360) % 360;
  if (rot !== 0 && rot !== 90 && rot !== 180 && rot !== 270) return two ? { ...e, axes: 'hv' } : e;
  let { flipH: fh = false, flipV: fv = false } = e, { x, y, w, h } = e, t = false;
  if (rot === 90 || rot === 270) {
    // Rotirea cu 90° a unei forme oglindite vertical = forma transpusă (x ↔ y); caseta se întoarce în jurul centrului.
    t = true;
    [fh, fv] = [!fv, fh];
    x = Math.round(e.x + e.w / 2 - e.h / 2); y = Math.round(e.y + e.h / 2 - e.w / 2); [w, h] = [e.h, e.w];
  }
  // 180° = oglindit și orizontal, și vertical.
  if (rot === 180 || rot === 270) { fh = !fh; fv = !fv; }
  const { rot: _r, flipH: _h, flipV: _v, axes: _a, ...rest } = e;
  const axes: LineAxes | undefined = two ? (t ? 'vh' : 'hv') : t ? 'vv' : undefined;
  return { ...rest, x, y, w, h, ...(fh ? { flipH: true } : {}), ...(fv ? { flipV: true } : {}), ...(axes ? { axes } : {}) };
}

/** La deschiderea unui .pptx: traseul după geometria conectorului (cei cu 4 sau 5 segmente se apropie de cel cu 3). */
/** La deschidere: adj1 al conectorului cu două coturi (val 50000 = la jumătate). */
export function bendOf(prstGeom: Element | null | undefined): { bend?: number } {
  if (!/Connector3$/.test(prstGeom?.getAttribute('prst') ?? '')) return {};
  const gd = [...(prstGeom!.getElementsByTagName('*') as unknown as Element[])].find((n) => n.localName === 'gd' && n.getAttribute('name') === 'adj1');
  const v = /^val\s+(-?[0-9]+)$/.exec(gd?.getAttribute('fmla')?.trim() ?? '');
  if (!v) return {};
  const b = Math.round(Math.min(1, Math.max(0, +v[1] / 100000)) * 1000) / 1000;
  return b === 0.5 ? {} : { bend: b };
}

export const routeOf = (prst: string | null | undefined): LineRoute | undefined =>
  prst?.startsWith('bentConnector') ? 'elbow' : prst?.startsWith('curvedConnector') ? 'curve' : undefined;

/**
 * Formele ale căror puncte de conexiune din .pptx sunt cele 4 de aici (0 sus, 1 stânga, 2 jos, 3 dreapta): dreptunghiurile,
 * casetele, rombul (colțurile lui sunt chiar mijloacele laturilor casetei) și formele de schemă cu vârfuri sau laturi acolo
 * (decizie, pregătire, cartelă, conector în altă pagină).
 */
const RECT_SITES = new Set(['rect', 'round', 'diamond', 'flowChartDecision', 'flowChartPreparation', 'flowChartPunchedCard', 'flowChartOffpageConnector']);
export const rectSites = (e: SlideEl) => !isLine(e) && (e.kind !== 'shape' || RECT_SITES.has(e.shape ?? 'rect') || !!quadOf(e));

/** Elipsa în .pptx: 8 puncte, de sus spre stânga (0 sus, 1 stânga-sus, 2 stânga, … 7 dreapta-sus); al nostru idx → al lor. */
const ELLIPSE_PPTX = [0, 2, 4, 6, 1, 3, 5, 7];
/** Triunghiurile în .pptx: 0 vârful, 1 latura stângă, 2 colțul stânga-jos, 3 mijlocul bazei, 4 colțul dreapta-jos, 5 latura dreaptă. */
const TRI_PPTX = [0, 1, 3, 5, 2, 4];

/** Numărul punctului în .pptx (null = forma nu are acolo un punct de conexiune). */
export function pptxSite(e: SlideEl, idx: number): number | null {
  if (isEllipse(e)) return ELLIPSE_PPTX[idx] ?? null;
  if (isTri(e)) return TRI_PPTX[idx] ?? null;
  const pts = pointsOf(e);
  if (pts) return idx >= 0 && idx < pts.length ? idx : null;
  return rectSites(e) && idx >= 0 && idx <= 3 ? idx : null;
}

/** Invers: punctul din .pptx → al nostru. */
export function siteFromPptx(e: SlideEl, idx: number): number | null {
  if (isEllipse(e)) { const i = ELLIPSE_PPTX.indexOf(idx); return i < 0 ? null : i; }
  if (isTri(e)) { const i = TRI_PPTX.indexOf(idx); return i < 0 ? null : i; }
  const pts = pointsOf(e);
  if (pts) return idx >= 0 && idx < pts.length ? idx : null;
  return rectSites(e) && idx >= 0 && idx <= 3 ? idx : null;
}

/**
 * .pptx: liniile lipite se scriu ca p:cxnSp, cu a:stCxn / a:endCxn spre numărul (cNvPr id) formei; biblioteca le scrie ca p:sp
 * cu numele „el-<id>”. Legăturile spre forme care nu sunt în slide sau nu au punctele de aici se lasă afară.
 */
export function cxnXml(xml: string, els: SlideEl[]): string {
  const spid = (id: string) => {
    const at = xml.indexOf(`name="el-${id}"`);
    const tag = at < 0 ? -1 : xml.lastIndexOf('<p:cNvPr', at);
    return tag < 0 ? null : /id="([0-9]+)"/.exec(xml.slice(tag, at))?.[1] ?? null;
  };
  const by = new Map(els.map((e) => [e.id, e]));
  for (const e of els) {
    if (!isLine(e) || (!e.stCxn && !e.endCxn)) continue;
    const ref = (tag: string, c?: Cxn) => {
      const t = c && by.get(c.id), i = t ? pptxSite(t, c!.idx) : null, n = i !== null ? spid(c!.id) : null;
      return n ? `<a:${tag} id="${n}" idx="${i}"/>` : '';
    };
    const links = ref('stCxn', e.stCxn) + ref('endCxn', e.endCxn);
    const at = xml.indexOf(`name="el-${e.id}"`);
    const s = at < 0 ? -1 : xml.lastIndexOf('<p:sp>', at), end = at < 0 ? -1 : xml.indexOf('</p:sp>', at);
    if (!links || s < 0 || end < 0) continue;
    let seg = xml.slice(s, end + '</p:sp>'.length);
    const c0 = seg.indexOf('<p:cNvSpPr');
    if (c0 < 0) continue;
    const c1 = seg.startsWith('<p:cNvSpPr/>', c0) ? c0 + '<p:cNvSpPr/>'.length : seg.indexOf('</p:cNvSpPr>', c0) + '</p:cNvSpPr>'.length;
    seg = seg.slice(0, c0) + `<p:cNvCxnSpPr>${links}</p:cNvCxnSpPr>` + seg.slice(c1);
    // Conectorul nu are text.
    const t0 = seg.indexOf('<p:txBody>'), t1 = seg.indexOf('</p:txBody>');
    if (t0 >= 0 && t1 > t0) seg = seg.slice(0, t0) + seg.slice(t1 + '</p:txBody>'.length);
    seg = '<p:cxnSp>' + seg.slice('<p:sp>'.length, seg.length - '</p:sp>'.length).replace('<p:nvSpPr>', '<p:nvCxnSpPr>').replace('</p:nvSpPr>', '</p:nvCxnSpPr>') + '</p:cxnSp>';
    xml = xml.slice(0, s) + seg + xml.slice(end + '</p:sp>'.length);
  }
  return xml;
}

/** La deschiderea unui .pptx: legăturile citite cu numărul formei („#7”) devin id-urile noastre; restul se scot. */
export function linkImported(els: SlideEl[], bySpid: Map<string, SlideEl>): void {
  for (const e of els) {
    for (const k of ['stCxn', 'endCxn'] as const) {
      const c = e[k];
      if (!c) continue;
      const t = c.id.startsWith('#') ? bySpid.get(c.id.slice(1)) : undefined, i = t && t !== e ? siteFromPptx(t, c.idx) : null;
      if (t && i !== null) e[k] = { id: t.id, idx: i };
      else delete e[k];
    }
  }
}
