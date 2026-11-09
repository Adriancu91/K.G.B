// Test pentru Rezumat (tabel pivot) cu Produs, Deviație standard și Varianță (din eșantion și din toată populația):
// valorile pe categorii, pe rânduri × coloane, pe intervale și totalurile (calculate pe tot grupul, nu adunate).
// Rulare (în suite/): node tests/pivot-stats.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pivst-${process.pid}`);
await build({ entryPoints: ['src/sheets/pivot.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { buildPivot, PIVOT_OPS } = await import(pathToFileURL(join(out, 'pivot.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GRESIT: ') + m); if (!c) bad++; };
const near = (t, x) => t !== undefined && Math.abs(Number(String(t).replace(',', '.')) - x) < 1e-6;
// Cluj: 2, 4, 6 (ian, feb, ian); Iași: 3, 5 (ian, feb); un rând Iași fără valoare (nu intră).
const src = { name: 'Date', cells: { A1: 'Oraș', B1: 'Lună', C1: 'Valoare',
  A2: 'Cluj', B2: 'ian', C2: '2', A3: 'Iași', B3: 'ian', C3: '3', A4: 'Cluj', B4: 'feb', C4: '4', A5: 'Iași', B5: 'feb', C5: '5', A6: 'Cluj', B6: 'ian', C6: '6', A7: 'Iași', B7: 'feb' }, styles: {} };
const range = { r0: 0, c0: 0, r1: 6, c1: 2 };
for (const k of ['product', 'countnums', 'stdev', 'stdevp', 'var', 'varp']) ok(PIVOT_OPS.some(([o]) => o === k), `${k} e în lista de calcule`);
const calc = (pv) => {
  const r = evaluateAll(pv.sheet.cells, { self: pv.sheet.name, sheets: [src, pv.sheet] });
  return (id) => r[id]?.text;
};
const one = (op) => { const pv = buildPivot(src, {}, { range, rowCol: 0, valCol: 2, op }, 'R'); return [pv, calc(pv)]; };
let [pv, v] = one('product');
ok(pv.sheet.cells.A1.startsWith('Produs din „Valoare”'), 'titlul: ' + pv.sheet.cells.A1);
ok(v('B5') === '48' && v('B6') === '15', 'produs pe oraș: Cluj 48, Iași 15 (celula goală nu face produsul 0): ' + v('B5') + ' ' + v('B6'));
ok(v('B7') === '720', 'totalul e produsul tuturor (720): ' + v('B7'));
[pv, v] = one('stdev');
ok(near(v('B5'), 2) && near(v('B6'), Math.SQRT2), 'deviația standard: Cluj 2, Iași √2: ' + v('B5') + ' ' + v('B6'));
ok(near(v('B7'), Math.sqrt(2.5)), 'totalul: deviația tuturor (√2,5): ' + v('B7'));
[pv, v] = one('stdevp');
ok(near(v('B5'), Math.sqrt(8 / 3)) && near(v('B6'), 1), 'deviația populației: Cluj √(8/3), Iași 1');
[pv, v] = one('var');
ok(near(v('B5'), 4) && near(v('B6'), 2) && near(v('B7'), 2.5), 'varianța: Cluj 4, Iași 2, total 2,5');
[pv, v] = one('varp');
ok(near(v('B5'), 8 / 3) && near(v('B6'), 1) && near(v('B7'), 2), 'varianța populației: Cluj 8/3, Iași 1, total 2');
ok(pv.pivot.data[0].fn === 'varp', 'GETPIVOTDATA știe că e varianța populației');
[pv, v] = one('countnums');
ok(v('B5') === '3' && v('B6') === '2' && v('B7') === '5', 'număr de numere: Cluj 3, Iași 2 (rândul gol nu intră), total 5: ' + v('B5') + ' ' + v('B6') + ' ' + v('B7'));
const pt = buildPivot(src, {}, { range, rowCol: 0, valCol: 1, op: 'countnums' }, 'RT');
const vt = calc(pt);
ok(vt('B5') === '0' && vt('B7') === '0', 'număr de numere dintr-o coloană cu text: 0');
// Rânduri × coloane, cu „% din total” cerut (nu se aplică): Cluj/ian (2, 6) → produs 12; Cluj/feb 4; Iași/ian 3; Iași/feb 5.
const p2 = buildPivot(src, {}, { range, rowCol: 0, colCol: 1, valCol: 2, op: 'product', show: 'pctTotal' }, 'R2');
const v2 = calc(p2);
const ian = p2.sheet.cells.B4 === 'ian' ? 'B' : 'C', feb = ian === 'B' ? 'C' : 'B';
ok(v2(ian + '5') === '12' && v2(feb + '5') === '4' && v2(ian + '6') === '3' && v2(feb + '6') === '5', 'produs pe oraș și lună: 12, 4, 3, 5');
ok(v2('D5') === '48' && v2('D6') === '15' && v2(ian + '7') === '36' && v2(feb + '7') === '20' && v2('D7') === '720', 'totalurile pe rând, coloană și general: 48, 15, 36, 20, 720');
ok(!/IFERROR\([^)]*\/|pctTotal/.test(JSON.stringify(p2.sheet.cells)), 'la Produs, „% din total” nu se aplică');
// O singură valoare într-un grup: deviația din eșantion nu se poate calcula → celula rămâne goală, fără eroare.
const p3 = buildPivot(src, {}, { range, rowCol: 0, colCol: 1, valCol: 2, op: 'stdev' }, 'R3');
const v3 = calc(p3);
ok(v3(p3.sheet.cells.B4 === 'feb' ? 'B5' : 'C5') === '', 'Cluj/feb (o singură valoare): gol, nu eroare: „' + v3(p3.sheet.cells.B4 === 'feb' ? 'B5' : 'C5') + '”');
// Pe intervale de numere: grupăm după Valoare însăși, câte 4 (0–3: 2, 3; 4–7: 4, 5, 6).
const p4 = buildPivot(src, {}, { range, rowCol: 2, valCol: 2, op: 'product', group: 4 }, 'R4');
const v4 = calc(p4);
ok(p4.sheet.cells.A5 === '0–3' && v4('B5') === '6' && v4('B6') === '120', 'pe intervale: 0–3 → 6, 4–7 → 120: ' + v4('B5') + ' ' + v4('B6'));
console.log(bad ? `${bad} greșeli` : 'OK: Rezumat cu Produs, Număr de numere, Deviație standard și Varianță.');
process.exit(bad ? 1 : 0);
