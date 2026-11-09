// Test: caseta de selectare din Docs (formCheck.ts): .docx (w:sdt cu w14:checkbox, bifată / nebifată) scris și citit înapoi, .odt și text.
// Rulare (în suite/): node tests/docs-form-check.test.mjs
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
const out = join(tmpdir(), `suite-formcheck-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `export * from './src/docs/formCheck.ts'; export { docToOdt } from './src/docs/odtExport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { docToText } from './src/docs/plainExport.ts';
export { getSchema } from '@tiptap/core'; export { default as StarterKit } from '@tiptap/starter-kit';`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const M = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let fail = 0;
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); const ok = g === w; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${g} (trebuia ${w})`}`); if (!ok) fail++; };
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'formCheck', attrs: { checked: true } }, { type: 'text', text: ' Pâine ' }, { type: 'formCheck', attrs: { checked: false } }, { type: 'text', text: ' Lapte' }] }] };
const x = await (await JSZip.loadAsync(await M.docToDocx(doc))).file('word/document.xml').async('string');
check('.docx: două controale cu casetă', (x.match(/<w14:checkbox>/g) ?? []).length, 2);
check('.docx: prima bifată, a doua nu', [...x.matchAll(/<w14:checked w14:val="([01])"/g)].map((m) => m[1]), ['1', '0']);
check('.docx: semnele ☒ și ☐ (w:sym 2612 / 2610)', [...x.matchAll(/<w:sym w:char="(26[0-9][0-9])"/g)].map((m) => m[1]), ['2612', '2610']);
const back = await M.docxToHtml(await M.docToDocx(doc));
check('.docx citit înapoi: casetele cu starea lor', [...back.html.matchAll(/data-form-check="([01])"/g)].map((m) => m[1]), ['1', '0']);
check('.docx citit înapoi: fără semnele ☒ / ☐ în plus', back.html.includes('☒') || back.html.includes('☐'), false);
check('.docx citit înapoi: textul rămâne', /Pâine[\s\S]*Lapte/.test(back.html), true);
// Editorul citește casetele din HTML.
const schema = M.getSchema([M.StarterKit, M.FormCheck]);
check('schema: span[data-form-check] devine casetă', schema.nodes.formCheck.spec.parseDOM[0].tag, 'span[data-form-check]');
const o = await (await JSZip.loadAsync(await M.docToOdt(doc))).file('content.xml').async('string');
check('.odt: ☒ Pâine ☐ Lapte', o.split('<text:s/>').join(' ').replace(/<[^>]+>/g, '').includes('☒ Pâine ☐ Lapte'), true);
check('text: ☒ Pâine ☐ Lapte', M.docToText(doc).trim(), '☒ Pâine ☐ Lapte');
console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
