// Test rapid pentru OFFSET, ROW/COLUMN/ROWS/COLUMNS, DAYS și DAYS360 (rezultatele așteptate sunt cele din Excel).
// Rulare (în suite/): node tests/formula-offset.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-formula-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const cells = {
  A1: '1', A2: '2', A3: '3', A4: '4', B1: '10', B2: '20', B3: '30', B4: '40',
  D1: '=OFFSET(A1;2;1)', D2: '=SUM(OFFSET(A1;1;0;3;2))', D3: '=SUMA(DEPLASARE(B1;0;0;COUNT(B1:B4)))',
  D4: '=ROW(B3)', D5: '=COLUMN(B3)', D6: '=ROWS(A1:B4)', D7: '=COLUMNS(OFFSET(A1;0;0;1;2))', D8: '=OFFSET(A1;-1;0)',
  D9: '=DAYS(DATE(2026;3;1);DATE(2026;2;1))',
  E1: '=DAYS360(DATE(2026;1;30);DATE(2026;2;1))', E2: '=DAYS360(DATE(2026;1;31);DATE(2026;3;31))',
  E3: '=DAYS360(DATE(2026;2;28);DATE(2026;3;31))', E4: '=DAYS360(DATE(2026;2;28);DATE(2026;3;31);ADEVĂRAT)',
  E5: '=DAYS360(DATE(2025;1;15);DATE(2026;1;15))', E6: '=INDEX(OFFSET(A1;0;1;4);2)',
};
const want = { D1: '30', D2: '99', D3: '100', D4: '3', D5: '2', D6: '4', D7: '2', D8: '#REF!', D9: '28',
  E1: '1', E2: '60', E3: '30', E4: '32', E5: '360', E6: '20' };
// INDEX pe o zonă e referință (ca în Excel): rândul 0 = coloana întreagă, coloana 0 = rândul întreg.
Object.assign(cells, { AZ1: '=COLUMN(INDEX(A1:B4;0;2))', AZ2: '=SUM(INDEX(A1:B4;0;2))', AZ3: '=SUM(INDEX(A1:B4;3;0))', AZ4: '=ROW(INDEX(A1:B4;3;1))', AZ5: '=INDEX(A1:B4;2;2)', AZ6: '=INDEX(A1:B4;5;1)', AZ7: '=COLUMN(INDEX(A1:B1;2))' });
// Zona cu un capăt calculat (A1:INDEX(...), INDEX(...):B3, B1:OFFSET(...)), ca în Excel.
Object.assign(cells, { AZ8: '=SUM(A1:INDEX(A1:A4;3))', AZ9: '=SUM(INDEX(A1:B4;2;1):B3)', AZ10: '=ROWS(A1:INDEX(A1:A4;MATCH(3;A1:A4;0)))', AZ11: '=SUM(B1:OFFSET(B1;1;0))', AZ12: '=A1:INDEX(A1:A4;1)', AZ13: '=SUM(A1:INDEX(A1:B4;4;2))', AZ14: '=SUM(A1:INDEX(A1:A4;9))', AZ15: '=ROWS(2:5)', AZ16: '=COLUMNS($3:$3)', AZ17: '=ROW(4:9)', AZ18: '=TYPE(NA())', AZ19: '=TYPE(1/0)', AZ20: '=TYPE(A1:B2)' });
// Unirea de zone: „~” din LibreOffice și (A1:A2;B4) din Excel.
Object.assign(cells, { AZ21: '=AREAS((A1:B3~B4~A4))', AZ22: '=AREAS((A1:A2;B1))', AZ23: '=SUM(A1:A2~B1)', AZ24: '=SUM((A1:A2;B4))', AZ25: '=AREAS(A1:B4)', AZ26: '=COUNT(A1~B1~A9)', AZ27: '=A1~B1', AZ28: '=COLUMNS()', AZ29: '=ROWS()' });
Object.assign(want, { AZ21: '3', AZ22: '2', AZ23: '13', AZ24: '43', AZ25: '1', AZ26: '2', AZ27: '#VALUE!', AZ28: '0', AZ29: '0' });
Object.assign(want, { AZ8: '6', AZ9: '55', AZ10: '3', AZ11: '30', AZ12: '1', AZ13: '110', AZ14: '#REF!', AZ15: '4', AZ16: '16384', AZ17: '4', AZ18: '16', AZ19: '16', AZ20: '64' });
Object.assign(want, { AZ1: '2', AZ2: '100', AZ3: '33', AZ4: '3', AZ5: '20', AZ6: '#REF!', AZ7: '2' });
// Nume definite (ca în Excel): global, al unei foi, constantă, zonă folosită în OFFSET, nume șters (#REF!), nume care se cere singur.
Object.assign(cells, { F1: '=Rata*100', F2: '=SUM(Zona)', F3: '=SUM(OFFSET(Zona;1;0;2))', F4: '=TVA', F5: '=Pierdut', F6: '=Necunoscut', F7: '=Bucla', F8: '=rata' });
Object.assign(want, { F1: '1000', F2: '10', F3: '5', F4: '0,19', F5: '#REF!', F6: '#NAME?', F7: '#CIRC!', F8: '10' });
// VLOOKUP/HLOOKUP citesc doar coloana de căutare și celula găsită: două tabele care se caută unul pe altul nu sunt o buclă.
Object.assign(cells, {
  A20: '1', B20: '100', A21: '2', B21: '=VLOOKUP(1;C20:D21;2;FALS)', C20: '1', D20: '=VLOOKUP(1;A20:B21;2;FALSE)', C21: '2', D21: '7',
  G1: '=VLOOKUP(2,5;A1:B4;2)', G2: '=HLOOKUP(20;B1:B4;3;0)', G3: '=VLOOKUP(9;A1:B4;2;FALSE)', G4: '=VLOOKUP(1;A1:B4;3;FALSE)',
  G5: '=VLOOKUP(3;Zona;1;FALSE)', G6: '=IF(ISNUMBER(F9)=TRUE();1;0)',
  H1: '=TEXT(DATE(1998;8;1);"dd-mmm-yyyy")', H2: '=TEXT(DATE(2026;10;18);"dddd, d mmmm yyyy")', H3: '=TEXT(DATE(2026;3;5);"mmmm")',
});
// Funcții matematice, statistice și financiare (valorile din Excel).
Object.assign(cells, {
  I1: '=ROUND(SIN(PI()/6);10)', I2: '=DEGREES(ACOS(0))', I3: '=LN(EXP(2))', I4: '=LOG(8;2)', I5: '=FACT(5)', I6: '=COMBIN(10;3)',
  I7: '=EVEN(1.5)', I8: '=ODD(-2)', I9: '=ROUND(STDEV(A1:A4);6)', I10: '=VARP(A1:A4)', I11: '=SUMSQ(A1:A4)', I12: '=AVEDEV(A1:A4)',
  I13: '=MODE(1;2;2;1)', I14: '=ROUND(PMT(0,05/12;60;-10000);2)', I15: '=ROUND(FV(0,06/12;10;-200;-500;1);2)', I16: '=ROUND(NPV(0,1;-10000;3000;4200;6800);2)',
  I17: '=SUMX2MY2(A1:A2;A3:A4)', I18: '=LN(0)', I19: '=GCD(24;36)', I20: '=ROUND(PV(0,08/12;240;500);2)',
});
Object.assign(want, { I1: '0,5', I2: '90', I3: '2', I4: '3', I5: '120', I6: '120', I7: '2', I8: '-3', I9: '1,290994', I10: '1,25',
  I11: '30', I12: '1', I13: '1', I14: '188,71', I15: '2581,4', I16: '1188,44', I17: '-20', I18: '#NUM!', I19: '12', I20: '-59777,15' });
Object.assign(cells, {
  J1: '=HOUR(TIME(13;45;30))', J2: '=MINUTE(0.75+1/1440)', J3: '=SECOND(TIME(1;2;3))', J4: '=CHAR(65)&CHAR(186)', J5: '=CODE("ă")',
  J6: '=ROUND(NPER(1%;-100;1000);4)', J7: '=ROUND(IRR(I21:I25);6)', J8: '=LOOKUP(3,5;A1:A4;B1:B4)', J9: '=ADDRESS(2;3)', J10: '=ADDRESS(2;3;4;ADEVĂRAT;"Foaia 2")',
  J11: '=INDIRECT("B"&2)', J12: '=SUM(INDIRECT("A1:A4"))', J13: '=ERROR.TYPE(1/0)', J14: '=AVERAGEA(A1:A4)', J15: '=INDIRECT("nimic!!")',
  I21: '-70000', I22: '12000', I23: '15000', I24: '18000', I25: '21000',
});
Object.assign(want, { J1: '13', J2: '1', J3: '3', J4: 'Aş', J5: '227', J6: '10,5886', J7: '-0,021245', J8: '30', J9: '$C$2', J10: "'Foaia 2'!C2",
  J11: '20', J12: '10', J13: '2', J14: '2,5', J15: '#REF!' });
// Funcțiile pe baze de date: K1:M5 e baza (cu titluri), O1:P3 criteriile (două rânduri = „sau”).
Object.assign(cells, {
  K1: 'Nume', L1: 'Oraș', M1: 'Suma', K2: 'Popescu', L2: 'Cluj', M2: '100', K3: 'Ionescu', L3: 'Iași', M3: '250',
  K4: 'Popa', L4: 'Cluj', M4: '40', K5: 'Marin', L5: 'Cluj', M5: '300',
  O1: 'Oraș', P1: 'Suma', O2: 'Cluj', P2: '>50', O3: 'Iași',
  K10: '=DSUM(K1:M5;"Suma";O1:P3)', K11: '=DCOUNT(K1:M5;3;O1:P2)', K12: '=DAVERAGE(K1:M5;"suma";O1:O2)', K13: '=DMAX(K1:M5;"Suma";O1:P3)',
  K14: '=DGET(K1:M5;"Nume";O1:O3)', K15: '=DCOUNTA(K1:M5;"Nume";Q1:Q2)', Q1: 'Nume', Q2: 'Pop', K16: '=DGET(K1:M5;"Oraș";Q4:Q5)', Q4: 'Nume', Q5: 'Marin',
});
Object.assign(want, { K10: '650', K11: '2', K12: '146,6666666667', K13: '300', K14: '#NUM!', K15: '2', K16: 'Cluj', K17: '10000' });
cells.K17 = '=DVARP(K1:M5;"Suma";O1:P2)';
Object.assign(want, { H1: '01-aug-1998', H2: 'duminică, 18 octombrie 2026', H3: 'martie' });
Object.assign(want, { B21: '100', D20: '100', G1: '20', G2: '#N/A', G3: '#N/A', G4: '#REF!', G5: '3', G6: '0' });
// Repartiții, regresie, date, finanțe, texte și biți (exemplele din documentația Microsoft).
const more = [
  ['=ROUND(NORM.DIST(42;40;1,5;TRUE);7)', '0,9087888'], ['=ROUND(NORMDIST(42;40;1,5;FALSE);8)', '0,10934005'],
  ['=ROUND(NORM.S.DIST(1,333333;TRUE);9)', '0,908788726'], ['=ROUND(NORM.INV(0,908789;40;1,5);6)', '42,000002'],
  ['=ROUND(NORM.S.INV(0,908789);7)', '1,3333347'], ['=ROUND(BINOM.DIST(6;10;0,5;FALSE);7)', '0,2050781'],
  ['=ROUND(POISSON.DIST(2;5;TRUE);6)', '0,124652'], ['=ROUND(POISSON(2;5;FALSE);6)', '0,084224'], ['=ROUND(EXPON.DIST(0,2;10;TRUE);8)', '0,86466472'],
  ['=SLOPE(B1:B4;A1:A4)', '10'], ['=INTERCEPT(B1:B4;A1:A4)', '0'], ['=RSQ(B1:B4;A1:A4)', '1'], ['=CORREL(A1:A4;B1:B4)', '1'], ['=FORECAST(5;B1:B4;A1:A4)', '50'],
  ['=ROUND(YEARFRAC(DATE(2012;1;1);DATE(2012;7;30));8)', '0,58055556'], ['=ROUND(YEARFRAC(DATE(2012;1;1);DATE(2012;7;30);1);8)', '0,57650273'],
  ['=ROUND(YEARFRAC(DATE(2012;1;1);DATE(2012;7;30);3);8)', '0,57808219'],
  ['=WEEKNUM(DATE(2012;3;9))', '10'], ['=WEEKNUM(DATE(2012;3;9);2)', '11'], ['=ISOWEEKNUM(DATE(2012;3;9))', '10'], ['=ISOWEEKNUM(DATE(2021;1;1))', '53'],
  ['=DATEVALUE("22.08.2008")', '39682'], ['=DATEVALUE("2008-08-22")', '39682'], ['=DATEVALUE("22-aug-2008")', '39682'], ['=TIMEVALUE("2:24 AM")', '0,1'],
  ['=ROUND(RATE(48;-200;8000);10)', '0,0077014725'], ['=ROUND(IPMT(0,1/12;1;36;8000);2)', '-66,67'], ['=ROUND(IPMT(0,1;3;3;8000);2)', '-292,45'],
  ['=ROUND(PPMT(0,1/12;1;24;2000);2)', '-75,62'], ['=ROUND(CUMIPMT(0,09/12;360;125000;13;24;0);2)', '-11135,23'], ['=ROUND(CUMPRINC(0,09/12;360;125000;13;24;0);4)', '-934,1071'],
  ['=ROUND(EFFECT(0,0525;4);6)', '0,053543'], ['=ROUND(NOMINAL(0,053543;4);8)', '0,05250032'],
  ['=ROMAN(499)', 'CDXCIX'], ['=ARABIC("mcmxii")', '1912'], ['=MROUND(10;3)', '9'], ['=MROUND(-10;-3)', '-9'], ['=MROUND(1,3;0,2)', '1,4'], ['=MROUND(5;-2)', '#NUM!'],
  ['=BASE(7;2)', '111'], ['=BASE(100;16;4)', '0064'], ['=DECIMAL("FF";16)', '255'],
  ['=BITAND(13;25)', '9'], ['=BITOR(23;10)', '31'], ['=BITXOR(5;3)', '6'], ['=BITLSHIFT(4;2)', '16'], ['=BITRSHIFT(13;2)', '3'],
  ['=ISERR(NA())', 'FALS'], ['=ISERR(1/0)', 'ADEVĂRAT'], ['=ISREF(A1)', 'ADEVĂRAT'], ['=ISREF("A1")', 'FALS'], ['=TYPE("x")', '2'], ['=TYPE(A1:B2)', '64'],
  ['=XMATCH(25;B1:B4;1)', '3'], ['=XMATCH(25;B1:B4;-1)', '2'], ['=XMATCH(30;B1:B4)', '3'], ['=XMATCH(5;B1:B4)', '#N/A'],
  ['=DOLLAR(1234,567;2)', '1.234,57 lei'], ['=CLEAN(CHAR(9)&"a")', 'a'], ['=NUMBERVALUE("2.500,27")', '2500,27'], ['=FACTDOUBLE(7)', '105'],
  ['=XOR(TRUE;FALSE)', 'ADEVĂRAT'], ['=ROUND(COT(1);6)', '0,642093'], ['=HYPERLINK("https://x.ro";"Site")', 'Site'],
];
more.forEach(([f, w], i) => { cells[`R${i + 1}`] = f; want[`R${i + 1}`] = w; });
// Zile lucrătoare (exemplele Microsoft), Paștele, rotunjiri și FIXED.
cells.T1 = '=DATE(2012;11;22)';
const more2 = [
  ['=NETWORKDAYS(DATE(2012;10;1);DATE(2013;3;1))', '110'], ['=NETWORKDAYS(DATE(2012;10;1);DATE(2013;3;1);T1)', '109'],
  ['=NETWORKDAYS(DATE(2013;3;1);DATE(2012;10;1))', '-110'], ['=NETWORKDAYS.INTL(DATE(2006;1;1);DATE(2006;2;1);7)', '24'],
  ['=NETWORKDAYS.INTL(DATE(2006;1;1);DATE(2006;2;1);"0010001")', '22'], ['=WORKDAY(DATE(2008;10;1);151)', '39933'],
  ['=WORKDAY.INTL(DATE(2012;1;1);90;11)', '41013'], ['=WORKDAY.INTL(DATE(2012;1;1);30;0)', '#NUM!'], ['=WORKDAY(DATE(2026;10;19);-1)', '46311'],
  ['=PASTE(2026)=DATE(2026;4;12)', 'ADEVĂRAT'], ['=PASTE(2025)=DATE(2025;4;20)', 'ADEVĂRAT'], ['=EASTERSUNDAY(2026)=DATE(2026;4;5)', 'ADEVĂRAT'],
  ['=WEEKSINYEAR(DATE(2020;6;1))', '53'], ['=FIXED(1234,567;1)', '1.234,6'], ['=FIXED(1234,567;-1)', '1.230'], ['=FIXED(-1234,567;-1;TRUE)', '-1230'],
  ['=CEILING.MATH(-5,5;2;-1)', '-6'], ['=CEILING.MATH(-5,5)', '-5'], ['=FLOOR.MATH(-5,5;2;-1)', '-4'], ['=FLOOR.MATH(-8,1;2)', '-10'],
  ['=CEILING.PRECISE(4,3;1)', '5'], ['=FLOOR.PRECISE(-3,2;-1)', '-4'], ['=ROUND(SQRTPI(2);9)', '2,506628275'], ['=COMBINA(4;3)', '20'],
  ['=MULTINOMIAL(2;3;4)', '1260'], ['=DOLLARDE(1,02;16)', '1,125'], ['=DOLLARFR(1,125;16)', '1,02'], ['=LENB("abc")', '3'],
];
more2.forEach(([f, w], i) => { cells[`S${i + 1}`] = f; want[`S${i + 1}`] = w; });
// Formule cu mai multe rezultate, care se varsă în celulele vecine (Excel 365), și operații pe zone.
Object.assign(cells, {
  U1: '=SEQUENCE(3)', V1: '=SEQUENCE(2;3;10;5)', U5: '=SORT(A1:A4;1;-1)', U10: '=SUM(SORT(B1:B4))',
  U11: '=SUMPRODUCT((A1:A4>2)*B1:B4)', U15: '=SUM((A1:A6>2)*B1:B6)', U12: '=SUM(A1:A4*B1:B4)', U13: '=UNIQUE(L2:L5)',
  Y1: '=FILTER(K2:K5;M2:M5>100)', Y5: '=FILTER(K2:K5;M2:M5>1000;"nimic")', Y6: '=FILTER(K2:K5;M2:M5>1000)',
  Z1: '=TRANSPOSE(A1:A3)', Z3: '=SEQUENCE(2)', Z4: 'blocat', Z6: '=SUM(U1:U3)', Z7: '=ROWS(UNIQUE(L2:L5))',
  Z9: '=SORTBY(K2:K5;M2:M5;-1)', Z14: '=SUMPRODUCT(--(L2:L5="Cluj"))', Z15: '=INDEX(SORT(B1:B4;1;-1);1)',
});
Object.assign(want, {
  U1: '1', U2: '2', U3: '3', V1: '10', W1: '15', X1: '20', V2: '25', X2: '35', U5: '4', U8: '1', U10: '100', U11: '70', U12: '300',
  U13: 'Cluj', U14: 'Iași', U15: '70', Y1: 'Ionescu', Y2: 'Marin', Y5: 'nimic', Y6: '#CALC!', Z1: '1', AA1: '2', AB1: '3', Z3: '#SPILL!',
  Z6: '6', Z7: '2', Z9: 'Marin', Z10: 'Ionescu', Z12: 'Popa', Z14: '3', Z15: '40',
});
// Informații despre celule și foi.
Object.assign(cells, { AE1: '=SHEET()', AE2: '=SHEETS()', AE3: '=CELL("address";C5)', AE4: '=CELL("row";C5)', AE5: '=CELL("type";A1)', AE6: '=CELL("type";K1)', AE7: '=CELL("type";AD1)', AE8: '=ISFORMULA(D1)', AE9: '=FORMULATEXT(D1)', AE10: '=ISFORMULA(A1)', AE11: '=CELL("contents";B2)' });
Object.assign(want, { AE1: '1', AE2: '1', AE3: '$C$5', AE4: '5', AE5: 'v', AE6: 'l', AE7: 'b', AE8: 'ADEVĂRAT', AE9: '=OFFSET(A1;2;1)', AE10: 'FALS', AE11: '20' });
// CONVERT (exemplele Microsoft și câteva uzuale).
Object.assign(cells, { AF1: '=ROUND(CONVERT(1;"lbm";"kg");7)', AF2: '=CONVERT(68;"F";"C")', AF3: '=CONVERT(2,5;"ft";"sec")', AF4: '=ROUND(CONVERT(CONVERT(100;"ft";"m");"ft";"m");6)', AF5: '=ROUND(CONVERT(1;"km";"mi");6)', AF6: '=CONVERT(1;"kWh";"J")', AF7: '=CONVERT(1;"Mibyte";"bit")', AF8: '=CONVERT(1;"km2";"m2")', AF9: '=CONVERT(1;"ha";"m2")', AF10: '=CONVERT(36;"km/h";"m/s")', AF11: '=CONVERT(0;"C";"K")', AF12: '=CONVERT(2;"l";"ml")' });
Object.assign(want, { AF1: '0,4535924', AF2: '20', AF3: '#N/A', AF4: '9,290304', AF5: '0,621371', AF6: '3600000', AF7: '8388608', AF8: '1000000', AF9: '10000', AF10: '10', AF11: '273,15', AF12: '2000' });
// Repartiții, teste statistice, percentile și ranguri (exemplele din documentația Microsoft).
const put = (col, vals) => vals.forEach((v, i) => { cells[`${col}${i + 1}`] = `=${v}`; });
put('BA', [3, 6, 7, 8, 6, 5, 4, 2, 1, 9]); put('BB', [3, 4, 5, 8, 9, 1, 2, 4, 5]); put('BC', [6, 19, 3, 2, 14, 4, 5, 17, 1]);
put('BD', [6, 7, 9, 15, 21]); put('BE', [20, 28, 31, 38, 40]); put('BF', [58, 11, 10]); put('BG', [35, 25, 23]);
put('BH', [45.35, 17.56, 16.09]); put('BI', [47.65, 18.44, 16.91]); put('BJ', [1, 2, 4, 7, 8, 9, 10, 12]);
put('BK', [1, 2, 3, 6, 6, 6, 7, 8, 9]); put('BL', [13, 12, 11, 8, 4, 3, 2, 1, 1, 1]); put('BM', [89, 88, 92, 101, 94, 97, 95]);
put('BN', [3, 4, 5, 2, 3, 4, 5, 6, 4, 7]); put('BO', [4, 5, 8, 7, 11, 4, 3]); put('BP', [4, 5, 6, 7, 2, 3, 4, 5, 1, 2, 3]);
put('BQ', [3, 2, 4, 5, 6]); put('BR', [9, 7, 12, 15, 17]); put('BS', [2, 3, 9, 1, 8, 7, 5]); put('BT', [6, 5, 11, 7, 5, 4, 4]);
put('BU', [0, 1, 2, 3]); put('BV', [0.2, 0.3, 0.1, 0.4]); put('BW', [7, 3.5, 3.5, 1, 2]);
const stat = {
  '=ROUND(GAMMA(2,5);9)': '1,329340388', '=ROUND(GAMMALN(4);9)': '1,791759469', '=GAMMA(-1)': '#NUM!', '=ROUND(GAMMA(-0,75);6)': '-4,834147',
  '=ROUND(GAMMA.DIST(10,00001131;9;2;FALSE);6)': '0,032639', '=ROUND(GAMMA.DIST(10,00001131;9;2;TRUE);6)': '0,068094',
  '=ROUND(GAMMA.INV(0,068094;9;2);5)': '10,00001', '=ROUND(CHISQ.DIST(0,5;1;TRUE);8)': '0,52049988', '=ROUND(CHISQ.DIST(2;3;FALSE);8)': '0,20755375',
  '=ROUND(CHISQ.DIST.RT(18,307;10);7)': '0,0500006', '=ROUND(CHISQ.INV(0,93;1);9)': '3,283020287', '=ROUND(CHISQ.INV(0,6;2);9)': '1,832581464',
  '=ROUND(CHISQ.INV.RT(0,050001;10);8)': '18,30697346', '=ROUND(CHIDIST(18,307;10);7)': '0,0500006',
  '=ROUND(BETA.DIST(2;8;10;TRUE;1;3);7)': '0,6854706', '=ROUND(BETA.DIST(2;8;10;FALSE;1;3);7)': '1,4837646', '=ROUND(BETA.INV(0,685470581;8;10;1;3);6)': '2',
  '=ROUND(F.DIST(15,2069;6;4;TRUE);6)': '0,99', '=ROUND(F.DIST(15,2069;6;4;FALSE);7)': '0,0012238', '=ROUND(F.DIST.RT(15,2068649;6;4);6)': '0,01',
  '=ROUND(F.INV(0,01;6;4);8)': '0,10930991', '=ROUND(F.INV.RT(0,01;6;4);5)': '15,20686', '=ROUND(FINV(0,01;6;4);5)': '15,20686',
  '=ROUND(T.DIST(60;1;TRUE);8)': '0,99469533', '=ROUND(T.DIST(8;3;FALSE);8)': '0,00073691', '=ROUND(T.DIST.2T(1,959999998;60);8)': '0,05464493',
  '=ROUND(T.DIST.RT(1,959999998;60);7)': '0,0273225', '=ROUND(T.INV(0,75;2);7)': '0,8164966', '=ROUND(T.INV.2T(0,546449;60);6)': '0,606533',
  '=ROUND(TDIST(1,959999998;60;2);8)': '0,05464493', '=ROUND(TINV(0,546449;60);6)': '0,606533',
  '=ROUND(HYPGEOM.DIST(1;4;8;20;TRUE);4)': '0,4654', '=ROUND(HYPGEOM.DIST(1;4;8;20;FALSE);4)': '0,3633',
  '=ROUND(NEGBINOM.DIST(10;5;0,25;TRUE);7)': '0,3135141', '=ROUND(NEGBINOM.DIST(10;5;0,25;FALSE);7)': '0,0550487',
  '=ROUND(WEIBULL.DIST(105;20;100;TRUE);6)': '0,929581', '=ROUND(WEIBULL.DIST(105;20;100;FALSE);6)': '0,035589',
  '=ROUND(LOGNORM.DIST(4;3,5;1,2;TRUE);7)': '0,0390836', '=ROUND(LOGNORM.DIST(4;3,5;1,2;FALSE);7)': '0,0176176', '=ROUND(LOGNORM.INV(0,039084;3,5;1,2);6)': '4,000025',
  '=ROUND(FISHER(0,75);7)': '0,9729551', '=ROUND(FISHERINV(0,972955);4)': '0,75',
  '=ROUND(CONFIDENCE.NORM(0,05;2,5;50);6)': '0,692952', '=ROUND(CONFIDENCE.T(0,05;1;50);9)': '0,284196855',
  '=ROUND(Z.TEST(BA1:BA10;4);6)': '0,090574', '=ROUND(T.TEST(BB1:BB9;BC1:BC9;2;1);6)': '0,196016', '=ROUND(F.TEST(BD1:BD5;BE1:BE5);8)': '0,64831785',
  '=ROUND(CHISQ.TEST(BF1:BG3;BH1:BI3);7)': '0,0003082',
  '=QUARTILE(BJ1:BJ8;1)': '3,5', '=PERCENTILE.EXC(BK1:BK9;0,25)': '2,5', '=PERCENTRANK.INC(BL1:BL10;2)': '0,333',
  '=PERCENTRANK.EXC(BK1:BK9;7)': '0,7', '=RANK.EQ(BW1;BW1:BW5;1)': '5', '=RANK.AVG(94;BM1:BM7)': '4', '=RANK(3,5;BW1:BW5;1)': '3',
  '=ROUND(SKEW(BN1:BN10);6)': '0,359543', '=ROUND(SKEW.P(BN1:BN10);6)': '0,303193', '=ROUND(KURT(BN1:BN10);6)': '-0,1518',
  '=ROUND(GEOMEAN(BO1:BO7);6)': '5,476987', '=ROUND(HARMEAN(BO1:BO7);6)': '5,028376', '=ROUND(TRIMMEAN(BP1:BP11;0,2);6)': '3,777778',
  '=COVAR(BQ1:BQ5;BR1:BR5)': '5,2', '=ROUND(STEYX(BS1:BS7;BT1:BT7);6)': '3,305719', '=PROB(BU1:BU4;BV1:BV4;2)': '0,1', '=PROB(BU1:BU4;BV1:BV4;1;3)': '0,8',
};
// Amortizare, finanțe, statistică „A”, conversii între baze (exemplele Microsoft).
put('BX', [-120000, 39000, 30000, 21000, 37000, 46000]); put('BY', [-10000, 2750, 4250, 3250, 2750]);
put('BZ', ['DATE(2008;1;1)', 'DATE(2008;3;1)', 'DATE(2008;10;30)', 'DATE(2009;2;15)', 'DATE(2009;4;1)']);
put('CB', [0.09, 0.11, 0.1]); put('CC', [1, -1 / 2, '1/24', '-1/720']); put('CD', [79, 85, 78, 85, 50, 81, 95, 88, 97]); put('CE', [70, 79, 89]);
put('CF', [1, 2, 3, 4, 3, 2, 1, 2, 3, 5, 6, 1]); put('CG', [1345, 1301, 1368, 1322, 1310, 1370, 1318, 1350, 1303, 1299]);
Object.assign(stat, {
  '=SLN(30000;7500;10)': '2250', '=ROUND(SYD(30000;7500;10;1);2)': '4090,91', '=ROUND(SYD(30000;7500;10;10);2)': '409,09',
  '=ROUND(DB(1000000;100000;6;1;7);2)': '186083,33', '=ROUND(DB(1000000;100000;6;2;7);2)': '259639,42', '=ROUND(DB(1000000;100000;6;7;7);2)': '15845,1',
  '=ROUND(DDB(2400;300;10*365;1);2)': '1,32', '=ROUND(DDB(2400;300;120;1;2);2)': '40', '=DDB(2400;300;10;1;2)': '480',
  '=ROUND(DDB(2400;300;10;2;1,5);2)': '306', '=ROUND(DDB(2400;300;10;10);2)': '22,12',
  '=ROUND(VDB(2400;300;10*365;0;1);2)': '1,32', '=ROUND(VDB(2400;300;120;0;1);2)': '40', '=ROUND(VDB(2400;300;10;0;1);2)': '480',
  '=ROUND(VDB(2400;300;120;6;18);2)': '396,31', '=ROUND(VDB(2400;300;120;6;18;1,5);2)': '311,81', '=ROUND(VDB(2400;300;10;0;0,875;1,5);2)': '315',
  '=ROUND(MIRR(BX1:BX6;0,1;0,12);6)': '0,126094', '=ROUND(XNPV(0,09;BY1:BY5;BZ1:BZ5);2)': '2086,65', '=ROUND(XIRR(BY1:BY5;BZ1:BZ5);8)': '0,37336253',
  '=ROUND(FVSCHEDULE(1;CB1:CB3);5)': '1,33089', '=ROUND(PDURATION(2,5%;2000;2200);2)': '3,86', '=ROUND(RRI(96;10000;11000);7)': '0,0009933',
  '=ROUND(ISPMT(0,1/12;1;36;8000000);2)': '-64814,81', '=BINOM.INV(6;0,5;0,75)': '4', '=ROUND(BINOM.DIST.RANGE(60;0,75;48);9)': '0,083974967',
  '=ROUND(BINOM.DIST.RANGE(60;0,75;45;50);9)': '0,523629793', '=ROUND(SERIESSUM(PI()/4;0;2;CC1:CC4);6)': '0,707103',
  '=HEX2DEC("FFFFFFFF5B")': '-165', '=DEC2BIN(9;4)': '1001', '=DEC2BIN(-100)': '1110011100', '=OCT2DEC("7777777533")': '-165',
  '=BIN2HEX(11111011;4)': '00FB', '=DEC2HEX(-54)': 'FFFFFFFFCA', '=HEX2BIN("F";8)': '00001111', '=DEC2OCT(58;3)': '072', '=DEC2BIN(512)': '#NUM!',
  '=ROUND(VARA(CG1:CG10);4)': '754,2667', '=ROUND(VARPA(CG1:CG10);2)': '678,84', '=ROUND(STDEVA(CG1:CG10);5)': '27,46392', '=ROUND(STDEVPA(CG1:CG10);5)': '26,05456',
  '=ROT13("Abc")': 'Nop', '=UNICODE(JIS("A"))': '65313', '=ASC(JIS("Ab 1"))': 'Ab 1', '=MODE.SNGL(CF1:CF12)': '1',
  '=MONTHS(DATE(2026;1;31);DATE(2026;3;1);0)': '1', '=MONTHS(DATE(2026;1;31);DATE(2026;3;1);1)': '2', '=YEARS(DATE(2020;5;10);DATE(2026;5;9);0)': '5',
  '=WEEKS(DATE(2026;10;18);DATE(2026;10;19);1)': '1', '=WEEKS(DATE(2026;10;18);DATE(2026;10;19);0)': '0',
});
// Obligațiuni, titluri de stat, amortizarea franceză (exemplele Microsoft).
const D = (y, m, d) => `DATE(${y};${m};${d})`;
const S1 = `${D(2011, 1, 25)};${D(2011, 11, 15)};2;1`;
Object.assign(stat, {
  [`=COUPDAYBS(${S1})`]: '71', [`=COUPDAYS(${S1})`]: '181', [`=COUPDAYSNC(${S1})`]: '110', [`=COUPNCD(${S1})`]: '40678',
  [`=COUPPCD(${S1})`]: '40497', [`=COUPNUM(${D(2007, 1, 25)};${D(2008, 11, 15)};2;1)`]: '4',
  [`=ROUND(PRICE(${D(2008, 2, 15)};${D(2017, 11, 15)};0,0575;0,065;100;2;0);5)`]: '94,63436',
  [`=ROUND(YIELD(${D(2008, 2, 15)};${D(2016, 11, 15)};0,0575;95,04287;100;2;0);6)`]: '0,065',
  [`=ROUND(DURATION(${D(2018, 7, 1)};${D(2048, 1, 1)};0,08;0,09;2;1);7)`]: '10,9191453',
  [`=ROUND(MDURATION(${D(2008, 1, 1)};${D(2016, 1, 1)};0,08;0,09;2;1);5)`]: '5,73567',
  [`=ROUND(ACCRINT(${D(2008, 3, 1)};${D(2008, 8, 31)};${D(2008, 5, 1)};0,1;1000;2;0);6)`]: '16,666667',
  [`=ROUND(ACCRINTM(${D(2008, 4, 1)};${D(2008, 6, 15)};0,1;1000;3);8)`]: '20,54794521',
  [`=ROUND(DISC(${D(2007, 1, 25)};${D(2007, 6, 15)};97,975;100;1);9)`]: '0,052420213',
  [`=ROUND(INTRATE(${D(2008, 2, 15)};${D(2008, 5, 15)};1000000;1014420;2);5)`]: '0,05768',
  [`=ROUND(RECEIVED(${D(2008, 2, 15)};${D(2008, 5, 15)};1000000;0,0575;2);3)`]: '1014584,654',
  [`=ROUND(PRICEDISC(${D(2008, 2, 16)};${D(2008, 3, 1)};0,0525;100;2);8)`]: '99,79583333',
  [`=ROUND(YIELDDISC(${D(2008, 2, 16)};${D(2008, 3, 1)};99,795;100;2);6)`]: '0,052823',
  [`=ROUND(PRICEMAT(${D(2008, 2, 15)};${D(2008, 4, 13)};${D(2007, 11, 11)};0,061;0,061;0);8)`]: '99,98449888',
  [`=ROUND(YIELDMAT(${D(2008, 3, 15)};${D(2008, 11, 3)};${D(2007, 11, 8)};0,0625;100,0123;0);6)`]: '0,060954',
  [`=TBILLPRICE(${D(2008, 3, 31)};${D(2008, 6, 1)};0,09)`]: '98,45', [`=ROUND(TBILLYIELD(${D(2008, 3, 31)};${D(2008, 6, 1)};98,45);6)`]: '0,091417',
  [`=ROUND(TBILLEQ(${D(2008, 3, 31)};${D(2008, 6, 1)};0,0914);6)`]: '0,094151',
  [`=ROUND(ODDLPRICE(${D(2008, 2, 7)};${D(2008, 6, 15)};${D(2007, 10, 15)};0,0375;0,0405;100;2;0);8)`]: '99,87828601',
  [`=ROUND(ODDLYIELD(${D(2008, 4, 20)};${D(2008, 6, 15)};${D(2007, 12, 24)};0,0375;99,875;100;2;0);6)`]: '0,045192',
  [`=AMORLINC(2400;${D(2008, 8, 19)};${D(2008, 12, 31)};300;1;0,15;1)`]: '360',
  [`=AMORDEGRC(2400;${D(2008, 8, 19)};${D(2008, 12, 31)};300;1;0,15;1)`]: '776',
  '=ROUND(EUROCONVERT(1;"FRF";"DEM";TRUE);4)': '0,2982', '=EUROCONVERT(100;"DEM";"EUR")': '51,13', '=EUROCONVERT(1;"EUR";"ITL")': '1936',
});
// Date și ore scrise ca text, CEILING/FLOOR cu pas negativ, R1C1 în INDIRECT, CONVERT cu monede euro.
Object.assign(stat, {
  '=DAY("2014-4-21")': '21', '=MONTH("18.10.2026")': '10', '=DATEDIF("1974-04-17";"2012-06-13";"y")': '38', '=HOUR("17:20:00")': '17', '=DATEDIF("1974-04-17";"2012-06-13";"ym")': '1', '=DATEDIF("1974-04-17";"2012-06-13";"md")': '27', '=DATEDIF("1974-04-17";"2012-06-13";"yd")': '57',
  '=ROUND(TIMEVALUE("4PM");10)': '0,6666666667', '=TIMEVALUE("12PM")': '0,5', '=WEEKDAY("1996-07-24";2)': '3', '=ISOWEEKNUM("1995-01-01";1)': '52',
  '=DAYS("1990-10-10";"1980-10-10")': '3652', '=YEARFRAC("2008-01-01";"2008-07-01";0)': '0,5', '=ROUND(("2026-10-18 18:00"-"2026-10-18")*24;6)': '18',
  '=CEILING(-11;-2)': '-12', '=CEILING(-2,5;2)': '-2', '=FLOOR(-11;-2)': '-10', '=FLOOR(-2,5;2)': '-4', '=CEILING(2,5;-2)': '#NUM!',
  '=CEILING(-11;-2;0)': '-10', '=CEILING(-11;-2;1)': '-12', '=FLOOR(-11;-2;0)': '-12', '=FLOOR(-11;-2;1)': '-10', '=CEILING(43/10)': '5',
  '=INDIRECT("R2C1";0)': '2', '=SUM(INDIRECT("R1C2:R4C2";FALSE))': '100', '=ROUND(CONVERT(100;"ATS";"EUR");4)': '7,2673', '=IF(TRUE())': 'ADEVĂRAT',
  '="abc"+1': '#VALUE!',
});
// Constante matrice: românește („;” între coloane, „|” între rânduri) și ca în Excel în engleză („,” și „;”).
Object.assign(stat, {
  '=SUM({1;2;3})': '6', '=SUM({1,5;2,5})': '4', '=SUM({1,2,3})': '6', '=SUM({1;2|3;4})': '10', '=ROWS({1;2|3;4})': '2', '=COLUMNS({1;2;3|4;5;6})': '3',
  '=INDEX({10;20;30|40;50;60};2;3)': '60', '=VLOOKUP("b";{"a";1|"b";2};2;FALS)': '2', '=FVSCHEDULE(1000,{0.03,0.04,0.05})': '1124,76',
  '=SUMPRODUCT({1;2;3};{4;5;6})': '32', '=AND({TRUE;FALSE})': 'FALS', '=MAX({-1;-5;-2})': '-1', '=SUM({1;"x";3})': '4', '=COUNT({1;"x";3})': '2',
});
// Numere complexe (exemplele Microsoft, cu virgulă zecimală).
Object.assign(stat, {
  '=IMABS("5+12i")': '13', '=IMREAL("6-9i")': '6', '=IMAGINARY("3+4i")': '4', '=IMAGINARY("0-j")': '-1', '=ROUND(IMARGUMENT("3+4i");8)': '0,92729522',
  '=IMCONJUGATE("3+4i")': '3-4i', '=IMSUM("3+4i";"5-3i")': '8+i', '=IMSUB("13+4i";"5+3i")': '8+i', '=IMPRODUCT("3+4i";"5-3i")': '27+11i',
  '=IMDIV("-238+240i";"10+24i")': '5+12i', '=IMSQRT("1+i")': '1,09868411346781+0,455089860562227i', '=COMPLEX(3;4)': '3+4i', '=COMPLEX(0;1)': 'i',
  '=COMPLEX(3;4;"j")': '3+4j', '=IMEXP("1+i")': '1,46869393991589+2,28735528717884i', '=IMLN("3+4i")': '1,6094379124341+0,927295218001612i',
  '=IMREAL("abc")': '#NUM!', '=IMABS(-7)': '7', '=IMPOWER("2+3i";2)': '-5+12i',
});
Object.assign(cells, { CJ5: '=ROW()', CK7: '=COLUMN()', CL3: '=INDIRECT("R[-1]C[-88]";0)' });
Object.assign(want, { CJ5: '5', CK7: '89', CL3: '20' });
// FREQUENCY și MODE.MULT se varsă în jos.
Object.assign(cells, { CH1: '=FREQUENCY(CD1:CD9;CE1:CE3)', CI1: '=MODE.MULT(CF1:CF12)' });
Object.assign(want, { CH1: '1', CH2: '2', CH3: '4', CH4: '2', CI1: '1', CI2: '2', CI3: '3' });
// GETPIVOTDATA: datele sursă în DA1:DC8, pivotul (sumă) ocupă DE1:DG10, al doilea (medie) DH1:DH3.
[['type', 'fruits', 'quantity'], ['A', 'apple', '1'], ['A', 'plum', '4'], ['A', 'plum', '5'], ['B', 'apple', '4'], ['B', 'pear', '2'],
  ['C', 'plum', '3'], ['C', 'pear', '5']].forEach((row, i) => row.forEach((v, j) => { cells['D' + 'ABC'[j] + (i + 1)] = v; }));
Object.assign(cells, {
  DJ1: '=GETPIVOTDATA("quantity";DE1)', DJ2: '=GETPIVOTDATA("quantity";DF3;"fruits";"apple")', DJ3: '=GETPIVOTDATA(DE1;"fruits[plum]")',
  DJ4: '=GETPIVOTDATA(DE1;"fruits[pluM] type[A]")', DJ5: '=GETPIVOTDATA("quantity";DE1;"type";"c";"fruits";"pLum")',
  DJ6: '=GETPIVOTDATA("Sum of quantity";DE1;"type";"B")', DJ7: '=GETPIVOTDATA(DE1;"pear")', DJ8: '=GETPIVOTDATA("quantity";DE1;"fruits";"melon")',
  DJ9: '=GETPIVOTDATA("quantity";DF20)', DJ10: '=GETPIVOTDATA("quantity";DE1;"price";"x")', DJ11: '=GETPIVOTDATA("quantity";DH2;"fruits";"plum")',
  DJ12: '=GETPIVOTDATA("Sum - quantity";DE1;"type";"A")', DJ13: '=GETPIVOTDATA("cantitate";DE1)',
});
Object.assign(want, { DJ1: '24', DJ2: '5', DJ3: '12', DJ4: '9', DJ5: '3', DJ6: '6', DJ7: '7', DJ8: '#REF!', DJ9: '#REF!', DJ10: '#REF!', DJ11: '4',
  DJ12: '10', DJ13: '#REF!' });
const pivots = [
  { sheet: 'Foaia 1', target: 'DE1:DG10', source: '$DA$1:$DC$8', rows: ['type', 'fruits'], cols: [], data: [{ field: 'quantity', fn: 'sum' }] },
  { sheet: 'foaia 1', target: 'DH1:DH3', source: 'DA1:DC8', rows: ['fruits'], cols: [], data: [{ field: 'quantity', fn: 'average' }] },
];
Object.entries(stat).forEach(([f, w], i) => { cells[`CA${i + 1}`] = f; want[`CA${i + 1}`] = w; });
const names = [
  { name: 'Rata', ref: "'Foaia 1'!$B$1" }, { name: 'Rata', ref: 'Foaia1!$B$2', sheet: 'Altă foaie' },
  { name: 'Zona', ref: '$A$1:$A$4' }, { name: 'TVA', ref: '0.19' }, { name: 'Pierdut', ref: '#REF!$E$55' }, { name: 'Bucla', ref: 'Bucla+1' },
];
const book = { self: 'Foaia 1', sheets: [{ name: 'Foaia 1', cells: {} }], names, pivots };
const res = evaluateAll(cells, book);
let bad = 0;
for (const [id, w] of Object.entries(want)) {
  const got = res[id]?.text;
  if (got !== w) { bad++; console.log(`GREȘIT ${id} ${cells[id]}: ${got} (trebuia ${w})`); }
}
console.log(bad ? `${bad} greșite` : `toate ${Object.keys(want).length} corecte`);
process.exit(bad ? 1 : 0);
