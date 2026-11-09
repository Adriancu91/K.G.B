// Test: Rezumat (tabel pivot) cu filtru de raport pe mai multe elemente: în B3 apare „(Mai multe elemente)”, iar cifrele,
// totalurile, procentele, grupurile alese de mână și celelalte calcule țin cont doar de rândurile cu elementele bifate.
// Rulare (în suite/): node tests/pivot-filtermulti.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pvfmulti-${process.pid}`);
await build({ entryPoints: ['src/sheets/pivot.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { buildPivot, PIVOT_ALL, PIVOT_MULTI } = await import(pathToFileURL(join(out, 'pivot.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
// Oraș, Produs, Suma: Cluj mere 10 / pere 30 / prune 1, Iași mere 60 / prune 2, Arad pere 5.
const src = { name: 'Date', cells: {
  A1: 'Oraș', B1: 'Produs', C1: 'Suma',
  A2: 'Cluj', B2: 'mere', C2: '10', A3: 'Cluj', B3: 'pere', C3: '30', A4: 'Cluj', B4: 'prune', C4: '1',
  A5: 'Iași', B5: 'mere', C5: '60', A6: 'Iași', B6: 'prune', C6: '2', A7: 'Arad', B7: 'pere', C7: '5',
}, styles: {} };
const range = { r0: 0, c0: 0, r1: 6, c1: 2 };
const make = (spec, pick) => {
  const pv = buildPivot(src, {}, { range, ...spec }, 'Rezumat');
  const cells = { ...pv.sheet.cells };
  if (pick !== undefined) cells.B3 = pick;
  const res = evaluateAll(cells, { self: 'Rezumat', sheets: [src, { ...pv.sheet, cells }] });
  const v = (id) => { const r = res[id]; return r?.value !== undefined && r?.num ? Math.round(r.value * 1000) / 1000 : r?.text ?? cells[id]; };
  return { pv, v };
};

check(PIVOT_MULTI === '(Mai multe elemente)', 'numele valorii „(Mai multe elemente)”');
const base = { rowCol: 0, valCol: 2, op: 'sum', filterCol: 1, filterItems: ['mere', 'pere'] };
let { pv, v } = make(base);
check(pv.sheet.cells.B3 === PIVOT_MULTI, 'B3 pornește cu „(Mai multe elemente)”: ' + pv.sheet.cells.B3);
check(JSON.stringify(pv.sheet.lists?.[0]?.values) === JSON.stringify([PIVOT_ALL, PIVOT_MULTI, 'mere', 'pere', 'prune']), 'lista din B3: ' + JSON.stringify(pv.sheet.lists?.[0]?.values));
check(String(pv.sheet.cells.C3).includes('mere, pere'), 'C3 arată elementele bifate: ' + pv.sheet.cells.C3);
check(v('B5') === 5 && v('B6') === 40 && v('B7') === 60 && v('B8') === 105, `mere + pere: Arad ${v('B5')}, Cluj ${v('B6')}, Iași ${v('B7')}, Total ${v('B8')}`);
({ v } = make(base, PIVOT_ALL));
check(v('B6') === 41 && v('B7') === 62 && v('B8') === 108, `(Toate): Cluj ${v('B6')}, Iași ${v('B7')}, Total ${v('B8')}`);
({ v } = make(base, 'prune'));
check(v('B5') === 0 && v('B6') === 1 && v('B7') === 2 && v('B8') === 3, `doar prune: Arad ${v('B5')}, Cluj ${v('B6')}, Iași ${v('B7')}, Total ${v('B8')}`);
({ v } = make({ ...base, filterItems: ['prune'] }));
check(v('B5') === 0 && v('B8') === 3, `un singur element bifat, grup fără rânduri = 0: Arad ${v('B5')}, Total ${v('B8')}`);
({ v } = make({ ...base, op: 'count' }));
check(v('B5') === 1 && v('B6') === 2 && v('B7') === 1 && v('B8') === 4, `număr pe mere + pere: ${v('B5')}, ${v('B6')}, ${v('B7')}, Total ${v('B8')}`);
({ v } = make({ ...base, op: 'avg' }));
check(v('B6') === 20 && v('B8') === 26.25, `medie pe mere + pere: Cluj ${v('B6')}, Total ${v('B8')}`);
({ v } = make({ ...base, show: 'pctTotal' }));
check(v('B6') === 0.381 && v('B7') === 0.571, `% din total pe mere + pere: Cluj ${v('B6')}, Iași ${v('B7')} (din 105)`);
({ v } = make({ ...base, rowGroups: [{ name: 'Vest', items: ['Cluj', 'Arad'] }] }));
check(v('A5') === 'Vest' && v('B5') === 45 && v('B6') === 60 && v('B7') === 105, `grup ales de mână pe mere + pere: ${v('A5')} ${v('B5')}, Iași ${v('B6')}, Total ${v('B7')}`);
// Pe coloane: Oraș pe rânduri, nimic altceva; filtrul pe Produs nu poate fi și pe coloane, deci punem Suma ca număr de rânduri.
({ v } = make({ ...base, more: [{ valCol: 2, op: 'max' }] }));
check(v('C6') === 30 && v('C8') === 60, `a doua valoare (maxim) pe mere + pere: Cluj ${v('C6')}, Total ${v('C8')}`);
// Fără elemente bifate: totul ca înainte (fără „(Mai multe elemente)”).
({ pv, v } = make({ ...base, filterItems: [] }));
check(pv.sheet.cells.B3 === PIVOT_ALL && !pv.sheet.lists[0].values.includes(PIVOT_MULTI) && v('B8') === 108, 'fără elemente bifate: ca înainte');

if (bad) { console.log(`\n${bad} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut.');
