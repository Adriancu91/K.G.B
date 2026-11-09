// Test pentru „Pagini pe foaie” și broșură: câte foi ies, ordinea paginilor pe foaie (după textul lor), paginile rotite
// stau drept, broșura are ordinea de îndoire corectă și pagini albe la nevoie.
// Copiat din Cyber Office Studio (tests/pdf-nup.test.mjs, D-071); schimbat doar felul în care se încarcă codul.
// Rulare (în app/): node tests/nup.test.mjs
import "./ts-hooks.mjs";
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
const { nUpPdf, bookletPdf, bookletOrder } = await import('../src/modules/pdf/nup.ts');
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const J = (x) => JSON.stringify(x);

const make = async (n, rotate = {}) => {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= n; i++) {
    const p = d.addPage([595, 842]);
    p.drawText(`P${i}`, { x: 60, y: 780, size: 30, font: f });
    if (rotate[i]) p.setRotation(degrees(rotate[i]));
  }
  return d.save();
};
// Pe fiecare foaie: textele P1, P2… ordonate de sus în jos, apoi de la stânga la dreapta (rânduri de grilă).
const sheets = async (bytes) => {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), disableFontFace: true, useSystemFonts: false, standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise;
  const res = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    const items = tc.items.filter((t) => /^P\d+$/.test(t.str)).map((t) => {
      const [x, y] = vp.convertToViewportPoint(t.transform[4], t.transform[5]);
      return { s: t.str, x, y, upright: Math.abs(t.transform[1]) < 1e-6 && t.transform[0] > 0 };
    });
    items.sort((a, b) => (Math.abs(a.y - b.y) > 40 ? a.y - b.y : a.x - b.x));
    res.push({ w: Math.round(vp.width), h: Math.round(vp.height), list: items.map((t) => t.s), upright: items.every((t) => t.upright), pos: Object.fromEntries(items.map((t) => [t.s, [Math.round(t.x), Math.round(t.y)]])) });
  }
  await doc.cleanup?.(); // pdf.js 6: fără destroy() pe document
  return res;
};

const s4 = await sheets(await nUpPdf(await make(10), 4, true));
check('4 pe foaie: 10 pagini → 3 foi A4 în picioare', s4.length === 3 && s4[0].w === 595 && s4[0].h === 842, J(s4));
check('4 pe foaie: ordinea de citire', J(s4.map((s) => s.list)) === J([['P1', 'P2', 'P3', 'P4'], ['P5', 'P6', 'P7', 'P8'], ['P9', 'P10']]), J(s4));
const s2 = await sheets(await nUpPdf(await make(3), 2));
check('2 pe foaie: foaie culcată', s2.length === 2 && s2[0].w === 842 && J(s2[0].list) === J(['P1', 'P2']), J(s2));
const s9 = await sheets(await nUpPdf(await make(9), 9));
check('9 pe foaie', s9.length === 1 && J(s9[0].list) === J(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9']), J(s9));
for (const r of [90, 180, 270]) {
  const sr = await sheets(await nUpPdf(await make(2, { 2: r }), 2));
  const [x, y] = sr[0].pos.P2 ?? [-1, -1];
  check(`pagina rotită ${r}° stă în jumătatea ei de foaie`, x > 421 && x < 842 && y > 0 && y < 595, J(sr));
}
check('ordinea broșurii pentru 8 pagini', J(bookletOrder(8)) === J([[7, 0], [1, 6], [5, 2], [3, 4]]));
check('broșura pentru 5 pagini: 3 albe', J(bookletOrder(5)) === J([[-1, 0], [1, -1], [-1, 2], [3, 4]]));
const sb = await sheets(await bookletPdf(await make(8)));
check('broșura: 4 fețe culcate, P8|P1, P2|P7…', sb.length === 4 && sb[0].w === 842 && J(sb.map((s) => s.list)) === J([['P8', 'P1'], ['P2', 'P7'], ['P6', 'P3'], ['P4', 'P5']]), J(sb));
check('textul rămâne drept', s4.every((s) => s.upright) && sb.every((s) => s.upright));
let err = '';
try { await nUpPdf(await make(2), 5); } catch (e) { err = e.message; }
check('număr nepermis: mesaj clar', /2, 4, 6, 9 sau 16/.test(err));

console.log(fail ? `${fail} GREȘITE` : 'TOATE TREC');
process.exit(fail ? 1 : 0);
