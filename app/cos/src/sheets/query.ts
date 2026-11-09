// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Interogare din tabel / zonă (ca Get & Transform → From Table/Range din Excel): datele unei zone trec printr-o listă de
// pași (păstrează coloane, filtrează, sortează, scoate dublurile / rândurile goale, redenumește, primele N) și ajung pe o
// foaie nouă. Pașii se țin minte pe foaia rezultatului, ca Date → Reîmprospătare totală să-i facă din nou pe datele de acum.
// Coloanele se țin minte după nume (capul de tabel), nu după poziție, ca o coloană nouă în sursă să nu strice pașii.
import { cellId, CellStyle } from './format';
import { Range } from './fill';
import { Result } from './formula';
import { parseDate } from './textImport';

export type QOp = 'eq' | 'ne' | 'gt' | 'lt' | 'ge' | 'le' | 'has' | 'nohas' | 'empty' | 'full';
export const Q_OPS: [QOp, string][] = [
  ['eq', 'este egal cu'], ['ne', 'nu este egal cu'], ['gt', 'mai mare decât'], ['lt', 'mai mic decât'],
  ['ge', 'mai mare sau egal cu'], ['le', 'mai mic sau egal cu'], ['has', 'conține'], ['nohas', 'nu conține'],
  ['empty', 'e gol'], ['full', 'nu e gol'],
];

export type QStep =
  | { k: 'keep'; cols: string[] }
  | { k: 'filter'; col: string; op: QOp; v: string }
  | { k: 'sort'; col: string; desc: boolean }
  | { k: 'dedupe' }
  | { k: 'noblank' }
  | { k: 'rename'; col: string; to: string }
  | { k: 'top'; n: number }
  | { k: 'group'; col: string; agg: QAgg; of?: string; by?: string[]; more?: QGroupAgg[] }
  | { k: 'calc'; name: string; a: string; op: QCalcOp; b: string; bCol: boolean }
  | { k: 'merge'; src: string; col: string; col2: string; how: QJoin; cols: string[] }
  | { k: 'append'; src: string }
  | { k: 'replace'; col: string; from: string; to: string; whole: boolean }
  | { k: 'split'; col: string; sep: string }
  | { k: 'case'; col: string; how: QCase }
  | { k: 'fill'; col: string; up: boolean }
  | { k: 'unpivot'; cols: string[] }
  | { k: 'index'; from: number }
  | { k: 'pivot'; col: string; val: string; agg: QAgg }
  | { k: 'transpose' }
  | { k: 'promote' }
  | { k: 'skip'; n: number }
  | { k: 'cond'; name: string; col: string; op: QOp; v: string; then: string; else: string }
  | { k: 'type'; col: string; to: QType }
  | { k: 'mcols'; cols: string[]; sep: string; name: string }
  | { k: 'extract'; col: string; how: QExtract; v: string }
  | { k: 'dup'; col: string }
  | { k: 'round'; col: string; how: QRound; n: number }
  | { k: 'date'; col: string; how: QDate }
  | { k: 'math'; col: string; op: QMath; v: string }
  | { k: 'skipb'; n: number }
  | { k: 'reverse' }
  | { k: 'move'; col: string; to: QMove }
  | { k: 'keepdup'; col: string }
  | { k: 'range'; from: number; n: number }
  | { k: 'drop'; cols: string[] }
  | { k: 'noerr' }
  | { k: 'custom'; name: string; expr: string };

/** Coloană personalizată: o formulă scurtă cu coloanele în paranteze drepte, de exemplu [Preț] * [Cantitate] * 1.19
 *  sau [Nume] & " " & [Prenume]: + − * / ^, paranteze, numere (cu punct sau virgulă), text între ghilimele și & care lipește
 *  textul. Un calcul imposibil pe un rând (text în loc de număr, împărțire la 0) dă o celulă goală. */
type QExpr = { t: 'n'; v: number } | { t: 's'; v: string } | { t: 'c'; v: string } | { t: 'neg'; a: QExpr } | { t: 'op'; o: string; a: QExpr; b: QExpr };
export function parseQExpr(src: string): { e: QExpr; cols: string[] } | { err: string } {
  let p = 0;
  const cols: string[] = [];
  const ws = () => { while (p < src.length && /\s/.test(src[p])) p++; };
  const fail = (m: string): never => { throw new Error(m); };
  const prim = (): QExpr => {
    ws();
    const ch = src[p];
    if (ch === '(') { p++; const e = cat(); ws(); if (src[p] !== ')') fail('Lipsește „)”'); p++; return e; }
    if (ch === '[') {
      const j = src.indexOf(']', p);
      if (j < 0) fail('Lipsește „]”');
      const name = src.slice(p + 1, j).trim();
      p = j + 1;
      if (!cols.includes(name)) cols.push(name);
      return { t: 'c', v: name };
    }
    if (ch === '"' || ch === '„' || ch === '“') {
      const close = ch === '"' ? '"' : '”';
      const j = src.indexOf(close, p + 1);
      if (j < 0) fail('Lipsesc ghilimelele de închidere');
      const v = src.slice(p + 1, j);
      p = j + 1;
      return { t: 's', v };
    }
    const m = /^\d+(?:[.,]\d+)?/.exec(src.slice(p));
    if (m) { p += m[0].length; return { t: 'n', v: Number(m[0].replace(',', '.')) }; }
    if (ch === '-' || ch === '−') { p++; return { t: 'neg', a: pow() }; }
    return fail(p >= src.length ? 'Formula se termină prea devreme' : `Nu înțeleg „${ch}”`);
  };
  const pow = (): QExpr => { const a = prim(); ws(); if (src[p] === '^') { p++; return { t: 'op', o: '^', a, b: pow() }; } return a; };
  const mul = (): QExpr => { let a = pow(); for (;;) { ws(); const o = src[p]; if (o === '*' || o === '/' || o === '×' || o === '÷') { p++; a = { t: 'op', o: o === '×' ? '*' : o === '÷' ? '/' : o, a, b: pow() }; } else return a; } };
  const add = (): QExpr => { let a = mul(); for (;;) { ws(); const o = src[p]; if (o === '+' || o === '-' || o === '−') { p++; a = { t: 'op', o: o === '+' ? '+' : '-', a, b: mul() }; } else return a; } };
  const cat = (): QExpr => { let a = add(); for (;;) { ws(); if (src[p] === '&') { p++; a = { t: 'op', o: '&', a, b: add() }; } else return a; } };
  try {
    if (!src.trim()) return { err: 'Scrie formula' };
    const e = cat();
    ws();
    if (p < src.length) fail(`Nu înțeleg „${src[p]}”`);
    return { e, cols };
  } catch (x) { return { err: (x as Error).message }; }
}
function evalQExpr(e: QExpr, get: (c: string) => QVal): QVal {
  switch (e.t) {
    case 'n': case 's': return e.v;
    case 'c': return get(e.v);
    case 'neg': { const x = num(evalQExpr(e.a, get)); return Number.isNaN(x) ? NaN : -x; }
    default: {
      const a = evalQExpr(e.a, get), b = evalQExpr(e.b, get);
      if (e.o === '&') return `${typeof a === 'number' && Number.isNaN(a) ? '' : a}${typeof b === 'number' && Number.isNaN(b) ? '' : b}`;
      const x = num(String(a).trim() === '' ? 0 : a), y = num(String(b).trim() === '' ? 0 : b);
      if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
      if (e.o === '/' && y === 0) return NaN;
      return e.o === '+' ? x + y : e.o === '-' ? x - y : e.o === '*' ? x * y : e.o === '/' ? x / y : x ** y;
    }
  }
}

/** O valoare de eroare a foii (#DIV/0!, #N/A, #VALUE!…), cum vine din formulele sursei. */
const IS_ERR = /^#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|SPILL!|CALC!|GETTING_DATA)$/i;

/** Mută coloana: la început, la sfârșit, cu un loc la stânga / la dreapta. */
export type QMove = 'first' | 'last' | 'left' | 'right';
export const Q_MOVES: [QMove, string][] = [['first', 'La început'], ['last', 'La sfârșit'], ['left', 'Un loc la stânga'], ['right', 'Un loc la dreapta']];

/** Calcul pe coloană, în locul valorilor: cu un număr (adună, scade, înmulțește, împarte, procent din, la putere, restul împărțirii),
 *  fără număr (valoarea absolută, rădăcina pătrată, semnul schimbat) sau, la text, prefix / sufix. Ce nu se poate calcula
 *  (text la un calcul cu numere) rămâne neatins; împărțirea la 0 și rădăcina unui număr negativ dau o celulă goală. */
export type QMath = 'add' | 'sub' | 'mul' | 'div' | 'pct' | 'pow' | 'mod' | 'abs' | 'sqrt' | 'neg' | 'prefix' | 'suffix';
export const Q_MATHS: [QMath, string][] = [
  ['add', 'Adună'], ['sub', 'Scade'], ['mul', 'Înmulțește cu'], ['div', 'Împarte la'], ['pct', 'Procent din valoare (%)'], ['pow', 'La puterea'],
  ['mod', 'Restul împărțirii la'], ['abs', 'Valoarea absolută'], ['sqrt', 'Rădăcina pătrată'], ['neg', 'Schimbă semnul'],
  ['prefix', 'Adaugă prefix (text în față)'], ['suffix', 'Adaugă sufix (text la urmă)'],
];
/** Calculele care nu cer un număr / text. */
export const Q_MATH_NOARG: QMath[] = ['abs', 'sqrt', 'neg'];

/** Din dată: o coloană nouă, pusă după coloana cu date, cu o parte a datei (anul, luna…). Datele se recunosc ca numere de zi
 *  (ca în foaie) sau ca text „31.10.2026” / „2026-10-31”; ce nu e dată rămâne gol. */
export type QDate = 'year' | 'month' | 'day' | 'quarter' | 'wday' | 'mname' | 'dname' | 'week' | 'som' | 'eom' | 'ym';
export const Q_DATES: [QDate, string][] = [
  ['year', 'Anul'], ['month', 'Luna (număr)'], ['mname', 'Numele lunii'], ['day', 'Ziua'], ['quarter', 'Trimestrul'],
  ['wday', 'Ziua săptămânii (luni = 1)'], ['dname', 'Numele zilei'], ['week', 'Săptămâna din an'], ['ym', 'Anul și luna (2026-10)'],
  ['som', 'Începutul lunii'], ['eom', 'Sfârșitul lunii'],
];
const Q_DATE_COL: Record<QDate, string> = { year: 'An', month: 'Lună', mname: 'Numele lunii', day: 'Zi', quarter: 'Trimestru', wday: 'Ziua săptămânii', dname: 'Numele zilei', week: 'Săptămâna', ym: 'An-lună', som: 'Începutul lunii', eom: 'Sfârșitul lunii' };
const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const DAYS = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'];

/** Rotunjește numerele coloanei la n zecimale (0 = întreg; negativ = la zeci, sute…): la cel mai apropiat, în sus sau în jos. */
export type QRound = 'round' | 'up' | 'down';
export const Q_ROUNDS: [QRound, string][] = [['round', 'La cel mai apropiat'], ['up', 'În sus'], ['down', 'În jos']];

/** Extrage din text (în locul valorii): primele / ultimele N caractere, textul dinainte / de după separator (prima lui apariție;
 *  fără separator rămâne gol) sau lungimea textului. */
export type QExtract = 'first' | 'last' | 'before' | 'after' | 'len';
export const Q_EXTRACTS: [QExtract, string][] = [['first', 'Primele caractere'], ['last', 'Ultimele caractere'], ['before', 'Textul dinainte de separator'], ['after', 'Textul de după separator'], ['len', 'Lungimea textului']];

/** Schimbă tipul coloanei: text (numerele devin text), număr întreg (rotunjit), număr zecimal; ce nu e număr rămâne gol. */
export type QType = 'text' | 'int' | 'dec';
export const Q_TYPES: [QType, string][] = [['text', 'Text'], ['int', 'Număr întreg'], ['dec', 'Număr zecimal']];

/** Formatează textul: MAJUSCULE, litere mici, Prima Literă Mare a fiecărui cuvânt, fără spațiile de la capete și duble. */
export type QCase = 'upper' | 'lower' | 'title' | 'trim';
export const Q_CASES: [QCase, string][] = [['upper', 'MAJUSCULE'], ['lower', 'litere mici'], ['title', 'Prima Literă Mare'], ['trim', 'Fără spații în plus']];

/** Împarte coloana: cel mult atâtea coloane noi. */
export const MAX_SPLIT = 20;

/** Îmbinarea cu alt tabel (ca Merge Queries): „left” = toate rândurile de aici, cu ce se potrivește din celălalt;
 *  „inner” = doar rândurile care se potrivesc; „anti” = doar rândurile de aici fără pereche acolo. */
export type QJoin = 'left' | 'inner' | 'anti';
export const Q_JOINS: [QJoin, string][] = [['left', 'Toate rândurile de aici, cu potrivirile de acolo'], ['inner', 'Doar rândurile care se potrivesc'], ['anti', 'Doar rândurile de aici fără pereche acolo']];
/** Celălalt tabel al unei îmbinări / adăugări, după nume (un tabel cu nume sau o foaie); undefined = nu mai există. */
export type QOther = (name: string) => QTable | undefined;
/** Cel mult atâtea rânduri după o îmbinare (o cheie repetată în ambele tabele înmulțește rândurile). */
export const MAX_QROWS = 100000;

/** Grupează după, pe larg: încă un calcul pentru fiecare grup (pe lângă primul). */
export interface QGroupAgg { agg: QAgg; of?: string }
/** Grupează după: ce se calculează pentru fiecare grup (pe coloana `of`; „count” = câte rânduri are grupul). */
export type QAgg = 'sum' | 'count' | 'avg' | 'min' | 'max';
export const Q_AGGS: [QAgg, string][] = [['sum', 'Sumă'], ['count', 'Număr de rânduri'], ['avg', 'Medie'], ['min', 'Minim'], ['max', 'Maxim']];
/** Coloana calculată: a (coloană) cu b (coloană sau număr / text); „&” lipește textele. */
export type QCalcOp = '+' | '-' | '*' | '/' | '&';
export const Q_CALC_OPS: [QCalcOp, string][] = [['+', '+ adunare'], ['-', '− scădere'], ['*', '× înmulțire'], ['/', '÷ împărțire'], ['&', '& lipește textul']];

/** Interogarea ținută pe foaia rezultatului: foaia sursă, zona (cu capul de tabel pe primul rând) sau tabelul cu nume, pașii.
 *  Cu „file”, sursa e un fișier .csv / .txt sau un registru .xlsx / .ods de pe calculator (citit din nou la reîmprospătare;
 *  din registru foaia „fsheet”), iar „src” e doar numele lui. Un „file” terminat cu \ sau / e un dosar: toate fișierele
 *  .csv / .txt / .xlsx / .xls / .ods din el, unite cu combineTables (din registre foaia „fsheet”, dacă o au). */
export interface SheetQuery { src: string; table?: string; file?: string; fsheet?: string; range: Range; steps: QStep[] }

export type QVal = string | number;
export interface QTable { head: string[]; rows: QVal[][] }

export const MAX_QSTEPS = 30;

/** Citește zona: primul rând = numele coloanelor (goale → „Coloana N”, la fel → „Nume (2)”), restul = valorile afișate. */
export function readQTable(cells: Record<string, string>, results: Record<string, Result>, g: Range): QTable {
  const val = (r: number, c: number): QVal => {
    const id = cellId(r, c), raw = cells[id];
    if (raw === undefined || raw === '') return '';
    const res = results[id];
    if (res) return res.num && res.value !== undefined ? res.value : res.text;
    const t = raw.trim();
    return /^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(t) ? Number(t.replace(',', '.')) : raw;
  };
  const head: string[] = [];
  for (let c = g.c0; c <= g.c1; c++) {
    const base = String(val(g.r0, c)).trim() || `Coloana ${c - g.c0 + 1}`;
    let name = base, n = 2;
    while (head.includes(name)) name = `${base} (${n++})`;
    head.push(name);
  }
  const rows: QVal[][] = [];
  for (let r = g.r0 + 1; r <= g.r1; r++) {
    const row: QVal[] = [];
    for (let c = g.c0; c <= g.c1; c++) row.push(val(r, c));
    rows.push(row);
  }
  return { head, rows };
}

const num = (v: QVal | string): number => (typeof v === 'number' ? v : /^\s*[-+]?(\d+([.,]\d*)?|[.,]\d+)\s*$/.test(v) ? Number(v.replace(',', '.')) : NaN);
/** Fără zgomotul de virgulă mobilă (11.899999999999999 → 11.9), ca în celulele foii. */
const fix = (x: number) => (Number.isFinite(x) ? +x.toPrecision(15) : x);
/** Textul care arată a număr devine număr (ca la citirea din foaie). */
const asVal = (t: string): QVal => (Number.isNaN(num(t)) ? t : num(t));
const low = (v: QVal) => String(v).trim().toLocaleLowerCase('ro-RO');
/** Numărul zilei (ca în foaie, 1 = 31.12.1899) al unei valori: număr de zi sau text „31.10.2026” / „2026-10-31” (cu oră, opțional). */
function dayOf(v: QVal): number | null {
  if (typeof v === 'number') return v >= 1 && v < 2958466 ? Math.floor(v) : null;
  const p = parseDate(v, 'dmy');
  return p ? Math.floor(p.v) : null;
}

function test(v: QVal, op: QOp, w: string): boolean {
  if (op === 'empty') return String(v).trim() === '';
  if (op === 'full') return String(v).trim() !== '';
  if (op === 'has' || op === 'nohas') return low(v).includes(low(w)) === (op === 'has');
  const a = num(v), b = num(w);
  const both = !Number.isNaN(a) && !Number.isNaN(b);
  const cmp = both ? a - b : low(v).localeCompare(low(w), 'ro');
  switch (op) {
    case 'eq': return both ? a === b : low(v) === low(w);
    case 'ne': return both ? a !== b : low(v) !== low(w);
    case 'gt': return cmp > 0;
    case 'lt': return cmp < 0;
    case 'ge': return cmp >= 0;
    default: return cmp <= 0;
  }
}

/** Numele de coloană făcute unice: goale → „Coloana N”, la fel → „Nume (2)”. */
function uniqHead(names: QVal[]): string[] {
  const out: string[] = [];
  names.forEach((v, c) => {
    const base = String(v).trim() || `Coloana ${c + 1}`;
    let nm = base, n = 2;
    while (out.includes(nm)) nm = `${base} (${n++})`;
    out.push(nm);
  });
  return out;
}

/** Trece tabelul prin pași, pe rând. Un pas cu o coloană care nu mai există e sărit și apare în `skipped` (numărul lui, de la 1). */
export function runQuery(t0: QTable, steps: QStep[], other?: QOther): { table: QTable; skipped: number[] } {
  let head = [...t0.head], rows = t0.rows.map((r) => [...r]);
  const skipped: number[] = [];
  steps.forEach((s, i) => {
    const at = 'col' in s ? head.indexOf(s.col) : -1;
    if ('col' in s && at < 0) { skipped.push(i + 1); return; }
    switch (s.k) {
      case 'keep': {
        const idx = s.cols.map((c) => head.indexOf(c)).filter((x) => x >= 0);
        if (!idx.length) { skipped.push(i + 1); return; }
        head = idx.map((x) => head[x]);
        rows = rows.map((r) => idx.map((x) => r[x]));
        break;
      }
      case 'filter': rows = rows.filter((r) => test(r[at], s.op, s.v)); break;
      case 'sort': {
        const k = (v: QVal) => (typeof v === 'number' ? 0 : String(v).trim() === '' ? 2 : 1);
        rows = rows.map((r, n) => ({ r, n })).sort((x, y) => {
          const a = x.r[at], b = y.r[at];
          // Golurile rămân la sfârșit în ambele sensuri; numerele înaintea textului, ca la sortarea din foaie.
          if (k(a) === 2 || k(b) === 2) return k(a) - k(b) || x.n - y.n;
          const d = k(a) - k(b) || (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'ro', { sensitivity: 'base' }));
          return (s.desc ? -d : d) || x.n - y.n;
        }).map((x) => x.r);
        break;
      }
      case 'dedupe': {
        const seen = new Set<string>();
        rows = rows.filter((r) => { const key = JSON.stringify(r.map((v) => (typeof v === 'number' ? v : low(v)))); return seen.has(key) ? false : (seen.add(key), true); });
        break;
      }
      case 'noblank': rows = rows.filter((r) => r.some((v) => String(v).trim() !== '')); break;
      case 'rename': {
        const to = s.to.trim();
        if (!to || head.some((h, n) => n !== at && h === to)) { skipped.push(i + 1); return; }
        head[at] = to;
        break;
      }
      case 'top': rows = rows.slice(0, Math.max(0, Math.floor(s.n))); break;
      case 'group': {
        // Grupurile după coloana aleasă și, pe larg, după încă câteva („by”), cu unul sau mai multe calcule („more”).
        const keys = [at, ...(s.by ?? []).map((x) => head.indexOf(x))];
        const aggs = [{ agg: s.agg, of: s.of }, ...(s.more ?? [])].map((a) => ({ agg: a.agg, of: a.agg === 'count' ? -1 : head.indexOf(a.of ?? '') }));
        if (keys.some((x) => x < 0) || new Set(keys).size < keys.length || aggs.some((a) => a.agg !== 'count' && a.of < 0)) { skipped.push(i + 1); return; }
        // Grupurile în ordinea în care apar; cheia fără majuscule și spații la capete (ca la dubluri).
        const groups = new Map<string, { label: QVal[]; vals: number[][]; n: number }>();
        for (const r of rows) {
          const k = keys.map((j) => (typeof r[j] === 'number' ? String(r[j]) : low(r[j]))).join('\u0001');
          let g = groups.get(k);
          if (!g) { g = { label: keys.map((j) => r[j]), vals: aggs.map(() => []), n: 0 }; groups.set(k, g); }
          g.n++;
          aggs.forEach((a, j) => { if (a.of >= 0) { const x = num(r[a.of]); if (!Number.isNaN(x)) g!.vals[j].push(x); } });
        }
        const calc = (agg: QAgg, v: number[], n: number): QVal => {
          if (agg === 'count') return n;
          if (!v.length) return agg === 'sum' ? 0 : '';
          if (agg === 'sum') return fix(v.reduce((a, b) => a + b, 0));
          if (agg === 'avg') return fix(v.reduce((a, b) => a + b, 0) / v.length);
          return agg === 'min' ? Math.min(...v) : Math.max(...v);
        };
        const names: string[] = keys.map((j) => head[j]);
        for (const a of aggs) {
          const aggName = Q_AGGS.find(([x]) => x === a.agg)![1];
          const base = a.agg === 'count' ? aggName : `${aggName} ${head[a.of]}`;
          let nm = base, m = 2;
          while (names.includes(nm)) nm = `${base} (${m++})`;
          names.push(nm);
        }
        head = names;
        rows = [...groups.values()].map((g) => [...g.label, ...aggs.map((a, j) => calc(a.agg, g.vals[j], g.n))]);
        break;
      }
      case 'calc': {
        const a = head.indexOf(s.a), b = s.bCol ? head.indexOf(s.b) : -1;
        const name = s.name.trim();
        if (a < 0 || (s.bCol && b < 0) || !name || head.includes(name)) { skipped.push(i + 1); return; }
        rows = rows.map((r) => {
          const x = r[a], y: QVal = s.bCol ? r[b] : s.b;
          if (s.op === '&') return [...r, `${x}${y}`];
          const p = num(x), q = num(y);
          if (Number.isNaN(p) || Number.isNaN(q) || (s.op === '/' && q === 0)) return [...r, ''];
          return [...r, fix(s.op === '+' ? p + q : s.op === '-' ? p - q : s.op === '*' ? p * q : p / q)];
        });
        head = [...head, name];
        break;
      }
      case 'replace': {
        if (s.from === '') { skipped.push(i + 1); return; }
        // Toată valoarea (fără majuscule, numerele după valoare) sau fiecare bucată de text la fel cu „from” (fără majuscule).
        const f = s.from.toLocaleLowerCase('ro-RO');
        const swap = (t: string) => {
          const l = t.toLocaleLowerCase('ro-RO');
          let out = '', k = 0, j = l.indexOf(f);
          if (j < 0 || l.length !== t.length) return t.split(s.from).join(s.to);
          while (j >= 0) { out += t.slice(k, j) + s.to; k = j + f.length; j = l.indexOf(f, k); }
          return out + t.slice(k);
        };
        rows = rows.map((r) => r.map((v, n) => {
          if (n !== at) return v;
          if (s.whole) return test(v, 'eq', s.from) ? asVal(s.to) : v;
          const t = String(v), u = swap(t);
          return u === t ? v : asVal(u);
        }));
        break;
      }
      case 'case': {
        const f = (t: string) => {
          if (s.how === 'upper') return t.toLocaleUpperCase('ro-RO');
          if (s.how === 'lower') return t.toLocaleLowerCase('ro-RO');
          if (s.how === 'trim') return t.split(' ').filter((w) => w !== '').join(' ');
          // Prima literă a fiecărui cuvânt mare (și după cratimă: Cluj-Napoca), restul mici.
          let out = '', start = true;
          for (const ch of t.toLocaleLowerCase('ro-RO')) { out += start ? ch.toLocaleUpperCase('ro-RO') : ch; start = ch === ' ' || ch === '-'; }
          return out;
        };
        rows = rows.map((r) => r.map((v, n) => (n === at && typeof v === 'string' ? f(v) : v)));
        break;
      }
      case 'fill': {
        // Celulele goale iau valoarea de deasupra (sau, în sus, de dedesubt), ca la rapoartele cu grupa scrisă o singură dată.
        let last: QVal = '';
        const order = s.up ? [...rows.keys()].reverse() : [...rows.keys()];
        for (const j of order) {
          if (String(rows[j][at]).trim() === '') rows[j][at] = last; else last = rows[j][at];
        }
        break;
      }
      case 'unpivot': {
        // Coloanele alese devin perechi Atribut / Valoare, câte un rând pentru fiecare; celelalte coloane se repetă.
        const idx = s.cols.map((c) => head.indexOf(c)).filter((x) => x >= 0);
        if (!idx.length) { skipped.push(i + 1); return; }
        const rest = head.map((_, n) => n).filter((n) => !idx.includes(n));
        const uniq = (base: string, also: string[] = []) => { let nm = base, m = 2; while (rest.some((n) => head[n] === nm) || also.includes(nm)) nm = `${base} (${m++})`; return nm; };
        const aName = uniq('Atribut'), vName = uniq('Valoare', [aName]);
        const out: QVal[][] = [];
        for (const r of rows) for (const x of idx) {
          if (String(r[x]).trim() === '' || out.length >= MAX_QROWS) continue;
          out.push([...rest.map((n) => r[n]), head[x], r[x]]);
        }
        head = [...rest.map((n) => head[n]), aName, vName];
        rows = out;
        break;
      }
      case 'pivot': {
        // Valorile din coloana „col” devin coloane noi; în fiecare, calculul (sumă, număr…) din coloana „val” pentru rândurile la fel în rest.
        const v = head.indexOf(s.val);
        if (v < 0 || v === at) { skipped.push(i + 1); return; }
        const rest = head.map((_, n) => n).filter((n) => n !== at && n !== v);
        const key = (x: QVal) => (typeof x === 'number' ? String(x) : low(x));
        const cols = new Map<string, QVal>();
        const groups = new Map<string, { keys: QVal[]; cells: Map<string, { vals: number[]; n: number }> }>();
        for (const r of rows) {
          if (String(r[at]).trim() === '') continue;
          const ck = key(r[at]);
          if (!cols.has(ck)) { if (cols.size >= 500) continue; cols.set(ck, r[at]); }
          const gk = JSON.stringify(rest.map((n) => key(r[n])));
          let g = groups.get(gk);
          if (!g) { g = { keys: rest.map((n) => r[n]), cells: new Map() }; groups.set(gk, g); }
          let c = g.cells.get(ck);
          if (!c) { c = { vals: [], n: 0 }; g.cells.set(ck, c); }
          c.n++;
          const x = num(r[v]);
          if (!Number.isNaN(x)) c.vals.push(x);
        }
        const calc = (c?: { vals: number[]; n: number }): QVal => {
          if (!c) return '';
          if (s.agg === 'count') return c.n;
          const a = c.vals;
          if (!a.length) return '';
          if (s.agg === 'sum') return fix(a.reduce((p, q) => p + q, 0));
          if (s.agg === 'avg') return fix(a.reduce((p, q) => p + q, 0) / a.length);
          return s.agg === 'min' ? Math.min(...a) : Math.max(...a);
        };
        const ks = [...cols.keys()];
        head = uniqHead([...rest.map((n) => head[n]), ...ks.map((k) => cols.get(k)!)]);
        rows = [...groups.values()].map((g) => [...g.keys, ...ks.map((k) => calc(g.cells.get(k)))]);
        break;
      }
      case 'transpose': {
        // Rândurile devin coloane: prima coloană dă numele noilor coloane, numele vechi ajung în prima coloană.
        if (!head.length || rows.length > 500) { skipped.push(i + 1); return; }
        const nh = uniqHead([head[0], ...rows.map((r) => r[0])]);
        rows = head.slice(1).map((h, j) => [h, ...rows.map((r) => r[j + 1] ?? '')]);
        head = nh;
        break;
      }
      case 'promote': {
        if (!rows.length) { skipped.push(i + 1); return; }
        head = uniqHead(rows[0]);
        rows = rows.slice(1);
        break;
      }
      case 'cond': {
        // Coloană condițională: „dacă <coloana> <condiția> <valoarea> atunci … altfel …”.
        const name = s.name.trim();
        if (!name || head.includes(name)) { skipped.push(i + 1); return; }
        const a = asVal(s.then), b = asVal(s.else);
        rows = rows.map((r) => [...r, test(r[at], s.op, s.v) ? a : b]);
        head = [...head, name];
        break;
      }
      case 'type': {
        const conv = (v: QVal): QVal => {
          if (s.to === 'text') return typeof v === 'number' ? String(v) : v;
          if (String(v).trim() === '') return '';
          const x = num(v);
          if (Number.isNaN(x)) return '';
          return s.to === 'int' ? Math.round(x) : fix(x);
        };
        rows = rows.map((r) => r.map((v, n) => (n === at ? conv(v) : v)));
        break;
      }
      case 'skip': rows = rows.slice(Math.max(0, Math.floor(s.n))); break;
      case 'skipb': rows = rows.slice(0, Math.max(0, rows.length - Math.max(0, Math.floor(s.n)))); break;
      case 'reverse': rows = rows.reverse(); break;
      case 'drop': {
        // Elimină coloanele bifate (opusul lui „Alege coloanele”); nu se pot scoate toate.
        const keepIdx = head.map((_, j) => j).filter((j) => !s.cols.includes(head[j]));
        if (keepIdx.length === head.length || !keepIdx.length) { skipped.push(i + 1); return; }
        head = keepIdx.map((j) => head[j]);
        rows = rows.map((r) => keepIdx.map((j) => r[j]));
        break;
      }
      case 'custom': {
        const name = s.name.trim();
        const pe = parseQExpr(s.expr);
        if (!name || head.includes(name) || 'err' in pe || pe.cols.some((c) => !head.includes(c))) { skipped.push(i + 1); return; }
        const idx = new Map(pe.cols.map((c) => [c, head.indexOf(c)]));
        rows = rows.map((r) => {
          const v = evalQExpr(pe.e, (c) => r[idx.get(c)!]);
          return [...r, typeof v === 'number' ? (Number.isFinite(v) ? fix(v) : '') : asVal(v)];
        });
        head = [...head, name];
        break;
      }
      case 'noerr': rows = rows.filter((r) => !r.some((v) => typeof v === 'string' && IS_ERR.test(v.trim()))); break;
      case 'range': {
        // Păstrează un interval de rânduri: de la rândul „from” (de la 1), „n” rânduri.
        const a = Math.max(1, Math.floor(s.from)) - 1;
        rows = rows.slice(a, a + Math.max(0, Math.floor(s.n)));
        break;
      }
      case 'keepdup': {
        // Păstrează doar rândurile a căror valoare din coloană apare de cel puțin două ori (ordinea rămâne).
        const key = (v: QVal) => (typeof v === 'number' ? 'n' + v : 's' + low(v));
        const cnt = new Map<string, number>();
        for (const r of rows) cnt.set(key(r[at]), (cnt.get(key(r[at])) ?? 0) + 1);
        rows = rows.filter((r) => (cnt.get(key(r[at])) ?? 0) > 1);
        break;
      }
      case 'move': {
        const to = s.to === 'first' ? 0 : s.to === 'last' ? head.length - 1 : s.to === 'left' ? Math.max(0, at - 1) : Math.min(head.length - 1, at + 1);
        const mv = <T,>(r: T[]) => { const x = [...r]; const [v] = x.splice(at, 1); x.splice(to, 0, v); return x; };
        head = mv(head);
        rows = rows.map(mv);
        break;
      }
      case 'math': {
        const text = s.op === 'prefix' || s.op === 'suffix';
        const w = num(s.v);
        if (!text && !Q_MATH_NOARG.includes(s.op) && Number.isNaN(w)) { skipped.push(i + 1); return; }
        const f = (x: number): number => {
          switch (s.op) {
            case 'add': return x + w;
            case 'sub': return x - w;
            case 'mul': return x * w;
            case 'div': return w === 0 ? NaN : x / w;
            case 'pct': return (x * w) / 100;
            case 'pow': return x ** w;
            case 'mod': return w === 0 ? NaN : x - w * Math.floor(x / w);
            case 'abs': return Math.abs(x);
            case 'sqrt': return x < 0 ? NaN : Math.sqrt(x);
            default: return -x;
          }
        };
        rows = rows.map((r) => r.map((v, k) => {
          if (k !== at || String(v).trim() === '') return v;
          if (text) return s.op === 'prefix' ? s.v + String(v) : String(v) + s.v;
          const x = num(v);
          if (Number.isNaN(x)) return v;
          const y = f(x);
          return Number.isFinite(y) ? fix(y) : '';
        }));
        break;
      }
      case 'mcols': {
        // Îmbină coloanele: valorile lipite cu separatorul (cele goale sar), într-o coloană nouă pusă în locul primei.
        const idx = s.cols.map((x) => head.indexOf(x));
        const name = s.name.trim();
        if (idx.length < 2 || idx.some((x) => x < 0) || !name || head.some((h) => h === name && !s.cols.includes(h))) { skipped.push(i + 1); return; }
        const first = Math.min(...idx);
        const keepAt = head.map((_, j) => j).filter((j) => !idx.includes(j));
        const pos = keepAt.filter((j) => j < first).length;
        const ins = <T,>(r: T[], v: T) => [...r.slice(0, pos), v, ...r.slice(pos)];
        head = ins(keepAt.map((j) => head[j]), name);
        rows = rows.map((r) => ins(keepAt.map((j) => r[j]), idx.map((j) => String(r[j])).filter((t) => t.trim() !== '').join(s.sep) as QVal));
        break;
      }
      case 'dup': {
        // Duplică coloana: copia vine imediat după ea, cu numele „<coloana> - Copie”.
        let nm = `${s.col} - Copie`, m = 2;
        while (head.includes(nm)) nm = `${s.col} - Copie (${m++})`;
        head = [...head.slice(0, at + 1), nm, ...head.slice(at + 1)];
        rows = rows.map((r) => [...r.slice(0, at + 1), r[at], ...r.slice(at + 1)]);
        break;
      }
      case 'round': {
        const n = Math.max(-10, Math.min(10, Math.floor(s.n)));
        if (!Number.isFinite(n)) { skipped.push(i + 1); return; }
        const p = 10 ** n;
        const f = s.how === 'up' ? Math.ceil : s.how === 'down' ? Math.floor : (x: number) => Math.sign(x) * Math.round(Math.abs(x));
        // Textul care nu e număr rămâne neatins; 1e-9 ține deoparte erorile de virgulă mobilă (2.675 → 2.68).
        rows = rows.map((r) => r.map((v, k) => {
          if (k !== at || String(v).trim() === '') return v;
          const x = num(v);
          if (Number.isNaN(x)) return v;
          const y = x * p, adj = s.how === 'up' ? y - 1e-9 : s.how === 'down' ? y + 1e-9 : y + Math.sign(y) * 1e-9;
          return fix(f(adj) / p);
        }));
        break;
      }
      case 'date': {
        let nm = Q_DATE_COL[s.how] ?? 'Dată', m = 2;
        while (head.includes(nm)) nm = `${Q_DATE_COL[s.how]} (${m++})`;
        const part = (v: QVal): QVal => {
          const day = dayOf(v);
          if (day === null) return '';
          const d = new Date(Date.UTC(1899, 11, 30) + day * 86400000);
          const y = d.getUTCFullYear(), mo = d.getUTCMonth(), wd = (d.getUTCDay() + 6) % 7;
          const p2 = (x: number) => String(x).padStart(2, '0');
          const text = (t: Date) => `${p2(t.getUTCDate())}.${p2(t.getUTCMonth() + 1)}.${t.getUTCFullYear()}`;
          switch (s.how) {
            case 'year': return y;
            case 'month': return mo + 1;
            case 'mname': return MONTHS[mo];
            case 'day': return d.getUTCDate();
            case 'quarter': return Math.floor(mo / 3) + 1;
            case 'wday': return wd + 1;
            case 'dname': return DAYS[wd];
            case 'ym': return `${y}-${p2(mo + 1)}`;
            case 'som': return text(new Date(Date.UTC(y, mo, 1)));
            case 'eom': return text(new Date(Date.UTC(y, mo + 1, 0)));
            case 'week': {
              // Săptămâna ISO: cea care conține joia; săptămâna 1 e cea cu 4 ianuarie.
              const th = new Date(d.getTime() + (3 - wd) * 86400000);
              const y1 = Date.UTC(th.getUTCFullYear(), 0, 1);
              return Math.floor((th.getTime() - y1) / 604800000) + 1;
            }
          }
          return '';
        };
        head = [...head.slice(0, at + 1), nm, ...head.slice(at + 1)];
        rows = rows.map((r) => [...r.slice(0, at + 1), part(r[at]), ...r.slice(at + 1)]);
        break;
      }
      case 'extract': {
        const n =Math.max(0, Math.floor(Number(s.v)));
        if ((s.how === 'first' || s.how === 'last') && !Number.isFinite(n)) { skipped.push(i + 1); return; }
        if ((s.how === 'before' || s.how === 'after') && s.v === '') { skipped.push(i + 1); return; }
        const ex = (t: string): QVal => {
          if (s.how === 'len') return [...t].length;
          const ch = [...t];
          if (s.how === 'first') return asVal(ch.slice(0, n).join(''));
          if (s.how === 'last') return asVal(n ? ch.slice(-n).join('') : '');
          const j = t.indexOf(s.v);
          if (j < 0) return '';
          return asVal(s.how === 'before' ? t.slice(0, j) : t.slice(j + s.v.length));
        };
        rows = rows.map((r) => r.map((v, k) => (k === at ? (String(v) === '' ? (s.how === 'len' ? 0 : '') : ex(String(v))) : v)));
        break;
      }
      case 'index': {
        let nm = 'Index', m = 2;
        while (head.includes(nm)) nm = `Index (${m++})`;
        const from = Math.floor(s.from);
        head = [...head, nm];
        rows = rows.map((r, j) => [...r, from + j]);
        break;
      }
      case 'split': {
        if (s.sep === '') { skipped.push(i + 1); return; }
        const parts = rows.map((r) => (String(r[at]) === '' ? [''] : String(r[at]).split(s.sep)));
        const n = Math.min(MAX_SPLIT, Math.max(1, ...parts.map((x) => x.length)));
        // Bucățile de după a n-a rămân lipite în ultima coloană, ca să nu se piardă nimic.
        const cut = parts.map((x) => (x.length > n ? [...x.slice(0, n - 1), x.slice(n - 1).join(s.sep)] : x));
        const names: string[] = [];
        for (let k = 1; k <= n; k++) {
          let nm = `${s.col}.${k}`, m = 2;
          while (head.some((h, j) => j !== at && h === nm) || names.includes(nm)) nm = `${s.col}.${k} (${m++})`;
          names.push(nm);
        }
        head = [...head.slice(0, at), ...names, ...head.slice(at + 1)];
        rows = rows.map((r, j) => [...r.slice(0, at), ...Array.from({ length: n }, (_, k) => asVal((cut[j][k] ?? '').trim())), ...r.slice(at + 1)]);
        break;
      }
      case 'merge': {
        const t2 = other?.(s.src), k2 = t2 ? t2.head.indexOf(s.col2) : -1;
        if (!t2 || k2 < 0) { skipped.push(i + 1); return; }
        const key = (v: QVal) => (typeof v === 'number' ? String(v) : low(v));
        const by = new Map<string, QVal[][]>();
        for (const r of t2.rows) {
          if (String(r[k2]).trim() === '') continue;
          const k = key(r[k2]);
          const l = by.get(k);
          if (l) l.push(r); else by.set(k, [r]);
        }
        if (s.how === 'anti') { rows = rows.filter((r) => !by.has(key(r[at]))); break; }
        // Coloanele aduse: cele alese (fără cheie, dacă lista e goală), cu numele făcut unic față de cele de aici.
        const pickIdx = (s.cols.length ? s.cols : t2.head.filter((_, n) => n !== k2)).map((c) => t2.head.indexOf(c)).filter((x) => x >= 0);
        const names: string[] = [];
        for (const x of pickIdx) {
          let nm = t2.head[x], n = 2;
          while (head.includes(nm) || names.includes(nm)) nm = `${t2.head[x]} (${n++})`;
          names.push(nm);
        }
        const out: QVal[][] = [];
        for (const r of rows) {
          const m = String(r[at]).trim() === '' ? undefined : by.get(key(r[at]));
          if (m) for (const r2 of m) { if (out.length < MAX_QROWS) out.push([...r, ...pickIdx.map((x) => r2[x] ?? '')]); }
          else if (s.how === 'left' && out.length < MAX_QROWS) out.push([...r, ...pickIdx.map(() => '')]);
        }
        head = [...head, ...names];
        rows = out;
        break;
      }
      case 'append': {
        const t2 = other?.(s.src);
        if (!t2) { skipped.push(i + 1); return; }
        // Coloanele se potrivesc după nume; cele care sunt doar dincolo se adaugă la dreapta, goale în rândurile de aici.
        const extra = t2.head.filter((h) => !head.includes(h));
        head = [...head, ...extra];
        rows = rows.map((r) => [...r, ...extra.map(() => '')]);
        const idx = head.map((h) => t2.head.indexOf(h));
        for (const r2 of t2.rows) { if (rows.length >= MAX_QROWS) break; rows.push(idx.map((x) => (x < 0 ? '' : r2[x] ?? ''))); }
        break;
      }
    }
  });
  return { table: { head, rows }, skipped };
}

/** Din dosar: tabelele fișierelor puse unul sub altul, coloanele potrivite după nume (cele noi se adaugă la dreapta),
 *  cu prima coloană „Fișier” = numele fișierului din care vine rândul. Cel mult MAX_FOLDER_ROWS rânduri. */
export const MAX_FOLDER_ROWS = 200000;
export function combineTables(parts: { name: string; t: QTable }[]): QTable {
  const key = (h: string) => h.trim().toLocaleLowerCase('ro-RO');
  let src = 'Fișier', n = 2;
  while (parts.some((p) => p.t.head.some((h) => key(h) === key(src)))) src = `Fișier (${n++})`;
  const head: string[] = [src];
  const at = new Map<string, number>();
  for (const p of parts) for (const h of p.t.head) if (!at.has(key(h))) { at.set(key(h), head.length); head.push(h); }
  const rows: QVal[][] = [];
  for (const p of parts) {
    const idx = p.t.head.map((h) => at.get(key(h))!);
    for (const r of p.t.rows) {
      if (rows.length >= MAX_FOLDER_ROWS) return { head, rows };
      const row: QVal[] = new Array(head.length).fill('');
      row[0] = p.name;
      r.forEach((v, c) => { if (idx[c] !== undefined) row[idx[c]] = v; });
      rows.push(row);
    }
  }
  return { head, rows };
}

/** Rezultatul ca celule de foaie, de la A1: capul îngroșat, numerele ca numere, textul care arată a formulă cu ' în față. */
export function qTableCells(t: QTable): { cells: Record<string, string>; styles: Record<string, CellStyle> } {
  const cells: Record<string, string> = {}, styles: Record<string, CellStyle> = {};
  const put = (r: number, c: number, v: QVal) => {
    if (v === '') return;
    const s = typeof v === 'number' ? String(v) : v;
    cells[cellId(r, c)] = typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : s;
  };
  t.head.forEach((h, c) => { put(0, c, h); styles[cellId(0, c)] = { b: true }; });
  t.rows.forEach((row, r) => row.forEach((v, c) => put(r + 1, c, v)));
  return { cells, styles };
}

/** Descrierea pe scurt a unui pas, pentru lista din fereastră. */
export function stepLabel(s: QStep): string {
  switch (s.k) {
    case 'keep': return `Păstrează coloanele: ${s.cols.join(', ')}`;
    case 'filter': return `Filtrează: ${s.col} ${Q_OPS.find(([o]) => o === s.op)?.[1] ?? ''}${s.op === 'empty' || s.op === 'full' ? '' : ` „${s.v}”`}`;
    case 'sort': return `Sortează după ${s.col}, ${s.desc ? 'descrescător' : 'crescător'}`;
    case 'dedupe': return 'Elimină rândurile dublate';
    case 'noblank': return 'Elimină rândurile goale';
    case 'rename': return `Redenumește ${s.col} în ${s.to}`;
    case 'top': return `Păstrează primele ${s.n} rânduri`;
    case 'group': {
      const one = (a: QGroupAgg) => (a.agg === 'count' ? 'număr de rânduri' : `${Q_AGGS.find(([x]) => x === a.agg)?.[1].toLocaleLowerCase('ro-RO')} din ${a.of}`);
      if (!s.by?.length && !s.more?.length) return s.agg === 'count' ? `Grupează după ${s.col}: număr de rânduri` : `Grupează după ${s.col}: ${Q_AGGS.find(([a]) => a === s.agg)?.[1].toLocaleLowerCase('ro-RO')} din ${s.of}`;
      return `Grupează după ${[s.col, ...(s.by ?? [])].join(', ')}: ${[s, ...(s.more ?? [])].map(one).join('; ')}`;
    }
    case 'calc': return `Coloană nouă ${s.name} = ${s.a} ${s.op === '*' ? '×' : s.op === '/' ? '÷' : s.op === '-' ? '−' : s.op} ${s.bCol ? s.b : `„${s.b}”`}`;
    case 'merge': return s.how === 'anti' ? `Păstrează rândurile fără pereche în ${s.src} (${s.col} = ${s.col2})`
      : s.how === 'inner' ? `Îmbină cu ${s.src} (${s.col} = ${s.col2}, doar potrivirile)${s.cols.length ? `: ${s.cols.join(', ')}` : ''}`
      : `Îmbină cu ${s.src} (${s.col} = ${s.col2})${s.cols.length ? `: ${s.cols.join(', ')}` : ''}`;
    case 'append': return `Adaugă dedesubt rândurile din ${s.src}`;
    case 'replace': return s.whole ? `Înlocuiește în ${s.col} valoarea „${s.from}” cu „${s.to}”` : `Înlocuiește în ${s.col} textul „${s.from}” cu „${s.to}”`;
    case 'split': return `Împarte ${s.col} după „${s.sep}”`;
    case 'case': return `Formatează ${s.col}: ${Q_CASES.find(([h]) => h === s.how)?.[1] ?? ''}`;
    case 'fill': return s.up ? `Umple în sus: ${s.col}` : `Umple în jos: ${s.col}`;
    case 'unpivot': return `Anulează pivotarea coloanelor: ${s.cols.join(', ')}`;
    case 'index': return `Coloană index de la ${s.from}`;
    case 'pivot': return `Pivotează ${s.col}, valorile din ${s.val} (${Q_AGGS.find(([a]) => a === s.agg)?.[1].toLocaleLowerCase('ro-RO') ?? ''})`;
    case 'transpose': return 'Transpune tabelul';
    case 'promote': return 'Folosește primul rând ca nume de coloane';
    case 'skip': return `Elimină primele ${s.n} rânduri`;
    case 'skipb': return `Elimină ultimele ${s.n} rânduri`;
    case 'reverse': return 'Inversează ordinea rândurilor';
    case 'drop': return `Elimină coloanele: ${s.cols.join(', ')}`;
    case 'noerr': return 'Elimină rândurile cu erori';
    case 'custom': return `Coloană personalizată ${s.name} = ${s.expr}`;
    case 'move': return `Mută coloana ${s.col}: ${Q_MOVES.find(([m]) => m === s.to)?.[1].toLocaleLowerCase('ro-RO') ?? ''}`;
    case 'keepdup': return `Păstrează doar dublurile din ${s.col}`;
    case 'range': return `Păstrează ${s.n} rânduri de la rândul ${s.from}`;
    case 'math': return Q_MATH_NOARG.includes(s.op) ? `Calcul pe ${s.col}: ${Q_MATHS.find(([o]) => o === s.op)?.[1].toLocaleLowerCase('ro-RO') ?? ''}`
      : `Calcul pe ${s.col}: ${Q_MATHS.find(([o]) => o === s.op)?.[1].toLocaleLowerCase('ro-RO') ?? ''} „${s.v}”`;
    case 'cond': return `Coloană condițională ${s.name}: dacă ${s.col} ${Q_OPS.find(([o]) => o === s.op)?.[1] ?? ''}${s.op === 'empty' || s.op === 'full' ? '' : ` „${s.v}”`} atunci „${s.then}”, altfel „${s.else}”`;
    case 'type': return `Schimbă tipul: ${s.col} → ${Q_TYPES.find(([t]) => t === s.to)?.[1] ?? ''}`;
    case 'mcols': return s.sep ? `Îmbină coloanele ${s.cols.join(', ')} în ${s.name} (cu „${s.sep}”)` : `Îmbină coloanele ${s.cols.join(', ')} în ${s.name}`;
    case 'dup': return `Duplică coloana ${s.col}`;
    case 'date': return `Din dată: ${s.col} → ${Q_DATES.find(([h]) => h === s.how)?.[1] ?? ''}`;
    case 'round': return `Rotunjește ${s.col} ${s.how === 'up' ? 'în sus ' : s.how === 'down' ? 'în jos ' : ''}la ${s.n} zecimale`;
    case 'extract': return s.how === 'len' ? `Extrage din ${s.col}: lungimea textului`
      : s.how === 'first' || s.how === 'last' ? `Extrage din ${s.col}: ${s.how === 'first' ? 'primele' : 'ultimele'} ${s.v} caractere`
        : `Extrage din ${s.col}: textul ${s.how === 'before' ? 'dinainte de' : 'de după'} „${s.v}”`;
  }
}

/** Pașii citiți dintr-un fișier, curățați (tipuri greșite scoase). */
export function cleanQuery(raw: unknown): SheetQuery | undefined {
  const q = raw as SheetQuery;
  if (!q || typeof q !== 'object' || typeof q.src !== 'string' || !q.range) return undefined;
  const g = q.range;
  const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
  if (![g.r0, g.c0, g.r1, g.c1].every(ok) || g.r1 < g.r0 || g.c1 < g.c0) return undefined;
  const str = (v: unknown) => typeof v === 'string';
  const steps = (Array.isArray(q.steps) ? q.steps : []).filter((s: QStep) => s && (
    (s.k === 'keep' && Array.isArray(s.cols) && s.cols.every(str))
    || (s.k === 'filter' && str(s.col) && Q_OPS.some(([o]) => o === s.op) && str(s.v))
    || (s.k === 'sort' && str(s.col) && typeof s.desc === 'boolean')
    || s.k === 'dedupe' || s.k === 'noblank'
    || (s.k === 'rename' && str(s.col) && str(s.to))
    || (s.k === 'top' && Number.isFinite(s.n))
    || (s.k === 'group' && str(s.col) && Q_AGGS.some(([a]) => a === s.agg) && (s.agg === 'count' || str(s.of))
      && (s.by === undefined || (Array.isArray(s.by) && s.by.every(str)))
      && (s.more === undefined || (Array.isArray(s.more) && s.more.length <= 10 && s.more.every((m: { agg?: unknown; of?: unknown }) => !!m && Q_AGGS.some(([a]) => a === m.agg) && (m.agg === 'count' || str(m.of))))))
    || (s.k === 'calc' && str(s.name) && str(s.a) && Q_CALC_OPS.some(([o]) => o === s.op) && str(s.b) && typeof s.bCol === 'boolean')
    || (s.k === 'merge' && str(s.src) && str(s.col) && str(s.col2) && Q_JOINS.some(([j]) => j === s.how) && Array.isArray(s.cols) && s.cols.every(str))
    || (s.k === 'append' && str(s.src))
    || (s.k === 'replace' && str(s.col) && str(s.from) && str(s.to) && typeof s.whole === 'boolean')
    || (s.k === 'split' && str(s.col) && str(s.sep))
    || (s.k === 'case' && str(s.col) && Q_CASES.some(([h]) => h === s.how))
    || (s.k === 'fill' && str(s.col) && typeof s.up === 'boolean')
    || (s.k === 'unpivot' && Array.isArray(s.cols) && s.cols.length > 0 && s.cols.every(str))
    || (s.k === 'index' && Number.isFinite(s.from))
    || (s.k === 'pivot' && str(s.col) && str(s.val) && Q_AGGS.some(([a]) => a === s.agg))
    || s.k === 'transpose' || s.k === 'promote'
    || (s.k === 'skip' && Number.isFinite(s.n))
    || (s.k === 'skipb' && Number.isFinite(s.n)) || s.k === 'reverse' || s.k === 'noerr'
    || (s.k === 'custom' && str(s.name) && str(s.expr))
    || (s.k === 'drop' && Array.isArray(s.cols) && s.cols.length > 0 && s.cols.every(str))
    || (s.k === 'move' && str(s.col) && Q_MOVES.some(([m]) => m === s.to))
    || (s.k === 'keepdup' && str(s.col))
    || (s.k === 'range' && Number.isFinite(s.from) && Number.isFinite(s.n))
    || (s.k === 'math' && str(s.col) && Q_MATHS.some(([o]) => o === s.op) && str(s.v))
    || (s.k === 'cond' && str(s.name) && str(s.col) && Q_OPS.some(([o]) => o === s.op) && str(s.v) && str(s.then) && str(s.else))
    || (s.k === 'type' && str(s.col) && Q_TYPES.some(([t]) => t === s.to))
    || (s.k === 'mcols' && Array.isArray(s.cols) && s.cols.length > 1 && s.cols.every(str) && str(s.sep) && str(s.name))
    || (s.k === 'extract' && str(s.col) && Q_EXTRACTS.some(([h]) => h === s.how) && str(s.v))
    || (s.k === 'dup' && str(s.col))
    || (s.k === 'date' && str(s.col) && Q_DATES.some(([h]) => h === s.how))
    || (s.k === 'round' && str(s.col) && Q_ROUNDS.some(([h]) => h === s.how) && Number.isFinite(s.n)))).slice(0, MAX_QSTEPS);
  return { src: q.src, ...(str(q.table) ? { table: q.table } : {}), ...(str(q.file) && q.file ? { file: q.file } : {}), ...(str(q.file) && str(q.fsheet) ? { fsheet: q.fsheet } : {}), range: { r0: g.r0, c0: g.c0, r1: g.r1, c1: g.c1 }, steps };
}
