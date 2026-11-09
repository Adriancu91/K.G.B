// Test: Sheets → formele și casetele de text în .xlsx: scrise ca forme adevărate (xdr:sp cu prstGeom, umplere, contur, text),
// nu ca poze, citite înapoi cu textul lor; o formă dintr-un fișier făcut de alt program se citește și ea.
// Rulare (în suite/): node tests/sheets-shapes-xlsx.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const dir = join(tmpdir(), `suite-shxlsx-${process.pid}`);
const entry = join(tmpdir(), `suite-shxlsx-entry-${process.pid}.ts`);
const p = (f) => JSON.stringify(join(process.cwd(), f).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { readXlsx, writeXlsx } from ${p('src/sheets/xlsx.ts')};\nexport { shapeFromSp } from ${p('src/sheets/shapeXml.ts')};\nexport { parseXml } from ${p('src/sheets/xlsx.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(dir, 'x.mjs'), logLevel: 'error', loader: { '.css': 'empty' } });
const { readXlsx, writeXlsx, shapeFromSp, parseXml } = await import(pathToFileURL(join(dir, 'x.mjs')).href);
rmSync(dir, { recursive: true, force: true });
rmSync(entry, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const pics = [
  { id: 'a', src: PNG, r: 1, c: 2, dx: 4, dy: 6, w: 120, h: 60 },
  { id: 'b', src: PNG, r: 4, c: 1, dx: 0, dy: 0, w: 200, h: 140, alt: 'Atenție',
    sh: { k: 'callout', fill: '#ffeeaa', stroke: '#333333', sw: 2, text: 'Plata până pe 5\nfără întârziere & <rest>', tc: '#aa0000', fs: 18, b: true, al: 'c' } },
  { id: 'c', src: PNG, r: 12, c: 0, dx: 0, dy: 0, w: 220, h: 80,
    sh: { k: 'rect', fill: '#ffffff', stroke: '#8a8a8a', sw: 1, text: 'Notă: cifrele sunt provizorii', tc: '#000000', fs: 14, al: 'l' } },
  { id: 'd', src: PNG, r: 20, c: 3, dx: 0, dy: 0, w: 240, h: 16, sh: { k: 'line', fill: '', stroke: '#ff0000', sw: 3, text: '', tc: '#000000', fs: 14, al: 'c' } },
];
const cells = { A1: 'Luna', B1: 'Vânzări' };
const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells, styles: {}, pics }, results: {} }]);
const zip = await JSZip.loadAsync(bytes);
const dXml = await zip.file('xl/drawings/drawing1.xml')?.async('string');
let errs = 0;
new DOMParser({ onError: () => { errs++; } }).parseFromString(dXml ?? '', 'text/xml');
ok(dXml && !errs, 'drawing1.xml există și e XML valid');
ok((dXml.match(/<xdr:pic>/g) ?? []).length === 1 && (dXml.match(/<xdr:sp /g) ?? []).length === 3, 'o poză și trei forme (nu poze)');
ok(dXml.includes('prst="wedgeRectCallout"') && dXml.includes('prst="rect"') && dXml.includes('prst="line"'), 'felul formei ca prstGeom');
ok(dXml.includes('<a:solidFill><a:srgbClr val="FFEEAA"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="333333"/>'), 'umplerea și conturul (2 px = 19050 EMU)');
ok(dXml.includes('sz="1350" b="1"') && dXml.includes('<a:t>fără întârziere &amp; &lt;rest&gt;</a:t>') && dXml.includes('algn="ctr"'), 'textul: mărime, aldin, rânduri, caractere speciale');
ok(dXml.includes('txBox="1"') && dXml.includes('anchor="t"'), 'caseta de text e marcată ca atare și are textul sus');
ok((await zip.file('xl/drawings/_rels/drawing1.xml.rels').async('string')).match(/\/image"/g).length === 1, 'doar poza are fișier în xl/media');
const ids = [...dXml.matchAll(/cNvPr id="(\d+)"/g)].map((m) => m[1]);
ok(new Set(ids).size === ids.length, 'fiecare obiect din desen are id diferit: ' + ids.join(','));

const back = await readXlsx(bytes);
const bp = back.sheets[0].pics ?? [];
ok(bp.length === 4, 'înapoi: patru obiecte pe foaie (' + bp.length + ')');
const cl = bp.find((x) => x.sh?.k === 'callout');
ok(cl && cl.sh.text === 'Plata până pe 5\nfără întârziere & <rest>' && cl.sh.fill === '#ffeeaa' && cl.sh.stroke === '#333333' && cl.sh.sw === 2 && cl.sh.fs === 18 && cl.sh.b === true && cl.sh.tc === '#aa0000' && cl.sh.al === 'c', 'balonul se citește înapoi cu tot: ' + JSON.stringify(cl?.sh));
ok(cl && cl.r === 4 && cl.c === 1 && cl.w === 200 && cl.h === 140 && cl.alt === 'Atenție' && /^data:image\/svg\+xml;base64,/.test(cl.src), 'locul, mărimea, textul alternativ și desenul');
const tb = bp.find((x) => x.sh?.k === 'rect');
ok(tb && tb.sh.al === 'l' && tb.sh.text === 'Notă: cifrele sunt provizorii', 'caseta de text rămâne casetă (text la stânga)');
const ln = bp.find((x) => x.sh?.k === 'line');
ok(ln && ln.sh.fill === '' && ln.sh.stroke === '#ff0000' && ln.sh.sw === 3, 'linia: fără umplere, contur roșu de 3 px');
ok(bp.some((x) => !x.sh && x.src.startsWith('data:image/png')), 'poza rămâne poză');

// O formă scrisă de alt program: culoarea din stil, text pe două paragrafe, aliniat la dreapta; o formă liberă (custGeom) nu se aduce.
const sp = parseXml(`<xdr:sp xmlns:xdr="x" xmlns:a="a"><xdr:nvSpPr><xdr:cNvPr id="3" name="Oval 2"/><xdr:cNvSpPr/></xdr:nvSpPr>
<xdr:spPr><a:xfrm><a:off x="1" y="1"/><a:ext cx="100" cy="100"/></a:xfrm><a:prstGeom prst="flowChartConnector"><a:avLst/></a:prstGeom></xdr:spPr>
<xdr:style><a:lnRef idx="2"><a:srgbClr val="1F3864"/></a:lnRef><a:fillRef idx="1"><a:srgbClr val="70AD47"/></a:fillRef></xdr:style>
<xdr:txBody><a:bodyPr/><a:p><a:pPr algn="r"/><a:r><a:rPr sz="1100"/><a:t>Unu</a:t></a:r></a:p><a:p><a:r><a:t>Doi</a:t></a:r></a:p><a:p/></xdr:txBody></xdr:sp>`).kids[0];
const s1 = shapeFromSp(sp);
ok(s1 && s1.k === 'ellipse' && s1.fill === '#70ad47' && s1.stroke === '#1f3864' && s1.text === 'Unu\nDoi' && s1.al === 'r' && s1.fs === 15, 'formă din alt program: ' + JSON.stringify(s1));
const free = parseXml('<xdr:sp><xdr:spPr><a:custGeom/></xdr:spPr></xdr:sp>').kids[0];
ok(shapeFromSp(free) === null, 'o formă desenată liber nu se aduce');
// Formele din 28.10 (hexagon, cruce, stea cu 6 colțuri…) se citesc ca ele însele, nu ca forma cea mai apropiată.
const kindOf = (prst) => shapeFromSp(parseXml('<xdr:sp xmlns:xdr="x" xmlns:a="a"><xdr:spPr><a:xfrm><a:off x="1" y="1"/><a:ext cx="100" cy="100"/></a:xfrm><a:prstGeom prst="' + prst + '"/><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></xdr:spPr></xdr:sp>').kids[0])?.k;
ok(['hexagon', 'parallelogram', 'trapezoid', 'plus', 'chevron', 'rtTriangle', 'star6'].every((k) => kindOf(k) === k) && kindOf('star8') === 'star', 'formele noi din .xlsx: ' + ['hexagon', 'plus', 'rtTriangle', 'star6', 'star8'].map(kindOf).join(', '));

console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
