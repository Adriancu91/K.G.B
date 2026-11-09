// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Rezumat (tabel pivot simplu): grupează rândurile unui tabel după o coloană (și, la alegere, după încă una pe orizontală)
// și face suma, numărul sau media unei coloane. Rezultatul e o foaie nouă cu formule SUMIFS/COUNTIFS/AVERAGEIFS
// care se uită la tabelul original, deci cifrele se schimbă singure când schimbi datele.

import { CellStyle, cellId, colName, COLS, ROWS, Sheet, emptySheet } from './format';
import { formatNumber, PivotDef, Result, sheetRef } from './formula';
import type { Range } from './fill';

export type PivotOp = 'sum' | 'count' | 'avg' | 'max' | 'min' | 'product' | 'countnums' | 'stdev' | 'stdevp' | 'var' | 'varp';

export const PIVOT_OPS: [PivotOp, string][] = [['sum', 'Sumă'], ['count', 'Număr'], ['avg', 'Medie'], ['max', 'Maxim'], ['min', 'Minim'],
  ['product', 'Produs'], ['countnums', 'Număr de numere'], ['stdev', 'Deviație standard'], ['stdevp', 'Deviație standard (toată populația)'], ['var', 'Varianță'], ['varp', 'Varianță (toată populația)']];
/** Toate în afară de sumă și număr nu se adună: totalurile lor se calculează din nou pe tot grupul (nu ca sumă a celulelor). */
export const SPREAD = (op: PivotOp) => op !== 'sum' && op !== 'count';
const WHOLE: Record<string, string> = { avg: 'AVERAGE', max: 'MAX', min: 'MIN', product: 'PRODUCT', countnums: 'COUNT', stdev: 'STDEV', stdevp: 'STDEVP', var: 'VAR', varp: 'VARP' };
/** Calculele fără funcție „…IFS”: valorile grupului se aleg cu FILTER, apoi li se aplică funcția întreagă. */
const BYFILTER = (op: PivotOp) => op === 'product' || op === 'countnums' || op === 'stdev' || op === 'stdevp' || op === 'var' || op === 'varp';
/** O condiție a unui grup: coloana, semnul și valoarea (o celulă sau un număr). */
/** O condiție pe o coloană; „in” = valoarea e una din listă (v = lista ca JSON), la grupurile alese de mână. */
type Cond = [string, '=' | '>=' | '<' | 'in', string];

/** Cum se arată valorile (ca Show Values As din Excel): cifrele, procentul din totalul general / al rândului / al coloanei,
 *  totalul cumulat de sus în jos, diferența (sau diferența în procente) față de rândul de deasupra, rangul în coloană. */
export type PivotShow = 'value' | 'pctTotal' | 'pctRow' | 'pctCol' | 'running' | 'diffPrev' | 'pctDiffPrev' | 'index' | 'rankDesc' | 'rankAsc' | 'pctParent' | 'pctRunning' | 'pctOf' | 'diffFrom' | 'pctDiffFrom';
export const PIVOT_SHOWS: [PivotShow, string][] = [['value', 'Cifrele'], ['pctTotal', '% din totalul general'], ['pctRow', '% din totalul rândului'], ['pctCol', '% din totalul coloanei'],
  ['running', 'Total cumulat'], ['pctRunning', '% din totalul cumulat'], ['diffPrev', 'Diferența față de cel anterior'], ['pctDiffPrev', '% diferență față de cel anterior'], ['index', 'Indice'],
  ['rankDesc', 'Rang de la cel mai mare la cel mai mic'], ['rankAsc', 'Rang de la cel mai mic la cel mai mare'], ['pctParent', '% din totalul părintelui'],
  ['pctOf', '% din elementul ales'], ['diffFrom', 'Diferența față de elementul ales'], ['pctDiffFrom', '% diferență față de elementul ales']];
/** Față de un element ales al câmpului de pe rânduri (ca % Of / Difference From cu Base item); fără grupare pe intervale. */
export const BASED = (s: PivotShow | undefined) => s === 'pctOf' || s === 'diffFrom' || s === 'pctDiffFrom';
/** % din totalul părintelui (ca % of Parent Row Total): doar cu mai multe câmpuri pe rânduri; fiecare rând din subtotalul grupului lui. */
export const PARENT = (s: PivotShow | undefined) => s === 'pctParent';
/** Rangul în coloană (1 = cea mai mare valoare, sau cea mai mică); fără grupare pe intervale. */
export const RANKED = (s: PivotShow | undefined) => s === 'rankDesc' || s === 'rankAsc';
/** Cele care merg pe rânduri, de sus în jos (și fără grupare pe coloane). */
export const ROWWISE = (s: PivotShow | undefined) => s === 'running' || s === 'pctRunning' || s === 'diffPrev' || s === 'pctDiffPrev';

/**
 * Gruparea categoriilor de pe rânduri (ca Group Field din Excel): datele calendaristice pe luni, trimestre sau ani,
 * numerele pe intervale de mărimea aleasă (0–99, 100–199…). Fiecare grup e un rând, cu formule pe „de la … până sub …”.
 */
export type PivotGroup = 'month' | 'quarter' | 'year' | number;
export const PIVOT_DATE_GROUPS: ['month' | 'quarter' | 'year', string][] = [['month', 'Luni'], ['quarter', 'Trimestre'], ['year', 'Ani']];

export interface PivotSpec {
  /** Tabelul sursă, cu capul de tabel pe primul rând. */
  range: Range;
  /** Coloana după care se grupează pe rânduri. */
  rowCol: number;
  /** Coloana după care se grupează pe coloane (opțional). */
  colCol?: number;
  /** Coloana cu valorile adunate / numărate. */
  valCol: number;
  op: PivotOp;
  /** Lipsă = cifrele. Procentele merg doar la Sumă și Număr; cele pe rând / coloană doar cu grupare și pe coloane. */
  show?: PivotShow;
  /** Gruparea rândurilor (doar pentru coloane cu date sau numere). */
  group?: PivotGroup;
  /** Totalurile generale (ca Grand Totals): lipsă = 'both'; 'rows' = doar coloana Total din dreapta (totalul fiecărui rând),
   *  'cols' = doar rândul Total de jos (totalul fiecărei coloane), 'none' = fără. */
  totals?: PivotTotals;
  /** Încă valori, fiecare în coloana ei, lângă prima (doar fără grupare pe coloane; se arată ca cifre). */
  more?: PivotValue[];
  /** Câmpuri calculate, după valori (tot doar fără grupare pe coloane și cu valorile arătate ca cifre). */
  calc?: PivotCalc[];
  /** Filtrul de raport (ca Report Filter): coloana după care se poate alege, deasupra rezumatului, o singură valoare (sau toate). */
  filterCol?: number;
  /** Elementele bifate la filtrul de raport („(Mai multe elemente)” în B3): rezumatul ține cont doar de rândurile cu ele. */
  filterItems?: string[];
  /** Al doilea câmp pe rânduri, sub primul (doar fără grupare pe coloane și cu cifrele sau % din totalul general). */
  rowCol2?: number;
  /** Elementul de bază la „% din” / „Diferența față de elementul ales”: o categorie a câmpului de pe rânduri. */
  base?: string;
  /** Al treilea câmp pe rânduri, sub al doilea (doar împreună cu al doilea). */
  rowCol3?: number;
  /** Aspectul raportului cu două câmpuri pe rânduri (ca Report Layout): lipsă = 'compact'. */
  layout?: PivotLayout;
  /** Subtotalurile fiecărui grup al primului câmp (pe rânduri sau, cu două câmpuri pe coloane, pe coloane): lipsă = da. */
  subtotals?: boolean;
  /** Al doilea câmp pe coloane, sub primul (doar cu cifrele sau procentele din total / rând / coloană, un singur câmp pe rânduri). */
  colCol2?: number;
  /** Gruparea coloanelor (datele pe luni / trimestre / ani, numerele pe intervale), doar cu un singur câmp pe coloane. */
  colGroup?: PivotGroup;
  /** Grupurile alese de mână pe rânduri (ca Group Selection din Excel): „Nord” = Cluj + Iași. Doar la un singur câmp pe rânduri,
   *  fără grupare pe date / intervale; categoriile negrupate rămân pe rândul lor. */
  rowGroups?: PivotTextGroup[];
  /** Elementele calculate pe rânduri (ca Calculated Item): un rând nou, sub categorii, cu o formulă din alte rânduri
   *  (de exemplu „Cluj - Iași”), pe fiecare coloană a rezumatului. Nu intră în rândul Total (altfel s-ar număra de două ori).
   *  Doar cu valorile arătate ca cifre, fără al doilea câmp pe rânduri / coloane. */
  calcItems?: PivotCalc[];
  /** Tabelul cu nume din care s-a făcut rezumatul (ca Summarize with PivotTable): la reîmprospătare se ia zona lui de acum. */
  table?: string;
}

export interface PivotTextGroup { name: string; items: string[] }

/** Ce variante „Arată valorile ca” merg cu două câmpuri pe coloane. */
export const COLS2_SHOWS = (s: PivotShow | undefined) => !s || s === 'value' || s === 'pctTotal' || s === 'pctRow' || s === 'pctCol';

/** Compact: ambele câmpuri în coloana A, al doilea retras; Schiță: câte o coloană pe câmp, subtotalul pe rândul grupului;
 *  Tabelar: câte o coloană pe câmp, grupul pe primul lui rând și subtotalul pe un rând „… Total” dedesubt. */
export type PivotLayout = 'compact' | 'outline' | 'tabular';
export const PIVOT_LAYOUTS: [PivotLayout, string][] = [['compact', 'Compact'], ['outline', 'Schiță'], ['tabular', 'Tabelar']];

/** Valoarea filtrului de raport care lasă toate rândurile. */
export const PIVOT_ALL = '(Toate)';
/** Celula în care se alege valoarea filtrului de raport (pe rândul 3, deasupra capului de tabel). */
export const PIVOT_FILTER_CELL = 'B3';
/** Valoarea filtrului de raport care lasă doar rândurile cu elementele bifate la facerea rezumatului. */
export const PIVOT_MULTI = '(Mai multe elemente)';

/** O valoare în plus a rezumatului: coloana și calculul. */
export interface PivotValue { valCol: number; op: PivotOp }
export const MAX_PIVOT_VALUES = 5;
/** Un câmp calculat (ca Calculated Field): numele coloanei noi și formula cu numele coloanelor tabelului, de exemplu Suma / Bucăți. */
export interface PivotCalc { name: string; expr: string }
export const MAX_PIVOT_CALCS = 3;

const isWordChar = (ch: string | undefined) => !!ch && (ch === '_' || (ch >= '0' && ch <= '9') || ch.toLowerCase() !== ch.toUpperCase());

/**
 * Formula unui câmp calculat pentru un grup: fiecare nume de coloană din formulă (scris simplu, ca Suma, sau între
 * apostrofuri, ca 'Preț unitar') devine suma coloanei pe grup, dată de `sumOf`. Textele dintre ghilimele rămân neatinse.
 * Fără niciun nume de coloană recunoscut: null.
 */
export function calcFormula(expr: string, fields: { c: number; name: string }[], sumOf: (c: number) => string): string | null {
  const s = expr.trim().replace(/^=/, '');
  const list = fields.filter((f) => f.name.trim()).sort((a, b) => b.name.length - a.name.length);
  const low = (t: string) => t.toLocaleLowerCase('ro-RO');
  let out = '', used = false, i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"') {
      const j = s.indexOf('"', i + 1);
      const end = j < 0 ? s.length : j + 1;
      out += s.slice(i, end); i = end; continue;
    }
    if (ch === "'") {
      const j = s.indexOf("'", i + 1);
      const f = j < 0 ? undefined : list.find((x) => low(x.name.trim()) === low(s.slice(i + 1, j).trim()));
      // 'Foaia 1'!A1 rămâne trimitere la foaie.
      if (f && s[j + 1] !== '!') { out += sumOf(f.c); used = true; i = j + 1; continue; }
      const end = j < 0 ? s.length : j + 1;
      out += s.slice(i, end); i = end; continue;
    }
    if (isWordChar(ch) && !isWordChar(s[i - 1]) && s[i - 1] !== '.') {
      const f = list.find((x) => {
        const n = x.name.trim();
        const after = s[i + n.length];
        return low(s.slice(i, i + n.length)) === low(n) && !isWordChar(after) && after !== '(' && after !== '!';
      });
      if (f) { out += sumOf(f.c); used = true; i += f.name.trim().length; continue; }
    }
    out += ch; i++;
  }
  return used ? out : null;
}

export type PivotTotals = 'both' | 'rows' | 'cols' | 'none';
export const PIVOT_TOTALS: [PivotTotals, string][] = [['both', 'Pe rânduri și pe coloane'], ['cols', 'Doar rândul Total de jos'], ['rows', 'Doar coloana Total din dreapta'], ['none', 'Fără totaluri']];

export interface PivotOut {
  sheet: Sheet;
  rows: number;
  cols: number;
  /** Categorii care nu au încăput în foaie. */
  cut: boolean;
  /** Definiția pivotului, pentru GETPIVOTDATA. */
  pivot: PivotDef;
  /** Zona cifrelor cu capul de tabel, fără totaluri (pentru graficul pivot), de exemplu „A4:C9”. */
  chartRange: string;
  /** Ultima coloană folosită de rezumat (cu tot cu Total). */
  lastCol: number;
}

const HEAD: CellStyle = { b: true, bg: '#dde7f5', align: 'center' };
const TOTAL: CellStyle = { b: true, bg: '#eef2f7' };

/** Valoarea unei celule pentru grupare: numărul (și din formule) sau textul. Celulele goale nu intră. */
function keyOf(raw: string | undefined, res: Result | undefined): { v: string; num: boolean } | null {
  if (res) {
    if (res.err) return null;
    if (res.num && res.value !== undefined) return { v: formatNumber(res.value), num: true };
    return res.text.trim() ? { v: res.text, num: false } : null;
  }
  const s = (raw ?? '').trim();
  if (!s) return null;
  return /^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(s) ? { v: s, num: true } : { v: s, num: false };
}

/** Categoriile distincte ale unei coloane: întâi numerele crescător, apoi textele în ordine alfabetică românească. */
export function categories(cells: Record<string, string>, results: Record<string, Result>, range: Range, col: number) {
  const seen = new Map<string, { v: string; num: boolean }>();
  for (let r = range.r0 + 1; r <= range.r1; r++) {
    const id = cellId(r, col);
    const k = keyOf(cells[id], results[id]);
    // Un text care începe cu „=” ar deveni formulă în rezumat; îl sărim.
    if (!k || k.v.startsWith('=')) continue;
    const key = k.num ? 'n:' + Number(k.v.replace(',', '.')) : 's:' + k.v.toLocaleLowerCase('ro-RO');
    if (!seen.has(key)) seen.set(key, k);
  }
  const list = [...seen.values()];
  const num = (k: { v: string }) => Number(k.v.replace(',', '.'));
  return list.sort((a, b) => (a.num !== b.num ? (a.num ? -1 : 1) : a.num ? num(a) - num(b) : a.v.localeCompare(b.v, 'ro', { sensitivity: 'base' })));
}

const MONTHS_RO = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const DAY_MS = 86400000;
const EPOCH = Date.UTC(1899, 11, 30); // ziua 0 a datelor, ca în numfmt.ts
/** Ziua 1 a lunii m (0 = ianuarie; 12 = ianuarie anul următor) ca număr de dată. */
const monthStart = (y: number, m: number) => Math.round((Date.UTC(y, m, 1) - EPOCH) / DAY_MS);
const tidy = (n: number) => Math.round(n * 1e9) / 1e9;

/** Un rezumat recomandat: ce se pune în fereastră (fără tabelul sursă) și cum se cheamă pe buton. */
export interface PivotRec { label: string; spec: Omit<PivotSpec, 'range'> }

/**
 * Rezumatele recomandate (cel mult 4), după felul coloanelor: suma primei coloane de numere pe fiecare coloană de text
 * cu puține categorii (2–50), pe luni după prima coloană cu date, pe două coloane de text deodată și numărul de rânduri
 * pe fiecare categorie. `name` = numele coloanei din capul de tabel.
 */
export function recommendPivots(cols: number[], name: (c: number) => string, numeric: (c: number) => boolean, dateCol: (c: number) => boolean, distinct: (c: number) => number): PivotRec[] {
  const dates = cols.filter(dateCol);
  const nums = cols.filter((c) => numeric(c) && !dateCol(c));
  const texts = cols.filter((c) => !numeric(c) && !dateCol(c) && distinct(c) >= 2 && distinct(c) <= 50);
  const q = (c: number) => `„${name(c)}”`;
  const out: PivotRec[] = [];
  const v = nums[nums.length - 1];
  if (v !== undefined) for (const t of texts.slice(0, 2)) out.push({ label: `Suma ${q(v)} pe ${q(t)}`, spec: { rowCol: t, valCol: v, op: 'sum' } });
  if (v !== undefined && dates.length) out.push({ label: `Suma ${q(v)} pe luni`, spec: { rowCol: dates[0], valCol: v, op: 'sum', group: 'month' } });
  if (v !== undefined && texts.length >= 2) out.push({ label: `Suma ${q(v)} pe ${q(texts[0])} și ${q(texts[1])}`, spec: { rowCol: texts[0], colCol: texts[1], valCol: v, op: 'sum' } });
  if (texts.length) out.push({ label: `Câte rânduri are fiecare ${q(texts[0])}`, spec: { rowCol: texts[0], valCol: texts[0], op: 'count' } });
  return out.slice(0, 4);
}

export interface PivotBucket { label: string; lo: number; hi: number }

/** Grupurile unei coloane cu date sau numere: doar cele care au cel puțin o valoare, în ordine crescătoare. */
export function groupBuckets(cells: Record<string, string>, results: Record<string, Result>, range: Range, col: number, g: PivotGroup): PivotBucket[] {
  const vals: number[] = [];
  for (let r = range.r0 + 1; r <= range.r1; r++) {
    const id = cellId(r, col);
    const res = results[id];
    let v: number | null = null;
    if (res) v = !res.err && res.num && res.value !== undefined ? res.value : null;
    else {
      const t = (cells[id] ?? '').trim();
      const n = Number(t.replace(',', '.'));
      if (t && Number.isFinite(n)) v = n;
    }
    if (v !== null && Number.isFinite(v)) vals.push(v);
  }
  const map = new Map<number, PivotBucket>();
  if (typeof g === 'number') {
    const step = g > 0 ? g : 1;
    const ints = Number.isInteger(step) && vals.every(Number.isInteger);
    for (const v of vals) {
      const lo = tidy(Math.floor(tidy(v / step)) * step);
      if (map.has(lo)) continue;
      const hi = tidy(lo + step);
      map.set(lo, { lo, hi, label: ints ? `${formatNumber(lo)}–${formatNumber(hi - 1)}` : `${formatNumber(lo)} – sub ${formatNumber(hi)}` });
    }
  } else {
    for (const v of vals) {
      const d = new Date(EPOCH + Math.floor(v) * DAY_MS);
      const y = d.getUTCFullYear(), m = d.getUTCMonth();
      const b = g === 'month' ? { lo: monthStart(y, m), hi: monthStart(y, m + 1), label: `${MONTHS_RO[m]} ${y}` }
        : g === 'quarter' ? { lo: monthStart(y, m - (m % 3)), hi: monthStart(y, m - (m % 3) + 3), label: `T${Math.floor(m / 3) + 1} ${y}` }
        : { lo: monthStart(y, 0), hi: monthStart(y + 1, 0), label: String(y) };
      if (!map.has(b.lo)) map.set(b.lo, b);
    }
  }
  return [...map.values()].sort((a, b) => a.lo - b.lo);
}

/** Categoria scrisă în celulă (aceeași valoare ca în tabel, ca formula s-o găsească). */
const asCell = (k: { v: string; num: boolean }) => k.v;

export function buildPivot(
  src: { name: string; cells: Record<string, string>; styles: Record<string, CellStyle> },
  results: Record<string, Result>,
  spec: PivotSpec,
  name: string,
): PivotOut {
  const { range, rowCol, colCol, valCol, op } = spec;
  let show: PivotShow = SPREAD(op) || !spec.show || (colCol === undefined && (spec.show === 'pctRow' || spec.show === 'pctCol' || spec.show === 'index')) || (RANKED(spec.show) && spec.group !== undefined)
    || (PARENT(spec.show) && colCol !== undefined) || (BASED(spec.show) && (spec.group !== undefined || spec.base === undefined)) ? 'value' : spec.show;
  // Rândul Total de jos (totalurile coloanelor) și coloana Total din dreapta (totalurile rândurilor, doar cu grupare pe coloane).
  const totals = spec.totals ?? 'both';
  const totRow = totals === 'both' || totals === 'cols', totCol = colCol !== undefined && (totals === 'both' || totals === 'rows');
  const head = (c: number) => (results[cellId(range.r0, c)]?.text ?? src.cells[cellId(range.r0, c)] ?? '').trim() || `coloana ${colName(c)}`;
  const ref = (c: number) => `${sheetRef(src.name)}!$${colName(c)}$${range.r0 + 2}:$${colName(c)}$${range.r1 + 1}`;
  const fnOf = (o: PivotOp) => (o === 'sum' ? 'SUMIFS' : o === 'count' ? 'COUNTIFS' : o === 'max' ? 'MAXIFS' : o === 'min' ? 'MINIFS' : 'AVERAGEIFS');
  // COUNTIFS numără rândurile categoriei (după coloana de grupare), nu doar cele cu număr în coloana de valori.
  const leadOf = (vc: number, o: PivotOp) => (o === 'count' ? '' : `${ref(vc)};`);
  // Filtrul de raport: o coloană a tabelului, alta decât cele de pe rânduri / coloane; valoarea aleasă stă în B3.
  // Al doilea câmp pe rânduri: o altă coloană a tabelului, doar fără grupare pe coloane și cu cifrele (sau % din totalul general).
  const r2 = spec.rowCol2 !== undefined && spec.rowCol2 >= range.c0 && spec.rowCol2 <= range.c1 && spec.rowCol2 !== rowCol && colCol === undefined
    && (show === 'value' || show === 'pctTotal' || show === 'pctParent') ? spec.rowCol2 : undefined;
  // Cu un singur câmp pe rânduri, părintele fiecărui rând e totalul general.
  if (show === 'pctParent' && r2 === undefined) show = 'pctTotal';
  // Al doilea câmp pe coloane: doar împreună cu primul, cu un singur câmp pe rânduri și cu procentele simple.
  const c2 = colCol !== undefined && spec.colCol2 !== undefined && spec.colCol2 >= range.c0 && spec.colCol2 <= range.c1 && spec.colCol2 !== rowCol
    && spec.colCol2 !== colCol && COLS2_SHOWS(show) && spec.colGroup === undefined ? spec.colCol2 : undefined;
  const r3 = r2 !== undefined && spec.rowCol3 !== undefined && spec.rowCol3 >= range.c0 && spec.rowCol3 <= range.c1 && spec.rowCol3 !== rowCol && spec.rowCol3 !== r2 ? spec.rowCol3 : undefined;
  const fc = spec.filterCol !== undefined && spec.filterCol >= range.c0 && spec.filterCol <= range.c1 && spec.filterCol !== rowCol && spec.filterCol !== colCol && spec.filterCol !== c2 && spec.filterCol !== r2 && spec.filterCol !== r3 ? spec.filterCol : undefined;
  const FV = '$B$3';
  // „(Toate)” = criteriul „diferit de (Toate)”, care se potrivește cu orice celulă, și cu cele goale.
  const fPair = fc === undefined ? '' : `${ref(fc)};IF(${FV}="${PIVOT_ALL}";"<>${PIVOT_ALL}";${FV})`;
  // Mai multe elemente bifate: în B3 apare „(Mai multe elemente)”, iar toate calculele trec prin FILTER (SUMIFS nu poate
  // primi o listă pentru filtru și una pentru grup în același timp).
  const fItems = fc === undefined ? [] : [...new Set((spec.filterItems ?? []).filter((x) => x !== ''))].slice(0, 499);
  const multi = fItems.length > 0;
  // Un element care e un număr întreg (un an, un cod) se potrivește și cu celulele cu numărul, nu doar cu textul lui.
  const fItem = (x: string) => `(${ref(fc!)}="${x.replace(/"/g, '""')}")` + (/^-?\d{1,15}$/.test(x) ? `+(${ref(fc!)}=${x})` : '');
  const fMul = fc === undefined ? '' : `(((${FV}="${PIVOT_ALL}")+(${ref(fc)}=${FV})${multi ? `+(${FV}="${PIVOT_MULTI}")*(${fItems.map(fItem).join('+')})` : ''})>0)`;
  // Formula pentru un grup (fără „=”): SUMIFS & co. cu perechi coloană;criteriu, sau FUNCȚIE(FILTER(valori; condiții)).
  // La FILTER, celulele goale din coloana valorilor nu intră; un grup fără valori rămâne gol.
  // Un grup ales de mână („in”): la Sumă / Număr, SUMIFS cu lista de criterii dă câte un rezultat pe element, iar SUM le adună;
  // la celelalte calcule se trece prin FILTER, cu „(col="a")+(col="b")” ca să intre rândurile oricărui element.
  const items = (v: string) => (JSON.parse(v) as string[]).map((x) => `"${x.replace(/"/g, '""')}"`);
  const aggOf = (conds: Cond[], vc: number, o: PivotOp): string => {
    const anyIn = conds.some(([, s]) => s === 'in');
    const cond = conds.map(([r, s, v]) => (s === 'in' ? `(${items(v).map((x) => `(${r}=${x})`).join('+')})` : `(${r}${s}${v})`)).join('*');
    // Cu mai multe elemente la filtru, Suma și Număr dau 0 la un grup fără rânduri, ca SUMIFS / COUNTIFS.
    if (multi && o === 'count') return `IFERROR(ROWS(FILTER(${ref(vc)};${cond}*${fMul}));0)`;
    if (multi && o === 'sum') return `IFERROR(SUM(FILTER(${ref(vc)};${cond}*${fMul}*(${ref(vc)}<>"")));0)`;
    if (BYFILTER(o) || multi || (anyIn && o !== 'sum' && o !== 'count')) {
      const w = WHOLE[o];
      return `IFERROR(${w}(FILTER(${ref(vc)};${cond}${fMul ? '*' + fMul : ''}*(${ref(vc)}<>"")));"")`;
    }
    const f = `${fnOf(o)}(${leadOf(vc, o)}${conds.map(([r, s, v]) => (s === '=' ? `${r};${v}` : s === 'in' ? `${r};{${items(v).join(';')}}` : `${r};"${s}${formatNumber(Number(v))}"`)).join(';')}${fPair ? ';' + fPair : ''})`;
    return anyIn ? `SUM(${f})` : f;
  };
  const agg = (conds: Cond[]) => aggOf(conds, valCol, op);
  // Toată coloana (la totaluri), cu filtrul de raport dacă e pus.
  const whole = (o: PivotOp, vc: number) => (fc === undefined ? `${WHOLE[o]}(${ref(vc)})` : `IFERROR(${WHOLE[o]}(FILTER(${ref(vc)};${fMul}*(${ref(vc)}<>"")));"")`);
  const sumAll = (vc: number) => (fc === undefined ? `SUM(${ref(vc)})` : multi ? `IFERROR(SUM(FILTER(${ref(vc)};${fMul}*(${ref(vc)}<>"")));0)` : `SUMIFS(${ref(vc)};${fPair})`);
  // Numărul tuturor rândurilor cu o categorie pe rânduri (la totaluri), cu filtrul de raport.
  const countRows = () => (multi ? `IFERROR(ROWS(FILTER(${ref(rowCol)};(${ref(rowCol)}<>"")*${fMul}));0)` : `COUNTIFS(${ref(rowCol)};"<>"${fPair ? ';' + fPair : ''})`);
  const nameOf = (o: PivotOp) => PIVOT_OPS.find(([k]) => k === o)![1];
  const opName = nameOf(op);
  // Valorile în plus: doar fără grupare pe coloane și fără procente (ca să rămână un tabel simplu, o coloană pe valoare).
  // Cu grupare pe coloane (un singur câmp acolo), fiecare categorie are câte o coloană pe valoare.
  const more = c2 === undefined && show === 'value' ? (spec.more ?? []).filter((m) => m.valCol >= range.c0 && m.valCol <= range.c1).slice(0, MAX_PIVOT_VALUES - 1) : [];
  // Câmpurile calculate: numele coloanelor din formulă devin sumele lor pe grup (pe tot tabelul la rândul Total).
  const fields = Array.from({ length: range.c1 - range.c0 + 1 }, (_, i) => ({ c: range.c0 + i, name: head(range.c0 + i) }));
  const calcs = c2 === undefined && show === 'value' ? (spec.calc ?? []).slice(0, MAX_PIVOT_CALCS)
    .map((k) => ({ name: k.name.trim(), at: (conds: Cond[] | null) => calcFormula(k.expr, fields, (c) => (conds ? aggOf(conds, c, 'sum') : sumAll(c))) }))
    .filter((k) => k.name && k.at(null) !== null) : [];

  const cells: Record<string, string> = {};
  const styles: Record<string, CellStyle> = {};
  const set = (r: number, c: number, v: string, st?: CellStyle) => {
    if (v !== '') cells[cellId(r, c)] = v;
    if (st) styles[cellId(r, c)] = st;
  };
  // Formatul valorilor (de exemplu lei) vine de la prima valoare din coloană.
  const fmtOf = (vc: number): CellStyle | undefined => {
    for (let r = range.r0 + 1; r <= range.r1; r++) {
      const st = src.styles[cellId(r, vc)];
      if (st?.fmt && st.fmt !== 'date') return { fmt: st.fmt, ...(st.dec !== undefined ? { dec: st.dec } : {}) };
    }
    return undefined;
  };
  const valStyle = fmtOf(valCol);
  const PCT: CellStyle = { fmt: 'percent', dec: 1 };
  const vst = RANKED(show) ? undefined : show === 'index' ? { fmt: 'number' as const, dec: 2 } : show === 'running' || show === 'diffPrev' || show === 'diffFrom' ? (op === 'count' ? undefined : valStyle) : show !== 'value' ? PCT : op === 'count' ? undefined : valStyle;
  const rowFmt = spec.group !== undefined ? undefined : src.styles[cellId(range.r0 + 1, rowCol)]?.fmt === 'date' ? { fmt: 'date' as const } : undefined;

  const buckets = spec.group !== undefined ? groupBuckets(src.cells, results, range, rowCol, spec.group) : null;
  const cats = buckets ? buckets.map((b) => ({ v: b.label, num: false })) : categories(src.cells, results, range, rowCol);
  // Grupurile alese de mână: fiecare ia locul primului său element; o categorie stă într-un singur grup (primul care o numește).
  const lo = (s: string) => s.trim().toLocaleLowerCase('ro-RO');
  const tgs = !buckets && r2 === undefined && !RANKED(show) && !BASED(show)
    ? (spec.rowGroups ?? []).map((g) => ({ name: g.name.trim(), items: g.items.map(lo).filter(Boolean) })).filter((g) => g.name && !g.name.startsWith('=') && g.items.length) : [];
  const owner = new Map<string, number>();
  tgs.forEach((g, n) => g.items.forEach((x) => { if (!owner.has(x)) owner.set(x, n); }));
  const all: { v: string; num: boolean; members?: string[] }[] = [];
  const placed = new Set<number>();
  for (const k of cats) {
    const n = owner.get(lo(k.v));
    if (n === undefined) { all.push(k); continue; }
    if (placed.has(n)) continue;
    placed.add(n);
    all.push({ v: tgs[n].name, num: false, members: cats.filter((x) => owner.get(lo(x.v)) === n).map((x) => x.v) });
  }
  const maxRows = ROWS - 5;
  const rowsK = all.slice(0, maxRows);
  // Condiția unui rând de grup ales de mână (lista elementelor lui), sau null la o categorie simplă.
  const memberCond = (i: number): Cond[] | null => {
    const m = rowsK[i]?.members;
    return m ? [[ref(rowCol), 'in', JSON.stringify(m)]] : null;
  };
  // Coloanele grupate: fiecare grup e un interval „de la lo până sub hi” al câmpului de pe coloane.
  const cbuckets = colCol !== undefined && c2 === undefined && spec.colGroup !== undefined ? groupBuckets(src.cells, results, range, colCol, spec.colGroup) : null;
  const colsAll = colCol === undefined ? [] : cbuckets ? cbuckets.map((b) => ({ v: b.label, num: false })) : categories(src.cells, results, range, colCol);
  // Condițiile coloanei j: intervalul grupului sau eticheta din capul coloanei (cc = litera ei; abs = cu $).
  const colCs = (j: number, cc: string, abs = false): Cond[] => {
    const b = cbuckets?.[j];
    return b ? [[ref(colCol!), '>=', String(b.lo)], [ref(colCol!), '<', String(b.hi)]] : [[ref(colCol!), '=', abs ? `$${cc}$${H + 1}` : `${cc}${H + 1}`]];
  };
  const colsK = colsAll.slice(0, COLS - 2);
  const cut = all.length > rowsK.length || colsAll.length > colsK.length;

  const showName = (show === 'value' ? '' : ` (${PIVOT_SHOWS.find(([k]) => k === show)![1]})`)
    + (spec.group === undefined ? '' : typeof spec.group === 'number' ? `, pe intervale de ${formatNumber(spec.group)}` : `, pe ${PIVOT_DATE_GROUPS.find(([k]) => k === spec.group)![1].toLocaleLowerCase('ro-RO')}`);
  const rowsName = `„${head(rowCol)}”${r2 === undefined ? '' : r3 === undefined ? ` și „${head(r2)}”` : `, „${head(r2)}” și „${head(r3)}”`}`;
  set(0, 0, more.length ? `Rezumat pe ${rowsName}${colCol !== undefined ? ` și „${head(colCol)}”` : ''}: ${[{ valCol, op }, ...more].map((m) => `${nameOf(m.op)} din „${head(m.valCol)}”`).join(', ')}${showName}` : `${opName} din „${head(valCol)}” pe ${rowsName}${colCol !== undefined ? ` și „${head(colCol)}”${c2 !== undefined ? ` / „${head(c2)}”` : ''}` : ''}${showName}`, { b: true });
  set(1, 0, `Din foaia „${src.name}”, ${colName(range.c0)}${range.r0 + 1}:${colName(range.c1)}${range.r1 + 1}. Cifrele se schimbă singure; pentru categorii noi fă din nou rezumatul.`, { i: true, color: '#666666' });
  const H = 3; // rândul capului de tabel (al 4-lea)
  const lists = fc === undefined ? [] : [{ range: PIVOT_FILTER_CELL, values: [PIVOT_ALL, ...(multi ? [PIVOT_MULTI] : []), ...categories(src.cells, results, range, fc).map((k) => k.v).filter((v) => v !== '').slice(0, 499)] }];
  if (fc !== undefined) { set(2, 0, head(fc), HEAD); set(2, 1, multi ? PIVOT_MULTI : PIVOT_ALL, { bg: '#fff7d6', b: true }); if (multi) set(2, 2, `${PIVOT_MULTI} = ${fItems.join(', ')}`, { i: true, color: '#666666' }); }
  set(H, 0, head(rowCol), HEAD);
  const first = H + 1;
  const last = first + rowsK.length - 1;
  const tot = last + 1;
  // Cu grupare, rândul r ia valorile „de la lo până sub hi” ale grupului lui; altfel pe cele egale cu eticheta din coloana A.
  const crit = (r: number): Cond[] => {
    const b = buckets?.[r - first];
    const m = memberCond(r - first);
    return m ?? (b ? [[ref(rowCol), '>=', String(b.lo)], [ref(rowCol), '<', String(b.hi)]] : [[ref(rowCol), '=', `$A${r + 1}`]]);
  };
  // Totalul general (numitorul la „% din totalul general”): suma coloanei de valori sau numărul rândurilor cu categorie.
  const grand = op === 'count' ? (buckets && fc === undefined ? `COUNT(${ref(rowCol)})` : countRows()) : sumAll(valCol);
  const pct = (f: string, den: string) => `=IFERROR(${f}/${den};0)`;
  // Pe rânduri, de sus în jos: f = valoarea rândului, prev = a rândului de deasupra (lipsă la primul), above = celula de deasupra.
  // Primul rând nu are cu ce se compara, deci la diferențe rămâne gol.
  // La „% din totalul cumulat” (ca % Running Total In): procentul de deasupra plus partea rândului din totalul den (al coloanei sau general).
  const step = (f: string, prev: string | null, above: string, den = grand) => show === 'running' ? (prev === null ? '=' + f : `=${above}+${f}`)
    : show === 'pctRunning' ? (prev === null ? pct(f, den) : `=${above}+IFERROR(${f}/${den};0)`)
    : prev === null ? '' : show === 'diffPrev' ? `=${f}-(${prev})` : `=IFERROR(${f}/(${prev})-1;"")`;
  const rowwise = ROWWISE(show);
  // Rangul: 1 + câte categorii din coloană au valoarea mai mare (sau mai mică); valorile lor, cu MAP peste etichetele din coloana A.
  const ranked = RANKED(show);
  const rank = (f: string, extra: Cond[]) => `=1+SUM(--(MAP($A$${first + 1}:$A$${last + 1};LAMBDA(k;${agg([[ref(rowCol), '=', 'k'], ...extra])}))${show === 'rankDesc' ? '>' : '<'}(${f})))`;
  // Față de elementul ales: rândul lui (cu eticheta în coloana A) e baza; la diferență, rândul bazei rămâne gol, ca și totalurile.
  const baseIdx = BASED(show) ? rowsK.findIndex((k) => k.v === spec.base) : -1;
  const based = BASED(show) && baseIdx >= 0;
  const vsBase = (f: string, r: number, extra: Cond[]) => {
    const b = agg([[ref(rowCol), '=', `$A${first + baseIdx + 1}`], ...extra]);
    return show === 'pctOf' ? pct(f, `(${b})`) : r === first + baseIdx ? '' : show === 'pctDiffFrom' ? `=IFERROR(${f}/(${b})-1;"")` : `=${f}-(${b})`;
  };
  const blankTot = rowwise || ranked || based;
  // Ce s-a folosit pe foaie (la două câmpuri pe rânduri se schimbă: rânduri de subtotal, încă o coloană de etichete).
  let used = rowsK.length, endRow = totRow ? tot : last, chartEnd = Math.max(last, first), lastC2: number | null = null, cut2 = false, chartTop = H;
  // Rândurile categoriilor (primul și ultimul), unde se caută elementele calculate; null = aspect fără elemente calculate.
  let itemRows: [number, number] | null = [first, last];

  if (colCol !== undefined && (more.length || calcs.length)) {
    // Mai multe valori (sau câmpuri calculate) cu grupare pe coloane: pe primul rând de cap categoriile, pe al doilea numele
    // valorilor (câte o coloană pe valoare în fiecare categorie), apoi coloanele Total, câte una pe valoare.
    const H2 = H + 1, f0 = H + 2;
    const countAll = buckets && fc === undefined ? `COUNT(${ref(rowCol)})` : countRows();
    // Fiecare valoare: numele din cap, formatul, formula pe un grup de condiții și cea pe tot tabelul (colțul Total).
    const vals = [
      ...[{ valCol, op }, ...more].map((m) => ({
        name: `${nameOf(m.op)} din ${head(m.valCol)}`, st: m.op === 'count' ? undefined : fmtOf(m.valCol),
        at: (conds: Cond[]) => aggOf(conds, m.valCol, m.op), all: SPREAD(m.op) ? whole(m.op, m.valCol) : m.op === 'count' ? countAll : sumAll(m.valCol),
      })),
      ...calcs.map((k) => ({ name: k.name, st: undefined as CellStyle | undefined, at: (conds: Cond[]) => k.at(conds)!, all: k.at(null)! })),
    ];
    const fmtA = !cbuckets && src.styles[cellId(range.r0 + 1, colCol)]?.fmt === 'date' ? { fmt: 'date' as const } : {};
    const fit = Math.max(0, Math.floor((COLS - 2) / vals.length) - (totCol ? 1 : 0));
    if (colsK.length > fit) cut2 = true;
    const cols: { c: number; k: number; conds: Cond[] }[] = [];
    let c = 1;
    colsK.slice(0, fit).forEach((cat, j) => {
      const g = colName(c);
      set(H, c, asCell(cat), { ...HEAD, ...fmtA, align: 'left' });
      vals.forEach((m, k) => {
        if (k) set(H, c, '', HEAD);
        set(H2, c, m.name, HEAD);
        cols.push({ c, k, conds: colCs(j, g, true) });
        c++;
      });
    });
    const tc = c;
    if (totCol) vals.forEach((m, k) => { set(H, tc + k, k ? '' : 'Total', HEAD); set(H2, tc + k, m.name, HEAD); });
    delete cells[cellId(H, 0)];
    set(H, 0, '', HEAD);
    set(H2, 0, head(rowCol), HEAD);
    const rowC = (i: number, r: number): Cond[] => {
      const b = buckets?.[i];
      return memberCond(i) ?? (b ? [[ref(rowCol), '>=', String(b.lo)], [ref(rowCol), '<', String(b.hi)]] : [[ref(rowCol), '=', `$A${r + 1}`]]);
    };
    rowsK.forEach((cat, i) => {
      const r = f0 + i;
      set(r, 0, asCell(cat), rowFmt);
      const rc = rowC(i, r);
      cols.forEach((x) => set(r, x.c, '=' + vals[x.k].at([...rc, ...x.conds]), vals[x.k].st));
      if (totCol) vals.forEach((m, k) => set(r, tc + k, '=' + m.at(rc), { ...TOTAL, ...m.st }));
    });
    const lastR = f0 + rowsK.length - 1;
    if (totRow) {
      const t = lastR + 1;
      set(t, 0, 'Total', TOTAL);
      cols.forEach((x) => set(t, x.c, '=' + vals[x.k].at(x.conds), { ...TOTAL, ...vals[x.k].st }));
      if (totCol) vals.forEach((m, k) => set(t, tc + k, '=' + m.all, { ...TOTAL, ...m.st }));
    }
    used = rowsK.length;
    chartTop = H2;
    chartEnd = Math.max(lastR, f0);
    endRow = totRow ? lastR + 1 : lastR;
    lastC2 = Math.max(1, (totCol ? tc + vals.length : tc) - 1);
    itemRows = [f0, lastR];
  } else if (c2 !== undefined) {
    itemRows = null;
    // Două rânduri de cap: pe primul valorile primului câmp de pe coloane (pe prima coloană a grupului lor), pe al doilea
    // valorile celui de-al doilea; după fiecare grup, coloana „… Total” (subtotalul), apoi coloana Total din dreapta.
    const sub = spec.subtotals !== false;
    const H2 = H + 1, f0 = H + 2;
    const norm = (k: { v: string; num: boolean }) => (k.num ? 'n:' + Number(k.v.replace(',', '.')) : 's:' + k.v.toLocaleLowerCase('ro-RO'));
    const pairs = new Map<string, Set<string>>();
    for (let r = range.r0 + 1; r <= range.r1; r++) {
      const a = cellId(r, colCol!), b = cellId(r, c2);
      const ka = keyOf(src.cells[a], results[a]), kb = keyOf(src.cells[b], results[b]);
      if (!ka || !kb) continue;
      if (!pairs.has(norm(ka))) pairs.set(norm(ka), new Set());
      pairs.get(norm(ka))!.add(norm(kb));
    }
    const inner = categories(src.cells, results, range, c2);
    const fmtA = src.styles[cellId(range.r0 + 1, colCol!)]?.fmt === 'date' ? { fmt: 'date' as const } : {};
    const fmtB = src.styles[cellId(range.r0 + 1, c2)]?.fmt === 'date' ? { fmt: 'date' as const } : {};
    // Coloanele: condițiile fiecăreia (grupul, sau grupul și valoarea celui de-al doilea câmp).
    const cols: { c: number; conds: Cond[]; sub: boolean }[] = [];
    let c = 1;
    for (const k of colsAll) {
      const has = pairs.get(norm(k));
      const inn = has ? inner.filter((x) => has.has(norm(x))) : [];
      if (!inn.length) continue;
      if (c + inn.length + (sub ? 1 : 0) > COLS - 2) { cut2 = true; break; }
      const g = colName(c);
      const outer: Cond = [ref(colCol!), '=', `$${g}$${H + 1}`];
      set(H, c, asCell(k), { ...HEAD, ...fmtA, align: 'left' });
      inn.forEach((x, j) => {
        if (j) set(H, c, '', HEAD);
        set(H2, c, asCell(x), { ...HEAD, ...fmtB });
        cols.push({ c, conds: [outer, [ref(c2), '=', `${colName(c)}$${H2 + 1}`]], sub: false });
        c++;
      });
      if (sub) {
        set(H, c, `${k.v} Total`, HEAD); set(H2, c, '', HEAD);
        cols.push({ c, conds: [outer], sub: true });
        c++;
      }
    }
    const tc = c;
    // În colț, deasupra etichetelor rândurilor: ce se calculează (ca în capul tabelului cu un singur câmp pe coloane).
    set(H, 0, `${opName} din ${head(valCol)}`, HEAD);
    set(H2, 0, head(rowCol), HEAD);
    if (totCol) { set(H, tc, 'Total', HEAD); set(H2, tc, '', HEAD); }
    const SUB: CellStyle = { b: true, bg: '#f4f6fa' };
    const rowC = (i: number, r: number): Cond[] => {
      const b = buckets?.[i];
      return memberCond(i) ?? (b ? [[ref(rowCol), '>=', String(b.lo)], [ref(rowCol), '<', String(b.hi)]] : [[ref(rowCol), '=', `$A${r + 1}`]]);
    };
    // O celulă: f = valoarea; rowDen / colDen = totalul rândului / coloanei ei (numitorii procentelor).
    const cell = (f: string, rowDen: string, colDen: string) => show === 'pctTotal' ? pct(f, grand) : show === 'pctRow' ? pct(f, `(${rowDen})`) : show === 'pctCol' ? pct(f, `(${colDen})`) : '=' + f;
    const all = SPREAD(op) ? whole(op, valCol) : grand;
    rowsK.forEach((k, i) => {
      const r = f0 + i;
      set(r, 0, asCell(k), rowFmt);
      const rc = rowC(i, r);
      cols.forEach((x) => set(r, x.c, cell(agg([...rc, ...x.conds]), agg(rc), agg(x.conds)), x.sub ? { ...SUB, ...vst } : vst));
      if (totCol) set(r, tc, cell(agg(rc), agg(rc), all), { ...TOTAL, ...vst });
    });
    const lastR = f0 + rowsK.length - 1;
    if (totRow) {
      const t = lastR + 1;
      set(t, 0, 'Total', TOTAL);
      cols.forEach((x) => set(t, x.c, cell(agg(x.conds), all, agg(x.conds)), { ...TOTAL, ...vst }));
      if (totCol) set(t, tc, show === 'value' ? '=' + all : pct(all, all), { ...TOTAL, ...vst });
    }
    used = rowsK.length;
    chartTop = H2;
    chartEnd = Math.max(lastR, f0);
    endRow = totRow ? lastR + 1 : lastR;
    lastC2 = Math.max(1, totCol ? tc : tc - 1);
  } else if (r2 !== undefined) {
    itemRows = null;
    const layout: PivotLayout = spec.layout ?? 'compact';
    const sub = spec.subtotals !== false;
    const ic = layout === 'compact' ? 0 : 1; // coloana etichetelor celui de-al doilea câmp
    const ic3 = layout === 'compact' ? 0 : 2; // și a celui de-al treilea
    const v0 = layout === 'compact' ? 1 : r3 !== undefined ? 3 : 2; // prima coloană de valori
    const icc = colName(ic), icc3 = colName(ic3);
    const norm = (k: { v: string; num: boolean }) => (k.num ? 'n:' + Number(k.v.replace(',', '.')) : 's:' + k.v.toLocaleLowerCase('ro-RO'));
    // Perechile care există în tabel: grupul primului câmp → valorile celui de-al doilea;
    // cu trei câmpuri și (grup, valoarea celui de-al doilea) → valorile celui de-al treilea.
    const pairs = new Map<string, Set<string>>();
    const triples = new Map<string, Set<string>>();
    for (let r = range.r0 + 1; r <= range.r1; r++) {
      const a = cellId(r, rowCol), b = cellId(r, r2);
      const kb = keyOf(src.cells[b], results[b]);
      if (!kb) continue;
      let kc: string | null = null;
      if (r3 !== undefined) {
        const c3 = cellId(r, r3);
        const k3 = keyOf(src.cells[c3], results[c3]);
        if (!k3) continue;
        kc = norm(k3);
      }
      let ka: string | null = null;
      if (buckets) {
        const ra = results[a];
        const n = ra ? (!ra.err && ra.num ? ra.value : undefined) : Number((src.cells[a] ?? '').trim().replace(',', '.'));
        const bk = n !== undefined && (src.cells[a] ?? '').trim() !== '' ? buckets.find((x) => n >= x.lo && n < x.hi) : undefined;
        ka = bk ? 'g:' + bk.lo : null;
      } else {
        const k = keyOf(src.cells[a], results[a]);
        ka = k ? norm(k) : null;
      }
      if (ka === null) continue;
      if (!pairs.has(ka)) pairs.set(ka, new Set());
      pairs.get(ka)!.add(norm(kb));
      if (kc !== null) {
        const t = ka + '|' + norm(kb);
        if (!triples.has(t)) triples.set(t, new Set());
        triples.get(t)!.add(kc);
      }
    }
    const inner = categories(src.cells, results, range, r2);
    const innerFmt = src.styles[cellId(range.r0 + 1, r2)]?.fmt === 'date' ? { fmt: 'date' as const } : undefined;
    const inner3 = r3 === undefined ? [] : categories(src.cells, results, range, r3);
    const fmt3 = r3 !== undefined && src.styles[cellId(range.r0 + 1, r3)]?.fmt === 'date' ? { fmt: 'date' as const } : undefined;
    const vals = [{ valCol, op }, ...more];
    const stOf = (k: number) => (k === 0 ? vst : vals[k].op === 'count' ? undefined : fmtOf(vals[k].valCol));
    // parent = condițiile grupului părinte (la „% din totalul părintelui”); null = totalul general.
    const fillRow = (row: number, conds: Cond[], extra?: CellStyle, parent: Cond[] | null = null) => {
      vals.forEach((m, k) => {
        const f = aggOf(conds, m.valCol, m.op);
        set(row, v0 + k, k === 0 && show === 'pctTotal' ? pct(f, grand) : k === 0 && show === 'pctParent' ? pct(f, parent ? '(' + aggOf(parent, m.valCol, m.op) + ')' : grand) : '=' + f, { ...stOf(k), ...extra });
      });
      calcs.forEach((c, n) => set(row, v0 + vals.length + n, '=' + c.at(conds), extra));
    };
    if (layout === 'compact') set(H, 0, [rowCol, r2, ...(r3 !== undefined ? [r3] : [])].map(head).join(' / '), HEAD);
    else { set(H, 0, head(rowCol), HEAD); set(H, 1, head(r2), HEAD); if (r3 !== undefined) set(H, 2, head(r3), HEAD); }
    vals.forEach((m, k) => set(H, v0 + k, `${nameOf(m.op)} din ${head(m.valCol)}`, HEAD));
    calcs.forEach((c, n) => set(H, v0 + vals.length + n, c.name, HEAD));
    const GROUP: CellStyle = { b: true, bg: '#f4f6fa' };
    const GROUP2: CellStyle = { b: true };
    const vEnd = v0 + vals.length + calcs.length;
    // Rândul unui grup (cu subtotalul lui sau gol): eticheta în coloana col, restul coloanelor de etichete goale, cu stilul grupului.
    const groupRow = (row: number, col: number, label: string, st: CellStyle, conds: Cond[], parent: Cond[] | null = null) => {
      set(row, col, label, st);
      for (let c = col + 1; c < v0; c++) set(row, c, '', st);
      if (sub) fillRow(row, conds, st, parent); else for (let c = v0; c < vEnd; c++) set(row, c, '', st);
    };
    let r = first;
    rowsK.forEach((k, i) => {
      const b = buckets?.[i];
      const ka = b ? 'g:' + b.lo : norm(k);
      const has = pairs.get(ka);
      // Cu trei câmpuri, valorile celui de-al doilea care au cel puțin o valoare a celui de-al treilea, fiecare cu lista lor.
      const inn = (has ? inner.filter((x) => has.has(norm(x))) : []).map((x) => {
        const h3 = triples.get(ka + '|' + norm(x));
        return { x, sub3: r3 === undefined ? [] : h3 ? inner3.filter((y) => h3.has(norm(y))) : [] };
      }).filter((e) => r3 === undefined || e.sub3.length);
      // Grupul, rândurile lui și rândurile de subtotal trebuie să încapă în foaie.
      if (!inn.length) return;
      const need = 2 + inn.reduce((n, e) => n + (r3 === undefined ? 1 : e.sub3.length + 1), 0);
      if (r + need >= ROWS - 1) { cut2 = true; return; }
      const g = r; // rândul cu eticheta grupului
      const outer: Cond[] = b ? [[ref(rowCol), '>=', String(b.lo)], [ref(rowCol), '<', String(b.hi)]] : [[ref(rowCol), '=', `$A$${g + 1}`]];
      if (layout !== 'tabular') { groupRow(r, 0, asCell(k), { ...rowFmt, ...GROUP }, outer); r++; }
      inn.forEach(({ x, sub3 }, j) => {
        if (layout === 'tabular' && j === 0) set(r, 0, asCell(k), rowFmt);
        const xSt = layout === 'compact' ? { ...innerFmt, align: 'left' as const, ind: 1 } : innerFmt;
        if (r3 === undefined) {
          set(r, ic, asCell(x), xSt);
          fillRow(r, [...outer, [ref(r2), '=', `${icc}${r + 1}`]], undefined, outer);
          r++;
          return;
        }
        const mid: Cond[] = [...outer, [ref(r2), '=', `$${icc}$${r + 1}`]];
        if (layout !== 'tabular') { groupRow(r, ic, asCell(x), { ...xSt, ...GROUP2 }, mid, outer); r++; }
        sub3.forEach((y, q) => {
          if (layout === 'tabular' && q === 0) set(r, 1, asCell(x), innerFmt);
          set(r, ic3, asCell(y), layout === 'compact' ? { ...fmt3, align: 'left', ind: 2 } : fmt3);
          fillRow(r, [...mid, [ref(r3), '=', `${icc3}${r + 1}`]], undefined, mid);
          r++;
        });
        if (layout === 'tabular' && sub) {
          set(r, 1, `${x.v} Total`, GROUP2);
          groupRow(r, 2, '', GROUP2, mid, outer);
          r++;
        }
      });
      if (layout === 'tabular' && sub) {
        set(r, 0, `${k.v} Total`, TOTAL);
        for (let c = 1; c < v0; c++) set(r, c, '', TOTAL);
        fillRow(r, outer, TOTAL);
        r++;
      }
    });
    used = r - first;
    chartEnd = Math.max(r - 1, first);
    endRow = r - 1;
    if (totRow) {
      set(r, 0, 'Total', TOTAL);
      for (let c = 1; c < v0; c++) set(r, c, '', TOTAL);
      const countAll = buckets && fc === undefined ? `COUNT(${ref(rowCol)})` : countRows();
      vals.forEach((m, k) => set(r, v0 + k, k === 0 && (show === 'pctTotal' || show === 'pctParent') ? pct(grand, grand)
        : '=' + (SPREAD(m.op) ? whole(m.op, m.valCol) : m.op === 'count' ? countAll : sumAll(m.valCol)), { ...TOTAL, ...stOf(k) }));
      calcs.forEach((c, n) => set(r, v0 + vals.length + n, '=' + c.at(null), TOTAL));
      endRow = r;
    }
    lastC2 = v0 + vals.length + calcs.length - 1;
  } else if (colCol === undefined) {
    set(H, 1, `${opName} din ${head(valCol)}`, HEAD);
    rowsK.forEach((k, i) => {
      set(first + i, 0, asCell(k), rowFmt);
      const f = agg(crit(first + i));
      set(first + i, 1, based ? vsBase(f, first + i, []) : ranked ? rank(f, []) : rowwise ? step(f, i ? agg(crit(first + i - 1)) : null, `B${first + i}`) : show === 'pctTotal' ? pct(f, grand) : '=' + f, vst);
    });
    if (totRow) set(tot, 0, 'Total', TOTAL);
    // La totalul cumulat, totalul e totalul general; la diferențe, rândul Total rămâne gol.
    if (totRow) set(tot, 1, SPREAD(op) ? `=${whole(op, valCol)}` : show === 'running' ? '=' + grand : blankTot ? '' : `=SUM(B${first + 1}:B${last + 1})`, { ...TOTAL, ...vst });
    more.forEach((m, k) => {
      const c = 2 + k, cc = colName(c);
      const st = m.op === 'count' ? undefined : fmtOf(m.valCol);
      set(H, c, `${nameOf(m.op)} din ${head(m.valCol)}`, HEAD);
      rowsK.forEach((_, i) => set(first + i, c, '=' + aggOf(crit(first + i), m.valCol, m.op), st));
      if (totRow) set(tot, c, SPREAD(m.op) ? `=${whole(m.op, m.valCol)}` : `=SUM(${cc}${first + 1}:${cc}${last + 1})`, { ...TOTAL, ...st });
    });
    calcs.forEach((k, n) => {
      const c = 2 + more.length + n;
      set(H, c, k.name, HEAD);
      rowsK.forEach((_, i) => set(first + i, c, '=' + k.at(crit(first + i))));
      if (totRow) set(tot, c, '=' + k.at(null), TOTAL);
    });
  } else {
    const colFmt = !cbuckets && src.styles[cellId(range.r0 + 1, colCol)]?.fmt === 'date' ? { fmt: 'date' as const } : {};
    colsK.forEach((k, j) => set(H, 1 + j, asCell(k), { ...HEAD, ...colFmt }));
    const tc = 1 + colsK.length;
    if (totCol) set(H, tc, 'Total', HEAD);
    rowsK.forEach((k, i) => {
      const r = first + i;
      set(r, 0, asCell(k), rowFmt);
      colsK.forEach((_, j) => {
        const cc = colName(1 + j);
        const f = agg([...crit(r), ...colCs(j, cc)]);
        // Indicele (ca Index): valoarea × totalul general / (totalul rândului × totalul coloanei); 1 = cât te-ai aștepta.
        if (show === 'index') { set(r, 1 + j, `=IFERROR((${f})*${grand}/((${agg(crit(r))})*(${agg(colCs(j, cc))}));0)`, vst); return; }
        if (ranked) { set(r, 1 + j, rank(f, colCs(j, cc)), vst); return; }
        if (based) { set(r, 1 + j, vsBase(f, r, colCs(j, cc)), vst); return; }
        set(r, 1 + j, rowwise ? step(f, i ? agg([...crit(r - 1), ...colCs(j, cc)]) : null, `${cc}${r}`, `(${agg(colCs(j, cc))})`) : show === 'value' ? '=' + f : pct(f, show === 'pctTotal' ? grand : show === 'pctRow' ? agg(crit(r)) : agg(colCs(j, cc))), vst);
      });
      // La „% din coloană”, totalul rândului e procentul lui din totalul general (suma procentelor din rând n-ar avea sens).
      if (totCol) set(r, tc, SPREAD(op) ? `=${agg(crit(r))}` : show === 'index' ? '=1' : based ? vsBase(agg(crit(r)), r, []) : ranked ? rank(agg(crit(r)), []) : rowwise ? step(agg(crit(r)), i ? agg(crit(r - 1)) : null, `${colName(tc)}${r}`) : show === 'pctCol' ? pct(agg(crit(r)), grand) : `=SUM(B${r + 1}:${colName(tc - 1)}${r + 1})`, { ...TOTAL, ...vst });
    });
    if (totRow) set(tot, 0, 'Total', TOTAL);
    if (totRow) colsK.forEach((_, j) => {
      const cc = colName(1 + j);
      const f = agg(colCs(j, cc));
      // La „% din rând”, totalul coloanei e procentul ei din totalul general.
      set(tot, 1 + j, SPREAD(op) ? '=' + f : show === 'index' ? '=1' : show === 'running' ? '=' + f : blankTot ? '' : show === 'pctRow' ? pct(f, grand) : `=SUM(${cc}${first + 1}:${cc}${last + 1})`, { ...TOTAL, ...vst });
    });
    if (totRow && totCol) set(tot, tc, SPREAD(op) ? `=${whole(op, valCol)}` : show === 'index' ? '=1' : show === 'running' ? '=' + grand : blankTot ? '' : show === 'pctRow' ? `=SUM(B${tot + 1}:${colName(tc - 1)}${tot + 1})` : `=SUM(${colName(tc)}${first + 1}:${colName(tc)}${last + 1})`, { ...TOTAL, ...vst });
  }
  const lastC = lastC2 ?? (colCol === undefined ? 1 + more.length + calcs.length : colsK.length + (totCol ? 1 : 0));
  // Elementele calculate: rânduri noi sub categorii, cu formula din celulele rândurilor numite (B5-B6 pentru „Cluj - Iași”);
  // rândul Total coboară sub ele și rămâne totalul categoriilor.
  const citems = itemRows && show === 'value' && rowsK.length ? (spec.calcItems ?? []).slice(0, MAX_PIVOT_CALCS)
    .map((k) => ({ name: k.name.trim(), expr: k.expr }))
    .filter((k) => k.name && !k.name.startsWith('=') && calcFormula(k.expr, rowsK.map((x, i) => ({ c: i, name: x.v })), () => '0') !== null) : [];
  if (itemRows && citems.length) {
    const [i0, i1] = itemRows;
    const T = i1 + 1, n = citems.length;
    if (endRow > i1) {
      for (let c = 0; c <= lastC; c++) {
        const a = cellId(T, c), b = cellId(T + n, c);
        if (a in cells) { cells[b] = cells[a]; delete cells[a]; }
        if (a in styles) { styles[b] = styles[a]; delete styles[a]; }
      }
    }
    const ITEM: CellStyle = { i: true };
    const fields = rowsK.slice(0, i1 - i0 + 1).map((x, i) => ({ c: i0 + i, name: x.v }));
    citems.forEach((k, j) => {
      const r = T + j;
      set(r, 0, k.name, ITEM);
      for (let c = 1; c <= lastC; c++) {
        if (!(cells[cellId(i0, c)] ?? '').startsWith('=')) continue;
        const f = calcFormula(k.expr, fields, (row) => `${colName(c)}${row + 1}`);
        if (f !== null) set(r, c, `=IFERROR(${f};"")`, { ...styles[cellId(i0, c)], ...ITEM });
      }
    });
    endRow += n;
    used += n;
  }
  const colW: Record<string, number> = { A: 200 };
  for (let c = 1; c <= Math.max(1, lastC); c++) colW[colName(c)] = 130;
  const pivot: PivotDef = {
    sheet: name, target: `A${H + 1}:${colName(Math.max(1, lastC))}${endRow + 1}`,
    source: `${sheetRef(src.name)}!${colName(range.c0)}${range.r0 + 1}:${colName(range.c1)}${range.r1 + 1}`,
    rows: [rowCol, ...(r2 !== undefined ? [r2] : []), ...(r3 !== undefined ? [r3] : [])].map(head), cols: colCol === undefined ? [] : [colCol, ...(c2 !== undefined ? [c2] : [])].map(head),
    data: [{ valCol, op }, ...more].map((m) => ({ field: head(m.valCol), fn: m.op === 'avg' ? 'average' : m.op, name: `${nameOf(m.op)} din ${head(m.valCol)}` })),
    make: { src: src.name, spec },
  };
  return {
    sheet: { ...emptySheet(name), cells, styles, colW, ...(lists.length ? { lists } : {}) },
    rows: used,
    cols: colsK.length,
    cut: cut || cut2,
    pivot,
    chartRange: `A${chartTop + 1}:${colName(lastC2 ?? (colCol === undefined ? 1 + more.length + calcs.length : Math.max(1, colsK.length)))}${chartEnd + 1}`,
    lastCol: Math.max(1, lastC),
  };
}
