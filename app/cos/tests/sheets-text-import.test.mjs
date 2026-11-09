// Test: Sheets, Import din text (textImport.ts) pe fișierele reale ale unui birou: separatoare ; , Tab | și lățime fixă,
// „sep=;”, codificări (UTF-8 cu / fără BOM, UTF-16 LE / BE, Windows-1250 / 1252, ISO-8859-2, sedile vechi ş ţ),
// ghilimele cu separatoare, ghilimele și rânduri noi în ele, CRLF / LF / CR, virgulă sau punct zecimal cu mii,
// date zz.ll.aaaa, coduri cu zero în față, CNP, telefoane, rânduri goale, fișier foarte lung, .txt aliniat cu spații.
// Fișierele de test se scriu și în %TEMP%/suite-textimport-files (le folosește și testul CDP).
// Rulare (în suite/): node tests/sheets-text-import.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const dir = join(tmpdir(), `suite-textimport-${process.pid}`);
await build({ entryPoints: ['src/sheets/textImport.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const T = await import(pathToFileURL(join(dir, 'textImport.js')).href);
rmSync(dir, { recursive: true, force: true });

let fail = 0, count = 0;
const ok = (c, m) => { count++; if (!c) { console.log('GREȘIT: ' + m); fail++; } else console.log('ok: ' + m); };

const TAB = String.fromCharCode(9), CR = String.fromCharCode(13), LF = String.fromCharCode(10), CRLF = CR + LF;
const utf8 = (s, bom = false) => { const b = new TextEncoder().encode(s); return bom ? Uint8Array.from([0xef, 0xbb, 0xbf, ...b]) : b; };
const utf16 = (s, le = true, bom = true) => {
  const a = bom ? (le ? [0xff, 0xfe] : [0xfe, 0xff]) : [];
  for (const ch of s) { const c = ch.charCodeAt(0); a.push(...(le ? [c & 255, c >> 8] : [c >> 8, c & 255])); }
  return Uint8Array.from(a);
};
// Codificările pe un octet: tabelul literelor de care avem nevoie (restul ASCII).
const MAPS = {
  'windows-1250': { 'ă': 0xe3, 'Ă': 0xc3, 'â': 0xe2, 'Â': 0xc2, 'î': 0xee, 'Î': 0xce, 'ş': 0xba, 'Ş': 0xaa, 'ţ': 0xfe, 'Ţ': 0xde, '€': 0x80, '„': 0x84, '”': 0x94 },
  'iso-8859-2': { 'ă': 0xe3, 'Ă': 0xc3, 'â': 0xe2, 'Â': 0xc2, 'î': 0xee, 'Î': 0xce, 'ş': 0xba, 'Ş': 0xaa, 'ţ': 0xfe, 'Ţ': 0xde },
  'windows-1252': { 'é': 0xe9, 'è': 0xe8, 'à': 0xe0, 'ç': 0xe7, 'ü': 0xfc, 'ö': 0xf6, 'ñ': 0xf1, '€': 0x80 },
};
const single = (s, enc) => Uint8Array.from([...s].map((ch) => { const c = ch.charCodeAt(0); if (c < 128) return c; const b = MAPS[enc][ch]; if (b === undefined) throw new Error(enc + ' fără ' + ch); return b; }));

const files = {};
const imp = (name, data, opts) => { files[name] = data; return T.importText(data, opts); };
const cell = (r, id) => r.cells[id];
const st = (r, id) => r.styles[id] ?? {};

// 1. Românesc clasic: „;”, virgulă zecimală, puncte la mii, date, diacritice (virgulă dedesubt), UTF-8 cu BOM, CRLF.
let r = imp('01-ro-punct-virgula.csv', utf8(['Dată;Denumire;Cantitate;Preț;Cod', '28.10.2026;Șurub țeavă;1.234;1.234,56;007', '01.02.2026;Mâner;5;12,5;0123', ''].join(CRLF), true));
ok(r.options.encoding === 'utf-8' && r.options.sep === ';' && r.options.decimal === ',' && r.options.header, 'ro: UTF-8 BOM, „;”, virgulă zecimală, cap de tabel ghicite');
ok(cell(r, 'B2') === 'Șurub țeavă' && st(r, 'A1').b, 'ro: diacriticele și capul îngroșat');
ok(st(r, 'A2').fmt === 'date' && cell(r, 'A2') === '46323', 'ro: 28.10.2026 e dată (46323): ' + cell(r, 'A2'));
ok(cell(r, 'C2') === '1234' && cell(r, 'D2') === '1234,56' && st(r, 'D2').fmt === 'number' && st(r, 'D2').dec === 2, 'ro: 1.234 și 1.234,56 sunt numere: ' + cell(r, 'C2') + ' / ' + cell(r, 'D2'));
ok(cell(r, 'D3') === '12,5', 'ro: 12,5 număr');
ok(cell(r, 'E2') === "'007" && cell(r, 'E3') === "'0123", 'ro: codurile cu zero în față rămân text');
ok(r.rows === 3 && r.cols === 5, 'ro: 3 rânduri, 5 coloane (fără rândul gol de la sfârșit)');

// 2. Internațional: „,”, punct zecimal, virgule la mii în ghilimele, LF.
r = imp('02-international-virgula.csv', utf8(['Date,Item,Amount,Total', '2026-10-28,"Bolts, steel",1,"1,234.56"', '2026-10-29,Nuts,2,12.50', ''].join(LF)));
ok(r.options.sep === ',' && r.options.decimal === '.', 'int: „,” și punct zecimal ghicite');
ok(cell(r, 'B2') === 'Bolts, steel', 'int: virgula din ghilimele rămâne în celulă');
ok(cell(r, 'D2') === '1234,56' && cell(r, 'D3') === '12,5', 'int: 1,234.56 și 12.50 numere: ' + cell(r, 'D2') + ' / ' + cell(r, 'D3'));
ok(st(r, 'A2').fmt === 'date' && cell(r, 'A2') === '46323', 'int: data ISO 2026-10-28');

// 3. Ghilimele cu „;”, ghilimele dublate și rând nou în celulă; CR singur (Mac vechi).
r = imp('03-ghilimele-cr.csv', utf8(['Nume;Notă', '"Pop; Ion";"A zis ""bună"""', '"Ana";"rândul 1' + CRLF + 'rândul 2"', 'Dan;  "spațiu înainte"  '].join(CR)));
ok(cell(r, 'A2') === 'Pop; Ion' && cell(r, 'B2') === 'A zis "bună"', 'ghilimele: „;” și ghilimele dublate în celulă');
ok(cell(r, 'B3') === 'rândul 1' + CRLF + 'rândul 2' && st(r, 'B3').wrap, 'ghilimele: rândul nou rămâne în celulă (încadrat)');
ok(cell(r, 'B4') === 'spațiu înainte', 'ghilimele: spațiile din jurul ghilimelelor nu intră');
ok(r.rows === 4, 'CR singur ca sfârșit de rând');

// 4. Tab, UTF-16 LE cu BOM (Text Unicode).
r = imp('04-text-unicode.txt', utf16(['Județ' + TAB + 'Populație', 'Iași' + TAB + '760.774', 'Constanța' + TAB + '655.997', ''].join(CRLF)));
ok(r.options.encoding === 'utf-16le' && r.options.sep === TAB, 'UTF-16 LE: codificarea și Tab ghicite');
ok(cell(r, 'A2') === 'Iași' && cell(r, 'B2') === '760774', 'UTF-16 LE: diacritice și 760.774 număr: ' + cell(r, 'B2'));
r = imp('05-utf16be.txt', utf16(['Oraș' + TAB + 'Cod', 'Brașov' + TAB + '0268'].join(CRLF), false, true));
ok(r.options.encoding === 'utf-16be' && cell(r, 'A2') === 'Brașov' && cell(r, 'B2') === "'0268", 'UTF-16 BE cu BOM');
r = imp('06-utf16-fara-bom.txt', utf16(['Oras' + TAB + 'Suma', 'Cluj' + TAB + '10,5'].join(CRLF), true, false));
ok(r.options.encoding === 'utf-16le' && cell(r, 'B2') === '10,5', 'UTF-16 LE fără BOM');

// 5. Windows-1250 cu sedile vechi (ş ţ), ISO-8859-2, Windows-1252 (Europa de Vest).
r = imp('07-win1250-sedile.csv', single(['Localitate;Sumă', 'Târgu Mureş;1.500,00', 'Ţăndărei;20,00 €', 'Piatra Neamţ;„citat”'].join(CRLF), 'windows-1250'));
ok(r.options.encoding === 'windows-1250', 'Windows-1250 ghicit: ' + r.options.encoding);
ok(cell(r, 'A2') === 'Târgu Mureş' && cell(r, 'A3') === 'Ţăndărei' && cell(r, 'B4') === '„citat”', 'Windows-1250: ş ţ â ă și ghilimelele românești');
ok(cell(r, 'B3') === '20' && st(r, 'B3').fmt === 'eur', 'Windows-1250: 20,00 € e sumă în euro');
r = imp('08-iso8859-2.csv', single(['Nume;Oraş', 'Ştefan;Bacău'].join(LF), 'iso-8859-2'));
ok(cell(r, 'A2') === 'Ştefan' && cell(r, 'B2') === 'Bacău', 'ISO-8859-2: diacriticele corecte (' + r.options.encoding + ')');
r = imp('09-win1252.csv', single(['Name;City', 'René;Zürich', 'Françoise;Málaga'.replace('á', 'à')].join(CRLF), 'windows-1252'));
ok(r.options.encoding === 'windows-1252' && cell(r, 'A2') === 'René' && cell(r, 'B2') === 'Zürich' && cell(r, 'A3') === 'Françoise', 'Windows-1252 ghicit: ' + r.options.encoding + ' ' + cell(r, 'A2'));
r = imp('10-utf8-fara-bom.csv', utf8('Țară;Capitală' + LF + 'România;București' + LF));
ok(r.options.encoding === 'utf-8' && cell(r, 'B2') === 'București', 'UTF-8 fără BOM');

// 6. „sep=,” pe primul rând, „|” și lățime fixă.
r = imp('11-sep-linie.csv', utf8(['sep=,', 'A,B', '1;2,3'].join(CRLF)));
ok(r.options.sep === ',' && r.options.start === 1 && cell(r, 'A1') === 'A' && cell(r, 'A2') === '1;2' && cell(r, 'B2') === '3', 'rândul sep=, respectat și sărit');
r = imp('12-bara.txt', utf8(['Cont|Denumire|Sold', '5121|Conturi la bănci|12.345,67', '5311|Casa în lei|250,00'].join(CRLF)));
ok(r.options.sep === '|' && cell(r, 'B2') === 'Conturi la bănci' && cell(r, 'C2') === '12345,67', '„|” ghicit');
r = imp('13-latime-fixa.prn', utf8([
  'Data        Explicatie                 Suma',
  '28.10.2026  Plata factura 123      1.234,56',
  '29.10.2026  Incasare client           50,00',
  '30.10.2026  Comision                   2,5',
].join(CRLF)));
ok(r.options.sep === 'fixed' && r.options.breaks.length === 2, 'lățime fixă ghicită: ' + JSON.stringify(r.options.breaks));
ok(cell(r, 'B2') === 'Plata factura 123' && cell(r, 'C2') === '1234,56' && cell(r, 'C3') === '50' && st(r, 'A2').fmt === 'date', 'lățime fixă: coloanele, sumele și datele');

// 7. Numere: semn în spate, paranteze, procente, lei, spațiu la mii, exponent, CNP, telefon, date americane.
r = imp('14-numere.csv', utf8(['Val;Cod;Tel', '(1.234,50);1850101123456;0722 123 456', '100-;+40722123456;12%', '1 234 567,8;RO49AAAA1B31007593840000;250 lei', '1,5E+3;0;-0,25'].join(CRLF)));
ok(cell(r, 'A2') === '-1234,5' && cell(r, 'A3') === '-100' && cell(r, 'A4') === '1234567,8' && cell(r, 'A5') === '1500', 'numere: paranteze, minus în spate, spațiu la mii, exponent: ' + [cell(r, 'A2'), cell(r, 'A3'), cell(r, 'A4'), cell(r, 'A5')].join(' '));
ok(cell(r, 'B2') === "'1850101123456" && cell(r, 'C2') === "'0722 123 456" && cell(r, 'B3') === "'+40722123456", 'CNP și telefoanele rămân text');
ok(cell(r, 'C3') === '0,12' && st(r, 'C3').fmt === 'percent' && cell(r, 'C4') === '250' && st(r, 'C4').fmt === 'lei', 'procent și lei');
ok(cell(r, 'B5') === '0' && cell(r, 'C5') === '-0,25', 'zero simplu rămâne număr; -0,25');
r = imp('15-date-us.csv', utf8(['Date,Value', '10/28/2026,1.5', '12/31/2026,2'].join(LF)));
ok(r.options.dates === 'mdy' && cell(r, 'A2') === '46323', 'datele lună/zi/an ghicite din 12/31');
r = T.importText(utf8('a;b' + LF + '05.06.2026;x'), { dates: 'mdy' });
ok(cell(r, 'A2') === String(46148), 'ordinea datelor aleasă de mână (6 mai): ' + cell(r, 'A2'));

// 8. Rânduri goale în mijloc, formule ca text, coloană omisă, coloană text, start, fără cap de tabel.
r = imp('16-goale-formule.csv', utf8(['x;y;z', '', '=1+1;@SUM(A1);5', '', '7;8;9', '', ''].join(CRLF)));
ok(r.rows === 5 && cell(r, 'A3') === "'=1+1" && cell(r, 'B3') === "'@SUM(A1)", 'rânduri goale păstrate în mijloc, formulele rămân text');
r = T.importText(utf8(['x;y;z', '1;2;3'].join(LF)), { types: ['general', 'skip', 'text'], header: true });
ok(cell(r, 'A2') === '1' && cell(r, 'B2') === "'3" && st(r, 'B2').fmt === 'text' && r.cols === 2, 'coloană omisă și coloană text');
r = T.importText(utf8(['Raport', 'generat azi', 'a;b', '1;2'].join(LF)), { start: 2 });
ok(cell(r, 'A1') === 'a' && cell(r, 'A2') === '1', 'începe de la rândul 3');
r = imp('17-fara-cap.csv', utf8(['1;2', '3;4'].join(LF)));
ok(!r.options.header && !st(r, 'A1').b && cell(r, 'A1') === '1', 'fără cap de tabel când primul rând are numere');

// 9. Ghilimea neînchisă nu înghite restul; un singur rând; fișier gol; un singur câmp.
r = imp('18-ghilimea-stricata.csv', utf8(['a;b', '"neînchis;2', '3;4', '5;6'].join(LF)));
ok(r.rows === 4 && cell(r, 'A3') === '3' && cell(r, 'A4') === '5', 'ghilimea neînchisă nu strică rândurile de după');
ok(T.importText(utf8('')).rows === 0, 'fișier gol');
r = T.importText(utf8('Ion Popescu' + LF + 'Ana Pop' + LF));
ok(cell(r, 'A1') === 'Ion Popescu' && cell(r, 'A2') === 'Ana Pop' && !cell(r, 'B1'), 'listă de nume (o coloană, fără lățime fixă)');

// 10. Fișier lung: 200.000 de rânduri × 6 coloane, repede.
{
  const lines = ['Nr;Data;Client;Cod;Suma;Obs'];
  for (let i = 1; i <= 200000; i++) lines.push(`${i};${String(1 + (i % 28)).padStart(2, '0')}.10.2026;Client ${i % 977};0${i % 9999};${(i * 1.37).toFixed(2).replace('.', ',')};"obs; ${i}"`);
  const big = utf8(lines.join(CRLF));
  files['19-lung.csv'] = big;
  const t0 = Date.now();
  r = T.importText(big);
  const ms = Date.now() - t0;
  ok(r.rows === 200001 && cell(r, 'E200001') === (200000 * 1.37).toFixed(2).replace('.', ',').replace(/,?0+$/, '') && cell(r, 'F3') === 'obs; 2' && cell(r, 'D2') === "'01", `fișier lung: 200.001 rânduri în ${ms} ms`);
  ok(ms < 20000, 'fișier lung sub 20 s');
}

// 11. .txt de deschis în Sheets: doar dacă arată ca un tabel.
ok(T.looksLikeTable(files['04-text-unicode.txt']) && T.looksLikeTable(files['12-bara.txt']), 'looksLikeTable: Text Unicode cu Tab și „|”');
ok(!T.looksLikeTable(utf8('Dragă Ion,' + CRLF + 'îți scriu; ce mai faci?' + CRLF + 'Cu bine, Ana')), 'looksLikeTable: o scrisoare nu e tabel');

// Fișierele, pentru testul CDP.
const out = join(tmpdir(), 'suite-textimport-files');
mkdirSync(out, { recursive: true });
for (const [n, d] of Object.entries(files)) writeFileSync(join(out, n), d);

console.log(`\n${count - fail} din ${count} verificări trecute` + (fail ? `, ${fail} GREȘITE` : ''));
process.exit(fail ? 1 : 0);
