// Test: Rezumat (tabel pivot) cu două câmpuri pe rânduri și aspectul raportului (ca Report Layout): Compact, Schiță, Tabelar,
// cu sau fără subtotaluri; cifrele, subtotalurile și totalul general.
// Rulare (în suite/): node tests/pivot-layout.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pvlay-${process.pid}`);
await build({ entryPoints: ['src/sheets/pivot.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { buildPivot, PIVOT_LAYOUTS } = await import(pathToFileURL(join(out, 'pivot.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
// Oraș, Agent, Suma, Data: Cluj Ana 10 + Ana 5 + Dan 30, Iași Ana 60, Arad Dan 5.
const src = { name: 'Date', cells: {
  A1: 'Oraș', B1: 'Agent', C1: 'Suma', D1: 'Data',
  A2: 'Cluj', B2: 'Ana', C2: '10', D2: '45658', A3: 'Cluj', B3: 'Dan', C3: '30', D3: '45689',
  A4: 'Iași', B4: 'Ana', C4: '60', D4: '45690', A5: 'Arad', B5: 'Dan', C5: '5', D5: '45700', A6: 'Cluj', B6: 'Ana', C6: '5', D6: '45720',
}, styles: {} };
const range = { r0: 0, c0: 0, r1: 5, c1: 3 };
const make = (spec) => {
  const pv = buildPivot(src, {}, { range, ...spec }, 'Rezumat');
  const cells = pv.sheet.cells;
  const res = evaluateAll(cells, { self: 'Rezumat', sheets: [src, pv.sheet] });
  const v = (id) => { const r = res[id]; return r?.value !== undefined && r?.num ? Math.round(r.value * 1000) / 1000 : r?.text ?? cells[id]; };
  return { pv, v, cells };
};

check(PIVOT_LAYOUTS.map(([k]) => k).join() === 'compact,outline,tabular', 'cele trei aspecte');
// Compact: A5 Arad (subtotal 5), A6 Dan 5, A7 Cluj 45, A8 Ana 15, A9 Dan 30, A10 Iași 60, A11 Ana 60, A12 Total 110.
let { pv, v } = make({ rowCol: 0, rowCol2: 1, valCol: 2, op: 'sum' });
check(v('A4') === 'Oraș / Agent' && v('B4') === 'Sumă din Suma', 'compact: capul de tabel ' + v('A4'));
check(v('A5') === 'Arad' && v('B5') === 5 && v('A6') === 'Dan' && v('B6') === 5, `compact: Arad ${v('B5')}, Dan ${v('B6')}`);
check(v('A7') === 'Cluj' && v('B7') === 45 && v('A8') === 'Ana' && v('B8') === 15 && v('A9') === 'Dan' && v('B9') === 30, `compact: Cluj ${v('B7')}, Ana ${v('B8')}, Dan ${v('B9')}`);
check(v('A10') === 'Iași' && v('B10') === 60 && v('A11') === 'Ana' && v('A12') === 'Total' && v('B12') === 110, `compact: Iași ${v('B10')}, Total ${v('B12')}`);
check(pv.sheet.styles.A8?.ind === 1 && pv.sheet.styles.A7?.b === true, 'compact: al doilea câmp retras, grupul îngroșat');
check(pv.pivot.target === 'A4:B12' && pv.pivot.rows.join() === 'Oraș,Agent' && pv.rows === 7, `zona ${pv.pivot.target}, rânduri ${pv.rows}`);
check(pv.sheet.cells.A1.includes('„Oraș” și „Agent”'), 'titlul: ' + pv.sheet.cells.A1);
// Schiță: A = Oraș, B = Agent, C = valorile; subtotalul pe rândul grupului.
({ pv, v } = make({ rowCol: 0, rowCol2: 1, valCol: 2, op: 'sum', layout: 'outline' }));
check(v('A4') === 'Oraș' && v('B4') === 'Agent' && v('C4') === 'Sumă din Suma', 'schiță: capul de tabel');
check(v('A7') === 'Cluj' && v('C7') === 45 && v('B8') === 'Ana' && v('C8') === 15 && v('A8') === undefined && v('C12') === 110, `schiță: Cluj ${v('C7')}, Ana ${v('C8')}, Total ${v('C12')}`);
// Tabelar: grupul pe primul rând, subtotalul pe rândul „… Total”.
({ pv, v } = make({ rowCol: 0, rowCol2: 1, valCol: 2, op: 'sum', layout: 'tabular' }));
check(v('A5') === 'Arad' && v('B5') === 'Dan' && v('C5') === 5 && v('A6') === 'Arad Total' && v('C6') === 5, `tabelar: Arad Dan ${v('C5')}, Arad Total ${v('C6')}`);
check(v('A7') === 'Cluj' && v('B7') === 'Ana' && v('C7') === 15 && v('A8') === undefined && v('B8') === 'Dan' && v('C8') === 30 && v('A9') === 'Cluj Total' && v('C9') === 45, `tabelar: Cluj ${v('C7')} / ${v('C8')} / ${v('C9')}`);
check(v('A12') === 'Total' && v('C12') === 110 && pv.pivot.target === 'A4:C12', `tabelar: Total ${v('C12')}, zona ${pv.pivot.target}`);
// Tabelar fără subtotaluri: fără rândurile „… Total”.
({ pv, v } = make({ rowCol: 0, rowCol2: 1, valCol: 2, op: 'sum', layout: 'tabular', subtotals: false }));
check(v('A5') === 'Arad' && v('A6') === 'Cluj' && v('C6') === 15 && v('A8') === 'Iași' && v('A9') === 'Total' && v('C9') === 110, `tabelar fără subtotaluri: Total ${v('C9')}`);
// Compact fără subtotaluri: rândul grupului rămâne fără cifre.
({ pv, v } = make({ rowCol: 0, rowCol2: 1, valCol: 2, op: 'sum', subtotals: false }));
check(v('A7') === 'Cluj' && v('B7') === undefined && v('B8') === 15, 'compact fără subtotaluri: rândul grupului gol');
// Număr și încă o valoare (Maxim), plus % din totalul general.
({ pv, v } = make({ rowCol: 0, rowCol2: 1, valCol: 2, op: 'count', more: [{ valCol: 2, op: 'max' }], layout: 'outline' }));
check(v('C7') === 3 && v('D7') === 30 && v('C8') === 2 && v('D8') === 10 && v('C12') === 5 && v('D12') === 60, `număr + maxim: Cluj ${v('C7')} / ${v('D7')}, Total ${v('C12')} / ${v('D12')}`);
({ pv, v } = make({ rowCol: 0, rowCol2: 1, valCol: 2, op: 'sum', show: 'pctTotal', layout: 'outline' }));
check(v('C10') === 0.545 && v('C9') === 0.273 && v('C12') === 1, `% din total: Iași ${v('C10')}, Cluj Dan ${v('C9')}, Total ${v('C12')}`);
// Primul câmp grupat pe luni (datele din D): ianuarie 2025 = Ana 10; februarie = Dan 30, Ana 60, Dan 5 (45700 = 12 feb), martie = Ana 5.
({ pv, v } = make({ rowCol: 3, rowCol2: 1, valCol: 2, op: 'sum', group: 'month', layout: 'tabular' }));
check(v('A5') === 'ianuarie 2025' && v('C5') === 10 && v('A7') === 'februarie 2025' && v('B7') === 'Ana' && v('C7') === 60 && v('C8') === 35 && v('C9') === 95, `pe luni: ian ${v('C5')}, feb Ana ${v('C7')} / Dan ${v('C8')} / total ${v('C9')}`);
// Fără al doilea câmp (sau același câmp) rămâne rezumatul obișnuit.
({ pv, v } = make({ rowCol: 0, rowCol2: 0, valCol: 2, op: 'sum', layout: 'tabular' }));
check(v('A5') === 'Arad' && v('B5') === 5 && v('A8') === 'Total' && pv.pivot.rows.length === 1, 'același câmp: rezumat obișnuit');
// Cu grupare pe coloane, al doilea câmp nu se folosește.
({ pv, v } = make({ rowCol: 0, rowCol2: 1, colCol: 1, valCol: 2, op: 'sum' }));
check(pv.pivot.rows.length === 1 && v('B4') === 'Ana', 'cu grupare pe coloane: fără al doilea câmp');
// Filtrul de raport pe aceeași coloană ca al doilea câmp nu se pune.
({ pv, v } = make({ rowCol: 0, rowCol2: 1, filterCol: 1, valCol: 2, op: 'sum' }));
check(!pv.sheet.lists && v('A4') === 'Oraș / Agent', 'filtrul pe al doilea câmp nu se pune');

// Al treilea câmp pe rânduri: Oraș, Agent, Produs, Suma. Cluj: Ana mere 10 + mere 5 + pere 7, Dan mere 30; Iași: Ana pere 60.
const src3 = { name: 'Date', cells: {
  A1: 'Oraș', B1: 'Agent', C1: 'Produs', D1: 'Suma',
  A2: 'Cluj', B2: 'Ana', C2: 'mere', D2: '10', A3: 'Cluj', B3: 'Dan', C3: 'mere', D3: '30', A4: 'Iași', B4: 'Ana', C4: 'pere', D4: '60',
  A5: 'Cluj', B5: 'Ana', C5: 'mere', D5: '5', A6: 'Cluj', B6: 'Ana', C6: 'pere', D6: '7',
}, styles: {} };
const make3 = (spec) => {
  const pv = buildPivot(src3, {}, { range: { r0: 0, c0: 0, r1: 5, c1: 3 }, rowCol: 0, rowCol2: 1, rowCol3: 2, valCol: 3, op: 'sum', ...spec }, 'Rezumat');
  const res = evaluateAll(pv.sheet.cells, { self: 'Rezumat', sheets: [src3, pv.sheet] });
  const v = (id) => { const r = res[id]; return r?.value !== undefined && r?.num ? Math.round(r.value * 1000) / 1000 : r?.text ?? pv.sheet.cells[id]; };
  return { pv, v };
};
// Compact: A5 Cluj 52, A6 Ana 22, A7 mere 15, A8 pere 7, A9 Dan 30, A10 mere 30, A11 Iași 60, A12 Ana 60, A13 pere 60, A14 Total 112.
({ pv, v } = make3({}));
check(v('A4') === 'Oraș / Agent / Produs' && v('B4') === 'Sumă din Suma', '3 câmpuri compact: capul de tabel ' + v('A4'));
check(v('A5') === 'Cluj' && v('B5') === 52 && v('A6') === 'Ana' && v('B6') === 22 && v('A7') === 'mere' && v('B7') === 15 && v('A8') === 'pere' && v('B8') === 7,
  `3 câmpuri compact: Cluj ${v('B5')}, Ana ${v('B6')}, mere ${v('B7')}, pere ${v('B8')}`);
check(v('A9') === 'Dan' && v('B9') === 30 && v('A10') === 'mere' && v('B10') === 30 && v('A11') === 'Iași' && v('A13') === 'pere' && v('B13') === 60 && v('A14') === 'Total' && v('B14') === 112,
  `3 câmpuri compact: Dan ${v('B9')}, Iași pere ${v('B13')}, Total ${v('B14')}`);
check(pv.sheet.styles.A6?.ind === 1 && pv.sheet.styles.A7?.ind === 2 && pv.sheet.styles.A6?.b === true, '3 câmpuri compact: retragerile 1 și 2, al doilea câmp îngroșat');
check(pv.pivot.rows.join() === 'Oraș,Agent,Produs' && pv.pivot.target === 'A4:B14' && pv.sheet.cells.A1.includes('„Oraș”, „Agent” și „Produs”'), `3 câmpuri: ${pv.pivot.rows}, ${pv.pivot.target}, ${pv.sheet.cells.A1}`);
// Schiță: A Oraș, B Agent, C Produs, D valorile.
({ pv, v } = make3({ layout: 'outline' }));
check(v('A4') === 'Oraș' && v('B4') === 'Agent' && v('C4') === 'Produs' && v('D4') === 'Sumă din Suma', '3 câmpuri schiță: capul de tabel');
check(v('A5') === 'Cluj' && v('D5') === 52 && v('B6') === 'Ana' && v('D6') === 22 && v('C7') === 'mere' && v('D7') === 15 && v('C8') === 'pere' && v('D8') === 7 && v('D14') === 112,
  `3 câmpuri schiță: Cluj ${v('D5')}, Ana ${v('D6')}, mere ${v('D7')}, Total ${v('D14')}`);
// Tabelar: Cluj Ana mere 15 / pere 7 / Ana Total 22 / Dan mere 30 / Dan Total 30 / Cluj Total 52 / Iași Ana pere 60 / Ana Total / Iași Total / Total.
({ pv, v } = make3({ layout: 'tabular' }));
check(v('A5') === 'Cluj' && v('B5') === 'Ana' && v('C5') === 'mere' && v('D5') === 15 && v('C6') === 'pere' && v('D6') === 7 && v('B7') === 'Ana Total' && v('D7') === 22,
  `3 câmpuri tabelar: mere ${v('D5')}, pere ${v('D6')}, Ana Total ${v('D7')}`);
check(v('B8') === 'Dan' && v('C8') === 'mere' && v('D8') === 30 && v('B9') === 'Dan Total' && v('A10') === 'Cluj Total' && v('D10') === 52,
  `3 câmpuri tabelar: Dan ${v('D8')}, Cluj Total ${v('D10')}`);
check(v('A11') === 'Iași' && v('D11') === 60 && v('A13') === 'Iași Total' && v('A14') === 'Total' && v('D14') === 112, `3 câmpuri tabelar: Iași ${v('D11')}, Total ${v('D14')}`);
// Tabelar fără subtotaluri: doar rândurile de jos și Total.
({ pv, v } = make3({ layout: 'tabular', subtotals: false }));
check(v('C5') === 'mere' && v('C6') === 'pere' && v('B7') === 'Dan' && v('D7') === 30 && v('A8') === 'Iași' && v('A9') === 'Total' && v('D9') === 112, `3 câmpuri tabelar fără subtotaluri: Total ${v('D9')}`);
// Al treilea câmp fără al doilea, sau același ca al doilea: nu se folosește.
({ pv, v } = make3({ rowCol2: undefined }));
check(pv.pivot.rows.length === 1 && v('A5') === 'Cluj', 'al treilea fără al doilea: rezumat obișnuit');
({ pv, v } = make3({ rowCol3: 1 }));
check(pv.pivot.rows.length === 2, 'al treilea = al doilea: doar două câmpuri');

// % din totalul părintelui: fiecare rând din subtotalul grupului lui; primul câmp din totalul general.
({ pv, v } = make3({ show: 'pctParent' }));
check(v('B5') === 0.464 && v('B6') === 0.423 && v('B7') === 0.682 && v('B8') === 0.318 && v('B9') === 0.577 && v('B10') === 1 && v('B11') === 0.536 && v('B13') === 1 && v('B14') === 1,
  `% din părinte, 3 câmpuri: Cluj ${v('B5')}, Ana ${v('B6')}, mere ${v('B7')}, pere ${v('B8')}, Dan ${v('B9')}, Iași ${v('B11')}, Total ${v('B14')}`);
check(pv.sheet.styles.B7?.fmt === 'percent', '% din părinte: format procent');
({ pv, v } = make3({ show: 'pctParent', layout: 'tabular' }));
check(v('D5') === 0.682 && v('D7') === 0.423 && v('D10') === 0.464 && v('D14') === 1, `% din părinte, tabelar: mere ${v('D5')}, Ana Total ${v('D7')}, Cluj Total ${v('D10')}`);
({ pv, v } = make({ rowCol: 0, rowCol2: 1, valCol: 2, op: 'sum', show: 'pctParent', layout: 'outline' }));
check(v('C5') === 0.045 && v('C6') === 1 && v('C7') === 0.409 && v('C8') === 0.333 && v('C9') === 0.667 && v('C12') === 1, `% din părinte, 2 câmpuri: Arad ${v('C5')}, Cluj ${v('C7')}, Ana ${v('C8')}, Dan ${v('C9')}`);
// Cu un singur câmp pe rânduri e ca % din totalul general; cu grupare pe coloane nu se folosește.
({ pv, v } = make({ rowCol: 0, valCol: 2, op: 'sum', show: 'pctParent' }));
check(v('B5') === 0.045 && v('B6') === 0.409 && pv.sheet.cells.A1.includes('% din totalul general'), `% din părinte, un câmp: Arad ${v('B5')}`);
({ pv, v } = make({ rowCol: 0, colCol: 1, valCol: 2, op: 'sum', show: 'pctParent' }));
check(v('B5') === 0 || v('B5') === undefined || v('C5') === 5, `% din părinte cu grupare pe coloane: cifrele (Arad Dan ${v('C5')})`);

console.log(bad ? `\n${bad} GREȘITE` : '\nTOATE OK');
process.exit(bad ? 1 : 0);
