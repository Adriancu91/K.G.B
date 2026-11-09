// Test pentru textul tăiat, alinierea verticală și retragerea în Sheets: export/import .xlsx, lipirea HTML și curățarea fișierului Suite.
// Rulare (în suite/): node tests/sheet-align.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-align-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/format.ts', 'src/sheets/paste.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { parseSheetDoc } = await import(pathToFileURL(join(dir, 'format.js')).href);
const { styleFromCss, styleToCss } = await import(pathToFileURL(join(dir, 'paste.js')).href);
rmSync(dir, { recursive: true, force: true });

const sheet = {
  name: 'Foaia 1', colW: {},
  cells: { A1: 'tăiat', A2: 'sus', A3: 'mijloc', A4: 'jos', A5: 'retras', A6: 'dreapta', A7: 'tot' },
  styles: {
    A1: { s: true }, A2: { va: 'top' }, A3: { va: 'middle' }, A4: { va: 'bottom' },
    A5: { align: 'left', ind: 2 }, A6: { align: 'right', ind: 1 }, A7: { s: true, u: true, va: 'top', ind: 3, align: 'left', wrap: true },
  },
};
const back = (await readXlsx(await writeXlsx([{ sheet, results: {} }]))).sheets[0];
for (const id of Object.keys(sheet.styles)) assert.deepEqual(back.styles[id], sheet.styles[id], id);

// Fișierul Suite: valorile greșite se aruncă.
const doc = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, title: '', sheets: [{ ...sheet, styles: {
  A1: { s: 'da', va: 'sus', ind: 99 }, A2: { s: true, va: 'bottom', ind: 4.4 }, A3: { ind: 0 },
} }] }));
assert.equal(doc.sheets[0].styles.A1, undefined);
assert.deepEqual(doc.sheets[0].styles.A2, { s: true, va: 'bottom', ind: 4 });
assert.equal(doc.sheets[0].styles.A3, undefined);

// Lipirea și copierea ca HTML păstrează tăierea.
assert.equal(styleFromCss({ 'text-decoration': 'line-through' }).s, true);
assert.deepEqual(styleFromCss({ 'text-decoration': 'underline line-through' }), { u: true, s: true });
assert.match(styleToCss({ s: true, u: true }), /text-decoration:underline line-through/);
console.log('tăiat, aliniere verticală, retragere: toate verificările trec');
