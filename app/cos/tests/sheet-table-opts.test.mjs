// Test pentru „▤ Tabel…” din Sheets: culorile și părțile tabelului (cap, benzi pe rânduri / coloane, prima / ultima coloană, total).
// Rulare (în suite/): node tests/sheet-table-opts.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-tblopts-${process.pid}`);
await build({ entryPoints: ['src/sheets/table.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { formatAsTable, TABLE_THEMES, DEFAULT_TABLE_OPTS } = await import(pathToFileURL(join(dir, 'table.js')).href);
rmSync(dir, { recursive: true, force: true });

const cells = { A1: 'Nume', B1: 'Oraș', C1: 'Suma', A2: 'Ana', B2: 'Iași', C2: '10', A3: 'Dan', B3: 'Cluj', C3: '20', A4: 'Ion', B4: 'Arad', C4: '30' };
const g = { r0: 0, c0: 0, r1: 3, c1: 2 };
assert.ok(Object.keys(TABLE_THEMES).length >= 21, '8 culori deschise, 6 intense și 7 întunecate (plus cele cu chenar și grilă, adăugate apoi)');
// Stilul intens: capul închis cu litere albe; trecut înapoi la unul deschis, albul dispare (culoarea pusă de om rămâne).
const dk = formatAsTable(cells, {}, {}, g, 'blueDark');
assert.equal(dk.styles.A1.bg, TABLE_THEMES.blueDark.head);
assert.equal(dk.styles.A1.color, '#ffffff');
assert.equal(dk.styles.A2.color, undefined, 'rândurile de date rămân cu literele lor');
const back = formatAsTable(cells, dk.styles, {}, g, 'blue');
assert.equal(back.styles.A1.color, undefined, 'înapoi la albastru deschis: fără litere albe');
assert.equal(formatAsTable(cells, { A1: { color: '#c00000' } }, {}, g, 'blue').styles.A1.color, '#c00000');

// Felul obișnuit: cap, rânduri alternate, total cu SUBTOTAL pe coloana de numere.
const a = formatAsTable(cells, {}, {}, g, 'teal');
assert.equal(a.styles.A1.bg, TABLE_THEMES.teal.head);
assert.equal(a.styles.A1.b, true);
assert.equal(a.styles.A2.bg, undefined);
assert.equal(a.styles.A3.bg, TABLE_THEMES.teal.band, 'al doilea rând de date are bandă');
assert.equal(a.totalRow, 5);
assert.equal(a.cells.C6, '=SUBTOTAL(9;C2:C4)');

// Coloane alternate, fără rânduri alternate; prima și ultima coloană aldine; fără total.
const b = formatAsTable(cells, {}, {}, g, 'red', { ...DEFAULT_TABLE_OPTS, bandRows: false, bandCols: true, firstCol: true, lastCol: true, total: false });
assert.equal(b.styles.A2.bg, undefined);
assert.equal(b.styles.B2.bg, TABLE_THEMES.red.band, 'coloana B are bandă');
assert.equal(b.styles.B3.bg, TABLE_THEMES.red.band);
assert.equal(b.styles.C3.bg, undefined);
assert.equal(b.styles.A3.b, true, 'prima coloană aldină');
assert.equal(b.styles.C4.b, true, 'ultima coloană aldină');
assert.equal(b.styles.B4.b, undefined);
assert.equal(b.totalRow, null, 'fără total');

// Fără cap: primul rând e de date (fără culoarea capului), benzile încep de la el, totalul adună de la rândul 1.
const nums = { A1: 'x', B1: '1', A2: 'y', B2: '2', A3: 'z', B3: '3' };
const c = formatAsTable(nums, {}, {}, { r0: 0, c0: 0, r1: 2, c1: 1 }, 'blue', { ...DEFAULT_TABLE_OPTS, head: false });
assert.equal(c.styles.A1.bg, undefined);
assert.equal(c.styles.A1.b, undefined);
assert.equal(c.styles.A2.bg, TABLE_THEMES.blue.band);
assert.equal(c.cells.B5, '=SUBTOTAL(9;B1:B3)');

// Aplicat din nou fără benzi: culorile vechi ale benzilor se scot.
const again = formatAsTable(cells, a.styles, {}, g, 'teal', { ...DEFAULT_TABLE_OPTS, bandRows: false, total: false });
assert.equal(again.styles.A3.bg, undefined);
console.log('OK: opțiunile tabelului (culori, cap, benzi, coloane aldine, total) merg');
