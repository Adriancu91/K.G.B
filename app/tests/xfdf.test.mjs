// Test pentru Exportă / Importă comentarii (XFDF și FDF): comentariile unui PDF trec, prin fișierul XFDF, pe o copie fără comentarii
// (notă cu diacritice, evidențiere cu QuadPoints, desen, linie, răspuns și starea lui); importul de două ori nu dublează nimic;
// legăturile și câmpurile nu se exportă; XFDF scris de Acrobat (cu prefix, entități, contents-richtext) se citește.
// Copiat din Cyber Office Studio (tests/pdf-xfdf.test.mjs, D-071); schimbat doar felul în care se încarcă codul.
// Rulare (în app/): node tests/xfdf.test.mjs
import "./ts-hooks.mjs";
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { PDFArray, PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';

const { exportXfdf, importXfdf, parseXml } = await import('../src/modules/pdf/xfdf.ts');

let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'OK   ' : 'GREȘIT ') + name + (extra ? ' — ' + extra : '')); if (!ok) fails++; };

const blank = async () => { const d = await PDFDocument.create(); d.addPage([595, 842]); d.addPage([595, 842]); return d; };
const src = await blank();
const ctx = src.context;
const p1 = src.getPage(0), p2 = src.getPage(1);
const reg = (o) => ctx.register(ctx.obj(o));
const note = reg({ Type: 'Annot', Subtype: 'Text', Rect: [100, 700, 120, 720], F: 4, Name: 'Comment', C: [1, 0.8, 0],
  Contents: PDFHexString.fromText('Verificați suma & „TVA” <19%>'), T: PDFHexString.fromText('Ana Ionescu'), M: PDFString.of('D:20261019100000') });
const hl = reg({ Type: 'Annot', Subtype: 'Highlight', Rect: [50, 600, 200, 615], F: 4, C: [1, 1, 0], CA: 0.5, QuadPoints: [50, 615, 200, 615, 50, 600, 200, 600] });
const ink = reg({ Type: 'Annot', Subtype: 'Ink', Rect: [10, 10, 100, 100], F: 4, C: [0, 0, 1], InkList: [[10, 10, 50, 60, 100, 100], [20, 80, 30, 90]] });
const line = reg({ Type: 'Annot', Subtype: 'Line', Rect: [0, 0, 300, 300], F: 4, L: [10, 20, 290, 280], LE: [PDFName.of('None'), PDFName.of('OpenArrow')], BS: { W: 2 } });
const reply = reg({ Type: 'Annot', Subtype: 'Text', Rect: [100, 700, 120, 720], F: 4, IRT: note, RT: PDFName.of('R'), Contents: PDFHexString.fromText('Am verificat.'), T: PDFHexString.fromText('Ion') });
const state = reg({ Type: 'Annot', Subtype: 'Text', Rect: [100, 700, 120, 720], F: 6, IRT: note, RT: PDFName.of('R'), State: PDFString.of('Accepted'), StateModel: PDFString.of('Review'), T: PDFHexString.fromText('Ion') });
const link = reg({ Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 10, 10] });
p1.node.set(PDFName.of('Annots'), ctx.obj([note, hl, reply, state, link]));
p2.node.set(PDFName.of('Annots'), ctx.obj([ink, line]));
const srcBytes = await src.save();

const { xml, count } = await exportXfdf(srcBytes, 'Contract.pdf');
check('6 comentarii exportate (fără legătură)', count === 6 && !xml.includes('<link'), String(count));
check('caracterele speciale sunt scrise corect în XML', xml.includes('&amp; „TVA” &lt;19%&gt;'));
check('numele fișierului PDF e în XFDF', xml.includes('<f href="Contract.pdf"/>'));

const target = await (await blank()).save();
const r1 = await importXfdf(target, xml);
check('import: 6 adăugate', r1.added === 6 && r1.skipped === 0 && r1.already === 0, JSON.stringify({ ...r1, bytes: undefined }));
const back = await PDFDocument.load(r1.bytes);
const annotsOf = (doc, i) => (doc.getPage(i).node.lookup(PDFName.of('Annots'), PDFArray)?.asArray() ?? []).map((r) => ({ ref: r, d: doc.context.lookup(r) }));
const a1 = annotsOf(back, 0), a2 = annotsOf(back, 1);
const sub = (x) => x.d.get(PDFName.of('Subtype')).decodeText();
check('pagina 1: notă, evidențiere, răspuns, stare; pagina 2: desen, linie', a1.map(sub).join() === 'Text,Highlight,Text,Text' && a2.map(sub).join() === 'Ink,Line', a1.map(sub).join() + ' / ' + a2.map(sub).join());
const n = a1[0].d;
check('nota: text cu diacritice, autor, culoare', n.get(PDFName.of('Contents')).decodeText() === 'Verificați suma & „TVA” <19%>' && n.get(PDFName.of('T')).decodeText() === 'Ana Ionescu'
  && n.get(PDFName.of('C')).asArray().map(String).join() === '1,0.8,0');
check('evidențierea: QuadPoints și opacitate', a1[1].d.get(PDFName.of('QuadPoints')).asArray().map(String).join() === '50,615,200,615,50,600,200,600' && String(a1[1].d.get(PDFName.of('CA'))) === '0.5');
const irt = (x) => x.d.get(PDFName.of('IRT'));
check('răspunsul și starea sunt legate de notă', irt(a1[2])?.toString() === a1[0].ref.toString() && irt(a1[3])?.toString() === a1[0].ref.toString());
check('starea Accepted, ascunsă', a1[3].d.get(PDFName.of('State')).decodeText() === 'Accepted' && (Number(String(a1[3].d.get(PDFName.of('F')))) & 2) === 2);
check('desenul: două linii', a2[0].d.get(PDFName.of('InkList')).asArray().map((g) => g.asArray().map(String).join()).join(' | ') === '10,10,50,60,100,100 | 20,80,30,90');
check('linia: capete, săgeată și grosime', a2[1].d.get(PDFName.of('L')).asArray().map(String).join() === '10,20,290,280'
  && a2[1].d.get(PDFName.of('LE')).asArray().map(String).join() === '/None,/OpenArrow' && String(a2[1].d.get(PDFName.of('BS')).get(PDFName.of('W'))) === '2');

const r2 = await importXfdf(r1.bytes, xml);
check('al doilea import nu dublează', r2.added === 0 && r2.already === 6, JSON.stringify({ ...r2, bytes: undefined }));
const r3 = await importXfdf(srcBytes, xml);
check('importul în PDF-ul original nu dublează (nume suite-…)', r3.added === 0 && r3.already === 6);

// FDF: aceleași comentarii prin formatul mai vechi .fdf (sintaxa PDF), dus-întors; apoi un .fdf scris de alt program.
const { xfdfToFdf, fdfToXfdf } = await import('../src/modules/pdf/fdf.ts');
const fdfText = xfdfToFdf(xml, 'Contract.pdf');
check('FDF: antet, 6 comentarii ca obiecte, răspunsul legat cu /IRT', fdfText.startsWith('%FDF-1.2') && fdfText.split(' 0 obj').length === 8 && fdfText.includes('/IRT 2 0 R /RT /R') && fdfText.includes('/F (Contract.pdf)'));
const fdfBytes = new TextEncoder().encode(fdfText);
const r5 = await importXfdf(target, fdfToXfdf(fdfBytes));
const b5 = await PDFDocument.load(r5.bytes);
const f1 = annotsOf(b5, 0), f2 = annotsOf(b5, 1);
check('FDF: import 6 adăugate, pe paginile lor', r5.added === 6 && f1.map(sub).join() === 'Text,Highlight,Text,Text' && f2.map(sub).join() === 'Ink,Line', f1.map(sub).join() + ' / ' + f2.map(sub).join());
check('FDF: nota cu diacritice, autor, culoare', f1[0].d.get(PDFName.of('Contents')).decodeText() === 'Verificați suma & „TVA” <19%>' && f1[0].d.get(PDFName.of('T')).decodeText() === 'Ana Ionescu'
  && f1[0].d.get(PDFName.of('C')).asArray().map(String).join() === '1,0.8,0');
check('FDF: răspunsul și starea legate de notă, starea Accepted', irt(f1[2])?.toString() === f1[0].ref.toString() && irt(f1[3])?.toString() === f1[0].ref.toString() && f1[3].d.get(PDFName.of('State')).decodeText() === 'Accepted');
check('FDF: evidențierea, desenul și linia', f1[1].d.get(PDFName.of('QuadPoints')).asArray().map(String).join() === '50,615,200,615,50,600,200,600'
  && f2[0].d.get(PDFName.of('InkList')).asArray().map((g) => g.asArray().map(String).join()).join(' | ') === '10,10,50,60,100,100 | 20,80,30,90'
  && f2[1].d.get(PDFName.of('LE')).asArray().map(String).join() === '/None,/OpenArrow' && String(f2[1].d.get(PDFName.of('BS')).get(PDFName.of('W'))) === '2');
const r6 = await importXfdf(r1.bytes, fdfToXfdf(fdfBytes));
check('FDF peste comentariile venite din XFDF: nimic dublat', r6.added === 0 && r6.already === 6, JSON.stringify({ ...r6, bytes: undefined }));
const hex16 = (s) => '<FEFF' + [...s].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('') + '>';
const foreign = ['%FDF-1.2', '1 0 obj', '<< /FDF << /Annots [5 0 R 6 0 R 7 0 R] /F (Contract.pdf) >> >>', 'endobj',
  '5 0 obj', `<< /Type /Annot /Subtype /Square /Page 1 /Rect [10 10 110 60] /Contents ${hex16('Semnătura lipsă')} /T (Maria) /C [1 0 0] /BS 8 0 R >>`, 'endobj',
  '6 0 obj', '<</Type/Annot/Subtype/Text/Page 1/Rect[10 10 30 30]/IRT 5 0 R/Contents(Rezolvat)/T(Ion)>>', 'endobj',
  '7 0 obj', '<< /Type /Annot /Subtype /Widget /Page 0 /Rect [0 0 1 1] >>', 'endobj', '8 0 obj', '<< /W 3 >>', 'endobj',
  'trailer', '<< /Root 1 0 R >>', '%%EOF'].join(String.fromCharCode(10));
const r7 = await importXfdf(target, fdfToXfdf(new TextEncoder().encode(foreign)));
const g = annotsOf(await PDFDocument.load(r7.bytes), 1);
check('FDF de la alt program: pătratul cu text și grosime, răspunsul legat, câmpul sărit', r7.added === 2 && g.map(sub).join() === 'Square,Text'
  && g[0].d.get(PDFName.of('Contents')).decodeText() === 'Semnătura lipsă' && String(g[0].d.get(PDFName.of('BS')).get(PDFName.of('W'))) === '3'
  && irt(g[1])?.toString() === g[0].ref.toString(), JSON.stringify({ ...r7, bytes: undefined }));
check('FDF fără comentarii: niciunul adăugat', (await importXfdf(target, fdfToXfdf(new TextEncoder().encode('%FDF-1.2 1 0 obj << /FDF << >> >> endobj')))).added === 0);

// XFDF ca de la Acrobat: prefix de spațiu de nume, entități numerice, contents-richtext, pagină inexistentă.
const acro = `<?xml version="1.0" encoding="UTF-8" ?>
<xfdf:xfdf xmlns:xfdf="http://ns.adobe.com/xfdf/" xml:space="preserve"><xfdf:annots>
<xfdf:square color="#FF0000" creationdate="D:20260101" flags="print" date="D:20260101" name="abc-1" page="1" rect="10,10,110,60" title="Maria" width="3">
<xfdf:contents-richtext><body xmlns="http://www.w3.org/1999/xhtml"><p>Semn&#259;tura lips&#x103;</p></body></xfdf:contents-richtext></xfdf:square>
<xfdf:circle page="9" rect="1,1,2,2" name="x"/>
<!-- comentariu XML --></xfdf:annots><xfdf:f href="Contract.pdf"/></xfdf:xfdf>`;
const r4 = await importXfdf(target, acro);
const sq = annotsOf(await PDFDocument.load(r4.bytes), 1)[0];
check('XFDF de la Acrobat: pătratul pe pagina 2, cu text și grosime', r4.added === 1 && r4.skipped === 1 && sq && sub(sq) === 'Square'
  && sq.d.get(PDFName.of('Contents')).decodeText() === 'Semnătura lipsă' && String(sq.d.get(PDFName.of('BS')).get(PDFName.of('W'))) === '3');

let threw = '';
try { await importXfdf(target, '<html><body>nu</body></html>'); } catch (e) { threw = e.message; }
check('fișier care nu e XFDF → mesaj', /nu e XFDF/.test(threw));
check('cititorul XML: atribute cu apostrof și elemente goale', parseXml("<a x='1 &amp; 2'><b/>t</a>").kids[0].attrs.x === '1 & 2');

console.log(fails ? `${fails} GREȘITE` : 'TOATE TREC');
process.exit(fails ? 1 : 0);
