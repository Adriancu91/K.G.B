// Test pentru întreruperile de secțiune din Docs: export .docx (w:sectPr cu felul fiecărei secțiuni), citire înapoi și .odt.
// Rulare (în suite/): node tests/docs-section-break.test.mjs
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
const out = join(tmpdir(), `suite-docssect-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToOdt } from './src/docs/odtExport.ts'; export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { docJsonToRtf } from './src/docs/plainExport.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToOdt, docToDocx, docxToHtml, docJsonToRtf } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const p = (t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });
const SECT = /<w:sectPr[ >][^]*?<[/]w:sectPr>/g;

// Trei întreruperi de secțiune: Continuu, Pagină impară, Pagina următoare → patru secțiuni.
const doc = { type: 'doc', content: [p('Unu'), { type: 'sectionBreak', attrs: { kind: 'continuous' } }, p('Doi'), { type: 'sectionBreak', attrs: { kind: 'oddPage' } }, p('Trei'), { type: 'sectionBreak', attrs: { kind: 'nextPage' } }, p('Patru')] };
const docx = await docToDocx(doc, { landscape: true, header: 'Antetul meu', footer: '' });
const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml').async('string');
const sects = xml.match(SECT) ?? [];
check('.docx: patru secțiuni (w:sectPr)', sects.length === 4, String(sects.length));
const types = sects.map((s) => /<w:type w:val="([a-zA-Z]+)"/.exec(s)?.[1] ?? '-');
check('.docx: felul fiecărei secțiuni (al întreruperii dinaintea ei)', types.slice(1).join(',') === 'continuous,oddPage,nextPage', types.join(','));
check('.docx: toate secțiunile culcate', sects.every((s) => s.includes('w:orient="landscape"')), sects.map((s) => s.slice(0, 200)).join(' | '));
check('.docx: antetul doar în prima secțiune (celelalte îl preiau)', sects.filter((s) => s.includes('w:headerReference')).length === 1);
check('.docx: textul în ordine', /Unu[^]*Doi[^]*Trei[^]*Patru/.test(xml));

const back = await docxToHtml(docx);
const marks = [...back.html.matchAll(/<div data-section-break="([a-zA-Z]+)"><[/]div>/g)].map((m) => m[1]);
check('înapoi din .docx: trei întreruperi, cu felul lor', marks.join(',') === 'continuous,oddPage,nextPage', marks.join(',') + ' | ' + back.html.slice(0, 300));
check('înapoi din .docx: fără semne rămase în text', !back.html.includes(String.fromCharCode(0x2063)) && /Unu[^]*continuous[^]*Doi[^]*oddPage[^]*Trei[^]*nextPage[^]*Patru/.test(back.html), back.html.slice(0, 400));
check('înapoi din .docx: pagina rămâne culcată', back.layout?.landscape === true || JSON.stringify(back).includes('"landscape":true'), JSON.stringify(back.layout ?? {}).slice(0, 200));

// Fără întreruperi: o singură secțiune, ca până acum.
const single = await docToDocx({ type: 'doc', content: [p('Singur')] });
const one = await (await JSZip.loadAsync(single)).file('word/document.xml').async('string');
check('fără întreruperi: o secțiune', (one.match(SECT) ?? []).length === 1);
check('fără întreruperi: nimic adăugat la import', !(await docxToHtml(single)).html.includes('data-section-break'));

// .odt: Pagină impară / Pagina următoare devin pagină nouă, Continuu nu adaugă nimic.
const odt = await docToOdt(doc);
const content = await (await JSZip.loadAsync(odt)).file('content.xml').async('string');
const styles = [...content.matchAll(/<style:style style:name="(P[0-9]+)"[^>]*>(?:(?!<[/]style:style>)[^])*fo:break-after="page"/g)].map((m) => m[1]);
const brk = styles.reduce((n, s) => n + (content.match(new RegExp(`<text:p text:style-name="${s}"[/]>`, 'g')) ?? []).length, 0);
check('.odt: două pagini noi', brk === 2, String(brk));

// .rtf: trei secțiuni noi, cu felul lor.
const rtf = docJsonToRtf(doc);
const B = String.fromCharCode(92);
check('.rtf: sbknone, sbkodd, sbkpage', [`${B}sbknone`, `${B}sbkodd`, `${B}sbkpage`].every((k) => rtf.includes(k)) && rtf.split(`${B}sect${B}sectd`).length === 4, rtf.slice(0, 200));


// Orientarea doar pentru o secțiune: documentul în picioare, a doua secțiune culcată, a treia ca documentul.
{
  const od = { type: 'doc', content: [p('Unu'), { type: 'sectionBreak', attrs: { kind: 'nextPage', orient: 'landscape' } }, p('Tabel lat'), { type: 'sectionBreak', attrs: { kind: 'nextPage' } }, p('Trei')] };
  const ox = await (await JSZip.loadAsync(await docToDocx(od))).file('word/document.xml').async('string');
  const os = ox.match(SECT) ?? [];
  const land = os.map((s) => s.includes('w:orient="landscape"'));
  check('orientare pe secțiune: doar a doua culcată în .docx', land.join(',') === 'false,true,false', land.join(','));
  const sz = os.map((s) => [/w:w="(\d+)"/, /w:h="(\d+)"/].map((r) => Number(r.exec(/<w:pgSz[^>]*>/.exec(s)?.[0] ?? '')?.[1])));
  check('orientare pe secțiune: pagina culcată e mai lată decât înaltă', sz[1][0] > sz[1][1] && sz[0][0] < sz[0][1], JSON.stringify(sz));
  const ob = await docxToHtml(await docToDocx(od));
  const om = [...ob.html.matchAll(/<div data-section-break="([a-zA-Z]+)"( data-orient="([a-z]+)")?><[/]div>/g)].map((m) => m[3] ?? '-');
  check('orientare pe secțiune: înapoi din .docx, prima întrerupere culcată, a doua ca documentul', om.join(',') === 'landscape,-', om.join(',') + ' | ' + ob.html.slice(0, 300));
  check('orientare pe secțiune: documentul rămâne în picioare', !ob.layout?.landscape, JSON.stringify(ob.layout ?? {}).slice(0, 200));
  // Document culcat, o secțiune în picioare la mijloc.
  const pd = { type: 'doc', content: [p('Unu'), { type: 'sectionBreak', attrs: { kind: 'nextPage', orient: 'portrait' } }, p('Doi'), { type: 'sectionBreak', attrs: { kind: 'continuous' } }, p('Trei')] };
  const pb = await docxToHtml(await docToDocx(pd, { landscape: true, header: '', footer: '' }));
  const pm = [...pb.html.matchAll(/<div data-section-break="([a-zA-Z]+)"( data-orient="([a-z]+)")?><[/]div>/g)].map((m) => m[1] + ':' + (m[3] ?? '-'));
  check('document culcat cu o secțiune în picioare: dus-întors', pm.join(',') === 'nextPage:portrait,continuous:-' && pb.layout?.landscape === true, pm.join(',') + ' ' + JSON.stringify(pb.layout ?? {}).slice(0, 120));
}
{
  // Marginile pe secțiune (Aspect → Margini → Doar secțiunea aceasta): a doua secțiune cu 1 cm, culcată; a treia ca documentul.
  const md = { type: 'doc', content: [p('Unu'), { type: 'sectionBreak', attrs: { kind: 'nextPage', orient: 'landscape', margin: 10 } }, p('Tabel lat'), { type: 'sectionBreak', attrs: { kind: 'nextPage' } }, p('Trei')] };
  const mx = await (await JSZip.loadAsync(await docToDocx(md, { margin: 25, header: '', footer: '' }))).file('word/document.xml').async('string');
  const ms = [...mx.matchAll(/<w:sectPr[^]*?<[/]w:sectPr>/g)].map((m) => m[0]);
  const lefts = ms.map((s) => Number(/<w:pgMar[^>]*w:left="(-?[0-9]+)"/.exec(s)?.[1]));
  check('margini pe secțiune: 2,5 cm, 1 cm, 2,5 cm în .docx', lefts.join(',') === '1418,567,1418', lefts.join(','));
  const mb = await docxToHtml(await docToDocx(md, { margin: 25, header: '', footer: '' }));
  const mm = [...mb.html.matchAll(/<div data-section-break="([a-zA-Z]+)"( data-orient="([a-z]+)")?( data-margin="([0-9]+)")?><[/]div>/g)].map((m) => (m[3] ?? '-') + ':' + (m[5] ?? '-'));
  check('margini pe secțiune: înapoi din .docx, prima întrerupere culcată cu 1 cm, a doua ca documentul', mm.join(',') === 'landscape:10,-:-', mm.join(',') + ' | ' + mb.html.slice(0, 300));
  check('margini pe secțiune: documentul păstrează 2,5 cm (de la prima secțiune)', mb.layout?.margin === 25 || Math.abs((mb.layout?.margin ?? 0) - 25) < 0.6, JSON.stringify(mb.layout ?? {}).slice(0, 200));
}
// Antet / subsol propriu pe secțiune (Legat de anterior oprit): a doua secțiune are antetul ei, a treia îl preia (legată), a patra are doar subsolul ei.
{
  const hd = { type: 'doc', content: [p('Unu'), { type: 'sectionBreak', attrs: { kind: 'nextPage', hdr: 'Capitolul 2 „Cifre”', ftr: null } }, p('Doi'), { type: 'sectionBreak', attrs: { kind: 'nextPage' } }, p('Trei'), { type: 'sectionBreak', attrs: { kind: 'nextPage', hdr: null, ftr: 'Anexe' } }, p('Patru')] };
  const bytes = await docToDocx(hd, { header: 'Raport anual', footer: 'Firma', numbers: false });
  const z = await JSZip.loadAsync(bytes);
  const x = await z.file('word/document.xml').async('string');
  const refs = [...x.matchAll(SECT)].map((m) => (m[0].match(/<w:headerReference/g) ?? []).length + '/' + (m[0].match(/<w:footerReference/g) ?? []).length);
  check('antet pe secțiune: referințele în .docx (1/1, 1/0, 0/0, 0/1)', refs.join(',') === '1/1,1/0,0/0,0/1', refs.join(','));
  const heads = await Promise.all(Object.keys(z.files).filter((f) => /^word[/]header[0-9]+[.]xml$/.test(f)).map((f) => z.file(f).async('string')));
  check('antet pe secțiune: textul antetului propriu e într-un antet', heads.some((h) => h.includes('Capitolul 2 „Cifre”')), heads.length + '');
  const back = await docxToHtml(bytes);
  const br = [...back.html.matchAll(/<div data-section-break="[a-zA-Z]+"([^>]*)><[/]div>/g)].map((m) => (/data-hdr="([^"]*)"/.exec(m[1])?.[1] ?? '-') + '|' + (/data-ftr="([^"]*)"/.exec(m[1])?.[1] ?? '-'));
  check('antet pe secțiune: înapoi din .docx (propriu, legat, doar subsolul)', br.join(',') === 'Capitolul 2 „Cifre”|-,-|-,-|Anexe', br.join(','));
  check('antet pe secțiune: documentul păstrează antetul primei secțiuni', back.layout?.header === 'Raport anual' && back.layout?.footer === 'Firma', JSON.stringify({ h: back.layout?.header, f: back.layout?.footer }));
  // Un antet propriu gol (secțiune fără antet) rămâne gol, nu legat.
  const empty = await docxToHtml(await docToDocx({ type: 'doc', content: [p('Unu'), { type: 'sectionBreak', attrs: { kind: 'nextPage', hdr: '', ftr: null } }, p('Doi')] }, { header: 'Sus', footer: '', numbers: false }));
  check('antet pe secțiune: antet propriu gol', /data-hdr=""/.test(empty.html), empty.html.slice(0, 300));
}
console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
