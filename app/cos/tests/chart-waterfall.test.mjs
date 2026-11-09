// Test: graficele Cascadă și Pâlnie din Sheets: desenul SVG (bucățile, culorile, totalul), salvarea în .xlsx și citirea înapoi.
// Rulare (în suite/): node tests/chart-waterfall.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-chartwf-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/chartSvg.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { writeXlsx, readXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { chartSvg, statData, SHEET_CHART_TYPES, WF_UP, WF_DOWN } = await import(pathToFileURL(join(dir, 'chartSvg.js')).href);
rmSync(dir, { recursive: true, force: true });

const data = { categories: ['Sold inițial', 'Vânzări', 'Salarii', 'Chirie'], series: [{ name: 'Lei', values: [1000, 500, -700, -200] }] };
let svg = chartSvg('waterfall', '', data);
const rects = svg.match(/<rect class="wf"[^>]*>/g) || [];
assert.equal(rects.length, 5, 'cascadă: o bucată pe rând + totalul');
assert.equal(rects.filter((r) => r.includes(WF_UP)).length, 2, 'cascadă: două creșteri (verde)');
assert.equal(rects.filter((r) => r.includes(WF_DOWN)).length, 2, 'cascadă: două scăderi (roșu)');
assert.ok(svg.includes('>Total</text>'), 'cascadă: coloana Total');
svg = chartSvg('waterfall', '', data, undefined, undefined, { labels: true });
assert.ok(svg.includes('>-700</text>') && svg.includes('>600</text>'), 'cascadă: valorile și totalul (600)');
const st = statData('waterfall', data);
assert.deepEqual(st.series[0].values, [0, 1000, 800, 600], 'cascadă .xlsx: baza');
assert.deepEqual(st.series[1].values, [1000, 500, 0, 0]);
assert.deepEqual(st.series[2].values, [0, 0, 700, 200]);

const fdata = { categories: ['Vizitatori', 'Coș', 'Plată', 'Comenzi'], series: [{ name: 'Oameni', values: [1000, 400, 200, 150] }] };
svg = chartSvg('funnel', '', fdata);
const bars = (svg.match(/<rect class="fn"[^>]*width="([\d.]+)"/g) || []).map((r) => Number(/width="([\d.]+)"/.exec(r)[1]));
assert.equal(bars.length, 4, 'pâlnie: o bară pe etapă');
assert.ok(bars.every((b, i) => !i || b < bars[i - 1]), 'pâlnie: tot mai înguste');
assert.ok(svg.includes('Coș: 400'), 'pâlnie: numele și valoarea pe bară');
assert.ok(SHEET_CHART_TYPES.some(([k]) => k === 'waterfall') && SHEET_CHART_TYPES.some(([k]) => k === 'funnel'), 'în lista tipurilor');

const cells = { A1: 'Ce', B1: 'Lei', A2: 'Sold', B2: '1000', A3: 'Vânzări', B3: '500', A4: 'Salarii', B4: '-700' };
for (const type of ['waterfall', 'funnel']) {
  const sheet = { name: 'Foaia 1', cells, styles: {}, colW: {}, charts: [{ id: 'g1', type, range: 'A1:B4', title: 'T' }] };
  const bytes = await writeXlsx([{ sheet, results: {} }]);
  const z = await JSZip.loadAsync(bytes);
  const x = await z.file(Object.keys(z.files).find((n) => /charts.chart\d+\.xml$/.test(n))).async('string');
  assert.ok(x.includes(`<s:stat kind="${type}" range="A1:B4"/>`), type + ': semnul nostru');
  if (type === 'waterfall') assert.ok(x.includes('<c:grouping val="stacked"/>') && x.includes('<a:noFill/>') && x.includes(WF_DOWN.slice(1).toUpperCase()), 'cascadă: coloane stivuite cu baza nevăzută');
  else assert.ok(x.includes('<c:barDir val="bar"/>'), 'pâlnie: bare orizontale');
  const back = (await readXlsx(bytes)).sheets[0].charts[0];
  assert.equal(back.type, type, type + ': citit înapoi');
}
console.log('cascadă și pâlnie: toate verificările trec');
