// Test: Mergi la special din Sheets (celulele goale, formulele, valorile, notele, zona curentă, ultima celulă, vizibile).
// Rulare (în suite/): node tests/sheet-gotospecial.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
const out = join(tmpdir(), `suite-gotosp-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/gotospecial.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { gotoSpecial, packCells } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const col = (c) => String.fromCharCode(65 + c);
const txt = (rs) => rs.map((g) => g.r0 === g.r1 && g.c0 === g.c1 ? `${col(g.c0)}${g.r0 + 1}` : `${col(g.c0)}${g.r0 + 1}:${col(g.c1)}${g.r1 + 1}`).join(' ');

// A1:C4: un tabel cu goluri, o formulă cu număr, una cu text, una cu eroare, ADEVĂRAT, o notă pe o celulă goală (E7).
const cells = { A1: 'Nume', B1: 'Sumă', C1: 'Total', A2: 'Ion', B2: '10', C2: '=B2*2', A3: 'Ana', C3: '=A3&"!"', A4: 'Dan', B4: 'TRUE', C4: '=1/0' };
const results = { C2: { text: '20', num: true }, C3: { text: 'Ana!', num: false }, C4: { text: '#DIV/0!', num: false, err: '#DIV/0!' }, B4: { text: 'TRUE', num: false } };
const ctx = (sel, extra = {}) => ({
  cells, results, styles: { A2: { note: 'n' }, E7: { note: 'goală' } }, rules: [{ range: 'B2:B9' }], lists: [{ range: 'A2' }],
  hiddenRows: new Set([2]), hiddenCols: new Set(), sel, at: { r: 1, c: 1 },
  region: () => ({ r0: 0, c0: 0, r1: 3, c1: 2 }), ...extra,
});
const A1 = [{ r0: 0, c0: 0, r1: 0, c1: 0 }];
check(txt(gotoSpecial('blanks', [], ctx(A1))) === 'B3', `golurile din tabel: ${txt(gotoSpecial('blanks', [], ctx(A1)))}`);
check(txt(gotoSpecial('formulas', [], ctx(A1))) === 'C2:C4', `toate formulele: ${txt(gotoSpecial('formulas', [], ctx(A1)))}`);
check(txt(gotoSpecial('formulas', ['num'], ctx(A1))) === 'C2', 'formulele cu număr');
check(txt(gotoSpecial('formulas', ['err'], ctx(A1))) === 'C4', 'formulele cu eroare');
check(txt(gotoSpecial('formulas', ['text'], ctx(A1))) === 'C3', 'formulele cu text');
check(txt(gotoSpecial('constants', ['num'], ctx(A1))) === 'B2', 'valorile numerice scrise');
check(txt(gotoSpecial('constants', ['bool'], ctx(A1))) === 'B4', 'ADEVĂRAT / FALS scris');
check(txt(gotoSpecial('constants', ['text'], ctx(A1))) === 'A1:C1 A2:A4', `textele scrise: ${txt(gotoSpecial('constants', ['text'], ctx(A1)))}`);
check(txt(gotoSpecial('notes', [], ctx(A1))) === 'A2 E7', `notele (și pe celulă goală): ${txt(gotoSpecial('notes', [], ctx(A1)))}`);
check(txt(gotoSpecial('last', [], ctx(A1))) === 'C4', 'ultima celulă folosită');
check(txt(gotoSpecial('region', [], ctx(A1))) === 'A1:C4', 'zona curentă');
check(txt(gotoSpecial('cond', [], ctx(A1))) === 'B2:B9', 'formatarea condiționată');
check(txt(gotoSpecial('valid', [], ctx(A1))) === 'A2', 'validarea');
// Într-o zonă selectată: doar acolo.
const sel = [{ r0: 1, c0: 1, r1: 3, c1: 2 }];
check(txt(gotoSpecial('formulas', [], ctx(sel))) === 'C2:C4' && txt(gotoSpecial('constants', [], ctx(sel))) === 'B2 B4', 'doar în zona selectată');
check(txt(gotoSpecial('cond', [], ctx(sel))) === 'B2:B4', 'formatarea condiționată tăiată la selecție');
check(txt(gotoSpecial('visible', [], ctx([{ r0: 0, c0: 0, r1: 3, c1: 1 }]))) === 'A1:B2 A4:B4', `vizibile (rândul 3 ascuns): ${txt(gotoSpecial('visible', [], ctx([{ r0: 0, c0: 0, r1: 3, c1: 1 }])))}`);
check(gotoSpecial('blanks', [], ctx(A1, { cells: {} })).length === 0, 'foaie goală: nimic');
check(txt(packCells([{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 1 }])) === 'A1:B2 B3', 'celulele se strâng în dreptunghiuri');
console.log(bad ? `\n${bad} GRESELI` : '\nTOATE TESTELE AU TRECUT');
process.exit(bad ? 1 : 0);
