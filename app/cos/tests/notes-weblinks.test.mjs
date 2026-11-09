// Test pentru legăturile web din Notițe: găsirea adreselor, Ctrl+click, hyperlink-uri la → Docs.
// Rulare (în suite/): node tests/notes-weblinks.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const src = (f) => join(process.cwd(), f).replaceAll('\\', '/');
const entry = join(tmpdir(), `suite-notesweb-entry-${process.pid}.ts`);
writeFileSync(entry, `export * from '${src('src/notes/store.ts')}';\nexport { noteToDoc } from '${src('src/notes/todoc.ts')}';\n`);
const out = join(tmpdir(), `suite-notesweb-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
rmSync(entry, { force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

const body = 'Vezi https://anaf.ro/formulare. Și www.emag.ro, apoi (https://ro.wikipedia.org/wiki/Ion_(film)).\n'
  + 'Din nou https://anaf.ro/formulare și „https://exemplu.ro/a?b=1&c=2”. Nu: www.x și http://';
const n = m.newNote({ title: 'Linkuri', body });
const links = m.webLinksOf(n);
check('găsește adresele, fără punctuația de la capăt', JSON.stringify(links) === JSON.stringify([
  'https://anaf.ro/formulare', 'www.emag.ro', 'https://ro.wikipedia.org/wiki/Ion_(film)', 'https://exemplu.ro/a?b=1&c=2',
]), JSON.stringify(links));
check('www. primește https://', m.webHref('www.emag.ro') === 'https://www.emag.ro' && m.webHref('http://a.ro') === 'http://a.ro');
check('fără adrese → listă goală', m.webLinksOf(m.newNote({ body: 'nimic aici, doar text.ro? nu' })).length === 0);

// Ctrl+click: poziția din text.
const i = body.indexOf('emag');
check('Ctrl+click în mijlocul adresei o găsește', m.webLinkAt(body, i) === 'www.emag.ro');
check('Ctrl+click pe text obișnuit → nimic', m.webLinkAt(body, 1) === null);

// → Docs: adresele devin hyperlink-uri.
const doc = JSON.parse(m.noteToDoc(m.newNote({ title: 'T', body: 'Site: www.emag.ro azi' }))).content.content;
const p = doc[1].content;
check('→ Docs: text + legătură + text', p.length === 3 && p[0].text === 'Site: ' && p[2].text === ' azi', JSON.stringify(p));
check('→ Docs: legătura are href complet', p[1].text === 'www.emag.ro' && p[1].marks?.[0]?.type === 'link' && p[1].marks[0].attrs.href === 'https://www.emag.ro');

console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
