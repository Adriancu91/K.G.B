// Test pentru listele derulante din .xlsx care iau valorile dintr-un nume definit (=Judete) sau dintr-un registru extern
// ([1]Coduri!$A$2:$A$4, cu valorile păstrate în xl/externalLinks/externalLink1.xml). Înainte, amândouă se pierdeau la deschidere.
// Rulare (în suite/): node tests/sheet-list-names.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-listnames-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
rmSync(dir, { recursive: true, force: true });

// Un registru cu foaia „Date” (lista de județe în D2:D4) și foaia „Liste”, în care punem de mână validările și numele.
const date = { name: 'Date', colW: {}, cells: { A1: 'Județ', B1: 'Cod', D2: 'Alba', D3: 'Arad', D4: 'Argeș' }, styles: {} };
const liste = { name: 'Liste', colW: {}, cells: { A1: 'x' }, styles: {} };
const zip = await JSZip.loadAsync(await writeXlsx([{ sheet: date, results: {} }, { sheet: liste, results: {} }]));
const s1 = await zip.file('xl/worksheets/sheet1.xml').async('string');
const dv = '<dataValidations count="4">'
  + '<dataValidation type="list" allowBlank="1" sqref="A2:A10"><formula1>Judete</formula1></dataValidation>'
  + '<dataValidation type="list" allowBlank="1" sqref="B2:B10"><formula1>Coduri</formula1></dataValidation>'
  + '<dataValidation type="list" allowBlank="1" sqref="C2"><formula1>Local</formula1></dataValidation>'
  + '<dataValidation type="list" allowBlank="1" sqref="E2"><formula1>Lipsa</formula1></dataValidation>'
  + '</dataValidations>';
zip.file('xl/worksheets/sheet1.xml', s1.replace('</sheetData>', '</sheetData>' + dv));
let wb = await zip.file('xl/workbook.xml').async('string');
const names = '<definedName name="Judete">Date!$D$2:$D$4</definedName>'
  + '<definedName name="Coduri">[1]Coduri!$A$2:$A$4</definedName>'
  + '<definedName name="Local" localSheetId="0">\'[1]Foaia mea\'!$B$1:$C$1</definedName>'
  + '<definedName name="Local">Date!$A$1</definedName>';
wb = wb.includes('<definedNames>') ? wb.replace('<definedNames>', '<definedNames>' + names) : wb.replace('</sheets>', '</sheets><definedNames>' + names + '</definedNames>');
wb = wb.replace('</workbook>', '<externalReferences><externalReference r:id="rIdExt1"/></externalReferences></workbook>');
if (!/xmlns:r=/.test(wb)) wb = wb.replace('<workbook ', '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
zip.file('xl/workbook.xml', wb);
const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
zip.file('xl/_rels/workbook.xml.rels', rels.replace('</Relationships>', '<Relationship Id="rIdExt1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink" Target="externalLinks/externalLink1.xml"/></Relationships>'));
zip.file('xl/externalLinks/externalLink1.xml', '<?xml version="1.0" encoding="UTF-8"?><externalLink xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><externalBook>'
  + '<sheetNames><sheetName val="Coduri"/><sheetName val="Foaia mea"/></sheetNames><sheetDataSet>'
  + '<sheetData sheetId="0"><row r="1"><cell r="A1" t="str"><v>Cod</v></cell></row><row r="3"><cell r="A3" t="str"><v>AR</v></cell></row><row r="2"><cell r="A2" t="str"><v>AB</v></cell></row><row r="4"><cell r="A4"><v>17</v></cell></row><row r="9"><cell r="A9" t="str"><v>prea jos</v></cell></row></sheetData>'
  + '<sheetData sheetId="1"><row r="1"><cell r="B1" t="str"><v>Da</v></cell><cell r="C1" t="str"><v>Nu</v></cell></row></sheetData>'
  + '</sheetDataSet></externalBook></externalLink>');
const bk = await readXlsx(await zip.generateAsync({ type: 'uint8array' }));
const got = bk.sheets[0].lists;
const at = (range) => got.find((l) => l.range === range)?.values;
assert.deepEqual(at('A2:A10'), ['Alba', 'Arad', 'Argeș'], 'numele Judete → zona Date!D2:D4');
assert.deepEqual(at('B2:B10'), ['AB', 'AR', '17'], 'numele Coduri → registrul extern [1], valorile păstrate, în ordinea rândurilor, fără ce e în afara zonei');
assert.deepEqual(at('C2:C2'), ['Da', 'Nu'], 'numele local al foii are întâietate; foaie externă cu spațiu, între apostrofuri');
assert.equal(at('E2:E2'), undefined, 'un nume care nu există: nicio listă, fără eroare');

// Fișierul real din colecție: listele „state”, „states” și „dropdown” sunt nume definite (înainte se pierdeau).
const real = join(import.meta.dirname, '..', '..', 'test-corpus', 'xlsx', 'StructuredRefs-lots-with-lookups.xlsx');
if (existsSync(real)) {
  const book = await readXlsx(new Uint8Array(readFileSync(real)));
  const all = book.sheets.flatMap((s) => s.lists.filter((l) => l.values.length));
  const states = all.find((l) => l.values.length >= 50);
  assert.ok(states, `lista de state americane (numele state / states) se deschide: ${all.map((l) => l.values.length).join(', ')}`);
  console.log(`  fișierul real: ${all.length} liste cu valori, de exemplu ${states.values.slice(0, 3).join(', ')}…`);
}
console.log('listele din nume și din registre externe: toate verificările trec');
