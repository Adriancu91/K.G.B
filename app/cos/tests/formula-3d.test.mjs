// Test pentru referințele pe mai multe foi (=SUM(Foaie1:Foaie3!A1), 'Foaia 1:Foaia 3'!A1:B2).
// Rulare (în suite/): node tests/formula-3d.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-f3d-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(out).href);
const out2 = out;

const s1 = { A1: '1', B1: '10', C1: 'a' };
const s2 = { A1: '2', B1: '20', C1: '' };
const s3 = { A1: '3', B1: '30', C1: 'c' };
const s4 = { A1: '100' };
const main = {
  A1: '=SUM(Foaie1:Foaie3!A1)', A2: '=AVERAGE(Foaie1:Foaie3!A1)', A3: '=COUNTA(Foaie1:Foaie3!C1)',
  A4: '=SUM(Foaie3:Foaie1!A1:B1)', A5: "=SUM('Foaia 1:Foaia 2'!A1)", A6: '=MAX(Foaie1:Foaie3!B1)', A7: '=SUM(Foaie1:Lipsa!A1)',
  A8: '=SUM(Foaie2:Foaie2!A1)', A9: '=MIN(Foaie2:Foaie3!A1:B1)',
};
const sheets = [
  { name: 'Foaie1', cells: s1 }, { name: 'Foaie2', cells: s2 }, { name: 'Foaie3', cells: s3 }, { name: 'Total', cells: main },
  { name: 'Foaia 1', cells: s4 }, { name: 'Foaia 2', cells: { A1: '5' } },
];
const r = evaluateAll(main, { self: 'Total', sheets });
const want = { A1: 6, A2: 2, A3: 2, A4: 66, A5: 105, A6: 30, A7: '#REF!', A8: 2, A9: 2 };
let bad = 0;
for (const [k, v] of Object.entries(want)) {
  const got = r[k];
  const val = got?.err ?? got?.value;
  const ok = val === v;
  if (!ok) bad++;
  console.log(`${ok ? 'OK    ' : 'GRESIT'} ${k} ${main[k]} → ${JSON.stringify(val)} (trebuie ${JSON.stringify(v)})`);
}
// Redenumirea unei foi schimbă și capetele referințelor pe mai multe foi.
const { renameSheetInFormula: ren } = await import(pathToFileURL(out2).href);
for (const [f, from, to, want] of [
  ['=SUM(Foaie1:Foaie3!A1)', 'Foaie1', 'Ianuarie', '=SUM(Ianuarie:Foaie3!A1)'],
  ['=SUM(Foaie1:Foaie3!A1)', 'Foaie3', 'Martie', '=SUM(Foaie1:Martie!A1)'],
  ['=SUM(Foaie1:Foaie3!A1)', 'Foaie1', 'Luna 1', "=SUM('Luna 1:Foaie3'!A1)"],
  ["=SUM('Foaia 1:Foaia 2'!A1)", 'Foaia 2', 'Gata', "=SUM('Foaia 1:Gata'!A1)"],
  ['=SUM(A1:B2)+Foaie1!A1', 'Foaie1', 'X', '=SUM(A1:B2)+X!A1'],
  ['=SUM(Foaie1:Foaie3!A1)', 'Alta', 'Y', '=SUM(Foaie1:Foaie3!A1)'],
]) {
  const got = ren(f, from, to);
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? 'OK    ' : 'GRESIT'} redenumire ${from} → ${to}: ${f} → ${got} (trebuie ${want})`);
}
rmSync(out, { force: true });
console.log(bad ? `\n${bad} greșite` : '\nToate au trecut');
process.exit(bad ? 1 : 0);
