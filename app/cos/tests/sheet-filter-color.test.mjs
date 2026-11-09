// Test pentru „Filtrează după culoare” din Sheets: culoarea fundalului / textului, lista de culori, .xlsx dus-întors.
// Rulare (în suite/): node tests/sheet-filter-color.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-fcolor-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/filter.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { hiddenRows, columnColors } = await import(pathToFileURL(join(dir, 'filter.js')).href);
const { parseSheetDoc, serializeSheetDoc } = await import(pathToFileURL(join(dir, 'format.js')).href);
rmSync(dir, { recursive: true, force: true });

let n = 0;
const cells = { A1: 'Client', B1: 'Sumă', A2: 'Ana', B2: '500', A3: 'Dan', B3: '1500', A4: 'Ion', B4: '2500', A5: 'Eva', B5: '3000' };
const styles = { A2: { bg: '#ffff00' }, A4: { bg: '#ffff00' }, A5: { bg: '#ff0000', color: '#c00000' }, B3: { color: '#c00000' } };
const base = { r: 0, c0: 0, c1: 1, hidden: {} };
const rows = (f) => [...hiddenRows(cells, {}, styles, f)].sort((a, b) => a - b);

// 1. Fundal galben: rămân Ana (2) și Ion (4).
eq(rows({ ...base, color: { A: { kind: 'bg', color: '#ffff00' } } }), [2, 4], 'fundal galben');
// 2. Fără fundal: rămâne doar Dan (3).
eq(rows({ ...base, color: { A: { kind: 'bg', color: 'none' } } }), [1, 3, 4], 'fără fundal');
// 3. Text roșu pe coloana B: rămâne doar Dan.
eq(rows({ ...base, color: { B: { kind: 'fg', color: '#c00000' } } }), [1, 3, 4], 'text roșu');
// 4. Lista de culori: fundalul are 3 culori (cea mai deasă prima, „fără” la final); textul coloanei A are 2.
const cc = columnColors(cells, {}, styles, base, 0);
eq(cc.bg.map((x) => x.color), ['#ffff00', '#ff0000', 'none'], 'culorile de fundal');
eq(cc.bg[0].count, 2, 'galben de 2 ori');
eq(cc.fg.map((x) => x.color), ['#c00000', 'none'], 'culorile textului');
// 5. O coloană toată la fel nu are listă (n-ai după ce filtra).
eq(columnColors({ ...cells }, {}, {}, base, 1), { bg: [], fg: [] }, 'fără culori');
// 6. Se păstrează în fișierul nostru.
const doc = parseSheetDoc(serializeSheetDoc({ format: 'suite-sheet', version: 1, sheets: [{ name: 'Foaia 1', colW: {}, cells, styles, filter: { ...base, color: { A: { kind: 'bg', color: '#ffff00' } } } }], active: 0 }));
eq(doc.sheets[0].filter.color, { A: { kind: 'bg', color: '#ffff00' } }, 'în .ssheet');
// Butoanele de filtrare (Slicer) se păstrează în fișierul nostru; valorile greșite se scot.
const sl = parseSheetDoc(serializeSheetDoc({ format: 'suite-sheet', version: 1, sheets: [{ name: 'Foaia 1', colW: {}, cells, styles: {}, filter: base, slicers: ['A', 'B', 'A', 'x1', 5] }], active: 0 }));
eq(sl.sheets[0].slicers, ['A', 'B'], 'butoanele de filtrare în .ssheet');
// 7. .xlsx dus-întors: <colorFilter dxfId=…>, pentru fundal și pentru text.
for (const fc of [{ A: { kind: 'bg', color: '#ffff00' } }, { B: { kind: 'fg', color: '#c00000' } }, { A: { kind: 'bg', color: 'none' } }]) {
  const f = { ...base, color: fc };
  const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles, filter: f }, results: {} }]);
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
  const st = await zip.file('xl/styles.xml').async('string');
  n++; assert.match(xml, /<colorFilter dxfId="\d+"/, 'colorFilter scris');
  n++; assert.match(st, /<dxfs count="\d+">/, 'dxf-urile scrise');
  const back = (await readXlsx(bytes)).sheets[0];
  eq(back.filter.color, fc, 'dus-întors ' + JSON.stringify(fc));
  eq([...hiddenRows(back.cells, {}, back.styles, back.filter)].sort((a, b) => a - b), rows(f), 'aceleași rânduri ascunse');
  eq(back.hideRows ?? [], [], 'rândurile ascunse de filtru nu devin ascunse de mână');
}
console.log(`filtrul după culoare: ${n} verificări trec`);

function eq(a, b, msg) { n++; assert.deepEqual(a, b, msg); }

