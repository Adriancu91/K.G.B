// Test pentru „Păstrează cu următorul”, „Păstrează liniile împreună” și „Control rânduri văduve / orfane” (oprit) din Docs: Word (w:keepNext, w:keepLines) și LibreOffice, dus-întors.
// Rulare (în suite/): node tests/docs-keep.test.mjs
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
const out = join(tmpdir(), `suite-docskeep-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, odtToHtml, docToDocx, docxToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const p = (text, attrs) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content: [{ type: 'text', text }] });
const doc = { type: 'doc', content: [p('Titlu tabel', { keepNext: true }), p('Bloc întreg', { keepLines: true }), p('Ambele', { keepNext: true, keepLines: true }), p('Simplu'), p('Fără control', { noWidow: true })] };

const docx = await docToDocx(doc);
const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
const paras = xml.split('</w:p>');
check('Word: keepNext pe primul', paras[0].includes('<w:keepNext/>') && !paras[0].includes('<w:keepLines/>'));
check('Word: keepLines pe al doilea', paras[1].includes('<w:keepLines/>') && !paras[1].includes('<w:keepNext/>'));
check('Word: ambele pe al treilea', paras[2].includes('<w:keepNext/>') && paras[2].includes('<w:keepLines/>'));
check('Word: nimic pe al patrulea', !paras[3].includes('<w:keep') && !paras[3].includes('<w:widowControl'));
check('Word: widowControl oprit pe al cincilea', /<w:widowControl w:val="(0|false)"/.test(paras[4]), paras[4]);
const back = (await docxToHtml(docx)).html;
check('Word → înapoi', back.includes('<p data-keep-next="">Titlu tabel</p>') && back.includes('<p data-keep-lines="">Bloc întreg</p>')
  && back.includes('<p data-keep-next="" data-keep-lines="">Ambele</p>') && back.includes('<p>Simplu</p>') && back.includes('<p data-no-widow="">Fără control</p>'), back);

const odt = await docToOdt(doc);
const c = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
check('LibreOffice: fo:keep-with-next și fo:keep-together', c.includes('fo:keep-with-next="always"') && c.includes('fo:keep-together="always"'));
check('LibreOffice: fo:widows="1" fo:orphans="1"', c.includes('fo:widows="1" fo:orphans="1"'));
const back2 = (await odtToHtml(odt)).html;
check('LibreOffice → înapoi', /<p[^>]*data-keep-next=""[^>]*>Titlu tabel/.test(back2) && /<p[^>]*data-keep-lines=""[^>]*>Bloc întreg/.test(back2) && !/data-keep[^>]*>Simplu/.test(back2) && /<p[^>]*data-no-widow=""[^>]*>Fără control/.test(back2) && !/data-no-widow[^>]*>Simplu/.test(back2), back2);

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
