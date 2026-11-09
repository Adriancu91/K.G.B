// Test pentru GROUPBY în Sheets: grupuri, funcții date prin nume (SUM, COUNT, PERCENTOF) sau LAMBDA, antete, totaluri,
// subtotaluri, sortare, filtru și scrierea în .xlsx (_xleta.SUM).
// Rulare (în suite/): node tests/formula-groupby.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-groupby-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { evaluateAll } from './src/sheets/formula.ts'; export { toExcelFormula, fromExcelFormula } from './src/sheets/xlsx.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { evaluateAll, toExcelFormula, fromExcelFormula } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

// Vânzări: Zonă, Produs, Sumă (cu antet).
const base = {
  A1: 'Zonă', B1: 'Produs', C1: 'Sumă',
  A2: 'Nord', B2: 'Mere', C2: '10',
  A3: 'Sud', B3: 'Pere', C3: '20',
  A4: 'Nord', B4: 'Pere', C4: '5',
  A5: 'Est', B5: 'Mere', C5: '7',
  A6: 'Sud', B6: 'Mere', C6: '3',
  A7: 'Nord', B7: 'Mere', C7: '1',
};
const COLS = ['Z', 'AA', 'AB', 'AC', 'AD'];
const table = (f, extra = {}) => {
  const r = evaluateAll({ ...base, ...extra, Z20: f });
  const rows = [];
  for (let i = 20; i < 40; i++) {
    const row = COLS.map((c) => { const x = r[c + i]; return x ? (x.err ?? (x.num ? x.value : x.text)) : undefined; });
    if (row.every((x) => x === undefined || x === '')) break;
    rows.push(row.filter((x, j) => j < row.findLastIndex((y) => y !== undefined) + 1));
  }
  return rows;
};

// Antetul se ghicește (text deasupra numerelor) și nu se arată; total general la final; sortat după zonă.
assert.deepEqual(table('=GROUPBY(A1:A7;C1:C7;SUM)'), [['Est', 7], ['Nord', 16], ['Sud', 23], ['Total', 46]]);
// Cu antetele arătate (3), fără total (0), descrescător după sumă (-2).
assert.deepEqual(table('=GROUPBY(A1:A7;C1:C7;SUM;3;0;-2)'), [['Zonă', 'Sumă'], ['Sud', 23], ['Nord', 16], ['Est', 7]]);
// LAMBDA în loc de nume, numele românesc și COUNT.
assert.deepEqual(table('=GROUPBY(A2:A7;C2:C7;LAMBDA(x;MAX(x));0;0)'), [['Est', 7], ['Nord', 10], ['Sud', 20]]);
assert.deepEqual(table('=GROUPBY(A2:A7;C2:C7;SUMA;0;0)'), [['Est', 7], ['Nord', 16], ['Sud', 23]]);
assert.deepEqual(table('=GROUPBY(A2:A7;C2:C7;COUNT;0;0)'), [['Est', 1], ['Nord', 3], ['Sud', 2]]);
// Două chei, cu subtotaluri pe prima.
assert.deepEqual(table('=GROUPBY(A2:B7;C2:C7;SUM;0;2)'), [
  ['Est', 'Mere', 7], ['Est', '', 7],
  ['Nord', 'Mere', 11], ['Nord', 'Pere', 5], ['Nord', '', 16],
  ['Sud', 'Mere', 3], ['Sud', 'Pere', 20], ['Sud', '', 23],
  ['Total', '', 46]]);
// Totalul sus (-1) și filtrul (doar Mere).
assert.deepEqual(table('=GROUPBY(A2:A7;C2:C7;SUM;0;-1;;B2:B7="Mere")'), [['Total', 21], ['Est', 7], ['Nord', 11], ['Sud', 3]]);
// PERCENTOF: partea fiecărui grup din total.
const p = table('=GROUPBY(A2:A7;C2:C7;PERCENTOF;0;0)');
assert.deepEqual(p.map((r) => r[0]), ['Est', 'Nord', 'Sud']);
assert.ok(Math.abs(p[2][1] - 23 / 46) < 1e-12);
// Greșeli: zone de mărimi diferite, funcție necunoscută.
assert.deepEqual(table('=GROUPBY(A2:A7;C2:C6;SUM)'), [['#VALUE!']]);
assert.deepEqual(table('=GROUPBY(A2:A7;C2:C7;NIMIC)'), [['#VALUE!']]);
// În .xlsx funcția dată prin nume e „_xleta.SUM”, iar la citire prefixul dispare.
assert.equal(toExcelFormula('=GROUPBY(A2:A7;C2:C7;SUM;0;0)'), '_xlfn.GROUPBY(A2:A7,C2:C7,_xleta.SUM,0,0)');
assert.equal(toExcelFormula('=SUM(A1:A3)'), 'SUM(A1:A3)');
assert.equal(fromExcelFormula('_xlfn.GROUPBY(A2:A7,C2:C7,_xleta.SUM)'), '=GROUPBY(A2:A7,C2:C7,SUM)');
// PIVOTBY: zonele pe rânduri, produsele pe coloane, cu totaluri.
assert.deepEqual(table('=PIVOTBY(A2:A7;B2:B7;C2:C7;SUM;0)'), [
  ['', 'Mere', 'Pere', 'Total'],
  ['Est', 7, '', 7],
  ['Nord', 11, 5, 16],
  ['Sud', 3, 20, 23],
  ['Total', 21, 25, 46]]);
// Cu antetele arătate, fără totaluri, rândurile descrescător și coloanele descrescător.
assert.deepEqual(table('=PIVOTBY(A1:A7;B1:B7;C1:C7;COUNT;3;0;-1;0;-1)'), [
  ['Zonă', 'Pere', 'Mere'],
  ['Sud', 1, 1],
  ['Nord', 1, 2],
  ['Est', '', 1]]);
// Totalurile sus / în stânga și filtrul.
assert.deepEqual(table('=PIVOTBY(A2:A7;B2:B7;C2:C7;SUM;0;-1;;-1;;A2:A7<>"Est")'), [
  ['', 'Total', 'Mere', 'Pere'],
  ['Total', 39, 14, 25],
  ['Nord', 16, 11, 5],
  ['Sud', 23, 3, 20]]);
assert.equal(toExcelFormula('=PIVOTBY(A2:A7;B2:B7;C2:C7;SUM)'), '_xlfn.PIVOTBY(A2:A7,B2:B7,C2:C7,_xleta.SUM)');
console.log('GROUPBY și PIVOTBY: toate verificările trec');
