// Test pentru „Prima pagină diferită” din Docs: .docx (w:titlePg + antet/subsol „first”), .odt (style:header-first), fișierul Suite.
// Rulare (în suite/): node tests/docs-firstpage.test.mjs
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
const out = join(tmpdir(), `suite-docsfirst-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { parseDoc, serializeDoc } from './src/docs/format.ts'; export { docToDocx } from './src/docs/docx.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, parseDoc, serializeDoc, docToDocx } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Copertă' }] }] };
const page = { header: 'Raport anual', footer: 'Confidențial', numbers: true, firstPage: { header: '', footer: 'Cluj, 2026', numbers: false } };

// .docx: w:titlePg și câte un antet / subsol „first”, cu textul lor.
const zip = await JSZip.loadAsync(await docToDocx(doc, page));
const xml = await zip.file('word/document.xml').async('string');
const rels = await zip.file('word/_rels/document.xml.rels').async('string');
check('.docx are w:titlePg', /<w:titlePg\/>|<w:titlePg [^>]*\/>/.test(xml), xml.match(/<w:sectPr[\s\S]*<\/w:sectPr>/)?.[0]);
check('.docx are antet „first”', /<w:headerReference w:type="first"/.test(xml));
check('.docx are subsol „first”', /<w:footerReference w:type="first"/.test(xml));
const target = (kind) => {
  const rid = xml.match(new RegExp(`<w:${kind}Reference w:type="first" r:id="([^"]+)"`))?.[1];
  return rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
};
const firstFooter = await zip.file('word/' + target('footer'))?.async('string');
check('subsolul primei pagini are textul lui, fără număr', !!firstFooter && firstFooter.includes('Cluj, 2026') && !firstFooter.includes('PAGE'), firstFooter);
const firstHeader = await zip.file('word/' + target('header'))?.async('string');
check('antetul primei pagini e gol', !!firstHeader && !firstHeader.includes('Raport anual'), firstHeader);
const allFooters = await Promise.all(Object.keys(zip.files).filter((f) => /^word\/footer\d*\.xml$/.test(f)).map((f) => zip.file(f).async('string')));
check('subsolul obișnuit are numărul paginii', allFooters.some((f) => f.includes('Confidențial') && f.includes('PAGE')));

// Fără „Prima pagină diferită” nu apare w:titlePg.
const plain = await (await JSZip.loadAsync(await docToDocx(doc, { ...page, firstPage: undefined }))).file('word/document.xml').async('string');
check('fără bifă: nici w:titlePg', !plain.includes('titlePg'));

// .odt: style:header-first / style:footer-first în pagina de bază.
const odt = await JSZip.loadAsync(await docToOdt(doc, page));
const styles = await odt.file('styles.xml').async('string');
check('.odt are style:footer-first cu textul lui', /<style:footer-first>[\s\S]*Cluj, 2026[\s\S]*<\/style:footer-first>/.test(styles));
check('.odt are style:header-first gol', /<style:header-first><text:p[^>]*><\/text:p><\/style:header-first>/.test(styles), styles.match(/<style:master-page[\s\S]*<\/style:master-page>/)?.[0]);
check('.odt păstrează antetul obișnuit', /<style:header><text:p[^>]*>Raport anual<\/text:p><\/style:header>/.test(styles));

// Fișierul Suite păstrează prima pagină; un firstPage stricat se ignoră.
const back = parseDoc(serializeDoc(doc, page)).page;
check('.sdoc păstrează prima pagină', JSON.stringify(back.firstPage) === JSON.stringify(page.firstPage), JSON.stringify(back));
const bad = parseDoc(JSON.stringify({ format: 'suite-doc', version: 1, content: doc, page: { header: '', footer: '', numbers: false, firstPage: 'x' } })).page;
check('firstPage stricat se ignoră', bad.firstPage === undefined);

console.log(fail ? `${fail} GREȘELI` : 'Toate verificările au trecut.');
process.exit(fail ? 1 : 0);
