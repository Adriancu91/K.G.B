// Test: Sheets → 📄 Pagini: unde începe singură o pagină nouă la tipărire (rânduri și coloane).
// Rulare (în suite/): node tests/sheets-autobreaks.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-autobreaks-${process.pid}`);
await build({ entryPoints: ['src/sheets/print.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { autoBreaks } = await import(pathToFileURL(join(dir, 'print.js')).href);
rmSync(dir, { recursive: true, force: true });

const rows = Array.from({ length: 200 }, (_, i) => i);
const h = () => 24;
// A4 pe înalt, margini obișnuite (1,2 cm): (297 − 24) mm ≈ 1031 px utili; capul (24 px) se repetă → 42 de rânduri pe prima pagină, 41 pe următoarele.
let b = autoBreaks(rows, h, [100, 100, 100], 0, undefined);
assert.equal(b.rows[0], 42, 'prima pagină: 42 de rânduri ' + b.rows.slice(0, 3));
assert.equal(b.rows[1] - b.rows[0], 41, 'paginile următoare: capul repetat ia un rând');
assert.deepEqual(b.cols, [], 'pe lățime încape');
// Sfârșit de pagină pe coloane pus de mână: zona începe la coloana B (c0 = 1), pagina nouă începe cu coloana D (3).
b = autoBreaks(rows, h, [100, 100, 100, 100], 1, { colBreaks: [3] });
assert.deepEqual(b.cols, [3], 'pagina alăturată începe cu coloana D');
b = autoBreaks(rows, h, [100, 100, 100, 100], 1, { colBreaks: [1, 9] });
assert.deepEqual(b.cols, [], 'sfârșitul pe prima coloană a zonei sau în afara ei nu contează');
// Fără capul repetat: câte 42 pe fiecare pagină.
b = autoBreaks(rows, h, [100], 0, { head: false });
assert.equal(b.rows[1] - b.rows[0], 42);
// Pe lung (peisaj): mai puține rânduri pe pagină.
assert.ok(autoBreaks(rows, h, [100], 0, { landscape: true }).rows[0] < 42, 'peisaj');
// Un sfârșit pus de mână la rândul 10: numărătoarea o ia de la capăt de acolo.
b = autoBreaks(rows, h, [100], 0, { breaks: [10], head: false });
assert.equal(b.rows[0], 52, 'după sfârșitul de mână: 10 + 42');
// Antet și subsol iau loc.
assert.ok(autoBreaks(rows, h, [100], 0, { header: 'Raport', numbers: true }).rows[0] < 42, 'antetul și numerele de pagină');
// Coloane late, fără potrivire pe lățime: pagina se rupe și pe orizontală (≈ 703 px utili pe A4).
b = autoBreaks(rows.slice(0, 5), h, [300, 300, 300, 300], 2, { fit: false });
assert.deepEqual(b.cols, [4], 'coloana E (2 + 2) începe pagina a doua');
// Cu potrivire pe lățime, încape tot.
assert.deepEqual(autoBreaks(rows.slice(0, 5), h, [300, 300, 300, 300], 2, { fit: true }).cols, []);
console.log('sfârșiturile automate de pagină: toate verificările trec');
