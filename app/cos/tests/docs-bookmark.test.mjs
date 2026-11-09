// Test pentru semnele de carte din Docs: export .docx (w:bookmarkStart, w:hyperlink w:anchor) citit înapoi, export .odt (text:bookmark) citit înapoi.
// Rulare (în suite/): node tests/docs-bookmark.test.mjs
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
const out = join(tmpdir(), `suite-docsbm-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { NO_PAGE_SETUP } from './src/docs/format.ts'; export { normalizeHref } from './src/docs/link.ts'; export { bookmarkName } from './src/docs/bookmark.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, odtToHtml, docToDocx, docxToHtml, NO_PAGE_SETUP, normalizeHref, bookmarkName } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
check('numele: spațiile devin _', bookmarkName('Capitolul 2') === 'Capitolul_2');
check('numele: nu începe cu cifră', bookmarkName('2abc') === null);
check('numele: diacriticele sunt bune', bookmarkName('Anexă_ș') === 'Anexă_ș');
check('legătura #nume rămâne', normalizeHref('#Anexa_1') === '#Anexa_1');
check('legătura # goală e refuzată', normalizeHref('#') === null);

const doc = { type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'Vezi ' }, { type: 'text', text: 'anexa', marks: [{ type: 'link', attrs: { href: '#Anexa_1' } }] }, { type: 'text', text: '.' }] },
  { type: 'paragraph', content: [{ type: 'bookmark', attrs: { name: 'Anexa_1' } }, { type: 'text', text: 'Anexa 1' }] },
] };
const docx = await docToDocx(doc, NO_PAGE_SETUP);
const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
check('.docx: w:bookmarkStart cu numele', /<w:bookmarkStart[^>]*w:name="Anexa_1"/.test(xml), xml.slice(0, 600));
check('.docx: w:bookmarkEnd', /<w:bookmarkEnd /.test(xml));
check('.docx: legătura w:hyperlink w:anchor', /<w:hyperlink[^>]*w:anchor="Anexa_1"/.test(xml));
const back = await docxToHtml(docx);
const html = typeof back === 'string' ? back : back.html ?? JSON.stringify(back);
check('.docx citit înapoi: legătura #Anexa_1', /href="#Anexa_1"/.test(html), html.slice(0, 500));
check('.docx citit înapoi: semnul <a id="Anexa_1">', /<a id="Anexa_1"/.test(html), html.slice(0, 500));

const odt = await docToOdt(doc, NO_PAGE_SETUP);
const content = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
check('.odt: text:bookmark', /<text:bookmark text:name="Anexa_1"\/>/.test(content));
check('.odt: text:a spre #Anexa_1', /xlink:href="#Anexa_1"/.test(content));
const ob = await odtToHtml(odt);
const oh = typeof ob === 'string' ? ob : ob.html ?? JSON.stringify(ob);
check('.odt citit înapoi: semnul și legătura', /data-bookmark="Anexa_1"/.test(oh) && /href="#Anexa_1"/.test(oh), oh.slice(0, 500));
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
