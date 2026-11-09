// Test rapid pentru referințele la tabelele din Excel (Tabel1[Suma] → $C$2:$C$4), cu rezultatele din Excel.
// Rulare (în suite/): node tests/structref.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-structref-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/structref.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { expandStructuredRefs } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

// Vanzari: B2:D6 pe foaia „Date”, cap pe rândul 2, total pe rândul 6. Fara: F1:G3 pe „Altă foaie”, fără cap.
const tables = [
  { name: 'Vanzari', sheet: 'Date', r0: 1, c0: 1, r1: 5, c1: 3, cols: ['Produs', 'Preț unitar', 'Cant [buc]'], head: 1, totals: 1 },
  { name: 'Fara', sheet: 'Altă foaie', r0: 0, c0: 5, r1: 2, c1: 6, cols: ['X', 'Y'], head: 0, totals: 0 },
];
const cases = [
  ['SUM(Vanzari[Preț unitar])', 3, 'Date', 'SUM($C$3:$C$5)'],
  ['COUNTA(Vanzari[#All])', 0, 'Date', 'COUNTA($B$2:$D$6)'],
  ['Vanzari[#Headers]', 0, 'Date', '$B$2:$D$2'],
  ['Vanzari[[#Totals],[Produs]]', 0, 'Date', '$B$6'],
  ['Vanzari[[#Headers],[#Data],[Produs]]', 0, 'Date', '$B$2:$B$5'],
  ['Vanzari[[Preț unitar]:[Cant [buc]]]', 0, 'Date', '$C$3:$D$5'],
  ["Vanzari[[Preț unitar]:[Cant '[buc']]]", 0, 'Date', '$C$3:$D$5'],
  ['Vanzari[[#This Row],[Preț unitar]]*Vanzari[@[Cant [buc]]]', 3, 'Date', '$C4*$D4'],
  ['[@Produs]&"x"', 2, 'Date', '$B3&"x"'],
  ['Vanzari[@Produs]', 0, 'Date', '#REF!'],
  ['SUM(Vanzari[Preț unitar])', 0, 'Rezumat', 'SUM(Date!$C$3:$C$5)'],
  ['SUM(Fara[Y])+ROWS(Fara)', 0, 'Rezumat', "SUM('Altă foaie'!$G$1:$G$3)+ROWS('Altă foaie'!$F$1:$G$3)"],
  ['Fara[#Headers]', 0, 'Altă foaie', '#REF!'],
  ['Vanzari[Nu există]', 0, 'Date', '#REF!'],
  ['"Vanzari[Produs]"&[1]Foaie!A1&VanzariX', 0, 'Date', '"Vanzari[Produs]"&[1]Foaie!A1&VanzariX'],
  ['VANZARI[produs]', 0, 'Date', '$B$3:$B$5'],
];
let bad = 0;
for (const [f, row, sheet, want] of cases) {
  const got = expandStructuredRefs(f, tables, row, sheet);
  if (got !== want) { bad++; console.log(`GREȘIT  ${f}  →  ${got}  (trebuia ${want})`); }
}
console.log(bad ? `${bad} din ${cases.length} greșite` : `Toate cele ${cases.length} cazuri sunt corecte.`);
process.exit(bad ? 1 : 0);
