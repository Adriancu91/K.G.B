// Test: graficele din .docx (w:drawing cu c:chart) se citesc ca grafice Docs (imagine + data-chart cu felul, titlul și datele).
// Rulare (în suite/): node tests/docs-docx-charts.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';

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
import { readFileSync } from 'node:fs';
const out = join(tmpdir(), `suite-docxch-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docxToHtml } from './src/docs/docxImport.ts'; export { parseChart } from './src/docs/chart.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docxToHtml, parseChart } = await import(pathToFileURL(out).href);
let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const unq = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
const chartsOf = (html) => [...html.matchAll(/<img\b[^>]*\bdata-chart="([^"]*)"/g)].map((m) => parseChart(unq(m[1])));

const a = await docxToHtml(new Uint8Array(readFileSync('../test-corpus/docx/61745.docx')));
const ca = chartsOf(a.html);
check('61745.docx: 2 grafice', ca.length === 2 && ca.every(Boolean), String(ca.length));
check('61745.docx: au serii și categorii', ca.every((c) => c && c.cells.length >= 2 && c.cells[0].length >= 2), JSON.stringify(ca[0]?.cells?.slice(0, 2)));
check('61745.docx: imaginea are lățimea din document', /<img\b[^>]*width="\d+"[^>]*data-chart=/.test(a.html));

const b = await docxToHtml(new Uint8Array(readFileSync('../test-corpus/docx/chartex.docx')));
const cb = chartsOf(b.html);
check('chartex.docx: 4 grafice (coloane, linie, radar, bursier)', cb.length === 4, String(cb.length));
check('chartex.docx: bursierul rămâne bursier', cb.some((c) => c?.t === 'stock'), cb.map((c) => c?.t).join(','));
check('chartex.docx: semnele nu rămân în text', !/⁣g\d+⁣/.test(b.html));

rmSync(out, { force: true });
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
