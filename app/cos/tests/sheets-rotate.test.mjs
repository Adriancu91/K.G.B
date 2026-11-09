// Test pentru rotirea textului din celulele Sheets: fișierul Suite și .xlsx (textRotation) dus-întors.
// Rulare (în suite/): node tests/sheets-rotate.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-rotate-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { parseSheetDoc, serializeSheetDoc } = await import(pathToFileURL(join(dir, 'format.js')).href);
rmSync(dir, { recursive: true, force: true });

const doc = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, sheets: [{ name: 'Foaia 1', cells: { A1: 'x' }, styles: { A1: { rot: 90 }, B1: { rot: -45 }, C1: { rot: 200 }, D1: { rot: 0 }, E1: { rot: 255 } } }] }));
const st = doc.sheets[0].styles;
assert.equal(st.A1.rot, 90);
assert.equal(st.B1.rot, -45);
assert.equal(st.C1?.rot, undefined, 'peste 90 de grade se ignoră');
assert.equal(st.D1?.rot, undefined);
assert.equal(st.E1.rot, 255, 'literă sub literă');
assert.equal(parseSheetDoc(serializeSheetDoc(doc)).sheets[0].styles.B1.rot, -45);

const sheet = { name: 'Foaia 1', colW: {}, cells: { A1: 'Ianuarie', B1: 'Februarie', C1: 'Martie', D1: 'Aprilie' }, styles: { A1: { rot: 90 }, B1: { rot: -90 }, C1: { rot: 45, b: true }, D1: { rot: 255 } } };
const bytes = await writeXlsx([{ sheet, results: {} }]);
const xml = await (await JSZip.loadAsync(bytes)).file('xl/styles.xml').async('string');
assert.ok(xml.includes('textRotation="90"') && xml.includes('textRotation="180"') && xml.includes('textRotation="45"') && xml.includes('textRotation="255"'), 'textRotation în styles.xml (în jos = 90 + grade)');
const back = (await readXlsx(bytes)).sheets[0].styles;
assert.equal(back.A1.rot, 90);
assert.equal(back.B1.rot, -90);
assert.equal(back.C1.rot, 45);
assert.equal(back.C1.b, true);
assert.equal(back.D1.rot, 255, 'literă sub literă din .xlsx');
console.log('rotirea textului: toate verificările trec');
