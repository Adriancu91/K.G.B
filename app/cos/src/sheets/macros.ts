// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Vizualizare → Macrocomenzi (ca View / Record Macros): pașii făcuți în foaie (valori, formule, formatare) se înregistrează
// și se repetă mai târziu cu un clic. Fiecare pas e diferența dintre foaia de dinainte și cea de după, ținută față de celula
// în care a pornit înregistrarea: cu „referințe relative” pașii se repetă de la celula aleasă acum (formulele se mută la fel
// ca la copiere), altfel exact în aceleași celule. Formatarea se ține ca proprietăți schimbate (aldin pus, culoare scoasă),
// deci la redare se adaugă peste formatarea celulei, nu o înlocuiește. Fără cod: nu se poate rula nimic altceva decât
// aceste schimbări. Testat în tests/sheets-macros.test.mjs.

import { cellId, colName, FILTER_OPS, parseCellId, type CellStyle, type FilterColor, type FilterCond, type SheetFilter } from './format';
import { shiftFormula } from './formula';
import type { SortKey } from './sort';

/**
 * Sortare înregistrată: tabelul care începe în celula `at` („dr,dc” față de start sau „A1”), după coloanele din `levels`
 * (col = a câta coloană din tabel, de la 0). Fără `size`, la rulare se sortează tot tabelul din jurul celulei (cu rândurile
 * adăugate între timp); cu `size` (zona aleasă de mână), exact atâtea rânduri și coloane.
 */
export interface MacroSort { at: string; head: boolean; levels: SortKey[]; size?: { h: number; w: number } }

/**
 * Filtrul înregistrat: capul de tabel în celula `at` („dr,dc” față de start sau „A1”), pe `w` + 1 coloane, cu valorile
 * debifate, condițiile și culorile pe coloane ținute după a câta coloană din filtru („0”, „1”…). `off` = filtrul oprit.
 */
export interface MacroFilter {
  off?: boolean;
  at?: string;
  w?: number;
  hidden?: Record<string, string[]>;
  cond?: Record<string, FilterCond>;
  color?: Record<string, FilterColor>;
}

/** Un pas: celulele schimbate („dr,dc” față de celula de start, sau „A1” la referințe absolute). */
export interface MacroStep {
  /** Valoarea nouă a celulei ('' = golită). */
  cells?: Record<string, string>;
  /** Proprietățile de format schimbate; null = scoasă. */
  styles?: Record<string, Record<string, unknown>>;
  /** Rânduri / coloane întregi inserate (n > 0) sau șterse (n < 0) de la `at` (față de celula de start, la referințe relative). */
  ins?: { axis: 'r' | 'c'; at: number; n: number };
  /** Sortarea unui tabel: la rulare se sortează datele de atunci (nu se scriu valorile de la înregistrare). */
  sort?: MacroSort;
  /** Filtrul pus, schimbat sau oprit: la rulare se pune același filtru pe tabelul de acolo (rândurile se ascund după datele de atunci). */
  filt?: MacroFilter;
  /** Așezarea: lățimea coloanelor, înălțimea rândurilor (null = cea obișnuită) și rândurile / coloanele ascunse (true) sau arătate. */
  lay?: MacroLayout;
}

/**
 * Schimbările de așezare, pe rânduri și coloane: cheia e a câta coloană / rând față de celula de start (la referințe relative)
 * sau numărul lor de la 0 (la absolute).
 */
export interface MacroLayout {
  colW?: Record<string, number | null>;
  rowH?: Record<string, number | null>;
  hideR?: Record<string, boolean>;
  hideC?: Record<string, boolean>;
}
/** Partea din foaie pe care o atinge pasul de așezare. */
export interface SheetLayout { colW: Record<string, number>; rowH?: Record<string, number>; hideRows?: number[]; hideCols?: number[] }

const colIndex = (n: string) => { let c = 0; for (const ch of n) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };

/** Pasul de așezare dintre două stări ale foii, sau null dacă lățimile, înălțimile și ce e ascuns au rămas la fel. */
export function layoutStep(before: SheetLayout, after: SheetLayout, from: { r: number; c: number }, rel: boolean): MacroStep | null {
  const key = (i: number, axis: 'r' | 'c') => String(rel ? i - (axis === 'r' ? from.r : from.c) : i);
  const lay: MacroLayout = {};
  const sizes = (a: Record<string, number> | undefined, b: Record<string, number> | undefined, idx: (k: string) => number, axis: 'r' | 'c') => {
    const out: Record<string, number | null> = {};
    for (const k of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
      if (a?.[k] === b?.[k]) continue;
      const i = idx(k);
      if (i >= 0) out[key(i, axis)] = b?.[k] ?? null;
    }
    return Object.keys(out).length ? out : undefined;
  };
  const hid = (a: number[] | undefined, b: number[] | undefined, axis: 'r' | 'c') => {
    const A = new Set(a ?? []), Bs = new Set(b ?? []);
    const out: Record<string, boolean> = {};
    for (const n of new Set([...A, ...Bs])) if (A.has(n) !== Bs.has(n)) out[key(n - 1, axis)] = Bs.has(n);
    return Object.keys(out).length ? out : undefined;
  };
  const colW = sizes(before.colW, after.colW, (k) => (/^[A-Z]{1,3}$/.test(k) ? colIndex(k) : -1), 'c');
  const rowH = sizes(before.rowH, after.rowH, (k) => (/^\d+$/.test(k) ? +k - 1 : -1), 'r');
  const hideR = hid(before.hideRows, after.hideRows, 'r'), hideC = hid(before.hideCols, after.hideCols, 'c');
  if (colW) lay.colW = colW;
  if (rowH) lay.rowH = rowH;
  if (hideR) lay.hideR = hideR;
  if (hideC) lay.hideC = hideC;
  return Object.keys(lay).length ? { lay } : null;
}

/** Așezarea foii după pasul de rulat de la celula `at`, plus câte schimbări ar fi ieșit din foaie (și au fost sărite). */
export function runLayout(m: SheetMacro, lay: MacroLayout, sheet: SheetLayout, at: { r: number; c: number }): SheetLayout & { outside: number } {
  let outside = 0;
  const idx = (k: string, axis: 'r' | 'c') => {
    const i = (m.rel ? (axis === 'r' ? at.r : at.c) : 0) + +k;
    if (i < 0 || i > (axis === 'r' ? 1048575 : 16383)) { outside++; return -1; }
    return i;
  };
  const colW = { ...sheet.colW };
  for (const [k, v] of Object.entries(lay.colW ?? {})) { const c = idx(k, 'c'); if (c < 0) continue; if (v === null) delete colW[colName(c)]; else colW[colName(c)] = v; }
  const rowH = { ...sheet.rowH };
  for (const [k, v] of Object.entries(lay.rowH ?? {})) { const r = idx(k, 'r'); if (r < 0) continue; if (v === null) delete rowH[String(r + 1)]; else rowH[String(r + 1)] = v; }
  const hide = (list: number[] | undefined, ch: Record<string, boolean> | undefined, axis: 'r' | 'c') => {
    const set = new Set(list ?? []);
    for (const [k, v] of Object.entries(ch ?? {})) { const i = idx(k, axis); if (i < 0) continue; if (v) set.add(i + 1); else set.delete(i + 1); }
    return [...set].sort((a, b) => a - b);
  };
  const hideRows = hide(sheet.hideRows, lay.hideR, 'r'), hideCols = hide(sheet.hideCols, lay.hideC, 'c');
  return { colW, ...(Object.keys(rowH).length ? { rowH } : {}), ...(hideRows.length ? { hideRows } : {}), ...(hideCols.length ? { hideCols } : {}), outside };
}

/** Pasul de filtru dintre două stări ale filtrului foii, sau null dacă nu s-a schimbat (ori ar ieși din foaie față de start). */
export function filterStep(before: SheetFilter | undefined, after: SheetFilter | undefined, from: { r: number; c: number }, rel: boolean): MacroStep | null {
  if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) return null;
  if (!after) return before ? { filt: { off: true } } : null;
  const at = keyOf(cellId(after.r, after.c0), from, rel);
  if (at === null) return null;
  const byOff = <T,>(o: Record<string, T> | undefined) => {
    const out: Record<string, T> = {};
    for (let c = after.c0; c <= after.c1; c++) if (o?.[colName(c)] !== undefined) out[String(c - after.c0)] = o[colName(c)];
    return Object.keys(out).length ? out : undefined;
  };
  const hidden = byOff(after.hidden), cond = byOff(after.cond), color = byOff(after.color);
  return { filt: { at, w: after.c1 - after.c0, ...(hidden ? { hidden } : {}), ...(cond ? { cond } : {}), ...(color ? { color } : {}) } };
}

/** Filtrul de pus la rulare (de la celula `at`), null = oprit, sau 'out' dacă ar ieși din foaie. */
export function filterAt(m: SheetMacro, ft: MacroFilter, at: { r: number; c: number }): SheetFilter | null | 'out' {
  if (ft.off) return null;
  const id = ft.at ? idOf(ft.at, at, m.rel) : null;
  const p = id ? parseCellId(id) : null;
  const w = ft.w ?? 0;
  if (!p || p.c + w > 16383) return 'out';
  const byCol = <T,>(o: Record<string, T> | undefined) => {
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(o ?? {})) { const i = +k; if (Number.isInteger(i) && i >= 0 && i <= w) out[colName(p.c + i)] = v; }
    return out;
  };
  const cond = byCol(ft.cond), color = byCol(ft.color);
  return { r: p.r, c0: p.c, c1: p.c + w, hidden: byCol(ft.hidden), ...(Object.keys(cond).length ? { cond } : {}), ...(Object.keys(color).length ? { color } : {}) };
}

/** Pasul de sortare pentru zona g (cu cap de tabel sau nu), sau null dacă zona iese din foaie față de start. */
export function sortStep(
  g: { r0: number; r1: number; c0: number; c1: number }, head: boolean, levels: SortKey[], picked: boolean,
  from: { r: number; c: number }, rel: boolean,
): MacroStep | null {
  const at = keyOf(cellId(g.r0, g.c0), from, rel);
  if (at === null || !levels.length) return null;
  const lv = levels.slice(0, 64).map((k) => ({ ...k, col: k.col - g.c0 }));
  return { sort: { at, head, levels: lv, ...(picked ? { size: { h: g.r1 - g.r0 + 1, w: g.c1 - g.c0 + 1 } } : {}) } };
}

/** Celula de la care pornește sortarea la rulare (rândul și coloana, de la 0), sau null dacă ar ieși din foaie. */
export function sortAt(m: SheetMacro, srt: MacroSort, at: { r: number; c: number }): { r: number; c: number } | null {
  const id = idOf(srt.at, at, m.rel);
  return id ? parseCellId(id) : null;
}

/** Pașii macrocomenzii, pe bucăți: celulele schimbate la rând (rulate cu runMacro) și inserările / ștergerile / sortările dintre ele. */
export function macroSegments(m: SheetMacro): ({ steps: MacroStep[] } | { ins: NonNullable<MacroStep['ins']> } | { sort: MacroSort } | { filt: MacroFilter } | { lay: MacroLayout })[] {
  const out: ({ steps: MacroStep[] } | { ins: NonNullable<MacroStep['ins']> } | { sort: MacroSort } | { filt: MacroFilter } | { lay: MacroLayout })[] = [];
  for (const st of m.steps) {
    if (st.ins) { out.push({ ins: st.ins }); continue; }
    if (st.sort) { out.push({ sort: st.sort }); continue; }
    if (st.filt) { out.push({ filt: st.filt }); continue; }
    if (st.lay) { out.push({ lay: st.lay }); continue; }
    const last = out[out.length - 1];
    if (last && 'steps' in last) last.steps.push(st); else out.push({ steps: [st] });
  }
  return out;
}

/** Unde se face inserarea / ștergerea la rulare (rândul sau coloana, de la 0), sau null dacă ar ieși din foaie. */
export function insAt(m: SheetMacro, ins: NonNullable<MacroStep['ins']>, at: { r: number; c: number }): number | null {
  const x = m.rel ? (ins.axis === 'r' ? at.r : at.c) + ins.at : ins.at;
  return x < 0 || x > (ins.axis === 'r' ? 1048575 : 16383) ? null : x;
}

export interface SheetMacro {
  name: string;
  /** Referințe relative: pașii se repetă de la celula aleasă la rulare. */
  rel: boolean;
  steps: MacroStep[];
  /** Celula în care a pornit înregistrarea (la referințe relative formulele se mută cu cât e celula de acum față de ea). */
  from: string;
  /** Descrierea scrisă de utilizator (opțională). */
  note?: string;
  /** Scurtătura Ctrl+Shift+literă (A–Z), opțională; are întâietate față de scurtătura obișnuită cu aceeași literă. */
  key?: string;
}

/** Macrocomanda pornită de Ctrl+Shift+tasta apăsată (după e.code, ca să meargă pe orice așezare a tastaturii). */
export function macroForKey(list: SheetMacro[] | undefined, code: string): SheetMacro | undefined {
  const m = /^Key([A-Z])$/.exec(code);
  return m ? list?.find((x) => x.key === m[1]) : undefined;
}

const MAX_STEPS = 500;
const MAX_CELLS = 20000;

const keyOf = (id: string, at: { r: number; c: number }, rel: boolean) => {
  if (!rel) return id;
  const p = parseCellId(id);
  return p ? `${p.r - at.r},${p.c - at.c}` : null;
};

/** Pasul dintre două stări ale foii, sau null dacă nu s-a schimbat nimic. */
export function diffStep(
  before: { cells: Record<string, string>; styles: Record<string, CellStyle> },
  after: { cells: Record<string, string>; styles: Record<string, CellStyle> },
  at: { r: number; c: number },
  rel: boolean,
): MacroStep | null {
  const cells: Record<string, string> = {};
  const styles: Record<string, Record<string, unknown>> = {};
  let n = 0;
  for (const id of new Set([...Object.keys(before.cells), ...Object.keys(after.cells)])) {
    const a = before.cells[id] ?? '', b = after.cells[id] ?? '';
    if (a === b) continue;
    const k = keyOf(id, at, rel);
    if (k === null) continue;
    cells[k] = b;
    n++;
  }
  for (const id of new Set([...Object.keys(before.styles), ...Object.keys(after.styles)])) {
    const a = (before.styles[id] ?? {}) as Record<string, unknown>, b = (after.styles[id] ?? {}) as Record<string, unknown>;
    const ch: Record<string, unknown> = {};
    for (const p of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (JSON.stringify(a[p]) === JSON.stringify(b[p])) continue;
      ch[p] = b[p] === undefined ? null : b[p];
    }
    if (!Object.keys(ch).length) continue;
    const k = keyOf(id, at, rel);
    if (k === null) continue;
    styles[k] = ch;
    n++;
  }
  if (!n || n > MAX_CELLS) return null;
  return { ...(Object.keys(cells).length ? { cells } : {}), ...(Object.keys(styles).length ? { styles } : {}) };
}

const idOf = (k: string, at: { r: number; c: number }, rel: boolean) => {
  if (!rel) return parseCellId(k) ? k : null;
  const m = /^(-?\d+),(-?\d+)$/.exec(k);
  if (!m) return null;
  const r = at.r + +m[1], c = at.c + +m[2];
  return r < 0 || c < 0 || r > 1048575 || c > 16383 ? null : cellId(r, c);
};

/** Rulează macrocomanda pe foaie de la celula `at`: celulele și formatele noi, plus câte celule n-au încăput (în afara foii). */
export function runMacro(
  m: SheetMacro,
  sheet: { cells: Record<string, string>; styles: Record<string, CellStyle> },
  at: { r: number; c: number },
): { cells: Record<string, string>; styles: Record<string, CellStyle>; outside: number } {
  const cells = { ...sheet.cells };
  const styles = { ...sheet.styles };
  let outside = 0;
  const f = parseCellId(m.from) ?? { r: 0, c: 0 };
  const dr = at.r - f.r, dc = at.c - f.c;
  for (const st of m.steps) {
    for (const [k, v] of Object.entries(st.cells ?? {})) {
      const id = idOf(k, at, m.rel);
      if (!id) { outside++; continue; }
      const val = m.rel && v.startsWith('=') && (dr || dc) ? shiftFormula(v, dr, dc) : v;
      if (val === '') delete cells[id]; else cells[id] = val;
    }
    for (const [k, ch] of Object.entries(st.styles ?? {})) {
      const id = idOf(k, at, m.rel);
      if (!id) { outside++; continue; }
      const s: Record<string, unknown> = { ...styles[id] };
      for (const [p, v] of Object.entries(ch)) { if (v === null) delete s[p]; else s[p] = v; }
      if (Object.keys(s).length) styles[id] = s as CellStyle; else delete styles[id];
    }
  }
  return { cells, styles, outside };
}

/** Pasul nou adăugat la înregistrare (cel mult 500). */
export function addStep(steps: MacroStep[], st: MacroStep): MacroStep[] {
  if (steps.length >= MAX_STEPS) return steps;
  return [...steps, st];
}

/** Câte celule atinge macrocomanda (pentru listă). */
export function macroSize(m: SheetMacro): number {
  const ks = new Set<string>();
  for (const st of m.steps) for (const k of [...Object.keys(st.cells ?? {}), ...Object.keys(st.styles ?? {})]) ks.add(k);
  // Inserările și ștergerile de rânduri / coloane nu ating celule anume, deci nu se numără aici.
  return ks.size;
}

/** Un nume bun și nefolosit: litere, cifre, spații, _ și -, cel mult 60. */
export function macroNameError(name: string, list: SheetMacro[], skip = -1): string | null {
  const t = name.trim();
  if (!t) return 'Scrie un nume pentru macrocomandă.';
  if (t.length > 60) return 'Numele e prea lung (cel mult 60 de litere).';
  if (list.some((m, i) => i !== skip && m.name.toLocaleLowerCase('ro-RO') === t.toLocaleLowerCase('ro-RO'))) return `Există deja o macrocomandă „${t}”.`;
  return null;
}

const cleanLayout = (v: unknown, rel: boolean): MacroLayout | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const okKey = (k: string) => (rel ? /^-?\d{1,7}$/ : /^\d{1,7}$/).test(k);
  const pick = <T,>(x: unknown, ok: (y: unknown) => y is T) => {
    const out: Record<string, T> = {};
    if (x && typeof x === 'object') for (const [k, y] of Object.entries(x as object).slice(0, 20000)) if (okKey(k) && ok(y)) out[k] = y;
    return Object.keys(out).length ? out : undefined;
  };
  const size = (y: unknown): y is number | null => y === null || (typeof y === 'number' && Number.isFinite(y) && y >= 0 && y <= 2000);
  const flag = (y: unknown): y is boolean => typeof y === 'boolean';
  const lay: MacroLayout = {};
  const colW = pick(o.colW, size), rowH = pick(o.rowH, size), hideR = pick(o.hideR, flag), hideC = pick(o.hideC, flag);
  if (colW) lay.colW = colW;
  if (rowH) lay.rowH = rowH;
  if (hideR) lay.hideR = hideR;
  if (hideC) lay.hideC = hideC;
  return Object.keys(lay).length ? lay : null;
};

const cleanFilter = (v: unknown, okKey: (k: string) => boolean): MacroFilter | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.off === true) return { off: true };
  if (typeof o.at !== 'string' || !okKey(o.at) || !Number.isInteger(o.w) || (o.w as number) < 0 || (o.w as number) > 25) return null;
  const w = o.w as number;
  const each = <T,>(x: unknown, ok: (y: Record<string, unknown> | unknown[]) => T | null) => {
    const out: Record<string, T> = {};
    if (x && typeof x === 'object') for (const [k, y] of Object.entries(x as object)) {
      if (!/^\d+$/.test(k) || +k > w || !y || typeof y !== 'object') continue;
      const t = ok(y as Record<string, unknown>);
      if (t !== null) out[k] = t;
    }
    return Object.keys(out).length ? out : undefined;
  };
  const hidden = each(o.hidden, (y) => (Array.isArray(y) ? y.filter((t): t is string => typeof t === 'string').slice(0, 5000).map((t) => t.slice(0, 500)) : null));
  const cond = each(o.cond, (y) => {
    const c = y as Record<string, unknown>;
    return FILTER_OPS.includes(c.op as never) && typeof c.v1 === 'string' ? { op: c.op as FilterCond['op'], v1: c.v1.slice(0, 500), ...(typeof c.v2 === 'string' ? { v2: c.v2.slice(0, 500) } : {}) } : null;
  });
  const color = each(o.color, (y) => {
    const c = y as Record<string, unknown>;
    return (c.kind === 'bg' || c.kind === 'fg') && typeof c.color === 'string' ? { kind: c.kind, color: c.color.slice(0, 40) } as FilterColor : null;
  });
  return { at: o.at, w, ...(hidden ? { hidden } : {}), ...(cond ? { cond } : {}), ...(color ? { color } : {}) };
};

const cleanSort = (v: unknown, okKey: (k: string) => boolean): MacroSort | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || !okKey(o.at) || !Array.isArray(o.levels)) return null;
  const levels: SortKey[] = [];
  for (const x of o.levels.slice(0, 64)) {
    const k = x as Record<string, unknown> | null;
    if (!k || typeof k !== 'object' || !Number.isInteger(k.col) || (k.col as number) < 0 || (k.col as number) > 16383) continue;
    const lv: SortKey = { col: k.col as number, desc: k.desc === true };
    if ((k.on === 'bg' || k.on === 'fg') && typeof k.color === 'string') { lv.on = k.on; lv.color = k.color.slice(0, 40); }
    if (Array.isArray(k.list)) lv.list = k.list.filter((t): t is string => typeof t === 'string').slice(0, 500).map((t) => t.slice(0, 200));
    levels.push(lv);
  }
  if (!levels.length) return null;
  const sz = o.size as Record<string, unknown> | undefined;
  const size = sz && Number.isInteger(sz.h) && Number.isInteger(sz.w) && (sz.h as number) >= 1 && (sz.w as number) >= 1 && (sz.h as number) <= 1048576 && (sz.w as number) <= 16384
    ? { h: sz.h as number, w: sz.w as number } : undefined;
  return { at: o.at, head: o.head === true, levels, ...(size ? { size } : {}) };
};

/** Macrocomenzile citite din fișier, curățate (fără chei sau valori ciudate). */
export function cleanMacros(v: unknown): SheetMacro[] {
  if (!Array.isArray(v)) return [];
  const out: SheetMacro[] = [];
  for (const x of v.slice(0, 100)) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, 60) : '';
    if (!name || out.some((m) => m.name === name)) continue;
    const rel = o.rel !== false;
    const okKey = (k: string) => (rel ? /^-?\d+,-?\d+$/.test(k) : !!parseCellId(k));
    const steps: MacroStep[] = [];
    for (const s of Array.isArray(o.steps) ? o.steps.slice(0, MAX_STEPS) : []) {
      if (!s || typeof s !== 'object') continue;
      const so = s as Record<string, unknown>;
      const cells: Record<string, string> = {};
      if (so.cells && typeof so.cells === 'object') for (const [k, val] of Object.entries(so.cells as object)) if (okKey(k) && typeof val === 'string') cells[k] = val;
      const styles: Record<string, Record<string, unknown>> = {};
      if (so.styles && typeof so.styles === 'object') for (const [k, val] of Object.entries(so.styles as object)) if (okKey(k) && val && typeof val === 'object' && !Array.isArray(val)) styles[k] = val as Record<string, unknown>;
      const ins = so.ins as Record<string, unknown> | undefined;
      if (ins && (ins.axis === 'r' || ins.axis === 'c') && Number.isInteger(ins.at) && Number.isInteger(ins.n) && ins.n !== 0 && Math.abs(ins.n as number) <= 100000 && Math.abs(ins.at as number) <= 1048576) {
        steps.push({ ins: { axis: ins.axis, at: ins.at as number, n: ins.n as number } });
        continue;
      }
      const srt = cleanSort(so.sort, okKey);
      if (srt) { steps.push({ sort: srt }); continue; }
      const ft = cleanFilter(so.filt, okKey);
      if (ft) { steps.push({ filt: ft }); continue; }
      const ly = cleanLayout(so.lay, rel);
      if (ly) { steps.push({ lay: ly }); continue; }
      if (Object.keys(cells).length || Object.keys(styles).length) steps.push({ ...(Object.keys(cells).length ? { cells } : {}), ...(Object.keys(styles).length ? { styles } : {}) });
    }
    if (!steps.length) continue;
    const from = typeof o.from === 'string' && parseCellId(o.from) ? o.from : 'A1';
    const key = typeof o.key === 'string' && /^[A-Z]$/.test(o.key) && !out.some((m) => m.key === o.key) ? o.key : undefined;
    out.push({ name, rel, steps, from, ...(typeof o.note === 'string' && o.note.trim() ? { note: o.note.trim().slice(0, 300) } : {}), ...(key ? { key } : {}) });
  }
  return out;
}
