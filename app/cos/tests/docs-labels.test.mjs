// Test pentru etichetele din Docs: tabelul fără chenare cu celulele cât etichetele, textul pe toată foaia sau pe o etichetă, .docx.
// Rulare (în suite/): node tests/docs-labels.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import JSZip from 'jszip';

const out = join(tmpdir(), `suite-docslabels-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { labelsDoc, labelsFile, labelsMergeDoc, labelText, LABEL_SHEETS, sheetById } from './src/docs/labels.ts'; export { envelopesMergeDoc } from './src/docs/envelope.ts'; export { parseDoc } from './src/docs/format.ts'; export { docToDocx } from './src/docs/docx.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const NL = String.fromCharCode(10);
const text = ['Ion Popescu', 'Str. Exemplu nr. 1', '010101 București'].join(NL);
const cellText = (c) => c.content.map((p) => (p.content ?? []).map((t) => t.text).join('')).join('|');
for (const s of m.LABEL_SHEETS) {
  check(`${s.id}: încape pe A4`, s.left + s.cols * s.w <= 210.5 && s.top + s.rows * s.h <= 297.5, `${s.left + s.cols * s.w} × ${s.top + s.rows * s.h}`);
  const { doc, page } = m.labelsDoc(text, s);
  const t = doc.content[0];
  const cells = t.content.flatMap((r) => r.content);
  check(`${s.id}: ${s.cols * s.rows} etichete, toate cu textul`, t.attrs.borders === 'none' && cells.length === s.cols * s.rows && cells.every((c) => cellText(c) === 'Ion Popescu|Str. Exemplu nr. 1|010101 București'));
  check(`${s.id}: înălțimea rândurilor și marginile`, t.content.every((r) => Math.abs(r.attrs.rowHeight - s.h / 10) < 0.06) && page.margins.top === s.top && page.margins.left === s.left);
}
const one = m.labelsDoc(text, m.sheetById('3x7'), { row: 2, col: 3 }).doc.content[0];
const full = one.content.flatMap((r, ri) => r.content.map((c, ci) => (cellText(c) ? `${ri + 1}:${ci + 1}` : ''))).filter(Boolean);
check('o singură etichetă, pe rândul 2, coloana 3', full.length === 1 && full[0] === '2:3', JSON.stringify(full));
const back = m.parseDoc(m.labelsFile(text, m.sheetById('2x7')));
check('fișierul Suite se citește înapoi', back.content.content[0].type === 'table' && back.page.margins.top === 15.1, JSON.stringify(back.page));
const xml = await (await JSZip.loadAsync(await m.docToDocx(back.content, back.page))).file('word/document.xml').async('string');
check('Word: tabel cu 14 etichete', (xml.match(/Ion Popescu/g) ?? []).length === 14 && xml.includes('<w:trHeight'), xml.slice(0, 300));
// Etichete din tabel: câte una pentru fiecare rând, cu câmpurile completate, pe foi noi când nu mai încap.
const data = { source: 'clienti.xlsx', headers: ['Nume', 'Adresa', 'Oras'], rows: Array.from({ length: 16 }, (_, i) => [`Client ${i + 1}`, `Str. ${i + 1}`, i === 3 ? '' : 'Cluj']) };
data.rows[15] = ['', '', ''];
const mm = m.labelsMergeDoc(['«Nume»', '«Adresa», «Oras»', '«Necunoscut»'].join(NL), m.sheetById('2x7'), data, data.rows.map((_, i) => i));
const tables = mm.doc.content.filter((n) => n.type === 'table');
const labels = tables.flatMap((t) => t.content.flatMap((r) => r.content)).map(cellText);
check('din tabel: 16 rânduri, unul gol → 15 etichete pe 2 foi', mm.count === 15 && tables.length === 2 && mm.doc.content[1].type === 'pageBreak' && labels.length === 28, `${mm.count} / ${tables.length}`);
check('din tabel: câmpurile completate în ordine, pe rânduri', labels[0] === 'Client 1|Str. 1, Cluj|«Necunoscut»' && labels[1].startsWith('Client 2|') && labels[13].startsWith('Client 14|') && labels[14].startsWith('Client 15|') && labels[15] === '', labels.slice(0, 2).join(' / '));
check('din tabel: câmp gol rămâne gol', labels[3] === 'Client 4|Str. 4,|«Necunoscut»', labels[3]);
const addr = m.labelText('«Bloc de adresă»', { source: 'x', headers: ['Nume', 'Prenume', 'Adresa', 'Oras'], rows: [['Popescu', 'Ion', 'Str. Lungă 3', 'Iași']] }, 0);
check('din tabel: blocul de adresă pe rânduri', addr.includes('Popescu') && addr.includes('Str. Lungă 3') && addr.includes(NL), JSON.stringify(addr));
// Plicuri din tabel: câte un plic (pagină) pentru fiecare rând, despărțite de pagini noi, cu expeditorul pe fiecare.
const env = m.envelopesMergeDoc('«Nume»' + NL + '«Adresa»', 'Firma Mea SRL', 'DL', data, data.rows.map((_, i) => i));
const envText = env.doc.content.map((n) => n.type === 'pageBreak' ? '#' : (n.content ?? []).map((t) => t.text).join('')).join('|');
check('plicuri din tabel: 15 plicuri, 14 pagini noi', env.count === 15 && env.doc.content.filter((n) => n.type === 'pageBreak').length === 14 && env.page.paper === 'DL' && env.page.landscape, `${env.count}`);
check('plicuri din tabel: expeditorul și destinatarul pe fiecare', envText.startsWith('Firma Mea SRL|Client 1|Str. 1|#|Firma Mea SRL|Client 2|'), envText.slice(0, 80));
console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
