// Docs: schimbările urmărite de paragraf (stil / aliniere, atributul pchange) ajung în .docx ca w:pPrChange și se citesc înapoi.
// Rulare (în suite/): node tests/docs-trackpara.test.mjs  (--arata scrie document.xml)
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
const out = join(tmpdir(), `suite-docspara-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml, pprChangeOld, headingStyleLevels } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx, docxToHtml, pprChangeOld, headingStyleLevels } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const pc = (old) => JSON.stringify({ author: 'Ana', date: '2026-10-30T08:00:00Z', old });
const doc = { type: 'doc', content: [
  { type: 'heading', attrs: { level: 1, textAlign: 'left', pchange: pc({ type: 'paragraph', textAlign: 'left' }) }, content: [{ type: 'text', text: 'Capitolul unu' }] },
  { type: 'paragraph', attrs: { textAlign: 'center', pchange: pc({ type: 'paragraph', textAlign: 'right' }) }, content: [{ type: 'text', text: 'Centrat acum' }] },
  { type: 'paragraph', attrs: { textAlign: 'justify', pchange: pc({ type: 'heading', level: 2, textAlign: 'left' }) }, content: [{ type: 'text', text: 'Fost titlu' }] },
  { type: 'paragraph', attrs: { indent: 2, spaceAfter: 12, lineHeight: '1.5', pchange: pc({ type: 'paragraph', textAlign: 'left', indent: 0, spaceAfter: 0, lineHeight: 1.15 }) }, content: [{ type: 'text', text: 'Retras' }] },
  { type: 'paragraph', attrs: { firstLine: 1, pchange: pc({ type: 'paragraph', textAlign: 'left', indent: 0, indentRight: 2, firstLine: -1 }) }, content: [{ type: 'text', text: 'Prima linie' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Simplu' }] },
] };
const bytes = await docToDocx(doc, { header: '', footer: '', numbers: false });
const zip = await JSZip.loadAsync(bytes);
const xml = await zip.file('word/document.xml').async('string');
if (process.argv.includes('--arata')) console.log(xml);
const para = (word) => { const i = xml.indexOf('>' + word + '<'); return xml.slice(xml.lastIndexOf('<w:p>', i) >= 0 ? Math.max(xml.lastIndexOf('<w:p>', i), xml.lastIndexOf('<w:p ', i)) : xml.lastIndexOf('<w:p ', i), i); };
const p1 = para('Capitolul unu'), p2 = para('Centrat acum'), p3 = para('Fost titlu'), p4 = para('Simplu');
const chg = (p) => { const a = p.indexOf('<w:pPrChange'); return a < 0 ? '' : p.slice(a, p.indexOf('</w:pPrChange>', a)); };
check('titlul: w:pPrChange cu autor și dată', chg(p1).includes('w:author="Ana"') && chg(p1).includes('w:date="2026-10-30T08:00:00Z"'), p1);
check('titlul: înainte era paragraf (fără stil de titlu în w:pPrChange)', chg(p1) && !chg(p1).includes('w:pStyle'), chg(p1));
check('centrat: înainte la dreapta', chg(p2).includes('<w:jc w:val="right"/>') && p2.indexOf('<w:jc w:val="center"/>') >= 0 && p2.indexOf('<w:jc w:val="center"/>') < p2.indexOf('<w:pPrChange'), p2);
check('fost titlu: înainte Heading2', chg(p3).includes('<w:pStyle w:val="Heading2"/>'), chg(p3));
check('paragraful simplu nu are w:pPrChange', !p4.includes('pPrChange'), p4);
const ids = [...xml.matchAll(/<w:pPrChange w:id="(.*?)"/g)].map((m) => m[1]);
const p5 = para('Retras');
check('retras: înainte fără retragere, 0 pt după, 1,15 rânduri', !chg(p5).includes('w:ind') && chg(p5).includes('w:after="0"') && chg(p5).includes('w:line="276"'), chg(p5));
const p6 = chg(para('Prima linie'));
check('prima linie: înainte agățată 1 cm și 2 cm la dreapta', p6.includes('w:hanging="567"') && p6.includes('w:left="567"') && p6.includes('w:right="1134"'), p6);
check('id-uri diferite', ids.length === 5 && new Set(ids).size === 5, ids.join(','));
// Înapoi: la deschidere, fiecare w:pPrChange devine un semn la începutul paragrafului, cu felul lui de dinainte.
const back = await docxToHtml(bytes);
const ps = back.changes.filter((c) => c.kind === 'paragraph');
check('înapoi: cinci schimbări de paragraf', ps.length === 5, JSON.stringify(back.changes));
const P = String.fromCharCode(0xe009), C = String.fromCharCode(0xe001);
const has = (text, ops) => { const c = ps.find((x) => x.ops === JSON.stringify(ops)); return !!c && back.html.includes(P + c.id + C + text); };
check('înapoi: „Capitolul unu” era paragraf aliniat stânga', has('Capitolul unu', { type: 'paragraph', textAlign: 'left' }), JSON.stringify(ps) + back.html.slice(0, 400));
check('înapoi: „Centrat acum” era la dreapta', has('Centrat acum', { type: 'paragraph', textAlign: 'right' }), JSON.stringify(ps));
check('înapoi: „Fost titlu” era titlu de nivel 2', has('Fost titlu', { type: 'heading', level: 2, textAlign: 'left' }), JSON.stringify(ps));
check('înapoi: „Retras” avea retragerea 0, 0 pt după și 1,15 rânduri', has('Retras', { type: 'paragraph', textAlign: 'left', indent: 0, spaceAfter: 0, lineHeight: 1.15 }), JSON.stringify(ps));
check('înapoi: „Prima linie” era agățată, cu 2 cm la dreapta', has('Prima linie', { type: 'paragraph', textAlign: 'left', indentRight: 2, firstLine: -1 }), JSON.stringify(ps.filter((c) => c.ops.includes('firstLine'))));
check('înapoi: autorul și data', ps.every((c) => c.author === 'Ana' && c.date === '2026-10-30T08:00:00Z'), JSON.stringify(ps));
const heads = headingStyleLevels('<w:styles><w:style w:type="paragraph" w:styleId="Titlu1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="character" w:styleId="H3c"><w:name w:val="heading 3"/></w:style></w:styles>');
check('stilurile de titlu după id (și cu nume de id traduse)', heads.get('Titlu1') === 1 && !heads.has('Normal') && !heads.has('H3c'), JSON.stringify([...heads]));
check('pprChangeOld: spațierea după schimbată (0 pt înainte)', JSON.stringify(pprChangeOld('<w:spacing w:after="200"/>', '<w:spacing w:after="0"/>', heads)) === '{"type":"paragraph","textAlign":"left","spaceAfter":0}', JSON.stringify(pprChangeOld('<w:spacing w:after="200"/>', '<w:spacing w:after="0"/>', heads)));
check('pprChangeOld: retragerea și rândurile', JSON.stringify(pprChangeOld('<w:ind w:left="1418"/><w:spacing w:line="360" w:lineRule="auto"/>', '', heads)) === '{"type":"paragraph","textAlign":"left","indent":0,"lineHeight":null}', JSON.stringify(pprChangeOld('<w:ind w:left="1418"/><w:spacing w:line="360" w:lineRule="auto"/>', '', heads)));
check('pprChangeOld: dreapta și prima linie agățată', JSON.stringify(pprChangeOld('<w:ind w:left="567" w:right="1134" w:hanging="567"/>', '<w:ind w:left="0" w:firstLine="567"/>', heads)) === '{"type":"paragraph","textAlign":"left","indentRight":null,"firstLine":1}', JSON.stringify(pprChangeOld('<w:ind w:left="567" w:right="1134" w:hanging="567"/>', '<w:ind w:left="0" w:firstLine="567"/>', heads)));
check('pprChangeOld: nimic schimbat = nimic', pprChangeOld('<w:spacing w:after="200"/>', '<w:spacing w:after="200"/>', heads) === null);
check('pprChangeOld: stilul de titlu pus', JSON.stringify(pprChangeOld('<w:pStyle w:val="Titlu1"/>', '', heads)) === '{"type":"paragraph","textAlign":"left"}');
check('pprChangeOld: alinierea both = stânga-dreapta', JSON.stringify(pprChangeOld('', '<w:jc w:val="both"/>', heads)) === '{"type":"paragraph","textAlign":"justify"}');
console.log(fail ? `\n${fail} GREȘELI` : '\nTOATE TESTELE AU TRECUT');
process.exit(fail ? 1 : 0);
