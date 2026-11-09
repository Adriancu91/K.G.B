// Test: Sheets → Proprietăți: titlul, subiectul, autorul și cuvintele cheie în .ssheet și în .xlsx (docProps/core.xml), dus-întors.
// Rulare (în suite/): node tests/sheets-props.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const dir = join(tmpdir(), `suite-shprops-${process.pid}`);
const entry = join(tmpdir(), `suite-shprops-entry-${process.pid}.ts`);
const p = (f) => JSON.stringify(join(process.cwd(), f).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { readXlsx, writeXlsx, propsFromCore } from ${p('src/sheets/xlsx.ts')};\nexport { emptySheetDoc, parseSheetDoc, serializeSheetDoc, sheetProps } from ${p('src/sheets/format.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'x.mjs'), logLevel: 'error', loader: { '.css': 'empty' } });
const M = await import(pathToFileURL(join(dir, 'x.mjs')).href);
rmSync(dir, { recursive: true, force: true });
rmSync(entry, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };

// În fișierul Suite.
const doc = M.emptySheetDoc();
doc.title = 'Buget 2026';
doc.props = { subject: 'Cheltuieli & venituri', author: 'Ana Pop', keywords: 'buget, firmă' };
const back = M.parseSheetDoc(M.serializeSheetDoc(doc));
ok(back.title === 'Buget 2026' && JSON.stringify(back.props) === JSON.stringify(doc.props), '.ssheet păstrează proprietățile');
ok(M.parseSheetDoc(M.serializeSheetDoc(M.emptySheetDoc())).props === undefined, 'fără proprietăți: câmpul lipsește');
ok(M.sheetProps({ props: { title: 'X', author: '  ', subject: 'a'.repeat(300) } }).subject.length === 200 && M.sheetProps({ props: { title: 'X' } }) === undefined, 'curățare: fără titlu, fără câmpuri goale, cel mult 200 de litere');

// În .xlsx.
const props = { title: 'Buget 2026', subject: 'Cheltuieli & venituri', author: 'Ana Pop', keywords: 'buget, firmă' };
const bytes = await M.writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells: { A1: '1' }, styles: {} }, results: {} }], 0, [], false, undefined, undefined, props);
const zip = await JSZip.loadAsync(bytes);
const core = await zip.file('docProps/core.xml')?.async('string');
let errs = 0;
new DOMParser({ onError: () => { errs++; } }).parseFromString(core ?? '', 'text/xml');
ok(core && !errs, 'docProps/core.xml există și e XML valid');
ok(core.includes('<dc:title>Buget 2026</dc:title>') && core.includes('<dc:subject>Cheltuieli &amp; venituri</dc:subject>') && core.includes('<dc:creator>Ana Pop</dc:creator>') && core.includes('<cp:keywords>buget, firmă</cp:keywords>'), 'câmpurile, cu & scris corect');
ok((await zip.file('_rels/.rels').async('string')).includes('Target="docProps/core.xml"') && (await zip.file('[Content_Types].xml').async('string')).includes('/docProps/core.xml'), 'legătura și tipul fișierului');
const r = await M.readXlsx(bytes);
ok(JSON.stringify(r.props) === JSON.stringify(props), 'citite înapoi: ' + JSON.stringify(r.props));
const plain = await M.writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells: { A1: '1' }, styles: {} }, results: {} }]);
ok(!(await JSZip.loadAsync(plain)).file('docProps/core.xml') && (await M.readXlsx(plain)).props === undefined, 'fără proprietăți: fără core.xml');
// Un fișier scris de alt program (cu dcterms:created și cp:lastModifiedBy).
const other = M.propsFromCore('<?xml version="1.0"?><cp:coreProperties xmlns:cp="c" xmlns:dc="d" xmlns:dcterms="t"><dc:creator>Ion</dc:creator><cp:lastModifiedBy>Alt om</cp:lastModifiedBy><dcterms:created>2020-01-01T00:00:00Z</dcterms:created><dc:title></dc:title></cp:coreProperties>');
ok(JSON.stringify(other) === JSON.stringify({ author: 'Ion' }), 'fișier din alt program: doar autorul');

// Clasificarea (02.11): în docProps/custom.xml, citită înapoi; păstrată în .ssheet.
const lprops = { title: 'Salarii', label: 'strict' };
const lbytes = await M.writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells: { A1: '1' }, styles: {} }, results: {} }], 0, [], false, undefined, undefined, lprops);
const lzip = await JSZip.loadAsync(lbytes);
const lcustom = await lzip.file('docProps/custom.xml')?.async('string');
let lerrs = 0;
new DOMParser({ onError: () => { lerrs++; } }).parseFromString(lcustom ?? '', 'text/xml');
ok(lcustom && !lerrs && lcustom.includes('name="Clasificare"><vt:lpwstr>Strict confidențial</vt:lpwstr>'), 'clasificarea în custom.xml: ' + lcustom);
ok((await lzip.file('_rels/.rels').async('string')).includes('Target="docProps/custom.xml"') && (await lzip.file('[Content_Types].xml').async('string')).includes('/docProps/custom.xml'), 'clasificare: legătura și tipul fișierului');
const lr = await M.readXlsx(lbytes);
ok(lr.props?.label === 'strict' && lr.props?.title === 'Salarii', 'clasificarea citită înapoi: ' + JSON.stringify(lr.props));
ok(!(await JSZip.loadAsync(bytes)).file('docProps/custom.xml'), 'fără clasificare: fără custom.xml');
const ldoc = { ...M.emptySheetDoc(), title: 'Salarii', props: { label: 'public' } };
ok(M.parseSheetDoc(M.serializeSheetDoc(ldoc)).props?.label === 'public', '.ssheet păstrează clasificarea');

console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
