// Test pentru Date → Preluare date → Din imagine: cuvintele recunoscute (cu pozițiile lor) → rânduri și coloane → foaie.
// Rulare (în suite/): node tests/sheets-picture-table.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pictable-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { boxesToRows, boxesToGrid, rowsToHtml } from './src/sheets/pictureTable.ts'; export { docTablesToBook } from './src/sheets/docTables.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { boxesToRows, boxesToGrid, rowsToHtml, docTablesToBook } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };

// Un tabel cu trei coloane, literele de 20 px; cuvintele unei celule la 8 px unul de altul, coloanele la 60 px.
const W = (text, x, y, w = text.length * 11) => ({ text, x0: x, y0: y, x1: x + w, y1: y + 20 });
const words = [
  W('Lista', 10, 0), W('produselor', 70, 2),
  W('Produs', 10, 40), W('Cantitate', 300, 41), W('Preț', 500, 39),
  W('Mere', 10, 80), W('roșii', 63, 81), W('12', 330, 80), W('3,50', 505, 82),
  W('Pere', 10, 120), W('7', 340, 119), W('4,25', 505, 121),
  W('Struguri', 10, 160), W('negri', 106, 160), W('100', 325, 161), W('12,00', 500, 160),
];
const rows = boxesToRows(words.sort(() => 0.5 - Math.random()));
check('cinci rânduri, trei coloane', rows.length === 5 && rows.every((r) => r.length === 3), JSON.stringify(rows));
check('titlul într-o singură celulă, în prima coloană', rows[0][0] === 'Lista produselor' && !rows[0][1] && !rows[0][2], JSON.stringify(rows[0]));
check('capul de tabel', rows[1].join('|') === 'Produs|Cantitate|Preț', JSON.stringify(rows[1]));
check('cuvintele apropiate sunt aceeași celulă', rows[2][0] === 'Mere roșii' && rows[4][0] === 'Struguri negri', JSON.stringify(rows));
check('numerele în coloana lor, chiar dacă sunt mai la dreapta', rows[3].join('|') === 'Pere|7|4,25' && rows[4][1] === '100', JSON.stringify(rows));

const book = docTablesToBook(rowsToHtml(rows), { layout: 'sheets', paragraphs: false });
const c = book.sheets[0].cells;
// Numerele ajung ca la tabelele din documente: scrise ca la tastare (virgula zecimală), deci numere în foaie.
check('în foaie: textul și numerele', c.A3 === 'Mere roșii' && c.B3 === '12' && c.C3 === '3,5' && c.C5 === '12', JSON.stringify(c));
check('rowsToHtml scapă < și &', rowsToHtml([['a<b & c']]) === '<table><tr><td>a&lt;b &amp; c</td></tr></table>');
check('fără cuvinte: niciun rând', boxesToRows([]).length === 0);
check('un singur cuvânt pe rând: o coloană', JSON.stringify(boxesToRows([W('Unu', 0, 0), W('Doi', 0, 40)])) === '[["Unu"],["Doi"]]');

// Celulele nesigure: un cuvânt cu încrederea sub 75 face celula lui „de verificat” (o singură dată pe celulă).
const low = words.map((w) => (w.text === '4,25' ? { ...w, conf: 41 } : w.text === 'negri' ? { ...w, conf: 60 } : w.text === 'Struguri' ? { ...w, conf: 50 } : w.text === 'Mere' ? { ...w, conf: 90 } : w));
const grid = boxesToGrid(low);
check('celulele nesigure: Pere 4,25 și Struguri negri (o dată)', JSON.stringify(grid.unsure.sort()) === JSON.stringify([[3, 2], [4, 0]]), JSON.stringify(grid.unsure));
check('fără încredere scrisă: nimic nesigur', boxesToGrid(words).unsure.length === 0);
check('un cuvânt pe rând, nesigur', JSON.stringify(boxesToGrid([W('Unu', 0, 0), { ...W('Doi', 0, 40), conf: 10 }]).unsure) === '[[1,0]]');

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);
