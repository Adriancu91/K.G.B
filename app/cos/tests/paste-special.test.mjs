// Test pentru Lipire specială (Ctrl+Alt+V) din Sheets.
// Rulare (în suite/): node tests/paste-special.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-ps-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/pasteSpecial.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { pasteSpecial } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

// Copiat din A1:B2: A1=2, B1=text, A2=formula =A1*3 (valoare 6), B2 gol; A1 aldin.
const src = { r: 0, c: 0, raw: [['2', 'mere'], ['=A1*3', '']], values: [['2', 'mere'], ['6', '']], styles: [[{ b: true }, undefined], [undefined, undefined]] };
const target = (cur = {}) => ({
  raw: (id) => cur[id] ?? '',
  num: (id) => (cur[id] && /^\d+$/.test(cur[id]) ? +cur[id] : null),
  style: () => undefined,
  shift: (f, dr, dc) => `${f}@${dr},${dc}`,
});
const o = (x) => ({ what: 'all', op: 'none', transpose: false, skipBlanks: false, ...x });
// Tot, la D5: formula se mută, formatarea vine.
let r = pasteSpecial(src, { r: 4, c: 3 }, o({}), target());
assert.deepEqual(r.cells, { D5: '2', E5: 'mere', D6: '=A1*3@4,3', E6: '' });
assert.deepEqual(r.styles.D5, { b: true });
// Doar valorile: rezultatul formulei, fără formatare.
r = pasteSpecial(src, { r: 4, c: 3 }, o({ what: 'values' }), target());
assert.equal(r.cells.D6, '6');
assert.deepEqual(r.styles, {});
// Doar formatarea: nicio valoare.
r = pasteSpecial(src, { r: 4, c: 3 }, o({ what: 'formats' }), target());
assert.deepEqual(r.cells, {});
assert.deepEqual(r.styles.D5, { b: true });
// Transpunere: B1 („mere”) ajunge sub A1, A2 în dreapta.
r = pasteSpecial(src, { r: 0, c: 5 }, o({ what: 'values', transpose: true }), target());
assert.deepEqual(r.cells, { F1: '2', F2: 'mere', G1: '6', G2: '' });
// Sari peste goale: B2 nu șterge ce e în țintă.
r = pasteSpecial(src, { r: 0, c: 5 }, o({ what: 'values', skipBlanks: true }), target({ G2: 'x' }));
assert.equal('G2' in r.cells, false);
// Adună: 10 + 2 = 12, 5 + 6 = 11; peste un text nu schimbă; „mere” peste gol se lipește.
r = pasteSpecial(src, { r: 0, c: 5 }, o({ what: 'values', op: 'add' }), target({ F1: '10', F2: '5', G1: '' }));
assert.deepEqual(r.cells, { F1: '12', G1: 'mere', F2: '11' });
r = pasteSpecial(src, { r: 0, c: 5 }, o({ what: 'values', op: 'mul' }), target({ F1: '0.1', F2: 'abc' }));
assert.equal(r.cells.F2, undefined);
// Înmulțire fără erori de rotunjire: 3 * 0.1 = 0.3 (nu 0.30000000000000004).
r = pasteSpecial({ ...src, raw: [['3']], values: [['3']], styles: [[undefined]] }, { r: 0, c: 0 }, o({ what: 'values', op: 'mul' }), { ...target(), num: () => 0.1 });
assert.equal(r.cells.A1, '0.3');
// Împărțire la zero.
r = pasteSpecial({ ...src, raw: [['0']], values: [['0']], styles: [[undefined]] }, { r: 0, c: 0 }, o({ what: 'values', op: 'div' }), { ...target(), num: () => 4 });
assert.equal(r.cells.A1, '#DIV/0!');
console.log('lipire specială: toate verificările trec');
