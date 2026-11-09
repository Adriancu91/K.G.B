// Test: foile late, până la 16.384 de coloane (A–XFD): celulele din coloana 1000 (ALL) și din ultima (XFD) trec dus-întors prin
// .xlsx, .ods și .csv, formulele cu coloane depărtate se calculează, ce trece de XFD se taie cu avertisment, iar lățimile
// date în fișier „până la ultima coloană” nu umplu foaia.
// Rulare (în suite/): node tests/sheet-wide.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';

// Pentru citirea .ods în Node (în aplicație e DOMParser-ul ferestrei).
globalThis.DOMParser ??= DOMParser;
{
  const d = new DOMParser().parseFromString('<a b="1"><c/></a>', 'text/xml');
  let p = Object.getPrototypeOf(d.documentElement);
  while (p && !Object.prototype.hasOwnProperty.call(p, 'appendChild')) p = Object.getPrototypeOf(p);
  if (!('children' in d.documentElement)) Object.defineProperty(p ?? Object.getPrototypeOf(d.documentElement), 'children', { get() { return Array.from(this.childNodes).filter((c) => c.nodeType === 1); }, configurable: true });
  for (const list of [d.childNodes, d.documentElement.attributes, d.getElementsByTagName('c')]) {
    const proto = Object.getPrototypeOf(list);
    if (!proto[Symbol.iterator]) proto[Symbol.iterator] = Array.prototype[Symbol.iterator];
  }
}

const dir = join(tmpdir(), `suite-wide-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/ods.ts', 'src/sheets/odsExport.ts', 'src/sheets/csv.ts', 'src/sheets/format.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { writeXlsx, readXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { readOds } = await import(pathToFileURL(join(dir, 'ods.js')).href);
const { writeOds } = await import(pathToFileURL(join(dir, 'odsExport.js')).href);
const { csvToCells, cellsToCsv } = await import(pathToFileURL(join(dir, 'csv.js')).href);
const { COLS, LAST_COL, colName, lastUsedCol } = await import(pathToFileURL(join(dir, 'format.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(dir, 'formula.js')).href);
rmSync(dir, { recursive: true, force: true });

assert.equal(COLS, 16384);
assert.equal(colName(COLS - 1), LAST_COL);
assert.equal(colName(999), 'ALL');
assert.equal(lastUsedCol({ A1: 'x', ALL5: 'y' }, { B2: {} }), 999);
assert.equal(lastUsedCol({}), -1);

const cells = { A1: 'Început', ALL1: 'Departe', AMJ2: '7', XFD2: '5', A3: '=ALL1&"!"', B3: '=SUM(A2:XFD2)' };
const res = evaluateAll(cells);
assert.equal(res.A3.text ?? res.A3.value, 'Departe!', 'formula citește coloana 1000');
assert.equal(res.B3.value, 12, 'suma până la XFD');

const sheet = { name: 'Lată', colW: { ALL: 150 }, cells, styles: { ALL1: { b: true } } };
const x = await readXlsx(await writeXlsx([{ sheet, results: res }]));
const s1 = x.sheets[0];
assert.equal(x.cut, false);
assert.equal(s1.cells.ALL1, 'Departe', '.xlsx: celula din coloana 1000');
assert.equal(s1.cells.AMJ2, '7', '.xlsx: coloana AMJ');
assert.equal(s1.styles.ALL1?.b, true, '.xlsx: aldinul');
assert.equal(s1.cells.XFD2, '5', '.xlsx: ultima coloană, XFD');
assert.equal(s1.cells.B3, '=SUM(A2:XFD2)', '.xlsx: formula');
assert.ok(Object.keys(s1.colW ?? {}).length < 50, '.xlsx: lățimile scrise doar pentru coloanele cu lățime proprie');

const o = await readOds(await writeOds([{ sheet, results: res }]));
assert.equal(o.sheets[0].cells.ALL1, 'Departe', '.ods: celula din coloana 1000');
assert.equal(o.sheets[0].cells.XFD2, '5', '.ods: ultima coloană, XFD');

const csv = cellsToCsv({ A1: 'a', ALL1: 'b' }, {}, {});
assert.equal(csv.split(';').length, 1000, '.csv: 1000 de câmpuri pe rând');
const back = csvToCells([Array.from({ length: 16390 }, (_, i) => (i === 999 ? 'z' : i === 16388 ? 'prea departe' : ''))]);
assert.equal(back.cells.ALL1, 'z', '.csv: coloana 1000 citită');
assert.equal(back.cut, true, '.csv: ce trece de XFD se taie cu avertisment');

console.log('foile late (16.384 de coloane): toate verificările trec');
