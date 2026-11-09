// Test pentru Umplere → Serie din Sheets: liniară, creștere, date (zile, zile lucrătoare, luni, ani), oprire.
// Rulare (în suite/): node tests/sheet-series.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-series-${process.pid}`);
await build({ entryPoints: ['src/sheets/series.ts', 'src/sheets/numfmt.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { seriesValues } = await import(pathToFileURL(join(dir, 'series.js')).href);
const { dateToSerial, serialToDate } = await import(pathToFileURL(join(dir, 'numfmt.js')).href);
rmSync(dir, { recursive: true, force: true });

const o = (type, step, extra = {}) => ({ type, unit: 'day', step, ...extra });
assert.deepEqual(seriesValues(1, 5, o('linear', 1)), [2, 3, 4, 5]);
assert.deepEqual(seriesValues(5, 4, o('linear', 5)), [10, 15, 20]);
assert.deepEqual(seriesValues(0.1, 4, o('linear', 0.1)), [0.2, 0.3, 0.4]); // fără 0,30000000000000004
assert.deepEqual(seriesValues(10, 5, o('linear', -3)), [7, 4, 1, -2]);
assert.deepEqual(seriesValues(2, 6, o('growth', 2)), [4, 8, 16, 32, 64]);
// Oprire: inclusiv valoarea de oprire, fără să o depășească; în jos la pas negativ.
assert.deepEqual(seriesValues(1, 1000, o('linear', 2, { stop: 9 })), [3, 5, 7, 9]);
assert.deepEqual(seriesValues(10, 1000, o('linear', -4, { stop: 0 })), [6, 2]);
assert.deepEqual(seriesValues(3, 1000, o('growth', 3, { stop: 100 })), [9, 27, 81]);
assert.deepEqual(seriesValues(5, 1000, o('linear', 1, { stop: 2 })), []);
// Date.
const d = (s) => dateToSerial(s);
const show = (vals) => vals.map(serialToDate);
assert.deepEqual(show(seriesValues(d('30.12.2026'), 4, o('date', 1))), ['31.12.2026', '01.01.2027', '02.01.2027']);
// Vineri 16.10.2026 → luni, marți (sare peste weekend).
assert.deepEqual(show(seriesValues(d('16.10.2026'), 3, { type: 'date', unit: 'weekday', step: 1 })), ['19.10.2026', '20.10.2026']);
// 31 ianuarie + luni: ultima zi a lunilor scurte, apoi înapoi la 31.
assert.deepEqual(show(seriesValues(d('31.01.2026'), 4, { type: 'date', unit: 'month', step: 1 })), ['28.02.2026', '31.03.2026', '30.04.2026']);
assert.deepEqual(show(seriesValues(d('29.02.2024'), 3, { type: 'date', unit: 'year', step: 1 })), ['28.02.2025', '28.02.2026']);
assert.deepEqual(show(seriesValues(d('01.01.2026'), 100, { type: 'date', unit: 'month', step: 3, stop: d('31.12.2026') })), ['01.04.2026', '01.07.2026', '01.10.2026']);
// O valoare de oprire uriașă nu blochează.
assert.equal(seriesValues(1, 1e9, o('linear', 1, { stop: 1e12 })).length, 99999);
console.log('seriile: toate verificările trec');
