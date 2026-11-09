// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { CellStyle, cellId, colName, FilterColor, isNumber, parseCellId, SheetFilter } from './format';
import { formatValue } from './numfmt';
import { formatNumber, Result } from './formula';
import { formatCode } from './fmtcode';
import { columnMatches } from './cond';

type Cells = Record<string, string>;
type Styles = Record<string, CellStyle>;
type Results = Record<string, Result>;

/** Cum apare o celulă goală în lista filtrului. */
export const EMPTY = '(gol)';

/** Textul afișat într-o celulă: rezultatul formulei sau ce s-a scris, în formatul ales (lei, %, dată). */
export function cellText(raw: string | undefined, res: Result | undefined, st: CellStyle | undefined): string {
  if (st?.code && !res?.err) { const r = codeResult(raw, res, st.code); if (r) return r.text; }
  const fmt = st?.fmt;
  if (fmt && fmt !== 'general' && !res?.err) {
    const n = res ? res.value : raw && isNumber(raw) ? Number(raw.trim().replace(',', '.')) : undefined;
    if (n !== undefined) return formatValue(n, fmt, st?.dec);
  }
  // Textul scris cu apostrof în față se arată fără apostrof.
  return res ? res.text : raw?.startsWith("'") ? raw.slice(1) : raw ?? '';
}

/** Formatul particularizat al unei celule (cod): textul și culoarea din cod ([Red] etc.); nimic pentru o celulă goală. */
function codeResult(raw: string | undefined, res: Result | undefined, code: string): { text: string; color?: string } | null {
  let v: number | string;
  if (res) v = typeof res.value === 'number' && res.num ? res.value : res.text;
  else if (raw === undefined || raw === '') return null;
  else v = raw.startsWith("'") ? raw.slice(1) : isNumber(raw) ? Number(raw.trim().replace(',', '.')) : raw;
  try { return formatCode(v, code, formatNumber); } catch { return null; }
}
/** Culoarea pusă de formatul particularizat (de exemplu negativele cu roșu), dacă există. */
export function cellCodeColor(raw: string | undefined, res: Result | undefined, st: CellStyle | undefined): string | undefined {
  return st?.code && !res?.err ? codeResult(raw, res, st.code)?.color : undefined;
}

/**
 * Ultimul rând cu date sub capul de tabel al filtrului (crește singur când adaugi rânduri): tabelul merge în jos
 * până la primul rând gol în coloanele filtrului, ca în Excel. O singură trecere prin celule, deci merge repede
 * și pe tabele late (126 de coloane × 5.000 de rânduri), unde căutarea coloană cu coloană dura minute.
 */
export function filterEnd(cells: Cells, f: SheetFilter): number {
  const rows = new Set<number>();
  for (const [id, v] of Object.entries(cells)) {
    if (!v) continue;
    const p = parseCellId(id);
    if (p && p.r > f.r && p.c >= f.c0 && p.c <= f.c1) rows.add(p.r);
  }
  let end = f.r;
  while (rows.has(end + 1)) end++;
  return end;
}

export function valueAt(cells: Cells, results: Results, styles: Styles, r: number, c: number): string {
  const id = cellId(r, c);
  return cellText(cells[id], results[id], styles[id]).trim() || EMPTY;
}

/** Rândurile ascunse de filtru: cele în care măcar o coloană are o valoare debifată. */
export function hiddenRows(cells: Cells, results: Results, styles: Styles, f: SheetFilter | undefined, skipCol = -1): Set<number> {
  const out = new Set<number>();
  if (!f) return out;
  const cols = Object.entries(f.hidden)
    .map(([name, vals]) => ({ c: colIndex(name), vals: new Set(vals) }))
    .filter((x) => x.c >= f.c0 && x.c <= f.c1 && x.c !== skipCol && x.vals.size);
  const conds = Object.entries(f.cond ?? {})
    .map(([name, cond]) => ({ c: colIndex(name), cond }))
    .filter((x) => x.c >= f.c0 && x.c <= f.c1 && x.c !== skipCol);
  const colors = Object.entries(f.color ?? {})
    .map(([name, fc]) => ({ c: colIndex(name), fc }))
    .filter((x) => x.c >= f.c0 && x.c <= f.c1 && x.c !== skipCol);
  if (!cols.length && !conds.length && !colors.length) return out;
  const end = filterEnd(cells, f);
  // Rândurile care trec condiția fiecărei coloane (cele mai mari N și media se socotesc pe toată coloana, ca în Excel).
  const pass = conds.map(({ c, cond }) => ({ c, ok: columnMatches({ range: '', op: cond.op, v1: cond.v1, v2: cond.v2, look: 'yellow' }, c, f.r + 1, end, cells, results) }));
  for (let r = f.r + 1; r <= end; r++) {
    if (cols.some(({ c, vals }) => vals.has(valueAt(cells, results, styles, r, c)))) out.add(r);
    else if (pass.some(({ c, ok }) => !ok.has(cellId(r, c)))) out.add(r);
    else if (colors.some(({ c, fc }) => colorOf(styles[cellId(r, c)], fc.kind) !== fc.color)) out.add(r);
  }
  return out;
}

/** Culoarea fundalului sau a textului unei celule, ca în filtru: „none” = fără fundal / textul obișnuit. */
export function colorOf(st: CellStyle | undefined, kind: FilterColor['kind']): string {
  const v = (kind === 'bg' ? st?.bg : st?.color)?.toLowerCase();
  if (!v || !/^#[0-9a-f]{6}$/.test(v)) return 'none';
  if (kind === 'bg' && v === '#ffffff') return 'none';
  if (kind === 'fg' && v === '#000000') return 'none';
  return v;
}

/**
 * Culorile diferite (de fundal și de text) din coloana c, pentru „Filtrează după culoare”, cu numărul de celule.
 * Ca la valori, se numără doar rândurile lăsate vizibile de filtrele celorlalte coloane.
 * Dacă toată coloana are o singură culoare (de obicei niciuna), lista e goală: n-ai după ce filtra.
 */
export function columnColors(cells: Cells, results: Results, styles: Styles, f: SheetFilter, c: number): Record<FilterColor['kind'], { color: string; count: number }[]> {
  const others = hiddenRows(cells, results, styles, f, c);
  const end = filterEnd(cells, f);
  const out = { bg: new Map<string, number>(), fg: new Map<string, number>() };
  for (let r = f.r + 1; r <= end; r++) {
    if (others.has(r)) continue;
    const st = styles[cellId(r, c)];
    for (const k of ['bg', 'fg'] as const) { const v = colorOf(st, k); out[k].set(v, (out[k].get(v) ?? 0) + 1); }
  }
  // Culoarea aleasă acum rămâne în listă, ca s-o vezi bifată.
  const cur = f.color?.[colName(c)];
  if (cur && !out[cur.kind].has(cur.color)) out[cur.kind].set(cur.color, 0);
  const list = (m: Map<string, number>) => (m.size < 2 && !(cur && m === out[cur.kind]) ? [] : [...m.entries()]
    .map(([color, count]) => ({ color, count }))
    .sort((a, b) => (a.color === 'none' ? 1 : b.color === 'none' ? -1 : b.count - a.count)));
  return { bg: list(out.bg), fg: list(out.fg) };
}

const collator = new Intl.Collator('ro', { sensitivity: 'base', numeric: true });

/**
 * Valorile diferite din coloana c (cu numărul de apariții), pentru lista de bifat a filtrului.
 * Ca în Excel, apar doar rândurile lăsate vizibile de filtrele celorlalte coloane.
 */
export function columnValues(cells: Cells, results: Results, styles: Styles, f: SheetFilter, c: number): { text: string; count: number }[] {
  const others = hiddenRows(cells, results, styles, f, c);
  const counts = new Map<string, number>();
  const end = filterEnd(cells, f);
  for (let r = f.r + 1; r <= end; r++) {
    if (others.has(r)) continue;
    const v = valueAt(cells, results, styles, r, c);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  // Valorile debifate rămân în listă chiar dacă alt filtru le-a ascuns, ca să le poți bifa la loc.
  for (const v of f.hidden[colName(c)] ?? []) if (!counts.has(v)) counts.set(v, 0);
  return [...counts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => (a.text === EMPTY ? 1 : b.text === EMPTY ? -1 : collator.compare(a.text, b.text)));
}

/** Potrivire fără diacritice și fără litere mari/mici („stefan” găsește „Ștefan”). */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function colIndex(name: string): number {
  let n = 0;
  for (const ch of name) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}
