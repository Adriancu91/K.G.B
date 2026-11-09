// Test: bordurile puse pe celulele alese în Docs (cellLines.ts): Borduri ▾ pe o zonă de celule (jos, contur, interior, fără),
// pensula pentru borduri (latura de lângă clic), exportul .docx (w:tcBorders) și .odt (fo:border-*) și citirea .docx înapoi.
// Rulare (în suite/): node tests/docs-cell-lines.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';

globalThis.DOMParser ??= DOMParser;
{
  const d = new DOMParser().parseFromString('<a><b/></a>', 'text/xml');
  let p = Object.getPrototypeOf(d.documentElement);
  while (p && !Object.prototype.hasOwnProperty.call(p, 'appendChild')) p = Object.getPrototypeOf(p);
  if (!('children' in d.documentElement)) Object.defineProperty(p ?? Object.getPrototypeOf(d.documentElement), 'children', { get() { return Array.from(this.childNodes).filter((c) => c.nodeType === 1); }, configurable: true });
}
{
  const d = new DOMParser().parseFromString('<a b="1"><c/></a>', 'text/xml');
  for (const list of [d.childNodes, d.documentElement.attributes, d.getElementsByTagName('c')]) {
    const proto = Object.getPrototypeOf(list);
    if (!proto[Symbol.iterator]) proto[Symbol.iterator] = Array.prototype[Symbol.iterator];
  }
}
const out = join(tmpdir(), `suite-celllines-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `export * from './src/docs/cellLines.ts'; export { TableBorders } from './src/docs/tableBorders.ts';
export { docToOdt } from './src/docs/odtExport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts';
export { getSchema } from '@tiptap/core';
export { default as StarterKit } from '@tiptap/starter-kit';
export { default as Table } from '@tiptap/extension-table';
export { default as TableRow } from '@tiptap/extension-table-row';
export { default as TableCell } from '@tiptap/extension-table-cell';
export { default as TableHeader } from '@tiptap/extension-table-header';
export { EditorState, TextSelection } from '@tiptap/pm/state'; export { CellSelection } from '@tiptap/pm/tables';`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const M = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let fail = 0;
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); const ok = g === w; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${g} (trebuia ${w})`}`); if (!ok) fail++; };
const schema = M.getSchema([M.StarterKit, M.Table, M.TableRow, M.TableCell, M.TableHeader, M.TableBorders, M.CellLines]);
const cell = (t) => ({ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });
const grid = [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']];
const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: grid.map((r) => ({ type: 'tableRow', content: r.map(cell) })) }] });
const cellPos = (d, i) => { const ps = []; d.descendants((n, p) => { if (n.type.name === 'tableCell') { ps.push(p); return false; } return true; }); return ps[i]; };
const lines = (st) => { const v = []; st.doc.descendants((n) => { if (n.type.name === 'tableCell') { v.push(n.attrs.cellLines); return false; } return true; }); return v; };
// Zona aleasă: primele două rânduri × primele două coloane (celulele 0, 1, 3, 4).
const zone = (d) => M.EditorState.create({ doc: d, selection: M.CellSelection.create(d, cellPos(d, 0), cellPos(d, 4)) });
const apply = (st, kind, pen = { style: 'thick', color: '#B91C1C' }) => { let next = st; M.applyCellBorders(kind, pen)(st, (tr) => { next = st.apply(tr); }); return next; };
const R = 'thick #b91c1c';
check('jos: doar latura de jos a rândului 2 din zonă', lines(apply(zone(doc), 'bottom')), [null, null, null, `||${R}|`, `||${R}|`, null, null, null, null]);
check('contur: marginile zonei', lines(apply(zone(doc), 'outer')), [`${R}|||${R}`, `${R}|${R}||`, null, `||${R}|${R}`, `|${R}|${R}|`, null, null, null, null]);
check('interior: doar liniile dintre celulele zonei', lines(apply(zone(doc), 'inner')), [`|${R}|${R}|`, `||${R}|${R}`, null, `${R}|${R}||`, `${R}|||${R}`, null, null, null, null]);
check('fără bordură: toate laturile ascunse', lines(apply(zone(doc), 'none'))[0], 'none|none|none|none');
// Cu cursorul într-o celulă (fără zonă), bordura se pune pe celula aceea.
const one = M.EditorState.create({ doc, selection: M.TextSelection.create(doc, cellPos(doc, 8) + 2) });
check('o celulă: toate laturile, linie dublă albastră', lines(apply(one, 'all', { style: 'double', color: '#1d4ed8' }))[8], 'double #1d4ed8|double #1d4ed8|double #1d4ed8|double #1d4ed8');
// Pensula: latura cea mai apropiată de clic (la cel mult 7 px), altfel toate.
const r = { left: 0, right: 100, top: 0, bottom: 40 };
check('pensula: clic lângă marginea de jos', M.sideAt(r, 50, 37), 'b');
check('pensula: clic lângă stânga', M.sideAt(r, 3, 20), 'l');
check('pensula: clic în mijloc → toate', M.sideAt(r, 50, 20), null);
check('CSS: groasă + ascunsă', M.cssOf(`${R}|none||`), 'border-top: 2px solid #b91c1c; border-right: hidden');

// .docx: w:tcBorders pe celule; la deschidere, data-cl înapoi.
const st = apply(zone(doc), 'outer');
const docx = await M.docToDocx(st.doc.toJSON());
const dxml = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
const tcb = [...dxml.matchAll(/<w:tcBorders>([\s\S]*?)<\/w:tcBorders>/g)].map((m) => m[1]);
check('.docx: 4 celule cu w:tcBorders', tcb.length, 4);
check('.docx: prima celulă sus groasă roșie', /<w:top [^>]*w:val="single"[^>]*w:sz="12"[^>]*w:color="B91C1C"|<w:top [^>]*w:color="B91C1C"[^>]*w:sz="12"/.test(tcb[0] ?? ''), true);
const none = await M.docToDocx(apply(zone(doc), 'none').doc.toJSON());
const nxml = await (await JSZip.loadAsync(none)).file('word/document.xml').async('string');
check('.docx: fără bordură → w:val="nil"', /<w:tcBorders>[\s\S]*?<w:top [^>]*w:val="nil"/.test(nxml), true);
const back = await M.docxToHtml(docx);
const cls = [...back.html.matchAll(/data-cl="([^"]*)"/g)].map((m) => m[1]);
check('.docx citit înapoi: laturile celulelor', cls, [`${R}|||${R}`, `${R}|${R}||`, `||${R}|${R}`, `|${R}|${R}|`]);
// .odt: laturile proprii bat liniile tabelului.
const odt = await M.docToOdt(st.doc.toJSON());
const oxml = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
check('.odt: prima celulă sus și stânga groase', /fo:border-top="1.5pt solid #b91c1c" fo:border-bottom="0.5pt solid #000000" fo:border-left="1.5pt solid #b91c1c" fo:border-right="0.5pt solid #000000"/.test(oxml), true);
check('.odt: celula din afara zonei rămâne obișnuită', /fo:border="0.5pt solid #000000"/.test(oxml), true);

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
