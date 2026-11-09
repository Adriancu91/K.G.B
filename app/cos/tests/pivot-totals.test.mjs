// Rezumat (pivot) → Totaluri generale (src/sheets/pivot.ts, câmpul totals): rândul Total de jos și coloana Total din dreapta, puse sau nu.
// Rulare (în suite/): node tests/pivot-totals.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-pivtot-${process.pid}`);
await build({ entryPoints: ['src/sheets/pivot.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { buildPivot } = await import(pathToFileURL(join(out, 'pivot.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
rmSync(out, { recursive: true, force: true });

const src = { name: 'Vânzări', cells: { A1: 'Oraș', B1: 'Lună', C1: 'Suma', A2: 'Cluj', B2: 'ian', C2: '10', A3: 'Iași', B3: 'ian', C3: '5',
  A4: 'Cluj', B4: 'feb', C4: '7' }, styles: {} };
const range = { r0: 0, c0: 0, r1: 3, c1: 2 };
const make = (extra) => buildPivot(src, {}, { range, rowCol: 0, colCol: 1, valCol: 2, op: 'sum', ...extra }, 'Rezumat');
const calc = (pv) => evaluateAll(pv.sheet.cells, { self: 'Rezumat', sheets: [src, pv.sheet] });
// Rândurile 5–6 = Cluj, Iași; coloanele B–C = feb, ian (în ordinea lor); D = Total; rândul 7 = Total.
let pv = make({});
let r = calc(pv);
assert.equal(pv.sheet.cells.D4, 'Total');
assert.equal(pv.sheet.cells.A7, 'Total');
assert.equal(r.D7.text, '22', 'totalul general');
assert.equal(pv.pivot.target, 'A4:D7');

pv = make({ totals: 'none' });
assert.equal(pv.sheet.cells.D4, undefined, 'fără coloana Total');
assert.equal(pv.sheet.cells.A7, undefined, 'fără rândul Total');
assert.equal(Object.keys(pv.sheet.cells).some((k) => /^D/.test(k)), false, 'nimic în coloana D');
assert.equal(pv.pivot.target, 'A4:C6');
assert.equal(pv.sheet.colW.D, undefined, 'coloana D rămâne îngustă');

pv = make({ totals: 'rows' });
r = calc(pv);
assert.equal(pv.sheet.cells.D4, 'Total', 'coloana Total din dreapta');
assert.equal(r.D5.text, '17', 'totalul rândului Cluj');
assert.equal(pv.sheet.cells.A7, undefined, 'fără rândul de jos');
assert.equal(pv.pivot.target, 'A4:D6');

pv = make({ totals: 'cols' });
r = calc(pv);
assert.equal(pv.sheet.cells.D4, undefined, 'fără coloana din dreapta');
assert.equal(pv.sheet.cells.A7, 'Total', 'rândul Total de jos');
assert.equal(r.B7.text + ' ' + r.C7.text, '7 15', 'totalurile coloanelor');
assert.equal(pv.sheet.cells.D7, undefined, 'fără colțul din dreapta jos');
assert.equal(pv.pivot.target, 'A4:C7');

// Fără grupare pe coloane: doar rândul Total contează.
pv = buildPivot(src, {}, { range, rowCol: 0, valCol: 2, op: 'sum', totals: 'none' }, 'Rezumat');
assert.equal(pv.sheet.cells.A7, undefined);
assert.equal(pv.pivot.target, 'A4:B6');
pv = buildPivot(src, {}, { range, rowCol: 0, valCol: 2, op: 'sum' }, 'Rezumat');
assert.equal(calc(pv).B7.text, '22');
console.log('totalurile generale ale rezumatului: toate verificările trec');
