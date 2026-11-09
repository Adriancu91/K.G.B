// Test pentru caseta de text din Docs: export .docx (cadru w:framePr cu chenar și fundal), .odt și text simplu.
// Rulare (în suite/): node tests/docs-textbox.test.mjs
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
const out = join(tmpdir(), `suite-docstb-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docToText } from './src/docs/plainExport.ts'; export { docxToHtml } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const mod = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
const { docToOdt, docToDocx } = mod;

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const doc = (attrs) => ({ type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'Text obișnuit înainte.' }] },
  { type: 'textBox', attrs, content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Citat important', marks: [{ type: 'bold' }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'al doilea rând' }] },
  ] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Text după casetă.' }] },
] });
const docxXml = async (d) => (await (await JSZip.loadAsync(await docToDocx(d))).file('word/document.xml').async('string'));

{
  const xml = await docxXml(doc({ align: 'wrapRight', width: 240, border: '#2563eb', fill: '#fef9c3' }));
  const frames = xml.match(/<w:framePr\b[^>]*>/g) ?? [];
  check('două paragrafe în cadru', frames.length === 2, String(frames.length));
  check('cadrul e în dreapta', frames.every((f) => f.includes('w:xAlign="right"')), frames[0]);
  check('lățime 240 px = 3600 twips', frames.every((f) => f.includes('w:w="3600"')), frames[0]);
  check('textul curge în jur', frames.every((f) => f.includes('w:wrap="around"')), frames[0]);
  check('chenar albastru', /<w:pBdr>[\s\S]*?w:color="2563EB"/i.test(xml));
  check('fundal galben', /w:fill="FEF9C3"/i.test(xml));
  check('textul casetei e acolo', xml.includes('Citat important') && xml.includes('al doilea rând'));
  const after = xml.slice(xml.indexOf('Text după casetă'));
  const lastP = xml.slice(xml.lastIndexOf('<w:p>', xml.indexOf('Text după casetă')), xml.indexOf('Text după casetă'));
  check('paragraful de după nu e în cadru', !lastP.includes('framePr') && after.length > 0);
}
{
  const xml = await docxXml(doc({ align: 'center', width: 300, border: '', fill: '' }));
  const f = (xml.match(/<w:framePr\b[^>]*>/) ?? [''])[0];
  check('pe rândul ei, centrat', f.includes('w:xAlign="center"') && f.includes('w:wrap="notBeside"'), f);
  check('fără chenar', !xml.includes('<w:pBdr>'));
}
{
  const zip = await JSZip.loadAsync(await docToOdt(doc({ align: 'wrapLeft', width: 200 })));
  const xml = await zip.file('content.xml').async('string');
  check('.odt păstrează textul casetei', xml.includes('Citat important') && xml.includes('al doilea rând'));
}
if (mod.docToText) {
  const t = mod.docToText(doc({}));
  check('text simplu cu textul casetei', t.includes('Citat important') && t.includes('Text după casetă.'));
}
{
  const bytes = await docToDocx(doc({ align: 'wrapLeft', width: 300, border: '#dc2626', fill: '#dcfce7' }));
  const res = await mod.docxToHtml(bytes);
  const html = typeof res === 'string' ? res : res.html ?? res.value ?? '';
  const box = /<div data-textbox=""[^>]*>([\s\S]*?)<\/div>/.exec(html);
  check('.docx citit înapoi: o casetă', !!box && (html.match(/data-textbox/g) ?? []).length === 1, html.slice(0, 600));
  check('caseta are ambele paragrafe', !!box && box[1].includes('Citat important') && box[1].includes('al doilea rând'), box?.[1]);
  check('caseta: stânga, 300 px, roșu, verde', !!box && box[0].includes('data-align="wrapLeft"') && box[0].includes('data-width="300"') && box[0].includes('data-border="#dc2626"') && box[0].includes('data-fill="#dcfce7"'), box?.[0].slice(0, 200));
  check('textul de după rămâne în afara casetei', !box?.[1].includes('Text după'));
}
console.log(fail ? `${fail} greșeli` : 'Toate verificările au trecut.');
process.exit(fail ? 1 : 0);
