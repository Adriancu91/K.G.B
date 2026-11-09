// Test: Rezumat (tabel pivot) cu câmpuri calculate (ca Calculated Field): formula cu numele coloanelor se face pe sumele
// fiecărui grup și pe tot tabelul la rândul Total. Rulare (în suite/): node tests/pivot-calc.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pvcalc-${process.pid}`);
await build({ entryPoints: ['src/sheets/pivot.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { buildPivot, calcFormula } = await import(pathToFileURL(join(out, 'pivot.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const F = [{ c: 1, name: 'Bucăți' }, { c: 2, name: 'Suma' }, { c: 3, name: 'Preț unitar' }, { c: 4, name: 'Sum' }];
const S = (c) => `S${c}`;
check(calcFormula('=Suma/Bucăți', F, S) === 'S2/S1', 'nume simple: ' + calcFormula('=Suma/Bucăți', F, S));
check(calcFormula("'Preț unitar'*2", F, S) === 'S3*2', 'nume cu spațiu între apostrofuri');
check(calcFormula('suma - sum', F, S) === 'S2 - S4', 'fără majuscule, iar „Sum” nu se confundă cu „Suma”: ' + calcFormula('suma - sum', F, S));
check(calcFormula('SUM(Suma)+"Suma"', F, S) === 'SUM(S2)+"Suma"', 'funcția SUM și textul dintre ghilimele rămân: ' + calcFormula('SUM(Suma)+"Suma"', F, S));
check(calcFormula('Sumar*2', F, S) === null && calcFormula('A1*2', F, S) === null, 'fără nume de coloană: null');

// Cluj: 2 buc, 10 lei + 3 buc, 30 lei; Iași: 4 buc, 60 lei.
const src = { name: 'Date', cells: { A1: 'Oraș', B1: 'Bucăți', C1: 'Suma', A2: 'Cluj', B2: '2', C2: '10', A3: 'Iași', B3: '4', C3: '60', A4: 'Cluj', B4: '3', C4: '30' }, styles: {} };
const pv = buildPivot(src, {}, { range: { r0: 0, c0: 0, r1: 3, c1: 2 }, rowCol: 0, valCol: 2, op: 'sum', more: [{ valCol: 1, op: 'sum' }],
  calc: [{ name: 'Preț mediu', expr: '=Suma/Bucăți' }, { name: 'Nimic', expr: 'A1*2' }, { name: '', expr: 'Suma' }] }, 'Rezumat');
const res = evaluateAll(pv.sheet.cells, { self: 'Rezumat', sheets: [src, pv.sheet] });
const v = (id) => { const r = res[id]; return r?.value !== undefined ? Math.round(r.value * 1000) / 1000 : r?.text; };
check(pv.sheet.cells.D4 === 'Preț mediu' && pv.sheet.cells.E4 === undefined, 'coloana câmpului calculat după valori; cele fără nume / fără coloane nu intră');
check(v('D5') === 8 && v('D6') === 15 && v('D7') === 11.111, `Preț mediu: Cluj ${v('D5')}, Iași ${v('D6')}, Total ${v('D7')} (100 / 9, nu suma rândurilor)`);
check(pv.chartRange === 'A4:D6' && pv.pivot.target === 'A4:D7', 'zona rezumatului și a graficului cuprind câmpul calculat');
const pc = buildPivot(src, {}, { range: { r0: 0, c0: 0, r1: 3, c1: 2 }, rowCol: 0, colCol: 1, valCol: 2, op: 'sum', calc: [{ name: 'X', expr: 'Suma*2' }] }, 'R');
check(Object.values(pc.sheet.cells).includes('X'), 'cu grupare pe coloane câmpurile calculate se pun (câte o coloană în fiecare categorie)');
console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
