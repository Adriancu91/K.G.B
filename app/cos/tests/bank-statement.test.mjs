// Test rapid pentru extrasul de cont → tabel (src/sheets/bankStatement.ts): trei feluri de exporturi CSV, făcute de noi după
// forma celor publice (antet pe câteva rânduri, Debit / Credit separate sau o singură sumă cu semn, descrieri pe mai multe rânduri).
// Rulare (în suite/): node tests/bank-statement.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-bank-${process.pid}.mjs`);
await build({ stdin: { contents: "export * from './src/sheets/bankStatement.ts'; export { parseCsv } from './src/sheets/csv.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const M = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GRESIT: ') + m); if (!c) fail++; };

ok(M.parseAmount('1.234,56') === 1234.56 && M.parseAmount('1,234.56') === 1234.56 && M.parseAmount('-123.45') === -123.45, 'sume: 1.234,56 / 1,234.56 / -123.45');
ok(M.parseAmount('(12,00)') === -12 && M.parseAmount('250 RON') === 250 && M.parseAmount('1.234') === 1234 && M.parseAmount('12,5') === 12.5 && Number.isNaN(M.parseAmount('abc')), 'sume: (12,00), 250 RON, 1.234, 12,5, text');
ok(M.parseBankDate('26.10.2026') === '2026-10-26' && M.parseBankDate('2026-10-26 14:03:00') === '2026-10-26' && M.parseBankDate('26 oct. 2026') === '2026-10-26' && M.parseBankDate('5/1/26') === '2026-01-05' && M.parseBankDate('Sold inițial') === '', 'date în mai multe forme');

// 1) Antet deasupra, Debit / Credit separate, numere cu virgulă, sold.
const csv1 = `Extras de cont;;;;
Titular: Ion Popescu;;;;
IBAN: RO49AAAA1B31007593840000;;;;
Perioada: 01.09.2026 - 31.10.2026;;;;
;;;;
Data tranzactiei;Descriere;Debit;Credit;Sold
01.09.2026;Sold initial;;;1.000,00
02.09.2026;Incasare salariu septembrie FIRMA TEST SRL;;5.250,00;6.250,00
05.09.2026;Plata POS SUPERMARKET CENTRAL CLUJ card ****1234;235,40;;6.014,60
10.09.2026;Plata factura energie electrica;180,25;;5.834,35
15.09.2026;Retragere numerar ATM;500,00;;5.334,35
30.09.2026;Comision administrare cont;12,00;;5.322,35
01.10.2026;Plata chirie octombrie;1.800,00;;3.522,35
02.10.2026;Incasare salariu octombrie FIRMA TEST SRL;;5.250,00;8.772,35
;Total;2.727,65;10.500,00;
`;
const r1 = M.readStatement(M.parseCsv(csv1, ';'));
ok(r1.txs.length === 7, 'format 1: 7 operațiuni (fără soldul inițial și totaluri): ' + r1.txs.length);
ok(r1.txs[0].date === '2026-09-02' && r1.txs[0].credit === 5250 && r1.txs[0].category === 'Salariu', 'format 1: salariul');
ok(r1.txs[1].debit === 235.4 && r1.txs[1].category === 'Cumpărături' && r1.txs[1].balance === 6014.6, 'format 1: plata cu cardul și soldul');
ok(r1.txs.map((t) => t.category).join(',') === 'Salariu,Cumpărături,Utilități,Numerar,Comisioane bancare,Chirie,Salariu', 'format 1: categoriile: ' + r1.txs.map((t) => t.category).join(','));

// 2) O singură sumă cu semn, punct zecimal, cea mai nouă operațiune prima, moneda separat, beneficiar separat.
const csv2 = `"Booking date","Beneficiar","Details","Amount","Currency"
"2026-10-20","Asociatia de proprietari","Intretinere septembrie","-345.10","RON"
"2026-10-15","Maria Ionescu","Transfer intre conturi","1,200.00","RON"
"2026-10-03","","Dobanda creditoare","0.42","RON"
`;
const r2 = M.readStatement(M.parseCsv(csv2, ','));
ok(r2.txs.length === 3 && r2.txs[0].date === '2026-10-03', 'format 2: 3 operațiuni, puse în ordinea zilelor');
ok(r2.txs[2].debit === 345.1 && r2.txs[2].partner === 'Asociatia de proprietari' && r2.txs[2].desc === 'Intretinere septembrie' && r2.txs[2].category === 'Utilități', 'format 2: plata cu minus, beneficiarul în coloana Partener: ' + r2.txs[2].partner + ' / ' + r2.txs[2].desc);
ok(r2.txs[0].partner === '' && r2.txs[1].partner === 'Maria Ionescu', 'format 2: dobânda fără partener');
ok(r2.txs[1].credit === 1200 && r2.txs[1].category === 'Transferuri' && r2.txs[0].category === 'Dobânzi', 'format 2: transfer și dobândă');
ok(r2.currency === 'RON', 'format 2: moneda RON');

// 3) Coloana Tip (D / C), descrierea continuată pe rândurile de sub operațiune.
const csv3 = `Data;Tip;Suma;Detalii
03.10.2026;D;89,99;Plata OP
;;;catre Furnizor Internet SA
;;;abonament octombrie
04.10.2026;C;150,00;Incasare
;;;de la Client Unu
`;
const r3 = M.readStatement(M.parseCsv(csv3, ';'));
ok(r3.txs.length === 2 && r3.txs[0].debit === 89.99 && r3.txs[1].credit === 150, 'format 3: debit / credit după coloana Tip');
ok(r3.txs[0].desc === 'Plata OP catre Furnizor Internet SA abonament octombrie' && r3.txs[0].category === 'Utilități', 'format 3: descrierea lipită din 3 rânduri: ' + r3.txs[0].desc);

// Partenerul scos din descriere: numele dinaintea contului IBAN (feedback 28.10: sortare după client).
const sp = (d) => { const x = M.splitPartner(d); return x.partner + ' | ' + x.rest; };
ok(sp('ALFA TRADE EXEMPLU S R L RO49BTRLRONCRT0123456789 Incasare SSC0001 Referinta bancii ab12') === 'ALFA TRADE EXEMPLU S R L | RO49BTRLRONCRT0123456789 Incasare SSC0001 Referinta bancii ab12', 'partener: firma dinaintea IBAN-ului: ' + sp('ALFA TRADE EXEMPLU S R L RO49BTRLRONCRT0123456789 Incasare SSC0001'));
ok(sp('Trezoreria Exemplu/1234567 RO12TREZ62120A470300XXXX TREZORERII Transfer') === 'Trezoreria Exemplu | RO12TREZ62120A470300XXXX TREZORERII Transfer', 'partener: fără codul fiscal de după „/”');
ok(sp('Plata factura catre Firma Doi SRL RO49INGB0000999901234567 abonament') === 'Firma Doi SRL | RO49INGB0000999901234567 abonament', 'partener: după „catre”');
ok(sp('Comision pe operatiune') === ' | Comision pe operatiune' && sp('Retragere numerar ATM card 1234') === ' | Retragere numerar ATM card 1234', 'fără IBAN: fără partener');
// Regulile se potrivesc și pe numele partenerului.
ok(M.categorize('ALFA TRADE RO49BTRL Incasare', true, [['alfa', 'Clienți']]) === 'Clienți', 'regulă pe numele partenerului');
const rs = M.readStatement([['Data', 'Descriere', 'Suma'], ['01.10.2026', 'ALFA TRADE S R L RO49BTRLRONCRT0123456789 Incasare SSC0001', '100'], ['02.10.2026', 'ALFA TRADE S R L RO49BTRLRONCRT0123456789 Incasare SSC0002', '50'], ['03.10.2026', 'Comision pe operatiune', '-1']]);
const ds = M.statementDoc(rs, 'Parteneri test');
const pa = ds.sheets.find((x) => x.name === 'Parteneri');
ok(ds.sheets.map((x) => x.name).join(',') === 'Extras,Rezumat,Parteneri,Reguli' && ds.sheets[0].cells.B2 === 'ALFA TRADE S R L' && ds.sheets[0].cells.C2.startsWith('RO49') && !ds.sheets[0].cells.B4, 'Extras: coloana Partener (B), descrierea fără nume (C), comisionul fără partener');
ok(pa.cells.A1 === 'Partener' && pa.cells.A2 === 'ALFA TRADE S R L' && !pa.cells.A3 && pa.cells.B2 === '=SUMIFS(Extras!$D$2:$D$4;Extras!$B$2:$B$4;$A2)' && pa.cells.E2 === '=COUNTIFS(Extras!$B$2:$B$4;$A2)', 'foaia Parteneri: un partener, cu SUMIFS și COUNTIFS: ' + pa.cells.B2);
// Un tabel făcut înainte (fără coloana Partener): Aplică regulile îl aduce la forma nouă, cu foaia Parteneri.
const old = M.statementDoc(rs, 'Vechi');
const oex = old.sheets[0];
const oldCells = { A1: 'Data', B1: 'Descriere', C1: 'Încasări', D1: 'Plăți', E1: 'Sold', F1: 'Categorie', G1: 'Luna' };
for (let r = 2; r <= 4; r++) Object.assign(oldCells, { [`A${r}`]: oex.cells[`A${r}`], [`B${r}`]: [oex.cells[`B${r}`], oex.cells[`C${r}`]].filter(Boolean).join(' '), [`C${r}`]: oex.cells[`D${r}`], [`D${r}`]: oex.cells[`E${r}`], [`F${r}`]: oex.cells[`G${r}`] });
for (const k of Object.keys(oldCells)) if (oldCells[k] === undefined) delete oldCells[k];
const oldDoc = { ...old, sheets: [{ ...oex, cells: oldCells }, old.sheets[1], old.sheets[3]] };
ok(M.isStatementDoc(oldDoc), 'tabelul vechi e recunoscut ca extras');
const ao = M.applyRules(oldDoc);
ok(ao.sheets.map((x) => x.name).join(',') === 'Extras,Rezumat,Parteneri,Reguli' && ao.sheets[0].cells.B2 === 'ALFA TRADE S R L' && ao.sheets[0].cells.D3 === '50', 'tabelul vechi: Aplică regulile pune coloana Partener și foaia Parteneri: ' + ao.sheets.map((x) => x.name).join(','));

// Cuvintele scurte doar întregi: „depozit” nu e „pos”.
ok(M.categorize('Constituire depozit', false) === 'Alte plăți' && M.categorize('Plata POS', false) === 'Cumpărături', '„pos” doar ca vorbă întreagă');
let thrown = ''; try { M.readStatement([['a', 'b'], ['1', '2']]); } catch (e) { thrown = e.message; }
ok(thrown.includes('Nu găsesc tabelul'), 'fără antet: mesaj clar');

// O foaie citită din .xlsx: data ca număr de zi cu format de dată, suma ca număr.
const rows = M.cellsToRows({ A1: 'Data', B1: 'Descriere', C1: 'Suma', A2: '46296,125', B2: 'Plata chirie', C2: '-1800,004' }, { A2: { fmt: 'date' } });
ok(JSON.stringify(rows) === JSON.stringify([['Data', 'Descriere', 'Suma'], ['01.10.2026', 'Plata chirie', '-1800']]), 'cellsToRows: ' + JSON.stringify(rows));
const rx = M.readStatement(rows);
ok(rx.txs.length === 1 && rx.txs[0].date === '2026-10-01' && rx.txs[0].debit === 1800 && rx.txs[0].category === 'Chirie', 'din .xlsx: chiria din 01.10.2026');
// Fără formatul de dată, numărul zilei din coloana Data e tot o dată.
const ry = M.readStatement(M.cellsToRows({ A1: 'Data', B1: 'Descriere', C1: 'Suma', A2: '46296', B2: 'Plata chirie', C2: '-1800' }, {}));
ok(ry.txs.length === 1 && ry.txs[0].date === '2026-10-01', 'numărul zilei fără format de dată: ' + ry.txs[0]?.date);

// Tabelul: foaia Extras și Rezumatul pe luni.
const d = M.statementDoc(r1, 'Extras test');
const [ex, rz] = d.sheets;
ok(ex.name === 'Extras' && rz.name === 'Rezumat' && ex.cells.B1 === 'Partener' && ex.cells.C2.startsWith('Incasare salariu') && ex.cells.H8 === '2026-10', 'foile Extras și Rezumat');
ok(rz.cells.B1 === '2026-09' && rz.cells.C1 === '2026-10' && rz.cells.D1 === 'Total', 'rezumatul are lunile pe coloane');
ok(/^=SUMIFS\(Extras!\$D\$2:\$D\$8;Extras!\$G\$2:\$G\$8;\$A2;Extras!\$H\$2/.test(rz.cells.B2), 'rezumat cu formule SUMIFS: ' + rz.cells.B2);

// Foaia Reguli: se schimbă o regulă, apoi Aplică regulile refac categoriile și Rezumatul.
const dr = M.statementDoc(r1, 'Extras test');
const rg = dr.sheets[3];
ok(rg.name === 'Reguli' && rg.cells.A2 === 'salariu' && rg.cells.B2 === 'Salariu' && M.isStatementDoc(dr), 'foaia Reguli cu regulile obișnuite');
rg.cells.A2 = 'Supermarket Central'; rg.cells.B2 = 'Mâncare';
rg.cells.A90 = 'octombrie'; rg.cells.B90 = 'Nu se ajunge aici';
const ap = M.applyRules(dr);
const [ex2, rz2, , rg2] = ap.sheets;
ok(ap.changed === 1 && ap.total === 7 && ex2.cells.G3 === 'Mâncare' && ex2.cells.G2 === 'Salariu' && ex2.cells.G7 === 'Chirie', 'Aplică regulile: o categorie schimbată, restul la fel: ' + ap.changed + ' ' + ex2.cells.G3);
ok(Object.values(rz2.cells).includes('Mâncare') && !Object.values(rz2.cells).includes('Cumpărături') && rg2.cells.A2 === 'Supermarket Central', 'Rezumatul are categoria nouă, fără cea veche; regulile rămân în foaie');
ok(ex2.lists[0].values.includes('Mâncare') && ex2.cells.C3.startsWith('Plata POS') && ex2.cells.E3 === '235.4' && ex2.cells.F3 === '6014.6', 'lista de categorii și sumele păstrate');

// Extrasul PDF: textul citit cu pdf.js din PDF-ul făcut de noi → rânduri → operațiuni.
const { makeStatementPdf } = await import('./bank-pdf-make.mjs');
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const pdfWordsOf = async (data) => {
  const pdoc = await pdfjs.getDocument({ data, isEvalSupported: false, verbosity: 0 }).promise;
  const ws = [];
  for (let p = 1; p <= pdoc.numPages; p++) {
    for (const it of (await (await pdoc.getPage(p)).getTextContent()).items) {
      if (it.str?.trim()) ws.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height, page: p });
    }
  }
  const pages = pdoc.numPages;
  await pdoc.destroy();
  return { words: ws, pages };
};
const { words } = await pdfWordsOf(await makeStatementPdf());
const prow = M.pdfToRows(words);
const rp = M.readStatement(prow);
ok(rp.txs.length === 8, 'PDF: 8 operațiuni pe două pagini: ' + rp.txs.length);
ok(rp.txs[0].date === '2026-09-01' && rp.txs[0].credit === 5250 && rp.txs[0].balance === 6250 && rp.txs[0].desc === 'Incasare salariu de la Firma Exemplu SRL' && rp.txs[0].category === 'Salariu', 'PDF: salariul, cu descrierea de pe două rânduri: ' + JSON.stringify(rp.txs[0]));
ok(rp.txs[1].debit === 312.45 && rp.txs[1].credit === 0 && rp.txs[1].category === 'Cumpărături', 'PDF: suma aliniată la dreapta merge la Debit');
ok(rp.txs[4].desc === 'Plata factura energie electrica cod client 123456' && rp.txs[4].category === 'Utilități', 'PDF: ultima operațiune de pe pagina 1, fără „Pagina 1 din 2”: ' + rp.txs[4].desc);
ok(rp.txs[5].date === '2026-10-01' && rp.txs[5].desc === 'Incasare salariu de la Firma Exemplu SRL', 'PDF: pagina 2 fără antetul băncii lipit: ' + rp.txs[5].desc);
ok(rp.txs[7].debit === 64.5 && rp.txs[7].desc === 'Plata POS farmacie' && rp.txs[7].balance === 8697.85, 'PDF: ultima operațiune fără nota de sub tabel: ' + rp.txs[7].desc);
ok(/rânduri fără dată sau sumă/.test(rp.warnings.join(' ')), 'PDF: sold inițial, total și nota sărite: ' + rp.warnings.join(' | '));
ok(rp.printed.credit === 10500 && rp.printed.debit === 2802.15 && rp.printed.opening === 1000 && rp.warnings.length === 1, 'PDF: totalurile și soldul inițial citite și potrivite: ' + JSON.stringify(rp.printed));
ok(r1.printed.credit === 10500 && r1.printed.debit === 2727.65 && r1.printed.opening === 1000 && r1.warnings.length === 1, 'format 1: rândul Total și soldul inițial se potrivesc cu operațiunile: ' + JSON.stringify(r1.printed));

// Al doilea fel de extras PDF: antetul tabelului pe două rânduri și doar pe prima pagină, un rezumat „Data / Numar / Suma”
// deasupra lui, antetul băncii pe fiecare pagină, plățile cu minus, numere 1,234.56, referința sub dată, nota și „1 \ 2” jos.
const { makeTwoLineStatementPdf, TWO_LINE_TXS, TWO_LINE_OPENING } = await import('./bank-pdf-make.mjs');
const two = await pdfWordsOf(await makeTwoLineStatementPdf());
const rt = M.readStatement(M.pdfToRows(two.words));
const want = TWO_LINE_TXS.map((t) => ({ credit: t.credit ?? 0, debit: t.debit ?? 0, desc: t.lines.filter(Boolean).reduce((a, s) => (a ? a + (/[A-Za-z0-9]-$/.test(a) ? '' : ' ') + s : s), '') }));
const sum = (a, k) => Math.round(a.reduce((x, t) => x + t[k], 0) * 100) / 100;
ok(two.pages >= 2 && rt.txs.length === want.length, `PDF 2: ${rt.txs.length} operațiuni din ${want.length}, pe ${two.pages} pagini`);
ok(sum(rt.txs, 'credit') === sum(want, 'credit') && sum(rt.txs, 'debit') === sum(want, 'debit'), `PDF 2: totalurile: încasări ${sum(rt.txs, 'credit')} / ${sum(want, 'credit')}, plăți ${sum(rt.txs, 'debit')} / ${sum(want, 'debit')}`);
// Descrierea din PDF = partenerul (scos în coloana lui, fără codul fiscal de după „/”) + restul.
const badDesc = rt.txs.map((t, i) => ((t.partner ? want[i]?.desc.startsWith(t.partner) && want[i].desc.endsWith(' ' + t.desc) : t.desc === want[i]?.desc) && t.credit === want[i].credit && t.debit === want[i].debit ? '' : `${i}: ${t.desc} [${t.credit}/${t.debit}]`)).filter(Boolean);
ok(!badDesc.length, 'PDF 2: fiecare operațiune cu descrierea întreagă (fără antetul băncii, fără referința de sub dată) și suma în coloana ei: ' + badDesc.join(' | '));
ok(rt.txs[0].date === '2026-09-01' && rt.txs[0].balance === TWO_LINE_OPENING - 1250 && rt.txs[rt.txs.length - 1].date === '2026-09-30', 'PDF 2: datele și soldul intermediar');
ok(rt.printed.opening === TWO_LINE_OPENING && rt.printed.credit === sum(want, 'credit') && rt.printed.debit === sum(want, 'debit'), 'PDF 2: soldul inițial și totalurile din rezumatul de sus: ' + JSON.stringify(rt.printed));
ok(!rt.warnings.some((w) => /nu se potrivește|nu dă soldul/.test(w)), 'PDF 2: fără avertisment de totaluri: ' + rt.warnings.join(' | '));
ok(rt.txs[4].category === 'Taxe și impozite' && rt.txs[1].category === 'Comisioane bancare' && rt.txs[5].category === 'Numerar', 'PDF 2: impozitul pe salarii la Taxe, comisionul, retragerea: ' + rt.txs.map((t) => t.category).join(','));
const doc2 = M.statementDoc(rt, 'Extras 2');
ok(doc2.sheets[1].cells.B1 === '2026-09' && doc2.sheets[1].cells.C1 === 'Total' && doc2.sheets[0].cells[`D${rt.txs.length + 3}`] === `=SUM(D2:D${rt.txs.length + 1})`, 'PDF 2: Rezumatul pe o lună și totalul din Extras');
// O operațiune lipsă (totalurile din rezumat rămân cele adevărate): avertismentul spune că nu se potrivesc.
const rm = M.readStatement(M.pdfToRows((await pdfWordsOf(await makeTwoLineStatementPdf({ drop: 6 }))).words));
ok(rm.txs.length === want.length - 1 && rm.warnings.some((w) => w.startsWith('Totalul încasărilor scris în extras')) && rm.warnings.some((w) => w.startsWith('Soldul inițial')), 'PDF 2 cu o operațiune lipsă: avertismentele de totaluri: ' + rm.warnings.join(' | '));

// Extrasul adevărat al utilizatorului, dacă e pe acest calculator (nu e în Git): doar numărul de operațiuni și dacă
// totalurile se potrivesc, fără nicio sumă sau descriere afișată.
// (Dosarul test-corpus e în rădăcina workspace-ului; dintr-o copie de lucru separată îl căutăm câteva dosare mai sus.)
const { existsSync, readFileSync } = await import('node:fs');
let realPath = process.env.SUITE_REAL_STATEMENT || '';
for (let up = 1, dir = process.cwd(); !realPath && up <= 5; up++) {
  dir = join(dir, '..');
  const p = join(dir, 'test-corpus', 'utilizator', 'extras-ing.pdf');
  if (existsSync(p)) realPath = p;
}
if (existsSync(realPath)) {
  const rr = M.readStatement(M.pdfToRows((await pdfWordsOf(new Uint8Array(readFileSync(realPath)))).words));
  const pc = rr.printed ?? {};
  const okC = pc.credit !== null && Math.abs(pc.credit - sum(rr.txs, 'credit')) < 0.005;
  const okD = pc.debit !== null && Math.abs(pc.debit - sum(rr.txs, 'debit')) < 0.005;
  const okB = !rr.warnings.some((w) => /nu dă soldul/.test(w));
  ok(rr.txs.length > 0 && okC && okD && okB, `extrasul real: ${rr.txs.length} operațiuni (${rr.txs.filter((t) => t.credit).length} încasări, ${rr.txs.filter((t) => t.debit).length} plăți); totaluri încasări ${okC ? 'potrivite' : 'NEPOTRIVITE'}, plăți ${okD ? 'potrivite' : 'NEPOTRIVITE'}, sold ${okB ? 'potrivit' : 'NEPOTRIVIT'}`);
} else console.log('(extrasul real lipsește: verificarea lui e sărită)');

console.log(fail ? `ESUAT (${fail})` : 'TOTUL OK');
process.exit(fail ? 1 : 0);
