// Test pentru filtrele din Sheets în .xlsx: valorile debifate, condițiile, rândurile ascunse, dus-întors.
// Rulare (în suite/): node tests/sheet-filter-xlsx.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-fxlsx-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/filter.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { hiddenRows } = await import(pathToFileURL(join(dir, 'filter.js')).href);
rmSync(dir, { recursive: true, force: true });

let n = 0;
const eq = (a, b, msg) => { n++; assert.deepEqual(a, b, msg); };
const cells = { A1: 'Oraș', B1: 'Sumă', A2: 'Cluj', B2: '500', A3: 'Iași', B3: '1500', A4: 'Cluj', B4: '2500', A5: 'Arad', B5: '3000' };
const roundTrip = async (filter, extra = {}) => {
  const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {}, filter, ...extra }, results: {} }]);
  const xml = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
  return { back: (await readXlsx(bytes)).sheets[0], xml };
};

// 1. Valori debifate: Iași ascuns.
{
  const f = { r: 0, c0: 0, c1: 1, hidden: { A: ['Iași'] } };
  const { back, xml } = await roundTrip(f);
  n++; assert.match(xml, /<autoFilter ref="A1:B5"><filterColumn colId="0"><filters><filter val="Arad"\/><filter val="Cluj"\/><\/filters><\/filterColumn><\/autoFilter>/);
  n++; assert.match(xml, /<row r="3"[^>]* hidden="1"/, 'rândul cu Iași e ascuns în Excel');
  eq(back.filter, f, 'dus-întors bife');
  eq(back.hideRows ?? [], [], 'rândurile ascunse de filtru nu devin ascunse de mână');
}
// 2. Condiții: mai mare decât 1000, între, conține, primele N, peste medie.
for (const cond of [{ op: 'gt', v1: '1000' }, { op: 'between', v1: '1000', v2: '2600' }, { op: 'text', v1: 'lu' }, { op: 'top', v1: '2' }, { op: 'below', v1: '' }, { op: 'ne', v1: '500' }]) {
  const f = { r: 0, c0: 0, c1: 1, hidden: {}, cond: { [cond.op === 'text' ? 'A' : 'B']: cond } };
  const { back } = await roundTrip(f);
  eq(back.filter, f, 'dus-întors ' + cond.op);
  const want = [...hiddenRows(cells, {}, {}, f)].sort();
  eq([...hiddenRows(back.cells, {}, back.styles, back.filter)].sort(), want, 'aceleași rânduri ascunse ' + cond.op);
}
// 3. Filtru fără nimic ales: doar ▾ în capul de tabel.
{
  const { back, xml } = await roundTrip({ r: 0, c0: 0, c1: 1, hidden: {} });
  n++; assert.match(xml, /<autoFilter ref="A1:B5"\/>/);
  eq(back.filter, { r: 0, c0: 0, c1: 1, hidden: {} }, 'filtru gol');
}
// 4. Celula goală debifată / lăsată la vedere (blank="1").
{
  const f = { r: 0, c0: 0, c1: 1, hidden: { A: ['Arad', 'Iași'] } };
  const c2 = { ...cells, A6: '', B6: '7' };
  const bytes = await writeXlsx([{ sheet: { name: 'F', colW: {}, cells: c2, styles: {}, filter: f }, results: {} }]);
  const back = (await readXlsx(bytes)).sheets[0];
  eq({ ...back.filter, hidden: { A: [...back.filter.hidden.A].sort() } }, f, 'golul rămâne la vedere');
}
// 5. Fără filtru: nimic în plus.
{
  const bytes = await writeXlsx([{ sheet: { name: 'F', colW: {}, cells, styles: {} }, results: {} }]);
  const xml = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
  n++; assert.ok(!xml.includes('autoFilter'));
  eq((await readXlsx(bytes)).sheets[0].filter, undefined, 'fără filtru');
}

console.log(`sheet-filter-xlsx: ${n} verificări trecute`);
