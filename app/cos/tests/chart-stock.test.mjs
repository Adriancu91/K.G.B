// Test: graficul bursier din Sheets: lumânări (deschidere, maxim, minim, închidere), varianta cu 3 coloane, scara, .xlsx.
// Rulare (în suite/): node tests/chart-stock.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-chartstk-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/chartSvg.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { writeXlsx, readXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { chartSvg, recommendCharts, SHEET_CHART_TYPES } = await import(pathToFileURL(join(dir, 'chartSvg.js')).href);
rmSync(dir, { recursive: true, force: true });

const cats = ['01.10', '02.10', '03.10', '04.10'];
const ohlc = { categories: cats, series: [
  { name: 'Deschidere', values: [100, 104, 101, 99] }, { name: 'Maxim', values: [106, 107, 103, 105] },
  { name: 'Minim', values: [98, 100, 96, 97] }, { name: 'Închidere', values: [104, 101, 99, 104] },
] };
const svg = chartSvg('stock', 'Acțiuni', ohlc);
assert.equal((svg.match(/<line class="stk"/g) || []).length, 4, 'o linie minim–maxim pe zi');
assert.equal((svg.match(/class="stk-up"/g) || []).length, 2, '2 zile în creștere');
assert.equal((svg.match(/class="stk-down"/g) || []).length, 2, '2 zile în scădere');
assert.ok(!svg.includes('NaN'), 'fără NaN');
// Scara se strânge în jurul prețurilor (nu pornește de la 0).
const ticks = [...svg.matchAll(/text-anchor="end" font-size="11" fill="#666">([^<]+)</g)].map((m) => Number(m[1].replace('.', '').replace(',', '.')));
assert.ok(ticks[0] > 0 && ticks[0] <= 96 && ticks[ticks.length - 1] >= 107, 'scara: ' + ticks.join(' '));
// Maxim, minim, închidere: liniuța la închidere, fără lumânări.
const hlc = { categories: cats, series: ohlc.series.slice(1) };
const s3 = chartSvg('stock', '', hlc);
assert.equal((s3.match(/class="stk-close"/g) || []).length, 4, 'liniuța la închidere');
assert.ok(!s3.includes('stk-up'), 'fără lumânări');
// Prea puține coloane: mesaj, nu desen stricat.
assert.ok(chartSvg('stock', '', { categories: cats, series: [ohlc.series[0]] }).includes('Alege coloanele'), 'mesaj');
assert.equal(recommendCharts(ohlc)[0], 'stock', 'recomandat după numele coloanelor');
assert.ok(SHEET_CHART_TYPES.some(([k]) => k === 'stock'), 'în lista tipurilor');

const cells = { A1: 'Ziua', B1: 'Deschidere', C1: 'Maxim', D1: 'Minim', E1: 'Închidere' };
cats.forEach((c, i) => { cells['A' + (i + 2)] = c; ohlc.series.forEach((s, k) => { cells['BCDE'[k] + (i + 2)] = String(s.values[i]); }); });
const sheet = { name: 'Foaia 1', cells, styles: {}, colW: {}, charts: [{ id: 'g1', type: 'stock', range: 'A1:E5', title: 'T' }] };
const bytes = await writeXlsx([{ sheet, results: {} }]);
const z = await JSZip.loadAsync(bytes);
const x = await z.file(Object.keys(z.files).find((n) => /charts.chart\d+\.xml$/.test(n))).async('string');
assert.ok(x.includes('<s:stat kind="stock" range="A1:E5"/>'), 'semnul nostru');
assert.ok(x.includes('<c:lineChart>'), 'în alte programe: linii');
assert.equal((await readXlsx(bytes)).sheets[0].charts[0].type, 'stock', 'citit înapoi');
console.log('graficul bursier: toate verificările trec');
