// Test pentru validarea datelor din Sheets: reguli pe număr întreg / zecimal / dată / lungime, mesaje și dus-întors .xlsx.
// Rulare (în suite/): node tests/sheet-validation.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-valid-${process.pid}`);
await build({ entryPoints: ['src/sheets/lists.ts', 'src/sheets/xlsx.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { ruleOk, describeValRule, setList, cleanLists, hasValues, listAt } = await import(pathToFileURL(join(dir, 'lists.js')).href);
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
rmSync(dir, { recursive: true, force: true });

let n = 0;
const eq = (a, b, msg) => { n++; assert.deepEqual(a, b, msg); };

// Număr întreg între 1 și 10.
const whole = { type: 'whole', op: 'between', a: 1, b: 10 };
eq([ruleOk(whole, '5'), ruleOk(whole, '10'), ruleOk(whole, '11'), ruleOk(whole, '2,5'), ruleOk(whole, 'abc'), ruleOk(whole, '')], [true, true, false, false, false, true], 'întreg');
// Zecimal cel puțin 0,5 (și „1.234,5” cu mii).
const dec = { type: 'decimal', op: 'ge', a: 0.5 };
eq([ruleOk(dec, '0,5'), ruleOk(dec, '0.4'), ruleOk(dec, '1.234,5'), ruleOk(dec, '250 lei'), ruleOk(dec, '-1')], [true, false, true, true, false], 'zecimal');
// Dată după 01.01.2026 (serial 46023).
const date = { type: 'date', op: 'gt', a: 46023 };
eq([ruleOk(date, '17.10.2026'), ruleOk(date, '31.12.2025'), ruleOk(date, '50000'), ruleOk(date, 'mâine')], [true, false, false, false], 'dată');
// Lungime de cel mult 5 caractere; în afara intervalului.
eq([ruleOk({ type: 'length', op: 'le', a: 5 }, 'abcde'), ruleOk({ type: 'length', op: 'le', a: 5 }, 'abcdef')], [true, false], 'lungime');
eq([ruleOk({ type: 'decimal', op: 'notBetween', a: 0, b: 10 }, '5'), ruleOk({ type: 'decimal', op: 'notBetween', a: 0, b: 10 }, '15')], [false, true], 'în afara');
eq([ruleOk({ type: 'decimal', op: 'ne', a: 0 }, '0'), ruleOk({ type: 'decimal', op: 'eq', a: 3 }, '3')], [false, true], 'egal / diferit');

// Descrieri în română.
eq(describeValRule(whole), 'un număr întreg între 1 și 10', 'descriere întreg');
eq(describeValRule(date), 'o dată după 01.01.2026', 'descriere dată');
eq(describeValRule({ type: 'length', op: 'le', a: 20 }), 'un text de cel mult 20 de caractere', 'descriere lungime');

// setList cu regulă și mesaje; hasValues doar pentru liste cu ▾.
const lists = setList([], 'B2:B9', [], undefined, { rule: whole, prompt: { text: 'Nota de la 1 la 10', title: 'Notă' }, error: { style: 'warning', text: 'Nota e între 1 și 10' } });
eq(lists[0], { range: 'B2:B9', values: [], rule: whole, prompt: { text: 'Nota de la 1 la 10', title: 'Notă' }, error: { style: 'warning', text: 'Nota e între 1 și 10' } }, 'setList');
eq([hasValues(lists[0]), hasValues(setList([], 'A1:A2', ['Da', 'Nu'])[0])], [false, true], 'hasValues');
eq(setList([], 'A1:A2', ['Da'], undefined, { error: { style: 'stop' } })[0].error, undefined, 'eroarea implicită nu se scrie');
// cleanLists păstrează regulile bune și le aruncă pe cele stricate.
eq(cleanLists([{ range: 'A1:A5', values: [], rule: { type: 'date', op: 'le', a: 46000 } }, { range: 'B1:B5', values: [], rule: { type: 'x', op: 'gt', a: 1 } }, { range: 'C1:C5', values: [], prompt: { text: 'Doar mesaj' } }]),
  [{ range: 'A1:A5', values: [], rule: { type: 'date', op: 'le', a: 46000 } }, { range: 'C1:C5', values: [], prompt: { text: 'Doar mesaj' } }], 'cleanLists');
eq(listAt(lists, 3, 1)?.rule, whole, 'listAt');

// Dus-întors .xlsx: întreg între, dată, lungime, listă cu mesaje, doar mesaj.
const all = [
  { range: 'A1:A10', values: [], rule: whole, prompt: { text: 'Nota', title: 'Atenție' }, error: { style: 'stop', title: 'Greșit', text: 'Doar 1–10 & nimic altceva' } },
  { range: 'B1:B10', values: [], rule: { type: 'date', op: 'ge', a: 46023 }, error: { style: 'info' } },
  { range: 'C1:C10', values: [], rule: { type: 'length', op: 'le', a: 13 }, error: { style: 'warning', text: 'Prea lung' } },
  { range: 'D1:D10', values: ['Da', 'Nu'], prompt: { text: 'Alege' } },
  { range: 'E1:E10', values: [], prompt: { text: 'Scrie suma fără TVA' } },
  { range: 'F1:F10', values: [], rule: { type: 'decimal', op: 'notBetween', a: -1.5, b: 2.25 } },
];
const back = (await readXlsx(await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells: {}, styles: {}, lists: all }, results: {} }]))).sheets[0].lists;
eq(back, all, 'dus-întors .xlsx');

console.log(`sheet-validation: ${n} verificări trecute`);
