// Test pentru indice/exponent, spațierea rândurilor și retragerea paragrafelor în Docs:
// export .docx (XML-ul Word are vertAlign, spacing, ind), apoi import înapoi (HTML-ul are <sup>, <sub>, data-indent).
// Rulare (în suite/): node tests/docs-format.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';

globalThis.DOMParser ??= DOMParser;
// xmldom nu are `children` (browserul are); fără el nu se citesc culorile și formatul literelor din XML-ul Word.
{
  const d = new DOMParser().parseFromString('<a><b/></a>', 'text/xml');
  let p = Object.getPrototypeOf(d.documentElement);
  while (p && !Object.prototype.hasOwnProperty.call(p, 'appendChild')) p = Object.getPrototypeOf(p);
  if (!('children' in d.documentElement)) Object.defineProperty(p ?? Object.getPrototypeOf(d.documentElement), 'children', { get() { return Array.from(this.childNodes).filter((c) => c.nodeType === 1); }, configurable: true });
}
const out = join(tmpdir(), `suite-docsfmt-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { docToDocx } from './src/docs/docx.ts'; export { docxToHtml } from './src/docs/docxImport.ts'; export { normalizeHref } from './src/docs/link.ts'; export { parseDoc, serializeDoc, pageMargins } from './src/docs/format.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { docToDocx, docxToHtml, normalizeHref, parseDoc, serializeDoc, pageMargins } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}`); if (!ok) fail++; };

const doc = { type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'H' }, { type: 'text', text: '2', marks: [{ type: 'subscript' }] }, { type: 'text', text: 'O și m' }, { type: 'text', text: '2', marks: [{ type: 'superscript' }] }] },
  { type: 'paragraph', attrs: { lineHeight: '1.5', indent: 2 }, content: [{ type: 'text', text: 'Paragraf retras cu rânduri la 1,5' }] },
  { type: 'heading', attrs: { level: 2, indent: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'Titlu retras' }] },
] };

const bytes = await docToDocx(doc);
const xml = await (await JSZip.loadAsync(bytes)).file('word/document.xml').async('string');
check('exponent în Word', /<w:vertAlign w:val="superscript"\/>/.test(xml));
check('indice în Word', /<w:vertAlign w:val="subscript"\/>/.test(xml));
check('spațiere 1,5 rânduri (line=360)', /<w:spacing w:line="360" w:lineRule="auto"\/>/.test(xml));
check('retragere 2 trepte (left=1418)', /<w:ind w:left="1418"\/>/.test(xml));

const { html } = await docxToHtml(bytes);
check('import: <sub>2</sub>', html.includes('<sub>2</sub>'));
check('import: <sup>2</sup>', html.includes('<sup>2</sup>'));
check('import: paragraf retras 2 trepte, rânduri la 1,5', /<p data-indent="2" data-line-height="1.5">Paragraf retras/.test(html));
check('import: titlu centrat și retras', /<h2 style="text-align: center" data-indent="1">/.test(html));
if (fail) console.log(html);

// Spațiul înainte / după paragraf și prima linie (retrasă sau agățată): în Word și înapoi.
const sp = { type: 'doc', content: [
  { type: 'paragraph', attrs: { spaceBefore: 12, spaceAfter: 6, firstLine: 1.25 }, content: [{ type: 'text', text: 'Roman retras' }] },
  { type: 'paragraph', attrs: { indent: 1, firstLine: -1 }, content: [{ type: 'text', text: 'Bibliografie agățată' }] },
  { type: 'paragraph', attrs: { spaceAfter: 0 }, content: [{ type: 'text', text: 'Fără spațiu după' }] },
] };
const sbytes = await docToDocx(sp);
const sxml = await (await JSZip.loadAsync(sbytes)).file('word/document.xml').async('string');
check('Word: înainte 240, după 120 (douăzecimi de punct)', sxml.includes('<w:spacing w:after="120" w:before="240"/>'));
check('Word: prima linie 709 twips', sxml.includes('<w:ind w:firstLine="709"/>'));
check('Word: agățat 567, retragerea 709 + 567', sxml.includes('<w:ind w:left="1276" w:hanging="567"/>'));
check('Word: după 0', sxml.includes('<w:spacing w:after="0"/>'));
const sback = (await docxToHtml(sbytes)).html;
check('import: înainte 12, după 6, prima linie 1,25', /<p data-space-before="12" data-space-after="6" data-first-line="1.25">Roman retras/.test(sback));
check('import: retras 1 treaptă, agățat 1 cm', /<p data-indent="1" data-first-line="-1">Bibliografie/.test(sback));
check('import: după 0', /<p data-space-after="0">Fără spațiu după/.test(sback));
if (fail) console.log(sxml, sback);

// Retragerea în cm exacți (2 cm la stânga = 1,6 trepte) și la dreapta (2 cm): în Word și înapoi.
const rx = await docToDocx({ type: 'doc', content: [{ type: 'paragraph', attrs: { indent: 1.6, indentRight: 2 }, content: [{ type: 'text', text: 'Citat retras' }] }] });
const rxml = await (await JSZip.loadAsync(rx)).file('word/document.xml').async('string');
check('Word: stânga 1134, dreapta 1134 twips', /<w:ind w:left="1134" w:right="1134"\/>/.test(rxml) || /<w:ind w:right="1134" w:left="1134"\/>/.test(rxml));
const rback = (await docxToHtml(rx)).html;
check('import: stânga 1,6 trepte, dreapta 2 cm', /<p data-indent="1.6" data-indent-right="2">Citat retras/.test(rback));
if (fail) console.log(rxml, rback);

// Pagina orizontală cu margini de 1,5 cm: în Word și înapoi.
const land = await docToDocx(doc, { header: '', footer: '', numbers: true, landscape: true, margin: 15 });
const lxml = await (await JSZip.loadAsync(land)).file('word/document.xml').async('string');
check('Word: A4 orizontal', lxml.includes('w:w="16838"') && lxml.includes('w:h="11906"') && lxml.includes('w:orient="landscape"'));
check('Word: margini 1,5 cm (851 twips)', lxml.includes('w:left="851"') && lxml.includes('w:top="851"'));
const back = await docxToHtml(land);
check('import: pagină orizontală, margini 15 mm', back.layout?.landscape === true && back.layout?.margin === 15);
const port = await docxToHtml(bytes);
check('import: pagină verticală, margini 20 mm', port.layout?.landscape === false && port.layout?.margin === 20);
check('import: o singură coloană', port.layout?.columns === undefined);
// Margini diferite pe fiecare latură: Word (twips) și înapoi; se păstrează și în fișierul nostru, cu filigranul și culoarea paginii.
const odd = { header: '', footer: '', numbers: false, margin: 20, margins: { top: 25, bottom: 20, left: 30, right: 15 } };
const mxml = await (await JSZip.loadAsync(await docToDocx(doc, odd))).file('word/document.xml').async('string');
const pgMar = /<w:pgMar [^>]*>/.exec(mxml)?.[0] ?? '';
check('Word: sus 1418, jos 1134, stânga 1701, dreapta 851', ['top="1418"', 'bottom="1134"', 'left="1701"', 'right="851"'].every((x) => pgMar.includes('w:' + x)));
const mback = await docxToHtml(await docToDocx(doc, odd));
check('import: margini pe fiecare latură', JSON.stringify(mback.layout?.margins) === JSON.stringify({ top: 25, bottom: 20, left: 30, right: 15 }));
check('import: margini egale rămân o singură valoare', port.layout?.margins === undefined);
const saved = parseDoc(serializeDoc({ type: 'doc', content: [] }, { ...odd, watermark: 'CIORNĂ', background: '#fff2cc' }));
check('fișierul nostru: marginile, filigranul și culoarea paginii rămân', JSON.stringify(pageMargins(saved.page)) === JSON.stringify(odd.margins)
  && saved.page.watermark === 'CIORNĂ' && saved.page.background === '#fff2cc');
// Mărimea hârtiei: A5 (8391 × 11906 twips) și Letter culcat, în Word și înapoi; A4 rămâne fără câmp.
const a5 = await docToDocx(doc, { header: '', footer: '', numbers: false, paper: 'A5' });
const a5xml = await (await JSZip.loadAsync(a5)).file('word/document.xml').async('string');
check('Word: A5 = 8391 × 11906', a5xml.includes('w:w="8391"') && a5xml.includes('w:h="11906"'));
check('import: A5', (await docxToHtml(a5)).layout?.paper === 'A5');
const ltr = await docToDocx(doc, { header: '', footer: '', numbers: false, paper: 'Letter', landscape: true });
const lt = (await docxToHtml(ltr)).layout;
check('import: Letter culcat', lt?.paper === 'Letter' && lt?.landscape === true);
check('import: A4 fără câmpul hârtie', port.layout?.paper === undefined);
check('fișierul nostru: hârtia rămâne', parseDoc(serializeDoc({ type: 'doc', content: [] }, { header: '', footer: '', numbers: false, paper: 'Legal' })).page?.paper === 'Legal');
// Textul pe două coloane: w:cols w:num="2" în Word și înapoi.
const two = await docToDocx(doc, { header: '', footer: '', numbers: false, columns: 2 });
const cxml = await (await JSZip.loadAsync(two)).file('word/document.xml').async('string');
check('Word: două coloane', /<w:cols [^>]*w:num="2"/.test(cxml));
check('import: două coloane', (await docxToHtml(two)).layout?.columns === 2);
// Note de subsol: în Word devin note adevărate, iar la import revin ca note de-ale noastre.
const withNotes = { type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'text', text: 'Conform legii' }, { type: 'footnote', attrs: { text: 'Legea nr. 31/1990 & completările' } },
  { type: 'text', text: ' și contractului' }, { type: 'footnote', attrs: { text: 'Contractul nr. 12 "Alfa"' } }, { type: 'text', text: '.' },
] }] };
const nz = await JSZip.loadAsync(await docToDocx(withNotes));
const fxml = await nz.file('word/footnotes.xml')?.async('string') ?? '';
const nxml = await nz.file('word/document.xml').async('string');
check('Word: 2 trimiteri la note', (nxml.match(/<w:footnoteReference /g) ?? []).length === 2);
check('Word: textul notelor în footnotes.xml', fxml.includes('Legea nr. 31/1990 &amp; completările') && fxml.includes('Contractul nr. 12'));
const nback = await docxToHtml(await nz.generateAsync({ type: 'uint8array' }));
check('import: nota 1', nback.html.includes('<sup data-footnote="Legea nr. 31/1990 &amp; completările"></sup>'));
check('import: nota 2', nback.html.includes('<sup data-footnote="Contractul nr. 12 &quot;Alfa&quot;"></sup>'));
check('import: fără lista de note la sfârșit', !nback.html.includes('footnote-') && !nback.html.includes('<ol>'));
if (fail) console.log(nback.html);

// Legături: adresele scrise de mână devin adrese complete; în Word sunt legături adevărate și revin la import.
check('adresă: www.anaf.ro', normalizeHref('www.anaf.ro') === 'https://www.anaf.ro');
check('adresă: e-mail', normalizeHref('ana@firma.ro') === 'mailto:ana@firma.ro');
check('adresă: refuză javascript:', normalizeHref('javascript:alert(1)') === null);
check('adresă: păstrează trimiterile spre semne de carte (#)', normalizeHref('#_Toc123') === '#_Toc123' && normalizeHref('#a b') === null);
const withLink = { type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'text', text: 'Vezi ' }, { type: 'text', text: 'site-ul ANAF', marks: [{ type: 'link', attrs: { href: 'https://www.anaf.ro' } }] },
] }] };
const lz = await JSZip.loadAsync(await docToDocx(withLink));
const lrels = await lz.file('word/_rels/document.xml.rels').async('string');
check('Word: legătură spre www.anaf.ro', (await lz.file('word/document.xml').async('string')).includes('<w:hyperlink ') && lrels.includes('Target="https://www.anaf.ro"'));
const lback = await docxToHtml(await lz.generateAsync({ type: 'uint8array' }));
check('import: legătura revine', lback.html.includes('<a href="https://www.anaf.ro">'));
// Fundalul celulelor de tabel: în Word ca umbrire (w:shd w:fill).
const withTable = { type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [
  { type: 'tableCell', attrs: { backgroundColor: '#fef9c3' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'galben' }] }] },
  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'alb' }] }] },
] }] }] };
const txml = await (await JSZip.loadAsync(await docToDocx(withTable))).file('word/document.xml').async('string');
check('Word: celula galbenă', txml.includes('w:fill="FEF9C3"'));
check('Word: celula fără culoare rămâne fără umbrire', (txml.match(/<w:shd /g) ?? []).length === 1);
const tback = await docxToHtml(await docToDocx(withTable));
check('import: celula galbenă', /<td[^>]* data-bg="#fef9c3"><p>galben<[/]p>/.test(tback.html) && !tback.html.includes('bfef9c3'));
check('import: tabelul cu borduri rămâne cu borduri', tback.html.includes('<table>') && !tback.html.includes('data-borders'));
// Tabel fără borduri: în Word toate laturile „none”, iar la import înapoi data-borders="none".
const noBorders = { type: 'doc', content: [{ ...withTable.content[0], attrs: { borders: 'none' } }] };
const nbDocx = await docToDocx(noBorders);
const nbxml = await (await JSZip.loadAsync(nbDocx)).file('word/document.xml').async('string');
check('Word: tabel fără borduri', /<w:tblBorders>(?:(?!<[/]w:tblBorders>)[^])*<[/]w:tblBorders>/.test(nbxml) && !/<w:tblBorders>(?:(?!<[/]w:tblBorders>)[^])*w:val="single"/.test(nbxml));
const nbback = await docxToHtml(nbDocx);
check('import: tabel fără borduri', nbback.html.includes('<table data-borders="none">') && nbback.html.includes('galben</p>') && !nbback.html.includes('⁣'));
// Majuscule mici, MAJUSCULE afișate și litere rărite: în Word (smallCaps, caps, spacing) și înapoi.
const letters = { type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'text', text: 'Ion Popescu', marks: [{ type: 'textStyle', attrs: { fontVariant: 'small-caps', letterSpacing: '2pt' } }] },
  { type: 'text', text: ' și ' }, { type: 'text', text: 'atenție', marks: [{ type: 'textStyle', attrs: { textTransform: 'uppercase', letterSpacing: '-0.5pt' } }] }] }] };
const lDocx = await docToDocx(letters);
const lxml2 = await (await JSZip.loadAsync(lDocx)).file('word/document.xml').async('string');
check('Word: majuscule mici + spațiere 40', lxml2.includes('<w:smallCaps/>') && lxml2.includes('<w:spacing w:val="40"/>'));
check('Word: MAJUSCULE + condensat -10', lxml2.includes('<w:caps/>') && lxml2.includes('<w:spacing w:val="-10"/>'));
const letback = await docxToHtml(lDocx);
check('import: majuscule mici și litere rărite', /font-variant: small-caps; letter-spacing: 2pt[^>]*>Ion Popescu/.test(letback.html));
check('import: MAJUSCULE și condensat', /text-transform: uppercase; letter-spacing: -0.5pt[^>]*>atenție/.test(letback.html));
// Chenar și fundal pentru paragrafe: w:pBdr și w:shd în Word și înapoi.
const boxed = { type: 'doc', content: [
  { type: 'paragraph', attrs: { box: true, shade: '#fef9c3' }, content: [{ type: 'text', text: 'Important: termen 25 mai' }] },
  { type: 'paragraph', attrs: { box: true }, content: [{ type: 'text', text: 'A doua linie din casetă' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Text obișnuit' }] }] };
const bDocx = await docToDocx(boxed);
const bxml = await (await JSZip.loadAsync(bDocx)).file('word/document.xml').async('string');
check('Word: chenar pe paragraf și fundal galben', (bxml.match(/<w:pBdr>/g) ?? []).length === 2 && bxml.includes('w:fill="FEF9C3"'));
const bback = await docxToHtml(bDocx);
check('import: chenar și fundal', bback.html.includes('<p data-box="1" data-shade="#fef9c3">Important: termen 25 mai</p>') && bback.html.includes('<p data-box="1">A doua linie') && bback.html.includes('<p>Text obișnuit</p>'));
if (fail) console.log(bback.html);
// Chenarul ales: laturi (sus și jos, bară în stânga, linie jos), linie (dublă, groasă, punctată) și culoare; în Word și înapoi.
const looks = { type: 'doc', content: [
  { type: 'paragraph', attrs: { box: true, boxLook: 'tb-double-2563eb' }, content: [{ type: 'text', text: 'Sus și jos' }] },
  { type: 'paragraph', attrs: { box: true, boxLook: 'left-single-dc2626' }, content: [{ type: 'text', text: 'Bară în stânga' }] },
  { type: 'paragraph', attrs: { box: true, boxLook: 'bottom-dotted-16a34a' }, content: [{ type: 'text', text: 'Linie jos' }] },
  { type: 'paragraph', attrs: { box: true, boxLook: 'all-thick-000000' }, content: [{ type: 'text', text: 'Groasă' }] }] };
const lx = await (await JSZip.loadAsync(await docToDocx(looks))).file('word/document.xml').async('string');
const pb = [...lx.matchAll(/<w:pBdr>([\s\S]*?)<\/w:pBdr>/g)].map((m) => m[1]);
check('Word: sus și jos, dublă, albastră', pb[0] && /<w:top w:val="double"[^>]*w:color="2563EB"/.test(pb[0]) && /<w:bottom /.test(pb[0]) && !/<w:left /.test(pb[0]));
check('Word: bară roșie în stânga', pb[1] && /<w:left [^>]*w:sz="24"/.test(pb[1]) && /<w:left [^>]*w:color="DC2626"/.test(pb[1]) && !/<w:top /.test(pb[1]));
check('Word: linie punctată jos', pb[2] && /<w:bottom w:val="dotted"/.test(pb[2]) && !/<w:top /.test(pb[2]));
check('Word: groasă pe toate laturile', pb[3] && (pb[3].match(/w:sz="18"/g) ?? []).length === 4);
const bxBack = (await docxToHtml(await docToDocx(looks))).html;
check('import Word: chenarele se citesc la fel', ['tb-double-2563eb', 'left-single-dc2626', 'bottom-dotted-16a34a', 'all-thick-000000'].every((l) => bxBack.includes(`data-box="1" data-box-look="${l}"`)));
if (fail) console.log(bxBack);
// Filigranul: forma Word cu text în antet (și fără text de antet), apoi citit înapoi.
const wm = await docToDocx(doc, { header: '', footer: '', numbers: false, watermark: 'CIORNĂ & co' });
const wzip = await JSZip.loadAsync(wm);
const hdrs = Object.keys(wzip.files).filter((f) => /^word.header[0-9]*.xml$/.test(f));
const hxml = hdrs.length ? await wzip.file(hdrs[0]).async('string') : '';
check('Word: filigran în antet', hxml.includes('PowerPlusWaterMarkObject') && hxml.includes('string="CIORNĂ &amp; co"') && hxml.includes('xmlns:v=') && hxml.includes('xmlns:o='));
check('Word: antetul cu filigran e XML corect', new DOMParser().parseFromString(hxml, 'text/xml').getElementsByTagName('parsererror').length === 0 && /<w:headerReference/.test(await wzip.file('word/document.xml').async('string')));
check('import: filigranul revine', (await docxToHtml(wm)).layout?.watermark === 'CIORNĂ & co');
check('import: fără filigran', (await docxToHtml(bytes)).layout?.watermark === undefined);
// Filigran colorat și orizontal: fillcolor fără rotire, citit înapoi; cel obișnuit rămâne gri, pe diagonală.
const wm2 = await docToDocx(doc, { header: '', footer: '', numbers: false, watermark: 'COPIE', watermarkColor: '#c62828', watermarkFlat: true });
const w2z = await JSZip.loadAsync(wm2);
const h2 = await w2z.file(Object.keys(w2z.files).find((f) => /^word.header[0-9]*.xml$/.test(f))).async('string');
check('Word: filigran roșu, orizontal', h2.includes('fillcolor="#c62828"') && !h2.includes('rotation:315'));
const back2 = (await docxToHtml(wm2)).layout;
check('import: culoarea și așezarea filigranului revin', back2?.watermark === 'COPIE' && back2?.watermarkColor === '#c62828' && back2?.watermarkFlat === true);
const back1 = (await docxToHtml(wm)).layout;
check('import: filigranul obișnuit rămâne gri, pe diagonală', back1?.watermarkColor === undefined && back1?.watermarkFlat === undefined && hxml.includes('rotation:315') && hxml.includes('fillcolor="silver"'));
const saved2 = parseDoc(serializeDoc({ type: 'doc', content: [] }, { ...odd, watermark: 'COPIE', watermarkColor: '#C62828', watermarkFlat: true }));
check('fișier Suite: culoarea și așezarea filigranului', saved2.page.watermarkColor === '#c62828' && saved2.page.watermarkFlat === true);
const saved3 = parseDoc(serializeDoc({ type: 'doc', content: [] }, { ...odd, watermark: 'X', watermarkColor: 'red; x' }));
check('fișier Suite: culoare necunoscută → gri', saved3.page.watermarkColor === undefined);
// Fontul filigranului: scris în v:textpath, citit înapoi; fontul necunoscut devine cel implicit.
const wm3 = await docToDocx(doc, { header: '', footer: '', numbers: false, watermark: 'MODEL', watermarkFont: 'Georgia' });
const hz = await JSZip.loadAsync(wm3);
const hx3 = (await Promise.all(Object.keys(hz.files).filter((f) => /^word[/]header[0-9]*[.]xml$/.test(f)).map((f) => hz.file(f).async('string')))).join('');
check('export: fontul filigranului în .docx', hx3.includes('font-family:&quot;Georgia&quot;'));
check('import: fontul filigranului revine', (await docxToHtml(wm3)).layout?.watermarkFont === 'Georgia');
check('import: fontul implicit nu se scrie', back1?.watermarkFont === undefined);
// Filigranul din imagine: o poză PNG în antet (VML cu v:imagedata decolorată), cu legătura ei, citită înapoi.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const wmi = await docToDocx(doc, { header: '', footer: '', numbers: false, watermark: 'MODEL', watermarkImage: PNG });
const iz = await JSZip.loadAsync(wmi);
const ihdr = Object.keys(iz.files).filter((f) => /^word[/]header[0-9]*[.]xml$/.test(f));
const ix = (await Promise.all(ihdr.map((f) => iz.file(f).async('string')))).join('');
check('export imagine: antet cu poza decolorată', ihdr.length > 0 && /<v:imagedata r:id="rIdSuiteWm"[^>]*gain="19661f" blacklevel="22938f"/.test(ix));
check('export imagine: fără filigranul cu text (imaginea are întâietate)', !ix.includes('v:textpath'));
check('export imagine: poza în word/media', !!iz.file('word/media/suite-watermark.png'));
const irels = await iz.file(ihdr[0].replace('word/', 'word/_rels/') + '.rels')?.async('string');
check('export imagine: legătura antetului spre poză', !!irels && irels.includes('Id="rIdSuiteWm"') && irels.includes('Target="media/suite-watermark.png"'));
check('export imagine: tipul png în [Content_Types].xml', /<Default Extension="png"/i.test(await iz.file('[Content_Types].xml').async('string')));
check('export imagine: spațiul de nume r în antet', /<w:hdr [^>]*xmlns:r=/.test(ix));
const iback = (await docxToHtml(wmi)).layout;
check('import imagine: poza revine ca filigran', iback?.watermarkImage === PNG && !iback?.watermark);
// Imaginea din antet (sigla): poză DrawingML în antet, la stânga, înaintea textului; citită înapoi; împreună cu filigranul din imagine.
const sgDoc = await docToDocx(doc, { header: 'Firma SRL', footer: '', numbers: false, headerImage: PNG, watermarkImage: PNG });
const sgZip = await JSZip.loadAsync(sgDoc);
const sgX = (await Promise.all(Object.keys(sgZip.files).filter((f) => /^word[/]header[0-9]*[.]xml$/.test(f)).map((f) => sgZip.file(f).async('string')))).join('');
check('export sigla: poza în antet (w:drawing cu a:blip)', /<w:drawing>[^]*<a:blip r:embed=/.test(sgX));
check('export sigla: poza înaintea textului antetului', sgX.indexOf('<w:drawing>') < sgX.indexOf('Firma SRL'));
check('export sigla: și filigranul din imagine rămâne', sgX.includes('rIdSuiteWm'));
const sgBack = (await docxToHtml(sgDoc)).layout;
check('import sigla: revine ca imagine în antet', sgBack?.headerImage === PNG && sgBack?.watermarkImage === PNG && sgBack?.header === 'Firma SRL');
const sgOnly = (await docxToHtml(await docToDocx(doc, { header: '', footer: '', numbers: false, headerImage: PNG }))).layout;
check('import sigla fără text în antet', sgOnly?.headerImage === PNG && !sgOnly?.watermarkImage);
const sgSaved = parseDoc(serializeDoc({ type: 'doc', content: [] }, { ...odd, headerImage: PNG }));
const sgBad = parseDoc(serializeDoc({ type: 'doc', content: [] }, { ...odd, headerImage: 'data:text/html;base64,PHA+' }));
check('fișierul Suite: sigla rămâne, alte feluri de date nu', sgSaved.page?.headerImage === PNG && sgBad.page?.headerImage === undefined);
const saved6 = parseDoc(serializeDoc({ type: 'doc', content: [] }, { ...odd, watermarkImage: PNG }));
const saved7 = parseDoc(serializeDoc({ type: 'doc', content: [] }, { ...odd, watermarkImage: 'data:text/html;base64,PHA+' }));
check('fișierul Suite: imaginea filigranului rămâne, alte feluri de date nu', saved6.page?.watermarkImage === PNG && saved7.page?.watermarkImage === undefined);
const saved4 = parseDoc(serializeDoc({ type: 'doc', content: [] }, { ...odd, watermark: 'X', watermarkFont: 'times new roman' }));
const saved5 = parseDoc(serializeDoc({ type: 'doc', content: [] }, { ...odd, watermark: 'X', watermarkFont: 'Comic; x' }));
check('fișier Suite: fontul filigranului (și cel necunoscut → implicit)', saved4.page.watermarkFont === 'Times New Roman' && saved5.page.watermarkFont === undefined);
// Culoarea paginii: <w:background> în document și afișarea ei în setări (altfel Word n-o arată).
const colored = await docToDocx(doc, { header: '', footer: '', numbers: false, background: '#fff2cc' });
const cz = await JSZip.loadAsync(colored);
check('export: culoarea paginii', /<w:background w:color="FFF2CC"/.test(await cz.file('word/document.xml').async('string')));
check('export: Word afișează culoarea paginii', (await cz.file('word/settings.xml').async('string')).includes('w:displayBackgroundShape'));
check('import: culoarea paginii revine', (await docxToHtml(colored)).layout?.background === '#fff2cc');
check('import: fără culoare de pagină', (await docxToHtml(bytes)).layout?.background === undefined);
if (fail) console.log(letback.html, lxml2.slice(0, 2500));
if (fail) console.log(tback.html, nbback.html, nbxml.slice(0, 1500));
console.log(fail ? `${fail} verificări greșite` : 'toate verificările trec');
process.exit(fail ? 1 : 0);
