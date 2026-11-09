// Test pentru filtrele cu condiție din Sheets (mai mare decât, între, conține, primele N, peste medie), împreună cu bifele.
// Rulare (în suite/): node tests/sheet-filter-cond.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-fcond-${process.pid}`);
await build({ entryPoints: ['src/sheets/filter.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { hiddenRows, columnValues } = await import(pathToFileURL(join(dir, 'filter.js')).href);
const { parseSheetDoc } = await import(pathToFileURL(join(dir, 'format.js')).href);
rmSync(dir, { recursive: true, force: true });

// Cap pe rândul 1: Nume | Sumă; rândurile 2–7.
const cells = { A1: 'Nume', B1: 'Sumă', A2: 'Ana', B2: '500', A3: 'Bogdan', B3: '1500', A4: 'Ștefan', B4: '2500', A5: 'Dana', B5: '800', A6: 'Ion', B6: '1200', A7: 'Stela', B7: '=B2*2' };
const results = { B7: { value: 1000, num: true, text: '1000' } };
const f = (cond, hidden = {}) => ({ r: 0, c0: 0, c1: 1, hidden, cond });
const shown = (filter) => { const h = hiddenRows(cells, results, {}, filter); return [2, 3, 4, 5, 6, 7].filter((r) => !h.has(r - 1)).map((r) => cells['A' + r]); };
assert.deepEqual(shown(f({ B: { op: 'gt', v1: '1000' } })), ['Bogdan', 'Ștefan', 'Ion']);
assert.deepEqual(shown(f({ B: { op: 'ge', v1: '1000' } })), ['Bogdan', 'Ștefan', 'Ion', 'Stela']); // rezultatul formulei contează
assert.deepEqual(shown(f({ B: { op: 'between', v1: '700', v2: '1300' } })), ['Dana', 'Ion', 'Stela']);
assert.deepEqual(shown(f({ A: { op: 'text', v1: 'stef' } })), ['Ștefan']); // fără diacritice
assert.deepEqual(shown(f({ B: { op: 'top', v1: '2' } })), ['Bogdan', 'Ștefan']);
assert.deepEqual(shown(f({ B: { op: 'below', v1: '' } })), ['Ana', 'Dana', 'Ion', 'Stela']); // media 1250
// Condiția și bifele altei coloane se adună.
assert.deepEqual(shown(f({ B: { op: 'gt', v1: '1000' } }, { A: ['Ion'] })), ['Bogdan', 'Ștefan']);
// Lista de bifat a coloanei A arată doar ce lasă condiția de pe B.
assert.deepEqual(columnValues(cells, results, {}, f({ B: { op: 'top', v1: '1' } }), 0).map((v) => v.text), ['Ștefan']);
// Fișierul Suite: condițiile greșite se aruncă.
const doc = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, title: '', sheets: [{ name: 'F', cells, styles: {}, colW: {},
  filter: { r: 0, c0: 0, c1: 1, hidden: {}, cond: { B: { op: 'gt', v1: '5' }, A: { op: 'rău', v1: 'x' }, b: { op: 'gt', v1: '1' } } } }] }));
assert.deepEqual(doc.sheets[0].filter.cond, { B: { op: 'gt', v1: '5' } });
console.log('filtrele cu condiție: toate verificările trec');
