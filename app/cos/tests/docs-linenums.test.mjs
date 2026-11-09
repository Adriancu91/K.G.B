// Test pentru Docs → Numere de rând: calculul rândurilor, .sdoc, .docx (w:lnNumType) și .odt (text:linenumbering-configuration), dus-întors.
// Rulare (în suite/): node tests/docs-linenums.test.mjs
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
const out = join(tmpdir(), `suite-docsln-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { NO_PAGE_SETUP, parseDoc, serializeDoc, lineNums } from './src/docs/format.ts'; export * from './src/docs/lineNumMath.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, odtToHtml, docToDocx, docxToHtml, NO_PAGE_SETUP, parseDoc, serializeDoc, lineNums, groupLines, numberLines } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };

// Rândurile unui paragraf: bucăți de text pe același rând (aldin, alt font) se unesc; un rând nou începe dedesubt.
const g = groupLines([{ top: 0, height: 20 }, { top: 2, height: 16 }, { top: 21, height: 20 }, { top: 0, height: 0 }, { top: 42, height: 22 }]);
check('trei rânduri din cinci bucăți', g.length === 3 && g[0].top === 0 && g[0].height === 20 && g[2].top === 42, JSON.stringify(g));
check('fără bucăți: niciun rând', groupLines([]).length === 0);
const tops = [0, 20, 40, 1000, 1020, 2100];
check('continuu: 1…6', numberLines(tops, [0, 990, 2000], false).join(',') === '1,2,3,4,5,6');
check('de la 1 pe fiecare pagină', numberLines(tops, [0, 990, 2000], true).join(',') === '1,2,3,1,2,1');
check('din 2 în 2 (celelalte fără număr)', numberLines(tops, [0], false, 2).join(',') === '0,2,0,4,0,6');

// .sdoc
const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Art. 1. Părțile contractante.' }] }] };
const back = parseDoc(serializeDoc(content, { ...NO_PAGE_SETUP, lineNums: { page: true, by: 5 } }));
check('.sdoc păstrează numerele de rând', back.page?.lineNums?.page === true && back.page.lineNums.by === 5, JSON.stringify(back.page?.lineNums));
check('pas greșit → 1', JSON.stringify(lineNums({ ...NO_PAGE_SETUP, lineNums: { by: 7 } })) === '{}');
check('fără numere: nimic', lineNums(NO_PAGE_SETUP) === undefined && !JSON.parse(serializeDoc(content, NO_PAGE_SETUP)).page);

// .docx
for (const ln of [{ page: true, by: 5 }, {}]) {
  const bytes = await docToDocx(content, { ...NO_PAGE_SETUP, lineNums: ln });
  const xml = await (await JSZip.loadAsync(bytes)).file('word/document.xml').async('string');
  const tag = /<w:lnNumType\b[^>]*>/.exec(xml)?.[0] ?? '';
  check(`.docx scrie w:lnNumType ${JSON.stringify(ln)}`, ln.page ? /countBy="5"/.test(tag) && /restart="newPage"/.test(tag) : /countBy="1"/.test(tag) && /restart="continuous"/.test(tag), tag);
  const imp = await docxToHtml(bytes);
  check(`.docx citit înapoi ${JSON.stringify(ln)}`, JSON.stringify(imp.layout?.lineNums) === JSON.stringify(ln), JSON.stringify(imp.layout?.lineNums));
}
const plain = await docToDocx(content, NO_PAGE_SETUP);
check('.docx fără numere de rând', !(await (await JSZip.loadAsync(plain)).file('word/document.xml').async('string')).includes('lnNumType') && !(await docxToHtml(plain)).layout?.lineNums);

// .odt
for (const ln of [{ page: true, by: 10 }, {}]) {
  const bytes = await docToOdt(content, { ...NO_PAGE_SETUP, lineNums: ln });
  const xml = await (await JSZip.loadAsync(bytes)).file('styles.xml').async('string');
  check(`.odt scrie text:linenumbering-configuration ${JSON.stringify(ln)}`, xml.includes('text:linenumbering-configuration text:number-lines="true"'));
  const imp = await odtToHtml(bytes);
  check(`.odt citit înapoi ${JSON.stringify(ln)}`, JSON.stringify(imp.layout?.lineNums) === JSON.stringify(ln), JSON.stringify(imp.layout?.lineNums));
}
check('.odt fără numere de rând', !(await odtToHtml(await docToOdt(content, NO_PAGE_SETUP))).layout?.lineNums);

console.log(fail ? `${fail} GREȘELI` : 'Toate testele numerelor de rând au trecut.');
process.exit(fail ? 1 : 0);
