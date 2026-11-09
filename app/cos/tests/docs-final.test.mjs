// Test pentru „Marcat ca final” din Docs: _MarkAsFinal în .docx (ca Word), citit înapoi, păstrat în fișierul Suite.
// Rulare (în suite/): node tests/docs-final.test.mjs
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
const out = join(tmpdir(), `suite-docsfin-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { parseDoc, serializeDoc } from './src/docs/format.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { parseDoc, serializeDoc, docToDocx, docxToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contract semnat' }] }] };
const page = { header: '', footer: '', numbers: false, final: true };

const bytes = await docToDocx(doc, page);
const zip = await JSZip.loadAsync(bytes);
const custom = await zip.file('docProps/custom.xml')?.async('string');
check('Word: docProps/custom.xml cu _MarkAsFinal', !!custom && custom.includes('name="_MarkAsFinal"><vt:bool>true</vt:bool>'), custom);
check('Word: tipul în [Content_Types].xml', (await zip.file('[Content_Types].xml').async('string')).includes('PartName="/docProps/custom.xml"'));
check('Word: legătura în _rels/.rels', (await zip.file('_rels/.rels').async('string')).includes('Target="docProps/custom.xml"'));
const back = await docxToHtml(bytes);
check('Word → înapoi: final', back.layout?.final === true, JSON.stringify(back.layout));
check('Word → înapoi: textul', back.html.includes('Contract semnat'));
const plain = await docxToHtml(await docToDocx(doc, { header: '', footer: '', numbers: false }));
const plainCustom = await (await JSZip.loadAsync(await docToDocx(doc, { header: '', footer: '', numbers: false }))).file('docProps/custom.xml')?.async('string');
check('fără final: nimic', !plain.layout?.final && !(plainCustom ?? '').includes('_MarkAsFinal'));
const saved = parseDoc(serializeDoc(doc, page));
check('fișierul Suite păstrează final', saved.page?.final === true);
check('fișierul Suite: final doar dacă e adevărat', parseDoc(serializeDoc(doc, { ...page, final: 'da' })).page?.final === undefined);

// Clasificarea (02.11): proprietatea „Clasificare” în docProps/custom.xml, singură sau lângă _MarkAsFinal.
const lp = { header: '', footer: '', numbers: false, props: { title: 'Ofertă', label: 'confidential' } };
const lb = await docToDocx(doc, lp);
const lc = await (await JSZip.loadAsync(lb)).file('docProps/custom.xml')?.async('string');
check('clasificare: scrisă în custom.xml', !!lc && lc.includes('name="Clasificare"><vt:lpwstr>Confidențial</vt:lpwstr>') && !lc.includes('_MarkAsFinal'), lc);
const lback = await docxToHtml(lb);
check('clasificare → înapoi', lback.layout?.props?.label === 'confidential' && lback.layout?.props?.title === 'Ofertă' && !lback.layout?.final, JSON.stringify(lback.layout?.props));
const both = await docToDocx(doc, { ...lp, final: true, props: { label: 'strict' } });
const bc = await (await JSZip.loadAsync(both)).file('docProps/custom.xml')?.async('string');
check('clasificare + final: două proprietăți, pid diferit', bc.includes('pid="2" name="_MarkAsFinal"') && bc.includes('pid="3" name="Clasificare"><vt:lpwstr>Strict confidențial<'), bc);
const bback = await docxToHtml(both);
check('clasificare + final → înapoi', bback.layout?.final === true && bback.layout?.props?.label === 'strict', JSON.stringify(bback.layout?.props));
check('fișierul Suite păstrează clasificarea', parseDoc(serializeDoc(doc, lp)).page?.props?.label === 'confidential');
check('clasificare necunoscută: scoasă', parseDoc(serializeDoc(doc, { ...lp, props: { label: 'secret' } })).page?.props?.label === undefined);

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
