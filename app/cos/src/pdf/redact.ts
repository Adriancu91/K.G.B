// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Redactarea: acoperă definitiv date personale (CNP, adrese, sume). Nu e doar un dreptunghi negru pus deasupra:
// întâi se scot literele de sub zone din conținutul paginii (redactKeep.ts), iar restul paginii rămâne text care se caută
// și se copiază, iar comentariile și câmpurile de formular peste zone se scot cu tot cu valori; apoi se verifică cu pdf.js
// că sub zone nu se mai citește nimic. Când asta nu e sigur (imagini, forme încorporate sau desene sub zonă, pagină rotită, fonturi necunoscute), pagina se desenează ca imagine (cu pdf.js), cu
// negru peste zonele alese, și înlocuiește pagina veche: textul, pozele și câmpurile ei se scot de tot din fișier.
import * as pdfjs from 'pdfjs-dist';
import { degrees, PDFArray, PDFDocument, PDFImage, PDFName, PDFRef, rgb } from 'pdf-lib';
import { open } from './edit';
import { Mark, paintRedactLabel, REDACT_COLOR, stampMarks, toPdfPoint } from './sign';
import { defuse } from './guard';
import { dropAnnotsIn, dropFields, dropUnreachable, redactKeepText } from './redactKeep';

export { dropUnreachable };
import type { Box } from './textRemove';

/** Rezoluția paginilor redactate: destul de clară pentru tipărire, fără fișiere uriașe. */
const DPI = 200;

/** Scrie în PDF toate elementele: întâi cele obișnuite (text, semnătură…), apoi redactările, la urmă decupările. */
export async function applyMarks(bytes: Uint8Array, marks: Mark[]): Promise<Uint8Array> {
  const boxes = marks.filter((m) => m.kind === 'redact');
  const crops = marks.filter((m) => m.kind === 'crop');
  const rest = marks.filter((m) => m.kind !== 'redact' && m.kind !== 'crop');
  let out = rest.length ? await stampMarks(bytes, rest) : bytes;
  if (boxes.length) out = await redact(out, boxes);
  return crops.length ? cropPages(out, crops) : out;
}

/** Decupează paginile: rămâne vizibilă doar zona trasă (pe o pagină, ultima decupare contează). */
export async function cropPages(bytes: Uint8Array, crops: Mark[]): Promise<Uint8Array> {
  const doc = await open(bytes);
  for (const c of crops) {
    if (c.page < 1 || c.page > doc.getPageCount() || c.w < 5 || c.h < 5) continue;
    const page = doc.getPage(c.page - 1);
    const rot = ((page.getRotation().angle % 360) + 360) % 360;
    const box = page.getCropBox();
    const [ax, ay] = toPdfPoint(c.x, c.y, box, rot);
    const [bx, by] = toPdfPoint(c.x + c.w, c.y + c.h, box, rot);
    page.setCropBox(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
  }
  return doc.save();
}

/** Zona unei redactări în coordonatele PDF ale paginii. */
function zoneOf(doc: PDFDocument, b: Mark): Box {
  const page = doc.getPage(b.page - 1);
  const rot = ((page.getRotation().angle % 360) + 360) % 360;
  const box = page.getCropBox();
  const [ax, ay] = toPdfPoint(b.x, b.y, box, rot);
  const [bx, by] = toPdfPoint(b.x + b.w, b.y + b.h, box, rot);
  return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
}

/** Dreptunghiul colorat și textul de peste el (ca imagine mică, să meargă și cu diacritice), pe o pagină care rămâne text. */
async function paintZone(doc: PDFDocument, b: Mark, z: Box) {
  const page = doc.getPage(b.page - 1);
  const fill = b.color ?? REDACT_COLOR;
  const n = parseInt(fill.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const [w, h] = [z[2] - z[0], z[3] - z[1]];
  page.drawRectangle({ x: z[0], y: z[1], width: w, height: h, color: rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255) });
  if (!b.text?.trim() || w < 4 || h < 4) return;
  const k = 4;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * k);
  canvas.height = Math.ceil(h * k);
  paintRedactLabel(canvas.getContext('2d')!, b.text, 0, 0, w * k, h * k, fill);
  const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  canvas.width = 0;
  if (png) page.drawImage(await doc.embedPng(new Uint8Array(await png.arrayBuffer())), { x: z[0], y: z[1], width: w, height: h });
}

/** Paginile (de la 1) pe care pdf.js mai citește vreo literă sub o zonă: acolo redactarea ca text n-a reușit. */
async function leftovers(view: pdfjs.PDFDocumentProxy, zones: Map<number, Box[]>): Promise<Set<number>> {
  const bad = new Set<number>();
  for (const [n, zs] of zones) {
    const tc = await (await view.getPage(n)).getTextContent();
    for (const it of tc.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const [a, b, , d, e, f] = it.transform as number[];
      const len = it.str.length;
      const hgt = it.height || Math.hypot(b, d) || 10;
      const s = Math.hypot(a, b);
      const [ux, uy] = s ? [a / s, b / s] : [1, 0];
      // Litera e doar aproximată (lățimea bucății împărțită egal), deci se socotește rămasă doar dacă e toată în zonă:
      // o literă de lângă zonă (virgula de după e-mail) rămâne pe drept.
      const cw = it.width / len;
      const at = (along: number): [number, number] => [e + ux * along - uy * hgt * 0.35, f + uy * along + ux * hgt * 0.35];
      for (let i = 0; i < len && !bad.has(n); i++) {
        if (!it.str[i].trim()) continue;
        const [xa, ya] = at(i * cw + cw * 0.1), [xb, yb] = at((i + 1) * cw - cw * 0.1);
        if (zs.some((z) => [xa, xb].every((x) => x >= z[0] && x <= z[2]) && [ya, yb].every((y) => y >= z[1] && y <= z[3]))) bad.add(n);
      }
      if (bad.has(n)) break;
    }
  }
  return bad;
}

/**
 * Acoperă zonele date (puncte, pe pagina așa cum se vede) și scoate din fișier tot ce era sub ele.
 * În `info.raster` pune paginile (de la 1) care au devenit imagine (dreaptă, cu originea în colțul paginii văzute).
 */
export async function redact(bytes: Uint8Array, boxes: Mark[], info?: { raster?: number[] }): Promise<Uint8Array> {
  const first = await open(bytes);
  const pages = [...new Set(boxes.map((b) => b.page))].filter((n) => n >= 1 && n <= first.getPageCount());
  // 1) Paginile drepte: literele de sub zone se scot, restul rămâne text.
  const kept = new Map<number, Box[]>();
  for (const n of pages) {
    const page = first.getPage(n - 1);
    if (((page.getRotation().angle % 360) + 360) % 360) continue;
    const mine = boxes.filter((b) => b.page === n);
    const zones = mine.map((b) => zoneOf(first, b));
    // Comentariile și câmpurile de formular peste zone se scot de tot (cu valorile lor); restul rămân.
    if (dropAnnotsIn(first, n - 1, zones) === null || redactKeepText(first, n - 1, zones) === null) continue;
    for (let i = 0; i < mine.length; i++) await paintZone(first, mine[i], zones[i]);
    page.node.delete(PDFName.of('Thumb'));
    kept.set(n, zones);
  }
  const cur = kept.size ? await first.save() : bytes;
  // 2) Verificarea cu pdf.js; paginile cu litere rămase sub zone, și cele care n-au putut rămâne text, se fac imagine.
  // pdf.js își ia octeții pentru el (îi mută în alt fir), deci îi dăm o copie.
  const view = await pdfjs.getDocument({ data: defuse(cur.slice()).data, isEvalSupported: false }).promise;
  let raster: number[];
  try {
    const bad = await leftovers(view, kept);
    raster = pages.filter((n) => !kept.has(n) || bad.has(n));
    if (info) info.raster = raster;
  } catch (e) { await view.loadingTask.destroy(); throw e; }
  const doc = await open(cur);
  const canvas = document.createElement('canvas');
  try {
    for (const n of raster) {
      const pg = await view.getPage(n);
      const scale = DPI / 72;
      const vp = pg.getViewport({ scale });
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // O pagină acoperită în întregime (redactarea paginii întregi) nu mai trebuie desenată: oricum nu se vede nimic din ea.
      const vp1 = pg.getViewport({ scale: 1 });
      const whole = boxes.some((b) => b.page === n && b.x <= 0.5 && b.y <= 0.5 && b.x + b.w >= vp1.width - 0.5 && b.y + b.h >= vp1.height - 0.5);
      if (!whole) await pg.render({ canvasContext: ctx, viewport: vp, intent: 'print', annotationMode: pdfjs.AnnotationMode.ENABLE_STORAGE }).promise;
      for (const b of boxes) {
        if (b.page !== n) continue;
        ctx.fillStyle = b.color ?? REDACT_COLOR;
        ctx.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
        paintRedactLabel(ctx, b.text, b.x * scale, b.y * scale, b.w * scale, b.h * scale, b.color ?? REDACT_COLOR);
      }
      const jpg = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (!jpg) throw new Error('Pagina nu s-a putut desena.');
      const img = await doc.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
      replacePage(doc, n - 1, img, vp.width / scale, vp.height / scale);
    }
  } finally {
    canvas.width = 0;
    await view.loadingTask.destroy();
  }
  dropUnreachable(doc);
  return doc.save();
}

/** Golește pagina (conținut, resurse, adnotări, miniatură) și pune în locul ei imaginea dată, dreaptă, la mărimea dată. */
export function replacePage(doc: PDFDocument, i: number, img: PDFImage, w: number, h: number) {
  const page = doc.getPage(i);
  const node = page.node;
  const annots = node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  const gone = new Set<string>();
  annots?.asArray().forEach((r) => { if (r instanceof PDFRef) gone.add(r.toString()); });
  dropFields(doc, gone);
  for (const k of ['Annots', 'Thumb', 'PieceInfo', 'Metadata', 'StructParents', 'Group', 'B', 'AA', 'BleedBox', 'TrimBox', 'ArtBox', 'UserUnit', 'VP', 'SeparationInfo']) {
    node.delete(PDFName.of(k));
  }
  // Valorile care s-ar moșteni de la părinte se pun explicit pe pagină.
  node.set(PDFName.of('Resources'), doc.context.obj({}));
  node.set(PDFName.of('Contents'), doc.context.obj([]));
  page.setMediaBox(0, 0, w, h);
  page.setCropBox(0, 0, w, h);
  page.setRotation(degrees(0));
  page.drawImage(img, { x: 0, y: 0, width: w, height: h });
}
