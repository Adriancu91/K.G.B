// Test: Rezumat (tabel pivot) cu elemente calculate pe rânduri („Diferență” = Cluj - Iași): rândul nou sub categorii,
// fără să intre în Total, pe coloane, cu mai multe valori, cu un grup ales de mână; nu se pune cu procente sau două câmpuri.
// Rulare (în suite/): node tests/pivot-calcitem.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pvci-${process.pid}`);
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
// Elementele calculate: Cluj - Iași (cu „iași” scris mic tot în Iași), sub categorii, fără să intre în Total.
let { v } = make({ rowCol: 0, valCol: 2, op: 'sum', calcItems: [{ name: 'Diferență', expr: 'Cluj - Iași' }] });
check(v('A5') === 'Brașov' && v('A6') === 'Cluj' && v('A7') === 'Iași' && v('A8') === 'Timiș' && v('A9') === 'Diferență' && v('A10') === 'Total', `rândurile: ${['A5','A6','A7','A8','A9','A10'].map(v).join(', ')}`);
check(v('B9') === 25 && v('B10') === 155, `Diferență ${v('B9')}, Total ${v('B10')}`);

// Două elemente, nume cu apostrofuri și formula cu „=”, fără rândul Total.
({ v } = make({ rowCol: 0, valCol: 2, op: 'sum', totals: 'none', calcItems: [{ name: 'Nord', expr: "='Cluj'+Iași" }, { name: 'Raport', expr: 'Cluj / Brașov' }] }));
check(v('A9') === 'Nord' && v('B9') === 75 && v('A10') === 'Raport' && v('B10') === 1.667 && v('A11') === undefined, `fără Total: ${v('A9')} ${v('B9')}, ${v('A10')} ${v('B10')}, ${v('A11')}`);

// Pe coloane Agent: fiecare coloană și coloana Total.
({ v } = make({ rowCol: 0, colCol: 1, valCol: 2, op: 'sum', calcItems: [{ name: 'Nord', expr: 'Cluj + Iași' }] }));
check(v('A9') === 'Nord' && v('B9') === 15 && v('C9') === 60 && v('D9') === 75 && v('A10') === 'Total' && v('D10') === 155, `pe coloane: ${v('B9')} ${v('C9')} ${v('D9')}, Total ${v('D10')}`);

// Cu mai multe valori și grupare pe coloane (două rânduri de cap).
({ v } = make({ rowCol: 0, colCol: 1, valCol: 2, op: 'sum', more: [{ valCol: 2, op: 'max' }], calcItems: [{ name: 'Nord', expr: 'Cluj + Iași' }] }));
check(v('A10') === 'Nord' && v('B10') === 15 && v('C10') === 15 && v('A11') === 'Total', `două valori: ${v('A10')} ${v('B10')} ${v('C10')} ${v('A11')}`);

// Împreună cu un grup ales de mână: numele grupului se poate folosi în formulă.
({ v } = make({ rowCol: 0, valCol: 2, op: 'sum', rowGroups: [{ name: 'Nord', items: ['Cluj', 'Iași'] }], calcItems: [{ name: 'Nord fără Brașov', expr: 'Nord - Brașov' }] }));
check(v('A8') === 'Nord fără Brașov' && v('B8') === 45 && v('A9') === 'Total' && v('B9') === 155, `cu grup: ${v('A8')} ${v('B8')}, ${v('A9')} ${v('B9')}`);

// Fără nume de categorie în formulă, cu procente, sau cu al doilea câmp pe rânduri: nimic nou.
({ v } = make({ rowCol: 0, valCol: 2, op: 'sum', calcItems: [{ name: 'X', expr: '1+2' }] }));
check(v('A9') === 'Total', `formulă fără categorii: ${v('A9')}`);
({ v } = make({ rowCol: 0, valCol: 2, op: 'sum', show: 'pctTotal', calcItems: [{ name: 'X', expr: 'Cluj-Iași' }] }));
check(v('A9') === 'Total', `cu procente: ${v('A9')}`);
({ v } = make({ rowCol: 0, rowCol2: 1, valCol: 2, op: 'sum', calcItems: [{ name: 'X', expr: 'Cluj-Iași' }] }));
check(![...Array(30).keys()].some((i) => v('A' + (i + 1)) === 'X'), 'cu două câmpuri pe rânduri: fără element');

console.log(bad ? `\n${bad} GRESITE` : '\nTOATE OK');
process.exit(bad ? 1 : 0);
