// Test pentru validarea datelor cu formulă proprie („doar valori pentru care o formulă e adevărată”): curățare, .xlsx dus-întors,
// formula mutată pe fiecare celulă și calculată cu valoarea nouă (ca în Sheets.tsx: customOk).
// Rulare (în suite/): node tests/sheet-validation-custom.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-valcustom-${process.pid}`);
await build({ entryPoints: ['src/sheets/lists.ts', 'src/sheets/xlsx.ts', 'src/sheets/cond.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { ruleOk, describeValRule, setList, cleanLists, invalidCells, listOrigin } = await import(pathToFileURL(join(dir, 'lists.js')).href);
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { formulaMatches } = await import(pathToFileURL(join(dir, 'cond.js')).href);
const { shiftFormula } = await import(pathToFileURL(join(dir, 'formula.js')).href);
rmSync(dir, { recursive: true, force: true });

const rule = { type: 'custom', op: 'between', a: 0, f: 'ȘI(A2>0;A2<=B2)' };
assert.equal(describeValRule(rule), 'o valoare pentru care formula =ȘI(A2>0;A2<=B2) dă ADEVĂRAT');
assert.equal(ruleOk(rule, '5'), true, 'fără foaie, valoarea se primește');
assert.equal(ruleOk(rule, '5', () => false), false);
assert.equal(ruleOk(rule, '  ', () => false), true, 'celula goală e mereu bună');
const lists = setList(undefined, 'A2:A10', [], undefined, { rule });
assert.deepEqual(cleanLists(JSON.parse(JSON.stringify(lists))), lists, 'se păstrează în fișierul Suite');
assert.deepEqual(cleanLists([{ range: 'A2:A10', values: [], rule: { type: 'custom', op: 'between', a: 0, f: '  ' } }]), [], 'formula goală se ignoră');
assert.deepEqual(cleanLists([{ range: 'A2:A10', values: [], rule: { type: 'custom', op: 'between', a: 0, f: '=A2>0' } }])[0].rule, { type: 'custom', op: 'between', a: 0, f: 'A2>0' });

// Ca în Sheets.tsx: formula se mută de la A2 la celula verificată și se calculează cu valoarea nouă.
const check = (cells, id, value) => {
  const o = listOrigin(lists[0]);
  const r = Number(id.slice(1)) - 1, c = id.charCodeAt(0) - 65;
  const cells2 = { ...cells, [id]: value };
  return formulaMatches(shiftFormula('=' + rule.f, r - o.r, c - o.c), { r0: r, r1: r, c0: c, c1: c }, cells2, { self: 'Foaia 1', sheets: [{ name: 'Foaia 1', cells: cells2, styles: {}, colW: {} }] }).length > 0;
};
const cells = { B2: '10', B3: '3' };
assert.equal(check(cells, 'A2', '7'), true, 'A2 = 7 ≤ B2 = 10');
assert.equal(check(cells, 'A3', '7'), false, 'A3 = 7 > B3 = 3 (formula s-a mutat pe rândul 3)');
assert.equal(check(cells, 'A2', '-1'), false, 'A2 = -1 nu e > 0');
const bad = invalidCells(lists, { ...cells, A2: '7', A3: '7' }, (id) => ({ ...cells, A2: '7', A3: '7' })[id] ?? '', (l, id, f) => check(cells, id, ({ A2: '7', A3: '7' })[id]));
assert.deepEqual(bad, ['A3'], 'încercuirea datelor nevalide găsește A3');

// .xlsx: type="custom" cu formula în engleză (numele și separatorii din fișier).
const sheet = { name: 'Foaia 1', colW: {}, cells: { B2: '10' }, styles: {}, lists };
const data = await writeXlsx([{ sheet, results: {} }]);
const xml = await (await JSZip.loadAsync(data)).file('xl/worksheets/sheet1.xml').async('string');
assert.match(xml, /<dataValidation type="custom" allowBlank="1" showErrorMessage="1" sqref="A2:A10"><formula1>AND\(A2&gt;0,A2&lt;=B2\)<\/formula1><\/dataValidation>/);
const back = (await readXlsx(data)).sheets[0].lists;
assert.deepEqual(back[0].rule, { ...rule, f: 'AND(A2>0,A2<=B2)' }, 'înapoi din .xlsx: aceeași regulă (cu numele din fișier, pe care Suite le înțelege)');
assert.equal(check({ ...cells }, 'A3', '2'), true);
console.log('validarea cu formulă: toate verificările trec');
