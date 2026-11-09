// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Graficele de pe slide: datele stau în celulele elementului (ca un mic tabel Sheets), desenul e cel din Sheets.
import { ChartData, chartSvg, ChartSeries } from '../sheets/chartSvg';
import { SlideEl } from './model';

/** Graficul nou: un exemplu pe care îl schimbi (sau peste care lipești date din Sheets / Excel). */
export const sampleChartCells = (): string[][] => [
  ['', 'Vânzări'],
  ['Ian', '120'],
  ['Feb', '150'],
  ['Mar', '90'],
  ['Apr', '180'],
];

/** Un număr scris românește sau englezește: „1.234,56”, „1234.5”, „250 lei”, „15%”. Altceva → NaN. */
export function parseNum(raw: string): number {
  let t = raw.replace(/\s| /g, '').replace(/(lei|ron|eur|€|\$|%)$/i, '');
  if (!t) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ''); // 1.500 = o mie cinci sute
  return /^-?\d*\.?\d+(e-?\d+)?$/i.test(t) ? Number(t) : NaN;
}

/** Celulele → datele graficului: rândul 1 dă numele seriilor, coloana A etichetele; coloanele fără numere se sar. */
/** Schimbă rândurile cu coloanele (seriile devin categorii și invers); null dacă n-ar mai încăpea în limitele tabelului. */
export function transposeCells(cells: string[][], maxRows: number, maxCols: number): string[][] | null {
  const rows = cells.length, cols = cells[0]?.length ?? 0;
  if (!rows || cols > maxRows || rows > maxCols) return null;
  return Array.from({ length: cols }, (_, c) => Array.from({ length: rows }, (_, r) => cells[r]?.[c] ?? ''));
}

/** Seriile graficului: coloana din tabel și numele (doar coloanele cu numere). */
export function chartSeriesOf(cells: string[][]): [number, string][] {
  const rows = cells.slice(1).filter((r) => r.some((t) => t.trim()));
  const out: [number, string][] = [];
  for (let c = 1; c < (cells[0]?.length ?? 0); c++) if (rows.some((r) => Number.isFinite(parseNum(r[c] ?? '')))) out.push([c, cells[0][c]?.trim() || `Seria ${c}`]);
  return out;
}

/** Celulele → datele graficului, fără seriile ascunse (coloanele din `hide`); dacă ar rămâne fără nicio serie, le arată pe toate. */
export function chartDataOf(cells: string[][], hide?: number[]): ChartData {
  const rows = cells.slice(1).filter((r) => r.some((t) => t.trim()));
  const categories = rows.map((r) => r[0]?.trim() ?? '');
  const all = chartSeriesOf(cells), shown = all.filter(([c]) => !hide?.includes(c));
  const series: ChartSeries[] = (shown.length ? shown : all).map(([c, name]) => ({ name, values: rows.map((r) => parseNum(r[c] ?? '')) }));
  return { categories, series };
}

/** Pe slide, graficul se desenează mai mic și se mărește, ca literele să se citească de la distanță. */
const ZOOM = 1.6;

/** Desenul graficului ca imagine (data URL SVG), la mărimea casetei. */
export function chartUrl(el: SlideEl): string {
  const svg = chartSvg(el.chart ?? 'col', el.text.trim(), chartDataOf(el.cells ?? [], el.choff), Math.round(el.w / ZOOM), Math.round(el.h / ZOOM),
    { palette: el.cpal, xTitle: el.cxt, yTitle: el.cyt, labels: el.clab, legend: el.cleg, noGrid: el.cng, bg: el.cbg, line: el.cln, font: el.cfont, ink: el.cink });
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
