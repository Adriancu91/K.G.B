// Test: rândul de antet repetat pe fiecare pagină, înălțimea rândurilor, rândul care nu se rupe, lățimea coloanei și alinierea verticală în celule, în Docs: comanda (pornire / oprire), exportul .docx (w:tblHeader) și .odt
// (table:table-header-rows) și citirea lor înapoi.
// Rulare (în suite/): node tests/docs-header-repeat.test.mjs
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
const out = join(tmpdir(), `suite-hdrrep-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `export * from './src/docs/tableHeaderRepeat.ts'; export * from './src/docs/tableRowHeight.ts'; export { CellVAlign } from './src/docs/cellColor.ts'; export { TableBorders } from './src/docs/tableBorders.ts'; export { setTableFit, setColumnWidth, columnWidthAt } from './src/docs/tableOps.ts';
export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts';
export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts';
export { getSchema } from '@tiptap/core';
export { default as StarterKit } from '@tiptap/starter-kit';
export { default as Table } from '@tiptap/extension-table';
export { default as TableRow } from '@tiptap/extension-table-row';
export { default as TableCell } from '@tiptap/extension-table-cell';
export { default as TableHeader } from '@tiptap/extension-table-header';
export { EditorState, TextSelection } from '@tiptap/pm/state';`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const M = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); const ok = g === w; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${g} (trebuia ${w})`}`); if (!ok) fail++; };
const schema = M.getSchema([M.StarterKit, M.Table, M.TableRow, M.TableCell, M.TableHeader, M.TableHeaderRepeat, M.TableRowHeight, M.CellVAlign, M.TableBorders]);
const cell = (t, head) => ({ type: head ? 'tableHeader' : 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });
const rows = [['Nume', 'Suma'], ['Luna', 'Total'], ['Ion', '10'], ['Ana', '20']];
const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: rows.map((r, i) => ({ type: 'tableRow', content: r.map((t) => cell(t, i === 0)) })) }] });
const stateAt = (d, r) => {
  let pos = -1, seen = 0;
  d.descendants((n, p) => { if (pos >= 0) return false; if (n.type.name === 'tableRow') { if (seen++ === r) pos = p + 3; return false; } return true; });
  return M.EditorState.create({ doc: d, selection: M.TextSelection.create(d, pos) });
};
const run = (st) => { let next = st; M.toggleRepeatHeader(st, (tr) => { next = st.apply(tr); }); return next; };
const flags = (st) => { const f = []; st.doc.descendants((n) => { if (n.type.name === 'tableRow') { f.push(!!n.attrs.repeatHeader); return false; } return true; }); return f; };

// Pornit pe rândul 2: se repetă rândurile 1 și 2 (de sus până la cursor).
let st = run(stateAt(doc, 1));
check('pornit pe rândul 2 → rândurile 1–2', flags(st), [true, true, false, false]);
check('cursorul e în antet', M.isRepeatOn(stateAt(st.doc, 1)), true);
check('rândul 3 nu e în antet', M.isRepeatOn(stateAt(st.doc, 2)), false);
// Oprit pe rândul 2: rămâne doar primul.
const st2 = run(stateAt(st.doc, 1));
check('oprit pe rândul 2 → doar rândul 1', flags(st2), [true, false, false, false]);
check('oprit pe rândul 1 → niciunul', flags(run(stateAt(st2.doc, 0))), [false, false, false, false]);
check('pornit pe rândul 1 → doar rândul 1', flags(run(stateAt(doc, 0))), [true, false, false, false]);

// .docx: w:tblHeader doar pe primele două rânduri; la import ajung în <thead>.
const json = st.doc.toJSON();
const docx = await M.docToDocx(json);
const dxml = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
const trs = dxml.split('<w:tr>').slice(1).map((r) => r.includes('<w:tblHeader'));
check('.docx: w:tblHeader pe rândurile 1–2', trs, [true, true, false, false]);
const back = await M.docxToHtml(docx);
const thead = /<thead>([^]*?)<\/thead>/.exec(back.html)?.[1] ?? '';
check('.docx citit: 2 rânduri în <thead>', (thead.match(/<tr>/g) ?? []).length, 2);
check('.docx citit: Luna în antet', thead.includes('Luna'), true);

// .odt: table:table-header-rows cu primele două rânduri; la import data-repeat-header.
const odt = await M.docToOdt(json);
const oxml = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
const hr = /<table:table-header-rows>([^]*?)<\/table:table-header-rows>/.exec(oxml)?.[1] ?? '';
check('.odt: 2 rânduri în table-header-rows', (hr.match(/<table:table-row>/g) ?? []).length, 2);
check('.odt: Ion nu e în antet', hr.includes('Ion'), false);
const oback = await M.odtToHtml(odt);
check('.odt citit: 2 rânduri data-repeat-header', (oback.html.match(/<tr data-repeat-header="">/g) ?? []).length, 2);
// Fără antet repetat: nimic în plus.
const plain = await M.docToOdt(doc.toJSON());
check('.odt fără antet repetat', (await (await JSZip.loadAsync(plain)).file('content.xml').async('string')).includes('header-rows'), false);
check('repeatCount', M.repeatCount([{ attrs: { repeatHeader: true } }, { attrs: {} }, { attrs: { repeatHeader: true } }]), 1);

// Înălțimea rândurilor: pe rândul 3 (cursor), apoi .docx (w:trHeight cel puțin) și .odt (min-row-height) dus-întors.
check('mm, pt, px → cm', [M.parseRowHeight('15mm'), M.parseRowHeight('72pt'), M.parseRowHeight('96px'), M.parseRowHeight('abc')], [1.5, 2.54, 2.54, null]);
let sh = stateAt(st.doc, 2);
let st3 = sh; M.setRowHeight(1.5)(sh, (tr) => { st3 = sh.apply(tr); });
const heights = (s) => { const f = []; s.doc.descendants((n) => { if (n.type.name === 'tableRow') { f.push(n.attrs.rowHeight); return false; } return true; }); return f; };
check('1,5 cm pe rândul 3', heights(st3), [null, null, 1.5, null]);
check('rowHeightAt', M.rowHeightAt(stateAt(st3.doc, 2)), 1.5);
let st4 = st3; M.setRowHeight(null)(stateAt(st3.doc, 2), (tr) => { st4 = stateAt(st3.doc, 2).apply(tr); });
check('gol → automată', heights(st4), [null, null, null, null]);
const hj = st3.doc.toJSON();
const hdocx = await M.docToDocx(hj);
const hx = await (await JSZip.loadAsync(hdocx)).file('word/document.xml').async('string');
const trh = /<w:trHeight [^>]*>/.exec(hx)?.[0] ?? '';
check('.docx: w:trHeight 851 cel puțin', [trh.includes('w:val="851"'), trh.includes('atLeast')], [true, true]);
const hb = await M.docxToHtml(hdocx);
check('.docx citit: data-row-height 1.5 pe rândul cu Ion', /<tr data-row-height="1.5"><td><p>Ion/.test(hb.html), true);
check('.docx citit: un singur rând cu înălțime', (hb.html.match(/data-row-height/g) ?? []).length, 1);
check('.docx citit: fără semne rămase', hb.html.includes(String.fromCharCode(0x2063)), false);
const hodt = await M.docToOdt(hj);
const ho = await (await JSZip.loadAsync(hodt)).file('content.xml').async('string');
check('.odt: stil de rând cu min-row-height', ho.includes('style:family="table-row"><style:table-row-properties style:min-row-height="1.5cm"/>'), true);
const hob = await M.odtToHtml(hodt);
check('.odt citit: data-row-height 1.5cm', (hob.html.match(/data-row-height="1.5cm"/g) ?? []).length, 1);

// Alinierea verticală: „Ion” la mijloc, „10” jos; .docx (w:vAlign) și .odt (style:vertical-align) dus-întors.
const vj = JSON.parse(JSON.stringify(doc.toJSON()));
vj.content[0].content[2].content[0].attrs = { ...(vj.content[0].content[2].content[0].attrs ?? {}), verticalAlign: 'middle' };
vj.content[0].content[2].content[1].attrs = { ...(vj.content[0].content[2].content[1].attrs ?? {}), verticalAlign: 'bottom' };
check('schema păstrează verticalAlign', schema.nodeFromJSON(vj).toJSON().content[0].content[2].content[1].attrs.verticalAlign, 'bottom');
const vdocx = await M.docToDocx(vj);
const vx = await (await JSZip.loadAsync(vdocx)).file('word/document.xml').async('string');
check('.docx: w:vAlign center și bottom', [vx.includes('<w:vAlign w:val="center"/>'), vx.includes('<w:vAlign w:val="bottom"/>')], [true, true]);
const vb = await M.docxToHtml(vdocx);
check('.docx citit: Ion la mijloc', /data-valign="middle"><p>Ion/.test(vb.html), true);
check('.docx citit: 10 jos', /data-valign="bottom"><p>10/.test(vb.html), true);
check('.docx citit: doar 2 celule aliniate', (vb.html.match(/data-valign/g) ?? []).length, 2);
const vodt = await M.docToOdt(vj);
const vo = await (await JSZip.loadAsync(vodt)).file('content.xml').async('string');
check('.odt: style:vertical-align middle și bottom', [vo.includes('style:vertical-align="middle"'), vo.includes('style:vertical-align="bottom"')], [true, true]);
const vob = await M.odtToHtml(vodt);
check('.odt citit: Ion la mijloc, 10 jos', [/data-valign="middle"><p[^>]*>Ion/.test(vob.html), /data-valign="bottom"><p[^>]*>10/.test(vob.html)], [true, true]);

// Potrivire automată: după conținut (lățimile trase se șterg) și înapoi pe toată lățimea; .docx dus-întors.
const fj = JSON.parse(JSON.stringify(doc.toJSON()));
fj.content[0].content[1].content[0].attrs = { ...(fj.content[0].content[1].content[0].attrs ?? {}), colwidth: [200] };
const fdoc = schema.nodeFromJSON(fj);
let fst = stateAt(fdoc, 1);
let fs2 = fst; M.setTableFit('content')(fst, (tr) => { fs2 = fst.apply(tr); });
const tbl = (s) => s.doc.firstChild;
check('după conținut: fit=content', tbl(fs2).attrs.fit, 'content');
let cw = 0; tbl(fs2).descendants((n) => { if (n.attrs.colwidth) cw++; return true; });
check('după conținut: lățimile trase șterse', cw, 0);
let fs3 = fs2; M.setTableFit('window')(stateAt(fs2.doc, 1), (tr) => { fs3 = stateAt(fs2.doc, 1).apply(tr); });
check('pe toată lățimea: fit=null', tbl(fs3).attrs.fit, null);
const fdocx = await M.docToDocx(fs2.doc.toJSON());
const fx = await (await JSZip.loadAsync(fdocx)).file('word/document.xml').async('string');
check('.docx: w:tblW auto și autofit', [/<w:tblW [^>]*w:type="auto"/.test(fx), fx.includes('<w:tblLayout w:type="autofit"/>')], [true, true]);
check('.docx citit: data-fit="content"', (await M.docxToHtml(fdocx)).html.includes('data-fit="content"'), true);
const wdocx = await M.docToDocx(fs3.doc.toJSON());
check('.docx pe toată lățimea: fără data-fit', (await M.docxToHtml(wdocx)).html.includes('data-fit'), false);

// Așezarea tabelului pe pagină: la centru, împreună cu „după conținut”; .docx dus-întors.
const aj = fs2.doc.toJSON();
aj.content[0].attrs = { ...aj.content[0].attrs, align: 'center' };
check('schema păstrează align', schema.nodeFromJSON(aj).firstChild.attrs.align, 'center');
const adocx = await M.docToDocx(aj);
const ax = await (await JSZip.loadAsync(adocx)).file('word/document.xml').async('string');
check('.docx: w:jc center în w:tblPr', /<w:tblPr>(?:(?!<[/]w:tblPr>)[^])*<w:jc w:val="center"[/]>/.test(ax), true);
const ahtml = (await M.docxToHtml(adocx)).html;
check('.docx citit: la centru și după conținut', [ahtml.includes('data-align="center"'), ahtml.includes('data-fit="content"')], [true, true]);
const rj = JSON.parse(JSON.stringify(aj)); rj.content[0].attrs.align = 'right';
check('.docx citit: la dreapta', (await M.docxToHtml(await M.docToDocx(rj))).html.includes('data-align="right"'), true);

const aodt = await M.docToOdt(aj);
const ao = await (await JSZip.loadAsync(aodt)).file('content.xml').async('string');
check('.odt: stil de tabel cu table:align center', ao.includes('style:family="table"><style:table-properties table:align="center"/>'), true);
check('.odt citit: data-align center', (await M.odtToHtml(aodt)).html.includes('data-align="center"'), true);

// Rândul care nu se rupe între pagini (Proprietăți tabel → Rând): comanda, .docx (w:cantSplit) și .odt (fo:keep-together) dus-întors.
let ns = stateAt(st3.doc, 2), ns2 = ns;
M.setRowNoSplit(true)(ns, (tr) => { ns2 = ns.apply(tr); });
const keeps = (s) => { const f = []; s.doc.descendants((n) => { if (n.type.name === 'tableRow') { f.push(!!n.attrs.noSplit); return false; } return true; }); return f; };
check('nu se rupe: rândul 3', keeps(ns2), [false, false, true, false]);
check('rowNoSplitAt', [M.rowNoSplitAt(stateAt(ns2.doc, 2)), M.rowNoSplitAt(stateAt(ns2.doc, 1))], [true, false]);
const nsdocx = await M.docToDocx(ns2.doc.toJSON());
const nsx = await (await JSZip.loadAsync(nsdocx)).file('word/document.xml').async('string');
check('.docx: un w:cantSplit', (nsx.match(/<w:cantSplit/g) ?? []).length, 1);
const nsb = (await M.docxToHtml(nsdocx)).html;
check('.docx citit: rândul cu Ion are înălțimea și nu se rupe', /<tr data-row-height="1.5" data-no-split=""><td><p>Ion/.test(nsb), true);
check('.docx citit: un singur rând care nu se rupe, fără semne rămase', [(nsb.match(/data-no-split/g) ?? []).length, nsb.includes(String.fromCharCode(0x2063))], [1, false]);
const only = schema.nodeFromJSON(doc.toJSON());
let os1 = stateAt(only, 3), os2 = os1; M.setRowNoSplit(true)(os1, (tr) => { os2 = os1.apply(tr); });
const ob = (await M.docxToHtml(await M.docToDocx(os2.doc.toJSON()))).html;
check('.docx citit: fără înălțime, doar nu se rupe (rândul cu Ana)', /<tr data-no-split=""><td><p>Ana/.test(ob), true);
const nsodt = await M.docToOdt(ns2.doc.toJSON());
const nso = await (await JSZip.loadAsync(nsodt)).file('content.xml').async('string');
check('.odt: stil de rând cu fo:keep-together', nso.includes('style:min-row-height="1.5cm" fo:keep-together="always"'), true);
check('.odt citit: data-no-split', ((await M.odtToHtml(nsodt)).html.match(/data-no-split/g) ?? []).length, 1);
let ns3 = ns2; M.setRowNoSplit(false)(stateAt(ns2.doc, 2), (tr) => { ns3 = stateAt(ns2.doc, 2).apply(tr); });
check('debifat: se poate rupe din nou', keeps(ns3), [false, false, false, false]);

// Lățimea coloanei (Proprietăți tabel → Coloană): pe toate celulele coloanei, în cm.
let cs1 = stateAt(doc, 2), cs2 = cs1;
M.setColumnWidth(3)(cs1, (tr) => { cs2 = cs1.apply(tr); });
const widths = (s) => { const f = []; s.doc.descendants((n) => { if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') { f.push(n.attrs.colwidth); return false; } return true; }); return f; };
check('3 cm pe prima coloană (113 px)', widths(cs2), [[113], null, [113], null, [113], null, [113], null]);
check('columnWidthAt', [M.columnWidthAt(stateAt(cs2.doc, 3)), M.columnWidthAt(stateAt(doc, 3))], [3, null]);
let cs3 = cs2; M.setColumnWidth(null)(stateAt(cs2.doc, 1), (tr) => { cs3 = stateAt(cs2.doc, 1).apply(tr); });
check('gol → automată', widths(cs3).every((w) => w === null), true);

// Indentarea tabelului (w:tblInd) și marginile celulelor (w:tblCellMar), .docx dus-întors; 0,19 cm (obișnuit) nu se ia.
const ij = JSON.parse(JSON.stringify(doc.toJSON()));
ij.content[0].attrs = { indent: 1.25, pad: 0.3 };
const idocx = await M.docToDocx(ij);
const ix = await (await JSZip.loadAsync(idocx)).file('word/document.xml').async('string');
check('.docx: w:tblInd 709 și w:tblCellMar 170', [/<w:tblInd w:type="dxa" w:w="709"\/>/.test(ix), /<w:tblCellMar>[^]*<w:left w:type="dxa" w:w="170"\/>/.test(ix)], [true, true]);
const ih = (await M.docxToHtml(idocx)).html;
check('.docx citit: data-indent 1.25 și data-pad 0.3', [/<table[^>]* data-indent="1.25"/.test(ih), /<table[^>]* data-pad="0.3"/.test(ih), ih.includes(String.fromCharCode(0x2063))], [true, true, false]);
const iback = schema.nodeFromJSON(ij).firstChild.attrs;
check('atributele în editor', [iback.indent, iback.pad], [1.25, 0.3]);
const dj = JSON.parse(JSON.stringify(doc.toJSON()));
dj.content[0].attrs = { pad: 0.19 };
const dh = (await M.docxToHtml(await M.docToDocx(dj))).html;
check('.docx citit: marginile obișnuite (108 twips) nu devin data-pad', [dh.includes('data-pad'), dh.includes('data-indent')], [false, false]);
const cj = JSON.parse(JSON.stringify(doc.toJSON()));
cj.content[0].attrs = { indent: 2, align: 'center' };
check('.docx: tabelul la centru nu primește indentare', (await (await JSZip.loadAsync(await M.docToDocx(cj))).file('word/document.xml').async('string')).includes('<w:tblInd'), false);

// Aceleași în .odt: fo:margin-left pe stilul tabelului și fo:padding pe celule, citite înapoi; 0,1 cm (obișnuit) nu se ia.
const iodt = await M.docToOdt(ij);
const io = await (await JSZip.loadAsync(iodt)).file('content.xml').async('string');
check('.odt: fo:margin-left 1.25cm și fo:padding 0.3cm', [io.includes('table:align="left" fo:margin-left="1.25cm"'), io.includes('fo:padding="0.3cm"')], [true, true]);
const ioh = (await M.odtToHtml(iodt)).html;
check('.odt citit: data-indent 1.25 și data-pad 0.3', [/<table[^>]* data-indent="1.25"/.test(ioh), /<table[^>]* data-pad="0.3"/.test(ioh)], [true, true]);
const poh = (await M.odtToHtml(await M.docToOdt(doc.toJSON()))).html;
check('.odt citit: tabelul obișnuit fără data-indent / data-pad', [poh.includes('data-indent'), poh.includes('data-pad')], [false, false]);

// Textul alternativ (Proprietăți tabel → Text alternativ): .docx w:tblCaption / w:tblDescription și .odt table:title / table:desc, dus-întors;
// trei tabele, doar primul și al treilea cu text, ca să se vadă că fiecare îl primește pe al lui.
const taj = JSON.parse(JSON.stringify(doc.toJSON()));
taj.content = [taj.content[0], { type: 'paragraph' }, JSON.parse(JSON.stringify(taj.content[0])), { type: 'paragraph' }, JSON.parse(JSON.stringify(taj.content[0]))];
taj.content[0].attrs = { altTitle: 'Plăți & "rate" <2026>', altDesc: 'Sume pe luni.\nAl doilea rând.' };
taj.content[4].attrs = { altDesc: 'Doar descriere' };
const tadocx = await M.docToDocx(taj);
const tax = await (await JSZip.loadAsync(tadocx)).file('word/document.xml').async('string');
check('.docx: w:tblCaption și w:tblDescription la locul lor', [tax.includes('<w:tblCaption w:val="Plăți &amp; &quot;rate&quot; &lt;2026&gt;"/><w:tblDescription w:val="Sume pe luni.&#10;Al doilea rând."/></w:tblPr>'), (tax.match(/<w:tblCaption/g) ?? []).length, (tax.match(/<w:tblDescription/g) ?? []).length], [true, 1, 2]);
const tah = (await M.docxToHtml(tadocx)).html;
const tags = (h) => [...h.matchAll(/<table[^>]*>/g)].map((m) => [/data-alt-title="([^"]*)"/.exec(m[0])?.[1] ?? null, /data-alt-desc="([^"]*)"/.exec(m[0])?.[1] ?? null]);
check('.docx citit: fiecare tabel cu textul lui', tags(tah), [['Plăți &amp; &quot;rate&quot; &lt;2026&gt;', 'Sume pe luni.\nAl doilea rând.'], [null, null], [null, 'Doar descriere']]);
check('.docx citit: fără semne rămase', tah.includes(String.fromCharCode(0x2063)), false);
const taback = schema.nodeFromJSON(taj).firstChild.attrs;
check('atributele în editor', [taback.altTitle, taback.altDesc], ['Plăți & "rate" <2026>', 'Sume pe luni.\nAl doilea rând.']);
const taodt = await M.docToOdt(taj);
const tao = await (await JSZip.loadAsync(taodt)).file('content.xml').async('string');
check('.odt: table:title și table:desc la începutul tabelului', [/<table:table [^>]*><table:title>Plăți &amp; &quot;rate&quot; &lt;2026&gt;<[/]table:title><table:desc>Sume pe luni/.test(tao), (tao.match(/<table:desc>/g) ?? []).length], [true, 2]);
check('.odt citit: fiecare tabel cu textul lui', tags((await M.odtToHtml(taodt)).html), [['Plăți &amp; &quot;rate&quot; &lt;2026&gt;', 'Sume pe luni.\nAl doilea rând.'], [null, null], [null, 'Doar descriere']]);
check('.docx fără text alternativ: nimic scris', (await (await JSZip.loadAsync(await M.docToDocx(doc.toJSON()))).file('word/document.xml').async('string')).includes('tblCaption'), false);

// Încadrarea textului în jurul tabelului: .docx w:tblpPr (la dreapta, față de margine), citit înapoi ca data-wrap + data-align.
const wj = JSON.parse(JSON.stringify(doc.toJSON()));
wj.content[0].attrs = { wrap: 'around', align: 'right' };
wj.content.push({ type: 'paragraph', content: [{ type: 'text', text: 'Text pe lângă tabel.' }] });
const wx = await (await JSZip.loadAsync(await M.docToDocx(wj))).file('word/document.xml').async('string');
const tp = /<w:tblpPr [^>]*>/.exec(wx)?.[0] ?? '';
check('.docx: w:tblpPr la dreapta, față de margine', [tp.includes('w:tblpXSpec="right"'), tp.includes('w:horzAnchor="margin"'), tp.includes('w:leftFromText="227"')], [true, true, true]);
const wh = (await M.docxToHtml(await M.docToDocx(wj))).html;
check('.docx citit: data-wrap="around" și data-align="right"', [/<table[^>]* data-wrap="around"/.test(wh), /<table[^>]* data-align="right"/.test(wh), wh.includes(String.fromCharCode(0x2063))], [true, true, false]);
wj.content[0].attrs = { wrap: 'around' };
const wl = (await M.docxToHtml(await M.docToDocx(wj))).html;
check('.docx citit: la stânga, fără data-align', [/<table[^>]* data-wrap="around"/.test(wl), wl.includes('data-align')], [true, false]);
check('atributul în editor', schema.nodeFromJSON(wj).firstChild.attrs.wrap, 'around');
check('.docx obișnuit fără w:tblpPr', (await (await JSZip.loadAsync(await M.docToDocx(doc.toJSON()))).file('word/document.xml').async('string')).includes('tblpPr'), false);

console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
