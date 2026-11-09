// Test pentru gruparea rândurilor din Rezumat (tabel pivot): datele pe luni / trimestre / ani, numerele pe intervale.
// Rulare (în suite/): node tests/pivot-group.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pivot-group-${process.pid}`);
await build({ entryPoints: ['src/sheets/pivot.ts', 'src/sheets/formula.ts', 'src/sheets/numfmt.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { buildPivot, groupBuckets } = await import(pathToFileURL(join(out, 'pivot.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
const { dateToSerial } = await import(pathToFileURL(join(out, 'numfmt.js')).href);
rmSync(out, { recursive: true, force: true });

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'corect' : 'GREȘIT'}: ${name}: ${JSON.stringify(got)}${ok ? '' : ' (trebuia ' + JSON.stringify(want) + ')'}`);
};

// Data | Oraș | Suma | Puncte
const rows = [['15.01.2026', 'Cluj', '10', '5'], ['31.01.2026', 'Iași', '20', '12'], ['01.02.2026', 'Cluj', '5', '99'],
  ['20.04.2026', 'Cluj', '100', '100'], ['03.01.2027', 'Iași', '1', '250']];
const cells = { A1: 'Data', B1: 'Oraș', C1: 'Suma', D1: 'Puncte' };
const styles = {};
rows.forEach((r, i) => {
  cells[`A${i + 2}`] = String(dateToSerial(r[0])); styles[`A${i + 2}`] = { fmt: 'date' };
  cells[`B${i + 2}`] = r[1]; cells[`C${i + 2}`] = r[2]; cells[`D${i + 2}`] = r[3];
});
const src = { name: 'Vânzări', cells, styles };
const range = { r0: 0, c0: 0, r1: rows.length, c1: 3 };

const run = (spec) => {
  const pv = buildPivot(src, {}, { range, valCol: 2, op: 'sum', ...spec }, 'Rezumat');
  const res = evaluateAll(pv.sheet.cells, { self: 'Rezumat', sheets: [src, pv.sheet] });
  const table = [];
  for (let r = 4; r < 4 + pv.rows + 1; r++) {
    const line = [];
    for (let c = 0; c <= (spec.colCol === undefined ? 1 : pv.cols + 1); c++) {
      const id = String.fromCharCode(65 + c) + (r + 1);
      line.push(res[id]?.text ?? pv.sheet.cells[id] ?? '');
    }
    table.push(line.join(' '));
  }
  return { pv, table };
};

check('luni', run({ rowCol: 0, group: 'month' }).table, ['ianuarie 2026 30', 'februarie 2026 5', 'aprilie 2026 100', 'ianuarie 2027 1', 'Total 136']);
check('trimestre', run({ rowCol: 0, group: 'quarter' }).table, ['T1 2026 35', 'T2 2026 100', 'T1 2027 1', 'Total 136']);
check('ani', run({ rowCol: 0, group: 'year' }).table, ['2026 135', '2027 1', 'Total 136']);
check('intervale de 100', run({ rowCol: 3, group: 100 }).table, ['0–99 35', '100–199 100', '200–299 1', 'Total 136']);
check('ani × oraș', run({ rowCol: 0, group: 'year', colCol: 1 }).table, ['2026 115 20 135', '2027 0 1 1', 'Total 115 21 136']);
const cnt = buildPivot(src, {}, { range, rowCol: 0, valCol: 2, op: 'count', group: 'quarter', show: 'pctTotal' }, 'Rezumat');
const cr = evaluateAll(cnt.sheet.cells, { self: 'Rezumat', sheets: [src, cnt.sheet] });
check('număr, % din total, pe trimestre', ['B5', 'B6', 'B7', 'B8'].map((k) => cr[k]?.value), [0.6, 0.2, 0.2, 1]);
check('titlul spune gruparea', run({ rowCol: 0, group: 'month' }).pv.sheet.cells.A1, 'Sumă din „Suma” pe „Data”, pe luni');
check('etichetele nu primesc format de dată', run({ rowCol: 0, group: 'year' }).pv.sheet.styles.A5, undefined);
// Intervale cu zecimale și valori din formule.
const dec = groupBuckets({ A1: 'x', A2: '0,25', A3: '0,75', A4: '=1+0,1' }, { A4: { num: true, value: 1.1, text: '1,1' } }, { r0: 0, c0: 0, r1: 3, c1: 0 }, 0, 0.5);
check('intervale de 0,5', dec.map((b) => b.label), ['0 – sub 0,5', '0,5 – sub 1', '1 – sub 1,5']);
check('textele și celulele goale nu intră', groupBuckets({ A1: 'x', A2: 'abc', A3: '', A4: '7' }, {}, { r0: 0, c0: 0, r1: 3, c1: 0 }, 0, 10).map((b) => b.label), ['0–9']);

console.log(fail ? `${fail} GREȘELI` : 'toate corecte');
process.exit(fail ? 1 : 0);
