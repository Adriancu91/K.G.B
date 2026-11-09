// Test pentru sugestiile de la scrierea formulelor în Sheets: lista de funcții după primele litere și argumentul curent.
// Rulare (în suite/): node tests/formula-hint.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-fxhint-${process.pid}`);
await build({ entryPoints: ['src/sheets/fnhelp.ts', 'src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { formulaHint, hintArgs, RO_FNS, fnEnglish, enterPicks } = await import(pathToFileURL(join(dir, 'fnhelp.js')).href);
const { functionNames, normName, evaluateAll } = await import(pathToFileURL(join(dir, 'formula.js')).href);
rmSync(dir, { recursive: true, force: true });
const all = functionNames();
const at = (t) => formulaHint(t, t.length, all);

assert.equal(formulaHint('SU', 2, all), null, 'textul obișnuit nu primește sugestii');
const su = at('=SU');
assert.equal(su.word.text, 'SU');
assert.equal(su.word.start, 1);
assert.equal(su.word.list[0].name, 'SUM', 'SUM e primul (cel mai folosit)');
assert.ok(su.word.list.some((x) => x.name === 'SUMIF'));
assert.ok(su.word.list.length <= 8);
assert.equal(at('=su').word.list[0].name, 'SUM', 'și cu litere mici');
assert.equal(at('=A1+vl').word.list[0].name, 'VLOOKUP', 'după un semn');
assert.equal(at('=A1')?.word, undefined, 'o celulă nu dă sugestii');
assert.equal(at('=Foaia1!SU')?.word, undefined, 'nu după numele foii');
assert.equal(at('="SU'), null, 'nu în text între ghilimele');
assert.ok(!at('=SUM').word.list.some((x) => x.name === 'SUM') && at('=SUM').word.list[0].name.startsWith('SUM'), 'numele întreg: doar funcțiile mai lungi (SUMIF…)');
// Argumentul curent.
const c1 = at('=SUM(A1;');
assert.equal(c1.call.name, 'SUM');
assert.equal(c1.call.arg, 1);
const c2 = at('=IF(A1>0;SUM(B1;B2);');
assert.equal(c2.call.name, 'IF', 'după paranteza închisă, înapoi în IF');
assert.equal(c2.call.arg, 2);
assert.equal(at('=ROUND(1,5').call.arg, 0, 'virgula zecimală nu desparte argumentele');
assert.equal(at('=ROUND(A1,2').call.arg, 1, 'virgula după o celulă desparte argumentele');
assert.equal(at('=IF(A1="a;b";').call.arg, 1, 'punctul și virgula din text nu contează');
assert.equal(formulaHint('=SUM(A1;B1)', 6, all).call.arg, 0, 'cursorul în mijlocul formulei');
assert.equal(at('=(A1+')?.call, undefined, 'parantezele fără funcție nu dau argumente');
// Argumentele scrise aldin.
const help = { name: 'SUM', args: 'număr1; [număr2]; …' };
assert.deepEqual(hintArgs(help, 0), { parts: ['număr1', '[număr2]', '…'], on: 0 });
assert.equal(hintArgs(help, 5).on, 1, 'argumentele în plus cad pe cel repetat');
assert.equal(hintArgs({ args: 'text; nr' }, 4).on, -1, 'prea multe argumente: niciunul aldin');
// Numele românești: în listă, cu funcția lor englezească și explicația ei; și fără diacritice.
const med = at('=med');
assert.equal(med.word.list[0].name, 'MEDIE', 'MEDIE (AVERAGE) e uzuală, deci prima');
assert.equal(med.word.list[0].en, 'AVERAGE');
assert.ok(med.word.list[0].help?.desc, 'are explicația lui AVERAGE');
assert.ok(med.word.list.some((x) => x.name === 'MEDIAN'), 'și funcțiile englezești');
assert.equal(at('=daca').word.list[0].name, 'DACĂEROARE', 'fără diacritice: DACA întreg nu apare, doar cele mai lungi');
assert.equal(at('=dac').word.list[0].name, 'DACĂ');
assert.equal(at('=dacă').word?.list[0].name, 'DACĂEROARE', 'cu diacritice în cuvânt');
assert.equal(at('=SUMĂ(A1;').call.arg, 1, 'argumentele și la nume cu diacritice');
assert.equal(at('=MEDIE(').call.help?.name, 'AVERAGE', 'argumentele lui AVERAGE la MEDIE(');
assert.equal(at('=DACĂ(A1>0;').call.help?.name, 'IF');
assert.ok(at('=rân').word.list.some((x) => x.name === 'RÂND' && x.en === 'ROW'));
// Fiecare nume românesc din listă e înțeles de calcul (și de exportul .xlsx, care folosește normName).
for (const [ro, en] of RO_FNS) {
  assert.equal(normName(ro), en, ro + ' → ' + en);
  assert.equal(fnEnglish(ro), en);
  assert.ok(all.includes(en), en + ' există');
}
assert.equal(fnEnglish('RAND'), 'RAND', 'RAND (fără diacritice) rămâne funcția englezească');
const r = evaluateAll({ A1: '=MEDIE(4;6)', A2: '=DACĂ(A1>4;"da";"nu")', A3: '=SUMĂ(1;2)', A4: '=RÂND()' });
assert.equal(r.A1.value, 5); assert.equal(r.A2.text, 'da', JSON.stringify(r.A2)); assert.equal(r.A3.value, 3); assert.equal(r.A4.value, 4);
// Enter primește sugestia doar când ce ai scris nu e deja valid.
assert.equal(enterPicks('su', all), true);
assert.equal(enterPicks('med', all), true);
assert.equal(enterPicks('PI', all), false, 'PI e funcție întreagă');
assert.equal(enterPicks('MEDIE', all), false);
assert.equal(enterPicks('B12', all), false, 'o celulă');
assert.equal(enterPicks('ADEVĂRAT', all), false);
assert.equal(enterPicks('Total', all, ['Total']), false, 'un nume definit');
console.log('sugestii de formule: toate verificările trec');
