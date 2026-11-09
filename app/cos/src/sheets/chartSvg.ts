// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Desenarea graficelor (coloane, bare, linie, arie, plăcintă, inel, puncte) ca SVG, fără bibliotecă și fără alte module:
// o folosesc Sheets (panoul de grafice) și Slides (graficele de pe slide).

export type ChartType = 'col' | 'line' | 'pie' | 'bar' | 'barStack' | 'barStack100' | 'stack' | 'stack100' | 'area' | 'doughnut' | 'scatter' | 'combo' | 'combo2' | 'hist' | 'pareto' | 'box' | 'waterfall' | 'funnel' | 'treemap' | 'sunburst' | 'stock' | 'bubble' | 'radar' | 'radarFill';
/** Tipurile din Slides (cele care se pot salva și în .pptx). */
export const CHART_TYPES: [ChartType, string][] = [['col', 'Coloane'], ['line', 'Linie'], ['pie', 'Plăcintă']];
/** Tipurile din Sheets (toate, și în .xlsx). */
export const SHEET_CHART_TYPES: [ChartType, string][] = [
  ['col', 'Coloane'], ['stack', 'Coloane stivuite'], ['stack100', 'Coloane stivuite 100%'], ['bar', 'Bare (orizontale)'], ['barStack', 'Bare stivuite'], ['barStack100', 'Bare stivuite 100%'], ['line', 'Linie'], ['area', 'Arie'],
  ['pie', 'Plăcintă'], ['doughnut', 'Inel'], ['scatter', 'Puncte (X–Y)'], ['bubble', 'Bule (X, Y și mărimea bulei)'],
  ['combo', 'Combinat (coloane + linie)'], ['combo2', 'Combinat, linia pe axa din dreapta'],
  ['hist', 'Histogramă (câte valori în fiecare interval)'], ['pareto', 'Pareto (de la mare la mic, cu % cumulat)'],
  ['box', 'Cutie cu mustăți (cum sunt împrăștiate valorile)'],
  ['waterfall', 'Cascadă (creșteri și scăderi până la total)'], ['funnel', 'Pâlnie (etapele unui proces)'],
  ['treemap', 'Hartă de suprafețe (cât ocupă fiecare din total)'],
  ['sunburst', 'Soare (inele pe niveluri: grupă → element)'],
  ['stock', 'Bursier (deschidere, maxim, minim, închidere)'],
  ['radar', 'Radar (pânză de păianjen)'], ['radarFill', 'Radar umplut'],
];
/**
 * Grafice recomandate (ca Recommended Charts): cele mai potrivite 4 tipuri pentru datele alese, de la cel mai potrivit.
 * Etichete-numere → puncte X–Y; o serie cu puține valori pozitive → coloane / plăcintă; cu valori negative → cascadă;
 * multe valori → linie; mai multe serii → coloane grupate / linie / stivuite; două serii de mărimi foarte diferite → combinat pe două axe.
 */
/** Numele coloanelor unui tabel bursier (deschidere, maxim, minim, închidere), în română sau engleză. */
const STOCK_NAME = /deschid|maxim|minim|nchid|open|high|low|close/i;
export function recommendCharts(data: ChartData): ChartType[] {
  const s = data.series.filter((x) => x.values.some(Number.isFinite));
  const n = data.categories.length;
  if (!s.length || !n) return ['col', 'bar', 'line', 'pie'];
  const vals = s.flatMap((x) => x.values.filter(Number.isFinite));
  const neg = vals.some((v) => v < 0);
  const out: ChartType[] = [];
  if (s.length >= 3 && s.filter((x) => STOCK_NAME.test(x.name)).length >= 3) out.push('stock');
  if ((data.levels?.length ?? 0) >= 2 && s[0].values.some((v) => v > 0)) out.push('sunburst', 'treemap');
  if (data.categories.every((c) => c.trim() !== '' && Number.isFinite(Number(c.replace(',', '.'))))) {
    out.push('scatter');
    // Două serii, a doua cu numere pozitive: X, Y și mărimea bulei.
    if (s.length === 2 && s[1].values.every((v) => !Number.isFinite(v) || v >= 0)) out.push('bubble');
  }
  if (s.length === 1) {
    if (neg) out.push('col', 'waterfall', 'bar', 'line');
    else if (n > 12) out.push('line', 'col', 'area', 'hist');
    else if (n <= 7) out.push('col', 'pie', 'bar', 'doughnut');
    else out.push('col', 'bar', 'line', 'treemap');
  } else {
    const mag = s.map((x) => Math.max(...x.values.filter(Number.isFinite).map(Math.abs), 0));
    const big = Math.max(...mag), small = Math.min(...mag);
    if (s.length === 2 && small > 0 && big / small >= 10) out.push('combo2');
    out.push(n > 12 ? 'line' : 'col', n > 12 ? 'col' : 'line', neg ? 'bar' : 'stack', 'bar', 'area');
  }
  return [...new Set(out)].slice(0, 4);
}

/** Graficul combinat: ultima serie e linie, celelalte coloane (cu o singură serie, doar coloane). */
export const isCombo = (t: ChartType) => t === 'combo' || t === 'combo2';

export interface ChartSeries { name: string; values: number[] }
export interface ChartData {
  categories: string[];
  series: ChartSeries[];
  /** Unde stau datele în foaie (pentru exportul în Excel): rândurile cu date, coloana de etichete și coloanele seriilor. */
  /** Coloanele de etichete în ordine (grupa mare întâi), când sunt mai multe coloane de text una după alta (pentru Soare). */
  levels?: string[][];
  where?: { header: boolean; labels: boolean; r0: number; r1: number; cols: number[]; byRow?: boolean };
}

export const CHART_W = 520;
export const CHART_H = 320;
export const COLORS = ['#4f6bed', '#e8743b', '#19a979', '#d64a8f', '#945ecf', '#13a4b4', '#d4a01c', '#6c8893'];
/** Paletele de culori ale graficului (Schimbă culorile): numele și cele 8 culori ale seriilor. */
export const PALETTES: [string, string[]][] = [
  ['Colorat', COLORS],
  ['Albastru', ['#1e3a8a', '#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#172554', '#2563eb', '#bfdbfe']],
  ['Verde', ['#14532d', '#15803d', '#22c55e', '#4ade80', '#86efac', '#052e16', '#16a34a', '#bbf7d0']],
  ['Cald', ['#b91c1c', '#ea580c', '#f59e0b', '#facc15', '#be185d', '#7c2d12', '#f97316', '#fde047']],
  ['Gri', ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#1f2937', '#4b5563', '#e5e7eb']],
  ['Pastel', ['#93c5fd', '#fca5a5', '#86efac', '#fde68a', '#c4b5fd', '#a5f3fc', '#fbcfe8', '#d9f99d']],
];
/** Locul legendei: jos (lipsă), sus, în dreapta sau fără legendă. */
export type LegendPos = 'b' | 't' | 'r' | 'none';
export const LEGEND_POS: [LegendPos, string][] = [['b', 'Jos'], ['t', 'Sus'], ['r', 'Dreapta'], ['none', 'Fără']];
/** Aspectul graficului: titlul axei orizontale și al celei verticale, paleta (indicele din PALETTES). */
export interface ChartLook { xTitle?: string; yTitle?: string; palette?: number; labels?: boolean; legend?: LegendPos; bg?: string; line?: string; noGrid?: boolean;
  /** Fontul și culoarea textului din grafic (titlu, legendă, axe, valori); lipsă = Segoe UI și griurile obișnuite. */
  font?: string; ink?: string;
  /** Scara axei valorilor aleasă de mână (Formatare axă): minimul, maximul și pasul gradațiilor; lipsă = automat. */
  axMin?: number; axMax?: number; axStep?: number;
  /** Efectul formelor seriilor (Stiluri diagramă): umbră sub coloane / felii / linii sau degrade de sus în jos; lipsă = plin. */
  fx?: ChartFx }
export type ChartFx = 'shadow' | 'grad';
/** Stilurile rapide ale graficului: numele și aspectul pus dintr-un clic (efectul, fundalul, conturul, textul, grila, valorile). */
export const CHART_STYLES: [string, Pick<ChartLook, 'fx' | 'bg' | 'line' | 'ink' | 'noGrid' | 'labels'>][] = [
  ['Stil 1: simplu', {}],
  ['Stil 2: cu umbre', { fx: 'shadow' }],
  ['Stil 3: degrade', { fx: 'grad' }],
  ['Stil 4: fără grilă, cu valori', { noGrid: true, labels: true }],
  ['Stil 5: fundal gri, cu contur', { bg: '#f2f2f2', line: '#a6a6a6' }],
  ['Stil 6: umbre pe albastru deschis', { fx: 'shadow', bg: '#e8f0fb', noGrid: true }],
  ['Stil 7: degrade cu valori', { fx: 'grad', noGrid: true, labels: true }],
  ['Stil 8: fundal închis', { bg: '#262626', ink: '#ffffff', noGrid: true }],
];
/** Culoarea amestecată cu alb (k = cât alb, 0–1), pentru capătul deschis al degradeului. */
export const lighten = (c: string, k: number) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * (1 - k) + 255 * k).toString(16).padStart(2, '0')).join('');
/** Câte gradații poate avea cel mult axa cu scara aleasă de mână (un pas prea mic ar umple axa de etichete). */
export const AXIS_MAX_TICKS = 40;
/** Scara automată schimbată după minimul / maximul / pasul alese pentru grafic (cele greșite se ignoră). */
export function userScale(sc: { lo: number; hi: number; step: number }, look: Pick<ChartLook, 'axMin' | 'axMax' | 'axStep'> = AX): { lo: number; hi: number; step: number } {
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!ok(look.axMin) && !ok(look.axMax) && !ok(look.axStep)) return sc;
  let lo = ok(look.axMin) ? look.axMin : sc.lo, hi = ok(look.axMax) ? look.axMax : sc.hi;
  if (!(hi > lo)) return sc;
  let step = ok(look.axStep) && look.axStep > 0 && (hi - lo) / look.axStep <= AXIS_MAX_TICKS ? look.axStep : 0;
  // Doar pasul ales: capetele automate se rotunjesc la multipli ai lui, ca gradațiile să cadă pe ele.
  if (step && !ok(look.axMin)) lo = Math.floor(lo / step + 1e-9) * step;
  if (step && !ok(look.axMax)) hi = Math.ceil(hi / step - 1e-9) * step;
  if (!step) {
    // Pasul automat pentru noul interval: 1, 2, 2,5, 5 × 10ⁿ, cam 5 diviziuni.
    const raw = (hi - lo) / 5, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
    step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  }
  return { lo, hi, step };
}
/** Scara are limite alese de mână: valorile din afară se taie la marginea graficului. */
const userAxis = () => [AX.axMin, AX.axMax, AX.axStep].some((v) => typeof v === 'number' && Number.isFinite(v));
/** Poziția pe grafic, tăiată la marginile zonei de desen doar când scara e aleasă de mână. */
const clampTo = (p: number, a: number, b: number) => (userAxis() ? Math.min(Math.max(p, Math.min(a, b)), Math.max(a, b)) : p);
/** Până unde merg gradațiile: cu scara aleasă de mână, nu trec de maxim. */
const tickEnd = (sc: { hi: number; step: number }) => (userAxis() ? sc.hi + sc.step * 1e-6 : sc.hi + sc.step / 2);
/** Umplerea zonei diagramei (lipsă = alb) și conturul ei (lipsă = fără contur): culorile din care se alege în panglică. */
export const CHART_FILLS: [string, string][] = [['Alb', '#ffffff'], ['Gri deschis', '#f2f2f2'], ['Albastru deschis', '#e8f0fb'], ['Verde deschis', '#eaf5ea'], ['Galben deschis', '#fff8e1'], ['Roz deschis', '#fdecef']];
export const CHART_LINES: [string, string][] = [['Gri', '#a6a6a6'], ['Negru', '#262626'], ['Albastru', '#2f6fd6'], ['Verde', '#2e8b57'], ['Roșu', '#c62828']];
/** Culorile textului din grafic: „” = griurile obișnuite (titlul mai închis, etichetele axelor mai deschise). */
export const CHART_INKS: [string, string][] = [['Automat (gri)', ''], ['Negru', '#000000'], ['Alb', '#ffffff'], ['Albastru închis', '#1f3864'], ['Verde închis', '#2e5a2e'], ['Roșu închis', '#8b1a1a']];
/** Fontul ales pentru grafic, doar dacă e un nume curat (litere, cifre, spații). */
export const chartFontOk = (f: unknown): f is string => typeof f === 'string' && /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,39}$/.test(f);
export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
export const paletteOf = (i: number | undefined) => PALETTES[i ?? 0]?.[1] ?? COLORS;
// Culorile și titlurile axelor pentru desenul în curs (chartSvg e sincron: le pune la început și le scoate la sfârșit).
let C: string[] = COLORS;
let AX: ChartLook = {};
function axisTitles(parts: string[], left: number, top: number, bottom: number, w: number): void {
  if (AX.yTitle) parts.push(`<text transform="translate(14 ${((top + bottom) / 2).toFixed(1)}) rotate(-90)" text-anchor="middle" font-size="12" fill="#444">${esc(cut(AX.yTitle, 40))}</text>`);
  if (AX.xTitle) parts.push(`<text x="${((left + w - 12) / 2).toFixed(1)}" y="${bottom + 34}" text-anchor="middle" font-size="12" fill="#444">${esc(cut(AX.xTitle, 60))}</text>`);
}

/** Eticheta cu valoarea unui punct (când „Valori pe grafic” e pornit). */
export function valueLabel(v: number): string {
  return Math.abs(v) >= 1e6 ? axisLabel(v) : Number(v.toPrecision(12)).toLocaleString('ro-RO', { maximumFractionDigits: 2 });
}
function dataLabel(parts: string[], x: number, y: number, v: number, anchor = 'middle', fill = '#333'): void {
  parts.push(`<text class="dl" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-size="10" fill="${fill}">${esc(valueLabel(v))}</text>`);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Numerele de pe axă: 1.500, 2,5, 1,2 mil. */
export function axisLabel(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return trim(n / 1e9) + ' mld.';
  if (a >= 1e6) return trim(n / 1e6) + ' mil.';
  return Number(n.toPrecision(12)).toLocaleString('ro-RO', { maximumFractionDigits: 4 });
}
const trim = (n: number) => Number(n.toPrecision(3)).toLocaleString('ro-RO', { maximumFractionDigits: 2 });

/** Diviziuni „rotunde” pentru axă (1, 2, 5 × 10ⁿ), care cuprind minimul și maximul. */
export function niceScale(min: number, max: number, ticks = 5): { lo: number; hi: number; step: number } {
  if (min > 0) min = 0;
  if (max < 0) max = 0;
  if (min === max) max = min + 1;
  const raw = (max - min) / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  return { lo: Math.floor(min / step + 1e-9) * step, hi: Math.ceil(max / step - 1e-9) * step, step };
}

/** Graficele statistice: din datele alese se calculează ce se desenează (intervalele histogramei, ordinea și procentul cumulat la Pareto). */
export const isStat = (t: ChartType) => t === 'hist' || t === 'pareto' || t === 'box' || t === 'waterfall' || t === 'funnel' || t === 'treemap' || t === 'sunburst' || t === 'stock';
/** Culorile cascadei: creștere, scădere (aceleași în orice paletă, ca să se citească „bine / rău”). */
export const WF_UP = '#2e9e5b', WF_DOWN = '#d64545';

/**
 * Histograma: valorile primei serii împărțite în intervale egale. Lățimea vine din regula lui Scott (3,5·σ / ∛n), rotunjită
 * la 1 / 2 / 2,5 / 5 × 10ⁿ, cel mult 30 de intervale. Primul interval e închis la ambele capete: [a, b], apoi (b, c]…
 */
export function histogram(values: number[]): { labels: string[]; counts: number[] } {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  const n = v.length;
  if (!n) return { labels: [], counts: [] };
  const min = v[0], max = v[n - 1];
  if (min === max) return { labels: [`[${axisLabel(min)}, ${axisLabel(max)}]`], counts: [n] };
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  let w = Math.max(sd > 0 ? (3.5 * sd) / Math.cbrt(n) : (max - min) / 5, (max - min) / 30);
  const mag = 10 ** Math.floor(Math.log10(w));
  const f = w / mag;
  w = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / w + 1e-9) * w;
  const k = Math.max(1, Math.ceil((max - lo) / w - 1e-9));
  const counts = new Array<number>(k).fill(0);
  for (const x of v) counts[Math.min(k - 1, Math.max(0, Math.ceil((x - lo) / w - 1e-9) - 1))]++;
  const at = (i: number) => axisLabel(Number((lo + w * i).toPrecision(12)));
  return { labels: counts.map((_, i) => `${i ? '(' : '['}${at(i)}, ${at(i + 1)}]`), counts };
}

/** Cutia cu mustăți a unei serii: quartilele (ca QUARTILE.INC), media, mustățile (cea mai mică / mare valoare la cel mult
 * 1,5 × distanța dintre quartile) și valorile ieșite din tipar (dincolo de mustăți). */
export interface BoxStats { min: number; q1: number; med: number; q3: number; max: number; mean: number; lo: number; hi: number; out: number[] }
export function boxStats(values: number[]): BoxStats | null {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const q = (p: number) => { const i = (v.length - 1) * p, a = Math.floor(i); return v[a] + (v[Math.min(a + 1, v.length - 1)] - v[a]) * (i - a); };
  const q1 = q(0.25), q3 = q(0.75), iqr = q3 - q1;
  const inside = v.filter((x) => x >= q1 - 1.5 * iqr - 1e-9 && x <= q3 + 1.5 * iqr + 1e-9);
  return { min: v[0], q1, med: q(0.5), q3, max: v[v.length - 1], mean: v.reduce((a, b) => a + b, 0) / v.length,
    lo: inside[0] ?? q1, hi: inside[inside.length - 1] ?? q3, out: v.filter((x) => x < (inside[0] ?? q1) || x > (inside[inside.length - 1] ?? q3)) };
}

/** Datele desenate pentru histogramă și Pareto (tipul de bază: coloane, respectiv coloane + linie pe axa din dreapta, în %). */
export function statData(type: ChartType, data: ChartData): ChartData {
  const s = data.series[0];
  if (!s) return { categories: [], series: [] };
  if (type === 'box') {
    // Pentru .xlsx: coloane stivuite (Q1 nevăzut, apoi mediana − Q1 și Q3 − mediana), câte o cutie pe serie.
    const st = data.series.map((x) => ({ name: x.name, b: boxStats(x.values) })).filter((x) => x.b);
    const f = (g: (b: BoxStats) => number) => st.map((x) => Number(g(x.b!).toPrecision(12)));
    return { categories: st.map((x) => x.name), series: [{ name: 'Q1', values: f((b) => b.q1) }, { name: 'Mediana − Q1', values: f((b) => b.med - b.q1) }, { name: 'Q3 − mediana', values: f((b) => b.q3 - b.med) }] };
  }
  if (type === 'waterfall') {
    // Pentru .xlsx: coloane stivuite: baza nevăzută (de unde pornește bucata), creșterile și scăderile.
    const base: number[] = [], up: number[] = [], down: number[] = [];
    let run = 0;
    s.values.forEach((v) => { const x = Number.isFinite(v) ? v : 0; base.push(Number(Math.min(run, run + x).toPrecision(12))); up.push(x > 0 ? x : 0); down.push(x < 0 ? -x : 0); run += x; });
    return { categories: data.categories, series: [{ name: 'Bază', values: base }, { name: 'Creștere', values: up }, { name: 'Scădere', values: down }] };
  }
  if (type === 'funnel') return { categories: data.categories, series: [s] };
  if (type === 'treemap') {
    // Pentru .xlsx: bare, de la mare la mic (doar valorile pozitive).
    const it = data.categories.map((c, i) => ({ c, v: s.values[i] })).filter((x) => Number.isFinite(x.v) && x.v > 0).sort((a, b) => b.v - a.v);
    return { categories: it.map((x) => x.c), series: [{ name: s.name, values: it.map((x) => x.v) }] };
  }
  if (type === 'stock') return { categories: data.categories, series: data.series.slice(0, 4) };
  if (type === 'sunburst') {
    // Pentru .xlsx: inel cu elementele de pe ultimul nivel („Grupă / element”), în ordinea din arbore.
    const leaves: { c: string; v: number }[] = [];
    const walk = (n: SunNode, path: string[]) => n.kids.length ? n.kids.forEach((k) => walk(k, [...path, k.name])) : leaves.push({ c: path.join(' / '), v: n.value });
    sunTree(data).kids.forEach((k) => walk(k, [k.name]));
    return { categories: leaves.map((x) => x.c), series: [{ name: s.name, values: leaves.map((x) => x.v) }] };
  }
  if (type === 'hist') {
    const h = histogram(s.values);
    return { categories: h.labels, series: [{ name: s.name, values: h.counts }] };
  }
  const items = data.categories.map((c, i) => ({ c, v: s.values[i] })).filter((x) => Number.isFinite(x.v) && x.v > 0).sort((a, b) => b.v - a.v);
  const total = items.reduce((a, x) => a + x.v, 0) || 1;
  let run = 0;
  return {
    categories: items.map((x) => x.c),
    series: [{ name: s.name, values: items.map((x) => x.v) }, { name: '% cumulat', values: items.map((x) => { run += x.v; return Number(((run / total) * 100).toFixed(2)); }) }],
  };
}

/** Scara cu exact  diviziuni rotunde (pentru a doua axă, ca liniile ei să cadă pe grila primei axe). */
export function fixedScale(min: number, max: number, steps: number): { lo: number; hi: number; step: number } {
  if (min > 0) min = 0;
  if (max < 0) max = 0;
  if (min === max) max = min + 1;
  steps = Math.max(1, steps);
  const nice = [1, 2, 2.5, 5, 10];
  let mag = 10 ** Math.floor(Math.log10((max - min) / steps));
  for (let guard = 0; guard < 40; guard++) {
    for (const f of nice) {
      const step = f * mag;
      const lo = Math.floor(min / step + 1e-9) * step;
      if (lo + step * steps >= max - 1e-9) return { lo, hi: lo + step * steps, step };
    }
    mag *= 10;
  }
  return { lo: min, hi: max, step: (max - min) / steps };
}

/** Desenează graficul ca SVG (text). Fundal alb, ca să arate la fel în temă închisă, la copiere și la tipărire. */
export function chartSvg(type: ChartType, title: string, data: ChartData, w = CHART_W, h = CHART_H, look: ChartLook = {}): string {
  C = paletteOf(look.palette);
  AX = look;
  try {
    return drawChart(type, title, data, w, h);
  } finally {
    C = COLORS;
    AX = {};
  }
}

function drawChart(type: ChartType, title: string, data: ChartData, w: number, h: number): string {
  const font = 'font-family="Segoe UI, Arial, sans-serif"';
  const line = isHex(AX.line) ? AX.line : '';
  const parts: string[] = [line
    ? `<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" fill="${isHex(AX.bg) ? AX.bg : '#ffffff'}" stroke="${line}" stroke-width="1.5"/>`
    : `<rect width="${w}" height="${h}" fill="${isHex(AX.bg) ? AX.bg : '#ffffff'}"/>`];
  let top = 14;
  if (title) {
    parts.push(`<text x="${w / 2}" y="30" text-anchor="middle" font-size="16" font-weight="600" fill="#222">${esc(cut(title, 60))}</text>`);
    top = 44;
  }
  if (type === 'stock') {
    if (data.categories.length && data.series.filter((x) => x.values.some(Number.isFinite)).length >= 2) { stock(parts, data, w, h, top); return wrap(w, h, font, parts); }
    parts.push(`<text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="13" fill="#888">Alege coloanele Deschidere, Maxim, Minim, Închidere (sau Maxim, Minim, Închidere)</text>`);
    return wrap(w, h, font, parts);
  }
  if (type === 'box') { if (data.series.some((x) => x.values.some(Number.isFinite))) { boxPlot(parts, data, w, h, top); return wrap(w, h, font, parts); } data = { categories: [], series: [] }; }
  else if ((type === 'waterfall' || type === 'funnel' || type === 'treemap' || type === 'sunburst') && data.categories.length && data.series[0]?.values.some(Number.isFinite)) {
    (type === 'waterfall' ? waterfall : type === 'funnel' ? funnel : type === 'sunburst' ? sunburst : treemap)(parts, data, w, h, top);
    return wrap(w, h, font, parts);
  }
  else if (isStat(type)) data = statData(type, data);
  const { categories, series } = data;
  if (!series.length || !categories.length) {
    parts.push(`<text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="13" fill="#888">Nu sunt numere în zona aleasă</text>`);
    return wrap(w, h, font, parts);
  }
  if (type === 'pie' || type === 'doughnut') pie(parts, data, w, h, top, type === 'doughnut');
  else if (type === 'bar' || type === 'barStack' || type === 'barStack100') hbar(parts, data, w, h, top, type);
  else if (type === 'radar' || type === 'radarFill') radar(parts, data, w, h, top, type === 'radarFill');
  else if (type === 'scatter' || type === 'bubble') scatter(parts, data, w, h, top, type === 'bubble');
  else axes(parts, type, data, w, h, top);
  return wrap(w, h, font, parts);
}

function wrap(w: number, h: number, font: string, parts: string[]): string {
  // Fără linii de grilă: liniile orizontale (sau verticale, la bare) gri deschis dintre valori nu se desenează.
  if (AX.noGrid) parts = parts.filter((p) => !(p.startsWith('<line') && p.endsWith('stroke="#e3e3e3"/>')));
  // Fontul ales și culoarea textului: griurile textelor (titlu, legendă, axe, valori) devin culoarea aleasă; textul alb de pe felii / dreptunghiuri rămâne.
  if (chartFontOk(AX.font)) font = `font-family="${AX.font}, Segoe UI, Arial, sans-serif"`;
  if (isHex(AX.ink)) { const ink = AX.ink; parts = parts.map((p) => (p.startsWith('<text') ? p.replace(/ fill="#(222|333|444|555|666)"/, ` fill="${ink}"`) : p)); }
  if (AX.fx === 'shadow' || AX.fx === 'grad') parts = chartFx(parts, AX.fx);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${font}>${parts.join('')}</svg>`;
}

/** Efectul ales pe formele seriilor (cele colorate cu paleta, fără pătrățelele legendei): umbra sau degradeul, cu definițiile lor. */
function chartFx(parts: string[], fx: ChartFx): string[] {
  const pal = new Set(C.map((c) => c.toLowerCase()));
  const grads = new Set<string>();
  let shadow = false;
  const out = parts.map((p, i) => {
    if (i === 0 || !/^<(rect|path|circle|polygon)[ /]/.test(p) || / width="11" height="11"/.test(p)) return p;
    const fill = / fill="(#[0-9a-fA-F]{6})"/.exec(p)?.[1].toLowerCase();
    const stroke = / stroke="(#[0-9a-fA-F]{6})"/.exec(p)?.[1].toLowerCase();
    if (fx === 'grad') {
      if (!fill || !pal.has(fill)) return p;
      grads.add(fill);
      return p.replace(/ fill="#[0-9a-fA-F]{6}"/, ` fill="url(#sg${fill.slice(1)})"`);
    }
    if (!(fill && pal.has(fill)) && !(stroke && pal.has(stroke))) return p;
    shadow = true;
    return p.replace(/^<([a-z]+)/, '<$1 filter="url(#sgsh)"');
  });
  // Id-urile țin de culoare: două grafice pe aceeași pagină au aceleași definiții pentru același id.
  const defs = (shadow ? '<filter id="sgsh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="1.5" dy="2" stdDeviation="1.6" flood-color="#000000" flood-opacity="0.35"/></filter>' : '')
    + [...grads].map((c) => `<linearGradient id="sg${c.slice(1)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lighten(c, 0.45)}"/><stop offset="1" stop-color="${c}"/></linearGradient>`).join('');
  if (defs) out.splice(1, 0, `<defs>${defs}</defs>`);
  return out;
}

function legend(parts: string[], names: string[], colors: string[], w: number, y: number): void {
  // Legenda pe un rând, centrată; numele lungi se scurtează.
  const items = names.map((n) => cut(n, 18));
  const widths = items.map((t) => 18 + t.length * 6.6 + 14);
  let x = Math.max(8, (w - widths.reduce((a, b) => a + b, 0)) / 2);
  items.forEach((t, i) => {
    if (x + widths[i] > w) return;
    parts.push(`<rect x="${x}" y="${y - 9}" width="11" height="11" rx="2" fill="${colors[i]}"/>`);
    parts.push(`<text x="${x + 16}" y="${y}" font-size="12" fill="#333">${esc(t)}</text>`);
    x += widths[i];
  });
}

/** Locul pe care îl ia legenda (când sunt cel puțin două serii): rândul de jos, rândul de sus sau o coloană în dreapta. */
interface LegendBox { show: boolean; pos: LegendPos; top: number; bottom: number; right: number; y: number }
function legendBox(names: string[], top: number): LegendBox {
  const pos = AX.legend ?? 'b';
  const show = names.length > 1 && pos !== 'none';
  const rw = show && pos === 'r' ? Math.min(160, 36 + Math.min(18, Math.max(...names.map((n) => n.length))) * 6.6) : 0;
  return { show, pos, top: show && pos === 't' ? 22 : 0, bottom: show && pos === 'b' ? 48 : 30, right: rw, y: top + 6 };
}
function drawLegend(parts: string[], names: string[], L: LegendBox, w: number, h: number): void {
  if (!L.show) return;
  if (L.pos === 'b') return legend(parts, names, C, w, h - 14);
  if (L.pos === 't') return legend(parts, names, C, w, L.y);
  const x = w - L.right + 10;
  const rows = Math.max(1, Math.floor((h - L.y - 8) / 20));
  names.slice(0, rows).forEach((n, i) => {
    const y = L.y + 14 + i * 20;
    parts.push(`<rect x="${x.toFixed(1)}" y="${y - 10}" width="11" height="11" rx="2" fill="${C[i % C.length]}"/>`);
    parts.push(`<text x="${(x + 16).toFixed(1)}" y="${y}" font-size="12" fill="#333">${esc(cut(n, 18))}</text>`);
  });
}

/** Coloanele stivuite 100%: fiecare valoare devine procentul ei din totalul categoriei (fiecare coloană are înălțimea 100%). */
export function toPercent(data: ChartData): ChartData {
  const totals = data.categories.map((_, i) => data.series.reduce((a, s) => a + (Number.isFinite(s.values[i]) ? Math.abs(s.values[i]) : 0), 0));
  return { ...data, series: data.series.map((s) => ({ ...s, values: s.values.map((v, i) => (Number.isFinite(v) && totals[i] ? (v / totals[i]) * 100 : NaN)) })) };
}

function axes(parts: string[], type: ChartType, data: ChartData, w: number, h: number, top: number): void {
  const p100 = type === 'stack100';
  if (p100) { data = toPercent(data); type = 'stack'; }
  const { categories, series } = data;
  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  // La coloanele stivuite contează suma pozitivelor (în sus) și a negativelor (în jos) de pe fiecare categorie.
  const stacks = type === 'stack' ? categories.map((_, i) => series.reduce((acc, s) => { const v = s.values[i]; if (Number.isFinite(v)) acc[v >= 0 ? 0 : 1] += v; return acc; }, [0, 0])) : [];
  // Combinat: ultima serie e linia; cu „axa din dreapta” coloanele și linia au fiecare scara lor.
  const combo = (isCombo(type) || type === 'pareto') && series.length > 1;
  const second = combo && (type === 'combo2' || type === 'pareto');
  const pct = type === 'pareto';
  const colVals = (second ? series.slice(0, -1) : series).flatMap((s) => s.values).filter(Number.isFinite);
  const sc = p100 ? fixedScale(Math.min(0, ...stacks.map((x) => x[1])) < 0 ? -100 : 0, 100, Math.min(0, ...stacks.map((x) => x[1])) < 0 ? 10 : 5)
    : type === 'stack' ? niceScale(Math.min(0, ...stacks.map((x) => x[1])), Math.max(0, ...stacks.map((x) => x[0])))
    : userScale(second ? niceScale(Math.min(...colVals), Math.max(...colVals)) : niceScale(Math.min(...all), Math.max(...all)));
  const lineVals = second ? series[series.length - 1].values.filter(Number.isFinite) : [];
  const sc2 = second && lineVals.length ? fixedScale(pct ? 0 : Math.min(...lineVals), pct ? 100 : Math.max(...lineVals), Math.round((sc.hi - sc.lo) / sc.step)) : null;
  const L = legendBox(series.map((s) => s.name), top);
  top += L.top;
  const tickLabels: string[] = [];
  for (let v = sc.lo; v <= tickEnd(sc); v += sc.step) tickLabels.push(axisLabel(v) + (p100 ? '%' : ''));
  // Pe axa din dreapta, tot atâtea diviziuni cât în stânga, ca liniile de grilă să se potrivească.
  const ticks2 = sc2 ? tickLabels.map((_, i) => sc2.lo + sc2.step * i) : [];
  const left = 14 + Math.max(...tickLabels.map((t) => t.length)) * 6.6 + (AX.yTitle ? 18 : 0);
  const label2 = (v: number) => axisLabel(v) + (pct ? '%' : '');
  const right = w - 16 - L.right - (sc2 ? Math.max(...ticks2.map((v) => label2(v).length)) * 6.6 + 6 : 0);
  const bottom = h - L.bottom - (AX.xTitle ? 18 : 0);
  axisTitles(parts, left, top, bottom, w);
  const plotW = right - left;
  const y = (v: number) => clampTo(bottom - ((v - sc.lo) / (sc.hi - sc.lo)) * (bottom - top), top, bottom);

  tickLabels.forEach((t, i) => {
    const yy = y(sc.lo + i * sc.step);
    parts.push(`<line x1="${left}" x2="${right}" y1="${yy}" y2="${yy}" stroke="#e3e3e3"/>`);
    parts.push(`<text x="${left - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#666">${esc(t)}</text>`);
    if (sc2) parts.push(`<text x="${right + 6}" y="${yy + 4}" text-anchor="start" font-size="11" fill="#666">${esc(label2(ticks2[i]))}</text>`);
  });
  const zero = y(0);
  parts.push(`<line x1="${left}" x2="${right}" y1="${zero}" y2="${zero}" stroke="#999"/>`);

  const n = categories.length;
  const band = plotW / n;
  // Etichetele de pe axă: doar câte încap, ca să nu se suprapună.
  const maxChars = Math.max(3, Math.floor(band / 6.6) - 1);
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 50))));
  categories.forEach((cat, i) => {
    if (i % every) return;
    const cx = left + band * (i + 0.5);
    parts.push(`<text x="${cx}" y="${bottom + 16}" text-anchor="middle" font-size="11" fill="#555">${esc(cut(cat, Math.max(maxChars, every * maxChars)))}</text>`);
  });

  if (type === 'stack') {
    const gap = band * 0.3;
    categories.forEach((_, i) => {
      let up = 0, down = 0;
      series.forEach((s, k) => {
        const v = s.values[i];
        if (!Number.isFinite(v) || v === 0) return;
        const from = v >= 0 ? up : down;
        const to = from + v;
        if (v >= 0) up = to; else down = to;
        const y1 = Math.min(y(from), y(to));
        parts.push(`<rect x="${(left + band * i + gap / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${Math.max(1, band - gap).toFixed(1)}" height="${Math.abs(y(to) - y(from)).toFixed(1)}" fill="${C[k % COLORS.length]}" stroke="#fff" stroke-width="0.5"/>`);
        if (AX.labels && Math.abs(y(to) - y(from)) >= 13 && band - gap >= 18) dataLabel(parts, left + band * (i + 0.5), (y(from) + y(to)) / 2 + 3.5, v, 'middle', '#fff');
      });
    });
  } else if (type === 'col' || isCombo(type) || isStat(type)) {
    // Histograma: coloanele aproape lipite (intervalele se continuă).
    const gap = band * (type === 'hist' ? 0.04 : 0.2);
    const cols = combo ? series.slice(0, -1) : series;
    const bw = (band - gap) / cols.length;
    // Valorile încap deasupra coloanelor doar dacă coloanele nu sunt prea înguste.
    const labelCols = AX.labels && bw >= 16;
    cols.forEach((s, k) => {
      s.values.forEach((v, i) => {
        if (!Number.isFinite(v)) return;
        const x = left + band * i + gap / 2 + bw * k;
        const y1 = Math.min(y(v), zero);
        const hh = Math.abs(y(v) - zero);
        parts.push(`<rect x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${hh.toFixed(1)}" fill="${C[k]}"/>`);
        if (labelCols) dataLabel(parts, x + (bw - 1) / 2, v >= 0 ? y(v) - 4 : y(v) + 12, v);
      });
    });
    if (combo) {
      const k = series.length - 1;
      const yl = sc2 ? (v: number) => bottom - ((v - sc2.lo) / (sc2.hi - sc2.lo)) * (bottom - top) : y;
      let path = '';
      let pen = false;
      series[k].values.forEach((v, i) => {
        if (!Number.isFinite(v)) { pen = false; return; }
        path += `${pen ? 'L' : 'M'}${(left + band * (i + 0.5)).toFixed(1)} ${yl(v).toFixed(1)}`;
        pen = true;
      });
      parts.push(`<path d="${path}" fill="none" stroke="${C[k % C.length]}" stroke-width="2.5" stroke-linejoin="round"/>`);
      if (n <= 30) series[k].values.forEach((v, i) => { if (Number.isFinite(v)) parts.push(`<circle cx="${(left + band * (i + 0.5)).toFixed(1)}" cy="${yl(v).toFixed(1)}" r="3.5" fill="${C[k % C.length]}"/>`); });
      if (AX.labels && n <= 30) series[k].values.forEach((v, i) => { if (Number.isFinite(v)) dataLabel(parts, left + band * (i + 0.5), yl(v) - 8, v, 'middle', C[k % C.length]); });
    }
  } else {
    series.forEach((s, k) => {
      // Celulele goale rup linia, ca în Excel.
      let path = '';
      let pen = false;
      s.values.forEach((v, i) => {
        if (!Number.isFinite(v)) { pen = false; return; }
        path += `${pen ? 'L' : 'M'}${(left + band * (i + 0.5)).toFixed(1)} ${y(v).toFixed(1)}`;
        pen = true;
      });
      if (type === 'area') {
        // Aria: fiecare bucată fără goluri se umple până la axa 0.
        let seg: [number, number][] = [];
        const flush = () => {
          if (seg.length) {
            const d = `M${seg[0][0].toFixed(1)} ${zero.toFixed(1)}` + seg.map(([x, yy]) => `L${x.toFixed(1)} ${yy.toFixed(1)}`).join('') + `L${seg[seg.length - 1][0].toFixed(1)} ${zero.toFixed(1)}Z`;
            parts.push(`<path d="${d}" fill="${C[k % COLORS.length]}" fill-opacity="0.45" stroke="${C[k % COLORS.length]}" stroke-width="2"/>`);
          }
          seg = [];
        };
        s.values.forEach((v, i) => { if (Number.isFinite(v)) seg.push([left + band * (i + 0.5), y(v)]); else flush(); });
        flush();
        if (AX.labels && n <= 30) s.values.forEach((v, i) => { if (Number.isFinite(v)) dataLabel(parts, left + band * (i + 0.5), y(v) - 6, v); });
        return;
      }
      parts.push(`<path d="${path}" fill="none" stroke="${C[k]}" stroke-width="2.5" stroke-linejoin="round"/>`);
      if (n <= 30) {
        s.values.forEach((v, i) => {
          if (Number.isFinite(v)) parts.push(`<circle cx="${(left + band * (i + 0.5)).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" fill="${C[k]}"/>`);
          if (AX.labels && Number.isFinite(v)) dataLabel(parts, left + band * (i + 0.5), y(v) - 8, v);
        });
      }
    });
  }
  drawLegend(parts, series.map((s) => s.name), L, w, h);
}

/** Cutie cu mustăți: câte o cutie pe serie (coloană de date), cu mediana, media (×), mustățile și punctele ieșite din tipar. */
function boxPlot(parts: string[], data: ChartData, w: number, h: number, top: number): void {
  const items = data.series.map((s) => ({ name: s.name, b: boxStats(s.values) })).filter((x) => x.b) as { name: string; b: BoxStats }[];
  const sc = niceScale(Math.min(...items.map((x) => x.b.min)), Math.max(...items.map((x) => x.b.max)));
  const tickLabels: string[] = [];
  for (let v = sc.lo; v <= sc.hi + sc.step / 2; v += sc.step) tickLabels.push(axisLabel(v));
  const left = 14 + Math.max(...tickLabels.map((t) => t.length)) * 6.6 + (AX.yTitle ? 18 : 0);
  const right = w - 16, bottom = h - 30 - (AX.xTitle ? 18 : 0);
  axisTitles(parts, left, top, bottom, w);
  const y = (v: number) => bottom - ((v - sc.lo) / (sc.hi - sc.lo)) * (bottom - top);
  tickLabels.forEach((t, i) => {
    const yy = y(sc.lo + i * sc.step);
    parts.push(`<line x1="${left}" x2="${right}" y1="${yy}" y2="${yy}" stroke="#e3e3e3"/>`);
    parts.push(`<text x="${left - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#666">${esc(t)}</text>`);
  });
  const band = (right - left) / items.length;
  items.forEach(({ name, b }, k) => {
    const cx = left + band * (k + 0.5), bw = Math.min(band * 0.5, 90), col = C[k % C.length];
    const f = (n: number) => n.toFixed(1);
    parts.push(`<line x1="${f(cx)}" x2="${f(cx)}" y1="${f(y(b.hi))}" y2="${f(y(b.q3))}" stroke="${col}" stroke-width="1.5"/>`);
    parts.push(`<line x1="${f(cx)}" x2="${f(cx)}" y1="${f(y(b.q1))}" y2="${f(y(b.lo))}" stroke="${col}" stroke-width="1.5"/>`);
    for (const v of [b.hi, b.lo]) parts.push(`<line x1="${f(cx - bw / 4)}" x2="${f(cx + bw / 4)}" y1="${f(y(v))}" y2="${f(y(v))}" stroke="${col}" stroke-width="1.5"/>`);
    parts.push(`<rect class="box" x="${f(cx - bw / 2)}" y="${f(y(b.q3))}" width="${f(bw)}" height="${f(Math.max(1, y(b.q1) - y(b.q3)))}" fill="${col}" fill-opacity="0.35" stroke="${col}" stroke-width="1.5"/>`);
    parts.push(`<line x1="${f(cx - bw / 2)}" x2="${f(cx + bw / 2)}" y1="${f(y(b.med))}" y2="${f(y(b.med))}" stroke="${col}" stroke-width="2.5"/>`);
    const my = y(b.mean), d = 4;
    parts.push(`<path d="M${f(cx - d)} ${f(my - d)}L${f(cx + d)} ${f(my + d)}M${f(cx + d)} ${f(my - d)}L${f(cx - d)} ${f(my + d)}" stroke="#333" stroke-width="1.5"/>`);
    for (const o of b.out) parts.push(`<circle cx="${f(cx)}" cy="${f(y(o))}" r="3.5" fill="none" stroke="${col}" stroke-width="1.5"/>`);
    parts.push(`<text x="${f(cx)}" y="${bottom + 16}" text-anchor="middle" font-size="11" fill="#555">${esc(cut(name, Math.max(4, Math.floor(band / 6.6))))}</text>`);
  });
}

/** Cascada: fiecare valoare pornește de unde s-a oprit suma de dinainte (verde = crește, roșu = scade), cu liniuțe între bucăți
 * și o ultimă coloană cu totalul. */
function waterfall(parts: string[], data: ChartData, w: number, h: number, top: number): void {
  const vals = data.series[0].values.map((v) => (Number.isFinite(v) ? v : 0));
  const cats = [...data.categories, 'Total'];
  const steps: [number, number][] = [];
  let run = 0;
  for (const v of vals) { steps.push([run, run + v]); run += v; }
  steps.push([0, run]);
  const sc = niceScale(Math.min(0, ...steps.flat()), Math.max(0, ...steps.flat()));
  const tickLabels: string[] = [];
  for (let v = sc.lo; v <= sc.hi + sc.step / 2; v += sc.step) tickLabels.push(axisLabel(v));
  const left = 14 + Math.max(...tickLabels.map((t) => t.length)) * 6.6 + (AX.yTitle ? 18 : 0);
  const right = w - 16, bottom = h - 30 - (AX.xTitle ? 18 : 0);
  axisTitles(parts, left, top, bottom, w);
  const y = (v: number) => bottom - ((v - sc.lo) / (sc.hi - sc.lo)) * (bottom - top);
  tickLabels.forEach((t, i) => {
    const yy = y(sc.lo + i * sc.step);
    parts.push(`<line x1="${left}" x2="${right}" y1="${yy}" y2="${yy}" stroke="#e3e3e3"/>`);
    parts.push(`<text x="${left - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#666">${esc(t)}</text>`);
  });
  parts.push(`<line x1="${left}" x2="${right}" y1="${y(0)}" y2="${y(0)}" stroke="#999"/>`);
  const band = (right - left) / cats.length, gap = band * 0.25, bw = band - gap;
  const every = Math.max(1, Math.ceil(cats.length / Math.max(1, Math.floor((right - left) / 50))));
  steps.forEach(([a, b], i) => {
    const x = left + band * i + gap / 2, last = i === steps.length - 1;
    const col = last ? C[0] : b >= a ? WF_UP : WF_DOWN;
    parts.push(`<rect class="wf" x="${x.toFixed(1)}" y="${Math.min(y(a), y(b)).toFixed(1)}" width="${Math.max(1, bw).toFixed(1)}" height="${Math.max(1, Math.abs(y(b) - y(a))).toFixed(1)}" fill="${col}"/>`);
    // Liniuța până la bucata următoare (la nivelul unde s-a oprit suma).
    if (!last) parts.push(`<line x1="${(x + bw).toFixed(1)}" x2="${(x + band).toFixed(1)}" y1="${y(b).toFixed(1)}" y2="${y(b).toFixed(1)}" stroke="#888" stroke-dasharray="2 2"/>`);
    if (AX.labels && bw >= 16) dataLabel(parts, x + bw / 2, Math.min(y(a), y(b)) - 4, last ? b : b - a);
    if (!(i % every) || last) parts.push(`<text x="${(x + bw / 2).toFixed(1)}" y="${bottom + 16}" text-anchor="middle" font-size="11" fill="#555">${esc(cut(cats[i], Math.max(4, Math.floor(band * every / 6.6))))}</text>`);
  });
}

/**
 * Graficul bursier: pe fiecare zi o linie de la minim la maxim; cu 4 coloane (deschidere, maxim, minim, închidere) și o lumânare
 * între deschidere și închidere (albă cu chenar verde când a crescut, roșie când a scăzut); cu 3 coloane (maxim, minim, închidere)
 * o liniuță la închidere; cu 2, doar intervalul.
 */
function stock(parts: string[], data: ChartData, w: number, h: number, top: number): void {
  const ser = data.series.slice(0, 4);
  const rows = data.categories.map((_, i) => {
    const v = ser.map((x) => x.values[i]);
    const ok = v.filter(Number.isFinite);
    if (!ok.length) return null;
    const four = ser.length >= 4;
    return { hi: Math.max(...ok), lo: Math.min(...ok), open: four ? v[0] : NaN, close: ser.length >= 3 ? v[ser.length - 1] : NaN };
  });
  const all = rows.flatMap((r) => (r ? [r.hi, r.lo] : []));
  const span = Math.max(...all) - Math.min(...all) || Math.abs(all[0]) || 1;
  // Prețurile nu pornesc de la zero: scara se strânge în jurul lor (ca să se vadă mișcarea).
  const mn = Math.min(...all), mx = Math.max(...all);
  const st = niceScale(0, span * 1.1).step;
  const scale = { lo: mn >= 0 ? Math.max(0, Math.floor(mn / st) * st) : Math.floor(mn / st) * st, hi: Math.ceil(mx / st) * st, step: st };
  if (scale.hi === scale.lo) scale.hi += st;
  const ticks: number[] = [];
  for (let v = scale.lo; v <= scale.hi + scale.step / 2; v += scale.step) ticks.push(Number(v.toPrecision(12)));
  const left = 14 + Math.max(...ticks.map((t) => axisLabel(t).length)) * 6.6 + (AX.yTitle ? 18 : 0);
  const right = w - 16, bottom = h - 30 - (AX.xTitle ? 18 : 0);
  axisTitles(parts, left, top, bottom, w);
  const hiV = ticks[ticks.length - 1];
  const y = (v: number) => bottom - ((v - scale.lo) / (hiV - scale.lo || 1)) * (bottom - top);
  ticks.forEach((t) => {
    const yy = y(t);
    parts.push(`<line x1="${left}" x2="${right}" y1="${yy}" y2="${yy}" stroke="#e3e3e3"/>`);
    parts.push(`<text x="${left - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#666">${esc(axisLabel(t))}</text>`);
  });
  const n = data.categories.length, band = (right - left) / n, bw = Math.max(1, Math.min(24, band * 0.6));
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((right - left) / 60))));
  rows.forEach((r, i) => {
    const cx = left + band * (i + 0.5);
    if (!(i % every)) parts.push(`<text x="${cx.toFixed(1)}" y="${bottom + 16}" text-anchor="middle" font-size="11" fill="#555">${esc(cut(data.categories[i], Math.max(4, Math.floor(band * every / 6.6))))}</text>`);
    if (!r) return;
    const up = !(r.close < r.open);
    const col = Number.isFinite(r.open) && Number.isFinite(r.close) ? (up ? WF_UP : WF_DOWN) : '#555';
    parts.push(`<line class="stk" x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${y(r.hi).toFixed(1)}" y2="${y(r.lo).toFixed(1)}" stroke="${col}" stroke-width="1.2"><title>${esc(data.categories[i])}: maxim ${esc(valueLabel(r.hi))}, minim ${esc(valueLabel(r.lo))}${Number.isFinite(r.close) ? ', închidere ' + esc(valueLabel(r.close)) : ''}</title></line>`);
    if (Number.isFinite(r.open) && Number.isFinite(r.close)) {
      const t = Math.min(y(r.open), y(r.close)), hh = Math.max(1, Math.abs(y(r.open) - y(r.close)));
      parts.push(`<rect class="${up ? 'stk-up' : 'stk-down'}" x="${(cx - bw / 2).toFixed(1)}" y="${t.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" fill="${up ? '#ffffff' : WF_DOWN}" stroke="${col}" stroke-width="1.2"/>`);
    } else if (Number.isFinite(r.close)) {
      parts.push(`<line class="stk-close" x1="${cx.toFixed(1)}" x2="${(cx + bw / 2).toFixed(1)}" y1="${y(r.close).toFixed(1)}" y2="${y(r.close).toFixed(1)}" stroke="${col}" stroke-width="1.6"/>`);
    }
    if (AX.labels && bw >= 16 && Number.isFinite(r.close)) dataLabel(parts, cx, y(r.hi) - 4, r.close);
  });
}

/**
 * Radarul (pânza de păianjen): câte o rază pe categorie, pornind de sus, în sensul acelor de ceas; fiecare serie e un poligon
 * închis cu punctele la distanța valorii de centru. Grila sunt poligoane la fiecare diviziune a scării; `filled` = poligoane umplute.
 */
function radar(parts: string[], data: ChartData, w: number, h: number, top: number, filled: boolean): void {
  const { categories, series } = data;
  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  const sc = userScale(niceScale(Math.min(0, ...all), Math.max(...all)));
  const L = legendBox(series.map((s) => s.name), top);
  top += L.top;
  const n = categories.length, bottom = h - L.bottom, right = w - L.right;
  const cx = right / 2, cy = (top + bottom) / 2 + 4, R = Math.max(10, Math.min(right / 2 - 56, (bottom - top) / 2 - 14));
  const at = (i: number, v: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n, r = ((Math.min(Math.max(v, sc.lo), sc.hi) - sc.lo) / (sc.hi - sc.lo)) * R;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = (pts: number[][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  for (let v = sc.lo + sc.step; v <= tickEnd(sc); v += sc.step) {
    // Grila: un poligon pe fiecare diviziune (desenat din linii, ca „fără grilă” să le poată scoate).
    const pts = categories.map((_, i) => at(i, v));
    pts.forEach(([x1, y1], i) => { const [x2, y2] = pts[(i + 1) % n]; parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#e3e3e3"/>`); });
    const [, ty] = at(0, v);
    parts.push(`<text x="${(cx + 4).toFixed(1)}" y="${(ty + 4).toFixed(1)}" font-size="10" fill="#666">${esc(axisLabel(v))}</text>`);
  }
  categories.forEach((c, i) => {
    const [x, y] = at(i, sc.hi), a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    parts.push(`<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#cfcfcf"/>`);
    const lx = cx + Math.cos(a) * (R + 10), ly = cy + Math.sin(a) * (R + 10) + 4;
    const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
    parts.push(`<text class="rd-cat" x="${lx.toFixed(1)}" y="${(ly + (Math.sin(a) > 0.9 ? 6 : 0)).toFixed(1)}" text-anchor="${anchor}" font-size="11" fill="#555">${esc(cut(c, 16))}</text>`);
  });
  series.forEach((s, k) => {
    const col = C[k % C.length];
    const pts = categories.map((_, i) => at(i, Number.isFinite(s.values[i]) ? s.values[i] : sc.lo));
    parts.push(`<polygon class="rd" points="${poly(pts)}" fill="${filled ? col : 'none'}" fill-opacity="${filled ? 0.35 : 0}" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>`);
    if (!filled) for (const [x, y] of pts) parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${col}"/>`);
    if (AX.labels && n <= 30) pts.forEach(([x, y], i) => { if (Number.isFinite(s.values[i])) dataLabel(parts, x, y - 6, s.values[i]); });
  });
  drawLegend(parts, series.map((s) => s.name), L, w, h);
}

/** Pâlnia: câte o bară pe etapă, centrată, cât de lată e valoarea; numele și valoarea pe bară. */
function funnel(parts: string[], data: ChartData, w: number, h: number, top: number): void {
  const items = data.categories.map((c, i) => ({ c, v: data.series[0].values[i] })).filter((x) => Number.isFinite(x.v) && x.v > 0);
  const max = Math.max(...items.map((x) => x.v), 1);
  const bottom = h - 14, band = (bottom - top) / Math.max(1, items.length), cx = w / 2, full = w - 40;
  items.forEach((x, i) => {
    const bw = Math.max(4, (x.v / max) * full), yy = top + band * i + band * 0.1, bh = band * 0.8;
    parts.push(`<rect class="fn" x="${(cx - bw / 2).toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${C[0]}" fill-opacity="${(1 - (i / Math.max(1, items.length)) * 0.45).toFixed(2)}"/>`);
    if (bh >= 11) parts.push(`<text x="${cx}" y="${(yy + bh / 2 + 4).toFixed(1)}" text-anchor="middle" font-size="${Math.min(13, Math.floor(bh * 0.6))}" fill="#fff" font-weight="600" stroke="#000" stroke-opacity="0.25" stroke-width="0.6" paint-order="stroke">${esc(cut(x.c, 24))}: ${esc(valueLabel(x.v))}</text>`);
  });
}

/**
 * Împarte dreptunghiul (x, y, w, h) în bucăți cu aria proporțională cu valorile (date de la mare la mic), cât mai aproape de
 * pătrate: pune pe rând bucăți de-a lungul laturii scurte cât timp cel mai alungit dreptunghi din rând nu se strică.
 */
export function squarify(values: number[], x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const total = values.reduce((a, b) => a + b, 0);
  if (!(total > 0) || w <= 0 || h <= 0) return values.map(() => ({ x, y, w: 0, h: 0 }));
  const area = values.map((v) => (v / total) * w * h);
  const worst = (row: number[], side: number) => {
    const s = row.reduce((a, b) => a + b, 0), mx = Math.max(...row), mn = Math.min(...row);
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  let i = 0;
  while (i < area.length) {
    const side = Math.min(w, h);
    const row = [area[i]];
    let j = i + 1;
    while (j < area.length && worst([...row, area[j]], side) <= worst(row, side)) row.push(area[j++]);
    const s = row.reduce((a, b) => a + b, 0);
    if (w >= h) {
      // Rândul e o coloană în stânga, cât e de lată suma ariilor / înălțime.
      const cw = s / h;
      let yy = y;
      for (const a of row) { const ch = a / cw; out.push({ x, y: yy, w: cw, h: ch }); yy += ch; }
      x += cw; w -= cw;
    } else {
      const rh = s / w;
      let xx = x;
      for (const a of row) { const cw = a / rh; out.push({ x: xx, y, w: cw, h: rh }); xx += cw; }
      y += rh; h -= rh;
    }
    i = j;
  }
  return out;
}

/** Harta de suprafețe: fiecare rând e un dreptunghi cu aria cât valoarea lui (de la mare la mic), cu numele și valoarea în el. */
function treemap(parts: string[], data: ChartData, w: number, h: number, top: number): void {
  const items = data.categories.map((c, i) => ({ c, v: data.series[0].values[i] })).filter((x) => Number.isFinite(x.v) && x.v > 0).sort((a, b) => b.v - a.v);
  const boxes = squarify(items.map((x) => x.v), 10, top, w - 20, h - top - 10);
  items.forEach((x, i) => {
    const b = boxes[i];
    parts.push(`<rect class="tm" x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${Math.max(0, b.w).toFixed(1)}" height="${Math.max(0, b.h).toFixed(1)}" fill="${C[i % C.length]}" stroke="#fff" stroke-width="2"/>`);
    if (b.w < 30 || b.h < 16) return;
    const fs = Math.max(9, Math.min(13, Math.floor(b.h / 3)));
    const chars = Math.max(3, Math.floor((b.w - 8) / (fs * 0.58)));
    const tx = (b.x + 5).toFixed(1);
    parts.push(`<text x="${tx}" y="${(b.y + fs + 3).toFixed(1)}" font-size="${fs}" fill="#fff" font-weight="600">${esc(cut(x.c, chars))}</text>`);
    if (b.h >= fs * 2 + 8) parts.push(`<text x="${tx}" y="${(b.y + fs * 2 + 6).toFixed(1)}" font-size="${fs}" fill="#fff">${esc(cut(valueLabel(x.v), chars))}</text>`);
  });
}

export interface SunNode { name: string; value: number; kids: SunNode[] }

/**
 * Arborele graficului Soare: fiecare rând dă un drum (grupă → subgrupă → element) din coloanele de etichete; celula de grupă
 * goală ia grupa de deasupra (ca la tabelele scrise o singură dată pe grupă). Valorile se adună în sus; doar cele pozitive.
 */
export function sunTree(data: ChartData): SunNode {
  const root: SunNode = { name: '', value: 0, kids: [] };
  const lv = data.levels && data.levels.length >= 2 ? data.levels : [data.categories];
  const vals = data.series[0]?.values ?? [];
  const last: string[] = [];
  vals.forEach((v, i) => {
    let path = lv.map((col) => (col[i] ?? '').trim());
    path.forEach((p, k) => { if (k < path.length - 1) { if (p) { last[k] = p; last.length = k + 1; } else path[k] = last[k] ?? ''; } });
    while (path.length > 1 && !path[path.length - 1]) path = path.slice(0, -1);
    path = path.map((p) => p || '(fără nume)');
    if (!(Number.isFinite(v) && v > 0)) return;
    let n = root;
    n.value += v;
    for (const p of path) {
      let k = n.kids.find((x) => x.name === p);
      if (!k) { k = { name: p, value: 0, kids: [] }; n.kids.push(k); }
      k.value += v;
      n = k;
    }
  });
  return root;
}

const mixWhite = (hex: string, t: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (x: number) => Math.round(x + (255 - x) * t).toString(16).padStart(2, '0');
  return '#' + ch(n >> 16) + ch((n >> 8) & 255) + ch(n & 255);
};

/** Graficul Soare: un inel pentru fiecare nivel, grupa mare în mijloc; fiecare bucată cât suma ei, sub grupa ei. */
function sunburst(parts: string[], data: ChartData, w: number, h: number, top: number): void {
  const root = sunTree(data);
  if (!(root.value > 0)) return;
  const depth = (n: SunNode): number => (n.kids.length ? 1 + Math.max(...n.kids.map(depth)) : 0);
  const levels = depth(root);
  const cx = w / 2, cy = (top + h - 8) / 2 + 2;
  const R = Math.max(20, Math.min(w / 2 - 10, (h - top - 8) / 2));
  const hole = R * 0.22;
  const ring = (R - hole) / levels;
  const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  const draw = (n: SunNode, lvl: number, a0: number, a1: number, color: string) => {
    const r0 = hole + ring * lvl, r1 = r0 + ring;
    const span = Math.min(a1 - a0, Math.PI * 2 - 1e-4);
    const e = a0 + span, big = span > Math.PI ? 1 : 0;
    const fill = mixWhite(color, Math.min(0.6, lvl * 0.22));
    parts.push(`<path class="sb" d="M${pt(r1, a0)}A${r1.toFixed(2)} ${r1.toFixed(2)} 0 ${big} 1 ${pt(r1, e)}L${pt(r0, e)}A${r0.toFixed(2)} ${r0.toFixed(2)} 0 ${big} 0 ${pt(r0, a0)}Z" fill="${fill}" stroke="#fff" stroke-width="1.5"><title>${esc(n.name)}: ${esc(valueLabel(n.value))}</title></path>`);
    const mid = (r0 + r1) / 2, am = a0 + span / 2;
    const fs = Math.max(9, Math.min(12, Math.floor(ring / 3)));
    const room = Math.min(span * mid, ring * 1.6);
    const chars = Math.floor((room - 4) / (fs * 0.58));
    if (chars >= 3 && span * mid >= fs + 4) {
      const tx = cx + mid * Math.cos(am), ty = cy + mid * Math.sin(am) + fs / 3;
      parts.push(`<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" font-size="${fs}" fill="${lvl >= 2 ? '#222' : '#fff'}" font-weight="${lvl ? 400 : 600}">${esc(cut(n.name, chars))}</text>`);
    }
    let a = a0;
    n.kids.forEach((k) => { const da = (k.value / n.value) * (a1 - a0); draw(k, lvl + 1, a, a + da, color); a += da; });
  };
  let a = -Math.PI / 2;
  root.kids.forEach((k, i) => { const da = (k.value / root.value) * Math.PI * 2; draw(k, 0, a, a + da, C[i % C.length]); a += da; });
}

/** Bare orizontale: categoriile de sus în jos, valorile pe orizontală; stivuite (seriile una după alta pe aceeași bară) sau stivuite 100%. */
function hbar(parts: string[], data: ChartData, w: number, h: number, top: number, type: ChartType = 'bar'): void {
  const p100 = type === 'barStack100', stacked = p100 || type === 'barStack';
  if (p100) data = toPercent(data);
  const { categories, series } = data;
  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  // Stivuite: contează suma pozitivelor (spre dreapta) și a negativelor (spre stânga) de pe fiecare bară.
  const stacks = stacked ? categories.map((_, i) => series.reduce((acc, s) => { const v = s.values[i]; if (Number.isFinite(v)) acc[v >= 0 ? 0 : 1] += v; return acc; }, [0, 0])) : [];
  const neg = Math.min(0, ...stacks.map((x) => x[1]));
  const sc = p100 ? fixedScale(neg < 0 ? -100 : 0, 100, neg < 0 ? 10 : 5)
    : userScale(stacked ? niceScale(neg, Math.max(0, ...stacks.map((x) => x[0]))) : niceScale(Math.min(...all), Math.max(...all)));
  const L = legendBox(series.map((s) => s.name), top);
  top += L.top;
  const left = 12 + Math.min(18, Math.max(...categories.map((c) => c.length))) * 6.6 + (AX.yTitle ? 18 : 0);
  const right = w - L.right - (AX.labels ? 48 : 24);
  const bottom = h - L.bottom - (AX.xTitle ? 18 : 0);
  axisTitles(parts, left, top, bottom, w);
  const x = (v: number) => clampTo(left + ((v - sc.lo) / (sc.hi - sc.lo)) * (right - left), left, right);
  for (let v = sc.lo; v <= tickEnd(sc); v += sc.step) {
    const xx = x(v);
    parts.push(`<line x1="${xx}" x2="${xx}" y1="${top}" y2="${bottom}" stroke="#e3e3e3"/>`);
    parts.push(`<text x="${xx}" y="${bottom + 16}" text-anchor="middle" font-size="11" fill="#666">${esc(axisLabel(v) + (p100 ? '%' : ''))}</text>`);
  }
  const zero = x(0);
  parts.push(`<line x1="${zero}" x2="${zero}" y1="${top}" y2="${bottom}" stroke="#999"/>`);
  const n = categories.length;
  const band = (bottom - top) / n;
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((bottom - top) / 16))));
  categories.forEach((cat, i) => {
    if (i % every) return;
    parts.push(`<text x="${left - 6}" y="${top + band * (i + 0.5) + 4}" text-anchor="end" font-size="11" fill="#555">${esc(cut(cat, 18))}</text>`);
  });
  if (stacked) {
    const gap = band * 0.3, bh = band - gap;
    categories.forEach((_, i) => {
      let right = 0, leftAcc = 0;
      series.forEach((s, k) => {
        const v = s.values[i];
        if (!Number.isFinite(v) || v === 0) return;
        const from = v >= 0 ? right : leftAcc, to = from + v;
        if (v >= 0) right = to; else leftAcc = to;
        const yy = top + band * i + gap / 2;
        parts.push(`<rect x="${Math.min(x(from), x(to)).toFixed(1)}" y="${yy.toFixed(1)}" width="${Math.abs(x(to) - x(from)).toFixed(1)}" height="${Math.max(1, bh).toFixed(1)}" fill="${C[k % COLORS.length]}" stroke="#fff" stroke-width="0.5"/>`);
        if (AX.labels && Math.abs(x(to) - x(from)) >= 26 && bh >= 12) dataLabel(parts, (x(from) + x(to)) / 2, yy + bh / 2 + 3.5, v, 'middle', '#fff');
      });
    });
    drawLegend(parts, series.map((s) => s.name), L, w, h);
    return;
  }
  const gap = band * 0.2;
  const bh = (band - gap) / series.length;
  series.forEach((s, k) => s.values.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    const yy = top + band * i + gap / 2 + bh * k;
    parts.push(`<rect x="${Math.min(x(v), zero).toFixed(1)}" y="${yy.toFixed(1)}" width="${Math.abs(x(v) - zero).toFixed(1)}" height="${Math.max(1, bh - 1).toFixed(1)}" fill="${C[k % COLORS.length]}"/>`);
    if (AX.labels && bh >= 10) dataLabel(parts, v >= 0 ? x(v) + 3 : x(v) - 3, yy + bh / 2 + 3, v, v >= 0 ? 'start' : 'end');
  }));
  drawLegend(parts, series.map((s) => s.name), L, w, h);
}

/**
 * Puncte X–Y: etichetele (prima coloană) sunt valorile X, dacă sunt numere; altfel 1, 2, 3…
 * Bule: seriile merg în perechi (Y, mărimea bulei); aria bulei e pe măsura mărimii (cea mai mare are raza maximă).
 * O serie fără pereche are toate bulele la fel.
 */
function scatter(parts: string[], data: ChartData, w: number, h: number, top: number, bub = false): void {
  const { categories } = data;
  const series = bub ? data.series.filter((_, k) => k % 2 === 0) : data.series;
  const sizes = bub ? series.map((_, k) => data.series[2 * k + 1]?.values ?? []) : [];
  const maxSize = Math.max(0, ...sizes.flat().filter(Number.isFinite));
  const maxR = Math.max(8, Math.min(w, h) / 9);
  const radius = (k: number, i: number) => {
    if (!bub) return 4;
    if (!sizes[k].length || !maxSize) return maxR / 2;
    const v = sizes[k][i];
    return Number.isFinite(v) && v > 0 ? Math.max(2, maxR * Math.sqrt(v / maxSize)) : 0;
  };
  const asNum = categories.map((c) => Number(String(c).trim().replace(/\s/g, '').replace(',', '.')));
  const xs = asNum.every((v, i) => categories[i].trim() !== '' && Number.isFinite(v)) ? asNum : categories.map((_, i) => i + 1);
  const ys = series.flatMap((s) => s.values).filter(Number.isFinite);
  const sy = userScale(niceScale(Math.min(...ys), Math.max(...ys)));
  const sx = niceScale(Math.min(...xs), Math.max(...xs));
  const L = legendBox(series.map((s) => s.name), top);
  top += L.top;
  const yl: string[] = [];
  for (let v = sy.lo; v <= tickEnd(sy); v += sy.step) yl.push(axisLabel(v));
  const left = 14 + Math.max(...yl.map((t) => t.length)) * 6.6 + (AX.yTitle ? 18 : 0);
  const right = w - 20 - L.right;
  const bottom = h - L.bottom - (AX.xTitle ? 18 : 0);
  axisTitles(parts, left, top, bottom, w);
  const X = (v: number) => left + ((v - sx.lo) / (sx.hi - sx.lo)) * (right - left);
  const Y = (v: number) => clampTo(bottom - ((v - sy.lo) / (sy.hi - sy.lo)) * (bottom - top), top, bottom);
  yl.forEach((t, i) => {
    const yy = Y(sy.lo + i * sy.step);
    parts.push(`<line x1="${left}" x2="${right}" y1="${yy}" y2="${yy}" stroke="#e3e3e3"/>`);
    parts.push(`<text x="${left - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#666">${esc(t)}</text>`);
  });
  for (let v = sx.lo; v <= sx.hi + sx.step / 2; v += sx.step) {
    parts.push(`<text x="${X(v)}" y="${bottom + 16}" text-anchor="middle" font-size="11" fill="#666">${esc(axisLabel(v))}</text>`);
  }
  parts.push(`<line x1="${left}" x2="${right}" y1="${Y(Math.max(sy.lo, 0))}" y2="${Y(Math.max(sy.lo, 0))}" stroke="#999"/>`);
  parts.push(`<line x1="${X(Math.max(sx.lo, 0))}" x2="${X(Math.max(sx.lo, 0))}" y1="${top}" y2="${bottom}" stroke="#999"/>`);
  // Bulele mari se desenează primele, ca cele mici să rămână la vedere deasupra lor.
  const dots: { k: number; i: number; v: number; r: number }[] = [];
  series.forEach((s, k) => s.values.forEach((v, i) => { const r = radius(k, i); if (Number.isFinite(v) && Number.isFinite(xs[i]) && r > 0) dots.push({ k, i, v, r }); }));
  if (bub) dots.sort((a, b) => b.r - a.r);
  for (const d of dots) {
    parts.push(`<circle cx="${X(xs[d.i]).toFixed(1)}" cy="${Y(d.v).toFixed(1)}" r="${d.r.toFixed(1)}" fill="${C[d.k % COLORS.length]}" fill-opacity="${bub ? 0.6 : 0.85}"${bub ? ' stroke="#ffffff" stroke-width="1"' : ''}/>`);
    if (AX.labels && series[d.k].values.length <= 40) dataLabel(parts, X(xs[d.i]), Y(d.v) - d.r - 3, d.v);
  }
  drawLegend(parts, series.map((s) => s.name), L, w, h);
}

function pie(parts: string[], data: ChartData, w: number, h: number, top: number, hole = false): void {
  // Plăcinta folosește prima serie; valorile negative sau goale nu au felie.
  const s = data.series[0];
  const items = data.categories.map((c, i) => ({ c, v: s.values[i] })).filter((x) => Number.isFinite(x.v) && x.v > 0);
  const total = items.reduce((a, x) => a + x.v, 0);
  if (!total) {
    parts.push(`<text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="13" fill="#888">Plăcinta are nevoie de numere pozitive</text>`);
    return;
  }
  const r = Math.min((h - top - 16) / 2, w * 0.3);
  const cx = AX.legend === 'none' ? w / 2 : 24 + r;
  const cy = top + (h - top) / 2 - 4;
  const color = (i: number) => C[i % COLORS.length];
  let a = -Math.PI / 2;
  items.forEach((x, i) => {
    const da = (x.v / total) * Math.PI * 2;
    if (items.length === 1) {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color(i)}"/>`);
    } else {
      const p = (t: number) => `${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`;
      parts.push(`<path d="M${cx} ${cy}L${p(a)}A${r} ${r} 0 ${da > Math.PI ? 1 : 0} 1 ${p(a + da)}Z" fill="${color(i)}" stroke="#fff" stroke-width="1.5"/>`);
    }
    const pct = (x.v / total) * 100;
    if (pct >= 4) {
      const m = a + da / 2;
      const lr = hole ? 0.78 : 0.65;
      parts.push(`<text x="${(cx + r * lr * Math.cos(m)).toFixed(1)}" y="${(cy + r * lr * Math.sin(m) + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="600" fill="#fff">${pctText(pct)}</text>`);
    }
    a += da;
  });
  // Inelul: un cerc alb în mijloc.
  if (hole) parts.push(`<circle cx="${cx}" cy="${cy}" r="${(r * 0.55).toFixed(1)}" fill="#ffffff"/>`);
  // Legenda în dreapta: o felie pe rând (cel mult câte încap).
  if (AX.legend === 'none') return;
  const lx = cx + r + 28;
  const rows = Math.max(1, Math.floor((h - top - 8) / 20));
  items.slice(0, rows).forEach((x, i) => {
    const ly = top + 14 + i * 20;
    const label = i === rows - 1 && items.length > rows ? `încă ${items.length - i}…` : cut(x.c || '(fără nume)', 28);
    parts.push(`<rect x="${lx}" y="${ly - 10}" width="12" height="12" rx="2" fill="${color(i)}"/>`);
    parts.push(`<text x="${lx + 18}" y="${ly}" font-size="12" fill="#333">${esc(label)}</text>`);
  });
}

const pctText = (p: number) => `${p.toLocaleString('ro-RO', { maximumFractionDigits: p < 10 ? 1 : 0 })}%`;

/** Transformă SVG-ul în imagine PNG (de două ori mai mare, ca să fie clară în Docs sau în prezentări). */
export function svgToPng(svg: string, w = CHART_W, h = CHART_H, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Nu se poate desena imaginea.')); return; }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Nu se poate crea imaginea.'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Graficul nu a putut fi desenat.')); };
    img.src = url;
  });
}
