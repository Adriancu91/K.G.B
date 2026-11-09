// Test pentru legendele din Docs: .docx (stil Caption, câmp SEQ cu numărul scris) citit înapoi ca număr automat, .odt (text:sequence) la fel.
// Rulare (în suite/): node tests/docs-caption.test.mjs
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
const out = join(tmpdir(), `suite-docscap-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { NO_PAGE_SETUP } from './src/docs/format.ts'; export { captionParagraph, captionsFromHtml } from './src/docs/caption.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, odtToHtml, docToDocx, docxToHtml, NO_PAGE_SETUP, captionParagraph, captionsFromHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const c1 = captionParagraph('Figura', 'Vânzări');
c1.content[1].attrs.n = 1;
const c2 = captionParagraph('Tabelul', 'Prețuri');
const c3 = captionParagraph('Figura', '');
c3.content[1].attrs.n = 2;
check('paragraful legendei', c1.attrs.pstyle === 'caption' && c1.content[0].text === 'Figura ' && c1.content[2].text === ': Vânzări');
check('fără text: doar eticheta și numărul', c3.content.length === 2);
const doc = { type: 'doc', content: [{ type: 'tableOfFigures', attrs: { label: 'Figura' } }, { type: 'paragraph', content: [{ type: 'text', text: 'Început' }] }, c1, c2, c3] };
const docx = await docToDocx(doc, NO_PAGE_SETUP);
const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
check('.docx: stilul Caption', /<w:pStyle w:val="Caption"\/>/.test(xml));
check('.docx: câmp SEQ Figura', /<w:instrText xml:space="preserve"> SEQ Figura \\* ARABIC <\/w:instrText>/.test(xml) || xml.includes(' SEQ Figura '), xml.slice(xml.indexOf('SEQ') - 200, xml.indexOf('SEQ') + 300));
check('.docx: rezultatul câmpului e scris (2)', /fldCharType="separate"\/><\/w:r><w:r>(<w:rPr>.*?<\/w:rPr>)?<w:t>2<\/w:t>/.test(xml));
check('.docx: nu rămân semnele de înlocuit', !xml.includes(String.fromCharCode(0x27e6)));
const styles = await (await JSZip.loadAsync(docx)).file('word/styles.xml').async('string');
check('.docx: stilul are numele „caption”', /w:styleId="Caption"[\s\S]*?<w:name w:val="caption"\/>/.test(styles));
{ const t = xml.indexOf('Lista figurilor'), cap = xml.indexOf('<w:pStyle w:val="Caption"/>'), list = xml.slice(t, cap); check('.docx: lista figurilor (titlu și cele două figuri, fără tabel)', t > 0 && t < cap && list.includes('Figura 1: Vânzări') && list.includes('>Figura 2<') && !list.includes('Tabelul'), list.slice(0, 300)); }
const back = await docxToHtml(docx);
const html = typeof back === 'string' ? back : back.html ?? JSON.stringify(back);
check('.docx citit înapoi: legendă cu număr automat', /<p class="doc-caption"[^>]*>Figura <span data-seq="Figura">1<\/span>: Vânzări/.test(html), html.slice(0, 600));
check('.docx citit înapoi: Tabelul', /data-seq="Tabelul">1</.test(html));
check('recunoaștere din HTML', captionsFromHtml('<p class="doc-caption">Figure 7 – x</p>') === '<p class="doc-caption">Figure <span data-seq="Figure">7</span> – x</p>');
check('paragraful obișnuit nu se atinge', captionsFromHtml('<p>Figura 7</p>') === '<p>Figura 7</p>');
const odt = await docToOdt(doc, NO_PAGE_SETUP);
const content = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
check('.odt: text:sequence', /<text:sequence text:name="Figura"[^>]*>2<\/text:sequence>/.test(content));
check('.odt: lista figurilor', content.indexOf('Lista figurilor') > 0 && content.indexOf('Figura 1: Vânzări') > content.indexOf('Lista figurilor'));
const ob = await odtToHtml(odt);
const oh = typeof ob === 'string' ? ob : ob.html ?? JSON.stringify(ob);
check('.odt citit înapoi: număr automat și stil Legendă', /data-pstyle="caption"/.test(oh) && /data-seq="Figura">2</.test(oh), oh.slice(0, 600));
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
