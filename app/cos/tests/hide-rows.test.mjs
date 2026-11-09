// Test pentru rândurile și coloanele ascunse din Sheets: păstrate la export/import .xlsx, mutate la inserarea rândurilor, curățate la citire.
// Rulare (în suite/): node tests/hide-rows.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-hide-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/insert.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const imp = (n) => import(pathToFileURL(join(dir, n + '.js')).href);
const { readXlsx, writeXlsx } = await imp('xlsx');
const { insertDelete } = await imp('insert');
const { parseSheetDoc } = await imp('format');
rmSync(dir, { recursive: true, force: true });

const sheet = { name: 'Foaia 1', cells: { A1: 'a', A2: 'b', A3: 'c', A5: 'e' }, styles: {}, colW: { E: 150 }, hideRows: [2, 4, 9], hideCols: [2, 5] };
const bytes = await writeXlsx([{ sheet, results: {} }]);
const back = await readXlsx(bytes);
assert.deepEqual(back.sheets[0].hideRows, [2, 4, 9]);
assert.equal(back.sheets[0].cells.A2, 'b');
assert.deepEqual(back.sheets[0].hideCols, [2, 5]);
// Coloana E ascunsă își păstrează lățimea.
assert.equal(back.sheets[0].colW.E, 150);
let c = insertDelete([sheet], 0, 'c', 0, 1)[0];
assert.deepEqual(c.hideCols, [3, 6]);
c = insertDelete([sheet], 0, 'c', 1, -1)[0];
assert.deepEqual(c.hideCols, [4]);
// Inserez 2 rânduri deasupra rândului 3: 4 → 6, 9 → 11, 2 rămâne; ștergerea rândului 2 îl scoate din listă.
let s = insertDelete([sheet], 0, 'r', 2, 2)[0];
assert.deepEqual(s.hideRows, [2, 6, 11]);
s = insertDelete([sheet], 0, 'r', 1, -1)[0];
assert.deepEqual(s.hideRows, [3, 8]);
// Fișierul Suite: valorile greșite se aruncă.
const doc = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, title: '', sheets: [{ ...sheet, hideRows: [5, 'x', 0, 5, 3, 2.5], hideCols: [3, 20000, 1] }] }));
assert.deepEqual(doc.sheets[0].hideRows, [3, 5]);
assert.deepEqual(doc.sheets[0].hideCols, [1, 3]);
console.log('rânduri și coloane ascunse: toate verificările trec');
