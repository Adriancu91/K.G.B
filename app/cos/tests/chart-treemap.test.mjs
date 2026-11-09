// Test: graficul Hartă de suprafețe (treemap) din Sheets: împărțirea în dreptunghiuri, desenul SVG, salvarea în .xlsx și citirea înapoi.
// Rulare (în suite/): node tests/chart-treemap.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-charttm-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/chartSvg.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { writeXlsx, readXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { chartSvg, squarify, statData, SHEET_CHART_TYPES } = await import(pathToFileURL(join(dir, 'chartSvg.js')).href);
rmSync(dir, { recursive: true, force: true });

// Ariile sunt proporționale cu valorile, bucățile acoperă tot dreptunghiul și nu ies din el.
const vals = [6, 6, 4, 3, 2, 2, 1];
const b = squarify(vals, 0, 0, 600, 400);
const total = vals.reduce((a, c) => a + c, 0);
b.forEach((r, i) => assert.ok(Math.abs(r.w * r.h - (vals[i] / total) * 240000) < 0.5, 'aria bucății ' + i));
assert.ok(b.every((r) => r.x >= -1e-6 && r.y >= -1e-6 && r.x + r.w <= 600 + 1e-6 && r.y + r.h <= 400 + 1e-6), 'în dreptunghi');
assert.ok(Math.max(...b.map((r) => Math.max(r.w / r.h, r.h / r.w))) < 4, 'bucăți cât mai pătrate');

const data = { categories: ['Chirie', 'Mâncare', 'Transport', 'Altele', 'Negativ'], series: [{ name: 'Lei', values: [2000, 1200, 400, 300, -50] }] };
const svg = chartSvg('treemap', 'Cheltuieli', data);
const rects = svg.match(/<rect class="tm"[^>]*>/g) || [];
assert.equal(rects.length, 4, 'un dreptunghi pe valoare pozitivă');
assert.ok(svg.includes('>Chirie</text>') && svg.includes('>' + (2000).toLocaleString('ro-RO') + '</text>'), 'numele și valoarea');
assert.deepEqual(statData('treemap', data).series[0].values, [2000, 1200, 400, 300], '.xlsx: de la mare la mic');
assert.ok(SHEET_CHART_TYPES.some(([k]) => k === 'treemap'), 'în lista tipurilor');

const cells = { A1: 'Ce', B1: 'Lei', A2: 'Chirie', B2: '2000', A3: 'Mâncare', B3: '1200', A4: 'Transport', B4: '400' };
const sheet = { name: 'Foaia 1', cells, styles: {}, colW: {}, charts: [{ id: 'g1', type: 'treemap', range: 'A1:B4', title: 'T' }] };
const bytes = await writeXlsx([{ sheet, results: {} }]);
const z = await JSZip.loadAsync(bytes);
const x = await z.file(Object.keys(z.files).find((n) => /charts.chart\d+\.xml$/.test(n))).async('string');
assert.ok(x.includes('<s:stat kind="treemap" range="A1:B4"/>'), 'semnul nostru');
assert.ok(x.includes('<c:barDir val="bar"/>'), 'în alte programe: bare');
assert.equal((await readXlsx(bytes)).sheets[0].charts[0].type, 'treemap', 'citit înapoi');
console.log('hartă de suprafețe: toate verificările trec');
