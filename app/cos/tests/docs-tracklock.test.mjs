// Test pentru „Blochează urmărirea” din Docs: w:trackRevisions + w:documentProtection w:edit="trackedChanges" în settings.xml (ca Word),
// în ordinea cerută de schemă, citit înapoi și păstrat în fișierul Suite.
// Rulare (în suite/): node tests/docs-tracklock.test.mjs
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
const out = join(tmpdir(), `suite-docslock-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { parseDoc, serializeDoc } from './src/docs/format.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { parseDoc, serializeDoc, docToDocx, docxToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contract în lucru' }] }] };
const plainSettings = await (await JSZip.loadAsync(await docToDocx(doc, { header: '', footer: '', numbers: false }))).file('word/settings.xml').async('string');
if (process.argv.includes('--arata')) console.log(plainSettings);
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const page = { header: '', footer: '', numbers: false, trackLock: true };
const bytes = await docToDocx(doc, page);
const settings = await (await JSZip.loadAsync(bytes)).file('word/settings.xml').async('string');
check('Word: w:trackRevisions în settings.xml', settings.includes('<w:trackRevisions/>'), settings.slice(-400));
check('Word: w:documentProtection w:edit="trackedChanges"', settings.includes('<w:documentProtection w:edit="trackedChanges" w:enforcement="1"/>'));
// Ordinea din schemă: trackRevisions < documentProtection < evenAndOddHeaders < compat.
const i = (t) => settings.indexOf(t);
check('Word: ordinea elementelor din settings.xml', i('<w:displayBackgroundShape') < i('<w:trackRevisions') && i('<w:trackRevisions') < i('<w:documentProtection') && i('<w:documentProtection') < i('<w:evenAndOddHeaders') && i('<w:evenAndOddHeaders') < i('<w:compat'));
check('Word: o singură dată', settings.split('<w:documentProtection').length === 2);
const back = await docxToHtml(bytes);
check('Word → înapoi: blocat', back.layout?.trackLock === true, JSON.stringify(back.layout));
check('Word → înapoi: textul', back.html.includes('Contract în lucru'));
const plain = await docxToHtml(await docToDocx(doc, { header: '', footer: '', numbers: false }));
check('fără blocare: nimic', !plain.layout?.trackLock && !plainSettings.includes('documentProtection'));
// Protecția de alt fel (doar citire) nu înseamnă urmărire blocată.
const zip = await JSZip.loadAsync(await docToDocx(doc, { header: '', footer: '', numbers: false }));
zip.file('word/settings.xml', plainSettings.replace('<w:evenAndOddHeaders', '<w:documentProtection w:edit="readOnly" w:enforcement="1"/><w:evenAndOddHeaders'));
const ro = await docxToHtml(await zip.generateAsync({ type: 'uint8array' }));
check('protecție „doar citire”: nu e blocare de urmărire', !ro.layout?.trackLock);
const saved = parseDoc(serializeDoc(doc, page));
check('fișierul Suite păstrează blocarea', saved.page?.trackLock === true, JSON.stringify(saved.page));
check('fișierul Suite fără blocare', !parseDoc(serializeDoc(doc, { header: '', footer: '', numbers: false })).page?.trackLock);
console.log(fail ? `\n${fail} GREȘELI` : '\nTOATE TESTELE AU TRECUT');
process.exit(fail ? 1 : 0);
