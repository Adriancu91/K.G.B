// Test pentru „Pagini pare diferite” din Docs: .docx (w:evenAndOddHeaders + antet/subsol „even”, citite și înapoi),
// .odt (style:header-left / style:footer-left), fișierul Suite.
// Rulare (în suite/): node tests/docs-evenpage.test.mjs
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
const out = join(tmpdir(), `suite-docseven-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { parseDoc, serializeDoc } from './src/docs/format.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, parseDoc, serializeDoc, docToDocx, docxToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Text' }] }] };
const page = { header: 'Capitolul 1', footer: 'Dreapta', numbers: true, evenPage: { header: 'Titlul cărții', footer: 'Stânga' } };

// .docx: w:evenAndOddHeaders în settings.xml și câte un antet / subsol „even”.
const bytes = await docToDocx(doc, page);
const zip = await JSZip.loadAsync(bytes);
const xml = await zip.file('word/document.xml').async('string');
const settings = await zip.file('word/settings.xml').async('string');
const rels = await zip.file('word/_rels/document.xml.rels').async('string');
check('.docx are w:evenAndOddHeaders', /<w:evenAndOddHeaders\s*\/>|<w:evenAndOddHeaders [^>]*\/>/.test(settings), settings.slice(0, 400));
check('.docx are antet și subsol „even”', /<w:headerReference w:type="even"/.test(xml) && /<w:footerReference w:type="even"/.test(xml));
const target = (kind) => {
  const rid = xml.match(new RegExp(`<w:${kind}Reference w:type="even" r:id="([^"]+)"`))?.[1];
  return rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
};
const evenHeader = await zip.file('word/' + target('header'))?.async('string');
check('antetul paginilor pare are textul lui', !!evenHeader && evenHeader.includes('Titlul cărții') && !evenHeader.includes('Capitolul 1'), evenHeader);
const evenFooter = await zip.file('word/' + target('footer'))?.async('string');
check('subsolul paginilor pare are textul lui și numărul', !!evenFooter && evenFooter.includes('Stânga') && evenFooter.includes('PAGE'), evenFooter);
check('antetul obișnuit rămâne', /<w:headerReference w:type="default"/.test(xml));
const plain = await JSZip.loadAsync(await docToDocx(doc, { ...page, evenPage: undefined }));
const plainSettings = await plain.file('word/settings.xml').async('string');
check('fără bifă: w:evenAndOddHeaders lipsește sau e oprit', !/<w:evenAndOddHeaders(?: w:val="(?:1|true|on)")? ?\/>/.test(plainSettings), plainSettings.match(/<w:evenAndOddHeaders[^>]*>/)?.[0]);

// Înapoi din .docx.
const back = (await docxToHtml(bytes)).layout;
check('.docx citit înapoi: paginile pare', back?.evenPage?.header === 'Titlul cărții' && back?.evenPage?.footer === 'Stânga' && back?.header === 'Capitolul 1', JSON.stringify(back));

// .odt: style:header-left / style:footer-left în pagina de bază, în ordinea cerută (header, header-left, footer, footer-left).
const odt = await JSZip.loadAsync(await docToOdt(doc, page));
const styles = await odt.file('styles.xml').async('string');
const master = styles.match(/<style:master-page[\s\S]*<\/style:master-page>/)?.[0] ?? '';
check('.odt are style:header-left cu textul lui', /<style:header-left><text:p[^>]*>Titlul cărții<\/text:p><\/style:header-left>/.test(master), master);
check('.odt are style:footer-left cu textul și numărul', /<style:footer-left>[\s\S]*Stânga[\s\S]*text:page-number[\s\S]*<\/style:footer-left>/.test(master));
check('.odt: ordinea elementelor', master.indexOf('<style:header>') < master.indexOf('<style:header-left>') && master.indexOf('<style:header-left>') < master.indexOf('<style:footer>') && master.indexOf('<style:footer>') < master.indexOf('<style:footer-left>'));

// Fișierul Suite.
const sd = parseDoc(serializeDoc(doc, page)).page;
check('.sdoc păstrează paginile pare', JSON.stringify(sd.evenPage) === JSON.stringify(page.evenPage), JSON.stringify(sd));
const bad = parseDoc(JSON.stringify({ format: 'suite-doc', version: 1, content: doc, page: { header: '', footer: '', numbers: false, evenPage: 5 } })).page;
check('evenPage stricat se ignoră', bad.evenPage === undefined);

console.log(fail ? `${fail} GREȘELI` : 'Toate verificările au trecut.');
process.exit(fail ? 1 : 0);
