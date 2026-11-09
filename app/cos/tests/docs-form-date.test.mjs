// Test: selectorul de dată din Docs (formDate.ts): .docx (w:sdt cu w:date, aleasă / necompletată) scris și citit înapoi, .odt și text.
// Rulare (în suite/): node tests/docs-form-date.test.mjs
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
const out = join(tmpdir(), `suite-formdate-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `export * from './src/docs/formDate.ts'; export { docToOdt } from './src/docs/odtExport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { docToText } from './src/docs/plainExport.ts';
export { getSchema } from '@tiptap/core'; export { default as StarterKit } from '@tiptap/starter-kit';`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const M = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let fail = 0;
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); const ok = g === w; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${g} (trebuia ${w})`}`); if (!ok) fail++; };
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'text', text: 'Data: ' }, { type: 'formDate', attrs: { value: '2026-10-27' } },
  { type: 'text', text: ' Termen: ' }, { type: 'formDate', attrs: { value: '' }, marks: [{ type: 'italic' }] },
] }] };
check('dată adevărată', M.cleanDate('2026-02-28'), '2026-02-28');
check('dată care nu există (30 februarie)', M.cleanDate('2026-02-30'), '');
check('dată scrisă zz.LL.aaaa', M.parseShownDate('5.3.2026'), '2026-03-05');
check('dată scrisă zz/LL/aaaa', M.parseShownDate('27/10/2026'), '2026-10-27');
check('textul arătat', [M.dateText({ value: '2026-10-27' }), M.dateText({ value: '' })], ['27.10.2026', 'Alegeți o dată.']);
const x = await (await JSZip.loadAsync(await M.docToDocx(doc))).file('word/document.xml').async('string');
check('.docx: două controale cu dată', (x.match(/<w:date[ >]/g) ?? []).length, 2);
check('.docx: data întreagă a primului', /<w:date w:fullDate="2026-10-27T00:00:00Z"><w:dateFormat w:val="dd.MM.yyyy"\/>/.test(x), true);
check('.docx: data scrisă în conținut', /<w:sdtContent><w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:t xml:space="preserve">27.10.2026<\/w:t>/.test(x), true);
check('.docx: al doilea cu textul de completat și cursiv', x.includes('<w:showingPlcHdr/><w:date><w:dateFormat') && /<w:sdtContent><w:r><w:rPr><w:i\/>[^]*?Alegeți o dată\./.test(x), true);
check('.docx: fără semnele de lucru', /[\u2989\u298a]/.test(x), false);
const back = await M.docxToHtml(await M.docToDocx(doc));
check('.docx citit înapoi: datele', [...back.html.matchAll(/data-form-date="([^"]*)"/g)].map((m) => m[1]), ['2026-10-27', '']);
check('.docx citit înapoi: fără textul arătat în plus', back.html.includes('27.10.2026') || back.html.includes('Alegeți o dată'), false);
check('.docx citit înapoi: textul rămâne', /Data:[\s\S]*Termen:/.test(back.html), true);
// Un selector de dată primit fără w:fullDate: data se citește din textul scris.
{
  const z = await JSZip.loadAsync(await M.docToDocx({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Z' }] }] }));
  const d = await z.file('word/document.xml').async('string');
  z.file('word/document.xml', d.replace(/<w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:t xml:space="preserve">Z<\/w:t><\/w:r>/, '<w:sdt><w:sdtPr><w:date><w:dateFormat w:val="d.M.yyyy"/></w:date></w:sdtPr><w:sdtContent><w:r><w:t>1.</w:t></w:r><w:r><w:t>12.2025</w:t></w:r></w:sdtContent></w:sdt>'));
  const h = await M.docxToHtml(await z.generateAsync({ type: 'uint8array' }));
  check('w:date primit fără w:fullDate: data din text', /data-form-date="([^"]*)"/.exec(h.html)?.[1], '2025-12-01');
}
const schema = M.getSchema([M.StarterKit, M.FormDate]);
check('schema: span[data-form-date] devine selector', schema.nodes.formDate.spec.parseDOM[0].tag, 'span[data-form-date]');
const o = await (await JSZip.loadAsync(await M.docToOdt(doc))).file('content.xml').async('string');
check('.odt: data și textul de completat', o.split('<text:s/>').join(' ').replace(/<[^>]+>/g, '').includes('Data: 27.10.2026 Termen: Alegeți o dată.'), true);
check('text: data și textul de completat', M.docToText(doc).trim(), 'Data: 27.10.2026 Termen: Alegeți o dată.');
console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
