// Test pentru lista „fx Inserează funcție”: toate funcțiile explicate există în calculator, iar căutarea le găsește.
// Rulare (în suite/): node tests/fnhelp.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-fnhelp-${process.pid}`);
await build({ entryPoints: ['src/sheets/fnhelp.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { FN_HELP, searchFns } = await import(pathToFileURL(join(dir, 'fnhelp.js')).href);
const { functionNames, evaluateAll } = await import(pathToFileURL(join(dir, 'formula.js')).href);
rmSync(dir, { recursive: true, force: true });

const all = functionNames();
assert.ok(all.length > 400, 'prea puține funcții: ' + all.length);
const missing = FN_HELP.map((h) => h.name).filter((n) => !all.includes(n));
assert.deepEqual(missing, [], 'explicate, dar necunoscute: ' + missing.join(', '));
// Fiecare funcție explicată chiar se calculează (nu dă #NAME?).
for (const h of FN_HELP) {
  const r = evaluateAll({ A1: `=${h.name}()` })['A1'];
  assert.notEqual(r?.err, '#NAME?', h.name + ' dă #NAME?');
}
assert.equal(searchFns(all, 'vlook', 'Toate')[0].name, 'VLOOKUP');
assert.ok(searchFns(all, 'rata', 'Toate').some((x) => x.name === 'PMT'));
assert.ok(searchFns(all, 'litere', 'Toate').some((x) => x.name === 'SUMAINLITERE'));
assert.ok(searchFns(all, '', 'Uzuale').length >= 10);
assert.ok(searchFns(all, '', 'Dată și oră').every((x) => x.help?.cat === 'Dată și oră'));
console.log(`fx: ${FN_HELP.length} funcții explicate, ${all.length} în total; toate verificările trec`);
