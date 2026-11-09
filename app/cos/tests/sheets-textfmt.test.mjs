// Test pentru formatul Text și Contabil din Sheets: apostroful de text (0722…, 00123), afișarea, calculul și .xlsx dus-întors.
// Rulare (în suite/): node tests/sheets-textfmt.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-textfmt-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/numfmt.ts', 'src/sheets/formula.ts', 'src/sheets/filter.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx, excelFmtToOurs } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { asText, keepText, formatValue } = await import(pathToFileURL(join(dir, 'numfmt.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(dir, 'formula.js')).href);
const { cellText } = await import(pathToFileURL(join(dir, 'filter.js')).href);
rmSync(dir, { recursive: true, force: true });
const Q = String.fromCharCode(39);

// Apostroful de text.
assert.equal(asText('00123'), Q + '00123');
assert.equal(asText(Q + 'x'), Q + 'x', 'nu se dublează');
assert.equal(asText(''), '');
assert.equal(keepText('0722123456'), Q + '0722123456', 'telefonul din .xlsx rămâne text');
assert.equal(keepText('=SUM(A1)'), Q + '=SUM(A1)', 'un text care începe cu = nu devine formulă');
assert.equal(keepText('Ion Popescu'), 'Ion Popescu');
assert.equal(keepText('TRUE'), Q + 'TRUE');
assert.equal(cellText(Q + '00123', undefined, undefined), '00123', 'se arată fără apostrof');
const r = evaluateAll({ A1: Q + '00123', A2: '5', A3: '=LEN(A1)', A4: '=ISTEXT(A1)', A5: '=SUM(A1:A2)', A6: Q + '=1+1' });
assert.equal(r.A3.text, '5', 'LEN vede cele 5 caractere');
assert.ok(/ADEV|TRUE/.test(r.A4.text), 'ISTEXT: e text');
assert.equal(r.A5.text, '5', 'SUM sare peste text, ca în Excel');
assert.equal(cellText(Q + '=1+1', r.A6, undefined), '=1+1', 'textul =1+1 nu se calculează');

// Contabil.
assert.equal(formatValue(1234.5, 'acct'), '1.234,50 lei');
assert.equal(formatValue(0, 'acct'), '- lei', 'zero cu liniuță');
assert.equal(formatValue(-3, 'acct'), '-3,00 lei');

// Formatele din .xlsx.
assert.equal(excelFmtToOurs(49, undefined).fmt, 'text');
assert.equal(excelFmtToOurs(200, '@').fmt, 'text');
assert.equal(excelFmtToOurs(200, '_-* #,##0.00 "lei"_-;-* #,##0.00 "lei"_-;_-* "-"?? "lei"_-;_-@_-').fmt, 'acct');
assert.equal(excelFmtToOurs(200, '#,##0.00 "lei"').fmt, 'lei');

// .xlsx dus-întors.
const sheet = {
  name: 'Foaia 1', colW: {},
  cells: { A1: Q + '0722123456', A2: Q + '=1+1', B1: '0', B2: '1500', C1: Q + '00123' },
  styles: { B1: { fmt: 'acct' }, B2: { fmt: 'acct' }, C1: { fmt: 'text' } },
};
const bytes = await writeXlsx([{ sheet, results: evaluateAll(sheet.cells) }]);
const zip = await JSZip.loadAsync(bytes);
const sst = await zip.file('xl/sharedStrings.xml').async('string');
assert.ok(sst.includes('>0722123456<') && !sst.includes(Q + '0722'), 'în .xlsx textul e fără apostrof');
const stylesXml = await zip.file('xl/styles.xml').async('string');
assert.ok(stylesXml.includes('formatCode="@"'), 'formatul Text e @');
assert.ok(stylesXml.includes('_-*'), 'formatul Contabil');
const back = (await readXlsx(bytes)).sheets[0];
assert.equal(back.cells.A1, Q + '0722123456', 'citit înapoi: telefonul e tot text');
assert.equal(back.cells.A2, Q + '=1+1', 'citit înapoi: =1+1 e tot text');
assert.equal(back.cells.C1, Q + '00123');
assert.equal(back.styles.C1?.fmt, 'text');
assert.equal(back.styles.B1?.fmt, 'acct');
assert.equal(back.cells.B2, '1500', 'numerele rămân numere');
console.log('formatul Text și Contabil: toate verificările trec');
