// Test: Rezumat (tabel pivot) cu filtru de raport (ca Report Filter): deasupra rezumatului, în B3, o listă cu „(Toate)” și
// valorile coloanei alese; cifrele, totalurile, procentele și câmpurile calculate țin cont de valoarea aleasă.
// Rulare (în suite/): node tests/pivot-filter.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pvfilt-${process.pid}`);
await build({ entryPoints: ['src/sheets/pivot.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { buildPivot, PIVOT_ALL, PIVOT_FILTER_CELL } = await import(pathToFileURL(join(out, 'pivot.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
// Oraș, An, Suma, Bucăți: Cluj 2025 10 / 2026 30, Iași 2026 60, Arad 2025 5 (anul 2025 al Aradului e scris ca număr).
const src = { name: 'Date', cells: {
  A1: 'Oraș', B1: 'An', C1: 'Suma', D1: 'Bucăți',
  A2: 'Cluj', B2: '2025', C2: '10', D2: '1', A3: 'Cluj', B3: '2026', C3: '30', D3: '3',
  A4: 'Iași', B4: '2026', C4: '60', D4: '2', A5: 'Arad', B5: '2025', C5: '5', D5: '1',
}, styles: {} };
const range = { r0: 0, c0: 0, r1: 4, c1: 3 };
const make = (spec, pick) => {
  const pv = buildPivot(src, {}, { range, ...spec }, 'Rezumat');
  const cells = { ...pv.sheet.cells };
  if (pick !== undefined) cells[PIVOT_FILTER_CELL] = pick;
  const res = evaluateAll(cells, { self: 'Rezumat', sheets: [src, { ...pv.sheet, cells }] });
  const v = (id) => { const r = res[id]; return r?.value !== undefined && r?.num ? Math.round(r.value * 1000) / 1000 : r?.text ?? cells[id]; };
  return { pv, v, cells };
};

check(PIVOT_FILTER_CELL === 'B3' && PIVOT_ALL === '(Toate)', 'celula filtrului și „(Toate)”');
let { pv, v } = make({ rowCol: 0, valCol: 2, op: 'sum', filterCol: 1 });
check(pv.sheet.cells.A3 === 'An' && pv.sheet.cells.B3 === '(Toate)', 'rândul 3: numele câmpului și „(Toate)”');
check(JSON.stringify(pv.sheet.lists) === JSON.stringify([{ range: 'B3', values: ['(Toate)', '2025', '2026'] }]), 'lista din B3: ' + JSON.stringify(pv.sheet.lists));
check(v('A5') === 'Arad' && v('B5') === 5 && v('B6') === 40 && v('B7') === 60 && v('B8') === 105, `toate: Arad ${v('B5')}, Cluj ${v('B6')}, Iași ${v('B7')}, Total ${v('B8')}`);
({ v } = make({ rowCol: 0, valCol: 2, op: 'sum', filterCol: 1 }, '2026'));
check(v('B5') === 0 && v('B6') === 30 && v('B7') === 60 && v('B8') === 90, `2026: Arad ${v('B5')}, Cluj ${v('B6')}, Iași ${v('B7')}, Total ${v('B8')}`);
({ v } = make({ rowCol: 0, valCol: 2, op: 'count', filterCol: 1 }, '2025'));
check(v('B5') === 1 && v('B6') === 1 && v('B7') === 0 && v('B8') === 2, `număr pe 2025: ${v('B5')}, ${v('B6')}, ${v('B7')}, Total ${v('B8')}`);
({ v } = make({ rowCol: 0, valCol: 2, op: 'sum', filterCol: 1, show: 'pctTotal' }, '2026'));
check(v('B6') === 0.333 && v('B7') === 0.667, `% din total pe 2026: Cluj ${v('B6')}, Iași ${v('B7')} (din 90, nu din 105)`);
({ v } = make({ rowCol: 0, valCol: 2, op: 'max', filterCol: 1 }, '2025'));
check(v('B6') === 10 && v('B8') === 10 && v('B7') === 0, `maxim pe 2025: Cluj ${v('B6')}, Iași ${v('B7')} (MAXIFS fără rânduri = 0), Total ${v('B8')}`);
({ v } = make({ rowCol: 0, valCol: 2, op: 'sum', filterCol: 1, more: [{ valCol: 3, op: 'sum' }], calc: [{ name: 'Preț', expr: 'Suma/Bucăți' }] }, '2026'));
check(v('C6') === 3 && v('D6') === 10 && v('D8') === 18, `câmpul calculat pe 2026: Cluj ${v('D6')}, Total ${v('D8')} (90 / 5)`);
({ v } = make({ rowCol: 0, colCol: 1, valCol: 2, op: 'sum', filterCol: 3 }, '1'));
check(v('B5') === 5 && v('B6') === 10 && v('C6') === 0 && v('D8') === 15, `pe coloane, filtru Bucăți = 1: Arad ${v('B5')}, Cluj 2025 ${v('B6')}, Total ${v('D8')}`);
// Filtrul pe aceeași coloană ca rândurile nu se pune.
({ pv } = make({ rowCol: 0, valCol: 2, op: 'sum', filterCol: 0 }));
check(!pv.sheet.lists && pv.sheet.cells.B3 === undefined && !/IF\(\$B\$3/.test(pv.sheet.cells.B5), 'filtru pe coloana rândurilor: ignorat');
console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
