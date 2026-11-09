// Test pentru funcțiile Bessel (BESSELJ, BESSELY, BESSELI, BESSELK) și FINDB / SEARCHB / REPLACEB / DBCS.
// Valorile așteptate sunt cele matematice (la fel ca în Excel), cu 8 zecimale.
// Rulare (în suite/): node tests/formula-bessel.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-bessel-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const cases = [
  ['=BESSELJ(1,9;2)', 0.329925728], ['=BESSELJ(30;3)', 0.129211229], ['=BESSELJ(-2;1)', -0.576724808], ['=BESSELJ(0;0)', 1],
  ['=BESSELJ(2,5;1,9)', 0.497094103],
  ['=BESSELI(1,5;1)', 0.981666429], ['=BESSELI(2;0)', 2.279585302], ['=BESSELI(-1;3)', -0.022168424],
  ['=BESSELK(1,5;1)', 0.277387800], ['=BESSELK(0,05;0)', 3.114234034], ['=BESSELK(5;2)', 0.005308943712],
  ['=BESSELY(2,5;1)', 0.145918138], ['=BESSELY(0,1;0)', -1.534238651], ['=BESSELY(10;5)', 0.135403048], ['=BESSELY(1;3)', -5.821517606],
  ['=BESSELJ(1;-1)', '#NUM!'], ['=BESSELK(0;1)', '#NUM!'], ['=BESSELY(-1;0)', '#NUM!'], ['=BESSELJ("x";1)', '#VALUE!'],
  ['=FINDB("c";"abcabc";4)', 6], ['=SEARCHB("B";"abc")', 2], ['=REPLACEB("abcdef";2;3;"X")', 'aXef'], ['=DBCS("AB")', 'ＡＢ'],
];
const cells = Object.fromEntries(cases.map(([f], i) => [`A${i + 1}`, f]));
const res = evaluateAll(cells, { self: 'Foaia1', sheets: [] });
let fail = 0;
cases.forEach(([f, want], i) => {
  const r = res[`A${i + 1}`];
  const got = typeof want === 'number' ? r?.value : r?.text;
  const ok = typeof want === 'number' ? typeof got === 'number' && Math.abs(got - want) <= 1e-8 * Math.max(1, Math.abs(want)) : got === want;
  console.log(`${ok ? 'ok ' : 'GREȘIT'} ${f} = ${got}${ok ? '' : ` (trebuia ${want})`}`);
  if (!ok) fail++;
});
if (fail) { console.log(`\n${fail} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut');
