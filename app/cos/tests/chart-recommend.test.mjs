// Test: Sheets → ★ Recomandate: ce grafice se propun pentru felurile obișnuite de date.
// Rulare (în suite/): node tests/chart-recommend.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-chartrec-${process.pid}`);
await build({ entryPoints: ['src/sheets/chartSvg.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { recommendCharts } = await import(pathToFileURL(join(dir, 'chartSvg.js')).href);
rmSync(dir, { recursive: true, force: true });

const one = (cats, vals) => ({ categories: cats, series: [{ name: 'V', values: vals }] });
assert.deepEqual(recommendCharts(one(['Nord', 'Sud', 'Est'], [5, 3, 2])), ['col', 'pie', 'bar', 'doughnut'], 'puține valori pozitive: coloane, plăcintă');
assert.deepEqual(recommendCharts(one(['Sold', 'Venit', 'Cheltuieli'], [100, 50, -70])).slice(0, 2), ['col', 'waterfall'], 'cu minus: cascadă');
const days = Array.from({ length: 30 }, (_, i) => `zi ${i + 1}`);
assert.equal(recommendCharts(one(days, days.map((_, i) => i * 2)))[0], 'line', 'multe valori: linie');
assert.equal(recommendCharts(one(['1', '2.5', '4'], [3, 5, 9]))[0], 'scatter', 'etichete-numere: puncte X–Y');
const two = { categories: ['ian', 'feb', 'mar'], series: [{ name: 'Vânzări', values: [1000, 1500, 1200] }, { name: 'Marjă', values: [20, 40, 42] }] };
assert.equal(recommendCharts(two)[0], 'combo2', 'mărimi foarte diferite: combinat pe două axe');
const close = { categories: ['ian', 'feb'], series: [{ name: 'A', values: [10, 12] }, { name: 'B', values: [8, 15] }] };
assert.deepEqual(recommendCharts(close), ['col', 'line', 'stack', 'bar'], 'mai multe serii asemănătoare');
assert.equal(recommendCharts({ categories: [], series: [] }).length, 4, 'fără date: tot 4 propuneri');
console.log('graficele recomandate: toate verificările trec');
