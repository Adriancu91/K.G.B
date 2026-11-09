// Test pentru evidențierea pe zonă din Sheets: primele / ultimele N, peste / sub medie, dubluri / unice (și dus-întors .xlsx).
// Rulare (în suite/): node tests/sheet-cond-zone.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-condz-${process.pid}`);
await build({ entryPoints: ['src/sheets/cond.ts', 'src/sheets/xlsx.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { condLooks, describeRule, cleanRules } = await import(pathToFileURL(join(dir, 'cond.js')).href);
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
rmSync(dir, { recursive: true, force: true });

// A1:A8 = 5, 1, 9, 9, 3, 7, (gol), „x”; media numerelor = 34/6 ≈ 5,67.
const cells = { A1: '5', A2: '1', A3: '9', A4: '9', A5: '3', A6: '7', A8: 'x', B1: '100' };
const rule = (op, v1 = '') => ({ range: 'A1:A8', op, v1, look: 'green' });
const ids = (r) => Object.keys(condLooks([r], cells, {})).sort();
assert.deepEqual(ids(rule('top', '2')), ['A3', 'A4']); // 9 și 9
assert.deepEqual(ids(rule('top', '3')), ['A3', 'A4', 'A6']);
assert.deepEqual(ids(rule('bottom', '2')), ['A2', 'A5']);
assert.deepEqual(ids(rule('top', '')), ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']); // implicit 10: toate numerele
assert.deepEqual(ids(rule('above')), ['A3', 'A4', 'A6']);
assert.deepEqual(ids(rule('below')), ['A1', 'A2', 'A5']);
assert.deepEqual(ids(rule('dup')), ['A3', 'A4']);
assert.deepEqual(ids(rule('unique')), ['A1', 'A2', 'A5', 'A6', 'A8']);
// Dublurile de text nu țin cont de diacritice și litere mari; rezultatele formulelor contează.
const t = { C1: 'Mărfuri', C2: 'marfuri', C3: 'Altele', C4: '=1+1', C5: '2' };
const res = { C4: { value: 2, num: true, text: '2' } };
assert.deepEqual(Object.keys(condLooks([{ range: 'C1:C5', op: 'dup', v1: '', look: 'red' }], t, res)).sort(), ['C1', 'C2', 'C4', 'C5']);
assert.equal(describeRule(rule('top', '3')), 'A1:A8: e printre cele mai mari 3 → Verde');
assert.equal(cleanRules([rule('dup'), { range: 'A1:A2', op: 'nimic', v1: '', look: 'red' }]).length, 1);

// Dus-întors .xlsx.
const rules = [rule('top', '3'), rule('bottom', '2'), rule('above'), rule('below'), rule('dup'), rule('unique')];
const back = (await readXlsx(await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {}, rules }, results: {} }]))).sheets[0];
assert.deepEqual(back.rules.map((r) => [r.op, r.v1]), rules.map((r) => [r.op, r.v1]));
console.log('evidențierea pe zonă: toate verificările trec');
