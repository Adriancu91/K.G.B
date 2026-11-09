// Test pentru limba de verificare a textului ales din Docs (Revizuire → Limba textului ales): .docx (w:lang, w:noProof) scris și citit înapoi,
// limba principală a documentului nesemnată pe fiecare bucată. Rulare (în suite/): node tests/docs-proof-lang.test.mjs
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
const out = join(tmpdir(), `suite-proof-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx, docxToHtml, docToOdt, odtToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' → ' + info}`); if (!ok) fail++; };
const run = (text, proofLang) => ({ type: 'text', text, ...(proofLang ? { marks: [{ type: 'textStyle', attrs: { proofLang } }] } : {}) });
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
  run('Un text obișnuit în română, destul de lung ca să fie limba principală. '), run('Hello world', 'en-US'), run(' și '), run('ABC-123-XYZ', 'none'), run(' gata.'),
] }] };
const bytes = await docToDocx(doc);
const xml = await (await JSZip.loadAsync(bytes)).file('word/document.xml').async('string');
const rPrOf = (t) => { const i = xml.indexOf('>' + t + '<'); const a = xml.lastIndexOf('<w:r>', i); return xml.slice(a, i); };
check('.docx: w:lang en-US pe „Hello world”', /<w:lang w:val="en-US"\/>/.test(rPrOf('Hello world')), rPrOf('Hello world'));
check('.docx: w:noProof pe cod', rPrOf('ABC-123-XYZ').includes('<w:noProof/>'), rPrOf('ABC-123-XYZ'));
check('.docx: textul obișnuit fără limbă', !rPrOf(' și ').includes('w:lang') && !rPrOf(' și ').includes('noProof'), rPrOf(' și '));
const html = (await docxToHtml(bytes)).html;
check('.docx citit: engleza pe „Hello world”', /--proof-lang: en-US[^"]*"[^>]*>Hello world</.test(html), html.slice(0, 400));
check('.docx citit: „nu verifica” pe cod', /--proof-lang: none[^"]*"[^>]*>ABC-123-XYZ</.test(html), html.slice(0, 400));
check('.docx citit: doar două bucăți marcate', (html.match(/--proof-lang/g) ?? []).length, 2);

// Un fișier în care tot textul are w:lang (cum scriu de obicei programele): limba principală nu se pune pe fiecare bucată.
const zip = await JSZip.loadAsync(bytes);
const all = xml.replace(/<w:r>(?!<w:rPr>)/g, '<w:r><w:rPr><w:lang w:val="en-GB"/></w:rPr>');
zip.file('word/document.xml', all);
const html2 = (await docxToHtml(await zip.generateAsync({ type: 'uint8array' }))).html;
const got2 = [(html2.match(/--proof-lang: en-GB/g) ?? []).length, /--proof-lang: en-US/.test(html2), /--proof-lang: none/.test(html2)];
check('limba principală (en-GB) nesemnată, engleza SUA și „nu verifica” păstrate', got2.join() === '0,true,true', got2.join() + ' ' + html2.slice(0, 300));
// .odt: fo:language + fo:country, „nu verifica” = zxx; citite înapoi.
const odt = await docToOdt(doc);
const cx = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
check('.odt: fo:language en / fo:country US și zxx', cx.includes('fo:language="en" fo:country="US"') && cx.includes('fo:language="zxx"'), cx.slice(0, 300));
const oh = (await odtToHtml(odt)).html;
check('.odt citit: engleza și „nu verifica”', /--proof-lang: en-US[^"]*"[^>]*>Hello world</.test(oh) && /--proof-lang: none[^"]*"[^>]*>ABC-123-XYZ</.test(oh) && (oh.match(/--proof-lang/g) ?? []).length === 2, oh.slice(0, 400));
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
