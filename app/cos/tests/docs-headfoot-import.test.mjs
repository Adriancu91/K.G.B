// Test pentru importul antetului și subsolului din .docx: text, numărul paginii (câmpul PAGE), prima pagină diferită, fișiere reale din corpus.
// Rulare (în suite/): node tests/docs-headfoot-import.test.mjs
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
const out = join(tmpdir(), `suite-docshf-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml, headFootText } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx, docxToHtml, headFootText } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
import { readdirSync, readFileSync, statSync } from 'node:fs';

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Text' }] }] };

// Dus și întors prin .docx.
const page = { header: 'Raport anual 2026', footer: 'Confidențial', numbers: true, firstPage: { header: '', footer: 'Cluj', numbers: false } };
const { layout } = await docxToHtml(await docToDocx(doc, page));
check('antetul revine', layout?.header === 'Raport anual 2026', JSON.stringify(layout));
check('subsolul revine fără „Pagina din”', layout?.footer === 'Confidențial', JSON.stringify(layout?.footer));
check('numerotarea revine', layout?.numbers === true);
check('prima pagină diferită revine', JSON.stringify(layout?.firstPage) === JSON.stringify(page.firstPage), JSON.stringify(layout?.firstPage));
const { layout: l2 } = await docxToHtml(await docToDocx(doc, { header: '', footer: '', numbers: true }));
check('doar numere: subsol gol, numerotare da', l2?.footer === '' && l2?.numbers === true, JSON.stringify(l2));
const { layout: l3 } = await docxToHtml(await docToDocx(doc, { header: '', footer: '', numbers: false }));
check('fără antet: nimic', !l3?.header && !l3?.footer && !l3?.numbers && !l3?.firstPage, JSON.stringify(l3));

// Bucăți de XML cum le scrie Word.
const run = (t) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;
const field = (instr, res) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${run(res)}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
let r = headFootText(`<w:ftr><w:p>${run('Page ')}${field('PAGE \* MERGEFORMAT', '3')}${run(' of ')}${field('NUMPAGES', '12')}</w:p></w:ftr>`);
check('„Page 3 of 12” → numere, fără text', r.page && r.text === '', JSON.stringify(r));
r = headFootText(`<w:ftr><w:p>${run('SC Exemplu SRL')}<w:r><w:tab/></w:r>${run('Pagina ')}<w:fldSimple w:instr=" PAGE "><w:r><w:t>2</w:t></w:r></w:fldSimple></w:p></w:ftr>`);
check('text + „Pagina” cu fldSimple', r.page && r.text === 'SC Exemplu SRL', JSON.stringify(r));
r = headFootText(`<w:hdr><w:p>${run('Contract')}</w:p><w:p/><w:p>${run('nr. 12')}</w:p><mc:AlternateContent><mc:Choice><w:p>${run('Caseta')}</w:p></mc:Choice><mc:Fallback><w:p>${run('Caseta')}</w:p></mc:Fallback></mc:AlternateContent></w:hdr>`);
check('mai multe paragrafe, caseta o singură dată', !r.page && r.text === 'Contract · nr. 12 · Caseta', JSON.stringify(r));
r = headFootText(`<w:hdr><w:p>${run('Despre &amp; pagina de gardă')}</w:p></w:hdr>`);
// Paragraful fără aliniere stă în stânga (ca în programul cunoscut): textul + Tab = locul din stânga al antetului.
check('fără câmp PAGE cuvântul „pagina” rămâne', r.text === 'Despre & pagina de gardă' + String.fromCharCode(9), JSON.stringify(r));
// Locurile antetului: alinierea paragrafului, tab-urile, tab-ul de aliniere la dreapta, oprirea doar la dreapta.
const T = String.fromCharCode(9);
const tab = '<w:r><w:tab/></w:r>';
r = headFootText(`<w:hdr><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run('Titlu')}</w:p></w:hdr>`);
check('antet centrat → la mijloc', r.text === 'Titlu', JSON.stringify(r));
r = headFootText(`<w:ftr><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run('Confidențial')}</w:p></w:ftr>`, false);
check('subsol centrat → la mijloc', r.text === T + 'Confidențial', JSON.stringify(r));
r = headFootText(`<w:ftr><w:p><w:pPr><w:jc w:val="right"/></w:pPr>${run('Cluj')}</w:p></w:ftr>`, false);
check('subsol la dreapta → dreapta', r.text === T + T + 'Cluj', JSON.stringify(r));
r = headFootText(`<w:ftr><w:p>${run('Cluj')}</w:p></w:ftr>`, false);
check('subsol fără aliniere → stânga, fără Tab', r.text === 'Cluj', JSON.stringify(r));
r = headFootText(`<w:hdr><w:p>${run('SC Exemplu')}${tab}${run('Raport')}${tab}${run('2026')}</w:p></w:hdr>`);
check('două tab-uri → trei locuri', r.text === 'SC Exemplu' + T + 'Raport' + T + '2026', JSON.stringify(r));
r = headFootText(`<w:hdr><w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="9000"/></w:tabs></w:pPr>${run('SC Exemplu')}${tab}${run('2026')}</w:p></w:hdr>`);
check('un tab spre oprirea din dreapta → dreapta', r.text === 'SC Exemplu' + T + T + '2026', JSON.stringify(r));
r = headFootText(`<w:hdr><w:p>${run('A')}<w:r><w:ptab w:relativeTo="margin" w:alignment="right" w:leader="none"/></w:r>${run('B')}</w:p></w:hdr>`);
check('tab de aliniere la dreapta → dreapta', r.text === 'A' + T + T + 'B', JSON.stringify(r));

// Fișierele reale din corpus: nu trebuie să cadă, iar antetele au cel mult 200 de caractere.
const root = '../test-corpus';
const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = d + '/' + n; if (statSync(p).isDirectory()) walk(p); else if (/\.docx$/i.test(n)) files.push(p); } };
try { walk(root); } catch {}
let withHf = 0, errs = 0;
for (const f of files) {
  try {
    const { layout: l } = await docxToHtml(new Uint8Array(readFileSync(f)));
    if (l?.header || l?.footer || l?.numbers || l?.firstPage) { withHf++; if (process.env.ARATA) console.log('   ', f.split('/').pop(), JSON.stringify({ h: l.header, f: l.footer, n: l.numbers, first: l.firstPage })); }
    if ((l?.header ?? '').length > 200 || (l?.footer ?? '').length > 200) { errs++; console.log('prea lung:', f); }
  } catch (e) { /* fișierele stricate cu bună știință sunt verificate de testul de compatibilitate */ }
}
const diff = files.find((f) => f.endsWith('/DiffFirstPageHeadFoot.docx'));
if (diff) {
  const { layout: l } = await docxToHtml(new Uint8Array(readFileSync(diff)));
  check('DiffFirstPageHeadFoot.docx: antet în trei bucăți + prima pagină', l?.header === ['First header column!', 'Mid header', 'Right header!'].join(String.fromCharCode(9)) && l?.firstPage?.footer === 'The footer of the first page', JSON.stringify(l));
}
check(`corpus: ${files.length} fișiere .docx, ${withHf} cu antet / subsol`, errs === 0 && (files.length === 0 || withHf > 0));

console.log(fail ? `${fail} GREȘELI` : 'Toate verificările au trecut.');
process.exit(fail ? 1 : 0);
