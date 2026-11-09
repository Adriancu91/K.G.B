// Test pentru optimizarea structurii PDF: obiectele nefolosite pleacă, fluxurile identice se unesc, fluxurile necomprimate
// se comprimă, miniaturile pleacă; textul și pozele paginilor rămân la fel.
// Copiat din Cyber Office Studio (tests/pdf-optimize.test.mjs, D-071); schimbat doar felul în care se încarcă codul.
// Rulare (în app/): node tests/optimize.test.mjs
import "./ts-hooks.mjs";
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { PDFDocument, PDFName, PDFRawStream, StandardFonts } from 'pdf-lib';
const { optimizePdf, OPTIMIZE_DEFAULT } = await import('../src/modules/pdf/optimize.ts');

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

// O siglă (aceeași poză) pusă de două ori ca obiecte separate, un conținut de pagină lung necomprimat, o miniatură și un obiect rătăcit.
const d = await PDFDocument.create();
const f = await d.embedFont(StandardFonts.Helvetica);
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg=='), (ch) => ch.charCodeAt(0));
const c = d.context;
const logo = new Uint8Array(4000).map((_, i) => (i * 7) % 251);
const mk = () => c.register(PDFRawStream.of(c.obj({ Type: 'XObject', Subtype: 'Image', Width: 40, Height: 25, ColorSpace: 'DeviceRGB', BitsPerComponent: 8 }), logo));
const im1 = mk(), im2 = mk();
for (const [i, im] of [im1, im2].entries()) {
  const p = d.addPage([400, 400]);
  const fk = p.node.newFontDictionary('F1', f.ref).asString().slice(1);
  p.node.Resources().set(PDFName.of('XObject'), c.obj({ Logo: im }));
  const lines = Array.from({ length: 40 }, (_, k) => `BT /${fk} 8 Tf 20 ${380 - k * 9} Td (Pagina ${i + 1}, randul ${k + 1}) Tj ET`).join('\n');
  p.node.set(PDFName.of('Contents'), c.register(PDFRawStream.of(c.obj({}), new TextEncoder().encode(`q 40 0 0 25 300 360 cm /Logo Do Q\n${lines}`))));
  p.node.set(PDFName.of('Thumb'), c.register(c.stream(new Uint8Array(500), {})));
}
c.register(c.stream(new Uint8Array(3000), {})); // la el nu duce nimic
await d.embedPng(png); // nici la poza asta
const src = await d.save({ useObjectStreams: false });

const { bytes, report } = await optimizePdf(src, OPTIMIZE_DEFAULT);
check('fișierul e mai mic', bytes.length < src.length * 0.6, `${src.length} → ${bytes.length}`);
check('raportul: nefolosite, dubluri, comprimate, miniaturi', report.unused >= 2 && report.duplicates === 1 && report.compressed >= 2 && report.extras === 2, JSON.stringify(report));
const r = await PDFDocument.load(bytes);
const logoOf = (i) => r.getPage(i).node.Resources().lookup(PDFName.of('XObject')).get(PDFName.of('Logo')).toString();
check('ambele pagini arată spre aceeași siglă', logoOf(0) === logoOf(1));
check('miniaturile au plecat', !r.getPage(0).node.has(PDFName.of('Thumb')) && !r.getPage(1).node.has(PDFName.of('Thumb')));
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const textOf = async (b, n) => (await (await (await pdfjs.getDocument({ data: b.slice(), disableFontFace: true }).promise).getPage(n)).getTextContent()).items.map((i) => i.str).join('|');
check('textul paginilor e la fel', (await textOf(bytes, 1)) === (await textOf(src, 1)) && (await textOf(bytes, 2)) === (await textOf(src, 2)) && (await textOf(bytes, 2)).includes('Pagina 2, randul 40'));
const ops = async (b) => (await (await (await pdfjs.getDocument({ data: b.slice() }).promise).getPage(1)).getOperatorList()).fnArray.length;
check('pagina are aceleași desene', (await ops(bytes)) === (await ops(src)));

const none = await optimizePdf(src, { duplicates: false, compress: false, extras: false });
const r2 = await PDFDocument.load(none.bytes);
check('fără bife: sigla rămâne dublă și miniaturile rămân', r2.getPage(0).node.Resources().lookup(PDFName.of('XObject')).get(PDFName.of('Logo')).toString()
  !== r2.getPage(1).node.Resources().lookup(PDFName.of('XObject')).get(PDFName.of('Logo')).toString() && r2.getPage(0).node.has(PDFName.of('Thumb')));

// Un font pus pe pagină dar nefolosit pleacă din fișier; fontul folosit rămâne și textul arată la fel.
{
  const df = await PDFDocument.create();
  const used = await df.embedFont(StandardFonts.Helvetica);
  const unused = await df.embedFont(StandardFonts.Courier);
  const pf = df.addPage([300, 200]);
  pf.drawText('Folosit', { x: 20, y: 100, size: 14, font: used });
  pf.node.newFontDictionary('Nefolosit', unused.ref);
  const srcF = await df.save();
  const outF = await optimizePdf(srcF, { duplicates: false, compress: false, extras: false });
  const rf = await PDFDocument.load(outF.bytes);
  const fonts = rf.getPage(0).node.Resources().lookup(PDFName.of('Font')).keys().map(String);
  const raw = new TextDecoder('latin1').decode(await rf.save({ useObjectStreams: false }));
  check('fontul nefolosit a plecat, cel folosit rămâne', fonts.length === 1 && !raw.includes('Courier') && raw.includes('Helvetica'), fonts.join(','));
  check('textul cu fontul folosit e la fel', (await textOf(outF.bytes, 1)) === 'Folosit', await textOf(outF.bytes, 1));
}

console.log(fail ? `${fail} GREȘITE` : 'TOATE TREC');
process.exit(fail ? 1 : 0);
