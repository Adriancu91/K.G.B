// Test pentru IMAGE / IMAGINE: poza din celulă (sursa, textul alternativ, felul în care intră în celulă) și erorile.
// Rulare (în suite/): node tests/formula-image.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-image-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll, functionNames } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const cells = {
  A1: 'https://exemplu.ro/sigla.png', A2: 'Sigla firmei',
  B1: '=IMAGE(A1)', B2: '=IMAGE(A1;A2)', B3: '=IMAGINE("' + PNG + '";"punct";1)', B4: '=IMAGE(A1;"x";3;40;60)',
  B5: '=IMAGE(A1;;2)', B6: '=IF(1>2;IMAGE(A1);"fără poză")',
  C1: '=IMAGE(5)', C2: '=IMAGE("C:\\poze\\a.png")', C3: '=IMAGE(A1;"x";7)', C4: '=IMAGE(A1;"x";3)', C5: '=IMAGE(A1;"x";0;40)',
  C6: '=IMAGE(A1;"x";3;-5)', C7: '=IMAGE()', C8: '=IMAGE(1/0)',
  D1: '=LEN(B2)',
};
const r = evaluateAll(cells, { self: 'Foaia1', sheets: [{ name: 'Foaia1', cells }] });
let fail = 0;
const check = (name, ok, got) => { if (ok) console.log('ok: ' + name); else { fail++; console.log('GREȘIT: ' + name + ' → ' + JSON.stringify(got)); } };

check('IMAGE e în lista funcțiilor', functionNames().includes('IMAGE'), null);
check('B1: poza din A1, încape în celulă, fără text', r.B1?.img?.src === cells.A1 && r.B1.img.sizing === 0 && r.B1.text === '' && !r.B1.err, r.B1);
check('B2: textul alternativ e valoarea celulei', r.B2?.img?.alt === 'Sigla firmei' && r.B2.text === 'Sigla firmei', r.B2);
check('B3: IMAGINE (numele românesc) cu poză data:, umple celula', r.B3?.img?.src === PNG && r.B3.img.sizing === 1 && r.B3.text === 'punct', r.B3);
check('B4: mărime aleasă 40 × 60', r.B4?.img?.sizing === 3 && r.B4.img.h === 40 && r.B4.img.w === 60, r.B4);
check('B5: argumentul sărit, mărimea pozei', r.B5?.img?.sizing === 2 && r.B5.img.alt === '', r.B5);
check('B6: IMAGE necalculat în IF fals → fără poză', !r.B6?.img && r.B6?.text === 'fără poză', r.B6);
for (const id of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']) check(id + ': #VALUE!', r[id]?.err === '#VALUE!' && !r[id].img, r[id]);
check('C8: eroarea din argument trece mai departe', r.C8?.err === '#DIV/0!' && !r.C8.img, r.C8);
check('D1: LEN pe celula cu poză = lungimea textului alternativ', r.D1?.text === '12', r.D1);

if (fail) { console.log(`\n${fail} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut.');
