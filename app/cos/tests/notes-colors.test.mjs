// Test pentru culorile din notițe: {roșu:text} și {fundal verde:text}, cu butonul de culoare, Lectura, exportul în Docs și .html.
// Rulare (în suite/): node tests/notes-colors.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const src = (f) => join(process.cwd(), f).split(String.fromCharCode(92)).join('/');
const entry = join(tmpdir(), `suite-notescolors-entry-${process.pid}.ts`);
writeFileSync(entry, [
  `export * from '${src('src/notes/inline.ts')}';`,
  `export { noteToDoc } from '${src('src/notes/todoc.ts')}';`,
  `export { richBodyHtml } from '${src('src/notes/tohtml.ts')}';`,
].join(String.fromCharCode(10)));
const out = join(tmpdir(), `suite-notescolors-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
rmSync(entry, { force: true });

const NL = String.fromCharCode(10);
let bad = 0;
const check = (name, ok, got) => { console.log((ok ? 'OK   ' : 'GREȘIT ') + name + (ok ? '' : '  →  ' + got)); if (!ok) bad++; };
const show = (spans) => spans.map((p) => (p.b ? 'B' : '') + (p.c ? 'C' + p.c : '') + (p.hc ? 'F' + p.hc : '') + '[' + p.s + ']').join('');
const ap = (v, e) => v.slice(0, e.from) + e.text + v.slice(e.to);

check('text roșu', show(m.parseInline('a {roșu:b} c')) === '[a ]C#d32f2f[b][ c]', show(m.parseInline('a {roșu:b} c')));
check('fundal verde', show(m.parseInline('{fundal verde:x}')) === 'F#c8e6c9[x]', show(m.parseInline('{fundal verde:x}')));
check('aldin în culoare', show(m.parseInline('{albastru:a **b**}')) === 'C#1565c0[a ]BC#1565c0[b]', show(m.parseInline('{albastru:a **b**}')));
check('culoare în aldin', show(m.parseInline('**{mov:x}**')) === 'BC#7b1fa2[x]', show(m.parseInline('**{mov:x}**')));
check('acolade obișnuite rămân text', show(m.parseInline('f(x) = {a, b} {roșu fără două puncte}')) === '[f(x) = {a, b} {roșu fără două puncte}]', show(m.parseInline('f(x) = {a, b} {roșu fără două puncte}')));
check('fără închidere rămâne text', show(m.parseInline('{roșu:abc')) === '[{roșu:abc]', show(m.parseInline('{roșu:abc')));
check('plainInline scoate semnele', m.plainInline('Azi {roșu:urgent} și {fundal galben:mâine}') === 'Azi urgent și mâine', m.plainInline('Azi {roșu:urgent} și {fundal galben:mâine}'));

let v = 'Ceva important aici';
let e = m.colorEdit(v, 5, 14, 'roșu');
check('butonul pune culoarea', ap(v, e) === 'Ceva {roșu:important} aici', ap(v, e));
v = ap(v, e);
e = m.colorEdit(v, 12, 15, 'verde');
check('altă culoare o înlocuiește', ap(v, e) === 'Ceva {verde:important} aici', ap(v, e));
v = ap(v, e);
e = m.colorEdit(v, 13, 16, 'galben', true);
check('fundalul se pune separat de culoare', ap(v, e).includes('{fundal galben:'), ap(v, e));
e = m.colorEdit(v, 12, 15, '');
check('Fără culoare o scoate', ap(v, e) === 'Ceva important aici', ap(v, e));
e = m.colorEdit(v, 0, v.length, '');
check('Fără culoare pe toată selecția', ap(v, e) === 'Ceva important aici', ap(v, e));
v = 'unu' + NL + 'doi';
e = m.colorEdit(v, 0, v.length, 'roz');
check('pe două rânduri, câte una pe rând', ap(v, e) === '{roz:unu}' + NL + '{roz:doi}', ap(v, e));
e = m.colorEdit('ab', 1, 1, 'gri');
check('fără selecție pune semnele goale', ap('ab', e) === 'a{gri:}b' && e.caret === 6, ap('ab', e) + ' ' + e.caret);

const html = m.richBodyHtml('Text {roșu:roșu} și {fundal verde:marcat}');
check('.html: culoare și fundal', html.includes('<span style="color:#d32f2f">roșu</span>') && html.includes('<mark style="background:#c8e6c9">marcat</mark>'), html);
const doc = JSON.parse(m.noteToDoc({ id: 'x', title: 'T', body: '{albastru:a} {fundal roz:b}', tags: [], created: 0, updated: 0 }));
const txt = JSON.stringify(doc);
check('→ Docs: textStyle cu culoare', txt.includes('"type":"textStyle","attrs":{"color":"#1565c0"}'), txt.slice(0, 400));
check('→ Docs: evidențiere roz', txt.includes('"type":"highlight","attrs":{"color":"#f8bbd0"}'), txt.slice(0, 400));

console.log(bad ? `${bad} greșeli` : 'Toate testele au trecut.');
process.exit(bad ? 1 : 0);
