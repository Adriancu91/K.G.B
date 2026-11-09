// Test: macrocomenzile din Docs (Vizualizare → Macrocomenzi): pașii editorului ținuți față de cursorul de la pornire,
// rularea relativă (de la alt cursor) și absolută, oprirea la un pas care nu se potrivește, cleanDocMacros, scurtăturile.
// Rulare (în suite/): node tests/docs-macros.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';

const out = join(tmpdir(), `suite-docmacros-${process.pid}`);
mkdirSync(out, { recursive: true });
const entry = join(out, 'entry.ts');
const src = process.cwd().split(String.fromCharCode(92)).join('/');
writeFileSync(entry, `export * from '${src}/src/docs/macros.ts';
export { EditorState, TextSelection } from '@tiptap/pm/state';
export { schema } from '@tiptap/pm/schema-basic';
export { parseDoc, serializeDoc, NO_PAGE_SETUP } from '${src}/src/docs/format.ts';`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error', nodePaths: [join(process.cwd(), 'node_modules')] });
const M = await import(pathToFileURL(join(out, 'entry.js')).href);
rmSync(out, { recursive: true, force: true });
const { parseDoc, serializeDoc, NO_PAGE_SETUP, EditorState, TextSelection, schema, recordSteps, playSteps, endSelection, cleanDocMacros, docMacroForKey, docMacroNameError, macroChars, shiftStep } = M;

let fail = 0;
const eq = (name, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'GREȘIT'} ${name}${ok ? '' : `\n   am: ${JSON.stringify(a)}\n   vreau: ${JSON.stringify(b)}`}`);
};

const p = (t) => schema.node('paragraph', null, t ? [schema.text(t)] : []);
const mk = (...ps) => EditorState.create({ schema, doc: schema.node('doc', null, ps.map(p)) });
const texts = (st) => { const a = []; st.doc.forEach((n) => a.push(n.textContent)); return a; };

// Înregistrare: cursorul la capătul primului paragraf („abc”, poziția 4), scriem „ X”, îl facem aldin, Enter.
let st = mk('abc', 'def');
st = st.apply(st.tr.setSelection(TextSelection.create(st.doc, 4)));
const base = st.selection.from;
const steps = [];
let tr = st.tr.insertText(' X'); steps.push(...tr.steps); st = st.apply(tr);
tr = st.tr.addMark(4, 6, schema.marks.strong.create()); steps.push(...tr.steps); st = st.apply(tr);
tr = st.tr.split(6); steps.push(...tr.steps); st = st.apply(tr);
const rec = recordSteps(steps, base);
eq('pozițiile ținute față de cursor', rec.map((s) => [s.stepType, s.from, s.to]), [['replace', 0, 0], ['addMark', 0, 2], ['replace', 2, 2]]);
const m = { name: 'Semn', rel: true, steps: rec, end: [st.selection.anchor - base, st.selection.head - base] };
eq('macroChars', macroChars(m), 2);

// Rulare relativă la capătul lui „def” într-un document nou.
let s2 = mk('abc', 'def');
s2 = s2.apply(s2.tr.setSelection(TextSelection.create(s2.doc, 9)));
let t2 = s2.tr;
const r2 = playSteps(t2, schema, m, s2.selection.from);
eq('rulare relativă: toți pașii', r2, { done: 3 });
const s2b = s2.apply(t2);
eq('rulare relativă: textul', texts(s2b), ['abc', 'def X', '']);
let bold = false; s2b.doc.nodesBetween(0, s2b.doc.content.size, (n) => { if (n.isText && n.text === ' X' && n.marks.some((k) => k.type.name === 'strong')) bold = true; });
eq('rulare relativă: aldin pus pe „ X”', bold, true);
eq('cursorul după rulare', endSelection(m, 9, s2b.doc.content.size), [13, 13]);

// Absolut: aceleași locuri, oricare ar fi cursorul.
const abs = { ...m, rel: false, steps: recordSteps(steps, 0), end: undefined };
let s3 = mk('abc', 'def');
let t3 = s3.tr;
eq('rulare absolută', playSteps(t3, schema, abs, 99), { done: 3 });
eq('rulare absolută: textul', texts(s3.apply(t3)), ['abc X', '', 'def']);
eq('fără cursor ținut', endSelection(abs, 1, 10), null);

// Pas care nu se potrivește: în afara documentului → oprire, ce s-a pus rămâne.
let s4 = mk('ab');
let t4 = s4.tr;
const far = { name: 'x', rel: true, steps: [{ stepType: 'replace', from: 0, to: 0, slice: { content: [{ type: 'text', text: 'Q' }] } }, { stepType: 'replace', from: 50, to: 50, slice: { content: [{ type: 'text', text: 'Z' }] } }] };
eq('oprire la pasul 2', playSteps(t4, schema, far, 1), { done: 1, failed: 2 });
eq('primul pas a rămas', texts(s4.apply(t4)), ['Qab']);
eq('pas necunoscut → oprire', playSteps(mk('a').tr, schema, { name: 'y', rel: true, steps: [{ stepType: 'nuexista', from: 1 }] }, 1), { done: 0, failed: 1 });

eq('shiftStep mută doar pozițiile', shiftStep({ stepType: 'replaceAround', from: 1, to: 5, gapFrom: 2, gapTo: 4, insert: 1 }, 10), { stepType: 'replaceAround', from: 11, to: 15, gapFrom: 12, gapTo: 14, insert: 1 });

eq('cleanDocMacros', cleanDocMacros([{ name: ' A ', steps: [{ stepType: 'replace', from: 0, to: 0 }], key: 'J', end: [1, 2], rel: false }, { name: 'A', steps: [{ stepType: 'replace' }] }, { name: 'B', steps: [] }, 'x', { name: 'C', steps: [{ stepType: 'replace' }], key: 'J', note: '  n ' }]),
  [{ name: 'A', rel: false, steps: [{ stepType: 'replace', from: 0, to: 0 }], end: [1, 2], key: 'J' }, { name: 'C', rel: true, steps: [{ stepType: 'replace' }], note: 'n' }]);
eq('cleanDocMacros: nu e listă', cleanDocMacros({}), []);
eq('docMacroForKey', docMacroForKey([{ name: 'A', key: 'J', steps: [] }], 'KeyJ')?.name, 'A');
eq('docMacroForKey: altă tastă', docMacroForKey([{ name: 'A', key: 'J', steps: [] }], 'KeyK'), undefined);
eq('nume gol', docMacroNameError('  ', []), 'Scrie un nume pentru macrocomandă.');
eq('nume repetat', docMacroNameError('semn', [m]), 'Există deja o macrocomandă „semn”.');
eq('redenumire în același nume', docMacroNameError('Semn', [m], 0), '');

const saved = serializeDoc({ type: 'doc', content: [{ type: 'paragraph' }] }, { ...NO_PAGE_SETUP, macros: [m] });
eq('păstrată în fișier', parseDoc(saved).page?.macros?.map((x) => [x.name, x.steps.length, x.end]), [['Semn', 3, [4, 4]]]);
eq('fără macrocomenzi: fără page', JSON.parse(serializeDoc({ type: 'doc', content: [] }, NO_PAGE_SETUP)).page, undefined);

console.log(fail ? `\n${fail} GREȘITE` : '\nToate bune');
process.exit(fail ? 1 : 0);
