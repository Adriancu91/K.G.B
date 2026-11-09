// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Graficele din Docs: datele stau pe imagine (un mic tabel, ca în Slides), desenul e cel din Sheets (chartSvg.ts).
// În document graficul e o imagine PNG, deci ajunge la fel în .docx, .odt, PDF și pagina web; din bara lui schimbi felul, titlul și datele.
import { ChartType, chartFontOk, chartSvg, isHex, LegendPos, PALETTES, SHEET_CHART_TYPES, svgToPng } from '../sheets/chartSvg';
import type { Editor } from '@tiptap/react';
import { chartDataOf, sampleChartCells } from '../slides/chart';

export interface DocChart {
  t: ChartType; title: string; cells: string[][];
  /** Aspectul, ca în Sheets: paleta, locul legendei, valorile pe grafic, fără grilă, umplerea și conturul zonei diagramei. */
  pal?: number; leg?: LegendPos; lab?: boolean; ng?: boolean; bg?: string; ln?: string;
  /** Fontul și culoarea textului din grafic (lipsă = Segoe UI, griurile obișnuite). */
  fn?: string; ink?: string;
}

export const CHART_KINDS = SHEET_CHART_TYPES;
export const CHART_MAX_ROWS = 30;
export const CHART_MAX_COLS = 9;
/** Mărimea desenului (px), la fel ca în Sheets; în pagină se poate mări sau micșora ca orice imagine. */
export const DOC_CHART_W = 520;
export const DOC_CHART_H = 320;

export const newChart = (): DocChart => ({ t: 'col', title: 'Vânzări pe lună', cells: sampleChartCells() });

/** Descrierea graficului din atribut (text JSON sau obiect); null dacă e stricată. Celulele se taie la limitele tabelului. */
export function parseChart(v: unknown): DocChart | null {
  let o: unknown = v;
  if (typeof v === 'string') { try { o = JSON.parse(v); } catch { return null; } }
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  const t = CHART_KINDS.some(([k]) => k === x.t) ? (x.t as ChartType) : 'col';
  if (!Array.isArray(x.cells)) return null;
  const cells = x.cells.slice(0, CHART_MAX_ROWS).map((r) => (Array.isArray(r) ? r.slice(0, CHART_MAX_COLS).map((c) => String(c ?? '').slice(0, 60)) : []));
  if (cells.length < 2) return null;
  const cols = Math.max(2, Math.min(CHART_MAX_COLS, Math.max(...cells.map((r) => r.length))));
  return {
    t, title: String(x.title ?? '').slice(0, 120), cells: cells.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? '')),
    ...(Number.isInteger(x.pal) && (x.pal as number) > 0 && (x.pal as number) < PALETTES.length ? { pal: x.pal as number } : {}),
    ...(x.leg === 't' || x.leg === 'r' || x.leg === 'none' ? { leg: x.leg } : {}),
    ...(x.lab === true ? { lab: true } : {}),
    ...(x.ng === true ? { ng: true } : {}),
    ...(isHex(x.bg) ? { bg: x.bg.toLowerCase() } : {}),
    ...(isHex(x.ln) ? { ln: x.ln.toLowerCase() } : {}),
    ...(chartFontOk(x.fn) ? { fn: x.fn } : {}),
    ...(isHex(x.ink) ? { ink: x.ink.toLowerCase() } : {}),
  };
}

/** Text lipit (din Sheets, dintr-un tabel sau o foaie de calcul): rânduri pe linii, coloane cu Tab (sau ; dacă nu are Tab). */
export function cellsFromText(text: string): string[][] | null {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return null;
  const sep = lines.some((l) => l.includes('\t')) ? '\t' : ';';
  const rows = lines.slice(0, CHART_MAX_ROWS).map((l) => l.split(sep).slice(0, CHART_MAX_COLS).map((c) => c.trim().slice(0, 60)));
  if (Math.max(...rows.map((r) => r.length)) < 2) return null;
  return parseChart({ t: 'col', title: '', cells: rows })?.cells ?? null;
}

export const chartSvgOf = (c: DocChart) => chartSvg(c.t, c.title.trim(), chartDataOf(c.cells), DOC_CHART_W, DOC_CHART_H,
  { palette: c.pal, legend: c.leg, labels: c.lab, noGrid: c.ng, bg: c.bg, line: c.ln, font: c.fn, ink: c.ink });

/** Desenul graficului ca PNG (data URL), de două ori mai mare, ca să fie clar și tipărit. */
export async function chartToPng(c: DocChart): Promise<string> {
  const blob = await svgToPng(chartSvgOf(c), DOC_CHART_W, DOC_CHART_H, 2);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Textul alternativ al graficului: felul, titlul și seriile (pentru cititoarele de ecran). */
export function chartAlt(c: DocChart): string {
  const kind = (CHART_KINDS.find(([k]) => k === c.t)?.[1] ?? 'Grafic').replace(/ [(].*[)]/, '');
  const d = chartDataOf(c.cells);
  return `Grafic (${kind.toLowerCase()})${c.title.trim() ? `: ${c.title.trim()}` : ''}; ${d.series.map((s) => s.name).join(', ')} pe ${d.categories.length === 1 ? 'o categorie' : d.categories.length + ' categorii'}`.slice(0, 300);
}

/** Pune un grafic nou (cu datele de exemplu) la cursor; datele se schimbă apoi din bara lui (✎ Date). */
export async function insertChart(editor: Editor) {
  const c = newChart();
  const src = await chartToPng(c);
  editor.chain().focus().insertContent({ type: 'image', attrs: { src, alt: chartAlt(c), width: DOC_CHART_W, align: 'center', chart: JSON.stringify(c) } }).run();
}
