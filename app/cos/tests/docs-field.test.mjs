// Test pentru câmpurile din Docs (field.ts): valorile, exportul .docx (câmp Word complet) și importul înapoi.
// Rulare (în suite/): node tests/docs-field.test.mjs
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
const out = join(tmpdir(), `suite-docsfield-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts'; export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export * from './src/docs/field.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx, docxToHtml, docToOdt, odtToHtml, fieldValue, fieldKindOf, markFieldsXml, fieldsFromMarks } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };

// Valorile.
const fakeDoc = { content: { size: 10 }, textBetween: () => 'Unu doi  trei' };
const ctx = { file: 'Contract.docx', props: { author: 'Ana Pop' }, date: new Date(2026, 9, 24, 9, 5), pageOf: () => ({ page: 2, pages: 5 }) };
check('data', fieldValue('DATE', fakeDoc, 0, ctx) === '24.10.2026');
check('ora', fieldValue('TIME', fakeDoc, 0, ctx) === '09:05');
check('autor', fieldValue('AUTHOR', fakeDoc, 0, ctx) === 'Ana Pop');
check('titlu din numele fișierului', fieldValue('TITLE', fakeDoc, 0, ctx) === 'Contract');
check('subiect gol', fieldValue('SUBJECT', fakeDoc, 0, ctx) === '[Subiect]');
check('pagina', fieldValue('PAGE', fakeDoc, 0, ctx) === '2' && fieldValue('NUMPAGES', fakeDoc, 0, ctx) === '5');
check('cuvinte / caractere', fieldValue('NUMWORDS', fakeDoc, 0, ctx) === '3' && fieldValue('NUMCHARS', fakeDoc, 0, ctx) === '10');
check('instrucțiune cu format', fieldKindOf(' DATE \\@ "d MMMM yyyy" ') === 'DATE' && fieldKindOf('HYPERLINK x') === null);

// Export .docx: câmp Word complet, cu rezultatul.
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'text', text: 'Autor: ' },
  { type: 'text', text: 'Ana & Pop', marks: [{ type: 'docField', attrs: { kind: 'AUTHOR' } }] },
  { type: 'text', text: ', pagini: ' },
  { type: 'text', text: '5', marks: [{ type: 'bold' }, { type: 'docField', attrs: { kind: 'NUMPAGES' } }] },
  { type: 'text', text: ', azi ' },
  { type: 'text', text: '24.10.2026', marks: [{ type: 'docField', attrs: { kind: 'DATE' } }] },
] }] };
const docx = await docToDocx(doc);
const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
check('Word: AUTHOR', /<w:instrText xml:space="preserve"> AUTHOR <\/w:instrText>/.test(xml), xml.slice(0, 2000));
check('Word: NUMPAGES', xml.includes('> NUMPAGES <'));
check('Word: DATE cu format', xml.includes('> DATE \\@ dd.MM.yyyy <'));
check('Word: rezultatul scris', xml.includes('<w:t xml:space="preserve">Ana &amp; Pop</w:t>'));
check('Word: fără semne rămase', !/[⦀⦃⦄]/.test(xml));

// Înapoi: câmpurile redevin câmpuri.
const back = await docxToHtml(docx);
check('înapoi: AUTHOR', back.html.includes('<span data-field="AUTHOR">Ana &amp; Pop</span>'), back.html);
check('înapoi: NUMPAGES aldin', /<span data-field="NUMPAGES"><strong>5<\/strong><\/span>/.test(back.html), back.html);
check('înapoi: DATE', back.html.includes('<span data-field="DATE">24.10.2026</span>'), back.html);

// .odt: câmpuri ODF (text:initial-creator, text:page-count, text:date) dus-întors.
const odt = await docToOdt(doc);
const cxml = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
check('odt: autor', cxml.includes('<text:initial-creator>Ana &amp; Pop</text:initial-creator>'), cxml.slice(cxml.indexOf('<office:text'), cxml.indexOf('<office:text') + 800));
check('odt: pagini în span aldin', /<text:span [^>]*><text:page-count>5<.text:page-count><.text:span>/.test(cxml));
check('odt: dată', cxml.includes('<text:date text:fixed="false">24.10.2026</text:date>'));
const backOdt = await odtToHtml(odt);
const bh = backOdt.html ?? backOdt;
check('odt înapoi: AUTHOR', String(bh).includes('<span data-field="AUTHOR">Ana &amp; Pop</span>'), String(bh).slice(0, 600));
check('odt înapoi: NUMPAGES', String(bh).includes('data-field="NUMPAGES"'));
check('odt înapoi: DATE', String(bh).includes('<span data-field="DATE">24.10.2026</span>'));

// fldSimple și câmpurile din alte câmpuri.
const M = '#';
const simple = '<w:p><w:fldSimple w:instr=" FILENAME "><w:r><w:t>a.docx</w:t></w:r></w:fldSimple></w:p>';
check('fldSimple', markFieldsXml(simple, M).includes('#QFILENAME#'));
const nested = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>TOC</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>'
  + '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>3</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>'
  + '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
check('câmp din cuprins rămâne text', !markFieldsXml(nested, M).includes('#Q'));
check('semne fără câmp cunoscut', fieldsFromMarks('#QXYZ#a#q#', M) === 'a' && fieldsFromMarks('#QPAGE#</p><p>x#q#', M) === '</p><p>x');

console.log(fail ? `${fail} GREȘITE` : 'Toate testele de câmpuri au trecut.');
process.exit(fail ? 1 : 0);
