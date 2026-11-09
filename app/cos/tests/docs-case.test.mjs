// Test pentru „Schimbă literele” din Docs (Aa▾, Shift+F3 ca în Word): formatarea rămâne pe aceleași litere,
// mai multe paragrafe, cuvântul de la cursor, ciclul Shift+F3 și inversarea literelor.
// Rulare (în suite/): node tests/docs-case.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-docscase-${process.pid}.mjs`);
await build({
  stdin: { contents: `export * from './src/docs/changeCase.ts'; export * from './src/textCase.ts'; export { getSchema } from '@tiptap/core';
export { default as StarterKit } from '@tiptap/starter-kit'; export { EditorState, TextSelection } from '@tiptap/pm/state';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { changeCaseTr, changeCase, nextCase, getSchema, StarterKit, EditorState, TextSelection } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, got, want) => { const ok = got === want; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`}`); if (!ok) fail++; };

check('inversare', changeCase('Ședința ABC', 'toggle'), 'șEDINȚA abc');
check('ß rămâne (aceeași lungime)', changeCase('straße', 'upper'), 'STRAßE');
check('Shift+F3 din litere mici, fără punct → Fiecare Cuvânt', nextCase('raport anual'), 'title');
check('Shift+F3 din litere mici, frază întreagă → Propoziție', nextCase('raport anual.'), 'sentence');
check('Shift+F3 din Fiecare Cuvânt → MAJUSCULE', nextCase('Raport Anual'), 'upper');
check('Shift+F3 din MAJUSCULE → litere mici', nextCase('RAPORT ANUAL'), 'lower');

const schema = getSchema([StarterKit]);
const mk = () => schema.nodeFromJSON({ type: 'doc', content: [
  { type: 'paragraph', content: [
    { type: 'text', text: 'ședința ' },
    { type: 'text', text: 'anuală', marks: [{ type: 'bold' }] },
    { type: 'text', text: ' a început. raport' },
  ] },
  { type: 'paragraph', content: [{ type: 'text', text: 'țintele noi' }] },
] });
const run = (sel, c) => {
  const doc = mk();
  const st = EditorState.create({ doc, selection: sel(doc) });
  const tr = st.tr;
  const ok = changeCaseTr(tr, c);
  return { ok, st: st.apply(tr) };
};
const all = (doc) => TextSelection.create(doc, 1, doc.content.size - 1);
const text = (doc) => doc.textBetween(0, doc.content.size, '|');
const bold = (doc) => { let b = ''; doc.descendants((n) => { if (n.isText && n.marks.some((m) => m.type.name === 'bold')) b += n.text; }); return b; };

let r = run(all, 'upper');
check('MAJUSCULE pe două paragrafe', text(r.st.doc), 'ȘEDINȚA ANUALĂ A ÎNCEPUT. RAPORT|ȚINTELE NOI');
check('aldinul rămâne pe „ANUALĂ”', bold(r.st.doc), 'ANUALĂ');
check('selecția rămâne aceeași', `${r.st.selection.from}-${r.st.selection.to}`, `1-${r.st.doc.content.size - 1}`);
r = run(all, 'sentence');
check('Propoziție: fiecare frază și paragraf', text(r.st.doc), 'Ședința anuală a început. Raport|Țintele noi');
r = run(all, 'title');
check('Fiecare Cuvânt', text(r.st.doc), 'Ședința Anuală A Început. Raport|Țintele Noi');
check('aldinul rămâne și aici', bold(r.st.doc), 'Anuală');
// Fără selecție: doar cuvântul de la cursor (în „anuală”, poziția 11), cursorul nu se mută.
r = run((doc) => TextSelection.create(doc, 11), 'upper');
check('fără selecție: cuvântul de la cursor', text(r.st.doc), 'ședința ANUALĂ a început. raport|țintele noi');
check('cursorul rămâne pe loc', `${r.st.selection.from}-${r.st.selection.to}`, '11-11');
r = run((doc) => TextSelection.create(doc, 9), undefined);
check('Shift+F3 pe cuvânt cu litere mici → Fiecare Cuvânt', text(r.st.doc), 'ședința Anuală a început. raport|țintele noi');
r = run((doc) => TextSelection.create(doc, 1, 3), 'toggle');
check('inversare pe o bucată', text(r.st.doc), 'ȘEdința anuală a început. raport|țintele noi');

console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
