// Un extras de cont PDF făcut de noi (cu pdf-lib), în forma celor publice: antetul băncii și al titularului deasupra,
// tabelul Data / Descriere / Debit / Credit / Sold cu sumele aliniate la dreapta, descrieri pe două rânduri, două pagini
// (antetul tabelului repetat, numărul paginii jos), totalul și o notă sub tabel. Folosit de bank-statement.test.mjs și cdp-sheets-extras.mjs.
import { PDFDocument, StandardFonts } from 'pdf-lib';

export async function makeStatementPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const X = { date: 40, desc: 110, debit: 400, credit: 470, sold: 550 }; // debit / credit / sold: marginea din dreapta
  const right = (pg, t, xr, y, f = font) => pg.drawText(t, { x: xr - f.widthOfTextAtSize(t, 9), y, size: 9, font: f });
  const head = (pg, y) => {
    pg.drawText('Data', { x: X.date, y, size: 9, font: bold });
    pg.drawText('Descriere', { x: X.desc, y, size: 9, font: bold });
    right(pg, 'Debit', X.debit, y, bold); right(pg, 'Credit', X.credit, y, bold); right(pg, 'Sold', X.sold, y, bold);
  };
  const ops = [
    ['01.09.2026', ['Incasare salariu', 'de la Firma Exemplu SRL'], '', '5.250,00', '6.250,00'],
    ['03.09.2026', ['Plata POS Supermarket Exemplu'], '312,45', '', '5.937,55'],
    ['10.09.2026', ['Plata OP chirie septembrie'], '1.800,00', '', '4.137,55'],
    ['15.09.2026', ['Retragere numerar ATM'], '400,00', '', '3.737,55'],
    ['22.09.2026', ['Plata factura energie electrica', 'cod client 123456'], '215,20', '', '3.522,35'],
    ['01.10.2026', ['Incasare salariu', 'de la Firma Exemplu SRL'], '', '5.250,00', '8.772,35'],
    ['02.10.2026', ['Comision administrare cont'], '10,00', '', '8.762,35'],
    ['05.10.2026', ['Plata POS farmacie'], '64,50', '', '8.697,85'],
  ];
  const pageTop = (pg, n) => {
    pg.drawText('BANCA EXEMPLU S.A.', { x: 40, y: 800, size: 12, font: bold });
    pg.drawText('Extras de cont', { x: 40, y: 784, size: 10, font });
    if (n === 1) {
      pg.drawText('Titular: Ion Popescu', { x: 40, y: 768, size: 9, font });
      pg.drawText('IBAN: RO49AAAA1B31007593840000   Moneda: RON', { x: 40, y: 756, size: 9, font });
      pg.drawText('Perioada: 01.09.2026 - 31.10.2026', { x: 40, y: 744, size: 9, font });
    }
  };
  let pg = pdf.addPage([595, 842]);
  pageTop(pg, 1);
  head(pg, 715);
  pg.drawText('Sold initial', { x: X.desc, y: 700, size: 9, font }); right(pg, '1.000,00', X.sold, 700);
  let y = 685;
  ops.forEach((o, i) => {
    if (i === 5) { // a doua pagină
      pg.drawText('Pagina 1 din 2', { x: 260, y: 30, size: 8, font });
      pg = pdf.addPage([595, 842]);
      pageTop(pg, 2);
      head(pg, 760);
      y = 745;
    }
    pg.drawText(o[0], { x: X.date, y, size: 9, font });
    o[1].forEach((t, k) => pg.drawText(t, { x: X.desc, y: y - k * 11, size: 9, font }));
    if (o[2]) right(pg, o[2], X.debit, y);
    if (o[3]) right(pg, o[3], X.credit, y);
    right(pg, o[4], X.sold, y);
    y -= 11 * o[1].length + 6;
  });
  pg.drawText('Total rulaje', { x: X.desc, y, size: 9, font: bold }); right(pg, '2.802,15', X.debit, y, bold); right(pg, '10.500,00', X.credit, y, bold);
  pg.drawText('Acest extras este generat electronic si nu necesita semnatura.', { x: 40, y: y - 30, size: 8, font });
  pg.drawText('Pagina 2 din 2', { x: 260, y: 30, size: 8, font });
  return pdf.save();
}

// Al doilea fel de extras PDF (date inventate), în forma extraselor de firmă ale unor bănci: antetul băncii pe fiecare pagină,
// dar antetul tabelului doar o dată; deasupra tabelului un mic rezumat („Data / Numar tranzactii / Suma”, cu soldul inițial
// și totalurile); antetul tabelului pe două rânduri; plățile cu minus în coloana Debitari, sumele cu punct zecimal și virgulă
// la mii; sub dată, pe al doilea rând, numărul de referință al băncii; descrieri pe multe rânduri (o referință ruptă la
// cratimă, o operațiune care trece pe pagina următoare); jos, pe fiecare pagină, o notă lată și „1 \ 3”.
export const TWO_LINE_OPENING = 10000;
export const TWO_LINE_TXS = [
  { date: '01.09.2026', debit: 1250, lines: ['Furnizor Exemplu SRL', 'RO00TEST0000000000000001', 'BANCA TEST SA', 'Transfer online', 'plata factura FX 101', 'Referinta bancii a1b2c3d4-e5f6-', '7a8b-9c0d'] },
  { date: '01.09.2026', debit: 0.5, lines: ['', 'Comision pe operatiune'] },
  { date: '03.09.2026', credit: 12500, lines: ['Client Alfa SRL', 'RO00TEST0000000000000002', 'Incasare', 'factura FA 55'] },
  { date: '05.09.2026', debit: 3000, lines: ['Ion Exemplu', 'RO00TEST0000000000000003', 'Transfer online', 'salariu august 2026'] },
  { date: '10.09.2026', debit: 1100, lines: ['Bugetul de stat/123', 'RO00TREZ0000000000000004', 'TREZORERII', 'impozit salarii'] },
  { date: '15.09.2026', debit: 2000, lines: ['1234 MAGAZIN TEST', '', 'Retragere numerar', 'Nr. Card: **** 0000', 'Data: 15-09-2026'] },
  { date: '20.09.2026', credit: 4321.09, lines: ['Client Beta SRL', 'RO00TEST0000000000000005', 'Incasare', 'avans contract 7', 'Referinta bancii 0f0e0d0c-', 'b0a0'] },
  { date: '25.09.2026', debit: 2500, lines: ['Proprietar Test', 'RO00TEST0000000000000006', 'Transfer online', 'plata chirie septembrie'] },
  { date: '28.09.2026', debit: 0.5, lines: ['', 'Comision pe operatiune'] },
  { date: '30.09.2026', credit: 105000, lines: ['Client Gama SA', 'RO00TEST0000000000000007', 'Incasare', 'factura FA 60', 'Referinta bancii 11112222-'] },
  { date: '30.09.2026', debit: 64.35, lines: ['Furnizor Delta SRL', 'RO00TEST0000000000000008', 'Transfer online', 'plata factura D 9'] },
];

export async function makeTwoLineStatementPdf({ drop = -1 } = {}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const en = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const txs = TWO_LINE_TXS.map((t) => ({ credit: 0, debit: 0, ...t }));
  const sumC = txs.reduce((a, t) => a + t.credit, 0), sumD = txs.reduce((a, t) => a + t.debit, 0);
  const T = (pg, t, x, y, size = 8) => pg.drawText(t, { x, y, size, font });
  const R = (pg, t, xr, y, size = 8) => pg.drawText(t, { x: xr - font.widthOfTextAtSize(t, size), y, size, font });
  const pages = [];
  const newPage = () => {
    const pg = pdf.addPage([595, 842]);
    T(pg, 'BANCA TEST S.A. Sucursala Exemplu,', 162, 803, 7);
    T(pg, 'Strada Exemplului nr. 1, sector 1, 010101 Bucuresti, Romania', 162, 794.6, 7);
    R(pg, 'Extras de cont', 559, 788.2, 12);
    T(pg, 'RC: J00/000/2000, CIF: RO000000', 162, 786.2, 7);
    T(pg, 'Tel: +40 21 000 00 00, www.banca-test.ro', 162, 777.8, 7);
    T(pg, 'Cod BIC: TESTROBU', 162, 769.4, 7);
    pages.push(pg);
    return pg;
  };
  let pg = newPage();
  [['Numar cont:', 'RO00TEST0000000000000099', 'Titular cont:', 'FIRMA EXEMPLU S.R.L.'], ['Nume cont:', 'Cont curent', 'CUI:', '12345678'],
    ['Valuta:', 'RON', 'Adresa:', 'Strada Test 1'], ['Data procesarii', 'din 01.09.2026 la 30.09.2026', '', '']].forEach((r, i) => {
    const y = 739.4 - 12 * i;
    T(pg, r[0], 34, y); T(pg, r[1], 114.8, y); if (r[2]) T(pg, r[2], 314.1, y); if (r[3]) T(pg, r[3], 394.9, y);
  });
  T(pg, 'Rezumat', 34, 662, 9);
  T(pg, 'Data', 34, 639.4); T(pg, 'Numar', 440.3, 639.4); R(pg, 'Suma', 564.1, 639.4); T(pg, 'tranzactii', 433.7, 627.4);
  T(pg, '01.09.2026', 34, 604.3); T(pg, 'Sold initial:', 303.3, 604.3); R(pg, en(TWO_LINE_OPENING), 564.1, 604.3);
  T(pg, 'Total creditari:', 303.3, 592.3); R(pg, String(txs.filter((t) => t.credit).length), 467.1, 592.3); R(pg, en(sumC), 564.1, 592.3);
  T(pg, 'Total debitari:', 303.3, 580.3); R(pg, String(txs.filter((t) => t.debit).length), 467.1, 580.3); R(pg, '-' + en(sumD), 564.1, 580.3);
  T(pg, 'Tranzactii', 34, 550.9, 9);
  T(pg, 'Data procesarii', 34, 528.3); T(pg, 'Beneficiar / Ordonator', 114.8, 528.3);
  T(pg, 'Referinta bancii', 34, 516.3); T(pg, 'Descrierea tranzactiei', 114.8, 516.3); T(pg, 'Debitari', 249.5, 516.3); T(pg, 'Creditari', 357.2, 516.3); R(pg, 'Sold intermediar', 564.1, 516.3);
  let y = 493.2, bal = TWO_LINE_OPENING;
  const line = () => { if (y < 80) { pg = newPage(); y = 739.4; } const v = y; y -= 12; return v; };
  txs.forEach((t, k) => {
    bal += t.credit - t.debit;
    if (k === drop) return; // operațiunea „pierdută” (totalurile rămân cele adevărate)
    const y0 = line();
    T(pg, t.date, 34, y0);
    if (t.lines[0]) T(pg, t.lines[0], 114.8, y0);
    if (t.debit) T(pg, '-' + en(t.debit), 249.5, y0); else T(pg, en(t.credit), 357.2, y0);
    R(pg, en(bal), 564.1, y0);
    t.lines.slice(1).forEach((s, i) => {
      const yi = line();
      if (i === 0) T(pg, String(5000 + k), 34, yi);
      if (s) T(pg, s, 114.8, yi);
    });
    y -= 11.5;
  });
  pages.forEach((p, i) => {
    T(p, 'Acest document a fost emis electronic. Informatii despre garantarea depozitelor sunt disponibile pe pagina bancii si in toate unitatile ei.', 28.4, 43.5, 7);
    T(p, 'www.banca-test.ro si in unitatile bancii. Valabil fara semnatura si stampila.', 28.4, 34, 7);
    R(p, `${i + 1} \\ ${pages.length}`, 566.9, 34, 7);
  });
  return pdf.save();
}
