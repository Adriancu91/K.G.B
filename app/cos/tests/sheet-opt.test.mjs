// Test: butoanele de opțiune / lista combo din celulă (Inserare → Controale → ◉ Butoane de opțiune): variantele se curăță,
// numărul variantei alese se citește din celulă, iar setările trec dus-întors prin fișierul Suite (.ssheet).
// Rulare (în suite/): node tests/sheet-opt.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-opt-${process.pid}`);
await build({ entryPoints: ['src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { cleanOpt, optIndex, OPT_MAX, emptySheetDoc, serializeSheetDoc, parseSheetDoc } = await import(pathToFileURL(join(dir, 'format.js')).href);
rmSync(dir, { recursive: true, force: true });

assert.deepEqual(cleanOpt({ items: [' Mic ', '', 'Mediu', 3, 'Mare'] }), { items: ['Mic', 'Mediu', 'Mare'] });
assert.deepEqual(cleanOpt({ items: ['A', 'B'], combo: true }), { items: ['A', 'B'], combo: true });
assert.equal(cleanOpt({ items: [] }), undefined);
assert.equal(cleanOpt({ items: 'A;B' }), undefined);
assert.equal(cleanOpt(null), undefined);
assert.equal(cleanOpt({ items: Array.from({ length: 80 }, (_, i) => 'v' + i) }).items.length, OPT_MAX);
assert.equal(cleanOpt({ items: ['x'.repeat(300)] }).items[0].length, 100);

assert.equal(optIndex('2', 3), 2);
assert.equal(optIndex(' 3 ', 3), 3);
assert.equal(optIndex('4', 3), 0);
assert.equal(optIndex('0', 3), 0);
assert.equal(optIndex('1.5', 3), 0);
assert.equal(optIndex('Mic', 3), 0);
assert.equal(optIndex(undefined, 3), 0);

const doc = emptySheetDoc();
doc.sheets[0].cells.A1 = '2';
doc.sheets[0].styles.A1 = { opt: { items: ['Mic', 'Mediu', 'Mare'] } };
doc.sheets[0].styles.A2 = { opt: { items: ['Roșu', 'Verde'], combo: true }, b: true };
doc.sheets[0].styles.A3 = { opt: { items: [] } };
const back = parseSheetDoc(serializeSheetDoc(doc));
assert.deepEqual(back.sheets[0].styles.A1.opt, { items: ['Mic', 'Mediu', 'Mare'] });
assert.deepEqual(back.sheets[0].styles.A2.opt, { items: ['Roșu', 'Verde'], combo: true });
assert.equal(back.sheets[0].styles.A2.b, true);
assert.equal(back.sheets[0].styles.A3?.opt, undefined);
assert.equal(back.sheets[0].cells.A1, '2');
console.log('OK: butoanele de opțiune / lista combo din celulă');
