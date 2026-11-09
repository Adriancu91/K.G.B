// Test pentru exponentul / indicele din celulele Sheets: fișierul Suite și .xlsx (vertAlign) dus-întors.
// Rulare (în suite/): node tests/sheets-supsub.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-supsub-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { parseSheetDoc, serializeSheetDoc } = await import(pathToFileURL(join(dir, 'format.js')).href);
rmSync(dir, { recursive: true, force: true });

const doc = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, sheets: [{ name: 'Foaia 1', cells: { A1: '2', B1: '2' }, styles: { A1: { pos: 'sup' }, B1: { pos: 'sub' }, C1: { pos: 'sus' } } }] }));
const st = doc.sheets[0].styles;
assert.equal(st.A1.pos, 'sup');
assert.equal(st.B1.pos, 'sub');
assert.equal(st.C1?.pos, undefined, 'o valoare necunoscută se ignoră');
assert.equal(parseSheetDoc(serializeSheetDoc(doc)).sheets[0].styles.B1.pos, 'sub');

const sheet = { name: 'Foaia 1', colW: {}, cells: { A1: 'm', B1: '2', C1: 'H', D1: '2' }, styles: { B1: { pos: 'sup' }, D1: { pos: 'sub', b: true } } };
const bytes = await writeXlsx([{ sheet, results: {} }]);
const xml = await (await JSZip.loadAsync(bytes)).file('xl/styles.xml').async('string');
assert.ok(xml.includes('<vertAlign val="superscript"/>') && xml.includes('<vertAlign val="subscript"/>'), 'vertAlign în styles.xml');
const back = (await readXlsx(bytes)).sheets[0].styles;
assert.equal(back.B1.pos, 'sup');
assert.equal(back.D1.pos, 'sub');
assert.equal(back.D1.b, true);
assert.equal(back.A1?.pos, undefined);
console.log('exponent / indice: toate verificările trec');
