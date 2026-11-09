// Test pentru Titlu 4–6 în Docs: export .docx (stilurile Heading4–6), import înapoi (h4–h6), cuprinsul Word doar cu Titlu 1–3.
// Rulare (în suite/): node tests/docs-headings.test.mjs
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
const out = join(tmpdir(), `suite-docshead-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { normalizeHref } from './src/docs/link.ts'; export { parseDoc, serializeDoc, pageMargins } from './src/docs/format.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx, docxToHtml, normalizeHref, parseDoc, serializeDoc, pageMargins } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}`); if (!ok) fail++; };

const h = (level, text) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
const doc = { type: 'doc', content: [{ type: 'tableOfContents' }, h(1, 'Unu'), h(3, 'Trei'), h(4, 'Patru'), h(5, 'Cinci'), h(6, 'Șase'), { type: 'paragraph', content: [{ type: 'text', text: 'Text' }] }] };
const bytes = await docToDocx(doc);
const xml = await (await JSZip.loadAsync(bytes)).file('word/document.xml').async('string');
for (const n of [4, 5, 6]) check(`Word: stilul Heading${n}`, xml.includes(`<w:pStyle w:val="Heading${n}"/>`));
check('cuprinsul Word: Titlu 3 da, Titlu 4 nu', xml.split('>Trei<').length === 3 && xml.split('>Patru<').length === 2);
const { html } = await docxToHtml(bytes);
check('import: <h4>Patru</h4>', /<h4>Patru<\/h4>/.test(html));
check('import: <h5>Cinci</h5>', /<h5>Cinci<\/h5>/.test(html));
check('import: <h6>Șase</h6>', /<h6>Șase<\/h6>/.test(html));
check('import: <h3>Trei</h3> rămâne', /<h3>Trei<\/h3>/.test(html));
// Titlu document / Subtitlu (stilurile Title / Subtitle din Word).
const p = (pstyle, text) => ({ type: 'paragraph', attrs: { pstyle }, content: [{ type: 'text', text }] });
const tb = await docToDocx({ type: 'doc', content: [p('title', 'Raport anual'), p('subtitle', 'Anul 2026'), p(null, 'Text')] });
const tz = await JSZip.loadAsync(tb);
const txml = await tz.file('word/document.xml').async('string');
const sxml = await tz.file('word/styles.xml').async('string');
const before = (s, a, b) => s.indexOf(a) >= 0 && s.indexOf(a) < s.indexOf(b);
check('Word: stilul Title', before(txml, '<w:pStyle w:val="Title"/>', 'Raport anual'));
check('Word: stilul Subtitle', before(txml, '<w:pStyle w:val="Subtitle"/>', 'Anul 2026') && !before(txml, '<w:pStyle w:val="Subtitle"/>', 'Raport anual'));
check('Word: Subtitle definit în styles.xml', sxml.includes('w:styleId="Subtitle"'));
const th = (await docxToHtml(tb)).html;
check('import: <p class="doc-title">', th.includes('<p class="doc-title">Raport anual</p>'));
check('import: <p class="doc-subtitle">', th.includes('<p class="doc-subtitle">Anul 2026</p>'));
check('import: textul rămâne normal', th.includes('<p>Text</p>'));
// Ruperea de pagină (Ctrl+Enter) trece prin Word și înapoi, și cea din mijlocul unui paragraf din Word.
const pb = await docToDocx({ type: 'doc', content: [p(null, 'Unu'), { type: 'pageBreak' }, p(null, 'Doi')] });
check('import: ruperea de pagină', (await docxToHtml(pb)).html === '<p>Unu</p><div data-page-break=""></div><p>Doi</p>');
const zpb = await JSZip.loadAsync(pb);
const dx = await zpb.file('word/document.xml').async('string');
zpb.file('word/document.xml', dx.replace('<w:t xml:space="preserve">Unu</w:t>', '<w:t xml:space="preserve">Unu</w:t><w:br w:type="page"/><w:t xml:space="preserve">Mijloc</w:t>'));
const mid = (await docxToHtml(await zpb.generateAsync({ type: 'uint8array' }))).html;
check('import: ruperea în mijlocul paragrafului', mid.startsWith('<p>Unu</p><div data-page-break=""></div><p>Mijloc</p>'));
// „Pagină nouă înainte” pe paragraf (w:pageBreakBefore), cum o pun des capitolele din Word; w:val="0" nu rupe.
const bb = await docToDocx({ type: 'doc', content: [p(null, 'Unu'), h(2, 'Cap'), h(3, 'Sub')] });
const zbb = await JSZip.loadAsync(bb);
const bx = await zbb.file('word/document.xml').async('string');
zbb.file('word/document.xml', bx.replace('<w:pStyle w:val="Heading2"/>', '<w:pStyle w:val="Heading2"/><w:pageBreakBefore/>').replace('<w:pStyle w:val="Heading3"/>', '<w:pStyle w:val="Heading3"/><w:pageBreakBefore w:val="0"/>'));
const bh = (await docxToHtml(await zbb.generateAsync({ type: 'uint8array' }))).html;
check('import: pagină nouă înainte de titlu', bh === '<p>Unu</p><div data-page-break=""></div><h2>Cap</h2><h3>Sub</h3>');
// Aceeași opțiune pusă în stilul „Heading 3” din styles.xml: fiecare Titlu 3 începe pe pagină nouă, dar nu primul rând al documentului.
const sb = await docToDocx({ type: 'doc', content: [h(3, 'Primul'), p(null, 'x'), h(3, 'Al doilea'), h(2, 'Fără')] });
const zsb = await JSZip.loadAsync(sb);
const sx = await zsb.file('word/styles.xml').async('string');
const at = sx.indexOf('w:styleId="Heading3"');
zsb.file('word/styles.xml', sx.slice(0, at) + sx.slice(at).replace('<w:qFormat/>', '<w:qFormat/><w:pPr><w:pageBreakBefore/></w:pPr>'));
const sh = (await docxToHtml(await zsb.generateAsync({ type: 'uint8array' }))).html;
check('import: pagină nouă din stilul Word', sh === '<h3>Primul</h3><p>x</p><div data-page-break=""></div><h3>Al doilea</h3><h2>Fără</h2>');
if (fail) console.log(xml.slice(0, 3000), html, th, mid, bh, sh);
console.log(fail ? `${fail} greșite` : 'Toate trec.');
process.exit(fail ? 1 : 0);
