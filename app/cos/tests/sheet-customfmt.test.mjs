// Test pentru Sheets → Format particularizat (cod pe celulă): afișarea, culoarea din cod, .sheet și .xlsx dus-întors (codul rămâne întocmai).
// Rulare (în suite/): node tests/sheet-customfmt.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const dir = join(tmpdir(), `suite-customfmt-${process.pid}`);
await build({ entryPoints: ['src/sheets/filter.ts', 'src/sheets/xlsx.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { cellText, cellCodeColor } = await import(pathToFileURL(join(dir, 'filter.js')).href);
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);

rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok ' : 'GREȘIT ') + m); if (!c) fail++; };

ok(cellText('1234,5', undefined, { code: '#,##0.00 "buc."' }) === '1.234,50 buc.', 'număr scris în celulă, cu cod');
ok(cellText('=A1', { text: '-5', num: true, value: -5 }, { code: '0;[Red](0)' }) === '(5)', 'rezultatul unei formule, negativ în paranteze');
ok(cellCodeColor('=A1', { text: '-5', num: true, value: -5 }, { code: '0;[Red](0)' }) === '#ff0000', 'culoarea din cod: roșu');
ok(cellCodeColor('5', undefined, { code: '0;[Red](0)' }) === undefined, 'pozitivul nu are culoare');
ok(cellText('abc', undefined, { code: '"Cod: "@' }) === 'Cod: abc', 'text cu prefix');
ok(cellText('', undefined, { code: '0.00' }) === '', 'celula goală rămâne goală');
ok(cellText('=1/0', { text: '#DIV/0!', num: false, err: '#DIV/0!' }, { code: '0.00' }) === '#DIV/0!', 'erorile rămân erori');
ok(cellText('5', undefined, { fmt: 'lei', code: '0.0' }) === '5,0', 'codul are întâietate față de formatul ales');


// .xlsx dus-întors: codul rămâne întocmai; formatele noastre obișnuite nu primesc cod.
const styles = { A1: { code: '#,##0.00;[Red]-#,##0.00' }, A2: { code: '0.0,,"M"' }, A3: { fmt: 'lei' }, A4: { code: 'dddd, d mmmm yyyy' } };
const cells = { A1: '-1234,5', A2: '2500000', A3: '7', A4: '46313' };
const back = (await readXlsx(await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles }, results: {} }]))).sheets[0];
ok(back.styles.A1?.code === '#,##0.00;[Red]-#,##0.00', '.xlsx: codul cu secțiuni și culoare rămâne ' + JSON.stringify(back.styles.A1));
ok(back.styles.A2?.code === '0.0,,"M"', '.xlsx: codul în milioane rămâne');
ok(back.styles.A3?.fmt === 'lei' && !back.styles.A3.code, '.xlsx: formatul lei rămâne fără cod');
ok(back.styles.A4?.code === 'dddd, d mmmm yyyy', '.xlsx: data lungă cu ziua rămâne');
ok(cellText(back.cells.A1, undefined, back.styles.A1) === '-1.234,50' && cellCodeColor(back.cells.A1, undefined, back.styles.A1) === '#ff0000', 'după .xlsx: -1.234,50 cu roșu');
ok(cellText(back.cells.A2, undefined, back.styles.A2) === '2,5M', 'după .xlsx: 2,5M');

console.log(fail ? `${fail} GREȘELI` : 'Toate testele formatului particularizat au trecut.');
process.exit(fail ? 1 : 0);
