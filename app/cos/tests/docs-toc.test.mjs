// Test pentru cuprinsul din Docs: nivelurile alese (levels) se respectă la exportul .docx și .odt.
// Rulare (în suite/): node tests/docs-toc.test.mjs
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
const out = join(tmpdir(), `suite-docstoc-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { NO_PAGE_SETUP } from './src/docs/format.ts'; export { tocLevels } from './src/docs/toc.ts'; export { docxToHtml } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, docToDocx, NO_PAGE_SETUP, tocLevels, docxToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
check('niveluri: implicit 3', tocLevels(undefined) === 3 && tocLevels('9') === 3 && tocLevels('5') === 5);
const h = (level, text) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
const make = (attrs) => ({ type: 'doc', content: [{ type: 'tableOfContents', attrs }, h(1, 'Unu'), h(2, 'Doi'), h(4, 'Patru')] });
const docXml = async (d) => (await JSZip.loadAsync(await docToDocx(d, NO_PAGE_SETUP))).file('word/document.xml').async('string');
const count = (xml, t) => xml.split('>' + t + '<').length - 1;
const x3 = await docXml(make({ levels: 3, pages: true }));
check('.docx, Titlu 1–3: Unu și Doi în cuprins, Patru nu', count(x3, 'Unu') === 2 && count(x3, 'Doi') === 2 && count(x3, 'Patru') === 1);
const x4 = await docXml(make({ levels: 4, pages: true }));
check('.docx, Titlu 1–4: și Patru', count(x4, 'Patru') === 2);
const x1 = await docXml(make({ levels: 1, pages: false }));
check('.docx, Titlu 1: doar Unu', count(x1, 'Unu') === 2 && count(x1, 'Doi') === 1);
const odt = await (await JSZip.loadAsync(await docToOdt(make({ levels: 1, pages: true }), NO_PAGE_SETUP))).file('content.xml').async('string');
check('.odt, Titlu 1: doar Unu', count(odt, 'Unu') === 2 && count(odt, 'Doi') === 1);
// Cuprinsul e un câmp TOC adevărat (begin / instrucțiune / separate / rândurile de acum / end), iar Word e rugat să-l actualizeze la deschidere.
const BS = String.fromCharCode(92), Q = '&quot;';
const fields = (x) => x.replace(/<[^>]+>/g, (t) => (/fldChar|instrText/.test(t) ? t.replace(/ xml:space="preserve"/, '') : '')).split('"').join(Q);
const BEGIN = `<w:fldChar w:fldCharType=${Q}begin${Q}/>`, SEP = `<w:fldChar w:fldCharType=${Q}separate${Q}/>`, END = `<w:fldChar w:fldCharType=${Q}end${Q}/>`;
const fld = fields(x3);
check('.docx: câmpul TOC cu nivelurile 1–3', fld.includes(`${BEGIN}<w:instrText> TOC ${BS}o ${Q}1-3${Q} ${BS}h ${BS}z ${BS}u </w:instrText>${SEP}Unu`), fld.slice(0, 300));
check('.docx: câmpul se închide după ultimul rând', fld.includes('Doi' + END) && fld.split(END).length === 2, fld.slice(0, 400));
check('.docx: fără semnele de lucru în fișier', !x3.includes(String.fromCharCode(0x2985)) && !x3.includes(String.fromCharCode(0x2986)));
const settings = async (d) => (await JSZip.loadAsync(await docToDocx(d, NO_PAGE_SETUP))).file('word/settings.xml').async('string');
check('.docx: actualizarea câmpurilor la deschidere', (await settings(make({ levels: 3 }))).includes('<w:updateFields'));
check('.docx fără cuprins: fără actualizare', !(await settings({ type: 'doc', content: [h(1, 'Unu')] })).includes('updateFields'));
// Cuprins fără titluri: câmpul rămâne întreg (begin … end), gol.
const fe = fields(await docXml({ type: 'doc', content: [{ type: 'tableOfContents' }, { type: 'paragraph', content: [{ type: 'text', text: 'Text' }] }] }));
check('.docx: cuprins gol tot câmp întreg', fe.split(BEGIN).length === 2 && fe.split(END).length === 2, fe.slice(0, 300));
// Lista figurilor: câmpul TOC \c cu eticheta legendelor (SEQ Figura).
const cap = (n) => ({ type: 'paragraph', attrs: { pstyle: 'caption' }, content: [{ type: 'text', text: 'Figura ' }, { type: 'captionNum', attrs: { label: 'Figura', n } }, { type: 'text', text: ' Grafic ' + n }] });
const ff = fields(await docXml({ type: 'doc', content: [{ type: 'tableOfFigures', attrs: { label: 'Figura' } }, cap(1), cap(2)] }));
check('.docx: lista figurilor e câmp TOC cu eticheta Figura', ff.includes(` TOC ${BS}h ${BS}z ${BS}c ${Q}Figura${Q} `) && ff.includes('SEQ Figura'), ff.slice(0, 400));
// Fișierul se deschide înapoi: titlurile și rândurile cuprinsului rămân text.
const back = await docxToHtml(await docToDocx(make({ levels: 3 }), NO_PAGE_SETUP));
check('.docx citit înapoi: textul cuprinsului și titlurile', back.html.split('Unu').length === 3 && !back.html.includes(String.fromCharCode(0x2985)), back.html.slice(0, 300));
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
