// Test pentru ștampile: (1) fundalul scos dintr-o „poză” de ștampilă (hârtie gri-deschis cu zgomot și lumină inegală,
// cerneală albastră) → colțurile transparente, cerneala opacă și tot albastră, tăierea pe desen;
// (2) ștampila scrisă ca adnotare /Stamp (cu aspect) și citită înapoi ca element, și pe o pagină rotită.
// Rulare (în suite/): node tests/pdf-stamp.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const entry = join(tmpdir(), `suite-stamp-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-stamp-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export * from ${src('src/pdf/stampBg.ts')};\nexport { addStampAnnot, extractStamps, hasSuiteStamps } from ${src('src/pdf/stampAnnot.ts')};\nexport { PDFDocument, PDFName, PDFArray, PDFDict, degrees } from 'pdf-lib';\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', external: ['pdfjs-dist'], nodePaths: [join(process.cwd(), 'node_modules')] });
const M = await import(pathToFileURL(out).href);
rmSync(entry, { force: true });
rmSync(out, { force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };

// (1) Poza: 240 × 160, hârtie gri-deschis (de la 196 în stânga la 232 în dreapta, umbra telefonului) cu zgomot ±12,
// cerneală albastră: un inel (raza 40–52) și o bară groasă în mijloc.
const W = 240, H = 160;
const px = new Uint8ClampedArray(W * H * 4);
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4;
  const paper = 196 + (36 * x) / W + (rnd() - 0.5) * 24;
  const d = Math.hypot(x - 120, y - 80);
  const ink = (d >= 40 && d <= 52) || (Math.abs(y - 80) < 6 && Math.abs(x - 120) < 30);
  // Pe marginea dinăuntru a inelului (un pixel) cerneala e amestecată pe jumătate cu hârtia, ca într-o poză adevărată.
  const edge = d >= 38.8 && d < 40;
  if (ink) { px[i] = 30 + rnd() * 20; px[i + 1] = 55 + rnd() * 20; px[i + 2] = 165 + rnd() * 20; }
  else if (edge) { px[i] = (paper + 40) / 2; px[i + 1] = (paper + 65) / 2; px[i + 2] = (paper - 4 + 175) / 2; }
  else { px[i] = paper; px[i + 1] = paper; px[i + 2] = paper - 4; }
  px[i + 3] = 255;
}
check(!M.hasAlpha(px), 'poza fără transparență e recunoscută (fundalul se scoate din oficiu)');
const res = M.removePaper(px, W, H, M.BG_TOL);
const a = (x, y) => res[(y * W + x) * 4 + 3];
const corners = [a(2, 2), a(W - 3, 2), a(2, H - 3), a(W - 3, H - 3)];
check(corners.every((v) => v === 0), `colțurile sunt transparente (${corners})`);
let paperLeft = 0, paperN = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (Math.hypot(x - 120, y - 80) < 60 && Math.hypot(x - 120, y - 80) > 36) continue;
  if (Math.abs(y - 80) < 10 && Math.abs(x - 120) < 34) continue;
  paperN++;
  if (a(x, y) > 0) paperLeft++;
}
check(paperLeft / paperN < 0.003, `hârtia e scoasă aproape toată, și pe partea umbrită (rămași ${paperLeft} din ${paperN} pixeli)`);
const inkPts = [[120, 34], [120, 126], [74, 80], [166, 80], [120, 80], [100, 80]];
check(inkPts.every(([x, y]) => a(x, y) === 255), 'cerneala e opacă (inelul și bara)');
check(inkPts.every(([x, y]) => { const i = (y * W + x) * 4; return res[i + 2] > 150 && res[i] < 70; }), 'cerneala rămâne albastră');
// Marginea moale: pe marginea inelului sunt și pixeli pe jumătate transparenți, fără contur alb.
let half = 0, whiteEdge = 0;
for (let i = 0; i < res.length; i += 4) {
  if (res[i + 3] > 0 && res[i + 3] < 255) { half++; if (res[i] > 200 && res[i + 1] > 200) whiteEdge++; }
}
check(half > 50 && whiteEdge === 0, `margine moale, fără contur alb pe margini (${half} pixeli pe margine, ${whiteEdge} albi)`);
const box = M.contentBox(res, W, H);
check(!!box && box.x >= 64 && box.x <= 68 && box.y >= 24 && box.y <= 28 && box.w >= 104 && box.w <= 112 && box.h >= 104 && box.h <= 112, `tăierea pe desen: ${JSON.stringify(box)}`);
// Toleranța mai mare scoate și cerneala foarte deschisă (aici: tot rămâne opacă cea albastră închisă).
const res2 = M.removePaper(px, W, H, 0.35);
check(res2[(80 * W + 100) * 4 + 3] > 200 && res2[3] === 0, 'cu toleranța mare cerneala închisă rămâne, hârtia tot dispare');
const t = new Uint8ClampedArray(px); for (let i = 3; i < t.length; i += 8) t[i] = 0;
check(M.hasAlpha(t), 'o poză cu transparență e recunoscută (nu se mai scoate fundalul din oficiu)');

// (2) Adnotarea /Stamp: scrisă, citită înapoi (text, rândul de sub, culoare, opacitate, locul), și pe o pagină rotită cu 90°.
const chunk = (ty, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(ty, 4, 'latin1'); d.copy(b, 8); b.writeUInt32BE(crc32(Buffer.concat([Buffer.from(ty, 'latin1'), d])), 8 + d.length); return b; };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0, 200, 0, 0, 255, 200, 0, 0, 255, 0, 200, 0, 0, 255, 200, 0, 0, 255]))), chunk('IEND', Buffer.alloc(0))]);
const doc = await M.PDFDocument.create();
const p1 = doc.addPage([595, 842]);
const p2 = doc.addPage([595, 842]);
p2.setRotation(M.degrees(90));
const img = await doc.embedPng(png);
const m1 = { id: 1, page: 1, x: 100, y: 120, w: 150, h: 60, kind: 'stamp', text: 'APROBAT', sub: '05.01.2026', color: '#1a237e', opacity: 0.6 };
const m2 = { id: 2, page: 2, x: 300, y: 50, w: 120, h: 40, kind: 'stamp', text: 'Ștampila firmei', img: 'data:image/png;base64,' + png.toString('base64') };
M.addStampAnnot(doc, p1, m1, img.ref);
M.addStampAnnot(doc, p2, m2, img.ref);
const bytes = await doc.save();
check(M.hasSuiteStamps(bytes), 'documentul salvat are ștampile Suite (găsite direct în octeți)');
const back = await M.PDFDocument.load(bytes);
const an = back.getPage(0).node.lookup(M.PDFName.of('Annots'), M.PDFArray).lookup(0, M.PDFDict);
check(an.get(M.PDFName.of('Subtype')) === M.PDFName.of('Stamp') && !!an.lookup(M.PDFName.of('AP'), M.PDFDict).get(M.PDFName.of('N')), 'adnotare /Stamp cu aspect (/AP /N)');
const r = an.lookup(M.PDFName.of('Rect'), M.PDFArray).asArray().map((n) => n.asNumber());
check(JSON.stringify(r) === JSON.stringify([100, 842 - 180, 250, 842 - 120]), `dreptunghiul în coordonate PDF: ${r}`);
const ex = await M.extractStamps(bytes);
check(!!ex && ex.marks.length === 2, 'citite înapoi: 2 ștampile');
const e1 = ex.marks[0], e2 = ex.marks[1];
const near = (u, v) => Math.abs(u - v) < 0.01;
check(e1.page === 1 && near(e1.x, 100) && near(e1.y, 120) && near(e1.w, 150) && near(e1.h, 60) && e1.text === 'APROBAT' && e1.sub === '05.01.2026' && e1.color === '#1a237e' && e1.opacity === 0.6,
  `prima ștampilă: ${JSON.stringify(e1)}`);
check(e2.page === 2 && near(e2.x, 300) && near(e2.y, 50) && near(e2.w, 120) && near(e2.h, 40) && e2.text === 'Ștampila firmei' && e2.img === m2.img, `ștampila din imagine, pe pagina rotită: ${JSON.stringify({ ...e2, img: e2.img?.slice(0, 30) })}`);
check(!M.hasSuiteStamps(ex.bytes), 'documentul fără ștampile nu mai are nici datele lor');
const strip = await M.PDFDocument.load(ex.bytes);
check(!strip.getPage(0).node.lookupMaybe(M.PDFName.of('Annots'), M.PDFArray)?.size(), 'ștampila a ieșit din pagină');
check(ex.bytes.length < bytes.length, `obiectele ștampilelor s-au șters (${bytes.length} → ${ex.bytes.length} octeți)`);
check((await M.extractStamps(ex.bytes)) === null, 'fără ștampile Suite: nimic de citit');

console.log(bad ? `${bad} GRESITE` : 'TOATE TREC');
process.exit(bad ? 1 : 0);
