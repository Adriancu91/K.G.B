// Test pentru mutarea referințelor din formule la inserarea / ștergerea de rânduri și coloane (ca în Excel).
// Rulare (în suite/): node tests/insert-refs.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-insert-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/insert.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { shiftFormulaRefs } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

// [formula, axă, la (de la 0), câte (+ inserare / - ștergere), în foaia țintă, rezultat așteptat]
const cases = [
  ['=SUM(A1:A10)', 'r', 4, 2, true, '=SUM(A1:A12)'],
  ['=B5*2', 'r', 4, -1, true, '=#REF!*2'],
  ['=SUM(2:5)', 'r', 0, 1, true, '=SUM(3:6)'],
  ['=SUM(2:5)', 'r', 3, 2, true, '=SUM(2:7)'],
  ['=SUM($2:$5)', 'r', 2, -2, true, '=SUM($2:$3)'],
  ['=SUM(3:4)', 'r', 2, -2, true, '=SUM(#REF!)'],
  ['=SUM(A:C)', 'c', 1, 1, true, '=SUM(A:D)'],
  ['=SUM(B:C)', 'c', 0, -1, true, '=SUM(A:B)'],
  ['=SUM(A:C)', 'r', 0, 5, true, '=SUM(A:C)'],
  ['=SUM(2:5)', 'c', 0, 5, true, '=SUM(2:5)'],
  ['=SUM(Date!2:5)+SUM(2:5)', 'r', 0, 1, false, '=SUM(Date!3:6)+SUM(2:5)'],
  ['=COUNTIF(A1:A9;"2:5")', 'r', 0, 1, true, '=COUNTIF(A2:A10;"2:5")'],
  ['=SUM(A1:INDEX(A1:A4;3))', 'r', 0, 1, true, '=SUM(A2:INDEX(A2:A5;3))'],
];
let bad = 0;
for (const [f, axis, at, n, inT, want] of cases) {
  const got = shiftFormulaRefs(f, axis, at, n, inT, 'Date');
  if (got !== want) { bad++; console.log(`GRESIT ${f} (${axis} ${at} ${n}) → ${got}, trebuia ${want}`); }
}
console.log(bad ? `${bad} greșite din ${cases.length}` : `toate ${cases.length} corecte`);
process.exit(bad ? 1 : 0);
