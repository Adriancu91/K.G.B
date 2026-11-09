// Test pentru stilurile de subliniere din Docs: dublă / groasă / punctată / cu liniuțe / ondulată și culoarea, în .docx și .odt, dus-întors.
// Rulare (în suite/): node tests/docs-underline.test.mjs
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
const out = join(tmpdir(), `suite-docsul-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, odtToHtml, docToDocx, docxToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };

const t = (text, style, color) => ({ type: 'text', text, marks: [{ type: 'underline', attrs: { style, color } }] });
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
  t('Dublu', 'double', '#c00000'), { type: 'text', text: ' ' }, t('Gros', 'thick', null), { type: 'text', text: ' ' }, t('Puncte', 'dotted', null),
  { type: 'text', text: ' ' }, t('Liniuțe', 'dashed', null), { type: 'text', text: ' ' }, t('Val', 'wavy', '#0563c1'), { type: 'text', text: ' ' }, t('Simplu', null, null),
] }] };

const docx = await docToDocx(doc);
const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
for (const [v, c] of [['double', 'C00000'], ['thick'], ['dotted'], ['dash'], ['wave', '0563C1']]) {
  const re = new RegExp(`<w:u w:val="${v}"${c ? ` w:color="${c}"` : ''}/>`, 'i');
  check(`Word: w:u ${v}${c ? ' ' + c : ''}`, re.test(xml), xml.match(/<w:u [^>]*>/g)?.join(' '));
}
check('Word: simplu rămâne single', /<w:u w:val="single"\/>/.test(xml));
const back = (await docxToHtml(docx)).html;
check('Word → înapoi: dublu roșu', back.includes('text-decoration: underline double #c00000'), back.slice(0, 600));
check('Word → înapoi: gros', back.includes('text-decoration: underline 2px'));
check('Word → înapoi: ondulat albastru', back.includes('text-decoration: underline wavy #0563c1'));
check('Word → înapoi: simplu ca <u>', /<u>Simplu<\/u>/.test(back));

const odt = await docToOdt(doc);
const content = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
check('LibreOffice: dublu', content.includes('style:text-underline-style="solid" style:text-underline-type="double" style:text-underline-width="auto" style:text-underline-color="#c00000"'));
check('LibreOffice: ondulat', content.includes('style:text-underline-style="wave"'));
check('LibreOffice: gros', content.includes('style:text-underline-width="bold"'));
const back2 = (await odtToHtml(odt)).html;
check('LibreOffice → înapoi: dublu roșu', back2.includes('<u style="text-decoration-style: double; text-decoration-color: #c00000">Dublu</u>'), back2.slice(0, 800));
check('LibreOffice → înapoi: punctat', back2.includes('<u style="text-decoration-style: dotted">Puncte</u>'));
check('LibreOffice → înapoi: gros', back2.includes('<u style="text-decoration-thickness: 2px">Gros</u>'));
check('LibreOffice → înapoi: simplu', back2.includes('<u>Simplu</u>'));

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
