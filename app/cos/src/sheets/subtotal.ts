// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Date → Subtotal (ca în Excel): într-un tabel sortat după o coloană, sub fiecare grup de rânduri cu aceeași valoare
// se inserează un rând „Total <valoare>” cu =SUBTOTAL(9;C2:C5) pe coloanele alese, iar la sfârșit „Total general”.
// SUBTOTAL nu adună alte SUBTOTAL, deci totalul general nu numără subtotalurile de două ori.
// „Elimină tot” scoate rândurile cu SUBTOTAL din tabel. Rândurile se inserează / șterg întregi, ca formulele să se mute corect.
import { cellId, colName, Sheet } from './format';
import { insertDelete } from './insert';

export interface SubtotalOpts {
  /** Coloana după care se fac grupurile. */
  groupCol: number;
  /** Codul funcției din SUBTOTAL: 9 Sumă, 1 Medie, 3 Număr, 2 Numere, 4 Max, 5 Min, 6 Produs. */
  fn: number;
  /** Coloanele care primesc subtotal. */
  cols: number[];
}

export const SUBTOTAL_FNS: [number, string][] = [
  [9, 'Sumă'], [3, 'Număr (celule completate)'], [1, 'Medie'], [4, 'Maxim'], [5, 'Minim'], [6, 'Produs'], [2, 'Număr de numere'],
];

/** Cele mai multe grupuri tratate (fiecare înseamnă un rând inserat). */
export const MAX_GROUPS = 2000;

interface Zone { r0: number; r1: number; c0: number; c1: number }

/**
 * Adaugă subtotalurile. `g.r0` e capul de tabel; `textOf` dă textul afișat al unei celule (după el se fac grupurile,
 * fără să conteze literele mari și spațiile de la capete). Întoarce foile noi și câte grupuri au fost.
 */
export function addSubtotals(sheets: Sheet[], active: number, g: Zone, o: SubtotalOpts, textOf: (r: number, c: number) => string):
  { sheets: Sheet[]; groups: number; last: number } {
  const key = (r: number) => textOf(r, o.groupCol).trim().toLocaleLowerCase('ro-RO');
  const groups: [number, number][] = [];
  for (let r = g.r0 + 1; r <= g.r1; r++) {
    const last = groups[groups.length - 1];
    if (last && key(r) === key(last[1])) last[1] = r; else groups.push([r, r]);
  }
  if (!groups.length || groups.length > MAX_GROUPS) return { sheets, groups: groups.length, last: g.r1 };
  let out = sheets;
  const fill = (row: number, label: string, from: number, to: number) => {
    const s = out[active];
    const cells = { ...s.cells };
    const styles = { ...s.styles };
    const bold = (id: string) => { styles[id] = { ...(styles[id] ?? {}), b: true }; };
    cells[cellId(row, o.groupCol)] = label;
    bold(cellId(row, o.groupCol));
    for (const c of o.cols) {
      if (c === o.groupCol) continue;
      const id = cellId(row, c);
      cells[id] = `=SUBTOTAL(${o.fn};${colName(c)}${from + 1}:${colName(c)}${to + 1})`;
      bold(id);
    }
    out = out.map((x, i) => (i === active ? { ...x, cells, styles } : x));
  };
  // De jos în sus, ca inserările să nu mute grupurile încă netratate.
  for (let i = groups.length - 1; i >= 0; i--) {
    const [a, b] = groups[i];
    out = insertDelete(out, active, 'r', b + 1, 1);
    const label = textOf(a, o.groupCol).trim();
    fill(b + 1, label ? `Total ${label}` : 'Total (gol)', a, b);
  }
  const last = g.r1 + groups.length;
  out = insertDelete(out, active, 'r', last + 1, 1);
  fill(last + 1, 'Total general', g.r0 + 1, last);
  return { sheets: out, groups: groups.length, last: last + 1 };
}

/** Rândurile din zonă care au o formulă SUBTOTAL (puse de comanda Subtotal sau de mână). */
export function subtotalRows(s: Sheet, g: Zone): number[] {
  const rows = new Set<number>();
  for (let r = g.r0; r <= g.r1; r++) {
    for (let c = g.c0; c <= g.c1; c++) {
      if (/^=\s*SUBTOTAL\s*\(/i.test(s.cells[cellId(r, c)] ?? '')) { rows.add(r); break; }
    }
  }
  return [...rows].sort((a, b) => a - b);
}

/** Elimină tot: șterge rândurile cu SUBTOTAL din zonă (de jos în sus). */
export function removeSubtotals(sheets: Sheet[], active: number, g: Zone): { sheets: Sheet[]; removed: number } {
  const rows = subtotalRows(sheets[active], g);
  let out = sheets;
  for (let i = rows.length - 1; i >= 0; i--) out = insertDelete(out, active, 'r', rows[i], -1);
  return { sheets: out, removed: rows.length };
}
