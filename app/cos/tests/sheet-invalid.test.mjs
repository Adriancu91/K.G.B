// Test pentru „Încercuiește datele nevalide” din Sheets: celulele care nu respectă lista, regula pe numere sau codurile.
// Rulare (în suite/): node tests/sheet-invalid.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-invalid-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/lists.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { invalidCells, setList } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let lists = setList([], 'B2:B6', ['Da', 'Nu']);
lists = setList(lists, 'C2:C6', [], undefined, { rule: { type: 'whole', op: 'between', a: 1, b: 10 } });
lists = setList(lists, 'D2:D6', [], 'cnp');
lists = setList(lists, 'E2:E6', [], undefined, { prompt: { text: 'doar mesaj' } });
const cells = { B2: 'da', B3: 'Poate', B4: '', C2: '5', C3: '11', C4: '2,5', C5: '=2*3', C6: '=20', D2: '1800101221144', D3: '1234567890123', E2: 'orice', F2: 'x' };
const shown = (id) => ({ C5: '6', C6: '20' }[id] ?? cells[id] ?? '');
assert.deepEqual(invalidCells(lists, cells, shown).sort(), ['B3', 'C3', 'C4', 'C6', 'D3']);
assert.deepEqual(invalidCells([], cells, shown), []);
assert.deepEqual(invalidCells(undefined, cells, shown), []);
console.log('datele nevalide: toate verificările trec');
