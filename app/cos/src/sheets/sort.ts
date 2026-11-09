// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { CellStyle, cellId, COLS, isNumber, ROWS } from './format';
import type { Range } from './fill';
import { Result, shiftFormula } from './formula';
import { colorOf } from './filter';

type Cells = Record<string, string>;
type Styles = Record<string, CellStyle>;

/**
 * Zona de date din jurul celulei (r, c), ca în Excel: se extinde cât timp rândurile și coloanele
 * vecine au ceva scris. Întoarce null dacă nu e nimic în jur.
 */
export function currentRegion(cells: Cells, r: number, c: number): Range | null {
  const has = (rr: number, cc: number) => rr >= 0 && cc >= 0 && rr < ROWS && cc < COLS && !!cells[cellId(rr, cc)];
  const g: Range = { r0: r, r1: r, c0: c, c1: c };
  // Rândul rr are ceva între coloanele c0-1 și c1+1 (diagonala contează și ea, ca în Excel).
  const rowHas = (rr: number, pad = 1) => { for (let cc = g.c0 - pad; cc <= g.c1 + pad; cc++) if (has(rr, cc)) return true; return false; };
  const colHas = (cc: number, pad = 1) => { for (let rr = g.r0 - pad; rr <= g.r1 + pad; rr++) if (has(rr, cc)) return true; return false; };
  for (let grew = true; grew;) {
    grew = false;
    if (g.r0 > 0 && rowHas(g.r0 - 1)) { g.r0--; grew = true; }
    if (g.r1 < ROWS - 1 && rowHas(g.r1 + 1)) { g.r1++; grew = true; }
    if (g.c0 > 0 && colHas(g.c0 - 1)) { g.c0--; grew = true; }
    if (g.c1 < COLS - 1 && colHas(g.c1 + 1)) { g.c1++; grew = true; }
  }
  // Rândurile/coloanele goale de la margine nu fac parte din zonă.
  while (g.r1 > g.r0 && !rowHas(g.r1, 0)) g.r1--;
  while (g.r0 < g.r1 && !rowHas(g.r0, 0)) g.r0++;
  while (g.c1 > g.c0 && !colHas(g.c1, 0)) g.c1--;
  while (g.c0 < g.c1 && !colHas(g.c0, 0)) g.c0++;
  return rowHas(g.r0, 0) ? g : null;
}

/** Valoarea după care se sortează: număr, text sau nimic (celulă goală). */
function keyOf(raw: string | undefined, res: Result | undefined): number | string | null {
  if (res) {
    if (res.err) return res.err;
    if (res.value !== undefined && res.num) return res.value;
    return res.text === '' ? null : res.text;
  }
  if (!raw) return null;
  if (isNumber(raw)) return Number(raw.trim().replace(',', '.'));
  return raw;
}

/**
 * Primul rând e cap de tabel dacă are doar texte, iar în coloanele de sub el apar numere
 * sau dacă e scris îngroșat (ca „Nume | Preț | Cantitate”).
 */
export function hasHeader(cells: Cells, styles: Styles, results: Record<string, Result>, g: Range): boolean {
  if (g.r1 <= g.r0) return false;
  let texts = 0;
  let bold = true;
  for (let c = g.c0; c <= g.c1; c++) {
    const id = cellId(g.r0, c);
    const k = keyOf(cells[id], results[id]);
    if (k === null) continue;
    if (typeof k === 'number') return false;
    texts++;
    if (!styles[id]?.b) bold = false;
  }
  if (!texts) return false;
  if (bold) return true;
  for (let c = g.c0; c <= g.c1; c++) {
    for (let r = g.r0 + 1; r <= g.r1; r++) {
      const id = cellId(r, c);
      if (typeof keyOf(cells[id], results[id]) === 'number') return true;
    }
  }
  return false;
}

const collator = new Intl.Collator('ro', { sensitivity: 'base', numeric: true });

/** Compară două valori: numerele înaintea textelor; celulele goale rămân mereu la final. */
function compare(a: number | string | null, b: number | string | null, desc: boolean): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  let d: number;
  if (typeof a === 'number' && typeof b === 'number') d = a - b;
  else if (typeof a === 'number') d = -1;
  else if (typeof b === 'number') d = 1;
  else d = collator.compare(a, b);
  return desc ? -d : d;
}

/**
 * Sortează rândurile zonei g după coloana col. Rândurile se mută întregi (conținut și formatare),
 * iar formulele își mută referințele relative odată cu rândul, ca în Excel.
 * Întoarce celulele și formatarea noi (doar zona g se schimbă).
 */
export function sortRange(
  cells: Cells, styles: Styles, results: Record<string, Result>, g: Range, col: number, desc: boolean,
): { cells: Cells; styles: Styles } {
  return sortRangeBy(cells, styles, results, g, [{ col, desc }]);
}

/**
 * Un nivel de sortare: coloana și sensul (ca un rând din fereastra Sortare din Excel).
 * Cu `on` = „bg” / „fg”, rândurile cu celula de culoarea `color` (fundal / text) merg sus, iar cu `desc` jos.
 * Cu `list` (de exemplu luni … duminică), valorile merg în ordinea listei (cu `desc`, invers); cele care nu sunt în listă, la final.
 */
export interface SortKey { col: number; desc: boolean; on?: 'bg' | 'fg'; color?: string; list?: string[] }

const plain = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Sortează după mai multe coloane: a doua decide doar între rândurile egale la prima, și așa mai departe. */
export function sortRangeBy(
  cells: Cells, styles: Styles, results: Record<string, Result>, g: Range, levels: SortKey[],
): { cells: Cells; styles: Styles } {
  const rows: number[] = [];
  for (let r = g.r0; r <= g.r1; r++) rows.push(r);
  const keyAt = (r: number, k: SortKey) => {
    const id = cellId(r, k.col);
    if (k.on) return colorOf(styles[id], k.on) === (k.color ?? 'none') ? 0 : 1;
    const v = keyOf(cells[id], results[id]);
    if (!k.list || v === null) return v;
    const i = k.list.findIndex((x) => plain(x) === plain(String(v)));
    return i < 0 ? k.list.length : k.desc ? k.list.length - 1 - i : i;
  };
  const keys = new Map(rows.map((r) => [r, levels.map((k) => keyAt(r, k))]));
  // Sortarea e stabilă: rândurile cu aceleași valori își păstrează ordinea.
  const order = [...rows].sort((a, b) => {
    const ka = keys.get(a)!, kb = keys.get(b)!;
    for (let i = 0; i < levels.length; i++) {
      const d = compare(ka[i], kb[i], levels[i].desc && !levels[i].list);
      if (d) return d;
    }
    return a - b;
  });
  const nextCells = { ...cells };
  const nextStyles = { ...styles };
  order.forEach((from, i) => {
    const to = g.r0 + i;
    for (let c = g.c0; c <= g.c1; c++) {
      const src = cellId(from, c);
      const dst = cellId(to, c);
      const v = cells[src];
      if (v) nextCells[dst] = shiftFormula(v, to - from, 0); else delete nextCells[dst];
      if (styles[src]) nextStyles[dst] = styles[src]; else delete nextStyles[dst];
    }
  });
  return { cells: nextCells, styles: nextStyles };
}
