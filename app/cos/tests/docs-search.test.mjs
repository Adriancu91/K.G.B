// Test pentru căutarea avansată din Docs: litere mari / mici, cuvinte întregi, semnele * și ?.
// Rulare (în suite/): node tests/docs-search.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-dsearch-${process.pid}.mjs`);
await build({ entryPoints: ['src/docs/searchMatch.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { textMatches } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' → ' + info}`); if (!ok) fail++; };
const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), `${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`);
const words = (t, q, o) => textMatches(t, q, o).map(([a, b]) => t.slice(a, b));

eq('simplu, fără litere mari', words('Marea e mare. MARE!', 'mare'), ['Mare', 'mare', 'MARE']);
eq('Aa', words('Marea e mare. MARE!', 'mare', { caseSensitive: true }), ['mare']);
eq('diacritice mari / mici', words('ÎNTRE noi și între voi', 'între'), ['ÎNTRE', 'între']);
eq('cuvinte întregi', words('marea, mare, amare, mare.', 'mare', { wholeWord: true }), ['mare', 'mare']);
eq('cuvinte întregi cu diacritice', words('șase șasea și șase', 'șase', { wholeWord: true }), ['șase', 'șase']);
eq('cuvinte întregi: „ana” în „banana ana”', words('banana ana', 'ana', { wholeWord: true }), ['ana']);
eq('cifrele fac parte din cuvânt', words('A12 A1 A1.', 'a1', { wholeWord: true }), ['A1', 'A1']);
eq('? = o literă', words('car cor cer cr ceer', 'c?r', { wildcards: true }), ['car', 'cor', 'cer']);
eq('* = oricâte, cât mai puține', words('între și încercare', 'în*re', { wildcards: true }), ['între', 'încercare']);
eq('* + cuvinte întregi', words('sat sold sand', 's*d', { wildcards: true, wholeWord: true }), ['sold', 'sand']);
eq('fără semne: ? și * se caută ca atare', words('Ce? 2*3 ce', 'ce?'), ['Ce?']);
eq('fără semne: * ca atare', words('2*3 = 6', '2*3'), ['2*3']);
eq('semne speciale de expresii (paranteze, puncte)', words('a.b (x) [y] a+b', '(x)'), ['(x)']);
eq('punctul nu e orice literă', words('axb a.b', 'a.b'), ['a.b']);
eq('cratimă și bară oblică', words('Cluj-Napoca 1/2 x', 'cluj-napoca 1/2', { wildcards: true }), ['Cluj-Napoca 1/2']);
const BS = String.fromCharCode(92);
eq('bară inversă', words('C:' + BS + 'x', 'c:' + BS), ['C:' + BS]);
eq('căutare goală', textMatches('abc', ''), []);
eq('* nu trece peste o imagine', words('ab' + String.fromCharCode(0xfffc) + 'cd', 'a*d', { wildcards: true }), []);

if (fail) { console.log(`\n${fail} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut');
