// Test pentru caseta de nume din Sheets (Mergi la): celule, zone, coloane, rânduri, alte foi, nume definite, nume noi.
// Rulare (în suite/): node tests/sheet-goto.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-goto-${process.pid}`);
await build({ entryPoints: ['src/sheets/goto.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { parseGoto } = await import(pathToFileURL(join(dir, 'goto.js')).href);
rmSync(dir, { recursive: true, force: true });

const sheets = ['Foaia 1', 'Vânzări', "Lui Ion's"];
const names = [{ name: 'Total', ref: "Vânzări!$B$2:$B$9" }, { name: 'Rata', ref: '$C$1', sheet: 'Foaia 1' }, { name: 'Calcul', ref: '1+2' }];
const go = (t, cur = 'Foaia 1') => parseGoto(t, sheets, cur, names);
assert.deepEqual(go('b12'), { kind: 'go', r0: 11, c0: 1, r1: 11, c1: 1 });
assert.deepEqual(go('$C$5:A1'), { kind: 'go', r0: 0, c0: 0, r1: 4, c1: 2 });
assert.deepEqual(go('C:D'), { kind: 'go', r0: 0, c0: 2, r1: 1048575, c1: 3 });
assert.deepEqual(go('5:3'), { kind: 'go', r0: 2, c0: 0, r1: 4, c1: 16383 });
assert.deepEqual(go('vânzări!d4'), { kind: 'go', sheet: 'Vânzări', r0: 3, c0: 3, r1: 3, c1: 3 });
assert.deepEqual(go("'Lui Ion''s'!A2"), { kind: 'go', sheet: "Lui Ion's", r0: 1, c0: 0, r1: 1, c1: 0 });
assert.deepEqual(go("'Foaia 1'!A2"), { kind: 'go', r0: 1, c0: 0, r1: 1, c1: 0 });
assert.deepEqual(go('total'), { kind: 'go', sheet: 'Vânzări', r0: 1, c0: 1, r1: 8, c1: 1 });
assert.deepEqual(go('Total', 'Vânzări'), { kind: 'go', r0: 1, c0: 1, r1: 8, c1: 1 });
assert.deepEqual(go('Rata'), { kind: 'go', r0: 0, c0: 2, r1: 0, c1: 2 });
// Numele local al altei foi nu se vede de pe foaia curentă: devine nume nou.
assert.deepEqual(go('Rata', 'Vânzări'), { kind: 'name', name: 'Rata' });
assert.equal(go('Calcul').kind, 'error');
assert.deepEqual(go('Dobânda_2026'), { kind: 'name', name: 'Dobânda_2026' });
assert.equal(go('Lipsă!A1').kind, 'error');
assert.equal(go('XFE1').kind, 'error');
assert.equal(go('XFD1').kind, 'go');
assert.equal(go('A0').kind, 'error');
assert.equal(go('2 + 2').kind, 'error');
assert.equal(go('ADEVĂRAT').kind, 'error');
assert.equal(go('').kind, 'error');
console.log('caseta de nume: toate verificările trec');

// Creează din selecție: titlurile coloanelor / rândurilor devin nume.
{
  const dir2 = join(tmpdir(), `suite-goto2-${process.pid}`);
  await build({ entryPoints: ['src/sheets/goto.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir2, logLevel: 'error' });
  const { namesFromRange, cleanName } = await import(pathToFileURL(join(dir2, 'goto.js')).href);
  rmSync(dir2, { recursive: true, force: true });
  assert.equal(cleanName('Preț unitar (lei)'), 'Preț_unitar_lei');
  assert.equal(cleanName('2026'), '_2026');
  assert.equal(cleanName('TVA1'), 'TVA1_');
  assert.equal(cleanName('  '), null);
  const grid = { '0,0': 'Produs', '0,1': 'Preț unitar', '0,2': '', '0,3': 'Total', '1,0': 'Mere' };
  const text = (r, c) => grid[`${r},${c}`] ?? '';
  const g = { r0: 0, c0: 0, r1: 9, c1: 3 };
  const top = namesFromRange(g, 'top', "'Foaia 1'", text, [{ name: 'total', ref: '1' }]);
  assert.deepEqual(top.add, [{ name: 'Produs', ref: "'Foaia 1'!$A$2:$A$10" }, { name: 'Preț_unitar', ref: "'Foaia 1'!$B$2:$B$10" }]);
  assert.deepEqual(top.skipped, ['Total']);
  const left = namesFromRange({ r0: 0, c0: 0, r1: 1, c1: 1 }, 'left', 'Date', text, []);
  assert.deepEqual(left.add, [{ name: 'Produs', ref: 'Date!$B$1' }, { name: 'Mere', ref: 'Date!$B$2' }]);
  console.log('nume din selecție: toate verificările trec');
}
