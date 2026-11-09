// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// ⊕ Consolidare (ca Data → Consolidate din Excel): mai multe tabele (de exemplu vânzările pe luni, fiecare pe foaia lui)
// se adună într-unul singur. După poziție: celula din același loc din fiecare tabel. După etichete: rândurile (și / sau coloanele)
// cu același nume din prima coloană (rândul de sus) se pun împreună, chiar dacă sunt în altă ordine sau lipsesc din unele tabele.
// Testat în tests/sheets-consolidate.test.mjs.

export type ConsFn = 'sum' | 'count' | 'average' | 'max' | 'min' | 'product';
export const CONS_FNS: [ConsFn, string][] = [
  ['sum', 'Sumă'], ['count', 'Număr'], ['average', 'Medie'], ['max', 'Maxim'], ['min', 'Minim'], ['product', 'Produs'],
];

/** O celulă dintr-un tabel: număr, text sau goală. */
export type ConsCell = number | string | null;

const num = (v: ConsCell): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function combine(vals: number[], fn: ConsFn): number | null {
  if (fn === 'count') return vals.length;
  if (!vals.length) return null;
  if (fn === 'sum') return vals.reduce((a, b) => a + b, 0);
  if (fn === 'average') return vals.reduce((a, b) => a + b, 0) / vals.length;
  if (fn === 'max') return Math.max(...vals);
  if (fn === 'min') return Math.min(...vals);
  return vals.reduce((a, b) => a * b, 1);
}

const key = (v: ConsCell) => String(v ?? '').trim().toLocaleLowerCase('ro');

/**
 * Tabelul consolidat. byTop: rândul de sus are etichete (numele coloanelor); byLeft: prima coloană are etichete (numele rândurilor).
 * Fără etichete, tabelele se pun unul peste altul după poziție (rezultatul are mărimea celui mai mare).
 */
export function consolidate(tables: ConsCell[][][], fn: ConsFn, byTop: boolean, byLeft: boolean): ConsCell[][] {
  const list = tables.filter((t) => t.length && t[0].length);
  if (!list.length) return [];
  // Etichetele rândurilor și coloanelor, în ordinea în care apar prima dată (ca în Excel).
  const rowKeys: string[] = [], rowNames = new Map<string, ConsCell>();
  const colKeys: string[] = [], colNames = new Map<string, ConsCell>();
  const addKey = (keys: string[], names: Map<string, ConsCell>, v: ConsCell) => { const k = key(v); if (!names.has(k)) { names.set(k, v); keys.push(k); } };
  let rows = 0, cols = 0;
  for (const t of list) {
    const r0 = byTop ? 1 : 0, c0 = byLeft ? 1 : 0;
    rows = Math.max(rows, t.length - r0);
    cols = Math.max(cols, Math.max(...t.map((r) => r.length)) - c0);
    if (byLeft) for (let r = r0; r < t.length; r++) addKey(rowKeys, rowNames, t[r][0] ?? null);
    if (byTop) for (let c = c0; c < t[0].length; c++) addKey(colKeys, colNames, t[0][c] ?? null);
  }
  const R = byLeft ? rowKeys.length : rows, C = byTop ? colKeys.length : cols;
  const acc: number[][][] = Array.from({ length: R }, () => Array.from({ length: C }, () => []));
  for (const t of list) {
    const r0 = byTop ? 1 : 0, c0 = byLeft ? 1 : 0;
    const colAt = (c: number) => (byTop ? colKeys.indexOf(key(t[0][c] ?? null)) : c - c0);
    for (let r = r0; r < t.length; r++) {
      const ri = byLeft ? rowKeys.indexOf(key(t[r][0] ?? null)) : r - r0;
      for (let c = c0; c < t[r].length; c++) {
        const ci = colAt(c), v = num(t[r][c] ?? null);
        if (ri < 0 || ci < 0 || v === null) continue;
        acc[ri][ci].push(v);
      }
    }
  }
  const body: ConsCell[][] = acc.map((row) => row.map((vals) => combine(vals, fn)));
  // Etichetele se pun înapoi pe margini; colțul din stânga-sus rămâne gol.
  const out: ConsCell[][] = body.map((row, i) => (byLeft ? [rowNames.get(rowKeys[i]) ?? null, ...row] : row));
  if (byTop) out.unshift([...(byLeft ? [null] : []), ...colKeys.map((k) => colNames.get(k) ?? null)]);
  return out;
}
