// Test pentru 🔍 Evaluează formula (Sheets, evalformula.ts), cu motorul de formule adevărat.
// Rulare (în suite/): node tests/sheets-evalformula.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-evalf-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-evalf-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export * from ${src('src/sheets/evalformula.ts')};\nexport { evaluateAll } from ${src('src/sheets/formula.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { formulaSteps, literalOf, cellRefs, innermost, evaluateAll } = await import(pathToFileURL(out).href);
rmSync(out, { force: true }); rmSync(entry, { force: true });
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };

const cells = { A1: '10', A2: '20', A3: '5', B1: 'mere', C1: '=A1*2' };
const evalExpr = (expr) => literalOf(evaluateAll({ ...cells, DX1000000: '=' + expr }, undefined, undefined, ['DX1000000']).DX1000000);
ok(JSON.stringify(cellRefs('A1+$B$2*SUM(A1:A3)+Foaie2!C3+"A5"').map((r) => r.ref)) === '["A1","$B$2"]', 'celulele simple, fără zone, alte foi și texte');
ok(JSON.stringify(innermost('SUM(1;MAX(2;3))+1')) === JSON.stringify({ start: 6, end: 14 }), 'cea mai din interior paranteză, cu funcția ei');
const s1 = formulaSteps('=SUM(A1:A3)+MAX(A1;A3*2)', evalExpr);
ok(JSON.stringify(s1) === JSON.stringify(['=SUM(A1:A3)+MAX(A1;A3*2)', '=SUM(A1:A3)+MAX(10;5*2)', '=35+MAX(10;5*2)', '=35+10', '45']), 'pașii: ' + JSON.stringify(s1));
const s2 = formulaSteps('=IF(A1>5;"mare";"mic")&" "&B1', evalExpr);
ok(s2[1] === '=IF(10>5;"mare";"mic")&" "&"mere"' && s2[s2.length - 1] === '"mare mere"', 'texte și IF: ' + JSON.stringify(s2));
const s3 = formulaSteps('=(A1+A2)*(A3-1)', evalExpr);
ok(JSON.stringify(s3) === JSON.stringify(['=(A1+A2)*(A3-1)', '=(10+20)*(5-1)', '=30*(5-1)', '=30*4', '120']), 'paranteze simple: ' + JSON.stringify(s3));
const s4 = formulaSteps('=C1/0', evalExpr);
ok(s4[1] === '=20/0' && /^#/.test(s4[s4.length - 1]), 'eroarea apare la final: ' + JSON.stringify(s4));
const s5 = formulaSteps('=A1', evalExpr);
ok(JSON.stringify(s5) === JSON.stringify(['=A1', '10']), 'o singură celulă: ' + JSON.stringify(s5));
const s6 = formulaSteps('=SUM(SORT(A1:A3))', evalExpr);
ok(s6[s6.length - 1] === '35', 'listă de valori în interior: tot ajunge la valoarea finală ' + JSON.stringify(s6));
ok(JSON.stringify(formulaSteps('mere', evalExpr)) === '["mere"]', 'un text, nu o formulă: un singur pas');
console.log(fail ? `${fail} GREȘELI` : 'Toate testele trec.');
process.exit(fail ? 1 : 0);
