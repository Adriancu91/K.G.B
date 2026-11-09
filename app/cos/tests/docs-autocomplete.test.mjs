// Test pentru completarea automată din Docs: lunile, zilele, data de azi și cuvintele lungi din document.
// Rulare (în suite/): node tests/docs-autocomplete.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-docsacomp-${process.pid}.mjs`);
await build({
  stdin: { contents: `export * from './src/docs/autoComplete.ts';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { completion, longDate } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, got, want) => { const ok = got === want; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`}`); if (!ok) fail++; };
const day = new Date(2026, 9, 22);
const C = (before, words = [], d = day) => { const c = completion(before, words, d); return c ? c.full : null; };

check('luna după 4 litere', C('Termen: 5 sept', [], new Date(2026, 0, 1)), 'septembrie');
check('luna cu majusculă', C('Febr'), 'Februarie');
check('luna scrisă cu majuscule', C('DECEM'), 'DECEMBRIE');
check('ziua', C('Ne vedem mier'), 'miercuri');
check('fără diacritice se completează cu ele', C('pana samba'), 'sâmbătă');
check('sub 4 litere nu', C('Ne vedem mie'), null);
check('cuvântul deja întreg nu', C('decembrie'), null);
check('o singură literă în plus nu', C('octombri'), null);
check('data de azi', C('Cluj, 22 oct', [], day), 'octombrie 2026');
check('data de azi: restul', JSON.stringify(completion('Cluj, 22 oct', [], day)), JSON.stringify({ rest: 'ombrie 2026', full: 'octombrie 2026', del: 3 }));
check('altă zi: doar luna', C('Cluj, 21 octo', [], day), 'octombrie');
check('longDate', longDate(day), '22 octombrie 2026');
check('cuvânt din document', C('Contractul de închir', ['închiriere', 'administrator']), 'închiriere');
check('cel mai scurt cuvânt potrivit', C('admin', ['administratorul', 'administrator']), 'administrator');
check('cuvânt din document cu majusculă', C('Admi', ['administrator']), 'Administrator');
check('cuvânt întreg + 2 litere din document nu', C('administrator', ['administratorul']), null);
check('nimic potrivit', C('Masa', ['administrator']), null);
check('în mijlocul unui număr nu', C('ref123abcd', ['abcdefghij']), null);

console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
