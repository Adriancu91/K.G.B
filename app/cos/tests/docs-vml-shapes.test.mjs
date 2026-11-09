// Test: textul din formele VML (ovalul, arcul, linia… din rezerva mc:Fallback) ajunge în documentul importat din .docx.
// Rulare (în suite/): node tests/docs-vml-shapes.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
const out = join(tmpdir(), `suite-docsvml-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml, vmlTextShapes, oneBody } from './src/docs/docxImport.ts'; export { NO_PAGE_SETUP } from './src/docs/format.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx, docxToHtml, vmlTextShapes, oneBody, NO_PAGE_SETUP } = await import(pathToFileURL(out).href);

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
check('v:oval / v:line devin v:shape, v:linestyle rămâne', vmlTextShapes('<v:oval id="a"><v:textbox/></v:oval><v:line/><v:linestyle/>') === '<v:shape id="a"><v:textbox/></v:shape><v:shape/><v:linestyle/>');

const docx = await docToDocx({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Înainte' }] }] }, NO_PAGE_SETUP);
const zip = await JSZip.loadAsync(docx);
const xml = await zip.file('word/document.xml').async('string');
const para = (t) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
const box = (t) => `<v:textbox><w:txbxContent>${para(t)}</w:txbxContent></v:textbox>`;
const shapes = '<w:p><w:r><mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="wps"><w:t>nimic</w:t></mc:Choice><mc:Fallback>'
  + `<w:pict xmlns:v="urn:schemas-microsoft-com:vml"><v:oval style="width:100pt;height:50pt">${box('Text în oval')}</v:oval><v:arc>${box('Text în arc')}</v:arc></w:pict>`
  + '</mc:Fallback></mc:AlternateContent></w:r></w:p>';
zip.file('word/document.xml', xml.replace('<w:sectPr', shapes + '<w:sectPr'));
const { html } = await docxToHtml(await zip.generateAsync({ type: 'uint8array' }));
check('.docx: textul din oval ajunge în document', html.includes('Text în oval'), html.slice(0, 400));
check('.docx: textul din arc ajunge în document', html.includes('Text în arc'), html.slice(0, 400));
check('.docx: textul de dinainte rămâne', html.includes('Înainte'));

// Document stricat cu trei w:body: tot textul ajunge în document.
check('oneBody unește corpurile', oneBody('<w:document><w:body><w:p/></w:body>\n<w:body><w:p/></w:body></w:document>') === '<w:document><w:body><w:p/><w:p/></w:body></w:document>');
const bodies = [1, 2, 3].map((i) => `<w:body>${para('Corpul ' + i)}</w:body>`).join('\n');
zip.file('word/document.xml', '<?xml version="1.0" encoding="utf-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' + bodies + '</w:document>');
const many = (await docxToHtml(await zip.generateAsync({ type: 'uint8array' }))).html;
check('.docx cu trei w:body: toate trei corpurile ajung', ['Corpul 1', 'Corpul 2', 'Corpul 3'].every((t) => many.includes(t)), many.slice(0, 300));
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
