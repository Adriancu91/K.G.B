// Test: Rezumat (tabel pivot) cu grupuri alese de mână pe rânduri („Nord” = Cluj + Iași): rândul grupului adună elementele,
// categoriile negrupate rămân, merge cu grupare pe coloane, cu procente, cu Medie / Maxim, cu filtrul de raport și cu mai multe valori.
// Rulare (în suite/): node tests/pivot-textgroup.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pvtg-${process.pid}`);
await build({ entryPoints: ['src/sheets/pivot.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { buildPivot } = await import(pathToFileURL(join(out, 'pivot.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
// Oraș, Agent, Suma.
const src = { name: 'Date', cells: {
  A1: 'Oraș', B1: 'Agent', C1: 'Suma',
  A2: 'Cluj', B2: 'Ana', C2: '10', A3: 'Iași', B3: 'Dan', C3: '20', A4: 'Brașov', B4: 'Ana', C4: '30',
  A5: 'Cluj', B5: 'Dan', C5: '40', A6: 'Timiș', B6: 'Ana', C6: '50', A7: 'iași', B7: 'Ana', C7: '5',
}, styles: {} };
const range = { r0: 0, c0: 0, r1: 6, c1: 2 };
const make = (spec) => {
  const pv = buildPivot(src, {}, { range, ...spec }, 'Rezumat');
  const cells = pv.sheet.cells;
  const res = evaluateAll(cells, { self: 'Rezumat', sheets: [src, { ...pv.sheet, cells }], pivots: [pv.pivot] });
  const v = (id) => { const r = res[id]; return r?.value !== undefined && r?.num ? Math.round(r.value * 1000) / 1000 : r?.text ?? cells[id]; };
  return { pv, v };
};
const nord = [{ name: 'Nord', items: ['Cluj', 'Iași'] }];

let { v } = make({ rowCol: 0, valCol: 2, op: 'sum', rowGroups: nord });
// Ordinea: Brașov, Nord (în locul lui Cluj), Timiș.
check(v('A5') === 'Brașov' && v('A6') === 'Nord' && v('A7') === 'Timiș' && v('A8') === 'Total', `rândurile: ${v('A5')}, ${v('A6')}, ${v('A7')}, ${v('A8')}`);
check(v('B5') === 30 && v('B6') === 75 && v('B7') === 50 && v('B8') === 155, `sumele: ${v('B5')} ${v('B6')} ${v('B7')} ${v('B8')}`);

({ v } = make({ rowCol: 0, valCol: 2, op: 'count', rowGroups: nord }));
check(v('B6') === 4 && v('B8') === 6, `Număr: Nord ${v('B6')}, Total ${v('B8')}`);

({ v } = make({ rowCol: 0, valCol: 2, op: 'avg', rowGroups: nord }));
check(v('B6') === 18.75, `Medie: Nord ${v('B6')}`);
({ v } = make({ rowCol: 0, valCol: 2, op: 'max', rowGroups: nord }));
check(v('B6') === 40 && v('B5') === 30, `Maxim: Nord ${v('B6')}, Brașov ${v('B5')}`);

({ v } = make({ rowCol: 0, valCol: 2, op: 'sum', show: 'pctTotal', rowGroups: nord }));
check(Math.abs(v('B6') - 75 / 155) < 0.001, `% din total: Nord ${v('B6')}`);

// Pe coloane Agent: Ana / Dan / Total.
({ v } = make({ rowCol: 0, colCol: 1, valCol: 2, op: 'sum', rowGroups: nord }));
check(v('B4') === 'Ana' && v('C4') === 'Dan' && v('A6') === 'Nord', `capul: ${v('B4')} ${v('C4')}, ${v('A6')}`);
check(v('B6') === 15 && v('C6') === 60 && v('D6') === 75, `Nord pe agenți: ${v('B6')} ${v('C6')} ${v('D6')}`);
({ v } = make({ rowCol: 0, colCol: 1, valCol: 2, op: 'sum', show: 'pctRow', rowGroups: nord }));
check(Math.abs(v('B6') - 0.2) < 0.001, `% din rând: Nord / Ana ${v('B6')}`);

// Două grupuri; o categorie numită de amândouă rămâne la primul.
({ v } = make({ rowCol: 0, valCol: 2, op: 'sum', rowGroups: [{ name: 'Nord', items: ['Cluj', 'Iași'] }, { name: 'Restul', items: ['Brașov', 'Timiș', 'Cluj'] }] }));
check(v('A5') === 'Restul' && v('B5') === 80 && v('A6') === 'Nord' && v('B6') === 75 && v('A7') === 'Total', `două grupuri: ${v('A5')} ${v('B5')}, ${v('A6')} ${v('B6')}, ${v('A7')}`);

// Filtrul de raport (Agent): Ana.
({ v } = make({ rowCol: 0, valCol: 2, op: 'sum', filterCol: 1, rowGroups: nord }));
check(v('A6') === 'Nord' && v('B6') === 75, `filtru (Toate): ${v('B6')}`);
{
  const pv = buildPivot(src, {}, { range, rowCol: 0, valCol: 2, op: 'sum', filterCol: 1, rowGroups: nord }, 'Rezumat');
  const cells = { ...pv.sheet.cells, B3: 'Ana' };
  const res = evaluateAll(cells, { self: 'Rezumat', sheets: [src, { ...pv.sheet, cells }], pivots: [pv.pivot] });
  check(res.B6?.value === 15, `filtru Ana: Nord ${res.B6?.value}`);
}

// Mai multe valori: Sumă și Maxim.
({ v } = make({ rowCol: 0, valCol: 2, op: 'sum', more: [{ valCol: 2, op: 'max' }], rowGroups: nord }));
check(v('B6') === 75 && v('C6') === 40, `două valori: ${v('B6')} ${v('C6')}`);

// Grupul gol sau fără nume nu schimbă nimic; cu grupare pe intervale grupurile de mână nu se aplică.
({ v } = make({ rowCol: 0, valCol: 2, op: 'sum', rowGroups: [{ name: '', items: ['Cluj'] }, { name: 'X', items: [] }] }));
check(v('A5') === 'Brașov' && v('A6') === 'Cluj', `grupuri goale: ${v('A5')} ${v('A6')}`);

// Ghilimelele din nume de categorii.
{
  const s2 = { name: 'Date', cells: { A1: 'Firma', B1: 'Suma', A2: 'SC "Alfa" SRL', B2: '7', A3: 'Beta', B3: '3', A4: 'Gama', B4: '1' }, styles: {} };
  const pv = buildPivot(s2, {}, { range: { r0: 0, c0: 0, r1: 3, c1: 1 }, rowCol: 0, valCol: 1, op: 'sum', rowGroups: [{ name: 'Mari', items: ['SC "Alfa" SRL', 'Beta'] }] }, 'Rezumat');
  const res = evaluateAll(pv.sheet.cells, { self: 'Rezumat', sheets: [s2, pv.sheet], pivots: [pv.pivot] });
  const row = ['A5', 'A6'].find((a) => pv.sheet.cells[a] === 'Mari');
  check(row && res['B' + row.slice(1)]?.value === 10, `ghilimele: ${row} ${row && res['B' + row.slice(1)]?.value}`);
}

console.log(bad ? `\n${bad} GRESITE` : '\nTOATE OK');
process.exit(bad ? 1 : 0);
