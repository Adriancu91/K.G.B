// Test pentru Sfârșit de coloană în Docs: export Word (w:br type=column) citit înapoi din .docx, și export LibreOffice (fo:break-after=column).
// Rulare (în suite/): node tests/docs-colbreak.test.mjs
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
const out = join(tmpdir(), `suite-docscb-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { NO_PAGE_SETUP } from './src/docs/format.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, odtToHtml, docToDocx, docxToHtml, NO_PAGE_SETUP } = await import(pathToFileURL(out).href);

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const doc = { type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'Coloana întâi' }] },
  { type: 'columnBreak' },
  { type: 'paragraph', content: [{ type: 'text', text: 'Coloana a doua' }] },
] };
const docx = await docToDocx(doc, { ...NO_PAGE_SETUP, columns: 2 });
const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
check('.docx: sfârșitul de coloană e w:br de tip column', /<w:br w:type="column"\/>/.test(xml), xml.slice(0, 400));
const back = await docxToHtml(docx);
const html = typeof back === 'string' ? back : back.html ?? JSON.stringify(back);
check('.docx citit înapoi: „Sfârșit de coloană” între cele două paragrafe', /Coloana întâi[\s\S]*data-column-break[\s\S]*Coloana a doua/.test(html), html.slice(0, 400));
const odt = await docToOdt(doc, { ...NO_PAGE_SETUP, columns: 2 });
const content = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
check('.odt: paragraf cu fo:break-after="column"', /fo:break-after="column"/.test(content));

// Linie între coloane: w:cols w:sep="1" în .docx, style:column-sep în .odt, și înapoi la citire.
const docxL = await docToDocx(doc, { ...NO_PAGE_SETUP, columns: 2, colLine: true });
const xmlL = await (await JSZip.loadAsync(docxL)).file('word/document.xml').async('string');
check('.docx: w:cols cu w:sep', /<w:cols\b[^>]*w:sep="(?:1|true)"/.test(xmlL), /<w:cols[^>]*>/.exec(xmlL)?.[0]);
check('.docx citit înapoi: linia rămâne', (await docxToHtml(docxL)).layout?.colLine === true);
check('.docx fără linie: nimic', !/w:sep=/.test(xml) && (await docxToHtml(docx)).layout?.colLine === undefined);
const odtL = await docToOdt(doc, { ...NO_PAGE_SETUP, columns: 2, colLine: true });
const zipL = await JSZip.loadAsync(odtL);
const stylesL = (await zipL.file('styles.xml')?.async('string')) ?? '';
check('.odt: style:column-sep', /<style:column-sep\b/.test(stylesL + (await zipL.file('content.xml').async('string'))));
const backL = await odtToHtml(odtL);
check('.odt citit înapoi: linia rămâne', backL.layout?.colLine === true, JSON.stringify(backL.layout));
check('linia nu se scrie la o singură coloană', !/<w:cols\b[^>]*w:sep=/.test(await (await JSZip.loadAsync(await docToDocx(doc, { ...NO_PAGE_SETUP, colLine: true }))).file('word/document.xml').async('string')));
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
