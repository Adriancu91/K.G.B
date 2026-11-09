// Test pentru efectele de text din Docs (contur, umbră, contur cu umbră, relief, gravat): .docx (w:outline, w:shadow, w:emboss, w:imprint)
// și .odt, scrise și citite înapoi. Rulare (în suite/): node tests/docs-texteffect.test.mjs
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
const out = join(tmpdir(), `suite-docsfx-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { docToOdt } from './src/docs/odtExport.ts'; export { odtToHtml } from './src/docs/odtImport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx, docxToHtml, docToOdt, odtToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' → ' + info}`); if (!ok) fail++; };
const FX = ['outline', 'shadow', 'outline-shadow', 'emboss', 'imprint'];
const doc = { type: 'doc', content: FX.map((fx) => ({ type: 'paragraph', content: [
  { type: 'text', text: 'Efect ' + fx, marks: [{ type: 'textStyle', attrs: { textEffect: fx, color: '#c62828' } }, { type: 'bold' }] },
] })) };
const bytes = await docToDocx(doc);
const xml = await (await JSZip.loadAsync(bytes)).file('word/document.xml').async('string');
const rPrOf = (t) => { const i = xml.indexOf('>' + t + '<'); const a = xml.lastIndexOf('<w:rPr>', i); return xml.slice(a, xml.indexOf('</w:rPr>', a)); };
check('.docx: fără semne w:effect rămase', !xml.includes('<w:effect'), xml.match(/<w:effect[^>]*>/)?.[0]);
check('.docx: contur', rPrOf('Efect outline').includes('<w:outline/>') && !rPrOf('Efect outline').includes('<w:shadow/>'), rPrOf('Efect outline'));
check('.docx: umbră', rPrOf('Efect shadow').includes('<w:shadow/>') && !rPrOf('Efect shadow').includes('<w:outline/>'), rPrOf('Efect shadow'));
check('.docx: contur cu umbră', rPrOf('Efect outline-shadow').includes('<w:outline/><w:shadow/>'), rPrOf('Efect outline-shadow'));
check('.docx: relief', rPrOf('Efect emboss').includes('<w:emboss/>'), rPrOf('Efect emboss'));
check('.docx: gravat', rPrOf('Efect imprint').includes('<w:imprint/>'), rPrOf('Efect imprint'));
{
  const r = rPrOf('Efect outline');
  check('.docx: w:outline înaintea culorii (ordinea din schemă)', r.indexOf('<w:outline/>') < r.indexOf('<w:color') && r.indexOf('<w:b/>') < r.indexOf('<w:outline/>'), r);
}
const back = await docxToHtml(bytes);
const html = typeof back === 'string' ? back : back.html;
for (const fx of FX) check(`.docx citit înapoi: ${fx}`, new RegExp('--text-effect: ' + fx + ';[^"]*"[^>]*>(<[^>]+>)*Efect ' + fx + '<').test(html), html.slice(0, 300));
// Strălucirea: w14:glow la sfârșitul w:rPr (după toate elementele w:), citită înapoi.
{
  const g = await docToDocx({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Efect glow', marks: [{ type: 'textStyle', attrs: { textEffect: 'glow', color: '#1565c0' } }, { type: 'italic' }] }] }] });
  const gx = await (await JSZip.loadAsync(g)).file('word/document.xml').async('string');
  const i = gx.indexOf('>Efect glow<'), a = gx.lastIndexOf('<w:rPr>', i), r = gx.slice(a, gx.indexOf('</w:rPr>', a) + 8);
  check('.docx: strălucirea ca w14:glow aurie', r.includes('<w14:glow w14:rad="101600"><w14:srgbClr w14:val="FFC000">'), r);
  check('.docx: w14:glow la sfârșitul w:rPr, fără w:effect', r.endsWith('</w14:glow></w:rPr>') && !gx.includes('<w:effect'), r);
  check('.docx: spațiul de nume w14 declarat', /<w:document [^>]*xmlns:w14=/.test(gx));
  const gh = await docxToHtml(g);
  check('.docx citit înapoi: strălucirea', /--text-effect: glow;[^"]*"[^>]*>(<[^>]+>)*Efect glow</.test(typeof gh === 'string' ? gh : gh.html), (typeof gh === 'string' ? gh : gh.html).slice(0, 300));
}
// Ligaturile: w14:ligatures la sfârșitul w:rPr (după w14:glow), fără semnul de lucru w:w, citite înapoi; valorile vechi se potrivesc.
{
  const LG = ['none', 'standard', 'standardContextual', 'historicalDiscretional', 'all'];
  const g = await docToDocx({ type: 'doc', content: [
    ...LG.map((lg) => ({ type: 'paragraph', content: [{ type: 'text', text: 'Ligaturi ' + lg, marks: [{ type: 'textStyle', attrs: { ligatures: lg, color: '#2e7d32' } }] }] })),
    { type: 'paragraph', content: [{ type: 'text', text: 'Glow fi', marks: [{ type: 'textStyle', attrs: { ligatures: 'all', textEffect: 'glow' } }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Umbra fi', marks: [{ type: 'textStyle', attrs: { ligatures: 'standard', textEffect: 'shadow' } }] }] },
  ] });
  const gx = await (await JSZip.loadAsync(g)).file('word/document.xml').async('string');
  const rOf = (t) => { const i = gx.indexOf('>' + t + '<'), a = gx.lastIndexOf('<w:rPr>', i); return gx.slice(a, gx.indexOf('</w:rPr>', a) + 8); };
  check('.docx: fără semnul w:w rămas', !/<w:w w:val=/.test(gx), gx.match(/<w:w [^>]*>/)?.[0]);
  for (const lg of LG) check('.docx: ligaturi ' + lg, rOf('Ligaturi ' + lg).endsWith('<w14:ligatures w14:val="' + lg + '"/></w:rPr>'), rOf('Ligaturi ' + lg));
  check('.docx: ligaturile după w14:glow', rOf('Glow fi').endsWith('</w14:glow><w14:ligatures w14:val="all"/></w:rPr>'), rOf('Glow fi'));
  check('.docx: ligaturile cu umbră (w:shadow la locul lui)', rOf('Umbra fi').includes('<w:shadow/>') && rOf('Umbra fi').endsWith('<w14:ligatures w14:val="standard"/></w:rPr>'), rOf('Umbra fi'));
  const h = await docxToHtml(g); const hh = typeof h === 'string' ? h : h.html;
  for (const lg of LG) check('.docx citit înapoi: ligaturi ' + lg, new RegExp('--ligatures: ' + lg + ';[^"]*"[^>]*>(<[^>]+>)*Ligaturi ' + lg + '<').test(hh), hh.slice(0, 300));
  check('.docx citit înapoi: strălucire și ligaturi', /--text-effect: glow[^"]*--ligatures: all|--ligatures: all[^"]*--text-effect: glow/.test(hh), hh.slice(0, 300));
  // Valoarea veche (contextualHistorical) din fișierele primite.
  const zip = await JSZip.loadAsync(g);
  zip.file('word/document.xml', gx.replace('w14:val="none"', 'w14:val="contextualHistorical"'));
  const h2 = await docxToHtml(await zip.generateAsync({ type: 'uint8array' })); const hh2 = typeof h2 === 'string' ? h2 : h2.html;
  check('.docx primit: contextualHistorical → istorice și opționale', /--ligatures: historicalDiscretional;[^"]*"[^>]*>(<[^>]+>)*Ligaturi none</.test(hh2), hh2.slice(0, 300));
}
const odt = await docToOdt(doc);
const cx = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
check('.odt: contur, umbră, relief, gravat', cx.includes('style:text-outline="true"') && cx.includes('fo:text-shadow="1pt 1pt"') && cx.includes('style:font-relief="embossed"') && cx.includes('style:font-relief="engraved"'), cx.slice(0, 400));
const ob = (await odtToHtml(odt)).html;
for (const fx of FX) check(`.odt citit înapoi: ${fx}`, new RegExp('--text-effect: ' + fx + ';').test(ob) && ob.includes('Efect ' + fx), ob.slice(0, 300));
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
