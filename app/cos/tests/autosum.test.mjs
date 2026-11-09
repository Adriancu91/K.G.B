// Test pentru AutoSum (Σ, Alt+=) din Sheets.
// Rulare (în suite/): node tests/autosum.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-autosum-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/autosum.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { autoFormula, autoFill } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

// Foaie mică: A1 = titlu, A2:A4 = numere, B2:B4 numere, C2 = text, rândul 6 numere pe orizontală.
const grid = { A1: 'Suma', A2: '10', A3: '20', A4: '30', B1: 'Alt', B2: '1', B3: '2', B4: '3', C2: 'x', A6: '5', B6: '6', C6: '7' };
const id = (r, c) => String.fromCharCode(65 + c) + (r + 1);
const look = {
  filled: (r, c) => r >= 0 && c >= 0 && !!grid[id(r, c)],
  num: (r, c) => r >= 0 && c >= 0 && /^\d+$/.test(grid[id(r, c)] ?? ''),
};
// Sub coloana de numere: adună doar numerele (fără titlu).
assert.equal(autoFormula(4, 0, look), '=SUM(A2:A4)');
// Cu un rând gol între numere și țintă: îl sare.
assert.equal(autoFormula(5, 1, { ...look, filled: (r, c) => look.filled(r, c) && r !== 5 }), '=SUM(B2:B4)');
// Fără numere deasupra: ia din stânga.
assert.equal(autoFormula(5, 3, look), '=SUM(A6:C6)');
// Medie.
assert.equal(autoFormula(4, 0, look, 'AVERAGE'), '=AVERAGE(A2:A4)');
// Nimic în jur.
assert.equal(autoFormula(10, 7, look), null);
// Zonă A2:B4 (ultimul rând plin): totalurile sub ea.
assert.deepEqual(autoFill({ r0: 1, c0: 0, r1: 3, c1: 1 }, look), { A5: '=SUM(A2:A4)', B5: '=SUM(B2:B4)' });
// Zonă A2:C5 cu ultimul rând gol: totalurile în el; C nu are numere.
assert.deepEqual(autoFill({ r0: 1, c0: 0, r1: 4, c1: 2 }, look), { A5: '=SUM(A2:A4)', B5: '=SUM(B2:B4)' });
// Un singur rând A6:C6: totalul în dreapta.
assert.deepEqual(autoFill({ r0: 5, c0: 0, r1: 5, c1: 2 }, look, 'MAX'), { D6: '=MAX(A6:C6)' });
// Fără numere: nimic.
assert.deepEqual(autoFill({ r0: 8, c0: 0, r1: 9, c1: 1 }, look), {});
console.log('autosum: toate verificările trec');
