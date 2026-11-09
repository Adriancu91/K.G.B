// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Formatează ca tabel”: cap de tabel colorat, rânduri alternate, filtru și un rând de total cu sume,
// ca tabelele din Excel, dar făcute dintr-un singur click pe tabelul existent.

import { CellStyle, cellId, colName, isNumber, ROWS } from './format';
import { shiftFormula, type Result } from './formula';
import type { Range } from './fill';

export type TableTheme = 'blue' | 'green' | 'orange' | 'gray' | 'red' | 'purple' | 'teal' | 'yellow' | 'blueDark' | 'greenDark' | 'orangeDark' | 'grayDark' | 'yellowDark' | 'tealDark' | 'grayNight' | 'blueNight' | 'orangeNight' | 'greenNight' | 'silverNight' | 'yellowNight' | 'tealNight'
  | 'blackLine' | 'blueLine' | 'orangeLine' | 'grayLine' | 'yellowLine' | 'tealLine' | 'greenLine'
  | 'blackBar' | 'blueBar' | 'orangeBar' | 'grayBar' | 'yellowBar' | 'tealBar' | 'greenBar'
  | 'blackGrid' | 'blueGrid' | 'orangeGrid' | 'grayGrid' | 'yellowGrid' | 'tealGrid' | 'greenGrid'
  | 'black' | 'blackDark'
  | 'blackFrame' | 'blueFrame' | 'orangeFrame' | 'grayFrame' | 'yellowFrame' | 'tealFrame' | 'greenFrame'
  | 'blackTint' | 'blueTint' | 'orangeTint' | 'grayTint' | 'yellowTint' | 'tealTint' | 'greenTint'
  | `u_${string}`;

/**
 * Culorile tabelului: capul, rândurile alternate și rândul de total (deschise, ca textul să se citească bine).
 * Stilurile intense au capul închis, cu literele albe (ink), ca stilurile medii din galeria programelor cunoscute.
 * Stilurile întunecate colorează tot tabelul (body = rândurile fără dungă), cu literele albe peste tot (bodyInk).
 * Stilurile cu linii (deschise) nu au fundal pe cap și pe total (head / total gol), ci câte o linie colorată (line) sub cap și deasupra totalului.
 * Chenarul (grid, în culoarea line): „rows” = contur în jurul tabelului și o linie sub fiecare rând, „all” = linii în jurul fiecărei celule.
 */
export const TABLE_THEMES: Record<TableTheme, { label: string; head: string; band: string; total: string; ink?: string; body?: string; bodyInk?: string; line?: string; grid?: 'rows' | 'all' }> = {
  blue: { label: 'Albastru', head: '#dde7f5', band: '#f2f6fc', total: '#e3eaf4' },
  green: { label: 'Verde', head: '#d9ead3', band: '#f1f8ee', total: '#e2efda' },
  orange: { label: 'Portocaliu', head: '#fce4d6', band: '#fef4ee', total: '#fbe5d6' },
  gray: { label: 'Gri', head: '#e2e2e2', band: '#f5f5f5', total: '#e7e7e7' },
  red: { label: 'Roșu', head: '#f8d7da', band: '#fdf1f2', total: '#f6dfe1' },
  purple: { label: 'Mov', head: '#e4dcf3', band: '#f5f1fb', total: '#e8e2f3' },
  teal: { label: 'Turcoaz', head: '#d2ecec', band: '#eff8f8', total: '#dcefef' },
  yellow: { label: 'Galben', head: '#fbefc4', band: '#fefaec', total: '#f9f0d2' },
  blueDark: { label: 'Albastru intens', head: '#4472c4', band: '#d9e1f2', total: '#b4c6e7', ink: '#ffffff' },
  greenDark: { label: 'Verde intens', head: '#548235', band: '#e2efda', total: '#c6e0b4', ink: '#ffffff' },
  orangeDark: { label: 'Portocaliu intens', head: '#c55a11', band: '#fce4d6', total: '#f8cbad', ink: '#ffffff' },
  grayDark: { label: 'Gri intens', head: '#404040', band: '#ededed', total: '#d0d0d0', ink: '#ffffff' },
  yellowDark: { label: 'Galben intens', head: '#bf8f00', band: '#fff2cc', total: '#ffe699', ink: '#ffffff' },
  tealDark: { label: 'Turcoaz intens', head: '#2e8b8b', band: '#dcefef', total: '#b9dfdf', ink: '#ffffff' },
  grayNight: { label: 'Negru întunecat', head: '#000000', band: '#484848', body: '#595959', total: '#262626', ink: '#ffffff', bodyInk: '#ffffff' },
  blueNight: { label: 'Albastru întunecat', head: '#1f3864', band: '#284780', body: '#305496', total: '#1f3864', ink: '#ffffff', bodyInk: '#ffffff' },
  orangeNight: { label: 'Portocaliu întunecat', head: '#833c0c', band: '#a5490e', body: '#c65911', total: '#833c0c', ink: '#ffffff', bodyInk: '#ffffff' },
  greenNight: { label: 'Verde întunecat', head: '#375623', band: '#446a2b', body: '#548235', total: '#375623', ink: '#ffffff', bodyInk: '#ffffff' },
  // 28.10: și restul stilurilor întunecate din .xlsx (TableStyleDark4 / 5 / 6), care până acum se deschideau ca stiluri intense.
  silverNight: { label: 'Gri întunecat', head: '#3a3a3a', band: '#5e5e5e', body: '#737373', total: '#3a3a3a', ink: '#ffffff', bodyInk: '#ffffff' },
  yellowNight: { label: 'Auriu întunecat', head: '#7f6000', band: '#9e7700', body: '#bf8f00', total: '#7f6000', ink: '#ffffff', bodyInk: '#ffffff' },
  tealNight: { label: 'Turcoaz întunecat', head: '#1d5959', band: '#257070', body: '#2e8b8b', total: '#1d5959', ink: '#ffffff', bodyInk: '#ffffff' },
  // 30.10: stilurile deschise cu linii (TableStyleLight1–7 din .xlsx), care până acum se deschideau ca stiluri cu cap colorat.
  blackLine: { label: 'Negru cu linii', head: '', band: '#d9d9d9', total: '', line: '#000000' },
  blueLine: { label: 'Albastru cu linii', head: '', band: '#d9e1f2', total: '', line: '#4472c4' },
  orangeLine: { label: 'Portocaliu cu linii', head: '', band: '#fce4d6', total: '', line: '#ed7d31' },
  grayLine: { label: 'Gri cu linii', head: '', band: '#ededed', total: '', line: '#a5a5a5' },
  yellowLine: { label: 'Auriu cu linii', head: '', band: '#fff2cc', total: '', line: '#ffc000' },
  tealLine: { label: 'Albastru deschis cu linii', head: '', band: '#ddebf7', total: '', line: '#5b9bd5' },
  greenLine: { label: 'Verde cu linii', head: '', band: '#e2efda', total: '', line: '#70ad47' },
  // 30.10: stilurile deschise cu cap plin și chenar (TableStyleLight8–14) și cele cu grilă (TableStyleLight15–21).
  blackBar: { label: 'Negru cu chenar', head: '#000000', band: '', total: '', ink: '#ffffff', line: '#000000', grid: 'rows' },
  blueBar: { label: 'Albastru cu chenar', head: '#4472c4', band: '', total: '', ink: '#ffffff', line: '#4472c4', grid: 'rows' },
  orangeBar: { label: 'Portocaliu cu chenar', head: '#ed7d31', band: '', total: '', ink: '#ffffff', line: '#ed7d31', grid: 'rows' },
  grayBar: { label: 'Gri cu chenar', head: '#a5a5a5', band: '', total: '', ink: '#ffffff', line: '#a5a5a5', grid: 'rows' },
  yellowBar: { label: 'Auriu cu chenar', head: '#ffc000', band: '', total: '', ink: '#ffffff', line: '#ffc000', grid: 'rows' },
  tealBar: { label: 'Albastru deschis cu chenar', head: '#5b9bd5', band: '', total: '', ink: '#ffffff', line: '#5b9bd5', grid: 'rows' },
  greenBar: { label: 'Verde cu chenar', head: '#70ad47', band: '', total: '', ink: '#ffffff', line: '#70ad47', grid: 'rows' },
  blackGrid: { label: 'Negru cu grilă', head: '', band: '#d9d9d9', total: '', line: '#000000', grid: 'all' },
  blueGrid: { label: 'Albastru cu grilă', head: '', band: '#d9e1f2', total: '', line: '#8ea9db', grid: 'all' },
  orangeGrid: { label: 'Portocaliu cu grilă', head: '', band: '#fce4d6', total: '', line: '#f4b084', grid: 'all' },
  grayGrid: { label: 'Gri cu grilă', head: '', band: '#ededed', total: '', line: '#c9c9c9', grid: 'all' },
  yellowGrid: { label: 'Auriu cu grilă', head: '', band: '#fff2cc', total: '', line: '#ffd966', grid: 'all' },
  tealGrid: { label: 'Albastru deschis cu grilă', head: '', band: '#ddebf7', total: '', line: '#9bc2e6', grid: 'all' },
  greenGrid: { label: 'Verde cu grilă', head: '', band: '#e2efda', total: '', line: '#a9d08e', grid: 'all' },
  // 30.10: negrul din stilurile medii (TableStyleMedium1 / 8), cele cu cap plin și grilă (Medium15–21) și cele umplute cu grilă (Medium22–28).
  black: { label: 'Negru', head: '#d9d9d9', band: '#f2f2f2', total: '#e0e0e0' },
  blackDark: { label: 'Negru intens', head: '#000000', band: '#d9d9d9', total: '#bfbfbf', ink: '#ffffff' },
  blackFrame: { label: 'Negru cu cap și grilă', head: '#000000', band: '#d9d9d9', total: '', ink: '#ffffff', line: '#000000', grid: 'all' },
  blueFrame: { label: 'Albastru cu cap și grilă', head: '#4472c4', band: '#d9e1f2', total: '', ink: '#ffffff', line: '#4472c4', grid: 'all' },
  orangeFrame: { label: 'Portocaliu cu cap și grilă', head: '#ed7d31', band: '#fce4d6', total: '', ink: '#ffffff', line: '#ed7d31', grid: 'all' },
  grayFrame: { label: 'Gri cu cap și grilă', head: '#a5a5a5', band: '#ededed', total: '', ink: '#ffffff', line: '#a5a5a5', grid: 'all' },
  yellowFrame: { label: 'Auriu cu cap și grilă', head: '#ffc000', band: '#fff2cc', total: '', ink: '#ffffff', line: '#ffc000', grid: 'all' },
  tealFrame: { label: 'Albastru deschis cu cap și grilă', head: '#5b9bd5', band: '#ddebf7', total: '', ink: '#ffffff', line: '#5b9bd5', grid: 'all' },
  greenFrame: { label: 'Verde cu cap și grilă', head: '#70ad47', band: '#e2efda', total: '', ink: '#ffffff', line: '#70ad47', grid: 'all' },
  blackTint: { label: 'Negru umplut', head: '#d9d9d9', band: '#bfbfbf', body: '#d9d9d9', total: '#bfbfbf', line: '#a6a6a6', grid: 'all' },
  blueTint: { label: 'Albastru umplut', head: '#d9e1f2', band: '#b4c6e7', body: '#d9e1f2', total: '#b4c6e7', line: '#8ea9db', grid: 'all' },
  orangeTint: { label: 'Portocaliu umplut', head: '#fce4d6', band: '#f8cbad', body: '#fce4d6', total: '#f8cbad', line: '#f4b084', grid: 'all' },
  grayTint: { label: 'Gri umplut', head: '#ededed', band: '#dbdbdb', body: '#ededed', total: '#dbdbdb', line: '#c9c9c9', grid: 'all' },
  yellowTint: { label: 'Auriu umplut', head: '#fff2cc', band: '#ffe699', body: '#fff2cc', total: '#ffe699', line: '#ffd966', grid: 'all' },
  tealTint: { label: 'Albastru deschis umplut', head: '#ddebf7', band: '#bdd7ee', body: '#ddebf7', total: '#bdd7ee', line: '#9bc2e6', grid: 'all' },
  greenTint: { label: 'Verde umplut', head: '#e2efda', band: '#c6e0b4', body: '#e2efda', total: '#c6e0b4', line: '#a9d08e', grid: 'all' },
};

/**
 * Un stil de tabel făcut de om (Proiectare tabel → ＋ Stil de tabel nou…): numele și culorile lui. Se ține în registru
 * (tableStyles) și în .xlsx (tableStyles din styles.xml). Cheia (id) vine din nume și culori, deci două registre deschise
 * deodată nu se încurcă: aceeași cheie înseamnă același stil.
 */
export interface CustomTableStyle { id: `u_${string}`; label: string; head: string; ink?: string; band: string; body?: string; total: string; line?: string; grid?: 'rows' | 'all' }
export type CustomTableLook = Omit<CustomTableStyle, 'id'>;

export const isCustomTheme = (k: string): k is `u_${string}` => k.startsWith('u_');

/** Cheia stilului: u_ + o sumă scurtă a numelui și a culorilor. */
export function customStyleId(s: CustomTableLook): `u_${string}` {
  const txt = [s.label, s.head, s.ink, s.band, s.body, s.total, s.line, s.grid].map((x) => x ?? '').join('|');
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return `u_${h.toString(36)}`;
}

const HEX = /^#[0-9a-f]{6}$/i;
const NAME_OK = /^[^<>&"]{1,60}$/;

/**
 * Stilurile proprii citite dintr-un fișier, curățate (cel mult 50, culori #rrggbb, nume fără semne care strică XML-ul)
 * și puse în lista stilurilor (TABLE_THEMES), ca tabelele care le folosesc să le găsească.
 */
export function cleanTableStyles(v: unknown): CustomTableStyle[] {
  if (!Array.isArray(v)) return [];
  const out: CustomTableStyle[] = [];
  const col = (x: unknown, empty = false) => (typeof x === 'string' && HEX.test(x) ? x.toLowerCase() : empty && x === '' ? '' : undefined);
  for (const x of v.slice(0, 50)) {
    const label = typeof x?.label === 'string' ? x.label.trim() : '';
    if (!NAME_OK.test(label) || out.some((o) => o.label.toLocaleLowerCase('ro') === label.toLocaleLowerCase('ro'))) continue;
    const look: CustomTableLook = { label, head: col(x.head, true) ?? '', band: col(x.band, true) ?? '', total: col(x.total, true) ?? '' };
    for (const k of ['ink', 'body', 'line'] as const) { const c = col(x[k]); if (c) look[k] = c; }
    if ((x.grid === 'rows' || x.grid === 'all') && look.line) look.grid = x.grid;
    out.push({ id: customStyleId(look), ...look });
  }
  registerTableStyles(out);
  return out;
}

/** Pune stilurile proprii în lista stilurilor (o cheie înseamnă mereu aceleași culori, deci nu strică alte registre). */
export function registerTableStyles(list: CustomTableStyle[]): void {
  for (const { id, ...look } of list) (TABLE_THEMES as Record<string, CustomTableLook>)[id] = look;
}

/** Stilurile din galerie pentru un registru: cele gata făcute, apoi doar stilurile proprii ale lui (nu și ale altor registre deschise). */
export function galleryThemes(own: CustomTableStyle[] | undefined): TableTheme[] {
  return [...(Object.keys(TABLE_THEMES) as TableTheme[]).filter((k) => !isCustomTheme(k)), ...(own ?? []).map((s) => s.id)];
}

/**
 * Liniile de chenar ale unei celule din tabel (stilurile cu grid): la „all” toate patru; la „rows” linia de jos, iar sus
 * doar pe primul rând și stânga / dreapta doar la margini. Liniile puse de mână rămân (se adaugă la ele).
 */
function gridBd(th: (typeof TABLE_THEMES)[TableTheme], prev: string | undefined, top: boolean, c: number, c0: number, c1: number): string {
  if (!th.grid) return prev ?? '';
  const add = th.grid === 'all' ? 'tblr' : `b${top ? 't' : ''}${c === c0 ? 'l' : ''}${c === c1 ? 'r' : ''}`;
  return [...new Set(((prev ?? '') + add).split(''))].join('');
}

/** Stilul capului: culoarea lui și literele albe la stilurile intense (albul pus de un stil intens se scoate la cele deschise). */
function headStyle(prev: CellStyle | undefined, th: (typeof TABLE_THEMES)[TableTheme]): CellStyle {
  const st: CellStyle = { ...prev };
  if (th.ink) st.color = th.ink; else if (st.color?.toLowerCase() === '#ffffff') delete st.color;
  return st;
}

/** Literele rândurilor de date și ale totalului: albe la stilurile întunecate (albul lor se scoate la celelalte). */
function bodyInk(st: CellStyle, th: (typeof TABLE_THEMES)[TableTheme]): void {
  if (th.bodyInk) st.color = th.bodyInk; else if (st.color?.toLowerCase() === '#ffffff') delete st.color;
}

/** Fundalul unei celule de date: dunga, corpul la stilurile întunecate sau nimic. */
const bodyBg = (th: (typeof TABLE_THEMES)[TableTheme], band: boolean) => (band ? th.band : th.body);

/** Ce părți are tabelul (opțiunile de stil): toate se aleg în fereastra „▤ Tabel…”. */
export interface TableOpts {
  /** Primul rând e capul de tabel (colorat, aldin, cu filtru). */
  head: boolean;
  /** Rânduri alternate colorate. */
  bandRows: boolean;
  /** Coloane alternate colorate. */
  bandCols: boolean;
  /** Prima / ultima coloană cu litere aldine (de exemplu numele și totalul pe rând). */
  firstCol: boolean;
  lastCol: boolean;
  /** Rândul de total sub tabel. */
  total: boolean;
  /** Butoanele de filtrare (▾) pe cap. */
  filter: boolean;
}

export const DEFAULT_TABLE_OPTS: TableOpts = { head: true, bandRows: true, bandCols: false, firstCol: false, lastCol: false, total: true, filter: true };

export interface TableOut {
  /** Celulele de schimbat (rândul de total). */
  cells: Record<string, string>;
  /** Stilurile noi ale celulelor din tabel ({} = fără format). */
  styles: Record<string, CellStyle>;
  /** Rândul de total, dacă a fost adăugat. */
  totalRow: number | null;
  /** Coloanele cu sumă în rândul de total. */
  summed: string[];
}

/** O coloană e „de numere” dacă majoritatea celulelor completate de sub cap sunt numere. */
function numericCol(cells: Record<string, string>, results: Record<string, Result>, g: Range, c: number): boolean {
  let n = 0;
  let filled = 0;
  for (let r = g.r0 + 1; r <= g.r1; r++) {
    const id = cellId(r, c);
    const raw = cells[id];
    if (!raw) continue;
    filled++;
    if (results[id] ? results[id].num : isNumber(raw)) n++;
  }
  return filled > 0 && n * 2 > filled;
}

export function formatAsTable(
  cells: Record<string, string>,
  styles: Record<string, CellStyle>,
  results: Record<string, Result>,
  g: Range,
  theme: TableTheme = 'blue',
  opts: TableOpts = DEFAULT_TABLE_OPTS,
): TableOut {
  const th = TABLE_THEMES[theme] ?? TABLE_THEMES.blue;
  // Capul are o linie dedesubt, rândul de total una deasupra (se văd și la tipărire).
  const HEAD: CellStyle = { b: true, bg: th.head, align: 'center' };
  const TOTAL: CellStyle = { b: true, bg: th.total, bd: 't', ...(th.bodyInk ? { color: th.bodyInk } : {}), ...(th.line ? { bdColor: th.line } : {}) };
  if (!th.total) delete TOTAL.bg;
  const out: TableOut = { cells: {}, styles: {}, totalRow: null, summed: [] };
  // Fără cap, și primul rând e de date (benzile încep de la el).
  const d0 = opts.head ? g.r0 + 1 : g.r0;
  if (opts.head) {
    for (let c = g.c0; c <= g.c1; c++) {
      const id = cellId(g.r0, c);
      const bd = [...new Set(((styles[id]?.bd ?? '') + 'b').split(''))].join('');
      out.styles[id] = { ...headStyle(styles[id], th), ...HEAD, bd };
      // Stilurile cu linii: fără fundal pe cap, cu linia colorată deasupra și dedesubt.
      if (!th.head) { delete out.styles[id].bg; out.styles[id].bd = [...new Set((bd + 't').split(''))].join(''); }
      if (th.line) out.styles[id].bdColor = th.line;
      if (th.grid) out.styles[id].bd = gridBd(th, out.styles[id].bd, true, c, g.c0, g.c1);
    }
  }
  for (let r = d0; r <= g.r1; r++) {
    for (let c = g.c0; c <= g.c1; c++) {
      const id = cellId(r, c);
      const st: CellStyle = { ...styles[id] };
      const band = (opts.bandRows && (r - d0) % 2 === 1) || (opts.bandCols && (c - g.c0) % 2 === 1);
      const bg = bodyBg(th, band);
      if (bg) st.bg = bg; else delete st.bg;
      bodyInk(st, th);
      if (th.grid) { st.bd = gridBd(th, st.bd, r === d0 && !opts.head, c, g.c0, g.c1); st.bdColor = th.line; }
      // Aldinul pus de tabel pe prima / ultima coloană; altfel rămâne cum l-ai pus tu.
      if ((opts.firstCol && c === g.c0) || (opts.lastCol && c === g.c1)) st.b = true;
      out.styles[id] = st;
    }
  }
  // Rândul de total merge sub tabel, după un rând liber (ca sortarea și filtrul să nu-l ia drept date),
  // și doar dacă acolo e loc (nu scriem peste date).
  const t = g.r1 + 2;
  const emptyRow = (r: number) => Array.from({ length: g.c1 - g.c0 + 1 }, (_, i) => cells[cellId(r, g.c0 + i)]).every((v) => !v);
  const free = t < ROWS && emptyRow(g.r1 + 1) && emptyRow(t);
  const already = /^total/i.test((cells[cellId(g.r1, g.c0)] ?? '').trim());
  if (opts.total && free && !already && g.r1 > g.r0) {
    out.totalRow = t;
    for (let c = g.c0; c <= g.c1; c++) {
      const id = cellId(t, c);
      const first = styles[cellId(d0, c)];
      const fmt = first?.fmt;
      if (c > g.c0 && numericCol(cells, results, opts.head ? g : { ...g, r0: g.r0 - 1 }, c)) {
        const L = colName(c);
        // SUBTOTAL(9; …) adună doar rândurile care se văd când e pornit filtrul.
        out.cells[id] = `=SUBTOTAL(9;${L}${d0 + 1}:${L}${g.r1 + 1})`;
        out.summed.push(L);
        out.styles[id] = { ...TOTAL, ...(fmt && fmt !== 'date' ? { fmt, ...(first?.dec !== undefined ? { dec: first.dec } : {}) } : {}) };
      } else {
        out.styles[id] = { ...TOTAL };
      }
      if (th.grid) out.styles[id].bd = gridBd(th, out.styles[id].bd, true, c, g.c0, g.c1);
    }
    out.cells[cellId(t, g.c0)] = 'Total';
  }
  return out;
}

/** Ce poate calcula rândul de total pe o coloană (codurile funcției SUBTOTAL). */
export const TOTAL_FNS: [number, string][] = [[9, 'Sumă'], [1, 'Medie'], [3, 'Număr'], [5, 'Minim'], [4, 'Maxim']];

/** Formula „=SUBTOTAL(9;B2:B10)” → codul (9) și zona; null dacă celula nu e un total de felul acesta. */
export function subtotalOf(raw: string | undefined): { code: number; area: string } | null {
  const m = /^=SUBTOTAL\(\s*(\d+)\s*[;,]\s*([^;,()]+)\)$/i.exec((raw ?? '').trim());
  if (!m) return null;
  const code = Number(m[1]) > 100 ? Number(m[1]) - 100 : Number(m[1]);
  return TOTAL_FNS.some(([c]) => c === code) ? { code, area: m[2].trim() } : null;
}

// ---------- Tabelele cu nume (Inserare → Tabel, Ctrl+L) ----------
// Un tabel are nume (Tabel1), zona lui (cap + date), culoarea și părțile. Culorile stau în celule (ca la „Formatează ca tabel”),
// iar zona și numele se păstrează în fișier și în .xlsx (ca tabel adevărat, cu filtru și stil). Testat în tests/sheets-tables.test.mjs.

export interface SheetTable {
  name: string;
  r0: number;
  c0: number;
  r1: number;
  c1: number;
  theme: TableTheme;
  opts: TableOpts;
  /**
   * Stilul din .xlsx (TableStyleMedium9…), păstrat ca tabelul să arate la fel după salvare; altfel se alege după culoare.
   * „TableStyleNone” = tabel fără stil în fișier (fără culori), cât timp culoarea nu e schimbată.
   */
  style?: string;
}

/** Primul nume liber: Tabel1, Tabel2… (fără să țină cont de literele mari / mici). */
export function nextTableName(used: string[]): string {
  const low = new Set(used.map((n) => n.toLowerCase()));
  for (let i = 1; ; i++) if (!low.has(`tabel${i}`)) return `Tabel${i}`;
}

/** Un nume bun de tabel: începe cu literă sau _, fără spații și semne, și nu arată ca o celulă (AB12) sau R1C1. */
export function validTableName(name: string): boolean {
  return /^[\p{L}_][\p{L}\p{N}_.]{0,254}$/u.test(name) && !/^[A-Z]{1,3}\d+$/i.test(name) && !/^[RC]\d*$/i.test(name) && !/^R\d*C\d*$/i.test(name);
}

/**
 * Datele unui tabel cu nume pentru un rezumat: capul și rândurile de date, fără rândul de total de jos din fișierele
 * aduse (ultimul rând începe cu „Total” și are formule SUBTOTAL), care altfel s-ar număra o dată în plus.
 */
export function tableDataRange(t: SheetTable, cells: Record<string, string>): { r0: number; c0: number; r1: number; c1: number } {
  const last = Array.from({ length: t.c1 - t.c0 + 1 }, (_, i) => (cells[cellId(t.r1, t.c0 + i)] ?? '').trim());
  const isTotal = t.r1 > t.r0 + 1 && /^total/i.test(last[0]) && last.slice(1).some((v) => /^=SUBTOTAL\(/i.test(v));
  return { r0: t.r0, c0: t.c0, r1: isTotal ? t.r1 - 1 : t.r1, c1: t.c1 };
}

/** Tabelul în care e celula (r, c), dacă e vreunul. */
export function tableAt(tables: SheetTable[] | undefined, r: number, c: number): SheetTable | undefined {
  return tables?.find((t) => r >= t.r0 && r <= t.r1 && c >= t.c0 && c <= t.c1);
}

// Stilurile medii din .xlsx se repetă din 7 în 7: negru, albastru, portocaliu, gri, auriu, albastru deschis, verde.
const STYLE_CYCLE: TableTheme[] = ['black', 'blue', 'orange', 'gray', 'yellow', 'teal', 'green'];
// Stilurile intense se scriu ca TableStyleMedium9–14 (al doilea rând al galeriei medii), ca să se recunoască la citire;
// cele întunecate ca TableStyleDark1–7 (negru, albastru, portocaliu, verde).
const THEME_STYLE: Record<TableTheme, string> = { gray: 'Medium4', blue: 'Medium2', orange: 'Medium3', yellow: 'Medium5', teal: 'Medium6', green: 'Medium7', red: 'Medium3', purple: 'Medium6', blueDark: 'Medium9', orangeDark: 'Medium10', grayDark: 'Medium11', yellowDark: 'Medium12', tealDark: 'Medium13', greenDark: 'Medium14', grayNight: 'Dark1', blueNight: 'Dark2', orangeNight: 'Dark3', greenNight: 'Dark7', silverNight: 'Dark4', yellowNight: 'Dark5', tealNight: 'Dark6',
  blackLine: 'Light1', blueLine: 'Light2', orangeLine: 'Light3', grayLine: 'Light4', yellowLine: 'Light5', tealLine: 'Light6', greenLine: 'Light7',
  blackBar: 'Light8', blueBar: 'Light9', orangeBar: 'Light10', grayBar: 'Light11', yellowBar: 'Light12', tealBar: 'Light13', greenBar: 'Light14',
  black: 'Medium1', blackDark: 'Medium8',
  blackFrame: 'Medium15', blueFrame: 'Medium16', orangeFrame: 'Medium17', grayFrame: 'Medium18', yellowFrame: 'Medium19', tealFrame: 'Medium20', greenFrame: 'Medium21',
  blackTint: 'Medium22', blueTint: 'Medium23', orangeTint: 'Medium24', grayTint: 'Medium25', yellowTint: 'Medium26', tealTint: 'Medium27', greenTint: 'Medium28',
  blackGrid: 'Light15', blueGrid: 'Light16', orangeGrid: 'Light17', grayGrid: 'Light18', yellowGrid: 'Light19', tealGrid: 'Light20', greenGrid: 'Light21' };
// Cele deschise vin în trei șiruri de câte 7 (negru, albastru, portocaliu, gri, auriu, albastru deschis, verde): cu linii, cu chenar, cu grilă.
const LIGHT_ROWS: TableTheme[][] = [
  ['blackLine', 'blueLine', 'orangeLine', 'grayLine', 'yellowLine', 'tealLine', 'greenLine'],
  ['blackBar', 'blueBar', 'orangeBar', 'grayBar', 'yellowBar', 'tealBar', 'greenBar'],
  ['blackGrid', 'blueGrid', 'orangeGrid', 'grayGrid', 'yellowGrid', 'tealGrid', 'greenGrid'],
];
const INTENSE: Partial<Record<TableTheme, TableTheme>> = { black: 'blackDark', blue: 'blueDark', orange: 'orangeDark', gray: 'grayDark', yellow: 'yellowDark', teal: 'tealDark', green: 'greenDark' };
const LINE: Partial<Record<TableTheme, TableTheme>> = { blue: 'blueLine', orange: 'orangeLine', gray: 'grayLine', yellow: 'yellowLine', teal: 'tealLine', green: 'greenLine' };
const FRAME: Partial<Record<TableTheme, TableTheme>> = { black: 'blackFrame', blue: 'blueFrame', orange: 'orangeFrame', gray: 'grayFrame', yellow: 'yellowFrame', teal: 'tealFrame', green: 'greenFrame' };
const TINT: Partial<Record<TableTheme, TableTheme>> = { black: 'blackTint', blue: 'blueTint', orange: 'orangeTint', gray: 'grayTint', yellow: 'yellowTint', teal: 'tealTint', green: 'greenTint' };
const NIGHT: Partial<Record<TableTheme, TableTheme>> = { gray: 'grayNight', blue: 'blueNight', orange: 'orangeNight', green: 'greenNight', yellow: 'yellowNight', teal: 'tealNight' };

/** Culoarea noastră pentru un stil de tabel din .xlsx (TableStyleMedium2 → albastru, TableStyleMedium9 → albastru intens). */
export function themeFromStyle(name: string | undefined): TableTheme {
  const m = /^TableStyle(Light|Medium|Dark)([0-9]+)$/i.exec(name ?? '');
  if (!m) return 'blue';
  const n = Number(m[2]), base = STYLE_CYCLE[(n - 1) % 7];
  if (/^dark$/i.test(m[1])) return n === 1 ? 'grayNight' : n === 4 ? 'silverNight' : n <= 7 ? NIGHT[base] ?? INTENSE[base] ?? base : INTENSE[base] ?? base;
  // Cele deschise: 1–7 cu linii, 8–14 cu cap plin și chenar, 15–21 cu grilă (primul din fiecare șir e negru).
  if (/^light$/i.test(m[1])) return n >= 1 && n <= 21 ? LIGHT_ROWS[Math.floor((n - 1) / 7)][(n - 1) % 7] : LINE[base] ?? base;
  // Cele medii: 1–7 deschise, 8–14 intense, 15–21 cu cap plin și grilă, 22–28 umplute cu grilă.
  if (/^medium$/i.test(m[1]) && n >= 22) return TINT[base] ?? base;
  if (/^medium$/i.test(m[1]) && n >= 15) return FRAME[base] ?? base;
  return /^medium$/i.test(m[1]) && n >= 8 && n <= 14 ? INTENSE[base] ?? base : base;
}

/** Stilul din .xlsx pentru tabel: cel citit din fișier, dacă culoarea n-a fost schimbată; altfel unul mediu de aceeași culoare. */
export function tableStyleName(t: SheetTable): string {
  if (isCustomTheme(t.theme)) return TABLE_THEMES[t.theme] ? esc(TABLE_THEMES[t.theme].label) : 'TableStyleMedium2';
  return t.style && themeFromStyle(t.style) === t.theme ? t.style : `TableStyle${THEME_STYLE[t.theme] ?? 'Medium2'}`;
}

/**
 * Culorile unui tabel venit din .xlsx (acolo stilul nu e scris în celule): capul aldin și colorat, rândurile alternate,
 * doar unde celula nu are deja un fundal al ei. Nu schimbă nicio valoare.
 */
export function tableLook(t: SheetTable, styles: Record<string, CellStyle>): Record<string, CellStyle> {
  const th = TABLE_THEMES[t.theme] ?? TABLE_THEMES.blue;
  const out: Record<string, CellStyle> = {};
  if (t.style === 'TableStyleNone') return out;
  const d0 = t.opts.head ? t.r0 + 1 : t.r0;
  for (let c = t.c0; c <= t.c1; c++) {
    if (t.opts.head) {
      const id = cellId(t.r0, c);
      if (!styles[id]?.bg) out[id] = { ...styles[id], b: true, ...(th.head ? { bg: th.head } : {}), ...(th.ink && !styles[id]?.color ? { color: th.ink } : {}),
        ...(th.line && !styles[id]?.bd ? { bd: th.grid ? gridBd(th, th.head ? '' : 'tb', true, c, t.c0, t.c1) : 'tb', bdColor: th.line } : {}) };
    }
    for (let r = d0; r <= t.r1; r++) {
      const band = (t.opts.bandRows && (r - d0) % 2 === 1) || (t.opts.bandCols && (c - t.c0) % 2 === 1);
      const id = cellId(r, c);
      const bg = bodyBg(th, band);
      const lines = th.grid && !styles[id]?.bd ? { bd: gridBd(th, '', r === d0 && !t.opts.head, c, t.c0, t.c1), bdColor: th.line } : {};
      if ((bg && !styles[id]?.bg) || lines.bd) out[id] = { ...styles[id], ...(bg && !styles[id]?.bg ? { bg } : {}), ...(th.bodyInk && !styles[id]?.color ? { color: th.bodyInk } : {}), ...lines };
    }
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Numele coloanelor pentru .xlsx: textul din cap. Null dacă tabelul nu se poate scrie ca tabel fără ca programul care îl
 * deschide să-l „repare”: cap gol, formulă în cap sau două coloane cu același nume (atunci rămân doar culorile).
 */
export function tableColumns(t: SheetTable, cells: Record<string, string>): string[] | null {
  const out: string[] = [];
  for (let c = t.c0; c <= t.c1; c++) {
    if (!t.opts.head) { out.push(`Coloana${c - t.c0 + 1}`); continue; }
    const raw = (cells[cellId(t.r0, c)] ?? '').replace(/^'/, '').trim();
    if (!raw || raw.startsWith('=') || isNumber(raw) || raw.length > 255) return null;
    if (out.some((x) => x.toLowerCase() === raw.toLowerCase())) return null;
    out.push(raw);
  }
  return out;
}

/** Fișierul xl/tables/tableN.xml al tabelului (id = numărul lui în tot registrul). */
export function tableXml(t: SheetTable, id: number, cols: string[]): string {
  const ref = `${cellId(t.r0, t.c0)}:${cellId(t.r1, t.c1)}`;
  const af = t.opts.head && t.opts.filter ? `<autoFilter ref="${ref}"/>` : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${id}" name="${esc(t.name)}" displayName="${esc(t.name)}" ref="${ref}"${t.opts.head ? '' : ' headerRowCount="0"'} totalsRowShown="0">`
    + af
    + `<tableColumns count="${cols.length}">${cols.map((n, i) => `<tableColumn id="${i + 1}" name="${esc(n)}"/>`).join('')}</tableColumns>`
    + `<tableStyleInfo${tableStyleName(t) === 'TableStyleNone' ? '' : ` name="${tableStyleName(t)}"`} showFirstColumn="${t.opts.firstCol ? 1 : 0}" showLastColumn="${t.opts.lastCol ? 1 : 0}" showRowStripes="${t.opts.bandRows ? 1 : 0}" showColumnStripes="${t.opts.bandCols ? 1 : 0}"/>`
    + '</table>';
}

/** Tabelele citite dintr-un fișier: doar cele cu nume bun și zonă întreagă, fiecare nume o singură dată (cel mult 200). */
export function cleanTables(v: unknown): SheetTable[] {
  if (!Array.isArray(v)) return [];
  const out: SheetTable[] = [];
  const int = (x: unknown, max: number) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < max ? x : -1);
  for (const x of v.slice(0, 200)) {
    const r0 = int(x?.r0, ROWS), r1 = int(x?.r1, ROWS), c0 = int(x?.c0, 16384), c1 = int(x?.c1, 16384);
    if (typeof x?.name !== 'string' || !validTableName(x.name) || r0 < 0 || r1 < r0 || c0 < 0 || c1 < c0) continue;
    if (out.some((o) => o.name.toLowerCase() === x.name.toLowerCase())) continue;
    const theme: TableTheme = x.theme in TABLE_THEMES ? x.theme : 'blue';
    const o = x.opts ?? {};
    const opts = Object.fromEntries(Object.entries(DEFAULT_TABLE_OPTS).map(([k, d]) => [k, typeof o[k] === 'boolean' ? o[k] : d])) as unknown as TableOpts;
    out.push({ name: x.name, r0, c0, r1, c1, theme, opts, ...(typeof x.style === 'string' && /^TableStyle[A-Za-z0-9]{1,20}$/.test(x.style) ? { style: x.style } : {}) });
  }
  return out;
}

/**
 * Tabelele după ce s-au scris celulele `written`: un tabel se lungește singur cu rândul scris imediat sub el (ca în programele
 * cunoscute), dacă rândul era gol în afară de ce s-a scris acum și dedesubt nu e rândul de total (acolo rămâne neschimbat).
 * Întoarce tabelele noi și stilurile rândurilor adăugate (dungi, aldin pe prima / ultima coloană), sau null dacă nu se schimbă nimic.
 */
export function growTables(
  tables: SheetTable[] | undefined,
  cells: Record<string, string>,
  styles: Record<string, CellStyle>,
  written: string[],
): { tables: SheetTable[]; styles: Record<string, CellStyle>; grown: string[] } | null {
  if (!tables?.length || !written.length) return null;
  const at = new Set(written.filter((id) => cells[id]));
  const isTotal = (raw: string | undefined) => !!subtotalOf(raw) || /^total$/i.test((raw ?? '').trim());
  const outStyles: Record<string, CellStyle> = {};
  const grown: string[] = [];
  let changed = false;
  const next = tables.map((t0) => {
    const t = { ...t0 };
    for (let guard = 0; guard < 1000 && t.r1 + 1 < ROWS; guard++) {
      const r = t.r1 + 1;
      let mine = false, other = false, totalBelow = false;
      for (let c = t.c0; c <= t.c1; c++) {
        const id = cellId(r, c);
        if (at.has(id)) mine = true; else if (cells[id]) other = true;
        if (isTotal(cells[cellId(r + 1, c)]) || isTotal(cells[id])) totalBelow = true;
      }
      if (!mine || other || totalBelow) break;
      t.r1 = r;
      if (t.style !== 'TableStyleNone') {
        const th = TABLE_THEMES[t.theme] ?? TABLE_THEMES.blue;
        const d0 = t.opts.head ? t.r0 + 1 : t.r0;
        for (let c = t.c0; c <= t.c1; c++) {
          const id = cellId(r, c);
          const st: CellStyle = { ...styles[id] };
          const band = (t.opts.bandRows && (r - d0) % 2 === 1) || (t.opts.bandCols && (c - t.c0) % 2 === 1);
          const bg = bodyBg(th, band);
          if (bg) st.bg = bg;
          if (th.bodyInk && !st.color) st.color = th.bodyInk;
          if (th.grid) { st.bd = gridBd(th, st.bd, false, c, t.c0, t.c1); st.bdColor = th.line; }
          if ((t.opts.firstCol && c === t.c0) || (t.opts.lastCol && c === t.c1)) st.b = true;
          // Formatul numerelor de deasupra (lei, procent, dată) trece și pe rândul nou.
          const up = styles[cellId(r - 1, c)];
          if (up?.fmt && !st.fmt) { st.fmt = up.fmt; if (up.dec !== undefined) st.dec = up.dec; }
          if (Object.keys(st).length) outStyles[id] = st;
        }
      }
      changed = true;
    }
    if (t.r1 !== t0.r1) grown.push(t.name);
    return t;
  });
  return changed ? { tables: next, styles: outStyles, grown } : null;
}

/**
 * Coloanele calculate (ca în programele cunoscute): o formulă scrisă într-o celulă din corpul unui tabel cu nume se completează
 * pe toată coloana, dacă restul coloanei era gol sau avea deja o singură formulă (mutată rând cu rând); rândurile noi ale unui
 * tabel care s-a lungit primesc formula coloanelor calculate de deasupra. `before` / `after` = tabelele înainte și după lungire.
 * Întoarce celulele de scris (formula mutată pe fiecare rând) și numele coloanelor completate.
 */
export function calcColumns(
  before: SheetTable[] | undefined,
  after: SheetTable[] | undefined,
  old: Record<string, string>,
  cells: Record<string, string>,
  written: string[],
): { cells: Record<string, string>; filled: string[] } {
  const out: Record<string, string> = {};
  const filled: string[] = [];
  const isTotal = (raw: string | undefined) => !!subtotalOf(raw) || /^total$/i.test((raw ?? '').trim());
  // Formula comună a rândurilor date (toate cu formulă, aceeași mutată), raportată la rândul r0; null dacă nu e una singură.
  const common = (src: Record<string, string>, rows: number[], c: number, allowEmpty: boolean): { f: string; r: number } | null => {
    let base: { f: string; r: number } | null = null;
    for (const r of rows) {
      const v = src[cellId(r, c)] ?? '';
      if (!v) { if (allowEmpty) continue; return null; }
      if (!v.startsWith('=')) return null;
      if (!base) base = { f: v, r };
      else if (shiftFormula(base.f, r - base.r, 0) !== v) return null;
    }
    return base;
  };
  (after ?? []).forEach((t, i) => {
    const t0 = before?.[i]?.name === t.name ? before[i] : t;
    const d0 = t.opts.head ? t.r0 + 1 : t.r0;
    for (let c = t.c0; c <= t.c1; c++) {
      const rows: number[] = [];
      for (let r = d0; r <= t.r1; r++) if (!isTotal(cells[cellId(r, c)]) && !isTotal(old[cellId(r, c)])) rows.push(r);
      // O singură celulă scrisă, cu formulă, în corpul tabelului: restul coloanei gol sau cu o formulă comună → toată coloana.
      if (written.length === 1) {
        const id = written[0];
        const rw = rows.find((r) => cellId(r, c) === id);
        const f = cells[id] ?? '';
        if (rw !== undefined && f.startsWith('=') && f !== (old[id] ?? '') && rows.length > 1) {
          const others = rows.filter((r) => r !== rw && r <= t0.r1);
          const empty = others.every((r) => !old[cellId(r, c)]);
          if (empty || common(old, others, c, false)) {
            for (const r of rows) if (r !== rw) out[cellId(r, c)] = shiftFormula(f, r - rw, 0);
            filled.push(t.name);
          }
          continue;
        }
      }
      // Rândurile noi (tabelul s-a lungit): formula comună a coloanei de deasupra, în celulele lor goale.
      if (t.r1 > t0.r1) {
        const above = rows.filter((r) => r <= t0.r1);
        const base = above.length ? common(cells, above, c, false) : null;
        if (!base) continue;
        for (const r of rows) if (r > t0.r1 && !cells[cellId(r, c)]) out[cellId(r, c)] = shiftFormula(base.f, r - base.r, 0);
      }
    }
  });
  return { cells: out, filled: [...new Set(filled)] };
}
