// Test pentru fontul și mărimea textului în Sheets: export/import .xlsx și curățarea la citirea fișierului Suite.
// Rulare (în suite/): node tests/sheet-fonts.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-fonts-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { parseSheetDoc } = await import(pathToFileURL(join(dir, 'format.js')).href);
rmSync(dir, { recursive: true, force: true });

const sheet = {
  name: 'Foaia 1', colW: {},
  cells: { A1: 'Titlu', A2: 'normal', A3: 'mic', A4: 'Courier' },
  styles: { A1: { b: true, sz: 18, font: 'Georgia' }, A3: { sz: 8 }, A4: { font: 'Courier New', i: true } },
};
const back = (await readXlsx(await writeXlsx([{ sheet, results: {} }]))).sheets[0];
assert.deepEqual(back.styles.A1, { b: true, sz: 18, font: 'Georgia' });
assert.deepEqual(back.styles.A3, { sz: 8 });
assert.deepEqual(back.styles.A4, { i: true, font: 'Courier New' });
assert.equal(back.styles.A2, undefined);
const doc = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, title: '', sheets: [{ ...sheet, styles: {
  A1: { sz: 200, font: 'Arial' }, A2: { sz: 12.3, font: '<script>' }, A3: { sz: 'mare' },
} }] }));
assert.deepEqual(doc.sheets[0].styles.A1, { font: 'Arial' });
assert.deepEqual(doc.sheets[0].styles.A2, { sz: 12.5 });
assert.equal(doc.sheets[0].styles.A3, undefined);
console.log('fonturi în tabel: toate verificările trec');
