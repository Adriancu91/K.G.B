// Test: MATCH / XMATCH / VLOOKUP / HLOOKUP cu o zonă sau o listă ca valoare căutată dau câte un rezultat pe element
// (=SUM(--ISNUMBER(MATCH(B1:B4;{"x";"z"};0))) numără rândurile cu x sau z); cu o singură valoare, ca înainte.
// Rulare (în suite/): node tests/formula-lookuparray.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-flka-${process.pid}`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(join(out, 'formula.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const base = { A1: 'a', A2: 'b', A3: 'c', A4: 'a', B1: 'x', B2: 'y', B3: 'x', B4: 'z', C1: '1', C2: '2', C3: '4', C4: '8', E1: 'x; z' };
const run = (f) => {
  const cells = { ...base, H1: f };
  const r = evaluateAll(cells, { self: 'S', sheets: [{ name: 'S', cells, styles: {} }] }).H1;
  return r?.err ?? r?.value ?? r?.text;
};
check(run('=SUM(--ISNUMBER(MATCH(B1:B4;TEXTSPLIT(E1;"; ");0)))') === 3, 'ISNUMBER(MATCH(zonă; listă)) numără 3 rânduri: ' + run('=SUM(--ISNUMBER(MATCH(B1:B4;TEXTSPLIT(E1;"; ");0)))'));
check(run('=SUM(FILTER(C1:C4;ISNUMBER(MATCH(B1:B4;TEXTSPLIT(E1;"; ");0))))') === 13, 'FILTER cu MATCH pe zonă: ' + run('=SUM(FILTER(C1:C4;ISNUMBER(MATCH(B1:B4;TEXTSPLIT(E1;"; ");0))))'));
check(run('=SUM(MATCH(TEXTSPLIT("b; c";"; ");A1:A4;0))') === 5, 'MATCH cu listă căutată: 2 + 3 = ' + run('=SUM(MATCH(TEXTSPLIT("b; c";"; ");A1:A4;0))'));
check(run('=SUM(XMATCH(TEXTSPLIT("b; c";"; ");A1:A4))') === 5, 'XMATCH cu listă căutată: ' + run('=SUM(XMATCH(TEXTSPLIT("b; c";"; ");A1:A4))'));
check(run('=SUM(VLOOKUP(TEXTSPLIT("b; c";"; ");A1:C4;3;0))') === 6, 'VLOOKUP cu listă căutată: 2 + 4 = ' + run('=SUM(VLOOKUP(TEXTSPLIT("b; c";"; ");A1:C4;3;0))'));
check(run('=SUMPRODUCT(--ISTEXT(B1:C4))') === 4 && run('=SUMPRODUCT(--ISNUMBER(B1:C4))') === 4, 'ISTEXT / ISNUMBER pe o zonă: câte unul pe celulă');
check(run('=SUM(IFERROR(MATCH(B1:B4;TEXTSPLIT("x";"; ");0);0))') === 2, 'IFERROR pe listă: 1 + 0 + 1 + 0 = ' + run('=SUM(IFERROR(MATCH(B1:B4;TEXTSPLIT("x";"; ");0);0))'));
check(run('=SUM(IFNA(MATCH(B1:B4;TEXTSPLIT("x; y";"; ");0);10))') === 14, 'IFNA pe listă: 1 + 2 + 1 + 10 = ' + run('=SUM(IFNA(MATCH(B1:B4;TEXTSPLIT("x; y";"; ");0);10))'));
check(run('=SUMPRODUCT(--ISNA(MATCH(B1:B4;TEXTSPLIT("x";"; ");0)))') === 2 && run('=SUMPRODUCT(--ISERROR(MATCH(B1:B4;TEXTSPLIT("x";"; ");0)))') === 2, 'ISNA / ISERROR pe listă: 2 negăsite');
check(run('=IFERROR(1/0;"gol")') === 'gol' && run('=IFNA(MATCH("q";A1:A4;0);"nu")') === 'nu' && run('=ISERROR(1/0)') === 'ADEVĂRAT', 'cu o singură valoare, ca înainte');
check(run('=MATCH("c";A1:A4;0)') === 3, 'o singură valoare, ca înainte: ' + run('=MATCH("c";A1:A4;0)'));
check(run('=VLOOKUP("b";A1:C4;3;0)') === 2, 'VLOOKUP simplu: ' + run('=VLOOKUP("b";A1:C4;3;0)'));
check(run('=MATCH("q";A1:A4;0)') === '#N/A', 'negăsit: ' + run('=MATCH("q";A1:A4;0)'));
console.log(bad ? `\n${bad} GRESITE` : '\nTOATE OK');
process.exit(bad ? 1 : 0);
