// Test pentru ODDFPRICE și ODDFYIELD (obligațiuni cu prima perioadă de cupon neregulată), cu exemplele din documentația oficială.
// Rulare (în suite/): node tests/formula-oddf.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-oddf-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const cells = {
  // Perioadă scurtă (exemplul oficial): 113,597717474079 și 7,72455%.
  A1: '=ODDFPRICE(DATE(2008;11;11);DATE(2021;3;1);DATE(2008;10;15);DATE(2009;3;1);0,0785;0,0625;100;2;1)',
  A2: '=ODDFYIELD(DATE(2008;11;11);DATE(2021;3;1);DATE(2008;10;15);DATE(2009;3;1);0,0575;84,5;100;2;0)',
  // Dus-întors: randamentul prețului dă înapoi randamentul (și pe o perioadă lungă, de peste un an).
  A3: '=ODDFYIELD(DATE(2008;11;11);DATE(2021;3;1);DATE(2008;10;15);DATE(2009;3;1);0,0785;A1;100;2;1)',
  A4: '=ODDFPRICE(DATE(2008;6;10);DATE(2015;3;1);DATE(2007;10;15);DATE(2009;3;1);0,06;0,05;100;2;0)',
  A5: '=ODDFYIELD(DATE(2008;6;10);DATE(2015;3;1);DATE(2007;10;15);DATE(2009;3;1);0,06;A4;100;2;0)',
  // Erori: emiterea după decontare, frecvență greșită.
  A6: '=ODDFPRICE(DATE(2008;11;11);DATE(2021;3;1);DATE(2008;12;15);DATE(2009;3;1);0,0785;0,0625;100;2;1)',
  A7: '=ODDFPRICE(DATE(2008;11;11);DATE(2021;3;1);DATE(2008;10;15);DATE(2009;3;1);0,0785;0,0625;100;3;1)',
};
const r = evaluateAll(cells, { self: 'Foaia1', sheets: [{ name: 'Foaia1', cells }] });
const num = (k) => Number(String(r[k]?.value ?? r[k]).replace(',', '.'));
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
ok(Math.abs(num('A1') - 113.597717474079) < 1e-8, `ODDFPRICE, perioadă scurtă = 113,5977174741 (${num('A1')})`);
ok(Math.abs(num('A2') - 0.0772455) < 1e-6, `ODDFYIELD, exemplul oficial ≈ 7,72455% (${num('A2')})`);
ok(Math.abs(num('A3') - 0.0625) < 1e-9, `ODDFYIELD(ODDFPRICE) dă înapoi 6,25% (${num('A3')})`);
ok(num('A4') > 100 && num('A4') < 110, `ODDFPRICE, perioadă lungă: cupon 6% > randament 5% → peste 100 (${num('A4')})`);
ok(Math.abs(num('A5') - 0.05) < 1e-9, `ODDFYIELD pe perioadă lungă dă înapoi 5% (${num('A5')})`);
ok(r.A6?.err === '#NUM!' && r.A7?.err === '#NUM!', 'date în ordine greșită / frecvență 3 → #NUM!');
if (fail) { console.log(`\n${fail} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut.');
