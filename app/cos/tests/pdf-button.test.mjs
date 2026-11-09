// Test: PDF → câmpul „▭ Buton”: acțiunea din opts (golește, tipărește, adresă, pagină), adresa completată, textul obișnuit al butonului.
// Rulare (în suite/): node tests/pdf-button.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(tmpdir(), `suite-btn-${process.pid}.mjs`);
await build({ entryPoints: [join(process.cwd(), 'src/pdf/sign.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
const { buttonAction, buttonOpts, buttonCaption, normalUrl } = await import(pathToFileURL(out).href);

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

check(eq(buttonAction(undefined), { kind: 'reset' }) && eq(buttonAction(''), { kind: 'reset' }), 'fără acțiune: golește formularul');
check(eq(buttonAction('print'), { kind: 'print' }), 'tipărește');
check(eq(buttonAction('url: www.exemplu.ro '), { kind: 'url', url: 'www.exemplu.ro' }), 'adresă web');
check(eq(buttonAction('page:3'), { kind: 'page', page: 3 }) && eq(buttonAction('page:x'), { kind: 'page', page: 1 }) && eq(buttonAction('page:-4'), { kind: 'page', page: 1 }), 'pagina (cel puțin 1)');
for (const a of [{ kind: 'reset' }, { kind: 'print' }, { kind: 'url', url: 'https://a.ro/b?c=1' }, { kind: 'page', page: 7 }]) check(eq(buttonAction(buttonOpts(a)), a), 'dus-întors: ' + a.kind);
check(normalUrl('www.exemplu.ro') === 'https://www.exemplu.ro', 'adresa fără https:// îl primește');
check(normalUrl('http://a.ro') === 'http://a.ro' && normalUrl('mailto:x@y.ro') === 'mailto:x@y.ro', 'adresa cu protocol rămâne');
check(normalUrl('ion@firma.ro') === 'mailto:ion@firma.ro', 'un e-mail devine mailto:');
check(normalUrl('  ') === '', 'adresa goală rămâne goală');
check(buttonCaption({ text: 'Trimite' }) === 'Trimite', 'textul scris rămâne pe buton');
check(buttonCaption({ opts: 'print' }) === 'Tipărește' && buttonCaption({}) === 'Golește formularul' && buttonCaption({ opts: 'page:2' }) === 'Mergi la pagina 2', 'textul obișnuit după acțiune');

if (bad) { console.log(`\n${bad} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut.');
