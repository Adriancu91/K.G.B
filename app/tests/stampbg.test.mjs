// Test pentru scoaterea fundalului din poza unei ștampile — partea (1) din testul Cyber Office Studio
// (tests/pdf-stamp.test.mjs), copiată fără schimbări (D-071): hârtie gri-deschis cu zgomot și lumină inegală,
// cerneală albastră → colțurile transparente, cerneala opacă și tot albastră, tăierea pe desen.
// Partea (2) din original (adnotarea /Stamp scrisă cu pdf-lib) e acoperită în K.G.B. de testele Rust ale modulului PDF.
// Rulare (în app/): node tests/stampbg.test.mjs   (Node 24 citește direct TypeScript-ul fără tipuri speciale)
import * as M from "../src/modules/pdf/stampBg.ts";

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

console.log(bad ? `${bad} GRESITE` : 'TOATE TREC');
process.exit(bad ? 1 : 0);
