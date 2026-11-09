// Test pentru Eliminare dubluri din Sheets.
// Rulare (în suite/): node tests/dedupe.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-dedupe-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/dedupe.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { removeDuplicates } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

// Rândurile 2–7 (fără cap): Ana/10, ana /10, Ion/5, Ana/12, Ion/5,0, Maria/=B2 (10).
const cells = { A2: 'Ana', B2: '10', A3: 'ana ', B3: '10', A4: 'Ion', B4: '5', A5: 'Ana', B5: '12', A6: 'Ion', B6: '5,0', A7: 'Maria', B7: '=B2', C9: 'jos' };
const styles = { A4: { b: true } };
const results = { B7: { text: '10', num: true, value: 10 } };
const g = { r0: 1, c0: 0, r1: 6, c1: 1 };
// După ambele coloane: rămân Ana/10, Ion/5, Ana/12, Maria/=B2.
let r = removeDuplicates(cells, styles, results, g, [0, 1]);
assert.equal(r.removed, 2);
assert.equal(r.kept, 4);
assert.deepEqual([r.cells.A2, r.cells.A3, r.cells.A4, r.cells.A5], ['Ana', 'Ion', 'Ana', 'Maria']);
assert.equal(r.cells.A6, undefined);
assert.equal(r.cells.A7, undefined);
assert.deepEqual(r.styles.A3, { b: true });
assert.equal(r.styles.A4, undefined);
assert.equal(r.cells.C9, 'jos');
// Formula mutată 2 rânduri mai sus: =B2 devine o referință cu 2 rânduri mai sus (în afara foii → eroare de referință, ca în Excel).
assert.notEqual(r.cells.B5, '=B2');
// Doar după nume: Ana, Ion, Maria.
r = removeDuplicates(cells, styles, results, g, [0]);
assert.equal(r.removed, 3);
assert.deepEqual([r.cells.A2, r.cells.A3, r.cells.A4, r.cells.A5], ['Ana', 'Ion', 'Maria', undefined]);
// Fără dubluri: nu se schimbă nimic.
r = removeDuplicates(cells, styles, results, { r0: 2, c0: 0, r1: 4, c1: 1 }, [0, 1]);
assert.equal(r.removed, 0);
assert.equal(r.cells, cells);
console.log('eliminare dubluri: toate verificările trec');
