// Test pentru scenariile din Sheets în .xlsx (<scenarios> / <inputCells>): scrise în ordinea cerută, citite înapoi.
// Rulare (în suite/): node tests/sheets-scenario-xlsx.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const dir = join(tmpdir(), `suite-scxlsx-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const cells = { B1: '10', B2: '100', B3: '=B1*B2' };
const scenarios = [{ name: 'Optimist & co', cells: { B1: '12,5', B2: '150' }, note: 'vara "bună"' }, { name: 'Pesimist', cells: { B1: '8', B2: 'puțin' } }];
const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {}, scenarios, protect: true, merges: ['D1:E1'] }, results: {} }]);
const xml = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
let errs = 0;
new DOMParser({ onError: () => { errs++; } }).parseFromString(xml, 'text/xml');
ok(!errs, 'foaia rămâne XML valid');
const order = ['</sheetData>', '<sheetProtection', '<scenarios', '<mergeCells'].map((t) => xml.indexOf(t));
ok(order.every((p, i) => p > 0 && (i === 0 || p > order[i - 1])), 'ordinea din specificație: sheetData, sheetProtection, scenarios, mergeCells (' + order.join(', ') + ')');
ok(xml.includes('<scenario name="Optimist &amp; co" count="2" comment="vara &quot;bună&quot;"><inputCells r="B1" val="12.5"/><inputCells r="B2" val="150"/></scenario>'), 'scenariul scris cu numărul cu punct');
const back = (await readXlsx(bytes)).sheets[0];
const want = [{ name: 'Optimist & co', cells: { B1: '12.5', B2: '150' }, note: 'vara "bună"' }, { name: 'Pesimist', cells: { B1: '8', B2: 'puțin' } }];
ok(JSON.stringify(back.scenarios) === JSON.stringify(want), 'citite înapoi: ' + JSON.stringify(back.scenarios));
const none = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {} }, results: {} }]);
ok(!(await (await JSZip.loadAsync(none)).file('xl/worksheets/sheet1.xml').async('string')).includes('<scenarios'), 'fără scenarii nu apare <scenarios>');
ok(!(await readXlsx(none)).sheets[0].scenarios, 'și nici la citire');
console.log(fail ? `${fail} GREȘELI` : 'TOATE OK');
process.exit(fail ? 1 : 0);
