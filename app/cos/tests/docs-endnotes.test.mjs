// Test pentru notele de final din Docs: export Word (endnotes.xml) și LibreOffice (note-class endnote), citite înapoi ca note de final.
// Rulare (în suite/): node tests/docs-endnotes.test.mjs
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
const out = join(tmpdir(), `suite-docsen-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, odtToHtml, docToDocx, docxToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'text', text: 'Text' }, { type: 'footnote', attrs: { text: 'Nota de jos' } }, { type: 'text', text: ' și final' }, { type: 'footnote', attrs: { text: 'Sursa: INS 2026', end: true } },
] }] };

const docx = await docToDocx(doc);
const z = await JSZip.loadAsync(docx);
const en = await z.file('word/endnotes.xml')?.async('string');
check('Word: endnotes.xml cu textul', !!en && en.includes('Sursa: INS 2026'));
check('Word: nota de subsol rămâne în footnotes.xml', ((await z.file('word/footnotes.xml')?.async('string')) ?? '').includes('Nota de jos'));
check('Word: trimitere w:endnoteReference', (await z.file('word/document.xml').async('string')).includes('<w:endnoteReference'));
const back = (await docxToHtml(docx)).html;
check('Word → înapoi: nota de final', back.includes('<sup data-footnote="Sursa: INS 2026" data-endnote=""></sup>'), back);
check('Word → înapoi: nota de subsol', back.includes('<sup data-footnote="Nota de jos"></sup>'));

const odt = await docToOdt(doc);
const c = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
check('LibreOffice: note-class endnote', c.includes('text:note-class="endnote"') && c.includes('text:note-class="footnote"'));
const back2 = (await odtToHtml(odt)).html;
check('LibreOffice → înapoi: nota de final', back2.includes('<sup data-footnote="Sursa: INS 2026" data-endnote=""></sup>'), back2);
check('LibreOffice → înapoi: nota de subsol', back2.includes('<sup data-footnote="Nota de jos"></sup>'));

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
