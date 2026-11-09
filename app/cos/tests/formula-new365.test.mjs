// Test pentru funcțiile adăugate pe 19.10: MAXIFS, MINIFS, TEXTBEFORE/AFTER, DELTA, GESTEP, ERF*, MDETERM,
// TAKE, DROP, CHOOSECOLS/ROWS, VSTACK/HSTACK, TOCOL/TOROW, MMULT, MUNIT, MINVERSE, TEXTSPLIT, RANDBETWEEN, SWITCH.
// Rulare (în suite/): node tests/formula-new365.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-f365-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

// A1:B4: nume / sumă; D1:E2 matrice [[1,2],[3,4]].
const base = { A1: 'Ana', B1: '10', A2: 'Ion', B2: '5', A3: 'Ana', B3: '30', A4: 'Ion', B4: '7', D1: '1', E1: '2', D2: '3', E2: '4' };
const calc = (f, extra = {}) => evaluateAll({ ...base, ...extra, Z1: f });
const v = (f) => { const r = calc(f).Z1; return r.err ?? (r.num ? r.value : r.text); };
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

assert.equal(v('=MAXIFS(B1:B4;A1:A4;"Ana")'), 30);
assert.equal(v('=MINIFS(B1:B4;A1:A4;"Ion")'), 5);
assert.equal(v('=MAXIFS(B1:B4;A1:A4;"Maria")'), 0);
assert.equal(v('=MINIFS(B1:B4;A1:A4;"Ana";B1:B4;">15")'), 30);
assert.equal(v('=TEXTBEFORE("Popescu, Ion";", ")'), 'Popescu');
assert.equal(v('=TEXTAFTER("a-b-c";"-";-1)'), 'c');
assert.equal(v('=TEXTAFTER("a-b-c";"-";2)'), 'c');
assert.equal(v('=TEXTBEFORE("a-b-c";"-";2)'), 'a-b');
assert.equal(v('=TEXTBEFORE("abc";"x")'), '#N/A');
assert.equal(v('=TEXTBEFORE("abc";"x";1;0;0;"nimic")'), 'nimic');
assert.equal(v('=TEXTAFTER("Total: 5";"TOTAL: ";1;1)'), '5');
assert.equal(v('=DELTA(5;5)'), 1);
assert.equal(v('=GESTEP(-1)'), 0);
near(v('=ERF(1)'), 0.842700792949715);
near(v('=ERF(0;1)'), 0.842700792949715);
near(v('=ERFC(1)'), 0.157299207050285);
near(v('=ERF.PRECISE(0.5)'), 0.520499877813047);
assert.equal(v('=MDETERM(D1:E2)'), -2);
assert.equal(v('=SWITCH(2;1;"unu";2;"doi";"altul")'), 'doi');
assert.equal(v('=SWITCH(9;1;"unu";"altul")'), 'altul');
const rb = v('=RANDBETWEEN(3;5)');
assert.ok(rb >= 3 && rb <= 5 && Number.isInteger(rb));

// Funcțiile care se varsă: rezultatul ajunge în celulele de lângă Z1 (se citește din AA1, Z2…).
const spill = (f) => calc(f);
let r = spill('=TAKE(A1:B4;2)');
assert.deepEqual([r.Z1.text, r.AA1.text, r.Z2.text, r.AA2.text], ['Ana', '10', 'Ion', '5']);
assert.equal(r.Z3?.text ?? '', '');
r = spill('=TAKE(A1:B4;-1;1)');
assert.equal(r.Z1.text, 'Ion');
r = spill('=DROP(A1:B4;3)');
assert.deepEqual([r.Z1.text, r.AA1.text], ['Ion', '7']);
r = spill('=CHOOSECOLS(A1:B4;2)');
assert.deepEqual([r.Z1.text, r.Z4.text], ['10', '7']);
r = spill('=CHOOSEROWS(A1:B4;-1;1)');
assert.deepEqual([r.Z1.text, r.Z2.text], ['Ion', 'Ana']);
r = spill('=VSTACK(D1:E1;D2:E2;A1)');
assert.deepEqual([r.Z1.text, r.Z3.text, r.AA3.err], ['1', 'Ana', '#N/A']);
r = spill('=HSTACK(D1:D2;E1:E2)');
assert.deepEqual([r.Z1.text, r.AA1.text, r.AA2.text], ['1', '2', '4']);
r = spill('=TOCOL(D1:E2)');
assert.deepEqual([r.Z1.text, r.Z2.text, r.Z3.text, r.Z4.text], ['1', '2', '3', '4']);
r = spill('=TOCOL(D1:E2;0;TRUE)');
assert.deepEqual([r.Z2.text, r.Z3.text], ['3', '2']);
r = spill('=TOROW(D1:E2)');
assert.deepEqual([r.Z1.text, r.AC1.text], ['1', '4']);
r = spill('=MMULT(D1:E2;D1:E2)');
assert.deepEqual([r.Z1.value, r.AA1.value, r.Z2.value, r.AA2.value], [7, 10, 15, 22]);
r = spill('=MUNIT(2)');
assert.deepEqual([r.Z1.value, r.AA1.value, r.Z2.value, r.AA2.value], [1, 0, 0, 1]);
r = spill('=MINVERSE(D1:E2)');
[[r.Z1.value, -2], [r.AA1.value, 1], [r.Z2.value, 1.5], [r.AA2.value, -0.5]].forEach(([a, b]) => near(a, b));
r = spill('=TEXTSPLIT("a,b;c,d";",";";")');
assert.deepEqual([r.Z1.text, r.AA1.text, r.Z2.text, r.AA2.text], ['a', 'b', 'c', 'd']);
r = spill('=TEXTSPLIT("a,,b";",";;TRUE)');
assert.deepEqual([r.Z1.text, r.AA1.text], ['a', 'b']);
console.log('funcții noi (MAXIFS … TEXTSPLIT): toate verificările trec');
