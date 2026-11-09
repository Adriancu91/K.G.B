// Test pentru chenarul paginii din Docs: Word (w:pgBorders, simplu / dublu / gros, citit înapoi), LibreOffice (fo:border pe pagină), fișierul Suite.
// Rulare (în suite/): node tests/docs-pageborder.test.mjs
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
const out = join(tmpdir(), `suite-docspb-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { parseDoc, serializeDoc } from './src/docs/format.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, parseDoc, serializeDoc, docToDocx, docxToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Diplomă' }] }] };
const page = (border) => ({ header: '', footer: '', numbers: false, border });

for (const [b, val] of [['single', 'single'], ['double', 'double'], ['thick', 'thick']]) {
  const bytes = await docToDocx(doc, page(b));
  const xml = await (await JSZip.loadAsync(bytes)).file('word/document.xml').async('string');
  const pg = /<w:pgBorders[^]*?<\/w:pgBorders>/.exec(xml)?.[0] ?? '';
  check(`Word: chenar ${b}`, pg.includes(`w:val="${val}"`) && /w:display="allPages"/.test(pg) && (pg.match(/<w:(top|left|bottom|right) /g) ?? []).length === 4, pg);
  const back = await docxToHtml(bytes);
  check(`Word → înapoi: ${b}`, back.layout?.border === b, JSON.stringify(back.layout));
}
const none = await docxToHtml(await docToDocx(doc, page(undefined)));
check('fără chenar: nimic', !none.layout?.border);
const c = await (await JSZip.loadAsync(await docToOdt(doc, page('double')))).file('styles.xml').async('string');
check('LibreOffice: fo:border dublu pe pagină', c.includes('fo:border="1.1pt double #333333"'));
check('fișierul Suite păstrează chenarul', parseDoc(serializeDoc(doc, page('thick'))).page?.border === 'thick');
check('fișierul Suite: chenar necunoscut ignorat', parseDoc(serializeDoc(doc, page('zigzag'))).page?.border === undefined);

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
