// Test pentru „Îngheață la selecție” în Sheets: mai multe rânduri și coloane înghețate, păstrate în fișierul Suite și în .xlsx.
// Rulare (în suite/): node tests/sheet-freeze.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-freeze-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { parseSheetDoc, cleanFreeze, MAX_FREEZE_ROWS, MAX_FREEZE_COLS } = await import(pathToFileURL(join(dir, 'format.js')).href);
rmSync(dir, { recursive: true, force: true });

// Curățarea numărului.
assert.equal(cleanFreeze(3, 100), 3);
assert.equal(cleanFreeze(2.7, 100), 2);
assert.equal(cleanFreeze(0, 100), 0);
assert.equal(cleanFreeze(-4, 100), 0);
assert.equal(cleanFreeze('3', 100), 0, 'textul nu e număr');
assert.equal(cleanFreeze(5000, 100), 100, 'cel mult maximul');

// Fișierul Suite: rândurile 1–3 și coloanele A–B înghețate rămân; valorile stricate se ignoră.
const sheet = { name: 'Foaia 1', colW: {}, styles: {}, cells: { A1: 'Nume', B1: 'Oraș', C1: 'Total' }, freeze: 3, freezeCol: 2 };
const doc = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, title: '', sheets: [
  sheet, { ...sheet, name: 'B', freeze: 1, freezeCol: undefined }, { ...sheet, name: 'C', freeze: 'mult', freezeCol: 9999 },
] }));
assert.equal(doc.sheets[0].freeze, 3);
assert.equal(doc.sheets[0].freezeCol, 2);
assert.equal(doc.sheets[1].freeze, 1, 'rândul 1 singur, ca până acum');
assert.equal(doc.sheets[1].freezeCol, undefined);
assert.equal(doc.sheets[2].freeze, undefined, 'valoare stricată');
assert.equal(doc.sheets[2].freezeCol, MAX_FREEZE_COLS);

// Dus-întors prin .xlsx: <pane xSplit="2" ySplit="3" topLeftCell="C4" state="frozen"/>.
const back = (await readXlsx(await writeXlsx([{ sheet, results: {} }]))).sheets[0];
assert.equal(back.freeze, 3);
assert.equal(back.freezeCol, 2);
const onlyRows = (await readXlsx(await writeXlsx([{ sheet: { ...sheet, freeze: 5, freezeCol: undefined }, results: {} }]))).sheets[0];
assert.equal(onlyRows.freeze, 5);
assert.equal(onlyRows.freezeCol, undefined);
const onlyCols = (await readXlsx(await writeXlsx([{ sheet: { ...sheet, freeze: undefined, freezeCol: 4 }, results: {} }]))).sheets[0];
assert.equal(onlyCols.freeze, undefined);
assert.equal(onlyCols.freezeCol, 4);
const none = (await readXlsx(await writeXlsx([{ sheet: { ...sheet, freeze: undefined, freezeCol: undefined }, results: {} }]))).sheets[0];
assert.equal(none.freeze, undefined);
assert.equal(none.freezeCol, undefined);
const huge = (await readXlsx(await writeXlsx([{ sheet: { ...sheet, freeze: 400 }, results: {} }]))).sheets[0];
assert.equal(huge.freeze, MAX_FREEZE_ROWS, 'prea multe rânduri: cel mult maximul');

// XML-ul scris: colțul de după panouri e C4.
const { default: JSZip } = await import('jszip');
const zip = await JSZip.loadAsync(await writeXlsx([{ sheet, results: {} }]));
const xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
assert.match(xml, /<pane xSplit="2" ySplit="3" topLeftCell="C4" activePane="bottomRight" state="frozen"\/>/);
console.log('OK: înghețarea mai multor rânduri și coloane se păstrează (fișier Suite și .xlsx)');

// Titlurile ascunse (literele coloanelor și numerele rândurilor): showRowColHeaders="0" în .xlsx și în fișierul Suite.
{
  const plainSheet = { name: 'T', colW: {}, styles: {}, cells: { A1: '1' } };
  const hid = (await readXlsx(await writeXlsx([{ sheet: { ...plainSheet, noHead: true }, results: {} }]))).sheets[0];
  assert.equal(hid.noHead, true);
  const zip2 = await JSZip.loadAsync(await writeXlsx([{ sheet: { ...plainSheet, noHead: true }, results: {} }]));
  assert.match(await zip2.file('xl/worksheets/sheet1.xml').async('string'), /showRowColHeaders="0"/);
  const shown = (await readXlsx(await writeXlsx([{ sheet: plainSheet, results: {} }]))).sheets[0];
  assert.equal(shown.noHead, undefined);
  const d2 = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, title: '', sheets: [{ ...plainSheet, noHead: true }, { ...plainSheet, name: 'U', noHead: 'da' }] }));
  assert.equal(d2.sheets[0].noHead, true);
  assert.equal(d2.sheets[1].noHead, undefined);
  console.log('OK: titlurile ascunse se păstrează (fișier Suite și .xlsx)');
}
