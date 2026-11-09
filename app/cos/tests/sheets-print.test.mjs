// Test pentru tipărirea din Sheets: mărimea hârtiei (A4, A3, A5, Letter, Legal) și marginile (înguste / obișnuite / late)
// schimbă lățimea utilă, potrivirea pe pagină și se păstrează în fișier.
// Rulare (în suite/): node tests/sheets-print.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-shprint-${process.pid}.mjs`);
await build({
  stdin: { contents: "export * from './src/sheets/print.ts'; export { readXlsx, writeXlsx } from './src/sheets/xlsx.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const P = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
const mm = (px) => Math.round(px / (96 / 25.4));
check('A4 portret, margini obișnuite: 210 − 2×12 = 186 mm', mm(P.pageWidthPx(false)) === 186, mm(P.pageWidthPx(false)));
check('A3 peisaj: 420 − 24 = 396 mm', mm(P.pageWidthPx(true, 'A3')) === 396, mm(P.pageWidthPx(true, 'A3')));
check('A4, margini înguste: 210 − 12 = 198 mm', mm(P.pageWidthPx(false, 'A4', 'narrow')) === 198);
check('A4, margini late: 210 − 50 = 160 mm', mm(P.pageWidthPx(false, 'A4', 'wide')) === 160);
check('Letter peisaj: @page 279 × 216 mm', JSON.stringify(P.pageSizeMm(true, 'Letter')) === '[279,216]');
const widths = Array(12).fill(90); // 1080 px
check('pe A3 tabelul se micșorează mai puțin decât pe A4', P.fitScale(widths, false, true, 'A3') > P.fitScale(widths, false, true, 'A4'));
check('fără potrivire, pe A5 trece pe mai multe pagini decât pe A3', P.pagesAcross(widths, false, 1, 'A5') > P.pagesAcross(widths, false, 1, 'A3'));
check('fișierul păstrează hârtia și marginile', JSON.stringify(P.cleanPrint({ paper: 'Legal', margin: 'wide', fit: false })) === '{"fit":false,"paper":"Legal","margin":"wide"}', JSON.stringify(P.cleanPrint({ paper: 'Legal', margin: 'wide', fit: false })));
check('valori necunoscute se ignoră', P.cleanPrint({ paper: 'B9', margin: 'enorm' }) === undefined);
// Antet și subsol.
const d = new Date(2026, 9, 20, 9, 5);
check('câmpurile se completează', P.fillHF('Raport · [Data] [Ora] · [Fișier] / [Foaie]', 'Buget.xlsx', 'Ianuarie', d) === 'Raport · 20.10.2026 09:05 · Buget.xlsx / Ianuarie', P.fillHF('Raport · [Data] [Ora] · [Fișier] / [Foaie]', 'Buget.xlsx', 'Ianuarie', d));
let h = P.fromExcelHF('&L&"Arial,Bold"Firma SRL&C&12Raport && bilanț&R&D');
check('antet .xlsx: stânga · mijloc · dreapta, fără font/mărime', h.text === 'Firma SRL · Raport & bilanț · [Data]' && !h.numbers, JSON.stringify(h));
h = P.fromExcelHF('&CPage &P of &N');
check('subsol .xlsx „Page &P of &N” → numerotare', h.text === '' && h.numbers, JSON.stringify(h));
h = P.fromExcelHF('&L&F&RPagina &P');
check('subsol .xlsx cu fișier și pagină', h.text === '[Fișier]' && h.numbers, JSON.stringify(h));
check('textul nostru → .xlsx', P.toExcelHF('A & B · [Data]', true) === '&CA && B · &D · Pagina &P din &N', P.toExcelHF('A & B · [Data]', true));
check('fișierul păstrează antetul', JSON.stringify(P.cleanPrint({ header: 'Sus', footer: '  ', numbers: true })) === '{"header":"Sus","numbers":true}');
const sheet = { name: 'Foaia 1', cells: { A1: 'x', F30: 'y' }, styles: {}, colW: {},
  print: { landscape: true, paper: 'A3', margin: 'wide', grid: false, headings: true, header: 'Raport [Data]', footer: '[Fișier]', numbers: true, area: 'A1:F30' } };
const back = (await P.readXlsx(await P.writeXlsx([{ sheet, results: {} }]))).sheets[0].print;
check('.xlsx dus-întors: orientare, hârtie, margini, grilă, antet, subsol, numere, zonă',
  back?.landscape === true && back.headings === true && back.paper === 'A3' && back.margin === 'wide' && back.grid === false && back.header === 'Raport [Data]' && back.footer === '[Fișier]' && back.numbers === true && back.area === 'A1:F30',
  JSON.stringify(back));
const plain = (await P.readXlsx(await P.writeXlsx([{ sheet: { name: 'F', cells: { A1: '1' }, styles: {}, colW: {} }, results: {} }]))).sheets[0].print;
check('fără setări de tipărire nu apare nimic nou', plain === undefined, JSON.stringify(plain));
{
  // Sfârșiturile de pagină puse de mână: <rowBreaks> în .xlsx, citite înapoi; curățate în fișierul Suite.
  const sb = { name: 'F', cells: { A1: '1', A30: '2' }, styles: {}, colW: {}, print: { breaks: [10, 25] } };
  const bytes = await P.writeXlsx([{ sheet: sb, results: {} }]);
  const JSZip = (await import('jszip')).default;
  const xml = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
  check('.xlsx: rowBreaks cu brk id 10 și 25', xml.includes('<rowBreaks count="2" manualBreakCount="2"><brk id="10" max="16383" man="1"/><brk id="25" max="16383" man="1"/></rowBreaks>'), xml.slice(-500));
  const rb = (await P.readXlsx(bytes)).sheets[0].print;
  check('.xlsx citit înapoi: sfârșiturile de pagină', JSON.stringify(rb?.breaks) === '[10,25]', JSON.stringify(rb));
  check('curățare: rânduri greșite scoase, ordonate', JSON.stringify(P.cleanPrint({ breaks: [25, 0, 10, 10, -3, 'x', 2.5] })?.breaks) === '[10,25]', JSON.stringify(P.cleanPrint({ breaks: [25, 0, 10, 10] })));
}
{
  // Sfârșiturile de pagină pe coloane: <colBreaks> în .xlsx, citite înapoi; curățate în fișierul Suite.
  const sb = { name: 'F', cells: { A1: '1', H1: '2' }, styles: {}, colW: {}, print: { breaks: [10], colBreaks: [3, 6] } };
  const bytes = await P.writeXlsx([{ sheet: sb, results: {} }]);
  const JSZip = (await import('jszip')).default;
  const xml = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
  check('.xlsx: colBreaks după rowBreaks', xml.includes('</rowBreaks><colBreaks count="2" manualBreakCount="2"><brk id="3" max="1048575" man="1"/><brk id="6" max="1048575" man="1"/></colBreaks>'), xml.slice(-500));
  const cb = (await P.readXlsx(bytes)).sheets[0].print;
  check('.xlsx citit înapoi: pe coloane', JSON.stringify(cb?.colBreaks) === '[3,6]' && JSON.stringify(cb?.breaks) === '[10]', JSON.stringify(cb));
  check('curățare: coloane greșite scoase', JSON.stringify(P.cleanPrint({ colBreaks: [6, 0, 3, 3, 99999, 'x'] })?.colBreaks) === '[3,6]', JSON.stringify(P.cleanPrint({ colBreaks: [6, 0, 3] })));
}
check('implicit: A4, margini obișnuite', P.DEFAULT_PRINT.paper === 'A4' && P.DEFAULT_PRINT.margin === 'normal');
{
  // Rândurile repetate pe fiecare pagină: câte se repetă, curățarea și _xlnm.Print_Titles în .xlsx.
  check('implicit se repetă un rând', P.headCount(undefined, 50) === 1);
  check('3 rânduri repetate', P.headCount({ headRows: 3 }, 50) === 3);
  check('fără repetare', P.headCount({ head: false, headRows: 3 }, 50) === 0);
  check('rămâne cel puțin un rând de date', P.headCount({ headRows: 5 }, 3) === 2);
  check('curățare: headRows între 1 și 20', P.cleanPrint({ headRows: 3 })?.headRows === 3 && P.cleanPrint({ headRows: 99 }) === undefined && P.cleanPrint({ headRows: 2.5 }) === undefined);
  // Cu 3 rânduri repetate, fiecare pagină are loc pentru mai puține rânduri noi decât cu unul singur.
  const rows = Array.from({ length: 300 }, (_, i) => i);
  const one = P.autoBreaks(rows, () => 25, [100], 0, { headRows: 1 }).rows;
  const three = P.autoBreaks(rows, () => 25, [100], 0, { headRows: 3 }).rows;
  check('3 rânduri repetate: 2 rânduri noi mai puțin pe pagină', three[2] - three[1] === one[2] - one[1] - 2, JSON.stringify([one.slice(0, 3), three.slice(0, 3)]));
  const st = { name: 'Foaie cu cap', cells: { A1: 'Raport', A2: 'Nume', A3: 'x' }, styles: {}, colW: {}, print: { headRows: 2, area: 'A1:C40' } };
  const bytes = await P.writeXlsx([{ sheet: st, results: {} }]);
  const JSZip = (await import('jszip')).default;
  const wb = await (await JSZip.loadAsync(bytes)).file('xl/workbook.xml').async('string');
  check('.xlsx: _xlnm.Print_Titles $1:$2', /<definedName name="_xlnm.Print_Titles" localSheetId="0">'Foaie cu cap'!\$1:\$2<\/definedName>/.test(wb), wb.slice(wb.indexOf('<definedNames'), wb.indexOf('</definedNames>')));
  const back = (await P.readXlsx(bytes)).sheets[0].print;
  check('.xlsx citit înapoi: 2 rânduri repetate', back?.headRows === 2 && back?.head === true, JSON.stringify(back));
  const one1 = await P.writeXlsx([{ sheet: { ...st, print: { area: 'A1:C40' } }, results: {} }]);
  const wb1 = await (await JSZip.loadAsync(one1)).file('xl/workbook.xml').async('string');
  check('un singur rând: nu se scrie Print_Titles', !wb1.includes('Print_Titles'));
}
{
  // Mărimea la tipărire aleasă de mână (fără „Potrivește pe lățime”): scale="N" în .xlsx.
  check('fără potrivire, 80%', P.fitScale([2000], false, false, 'A4', 'normal', 80) === 0.8);
  check('fără potrivire, fără mărime: 100%', P.fitScale([2000], false, false, 'A4', 'normal') === 1);
  check('cu potrivire, mărimea aleasă nu contează', P.fitScale([100], false, true, 'A4', 'normal', 50) === 1);
  check('mărime greșită: 100%', P.fitScale([100], false, false, 'A4', 'normal', 5) === 1);
  check('curățare: scale 10–400, fără 100', P.cleanPrint({ scale: 150 })?.scale === 150 && P.cleanPrint({ scale: 100 }) === undefined && P.cleanPrint({ scale: 401 }) === undefined);
  check('la 200% coloanele trec pe mai multe pagini', P.pagesAcross([400], false, 2, 'A4', 'normal') > P.pagesAcross([400], false, 1, 'A4', 'normal'));
  const halfRows = P.autoBreaks(Array.from({ length: 300 }, (_, i) => i), () => 25, [100], 0, { fit: false, scale: 50 }).rows;
  const fullRows = P.autoBreaks(Array.from({ length: 300 }, (_, i) => i), () => 25, [100], 0, { fit: false }).rows;
  check('la 50% încap de două ori mai multe rânduri pe pagină', halfRows.length < fullRows.length && halfRows[1] - halfRows[0] >= 2 * (fullRows[1] - fullRows[0]) - 2, JSON.stringify([halfRows.slice(0, 2), fullRows.slice(0, 2)]));
  const ss = { name: 'S', cells: { A1: '1' }, styles: {}, colW: {}, print: { fit: false, scale: 75 } };
  const bytes = await P.writeXlsx([{ sheet: ss, results: {} }]);
  const JSZip = (await import('jszip')).default;
  const xml = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
  check('.xlsx: pageSetup scale="75", fără fitToPage', /<pageSetup [^>]*scale="75"/.test(xml) && !xml.includes('fitToPage'), xml.slice(xml.indexOf('<pageSetup'), xml.indexOf('<pageSetup') + 120));
  const back = (await P.readXlsx(bytes)).sheets[0].print;
  check('.xlsx citit înapoi: 75%, fără potrivire', back?.scale === 75 && back?.fit === false, JSON.stringify(back));
  const fitted = (await P.readXlsx(await P.writeXlsx([{ sheet: { ...ss, print: { fit: true, scale: 75 } }, results: {} }]))).sheets[0].print;
  check('cu potrivire nu se scrie mărimea', fitted?.scale === undefined, JSON.stringify(fitted));
}
{
  // Totul pe o singură pagină: micșorat și pe înălțime; în .xlsx fitToWidth="1" fitToHeight="1".
  const s1 = P.printScale([300], { onePage: true }, 3000);
  check('3000 px de rânduri pe o pagină A4: micșorat sub 40%', s1 < 0.4 && s1 >= 0.1, String(s1));
  check('fără „o singură pagină”: doar pe lățime', P.printScale([300], {}, 3000) === 1);
  check('tabel mic: nu se micșorează', P.printScale([300], { onePage: true }, 200) === 1);
  check('cel puțin 10%', P.printScale([300], { onePage: true }, 1e7) === 0.1);
  check('fără potrivire, „o singură pagină” nu contează', P.printScale([300], { fit: false, onePage: true, scale: 80 }, 3000) === 0.8);
  const rows = Array.from({ length: 120 }, (_, i) => i);
  check('Pagini: cu „o singură pagină” nu mai apar sfârșituri automate', P.autoBreaks(rows, () => 25, [300], 0, { onePage: true }).rows.length === 0 && P.autoBreaks(rows, () => 25, [300], 0, {}).rows.length > 0);
  check('curățare: onePage', P.cleanPrint({ onePage: true })?.onePage === true && P.cleanPrint({ onePage: 'da' }) === undefined);
  const so = { name: 'O', cells: { A1: '1' }, styles: {}, colW: {}, print: { onePage: true } };
  const JSZip = (await import('jszip')).default;
  const bytes = await P.writeXlsx([{ sheet: so, results: {} }]);
  const xml = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
  check('.xlsx: fitToWidth="1" fitToHeight="1"', xml.includes('fitToWidth="1" fitToHeight="1"') && xml.includes('<pageSetUpPr fitToPage="1"/>'));
  check('.xlsx citit înapoi: o singură pagină', (await P.readXlsx(bytes)).sheets[0].print?.onePage === true);
  const wide = (await P.readXlsx(await P.writeXlsx([{ sheet: { ...so, print: { fit: true } }, results: {} }]))).sheets[0].print;
  check('.xlsx doar pe lățime (fitToHeight="0"): nu e o singură pagină', !wide?.onePage, JSON.stringify(wide));
}
{
  // Coloanele repetate în stânga pe paginile alăturate (tabel mai lat decât pagina, fără potrivire pe lățime).
  const w20 = Array(20).fill(90); // pagina A4 portret are ~703 px: încap 7 coloane de 90 px
  const plain = P.colPages(w20, { fit: false }, 1);
  check('fără coloane repetate: 3 pagini alăturate (7 + 7 + 6)', JSON.stringify(plain.map((p) => p.length)) === '[7,7,6]', JSON.stringify(plain));
  const rep = P.colPages(w20, { fit: false, leftCols: 2 }, 1);
  check('cu 2 coloane repetate: pe paginile 2–4 încap doar 5 coloane noi', JSON.stringify(rep.map((p) => p.length)) === '[7,5,5,3]' && rep[1][0] === 7, JSON.stringify(rep));
  const groups = P.printColGroups(w20, { fit: false, leftCols: 2 }, 1);
  check('pagina 2 începe cu A și B, apoi H–L', JSON.stringify(groups[1]) === '[0,1,7,8,9,10,11]', JSON.stringify(groups[1]));
  check('pagina 1 nu are coloanele de două ori', JSON.stringify(groups[0]) === '[0,1,2,3,4,5,6]');
  check('tabelul încape pe o pagină: un singur grup, fără repetare', P.printColGroups(Array(5).fill(90), { fit: false, leftCols: 2 }, 1).length === 1);
  check('coloane repetate prea late (peste jumătate de pagină): nu se mai repetă', P.printColGroups([500, 300, 300, 300], { fit: false, leftCols: 1 }, 1).slice(1).every((g) => g[0] !== 0));
  check('sfârșiturile automate pe coloane țin cont de coloanele repetate', JSON.stringify(P.autoBreaks([0], () => 20, w20, 0, { fit: false, leftCols: 2 }).cols) === '[7,12,17]', JSON.stringify(P.autoBreaks([0], () => 20, w20, 0, { fit: false, leftCols: 2 }).cols));
  check('leftCount: cel mult 10 și rămâne o coloană de date', P.leftCount({ leftCols: 3 }, 20) === 3 && P.leftCount({ leftCols: 5 }, 3) === 2 && P.leftCount(undefined, 20) === 0);
  check('curățare: leftCols între 1 și 10', P.cleanPrint({ leftCols: 2 })?.leftCols === 2 && P.cleanPrint({ leftCols: 0 }) === undefined && P.cleanPrint({ leftCols: 11 }) === undefined);
  const JSZip = (await import('jszip')).default;
  const st = { name: 'Lat', cells: { A1: 'Nume', B1: 'Cod', T1: 'x' }, styles: {}, colW: {}, print: { headRows: 2, leftCols: 2, area: 'A1:T40' } };
  const bytes = await P.writeXlsx([{ sheet: st, results: {} }]);
  const wb = await (await JSZip.loadAsync(bytes)).file('xl/workbook.xml').async('string');
  check('.xlsx: _xlnm.Print_Titles cu coloanele și rândurile', wb.includes(">Lat!$A:$B,Lat!$1:$2</definedName>"), wb.slice(wb.indexOf('<definedNames'), wb.indexOf('</definedNames>')));
  const back = (await P.readXlsx(bytes)).sheets[0].print;
  check('.xlsx citit înapoi: 2 coloane și 2 rânduri repetate', back?.leftCols === 2 && back?.headRows === 2, JSON.stringify(back));
  const onlyCols = await P.writeXlsx([{ sheet: { ...st, print: { leftCols: 1 } }, results: {} }]);
  const wbc = await (await JSZip.loadAsync(onlyCols)).file('xl/workbook.xml').async('string');
  check('.xlsx: doar o coloană repetată ($A:$A)', wbc.includes(">Lat!$A:$A</definedName>"), wbc.slice(wbc.indexOf('<definedNames'), wbc.indexOf('</definedNames>')));
  check('.xlsx citit înapoi: o coloană, rândul obișnuit', (await P.readXlsx(onlyCols)).sheets[0].print?.leftCols === 1);
}
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut');
process.exit(fail ? 1 : 0);
