// Test: lista verticală din Docs (formDrop.ts): .docx (w:sdt cu w:dropDownList, aleasă / necompletată) scris și citit înapoi, .odt și text.
// Rulare (în suite/): node tests/docs-form-drop.test.mjs
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
const out = join(tmpdir(), `suite-formdrop-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `export * from './src/docs/formDrop.ts'; export { encodeDrop, decodeDrop } from './src/docs/formDropData.ts'; export { docToOdt } from './src/docs/odtExport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { docToText } from './src/docs/plainExport.ts';
export { getSchema } from '@tiptap/core'; export { default as StarterKit } from '@tiptap/starter-kit';`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const M = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let fail = 0;
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); const ok = g === w; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${g} (trebuia ${w})`}`); if (!ok) fail++; };
const NL = String.fromCharCode(10);
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'text', text: 'Răspuns: ' }, { type: 'formDrop', attrs: { items: ['Da', 'Nu', 'Poate. "Sigur" & <alt>'].join(NL), value: 'Nu' } },
  { type: 'text', text: ' Oraș: ' }, { type: 'formDrop', attrs: { items: ['Cluj', 'Iași'].join(NL), value: '' }, marks: [{ type: 'bold' }] },
] }] };
check('variante: ; fără goluri și dubluri', M.parseDropItems(' Da ; Nu;; Da ;Poate '), ['Da', 'Nu', 'Poate']);
check('codare dus-întors cu puncte și semne', M.decodeDrop(M.encodeDrop(['a.b', "x'(y)"], 'a.b')), { value: 'a.b', items: ['a.b', "x'(y)"] });
const x = await (await JSZip.loadAsync(await M.docToDocx(doc))).file('word/document.xml').async('string');
check('.docx: două controale cu listă', (x.match(/<w:dropDownList>/g) ?? []).length, 2);
check('.docx: variantele primei liste', [...x.split('</w:dropDownList>')[0].matchAll(/w:displayText="([^"]*)"/g)].map((m) => m[1]), ['Da', 'Nu', 'Poate. &quot;Sigur&quot; &amp; &lt;alt&gt;']);
check('.docx: alegerea Nu în conținut', /<w:sdtContent><w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:t xml:space="preserve">Nu<\/w:t>/.test(x), true);
check('.docx: a doua cu textul de completat', x.includes('<w:showingPlcHdr/>') && x.includes('Alegeți un element.'), true);
check('.docx: a doua păstrează aldinul', /<w:sdtContent><w:r><w:rPr><w:b\/>[^]*?Alegeți un element/.test(x), true);
check('.docx: fără semnele de lucru', /[\u2987\u2988]/.test(x), false);
const back = await M.docxToHtml(await M.docToDocx(doc));
check('.docx citit înapoi: alegerile', [...back.html.matchAll(/data-form-drop="([^"]*)"/g)].map((m) => m[1]), ['Nu', '']);
check('.docx citit înapoi: variantele', [...back.html.matchAll(/data-items="([^"]*)"/g)].map((m) => m[1].split(NL)), [['Da', 'Nu', 'Poate. &quot;Sigur&quot; &amp; &lt;alt>'], ['Cluj', 'Iași']]);
check('.docx citit înapoi: fără textul de completat în plus', back.html.includes('Alegeți un element'), false);
check('.docx citit înapoi: textul rămâne', /Răspuns:[\s\S]*Oraș:/.test(back.html), true);
// O listă combinată (w:comboBox) dintr-un fișier primit, cu alegerea scrisă pe mai multe bucăți.
{
  const z = await JSZip.loadAsync(await M.docToDocx({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Z' }] }] }));
  const d = await z.file('word/document.xml').async('string');
  z.file('word/document.xml', d.replace(/<w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:t xml:space="preserve">Z<\/w:t><\/w:r>/, '<w:sdt><w:sdtPr><w:alias w:val="Luna"/><w:comboBox><w:listItem w:displayText="Ianuarie" w:value="1"/><w:listItem w:value="Februarie"/></w:comboBox></w:sdtPr><w:sdtContent><w:r><w:t>Febr</w:t></w:r><w:r><w:t>uarie</w:t></w:r></w:sdtContent></w:sdt>'));
  const h = await M.docxToHtml(await z.generateAsync({ type: 'uint8array' }));
  check('w:comboBox primit: alegerea din bucăți', /data-form-drop="([^"]*)"/.exec(h.html)?.[1], 'Februarie');
  check('w:comboBox primit: variantele (displayText sau value)', /data-items="([^"]*)"/.exec(h.html)?.[1].split(NL), ['Ianuarie', 'Februarie']);
}
const schema = M.getSchema([M.StarterKit, M.FormDrop]);
check('schema: span[data-form-drop] devine listă', schema.nodes.formDrop.spec.parseDOM[0].tag, 'span[data-form-drop]');
const o = await (await JSZip.loadAsync(await M.docToOdt(doc))).file('content.xml').async('string');
check('.odt: Nu și textul de completat', o.split('<text:s/>').join(' ').replace(/<[^>]+>/g, '').includes('Răspuns: Nu Oraș: Alegeți un element.'), true);
check('text: Nu și textul de completat', M.docToText(doc).trim(), 'Răspuns: Nu Oraș: Alegeți un element.');
console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
