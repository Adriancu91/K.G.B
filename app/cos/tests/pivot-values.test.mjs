// Rezumat (pivot) → mai multe valori (src/sheets/pivot.ts, câmpul more): fiecare valoare în coloana ei, cu totalul ei și formatul ei.
// Rulare (în suite/): node tests/pivot-values.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-pivval-${process.pid}`);
await build({ entryPoints: ['src/sheets/pivot.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { buildPivot } = await import(pathToFileURL(join(out, 'pivot.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
rmSync(out, { recursive: true, force: true });

const src = { name: 'Vânzări', cells: { A1: 'Oraș', B1: 'Bucăți', C1: 'Suma', A2: 'Cluj', B2: '2', C2: '10', A3: 'Iași', B3: '4', C3: '5',
  A4: 'Cluj', B4: '6', C4: '7' }, styles: { C2: { fmt: 'lei', dec: 2 } } };
const range = { r0: 0, c0: 0, r1: 3, c1: 2 };
const make = (extra) => buildPivot(src, {}, { range, rowCol: 0, valCol: 2, op: 'sum', ...extra }, 'Rezumat');
const calc = (pv) => evaluateAll(pv.sheet.cells, { self: 'Rezumat', sheets: [src, pv.sheet] });

// Rândurile 5–6 = Cluj, Iași; B = Sumă din Suma, C = Medie din Bucăți, D = Număr; rândul 7 = Total.
let pv = make({ more: [{ valCol: 1, op: 'avg' }, { valCol: 1, op: 'count' }, { valCol: 1, op: 'max' }] });
let r = calc(pv);
assert.equal(pv.sheet.cells.B4, 'Sumă din Suma');
assert.equal(pv.sheet.cells.C4, 'Medie din Bucăți');
assert.equal(pv.sheet.cells.D4, 'Număr din Bucăți');
assert.equal(pv.sheet.cells.E4, 'Maxim din Bucăți');
assert.equal(r.B5.text + ' ' + r.B6.text + ' ' + r.B7.text, '17 5 22', 'sumele și totalul');
assert.equal(r.C5.text + ' ' + r.C6.text + ' ' + r.C7.text, '4 4 4', 'mediile; totalul = media tuturor');
assert.equal(r.D5.text + ' ' + r.D6.text + ' ' + r.D7.text, '2 1 3', 'numărul rândurilor');
assert.equal(r.E5.text + ' ' + r.E7.text, '6 6', 'maximul');
assert.equal(pv.sheet.styles.B5?.fmt, 'lei', 'prima valoare are formatul coloanei ei');
assert.equal(pv.sheet.styles.C5, undefined, 'Bucăți n-au format');
assert.equal(pv.pivot.target, 'A4:E7');
assert.equal(pv.pivot.data.length, 4, 'GETPIVOTDATA știe toate valorile');
assert.ok(pv.sheet.cells.A1.startsWith('Rezumat pe „Oraș”: Sumă din „Suma”, Medie din „Bucăți”'), pv.sheet.cells.A1);
assert.equal(pv.sheet.colW.E, 130);

// GETPIVOTDATA pe a doua valoare.
const withGpd = { ...pv.sheet.cells, H1: '=GETPIVOTDATA("Medie din Bucăți";A4;"Oraș";"Cluj")' };
assert.equal(evaluateAll(withGpd, { self: 'Rezumat', sheets: [src, { ...pv.sheet, cells: withGpd }], pivots: [pv.pivot] }).H1.text, '4', 'GETPIVOTDATA pe valoarea a doua');

// Fără rândul Total.
pv = make({ more: [{ valCol: 1, op: 'sum' }], totals: 'none' });
assert.equal(pv.sheet.cells.A7, undefined);
assert.equal(pv.sheet.cells.C7, undefined);
assert.equal(pv.pivot.target, 'A4:C6');

// Cu grupare pe coloane valorile în plus se pun (câte o coloană pe valoare în fiecare categorie); cu procente nu.
pv = make({ colCol: 1, more: [{ valCol: 1, op: 'avg' }] });
assert.equal(pv.pivot.data.length, 2, 'cu coloane: ambele valori');
pv = make({ show: 'pctTotal', more: [{ valCol: 1, op: 'avg' }] });
assert.equal(pv.sheet.cells.C4, undefined, 'cu procente: o singură valoare');

// Fără „more”: la fel ca înainte.
pv = make({});
assert.equal(pv.sheet.cells.A1, 'Sumă din „Suma” pe „Oraș”');
assert.equal(pv.pivot.target, 'A4:B7');
console.log('pivot-values: toate verificările au trecut');
