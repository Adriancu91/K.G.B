// Test: 🧮 Rezolvitor → raportul de sensibilitate, intervalele permise (src/sheets/solver.ts solverRanges), pe modele cu răspuns
// cunoscut din manuale. Rulare (în suite/): node tests/sheets-solver-ranges.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, rmSync } from 'node:fs';

const entry = join(tmpdir(), `suite-solverrng-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-solverrng-${process.pid}.mjs`);
writeFileSync(entry, `export * from ${JSON.stringify(join(process.cwd(), 'src/sheets/solver.ts').split(String.fromCharCode(92)).join('/'))};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { solverRanges } = await import(pathToFileURL(out).href);
rmSync(entry, { force: true }); rmSync(out, { force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1) Producția clasică: max 3x + 5y cu x ≤ 4, 2y ≤ 12, 3x + 2y ≤ 18 → x = 2, y = 6.
//    Coeficienții: 3 poate crește cu 4,5 și scădea cu 3; 5 poate crește oricât și scădea cu 3.
//    Părțile drepte: 4 poate crește oricât și scădea cu 2 (neatinsă); 12 și 18 pot crește / scădea cu câte 6.
const p = { n: 2, x0: [0, 0], ops: ['<=', '<=', '<='], ints: [], bins: [], nonneg: true, goal: 'max',
  measure: (x) => [3 * x[0] + 5 * x[1], x[0], 4, 2 * x[1], 12, 3 * x[0] + 2 * x[1], 18] };
const r = solverRanges(p);
console.log(JSON.stringify(r));
check(same(r?.cInc, [4.5, null]) && same(r?.cDec, [3, 3]), 'producție: coeficienții (+4,5 / −3 și fără limită / −3)');
check(same(r?.rInc, [null, 6, 6]) && same(r?.rDec, [2, 6, 6]), 'producție: părțile drepte (fără limită / 2, 6 / 6, 6 / 6)');

// 2) Minim: min 2x + 3y cu x + y ≥ 4 → x = 4, y = 0; 2 poate crește cu 1 și scădea cu 2, 3 poate crește oricât și scădea cu 1;
//    partea dreaptă 4 poate crește oricât (prețul umbră rămâne 2) și scădea cu 4.
const q = { ...p, goal: 'min', ops: ['>='], measure: (x) => [2 * x[0] + 3 * x[1], x[0] + x[1], 4] };
const s = solverRanges(q);
console.log(JSON.stringify(s));
check(same(s?.cInc, [1, null]) && same(s?.cDec, [2, 1]), 'minim: coeficienții');
check(same(s?.rInc, [null]) && same(s?.rDec, [4]), 'minim: partea dreaptă');

// 3) Fără intervale: „egal cu”, numere întregi, formule neliniare.
check(solverRanges({ ...p, goal: 'value', target: 30 }) === null, '„egal cu”: fără intervale');
check(solverRanges({ ...p, ints: [0] }) === null, 'întregi: fără intervale');
check(solverRanges({ ...p, measure: (x) => [x[0] * x[1], x[0], 4, 2 * x[1], 12, 3 * x[0] + 2 * x[1], 18] }) === null, 'neliniar: fără intervale');

console.log(bad ? `\n${bad} GREȘELI` : '\nToate verificările au trecut.');
process.exit(bad ? 1 : 0);
