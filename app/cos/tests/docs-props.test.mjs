// Test pentru proprietățile documentului în Docs: în Word (docProps/core.xml) și înapoi, în .sdoc, în pagina web.
// Rulare (în suite/): node tests/docs-props.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';

globalThis.DOMParser ??= DOMParser;
// xmldom nu are `children` (browserul are); fără el nu se citesc culorile și formatul literelor din XML-ul Word.
{
  const d = new DOMParser().parseFromString('<a><b/></a>', 'text/xml');
  let p = Object.getPrototypeOf(d.documentElement);
  while (p && !Object.prototype.hasOwnProperty.call(p, 'appendChild')) p = Object.getPrototypeOf(p);
  if (!('children' in d.documentElement)) Object.defineProperty(p ?? Object.getPrototypeOf(d.documentElement), 'children', { get() { return Array.from(this.childNodes).filter((c) => c.nodeType === 1); }, configurable: true });
}
// În browser listele de noduri și atribute se pot parcurge cu for…of; în xmldom le facem la fel.
{
  const d = new DOMParser().parseFromString('<a b="1"><c/></a>', 'text/xml');
  for (const list of [d.childNodes, d.documentElement.attributes, d.getElementsByTagName('c')]) {
    const proto = Object.getPrototypeOf(list);
    if (!proto[Symbol.iterator]) proto[Symbol.iterator] = Array.prototype[Symbol.iterator];
  }
}
const out = join(tmpdir(), `suite-docsprops-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { normalizeHref } from './src/docs/link.ts'; export { parseDoc, serializeDoc, pageMargins } from './src/docs/format.ts'; export { odtToHtml } from './src/docs/odtImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx, docxToHtml, normalizeHref, parseDoc, serializeDoc, pageMargins, odtToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}`); if (!ok) fail++; };

const props = { title: 'Contract & anexă', subject: 'Închiriere', author: 'Ana Pop', keywords: 'contract, 2026' };
const page = { header: '', footer: '', numbers: false, landscape: false, margin: 20, props };
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Text' }] }] };
const bytes = await docToDocx(doc, page);
const core = await (await JSZip.loadAsync(bytes)).file('docProps/core.xml').async('string');
check('Word: titlul', core.includes('<dc:title>Contract &amp; anexă</dc:title>'));
check('Word: subiectul', core.includes('<dc:subject>Închiriere</dc:subject>'));
check('Word: autorul', core.includes('<dc:creator>Ana Pop</dc:creator>'));
check('Word: cuvintele cheie', core.includes('<cp:keywords>contract, 2026</cp:keywords>'));
const back = (await docxToHtml(bytes)).layout?.props;
check('import Word: toate patru înapoi', JSON.stringify(back) === JSON.stringify(props));
const plain = await docToDocx(doc, { header: '', footer: '', numbers: false, landscape: false, margin: 20 });
check('fără proprietăți: autorul e Cyber Office Studio, importul nu inventează', (await (await JSZip.loadAsync(plain)).file('docProps/core.xml').async('string')).includes('<dc:creator>Cyber Office Studio</dc:creator>') && !(await docxToHtml(plain)).layout?.props);
const sd = parseDoc(serializeDoc(doc, page));
check('.sdoc: proprietățile rămân', JSON.stringify(sd.page?.props) === JSON.stringify(props));
const sd2 = parseDoc(serializeDoc(doc, { ...page, props: { title: '  ', author: 'x'.repeat(300) } }));
check('.sdoc: câmpurile goale cad, textul lung se taie la 200', JSON.stringify(sd2.page?.props) === JSON.stringify({ author: 'x'.repeat(200) }));
// LibreOffice: meta.xml (arhivă) și office:meta (.fodt plat).
const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"';
const metaXml = '<office:meta><dc:title>Proces verbal</dc:title><dc:subject>Ședință</dc:subject><meta:initial-creator>Ion</meta:initial-creator><dc:creator>Maria</dc:creator><meta:keyword>ședință</meta:keyword><meta:keyword>2026</meta:keyword></office:meta>';
const body = '<office:body><office:text><text:p>Text <text:meta>x</text:meta></text:p></office:text></office:body>';
const z = new JSZip();
z.file('mimetype', 'application/vnd.oasis.opendocument.text');
z.file('content.xml', '<?xml version="1.0"?><office:document-content ' + NS + '>' + body + '</office:document-content>');
z.file('meta.xml', '<?xml version="1.0"?><office:document-meta ' + NS + '>' + metaXml + '</office:document-meta>');
const want = { title: 'Proces verbal', subject: 'Ședință', author: 'Ion', keywords: 'ședință, 2026' };
const odt = await odtToHtml(new Uint8Array(await z.generateAsync({ type: 'arraybuffer' })));
check('.odt: proprietățile din meta.xml', JSON.stringify(odt.layout?.props) === JSON.stringify(want));
const flat = await odtToHtml(new TextEncoder().encode('<?xml version="1.0"?><office:document ' + NS + '>' + metaXml + body + '</office:document>'));
check('.fodt: proprietățile din office:meta', JSON.stringify(flat.layout?.props) === JSON.stringify(want));
const z2 = new JSZip(); z2.file('content.xml', '<?xml version="1.0"?><office:document-content ' + NS + '>' + body + '</office:document-content>');
check('.odt fără meta.xml: fără proprietăți', !(await odtToHtml(new Uint8Array(await z2.generateAsync({ type: 'arraybuffer' })))).layout?.props);
console.log(fail ? `${fail} greșite` : 'Toate trec.');
process.exit(fail ? 1 : 0);
