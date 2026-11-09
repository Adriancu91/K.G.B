// Test pentru Tabel de date (What-If) din Sheets: cu o variabilă (pe coloană și pe rând) și cu două variabile.
// Rulare (în suite/): node tests/sheets-datatable.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-datatable-${process.pid}`);
await build({ entryPoints: ['src/sheets/datatable.ts', 'src/sheets/formula.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { planDataTable, MAX_DT_CELLS, cleanDataTables, MAX_DATA_TABLES } = await import(pathToFileURL(join(dir, 'datatable.js')).href);
const { parseSheetDoc } = await import(pathToFileURL(join(dir, 'format.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(dir, 'formula.js')).href);
rmSync(dir, { recursive: true, force: true });

const id = (r, c) => String.fromCharCode(65 + c) + (r + 1);
// Ca în Sheets: fiecare celulă primește formula calculată cu valorile de pe margine puse în celulele de intrare.
const run = (cells, z, rowIn, colIn) => {
  const jobs = planDataTable(z, rowIn, colIn);
  if (typeof jobs === 'string') return jobs;
  const out = {};
  for (const j of jobs) {
    const f = id(j.formula.r, j.formula.c);
    if (!(cells[f] ?? '').startsWith('=')) continue;
    const over = { ...cells };
    for (const k of j.inputs) over[k.cell] = cells[id(k.value.r, k.value.c)] ?? '';
    const r = evaluateAll(over, undefined, undefined, [f])[f];
    out[id(j.r, j.c)] = r.err ?? (r.num ? r.value : r.text);
  }
  return out;
};
let n = 0;
const near = (a, b, msg) => { n++; assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} în loc de ${b}`); };

// 1. O variabilă pe coloană: dobânzile în D2:D4, două formule în E1 (rata) și F1 (rata × 12).
{
  const cells = { A1: '0,05', A2: '240', A3: '200000', B1: '=-PMT(A1/12;A2;A3)',
    E1: '=B1', F1: '=B1*12', D2: '0,04', D3: '0,05', D4: '0,06' };
  const out = run(cells, { r0: 0, c0: 3, r1: 3, c1: 5 }, null, 'A1');
  const pmt = (i) => 200000 * (i / 12) / (1 - (1 + i / 12) ** -240);
  near(out.E2, pmt(0.04), 'E2'); near(out.E3, pmt(0.05), 'E3'); near(out.E4, pmt(0.06), 'E4');
  near(out.F4, pmt(0.06) * 12, 'F4');
  assert.equal(Object.keys(out).length, 6); n++;
  // Celula de intrare nu se schimbă de fapt.
  assert.equal(cells.A1, '0,05'); n++;
}
// 2. O variabilă pe rând: valorile în B1:D1, formula în A2.
{
  const cells = { F1: '3', A2: '=F1*F1', B1: '1', C1: '2', D1: '10' };
  const out = run(cells, { r0: 0, c0: 0, r1: 1, c1: 3 }, 'F1', null);
  assert.deepEqual(out, { B2: 1, C2: 4, D2: 100 }); n++;
}
// 3. Două variabile: formula în colț (A1), dobânzi în A2:A3, ani în B1:C1.
{
  const cells = { H1: '0,05', H2: '20', A1: '=-PMT(H1/12;H2*12;100000)', A2: '0,03', A3: '0,07', B1: '10', C1: '30' };
  const out = run(cells, { r0: 0, c0: 0, r1: 2, c1: 2 }, 'H2', 'H1');
  const pmt = (i, y) => 100000 * (i / 12) / (1 - (1 + i / 12) ** -(y * 12));
  near(out.B2, pmt(0.03, 10), 'B2'); near(out.C2, pmt(0.03, 30), 'C2');
  near(out.B3, pmt(0.07, 10), 'B3'); near(out.C3, pmt(0.07, 30), 'C3');
}
// 4. Erori din formulă se scriu ca erori; zonă greșită și fără celule de intrare dau mesaje.
{
  const cells = { A1: '1', B1: '=10/A1', D2: '0', D3: '5' , E1: '=B1' };
  const out = run(cells, { r0: 0, c0: 3, r1: 2, c1: 4 }, null, 'A1');
  assert.equal(out.E2, '#DIV/0!'); assert.equal(out.E3, 2); n += 2;
  assert.match(run(cells, { r0: 0, c0: 0, r1: 0, c1: 3 }, null, 'A1'), /2 × 2/); n++;
  assert.match(run(cells, { r0: 0, c0: 0, r1: 2, c1: 2 }, null, null), /cel puțin o celulă/); n++;
  assert.match(planDataTable({ r0: 0, c0: 0, r1: 200, c1: 100 }, null, 'Z1'), /prea mare/); n++;
  assert.ok(MAX_DT_CELLS >= 1000); n++;
}
// Tabelul ținut minte în foaie (se recalculează singur): curățarea din fișier și păstrarea în .ssheet.
{
  assert.deepEqual(cleanDataTables([{ zone: 'D1:E4', col: 'A1' }, { zone: 'D1', col: 'A1' }, { zone: 'A1:B2' }, { zone: 'A1:C3', row: 'b1', col: 'Z9' }, 5, null]),
    [{ zone: 'D1:E4', col: 'A1' }, { zone: 'A1:C3', col: 'Z9' }]); n++;
  assert.deepEqual(cleanDataTables('x'), []); n++;
  assert.equal(cleanDataTables(Array.from({ length: 50 }, () => ({ zone: 'A1:B2', row: 'C1' }))).length, MAX_DATA_TABLES); n++;
  const doc = parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, sheets: [{ name: 'Foaia1', cells: { A1: '1' }, styles: {}, dataTables: [{ zone: 'D1:E4', col: 'A1' }] }] }));
  assert.deepEqual(doc.sheets[0].dataTables, [{ zone: 'D1:E4', col: 'A1' }]); n++;
}
console.log(`OK: ${n} verificări pentru Tabel de date`);
