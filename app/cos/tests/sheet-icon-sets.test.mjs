// Test pentru seturile de pictograme din Evidențiere (Sheets): treimile intervalului, imaginile SVG, dus-întors .xlsx.
// Rulare (în suite/): node tests/sheet-icon-sets.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-icons-${process.pid}`);
await build({ entryPoints: ['src/sheets/cond.ts', 'src/sheets/xlsx.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { dataBars, iconLevels, iconUrl, describeRule, cleanRules, ICON_SETS } = await import(pathToFileURL(join(dir, 'cond.js')).href);
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
rmSync(dir, { recursive: true, force: true });

let n = 0;
const eq = (a, b, msg) => { n++; assert.deepEqual(a, b, msg); };

// 0, 32, 33, 66, 67, 100 → praguri la 33 % și 67 %, ca în Excel.
eq(iconLevels([['a', 0], ['b', 32], ['c', 33], ['d', 66], ['e', 67], ['f', 100]]).map(([, l]) => l), [2, 2, 1, 1, 0, 0], 'praguri');
eq(iconLevels([['a', 5], ['b', 5]]).map(([, l]) => l), [0, 0], 'valori egale → sus');
const rule = { range: 'A1:A4', op: 'icons', v1: '', look: 'green' };
eq(dataBars([rule], { A1: '10', A2: '50', A3: '90', A4: 'text' }, {}), { A1: 'ic:green:2', A2: 'ic:green:1', A3: 'ic:green:0' }, 'nivelurile în celule');
// Imaginile: SVG valid, culori diferite pe niveluri.
for (const look of Object.keys(ICON_SETS)) {
  const urls = [0, 1, 2].map((l) => iconUrl(look, l));
  n++; assert.ok(urls.every((u) => u.startsWith('url("data:image/svg+xml,') && decodeURIComponent(u).includes('<svg')), look + ' svg');
  n++; assert.equal(new Set(urls).size, 3, look + ' trei pictograme diferite');
}
eq(describeRule(rule), 'A1:A4: pictograme Săgeți', 'descriere');
eq(cleanRules([rule]), [rule], 'fișier');
// Dus-întors .xlsx pentru toate seturile; semaforul e setul implicit (fără atribut).
const rules = Object.keys(ICON_SETS).map((look, i) => ({ range: `${String.fromCharCode(65 + i)}1:${String.fromCharCode(65 + i)}9`, op: 'icons', v1: '', look }));
const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells: { A1: '1' }, styles: {}, rules }, results: {} }]);
const back = (await readXlsx(bytes)).sheets[0].rules;
eq(back, rules, 'dus-întors .xlsx');

console.log(`sheet-icon-sets: ${n} verificări trecute`);
