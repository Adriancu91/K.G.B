// Test pentru tabelele de date din Sheets în .xlsx (<f t="dataTable" ref r1 r2 dtr dt2D/> în prima celulă de rezultat): scrise și citite înapoi.
// Rulare (în suite/): node tests/sheets-datatable-xlsx.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const dir = join(tmpdir(), `suite-dtxlsx-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
// Cu o variabilă pe coloană (D1:E4, intrarea A1) și cu două variabile (G1:I3, intrările B1 pe rând și A1 pe coloană).
const cells = { A1: '0,05', B1: '200000', E1: '=A1*B1', D2: '0,04', D3: '0,05', D4: '0,06', E2: '8000', E3: '10000', E4: '12000',
  G1: '=A1*B1', H1: '100', I1: '200', G2: '0,1', G3: '0,2', H2: '10', I2: '20', H3: '20', I3: '40' };
const dataTables = [{ zone: 'D1:E4', col: 'A1' }, { zone: 'G1:I3', row: 'B1', col: 'A1' }];
const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {}, dataTables }, results: {} }]);
const xml = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
let errs = 0;
new DOMParser({ onError: () => { errs++; } }).parseFromString(xml, 'text/xml');
ok(!errs, 'foaia rămâne XML valid');
ok(xml.includes('<c r="E2"><f t="dataTable" ref="E2:E4" dt2D="0" dtr="0" r1="A1"/><v>8000</v></c>'), 'cu o variabilă: formula tabelului în E2, cu zona E2:E4 și intrarea A1');
ok(xml.includes('<c r="H2"><f t="dataTable" ref="H2:I3" dt2D="1" dtr="1" r1="B1" r2="A1"/><v>10</v></c>'), 'cu două variabile: în H2, r1 = intrarea din rând, r2 = cea din coloană');
ok(!/<c r="E3"><f/.test(xml) && xml.includes('<c r="E3"><v>10000</v></c>'), 'celelalte rezultate rămân valori');
const back = (await readXlsx(bytes)).sheets[0];
ok(JSON.stringify(back.dataTables) === JSON.stringify(dataTables), 'citite înapoi: ' + JSON.stringify(back.dataTables));
ok(back.cells.E2 === '8000' && back.cells.I3 === '40', 'valorile rezultatelor rămân: ' + back.cells.E2 + ', ' + back.cells.I3);
// Pe rând (o variabilă, valorile în primul rând): dtr="1".
const row = await writeXlsx([{ sheet: { name: 'F', colW: {}, cells: { A1: '1', C1: '2', D1: '3', B2: '=A1*2', C2: '4', D2: '6' }, styles: {}, dataTables: [{ zone: 'B1:D2', row: 'A1' }] }, results: {} }]);
const rx = await (await JSZip.loadAsync(row)).file('xl/worksheets/sheet1.xml').async('string');
ok(rx.includes('<f t="dataTable" ref="C2:D2" dt2D="0" dtr="1" r1="A1"/>'), 'pe rând: dtr="1"');
ok(JSON.stringify((await readXlsx(row)).sheets[0].dataTables) === JSON.stringify([{ zone: 'B1:D2', row: 'A1' }]), 'pe rând: citit înapoi');
const none = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {} }, results: {} }]);
ok(!(await (await JSZip.loadAsync(none)).file('xl/worksheets/sheet1.xml').async('string')).includes('dataTable'), 'fără tabele de date nu apare dataTable');
ok(!(await readXlsx(none)).sheets[0].dataTables, 'și nici la citire');
console.log(fail ? `${fail} GREȘELI` : 'TOATE OK');
process.exit(fail ? 1 : 0);
