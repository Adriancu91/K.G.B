// Test pentru Poster (o pagină mărită pe mai multe foi A4): câte foi ies, fiecare colț al paginii ajunge pe foaia lui,
// foile se suprapun, paginile rotite și cele foarte late merg, numărul de foi e limitat.
// Copiat din Cyber Office Studio (tests/pdf-poster.test.mjs, D-071); schimbat doar felul în care se încarcă codul.
// Rulare (în app/): node tests/poster.test.mjs
import "./ts-hooks.mjs";
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
const { posterPdf } = await import('../src/modules/pdf/nup.ts');
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

const make = async (w, h, rot = 0) => {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  d.addPage([200, 200]).drawText('ALTA', { x: 50, y: 100, size: 20, font: f });
  const p = d.addPage([w, h]);
  p.drawText('SS', { x: 10, y: h - 30, size: 16, font: f });
  p.drawText('SD', { x: w - 40, y: h - 30, size: 16, font: f });
  p.drawText('JS', { x: 10, y: 10, size: 16, font: f });
  p.drawText('JD', { x: w - 40, y: 10, size: 16, font: f });
  if (rot) p.setRotation(degrees(rot));
  return d.save();
};
// Pe ce foaie se vede fiecare text (originea lui e în zona tipăribilă a foii).
const where = async (bytes) => {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const res = { pages: doc.numPages, at: {}, labels: [] };
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i);
    const [, , W, H] = pg.view;
    for (const it of (await pg.getTextContent()).items) {
      const [x, y] = [it.transform[4], it.transform[5]];
      if (/^[A-Z]\d/.test(it.str)) { res.labels.push(it.str.split(' ')[0]); continue; }
      if (x >= 18 && x <= W - 18 && y >= 18 && y <= H - 18) (res.at[it.str] ??= []).push(i);
    }
  }
  return res;
};

const r1 = await where(await posterPdf(await make(595, 842), 1, 2, 2));
check('2×2 dă 4 foi', r1.pages === 4, r1.pages);
check('etichetele A1 A2 B1 B2', r1.labels.join() === 'A1,A2,B1,B2', r1.labels.join());
check('colțul stânga-sus pe foaia 1', r1.at.SS?.[0] === 1, JSON.stringify(r1.at));
check('colțul dreapta-sus pe foaia 2', r1.at.SD?.[0] === 2, JSON.stringify(r1.at));
check('colțul stânga-jos pe foaia 3', r1.at.JS?.[0] === 3, JSON.stringify(r1.at));
check('colțul dreapta-jos pe foaia 4', r1.at.JD?.[0] === 4, JSON.stringify(r1.at));
check('cealaltă pagină nu intră', !r1.at.ALTA, JSON.stringify(r1.at));

const r2 = await where(await posterPdf(await make(842, 595), 1, 3, 3));
check('3×3 pe o pagină culcată: 9 foi', r2.pages === 9, r2.pages);
check('pagina culcată: dreapta-jos pe ultima foaie', r2.at.JD?.includes(9), JSON.stringify(r2.at));

const r3 = await where(await posterPdf(await make(595, 842, 90), 1, 2, 2));
check('pagina rotită: 4 foi', r3.pages === 4, r3.pages);
// Rotită 90° în sensul acelor: colțul stânga-sus al paginii ajunge sus în dreapta.
check('pagina rotită: stânga-sus ajunge în dreapta-sus', r3.at.SS?.[0] === 2, JSON.stringify(r3.at));

// O bandă foarte lată pe 3×3: rândurile de sus și de jos nu ating pagina, deci nu se tipăresc.
const r4 = await where(await posterPdf(await make(3000, 300), 1, 3, 3));
check('banda lată: doar foile care o ating', r4.pages > 0 && r4.pages < 9, r4.pages);

let threw = false;
try { await posterPdf(await make(100, 100), 1, 9, 9); } catch { threw = true; }
check('peste 64 de foi e refuzat', threw);
threw = false;
try { await posterPdf(await make(100, 100), 5, 2, 2); } catch { threw = true; }
check('pagina care nu există e refuzată', threw);

console.log(fail ? `pdf-poster: ${fail} GREȘELI` : 'pdf-poster: toate trec');
process.exit(fail ? 1 : 0);
