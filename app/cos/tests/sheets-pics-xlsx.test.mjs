// Test: Sheets → pozele în .xlsx: scrise ca xdr:pic (oneCellAnchor + xl/media + legături + tip), citite înapoi la locul lor,
// împreună cu un grafic; o poză EMF sau legată din afară nu se aduce (se numără). Rulare (în suite/): node tests/sheets-pics-xlsx.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const dir = join(tmpdir(), `suite-picsxlsx-${process.pid}`);
const entry = join(tmpdir(), `suite-picsxlsx-entry-${process.pid}.ts`);
const p = (f) => JSON.stringify(join(process.cwd(), f).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { readXlsx, writeXlsx } from ${p('src/sheets/xlsx.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'x.mjs'), logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'x.mjs')).href);
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQ==';
const pics = [
  { id: 'a', src: PNG, r: 1, c: 2, dx: 4, dy: 6, w: 120, h: 60, alt: 'Sigla & co' },
  { id: 'b', src: JPG, r: 10, c: 0, dx: 0, dy: 0, w: 50, h: 50 },
  { id: 'c', src: 'data:image/svg+xml;base64,PHN2Zy8+', r: 0, c: 0, dx: 0, dy: 0, w: 10, h: 10 },
];
const cells = { A1: 'Luna', B1: 'Vânzări', A2: 'Ian', B2: '10', A3: 'Feb', B3: '20' };
const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {}, pics, charts: [{ id: 'g1', type: 'col', range: 'A1:B3', title: 'Test' }] }, results: {} }]);
const zip = await JSZip.loadAsync(bytes);
const dXml = await zip.file('xl/drawings/drawing1.xml')?.async('string');
let errs = 0;
new DOMParser({ onError: () => { errs++; } }).parseFromString(dXml ?? '', 'text/xml');
ok(dXml && !errs, 'drawing1.xml există și e XML valid');
ok((dXml.match(/<xdr:pic>/g) ?? []).length === 2 && dXml.includes('<c:chart '), 'două poze (SVG-ul nu se poate pune) și graficul, în același desen');
ok(dXml.includes('<xdr:col>2</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>57150</xdr:rowOff>') && dXml.includes('cx="1143000" cy="571500"'), 'locul și mărimea în EMU (9525 pe pixel)');
ok(dXml.includes('descr="Sigla &amp; co"'), 'textul alternativ, cu & scris corect');
const dRels = await zip.file('xl/drawings/_rels/drawing1.xml.rels')?.async('string');
ok(/Id="rIdP1"[^>]*\/image" Target="\.\.\/media\/image1\.png"/.test(dRels ?? '') && /Id="rIdP2"[^>]*Target="\.\.\/media\/image2\.jpeg"/.test(dRels ?? ''), 'legăturile spre xl/media');
ok(!!zip.file('xl/media/image1.png') && !!zip.file('xl/media/image2.jpeg'), 'fișierele pozelor sunt în arhivă');
const types = await zip.file('[Content_Types].xml').async('string');
ok(types.includes('PartName="/xl/media/image1.png" ContentType="image/png"') && types.includes('ContentType="image/jpeg"'), 'tipurile pozelor în [Content_Types].xml');
const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
ok(sheetXml.includes('<drawing r:id="rId1"/>'), 'foaia are desenul');

const back = await readXlsx(bytes);
const bp = back.sheets[0].pics ?? [];
ok(bp.length === 2, 'citite înapoi: două poze');
ok(bp[0] && bp[0].src === PNG && bp[0].r === 1 && bp[0].c === 2 && bp[0].dx === 4 && bp[0].dy === 6 && bp[0].w === 120 && bp[0].h === 60 && bp[0].alt === 'Sigla & co', 'prima poză: aceeași, la același loc: ' + JSON.stringify({ ...bp[0], src: bp[0]?.src.slice(0, 30) }));
ok(bp[1] && bp[1].src === JPG && bp[1].r === 10 && bp[1].w === 50, 'a doua (JPEG)');
ok(back.sheets[0].charts.length === 1, 'graficul rămâne');

// Poze din alte programe: twoCellAnchor cu xfrm, una EMF (nu se poate arăta), una legată din afară, una în mc:AlternateContent.
const z2 = await JSZip.loadAsync(bytes);
const anchor = (rid, from, inner = '') => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${from}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>9</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>9</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="9" name="P"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rid}"/></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="1" y="1"/><a:ext cx="952500" cy="476250"/></a:xfrm></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>${inner}`;
const MC = 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
let d2 = dXml.replace(/<xdr:oneCellAnchor>[\s\S]*<\/xdr:oneCellAnchor>/, '');
d2 = d2.replace('</xdr:wsDr>', anchor('rIdP1', 5) + anchor('rIdP1', 4).replace('<a:ext cx="952500" cy="476250"/>', '') + anchor('rIdE', 6) + anchor('rIdX', 7)
  + `<mc:AlternateContent ${MC}><mc:Choice Requires="a14">${anchor('rIdP2', 1)}</mc:Choice><mc:Fallback>${anchor('rIdP2', 1)}</mc:Fallback></mc:AlternateContent></xdr:wsDr>`);
z2.file('xl/drawings/drawing1.xml', d2);
z2.file('xl/media/image9.emf', 'xx');
z2.file('xl/drawings/_rels/drawing1.xml.rels', dRels.replace('</Relationships>', '<Relationship Id="rIdE" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image9.emf"/><Relationship Id="rIdX" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://exemplu.ro/a.png" TargetMode="External"/></Relationships>'));
const b2 = await readXlsx(await z2.generateAsync({ type: 'uint8array' }));
const p2 = b2.sheets[0].pics ?? [];
ok(p2.length === 3 && p2[0].c === 5 && p2[0].r === 3 && p2[0].w === 100 && p2[0].h === 50, 'twoCellAnchor: locul din „from”, mărimea din xfrm: ' + JSON.stringify(p2.map((x) => [x.r, x.c, x.w, x.h])));
ok(p2[1] && p2[1].c === 4 && p2[1].w === 500 && p2[1].h === 144, 'fără mărime scrisă: din celula de sfârșit (5 coloane × 100 px, 6 rânduri × 24 px): ' + JSON.stringify(p2[1] && [p2[1].w, p2[1].h]));
ok(p2[2] && p2[2].c === 1 && p2[2].src === JPG, 'din mc:AlternateContent se ia o singură dată');
ok(b2.picsSkipped === 2, 'EMF-ul și poza legată din afară se numără ca neaduse: ' + b2.picsSkipped);

// Pozele puse în celule (xl/richData, <c t="e" vm="1">), din fișierele de test XlsxWriter făcute de programul de calcul.
const { readFileSync, existsSync } = await import('node:fs');
const corpus = join('..', 'test-corpus', 'xlsx');
for (const [n, want] of [['01', 1], ['04', 2], ['07', 2]]) {
  const fp = join(corpus, `xlsxwriter-embed_image${n}.xlsx`);
  if (!existsSync(fp)) { console.log('(lipsește ' + fp + ')'); continue; }
  const bk = await readXlsx(new Uint8Array(readFileSync(fp)));
  const all = bk.sheets.flatMap((sh) => (sh.pics ?? []).filter((x) => x.cell).map((x) => ({ ...x, sheet: sh.name, text: sh.cells[`${String.fromCharCode(65 + x.c)}${x.r + 1}`] })));
  ok(all.length >= want && all.every((x) => x.src.startsWith('data:image/png;base64,') && x.dx === 0 && !x.text), `embed_image${n}: ${all.length} poze în celule, celulele fără #VALUE!: ` + JSON.stringify(all.map((x) => [x.sheet, x.r, x.c])));
}
const b7 = await readXlsx(new Uint8Array(readFileSync(join(corpus, 'xlsxwriter-embed_image07.xlsx'))));
const p7 = b7.sheets[0].pics ?? [];
ok(p7.some((x) => x.cell && x.r === 0 && x.c === 0) && p7.some((x) => x.cell && x.r === 2 && x.c === 0) && p7.some((x) => !x.cell), 'embed_image07: 2 poze în A1 și A3, plus poza de pe foaie: ' + JSON.stringify(p7.map((x) => [x.r, x.c, !!x.cell])));

// Pozele în celule scrise înapoi în .xlsx (xl/metadata.xml + xl/richData), citite la fel; o celulă cu text păstrează poza peste ea.
{
  const cp = [
    { id: 'c1', src: PNG, r: 0, c: 0, dx: 0, dy: 0, w: 96, h: 20, cell: true, alt: 'Măr & pară' },
    { id: 'c2', src: JPG, r: 30, c: 3, dx: 0, dy: 0, w: 96, h: 20, cell: true },
    { id: 'c3', src: PNG, r: 1, c: 0, dx: 0, dy: 0, w: 96, h: 20, cell: true },
    { id: 'f1', src: PNG, r: 4, c: 4, dx: 3, dy: 3, w: 60, h: 30 },
  ];
  const by = await writeXlsx([{ sheet: { name: 'Produse', colW: {}, cells: { B1: 'Mere', A2: 'text' }, styles: {}, pics: cp }, results: {} }]);
  const zz = await JSZip.loadAsync(by);
  let bad = 0;
  for (const k of ['xl/metadata.xml', 'xl/richData/rdrichvalue.xml', 'xl/richData/rdrichvaluestructure.xml', 'xl/richData/richValueRel.xml', 'xl/richData/_rels/richValueRel.xml.rels', 'xl/richData/rdRichValueTypes.xml', 'xl/worksheets/sheet1.xml', '[Content_Types].xml', 'xl/_rels/workbook.xml.rels']) {
    const x = await zz.file(k)?.async('string');
    if (!x) { bad++; console.log('   lipsește ' + k); continue; }
    new DOMParser({ onError: () => { bad++; } }).parseFromString(x, 'text/xml');
  }
  ok(!bad, 'părțile xl/richData sunt scrise și sunt XML valid');
  const sx = await zz.file('xl/worksheets/sheet1.xml').async('string');
  ok(sx.includes('<c r="A1" t="e" vm="1"><v>#VALUE!</v></c>') &&/<c r="D31"[^>]* t="e" vm="2">/.test(sx), 'celulele cu poze au vm="1" / vm="2" (și rândul 31 e scris)');
  const rb = await readXlsx(by);
  const rp = rb.sheets[0].pics ?? [];
  const inc = rp.filter((x) => x.cell);
  ok(inc.length === 2 && inc.some((x) => x.r === 0 && x.c === 0 && x.alt === 'Măr & pară' && x.src === PNG) && inc.some((x) => x.r === 30 && x.c === 3 && x.src.startsWith('data:image/jpeg')), 'citite înapoi: 2 poze în celule, cu textul alternativ: ' + JSON.stringify(inc.map((x) => [x.r, x.c, x.alt])));
  ok(rp.filter((x) => !x.cell).length === 2 && !rb.sheets[0].cells.A1, 'poza din celula cu text și poza de pe foaie rămân peste celule; A1 fără #VALUE!');
}

console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
