// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Graficele din .ods / .fods: fiecare grafic e un obiect încorporat (draw:frame / draw:object) cu un chart:chart
// în „Object N/content.xml” (în .fods, chiar în draw:object). Le aducem ca grafice Suite (SheetChart): tipul, zona de date,
// titlurile, legenda, valorile pe grafic și grila. Graficul ajunge pe foaia din care își ia datele; dacă e aceeași foaie
// cu cea pe care stă, își păstrează locul și mărimea.
import JSZip from 'jszip';
import { cellId, ROWS, COLS } from './format';
import { canHideSeries, canSwitchRC, ChartAt, cleanAt, LegendPos, SheetChart } from './chart';
import { ChartType } from './chartSvg';
import { attr, deep, el, els, odfLength } from '../odf';

/** Cel mult atâtea grafice pe o foaie (ca la .xlsx). */
const MAX_PER_SHEET = 20;

interface Box { sheet: string; r0: number; c0: number; r1: number; c1: number }

const colIdx = (s: string) => [...s.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const unq = (s: string) => (s.startsWith("'") ? s.slice(1, -1).replace(/''/g, "'") : s);

/** O adresă ODF („Data.A2:Data.B4”, „$'Foaia 1'.$A$1:.$B$3”, „Data.B1”) → foaia și zona; null dacă nu se înțelege. */
export function odsRange(s: string): Box | null {
  const SH = String.raw`\$?('(?:[^']|'')+'|[^.' ]*)`;
  const m = new RegExp(String.raw`^${SH}\.\$?([A-Za-z]{1,3})\$?(\d+)(?::${SH}\.\$?([A-Za-z]{1,3})\$?(\d+))?$`).exec(s.trim());
  if (!m || !m[1]) return null;
  const sheet = unq(m[1]);
  if (m[4] && unq(m[4]) && unq(m[4]) !== sheet) return null;
  const a = { r: Number(m[3]) - 1, c: colIdx(m[2]) };
  const b = m[5] ? { r: Number(m[6]) - 1, c: colIdx(m[5]) } : a;
  if (a.r < 0 || b.r < 0) return null;
  return { sheet, r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c) };
}

/** O listă de adrese despărțite prin spații (numele de foi între ghilimele pot avea spații). */
export function odsRanges(s: string | null): Box[] {
  if (!s) return [];
  const parts = s.match(/(?:'(?:[^']|'')*'|[^ ])+/g) ?? [];
  return parts.map(odsRange).filter((b): b is Box => !!b);
}

/** Stilurile automate ale obiectului: numele → atributele din style:chart-properties. */
function chartProps(doc: Document | Element): Map<string, Element> {
  const out = new Map<string, Element>();
  const auto = deep(doc, 'automatic-styles');
  for (const s of auto ? els(auto, 'style') : []) {
    const p = el(s, 'chart-properties');
    const n = attr(s, 'name');
    if (p && n) out.set(n, p);
  }
  return out;
}

const titleText = (n: Element | undefined) => (n ? els(n, 'p').map((p) => p.textContent ?? '').join(' ').trim().slice(0, 200) : '');

/** Un chart:chart → grafic Suite, cu foaia din care vin datele; null dacă felul lui nu există în Suite sau n-are date din foi. */
export function chartFromOds(doc: Document | Element, id: string): { sheet: string; chart: SheetChart } | null {
  const chart = findChart(doc);
  if (!chart) return null;
  const props = chartProps(doc);
  const plot = el(chart, 'plot-area');
  if (!plot) return null;
  const pp = props.get(attr(plot, 'style-name') ?? '');
  const on = (p: Element | undefined, k: string) => !!p && attr(p, k) === 'true';
  const cls = (attr(chart, 'class') ?? '').replace(/^chart:/, '');
  const series = els(plot, 'series');
  const sCls = series.map((s) => (attr(s, 'class') ?? '').replace(/^chart:/, ''));
  let type: ChartType;
  if (cls === 'bar') {
    const horiz = on(pp, 'vertical');
    type = on(pp, 'percentage') ? (horiz ? 'barStack100' : 'stack100') : on(pp, 'stacked') ? (horiz ? 'barStack' : 'stack') : horiz ? 'bar' : 'col';
    // Coloane cu o serie desenată ca linie = grafic combinat.
    if (!horiz && type === 'col' && sCls.some((c) => c === 'line')) type = 'combo';
  } else if (cls === 'line') type = 'line';
  else if (cls === 'area') type = 'area';
  else if (cls === 'circle') type = 'pie';
  else if (cls === 'ring') type = 'doughnut';
  else if (cls === 'scatter') type = 'scatter';
  else if (cls === 'bubble') type = 'bubble';
  // Radarul (chart:radar) și radarul umplut (chart:filled-radar).
  else if (cls === 'radar') type = 'radar';
  else if (cls === 'filled-radar') type = 'radarFill';
  else return null;

  // Zona de date: valorile seriilor, axa X (categorii sau chart:domain) și numele seriilor, toate din aceeași foaie.
  const vals = series.flatMap((s) => odsRanges(attr(s, 'values-cell-range-address')));
  const xAxis = els(plot, 'axis').find((a) => attr(a, 'dimension') === 'x');
  const extra = [
    ...odsRanges(xAxis && el(xAxis, 'categories') ? attr(el(xAxis, 'categories')!, 'cell-range-address') : null),
    ...series.flatMap((s) => els(s, 'domain').flatMap((d) => odsRanges(attr(d, 'cell-range-address')))),
    ...series.flatMap((s) => odsRanges(attr(s, 'label-cell-address'))),
  ];
  const all = vals.length ? vals : odsRanges(attr(plot, 'cell-range-address'));
  if (!all.length) return null;
  const sheet = all[0].sheet;
  if (all.some((b) => b.sheet !== sheet)) return null;
  let box = { r0: Math.min(...all.map((b) => b.r0)), c0: Math.min(...all.map((b) => b.c0)), r1: Math.max(...all.map((b) => b.r1)), c1: Math.max(...all.map((b) => b.c1)) };
  // Etichetele și categoriile intră în zonă doar dacă sunt pe aceeași foaie și lângă date (capul de tabel, prima coloană).
  for (const b of extra) {
    if (b.sheet !== sheet) continue;
    const near = b.r1 >= box.r0 - 1 && b.r0 <= box.r1 + 1 && b.c1 >= box.c0 - 1 && b.c0 <= box.c1 + 1;
    if (near) box = { r0: Math.min(box.r0, b.r0), c0: Math.min(box.c0, b.c0), r1: Math.max(box.r1, b.r1), c1: Math.max(box.c1, b.c1) };
  }
  if (box.r1 >= ROWS || box.c1 >= COLS) return null;

  const out: SheetChart = { id, type, range: `${cellId(box.r0, box.c0)}:${cellId(box.r1, box.c1)}`, title: titleText(el(chart, 'title')) };
  for (const a of els(plot, 'axis')) {
    const t = titleText(el(a, 'title')).slice(0, 100);
    const dim = attr(a, 'dimension');
    if (t && dim === 'x' && !out.xTitle) out.xTitle = t;
    else if (t && dim === 'y' && !out.yTitle) out.yTitle = t;
  }
  // Barele orizontale: în ODF axa X e cea verticală, deci titlurile se schimbă între ele.
  if ((type === 'bar' || type === 'barStack' || type === 'barStack100') && (out.xTitle || out.yTitle)) [out.xTitle, out.yTitle] = [out.yTitle, out.xTitle];
  if (!out.xTitle) delete out.xTitle;
  if (!out.yTitle) delete out.yTitle;
  // Legenda: lipsă = „Fără” (la plăcintă sau la mai multe serii); sus / dreapta se păstrează.
  const leg = el(chart, 'legend');
  const round = type === 'pie' || type === 'doughnut';
  if (!leg) { if (round || series.length > 1) out.legend = 'none'; }
  else if (!round) {
    const lp = attr(leg, 'legend-position') ?? 'end';
    const pos: LegendPos | undefined = lp === 'top' ? 't' : /end|start|right|left/.test(lp) ? 'r' : undefined;
    if (pos) out.legend = pos;
  }
  // Valorile pe grafic: o serie (sau toată zona) cu chart:data-label-number = value.
  const showVal = (p?: Element) => !!p && /^value/.test(attr(p, 'data-label-number') ?? '');
  if (!round && (showVal(pp) || series.some((s) => showVal(props.get(attr(s, 'style-name') ?? ''))))) out.labels = true;
  // Grila: graficele cu axe la care axa Y n-are chart:grid.
  const yAx = els(plot, 'axis').find((a) => attr(a, 'dimension') === 'y');
  if (!round && yAx && !el(yAx, 'grid')) out.noGrid = true;
  // Comutare rând / coloană și seriile ascunse, ca la .xlsx.
  const v0 = vals[0];
  const byRow = !!v0 && canSwitchRC(type) && v0.r0 === v0.r1 && v0.c1 > v0.c0;
  if (byRow) out.byRow = true;
  const lineOf = (b: Box) => (byRow ? (b.r0 === b.r1 ? b.r0 : -1) : b.c0 === b.c1 ? b.c0 : -1);
  const valCols = vals.map(lineOf).filter((c) => c >= 0);
  const catCols = extra.filter((b) => b.sheet === sheet).map(lineOf).filter((c) => c >= 0);
  const hide: number[] = [];
  if (canHideSeries(type) && valCols.length) for (let c = Math.min(...valCols) + 1; c < Math.max(...valCols); c++) if (!valCols.includes(c) && !catCols.includes(c)) hide.push(c);
  if (hide.length) out.hide = hide.slice(0, 50);
  return { sheet, chart: out };
}

function findChart(doc: Document | Element): Element | undefined {
  const body = deep(doc, 'body');
  const office = body ? el(body, 'chart') : undefined;
  return office ? el(office, 'chart') : deep(doc, 'chart');
}

interface Frame { frame: Element; obj: Element; r: number; c: number; inShapes: boolean }

/** Cadrele cu obiecte ale unei foi, cu celula în care stau (sau 0, 0 pentru cele din table:shapes). */
function framesOf(table: Element): Frame[] {
  const out: Frame[] = [];
  const take = (n: Element, r: number, c: number, inShapes: boolean) => {
    for (const f of els(n, 'frame')) { const obj = el(f, 'object'); if (obj) out.push({ frame: f, obj, r, c, inShapes }); }
    for (const g of els(n, 'g')) take(g, r, c, inShapes);
  };
  const sh = el(table, 'shapes');
  if (sh) take(sh, 0, 0, true);
  let r = 0;
  const walk = (n: Element) => {
    for (const k of els(n)) {
      if (r >= ROWS) return;
      if (k.localName === 'table-row') {
        let c = 0;
        for (const cell of els(k)) {
          if (cell.localName !== 'table-cell' && cell.localName !== 'covered-table-cell') continue;
          take(cell, r, c, false);
          c += Number(attr(cell, 'number-columns-repeated') ?? 1) || 1;
        }
        r += Number(attr(k, 'number-rows-repeated') ?? 1) || 1;
      } else if (k.localName === 'table-row-group' || /^table-(header-)?rows$/.test(k.localName)) walk(k);
    }
  };
  walk(table);
  return out;
}

/**
 * Pune graficele din fișier pe foile Suite. `tables[i]` e foaia din fișier pentru `sheets[i]`; `names` = numele lor din fișier.
 * Întoarce câte obiecte n-au putut fi aduse (alt fel de obiect, date din mai multe foi, prea multe grafice).
 */
export async function readOdsCharts(zip: JSZip | null, tables: Element[], sheets: { charts: SheetChart[] }[], names: string[]): Promise<number> {
  let skipped = 0;
  let n = 0;
  for (let i = 0; i < tables.length; i++) {
    for (const f of framesOf(tables[i])) {
      let doc: Document | Element | null = null;
      const inline = el(f.obj, 'document');
      if (inline) doc = inline;
      else {
        const href = (attr(f.obj, 'href') ?? '').replace(/^\.\//, '').replace(/\/$/, '');
        const xml = href && zip ? await zip.file(`${href}/content.xml`)?.async('string') : undefined;
        if (xml) {
          const d = new DOMParser().parseFromString(xml, 'application/xml');
          if (!d.getElementsByTagName('parsererror').length) doc = d;
        }
      }
      const got = doc ? chartFromOds(doc, `g${Date.now().toString(36)}o${n++}`) : null;
      const k = got ? names.indexOf(got.sheet) : -1;
      // Graficul stă pe foaia lui (la locul lui); datele de pe altă foaie se iau de acolo (src).
      if (!got || k < 0 || sheets[i].charts.length >= MAX_PER_SHEET) { skipped++; continue; }
      if (k !== i) got.chart.src = names[k];
      {
        const w = odfLength(attr(f.frame, 'width')), h = odfLength(attr(f.frame, 'height'));
        const raw: Partial<ChartAt> = f.inShapes
          ? { r: 0, c: 0, dx: odfLength(attr(f.frame, 'x')) ?? 0, dy: odfLength(attr(f.frame, 'y')) ?? 0 }
          : { r: f.r, c: f.c, dx: 0, dy: 0 };
        const at = w && h ? cleanAt({ ...raw, w, h }, ROWS, COLS) : null;
        if (at) got.chart.at = at;
      }
      sheets[i].charts.push(got.chart);
    }
  }
  return skipped;
}
