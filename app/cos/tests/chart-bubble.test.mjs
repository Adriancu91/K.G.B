// Test: graficul cu bule din Sheets: X, Y și mărimea bulei (aria pe măsura mărimii), recomandare, .xlsx dus-întors,
// și păstrarea tipului în fișierul Suite (și pentru Soare / Bursier, care se pierdeau la redeschidere).
// Rulare (în suite/): node tests/chart-bubble.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-chartbub-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/chartSvg.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { writeXlsx, readXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { chartSvg, recommendCharts, SHEET_CHART_TYPES } = await import(pathToFileURL(join(dir, 'chartSvg.js')).href);
const fmt = await import(pathToFileURL(join(dir, 'format.js')).href);
rmSync(dir, { recursive: true, force: true });

const data = { categories: ['10', '20', '30', '40'], series: [{ name: 'Vânzări', values: [5, 9, 3, 7] }, { name: 'Clienți', values: [100, 25, 400, 0] }] };
const svg = chartSvg('bubble', 'Piețe', data);
const radii = [...svg.matchAll(/<circle [^>]*r="([\d.]+)"/g)].map((m) => Number(m[1]));
assert.equal(radii.length, 3, 'mărimea 0 nu are bulă: ' + radii.join(' '));
assert.ok(Math.abs(radii[0] / radii[1] - 2) < 0.05, 'aria pe măsura mărimii (400 față de 100 = rază dublă), cele mari primele: ' + radii.join(' '));
assert.ok(!svg.includes('NaN'), 'fără NaN');
assert.ok(!svg.includes('Clienți'), 'seria de mărimi nu apare în legendă');
const one = chartSvg('bubble', '', { categories: data.categories, series: [data.series[0]] });
assert.equal(new Set([...one.matchAll(/<circle [^>]*r="([\d.]+)"/g)].map((m) => m[1])).size, 1, 'fără mărimi: bule egale');
assert.ok(recommendCharts(data).includes('bubble'), 'recomandat la X numeric + 2 serii');
assert.ok(SHEET_CHART_TYPES.some(([k]) => k === 'bubble'), 'în lista tipurilor');

const cells = { A1: 'Preț', B1: 'Vânzări', C1: 'Clienți' };
data.categories.forEach((c, i) => { cells['A' + (i + 2)] = c; cells['B' + (i + 2)] = String(data.series[0].values[i]); cells['C' + (i + 2)] = String(data.series[1].values[i]); });
const sheet = { name: 'Foaia 1', cells, styles: {}, colW: {}, charts: [{ id: 'g1', type: 'bubble', range: 'A1:C5', title: 'T' }] };
const bytes = await writeXlsx([{ sheet, results: {} }]);
const z = await JSZip.loadAsync(bytes);
const x = await z.file(Object.keys(z.files).find((n) => /charts.chart\d+\.xml$/.test(n))).async('string');
assert.ok(x.includes('<c:bubbleChart>'), 'bubbleChart în .xlsx');
assert.equal((x.match(/<c:ser>/g) || []).length, 1, 'o singură serie (Y + mărime)');
assert.ok(/<c:xVal>.*\$A\$2:\$A\$5.*<\/c:xVal><c:yVal>.*\$B\$2:\$B\$5.*<\/c:yVal><c:bubbleSize>.*\$C\$2:\$C\$5.*<\/c:bubbleSize><c:bubble3D val="0"\/>/.test(x), 'X, Y, mărime în ordinea cerută');
assert.ok(!x.includes('<c:marker>'), 'bulele nu au marker');
assert.equal((await readXlsx(bytes)).sheets[0].charts[0].type, 'bubble', 'citit înapoi');

// Fișierul Suite: tipurile noi rămân la redeschidere.
for (const type of ['bubble', 'sunburst', 'stock']) {
  const back = fmt.parseSheetDoc(fmt.serializeSheetDoc({ format: 'suite-sheet', version: 1, title: 'x', updatedAt: '', sheets: [{ ...sheet, charts: [{ id: 'g1', type, range: 'A1:C5', title: '' }] }] }));
  assert.equal(back.sheets[0].charts[0].type, type, 'fișier Suite: ' + type);
}
console.log('graficul cu bule: toate verificările trec');
