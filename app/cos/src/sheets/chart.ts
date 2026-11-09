// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { CellStyle, cellId, cellId as cellIdOf, colName, isNumber } from './format';
import { Range } from './fill';
import { cellText } from './filter';
import { Result } from './formula';
import { ChartData, ChartSeries, ChartType, LegendPos, isStat } from './chartSvg';
export { CHART_STYLES, CHART_FILLS, CHART_INKS, CHART_LINES, chartFontOk, isHex, recommendCharts, axisLabel, isCombo, isStat, statData, CHART_H, CHART_TYPES, CHART_W, PALETTES, paletteOf, LEGEND_POS, SHEET_CHART_TYPES, WF_DOWN, WF_UP, chartSvg, niceScale, svgToPng } from './chartSvg';
export type { ChartFx, ChartData, ChartLook, ChartSeries, ChartType, LegendPos } from './chartSvg';

// Graficele din foi: zona de date și citirea ei. Desenarea e în chartSvg.ts.

/** Un grafic salvat în foaie: tipul, zona de date („A1:C6”) și titlul. */
export interface SheetChart {
  id: string;
  type: ChartType;
  range: string;
  /** Foaia datelor, când nu e foaia pe care stă graficul (de exemplu datele pe o foaie ascunsă). */
  src?: string;
  title: string;
  /** Titlurile axelor (orizontală, verticală) și paleta de culori (indicele din PALETTES; lipsă = Colorat). */
  xTitle?: string;
  yTitle?: string;
  palette?: number;
  /** Valorile scrise pe grafic (deasupra coloanelor, lângă puncte). */
  labels?: boolean;
  /** Locul legendei (lipsă = jos; la plăcintă, în dreapta). */
  legend?: LegendPos;
  /** Graficul stă pe foaie, peste celule (ca o poză, prins de colțul unei celule), în loc de panoul din dreapta. */
  at?: ChartAt;
  /** Formatarea zonei diagramei: umplerea, conturul (culori #rrggbb) și liniile de grilă ascunse. */
  bg?: string;
  line?: string;
  noGrid?: boolean;
  /** Fontul și culoarea textului din grafic (titlu, legendă, axe, valori); lipsă = Segoe UI și griurile obișnuite. */
  font?: string;
  ink?: string;
  /** Formatare axă: minimul, maximul și pasul axei valorilor (lipsă = automat); vezi userScale. */
  axMin?: number;
  axMax?: number;
  axStep?: number;
  /** Efectul formelor seriilor (Stiluri diagramă): umbră sau degrade; lipsă = plin. */
  fx?: 'shadow' | 'grad';
  /** Seriile ascunse (Selectare date): coloanele foii care nu apar pe grafic, deși sunt în zona de date. */
  hide?: number[];
  /** Comutare rând / coloană: seriile sunt rândurile zonei, iar etichetele de pe axă sunt capul de tabel. */
  byRow?: boolean;
}

/** Graficele la care se pot comuta rândurile cu coloanele (nu la cele statistice, bule și bursă). */
export const canSwitchRC = (t: ChartType) => canHideSeries(t) && !isStat(t);
/** Datele arătate de grafic: zona citită pe coloane sau pe rânduri, fără seriile ascunse. */
export const chartDataOf = (cells: Cells, results: Results, styles: Styles, g: Range, ch: Pick<SheetChart, 'type' | 'hide' | 'byRow'>): ChartData =>
  shownData(chartData(cells, results, styles, g, isXY(ch.type), !!ch.byRow && canSwitchRC(ch.type)), ch);

/** Graficele la care se pot ascunde serii (la bule seriile merg câte două, la bursă ordinea coloanelor contează). */
export const canHideSeries = (t: ChartType) => t !== 'bubble' && t !== 'stock';
/** Datele graficului fără seriile ascunse (coloanele din hide); dacă toate ar fi ascunse, rămân toate. */
export function shownData(data: ChartData, ch: Pick<SheetChart, 'hide' | 'type'>): ChartData {
  const hide = ch.hide;
  if (!hide?.length || !data.where || !canHideSeries(ch.type)) return data;
  const cols = data.where.cols;
  const keep = cols.map((c, i) => (hide.includes(c) ? -1 : i)).filter((i) => i >= 0);
  if (!keep.length || keep.length === cols.length) return data;
  return { ...data, series: keep.map((i) => data.series[i]), where: { ...data.where, cols: keep.map((i) => cols[i]) } };
}
/** Seriile ascunse citite din fișier: coloane întregi, fără repetări, cel mult 50. */
export const cleanHide = (v: unknown): number[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out = [...new Set(v.filter((c): c is number => Number.isInteger(c) && c >= 0 && c < 16384))].slice(0, 50).sort((a, b) => a - b);
  return out.length ? out : undefined;
};

/** Scara axei citită din fișier: numere finite, maximul peste minim, pasul pozitiv; ce nu e bun se scoate. */
export function cleanAxis(o: { axMin?: unknown; axMax?: unknown; axStep?: unknown }): Pick<SheetChart, 'axMin' | 'axMax' | 'axStep'> {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e15 ? v : undefined);
  let axMin = num(o.axMin), axMax = num(o.axMax);
  const axStep = num(o.axStep);
  if (axMin !== undefined && axMax !== undefined && !(axMax > axMin)) { axMin = undefined; axMax = undefined; }
  return { ...(axMin !== undefined ? { axMin } : {}), ...(axMax !== undefined ? { axMax } : {}), ...(axStep !== undefined && axStep > 0 ? { axStep } : {}) };
}

/** Locul unui grafic de pe foaie: celula din colțul stânga sus, depărtarea de colțul ei și mărimea, în pixeli. */
export interface ChartAt { r: number; c: number; dx: number; dy: number; w: number; h: number }

export const CHART_MIN = 120;
export const CHART_MAX = 3000;

/** Locul citit din fișier: numere întregi, în limite; null dacă lipsește ceva. */
export function cleanAt(raw: unknown, rows: number, cols: number): ChartAt | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null);
  const r = int(o.r, 0, rows - 1), c = int(o.c, 0, cols - 1), w = int(o.w, CHART_MIN, CHART_MAX), h = int(o.h, CHART_MIN, CHART_MAX);
  if (r === null || c === null || w === null || h === null) return null;
  return { r, c, dx: int(o.dx, 0, 4000) ?? 0, dy: int(o.dy, 0, 4000) ?? 0, w, h };
}


type Cells = Record<string, string>;
type Styles = Record<string, CellStyle>;
type Results = Record<string, Result>;

export const MAX_CATEGORIES = 100;
export const MAX_SERIES = 8;

export function rangeText(g: Range): string {
  return `${cellId(g.r0, g.c0)}:${cellId(g.r1, g.c1)}`;
}

export function parseRangeText(s: string): Range | null {
  const m = /^([A-Z]+)([1-9]\d*):([A-Z]+)([1-9]\d*)$/.exec(s);
  if (!m) return null;
  const col = (t: string) => [...t].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const a = { r: Number(m[2]) - 1, c: col(m[1]) };
  const b = { r: Number(m[4]) - 1, c: col(m[3]) };
  return { r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r), c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c) };
}

/**
 * Citește datele unui grafic din zonă, ca Excel: dacă primul rând are doar text, e capul de tabel (numele seriilor);
 * dacă prima coloană are doar text (sau date), dă etichetele de pe axă. Restul coloanelor cu numere sunt serii.
 * La puncte și bule (`xy`), prima coloană cu numere e axa X, chiar dacă are cap de tabel.
 */
/** Graficele care au numere pe ambele axe (prima coloană = X). */
export const isXY = (t: string) => t === 'scatter' || t === 'bubble';

export function chartData(cells: Cells, results: Results, styles: Styles, g: Range, xy = false, byRow = false): ChartData {
  // Comutare rând / coloană: seriile sunt rândurile; se citește zona întoarsă (rândul r, coloana c = celula din rândul c, coloana r).
  const cellId = byRow ? (r: number, c: number) => cellIdOf(c, r) : cellIdOf;
  if (byRow) g = { r0: g.c0, r1: g.c1, c0: g.r0, c1: g.r1 };
  const raw = (r: number, c: number) => cells[cellId(r, c)]?.trim() ?? '';
  const num = (r: number, c: number): number | null => {
    const id = cellId(r, c);
    const res = results[id];
    if (res) return res.err || res.value === undefined || !Number.isFinite(res.value) ? null : res.value;
    const v = raw(r, c);
    return v && isNumber(v) ? Number(v.replace(',', '.')) : null;
  };
  const text = (r: number, c: number) => {
    const id = cellId(r, c);
    return cellText(cells[id], results[id], styles[id]).trim();
  };
  const fmtOf = (r: number, c: number) => styles[cellId(r, c)]?.fmt;

  // Capul de tabel: primul rând are ceva scris și niciun număr (în afara primei coloane).
  let header = false;
  if (g.r1 > g.r0) {
    let any = false;
    let nums = false;
    for (let c = g.c0; c <= g.c1; c++) {
      if (raw(g.r0, c)) any = true;
      if ((c > g.c0 || g.c0 === g.c1) && num(g.r0, c) !== null) nums = true;
    }
    header = any && !nums;
  }
  const r0 = header ? g.r0 + 1 : g.r0;
  const r1 = Math.min(g.r1, r0 + MAX_CATEGORIES - 1);

  // Coloana de etichete: prima coloană, dacă are text sau date calendaristice și mai sunt coloane după ea.
  let labels = false;
  if (g.c1 > g.c0) {
    let any = false;
    let allNum = true;
    for (let r = r0; r <= r1; r++) {
      if (!raw(r, g.c0)) continue;
      any = true;
      if (num(r, g.c0) === null || fmtOf(r, g.c0) === 'date') { allNum = false; }
    }
    labels = any && !allNum;
    // Prima coloană numerică dar cu cap gol (ex. anii 2023, 2024) e tot etichetă, ca în Excel.
    if (any && allNum && header && !raw(g.r0, g.c0)) labels = true;
    if (any && xy) labels = true;
  }

  const categories: string[] = [];
  for (let r = r0; r <= r1; r++) categories.push(labels ? text(r, g.c0) : String(r - r0 + 1));

  // Mai multe coloane de text una după alta (Regiune, Oraș, apoi valorile): nivelurile graficului Soare.
  const levels: string[][] = [];
  if (labels) {
    for (let c = g.c0; c < g.c1; c++) {
      let any = false, nums = false;
      for (let r = r0; r <= r1; r++) { if (raw(r, c)) { any = true; if (num(r, c) !== null && fmtOf(r, c) !== 'date') nums = true; } }
      if (c > g.c0 && (!any || nums)) break;
      const col: string[] = [];
      for (let r = r0; r <= r1; r++) col.push(text(r, c));
      levels.push(col);
    }
  }

  const series: ChartSeries[] = [];
  const cols: number[] = [];
  for (let c = labels ? g.c0 + 1 : g.c0; c <= g.c1 && series.length < MAX_SERIES; c++) {
    const values: number[] = [];
    let any = false;
    for (let r = r0; r <= r1; r++) {
      const x = num(r, c);
      if (x !== null) any = true;
      values.push(x ?? NaN);
    }
    if (!any) continue;
    const auto = byRow ? `Rândul ${c + 1}` : `Coloana ${colName(c)}`;
    const name = header ? text(g.r0, c) || auto : auto;
    series.push({ name, values });
    cols.push(c);
  }
  // Rândurile complet goale de la coadă nu apar pe grafic.
  while (categories.length && !categories[categories.length - 1] && series.every((s) => Number.isNaN(s.values[categories.length - 1]))) {
    categories.pop();
    for (const s of series) s.values.pop();
    for (const l of levels) l.pop();
  }
  return { categories, series, ...(levels.length >= 2 ? { levels } : {}), where: { header, labels, r0, r1: r0 + categories.length - 1, cols, ...(byRow ? { byRow: true } : {}) } };
}
