// Test pentru „Sortează” din Docs: paragrafe și liste, ordinea românească (ă, ș), numerele, rândurile goale, Z→A.
// Rulare (în suite/): node tests/docs-sort.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-docsort-${process.pid}.mjs`);
await build({
  stdin: { contents: `export * from './src/docs/sortParagraphs.ts'; export { getSchema } from '@tiptap/core';
export { default as StarterKit } from '@tiptap/starter-kit'; export { EditorState, TextSelection } from '@tiptap/pm/state';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { sortTr, getSchema, StarterKit, EditorState, TextSelection } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); const ok = g === w; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${g} (trebuia ${w})`}`); if (!ok) fail++; };
const schema = getSchema([StarterKit]);
const P = (t) => ({ type: 'paragraph', content: t ? [{ type: 'text', text: t }] : [] });
const texts = (doc) => { const r = []; doc.descendants((n) => { if (n.type.name === 'paragraph') { r.push(n.textContent); return false; } }); return r; };
const run = (json, sel, desc) => {
  const doc = schema.nodeFromJSON({ type: 'doc', content: json });
  const st = EditorState.create({ doc, selection: sel(doc) });
  const tr = st.tr;
  const ok = sortTr(tr, desc);
  return { ok, doc: st.apply(tr).doc };
};
const all = (d) => TextSelection.create(d, 1, d.content.size - 1);

let r = run([P('Ștefan'), P('Ana'), P(''), P('Ăla'), P('Sorin'), P('Bogdan')], all);
check('A→Z în română, goale la sfârșit', texts(r.doc), ['Ana', 'Ăla', 'Bogdan', 'Sorin', 'Ștefan', '']);
r = run([P('Ana'), P('Bogdan'), P('Ștefan')], all, true);
check('Z→A', texts(r.doc), ['Ștefan', 'Bogdan', 'Ana']);
r = run([P('Punct 10'), P('Punct 2'), P('Punct 1')], all);
check('numerele în ordinea lor', texts(r.doc), ['Punct 1', 'Punct 2', 'Punct 10']);
// Doar paragrafele atinse de selecție (al 2-lea și al 3-lea).
r = run([P('z'), P('c'), P('b'), P('a')], (d) => TextSelection.create(d, 4, 7));
check('doar cele selectate', texts(r.doc), ['z', 'b', 'c', 'a']);
// Lista: elementele se sortează în listă.
const LI = (t) => ({ type: 'listItem', content: [P(t)] });
r = run([{ type: 'bulletList', content: [LI('pere'), LI('mere'), LI('caise')] }], (d) => TextSelection.create(d, 3, d.content.size - 3));
check('elementele listei', texts(r.doc), ['caise', 'mere', 'pere']);
check('lista rămâne listă', r.doc.firstChild.type.name, 'bulletList');
r = run([P('doar unul')], all);
check('un singur paragraf: nimic', r.ok, false);
console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
