// Test: Sheets, Import .docx (tabele) (docTables.ts): un .docx făcut aici, cu titlu, text între tabele, cap de tabel
// îngroșat, celule unite pe orizontală și pe verticală, numere românești, date și coduri cu zero în față; se citește cu
// cititorul din Docs (docxToHtml) și se pune în foi: fiecare tabel pe foaia lui, sau toate pe o foaie, cu textul ca rânduri.
// Documentul se scrie și în %TEMP%/suite-textimport-files/tabele.docx (îl folosește testul CDP).
// Rulare (în suite/): node tests/sheets-doc-tables.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, VerticalMergeType, WidthType } from 'docx';

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
const out = join(tmpdir(), `suite-doctables-${process.pid}.mjs`);
await build({
  stdin: { contents: `export * from './src/sheets/docTables.ts'; export { docxToHtml } from './src/docs/docxImport.ts';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const M = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0, count = 0;
const ok = (c, m) => { count++; if (!c) { console.log('GREȘIT: ' + m); fail++; } else console.log('ok: ' + m); };

const cellP = (text, opts = {}) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: !!opts.bold })] })], ...(opts.span ? { columnSpan: opts.span } : {}), ...(opts.vm ? { verticalMerge: opts.vm } : {}) });
const doc = new Document({ sections: [{ children: [
  new Paragraph({ text: 'Raport lunar', heading: HeadingLevel.HEADING_1 }),
  new Paragraph('Situația vânzărilor pe octombrie.'),
  new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
    new TableRow({ children: [cellP('Produs', { bold: true }), cellP('Cod', { bold: true }), cellP('Valoare', { bold: true }), cellP('Data', { bold: true })] }),
    new TableRow({ children: [cellP('Șurub'), cellP('007'), cellP('1.234,56'), cellP('28.10.2026')] }),
    new TableRow({ children: [cellP('Total', { span: 2 }), cellP('1.234,56'), cellP('')] }),
  ] }),
  new Paragraph('Text între tabele.'),
  new Table({ rows: [
    new TableRow({ children: [cellP('Regiune'), cellP('Oraș'), cellP('Clienți')] }),
    new TableRow({ children: [cellP('Nord', { vm: VerticalMergeType.RESTART }), cellP('Iași'), cellP('12')] }),
    new TableRow({ children: [cellP('', { vm: VerticalMergeType.CONTINUE }), cellP('Suceava'), cellP('7')] }),
  ] }),
  new Paragraph('Încheiere.'),
] }] });
const bytes = new Uint8Array(await Packer.toBuffer(doc));
const dir = join(tmpdir(), 'suite-textimport-files');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'tabele.docx'), bytes);

const { html } = await M.docxToHtml(bytes);
ok(M.countTables(html) === 2, 'două tabele găsite');

// Fiecare tabel pe foaia lui, fără text.
let b = M.docTablesToBook(html, { layout: 'sheets', paragraphs: false });
ok(b.sheets.length === 2 && b.sheets[0].name === 'Tabel 1' && b.sheets[1].name === 'Tabel 2', 'două foi: Tabel 1 și Tabel 2');
let s = b.sheets[0];
ok(s.cells.A1 === 'Produs' && s.styles.A1?.b && s.styles.D1?.b, 'capul de tabel îngroșat');
ok(s.cells.B2 === "'007", 'codul 007 rămâne text: ' + s.cells.B2);
ok(s.cells.C2 === '1234,56' && s.styles.C2?.fmt === 'number', 'numărul 1.234,56 e număr: ' + s.cells.C2);
ok(s.cells.D2 === '46323' && s.styles.D2?.fmt === 'date', 'data 28.10.2026: ' + s.cells.D2);
ok(s.merges.includes('A3:B3') && s.cells.C3 === '1234,56', 'celula unită pe orizontală (Total): ' + JSON.stringify(s.merges));
ok(s.styles.A2?.bd === 'tblr', 'chenarele tabelului');
s = b.sheets[1];
ok(s.merges.includes('A2:A3') && s.cells.A2 === 'Nord' && s.cells.C3 === '7', 'celula unită pe verticală (Nord): ' + JSON.stringify(s.merges));
ok(s.styles.A1?.b, 'capul ghicit (texte deasupra numerelor) îngroșat');

// Toate pe o foaie, cu textul ca rânduri.
b = M.docTablesToBook(html, { layout: 'stack', paragraphs: true });
s = b.sheets[0];
ok(b.sheets.length === 1 && s.name === 'Tabele', 'o singură foaie');
ok(s.cells.A1 === 'Raport lunar' && s.styles.A1?.b && s.styles.A1?.sz === 16, 'titlul documentului, mare și îngroșat');
ok(s.cells.A2 === 'Situația vânzărilor pe octombrie.' && !s.cells.A3 && s.cells.A4 === 'Produs', 'textul, un rând gol, apoi tabelul');
const rowOf = (txt) => Object.entries(s.cells).find(([, v]) => v === txt)?.[0];
ok(rowOf('Text între tabele.') === 'A8' && rowOf('Regiune') === 'A10' && rowOf('Încheiere.') === 'A14', 'ordinea: tabel, rând gol, text, rând gol, tabel, rând gol, text: ' + [rowOf('Text între tabele.'), rowOf('Regiune'), rowOf('Încheiere.')].join(' '));
ok(s.merges.includes('A11:A12'), 'celula unită de pe verticală, mutată mai jos: ' + JSON.stringify(s.merges));

// Fiecare pe foaia lui, cu text: textul dinaintea tabelului deasupra lui.
b = M.docTablesToBook(html, { layout: 'sheets', paragraphs: true });
ok(b.sheets[0].cells.A1 === 'Raport lunar' && b.sheets[0].cells.A4 === 'Produs' && b.sheets[1].cells.A1 === 'Text între tabele.' && Object.values(b.sheets[1].cells).includes('Încheiere.'), 'pe foi, cu textul dinainte deasupra');

// HTML direct: entități, th, tabel în celulă, fără tabele.
const h2 = '<table><tr><th>A &amp; B</th><th>Sumă</th></tr><tr><td>x<br/>y</td><td>2&nbsp;500,00</td></tr><tr><td><table><tr><td>in</td><td>tabel</td></tr></table></td><td>-3</td></tr></table>';
b = M.docTablesToBook(h2, { layout: 'stack', paragraphs: false });
s = b.sheets[0];
ok(s.cells.A1 === 'A & B' && s.styles.A1?.b && s.cells.A2 === 'x\ny' && s.styles.A2?.wrap && s.cells.B2 === '2500', 'entități, <th>, rând nou în celulă, 2 500,00: ' + s.cells.B2);
ok(s.cells.A3 === 'in tabel' && s.cells.B3 === '-3', 'tabelul din celulă devine textul celulei');
let threw = '';
try { M.docTablesToBook('<p>doar text</p>', { layout: 'stack', paragraphs: true }); } catch (e) { threw = e.message; }
ok(/niciun tabel/.test(threw), 'fără tabele: mesaj clar');

console.log(`\n${count - fail} din ${count} verificări trecute` + (fail ? `, ${fail} GREȘITE` : ''));
process.exit(fail ? 1 : 0);
