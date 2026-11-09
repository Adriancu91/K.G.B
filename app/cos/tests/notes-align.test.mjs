// Test pentru alinierea rândurilor din notițe: {la centru:…}, {la dreapta:…}, {stânga-dreapta:…}, cu Lectura, exportul în Docs și .html.
// Rulare (în suite/): node tests/notes-align.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const src = (f) => join(process.cwd(), f).split(String.fromCharCode(92)).join('/');
const entry = join(tmpdir(), `suite-notesalign-entry-${process.pid}.ts`);
writeFileSync(entry, [
  `export * from '${src('src/notes/inline.ts')}';`,
  `export { noteToDoc } from '${src('src/notes/todoc.ts')}';`,
  `export { richBodyHtml, noteToHtml } from '${src('src/notes/tohtml.ts')}';`,
  `export { parseStore } from '${src('src/notes/store.ts')}';`,
].join(String.fromCharCode(10)));
const out = join(tmpdir(), `suite-notesalign-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
rmSync(entry, { force: true });


const NL = String.fromCharCode(10);
let bad = 0;
const check = (name, ok, got) => { console.log((ok ? 'OK   ' : 'GREȘIT ') + name + (ok ? '' : '  →  ' + got)); if (!ok) bad++; };
const ap = (v, e) => v.slice(0, e.from) + e.text + v.slice(e.to);
const J = JSON.stringify;

check('rând întreg la centru', J(m.lineAlign('{la centru:Salut **lume**}')) === J({ align: 'center', text: 'Salut **lume**' }), J(m.lineAlign('{la centru:Salut **lume**}')));
check('cu spații la margini', m.lineAlign('  {la dreapta:x}  ')?.align === 'right');
check('doar o parte din rând: nu e aliniere', m.lineAlign('{la centru:x} y') === null);
check('alte semne în interior', m.lineAlign('{stânga-dreapta:{roșu:a} b}')?.text === '{roșu:a} b');
check('în mijlocul rândului se vede doar textul', m.plainInline('a {la centru:b} c') === 'a b c', m.plainInline('a {la centru:b} c'));

let v = 'Titlu' + NL + 'text';
let e = m.alignEdit(v, 2, 2, 'la centru');
check('cursorul pe rând: rândul se centrează', ap(v, e) === '{la centru:Titlu}' + NL + 'text', ap(v, e));
v = ap(v, e);
e = m.alignEdit(v, 3, 3, 'la dreapta');
check('altă aliniere o înlocuiește', ap(v, e) === '{la dreapta:Titlu}' + NL + 'text', ap(v, e));
v = ap(v, e);
e = m.alignEdit(v, 0, v.length, '');
check('La stânga pe tot scoate alinierea', ap(v, e) === 'Titlu' + NL + 'text', ap(v, e));
v = '# Capitol' + NL + NL + 'unu';
e = m.alignEdit(v, 0, v.length, 'la centru');
check('titlul își păstrează „# ”, rândul gol rămâne gol', ap(v, e) === '# {la centru:Capitol}' + NL + NL + '{la centru:unu}', ap(v, e));
v = ap(v, e);

const blocks = m.parseBlocks(v + NL + 'doi' + NL + 'trei');
check('blocuri: titlu centrat, paragraf centrat separat, apoi paragraf obișnuit', J(blocks) === J([{ kind: 'h', level: 1, text: 'Capitol', align: 'center' }, { kind: 'p', text: 'unu', align: 'center' }, { kind: 'p', text: 'doi' + NL + 'trei' }]), J(blocks));
const html = m.richBodyHtml(v);
check('.html: text-align', html.includes('<h2 style="text-align:center">Capitol</h2>') && html.includes('<p style="text-align:center">unu</p>'), html);
const doc = JSON.stringify(JSON.parse(m.noteToDoc({ id: 'x', title: 'T', body: v + NL + '{stânga-dreapta:lung}', tags: [], created: 0, updated: 0 })));
check('→ Docs: titlul centrat', doc.includes('"type":"heading","attrs":{"level":2,"textAlign":"center"}'), doc.slice(0, 600));
check('→ Docs: paragraf centrat, fără semne', doc.includes('"attrs":{"textAlign":"center"},"content":[{"type":"text","text":"unu"}]'), doc.slice(0, 600));
check('→ Docs: stânga-dreapta', doc.includes('"textAlign":"justify"'), doc);

console.log(bad ? `${bad} teste au greșit.` : 'Toate testele au trecut.');
process.exit(bad ? 1 : 0);
