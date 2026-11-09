// Test pentru AutoCorect din Docs: ghilimele „”, simboluri, ș/ț, DOuă MAjuscule, prima literă din propoziție, lista de înlocuiri,
// plus în editor: corectura e un pas separat de anulare și Backspace imediat după o anulează.
// Rulare (în suite/): node tests/docs-autocorrect.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-docsac-${process.pid}.mjs`);
await build({
  stdin: { contents: `export * from './src/docs/autoCorrect.ts';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { autoCorrect, linkBefore, DEFAULT_OPTIONS } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, got, want) => { const ok = got === want; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`}`); if (!ok) fail++; };

/** Scrie textul literă cu literă, cu AutoCorect, și întoarce ce rămâne în paragraf. */
const type = (text, o = DEFAULT_OPTIONS) => {
  let s = '';
  for (const ch of text) {
    const fix = autoCorrect(s, ch, o);
    s += ch;
    if (fix) s = s.slice(0, s.length - fix.del) + fix.text;
  }
  return s;
};

check('ghilimele românești', type('A spus "da" azi.'), 'A spus „da” azi.');
check('ghilimele la început și după paranteză', type('"Bine" ("ok")'), '„Bine” („ok”)');
check('apostrof', type("Rock'n'roll"), 'Rock’n’roll');
check('liniuță de pauză', type('Unu -- doi'), 'Unu – doi');
check('linie lungă', type('Unu --- doi'), 'Unu — doi');
check('puncte de suspensie', type('Deci...'), 'Deci…');
check('simboluri', type('(c) 2026 (tm) 5(e) a->b'), '© 2026 ™ 5€ a→b');
check('ş/ţ cu sedilă', type('Ştiinţă'), 'Știință');
check('fracții', type('1/2 kg, 3/4 din ei și 1/4.'), '½ kg, ¾ din ei și ¼.');
check('fracții: nu în date sau numere mai lungi', type('11/2 și 2/4 și 21/12/2026 '), '11/2 și 2/4 și 21/12/2026 ');
check('fracții oprite', type('1/2 ', { ...DEFAULT_OPTIONS, fractions: false }), '1/2 ');
const L = (t) => JSON.stringify(linkBefore(t));
check('legătură https', L('Vezi https://exemplu.ro/pagina'), JSON.stringify({ start: 5, end: 30, href: 'https://exemplu.ro/pagina' }));
check('legătură www, fără punctul de după', L('Pe www.firma.ro.'), JSON.stringify({ start: 3, end: 15, href: 'https://www.firma.ro' }));
check('legătură e-mail în paranteză', L('(ion@firma.ro)'), JSON.stringify({ start: 1, end: 13, href: 'mailto:ion@firma.ro' }));
check('fără legătură pentru un cuvânt obișnuit', L('exemplu.ro'), 'null');
check('fără legătură pentru o cale de fișier', L('C:/acte/x.pdf'), 'null');
check('DOuă MAjuscule', type('DOcument nou'), 'Document nou');
check('acronimele rămân', type('Raport ANAF și UE.'), 'Raport ANAF și UE.');
check('prima literă din propoziție', type('azi plouă. mâine nu! poate? da.'), 'Azi plouă. Mâine nu! Poate? Da.');
check('după prescurtări nu', type('Vezi nr. unu și ex. doi.'), 'Vezi nr. unu și ex. doi.');
check('după inițiale nu', type('Dl. I. popescu'), 'Dl. I. popescu');
check('lista de înlocuiri', type('Multumesc, ne vedem maine dupa ora 5.'), 'Mulțumesc, ne vedem mâine după ora 5.');
check('lista păstrează majusculele', type('DUPA asta'), 'DUPĂ asta');
check('cu cratimă', type('Am fost intr-un loc'), 'Am fost într-un loc');
check('adrese și numere neatinse', type('Scrie la www.exemplu.ro sau ion@mail.ro azi'), 'Scrie la www.exemplu.ro sau ion@mail.ro azi');
check('totul oprit', type('azi "da" -- dupa', { ...DEFAULT_OPTIONS, quotes: false, symbols: false, sentence: false, replace: false }), 'azi "da" -- dupa');
check('înlocuire proprie', type('Ss mulțumim', { ...DEFAULT_OPTIONS, list: [['ss', 'Societatea Suite']] }), 'Societatea Suite mulțumim');

// În editor: corectura se anulează separat (Ctrl+Z) și cu Backspace.
const out2 = join(tmpdir(), `suite-docsac2-${process.pid}.mjs`);
await build({
  stdin: { contents: `export { AutoCorrect } from './src/docs/autoCorrect.ts'; export { getSchema } from '@tiptap/core';
export { default as StarterKit } from '@tiptap/starter-kit'; export { EditorState, TextSelection } from '@tiptap/pm/state';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out2, logLevel: 'error',
});
const m = await import(pathToFileURL(out2).href);
rmSync(out2, { force: true });
globalThis.localStorage = { getItem: () => null, setItem() {} };
// Fără DOM nu se poate crea un Editor: pluginul se testează pe o vedere minimă.
const ext = m.AutoCorrect;
const schema = m.getSchema([m.StarterKit, ext]);
// Pluginurile extensiei: le luăm prin addProseMirrorPlugins, cu un context minim.
const plugins = ext.config.addProseMirrorPlugins.call({ editor: null, options: {} });
let state = m.EditorState.create({ schema, doc: schema.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph' }] }), plugins: [...plugins] });
const view = {
  composing: false,
  get state() { return state; },
  dispatch(tr) { state = state.apply(tr); },
};
const typeIn = (text) => {
  for (const ch of text) {
    const pos = state.selection.from;
    const handled = plugins[0].props.handleTextInput(view, pos, pos, ch);
    if (!handled) view.dispatch(state.tr.insertText(ch, pos, pos));
  }
};
typeIn('dupa ');
check('în editor: corectat', state.doc.textContent, 'După ');
const bs = ext.config.addKeyboardShortcuts.call({ editor: { get state() { return state; }, view } }).Backspace;
bs({ editor: { get state() { return state; }, view } });
check('Backspace după corectură o anulează', state.doc.textContent, 'dupa ');
typeIn('x');
check('apoi scrii mai departe normal', state.doc.textContent, 'dupa x');

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
