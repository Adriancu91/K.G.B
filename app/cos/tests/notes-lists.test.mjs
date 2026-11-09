// Test pentru listele din Notițe: buline, numerotate (Enter continuă și renumerotează), Tab, → Markdown și → Docs.
// Rulare (în suite/): node tests/notes-lists.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-noteslists-entry-${process.pid}.ts`);
writeFileSync(entry, `export * from '${join(process.cwd(), 'src/notes/checklist.ts').replaceAll('\\', '/')}';
export { noteToMarkdown } from '${join(process.cwd(), 'src/notes/markdown.ts').replaceAll('\\', '/')}';
export { noteToDoc } from '${join(process.cwd(), 'src/notes/todoc.ts').replaceAll('\\', '/')}';
`);
const out = join(tmpdir(), `suite-noteslists-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
rmSync(entry, { force: true });

let fail = 0;
const J = (...a) => a.join(String.fromCharCode(10));
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const run = (v, e) => (e ? v.slice(0, e.from) + e.text + v.slice(e.to) : v);

// Butonul „• Listă” pe trei rânduri, apoi din nou (le scoate).
let v = 'lapte\npâine\nouă';
let e = m.bulletEdit(v, 0, v.length, 'bullet');
check('• Listă: fiecare rând primește bulină', run(v, e) === '• lapte\n• pâine\n• ouă', JSON.stringify(run(v, e)));
const back = run(run(v, e), m.bulletEdit(run(v, e), 0, run(v, e).length, 'bullet'));
check('• Listă din nou: bulinele dispar', back === v, JSON.stringify(back));

// Numerotată, și din buline în numere.
const nums = run('• a\n• b', m.bulletEdit('• a\n• b', 0, 7, 'number'));
check('1. Numerotată: bulinele devin 1. 2.', nums === '1. a\n2. b', JSON.stringify(nums));
const box = run('☐ x', m.bulletEdit('☐ x', 0, 3, 'bullet'));
check('căsuța devine bulină (nu rămân amândouă)', box === '• x', JSON.stringify(box));

// Enter continuă lista cu buline și o încheie pe un rând gol.
v = '• lapte';
e = m.enterEdit(v, v.length);
check('Enter după „• lapte” → rând nou cu bulină', run(v, e) === '• lapte\n• ' && e.caret === run(v, e).length, JSON.stringify(run(v, e)));
v = '• lapte\n• ';
e = m.enterEdit(v, v.length);
check('Enter pe bulină goală → lista se încheie', run(v, e) === '• lapte\n' && e.caret === 8, JSON.stringify(run(v, e)));
v = '- da';
check('„- ” scris de mână continuă și el', run(v, m.enterEdit(v, 4)) === '- da\n- ');
check('pe text obișnuit Enter rămâne normal', m.enterEdit('salut', 5) === null && m.enterEdit('2024. an', 8) === null);

// Numerotată: Enter pune numărul următor și renumerotează ce urmează.
v = '1. unu\n2. doi\n3. trei';
e = m.enterEdit(v, 6); // după „unu”
check('Enter în mijlocul listei numerotate renumerotează', run(v, e) === '1. unu\n2. \n3. doi\n4. trei' && e.caret === 10, JSON.stringify(run(v, e)));
v = '1) a';
check('„1)” continuă cu „2)”', run(v, m.enterEdit(v, 4)) === '1) a\n2) ');
v = '1. a\n2. ';
check('număr gol → lista se încheie', run(v, m.enterEdit(v, v.length)) === '1. a\n');

// Tab / Shift+Tab: sub-liste.
v = '• a\n• b';
e = m.indentEdit(v, 6, 6, false);
check('Tab pe „• b” → sub-listă', run(v, e) === '• a\n    • b' && e.caret === 10, JSON.stringify(run(v, e)));
const sub = run(v, e);
check('Enter pe sub-listă păstrează nivelul', run(sub + 'x', m.enterEdit(sub + 'x', sub.length + 1)) === '• a\n    • bx\n    • ');
check('Enter pe sub-listă goală urcă un nivel', run('• a\n    • ', m.enterEdit('• a\n    • ', 10)) === '• a\n• ');
check('Shift+Tab o scoate înapoi', run(sub, m.indentEdit(sub, 10, 10, true)) === v);
// Paragrafele obișnuite se retrag și ele (câte 4 spații), titlurile, tabelele și rândurile goale nu.
e = m.indentEdit('salut', 2, 2, false);
check('Tab pe text obișnuit: paragraful se retrage', run('salut', e) === '    salut' && e.caret === 6, JSON.stringify(e));
check('Shift+Tab pe paragraful retras: înapoi', run('    salut', m.indentEdit('    salut', 6, 6, true)) === 'salut');
check('Shift+Tab pe paragraf neretras: nimic de făcut', m.indentEdit('salut', 2, 2, true) === null);
check('Tab pe titlu: nimic', m.indentEdit('## Titlu', 4, 4, false) === null);
check('Tab pe rând de tabel: nimic', m.indentEdit('| a | b |', 3, 3, false) === null);
check('Tab pe rând gol: nimic', m.indentEdit('', 0, 0, false) === null);
v = 'unu\n\n## T\ndoi';
check('Tab pe mai multe rânduri: doar paragrafele', run(v, m.indentEdit(v, 0, v.length, false)) === '    unu\n\n## T\n    doi', JSON.stringify(run(v, m.indentEdit(v, 0, v.length, false))));
v = ' '.repeat(m.PARA_INDENT_MAX) + 'x';
check('retragerea se oprește la 8 trepte', m.indentEdit(v, v.length, v.length, false) === null);
check('Tab pe listă de bifat: sub-element', run('☐ a', m.indentEdit('☐ a', 2, 2, false)) === '    ☐ a');
// Sub-elemente în listele de bifat.
const S = J('☐ mâncare', '    ☐ pâine', '    ☑ lapte', '☑ curățenie', '    ☐ baie', '☐ facturi');
check('sub-elemente: progresul le numără', JSON.stringify(m.progress(S)) === JSON.stringify({ done: 2, total: 6 }));
check('sub-elemente: bifatele jos pe fiecare nivel, cu copiii lor', run(S, m.checkedEdit(S, 'bottom')) === J('☐ mâncare', '    ☐ pâine', '    ☑ lapte', '☐ facturi', '☑ curățenie', '    ☐ baie'), JSON.stringify(run(S, m.checkedEdit(S, 'bottom'))));
check('sub-elemente: Șterge bifatele ia și copiii', run(S, m.checkedEdit(S, 'remove')) === J('☐ mâncare', '    ☐ pâine', '☐ facturi'), JSON.stringify(run(S, m.checkedEdit(S, 'remove'))));
check('sub-elemente: Debifează tot', !run(S, m.checkedEdit(S, 'uncheck')).includes('☑'));
const sv = J('☐ a', '    ☐ b');
check('sub-elemente: Enter continuă la același nivel', run(sv, m.enterEdit(sv, sv.length)) === J('☐ a', '    ☐ b', '    ☐ '));
const se = J('☐ a', '    ☐ ');
check('sub-elemente: Enter pe unul gol urcă un nivel', run(se, m.enterEdit(se, se.length)) === J('☐ a', '☐ '), JSON.stringify(run(se, m.enterEdit(se, se.length))));
check('sub-elemente → Markdown: sub-listă de bifat', m.noteToMarkdown({ title: '', body: J('☐ a', '    ☑ b'), updated: '' }).includes(J('- [ ] a', '    - [x] b')));

// Data și ora (📅 Dată, Alt+Shift+D / T).
const d = new Date(2026, 0, 5, 9, 7);
check('data și ora ca în România', m.dateStamp(d, 'date') === '05.01.2026' && m.dateStamp(d, 'time') === '09:07' && m.dateStamp(d, 'both') === '05.01.2026, 09:07');

// Export.
const note = { id: 'n1', title: 'Cumpărături', body: '• lapte\n    • degresat\n1. unu\n2. doi\ntext', created: '', updated: '2026-10-18T10:00:00Z' };
const md = m.noteToMarkdown(note);
check('Markdown: bulinele devin „- ”, sub-lista păstrează spațiile', md.includes('\n- lapte\n    - degresat\n1. unu\n'), JSON.stringify(md));
const doc = JSON.parse(m.noteToDoc(note)).content.content;
const types = doc.map((x) => x.type).join(',');
check('Docs: listă cu buline + listă numerotată + paragraf', types === 'heading,bulletList,orderedList,paragraph', types);
check('Docs: lista cu buline are 2 elemente', doc[1].content.length === 2 && doc[1].content[1].content[0].content[0].text === 'degresat');
check('Docs: lista numerotată pornește de la 1', doc[2].attrs.start === 1 && doc[2].content.length === 2);

// Comenzile pentru bifate (ca în Keep).

const L = J('☐ a', '☑ b', '☐ c', '☑ d', 'text', '☑ e', '☐ f');
check('bifate jos: în fiecare grup, bifatele la sfârșit', run(L, m.checkedEdit(L, 'bottom')) === J('☐ a', '☐ c', '☑ b', '☑ d', 'text', '☐ f', '☑ e'), JSON.stringify(run(L, m.checkedEdit(L, 'bottom'))));
check('debifează tot', run(L, m.checkedEdit(L, 'uncheck')) === J('☐ a', '☐ b', '☐ c', '☐ d', 'text', '☐ e', '☐ f'));
check('șterge bifatele', run(L, m.checkedEdit(L, 'remove')) === J('☐ a', '☐ c', 'text', '☐ f'));
check('nimic de schimbat: null', m.checkedEdit(J('☐ a', '☐ b', '☑ c'), 'bottom') === null && m.checkedEdit('x', 'remove') === null);
const ed = m.checkedEdit(L, 'uncheck');
check('se schimbă doar bucata diferită', ed.from === 4 && ed.to < L.length, JSON.stringify(ed));

// Semnele pe rând (⭐ Important…).
const mv = J('ofertă', '    preț', '');
check('semn pe rând: se pune după spațiile din față', run(mv, m.markEdit(mv, 0, 12, '⭐')) === J('⭐ ofertă', '    ⭐ preț', ''), JSON.stringify(run(mv, m.markEdit(mv, 0, 12, '⭐'))));
const mv2 = run(mv, m.markEdit(mv, 0, 12, '⭐'));
check('semn pe rând: din nou îl scoate', run(mv2, m.markEdit(mv2, 0, 15, '⭐')) === mv);

// Alt+↑/↓: mutarea rândurilor, cu sub-elementele lor.
{
  const ap = (v, e) => (e ? v.slice(0, e.from) + e.text + v.slice(e.to) : null);
  const T = J('☐ a', '☐ b', '    ☐ b1', '    ☐ b2', '☐ c');
  const at = (v, line) => v.split(String.fromCharCode(10)).slice(0, line).join(String.fromCharCode(10)).length + (line ? 1 : 0);
  const up = m.moveLinesEdit(T, at(T, 4) + 2, at(T, 4) + 2, -1);
  check('mută sus: c sare peste b cu tot cu sub-elementele lui', ap(T, up) === J('☐ a', '☐ c', '☐ b', '    ☐ b1', '    ☐ b2'), JSON.stringify(ap(T, up)));
  check('mută sus: cursorul rămâne pe c', up && ap(T, up).slice(up.caret - 2, up.caret + 1) === '☐ c', String(up?.caret));
  const down = m.moveLinesEdit(T, at(T, 1) + 1, at(T, 1) + 1, 1);
  check('mută jos: b se mută cu sub-elementele lui după c', ap(T, down) === J('☐ a', '☐ c', '☐ b', '    ☐ b1', '    ☐ b2'), JSON.stringify(ap(T, down)));
  const sub = m.moveLinesEdit(T, at(T, 3) + 5, at(T, 3) + 5, -1);
  check('sub-element: b2 urcă peste b1', ap(T, sub) === J('☐ a', '☐ b', '    ☐ b2', '    ☐ b1', '☐ c'), JSON.stringify(ap(T, sub)));
  check('primul rând nu urcă, ultimul nu coboară', m.moveLinesEdit(T, 0, 0, -1) === null && m.moveLinesEdit(T, T.length, T.length, 1) === null);
  const P = J('unu', 'doi', 'trei');
  const sel = m.moveLinesEdit(P, 0, at(P, 1) + 2, 1);
  check('text simplu: două rânduri selectate coboară împreună', ap(P, sel) === J('trei', 'unu', 'doi'), JSON.stringify(ap(P, sel)));
}

// Tragerea unui element de bifat de căsuța lui (moveItemEdit), cu sub-elementele lui.
{
  const ap = (v, e) => (e ? v.slice(0, e.from) + e.text + v.slice(e.to) : null);
  const T = J('☐ a', '☐ b', '    ☐ b1', '    ☐ b2', '☐ c', 'gata');
  const at = (v, line) => v.split(String.fromCharCode(10)).slice(0, line).join(String.fromCharCode(10)).length + (line ? 1 : 0);
  check('boxAt: înainte și după căsuță, nu în text', m.boxAt(T, at(T, 2) + 4) === at(T, 2) + 4 && m.boxAt(T, at(T, 2) + 5) === at(T, 2) + 4 && m.boxAt(T, at(T, 2) + 7) === -1 && m.boxAt(T, at(T, 5)) === -1);
  const down = m.moveItemEdit(T, at(T, 1), at(T, 4) + 1);
  check('trage b jos pe c: b ajunge după c, cu b1 și b2', ap(T, down) === J('☐ a', '☐ c', '☐ b', '    ☐ b1', '    ☐ b2', 'gata'), JSON.stringify(ap(T, down)));
  check('trage b jos: cursorul la capătul lui b', down && ap(T, down).slice(down.caret - 3, down.caret) === '☐ b', String(down?.caret));
  const up = m.moveItemEdit(T, at(T, 4), at(T, 0) + 2);
  check('trage c sus pe a: c ajunge primul', ap(T, up) === J('☐ c', '☐ a', '☐ b', '    ☐ b1', '    ☐ b2', 'gata'), JSON.stringify(ap(T, up)));
  check('trage c sus: cursorul la capătul lui c', up && ap(T, up).slice(up.caret - 3, up.caret) === '☐ c', String(up?.caret));
  const onKid = m.moveItemEdit(T, at(T, 0), at(T, 2) + 6);
  check('trage a jos pe b1: a ajunge după b1, înaintea lui b2', ap(T, onKid) === J('☐ b', '    ☐ b1', '☐ a', '    ☐ b2', '☐ c', 'gata'), JSON.stringify(ap(T, onKid)));
  const onB = m.moveItemEdit(T, at(T, 0), at(T, 1) + 1);
  check('trage a jos pe b (cu sub-elemente): a ajunge după b2', ap(T, onB) === J('☐ b', '    ☐ b1', '    ☐ b2', '☐ a', '☐ c', 'gata'), JSON.stringify(ap(T, onB)));
  check('pe el însuși sau pe sub-elementele lui: nimic', m.moveItemEdit(T, at(T, 1), at(T, 1) + 2) === null && m.moveItemEdit(T, at(T, 1), at(T, 3) + 3) === null);
  check('de pe un rând fără căsuță: nimic', m.moveItemEdit(T, at(T, 5), at(T, 0)) === null);
  const last = m.moveItemEdit(T, at(T, 0), T.length);
  check('trage pe ultimul rând: ajunge la sfârșit', ap(T, last) === J('☐ b', '    ☐ b1', '    ☐ b2', '☐ c', 'gata', '☐ a'), JSON.stringify(ap(T, last)));
}

// Paragrafele retrase cu Tab: în Docs devin retrageri adevărate, în Markdown nu devin bloc de cod.
{
  const ni = { title: 'R', body: 'unu\n    doi\n        trei', updated: '' };
  const dc = JSON.parse(m.noteToDoc(ni)).content.content;
  const ps = dc.filter((x) => x.type === 'paragraph');
  check('→ Docs: retragerea 1 și 2, fără spațiile din față', ps[1]?.attrs?.indent === 1 && ps[2]?.attrs?.indent === 2 && ps[2].content[0].text === 'trei' && !ps[0].attrs?.indent, JSON.stringify(ps));
  const mdi = m.noteToMarkdown(ni);
  check('→ Markdown: spații care nu se pierd, nu bloc de cod', mdi.includes(String.fromCharCode(160).repeat(4) + 'doi') && !mdi.includes('\n    doi'));
}
console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
