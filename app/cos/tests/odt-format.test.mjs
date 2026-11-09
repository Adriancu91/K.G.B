// Test pentru importul .odt: legături, note de subsol, exponent/indice, retragere și spațierea rândurilor.
// Rulare (în suite/): node tests/odt-format.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';

globalThis.DOMParser ??= DOMParser;
// În browser listele de noduri și atribute se pot parcurge cu for…of; în xmldom le facem la fel.
{
  const d = new DOMParser().parseFromString('<a b="1"><c/></a>', 'text/xml');
  for (const list of [d.childNodes, d.documentElement.attributes, d.getElementsByTagName('c')]) {
    const proto = Object.getPrototypeOf(list);
    if (!proto[Symbol.iterator]) proto[Symbol.iterator] = Array.prototype[Symbol.iterator];
  }
}
const out = join(tmpdir(), `suite-odtfmt-${process.pid}.mjs`);
await build({ entryPoints: ['src/docs/odtImport.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { odtToHtml } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}`); if (!ok) fail++; };

const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" '
  + 'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" '
  + 'xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"';
const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${NS} office:version="1.3">
<office:automatic-styles>
  <style:style style:name="T1" style:family="text"><style:text-properties style:text-position="super 58%"/></style:style>
  <style:style style:name="T2" style:family="text"><style:text-properties style:text-position="-33% 58%"/></style:style>
  <style:style style:name="T3" style:family="text"><style:text-properties fo:font-variant="small-caps" fo:letter-spacing="0.0706cm"/></style:style>
  <style:style style:name="P2" style:family="paragraph"><style:paragraph-properties fo:border="0.5pt solid #000000" fo:background-color="#DBEAFE"/></style:style>
  <style:style style:name="P1" style:family="paragraph"><style:paragraph-properties fo:margin-left="2.5cm" fo:line-height="150%"/></style:style>
  <style:style style:name="P3" style:family="paragraph"><style:paragraph-properties fo:margin-top="0.423cm" fo:margin-bottom="0.212cm" fo:text-indent="1.25cm"/></style:style>
  <style:style style:name="P4" style:family="paragraph"><style:paragraph-properties fo:margin-left="1.25cm" fo:text-indent="-1.25cm"/></style:style>
  <style:style style:name="P5" style:family="paragraph"><style:paragraph-properties fo:margin-left="2cm" fo:margin-right="1.5cm"/></style:style>
  <style:style style:name="C1" style:family="table-cell"><style:table-cell-properties fo:background-color="#FEF9C3"/></style:style>
  <style:style style:name="C2" style:family="table-cell"><style:table-cell-properties fo:background-color="#ffffff"/></style:style>
</office:automatic-styles>
<office:body><office:text>
  <text:p>m<text:span text:style-name="T1">2</text:span> și H<text:span text:style-name="T2">2</text:span>O</text:p>
  <text:p text:style-name="P1">Vezi <text:a xlink:type="simple" xlink:href="https://www.anaf.ro">site-ul ANAF</text:a> și <text:a xlink:href="#Cuprins">cuprinsul</text:a>.</text:p>
  <text:p><text:span text:style-name="T3">Ion Popescu</text:span></text:p>
  <text:p text:style-name="P2">Notă în casetă</text:p>
  <text:p text:style-name="P3">Roman retras</text:p>
  <text:p text:style-name="P4">Bibliografie agățată</text:p>
  <text:p text:style-name="P5">Citat retras</text:p>
  <text:p>Conform legii<text:note text:id="ftn1" text:note-class="footnote"><text:note-citation>1</text:note-citation><text:note-body><text:p>Legea nr. 31/1990 &amp; completările</text:p></text:note-body></text:note>.</text:p>
  <table:table><table:table-column/><table:table-row><table:table-cell table:style-name="C1"><text:p>galben</text:p></table:table-cell><table:table-cell table:style-name="C2"><text:p>alb</text:p></table:table-cell></table:table-row></table:table>
</office:text></office:body></office:document-content>`;
const zip = new JSZip();
zip.file('mimetype', 'application/vnd.oasis.opendocument.text');
zip.file('content.xml', content);
zip.file('META-INF/manifest.xml', '<?xml version="1.0"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/></manifest:manifest>');
const { html } = await odtToHtml(await zip.generateAsync({ type: 'uint8array' }));

check('exponent', html.includes('m<sup>2</sup>'));
check('indice', html.includes('H<sub>2</sub>O'));
check('retragere 2 trepte și rânduri la 1,5', html.includes('<p data-indent="2" data-line-height="1.5">'));
check('spațiu înainte 12 pt, după 6 pt, prima linie 1,25 cm', html.includes('<p data-space-before="12" data-space-after="6" data-first-line="1.25">Roman retras'));
check('agățat 1,25 cm, fără retragere în plus', html.includes('<p data-first-line="-1.25">Bibliografie agățată'));
check('retragere 2 cm la stânga (1,6 trepte) și 1,5 cm la dreapta', html.includes('<p data-indent="1.6" data-indent-right="1.5">Citat retras'));
check('legătură web', html.includes('<a href="https://www.anaf.ro">site-ul ANAF</a>'));
// De la semnele de carte (JURNAL 20.10), trimiterile interne rămân legături spre semnul de carte.
check('trimitere internă rămâne legătură', html.includes(' și <a href="#Cuprins">cuprinsul</a>.'));
check('notă de subsol', html.includes('<sup data-footnote="Legea nr. 31/1990 &amp; completările"></sup>'));
check('fără lista „Note” la final', !html.includes('<h3>Note</h3>'));
check('majuscule mici și litere rărite (2 pt)', html.includes('<span style="font-variant: small-caps; letter-spacing: 2pt">Ion Popescu</span>'));
check('paragraf cu chenar (negru, cum e în fișier) și fundal albastru', html.includes('<p data-box="1" data-box-look="all-single-000000" data-shade="#dbeafe">Notă în casetă</p>'));
check('celulă colorată', html.includes('<td data-bg="#fef9c3"><p>galben</p></td>'));
check('celulă albă fără culoare', html.includes('<td><p>alb</p></td>'));
check('tabel fără chenare → fără borduri', html.includes('<table data-borders="none">'));
{
  const bordered = content.replace('<style:table-cell-properties fo:background-color="#ffffff"/>', '<style:table-cell-properties fo:background-color="#ffffff" fo:border="0.5pt solid #000000"/>');
  const z2 = new JSZip();
  z2.file('mimetype', 'application/vnd.oasis.opendocument.text');
  z2.file('content.xml', bordered);
  const r2 = await odtToHtml(await z2.generateAsync({ type: 'uint8array' }));
  check('tabel cu chenar de 0,5 pt rămâne cu borduri', r2.html.includes('<table><tbody>'));
  check('fără stiluri de pagină: fără așezare', r2.layout === undefined);
  // Pagina: orizontală, margini de 1,5 cm, două coloane (din styles.xml, pagina „Standard”).
  z2.file('styles.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NS} office:version="1.3">
<office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="29.7cm" fo:page-height="21cm"
 style:print-orientation="landscape" fo:margin-left="1.5cm" fo:margin-right="1.5cm"><style:columns fo:column-count="2" fo:column-gap="1cm"/></style:page-layout-properties></style:page-layout></office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles></office:document-styles>`);
  const r3 = await odtToHtml(await z2.generateAsync({ type: 'uint8array' }));
  check('pagină orizontală, margini 15 mm, două coloane', r3.layout?.landscape === true && r3.layout?.margin === 15 && r3.layout?.columns === 2);
  check('fără culoare: pagina rămâne albă', r3.layout?.background === undefined);
  z2.file('styles.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NS} office:version="1.3">
<office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:background-color="#DEEBF7"/></style:page-layout></office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles></office:document-styles>`);
  check('culoarea paginii din .odt', (await odtToHtml(await z2.generateAsync({ type: 'uint8array' }))).layout?.background === '#deebf7');
  // Filigranul pus din LibreOffice (Format → Filigran): formă fontwork în antetul paginii.
  const DRAW = 'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"';
  z2.file('styles.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NS} ${DRAW} office:version="1.3">
<office:master-styles><style:master-page style:name="Standard"><style:header><text:p><draw:custom-shape draw:name="PowerPlusWaterMarkObject98" text:anchor-type="char"
 svg:width="16cm" svg:height="4cm"><text:p>CIORNĂ</text:p><text:p>  internă </text:p><draw:enhanced-geometry draw:type="fontwork-plain-text" draw:text-path="true"/></draw:custom-shape></text:p></style:header>
</style:master-page></office:master-styles></office:document-styles>`);
  const r4 = await odtToHtml(await z2.generateAsync({ type: 'uint8array' }));
  check('filigran din antetul LibreOffice', r4.layout?.watermark === 'CIORNĂ internă' && r4.layout?.margin === 20);
  // O formă obișnuită în antet (un logo) nu e filigran.
  z2.file('styles.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NS} ${DRAW} office:version="1.3">
<office:master-styles><style:master-page style:name="Standard"><style:header><text:p><draw:custom-shape draw:name="Logo"><text:p>Firma SRL</text:p>
<draw:enhanced-geometry draw:type="rectangle"/></draw:custom-shape></text:p></style:header></style:master-page></office:master-styles></office:document-styles>`);
  const r5 = await odtToHtml(await z2.generateAsync({ type: 'uint8array' }));
  check('o formă obișnuită din antet nu e filigran', r5.layout === undefined);
}
if (fail) console.log(html);
console.log(fail ? `${fail} verificări greșite` : 'toate verificările trec');
process.exit(fail ? 1 : 0);
