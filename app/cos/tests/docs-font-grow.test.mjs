// Test pentru „Mărește / Micșorează fontul” din Docs (ca A⁺ / A⁻ din Word): lista de mărimi, pașii de 1 punct
// și selecțiile cu mărimi diferite (fiecare bucată crește de la mărimea ei, celelalte atribute rămân).
// Rulare (în suite/): node tests/docs-font-grow.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-fontgrow-${process.pid}.mjs`);
await build({
  stdin: { contents: `export * from './src/docs/fontSize.ts'; export { getSchema } from '@tiptap/core'; export { default as StarterKit } from '@tiptap/starter-kit';
export { TextStyle } from '@tiptap/extension-text-style'; export { Color } from '@tiptap/extension-color'; export { EditorState, TextSelection } from '@tiptap/pm/state';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { Color, nextFontSize, growFontTr, FontSize, getSchema, StarterKit, TextStyle, EditorState, TextSelection } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}`); if (!ok) fail++; };

// Lista Word: 8 9 10 11 12 14 16 18 20 22 24 26 28 36 48 72, apoi din 10 în 10.
check('11 → 12', nextFontSize(11, 1) === 12);
check('12 → 14', nextFontSize(12, 1) === 14);
check('28 → 36', nextFontSize(28, 1) === 36);
check('72 → 80', nextFontSize(72, 1) === 80);
check('80 → 72', nextFontSize(80, -1) === 72);
check('90 → 80', nextFontSize(90, -1) === 80);
check('11,25 (implicit) → 12 / 11', nextFontSize(11.25, 1) === 12 && nextFontSize(11.25, -1) === 11);
check('13 (nestandard) → 14 / 12', nextFontSize(13, 1) === 14 && nextFontSize(13, -1) === 12);
check('8 → 7 → 6 (sub listă câte 1)', nextFontSize(8, -1) === 7 && nextFontSize(7, -1) === 6);
check('nu sub 1 punct', nextFontSize(1, -1) === 1 && nextFontSize(1, -1, true) === 1);
check('nu peste 1638', nextFontSize(1638, 1) === 1638);
check('câte 1 punct: 11 → 12, 12 → 11', nextFontSize(11, 1, true) === 12 && nextFontSize(12, -1, true) === 11);

const schema = getSchema([StarterKit, TextStyle, Color, FontSize]);
const doc = schema.nodeFromJSON({ type: 'doc', content: [
  { type: 'paragraph', content: [
    { type: 'text', text: 'mic ' },
    { type: 'text', text: 'roșu', marks: [{ type: 'textStyle', attrs: { fontSize: '20pt', color: '#ff0000' } }] },
  ] },
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Titlu' }] },
] });
const sizes = (d) => { const r = []; d.descendants((n) => { if (n.isText) { const m = n.marks.find((x) => x.type.name === 'textStyle'); r.push([n.text, m?.attrs.fontSize ?? null, m?.attrs.color ?? null]); } }); return r; };

let st = EditorState.create({ doc, selection: TextSelection.create(doc, 1, doc.content.size - 1) });
const grow = (s, d, f) => { const tr = s.tr; growFontTr(tr, d, f); return s.apply(tr); };
st = grow(st, 1);
const s1 = sizes(st.doc);
check('textul fără mărime: 11 → 12', s1[0][1] === '12pt');
check('textul de 20: → 22, culoarea rămâne', s1[1][1] === '22pt' && s1[1][2] === '#ff0000');
check('titlul 1 (21 pt): → 22', s1[2][1] === '22pt');
st = grow(st, -1, true);
const s2 = sizes(st.doc);
check('Ctrl+[ după aceea: 12 → 11, 22 → 21', s2[0][1] === '11pt' && s2[1][1] === '21pt' && s2[2][1] === '21pt');

// Fără selecție: mărimea se aplică textului scris de acum.
let e = EditorState.create({ doc, selection: TextSelection.create(doc, 3) });
const tr = e.tr; growFontTr(tr, 1);
const stored = tr.storedMarks?.find((m) => m.type.name === 'textStyle');
check('fără selecție: următorul text va fi de 12', stored?.attrs.fontSize === '12pt');

console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
