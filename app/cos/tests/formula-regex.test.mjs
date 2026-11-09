// Test pentru funcțiile adăugate pe 20.10: RAND (și RÂND = ROW), REGEXTEST, REGEXEXTRACT, REGEXREPLACE, PERCENTOF, VALUETOTEXT,
// IMSINH, IMCOSH, IMTAN, IMCOT, IMSEC, IMCSC, IMSECH, IMCSCH, LET, LAMBDA, MAP, REDUCE, SCAN, BYROW, BYCOL, MAKEARRAY,
// WRAPROWS, WRAPCOLS, EXPAND, TREND, GROWTH, LINEST, LOGEST, AGGREGATE, RANDARRAY.
// Rulare (în suite/): node tests/formula-regex.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-fregex-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const base = { A1: 'Comanda 1234 din 2026', A2: 'ion@exemplu.ro', B1: '10', B2: '30', B3: '60', D1: '1', E1: '2', D2: '3', E2: '4' };
const calc = (f) => evaluateAll({ ...base, Z5: f });
const v = (f) => { const r = calc(f).Z5; return r.err ?? (r.num ? r.value : r.text); };
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
// Partea reală și cea imaginară, citite chiar cu IMREAL / IMAGINARY.
const cxf = (f) => [v(`=IMREAL(${f})`), v(`=IMAGINARY(${f})`)];

// RAND: între 0 și 1; RÂND (cu diacritice) rămâne numărul rândului.
const r = v('=RAND()');
assert.ok(typeof r === 'number' && r >= 0 && r < 1, 'RAND: ' + r);
assert.equal(v('=RÂND()'), 5);
assert.equal(v('=ROW()'), 5);
assert.ok(v('=ALEATOR()') < 1);
assert.equal(v('=RAND(1)'), '#N/A');

// Expresii regulate.
assert.equal(v('=REGEXTEST(A2;"^[a-z.]+@[a-z.]+$")'), 'ADEVĂRAT');
assert.equal(v('=REGEXTEST(A1;"comanda")'), 'FALS');
assert.equal(v('=REGEXTEST(A1;"comanda";1)'), 'ADEVĂRAT');
assert.equal(v('=REGEXEXTRACT(A1;"[0-9]+")'), '1234');
const all = calc('=REGEXEXTRACT(A1;"[0-9]+";1)');
assert.equal(all.Z5.value ?? all.Z5.text, '1234');
assert.equal(String(all.Z6?.value ?? all.Z6?.text), '2026', 'mod 1: a doua potrivire sub prima');
const groups = calc('=REGEXEXTRACT(A2;"([a-z]+)@([a-z]+)";2)');
assert.equal(groups.Z5.text, 'ion');
assert.equal(groups.AA5?.text, 'exemplu', 'mod 2: grupurile, unul lângă altul');
assert.equal(v('=REGEXEXTRACT(A1;"x+")'), '#N/A');
assert.equal(v('=REGEXEXTRACT(A1;"[0-9";0)'), '#VALUE!');
assert.equal(v('=REGEXREPLACE(A1;"[0-9]";"#")'), 'Comanda #### din ####');
assert.equal(v('=REGEXREPLACE(A1;"([0-9]+)";"<$1>";2)'), 'Comanda 1234 din <2026>');
assert.equal(v('=REGEXREPLACE(A1;"[0-9]+";"N";-1)'), 'Comanda 1234 din N');
assert.equal(v('=REGEXREPLACE(A2;"([a-z]+)@(.*)";"$2 / $1")'), 'exemplu.ro / ion');

// PERCENTOF și VALUETOTEXT.
near(v('=PERCENTOF(B1;B1:B3)'), 0.1);
near(v('=PERCENTOF(B1:B2;B1:B3)'), 0.4);
assert.equal(v('=PERCENTOF(B1;C1:C3)'), '#DIV/0!');
assert.equal(v('=VALUETOTEXT(A2)'), 'ion@exemplu.ro');
assert.equal(v('=VALUETOTEXT(A2;1)'), '"ion@exemplu.ro"');
assert.equal(v('=VALUETOTEXT(B1;1)'), '10');

// Funcții complexe (valori verificate cu identitățile: tan = sin/cos etc.).
const [sr, si] = cxf('IMSINH("1+2i")');
near(sr, Math.sinh(1) * Math.cos(2)); near(si, Math.cosh(1) * Math.sin(2));
const [cr, ci] = cxf('IMCOSH("1+2i")');
near(cr, Math.cosh(1) * Math.cos(2)); near(ci, Math.sinh(1) * Math.sin(2));
near(cxf('IMTAN("0.5")')[0], Math.tan(0.5));
near(cxf('IMCOT("0.5")')[0], 1 / Math.tan(0.5));
near(cxf('IMSEC("0.5")')[0], 1 / Math.cos(0.5));
near(cxf('IMCSC("0.5")')[0], 1 / Math.sin(0.5));
near(cxf('IMSECH("0.5")')[0], 1 / Math.cosh(0.5));
near(cxf('IMCSCH("0.5")')[0], 1 / Math.sinh(0.5));
const [tr, ti] = cxf('IMTAN("1+i")');
near(tr, Math.sin(2) / (Math.cos(2) + Math.cosh(2)), 1e-9); near(ti, Math.sinh(2) / (Math.cos(2) + Math.cosh(2)), 1e-9);
assert.equal(v('=IMCSC("0")'), '#NUM!');
assert.equal(v('=IMCOT("0")'), '#NUM!');

// LET: nume pentru rezultate intermediare.
assert.equal(v('=LET(x;B1*2;x+1)'), 21);
assert.equal(v('=LET(pret;B2;tva;pret*0,19;pret+tva)'), 35.7);
assert.equal(v('=LET(s;SUM(B1:B3);s/3)'), 100 / 3);
assert.equal(v('=LET(x;2;LET(x;10;x)+x)'), 12, 'un LET în alt LET își are numele lui');
assert.equal(v('=LET(t;A1;REGEXEXTRACT(t;"[0-9]+"))'), '1234');
assert.equal(v('=LET(x;5)'), '#N/A');
assert.equal(v('=LET(x;1;y)'), '#NAME?', 'un nume necunoscut rămâne #NAME?');
assert.equal(v('=LET(B1;5;B1)'), '#VALUE!', 'o adresă de celulă nu poate fi nume');
// LAMBDA cu MAP, REDUCE, SCAN, BYROW, BYCOL, MAKEARRAY și chemat după nume în LET.
assert.equal(v('=LET(f;LAMBDA(x;x*2);f(21))'), 42);
assert.equal(v('=LET(adun;LAMBDA(a;b;a+b);adun(2;3)*adun(1;1))'), 10);
// ISOMITTED: parametrul lipsă (sau lăsat gol) primește o valoare implicită.
assert.equal(v('=LET(f;LAMBDA(x;y;IF(ISOMITTED(y);x;x*y));f(5))'), 5);
assert.equal(v('=LET(f;LAMBDA(x;[y];IF(ISOMITTED(y);x;x*y));f(5))'), 5);
assert.equal(v('=LET(f;LAMBDA(x;y;IF(ISOMITTED(y);x;x*y));f(5;3))'), 15);
assert.equal(v('=LET(f;LAMBDA(x;y;IF(ISOMITTED(y);-1;y));f(5;))'), -1);
assert.equal(v('=LET(f;LAMBDA(x;ISOMITTED(x));f(0))'), 'FALS');
assert.equal(v('=LET(g;LAMBDA(a;b;ISOMITTED(b));f;LAMBDA(b;g(b));f(1))'), 'ADEVĂRAT');
let m = calc('=MAP(B1:B3;LAMBDA(x;x/10))');
assert.deepEqual([m.Z5.value, m.Z6.value, m.Z7.value], [1, 3, 6]);
m = calc('=MAP(B1:B3;B1:B3;LAMBDA(a;b;a*b))');
assert.deepEqual([m.Z5.value, m.Z7.value], [100, 3600]);
assert.equal(v('=REDUCE(0;B1:B3;LAMBDA(s;x;IF(x>15;s+x;s)))'), 90);
assert.equal(v('=REDUCE(;B1:B3;LAMBDA(s;x;s+x))'), 100, 'fără valoare inițială pornește de la 0');
m = calc('=SCAN(0;B1:B3;LAMBDA(s;x;s+x))');
assert.deepEqual([m.Z5.value, m.Z6.value, m.Z7.value], [10, 40, 100], 'SCAN: soldul cumulat');
m = calc('=BYROW(D1:E2;LAMBDA(r;SUM(r)))');
assert.deepEqual([m.Z5.value, m.Z6.value], [3, 7], 'BYROW: suma fiecărui rând');
m = calc('=BYCOL(D1:E2;LAMBDA(c;MAX(c)))');
assert.deepEqual([m.Z5.value, m.AA5.value], [3, 4], 'BYCOL: maximul fiecărei coloane');
m = calc('=MAKEARRAY(3;3;LAMBDA(r;c;r*c))');
assert.deepEqual([m.Z5.value, m.AA6.value, m.AB7.value], [1, 4, 9], 'MAKEARRAY: tabla înmulțirii');
assert.equal(v('=LAMBDA(x;x+1)'), '#CALC!');
assert.equal(v('=MAP(B1:B3;5)'), '#VALUE!', 'fără LAMBDA → #VALUE!');
assert.equal(v('=LET(f;LAMBDA(x;x);f(1;2))'), '#VALUE!', 'prea multe argumente');
// WRAPROWS, WRAPCOLS, EXPAND, TREND, GROWTH, LINEST, LOGEST, AGGREGATE, RANDARRAY.
let w = calc('=WRAPROWS(B1:B3;2)');
assert.deepEqual([w.Z5.value, w.AA5.value, w.Z6.value, w.AA6.err], [10, 30, 60, '#N/A'], 'WRAPROWS: câte 2 pe rând, golul #N/A');
w = calc('=WRAPCOLS(B1:B3;2;0)');
assert.deepEqual([w.Z5.value, w.Z6.value, w.AA5.value, w.AA6.value], [10, 30, 60, 0], 'WRAPCOLS: câte 2 pe coloană, umplut cu 0');
assert.equal(v('=WRAPROWS(D1:E2;2)'), '#VALUE!', 'doar dintr-un rând sau o coloană');
assert.equal(v('=WRAPROWS(B1:B3;0)'), '#NUM!');
w = calc('=EXPAND(D1:E2;3;3;"-")');
assert.deepEqual([w.Z5.value, w.AA6.value, w.AB5.text, w.Z7.text], [1, 4, '-', '-'], 'EXPAND: 3×3, celulele noi cu „-”');
w = calc('=EXPAND(D1:E1;2)');
assert.deepEqual([w.Z5.value, w.AA5.value, w.Z6.err], [1, 2, '#N/A'], 'EXPAND: doar rânduri, golul #N/A');
assert.equal(v('=EXPAND(D1:E2;1)'), '#VALUE!', 'nu se poate micșora');
// TREND și GROWTH.
const tb = { F1: '1', F2: '2', F3: '3', G1: '4', G2: '5', H1: '2', H2: '4', H3: '8',
  J1: '1', K1: '0', L1: '3', J2: '0', K2: '1', L2: '4', J3: '1', K3: '1', L3: '6', J4: '2', K4: '1', L4: '8', J6: '3', K6: '2' };
const tc = (f) => evaluateAll({ ...base, ...tb, Z5: f });
const tv = (f) => { const r = tc(f).Z5; return r.err ?? (r.num ? r.value : r.text); };
let tt = tc('=TREND(B1:B3)');
near(tt.Z5.value, 25 / 3, 1e-9); near(tt.Z7.value, 175 / 3, 1e-9);
near(tv('=TREND(B1:B3;;4)'), 250 / 3);
tt = tc('=TREND(B1:B3;F1:F3;G1:G2)');
near(tt.Z5.value, 250 / 3); near(tt.Z6.value, 325 / 3);
near(tv('=TREND(B1:B3;F1:F3;4;FALSE)'), 4 * 250 / 14);
near(tv('=GROWTH(H1:H3;;4)'), 16);
near(tv('=GROWTH(H1:H3;F1:F3;5)'), 32);
near(tv('=TREND(L1:L4;J1:K4;J6:K6)'), 13, 1e-9);
near(tv('=TREND(D1:E1;;3)'), 3);
assert.equal(tv('=GROWTH(B1:B3;F1:F3;-1)') > 0, true);
assert.equal(tv('=GROWTH(K1:K4)'), '#NUM!', 'GROWTH cu zero → #NUM!');
assert.equal(tv('=TREND(B1:B3;G1:G2)'), '#REF!', 'x și y de lungimi diferite');
// LINEST și LOGEST.
let ls = tc('=LINEST(B1:B3;F1:F3)');
near(ls.Z5.value, 25); near(ls.AA5.value, -50 / 3);
ls = tc('=LINEST(B1:B3;F1:F3;TRUE;TRUE)');
near(ls.Z7.value, 7500 / 7500 * (1250 / (1250 + 50 / 3)), 1e-9); // R² = SSreg / SStot
near(ls.Z8.value, (1250) / ((50 / 3) / 1)); assert.equal(ls.AA8.value, 1, 'grade de libertate');
near(ls.Z9.value, 1250); near(ls.AA9.value, 50 / 3);
near(ls.AA7.value, Math.sqrt(50 / 3)); near(ls.Z6.value, Math.sqrt((50 / 3) / 2));
ls = tc('=LINEST(L1:L4;J1:K4)');
near(ls.Z5.value, 3); near(ls.AA5.value, 2); near(ls.AB5.value, 1);
assert.equal(tc('=LINEST(L1:L4;J1:K4;1;1)').AB7.err, '#N/A', 'golurile din statistici');
near(tv('=LINEST(B1:B3;F1:F3;FALSE)'), 250 / 14);
assert.equal(tc('=LINEST(B1:B3;F1:F3;FALSE)').AA5.value, 0);
ls = tc('=LOGEST(H1:H3;F1:F3)');
near(ls.Z5.value, 2); near(ls.AA5.value, 1);
near(tv('=INDEX(LOGEST(H1:H3;F1:F3;1;1);3;1)'), 1);
assert.equal(tv('=LOGEST(K1:K4)'), '#NUM!');
// AGGREGATE și RANDARRAY.
const ag = { M1: '5', M2: '=1/0', M3: '7', M4: '=SUBTOTAL(9;M1;M3)' };
const av = (f) => { const r = evaluateAll({ ...base, ...ag, Z5: f }).Z5; return r.err ?? (r.num ? r.value : r.text); };
assert.equal(av('=AGGREGATE(9;6;M1:M3)'), 12, 'SUM fără erori');
assert.equal(av('=AGGREGATE(9;4;M1:M3)'), '#DIV/0!', 'opțiunea 4 lasă erorile');
assert.equal(av('=AGGREGATE(9;3;M1:M4)'), 12, 'fără erori și fără SUBTOTAL');
assert.equal(av('=AGGREGATE(9;6;M1:M4)'), 24, 'SUBTOTAL inclus la opțiunea 6');
assert.equal(av('=AGGREGATE(14;6;M1:M3;1)'), 7, 'LARGE');
assert.equal(av('=AGGREGATE(15;6;M1:M3;1)'), 5, 'SMALL');
assert.equal(av('=AGGREGATE(4;6;M1:M3;B1:B3)'), 60, 'MAX pe două zone');
assert.equal(av('=AGGREGATE(12;6;B1:B3)'), 30, 'MEDIAN');
near(av('=AGGREGATE(16;6;B1:B3;0,5)'), 30);
assert.equal(av('=AGGREGATE(1;;B1:B3)'), 100 / 3);
assert.equal(av('=AGGREGATE(20;6;B1:B3)'), '#VALUE!');
assert.equal(av('=AGGREGATE(14;6;B1:B3)'), '#VALUE!', 'LARGE fără k');
const ra = calc('=RANDARRAY(3;2;1;6;TRUE)');
for (const id of ['Z5', 'AA5', 'Z7', 'AA7']) { const x = ra[id].value; assert.ok(Number.isInteger(x) && x >= 1 && x <= 6, 'RANDARRAY ' + x); }
const r1 = v('=RANDARRAY()'); assert.ok(r1 >= 0 && r1 < 1);
assert.equal(v('=RANDARRAY(0)'), '#CALC!');
assert.equal(v('=RANDARRAY(2;2;5;1)'), '#VALUE!');
const hid = (f) => evaluateAll({ ...base, Z5: f }, undefined, new Set([0])).Z5.value;
assert.equal(hid('=AGGREGATE(9;5;B1:B3)'), 90, 'fără rândul ascuns');
assert.equal(hid('=AGGREGATE(9;4;B1:B3)'), 100, 'cu rândul ascuns');
// ARRAYTOTEXT.
const at2 = { P1: '1', Q1: 'a', P2: '2,5', Q2: '=1/0' };
const atv = (f) => { const r = evaluateAll({ ...base, ...at2, Z5: f }).Z5; return r.err ?? (r.num ? r.value : r.text); };
assert.equal(atv('=ARRAYTOTEXT(P1:Q2)'), '1, a, 2,5, #DIV/0!');
assert.equal(atv('=ARRAYTOTEXT(P1:Q2; 1)'), '{1;"a"|2,5;#DIV/0!}');
assert.equal(atv('=ARRAYTOTEXT(P1)'), '1');
assert.equal(atv('=ARRAYTOTEXT(P1:Q1; 3)'), '#VALUE!');
console.log('Toate verificările au trecut');
