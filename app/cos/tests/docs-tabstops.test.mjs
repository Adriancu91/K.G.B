// Test pentru tabulator și opririle de tabulator din Docs: calculul lățimii, Word (w:tab, w:tabs) și LibreOffice (text:tab, style:tab-stops), dus-întors.
// Rulare (în suite/): node tests/docs-tabstops.test.mjs
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
const out = join(tmpdir(), `suite-docstabs-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml, tabStopsFrom, tabsToNodes } from './src/docs/docxImport.ts'; export { parseStops, formatStops, nextStop, tabWidth } from './src/docs/tabStops.ts'; export { docToText } from './src/docs/plainExport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
const TAB = String.fromCharCode(9);

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const near = (a, b) => Math.abs(a - b) < 0.001;

// Opririle: citire, ordine, dubluri, valori greșite.
check('parseStops sortează și scoate dublurile', m.formatStops(m.parseStops('15r. 3.5l 3.5c x 0l 99r 8d_')) === '3.5l 8d_ 15r.', m.formatStops(m.parseStops('15r. 3.5l 3.5c x 0l 99r 8d_')));
check('formatStops gol = null', m.formatStops([]) === null);
// Unde sare tabulatorul.
const st = m.parseStops('4l 10r.');
check('prima oprire proprie', m.nextStop(st, 1).pos === 4);
check('a doua oprire proprie', m.nextStop(st, 4).pos === 10 && m.nextStop(st, 4).leader === '.');
check('după ultima: opririle implicite (1,25 cm)', near(m.nextStop(st, 10.3).pos, 11.25));
check('fără opriri: din 1,25 în 1,25', near(m.nextStop([], 0).pos, 1.25) && near(m.nextStop([], 2.6).pos, 3.75));
// Lățimea: la stânga, centrat, la dreapta, la virgulă.
check('la stânga', near(m.tabWidth({ pos: 4, align: 'l', leader: '' }, 1, 2, 0), 3));
check('centrat', near(m.tabWidth({ pos: 8, align: 'c', leader: '' }, 2, 2, 0), 5));
check('la dreapta', near(m.tabWidth({ pos: 15, align: 'r', leader: '' }, 5, 3, 0), 7));
check('la virgulă', near(m.tabWidth({ pos: 10, align: 'd', leader: '' }, 2, 3, 1.5), 6.5));
check('textul nu încape: lățime 0', m.tabWidth({ pos: 6, align: 'r', leader: '' }, 5, 3, 0) === 0);

// Word: citirea opririlor din w:pPr.
check('w:tabs → opriri', m.tabStopsFrom('<w:tabs><w:tab w:val="left" w:pos="1985"/><w:tab w:val="clear" w:pos="4536"/><w:tab w:val="right" w:leader="dot" w:pos="9072"/><w:tab w:val="decimal" w:pos="5670"/></w:tabs>') === '3.5l 16r. 10d', m.tabStopsFrom('<w:tabs><w:tab w:val="left" w:pos="1985"/><w:tab w:val="clear" w:pos="4536"/><w:tab w:val="right" w:leader="dot" w:pos="9072"/><w:tab w:val="decimal" w:pos="5670"/></w:tabs>'));
check('tabsToNodes', m.tabsToNodes(`<p a="1">Nume${TAB}Prenume</p>`) === '<p a="1">Nume<span data-tab=""></span>Prenume</p>');

// Documentul cu tabulatori și opriri: Word dus-întors.
const doc = { type: 'doc', content: [
  { type: 'paragraph', attrs: { tabStops: '4l 16r.' }, content: [{ type: 'text', text: 'Capitolul 1' }, { type: 'tabChar' }, { type: 'text', text: '7' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'A' }, { type: 'tabChar' }, { type: 'text', text: 'B' }] },
] };
const docx = await m.docToDocx(doc);
const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
check('Word: w:tab în text', (xml.match(/<w:tab\/>/g) ?? []).length === 2, xml.slice(0, 400));
check('Word: opririle în w:tabs', /<w:tabs>.*w:val="left".*w:pos="2268".*<\/w:tabs>/.test(xml) && /w:val="right"[^>]*w:pos="9072"|w:pos="9072"[^>]*w:val="right"/.test(xml) && xml.includes('w:leader="dot"'), xml.slice(0, 1500));
const back = (await m.docxToHtml(docx)).html;
check('Word → înapoi: opriri și tabulatori', back.includes('<p data-tabs="4l 16r.">Capitolul 1<span data-tab=""></span>7</p>') && back.includes('<p>A<span data-tab=""></span>B</p>'), back);

// LibreOffice dus-întors.
const odt = await m.docToOdt(doc);
const c = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
check('LibreOffice: text:tab și style:tab-stops', (c.match(/<text:tab\/>/g) ?? []).length === 2 && c.includes('<style:tab-stops>') && c.includes('style:position="16.00cm" style:type="right" style:leader-style="dotted"'), c.slice(0, 3000));
const back2 = (await m.odtToHtml(odt)).html;
check('LibreOffice → înapoi', /<p[^>]*data-tabs="4l 16r\."[^>]*>Capitolul 1<span data-tab=""><\/span>7/.test(back2) && back2.includes('A<span data-tab=""></span>B'), back2);

// Text simplu: tabulatorul rămâne Tab.
check('Text simplu', m.docToText(doc).includes(`Capitolul 1${TAB}7`));

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
