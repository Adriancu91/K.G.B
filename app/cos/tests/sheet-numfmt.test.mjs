// Test pentru formatele de număr noi din Sheets: oră, dată lungă, dată cu oră, științific, fracție (afișare, scriere, .xlsx).
// Rulare (în suite/): node tests/sheet-numfmt.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-numfmt-${process.pid}`);
await build({ entryPoints: ['src/sheets/numfmt.ts', 'src/sheets/xlsx.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { formatValue, parseEntry, fraction, scientific } = await import(pathToFileURL(join(dir, 'numfmt.js')).href);
const { readXlsx, writeXlsx, excelFmtToOurs } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
rmSync(dir, { recursive: true, force: true });

// Afișare.
const d = 46387.5625; // 31.12.2026 13:30
assert.equal(formatValue(d, 'time'), '13:30');
assert.equal(formatValue(d + 15 / 86400, 'time', 1), '13:30:15');
assert.equal(formatValue(0.99999, 'time'), '00:00'); // 23:59:59 rotunjit la minut trece de miezul nopții
assert.equal(formatValue(d, 'datetime'), '31.12.2026 13:30');
assert.equal(formatValue(d, 'datelong'), '31 decembrie 2026');
assert.equal(formatValue(46023, 'datelong'), '1 ianuarie 2026');
assert.equal(scientific(12345, 2), '1,23E+04');
assert.equal(scientific(0.000123, 1), '1,2E-04');
assert.equal(scientific(0, 2), '0,00E+00');
assert.equal(formatValue(12345, 'sci'), '1,23E+04');
assert.equal(fraction(1.25), '1 1/4');
assert.equal(fraction(0.5), '1/2');
assert.equal(fraction(-2.333), '-2 1/3');
assert.equal(fraction(3), '3');
assert.equal(fraction(0.999), '1');
assert.equal(formatValue(0.875, 'fraction'), '7/8');

// Scriere: ora și data cu oră se recunosc.
assert.deepEqual(parseEntry('13:30'), { raw: '0,5625', fmt: 'time' });
assert.deepEqual(parseEntry('8:05:30'), { raw: String(Math.round((8 * 3600 + 5 * 60 + 30) / 86400 * 1e10) / 1e10).replace('.', ','), fmt: 'time', dec: 1 });
assert.deepEqual(parseEntry('31.12.2026 13:30'), { raw: '46387,5625', fmt: 'datetime' });
assert.deepEqual(parseEntry('25:00'), { raw: '25:00' });
assert.deepEqual(parseEntry('12:61'), { raw: '12:61' });
assert.deepEqual(parseEntry('31.02.2026 10:00'), { raw: '31.02.2026 10:00' });

// Codurile Excel.
assert.deepEqual(excelFmtToOurs(20, undefined), { fmt: 'time' });
assert.deepEqual(excelFmtToOurs(21, undefined), { fmt: 'time', dec: 1 });
assert.deepEqual(excelFmtToOurs(22, undefined), { fmt: 'datetime' });
assert.deepEqual(excelFmtToOurs(14, undefined), { fmt: 'date' });
assert.deepEqual(excelFmtToOurs(11, undefined), { fmt: 'sci', dec: 2 });
assert.deepEqual(excelFmtToOurs(12, undefined), { fmt: 'fraction' });
assert.deepEqual(excelFmtToOurs(164, '[h]:mm'), { fmt: 'time' });
assert.deepEqual(excelFmtToOurs(164, 'dd/mm/yyyy\ hh:mm:ss'), { fmt: 'datetime', dec: 1 });
assert.deepEqual(excelFmtToOurs(164, '[$-418]d mmmm yyyy;@'), { fmt: 'datelong' });
assert.deepEqual(excelFmtToOurs(164, '0.000E+00'), { fmt: 'sci', dec: 3 });
assert.deepEqual(excelFmtToOurs(164, '# ??/??'), { fmt: 'fraction' });
assert.deepEqual(excelFmtToOurs(164, 'mmm-yy'), { fmt: 'date' });
assert.deepEqual(excelFmtToOurs(164, '_-* #,##0.00\ _l_e_i_-;\-* #,##0.00\ _l_e_i_-'), { fmt: 'number', dec: 2 });

// Dus-întors .xlsx.
const styles = { A1: { fmt: 'time' }, A2: { fmt: 'time', dec: 1 }, A3: { fmt: 'datetime' }, A4: { fmt: 'datelong' }, A5: { fmt: 'sci' }, A6: { fmt: 'sci', dec: 3 }, A7: { fmt: 'fraction' } };
const cells = Object.fromEntries(Object.keys(styles).map((k) => [k, '46387.5625']));
const back = (await readXlsx(await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles }, results: {} }]))).sheets[0];
for (const k of Object.keys(styles)) assert.deepEqual(back.styles[k], styles[k], k);
console.log('formatele de număr noi: toate verificările trec');
