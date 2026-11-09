// Test pentru tabelele pivot citite din .xlsx (pentru GETPIVOTDATA): folosește fișierele din corpus, dacă există.
// Rulare (în suite/): node tests/pivot.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pivot-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/xlsx.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { readXlsx } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
await build({ entryPoints: ['src/sheets/pivot.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out + '-d', logLevel: 'error' });
const { buildPivot } = await import(pathToFileURL(join(out + '-d', 'pivot.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(out + '-d', 'formula.js')).href);
rmSync(out + '-d', { recursive: true, force: true });

// Rezumatul făcut în Suite: GETPIVOTDATA îl recunoaște.
const src = { name: 'Vânzări', cells: { A1: 'Oraș', B1: 'Lună', C1: 'Suma', A2: 'Cluj', B2: 'ian', C2: '10', A3: 'Iași', B3: 'ian', C3: '5',
  A4: 'Cluj', B4: 'feb', C4: '7' }, styles: {} };
const pv = buildPivot(src, {}, { range: { r0: 0, c0: 0, r1: 3, c1: 2 }, rowCol: 0, colCol: 1, valCol: 2, op: 'sum' }, 'Rezumat');
const sum = { A1: '=GETPIVOTDATA("Suma";Rezumat!B5;"Oraș";"cluj")', A2: '=GETPIVOTDATA("Sumă din Suma";Rezumat!A4;"Lună";"ian")',
  A3: '=GETPIVOTDATA(Rezumat!A4;"Oraș[Cluj] Lună[feb]")', A4: '=GETPIVOTDATA("Suma";Rezumat!A4)' };
const res = evaluateAll(sum, { self: 'Foaia 1', sheets: [src, pv.sheet, { name: 'Foaia 1', cells: sum }], pivots: [pv.pivot] });
const got = ['A1', 'A2', 'A3', 'A4'].map((k) => res[k]?.text).join(' ');
console.log('Rezumat Suite:', pv.pivot.target, got);
if (got !== '17 15 7 22') { console.log('GREȘIT (trebuia 17 15 7 22)'); process.exit(1); }

const file = '../test-corpus/xlsx/ExcelPivotTableSample.xlsx';
if (!existsSync(file)) { console.log('fără corpus, sărit'); process.exit(0); }
const r = await readXlsx(new Uint8Array(readFileSync(file)));
console.log(JSON.stringify(r.pivots, null, 1));
const p = r.pivots?.[0];
const ok = p && p.target === 'A3:D7' && p.rows[0] === 'Field1' && p.cols[0] === 'Field3' && p.data[0]?.field === 'Field2'
  && p.hide?.Field1?.[0] === 'b' && /!A1:C4$/.test(p.source);
console.log(ok ? 'corect' : 'GREȘIT');
process.exit(ok ? 0 : 1);
