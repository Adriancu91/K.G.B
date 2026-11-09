// Test pentru modelul 🧮 Rezolvitorului în .xlsx: numele ascunse solver_* (locale foii) scrise și citite înapoi,
// plus curățarea modelului din .ssheet (cleanSolver). Rulare (în suite/): node tests/sheets-solver-xlsx.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const dir = join(tmpdir(), `suite-solverxlsx-${process.pid}`);
const entry = join(tmpdir(), `suite-solverxlsx-entry-${process.pid}.ts`);
const p = (f) => JSON.stringify(join(process.cwd(), f).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { readXlsx, writeXlsx } from ${p('src/sheets/xlsx.ts')};\nexport { cleanSolver, solverNames, solverFromNames } from ${p('src/sheets/solver.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'x.mjs'), logLevel: 'error' });
const { readXlsx, writeXlsx, cleanSolver, solverNames, solverFromNames } = await import(pathToFileURL(join(dir, 'x.mjs')).href);
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const model = { obj: 'A3', goal: 'max', target: '', vars: 'A1:A2', nonneg: true,
  cons: [{ l: 'A1', op: '<=', r: '4' }, { l: 'A4', op: '<=', r: 'B4' }, { l: 'A5', op: '>=', r: '2,5' }, { l: 'A1:A2', op: 'int', r: '' }] };
// Numele, ca în fișierele altor programe.
const names = Object.fromEntries(solverNames(model, "'Foaia 1'").map((n) => [n.name, n.ref]));
ok(names.solver_opt === "'Foaia 1'!$A$3" && names.solver_adj === "'Foaia 1'!$A$1:$A$2" && names.solver_typ === '1' && names.solver_num === '4', 'numele: obiectiv, celule, tip, număr: ' + JSON.stringify([names.solver_opt, names.solver_adj]));
ok(names.solver_rel1 === '1' && names.solver_rhs1 === '4' && names.solver_rhs2 === "'Foaia 1'!$B$4" && names.solver_rel3 === '3' && names.solver_rhs3 === '2.5' && names.solver_rel4 === '4' && names.solver_rhs4 === '"integer"', 'condițiile: semne și valori');
ok(names.solver_neg === '1', 'nenegative: solver_neg = 1');
// În .xlsx: nume ascunse, locale foii; citite înapoi la fel.
const cells = { A1: '0', A2: '0', A3: '=3*A1+5*A2', A4: '=2*A2', A5: '=3*A1+2*A2', B4: '12' };
const bytes = await writeXlsx([{ sheet: { name: 'Altă foaie', colW: {}, cells: { A1: '1' }, styles: {} }, results: {} }, { sheet: { name: 'Foaia 1', colW: {}, cells, styles: {}, solver: model }, results: {} }]);
const wb = await (await JSZip.loadAsync(bytes)).file('xl/workbook.xml').async('string');
let errs = 0;
new DOMParser({ onError: () => { errs++; } }).parseFromString(wb, 'text/xml');
ok(!errs, 'workbook.xml rămâne XML valid');
ok(/<definedName name="solver_opt" localSheetId="1" hidden="1">'Foaia 1'!\$A\$3<\/definedName>/.test(wb), 'solver_opt ascuns, local foii a doua');
ok(wb.includes('<definedName name="solver_rhs4" localSheetId="1" hidden="1">&quot;integer&quot;</definedName>'), 'int: „integer” între ghilimele');
const back = await readXlsx(bytes);
const want = { obj: 'A3', goal: 'max', target: '', vars: 'A1:A2', cons: [{ l: 'A1', op: '<=', r: '4' }, { l: 'A4', op: '<=', r: 'B4' }, { l: 'A5', op: '>=', r: '2,5' }, { l: 'A1:A2', op: 'int', r: '' }], nonneg: true };
ok(JSON.stringify(back.sheets[1].solver) === JSON.stringify(want), 'citit înapoi: ' + JSON.stringify(back.sheets[1].solver));
ok(!back.sheets[0].solver && !(back.names ?? []).some((n) => /^solver_/.test(n.name)), 'prima foaie fără model; numele solver_* nu apar la Nume definite');
// Valoare și fără nenegative.
const v = solverFromNames({ solver_opt: 'Sheet1!$C$9', solver_typ: '3', solver_val: '1500.5', solver_adj: 'Sheet1!$B$2,Sheet1!$B$4:$B$5', solver_neg: '2', solver_num: '1', solver_lhs1: 'Sheet1!$B$2', solver_rel1: '5', solver_rhs1: '"binary"' });
ok(v.goal === 'value' && v.target === '1500,5' && v.vars === 'B2, B4:B5' && v.nonneg === false && v.cons[0].op === 'bin', 'din numele altui program: ' + JSON.stringify(v));
ok(solverFromNames({ solver_typ: '1' }) === null, 'fără obiectiv și celule → nimic');
// .ssheet: modelul curățat.
ok(cleanSolver({ obj: 'A3', vars: 'A1', goal: 'ciudat', cons: [{ l: 'A1', op: '<=', r: '4' }, { l: 'A2', op: 'xx' }], nonneg: false }).cons.length === 1, 'cleanSolver: semnele necunoscute se scot');
ok(cleanSolver(null) === null && cleanSolver({}) === null, 'cleanSolver: gol → nimic');
console.log(fail ? `${fail} GREȘELI` : 'TOATE OK');
process.exit(fail ? 1 : 0);
