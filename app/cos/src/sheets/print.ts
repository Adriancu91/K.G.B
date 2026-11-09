// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { COL_W, colName, COLS, ROWS } from './format';
import type { Range } from './fill';
import { parseRangeText } from './chart';

/** Setările de tipărire ale unei foi (se salvează în .ssheet). */
export interface SheetPrint {
  /** Zona de tipărit („A1:F30”); fără ea se tipărește tot ce e completat. */
  area?: string;
  /** Pagina pe lung (peisaj). */
  landscape?: boolean;
  /** Micșorează tabelul ca să încapă pe lățimea paginii. */
  fit?: boolean;
  /** Cu „fit”: micșorează și pe înălțime, ca tot tabelul să încapă pe o singură pagină. */
  onePage?: boolean;
  /** Primul rând al zonei (capul de tabel) se repetă sus pe fiecare pagină. */
  head?: boolean;
  /** Mărimea la tipărire în procente (când nu se potrivește pe lățime), între MIN_PRINT_SCALE și MAX_PRINT_SCALE. */
  scale?: number;
  /** Câte rânduri de sus se repetă (capul de tabel pe mai multe rânduri), între 1 și MAX_HEAD_ROWS. */
  headRows?: number;
  /** Câte coloane din stânga zonei se repetă pe fiecare pagină alăturată, când tabelul e mai lat decât pagina (0 = niciuna). */
  leftCols?: number;
  /** Linii subțiri între celule, ca în grilă. */
  grid?: boolean;
  /** Literele coloanelor (A, B, C…) sus și numerele rândurilor în stânga, ca pe ecran. */
  headings?: boolean;
  /** Graficele se tipăresc după tabel. */
  charts?: boolean;
  /** Mărimea hârtiei (implicit A4). */
  paper?: PrintPaper;
  /** Marginile paginii: înguste, obișnuite sau late. */
  margin?: PrintMargin;
  /** Textul de sus al fiecărei pagini (poate avea [Data], [Ora], [Fișier], [Foaie]). */
  header?: string;
  /** Textul de jos al fiecărei pagini. */
  footer?: string;
  /** „Pagina 1 din 3” jos, la mijloc. */
  numbers?: boolean;
  /** Sfârșiturile de pagină puse de mână: rândurile (de la 0) cu care începe o pagină nouă, crescător. */
  breaks?: number[];
  /** Sfârșiturile de pagină pe coloane: coloanele (de la 0) cu care începe o pagină alăturată nouă, crescător. */
  colBreaks?: number[];
}

/** Câmpurile care se completează la tipărire, în antet și subsol. */
export const HF_FIELDS = ['[Data]', '[Ora]', '[Fișier]', '[Foaie]'] as const;

/** Antetul / subsolul cu câmpurile completate (data și ora de acum, numele fișierului și al foii). */
export function fillHF(text: string | undefined, file: string, sheet: string, now = new Date()): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return (text ?? '')
    .replace(/\[Data\]/gi, `${two(now.getDate())}.${two(now.getMonth() + 1)}.${now.getFullYear()}`)
    .replace(/\[Ora\]/gi, `${two(now.getHours())}:${two(now.getMinutes())}`)
    .replace(/\[Fi[șs]ier\]/gi, file)
    .replace(/\[Foaie\]/gi, sheet)
    .trim();
}

/**
 * Antetul sau subsolul dintr-un .xlsx („&LStânga&CMijloc&RDreapta”, cu &P pagina, &N numărul de pagini, &D data…)
 * → textul nostru (părțile unite cu „ · ”) și dacă are numărul paginii.
 */
export function fromExcelHF(src: string): { text: string; numbers: boolean } {
  const parts: string[] = [];
  let numbers = false;
  for (const sec of src.split(/&(?=[LCR])/)) {
    let s = sec.replace(/^[LCR]/, '');
    if (/&[PN]/.test(s)) numbers = true;
    s = s
      .replace(/&&/g, '\u0000')
      .replace(/&"[^"]*"/g, '') // fontul
      .replace(/&K[0-9A-Fa-f]{6}/g, '') // culoarea
      .replace(/&\d+/g, '') // mărimea
      .replace(/&D/g, '[Data]').replace(/&T/g, '[Ora]').replace(/&[FZ]/g, '[Fișier]').replace(/&A/g, '[Foaie]')
      // „Page &P of &N”, „Pagina &P din &N”, „&P / &N”: numerotarea noastră le pune singură.
      .replace(/(?:Page|Pagina|Seite|Página|Pag\.?)?\s*&P(?:\s*(?:of|din|von|de|\/)\s*&N)?/gi, '')
      .replace(/&N/g, '')
      .replace(/&[A-Za-z]/g, '') // aldin, cursiv, imagini și altele
      .replace(/\u0000/g, '&')
      .replace(/\s+/g, ' ')
      .replace(/^[\s·|,–-]+|[\s·|,–-]+$/g, ''); // ce rămâne de la „Raport · Pagina &P”
    if (s) parts.push(s);
  }
  return { text: parts.join(' · ').slice(0, 200), numbers };
}

/** Textul nostru → antet sau subsol .xlsx, la mijloc (câmpurile devin coduri Excel). */
export function toExcelHF(text: string | undefined, numbers = false): string {
  let s = (text ?? '').replace(/&/g, '&&')
    .replace(/\[Data\]/gi, '&D').replace(/\[Ora\]/gi, '&T').replace(/\[Fi[șs]ier\]/gi, '&F').replace(/\[Foaie\]/gi, '&A')
    .trim();
  if (numbers) s = (s ? s + ' · ' : '') + 'Pagina &P din &N';
  return s ? '&C' + s : '';
}

export type PrintPaper = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal';
export type PrintMargin = 'narrow' | 'normal' | 'wide';
/** Lățimea și înălțimea hârtiei (pe portret), în milimetri. */
export const PAPERS: Record<PrintPaper, [number, number]> = { A4: [210, 297], A3: [297, 420], A5: [148, 210], Letter: [216, 279], Legal: [216, 356] };
/** Marginea fiecărei laturi, în milimetri. */
export const MARGINS: Record<PrintMargin, number> = { narrow: 6, normal: 12, wide: 25 };
export const MARGIN_NAMES: Record<PrintMargin, string> = { narrow: 'Înguste (0,6 cm)', normal: 'Obișnuite (1,2 cm)', wide: 'Late (2,5 cm)' };

export const DEFAULT_PRINT: Required<Omit<SheetPrint, 'area' | 'breaks' | 'colBreaks'>> = {
  landscape: false, fit: true, onePage: false, scale: 100, head: true, headRows: 1, leftCols: 0, grid: false, headings: false, charts: true, paper: 'A4', margin: 'normal', header: '', footer: '', numbers: false,
};

const PX_PER_MM = 96 / 25.4;

/** Mărimea paginii pentru @page: lățime și înălțime în milimetri, după orientare. */
export function pageSizeMm(landscape: boolean, paper: PrintPaper = 'A4'): [number, number] {
  const [w, h] = PAPERS[paper] ?? PAPERS.A4;
  return landscape ? [h, w] : [w, h];
}

/** Lățimea utilă a paginii (fără margini), în pixeli CSS. */
export function pageWidthPx(landscape: boolean, paper: PrintPaper = 'A4', margin: PrintMargin = 'normal'): number {
  return Math.floor((pageSizeMm(landscape, paper)[0] - 2 * (MARGINS[margin] ?? 12)) * PX_PER_MM);
}

/** Cea mai mică zonă care cuprinde toate celulele completate (null dacă tabelul e gol). */
export function usedRange(cells: Record<string, string>): Range | null {
  let g: Range | null = null;
  for (const [id, v] of Object.entries(cells)) {
    if (!v.trim()) continue;
    const m = /^([A-Z]+)(\d+)$/.exec(id);
    if (!m) continue;
    const c = [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    const r = Number(m[2]) - 1;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
    if (!g) g = { r0: r, r1: r, c0: c, c1: c };
    else g = { r0: Math.min(g.r0, r), r1: Math.max(g.r1, r), c0: Math.min(g.c0, c), c1: Math.max(g.c1, c) };
  }
  return g;
}

/** Zona care se tipărește: cea aleasă (dacă e validă și încape în tabel) sau tot ce e completat. */
export function printRange(cells: Record<string, string>, p: SheetPrint | undefined, pics?: { r: number; c: number }[]): Range | null {
  const g = p?.area ? parseRangeText(p.area) : null;
  const used = usedRange(cells);
  if (g && g.r1 < ROWS && g.c1 < COLS) return used && g.r1 > used.r1 ? { ...g, r1: Math.max(g.r0, used.r1) } : g;
  // Fără zonă aleasă: se tipăresc și celulele de care sunt prinse pozele (o siglă deasupra tabelului).
  let out = used;
  for (const q of pics ?? []) out = out ? { r0: Math.min(out.r0, q.r), c0: Math.min(out.c0, q.c), r1: Math.max(out.r1, q.r), c1: Math.max(out.c1, q.c) } : { r0: q.r, c0: q.c, r1: q.r, c1: q.c };
  return out;
}

/** Lățimile coloanelor zonei, în pixeli. */
export function printWidths(g: Range, colW: Record<string, number>): number[] {
  const out: number[] = [];
  for (let c = g.c0; c <= g.c1; c++) out.push(colW[colName(c)] ?? COL_W);
  return out;
}

/** Cât se micșorează tabelul ca să încapă pe lățime (1 = deloc; nu sub 30%, ca textul să rămână citibil). */
export function fitScale(widths: number[], landscape: boolean, fit: boolean, paper?: PrintPaper, margin?: PrintMargin, pct?: number): number {
  const total = widths.reduce((a, b) => a + b, 0);
  // Fără potrivire: mărimea aleasă de mână (100% dacă nu e aleasă).
  if (!fit) return pct && pct >= MIN_PRINT_SCALE && pct <= MAX_PRINT_SCALE ? pct / 100 : 1;
  if (total <= 0) return 1;
  const s = pageWidthPx(landscape, paper, margin) / total;
  return s >= 1 ? 1 : Math.max(0.3, Math.floor(s * 100) / 100);
}

/** Câte pagini acoperă tabelul pe lățime (fără potrivire, coloanele care nu încap trec pe pagini noi). */
export function pagesAcross(widths: number[], landscape: boolean, scale: number, paper?: PrintPaper, margin?: PrintMargin): number {
  const total = widths.reduce((a, b) => a + b, 0) * scale;
  return Math.max(1, Math.ceil(total / pageWidthPx(landscape, paper, margin) - 0.001));
}

/** Rândurile tipărite: cele din zonă, fără cele ascunse de filtru. */
export function printRows(g: Range, hidden: Set<number>): number[] {
  const out: number[] = [];
  for (let r = g.r0; r <= g.r1; r++) if (!hidden.has(r)) out.push(r);
  return out;
}

/** Cât loc ia antetul sau subsolul pe pagină, în pixeli (un rând de text cu spațiu). */
const HF_PX = 30;

/** Înălțimea utilă a paginii, în pixeli: hârtia fără margini, antet și subsol. */
function usableHeightPx(s: Required<Omit<SheetPrint, 'area' | 'breaks' | 'colBreaks'>>): number {
  const extra = (s.header.trim() ? HF_PX : 0) + (s.footer.trim() || s.numbers ? HF_PX : 0);
  return (pageSizeMm(s.landscape, s.paper)[1] - 2 * (MARGINS[s.margin] ?? 12)) * PX_PER_MM - extra;
}

/**
 * Mărimea tabelului pe hârtie: potrivit pe lățime (sau procentul ales) și, cu „Totul pe o singură pagină”,
 * micșorat și cât să încapă pe înălțime. tallPx = înălțimea tuturor rândurilor tipărite, la 100%.
 */
export function printScale(widths: number[], p: SheetPrint | undefined, tallPx?: number): number {
  const s = { ...DEFAULT_PRINT, ...p };
  const w = fitScale(widths, s.landscape, s.fit, s.paper, s.margin, s.scale);
  if (!s.fit || !s.onePage || !tallPx || tallPx <= 0) return w;
  const h = usableHeightPx(s) / tallPx;
  return h >= w ? w : Math.max(0.1, Math.floor(h * 100) / 100);
}

/**
 * Unde începe singură o pagină nouă la tipărire (liniile punctate din „Vedere pagini”): rândurile și coloanele cu care
 * începe o pagină, după înălțimea / lățimea utilă a hârtiei, micșorarea „pe lățime”, antet / subsol, capul de tabel repetat
 * și sfârșiturile puse de mână (după ele numărătoarea o ia de la capăt).
 */
export function autoBreaks(rows: number[], heightOf: (r: number) => number, widths: number[], c0: number, p: SheetPrint | undefined): { rows: number[]; cols: number[] } {
  const s = { ...DEFAULT_PRINT, ...p };
  const scale = printScale(widths, s, s.onePage ? rows.reduce((a, r) => a + heightOf(r), 0) : undefined);
  const pageH = usableHeightPx(s);
  const manual = new Set(p?.breaks ?? []);
  let head = 0;
  for (let i = 0; i < headCount(s, rows.length); i++) head += heightOf(rows[i]) * scale;
  const outR: number[] = [];
  let used = 0;
  rows.forEach((r, i) => {
    const h = heightOf(r) * scale;
    if (i > 0 && manual.has(r)) used = head;
    else if (i > 0 && used > head && used + h > pageH) { outR.push(r); used = head; }
    used += h;
  });
  const outC = colPages(widths, s, scale, c0).slice(1).map((p) => c0 + p[0]);
  return { rows: outR, cols: outC };
}

/** Cel mult atâtea coloane repetate în stânga pe fiecare pagină. */
export const MAX_LEFT_COLS = 10;

/** Câte dintre primele coloane ale zonei se repetă în stânga pe paginile alăturate (rămâne mereu cel puțin o coloană de date). */
export function leftCount(p: SheetPrint | undefined, colCount: number): number {
  const n = Math.floor({ ...DEFAULT_PRINT, ...p }.leftCols) || 0;
  return Math.max(0, Math.min(MAX_LEFT_COLS, n, colCount - 1));
}

/**
 * Coloanele (indici în zonă) de pe fiecare pagină alăturată, de la stânga la dreapta, fără cele repetate:
 * pe prima pagină coloanele intră pe rând cât încap; pe următoarele, după coloanele repetate din stânga.
 */
export function colPages(widths: number[], p: SheetPrint | undefined, scale: number, c0 = 0): number[][] {
  const s = { ...DEFAULT_PRINT, ...p };
  // Coloanele cu care începe de mână o pagină nouă (indici în foaie; zona începe la c0).
  const manual = new Set(p?.colBreaks ?? []);
  const pageW = pageWidthPx(s.landscape, s.paper, s.margin);
  const rep = leftCount(s, widths.length);
  let repW = 0;
  for (let i = 0; i < rep; i++) repW += widths[i] * scale;
  // Coloanele repetate prea late (peste jumătate de pagină) nu se mai repetă: n-ar rămâne loc pentru date.
  if (repW > pageW / 2) repW = 0;
  const pages: number[][] = [[]];
  let w = 0;
  widths.forEach((x, i) => {
    const cw = x * scale, cur = pages[pages.length - 1];
    if (cur.length && (manual.has(c0 + i) || w + cw > pageW + 0.5)) { pages.push([i]); w = repW + cw; return; }
    cur.push(i);
    w += cw;
  });
  return pages;
}

/** Coloanele tipărite pe fiecare pagină alăturată, cu cele repetate în față (indici în zonă). */
export function printColGroups(widths: number[], p: SheetPrint | undefined, scale: number, c0 = 0): number[][] {
  const pages = colPages(widths, p, scale, c0);
  if (pages.length < 2) return pages;
  const s = { ...DEFAULT_PRINT, ...p };
  const rep = leftCount(s, widths.length);
  let repW = 0;
  for (let i = 0; i < rep; i++) repW += widths[i] * scale;
  const lead = repW > pageWidthPx(s.landscape, s.paper, s.margin) / 2 ? [] : Array.from({ length: rep }, (_, i) => i);
  return pages.map((pg, k) => (k === 0 ? pg : [...lead.filter((i) => i < pg[0]), ...pg]));
}

/** Mărimea la tipărire aleasă de mână: între 10% și 400%. */
export const MIN_PRINT_SCALE = 10;
export const MAX_PRINT_SCALE = 400;

/** Cel mult atâtea rânduri repetate sus pe fiecare pagină. */
export const MAX_HEAD_ROWS = 20;

/** Câte dintre primele rânduri tipărite se repetă sus pe fiecare pagină (rămâne mereu cel puțin un rând de date). */
export function headCount(p: SheetPrint | undefined, rowCount: number): number {
  const s = { ...DEFAULT_PRINT, ...p };
  if (!s.head || rowCount < 2) return 0;
  return Math.max(1, Math.min(MAX_HEAD_ROWS, Math.floor(s.headRows) || 1, rowCount - 1));
}

/** Curăță setările citite din fișier. */
export function cleanPrint(raw: unknown): SheetPrint | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as Record<string, unknown>;
  const out: SheetPrint = {};
  if (typeof p.area === 'string' && parseRangeText(p.area)) out.area = p.area;
  for (const k of ['header', 'footer'] as const) {
    if (typeof p[k] === 'string' && (p[k] as string).trim()) out[k] = (p[k] as string).slice(0, 200);
  }
  for (const k of ['landscape', 'fit', 'onePage', 'head', 'grid', 'headings', 'charts', 'numbers'] as const) {
    if (typeof p[k] === 'boolean') out[k] = p[k] as boolean;
  }
  if (typeof p.scale === 'number' && Number.isInteger(p.scale) && p.scale >= MIN_PRINT_SCALE && p.scale <= MAX_PRINT_SCALE && p.scale !== 100) out.scale = p.scale;
  if (typeof p.headRows === 'number' && Number.isInteger(p.headRows) && p.headRows >= 1 && p.headRows <= MAX_HEAD_ROWS) out.headRows = p.headRows;
  if (typeof p.leftCols === 'number' && Number.isInteger(p.leftCols) && p.leftCols >= 1 && p.leftCols <= MAX_LEFT_COLS) out.leftCols = p.leftCols;
  if (typeof p.paper === 'string' && p.paper in PAPERS) out.paper = p.paper as PrintPaper;
  if (typeof p.margin === 'string' && p.margin in MARGINS) out.margin = p.margin as PrintMargin;
  if (Array.isArray(p.breaks)) {
    const b = [...new Set(p.breaks.filter((x): x is number => Number.isInteger(x) && x > 0 && x < ROWS))].sort((a, z) => a - z).slice(0, 1000);
    if (b.length) out.breaks = b;
  }
  if (Array.isArray(p.colBreaks)) {
    const b = [...new Set(p.colBreaks.filter((x): x is number => Number.isInteger(x) && x > 0 && x < COLS))].sort((a, z) => a - z).slice(0, 1000);
    if (b.length) out.colBreaks = b;
  }
  return Object.keys(out).length ? out : undefined;
}

