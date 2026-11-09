// Test pentru exportul notiței ca pagină web (.html): caractere scăpate, legături, poze incluse, notițe blocate.
// Rulare (în suite/): node tests/notes-html.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const src = (f) => join(process.cwd(), f).replaceAll('\\', '/');
const entry = join(tmpdir(), `suite-noteshtml-entry-${process.pid}.ts`);
writeFileSync(entry, `export * from '${src('src/notes/tohtml.ts')}';\nexport { newNote } from '${src('src/notes/store.ts')}';\n`);
const out = join(tmpdir(), `suite-noteshtml-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
rmSync(entry, { force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const NL = String.fromCharCode(10);

check('legături: adresa devine clicabilă, punctul de la final rămâne afară',
  m.bodyHtml('Vezi https://exemplu.ro/a?b=1&c=2.') === 'Vezi <a href="https://exemplu.ro/a?b=1&amp;c=2">https://exemplu.ro/a?b=1&amp;c=2</a>.', m.bodyHtml('Vezi https://exemplu.ro/a?b=1&c=2.'));
check('legături: www. primește https://', m.bodyHtml('www.anaf.ro').includes('href="https://www.anaf.ro"'));
check('caractere speciale scăpate', m.bodyHtml('<script>alert(1)</script> & "x"') === '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;');

const n = m.newNote({ title: 'Rețetă <1>', body: '☐ făină' + NL + '☑ ouă', images: ['data:image/png;base64,AAAA'], section: 'Casă', files: [{ id: 'a.pdf', name: 'act.pdf', size: 1 }] });
const h = m.noteToHtml(n);
check('pagina: titlul scăpat', h.includes('<title>Rețetă &lt;1&gt;</title>') && h.includes('<h1>Rețetă &lt;1&gt;</h1>'));
check('pagina: rândurile și ☐ rămân', h.includes('☐ făină' + NL + '☑ ouă'));
check('pagina: poza inclusă', h.includes('<img src="data:image/png;base64,AAAA" alt="Poza 1">'));
check('pagina: secțiunea și atașamentele', h.includes('Casă · ') && h.includes('act.pdf'));
check('pagina: diacriticele (UTF-8)', h.includes('<meta charset="utf-8">'));
const locked = m.noteToHtml({ ...n, body: '', images: undefined, secret: { v: 1 } });
check('notiță blocată: fără conținut', locked.includes('Notiță blocată') && !locked.includes('<img'));

console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
