// Test: Docs → împarte celula în 2 coloane / 2 rânduri: celula nouă vine alături, celelalte se lățesc, tabelul rămâne drept.
// Rulare (în suite/): node tests/docs-table-split.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-tblsplit-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-tblsplit-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export * from ${src('src/docs/tableOps.ts')};
export { getSchema } from '@tiptap/core';
export { default as StarterKit } from '@tiptap/starter-kit';
export { default as Table } from '@tiptap/extension-table';
export { default as TableRow } from '@tiptap/extension-table-row';
export { default as TableCell } from '@tiptap/extension-table-cell';
export { default as TableHeader } from '@tiptap/extension-table-header';
export { EditorState, TextSelection } from '@tiptap/pm/state';
export { TableMap } from '@tiptap/pm/tables';
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


/** Tabelul ca text: fiecare rând cu celulele lui, scrise text[colspan x rowspan]. */
const shape = (st) => { const rows = []; st.doc.descendants((n) => { if (n.type.name === 'tableRow') { rows.push(Array.from({ length: n.childCount }, (_, i) => { const c = n.child(i); return c.textContent + (c.attrs.colspan > 1 || c.attrs.rowspan > 1 ? '[' + c.attrs.colspan + 'x' + c.attrs.rowspan + ']' : ''); }).join('|')); return false; } return true; }); return rows; };
const width = (st) => { let w = null; st.doc.descendants((n) => { if (n.type.name === 'table') { w = M.TableMap.get(n); return false; } return true; }); return w && [w.width, w.height, w.problems ? 'probleme' : 'ok']; };

const d = docOf([['A', 'B', 'C'], ['D', 'E', 'F']]);
let r = run(M.splitCellInto('cols'), stateAt(d, 0, 1));
check('în 2 coloane: celula nouă la dreapta, cele de sub ea lățite', shape(r.st), ['A|B||C', 'D|E[2x1]|F']);
check('în 2 coloane: tabelul are 4 coloane și e drept', width(r.st), [4, 2, 'ok']);
r = run(M.splitCellInto('rows'), stateAt(d, 1, 0));
check('în 2 rânduri: rândul nou dedesubt, vecinii coboară peste el', shape(r.st), ['A|B|C', 'D|E[1x2]|F[1x2]', '']);
check('în 2 rânduri: 3 rânduri, drept', width(r.st), [3, 3, 'ok']);
// De două ori pe aceeași celulă, apoi pe celula nouă.
let s = run(M.splitCellInto('cols'), stateAt(d, 0, 0)).st;
s = run(M.splitCellInto('rows'), stateAt(s.doc, 0, 0)).st;
check('coloane apoi rânduri', shape(s), ['A|[1x2]|B[1x2]|C[1x2]', '', 'D[2x1]|E|F']);
check('coloane apoi rânduri: drept', width(s), [4, 3, 'ok']);
// Cu lățimi trase cu mausul: lățimea se împarte în două.
const dw = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: [
  { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colwidth: [200] }, content: [{ type: 'paragraph' }] }, { type: 'tableCell', attrs: { colwidth: [100] }, content: [{ type: 'paragraph' }] }] },
  { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colwidth: [200] }, content: [{ type: 'paragraph' }] }, { type: 'tableCell', attrs: { colwidth: [100] }, content: [{ type: 'paragraph' }] }] }] }] });
const cw = run(M.splitCellInto('cols'), M.EditorState.create({ doc: dw, selection: M.TextSelection.create(dw, 4) })).st;
const widths = []; cw.doc.descendants((n) => { if (n.type.name === 'tableCell') { widths.push(n.attrs.colwidth); return false; } return true; });
check('lățimile: 200 → 100 + 100', widths, [[100], [100], [100], [100, 100], [100]]);
// O celulă unită pe orizontală nu se împarte în coloane (pentru ea e „desparte”).
const dm = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: [
  { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 2 }, content: [{ type: 'paragraph' }] }] },
  { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }, { type: 'tableCell', content: [{ type: 'paragraph' }] }] }] }] });
const st0 = M.EditorState.create({ doc: dm, selection: M.TextSelection.create(dm, 4) });
check('celula unită: nu în coloane', run(M.splitCellInto('cols'), st0).ok, false);
const rr = run(M.splitCellInto('rows'), st0);
check('celula unită pe orizontală: în rânduri da', [rr.ok, shape(rr.st), width(rr.st)], [true, ['[2x1]', '[2x1]', '|'], [2, 3, 'ok']]);
check('cursor în afara tabelului: nimic', run(M.splitCellInto('cols'), M.EditorState.create({ doc: d, selection: M.TextSelection.create(d, 2) })).ok, false);

console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
