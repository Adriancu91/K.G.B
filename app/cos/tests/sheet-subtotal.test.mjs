// Test pentru Date → Subtotal din Sheets: rânduri de total pe grupuri, Total general fără dublare, Elimină tot.
// Rulare (în suite/): node tests/sheet-subtotal.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-subtotal-${process.pid}`);
await build({ entryPoints: ['src/sheets/subtotal.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { addSubtotals, removeSubtotals, subtotalRows } = await import(pathToFileURL(join(dir, 'subtotal.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(dir, 'formula.js')).href);
rmSync(dir, { recursive: true, force: true });

let n = 0;
const eq = (a, b, msg) => { n++; assert.deepEqual(a, b, msg); };
const cells0 = { A1: 'Oraș', B1: 'Sumă', C1: 'Buc', A2: 'Cluj', B2: '10', C2: '1', A3: 'cluj ', B3: '20', C3: '2', A4: 'Iași', B4: '5', C4: '3', E1: '=SUM(B2:B4)', A6: 'sub tabel' };
const sheets = [{ name: 'Foaia1', cells: cells0, styles: { B2: { i: true } }, colW: {} }];
const g = { r0: 0, r1: 3, c0: 0, c1: 2 };
const textOf = (r, c) => cells0[String.fromCharCode(65 + c) + (r + 1)] ?? '';
const out = addSubtotals(sheets, 0, g, { groupCol: 0, fn: 9, cols: [1, 2] }, textOf);
const s = out.sheets[0];
eq(out.groups, 2, 'două grupuri (Cluj fără să conteze literele mari și spațiile)');
eq([s.cells.A4, s.cells.B4, s.cells.C4], ['Total Cluj', '=SUBTOTAL(9;B2:B3)', '=SUBTOTAL(9;C2:C3)'], 'rândul Total Cluj');
eq([s.cells.A5, s.cells.A6, s.cells.B6], ['Iași', 'Total Iași', '=SUBTOTAL(9;B5:B5)'], 'rândul Total Iași');
eq([s.cells.A7, s.cells.B7], ['Total general', '=SUBTOTAL(9;B2:B6)'], 'Total general');
eq(s.cells.A9, 'sub tabel', 'ce era sub tabel coboară');
eq(s.cells.E1, '=SUM(B2:B5)', 'formula de lângă se lărgește cu rândurile inserate în ea, ca în Excel');
eq([s.styles.A4?.b, s.styles.B7?.b, s.styles.B2], [true, true, { i: true }], 'totalurile îngroșate, restul formatării rămâne');
eq(out.last, 6, 'ultimul rând');
const res = evaluateAll(s.cells);
eq([res.B4.value, res.B6.value, res.B7.value, res.C7.value], [30, 5, 35, 6], 'Total general nu adună subtotalurile de două ori');
// Medie.
const avg = addSubtotals(sheets, 0, g, { groupCol: 0, fn: 1, cols: [1] }, textOf).sheets[0];
eq(evaluateAll(avg.cells).B7.value, 35 / 3, 'media generală');
// Elimină tot: înapoi la tabelul inițial.
eq(subtotalRows(s, { r0: 0, r1: 6, c0: 0, c1: 2 }), [3, 5, 6], 'rândurile cu SUBTOTAL');
const back = removeSubtotals(out.sheets, 0, { r0: 0, r1: 6, c0: 0, c1: 2 });
eq(back.removed, 3, 'trei rânduri scoase');
eq(back.sheets[0].cells, cells0, 'Elimină tot readuce tabelul');
// Tabel fără rânduri de date.
eq(addSubtotals(sheets, 0, { r0: 0, r1: 0, c0: 0, c1: 2 }, { groupCol: 0, fn: 9, cols: [1] }, textOf).groups, 0, 'fără date');

console.log(`sheet-subtotal: ${n} verificări trecute`);
