// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Îmbinare de corespondență: un document cu câmpuri «Nume», «Adresa»… completat pentru fiecare rând dintr-un tabel
// (tabel Suite .ssheet, Excel .xlsx sau CSV). Primul rând completat al tabelului dă numele câmpurilor.
import type { JSONContent } from '@tiptap/react';
import { cellId, lastUsedCol, parseSheetDoc } from '../sheets/format';
import { evaluateAll } from '../sheets/formula';
import { cellText } from '../sheets/filter';
import type { CellStyle } from '../sheets/format';

export interface MergeData {
  source: string;
  headers: string[];
  rows: string[][];
  /** Potrivirea câmpurilor (Potrivește câmpurile): câmpul din document (fieldKey) → coloana aleasă din tabel. */
  match?: Record<string, string>;
}

export const FIELD_RE = /«([^«»\n]{1,200})»/g;

// Regulile (ca Rules → If…Then…Else și Skip Record If din Word), scrise tot între « »:
//   «DACĂ Oraș = București | text dacă da | text dacă nu»  → textul potrivit; în texte, {Nume} pune valoarea coloanei Nume;
//   «SARI DACĂ Plătit = da»                                 → rândurile care îndeplinesc condiția nu primesc exemplar.
// Comparațiile: =, <>, >, <, >=, <=, conține; numerele (și cele scrise românește, 1.234,5) se compară ca numere,
// textul fără diacritice și fără litere mari.
export const RULE_OPS = ['=', '<>', '>', '<', '>=', '<=', 'conține'] as const;
export type RuleOp = typeof RULE_OPS[number];
const OP_RE = '(<>|>=|<=|=|>|<|\\s+con[tț]ine\\s+)';
const IF_RE = new RegExp(`^\\s*DAC[AĂ]\\s+(.+?)\\s*${OP_RE}\\s*([^|]*?)\\s*\\|([^|]*)(?:\\|([^|]*))?$`, 'i');
const SKIP_RE = new RegExp(`^\\s*SARI\\s+DAC[AĂ]\\s+(.+?)\\s*${OP_RE}\\s*(.*?)\\s*$`, 'i');

/** Condiția unei reguli e adevărată pentru rândul dat? (o coloană care lipsește e goală) */
export function ruleTest(data: MergeData, row: number, field: string, op: string, value: string): boolean {
  const a = (fieldValue(data, row, field) ?? '').trim(), b = value.trim();
  const o = op.trim().toLowerCase();
  if (o === 'conține' || o === 'contine') return fieldKey(a).includes(fieldKey(b));
  const na = asNumber(a), nb = asNumber(b);
  const cmp = !Number.isNaN(na) && !Number.isNaN(nb) ? na - nb : fieldKey(a).localeCompare(fieldKey(b), 'ro');
  switch (o) {
    case '<>': return cmp !== 0;
    case '>': return cmp > 0;
    case '<': return cmp < 0;
    case '>=': return cmp >= 0;
    case '<=': return cmp <= 0;
    default: return cmp === 0;
  }
}

/** Textul unei reguli «DACĂ …» pentru rândul dat (cu {Coloană} completate); null dacă nu e o regulă DACĂ. */
export function ruleValue(data: MergeData, row: number, body: string): string | null {
  const m = IF_RE.exec(body);
  if (!m) return null;
  const text = ruleTest(data, row, m[1], m[2], m[3]) ? m[4] : m[5] ?? '';
  return text.trim().replace(/\{([^{}]{1,60})\}/g, (all, f: string) => fieldValue(data, row, f) ?? all);
}

/** Regulile «SARI DACĂ …» din document: [coloană, comparație, valoare]. */
export function skipRules(doc: JSONContent): [string, string, string][] {
  const out: [string, string, string][] = [];
  const walk = (n: JSONContent) => {
    if (n.text) for (const m of n.text.matchAll(FIELD_RE)) { const s = SKIP_RE.exec(m[1]); if (s) out.push([s[1], s[2], s[3]]); }
    (n.content ?? []).forEach(walk);
  };
  walk(doc);
  return out;
}

/** Rândul e sărit de o regulă «SARI DACĂ …»? */
export const skipRow = (rules: [string, string, string][], data: MergeData, row: number) => rules.some(([f, op, v]) => ruleTest(data, row, f, op, v));

/** O regulă «DACĂ …» gata de pus în document. */
export function ifField(field: string, op: RuleOp, value: string, yes: string, no: string): string {
  const clean = (s: string) => s.replace(/[«»|\n]/g, ' ').trim();
  return `«DACĂ ${clean(field)} ${op} ${clean(value)} | ${clean(yes)} | ${clean(no)}»`;
}
export function skipField(field: string, op: RuleOp, value: string): string {
  const clean = (s: string) => s.replace(/[«»|\n]/g, ' ').trim();
  return `«SARI DACĂ ${clean(field)} ${op} ${clean(value)}»`;
}

/** Comparăm numele câmpurilor fără diacritice, litere mari și spații în plus. */
export function fieldKey(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Tabelul (rânduri de text) → capul de tabel și rândurile cu date; rândurile goale se sar. */
export function gridToMerge(grid: string[][], source: string): MergeData {
  const filled = grid.filter((r) => r.some((v) => v.trim()));
  if (!filled.length) throw new Error('Tabelul e gol.');
  const width = Math.max(...filled.map((r) => r.reduce((w, v, i) => (v.trim() ? i + 1 : w), 0)));
  const headers = filled[0].slice(0, width).map((h, i) => h.trim() || `Coloana ${i + 1}`);
  const rows = filled.slice(1).map((r) => headers.map((_, i) => (r[i] ?? '').trim()));
  if (!rows.length) throw new Error('Tabelul are doar capul de tabel, fără rânduri cu date.');
  return { source, headers, rows };
}

/** Celulele unei foi, cu formulele calculate și formatarea aplicată (1.234,56 lei, date), ca text. */
export function cellsToGrid(cells: Record<string, string>, styles: Record<string, CellStyle>, book?: Parameters<typeof evaluateAll>[1]): string[][] {
  const results = evaluateAll(cells, book);
  let maxR = -1;
  for (const id of Object.keys(cells)) {
    const m = /^[A-Z]+(\d+)$/.exec(id);
    if (m && cells[id] !== '') maxR = Math.max(maxR, Number(m[1]) - 1);
  }
  const grid: string[][] = [];
  const maxC = lastUsedCol(cells);
  for (let r = 0; r <= maxR; r++) {
    const row: string[] = [];
    for (let c = 0; c <= maxC; c++) {
      const id = cellId(r, c);
      row.push(cells[id] ? cellText(cells[id], results[id], styles[id]) : '');
    }
    grid.push(row);
  }
  return grid;
}

/** Tabel Suite: prima foaie. */
export function sheetFileToMerge(content: string, source: string): MergeData {
  const doc = parseSheetDoc(content);
  const s = doc.sheets[0];
  return gridToMerge(cellsToGrid(s.cells, s.styles, { self: s.name, sheets: doc.sheets, names: doc.names }), source);
}

export async function csvFileToMerge(data: Uint8Array, source: string): Promise<MergeData> {
  const { decodeCsv, parseCsv } = await import('../sheets/csv');
  return gridToMerge(parseCsv(decodeCsv(data)), source);
}

/** Excel: foaia care era deschisă în Excel. */
export async function xlsxFileToMerge(data: Uint8Array, source: string): Promise<MergeData> {
  const { readXlsx } = await import('../sheets/xlsx');
  const book = await readXlsx(data);
  const s = book.sheets[book.active] ?? book.sheets[0];
  if (!s) throw new Error('Tabelul .xlsx nu are foi cu date.');
  return gridToMerge(cellsToGrid(s.cells, s.styles, { self: s.name, sheets: book.sheets }), source);
}

/** Câmpurile folosite în document, în ordinea apariției (fără repetări). */
export function usedFields(doc: JSONContent): string[] {
  const seen = new Map<string, string>();
  const walk = (n: JSONContent) => {
    if (n.text) for (const m of n.text.matchAll(FIELD_RE)) {
      // La reguli contează coloanele folosite: cea din condiție și cele scrise {așa} în texte.
      const rule = IF_RE.exec(m[1]) ?? SKIP_RE.exec(m[1]);
      const names = rule ? [rule[1], ...[...rule.slice(4).join(' ').matchAll(/\{([^{}]{1,60})\}/g)].map((x) => x[1])] : [m[1]];
      for (const f of names) if (!seen.has(fieldKey(f))) seen.set(fieldKey(f), f);
    }
    (n.content ?? []).forEach(walk);
  };
  walk(doc);
  return [...seen.values()];
}

/** Câmpurile compuse (ca Address Block și Greeting Line din Word): se calculează din coloanele obișnuite ale tabelului. */
export const ADDRESS_FIELD = 'Bloc de adresă';
export const GREETING_FIELD = 'Formulă de salut';

/** Prima coloană care se potrivește cu unul dintre nume (fără diacritice / litere mari); -1 dacă nu e niciuna. */
function col(data: MergeData, names: string[]): number {
  const keys = data.headers.map(fieldKey);
  for (const n of names) { const i = keys.indexOf(n); if (i >= 0) return i; }
  return -1;
}
const cell = (data: MergeData, row: number, names: string[]) => { const i = col(data, names); return i < 0 ? '' : (data.rows[row]?.[i] ?? '').trim(); };

/** Numele întreg: Prenume + Nume (sau „Nume complet” / „Nume și prenume”, ori doar Nume). */
export function fullName(data: MergeData, row: number): string {
  const whole = cell(data, row, ['nume complet', 'nume si prenume', 'nume prenume', 'destinatar', 'name', 'full name']);
  if (whole) return whole;
  return [cell(data, row, ['prenume', 'first name']), cell(data, row, ['nume', 'nume de familie', 'last name'])].filter(Boolean).join(' ');
}

/** Blocul de adresă: numele, firma, strada, codul + localitatea, județul, țara; câte unul pe rând, fără rânduri goale. */
export function addressBlock(data: MergeData, row: number): string {
  const title = cell(data, row, ['titlu', 'formula de adresare', 'title']);
  const name = [title, fullName(data, row)].filter(Boolean).join(' ');
  const city = [cell(data, row, ['cod postal', 'codul postal', 'zip']), cell(data, row, ['localitate', 'oras', 'localitatea', 'orasul', 'city'])].filter(Boolean).join(' ');
  const jud = cell(data, row, ['judet', 'judetul']), sector = cell(data, row, ['sector']);
  const county = jud ? (/^jud/i.test(jud) ? jud : 'jud. ' + jud) : sector ? (/^sector/i.test(sector) ? sector : 'Sector ' + sector) : '';
  return [name, cell(data, row, ['firma', 'companie', 'societate', 'company']), cell(data, row, ['adresa', 'strada', 'adresa postala', 'address']),
    city, county, cell(data, row, ['tara', 'country'])]
    .filter(Boolean).join('\n');
}

/** Formula de salut: „Stimate domnule Popescu,” / „Stimată doamnă Ionescu,” după coloana Titlu sau Gen; altfel „Bună ziua, Ion Popescu,”. */
export function greetingLine(data: MergeData, row: number): string {
  const g = fieldKey(cell(data, row, ['titlu', 'formula de adresare', 'gen', 'sex', 'title']));
  const last = cell(data, row, ['nume', 'nume de familie', 'last name']) || fullName(data, row);
  if (/^(dl|d-l|domnul|domn|m|masculin|barbat|mr)\b/.test(g)) return `Stimate domnule ${last},`;
  if (/^(dna|d-na|doamna|doamna|f|feminin|femeie|mrs|ms|dra|d-ra|domnisoara)\b/.test(g)) return `Stimată doamnă ${last},`;
  const name = fullName(data, row);
  return name ? `Bună ziua, ${name},` : 'Bună ziua,';
}

/** Valoarea unui câmp pentru un rând; null dacă tabelul nu are coloana. Câmpurile compuse se calculează când tabelul nu are o coloană cu numele lor. */
export function fieldValue(data: MergeData, row: number, field: string): string | null {
  const i = data.headers.findIndex((h) => fieldKey(h) === fieldKey(field));
  if (i >= 0) return data.rows[row]?.[i] ?? '';
  const to = data.match?.[fieldKey(field)];
  const j = to ? data.headers.findIndex((h) => fieldKey(h) === fieldKey(to)) : -1;
  if (j >= 0) return data.rows[row]?.[j] ?? '';
  if (fieldKey(field) === fieldKey(ADDRESS_FIELD)) return addressBlock(data, row);
  if (fieldKey(field) === fieldKey(GREETING_FIELD)) return greetingLine(data, row);
  return null;
}

/** Câmpurile din document fără coloană cu același nume în tabel (pentru Potrivește câmpurile); blocul de adresă și salutul se completează singure. */
export function unmatchedFields(data: MergeData, fields: string[]): string[] {
  const plain = { ...data, match: undefined };
  return fields.filter((f) => fieldValue(plain, 0, f) === null);
}

/** Verifică erorile (înainte de îmbinare): câmpurile fără coloană și, pentru fiecare câmp, rândurile din tabel la care e gol. */
export function checkMerge(data: MergeData, fields: string[], rows: number[]): { missing: string[]; empty: { field: string; rows: number[] }[] } {
  const missing = fields.filter((f) => fieldValue(data, rows[0] ?? 0, f) === null);
  const empty = fields.filter((f) => !missing.includes(f))
    .map((field) => ({ field, rows: rows.filter((r) => !(fieldValue(data, r, field) ?? '').trim()) }))
    .filter((e) => e.rows.length);
  return { missing, empty };
}

/** Datele cu câmpul potrivit cu coloana dată (coloana goală scoate potrivirea). */
export function withMatch(data: MergeData, field: string, header: string): MergeData {
  const match = { ...data.match };
  if (header && data.headers.includes(header)) match[fieldKey(field)] = header; else delete match[fieldKey(field)];
  return { ...data, match };
}

/** O copie a documentului cu câmpurile înlocuite de valorile rândului (câmpurile necunoscute rămân cum sunt). */
export function fillDoc(doc: JSONContent, data: MergeData, row: number): JSONContent {
  // Un text cu mai multe rânduri (blocul de adresă) devine rânduri despărțite de Shift+Enter, cu formatarea textului.
  const fill = (n: JSONContent): JSONContent[] => {
    if (n.type === 'text' && n.text) {
      // Regulile SARI DACĂ nu lasă text în document; regulile DACĂ pun textul potrivit.
      const text = n.text.replace(FIELD_RE, (all, f: string) => (SKIP_RE.test(f) ? '' : ruleValue(data, row, f) ?? fieldValue(data, row, f) ?? all));
      const out: JSONContent[] = [];
      text.split('\n').forEach((part, k) => {
        if (k) out.push({ type: 'hardBreak' });
        if (part) out.push({ ...n, text: part }); // un nod de text gol nu e voie în document
      });
      return out;
    }
    if (!n.content) return [{ ...n }];
    return [{ ...n, content: n.content.flatMap(fill) }];
  };
  return fill(doc)[0] ?? { type: 'doc', content: [] };
}

/**
 * Toate exemplarele într-un singur document, fiecare de la pagină nouă. Cu `list` (ca tipul Director / Catalog):
 * unul sub altul, fără pagini noi, de exemplu o listă de prețuri sau o agendă de telefon din tabel.
 */
export function mergeAll(doc: JSONContent, data: MergeData, rows: number[], list = false): JSONContent {
  const content: JSONContent[] = [];
  const skip = skipRules(doc);
  rows.filter((r) => !skipRow(skip, data, r)).forEach((r, i) => {
    if (i && !list) content.push({ type: 'pageBreak' });
    content.push(...(fillDoc(doc, data, r).content ?? []));
  });
  return { type: 'doc', content };
}

/** Cum se aleg destinatarii (ca Edit Recipient List din Word): un filtru pe o coloană, sortarea și rândurile scoase cu mâna. */
export type FilterOp = 'contine' | 'egal' | 'incepe' | 'nu-contine' | 'gol' | 'negol';
export const FILTER_OPS: [FilterOp, string][] = [
  ['contine', 'conține'], ['egal', 'este egal cu'], ['incepe', 'începe cu'], ['nu-contine', 'nu conține'], ['gol', 'e gol'], ['negol', 'nu e gol'],
];
export interface RecipientPick {
  filterCol?: number;
  op?: FilterOp;
  text?: string;
  sortCol?: number;
  desc?: boolean;
  /** Rândurile scoase din listă (debifate), după numărul lor din tabel. */
  excluded?: number[];
}

/** Rândul trece filtrul? Comparăm fără diacritice și fără litere mari. */
export function passesFilter(data: MergeData, row: number, p: RecipientPick): boolean {
  if (p.filterCol == null || p.filterCol < 0 || !p.op) return true;
  const v = fieldKey(data.rows[row]?.[p.filterCol] ?? ''), t = fieldKey(p.text ?? '');
  switch (p.op) {
    case 'gol': return !v;
    case 'negol': return !!v;
    case 'egal': return v === t;
    case 'incepe': return v.startsWith(t);
    case 'nu-contine': return !t || !v.includes(t);
    default: return v.includes(t);
  }
}

/** Un număr scris românește („1.234,5”, „12 lei” nu) sau NaN. */
function asNumber(s: string): number {
  const x = s.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(x) ? Number(x) : NaN;
}

/** Rândurile care trec filtrul, în ordinea sortării (numerele ca numere: 2 înainte de 10). Fără cele scoase cu mâna, dacă `all` e fals. */
export function recipientRows(data: MergeData, p: RecipientPick, all = false): number[] {
  const ex = new Set(p.excluded ?? []);
  const out = data.rows.map((_, i) => i).filter((i) => passesFilter(data, i, p) && (all || !ex.has(i)));
  const c = p.sortCol;
  if (c != null && c >= 0) {
    out.sort((a, b) => {
      const x = data.rows[a][c] ?? '', y = data.rows[b][c] ?? '';
      const nx = asNumber(x), ny = asNumber(y);
      const r = !Number.isNaN(nx) && !Number.isNaN(ny) ? nx - ny : x.localeCompare(y, 'ro', { numeric: true, sensitivity: 'base' });
      return (p.desc ? -r : r) || a - b;
    });
  }
  return out;
}
