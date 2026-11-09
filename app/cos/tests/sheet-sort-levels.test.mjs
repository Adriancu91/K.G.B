// Test pentru sortarea pe mai multe niveluri în Sheets (fereastra Sortare).
// Rulare (în suite/): node tests/sheet-sort-levels.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-sortl-${process.pid}`);
await build({ entryPoints: ['src/sheets/sort.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { sortRangeBy, sortRange } = await import(pathToFileURL(join(dir, 'sort.js')).href);
rmSync(dir, { recursive: true, force: true });

// Oraș | Sumă | Nume, rândurile 1–6 (fără cap).
const rows = [['Iași', '50', 'Ana'], ['Cluj', '20', 'Dan'], ['Iași', '90', 'Ion'], ['Arad', '70', 'Eva'], ['Cluj', '80', 'Gil'], ['Iași', '50', 'Bob']];
const cells = {};
rows.forEach((r, i) => r.forEach((v, c) => { cells['ABC'[c] + (i + 1)] = v; }));
cells.D1 = '=B1*2';
const styles = { C3: { b: true } };
const g = { r0: 0, c0: 0, r1: 5, c1: 3 };
const names = (out) => [1, 2, 3, 4, 5, 6].map((r) => out.cells['C' + r]);
// Oraș A→Z, apoi Sumă Z→A; la egalitate (Iași 50) rămâne ordinea veche (Ana înaintea lui Bob).
let out = sortRangeBy(cells, styles, {}, g, [{ col: 0, desc: false }, { col: 1, desc: true }]);
assert.deepEqual(names(out), ['Eva', 'Gil', 'Dan', 'Ion', 'Ana', 'Bob']);
// Formatarea și formulele merg cu rândul (Ion era aldin; =B1*2 al Anei devine =B5*2 pe rândul 5).
assert.deepEqual(out.styles.C4, { b: true });
assert.equal(out.styles.C3, undefined);
assert.equal(out.cells.D5, '=B5*2');
// Trei niveluri: Sumă A→Z, apoi Nume Z→A.
out = sortRangeBy(cells, styles, {}, g, [{ col: 1, desc: false }, { col: 2, desc: true }]);
assert.deepEqual(names(out), ['Dan', 'Bob', 'Ana', 'Eva', 'Gil', 'Ion']);
// Un singur nivel dă același rezultat ca sortarea veche.
assert.deepEqual(sortRangeBy(cells, styles, {}, g, [{ col: 1, desc: true }]), sortRange(cells, styles, {}, g, 1, true));
console.log('sortarea pe niveluri: toate verificările trec');
