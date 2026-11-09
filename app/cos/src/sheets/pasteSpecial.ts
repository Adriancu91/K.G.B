// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Lipire specială (Ctrl+Alt+V), ca în Excel: doar valorile, doar formulele, doar formatarea,
// transpunere (rândurile devin coloane), operații cu ce e deja în celule și sărirea celulelor goale.
import { CellStyle, cellId, COLS, isNumber, ROWS } from './format';

export type PasteWhat = 'all' | 'values' | 'formulas' | 'formats' | 'valfmt';
export type PasteOp = 'none' | 'add' | 'sub' | 'mul' | 'div';

export const PASTE_WHAT: [PasteWhat, string][] = [
  ['all', 'Tot (formule și formatare)'],
  ['values', 'Doar valorile (rezultatele formulelor, fără formatare)'],
  ['valfmt', 'Valorile și formatarea'],
  ['formulas', 'Doar formulele (fără formatare)'],
  ['formats', 'Doar formatarea'],
];
export const PASTE_OPS: [PasteOp, string][] = [
  ['none', 'Niciuna'],
  ['add', 'Adună'],
  ['sub', 'Scade'],
  ['mul', 'Înmulțește'],
  ['div', 'Împarte'],
];

export interface PasteOpts { what: PasteWhat; op: PasteOp; transpose: boolean; skipBlanks: boolean }

/** Ce s-a copiat din Suite: textul scris în celule, valorile afișate (ca numere simple) și formatarea. */
export interface PasteSource {
  r: number;
  c: number;
  raw: string[][];
  values: string[][];
  styles: (CellStyle | undefined)[][];
}

export interface PasteTarget {
  /** Textul scris acum în celulă. */
  raw(id: string): string;
  /** Valoarea numerică a celulei (și pentru formule), sau null. */
  num(id: string): number | null;
  style(id: string): CellStyle | undefined;
  shift(formula: string, dr: number, dc: number): string;
}

const toNum = (s: string) => (isNumber(s) ? Number(s.trim().replace(',', '.')) : null);
const round = (x: number) => Number(x.toPrecision(15));

export function pasteSpecial(src: PasteSource, at: { r: number; c: number }, o: PasteOpts, t: PasteTarget):
  { cells: Record<string, string>; styles: Record<string, CellStyle> } {
  const cells: Record<string, string> = {};
  const styles: Record<string, CellStyle> = {};
  src.raw.forEach((line, i) => line.forEach((rawSrc, j) => {
    const r = at.r + (o.transpose ? j : i);
    const c = at.c + (o.transpose ? i : j);
    if (r >= ROWS || c >= COLS) return;
    const id = cellId(r, c);
    if (o.skipBlanks && rawSrc === '') return;
    if (o.what === 'all' || o.what === 'formats' || o.what === 'valfmt') styles[id] = { ...(src.styles[i]?.[j] ?? {}) };
    if (o.what === 'formats') return;
    let v = o.what === 'values' || o.what === 'valfmt'
      ? src.values[i][j]
      : rawSrc.startsWith('=') ? t.shift(rawSrc, r - (src.r + i), c - (src.c + j)) : rawSrc;
    if (o.op !== 'none') {
      // Cu o operație: se lucrează doar cu numere; celulele goale din sursă nu schimbă nimic.
      if (src.values[i][j] === '') return;
      // Peste un text, operația nu schimbă nimic; un text din sursă se lipește ca atare.
      const a = t.num(id) ?? (t.raw(id) === '' ? 0 : null);
      const b = toNum(src.values[i][j]);
      if (a === null) return;
      if (b !== null) {
        if (o.op === 'div' && b === 0) v = '#DIV/0!';
        else v = String(round(o.op === 'add' ? a + b : o.op === 'sub' ? a - b : o.op === 'mul' ? a * b : a / b));
      }
    }
    cells[id] = v;
  }));
  return { cells, styles };
}
