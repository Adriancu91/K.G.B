// Test pentru evidențierea cu formulă din Sheets (=$C2>1000, ca în Excel): formula se mută pe fiecare celulă, rândul întreg
// se colorează, funcțiile și celelalte foi merg; dus-întors .xlsx (cfRule type="expression").
// Rulare (în suite/): node tests/sheet-cond-formula.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-condf-${process.pid}`);
await build({ entryPoints: ['src/sheets/cond.ts', 'src/sheets/xlsx.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { condLooks, describeRule, cleanRules } = await import(pathToFileURL(join(dir, 'cond.js')).href);
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
rmSync(dir, { recursive: true, force: true });

// Rândurile 2–5: nume, stare, sumă. Se colorează tot rândul (A:C) unde suma e peste 1000.
const cells = { A1: 'Client', B1: 'Stare', C1: 'Suma', A2: 'Ana', B2: 'Plătit', C2: '1500', A3: 'Bogdan', B3: 'Neîncasat', C3: '200',
  A4: 'Corina', B4: 'Neîncasat', C4: '=1000+1', A5: 'Dan', B5: '', C5: '1000' };
const ids = (r, book) => Object.keys(condLooks([r], cells, {}, book)).sort();
const rule = (v1, range = 'A2:C5') => ({ range, op: 'formula', v1, look: 'red' });
assert.deepEqual(ids(rule('=$C2>1000')), ['A2', 'A4', 'B2', 'B4', 'C2', 'C4'], 'rândurile cu suma peste 1000 (și din formulă)');
assert.deepEqual(ids(rule('$C2>1000')), ['A2', 'A4', 'B2', 'B4', 'C2', 'C4'], 'merge și fără „=”');
assert.deepEqual(ids(rule('=ȘI($B2="Neîncasat";$C2>500)')), ['A4', 'B4', 'C4'], 'funcții cu nume românești');
assert.deepEqual(ids(rule('=AND($B2="Neîncasat",$C2>100)')), ['A3', 'A4', 'B3', 'B4', 'C3', 'C4'], 'funcții cu nume englezești');
assert.deepEqual(ids(rule('=ISBLANK(B2)', 'B2:B5')), ['B5'], 'celula goală din zonă');
assert.deepEqual(ids(rule('=MOD(RÂND();2)=0', 'A2:A5')), ['A2', 'A4'], 'dungi: RÂND() e rândul celulei verificate');
assert.deepEqual(ids(rule('=MOD(ROW(),2)=1', 'A2:B3')), ['A3', 'B3'], 'dungi cu nume englezești');
assert.deepEqual(ids(rule('=C2', 'C2:C5')), ['C2', 'C3', 'C4', 'C5'], 'un număr diferit de zero e adevărat');
assert.deepEqual(ids(rule('=1/0')), [], 'erorile nu colorează');
assert.deepEqual(ids(rule('=')), [], 'formula goală');
// Altă foaie.
const book = { self: 'Foaia 1', sheets: [{ name: 'Foaia 1', cells }, { name: 'Prag', cells: { A1: '1400' } }] };
assert.deepEqual(ids(rule('=$C2>Prag!$A$1', 'C2:C5'), book), ['C2'], 'pragul de pe altă foaie');
assert.equal(cleanRules([rule('=$C2>1000')])[0].op, 'formula');
assert.ok(describeRule(rule('=$C2>1000')).includes('=$C2>1000'));

// .xlsx dus-întors: cfRule type="expression" cu formula în engleză.
const sheet = { name: 'Foaia 1', colW: {}, cells, styles: {}, rules: [rule('=ȘI($B2="Neîncasat";$C2>500)')] };
const bytes = await writeXlsx([{ sheet, results: {} }]);
const xml = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
assert.ok(xml.includes('type="expression"') && xml.includes('<formula>AND($B2=&quot;Neîncasat&quot;,$C2&gt;500)</formula>'), xml.slice(xml.indexOf('<conditionalFormatting'), xml.indexOf('</conditionalFormatting>') + 30));
const back = (await readXlsx(bytes)).sheets[0].rules;
assert.equal(back.length, 1);
assert.equal(back[0].op, 'formula');
assert.deepEqual(Object.keys(condLooks(back, cells, {})).sort(), ['A4', 'B4', 'C4'], 'regula citită din .xlsx colorează la fel');
console.log('evidențierea cu formulă: toate verificările trec');
