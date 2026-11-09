// Test pentru exportul Docs în .odt (LibreOffice): XML corect, apoi citit înapoi cu importul nostru .odt.
// Rulare (în suite/): node tests/docs-odt-export.test.mjs
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
const out = join(tmpdir(), `suite-docsodt-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, odtToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}`); if (!ok) fail++; };
const t = (text, marks) => ({ type: 'text', text, ...(marks ? { marks } : {}) });
const p = (...c) => ({ type: 'paragraph', content: c });
const li = (...c) => ({ type: 'listItem', content: c });
const cell = (txt, attrs = {}) => ({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, ...attrs }, content: [p(t(txt))] });
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const doc = { type: 'doc', content: [
  { type: 'paragraph', attrs: { pstyle: 'title' }, content: [t('Raport anual')] },
  { type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [t('Capitol')] },
  p(t('Aldin', [{ type: 'bold' }]), t('  două spații\tși tab '), t('roșu', [{ type: 'textStyle', attrs: { color: '#ff0000', fontSize: '14pt' } }]),
    t(' link', [{ type: 'link', attrs: { href: 'https://exemplu.ro' } }]), { type: 'hardBreak' }, t('Șt & <ă>'), { type: 'footnote', attrs: { text: 'Nota unu' } }),
  { type: 'paragraph', attrs: { indent: 2, lineHeight: '1.5', spaceBefore: 6, box: true, shade: '#fff2cc' }, content: [t('Retras')] },
  { type: 'bulletList', content: [li(p(t('mere'))), li(p(t('pere')), { type: 'orderedList', attrs: { start: 3 }, content: [li(p(t('sub')))] })] },
  { type: 'blockquote', content: [p(t('Citat'))] },
  { type: 'table', content: [
    { type: 'tableRow', content: [cell('A', { colspan: 2, backgroundColor: '#ddeeff' }), cell('C', { rowspan: 2 })] },
    { type: 'tableRow', content: [cell('D'), cell('E')] },
  ] },
  { type: 'image', attrs: { src: png, width: 50, align: 'center', caption: 'Figura 1' } },
  { type: 'pageBreak' },
  p(t('Final')),
] };
const page = { header: 'Antet SRL', footer: 'Confidențial', numbers: true, landscape: true, margin: 20, paper: 'A5', margins: { top: 20, bottom: 20, left: 30, right: 15 }, props: { title: 'Raport', author: 'Ana', keywords: 'a, b', label: 'confidential' } };
const bytes = await docToOdt(doc, page);
const zip = await JSZip.loadAsync(bytes);
check('arhivă: mimetype primul, necomprimat', Object.keys(zip.files)[0] === 'mimetype' && new TextDecoder().decode(bytes.slice(30, 38)) === 'mimetype' && new TextDecoder().decode(bytes.slice(38, 77)) === 'application/vnd.oasis.opendocument.text');
let bad = '';
for (const f of ['content.xml', 'styles.xml', 'meta.xml', 'META-INF/manifest.xml']) {
  const xml = await zip.file(f).async('string');
  new DOMParser({ onError: (lvl, msg) => { if (lvl !== 'warning') bad += `${f}: ${msg}\n`; } }).parseFromString(xml, 'text/xml');
}
check('XML corect în toate cele 4 fișiere', !bad);
if (bad) console.log(bad);
const content = await zip.file('content.xml').async('string');
const styles = await zip.file('styles.xml').async('string');
check('spațiile și Tab-ul păstrate', content.includes('<text:s/><text:s text:c="1"/>două spații<text:tab/>și tab'));
check('legătura', content.includes('xlink:href="https://exemplu.ro"'));
check('nota de subsol', content.includes('<text:note-citation>1</text:note-citation>') && content.includes('Nota unu'));
check('celulele unite (2 coloane, 2 rânduri)', content.includes('table:number-columns-spanned="2"') && content.includes('table:number-rows-spanned="2"')
  && (content.match(/<table:covered-table-cell\/>/g) ?? []).length === 2 && content.includes('table:number-columns-repeated="3"'));
check('imaginea în Pictures/', !!zip.file('Pictures/imagine1.png') && content.includes('xlink:href="Pictures/imagine1.png"'));
check('pagina A5 culcată, margini', styles.includes('fo:page-width="210mm" fo:page-height="148mm"') && styles.includes('fo:margin-left="30mm"'));
check('antet, subsol, numerele paginilor', styles.includes('Antet SRL') && styles.includes('Confidențial') && styles.includes('<text:page-number'));
check('meta: titlu, autor, 2 cuvinte cheie', (await zip.file('meta.xml').async('string')).includes('<dc:title>Raport</dc:title>') && (await zip.file('meta.xml').async('string')).split('<meta:keyword>').length === 3);

const back = await odtToHtml(bytes);
const h = back.html;
check('înapoi: Titlu document', /<p[^>]*data-pstyle="title"[^>]*>.*Raport anual/.test(h));
check('înapoi: Titlu 2 centrat', /<h2 style="text-align: center"[^>]*>(<[^>]+>)*Capitol(<\/[a-z]+>)*<\/h2>/.test(h));
check('înapoi: aldin, culoare, mărime', h.includes('<strong>Aldin</strong>') && /color: #ff0000/.test(h) && /font-size: 14pt/.test(h));
check('înapoi: diacritice și caractere speciale', h.includes('Șt &amp; &lt;ă&gt;'));
check('înapoi: paragraf retras, cu chenar și fundal', /data-indent="2"/.test(h) && /data-box="1"/.test(h) && /data-shade="#fff2cc"/.test(h));
check('înapoi: liste', /<ul>.*mere.*<ol[^>]*>.*sub/s.test(h));
check('înapoi: tabel cu celule unite', /colspan="2"/.test(h) && /rowspan="2"/.test(h));
check('înapoi: imaginea', /<img[^>]+src="data:image\/png/.test(h));
check('înapoi: pagina', back.layout?.paper === 'A5' && back.layout?.landscape === true);
check('înapoi: proprietățile', back.layout?.props?.title === 'Raport' && back.layout?.props?.author === 'Ana');
check('înapoi: clasificarea (meta:user-defined Clasificare)', back.layout?.props?.label === 'confidential', JSON.stringify(back.layout?.props));
check('înapoi: ruperea de pagină', h.includes('Figura 1</em></span></p><div data-page-break=""></div><p') && !h.includes('<p data-line-height="1.15" data-space-before="0" data-space-after="6"></p>'));
if (fail) console.log(h);
// Chenarul ales (laturi, linie, culoare) în .odt și înapoi.
const bl = ['tb-double-2563eb', 'left-single-dc2626', 'bottom-dotted-16a34a', 'all-thick-000000'];
const bdoc = { type: 'doc', content: bl.map((l, i) => ({ type: 'paragraph', attrs: { box: true, boxLook: l }, content: [t('Chenar ' + i)] })) };
const bodt = await docToOdt(bdoc, { header: '', footer: '', numbers: false });
const bcontent = await (await JSZip.loadAsync(bodt)).file('content.xml').async('string');
check('.odt: sus și jos dublă albastră, bară roșie în stânga', /fo:border-top="2.2pt double #2563eb" fo:border-bottom="2.2pt double #2563eb"/.test(bcontent) && /fo:border-left="3pt solid #dc2626"/.test(bcontent));
const bh = (await odtToHtml(bodt)).html;
check('.odt înapoi: chenarele se citesc la fel', bl.every((l) => bh.includes(`data-box-look="${l}"`)));
if (fail) console.log(bcontent.slice(0, 3000), bh);
console.log(fail ? `${fail} greșite` : 'Toate trec.');
process.exit(fail ? 1 : 0);
