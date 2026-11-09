// Test pentru liniile tabelului (Docs, tableLines.ts) și indexul alfabetic (indexEntry.ts) la export: .docx (w:tblBorders) și .odt (fo:border pe celule, indexul ca text).
// Rulare (în suite/): node tests/docs-tablelines.test.mjs
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
const out = join(tmpdir(), `suite-docslines-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { NO_PAGE_SETUP } from './src/docs/format.ts'; export { buildIndex, groupLetter } from './src/docs/indexEntry.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, docToDocx, NO_PAGE_SETUP, buildIndex, groupLetter } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const cell = (t) => ({ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });
const tbl = (attrs) => ({ type: 'table', attrs, content: [{ type: 'tableRow', content: [cell('a'), cell('b')] }, { type: 'tableRow', content: [cell('c'), cell('d')] }] });
const doc = (t) => ({ type: 'doc', content: [t, { type: 'paragraph', content: [{ type: 'text', text: 'Ana' }, { type: 'indexEntry', attrs: { term: 'Ana', sub: '' } }, { type: 'text', text: ' și ' }, { type: 'indexEntry', attrs: { term: 'șablon', sub: '' } }, { type: 'indexEntry', attrs: { term: 'Sistem', sub: 'nou' } }] }, { type: 'docIndex' }] });
const docxXml = async (d) => (await JSZip.loadAsync(await docToDocx(d, NO_PAGE_SETUP))).file('word/document.xml').async('string');
const odtXml = async (d) => { const z = await JSZip.loadAsync(await docToOdt(d, NO_PAGE_SETUP)); return z.file('content.xml').async('string'); };

// .docx: liniile obișnuite nu scriu w:tblBorders proprii; cele alese da.
let x = await docxXml(doc(tbl({})));
check('.docx: tabel obișnuit fără chenare proprii', !/<w:tblBorders>/.test(x) || !/w:val="double"/.test(x));
x = await docxXml(doc(tbl({ bset: 'outer', bstyle: 'double', bcolor: '#1d4ed8' })));
const tb = /<w:tblBorders>([\s\S]*?)<\/w:tblBorders>/.exec(x)?.[1] ?? '';
check('.docx: conturul e dublu, albastru', /<w:top [^>]*w:val="double"[^>]*w:color="1D4ED8"/.test(tb) || /<w:top [^>]*w:color="1D4ED8"[^>]*w:val="double"/.test(tb), tb.slice(0, 300));
check('.docx: în interior fără linii', /<w:insideH [^>]*w:val="none"/.test(tb) && /<w:insideV [^>]*w:val="none"/.test(tb), tb.slice(0, 400));
x = await docxXml(doc(tbl({ bset: 'horiz', bstyle: 'dashed' })));
const th = /<w:tblBorders>([\s\S]*?)<\/w:tblBorders>/.exec(x)?.[1] ?? '';
check('.docx: doar orizontale, întrerupte', /<w:insideH [^>]*w:val="dashed"/.test(th) && /<w:left [^>]*w:val="none"/.test(th) && /<w:insideV [^>]*w:val="none"/.test(th), th.slice(0, 400));
// Indexul ajunge ca text: literele și intrările.
const body = x.replace(/<[^>]+>/g, '|');
check('.docx: indexul cu literele A și S', /\|Index\|/.test(body) && /\|A\|[\s\S]*\|Ana\|[\s\S]*\|S\|[\s\S]*\|Sistem\|[\s\S]*\|nou\|[\s\S]*\|șablon\|/.test(body), body.slice(-400));

// .odt: celulele au laturile după set.
let o = await odtXml(doc(tbl({ bset: 'outer', bstyle: 'thick', bcolor: '#b91c1c' })));
check('.odt: celula din stânga sus are sus și stânga, nu jos și dreapta', /fo:border-top="1.5pt solid #b91c1c" fo:border-bottom="none" fo:border-left="1.5pt solid #b91c1c" fo:border-right="none"/.test(o));
o = await odtXml(doc(tbl({})));
check('.odt: tabel obișnuit, linie subțire neagră', /fo:border="0.5pt solid #000000"/.test(o));
check('.odt: indexul ca text', o.includes('>Index<') && o.includes('>Sistem<') && o.includes('>nou<'));

// Ordinea și literele.
check('litera grupei: Ș → S, Ă → A, 3 → #', groupLetter('Șablon') === 'S' && groupLetter('Ăla') === 'A' && groupLetter('3D') === '#');
const rows = buildIndex([{ term: 'șablon', sub: '', pos: 1 }, { term: 'Sistem', sub: '', pos: 2 }, { term: 'sistem', sub: '', pos: 3 }, { term: 'Ana', sub: 'x', pos: 4 }], [2, 1, 1, 5]);
check('index: ordinea română, litere mari/mici unite, subintrare cu rând principal', JSON.stringify(rows.map((r) => [r.term, r.sub, r.pages.map((p) => p.page)])) === JSON.stringify([['Ana', '', []], ['Ana', 'x', [5]], ['Sistem', '', [1]], ['șablon', '', [2]]]), JSON.stringify(rows));
console.log(fail ? `${fail} greșeli` : 'TOATE OK');
process.exit(fail ? 1 : 0);
