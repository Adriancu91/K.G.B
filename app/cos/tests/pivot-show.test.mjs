// Test: Rezumat (tabel pivot) → „Arată valorile ca” % din totalul general / al rândului / al coloanei, calculat cu formulele foii.
// Rulare (în suite/): node tests/pivot-show.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pvshow-${process.pid}`);
await build({ entryPoints: ['src/sheets/pivot.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { buildPivot } = await import(pathToFileURL(join(out, 'pivot.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
// Cluj: ian 10, feb 30; Iași: ian 60 → total 100.
const src = { name: 'Vânzări', cells: { A1: 'Oraș', B1: 'Lună', C1: 'Suma', A2: 'Cluj', B2: 'ian', C2: '10', A3: 'Iași', B3: 'ian', C3: '60', A4: 'Cluj', B4: 'feb', C4: '30' }, styles: {} };
const range = { r0: 0, c0: 0, r1: 3, c1: 2 };
const run = (spec) => {
  const pv = buildPivot(src, {}, { range, valCol: 2, ...spec }, 'Rezumat');
  const res = evaluateAll(pv.sheet.cells, { self: 'Rezumat', sheets: [src, pv.sheet] });
  const v = (id) => { const r = res[id]; return r?.value !== undefined ? Math.round(r.value * 1000) / 1000 : r?.text; };
  return { pv, v };
};

// Pe rânduri (Cluj, Iași), % din totalul general.
let { pv, v } = run({ rowCol: 0, op: 'sum', show: 'pctTotal' });
check(v('B5') === 0.4 && v('B6') === 0.6 && v('B7') === 1, `% din total: Cluj ${v('B5')}, Iași ${v('B6')}, Total ${v('B7')}`);
check(pv.sheet.styles.B5?.fmt === 'percent' && pv.sheet.styles.B7?.fmt === 'percent', 'celulele au formatul procent');
check(/% din totalul general/.test(pv.sheet.cells.A1), 'titlul spune cum se arată valorile: ' + pv.sheet.cells.A1);
({ v } = run({ rowCol: 0, op: 'count', show: 'pctTotal' }));
check(Math.abs(v('B5') - 2 / 3) < 0.001 && Math.abs(v('B6') - 1 / 3) < 0.001 && v('B7') === 1, `Număr ca % din total: ${v('B5')}, ${v('B6')}, ${v('B7')}`);
({ pv, v } = run({ rowCol: 0, op: 'avg', show: 'pctTotal' }));
check(!/%/.test(pv.sheet.cells.A1) && v('B5') === 20, 'la Medie procentele nu se aplică (rămân cifrele)');
({ v } = run({ rowCol: 0, op: 'sum', show: 'pctRow' }));
check(v('B5') === 40, 'fără grupare pe coloane, „% din rând” nu se aplică (rămân cifrele)');

// Pe rânduri orașul, pe coloane luna (feb, ian în ordine alfabetică): B = feb, C = ian, D = Total.
({ v } = run({ rowCol: 0, colCol: 1, op: 'sum', show: 'pctTotal' }));
check([v('B5'), v('C5'), v('D5'), v('B6'), v('C6'), v('D6'), v('B7'), v('C7'), v('D7')].join(' ') === '0.3 0.1 0.4 0 0.6 0.6 0.3 0.7 1', '% din totalul general în tabel: ' + [v('B5'), v('C5'), v('D5'), v('B6'), v('C6'), v('D6'), v('B7'), v('C7'), v('D7')].join(' '));
({ v } = run({ rowCol: 0, colCol: 1, op: 'sum', show: 'pctRow' }));
check([v('B5'), v('C5'), v('D5'), v('B6'), v('C6'), v('D6'), v('B7'), v('C7'), v('D7')].join(' ') === '0.75 0.25 1 0 1 1 0.3 0.7 1', '% din totalul rândului: ' + [v('B5'), v('C5'), v('D5'), v('B6'), v('C6'), v('D6'), v('B7'), v('C7'), v('D7')].join(' '));
({ v } = run({ rowCol: 0, colCol: 1, op: 'sum', show: 'pctCol' }));
check([v('B5'), v('C5'), v('D5'), v('B6'), v('C6'), v('D6'), v('B7'), v('C7'), v('D7')].join(' ') === '1 0.143 0.4 0 0.857 0.6 1 1 1', '% din totalul coloanei: ' + [v('B5'), v('C5'), v('D5'), v('B6'), v('C6'), v('D6'), v('B7'), v('C7'), v('D7')].join(' '));
({ v } = run({ rowCol: 0, colCol: 1, op: 'sum' }));
check(v('B5') === 30 && v('D7') === 100, 'fără „Arată valorile ca”: cifrele, ca înainte');
// Total cumulat și diferențe, de sus în jos (Cluj 40, Iași 60).
({ pv, v } = run({ rowCol: 0, op: 'sum', show: 'running' }));
check(v('B5') === 40 && v('B6') === 100 && v('B7') === 100, `total cumulat: ${v('B5')}, ${v('B6')}, Total ${v('B7')}`);
check(/Total cumulat/.test(pv.sheet.cells.A1) && pv.sheet.styles.B5?.fmt !== 'percent', 'titlul spune „Total cumulat”, celulele rămân cifre');
({ pv, v } = run({ rowCol: 0, op: 'sum', show: 'diffPrev' }));
check(pv.sheet.cells.B5 === undefined && v('B6') === 20 && pv.sheet.cells.B7 === undefined, `diferența față de anterior: primul gol, Iași ${v('B6')}, Total gol`);
({ pv, v } = run({ rowCol: 0, op: 'sum', show: 'pctDiffPrev' }));
check(pv.sheet.cells.B5 === undefined && v('B6') === 0.5 && pv.sheet.styles.B6?.fmt === 'percent', `% diferență: Iași ${v('B6')} (procent)`);
({ v } = run({ rowCol: 0, op: 'count', show: 'running' }));
check(v('B5') === 2 && v('B6') === 3 && v('B7') === 3, `Număr cumulat: ${v('B5')}, ${v('B6')}, ${v('B7')}`);
({ pv, v } = run({ rowCol: 0, op: 'avg', show: 'running' }));
check(v('B5') === 20 && !/cumulat/.test(pv.sheet.cells.A1), 'la Medie totalul cumulat nu se aplică');
// Cu luna pe coloane (B = feb, C = ian, D = Total): Cluj 30 10 40, Iași 0 60 60.
({ v } = run({ rowCol: 0, colCol: 1, op: 'sum', show: 'running' }));
check([v('B5'), v('C5'), v('D5'), v('B6'), v('C6'), v('D6'), v('B7'), v('C7'), v('D7')].join(' ') === '30 10 40 30 70 100 30 70 100', 'total cumulat în tabel: ' + [v('B5'), v('C5'), v('D5'), v('B6'), v('C6'), v('D6'), v('B7'), v('C7'), v('D7')].join(' '));
({ pv, v } = run({ rowCol: 0, colCol: 1, op: 'sum', show: 'diffPrev' }));
check([v('B6'), v('C6'), v('D6')].join(' ') === '-30 50 20' && pv.sheet.cells.B5 === undefined && pv.sheet.cells.D7 === undefined, 'diferențe în tabel: ' + [v('B6'), v('C6'), v('D6')].join(' '));
// Indice: Cluj feb 30 × 100 / (40 × 30) = 2,5; Cluj ian 10 × 100 / (40 × 70) = 0,357; totalurile 1.
({ pv, v } = run({ rowCol: 0, colCol: 1, op: 'sum', show: 'index' }));
check([v('B5'), v('C5'), v('D5'), v('B6'), v('C6'), v('B7'), v('D7')].join(' ') === '2.5 0.357 1 0 1.429 1 1' && pv.sheet.styles.B5?.fmt === 'number', 'indice: ' + [v('B5'), v('C5'), v('D5'), v('B6'), v('C6'), v('B7'), v('D7')].join(' '));
({ pv, v } = run({ rowCol: 0, op: 'sum', show: 'index' }));
check(v('B5') === 40, 'fără grupare pe coloane indicele nu se aplică');
// Rang (Cluj 40, Iași 60): de la cel mai mare, Iași 1 și Cluj 2; de la cel mai mic, invers; rândul Total gol.
({ pv, v } = run({ rowCol: 0, op: 'sum', show: 'rankDesc' }));
check(v('B5') === 2 && v('B6') === 1 && pv.sheet.cells.B7 === undefined && pv.sheet.styles.B5?.fmt !== 'percent' && /Rang de la cel mai mare/.test(pv.sheet.cells.A1), `rang descrescător: Cluj ${v('B5')}, Iași ${v('B6')}`);
({ v } = run({ rowCol: 0, op: 'sum', show: 'rankAsc' }));
check(v('B5') === 1 && v('B6') === 2, `rang crescător: Cluj ${v('B5')}, Iași ${v('B6')}`);
({ v } = run({ rowCol: 0, op: 'count', show: 'rankDesc' }));
check(v('B5') === 1 && v('B6') === 2, `rang după număr (Cluj 2 rânduri, Iași 1): ${v('B5')}, ${v('B6')}`);
// În tabel, pe fiecare coloană (feb: Cluj 30, Iași 0; ian: Cluj 10, Iași 60), plus coloana Total (40, 60).
({ pv, v } = run({ rowCol: 0, colCol: 1, op: 'sum', show: 'rankDesc' }));
check([v('B5'), v('C5'), v('D5'), v('B6'), v('C6'), v('D6')].join(' ') === '1 2 2 2 1 1' && pv.sheet.cells.B7 === undefined, 'rang în tabel: ' + [v('B5'), v('C5'), v('D5'), v('B6'), v('C6'), v('D6')].join(' '));
// Cu valori egale, același rang (ca RANK.EQ).
const eq = buildPivot({ ...src, cells: { ...src.cells, C3: '40' } }, {}, { range, valCol: 2, rowCol: 0, op: 'sum', show: 'rankDesc' }, 'Rezumat');
const er = evaluateAll(eq.sheet.cells, { self: 'Rezumat', sheets: [{ ...src, cells: { ...src.cells, C3: '40' } }, eq.sheet] });
check(er.B5?.value === 1 && er.B6?.value === 1, `valori egale, același rang: ${er.B5?.value}, ${er.B6?.value}`);
// Cu gruparea pe intervale, rangul nu se aplică (rămân cifrele).
({ pv } = run({ rowCol: 2, op: 'count', show: 'rankDesc', group: 50 }));
check(!/Rang/.test(pv.sheet.cells.A1), 'cu grupare pe intervale rangul nu se aplică');
// % din totalul cumulat: Cluj 40 → 40%, Iași 60 → 100%; rândul Total gol.
({ pv, v } = run({ rowCol: 0, op: 'sum', show: 'pctRunning' }));
check(v('B5') === 0.4 && v('B6') === 1 && !pv.sheet.cells.B7 && pv.sheet.styles.B5?.fmt === 'percent', `% din totalul cumulat: Cluj ${v('B5')}, Iași ${v('B6')}, Total ${pv.sheet.cells.B7 ?? 'gol'}`);
// Pe coloane, fiecare coloană din totalul ei: feb (Cluj 30, Iași 0) → 100%, 100%; ian (10, 60) → 14,3%, 100%; Total (40, 60) → 40%, 100%.
({ v } = run({ rowCol: 0, colCol: 1, op: 'sum', show: 'pctRunning' }));
check(v('B5') === 1 && v('B6') === 1 && v('C5') === 0.143 && v('C6') === 1 && v('D5') === 0.4 && v('D6') === 1, `% din totalul cumulat pe coloane: feb ${v('B5')}/${v('B6')}, ian ${v('C5')}/${v('C6')}, Total ${v('D5')}/${v('D6')}`);
({ v } = run({ rowCol: 0, op: 'count', show: 'pctRunning' }));
check(Math.abs(v('B5') - 2 / 3) < 0.001 && v('B6') === 1, `Număr ca % din totalul cumulat: ${v('B5')}, ${v('B6')}`);
// Față de elementul ales (Cluj = 40): % din → Cluj 100%, Iași 150%; diferența → Cluj gol, Iași 20; totalul gol.
({ pv, v } = run({ rowCol: 0, op: 'sum', show: 'pctOf', base: 'Cluj' }));
check(v('B5') === 1 && v('B6') === 1.5 && !pv.sheet.cells.B7 && pv.sheet.styles.B6?.fmt === 'percent', `% din Cluj: Cluj ${v('B5')}, Iași ${v('B6')}`);
check(/% din elementul ales/.test(pv.sheet.cells.A1), 'titlul: ' + pv.sheet.cells.A1);
({ pv, v } = run({ rowCol: 0, op: 'sum', show: 'diffFrom', base: 'Iași' }));
check(v('B5') === -20 && !pv.sheet.cells.B6 && !pv.sheet.cells.B7, `diferența față de Iași: Cluj ${v('B5')}, Iași ${pv.sheet.cells.B6 ?? 'gol'}`);
// Pe coloane (B feb, C ian, D Total), față de Iași: feb Cluj 30 - 0, ian Cluj 10 - 60, Total 40 - 60.
({ v } = run({ rowCol: 0, colCol: 1, op: 'sum', show: 'diffFrom', base: 'Iași' }));
check(v('B5') === 30 && v('C5') === -50 && v('D5') === -20, `diferența pe coloane: feb ${v('B5')}, ian ${v('C5')}, Total ${v('D5')}`);
({ v } = run({ rowCol: 0, colCol: 1, op: 'sum', show: 'pctOf', base: 'Iași' }));
check(v('C5') === 0.167 && v('C6') === 1 && v('D5') === 0.667, `% din Iași pe coloane: ian Cluj ${v('C5')}, Total Cluj ${v('D5')}`);
({ pv, v } = run({ rowCol: 0, op: 'sum', show: 'pctDiffFrom', base: 'Cluj' }));
check(!pv.sheet.cells.B5 && v('B6') === 0.5 && pv.sheet.styles.B6?.fmt === 'percent', `% diferență față de Cluj: Iași ${v('B6')}`);
// Fără element ales sau cu un element care nu există: cifrele / fără comparație.
({ pv, v } = run({ rowCol: 0, op: 'sum', show: 'pctOf' }));
check(v('B5') === 40 && !/elementul ales/.test(pv.sheet.cells.A1), 'fără element ales rămân cifrele');
console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
