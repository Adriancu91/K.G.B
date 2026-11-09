// Test pentru ecuațiile din notițe ({ecuație:…}): citirea semnului (și cu acolade în el), găsirea ecuației de la cursor,
// pagina .html (desenul SVG), → Docs (imaginea de ecuație sub rândul ei), textul simplu pentru căutare.
// Rulare (în suite/): node tests/notes-equation.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const B = String.fromCharCode(92);
const src = (f) => join(process.cwd(), f).split(B).join('/');
const entry = join(tmpdir(), `suite-noteseq-entry-${process.pid}.ts`);
writeFileSync(entry, ['inline', 'tohtml', 'todoc', 'store'].map((f) => `export * from '${src('src/notes/' + f + '.ts')}';`).join(String.fromCharCode(10)));
const out = join(tmpdir(), `suite-noteseq-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
rmSync(entry, { force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const NL = String.fromCharCode(10);
const J = JSON.stringify;

const sp = m.parseInline('Aria: {ecuație:A = pi r^2} cm');
check('semnul devine ecuație', sp.length === 3 && sp[1].eq === 'A = pi r^2' && sp[0].s === 'Aria: ' && sp[2].s === ' cm', J(sp));
const sp2 = m.parseInline('{ecuatie:x^{2n} + 1}');
check('fără diacritice și cu acolade în ecuație', sp2.length === 1 && sp2[0].eq === 'x^{2n} + 1', J(sp2));
check('fără acolada de închidere rămâne text', !m.parseInline('{ecuație:x^2').some((p) => p.eq));
check('ecuația goală rămâne text', !m.parseInline('{ecuație: }').some((p) => p.eq));
const sp3 = m.parseInline('**{ecuație:a/b} gros**');
check('în aldin', sp3[0].eq === 'a/b' && sp3[0].b, J(sp3));
check('textul simplu păstrează ecuația (căutare, voce)', m.plainInline('x {ecuație:a/b} y') === 'x a/b y', m.plainInline('x {ecuație:a/b} y'));
check('semnul pus de buton', m.equationMark('a/b' + NL + '+ c') === '{ecuație:a/b + c}', m.equationMark('a/b' + NL + '+ c'));

const t = 'Rând' + NL + 'Fie {ecuație:x_1} și {ecuație:x_2}.';
const at = m.equationAt(t, t.indexOf('x_2'));
check('ecuația de la cursor (a doua)', at && at.src === 'x_2' && t.slice(at.from, at.to) === '{ecuație:x_2}', J(at));
const at1 = m.equationAt(t, t.indexOf('{ecuație:x_1}'));
check('cursorul chiar la început', at1 && at1.src === 'x_1', J(at1));
// Ecuația scrisă cu bară inversă (acolade în ea, și una fără pereche, scrisă ca semn) se găsește întreagă.
{ const B = String.fromCharCode(92), tx = 'a {ecuație:' + B + 'frac{1}{2} + ' + B + 'left' + B + '{ x ' + B + 'right.} b';
  const e = m.equationAt(tx, 5); check('ecuația cu bară inversă', e && e.src === B + 'frac{1}{2} + ' + B + 'left' + B + '{ x ' + B + 'right.' && tx.slice(e.to) === ' b', J(e)); }
check('cursorul în afara ecuațiilor', m.equationAt(t, 2) === null && m.equationAt(t, t.indexOf('și') + 1) === null, J(m.equationAt(t, t.indexOf('și') + 1)));

const n = m.newNote({ title: 'Mate', body: 'Formula: {ecuație:a^2 + b^2 = c^2}' + NL + '{ecuație:sqrt(x)}' + NL + '• listă {ecuație:pi}' });
const html = m.noteToHtml(n);
check('.html: desen SVG cu textul ecuației', /<img class="eq"[^>]*alt="Ecuație: a\^2 \+ b\^2 = c\^2"[^>]*src="data:image\/svg\+xml/.test(html), html.slice(0, 400));
check('.html: semnul nu se vede', !html.includes('{ecuație:'));

check('lista ecuațiilor notiței', J(m.noteEquations(n)) === J(['a^2 + b^2 = c^2', 'sqrt(x)', 'pi']), J(m.noteEquations(n)));
const pngs = new Map([['a^2 + b^2 = c^2', { src: 'data:image/png;base64,AAA', w: 120 }], ['sqrt(x)', { src: 'data:image/png;base64,BBB', w: 40 }]]);
const doc = JSON.parse(m.noteToDoc(n, pngs)).content.content;
const types = doc.map((d) => d.type).join();
check('→ Docs: paragraf, imagine, imagine, listă', types === 'heading,paragraph,image,image,bulletList', types);
check('→ Docs: textul rămâne fără semn', doc[1].content.map((c) => c.text).join('') === 'Formula: ', J(doc[1]));
check('→ Docs: imaginea ține minte ecuația', doc[2].attrs.src.endsWith('AAA') && JSON.parse(doc[2].attrs.equation).src === 'a^2 + b^2 = c^2' && doc[2].attrs.width === 120, J(doc[2].attrs));
const li = doc[4].content[0].content;
check('→ Docs: ecuația fără desen din listă rămâne text', li.length === 2 && li[1].content[0].text === 'pi', J(li));
check('→ Docs fără desene: nimic nu se pierde', JSON.parse(m.noteToDoc(n)).content.content.filter((d) => d.type === 'paragraph').length === 3);

console.log(fail ? `notes-equation: ${fail} GREȘELI` : 'notes-equation: toate trec');
process.exit(fail ? 1 : 0);
