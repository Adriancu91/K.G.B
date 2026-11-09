// Test: la salvarea în .xlsx, funcțiile noi primesc „_xlfn.”, iar parametrii din LET / LAMBDA „_xlpm.” (altfel apar ca #NAME?
// în programele mari); la deschidere prefixele se scot.
// Rulare (în suite/): node tests/xlsx-xlfn.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = join(tmpdir(), `suite-xlfn-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/xlsx.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { toExcelFormula, fromExcelFormula } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

assert.equal(toExcelFormula('=AGGREGATE(9;6;A1:A9)'), '_xlfn.AGGREGATE(9,6,A1:A9)');
assert.equal(toExcelFormula('=RANDARRAY(3)'), '_xlfn.RANDARRAY(3)');
assert.equal(toExcelFormula('=REGEXTEST(A1;"[0-9]")'), '_xlfn.REGEXTEST(A1,"[0-9]")');
assert.equal(toExcelFormula('=VSTACK(A1:A2;B1:B2)'), '_xlfn.VSTACK(A1:A2,B1:B2)');
assert.equal(toExcelFormula('=SUM(A1:A3)'), 'SUM(A1:A3)', 'funcțiile vechi rămân fără prefix');
assert.equal(toExcelFormula('=LINEST(B1:B3;A1:A3)'), 'LINEST(B1:B3,A1:A3)');
assert.equal(toExcelFormula('=LET(pret;B2;tva;pret*0,19;pret+tva)'), '_xlfn.LET(_xlpm.pret,B2,_xlpm.tva,_xlpm.pret*0.19,_xlpm.pret+_xlpm.tva)');
assert.equal(toExcelFormula('=SCAN(0;A1:A3;LAMBDA(s;x;s+x))'), '_xlfn.SCAN(0,A1:A3,_xlfn.LAMBDA(_xlpm.s,_xlpm.x,_xlpm.s+_xlpm.x))');
// Un nume definit obișnuit (fără LET) nu primește prefix.
assert.equal(toExcelFormula('=Total*2'), 'Total*2');
// La deschidere: prefixele se scot și formula se poate salva din nou la fel.
const x = '_xlfn.LET(_xlpm.a,2,_xlpm.a*3)';
assert.equal(fromExcelFormula(x), '=LET(a,2,a*3)');
assert.equal(toExcelFormula(fromExcelFormula(x)), x);
assert.equal(fromExcelFormula('_xlfn._xlws.SORT(A1:A3)'), '=SORT(A1:A3)');
// Numele românești ajung în engleză (aceeași listă ca la calcul).
assert.equal(toExcelFormula('=ACUM()'), 'NOW()');
assert.equal(toExcelFormula('=DACĂ(A1>0;MEDIE(B1:B3);0)'), 'IF(A1>0,AVERAGE(B1:B3),0)');
assert.equal(toExcelFormula('=RÂND()+RAND()'), 'ROW()+RAND()', 'RÂND e ROW, RAND rămâne RAND');
assert.equal(toExcelFormula('=SUMĂDACĂ(A1:A3;"x";B1:B3)'), 'SUMIF(A1:A3,"x",B1:B3)');
console.log('Prefixele .xlsx: toate verificările au trecut');
