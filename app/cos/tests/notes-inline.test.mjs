// Test pentru formatarea cu semne din notițe: **aldin**, *cursiv*, ~~tăiat~~, ==evidențiat==, # titluri, | tabele |,
// cu exportul în Docs și ca pagină web. Rulare (în suite/): node tests/notes-inline.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const src = (f) => join(process.cwd(), f).split(String.fromCharCode(92)).join('/');
const entry = join(tmpdir(), `suite-notesinline-entry-${process.pid}.ts`);
writeFileSync(entry, [
  `export * from '${src('src/notes/inline.ts')}';`,
  `export { noteToDoc } from '${src('src/notes/todoc.ts')}';`,
  `export { richBodyHtml } from '${src('src/notes/tohtml.ts')}';`,
].join(String.fromCharCode(10)));
const out = join(tmpdir(), `suite-notesinline-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
rmSync(entry, { force: true });

const NL = String.fromCharCode(10);
let bad = 0;
const check = (name, ok, got) => { console.log((ok ? 'OK   ' : 'GREȘIT ') + name + (ok ? '' : '  →  ' + got)); if (!ok) bad++; };
const show = (spans) => spans.map((p) => (p.b ? 'B' : '') + (p.i ? 'I' : '') + (p.u ? 'U' : '') + (p.x ? 'X' : '') + (p.h ? 'H' : '') + '[' + p.s + ']').join('');

check('aldin și cursiv', show(m.parseInline('a **b** *c* d')) === '[a ]B[b][ ]I[c][ d]', show(m.parseInline('a **b** *c* d')));
check('aldin cu cursiv în el', show(m.parseInline('**x *y* z**')) === 'B[x ]BI[y]B[ z]', show(m.parseInline('**x *y* z**')));
check('tăiat și evidențiat', show(m.parseInline('~~vechi~~ ==nou==')) === 'X[vechi][ ]H[nou]', show(m.parseInline('~~vechi~~ ==nou==')));
check('subliniat cu aldin în el', show(m.parseInline('++a **b**++')) === 'U[a ]BU[b]', show(m.parseInline('++a **b**++')));
check('„C++” și „1 + 1” rămân text', show(m.parseInline('C++ și 1 + 1')) === '[C++ și 1 + 1]', show(m.parseInline('C++ și 1 + 1')));
check('stelele fără pereche rămân text', show(m.parseInline('2 * 3 = 6 și 4*')) === '[2 * 3 = 6 și 4*]', show(m.parseInline('2 * 3 = 6 și 4*')));
check('text simplu fără semne', m.plainInline('**Atenție:** ==azi==') === 'Atenție: azi', m.plainInline('**Atenție:** ==azi=='));

// Butoanele: pun semnele în jurul selecției și le scot la a doua apăsare.
const v = 'un cuvânt aici';
const e1 = m.wrapEdit(v, 3, 9, '**');
const v1 = v.slice(0, e1.from) + e1.text + v.slice(e1.to);
check('Aldin pe selecție', v1 === 'un **cuvânt** aici', v1);
const e2 = m.wrapEdit(v1, 5, 11, '**');
const v2 = v1.slice(0, e2.from) + e2.text + v1.slice(e2.to);
check('Aldin din nou scoate semnele', v2 === v, v2);
const e3 = m.wrapEdit('ab', 1, 1, '*');
check('fără selecție: semnele și cursorul între ele', e3.text === '**' && e3.caret === 2, JSON.stringify(e3));
const e4 = m.wrapEdit('a cuvânt b', 1, 9, '==');
check('spațiile de la margini rămân în afară', e4.text === ' ==cuvânt== ', JSON.stringify(e4.text));

// Titluri.
const h = 'Titlu' + NL + 'text';
const h1 = m.headingEdit(h, 2, 2, 2);
const hv = h1.text + h.slice(h1.to);
check('Titlu 2 pe rândul cu cursorul', hv === '## Titlu' + NL + 'text', JSON.stringify(hv));
const h2 = m.headingEdit(hv, 4, 4, 2);
check('același titlu din nou îl scoate', h2.text === 'Titlu', JSON.stringify(h2.text));
check('nivelul titlului', m.headingLevel('### a') === 3 && m.headingLevel('#a') === 0 && m.headingLevel('#### a') === 4 && m.headingLevel('####### a') === 0, '');

// Tabele și blocuri.
const t = m.tableText(2, 1);
check('tabel gol 2 × 1', t === '| Coloana 1 | Coloana 2 |' + NL + '| --- | --- |' + NL + '|     |     |', JSON.stringify(t));
const body = ['# Cumpărături', 'lapte', 'pâine', '', '| Produs | Preț |', '| --- | --- |', '| lapte | **7,50** |', 'gata'].join(NL);
const bl = m.parseBlocks(body);
check('blocuri: titlu, paragraf, tabel, paragraf', bl.map((b) => b.kind).join(',') === 'h,p,table,p', bl.map((b) => b.kind).join(','));
check('tabelul are cap și un rând', JSON.stringify(bl[2].head) === '["Produs","Preț"]' && bl[2].rows.length === 1 && bl[2].rows[0][1] === '**7,50**', JSON.stringify(bl[2]));

// Export în Docs.
const doc = JSON.parse(m.noteToDoc({ id: 'x', title: 'Notă', body, updated: '', created: '', tags: [] })).content.content;
check('Docs: „# ” devine Titlu 2', doc[1].type === 'heading' && doc[1].attrs.level === 2 && doc[1].content[0].text === 'Cumpărături', JSON.stringify(doc[1]));
const tbl = doc.find((n) => n.type === 'table');
check('Docs: tabel cu cap și rând', tbl && tbl.content.length === 2 && tbl.content[0].content[0].type === 'tableHeader', JSON.stringify(tbl));
const cell = tbl?.content[1].content[1].content[0].content[0];
check('Docs: aldinul din celulă', cell?.text === '7,50' && cell.marks?.[0]?.type === 'bold', JSON.stringify(cell));
check('Docs: rândul de după tabel rămâne paragraf', doc[doc.length - 1].type === 'paragraph' && doc[doc.length - 1].content[0].text === 'gata', JSON.stringify(doc[doc.length - 1]));
const d2 = JSON.parse(m.noteToDoc({ id: 'y', title: 'T', body: 'vezi ~~www.exemplu.ro~~ ==acum==', updated: '', created: '', tags: [] })).content.content[1].content;
check('Docs: tăiat peste legătură, evidențiat', d2[1].marks.map((k) => k.type).join() === 'strike,link' && d2[3].marks[0].type === 'highlight', JSON.stringify(d2));

const d3 = JSON.parse(m.noteToDoc({ id: 'z', title: 'T', body: '++semnat++', updated: '', created: '', tags: [] })).content.content[1].content;
check('Docs: subliniat', d3[0].marks?.[0]?.type === 'underline', JSON.stringify(d3));

// Pagina web.
const html = m.richBodyHtml(body);
check('HTML: titlu, tabel, aldin', html.includes('<h2>Cumpărături</h2>') && html.includes('<th>Produs</th>') && html.includes('<td><strong>7,50</strong></td>'), html);
check('HTML: subliniat', m.richBodyHtml('++a++') === '<p><u>a</u></p>', m.richBodyHtml('++a++'));
check('HTML: caracterele speciale scăpate', m.richBodyHtml('**a<b**') === '<p><strong>a&lt;b</strong></p>', m.richBodyHtml('**a<b**'));

console.log(bad ? `${bad} verificări greșite` : 'Toate verificările au trecut.');
process.exit(bad ? 1 : 0);
