// Test rapid pentru căutările cu expresii regulate, ca în LibreOffice (fișierele .ods): MATCH("testi..").
// Fără `match: 'regex'` (tabelele Suite și .xlsx) rămân * și ? ca în Excel.
// Rulare (în suite/): node tests/regex-crit.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-regex-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const cells = {
  R1: 'alfa', R2: 'testing', R3: 'Ion Popescu', R4: 'a.b', R5: 'mere', R6: 'mare',
  D1: '=MATCH("testi..";R1:R6;0)', D2: '=COUNTIF(R1:R6;"m.re")', D3: '=MATCH("ion.*";R1:R6;0)', D4: '=COUNTIF(R1:R6;"<>m.re")',
  D5: '=MATCH("m*re";R1:R6;0)', D6: '=VLOOKUP("Ion.*";R1:R6;1;0)', D7: '=MATCH("a.b";R1:R6;0)', D9: '=MATCH("a..a";R1:R6;0)', D8: '=MATCH("(";R1:R6;0)',
};
const regex = { D1: '2', D2: '2', D3: '3', D4: '4', D5: '#N/A', D6: 'Ion Popescu', D7: '4', D8: '#N/A', D9: '1' };
const excel = { D1: '#N/A', D2: '0', D3: '#N/A', D4: '6', D5: '5', D6: '#N/A', D7: '4', D8: '#N/A', D9: '#N/A' };

let bad = 0;
for (const [mode, want] of [['regex', regex], [undefined, excel]]) {
  const res = evaluateAll(cells, { self: 'Foaia1', sheets: [], match: mode });
  for (const [id, v] of Object.entries(want)) {
    if (res[id]?.text !== v) { bad++; console.log(`GREȘIT (${mode ?? 'excel'}) ${id} ${cells[id]}: ${res[id]?.text} în loc de ${v}`); }
  }
}
// După un calcul cu expresii, următorul (fără) revine la * și ?.
if (evaluateAll({ A1: 'testing', B1: '=MATCH("testi..";A1:A1;0)' }).B1.text !== '#N/A') { bad++; console.log('GREȘIT: modul a rămas pornit'); }
console.log(bad ? `${bad} greșeli` : 'Toate verificările au trecut.');
process.exit(bad ? 1 : 0);
