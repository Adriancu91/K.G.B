// Test pentru mărimile și fonturile din notițe: {mare:text}, {font Georgia:text}, fontul întregii notițe, cu Lectura, exportul în Docs și .html.
// Rulare (în suite/): node tests/notes-fonts.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const src = (f) => join(process.cwd(), f).split(String.fromCharCode(92)).join('/');
const entry = join(tmpdir(), `suite-notesfonts-entry-${process.pid}.ts`);
writeFileSync(entry, [
  `export * from '${src('src/notes/inline.ts')}';`,
  `export { noteToDoc } from '${src('src/notes/todoc.ts')}';`,
  `export { richBodyHtml, noteToHtml } from '${src('src/notes/tohtml.ts')}';`,
  `export { parseStore } from '${src('src/notes/store.ts')}';`,
].join(String.fromCharCode(10)));
const out = join(tmpdir(), `suite-notesfonts-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
rmSync(entry, { force: true });

const NL = String.fromCharCode(10);
let bad = 0;
const check = (name, ok, got) => { console.log((ok ? 'OK   ' : 'GREȘIT ') + name + (ok ? '' : '  →  ' + got)); if (!ok) bad++; };
const show = (spans) => spans.map((p) => (p.b ? 'B' : '') + (p.c ? 'C' + p.c : '') + (p.sz ? 'S' + p.sz : '') + (p.f ? 'F' + p.f.split(',')[0] : '') + '[' + p.s + ']').join('');
const ap = (v, e) => v.slice(0, e.from) + e.text + v.slice(e.to);

// Citirea semnelor
check('mare', show(m.parseInline('a {mare:b} c')) === '[a ]S1.3[b][ c]', show(m.parseInline('a {mare:b} c')));
check('foarte mare nu e „mare”', show(m.parseInline('{foarte mare:x}')) === 'S1.7[x]', show(m.parseInline('{foarte mare:x}')));
check('mic și foarte mic', show(m.parseInline('{mic:a}{foarte mic:b}')) === 'S0.85[a]S0.75[b]', show(m.parseInline('{mic:a}{foarte mic:b}')));
check('font', show(m.parseInline('{font Georgia:titlu}')) === 'FGeorgia[titlu]', show(m.parseInline('{font Georgia:titlu}')));
check('font cu spații', show(m.parseInline('{font Times New Roman:x}')) === 'F"Times New Roman"[x]', show(m.parseInline('{font Times New Roman:x}')));
check('unele în altele', show(m.parseInline('{mare:{roșu:x} y}')) === 'C#d32f2fS1.3[x]S1.3[ y]', show(m.parseInline('{mare:{roșu:x} y}')));
check('aldin în mărime', show(m.parseInline('{mare:**x**}')) === 'BS1.3[x]', show(m.parseInline('{mare:**x**}')));
check('font necunoscut rămâne text', show(m.parseInline('{font Necunoscut:x}')) === '[{font Necunoscut:x}]', show(m.parseInline('{font Necunoscut:x}')));
check('acoladă fără pereche rămâne text', show(m.parseInline('{mare:abc')) === '[{mare:abc]', show(m.parseInline('{mare:abc')));
check('plainInline', m.plainInline('{mare:{font Arial:Salut}} lume') === 'Salut lume', m.plainInline('{mare:{font Arial:Salut}} lume'));

// Butoanele
let v = 'Un titlu aici';
let e = m.styleEdit(v, 3, 8, 'mare', 'sz');
check('pune mărimea', ap(v, e) === 'Un {mare:titlu} aici', ap(v, e));
v = ap(v, e);
e = m.styleEdit(v, 10, 12, 'foarte mare', 'sz');
check('altă mărime o înlocuiește', ap(v, e) === 'Un {foarte mare:titlu} aici', ap(v, e));
v = ap(v, e);
e = m.styleEdit(v, 16, 21, 'Georgia', 'f');
check('fontul se pune în interior, separat de mărime', ap(v, e) === 'Un {foarte mare:{font Georgia:titlu}} aici', ap(v, e));
v = ap(v, e);
e = m.styleEdit(v, 32, 34, '', 'sz');
check('Mărime obișnuită scoate doar mărimea (cursor în font)', ap(v, e) === 'Un {font Georgia:titlu} aici', ap(v, e));
e = m.styleEdit(v, 0, v.length, '', 'f');
check('Fontul obișnuit pe toată selecția păstrează mărimea', ap(v, e) === 'Un {foarte mare:titlu} aici', ap(v, e));
e = m.styleEdit('ab', 1, 1, 'mic', 'sz');
check('fără selecție pune semnele goale', ap('ab', e) === 'a{mic:}b' && e.caret === 6, ap('ab', e) + ' ' + e.caret);
v = 'unu' + NL + 'doi';
e = m.styleEdit(v, 0, v.length, 'Verdana', 'f');
check('pe două rânduri', ap(v, e) === '{font Verdana:unu}' + NL + '{font Verdana:doi}', ap(v, e));
check('colorEdit merge ca înainte', ap('x y', m.colorEdit('x y', 2, 3, 'verde')) === 'x {verde:y}');

// Export
const html = m.richBodyHtml('A {mare:b} {font Consolas:c}');
check('.html: mărime și font', html.includes('font-size:1.3em') && html.includes('font-family:Consolas'), html);
const note = { id: 'x', title: 'T', body: '{mare:a} {font Georgia:b} c', tags: [], created: 0, updated: 0, font: 'Verdana' };
const txt = JSON.stringify(JSON.parse(m.noteToDoc(note)));
check('→ Docs: mărimea în puncte', txt.includes('"fontSize":"14pt"'), txt.slice(0, 500));
check('→ Docs: fontul ales', txt.includes('"fontFamily":"Georgia"'), txt.slice(0, 500));
check('→ Docs: fontul notiței pe restul textului', txt.includes('"fontFamily":"Verdana"'), txt.slice(0, 500));
check('.html: fontul notiței', m.noteToHtml(note).includes('font-family: Verdana, sans-serif'), '');
const st = m.parseStore(JSON.stringify({ format: 'suite-notes', version: 1, notes: [{ id: 'a', title: 't', body: '', font: 'Georgia' }, { id: 'b', title: 'u', body: '', font: 'Wingdings<script>' }] }));
check('fontul notiței se păstrează la deschidere', st.notes[0].font === 'Georgia', JSON.stringify(st.notes[0]));
check('fontul necunoscut se ignoră', st.notes[1].font === undefined, JSON.stringify(st.notes[1]));

console.log(bad ? `${bad} teste au greșit.` : 'Toate testele au trecut.');
process.exit(bad ? 1 : 0);
