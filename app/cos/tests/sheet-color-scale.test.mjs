// Test pentru scalele de culori din Evidențiere (Sheets): culorile după mărime, mijlocul la percentila 50, dus-întors .xlsx.
// Rulare (în suite/): node tests/sheet-color-scale.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-scale-${process.pid}`);
await build({ entryPoints: ['src/sheets/cond.ts', 'src/sheets/xlsx.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { dataBars, scaleColors, describeRule, cleanRules, condLooks } = await import(pathToFileURL(join(dir, 'cond.js')).href);
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
rmSync(dir, { recursive: true, force: true });

let n = 0;
const eq = (a, b, msg) => { n++; assert.deepEqual(a, b, msg); };

// Trei culori: cel mai mic roșu, mijlocul galben, cel mai mare verde.
const cells = { A1: '10', A2: '20', A3: '30', A4: 'text', A5: '' };
const rule = { range: 'A1:A5', op: 'scale', v1: '', look: 'green' };
const out = dataBars([rule], cells, {});
eq(out, { A1: 'bg:#f8696b', A2: 'bg:#ffeb84', A3: 'bg:#63be7b' }, 'trei culori; textul și golul rămân albe');
// Două culori: alb → albastru, liniar.
eq(scaleColors([['a', 0], ['b', 50], ['c', 100]], ['#ffffff', '#000000']), [['a', '#ffffff'], ['b', '#808080'], ['c', '#000000']], 'două culori, la jumătate gri');
// Mijlocul e percentila 50, nu media: 1, 2, 3, 100 → mijlocul 2,5.
const p = scaleColors([['a', 1], ['b', 2.5], ['c', 100]], ['#000000', '#808080', '#ffffff']);
eq(p[1][1], '#808080', 'percentila 50 primește culoarea din mijloc');
// Toate egale.
eq(scaleColors([['a', 5], ['b', 5]], ['#f8696b', '#ffeb84', '#63be7b']), [['a', '#ffeb84'], ['b', '#ffeb84']], 'valori egale → mijlocul');
// Nu colorează ca regulă obișnuită; descriere; curățare din fișier.
eq(condLooks([rule], cells, {}), {}, 'nu e regulă de stil');
eq(describeRule(rule), 'A1:A5: scală de culori Roșu → galben → verde', 'descriere');
eq(cleanRules([rule]), [rule], 'se păstrează în fișier');
// Formule: valoarea calculată.
eq(dataBars([{ ...rule, look: 'blue' }], { B1: '=1', B2: '=3' }, { B1: { text: '1', num: true, value: 1 }, B2: { text: '3', num: true, value: 3 } }).B2, undefined, 'altă zonă');
// Dus-întors .xlsx pentru toate cele 5 scale (plus o bară, ca să nu se încurce).
const rules = ['green', 'red', 'yellow', 'blue', 'bold'].map((look, i) => ({ range: `${String.fromCharCode(65 + i)}1:${String.fromCharCode(65 + i)}9`, op: 'scale', v1: '', look }));
rules.push({ range: 'G1:G9', op: 'databar', v1: '', look: 'blue' });
const back = (await readXlsx(await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells: { A1: '1' }, styles: {}, rules }, results: {} }]))).sheets[0].rules;
eq(back, rules, 'dus-întors .xlsx');

console.log(`sheet-color-scale: ${n} verificări trecute`);
