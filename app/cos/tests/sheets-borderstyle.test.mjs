// Test pentru felul și culoarea liniilor de chenar din Sheets: laturile desenate, fișierul Suite, tipărirea și .xlsx dus-întors.
// Rulare (în suite/): node tests/sheets-borderstyle.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-bdstyle-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/border.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { borderPatch, withLook, edges, printLine, cleanLineStyle } = await import(pathToFileURL(join(dir, 'border.js')).href);
const { parseSheetDoc, serializeSheetDoc } = await import(pathToFileURL(join(dir, 'format.js')).href);
rmSync(dir, { recursive: true, force: true });

assert.equal(cleanLineStyle('thick'), 'thick');
assert.equal(cleanLineStyle('wavy'), undefined);
// Contur gros roșu pe A1:B2.
const patch = withLook(borderPatch({}, { r0: 0, c0: 0, r1: 1, c1: 1 }, 'outline'), { st: 'thick', col: '#cc0000' });
assert.equal(patch.A1.bd, 'tl');
assert.equal(patch.A1.bdStyle, 'thick');
assert.equal(patch.B2.bdColor, '#cc0000');
const e = edges(patch, 0, 0);
assert.ok(e.t && e.l && !e.r, 'A1: sus și stânga');
assert.equal(e.look.t.st, 'thick');
// Latura de jos a lui A2 vine de la ea; latura dreaptă a lui A3 (fără chenar) nu există.
assert.equal(edges(patch, 1, 0).look.b.col, '#cc0000');
assert.equal(edges(patch, 2, 0).look, undefined);
// „Fără chenar” scoate și felul liniei.
const none = withLook(borderPatch(patch, { r0: 0, c0: 0, r1: 1, c1: 1 }, 'none'), { st: 'thick' });
assert.equal(none.A1.bd, undefined);
assert.equal(none.A1.bdStyle, undefined);
// Tipărirea.
assert.equal(printLine({ st: 'thick', col: '#cc0000' }), '3px solid #cc0000');
assert.equal(printLine({ st: 'double' }), '3px double #000');
assert.equal(printLine(undefined), '1px solid #000');

// Fișierul Suite.
const doc = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, sheets: [{ name: 'Foaia 1', cells: { A1: 'x' }, styles: { A1: { bd: 'b', bdStyle: 'double', bdColor: '#0000ff' }, B1: { bdStyle: 'thick' } } }] }));
const st = doc.sheets[0].styles;
assert.equal(st.A1.bdStyle, 'double');
assert.equal(st.A1.bdColor, '#0000ff');
assert.equal(st.B1?.bdStyle, undefined, 'fără chenar, felul liniei nu se păstrează');
assert.equal(parseSheetDoc(serializeSheetDoc(doc)).sheets[0].styles.A1.bdStyle, 'double');

// .xlsx dus-întors.
const sheet = { name: 'Foaia 1', colW: {}, cells: { A1: 'Total' }, styles: { A1: { bd: 'tb', bdStyle: 'double', bdColor: '#cc0000' }, A2: { bd: 'b', bdStyle: 'dashed' } } };
const bytes = await writeXlsx([{ sheet, results: {} }]);
const xml = await (await JSZip.loadAsync(bytes)).file('xl/styles.xml').async('string');
assert.ok(xml.includes('<top style="double"><color rgb="FFCC0000"/></top>'), 'linia dublă roșie în styles.xml');
assert.ok(xml.includes('<bottom style="dashed">'), 'linia întreruptă');
const back = (await readXlsx(bytes)).sheets[0].styles;
assert.equal(back.A1.bd, 'tb');
assert.equal(back.A1.bdStyle, 'double');
assert.equal(back.A1.bdColor, '#cc0000');
assert.equal(back.A2.bdStyle, 'dashed');
console.log('felul și culoarea chenarelor: toate verificările trec');
