// Test pentru Manager de scenarii din Sheets: lista de celule, curățarea din fișier, rezumatul cu rezultate.
// Rulare (în suite/): node tests/sheets-scenario.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-scenario-${process.pid}`);
await build({ entryPoints: ['src/sheets/scenario.ts', 'src/sheets/formula.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { parseCellList, cleanScenarios, scenarioSummary, MAX_SC_CELLS } = await import(pathToFileURL(join(dir, 'scenario.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(dir, 'formula.js')).href);
const { parseSheetDoc, serializeSheetDoc, emptySheetDoc } = await import(pathToFileURL(join(dir, 'format.js')).href);
rmSync(dir, { recursive: true, force: true });
let n = 0;
const eq = (a, b, m) => { n++; assert.deepEqual(a, b, m); };

eq(parseCellList('b1:b3', 1000, 100), ['B1', 'B2', 'B3'], 'zonă');
eq(parseCellList('$B$1; C2, b1', 1000, 100), ['B1', 'C2'], 'listă fără dubluri');
eq(parseCellList('AA10:AB11', 1000, 100), ['AA10', 'AB10', 'AA11', 'AB11'], 'coloane cu două litere');
n++; assert.match(parseCellList('', 1000, 100), /Scrie/);
n++; assert.match(parseCellList('B1:Q9', 1000, 100), new RegExp('cel mult ' + MAX_SC_CELLS));
n++; assert.match(parseCellList('xyz', 1000, 100), /nu e o celulă/);
n++; assert.match(parseCellList('ZZ1', 1000, 100), /iese din foaie/);

eq(cleanScenarios([{ name: ' Bun ', cells: { B1: '10', x: '1', C1: 5 } }, { name: '', cells: { B1: '1' } }, { name: 'Gol', cells: {} }, 7]),
  [{ name: 'Bun', cells: { B1: '10' } }], 'curățare');

// Rezumatul: profit = preț × cantitate − cost.
const cells = { B1: '10', B2: '100', B3: '500', B4: '=B1*B2-B3' };
const list = [{ name: 'Optimist', cells: { B1: '12', B2: '150' } }, { name: 'Pesimist', cells: { B1: '8', B2: '80', B3: '600' } }];
const res = (over, id) => evaluateAll({ ...cells, ...over }, undefined, undefined, [id])[id].text;
const rows = scenarioSummary(list, (id) => cells[id] ?? '', ['B4'], res);
eq(rows[0], ['Rezumat scenarii', 'Valori actuale', 'Optimist', 'Pesimist'], 'antet');
eq(rows.slice(2, 5), [['B1', '10', '12', '8'], ['B2', '100', '150', '80'], ['B3', '500', '500', '600']], 'celule schimbate');
eq(rows.at(-1), ['B4', '500', '1300', '40'], 'rezultatul fiecărui scenariu');

// Se păstrează în fișierul .ssheet.
const d = emptySheetDoc();
d.sheets[0].scenarios = list;
const back = parseSheetDoc(serializeSheetDoc(d));
eq(back.sheets[0].scenarios, list, 'în fișier');
console.log(`OK: ${n} verificări pentru Manager de scenarii`);
