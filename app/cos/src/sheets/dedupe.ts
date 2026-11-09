// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Eliminare dubluri (Date → Remove Duplicates din Excel): din zona g rămâne doar primul rând
// cu aceleași valori în coloanele alese; rândurile rămase urcă, iar jos zona se golește.
import { CellStyle, cellId } from './format';
import { Range } from './fill';
import { Result, shiftFormula } from './formula';

type Cells = Record<string, string>;
type Styles = Record<string, CellStyle>;

/** Valoarea după care se compară: ce se vede în celulă, fără spații la capete, cu litere mici (ca în Excel, „Ana” = „ana”). */
function keyOf(raw: string | undefined, res: Result | undefined): string {
  if (!raw) return '';
  if (raw.startsWith('=')) return res ? (res.num && res.value !== undefined ? String(res.value) : res.text.trim().toLowerCase()) : raw;
  const t = raw.trim();
  const n = /^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(t) ? Number(t.replace(',', '.')) : NaN;
  return Number.isNaN(n) ? t.toLowerCase() : String(n);
}

export function removeDuplicates(
  cells: Cells, styles: Styles, results: Record<string, Result>, g: Range, cols: number[],
): { cells: Cells; styles: Styles; removed: number; kept: number } {
  const seen = new Set<string>();
  const keep: number[] = [];
  for (let r = g.r0; r <= g.r1; r++) {
    const key = JSON.stringify(cols.map((c) => keyOf(cells[cellId(r, c)], results[cellId(r, c)])));
    if (seen.has(key)) continue;
    seen.add(key);
    keep.push(r);
  }
  const removed = g.r1 - g.r0 + 1 - keep.length;
  if (!removed) return { cells, styles, removed: 0, kept: keep.length };
  const nextCells = { ...cells };
  const nextStyles = { ...styles };
  for (let i = 0; i <= g.r1 - g.r0; i++) {
    const to = g.r0 + i;
    const from = keep[i];
    for (let c = g.c0; c <= g.c1; c++) {
      const dst = cellId(to, c);
      if (from === undefined) { delete nextCells[dst]; delete nextStyles[dst]; continue; }
      const src = cellId(from, c);
      const v = cells[src];
      if (v) nextCells[dst] = shiftFormula(v, to - from, 0); else delete nextCells[dst];
      if (styles[src]) nextStyles[dst] = styles[src]; else delete nextStyles[dst];
    }
  }
  return { cells: nextCells, styles: nextStyles, removed, kept: keep.length };
}
