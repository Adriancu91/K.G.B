// Test pentru DETECTLANGUAGE: limba textului, ghicită local (fără internet), și erorile.
// Rulare (în suite/): node tests/formula-detectlang.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-detlang-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll, functionNames } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const cells = {
  A1: 'Vă rugăm să trimiteți factura până la sfârșitul lunii.',
  A2: 'Please send the invoice before the end of the month.',
  A3: 'Le contrat est signé par les deux parties.',
  A4: 'Der Vertrag wird von beiden Parteien unterschrieben.',
  A5: 'Il contratto è firmato dalle due parti.',
  A6: 'El contrato está firmado por las dos partes.',
  A7: 'Köszönöm szépen, és minden jót kívánok.',
  A8: 'Mulțumesc', A9: 'the', A10: 'xyzzy qwrt', A11: '',
  B1: '=DETECTLANGUAGE(A1)', B2: '=DETECTLANGUAGE(A2)', B3: '=DETECTLANGUAGE(A3)', B4: '=DETECTLANGUAGE(A4)',
  B5: '=DETECTLANGUAGE(A5)', B6: '=DETECTLANGUAGE(A6)', B7: '=DETECTLANGUAGE(A7)', B8: '=DETECTLANGUAGE(A8)', B9: '=DETECTLANGUAGE(A9)',
  B10: '=DETECTLANGUAGE(A10)', B11: '=DETECTLANGUAGE(A11)', B12: '=DETECTLANGUAGE("Bună ziua și la mulți ani")', B13: '=DETECTLANGUAGE()',
  B14: '=IF(DETECTLANGUAGE(A2)="en";"engleză";"alta")',
};
const want = { B1: 'ro', B2: 'en', B3: 'fr', B4: 'de', B5: 'it', B6: 'es', B7: 'hu', B8: 'ro', B9: 'en', B10: '#N/A', B11: '#VALUE!', B12: 'ro', B13: '#N/A', B14: 'engleză' };
const r = evaluateAll(cells, { self: 'Foaia1', sheets: [{ name: 'Foaia1', cells }] });
let fail = 0;
if (functionNames().includes('DETECTLANGUAGE')) console.log('ok: DETECTLANGUAGE e în lista funcțiilor'); else { fail++; console.log('GREȘIT: lipsește din listă'); }
for (const [k, w] of Object.entries(want)) {
  const got = r[k]?.err ?? r[k]?.text;
  if (got === w) console.log(`ok: ${k} = ${w}`); else { fail++; console.log(`GREȘIT: ${k} = ${got}, trebuia ${w}`); }
}
if (fail) { console.log(`\n${fail} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut.');
