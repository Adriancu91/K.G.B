// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Filtrul avansat (ca Date → Avansat în Excel): o zonă de criterii cu titluri, apoi condiții.
// Pe un rând de criterii toate condițiile trebuie îndeplinite („și”); între rânduri oricare („sau”).
// Rezultatul: rândurile ascunse pe loc sau rândurile potrivite copiate în altă parte (opțional doar cele unice).
import { CellStyle, cellId, isNumber } from './format';
import type { Range } from './fill';
import { dbRowsMatch, FErr, Result, Scalar } from './formula';

type Cells = Record<string, string>;
type Styles = Record<string, CellStyle>;
type Results = Record<string, Result>;

/** Valoarea unei celule pentru potrivire: număr, text, logic sau nimic. */
function scalarAt(cells: Cells, results: Results, id: string): Scalar {
  const res = results[id];
  if (res) {
    if (res.err) return new FErr(res.err);
    if (res.num && res.value !== undefined) return res.value;
    return res.text === '' ? null : res.text;
  }
  const raw = cells[id];
  if (!raw) return null;
  if (isNumber(raw)) return Number(raw.trim().replace(',', '.'));
  if (raw === 'ADEVĂRAT' || raw === 'TRUE') return true;
  if (raw === 'FALS' || raw === 'FALSE') return false;
  return raw.startsWith("'") ? raw.slice(1) : raw;
}

function gridOf(cells: Cells, results: Results, g: Range): Scalar[][] {
  const out: Scalar[][] = [];
  for (let r = g.r0; r <= g.r1; r++) {
    const row: Scalar[] = [];
    for (let c = g.c0; c <= g.c1; c++) row.push(scalarAt(cells, results, cellId(r, c)));
    out.push(row);
  }
  return out;
}

/**
 * Rândurile de date ale listei (fără rândul de titluri) care trec criteriile, în ordine.
 * Cu `unique`, un rând identic cu unul deja păstrat se sare. Aruncă o eroare cu mesaj în română dacă un titlu de criteriu
 * nu e în listă.
 */
export function advancedMatch(cells: Cells, results: Results, list: Range, crit: Range, unique = false): number[] {
  const db = gridOf(cells, results, list);
  let ok: boolean[];
  try {
    ok = dbRowsMatch(db, gridOf(cells, results, crit));
  } catch {
    throw new Error('Titlurile din zona criteriilor trebuie să fie la fel cu titlurile coloanelor din listă.');
  }
  const out: number[] = [];
  const seen = new Set<string>();
  ok.forEach((yes, i) => {
    if (!yes) return;
    if (unique) {
      const key = JSON.stringify(db[i + 1].map((v) => (v instanceof FErr ? v.code : typeof v === 'string' ? v.toLocaleLowerCase('ro-RO') : v)));
      if (seen.has(key)) return;
      seen.add(key);
    }
    out.push(list.r0 + 1 + i);
  });
  return out;
}

/**
 * Copiază titlurile și rândurile `rows` ale listei începând din celula (r, c): valorile (formulele devin rezultatul lor)
 * și formatarea. Întoarce celulele și formatarea noi, plus zona scrisă.
 */
export function copyRows(cells: Cells, styles: Styles, results: Results, list: Range, rows: number[], r: number, c: number): { cells: Cells; styles: Styles; to: Range } {
  const nextCells = { ...cells };
  const nextStyles = { ...styles };
  const src = [list.r0, ...rows];
  const w = list.c1 - list.c0;
  src.forEach((from, i) => {
    for (let k = 0; k <= w; k++) {
      const a = cellId(from, list.c0 + k);
      const b = cellId(r + i, c + k);
      const raw = cells[a];
      const res = results[a];
      const v = raw?.startsWith('=') && res ? (res.err ?? (res.num && res.value !== undefined ? String(res.value) : res.text)) : raw;
      if (v) nextCells[b] = v; else delete nextCells[b];
      if (styles[a]) nextStyles[b] = styles[a]; else delete nextStyles[b];
    }
  });
  return { cells: nextCells, styles: nextStyles, to: { r0: r, c0: c, r1: r + src.length - 1, c1: c + w } };
}
