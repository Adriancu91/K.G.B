// Test pentru imaginile în fața / în spatele textului din Docs: ordinea, export .docx (ancoră) și .odt.
// Rulare (în suite/): node tests/docs-floating.test.mjs
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
const out = join(tmpdir(), `suite-docsfl-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { reorderZ, clampOffset, zIndexOf, isFloating } from './src/docs/floating.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const mod = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
const { docxToHtml, docToOdt, docToDocx, reorderZ, clampOffset, zIndexOf, isFloating } = mod;

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Ordinea: trei imagini cu z 1, 2, 3 (a doua e la mijloc).
check('adu în față', eq(reorderZ([1, 2, 3], 0, 'front'), [3, 1, 2]), String(reorderZ([1, 2, 3], 0, 'front')));
check('trimite în spate', eq(reorderZ([1, 2, 3], 2, 'back'), [2, 3, 1]));
check('mai în față cu un loc', eq(reorderZ([1, 2, 3], 0, 'forward'), [2, 1, 3]));
check('mai în spate cu un loc', eq(reorderZ([1, 2, 3], 1, 'backward'), [2, 1, 3]));
check('cea de sus rămâne sus', eq(reorderZ([1, 2, 3], 2, 'forward'), [1, 2, 3]));
check('z egale: ordinea din document, apoi 1…n', eq(reorderZ([0, 0, 0], 0, 'front'), [3, 1, 2]));
check('z lipsă', eq(reorderZ([NaN, 5], 1, 'back'), [2, 1]));
check('deplasare limitată', clampOffset(99999) === 4000 && clampOffset('x') === 0 && clampOffset(-12.6) === -13);
check('spate sub text, față peste', zIndexOf('behind', 3) < 0 && zIndexOf('front', 1) > 0);
check('numai față / spate plutesc', isFloating('front') && isFloating('behind') && !isFloating('wrapLeft') && !isFloating(undefined));

// O poză PNG de 4 × 2 px.
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAAEUlEQVR4nGP4z8DwHxkzEMEBAP8LB/n+3vYsAAAAAElFTkSuQmCC';
const doc = (align, extra = {}) => ({ type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'Text peste poză.' }] },
  { type: 'image', attrs: { src: png, alt: 'Siglă', width: 200, align, ...extra } },
  { type: 'paragraph', content: [{ type: 'text', text: 'Încă un rând.' }] },
] });
const docxXml = async (d) => (await (await JSZip.loadAsync(await docToDocx(d))).file('word/document.xml').async('string'));
{
  const xml = await docxXml(doc('behind', { dx: 30, dy: -20, z: 2 }));
  const anchor = /<wp:anchor\b[^>]*>/.exec(xml)?.[0] ?? '';
  check('.docx: imaginea din spate e ancorată', !!anchor, xml.slice(0, 200));
  check('.docx: în spatele textului', /behindDoc="(1|true)"/.test(anchor), anchor);
  check('.docx: fără text în jur', xml.includes('<wp:wrapNone'));
  check('.docx: deplasarea în EMU', xml.includes('<wp:posOffset>285750</wp:posOffset>') && xml.includes('<wp:posOffset>-190500</wp:posOffset>'), (xml.match(/<wp:posOffset>[^<]*/g) ?? []).join(','));
  check('.docx: ordinea', /relativeHeight="2"/.test(anchor), anchor);
}
{
  const xml = await docxXml(doc('front', { dx: 0, dy: 0, z: 1 }));
  const anchor = /<wp:anchor\b[^>]*>/.exec(xml)?.[0] ?? '';
  check('.docx: în fața textului', !!anchor && /behindDoc="(0|false)"/.test(anchor) && /relativeHeight="1001"/.test(anchor), anchor);
}
{
  const xml = await docxXml(doc('wrapLeft'));
  check('.docx: celelalte imagini rămân în rând', xml.includes('<wp:inline') && !xml.includes('<wp:anchor'));
}
{
  const zip = await JSZip.loadAsync(await docToOdt(doc('behind', { dx: 96, dy: 48, z: 1 })));
  const xml = await zip.file('content.xml').async('string');
  const frame = /<draw:frame\b[^>]*>/.exec(xml)?.[0] ?? '';
  check('.odt: cadru ancorat la paragraf', frame.includes('text:anchor-type="paragraph"') && frame.includes('svg:x="2.540cm"') && frame.includes('svg:y="1.270cm"'), frame);
  const st = /draw:style-name="(Gr\d+)"/.exec(frame)?.[1];
  check('.odt: textul trece pe deasupra', !!st && new RegExp(`style:name="${st}" style:family="graphic"><style:graphic-properties [^>]*style:run-through="background"`).test(xml));
  const xml2 = await (await JSZip.loadAsync(await docToOdt(doc('front')))).file('content.xml').async('string');
  check('.odt: în față', xml2.includes('style:run-through="foreground"'));
}
{
  // Dus-întors: .docx scris de noi → citit înapoi.
  const d = doc('behind', { dx: 30, dy: -20, z: 2 });
  d.content.push({ type: 'image', attrs: { src: png, alt: '', width: 100, align: 'front', dx: 5, dy: 6, z: 1 } });
  const { html } = await docxToHtml(await docToDocx(d));
  const imgs = html.match(/<img[^>]*>/g) ?? [];
  check('import: două imagini', imgs.length === 2, String(imgs.length));
  check('import: în spate, cu deplasarea și textul alternativ', /data-align="behind"/.test(imgs[0]) && /data-dx="30"/.test(imgs[0]) && /data-dy="-20"/.test(imgs[0]) && /alt="Siglă"/.test(imgs[0]) && /data-z="1"/.test(imgs[0]), imgs[0]?.replace(/src="[^"]*"/, ''));
  check('import: în față', /data-align="front"/.test(imgs[1]) && /data-dx="5"/.test(imgs[1]) && !/alt="/.test(imgs[1]), imgs[1]?.replace(/src="[^"]*"/, ''));
  const plain = await docxToHtml(await docToDocx(doc('center')));
  check('import: imaginile din rând nu se schimbă', !/data-align/.test(plain.html.match(/<img[^>]*>/)?.[0] ?? ''));
}
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);
