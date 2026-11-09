// Test: Rezumat (tabel pivot) cu două câmpuri pe coloane: două rânduri de cap, subtotalul fiecărui grup („Cluj Total”),
// coloana și rândul Total, procentele din total / rând / coloană, fără subtotaluri și GETPIVOTDATA pe ambele câmpuri.
// Rulare (în suite/): node tests/pivot-cols2.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pvc2-${process.pid}`);
await build({ entryPoints: ['src/sheets/pivot.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { buildPivot, COLS2_SHOWS } = await import(pathToFileURL(join(out, 'pivot.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
// Oraș, Produs, Agent, Suma.
const src = { name: 'Date', cells: {
  A1: 'Oraș', B1: 'Produs', C1: 'Agent', D1: 'Suma',
  A2: 'Cluj', B2: 'mere', C2: 'Ana', D2: '10', A3: 'Cluj', B3: 'pere', C3: 'Ana', D3: '20', A4: 'Cluj', B4: 'mere', C4: 'Dan', D4: '30',
  A5: 'Iași', B5: 'mere', C5: 'Ana', D5: '40', A6: 'Iași', B6: 'prune', C6: 'Dan', D6: '50',
}, styles: {} };
const range = { r0: 0, c0: 0, r1: 5, c1: 3 };
const make = (spec, extra = {}) => {
  const pv = buildPivot(src, {}, { range, ...spec }, 'Rezumat');
  const cells = { ...pv.sheet.cells, ...extra };
  const res = evaluateAll(cells, { self: 'Rezumat', sheets: [src, { ...pv.sheet, cells }], pivots: [pv.pivot] });
  const v = (id) => { const r = res[id]; return r?.value !== undefined && r?.num ? Math.round(r.value * 1000) / 1000 : r?.text ?? cells[id]; };
  return { pv, v };
};
const base = { rowCol: 2, colCol: 0, colCol2: 1, valCol: 3, op: 'sum' };

check(COLS2_SHOWS('value') && COLS2_SHOWS('pctCol') && !COLS2_SHOWS('rankDesc') && !COLS2_SHOWS('running'), 'variantele permise');
let { pv, v } = make(base);
check(v('B4') === 'Cluj' && v('D4') === 'Cluj Total' && v('E4') === 'Iași' && v('G4') === 'Iași Total' && v('H4') === 'Total', `primul rând de cap: ${v('B4')}, ${v('D4')}, ${v('E4')}, ${v('G4')}, ${v('H4')}`);
check(v('A4') === 'Sumă din Suma' && v('A5') === 'Agent' && v('B5') === 'mere' && v('C5') === 'pere' && v('E5') === 'mere' && v('F5') === 'prune', `al doilea rând de cap: ${v('B5')}, ${v('C5')}, ${v('E5')}, ${v('F5')}`);
check(v('A6') === 'Ana' && v('B6') === 10 && v('C6') === 20 && v('D6') === 30 && v('E6') === 40 && v('F6') === 0 && v('G6') === 40 && v('H6') === 70, `Ana: ${v('B6')} ${v('C6')} ${v('D6')} ${v('E6')} ${v('F6')} ${v('G6')} ${v('H6')}`);
check(v('A7') === 'Dan' && v('B7') === 30 && v('C7') === 0 && v('D7') === 30 && v('F7') === 50 && v('G7') === 50 && v('H7') === 80, `Dan: ${v('B7')} ${v('D7')} ${v('F7')} ${v('G7')} ${v('H7')}`);
check(v('A8') === 'Total' && v('B8') === 40 && v('C8') === 20 && v('D8') === 60 && v('G8') === 90 && v('H8') === 150, `Total: ${v('B8')} ${v('D8')} ${v('G8')} ${v('H8')}`);
check(pv.pivot.target === 'A4:H8' && pv.pivot.cols.join() === 'Oraș,Produs' && pv.chartRange === 'A5:H7', `zona ${pv.pivot.target}, coloane ${pv.pivot.cols}, grafic ${pv.chartRange}`);
check(pv.sheet.cells.A1.includes('„Oraș” / „Produs”'), 'titlul: ' + pv.sheet.cells.A1);
check(pv.sheet.styles.D6?.b === true && pv.sheet.styles.B6?.b !== true, 'subtotalul îngroșat');
// GETPIVOTDATA pe ambele câmpuri de pe coloane și pe cel de pe rânduri.
({ v } = make(base, { K1: '=GETPIVOTDATA("Suma";A4;"Oraș";"Cluj";"Produs";"mere";"Agent";"Ana")', K2: '=GETPIVOTDATA("Suma";A4;"Oraș";"Iași")' }));
check(v('K1') === 10 && v('K2') === 90, `GETPIVOTDATA: ${v('K1')}, ${v('K2')}`);
// Procentele.
({ v } = make({ ...base, show: 'pctTotal' }));
check(v('B6') === 0.067 && v('D6') === 0.2 && v('H6') === 0.467 && v('H8') === 1, `% din total: ${v('B6')} ${v('D6')} ${v('H6')} ${v('H8')}`);
({ v } = make({ ...base, show: 'pctCol' }));
check(v('B6') === 0.25 && v('D6') === 0.5 && v('B8') === 1 && v('H6') === 0.467 && v('H8') === 1, `% din coloană: ${v('B6')} ${v('D6')} ${v('B8')} ${v('H6')}`);
({ v } = make({ ...base, show: 'pctRow' }));
check(v('B6') === 0.143 && v('H6') === 1 && v('B8') === 0.267 && v('G8') === 0.6, `% din rând: ${v('B6')} ${v('H6')} ${v('B8')} ${v('G8')}`);
// Fără subtotaluri: doar perechile și Total.
({ pv, v } = make({ ...base, subtotals: false }));
check(v('B5') === 'mere' && v('C5') === 'pere' && v('D4') === 'Iași' && v('D5') === 'mere' && v('E5') === 'prune' && v('F4') === 'Total' && v('F6') === 70 && v('F8') === 150, `fără subtotaluri: ${v('D4')} ${v('E5')} ${v('F6')}`);
// Fără coloana Total din dreapta.
({ pv, v } = make({ ...base, totals: 'cols' }));
check(v('H4') === undefined && v('G8') === 90 && pv.pivot.target === 'A4:G8', `fără coloana Total: zona ${pv.pivot.target}`);
// Număr.
({ v } = make({ ...base, op: 'count' }));
check(v('B6') === 1 && v('D7') === 1 && v('H8') === 5, `număr: ${v('B6')} ${v('D7')} ${v('H8')}`);
// Rangul nu merge cu două câmpuri pe coloane: rămâne un singur câmp pe coloane.
({ pv, v } = make({ ...base, show: 'rankDesc' }));
check(pv.pivot.cols.join() === 'Oraș' && v('B4') === 'Cluj' && v('C4') === 'Iași', 'rangul: un singur câmp pe coloane');
// Cu filtrul de raport pe Produs nu se poate (e pe coloane), deci se ignoră; cu filtru pe altă coloană nu e niciuna liberă.
({ pv } = make({ ...base, filterCol: 1 }));
check(!pv.sheet.lists, 'filtrul pe un câmp de pe coloane se ignoră');
// Mai multe valori cu un câmp pe coloane: în fiecare oraș câte o coloană pe valoare, apoi Total pe fiecare valoare.
({ pv, v } = make({ rowCol: 2, colCol: 0, valCol: 3, op: 'sum', more: [{ valCol: 3, op: 'count' }] }, { K1: '=GETPIVOTDATA("Număr din Suma";A4;"Oraș";"Cluj";"Agent";"Ana")' }));
check(v('A4') === undefined && v('B4') === 'Cluj' && v('D4') === 'Iași' && v('F4') === 'Total' && v('A5') === 'Agent' && v('B5') === 'Sumă din Suma' && v('C5') === 'Număr din Suma' && v('G5') === 'Număr din Suma', `valori pe coloane, capul: ${v('B4')} ${v('D4')} ${v('F4')} / ${v('B5')} ${v('C5')}`);
check(v('A6') === 'Ana' && v('B6') === 30 && v('C6') === 2 && v('D6') === 40 && v('E6') === 1 && v('F6') === 70 && v('G6') === 3, `valori pe coloane, Ana: ${v('B6')} ${v('C6')} ${v('D6')} ${v('E6')} ${v('F6')} ${v('G6')}`);
check(v('A8') === 'Total' && v('B8') === 60 && v('C8') === 3 && v('E8') === 2 && v('F8') === 150 && v('G8') === 5, `valori pe coloane, Total: ${v('B8')} ${v('C8')} ${v('F8')} ${v('G8')}`);
check(pv.pivot.target === 'A4:G8' && pv.pivot.data.length === 2 && v('K1') === 2 && pv.chartRange === 'A5:G7', `valori pe coloane: zona ${pv.pivot.target}, GETPIVOTDATA ${v('K1')}`);
check(pv.sheet.cells.A1.startsWith('Rezumat pe „Agent” și „Oraș”: Sumă din „Suma”, Număr din „Suma”'), 'titlul: ' + pv.sheet.cells.A1);
({ pv, v } = make({ rowCol: 2, colCol: 0, valCol: 3, op: 'sum', more: [{ valCol: 3, op: 'max' }], totals: 'cols' }));
check(v('F4') === undefined && v('C8') === 30 && v('E8') === 50 && pv.pivot.target === 'A4:E8', `valori pe coloane fără coloana Total: maxim ${v('C8')} / ${v('E8')}`);
// Cu două câmpuri pe coloane, valorile în plus nu se pun.
({ pv } = make({ ...base, more: [{ valCol: 3, op: 'count' }] }));
check(pv.pivot.data.length === 1 && pv.pivot.cols.length === 2, 'două câmpuri pe coloane: o singură valoare');
// Gruparea coloanelor: datele pe luni / trimestre, numerele pe intervale.
const src2 = { name: 'Date', cells: { A1: 'Agent', B1: 'Data', C1: 'Suma', A2: 'Ana', B2: '45658', C2: '10', A3: 'Ana', B3: '45689', C3: '20',
  A4: 'Dan', B4: '45690', C4: '30', A5: 'Dan', B5: '45720', C5: '40' }, styles: { B2: { fmt: 'date' } } };
const make2 = (spec) => {
  const pv = buildPivot(src2, {}, { range: { r0: 0, c0: 0, r1: 4, c1: 2 }, ...spec }, 'Rezumat');
  const res = evaluateAll(pv.sheet.cells, { self: 'Rezumat', sheets: [src2, pv.sheet] });
  return { pv, v: (id) => { const r = res[id]; return r?.value !== undefined && r?.num ? Math.round(r.value * 1000) / 1000 : r?.text ?? pv.sheet.cells[id]; } };
};
({ pv, v } = make2({ rowCol: 0, colCol: 1, colGroup: 'month', valCol: 2, op: 'sum' }));
check(/2025$/.test(v('B4')) && /2025$/.test(v('D4')) && v('E4') === 'Total' && pv.sheet.styles.B4?.fmt === undefined, `coloane pe luni, capul: ${v('B4')} | ${v('C4')} | ${v('D4')} | ${v('E4')}`);
check(v('B5') === 10 && v('C5') === 20 && v('D5') === 0 && v('E5') === 30 && v('C6') === 30 && v('D6') === 40 && v('E7') === 100 && v('C7') === 50, `coloane pe luni: Ana ${v('B5')} ${v('C5')} ${v('D5')}, Dan ${v('C6')} ${v('D6')}, Total ${v('C7')} ${v('E7')}`);
({ v } = make2({ rowCol: 0, colCol: 1, colGroup: 'quarter', valCol: 2, op: 'sum', show: 'pctRow' }));
check(v('B4') === 'T1 2025' && v('B5') === 1 && v('C4') === 'Total', `coloane pe trimestre, % din rând: ${v('B4')} ${v('B5')}`);
({ v } = make2({ rowCol: 0, colCol: 2, colGroup: 25, valCol: 2, op: 'count' }));
check(v('B4') === '0–24' && v('C4') === '25–49' && v('B5') === 2 && v('C5') === 0 && v('C6') === 2 && v('D7') === 4, `coloane pe intervale: ${v('B4')} ${v('C4')}, Ana ${v('B5')} ${v('C5')}, Dan ${v('C6')}, Total ${v('D7')}`);
({ v } = make2({ rowCol: 0, colCol: 1, colGroup: 'quarter', valCol: 2, op: 'sum', more: [{ valCol: 2, op: 'count' }] }));
check(v('B4') === 'T1 2025' && v('B6') === 30 && v('C6') === 2 && v('D6') === 30 && v('E8') === 4, `coloane pe trimestre cu două valori: ${v('B6')} ${v('C6')} ${v('D6')} ${v('E8')}`);
// Câmp calculat cu un câmp pe coloane: în fiecare oraș coloana valorii și a câmpului calculat, apoi Total pe fiecare.
({ pv, v } = make({ rowCol: 2, colCol: 0, valCol: 3, op: 'sum', calc: [{ name: 'Dublu', expr: 'Suma * 2' }] }));
check(v('B5') === 'Sumă din Suma' && v('C5') === 'Dublu' && v('D4') === 'Iași' && v('F4') === 'Total' && v('G5') === 'Dublu', `câmp calculat pe coloane, capul: ${v('B5')} ${v('C5')} ${v('G5')}`);
check(v('B6') === 30 && v('C6') === 60 && v('E6') === 80 && v('G6') === 140 && v('C8') === 120 && v('G8') === 300, `câmp calculat pe coloane: Ana ${v('C6')} ${v('E6')} ${v('G6')}, Total ${v('C8')} ${v('G8')}`);

console.log(bad ? `\n${bad} GRESIT` : '\nTOATE OK');
process.exit(bad ? 1 : 0);
