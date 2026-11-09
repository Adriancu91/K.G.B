// Test pentru WEBSERVICE: întâi #BUSY!, apoi textul adus; o singură aducere pe adresă, foaia anunțată, erorile.
// Fără internet: „aducătorul” e unul de probă. Rulare (în suite/): node tests/formula-webservice.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const dir = join(tmpdir(), `suite-websvc-${process.pid}`);
const entry = join(dir, 'entry.ts');
await import('node:fs').then((fs) => fs.mkdirSync(dir, { recursive: true }));
writeFileSync(entry, `export * from ${JSON.stringify(join(process.cwd(), 'src/sheets/formula.ts'))};\nexport * from ${JSON.stringify(join(process.cwd(), 'src/sheets/webService.ts'))};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'out.mjs'), logLevel: 'error' });
const { evaluateAll, functionNames, setWebFetcher, onWebData, ERROR_HELP } = await import(pathToFileURL(join(dir, 'out.mjs')).href);
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const check = (name, ok, got) => { if (ok) console.log('ok: ' + name); else { fail++; console.log('GREȘIT: ' + name + ' → ' + JSON.stringify(got)); } };
const enc = (s) => new TextEncoder().encode(s);
const calls = [];
setWebFetcher(async (url) => {
  calls.push(url);
  await new Promise((r) => setTimeout(r, 20));
  if (url.endsWith('/curs')) return { data: enc('4,9761'), type: 'text/plain; charset=utf-8' };
  if (url.endsWith('/latin')) return { data: new Uint8Array([0x63, 0x61, 0x66, 0xe9]), type: 'text/plain; charset=iso-8859-1' };
  if (url.endsWith('/mare')) return { data: enc('x'.repeat(40000)), type: 'text/plain' };
  throw new Error('404');
});
let told = 0;
onWebData(() => told++);
const cells = {
  A1: 'https://exemplu.ro/curs',
  B1: '=WEBSERVICE(A1)', B2: '=WEBSERVICE("https://exemplu.ro/curs")&" lei"', B3: '=WEBSERVICE("https://exemplu.ro/latin")',
  B4: '=WEBSERVICE("https://exemplu.ro/mare")', B5: '=WEBSERVICE("https://exemplu.ro/lipsa")', B6: '=WEBSERVICE("ftp://exemplu.ro/x")',
  B7: '=WEBSERVICE("C:\\fisier.txt")', B8: '=VALUE(WEBSERVICE(A1))*2',
};
const book = { self: 'Foaia1', sheets: [{ name: 'Foaia1', cells }] };
check('WEBSERVICE e în lista funcțiilor', functionNames().includes('WEBSERVICE'), null);
check('#BUSY! are explicație', !!ERROR_HELP['#BUSY!'], null);
let r = evaluateAll(cells, book);
check('prima dată: #BUSY! cât se aduce', r.B1?.err === '#BUSY!' && r.B3?.err === '#BUSY!', r.B1);
check('adresele greșite: #VALUE! pe loc', r.B6?.err === '#VALUE!' && r.B7?.err === '#VALUE!', [r.B6, r.B7]);
await new Promise((res) => setTimeout(res, 120));
check('foaia a fost anunțată când au sosit răspunsurile', told >= 1, told);
check('aceeași adresă (A1 și scrisă direct) s-a adus o singură dată', calls.filter((u) => u.endsWith('/curs')).length === 1, calls);
r = evaluateAll(cells, book);
check('B1: textul adus', r.B1?.text === '4,9761' && !r.B1.err, r.B1);
check('B2: se lipește cu alt text', r.B2?.text === '4,9761 lei', r.B2);
check('B3: textul în codarea dată (iso-8859-1)', r.B3?.text === 'café', r.B3);
check('B4: peste 32767 de caractere → #VALUE!', r.B4?.err === '#VALUE!', r.B4);
check('B5: adresa nu răspunde → #VALUE!', r.B5?.err === '#VALUE!', r.B5);
check('B8: răspunsul se poate folosi în calcule', r.B8?.text === '9,9522', r.B8);
const n = calls.length;
evaluateAll(cells, book);
check('recalcularea nu aduce din nou', calls.length === n, calls.length);

if (fail) { console.log(`\n${fail} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut.');
