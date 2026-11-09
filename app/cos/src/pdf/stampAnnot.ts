// @ts-nocheck
// Din Cyber Office Studio (src/pdf/stampAnnot.ts, D-071, D-078), neschimbat.
// Ștampilele puse de noi ajung în PDF ca adnotări /Stamp adevărate, cu aspectul desenat (/AP), ca orice program de PDF
// să le arate (și să le poată muta sau șterge). Lângă ele ținem și datele ștampilei (textul, rândul de sub el, culoarea,
// imaginea), într-un flux separat, ca la redeschiderea în Suite ștampila să fie din nou un element pe care îl muți,
// îl mărești și îl schimbi.
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFStream, PDFString, type PDFPage } from 'pdf-lib';
import { open } from './edit';
import { toPdfPoint, type Mark } from './sign';

/** Cheia din adnotare care duce la datele ștampilei și tipul fluxului cu datele (căutat direct în octeți, e mereu necomprimat). */
const KEY = 'SuiteStamp';
const DATA_TYPE = 'SuiteStampData';

/** Numele standard al ștampilei (pentru programele care arată pictograma după nume). */
const STD_NAMES: Record<string, string> = {
  'APROBAT': 'Approved', 'RESPINS': 'NotApproved', 'CONFIDENȚIAL': 'Confidential', 'COPIE': 'Draft', 'PRIMIT': 'Approved', 'PLĂTIT': 'Approved',
};

interface StampData { v: 1; text?: string; sub?: string; color?: string; opacity?: number; img?: string }

function pdfNow(): string {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
  return `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Ștampila ca adnotare /Stamp. `img` e desenul ei (PNG pus deja în document). Pe o pagină rotită desenul se rotește odată cu ea,
 * ca pe ecran să stea drept; dreptunghiul adnotării (/Rect) e cel care îl cuprinde.
 */
export function addStampAnnot(doc: PDFDocument, page: PDFPage, m: Mark, img: PDFRef) {
  const ctx = doc.context;
  const rot = ((page.getRotation().angle % 360) + 360) % 360;
  const box = page.getCropBox();
  // Colțul din stânga-jos al ștampilei așa cum se vede și cele patru colțuri în coordonatele PDF.
  const [x, y] = toPdfPoint(m.x, m.y + m.h, box, rot);
  const corners = [[m.x, m.y], [m.x + m.w, m.y], [m.x, m.y + m.h], [m.x + m.w, m.y + m.h]].map(([a, b]) => toPdfPoint(a, b, box, rot));
  const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
  const rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const t = (rot * Math.PI) / 180, cos = Math.round(Math.cos(t)), sin = Math.round(Math.sin(t));
  const f = (n: number) => String(Math.round(n * 1000) / 1000);
  const cm = [m.w * cos, m.w * sin, -m.h * sin, m.h * cos, x, y].map(f).join(' ');
  const ap = ctx.register(ctx.stream(`q ${cm} cm /Im0 Do Q`, {
    Type: 'XObject', Subtype: 'Form', BBox: rect, Resources: { XObject: { Im0: img } },
  }));
  const data: StampData = { v: 1, text: m.text, sub: m.sub, color: m.color, opacity: m.opacity, img: m.img };
  const dataRef = ctx.register(ctx.flateStream(new TextEncoder().encode(JSON.stringify(data)), { Type: DATA_TYPE }));
  const label = (m.text ?? '').trim();
  const dict: Record<string, unknown> = {
    Type: 'Annot', Subtype: 'Stamp', Rect: rect, F: 4, M: PDFString.of(pdfNow()),
    T: PDFHexString.fromText('Cyber Office Studio'), Subj: PDFHexString.fromText('Ștampilă'),
    NM: PDFString.of(`suite-stamp-${Date.now().toString(36)}-${m.id}`),
    Name: PDFName.of(m.img ? 'Draft' : STD_NAMES[label] ?? 'Draft'),
    IT: PDFName.of(m.img ? 'StampImage' : 'Stamp'),
    AP: { N: ap },
    [KEY]: dataRef,
  };
  const contents = m.img ? label : [label, m.sub].filter((s) => s?.trim()).join(' ');
  if (contents) dict.Contents = PDFHexString.fromText(contents);
  page.node.addAnnot(ctx.register(ctx.obj(dict as Parameters<typeof ctx.obj>[0])));
}

/** Are documentul ștampile puse de Suite? Se caută tipul fluxului de date direct în octeți (repede, fără să deschidem PDF-ul). */
export function hasSuiteStamps(bytes: Uint8Array): boolean {
  const needle = new TextEncoder().encode('/' + DATA_TYPE);
  let i = bytes.indexOf(needle[0]);
  while (i >= 0 && i <= bytes.length - needle.length) {
    let k = 1;
    while (k < needle.length && bytes[i + k] === needle[k]) k++;
    if (k === needle.length) return true;
    i = bytes.indexOf(needle[0], i + 1);
  }
  return false;
}

/** Inversul lui toPdfPoint: un punct PDF → punctul de pe pagina văzută (cu rotirea ei, y de sus în jos). */
function fromPdfPoint(px: number, py: number, box: { x: number; y: number; width: number; height: number }, rot: number): [number, number] {
  const u = px - box.x, v = box.y + box.height - py;
  if (rot === 90) return [box.height - v, u];
  if (rot === 180) return [box.width - u, box.height - v];
  if (rot === 270) return [v, box.width - u];
  return [u, v];
}

/** Șterge din document un obiect și, pe rând, desenele lui (aspectul, imaginea și masca ei de transparență). */
function dropTree(doc: PDFDocument, ref: PDFRef | undefined, depth = 0) {
  if (!ref || depth > 4) return;
  const obj = doc.context.lookup(ref);
  const dict = obj instanceof PDFStream ? obj.dict : obj instanceof PDFDict ? obj : null;
  if (dict) {
    const kids: PDFRef[] = [];
    const ap = dict.lookupMaybe(PDFName.of('AP'), PDFDict);
    const n = ap?.get(PDFName.of('N'));
    if (n instanceof PDFRef) kids.push(n);
    const res = dict.lookupMaybe(PDFName.of('Resources'), PDFDict);
    const xo = res?.lookupMaybe(PDFName.of('XObject'), PDFDict);
    if (xo) for (const [, v] of xo.entries()) if (v instanceof PDFRef) kids.push(v);
    const sm = dict.get(PDFName.of('SMask'));
    if (sm instanceof PDFRef) kids.push(sm);
    const data = dict.get(PDFName.of(KEY));
    if (data instanceof PDFRef) kids.push(data);
    for (const k of kids) dropTree(doc, k, depth + 1);
  }
  doc.context.delete(ref);
}

/**
 * Scoate din document ștampilele puse de Suite și le întoarce ca elemente de pe pagină (din nou de mutat și de schimbat).
 * null dacă nu e niciuna (sau PDF-ul nu se poate rescrie, de exemplu e criptat): atunci documentul rămâne neatins.
 */
export async function extractStamps(bytes: Uint8Array): Promise<{ bytes: Uint8Array; marks: Omit<Mark, 'id'>[] } | null> {
  if (!hasSuiteStamps(bytes)) return null;
  let doc: PDFDocument;
  try { doc = await open(bytes); } catch { return null; }
  const marks: Omit<Mark, 'id'>[] = [];
  doc.getPages().forEach((page, pi) => {
    const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    if (!annots) return;
    const rot = ((page.getRotation().angle % 360) + 360) % 360;
    const box = page.getCropBox();
    const here: Omit<Mark, 'id'>[] = [];
    for (let i = annots.size() - 1; i >= 0; i--) {
      const ref = annots.get(i);
      const a = doc.context.lookup(ref);
      if (!(a instanceof PDFDict) || a.get(PDFName.of('Subtype')) !== PDFName.of('Stamp')) continue;
      const dataRef = a.get(PDFName.of(KEY));
      const raw = dataRef instanceof PDFRef ? doc.context.lookup(dataRef) : null;
      if (!(raw instanceof PDFRawStream)) continue;
      let data: StampData;
      try { data = JSON.parse(new TextDecoder().decode(decodePDFRawStream(raw).decode())); } catch { continue; }
      if (!data || data.v !== 1) continue;
      const r = a.lookupMaybe(PDFName.of('Rect'), PDFArray);
      const nums = r ? r.asArray().map((n) => (n instanceof PDFNumber ? n.asNumber() : NaN)) : [];
      if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) continue;
      // Dreptunghiul (poate mutat de alt program) → locul de pe pagina văzută.
      const [ax, ay] = fromPdfPoint(nums[0], nums[1], box, rot), [bx, by] = fromPdfPoint(nums[2], nums[3], box, rot);
      const m: Omit<Mark, 'id'> = {
        page: pi + 1, x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.max(1, Math.abs(bx - ax)), h: Math.max(1, Math.abs(by - ay)), kind: 'stamp',
      };
      if (typeof data.text === 'string') m.text = data.text;
      if (typeof data.sub === 'string') m.sub = data.sub;
      if (typeof data.color === 'string' && /^#[0-9a-f]{6}$/i.test(data.color)) m.color = data.color;
      if (typeof data.opacity === 'number' && data.opacity > 0 && data.opacity <= 1) m.opacity = data.opacity;
      if (typeof data.img === 'string' && data.img.startsWith('data:image/')) m.img = data.img;
      here.unshift(m);
      annots.remove(i);
      if (ref instanceof PDFRef) dropTree(doc, ref);
    }
    marks.push(...here);
  });
  if (!marks.length) return null;
  return { bytes: await doc.save(), marks };
}
