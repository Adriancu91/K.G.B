// Test pentru Rezumat (tabel pivot) cu Maxim și Minim: valorile pe categorii, pe rânduri × coloane și totalurile (care nu se adună,
// ci se calculează pe tot grupul). Rulare (în suite/): node tests/pivot-maxmin.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pivmm-${process.pid}`);
await build({ entryPoints: ['src/sheets/pivot.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { buildPivot, PIVOT_OPS } = await import(pathToFileURL(join(out, 'pivot.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GRESIT: ') + m); if (!c) bad++; };
const src = { name: 'Vânzări', cells: { A1: 'Oraș', B1: 'Lună', C1: 'Suma',
  A2: 'Cluj', B2: 'ian', C2: '10', A3: 'Iași', B3: 'ian', C3: '5', A4: 'Cluj', B4: 'feb', C4: '7', A5: 'Iași', B5: 'feb', C5: '12', A6: 'Cluj', B6: 'ian', C6: '3' }, styles: {} };
const range = { r0: 0, c0: 0, r1: 5, c1: 2 };
ok(PIVOT_OPS.some(([k, l]) => k === 'max' && l === 'Maxim') && PIVOT_OPS.some(([k, l]) => k === 'min' && l === 'Minim'), 'Maxim și Minim sunt în lista de calcule');
const calc = (pv) => {
  const r = evaluateAll(pv.sheet.cells, { self: pv.sheet.name, sheets: [src, pv.sheet] });
  return (id) => r[id]?.text;
};
// Doar pe rânduri: Cluj (10, 7, 3), Iași (5, 12).
const mx = buildPivot(src, {}, { range, rowCol: 0, valCol: 2, op: 'max' }, 'R1');
const v1 = calc(mx);
ok(mx.sheet.cells.A1.startsWith('Maxim din „Suma”'), 'titlul: ' + mx.sheet.cells.A1);
ok(v1('B5') === '10' && v1('B6') === '12', 'maxim pe oraș: Cluj 10, Iași 12: ' + v1('B5') + ' ' + v1('B6'));
ok(v1('B7') === '12' && /^=MAX\(/.test(mx.sheet.cells.B7), 'totalul e maximul tuturor (12), nu suma: ' + mx.sheet.cells.B7);
const mn = buildPivot(src, {}, { range, rowCol: 0, valCol: 2, op: 'min' }, 'R2');
const v2 = calc(mn);
ok(v2('B5') === '3' && v2('B6') === '5' && v2('B7') === '3', 'minim pe oraș: Cluj 3, Iași 5, total 3');
// Rânduri × coloane: Cluj/ian (10, 3) → max 10; Iași/feb 12; totalurile rândurilor și coloanelor sunt maxime pe grup.
const mx2 = buildPivot(src, {}, { range, rowCol: 0, colCol: 1, valCol: 2, op: 'max', show: 'pctTotal' }, 'R3');
const v3 = calc(mx2);
const cols = [mx2.sheet.cells.B4, mx2.sheet.cells.C4];
const ian = cols.indexOf('ian') === 0 ? 'B' : 'C', feb = ian === 'B' ? 'C' : 'B';
ok(v3(ian + '5') === '10' && v3(feb + '5') === '7' && v3(ian + '6') === '5' && v3(feb + '6') === '12', 'pe oraș și lună: Cluj ian 10, feb 7; Iași ian 5, feb 12');
ok(v3('D5') === '10' && v3('D6') === '12', 'totalul pe rând: maximul orașului (10, 12)');
ok(v3(ian + '7') === '10' && v3(feb + '7') === '12' && v3('D7') === '12', 'totalul pe coloană și cel general: maxime (10, 12, 12)');
ok(!/IFERROR/.test(JSON.stringify(mx2.sheet.cells)), 'la Maxim, „% din total” nu se aplică (valorile rămân)');
ok(mx2.pivot.data[0].fn === 'max' && mn.pivot.data[0].fn === 'min', 'GETPIVOTDATA știe că e maxim / minim');
console.log(bad ? `${bad} greșeli` : 'OK: Rezumat cu Maxim și Minim.');
process.exit(bad ? 1 : 0);
