// Docs: schimbările de format urmărite (formatChange) ajung în .docx ca w:rPrChange, cu formatul de dinainte, autorul și data.
// Rulare (în suite/): node tests/docs-trackformat.test.mjs  (--arata scrie document.xml)
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
const out = join(tmpdir(), `suite-docsfmt-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml, rprChangeOps } from './src/docs/docxImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx, docxToHtml, rprChangeOps } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const fc = (ops) => ({ type: 'formatChange', attrs: { author: 'Ana', date: '2026-10-28T08:00:00Z', ops: JSON.stringify(ops) } });
const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'text', text: 'Unu', marks: [fc([{ op: 'remove', type: 'bold' }])] },
  { type: 'text', text: ' ' },
  { type: 'text', text: 'doi', marks: [{ type: 'bold' }, fc([{ op: 'add', type: 'bold' }])] },
  { type: 'text', text: ' ' },
  { type: 'text', text: 'patru', marks: [{ type: 'textStyle', attrs: { color: '#ff0000' } }, fc([{ op: 'remove', type: 'textStyle', attrs: { color: '#0000ff' } }, { op: 'add', type: 'textStyle', attrs: { color: '#ff0000' } }])] },
  { type: 'text', text: ' simplu' },
] }] };
const bytes = await docToDocx(doc, { header: '', footer: '', numbers: false });
const xml = await (await JSZip.loadAsync(bytes)).file('word/document.xml').async('string');
if (process.argv.includes('--arata')) console.log(xml);
const run = (word) => { const i = xml.indexOf('>' + word + '<'); const s = xml.lastIndexOf('<w:r>', i) >= 0 ? xml.lastIndexOf('<w:r>', i) : xml.lastIndexOf('<w:r ', i); return xml.slice(s, i); };
const unu = run('Unu'), doi = run('doi'), patru = run('patru'), simplu = run(' simplu');
check('„Unu”: aldinul scos, vechiul format (aldin) în w:rPrChange', /<w:rPrChange[^>]*w:author="Ana"[^>]*>.*<w:b\/>.*<\/w:rPrChange>/.test(unu) && !/<w:b\/>.*<w:rPrChange/.test(unu), unu);
check('„doi”: aldin acum, fără aldin înainte', /<w:b\/>.*<w:rPrChange/.test(doi) && !/<w:rPrChange.*<w:b\/>/.test(doi), doi);
check('„patru”: culoarea nouă FF0000, cea veche 0000FF în w:rPrChange', /<w:color w:val="FF0000"\/>.*<w:rPrChange.*<w:color w:val="0000FF"\/>/i.test(patru), patru);
check('w:rPrChange are id, autor și dată', /<w:rPrChange w:id="\d+" w:author="Ana" w:date="2026-10-28T08:00:00Z"/.test(unu) || /<w:rPrChange[^>]*w:id="\d+"[^>]*w:author="Ana"[^>]*w:date="2026-10-28T08:00:00Z"/.test(unu), unu);
check('„doi”: w:rPrChange are w:rPr gol înăuntru (cerut de schemă)', /<w:rPrChange [^>]*><w:rPr\/><\/w:rPrChange>/.test(doi) && !/<w:rPrChange [^>]*\/>/.test(xml), doi);
check('textul simplu nu are w:rPrChange', !simplu.includes('rPrChange'), simplu);
const ids = [...xml.matchAll(/<w:rPrChange[^>]*w:id="(\d+)"/g)].map((m) => m[1]);
check('id-uri diferite', ids.length === 3 && new Set(ids).size === 3, ids.join(','));
// Înapoi: la deschidere, w:rPrChange devine schimbare de format (semne în jurul rulajului + lista de schimbări).
const back = await docxToHtml(bytes);
const fmts = back.changes.filter((c) => c.kind === 'format');
check('înapoi: trei schimbări de format (aldin scos, aldin pus, culoarea schimbată)', fmts.length === 3, JSON.stringify(back.changes));
check('înapoi: „patru” = culoarea albastră scoasă, cea roșie pusă', fmts.some((c) => c.ops === '[{"op":"remove","type":"textStyle","attrs":{"color":"#0000ff"}},{"op":"add","type":"textStyle","attrs":{"color":"#ff0000"}}]'), JSON.stringify(fmts));
check('înapoi: „Unu” = aldin scos, cu autor și dată', fmts.some((c) => c.ops === '[{"op":"remove","type":"bold"}]' && c.author === 'Ana' && c.date === '2026-10-28T08:00:00Z'), JSON.stringify(fmts));
check('înapoi: „doi” = aldin pus', fmts.some((c) => c.ops === '[{"op":"add","type":"bold"}]'), JSON.stringify(fmts));
const S = String.fromCharCode(0xe007), E = String.fromCharCode(0xe008), C = String.fromCharCode(0xe001);
check('înapoi: semnele stau în jurul cuvintelor', back.html.includes(S + fmts[0]?.id + C + 'Unu' + E + fmts[0]?.id + C) && /<strong>doi<\/strong>|doi/.test(back.html), back.html.slice(0, 300));
check('înapoi: textul fără format vechi rămâne normal, „doi” rămâne aldin', /<strong>[^<]*doi/.test(back.html) && !/<strong>[^<]*Unu/.test(back.html), back.html.slice(0, 300));
check('rprChangeOps: subliniat pus, cursiv scos', JSON.stringify(rprChangeOps('<w:u w:val="single"/>', '<w:i/>')) === '[{"op":"remove","type":"italic"},{"op":"add","type":"underline"}]', JSON.stringify(rprChangeOps('<w:u w:val="single"/>', '<w:i/>')));
check('rprChangeOps: w:b w:val="0" nu e aldin', rprChangeOps('<w:b w:val="0"/>', '').length === 0);
const j = (a, b) => JSON.stringify(rprChangeOps(a, b));
check('rprChangeOps: fontul și mărimea schimbate', j('<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="28"/>', '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/>') === '[{"op":"remove","type":"textStyle","attrs":{"fontFamily":"Calibri","fontSize":"11pt"}},{"op":"add","type":"textStyle","attrs":{"fontFamily":"Arial","fontSize":"14pt"}}]', j('<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="28"/>', '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/>'));
check('rprChangeOps: același font și aceeași mărime = nimic', rprChangeOps('<w:rFonts w:ascii="Arial"/><w:sz w:val="24"/><w:b/>', '<w:rFonts w:ascii="Arial"/><w:sz w:val="24"/>').length === 1);
check('rprChangeOps: culoarea pusă (fără culoare înainte)', j('<w:color w:val="C00000"/>', '') === '[{"op":"add","type":"textStyle","attrs":{"color":"#c00000"}}]', j('<w:color w:val="C00000"/>', ''));
check('rprChangeOps: negrul = fără culoare', rprChangeOps('<w:color w:val="000000"/>', '').length === 0);
check('rprChangeOps: evidențiere galbenă pusă', j('<w:highlight w:val="yellow"/>', '') === '[{"op":"add","type":"highlight","attrs":{"color":"#ffff00"}}]', j('<w:highlight w:val="yellow"/>', ''));
check('rprChangeOps: fundalul rulajului scos', j('', '<w:shd w:val="clear" w:color="auto" w:fill="FFF176"/>') === '[{"op":"remove","type":"highlight","attrs":{"color":"#fff176"}}]', j('', '<w:shd w:val="clear" w:color="auto" w:fill="FFF176"/>'));
console.log(fail ? `\n${fail} GREȘELI` : '\nTOATE TESTELE AU TRECUT');
process.exit(fail ? 1 : 0);