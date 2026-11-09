// Test: funcțiile cu criterii (COUNTIF, SUMIF, SUMIFS, COUNTIFS, AVERAGEIFS, MAXIFS…) cu o listă de criterii dau câte un rezultat
// pe fiecare criteriu, ca în aplicațiile mari: =SUM(SUMIFS(C:C;A:A;{"a";"b"})) adună ambele; un singur criteriu rămâne ca înainte.
// Rulare (în suite/): node tests/formula-critarray.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-critarr-${process.pid}`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const cells = {
  A1: 'a', A2: 'b', A3: 'c', A4: 'a', C1: '1', C2: '2', C3: '4', C4: '8', G1: 'a', G2: 'c',
  E1: '=SUM(SUMIFS(C1:C4;A1:A4;{"a";"b"}))', E2: '=SUM(COUNTIFS(A1:A4;{"a";"b"}))', E3: '=SUM(SUMIFS(C1:C4;A1:A4;{"a";"b"};C1:C4;">1"))',
  E4: '=SUM(COUNTIF(A1:A4;{"a";"c"}))', E5: '=SUM(SUMIF(A1:A4;G1:G2;C1:C4))', E6: '=MAX(MAXIFS(C1:C4;A1:A4;{"b";"c"}))',
  E7: '=SUMIFS(C1:C4;A1:A4;"a")', E8: '=SUMPRODUCT(COUNTIF(A1:A4;{"a";"b";"z"}))', E9: '=SUM(AVERAGEIFS(C1:C4;A1:A4;{"a";"b"}))',
  F1: '=COUNTIF(A1:A4;{"a";"b"})',
};
const r = evaluateAll(cells, { self: 'S', sheets: [{ name: 'S', cells }] });
const v = (id) => r[id]?.text;
check(v('E1') === '11', 'SUMIFS cu două criterii: ' + v('E1'));
check(v('E2') === '3', 'COUNTIFS cu două criterii: ' + v('E2'));
check(v('E3') === '10', 'SUMIFS cu listă și încă o condiție: ' + v('E3'));
check(v('E4') === '3', 'COUNTIF cu listă: ' + v('E4'));
check(v('E5') === '13', 'SUMIF cu criteriile dintr-o zonă: ' + v('E5'));
check(v('E6') === '4', 'MAXIFS cu listă: ' + v('E6'));
check(v('E7') === '9', 'un singur criteriu, ca înainte: ' + v('E7'));
check(v('E8') === '3', 'SUMPRODUCT(COUNTIF(listă)) cu un criteriu fără potriviri: ' + v('E8'));
check(v('E9') === '6.5' || v('E9') === '6,5', 'AVERAGEIFS cu listă: ' + v('E9'));
// Singur în celulă rămâne primul rezultat (ca în fișierele vechi), fără să se verse peste celulele de dedesubt.
check(v('F1') === '2' && !r.F1?.spill, `singur în celulă: ${v('F1')}`);

console.log(bad ? `\n${bad} GRESIT` : '\nTOATE OK');
process.exit(bad ? 1 : 0);
