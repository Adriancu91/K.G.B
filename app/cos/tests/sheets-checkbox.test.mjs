// Test pentru casetele de bifat din Sheets: ADEVĂRAT / FALS se scriu în .xlsx ca valori logice (nu text), caseta se păstrează
// în fișierul nostru și se citește dintr-un .xlsx care are casete (stil cu xfComplement + punga „Checkbox”).
// Rulare (în suite/): node tests/sheets-checkbox.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const out = join(tmpdir(), `suite-chk-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { readXlsx, writeXlsx } from './src/sheets/xlsx.ts'; export { parseSheetDoc } from './src/sheets/format.ts'; export { evaluateAll } from './src/sheets/formula.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { readXlsx, writeXlsx, evaluateAll } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

// Valorile logice: în fișier t="b", iar formulele care le numără merg.
const sheet = { name: 'Sarcini', cells: { A1: 'Pâine', B1: 'ADEVĂRAT', A2: 'Lapte', B2: 'FALS', B3: '=COUNTIF(B1:B2;TRUE)', B4: '=B1' }, styles: { B1: { chk: true }, B2: { chk: true } }, colW: {} };
const results = evaluateAll(sheet.cells);
assert.equal(results.B3.value, 1, 'COUNTIF numără casetele bifate');
const bytes = await writeXlsx([{ sheet, results }]);
const zip = await JSZip.loadAsync(bytes);
const xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
assert.match(xml, /<c r="B1"[^>]* t="b"><v>1<\/v><\/c>/, 'ADEVĂRAT e valoare logică');
assert.match(xml, /<c r="B2"[^>]* t="b"><v>0<\/v><\/c>/, 'FALS e valoare logică');
assert.match(xml, /<c r="B4"[^>]* t="b"><f>B1<\/f><v>1<\/v><\/c>/, 'formula care dă ADEVĂRAT');
const back = (await readXlsx(bytes)).sheets[0];
assert.equal(back.cells.B1, 'ADEVĂRAT');
assert.equal(back.cells.B2, 'FALS');

// Un .xlsx cu casete de bifat: le adaug în fișierul scris mai sus (stilul celulei B1 primește xfComplement).
const st = await zip.file('xl/styles.xml').async('string');
const withXf = st.replace(/<cellXfs count="(\d+)">/, (m, n) => `<cellXfs count="${+n + 1}">`)
  .replace('</cellXfs>', '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><extLst><ext uri="{C7286773-470A-42A8-94C5-96B5CB345126}" xmlns:xfpb="http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag"><xfpb:xfComplement i="0"/></ext></extLst></xf></cellXfs>');
const nXf = (withXf.match(/<cellXfs count="(\d+)"/) ?? [])[1] - 1;
zip.file('xl/styles.xml', withXf);
zip.file('xl/worksheets/sheet1.xml', xml.replace(/<c r="B2"[^>]*>/, `<c r="B2" s="${nXf}" t="b">`).replace(/<c r="B1"[^>]*>/, `<c r="B1" s="${nXf}" t="b">`));
zip.file('xl/featurePropertyBag/featurePropertyBag.xml', '<?xml version="1.0" encoding="UTF-8"?><FeaturePropertyBags xmlns="http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag"><bag type="Checkbox"/><bag type="XFControls"><bagId k="CellControl">0</bagId></bag><bag type="XFComplement"><bagId k="XFControls">1</bagId></bag><bag type="XFComplements" extRef="XFComplementsMapperExtRef"><a k="MappedFeaturePropertyBags"><bagId>2</bagId></a></bag></FeaturePropertyBags>');
const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
zip.file('xl/_rels/workbook.xml.rels', rels.replace('</Relationships>', '<Relationship Id="rId99" Type="http://schemas.microsoft.com/office/2022/11/relationships/FeaturePropertyBag" Target="featurePropertyBag/featurePropertyBag.xml"/></Relationships>'));
const withChk = (await readXlsx(await zip.generateAsync({ type: 'uint8array' }))).sheets[0];
assert.equal(withChk.styles.B1?.chk, true, 'caseta din .xlsx se citește');
assert.equal(withChk.styles.B2?.chk, true);
assert.equal(withChk.cells.B1, 'ADEVĂRAT');
assert.equal(withChk.styles.A1?.chk, undefined, 'celulele fără casetă rămân fără');
// Fără punga „Checkbox”, același stil nu e casetă.
zip.remove('xl/featurePropertyBag/featurePropertyBag.xml');
const noBag = (await readXlsx(await zip.generateAsync({ type: 'uint8array' }))).sheets[0];
assert.equal(noBag.styles.B1?.chk, undefined);
console.log('casete de bifat: toate verificările trec');

// Legăturile din celule: adresele bune, dus-întors .xlsx (web, e-mail, loc din tabel), fără stiluri Excel în plus.
const { cleanLink } = await (async () => {
  const o = join(tmpdir(), `suite-link-${process.pid}.mjs`);
  await build({ stdin: { contents: "export { cleanLink } from './src/sheets/format.ts';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: o, logLevel: 'error' });
  const m = await import(pathToFileURL(o).href); rmSync(o, { force: true }); return m;
})();
assert.equal(cleanLink('www.exemplu.ro'), 'https://www.exemplu.ro');
assert.equal(cleanLink('ana@exemplu.ro'), 'mailto:ana@exemplu.ro');
assert.equal(cleanLink("#'Foaia 2'!B3"), "#'Foaia 2'!B3");
assert.equal(cleanLink('javascript:alert(1)'), null, 'nu orice adresă');
assert.equal(cleanLink('file:///C:/x.exe'), null);
const lsheet = { name: 'Legături', cells: { A1: 'Site', A2: 'Mail', A3: 'Sus' }, styles: { A1: { link: 'https://exemplu.ro/a?b=1&c=2', b: true }, A2: { link: 'mailto:ana@exemplu.ro' }, A3: { link: '#Legături!A1' } }, colW: {} };
const lbytes = await writeXlsx([{ sheet: lsheet, results: {} }]);
const lzip = await JSZip.loadAsync(lbytes);
assert.match(await lzip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string'), /Target="https:\/\/exemplu.ro\/a\?b=1&amp;c=2" TargetMode="External"/);
assert.match(await lzip.file('xl/worksheets/sheet1.xml').async('string'), /<hyperlink ref="A3" location="Legături!A1"\/>/);
const lback = (await readXlsx(lbytes)).sheets[0];
assert.equal(lback.styles.A1.link, 'https://exemplu.ro/a?b=1&c=2');
assert.equal(lback.styles.A1.b, true);
assert.equal(lback.styles.A2.link, 'mailto:ana@exemplu.ro');
assert.equal(lback.styles.A3.link, '#Legături!A1');
const sx = await lzip.file('xl/styles.xml').async('string');
assert.equal((sx.match(/<cellXfs count="(\d+)"/) ?? [])[1], '2', 'legăturile nu fac stiluri noi (doar cel aldin)');
console.log('legături: toate verificările trec');
