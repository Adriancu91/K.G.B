// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { cellId, COLS, isNumber, parseCellId, ROWS } from './format';
import type { Range } from './fill';

// Mergi la special (ca Go To Special din Excel): selectează dintr-odată toate celulele de un anumit fel,
// de exemplu celulele goale dintr-un tabel (ca să le umpli), toate formulele (ca să le colorezi) sau celulele cu note.

export type SpecialKind = 'blanks' | 'constants' | 'formulas' | 'notes' | 'region' | 'last' | 'visible' | 'cond' | 'valid';
/** Felurile de valori, la Constante și Formule: numere, text, ADEVĂRAT / FALS, erori. */
export type ValueType = 'num' | 'text' | 'bool' | 'err';

export const SPECIAL_KINDS: [SpecialKind, string][] = [
  ['blanks', 'Celulele goale'],
  ['constants', 'Valorile scrise (fără formule)'],
  ['formulas', 'Formulele'],
  ['notes', 'Celulele cu note'],
  ['region', 'Tabelul din jurul celulei (zona curentă)'],
  ['last', 'Ultima celulă folosită'],
  ['visible', 'Doar celulele vizibile (fără rândurile și coloanele ascunse)'],
  ['cond', 'Celulele cu formatare condiționată'],
  ['valid', 'Celulele cu validare / listă derulantă'],
];
export const VALUE_TYPES: [ValueType, string][] = [['num', 'Numere'], ['text', 'Text'], ['bool', 'ADEVĂRAT / FALS'], ['err', 'Erori']];

export interface SpecialCtx {
  cells: Record<string, string>;
  /** Rezultatele formulelor (pentru felul valorii: număr, text, eroare). */
  results: Record<string, { text: string; num: boolean; err?: string }>;
  styles: Record<string, { note?: string }>;
  rules?: { range: string }[];
  lists?: { range: string }[];
  hiddenRows: Set<number>;
  hiddenCols: Set<number>;
  /** Zonele selectate; dacă e una singură, de o celulă, se caută în toată foaia. */
  sel: Range[];
  /** Celula activă (pentru zona curentă). */
  at: { r: number; c: number };
  /** Zona curentă din jurul unei celule (vezi sort.ts). */
  region(r: number, c: number): Range | null;
}

const BOOL = /^(TRUE|FALSE|ADEVĂRAT|ADEVARAT|FALS)$/i;

/** Felul valorii unei celule: din formulă se ia rezultatul, altfel ce e scris. */
function typeOf(raw: string, res: { text: string; num: boolean; err?: string } | undefined): ValueType {
  if (raw.startsWith('=')) {
    if (res?.err) return 'err';
    if (res?.num) return 'num';
    return res && BOOL.test(res.text) ? 'bool' : 'text';
  }
  if (/^#(N\/A|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|NULL!|SPILL!|CALC!)$/i.test(raw.trim())) return 'err';
  if (BOOL.test(raw.trim())) return 'bool';
  return res?.num || isNumber(raw) ? 'num' : 'text';
}

/** O zonă scrisă („B2:C9”, „B2”) ca dreptunghi; null dacă nu se poate citi. */
export function areaOf(t: string): Range | null {
  const [a, b] = t.replace(/\$/g, '').toUpperCase().split(':');
  const p = parseCellId(a), q = parseCellId(b ?? a);
  if (!p || !q) return null;
  return { r0: Math.min(p.r, q.r), c0: Math.min(p.c, q.c), r1: Math.min(ROWS - 1, Math.max(p.r, q.r)), c1: Math.min(COLS - 1, Math.max(p.c, q.c)) };
}

const cut = (a: Range, b: Range): Range | null => {
  const g = { r0: Math.max(a.r0, b.r0), c0: Math.max(a.c0, b.c0), r1: Math.min(a.r1, b.r1), c1: Math.min(a.c1, b.c1) };
  return g.r0 <= g.r1 && g.c0 <= g.c1 ? g : null;
};

/** Celulele găsite (perechi rând, coloană) strânse în cât mai puține dreptunghiuri: bucăți pe rând, lipite pe verticală. */
export function packCells(list: { r: number; c: number }[]): Range[] {
  const rows = new Map<number, number[]>();
  for (const { r, c } of list) { const a = rows.get(r); if (a) a.push(c); else rows.set(r, [c]); }
  const out: Range[] = [];
  // Bucățile deschise de pe rândul de deasupra, după „c0:c1”, ca să crească în jos.
  let open = new Map<string, Range>();
  for (const r of [...rows.keys()].sort((a, b) => a - b)) {
    const cs = [...new Set(rows.get(r)!)].sort((a, b) => a - b);
    const next = new Map<string, Range>();
    for (let i = 0; i < cs.length; ) {
      let j = i;
      while (j + 1 < cs.length && cs[j + 1] === cs[j] + 1) j++;
      const k = `${cs[i]}:${cs[j]}`, prev = open.get(k);
      if (prev && prev.r1 === r - 1) { prev.r1 = r; next.set(k, prev); }
      else { const g = { r0: r, c0: cs[i], r1: r, c1: cs[j] }; out.push(g); next.set(k, g); }
      i = j + 1;
    }
    open = next;
  }
  return out;
}

/** Zonele de selectat pentru „Mergi la special”; o listă goală înseamnă că nu s-a găsit nimic. */
export function gotoSpecial(kind: SpecialKind, types: ValueType[], x: SpecialCtx): Range[] {
  // Partea folosită a foii: de la A1 până la ultimul rând și ultima coloană cu ceva în ele.
  let lr = -1, lc = -1;
  for (const id of Object.keys(x.cells)) {
    if (x.cells[id] === '') continue;
    const p = parseCellId(id);
    if (p) { lr = Math.max(lr, p.r); lc = Math.max(lc, p.c); }
  }
  if (kind === 'last') return lr < 0 ? [] : [{ r0: lr, c0: lc, r1: lr, c1: lc }];
  if (kind === 'region') { const g = x.region(x.at.r, x.at.c); return [g ?? { r0: x.at.r, c0: x.at.c, r1: x.at.r, c1: x.at.c }]; }
  const one = x.sel.length === 1 && x.sel[0].r0 === x.sel[0].r1 && x.sel[0].c0 === x.sel[0].c1;
  const used: Range | null = lr < 0 ? null : { r0: 0, c0: 0, r1: lr, c1: lc };
  const scope: Range[] = one ? (used ? [used] : []) : x.sel;
  if (kind === 'cond' || kind === 'valid') {
    const areas = ((kind === 'cond' ? x.rules : x.lists) ?? []).map((l) => areaOf(l.range)).filter((g): g is Range => !!g);
    if (one) return areas;
    const out: Range[] = [];
    for (const a of areas) for (const s of scope) { const g = cut(a, s); if (g) out.push(g); }
    return out;
  }
  if (kind === 'visible') {
    const runs: Range[] = [];
    for (const s of scope) {
      // Bucăți de rânduri vizibile × bucăți de coloane vizibile.
      const seg = (a: number, b: number, hid: Set<number>) => {
        const r: [number, number][] = [];
        for (let i = a; i <= b; i++) {
          if (hid.has(i)) continue;
          if (r.length && r[r.length - 1][1] === i - 1) r[r.length - 1][1] = i; else r.push([i, i]);
        }
        return r;
      };
      for (const [r0, r1] of seg(s.r0, s.r1, x.hiddenRows)) for (const [c0, c1] of seg(s.c0, s.c1, x.hiddenCols)) runs.push({ r0, c0, r1, c1 });
    }
    return runs;
  }
  const want = new Set(types.length ? types : (['num', 'text', 'bool', 'err'] as ValueType[]));
  const found: { r: number; c: number }[] = [];
  if (kind === 'blanks') {
    for (const s of scope) {
      const g = used ? cut(s, one ? used : s) : one ? null : s;
      if (!g) continue;
      // Pe o zonă uriașă (coloane întregi) se caută doar până la ultimul rând folosit.
      const r1 = Math.min(g.r1, Math.max(lr, g.r0)), c1 = Math.min(g.c1, Math.max(lc, g.c0));
      for (let r = g.r0; r <= r1; r++) for (let c = g.c0; c <= c1; c++) if (!x.cells[cellId(r, c)]) found.push({ r, c });
    }
    return packCells(found);
  }
  for (const id of Object.keys(x.cells)) {
    const raw = x.cells[id];
    const p = parseCellId(id);
    if (!p || !scope.some((s) => p.r >= s.r0 && p.r <= s.r1 && p.c >= s.c0 && p.c <= s.c1)) continue;
    if (kind === 'notes') { if (x.styles[id]?.note) found.push(p); continue; }
    if (raw === '' || raw === undefined) continue;
    const isF = raw.startsWith('=');
    if ((kind === 'formulas') !== isF) continue;
    if (want.has(typeOf(raw, x.results[id]))) found.push(p);
  }
  // Notele pot sta și pe celule goale.
  if (kind === 'notes') {
    for (const id of Object.keys(x.styles)) {
      if (!x.styles[id]?.note || x.cells[id]) continue;
      const p = parseCellId(id);
      if (p && (one || scope.some((s) => p.r >= s.r0 && p.r <= s.r1 && p.c >= s.c0 && p.c <= s.c1))) found.push(p);
    }
  }
  return packCells(found);
}
