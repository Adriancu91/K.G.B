// Test pentru butonul cu macrocomandă din Docs (câmpul MACROBUTTON, field.ts): instrucțiunea, exportul .docx (câmp complet),
// importul înapoi, câmpul .odt text:execute-macro și importul butoanelor scrise de alte programe (fără rezultat, ca fldSimple, cu rezultat formatat).
// Rulare (în suite/): node tests/docs-macrobtn.test.mjs
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
const out = join(tmpdir(), `suite-docsmacrobtn-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts'; export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export * from './src/docs/field.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx, docxToHtml, docToOdt, odtToHtml, parseMacroBtn, macroBtnInstr, findMacroForBtn } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };

// Instrucțiunea și căutarea macrocomenzii.
check('instrucțiunea cu numele fără spații', macroBtnInstr('Antet firmă', 'Pune antetul') === 'MACROBUTTON Antet_firmă Pune antetul');
const p = parseMacroBtn(' MACROBUTTON NoMacro [Clic și scrie numele] ');
check('instrucțiunea citită', p?.macro === 'NoMacro' && p?.text === '[Clic și scrie numele]', JSON.stringify(p));
check('alt câmp nu e buton', parseMacroBtn('AUTHOR') === null);
const lists = [[{ name: 'Antet firmă' }], [{ name: 'Semnătură' }]];
check('macrocomanda găsită după numele cu „_”', findMacroForBtn(lists, 'Antet_firmă')?.name === 'Antet firmă');
check('și în cele pentru toate documentele', findMacroForBtn(lists, 'Semnătură')?.name === 'Semnătură' && !findMacroForBtn(lists, 'Alta'));

// Export .docx: câmpul MACROBUTTON complet, cu textul afișat în instrucțiune și ca rezultat.
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'text', text: 'Apasă ' },
  { type: 'text', text: 'Antet & logo', marks: [{ type: 'macroBtn', attrs: { macro: 'Antet firmă' } }] },
  { type: 'text', text: ' și gata.' },
] }] };
const docx = await docToDocx(doc);
const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
check('Word: instrucțiunea MACROBUTTON', xml.includes('<w:instrText xml:space="preserve"> MACROBUTTON Antet_firmă Antet &amp; logo </w:instrText>'), xml.slice(0, 2500));
check('Word: rezultatul scris', xml.includes('<w:t xml:space="preserve">Antet &amp; logo</w:t>'));
check('Word: fără semne rămase', !/[⦀⦃⦄]/.test(xml));

// Înapoi: butonul redevine buton (numele cu „_”, găsit apoi după numele cu spațiu).
const back = await docxToHtml(docx);
check('înapoi: butonul', back.html.includes('<span data-macrobtn="Antet_firmă">Antet &amp; logo</span>'), back.html);
check('înapoi: textul din jur', back.html.includes('Apasă ') && back.html.includes(' și gata.'));

// .odt: câmpul text:execute-macro, dus-întors.
const odt = await docToOdt(doc);
const cxml = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
check('odt: text:execute-macro', cxml.includes('<text:execute-macro text:name="Antet firmă">Antet &amp; logo</text:execute-macro>'), cxml.slice(cxml.indexOf('<office:text'), cxml.indexOf('<office:text') + 800));
const oback = await odtToHtml(odt);
const ohtml = typeof oback === 'string' ? oback : oback.html;
check('odt înapoi: butonul', ohtml.includes('<span data-macrobtn="Antet firmă">Antet &amp; logo</span>'), ohtml);

// Butoane scrise de alte programe: fără rezultat (textul doar în instrucțiune), ca fldSimple fără conținut, cu rezultat aldin.
const zip = await JSZip.loadAsync(docx);
const body = '<w:p><w:r><w:t xml:space="preserve">A: </w:t></w:r>'
  + '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> MACROBUTTON NoMacro [Scrie numele] </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>'
  + '<w:r><w:t xml:space="preserve"> B: </w:t></w:r><w:fldSimple w:instr=" MACROBUTTON Tabel Pune tabelul "/>'
  + '<w:r><w:t xml:space="preserve"> C: </w:t></w:r>'
  + '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> MACROBUTTON Rapid Clic aici </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>Clic aici</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>'
  + '</w:p>';
const dx = (await zip.file('word/document.xml').async('string')).replace(/<w:body>[\s\S]*?(<w:sectPr)/, '<w:body>' + body + '$1');
zip.file('word/document.xml', dx);
const other = await docxToHtml(await zip.generateAsync({ type: 'uint8array' }));
check('fără rezultat: textul din instrucțiune', other.html.includes('<span data-macrobtn="NoMacro">[Scrie numele]</span>'), other.html);
check('fldSimple fără conținut', other.html.includes('<span data-macrobtn="Tabel">Pune tabelul</span>'), other.html);
check('cu rezultat aldin', /<span data-macrobtn="Rapid"><strong>Clic aici<\/strong><\/span>/.test(other.html), other.html);
check('textul din jur rămâne', other.html.includes('A: ') && other.html.includes(' B: ') && other.html.includes(' C: '));

console.log(fail ? `GREȘELI: ${fail}` : 'Butonul cu macrocomandă (MACROBUTTON): toate verificările au trecut');
process.exit(fail ? 1 : 0);
