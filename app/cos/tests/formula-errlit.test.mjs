// Test: erorile scrise ca valoare (#N/A în formulă sau singură în celulă), criteriile cu erori și intersecția implicită
// la funcțiile cu o singură valoare, plus celulele cu text date prin referință la MAX / SUM / AVERAGEA (se sar sau valorează 0) și la AND / OR, LOOKUP binar, VALUE cu $ și COUNTIF cu eroare drept criteriu (=ABS(A1:A9) scris în rândul 5 = ABS(A5)).
// Rulare (în suite/): node tests/formula-errlit.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(tmpdir(), `suite-ferr-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(out).href);

const cells = {
  A1: '#DIV/0!', A2: '#N/A', A3: '-4', A4: '9', A5: '-16', A6: 'text #N/A',
  B1: '=ISNA(#N/A)', B2: '=ERROR.TYPE(A1)', B3: '=CHOOSE(2,#REF!,3)', B4: '=IF(FALSE,#VALUE!,3)', B5: '=ABS(A1:A6)',
  B6: '=ISERROR(A6)', B7: '=COUNTIF(A1:A6,"#N/A")', B8: '=#NULL!',
  C3: '=SQRT(A1:A6)', C4: '=SQRT(A1:A6)', C9: '=ABS(A1:A6)', D1: '=ROUND(A3:C3,0)',
  F1: '=MAX(A3,A6,A4)', F2: '=AVERAGEA(A6,2)', F3: '=COUNT(A3,A6)', F4: '=MAX(1,"x")', F5: '=SUM(A3,A6)',
  G1: '=AND(A3:A6)', G2: '=AND(A6)', G3: '=OR(0,"x")', G4: '=AND(1,TRUE)', G5: '=OR(A6,0)',
  J1: 'DOUBLE', J2: 'BLANK', J3: 'STRING', J4: 'REF', J5: 'AREA', K1: '1.1', K3: '7',
  H1: '=LOOKUP("DOUBLE",J1:J5,K1:K5)', H2: '=VALUE("$1,000")', H3: '=VALUE("1,234.5")', H4: '=VALUE("12,5")', H5: '=COUNTIF(A1:A6,1/0)', H6: '=VLOOKUP(3,L1:M4,2)',
  L1: '1', L2: '2', L3: '3', L4: '5', M1: 'a', M2: 'b', M3: 'c', M4: 'd',
};
const r = evaluateAll(cells, { self: 'S', sheets: [{ name: 'S', cells }] });
const want = { B1: 'ADEVĂRAT', B2: 2, B3: 3, B4: 3, B5: 16, B6: 'FALS', B7: 1, B8: '#NULL!', C3: '#NUM!', C4: 3, C9: '#VALUE!', F1: 9, F2: 1, F3: 1, F4: '#VALUE!', F5: -4, G1: 'ADEVĂRAT', G2: '#VALUE!', G3: '#VALUE!', G4: 'ADEVĂRAT', G5: 'FALS', H1: 1.1, H2: 1000, H3: 1234.5, H4: 12.5, H5: 1, H6: 'c' };
let bad = 0;
for (const [k, v] of Object.entries(want)) {
  const got = r[k].err ?? r[k].value ?? r[k].text;
  const ok = got === v;
  console.log(`${ok ? 'ok ' : 'GREȘIT'} ${k} ${cells[k]} = ${got}${ok ? '' : ` (trebuia ${v})`}`);
  if (!ok) bad++;
}
console.log(bad ? `\n${bad} greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);
