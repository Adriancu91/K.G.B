// Test pentru textul alternativ al pozelor din Docs: export .docx (descr) și .odt (svg:desc), apoi citire înapoi.
// Rulare (în suite/): node tests/docs-alt.test.mjs
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
const out = join(tmpdir(), `suite-docsalt-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, odtToHtml, docToDocx, docxToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };

// O poză PNG de 1×1.
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const alt = 'Graficul vânzărilor & „2026”';
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sus' }] }, { type: 'image', attrs: { src: png, alt } }, { type: 'image', attrs: { src: png, alt: '' } }] };

const docx = await docToDocx(doc);
const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
check('Word: descr pe poză', xml.includes('descr="Graficul vânzărilor &amp; „2026”"'), xml.match(/<wp:docPr[^>]*>/g)?.join(' '));
const back = await docxToHtml(docx);
check('Word → înapoi: alt', back.html.includes('alt="Graficul vânzărilor &amp; „2026”"'), back.html.slice(0, 300));

const odt = await docToOdt(doc);
const content = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
check('LibreOffice: svg:desc', content.includes('<svg:desc>Graficul vânzărilor &amp; „2026”</svg:desc>'));
check('LibreOffice: fără desc gol', content.split('<svg:desc>').length === 2);
const back2 = await odtToHtml(odt);
check('LibreOffice → înapoi: alt', back2.html.includes('alt="Graficul vânzărilor &amp; „2026”"'), back2.html.slice(0, 300));

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
