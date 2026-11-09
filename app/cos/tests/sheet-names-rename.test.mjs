// Test pentru redenumirea unui nume definit (Nume definite → ✎): formulele care îl folosesc se schimbă și ele.
// Rulare (în suite/): node tests/sheet-names-rename.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-names-${process.pid}`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { renameNameInFormula: r, evaluateAll } = await import(pathToFileURL(join(dir, 'formula.js')).href);
rmSync(dir, { recursive: true, force: true });

assert.equal(r('=B2*TVA', 'TVA', 'Cota'), '=B2*Cota');
assert.equal(r('=SUM(tva;Tva2)+"TVA"', 'TVA', 'Cota'), '=SUM(Cota;Tva2)+"TVA"', 'literele mari/mici nu contează; textele și alte nume rămân');
assert.equal(r('=Foaia1!TVA+TVA(1)', 'TVA', 'Cota'), '=Foaia1!Cota+TVA(1)', 'funcția cu același nume rămâne');
assert.equal(r("='TVA'!A1+TVA", 'TVA', 'Cota'), "='TVA'!A1+Cota", 'foaia numită TVA rămâne');
assert.equal(r('=TVA!A1', 'TVA', 'Cota'), '=TVA!A1', 'foaia fără ghilimele rămâne');
assert.equal(r('=Tab[TVA]+tva', 'TVA', 'Cota'), '=Tab[Cota]'.replace('Cota', 'TVA') + '+Cota', 'coloana de tabel rămâne');
assert.equal(r('=TVA.X+TVA', 'TVA', 'Cota'), '=TVA.X+Cota', 'alt nume care începe la fel rămâne');
assert.equal(r('text TVA', 'TVA', 'Cota'), 'text TVA', 'textul simplu (fără =) rămâne');
assert.equal(r('=Țară*2', 'TARA', 'Tara2'), '=Tara2*2', 'diacriticele nu contează, ca la căutarea numelor');

// După redenumire, formula dă același rezultat cu numele nou.
const sheet = { name: 'Foaia 1', cells: { A1: '100', B1: '0,19', C1: '=A1*TVA' }, styles: {}, colW: {} };
const before = evaluateAll(sheet.cells, { self: 'Foaia 1', sheets: [sheet], names: [{ name: 'TVA', ref: "'Foaia 1'!$B$1" }] }).C1;
const cells2 = { ...sheet.cells, C1: r(sheet.cells.C1, 'TVA', 'Cota') };
const after = evaluateAll(cells2, { self: 'Foaia 1', sheets: [{ ...sheet, cells: cells2 }], names: [{ name: 'Cota', ref: "'Foaia 1'!$B$1" }] }).C1;
assert.equal(String(before?.value ?? before), '19', 'formula cu numele vechi dă 19: ' + JSON.stringify(before));
assert.deepEqual(after, before);
console.log('redenumirea numelor definite: toate verificările trec');
