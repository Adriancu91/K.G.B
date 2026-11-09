// Test pentru letrină în Docs: export Word (cadru dropCap pe 3 rânduri, prima literă separată) și LibreOffice (style:drop-cap), citită înapoi din .odt.
// Rulare (în suite/): node tests/docs-dropcap.test.mjs
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
const out = join(tmpdir(), `suite-docsdc-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, odtToHtml, docToDocx, docxToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const doc = { type: 'doc', content: [
  { type: 'paragraph', attrs: { dropCap: true }, content: [{ type: 'text', text: 'Într-o zi de toamnă', marks: [{ type: 'bold' }] }, { type: 'text', text: ' a plouat.' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Al doilea paragraf.' }] },
] };

const xml = await (await JSZip.loadAsync(await docToDocx(doc))).file('word/document.xml').async('string');
check('Word: cadru dropCap pe 3 rânduri', /<w:framePr[^>]*w:dropCap="drop"[^>]*w:lines="3"/.test(xml) || /<w:framePr[^>]*w:lines="3"[^>]*w:dropCap="drop"/.test(xml), xml.match(/<w:framePr[^>]*>/)?.[0]);
const paras = [...xml.matchAll(/<w:p>([^]*?)<\/w:p>|<w:p [^>]*>([^]*?)<\/w:p>/g)].map((m) => [...(m[1] ?? m[2]).matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((t) => t[1]).join(''));
check('Word: prima literă separată (Î)', paras[0] === 'Î', JSON.stringify(paras));
check('Word: restul paragrafului', paras[1] === 'ntr-o zi de toamnă a plouat.', JSON.stringify(paras));
check('Word: litera mare (42 pt) și aldină', /<w:b\/>[^]*?<w:sz w:val="84"\/>/.test(xml.split('</w:p>')[0]));

const backW = (await docxToHtml(await docToDocx(doc))).html;
const firstP = backW.split('</p>')[0];
check('Word → înapoi: letrina pe primul paragraf, cu tot textul', firstP.startsWith('<p data-dropcap="">') && firstP.replace(/<[^>]+>/g, '') === 'Într-o zi de toamnă a plouat.', backW.slice(0, 300));
check('Word → înapoi: o singură letrină', backW.split('data-dropcap').length === 2, backW);
check('Word → înapoi: litera fără mărimea mare', !backW.includes('font-size: 42pt'));
check('Word → înapoi: al doilea paragraf neatins', backW.includes('<p>Al doilea paragraf.</p>'), backW);

const odt = await docToOdt(doc);
const c = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
check('LibreOffice: style:drop-cap', c.includes('<style:drop-cap style:length="1" style:lines="3" style:distance="0.1cm"/>'));
const back = (await odtToHtml(odt)).html;
check('LibreOffice → înapoi: letrina', /<p[^>]*data-dropcap=""[^>]*>.*Într-o zi/.test(back), back);
check('LibreOffice → înapoi: al doilea fără', !/data-dropcap[^>]*>Al doilea/.test(back));

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
