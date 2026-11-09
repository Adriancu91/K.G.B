// Original: src/pdf/nup.ts din Cyber Office Studio, aplicația proprietarului (D-071, D-072), fără schimbări de logică.
// @ts-nocheck — K.G.B. verifică tablourile mai strict (noUncheckedIndexedAccess) decât proiectul de origine; testat în tests/.
// Mai multe pagini pe o foaie A4 (ca la tipărirea din Acrobat: 2, 4, 6, 9 sau 16 pe foaie, pentru economie de hârtie) și
// broșura (foi A4 culcate cu câte două pagini, în ordinea în care, tipărite față-verso și îndoite la mijloc, dau o carte mică).
// Posterul: o pagină mărită pe mai multe foi A4, cu o margine comună pentru lipit și eticheta fiecărei foi.
// Paginile se pun ca imagini vectoriale (embedPage, nu poze): textul rămâne clar și se poate căuta; paginile rotite stau drept.
import { clip, closePath, degrees, endPath, lineTo, moveTo, PDFDocument, PDFPage, popGraphicsState, pushGraphicsState, rgb, StandardFonts } from 'pdf-lib';
import { open } from './edit';

const A4: [number, number] = [595.28, 841.89];

/** Câte coloane × rânduri are foaia pentru N pagini, și dacă foaia e culcată. */
export const NUP_GRID: Record<number, { cols: number; rows: number; landscape: boolean }> = {
  2: { cols: 2, rows: 1, landscape: true },
  4: { cols: 2, rows: 2, landscape: false },
  6: { cols: 3, rows: 2, landscape: true },
  9: { cols: 3, rows: 3, landscape: false },
  16: { cols: 4, rows: 4, landscape: false },
};

/** Ordinea paginilor în broșură (de la 0; -1 = pagină albă), câte două pe fiecare față de foaie: [stânga, dreapta]. */
export function bookletOrder(count: number): [number, number][] {
  const n = Math.max(4, Math.ceil(count / 4) * 4);
  const p = (i: number) => (i < count ? i : -1);
  const out: [number, number][] = [];
  for (let i = 0; i < n / 4; i++) {
    out.push([p(n - 1 - 2 * i), p(2 * i)]); // fața foii
    out.push([p(2 * i + 1), p(n - 2 - 2 * i)]); // spatele foii
  }
  return out;
}

/** Desenează pagina `src` (cu rotirea ei) cât mai mare în dreptunghiul dat, centrată. */
async function place(doc: PDFDocument, sheet: PDFPage, src: PDFPage, x: number, y: number, w: number, h: number, frame: boolean) {
  const box = src.getCropBox();
  const [ep] = await doc.embedPages([src], [{ left: box.x, bottom: box.y, right: box.x + box.width, top: box.y + box.height }]);
  const rot = ((src.getRotation().angle % 360) + 360) % 360;
  const vw = rot % 180 ? box.height : box.width, vh = rot % 180 ? box.width : box.height;
  const s = Math.min(w / vw, h / vh);
  const dx = x + (w - vw * s) / 2, dy = y + (h - vh * s) / 2;
  // Rotirea paginii e în sensul acelor de ceasornic; drawPage rotește în jurul colțului din stânga-jos, deci mutăm înapoi.
  const off = rot === 90 ? [0, box.width * s] : rot === 180 ? [box.width * s, box.height * s] : rot === 270 ? [box.height * s, 0] : [0, 0];
  sheet.drawPage(ep, { x: dx + off[0], y: dy + off[1], xScale: s, yScale: s, rotate: degrees(-rot) });
  if (frame) sheet.drawRectangle({ x: dx, y: dy, width: vw * s, height: vh * s, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 });
}

/** Un PDF nou cu `per` pagini pe fiecare foaie A4, în ordinea de citire (stânga → dreapta, sus → jos). */
export async function nUpPdf(bytes: Uint8Array, per: number, frame = false): Promise<Uint8Array> {
  const g = NUP_GRID[per];
  if (!g) throw new Error('Se pot pune 2, 4, 6, 9 sau 16 pagini pe foaie.');
  const src = await open(bytes);
  const out = await PDFDocument.create();
  const pages = src.getPages();
  const [W, H] = g.landscape ? [A4[1], A4[0]] : A4;
  const m = 18, gap = 10;
  const cw = (W - 2 * m - gap * (g.cols - 1)) / g.cols, ch = (H - 2 * m - gap * (g.rows - 1)) / g.rows;
  for (let i = 0; i < pages.length; i += per) {
    const sheet = out.addPage([W, H]);
    for (let k = 0; k < per && i + k < pages.length; k++) {
      const c = k % g.cols, r = Math.floor(k / g.cols);
      await place(out, sheet, pages[i + k], m + c * (cw + gap), H - m - (r + 1) * ch - r * gap, cw, ch, frame);
    }
  }
  out.setCreator('Cyber Office Studio');
  return out.save();
}

/** Broșura: foi A4 culcate, două pagini pe față; se tipărește față-verso (întoarcere pe latura scurtă) și se îndoaie. */
export async function bookletPdf(bytes: Uint8Array, frame = false): Promise<Uint8Array> {
  const src = await open(bytes);
  const out = await PDFDocument.create();
  const pages = src.getPages();
  const [W, H] = [A4[1], A4[0]];
  const m = 14;
  for (const pair of bookletOrder(pages.length)) {
    const sheet = out.addPage([W, H]);
    for (let side = 0; side < 2; side++) {
      const i = pair[side];
      if (i < 0) continue;
      await place(out, sheet, pages[i], side * W / 2 + m, m, W / 2 - 2 * m, H - 2 * m, frame);
    }
  }
  out.setCreator('Cyber Office Studio');
  return out.save();
}

/** Posterul: pagina `index` (de la 0) mărită pe `cols` × `rows` foi A4, care se suprapun cu `overlap` puncte (pentru lipit).
 *  Pe fiecare foaie: bucata ei din pagină (tăiată la marginea tipăribilă), eticheta (A1, A2… = rândul și coloana) și linia de lipire. */
export async function posterPdf(bytes: Uint8Array, index: number, cols: number, rows: number, overlap = 28.35, guides = true): Promise<Uint8Array> {
  if (cols < 1 || rows < 1 || cols * rows > 64) throw new Error('Posterul se face pe cel mult 64 de foi.');
  const src = await open(bytes);
  const sp = src.getPages()[index];
  if (!sp) throw new Error('Pagina aleasă nu există.');
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const box = sp.getCropBox();
  const [ep] = await out.embedPages([sp], [{ left: box.x, bottom: box.y, right: box.x + box.width, top: box.y + box.height }]);
  const rot = ((sp.getRotation().angle % 360) + 360) % 360;
  const vw = rot % 180 ? box.height : box.width, vh = rot % 180 ? box.width : box.height;
  const m = 18;
  // Foile se culcă dacă așa pagina iese mai mare pe poster.
  const fit = (W: number, H: number) => {
    const pw = W - 2 * m, ph = H - 2 * m;
    const PW = cols * (pw - overlap) + overlap, PH = rows * (ph - overlap) + overlap;
    return { W, H, pw, ph, PW, PH, s: Math.min(PW / vw, PH / vh) };
  };
  const a = fit(A4[0], A4[1]), b = fit(A4[1], A4[0]);
  const { W, H, pw, ph, PW, PH, s } = b.s > a.s ? b : a;
  // Pagina mărită, centrată pe poster (coordonate de poster, de jos din stânga).
  const dx = (PW - vw * s) / 2, dy = (PH - vh * s) / 2;
  const off = rot === 90 ? [0, box.width * s] : rot === 180 ? [box.width * s, box.height * s] : rot === 270 ? [box.height * s, 0] : [0, 0];
  const gray = rgb(0.55, 0.55, 0.55);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * (pw - overlap), yb = PH - r * (ph - overlap) - ph;
      // Foaia nu atinge pagina (pagina e mult mai lată decât înaltă sau invers): nu se tipărește degeaba.
      if (x0 + pw <= dx + 0.5 || x0 >= dx + vw * s - 0.5 || yb + ph <= dy + 0.5 || yb >= dy + vh * s - 0.5) continue;
      const sheet = out.addPage([W, H]);
      sheet.pushOperators(pushGraphicsState(), moveTo(m, m), lineTo(W - m, m), lineTo(W - m, H - m), lineTo(m, H - m), closePath(), clip(), endPath());
      sheet.drawPage(ep, { x: m + dx - x0 + off[0], y: m + dy - yb + off[1], xScale: s, yScale: s, rotate: degrees(-rot) });
      sheet.pushOperators(popGraphicsState());
      const label = String.fromCharCode(65 + (r % 26)) + (c + 1);
      sheet.drawText(label + '   (' + (r + 1) + '/' + rows + ', ' + (c + 1) + '/' + cols + ')', { x: m, y: 6, size: 7, font, color: gray });
      if (guides && overlap > 0) {
        // Linia pe care se pune foaia vecină (stânga / sus): marginea comună rămâne sub ea, la lipit.
        if (c > 0) sheet.drawLine({ start: { x: m + overlap, y: m }, end: { x: m + overlap, y: H - m }, thickness: 0.4, color: gray, dashArray: [3, 3] });
        if (r > 0) sheet.drawLine({ start: { x: m, y: H - m - overlap }, end: { x: W - m, y: H - m - overlap }, thickness: 0.4, color: gray, dashArray: [3, 3] });
      }
    }
  }
  out.setCreator('Cyber Office Studio');
  return out.save();
}
