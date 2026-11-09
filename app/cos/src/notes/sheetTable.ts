// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Inserare → Foaie de calcul: o foaie dintr-un .xlsx / .ods (sau un .csv) pusă în notiță ca tabel „| a | b |”,
// cu valorile calculate ale formulelor. Tabelele mari se taie (rândurile și coloanele de prisos), cu mesaj.
const NL = String.fromCharCode(10);
export const MAX_ROWS = 60;
export const MAX_COLS = 12;

export interface SheetTable { text: string; rows: number; cols: number; cut: boolean; sheet: string }

// O celulă în tabelul notiței: fără „|” (desparte celulele) și fără rânduri noi.
const cellText = (s: string) => s.replace(/\r?\n|\r/g, ' ').split('|').join('∣').trim();

/** Rândurile (primul e capul tabelului) ca tabel de notiță; rândurile și coloanele goale de la capăt se scot. */
export function rowsToTable(rows: string[][], sheet = ''): SheetTable | null {
  let r = rows.map((row) => row.map((c) => cellText(c ?? '')));
  while (r.length && r[r.length - 1].every((c) => !c)) r.pop();
  // Rândurile goale de la început nu fac parte din tabel.
  while (r.length && r[0].every((c) => !c)) r.shift();
  if (!r.length) return null;
  let cols = Math.max(...r.map((row) => { let n = row.length; while (n && !row[n - 1]) n--; return n; }));
  if (!cols) return null;
  const cut = r.length > MAX_ROWS + 1 || cols > MAX_COLS;
  r = r.slice(0, MAX_ROWS + 1);
  cols = Math.min(cols, MAX_COLS);
  const line = (row: string[]) => '| ' + Array.from({ length: cols }, (_, i) => row[i] || ' ').join(' | ') + ' |';
  const head = r[0].some((c) => c) ? r[0] : Array.from({ length: cols }, (_, i) => `Coloana ${i + 1}`);
  const text = [line(head), line(Array.from({ length: cols }, () => '---')), ...r.slice(1).map(line)].join(NL);
  return { text, rows: r.length - 1, cols, cut, sheet };
}

// „B12” → [11, 1] (rând, coloană de la 0).
function at(id: string): [number, number] | null {
  const m = /^([A-Z]{1,3})(\d+)$/.exec(id);
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64;
  return [Number(m[2]) - 1, c - 1];
}

/** Valorile afișate ale unei foi (formulele calculate), ca rânduri de text. */
export function cellsToRows(cells: Record<string, string>, results: Record<string, { text: string }>, maxR = MAX_ROWS + 1, maxC = MAX_COLS + 1): string[][] {
  const rows: string[][] = [];
  for (const [id, raw] of Object.entries(cells)) {
    const p = at(id);
    if (!p || p[0] >= maxR || p[1] >= maxC) continue;
    const v = raw.startsWith('=') ? (results[id]?.text ?? '') : raw.startsWith("'") ? raw.slice(1) : (results[id]?.text ?? raw);
    (rows[p[0]] ??= [])[p[1]] = v;
  }
  return Array.from({ length: rows.length }, (_, i) => Array.from({ length: rows[i]?.length ?? 0 }, (_, j) => rows[i]?.[j] ?? ''));
}

/** O foaie din fișier, gata de pus în notiță. */
export interface SheetSrc { name: string; cells: Record<string, string> }

/**
 * Foile vizibile din fișierul ales (.csv / .txt are una singură, deja ca rânduri) și foaia activă la salvare;
 * null dacă fișierul n-are nicio foaie.
 */
export async function sheetFileSheets(name: string, data: Uint8Array): Promise<{ sheets: SheetSrc[]; active: number; rows?: string[][] } | null> {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'csv' || ext === 'txt') {
    const { decodeCsv, parseCsv } = await import('../sheets/csv');
    return { sheets: [{ name: '', cells: {} }], active: 0, rows: parseCsv(decodeCsv(data)) };
  }
  let sheets: { name: string; cells: Record<string, string>; hidden?: boolean }[];
  let active = 0;
  if (ext === 'ods' || ext === 'fods') {
    const { readOds } = await import('../sheets/ods');
    const r = await readOds(data);
    sheets = r.sheets; active = r.active ?? 0;
  } else {
    const { readXlsx } = await import('../sheets/xlsx');
    const r = await readXlsx(data);
    sheets = r.sheets; active = r.active ?? 0;
  }
  const act = sheets[active];
  const vis = sheets.filter((x) => !x.hidden);
  const list = vis.length ? vis : sheets.slice(0, 1);
  if (!list.length) return null;
  return { sheets: list.map((x) => ({ name: x.name, cells: x.cells })), active: Math.max(0, list.findIndex((x) => x === act)) };
}

/** Tabelul notiței dintr-o foaie, cu formulele calculate. */
export async function sheetToTable(sh: SheetSrc): Promise<SheetTable | null> {
  const { evaluateAll } = await import('../sheets/formula');
  let results: Record<string, { text: string }> = {};
  try { results = evaluateAll(sh.cells); } catch { /* fără calcul: rămân formulele goale */ }
  return rowsToTable(cellsToRows(sh.cells, results), sh.name);
}

/** Citește fișierul ales și întoarce tabelul foii `index` (implicit foaia activă); null dacă e gol. */
export async function sheetFileToTable(name: string, data: Uint8Array, index?: number): Promise<SheetTable | null> {
  const f = await sheetFileSheets(name, data);
  if (!f) return null;
  if (f.rows) return rowsToTable(f.rows);
  const sh = f.sheets[index ?? f.active];
  return sh ? sheetToTable(sh) : null;
}
