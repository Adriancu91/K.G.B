// Test pentru culoarea filelor, foile ascunse și grila ascunsă în Sheets: export/import .xlsx și curățarea fișierului Suite.
// Rulare (în suite/): node tests/sheet-tabs.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-tabs-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { parseSheetDoc } = await import(pathToFileURL(join(dir, 'format.js')).href);
rmSync(dir, { recursive: true, force: true });

const sh = (name, extra = {}) => ({ name, colW: {}, cells: { A1: name }, styles: {}, ...extra });
const book = [sh('Date', { hidden: true, tab: '#c00000' }), sh('Raport', { tab: '#00b050', noGrid: true }), sh('Note')];
// Fila activă cerută e cea ascunsă: Excel trebuie să primească o foaie vizibilă.
const bytes = await writeXlsx(book.map((sheet) => ({ sheet, results: {} })), 0);
const wb = await (await JSZip.loadAsync(bytes)).file('xl/workbook.xml').async('string');
assert.match(wb, /<sheet name="Date" state="hidden"/);
assert.match(wb, /activeTab="1"/);
const s1 = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
assert.match(s1, /<worksheet [^>]*><sheetPr><tabColor rgb="FFC00000"\/><\/sheetPr><sheetViews>/);
const back = await readXlsx(bytes);
assert.equal(back.sheets[0].hidden, true);
assert.equal(back.sheets[0].tab, '#c00000');
assert.equal(back.sheets[1].hidden, undefined);
assert.equal(back.sheets[1].tab, '#00b050');
assert.equal(back.sheets[2].tab, undefined);
// Grila ascunsă (showGridLines=0) doar pe foaia Raport.
assert.deepEqual(back.sheets.map((s) => !!s.noGrid), [false, true, false]);
assert.equal(back.active, 1);

// Toate ascunse: prima se afișează (și la .xlsx, și la fișierul Suite).
const all = await readXlsx(await writeXlsx([sh('A', { hidden: true }), sh('B', { hidden: true })].map((sheet) => ({ sheet, results: {} }))));
assert.deepEqual(all.sheets.map((s) => !!s.hidden), [false, true]);
const doc = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, title: '', sheets: [
  sh('A', { hidden: true, tab: 'rosu' }), sh('B', { hidden: true, tab: '#ABCDEF' }),
] }));
assert.deepEqual(doc.sheets.map((s) => [!!s.hidden, s.tab]), [[false, undefined], [true, '#ABCDEF']]);
console.log('culoarea filelor și foile ascunse: toate verificările trec');
