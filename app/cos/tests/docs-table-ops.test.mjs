// Test: operațiile pe tabel din Docs: sortarea după coloana cursorului, împărțirea tabelului și tabel → text.
// Rulare (în suite/): node tests/docs-table-ops.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-tblops-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-tblops-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export * from ${src('src/docs/tableOps.ts')};
export { getSchema } from '@tiptap/core';
export { default as StarterKit } from '@tiptap/starter-kit';
export { default as Table } from '@tiptap/extension-table';
export { default as TableRow } from '@tiptap/extension-table-row';
export { default as TableCell } from '@tiptap/extension-table-cell';
export { default as TableHeader } from '@tiptap/extension-table-header';
export { EditorState, TextSelection } from '@tiptap/pm/state';
`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', nodePaths: [join(process.cwd(), 'node_modules')] });
const M = await import(pathToFileURL(out).href);
rmSync(entry, { force: true });

let fail = 0;
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); const ok = g === w; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${g} (trebuia ${w})`}`); if (!ok) fail++; };
const schema = M.getSchema([M.StarterKit, M.Table, M.TableRow, M.TableCell, M.TableHeader]);
const cell = (t, head) => ({ type: head ? 'tableHeader' : 'tableCell', content: [{ type: 'paragraph', content: t ? [{ type: 'text', text: t }] : [] }] });
const table = (rows, head) => ({ type: 'table', content: rows.map((r, i) => ({ type: 'tableRow', content: r.map((t) => cell(t, head && i === 0)) })) });
const docOf = (rows, head) => schema.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sus' }] }, table(rows, head)] });
/** Starea cu cursorul în celula (rând r, coloana c). */
const stateAt = (doc, r, c) => {
  let pos = -1, seen = 0;
  doc.descendants((n, p) => { if (pos >= 0) return false; if (n.type.name === 'tableRow') { if (seen++ === r) { let x = p + 1; for (let i = 0; i < c; i++) x += n.child(i).nodeSize; pos = x + 2; } return false; } return true; });
  return M.EditorState.create({ doc, selection: M.TextSelection.create(doc, pos) });
};
const run = (cmd, st) => { let next = st; const ok = cmd(st, (tr) => { next = st.apply(tr); }); return { ok, st: next }; };
const grid = (st) => { const rows = []; st.doc.descendants((n) => { if (n.type.name === 'tableRow') { rows.push(Array.from({ length: n.childCount }, (_, i) => n.child(i).textContent)); return false; } return true; }); return rows; };

check('număr românesc 1.250,50', M.sortNumber('1.250,50 lei'), 1250.5);
check('număr 2.000', M.sortNumber('2.000'), 2000);
check('număr 3,5', M.sortNumber('3,5'), 3.5);
check('text nu e număr', M.sortNumber('Ana'), null);
check('ș după s', ['Șt', 'Sa', 'Ta'].sort(M.compareCells), ['Sa', 'Șt', 'Ta']);

const rows = [['Nume', 'Suma', 'Data'], ['Ion', '1.250,50', '02.03.2025'], ['Ana', '99', '15.11.2024'], ['Ștefan', '', '01.01.2026'], ['Bogdan', '1.000', '15.11.2023']];
// Cu antet (celule de antet): rămâne sus.
let r = run(M.sortTable(1), stateAt(docOf(rows, true), 1, 0));
check('A→Z după nume, antetul sus', grid(r.st).map((x) => x[0]), ['Nume', 'Ana', 'Bogdan', 'Ion', 'Ștefan']);
r = run(M.sortTable(1), stateAt(docOf(rows, true), 2, 1));
check('crescător după sumă (numere), golul la final', grid(r.st).map((x) => x[1]), ['Suma', '99', '1.000', '1.250,50', '']);
r = run(M.sortTable(-1), stateAt(docOf(rows, true), 2, 1));
check('descrescător după sumă, golul tot la final', grid(r.st).map((x) => x[1]), ['Suma', '1.250,50', '1.000', '99', '']);
r = run(M.sortTable(1), stateAt(docOf(rows, true), 1, 2));
check('crescător după dată', grid(r.st).map((x) => x[0]), ['Nume', 'Bogdan', 'Ana', 'Ion', 'Ștefan']);
// Fără celule de antet: primul rând se sortează și el, dacă nu ceri să rămână sus.
r = run(M.sortTable(1), stateAt(docOf(rows, false), 1, 0));
check('fără antet: și primul rând se sortează', grid(r.st)[0][0], 'Ana');
r = run(M.sortTable(1, true), stateAt(docOf(rows, false), 1, 0));
check('fără antet, „primul rând rămâne sus”', grid(r.st).map((x) => x[0]), ['Nume', 'Ana', 'Bogdan', 'Ion', 'Ștefan']);
check('în afara tabelului nu face nimic', M.sortTable(1)(M.EditorState.create({ doc: docOf(rows, true) }), () => {}), false);

// Împărțirea: deasupra rândului 3.
r = run(M.splitTable, stateAt(docOf(rows, true), 3, 0));
const kinds = []; r.st.doc.forEach((n) => kinds.push(n.type.name + (n.type.name === 'table' ? ':' + n.childCount : '')));
check('două tabele cu un paragraf între ele', kinds, ['paragraph', 'table:3', 'paragraph', 'table:2']);
check('pe primul rând nu se împarte', M.splitTable(stateAt(docOf(rows, true), 0, 0)), false);

// Tabel → text, cu tab între celule; formatul literelor rămâne.
const bold = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [
  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Aldin', marks: [{ type: 'bold' }] }] }] },
  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'unu' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'doi' }] }] }] }] }] });
r = run(M.tableToText, stateAt(bold, 0, 0));
const T = String.fromCharCode(9);
check('tabel → text', r.st.doc.firstChild.textContent, 'Aldin' + T + 'unu doi');
check('aldinul rămâne', r.st.doc.firstChild.firstChild.marks.map((m) => m.type.name), ['bold']);
r = run(M.tableToText, stateAt(docOf(rows, true), 2, 1));
check('un paragraf pe rând', r.st.doc.childCount, 6);

// În .docx, tab-ul devine w:tab (și se citește înapoi ca tab).
const { DOMParser } = await import('@xmldom/xmldom');
const JSZip = (await import('jszip')).default;
globalThis.DOMParser ??= DOMParser;
const outD = join(tmpdir(), `suite-tblops-docx-${process.pid}.mjs`);
await build({ stdin: { contents: "export { docToDocx } from './src/docs/docx.ts';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: outD, logLevel: 'error' });
const { docToDocx } = await import(pathToFileURL(outD).href);
rmSync(outD, { force: true });
const docxBytes = await docToDocx({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ana' + T + '99' + T + 'Iași' }] }] });
const dxml = await (await JSZip.loadAsync(docxBytes)).file('word/document.xml').async('string');
check('în .docx: două w:tab între celule', (dxml.match(/<w:tab\/>/g) ?? []).length, 2);
check('în .docx: fără tab în w:t', /<w:t[^>]*>[^<]*\t/.test(dxml), false);
rmSync(out, { force: true });
console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
