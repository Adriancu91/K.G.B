// Test: XLOOKUP cu toate modurile (potrivire exactă / aproximativă / cu * și ?, căutare de la sfârșit, căutare binară).
// Rulare (în suite/): node tests/formula-xlookup.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(tmpdir(), `suite-fxl-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(out).href);

// A: venitul maxim (crescător, cu două texte în mijloc, ca în fișierul real), B: cota (pe rândurile lui A); D: alt tabel, descrescător, cu rezultatul tot din B.
const cells = {
  A1: '9700', A2: 'xyz', A3: 'xyz84200', A4: '160726', A5: '204100', A6: '510300',
  B1: '0,1', B2: '0,22', B3: '0,24', B4: '0,32', B5: '0,35', B6: '0,37',
  D1: '510300', D2: '204100', D3: '160726', D4: '84200', D5: '39475', D6: '9700',
  F1: 'Ana', F2: 'Bogdan', F3: 'Ana', G1: '1', G2: '2', G3: '3',
  H1: '=XLOOKUP(46523,A1:A6,B1:B6,0,1,2)',
  H2: '=XLOOKUP(46523,D1:D6,B1:B6,0,1,-2)',
  H3: '=XLOOKUP(46523,D1:D6,B1:B6,"lipsă",-1)',
  H4: '=XLOOKUP(46523,D1:D6,B1:B6,"lipsă",1)',
  H5: '=XLOOKUP(46523,D1:D6,B1:B6,"lipsă")',
  H6: '=XLOOKUP(46523,D1:D6,B1:B6)',
  H7: '=XLOOKUP("Ana",F1:F3,G1:G3,,0,-1)',
  H8: '=XLOOKUP("Bog*",F1:F3,G1:G3,,2)',
  H9: '=XLOOKUP("Bog*",F1:F3,G1:G3)',
  H10: '=XLOOKUP(160726,D1:D6,B1:B6,0,0,-2)',
  H11: '=XLOOKUP(1,G1:G3,F1:F3,,5)',
};
const r = evaluateAll(cells, { self: 'Foaia 1', sheets: [{ name: 'Foaia 1', cells }] });
const want = { H1: 0.22, H2: 0.32, H3: 0.35, H4: 0.32, H5: 'lipsă', H6: '#N/A', H7: 3, H8: 2, H9: '#N/A', H10: 0.24, H11: '#VALUE!' };
let bad = 0;
for (const [k, v] of Object.entries(want)) {
  const got = r[k].err ?? r[k].value ?? r[k].text;
  const ok = typeof v === 'number' ? Math.abs(got - v) < 1e-9 : got === v;
  console.log(`${ok ? 'ok ' : 'GREȘIT'} ${k} ${cells[k]} = ${got}${ok ? '' : ` (trebuia ${v})`}`);
  if (!ok) bad++;
}
console.log(bad ? `\n${bad} greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
