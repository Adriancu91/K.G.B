// Test: graficul Soare (sunburst) din Sheets: nivelurile din coloanele de text, arborele, desenul SVG, .xlsx și citirea înapoi.
// Rulare (în suite/): node tests/chart-sunburst.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-chartsb-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/chartSvg.ts', 'src/sheets/chart.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { writeXlsx, readXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { chartSvg, sunTree, statData, recommendCharts, SHEET_CHART_TYPES } = await import(pathToFileURL(join(dir, 'chartSvg.js')).href);
const { chartData } = await import(pathToFileURL(join(dir, 'chart.js')).href);
rmSync(dir, { recursive: true, force: true });

// Regiunea e scrisă o singură dată pe grupă (celulele de sub ea sunt goale).
const cells = {
  A1: 'Regiune', B1: 'Oraș', C1: 'Vânzări',
  A2: 'Nord', B2: 'Cluj', C2: '50', B3: 'Baia Mare', C3: '20',
  A4: 'Sud', B4: 'Craiova', C4: '30', B5: 'Pitești', C5: '10', A6: 'Vest', B6: 'Timișoara', C6: '40',
};
const g = { r0: 0, c0: 0, r1: 5, c1: 2 };
const data = chartData(cells, {}, {}, g);
assert.equal(data.levels?.length, 2, 'două niveluri: regiune, oraș');
assert.deepEqual(data.series.map((s) => s.name), ['Vânzări'], 'o serie');
const t = sunTree(data);
assert.equal(t.value, 150, 'totalul');
assert.deepEqual(t.kids.map((k) => [k.name, k.value]), [['Nord', 70], ['Sud', 40], ['Vest', 40]], 'grupele, cu golurile completate');
assert.deepEqual(t.kids[0].kids.map((k) => k.name), ['Cluj', 'Baia Mare'], 'orașele sub grupa lor');

const svg = chartSvg('sunburst', 'Vânzări', data);
assert.equal((svg.match(/<path class="sb"/g) || []).length, 8, '3 grupe + 5 orașe');
assert.ok(svg.includes('>Nord</text>') && svg.includes('>Cluj</text>'), 'numele în inele');
assert.ok(!svg.includes('NaN'), 'fără NaN');
// Un singur nivel: un inel plin (o singură grupă face cerc întreg, fără să dispară).
const one = chartSvg('sunburst', '', { categories: ['Tot'], series: [{ name: 'V', values: [5] }] });
assert.equal((one.match(/<path class="sb"/g) || []).length, 1, 'cerc întreg');
assert.ok(!one.includes('NaN'));

assert.deepEqual(statData('sunburst', data).categories, ['Nord / Cluj', 'Nord / Baia Mare', 'Sud / Craiova', 'Sud / Pitești', 'Vest / Timișoara'], '.xlsx: frunzele cu drumul');
assert.equal(recommendCharts(data)[0], 'sunburst', 'recomandat la date pe niveluri');
assert.ok(SHEET_CHART_TYPES.some(([k]) => k === 'sunburst'), 'în lista tipurilor');
// Tabelele obișnuite (o coloană de text) nu primesc niveluri.
assert.equal(chartData({ A1: 'a', B1: '1', A2: 'b', B2: '2' }, {}, {}, { r0: 0, c0: 0, r1: 1, c1: 1 }).levels, undefined);

const sheet = { name: 'Foaia 1', cells, styles: {}, colW: {}, charts: [{ id: 'g1', type: 'sunburst', range: 'A1:C6', title: 'T' }] };
const bytes = await writeXlsx([{ sheet, results: {} }]);
const z = await JSZip.loadAsync(bytes);
const x = await z.file(Object.keys(z.files).find((n) => /charts.chart\d+\.xml$/.test(n))).async('string');
assert.ok(x.includes('<s:stat kind="sunburst" range="A1:C6"/>'), 'semnul nostru');
assert.ok(x.includes('<c:doughnutChart>'), 'în alte programe: inel');
assert.equal((await readXlsx(bytes)).sheets[0].charts[0].type, 'sunburst', 'citit înapoi');
console.log('graficul Soare: toate verificările trec');
