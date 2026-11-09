// Original: src/pdf/textRemove.ts.
// @ts-nocheck — copiat din Cyber Office Studio, aplicația proprietarului (D-071, D-072), fără schimbări de logică;
//   K.G.B. verifică tablourile mai strict (noUncheckedIndexedAccess) decât proiectul de origine.
//   Testat în tests/redact-keep.test.mjs.
// Ștergerea adevărată a unui text din pagina PDF (pentru „Editează text”): textul vechi se scoate din conținutul paginii,
// nu doar se acoperă cu alb, ca să nu mai apară la căutare, la copiere sau la citirea cu alt program.
// Se citesc comenzile paginii (BT … ET, Tf, Td, Tm, Tj, TJ…), se urmărește unde ajunge fiecare bucată de text și se
// înlocuiesc doar bucățile care cad în zonele date cu un spațiu gol de aceeași lățime ([-N] TJ). Așa textul care urmează pe
// același rând rămâne exact pe loc. Lățimile vin din fontul paginii (/Widths, /W) sau, la fonturile de bază, din
// tabelele lor. Textul din formele încorporate (XObject) nu se atinge. Testat în tests/pdf-text-remove.test.mjs.
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFStream } from 'pdf-lib';
import { Encodings, Font } from '@pdf-lib/standard-fonts';

/** O zonă de pe pagină, în coordonatele PDF ale paginii (punctul 0,0 jos în stânga): [x0, y0, x1, y1]. */
export type Box = [number, number, number, number];

export type M = [number, number, number, number, number, number];
export const ID: M = [1, 0, 0, 1, 0, 0];
export const mul = (a: M, b: M): M => [
  a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
];
export const apply = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// ---------- Citirea comenzilor ----------

export type Tok =
  | { k: 'num'; v: number; s: number; e: number }
  | { k: 'str'; v: number[]; s: number; e: number }
  | { k: 'name'; v: string; s: number; e: number }
  | { k: 'op'; v: string; s: number; e: number }
  | { k: 'arr'; v: Tok[]; s: number; e: number }
  | { k: 'other'; s: number; e: number };

const isWs = (c: number) => c === 32 || c === 10 || c === 13 || c === 9 || c === 12 || c === 0;
const isDelim = (c: number) => c === 40 || c === 41 || c === 60 || c === 62 || c === 91 || c === 93 || c === 123 || c === 125 || c === 47 || c === 37;

/** Citește comenzile din textul conținutului (un caracter = un octet). */
export function* tokens(src: string): Generator<Tok> {
  let i = 0;
  const n = src.length;
  const code = (j: number) => src.charCodeAt(j);
  const readOne = (): Tok | null => {
    while (i < n) {
      const c = code(i);
      if (isWs(c)) { i++; continue; }
      if (c === 37) { while (i < n && code(i) !== 10 && code(i) !== 13) i++; continue; }
      break;
    }
    if (i >= n) return null;
    const s = i;
    const c = code(i);
    if (c === 40) { // ( … ) cu paranteze în interior și caractere scăpate
      const out: number[] = [];
      let depth = 1;
      i++;
      while (i < n && depth > 0) {
        const ch = code(i++);
        if (ch === 92) {
          const nx = code(i++);
          if (nx >= 48 && nx <= 55) {
            let v = nx - 48;
            for (let k = 0; k < 2 && code(i) >= 48 && code(i) <= 55; k++) v = v * 8 + code(i++) - 48;
            out.push(v & 255);
          } else if (nx === 110) out.push(10); else if (nx === 114) out.push(13); else if (nx === 116) out.push(9);
          else if (nx === 98) out.push(8); else if (nx === 102) out.push(12);
          else if (nx === 13) { if (code(i) === 10) i++; } else if (nx === 10) { /* rând continuat */ } else out.push(nx);
        } else if (ch === 40) { depth++; out.push(ch); } else if (ch === 41) { depth--; if (depth) out.push(ch); } else out.push(ch);
      }
      return { k: 'str', v: out, s, e: i };
    }
    if (c === 60 && code(i + 1) === 60) { i += 2; return { k: 'other', s, e: i }; } // << (dicționar: doar se sare)
    if (c === 62 && code(i + 1) === 62) { i += 2; return { k: 'other', s, e: i }; }
    if (c === 60) { // <hex>
      i++;
      let hex = '';
      while (i < n && code(i) !== 62) { const ch = src[i++]; if (!isWs(ch.charCodeAt(0))) hex += ch; }
      i++;
      if (hex.length % 2) hex += '0';
      const out: number[] = [];
      for (let k = 0; k < hex.length; k += 2) out.push(parseInt(hex.slice(k, k + 2), 16) || 0);
      return { k: 'str', v: out, s, e: i };
    }
    if (c === 91) { // [ … ]
      i++;
      const items: Tok[] = [];
      for (;;) {
        while (i < n && (isWs(code(i)))) i++;
        if (i >= n) break;
        if (code(i) === 93) { i++; break; }
        const t = readOne();
        if (!t) break;
        items.push(t);
      }
      return { k: 'arr', v: items, s, e: i };
    }
    if (c === 93 || c === 123 || c === 125 || c === 41 || c === 62) { i++; return { k: 'other', s, e: i }; }
    if (c === 47) { // /Nume
      i++;
      while (i < n && !isWs(code(i)) && !isDelim(code(i))) i++;
      return { k: 'name', v: src.slice(s + 1, i), s, e: i };
    }
    while (i < n && !isWs(code(i)) && !isDelim(code(i))) i++;
    if (i === s) { i++; return { k: 'other', s, e: i }; }
    const w = src.slice(s, i);
    const num = Number(w);
    if (w !== '' && !Number.isNaN(num) && /^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) return { k: 'num', v: num, s, e: i };
    if (w === 'BI') { // imagine în linie: până la EI (despărțit de spații)
      const end = src.indexOf('EI', i);
      let j = end;
      while (j >= 0 && !(isWs(code(j - 1)) && (j + 2 >= n || isWs(code(j + 2))))) j = src.indexOf('EI', j + 2);
      i = j < 0 ? n : j + 2;
      return { k: 'op', v: 'BI', s, e: i };
    }
    return { k: 'op', v: w, s, e: i };
  };
  for (;;) { const t = readOne(); if (!t) return; yield t; }
}

// ---------- Lățimile literelor ----------

/** known = false: lățimile literelor nu se știu (font fără /Widths, Type3), deci nici unde cade fiecare literă. */
export interface FontInfo { two: boolean; width: (code: number) => number; spaceOk: boolean; blank?: Set<number>; known?: boolean }

/** Codurile care înseamnă spațiu în tabela ToUnicode a unui font (bfchar / bfrange spre U+0020 sau U+00A0). */
function blankCodes(doc: PDFDocument, dict: PDFDict): Set<number> | undefined {
  const raw = dict.get(PDFName.of('ToUnicode'));
  const st = raw instanceof PDFRef ? doc.context.lookup(raw) : raw;
  if (!(st instanceof PDFStream)) return undefined;
  let txt = '';
  try {
    const b = st instanceof PDFRawStream ? decodePDFRawStream(st).decode() : (st as unknown as { getContents(): Uint8Array }).getContents();
    for (let k = 0; k < b.length; k += 8192) txt += String.fromCharCode(...b.subarray(k, k + 8192));
  } catch { return undefined; }
  const out = new Set<number>();
  const sp = (h: string) => { const u = parseInt(h, 16); return u === 0x20 || u === 0xa0; };
  for (const blk of txt.match(/beginbfchar[\s\S]*?endbfchar/g) ?? []) {
    for (const m of blk.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) if (sp(m[2])) out.add(parseInt(m[1], 16));
  }
  for (const blk of txt.match(/beginbfrange[\s\S]*?endbfrange/g) ?? []) {
    for (const m of blk.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const a = parseInt(m[1], 16), z = parseInt(m[2], 16), u = parseInt(m[3], 16);
      for (const t of [0x20, 0xa0]) if (t >= u && t - u <= z - a) out.add(a + t - u);
    }
  }
  return out.size ? out : undefined;
}

let winAnsiNames: Map<number, string> | null = null;
function winAnsiName(code: number): string | undefined {
  if (!winAnsiNames) {
    winAnsiNames = new Map();
    for (const cp of Encodings.WinAnsi.supportedCodePoints) { const r = Encodings.WinAnsi.encodeUnicodeCodePoint(cp); winAnsiNames.set(r.code, r.name); }
  }
  return winAnsiNames.get(code);
}
const BASE14 = ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique', 'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique',
  'Helvetica-BoldOblique', 'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic'];

export function fontInfo(doc: PDFDocument, dict: PDFDict | undefined): FontInfo {
  const fallback: FontInfo = { two: false, width: () => 500, spaceOk: true, known: false };
  if (!dict) return fallback;
  const get = (d: PDFDict, k: string) => { const v = d.get(PDFName.of(k)); return v instanceof PDFRef ? doc.context.lookup(v) : v; };
  const sub = String(get(dict, 'Subtype') ?? '');
  // La Type3 lățimile sunt în unitățile lui FontMatrix, nu în miimi: nu le folosim.
  if (sub === '/Type3') return fallback;
  if (sub === '/Type0') {
    const desc = get(dict, 'DescendantFonts');
    const cid = desc instanceof PDFArray ? doc.context.lookup(desc.get(0)) : undefined;
    const widths = new Map<number, number>();
    let dw = 1000;
    if (cid instanceof PDFDict) {
      const d = get(cid, 'DW');
      if (d instanceof PDFNumber) dw = d.asNumber();
      const w = get(cid, 'W');
      if (w instanceof PDFArray) {
        const arr = w.asArray().map((x) => (x instanceof PDFRef ? doc.context.lookup(x) : x));
        for (let k = 0; k < arr.length;) {
          const a = arr[k], b = arr[k + 1];
          if (a instanceof PDFNumber && b instanceof PDFArray) {
            b.asArray().forEach((x, j) => { const v = x instanceof PDFRef ? doc.context.lookup(x) : x; if (v instanceof PDFNumber) widths.set(a.asNumber() + j, v.asNumber()); });
            k += 2;
          } else if (a instanceof PDFNumber && b instanceof PDFNumber && arr[k + 2] instanceof PDFNumber) {
            for (let c = a.asNumber(); c <= b.asNumber() && c - a.asNumber() < 65536; c++) widths.set(c, (arr[k + 2] as PDFNumber).asNumber());
            k += 3;
          } else k++;
        }
      }
    }
    // Spațierea între cuvinte (Tw) nu se aplică la fonturile cu coduri de 2 octeți.
    return { two: true, width: (c) => widths.get(c) ?? dw, spaceOk: false, blank: blankCodes(doc, dict) };
  }
  const first = get(dict, 'FirstChar');
  const ws = get(dict, 'Widths');
  if (first instanceof PDFNumber && ws instanceof PDFArray) {
    const f = first.asNumber();
    const arr = ws.asArray().map((x) => { const v = x instanceof PDFRef ? doc.context.lookup(x) : x; return v instanceof PDFNumber ? v.asNumber() : 0; });
    return { two: false, width: (c) => arr[c - f] ?? 0, spaceOk: true };
  }
  const base = String(get(dict, 'BaseFont') ?? '').replace(/^\//, '').replace(/^[A-Z]{6}\+/, '');
  const std = BASE14.find((b) => b === base) ?? (/^Arial/i.test(base) ? (/Bold/i.test(base) ? 'Helvetica-Bold' : 'Helvetica') : undefined);
  if (std) {
    const font = Font.load(std as Parameters<typeof Font.load>[0]);
    return { two: false, width: (c) => { const name = winAnsiName(c); const w = name ? font.getWidthOfGlyph(name) : undefined; return typeof w === 'number' ? w : 500; }, spaceOk: true };
  }
  return fallback;
}

// ---------- Ștergerea ----------

/** Conținutul paginii (toate fluxurile, lipite), ca text cu un caracter pe octet. */
export function pageContent(doc: PDFDocument, pageIndex: number): string | null {
  const node = doc.getPage(pageIndex).node;
  const raw = node.get(PDFName.of('Contents'));
  const val = raw instanceof PDFRef ? doc.context.lookup(raw) : raw;
  const list = val instanceof PDFArray ? val.asArray().map((x) => (x instanceof PDFRef ? doc.context.lookup(x) : x)) : [val];
  let out = '';
  for (const s of list) {
    if (!(s instanceof PDFStream)) continue;
    const bytes = s instanceof PDFRawStream ? decodePDFRawStream(s).decode() : (s as unknown as { getContents(): Uint8Array }).getContents();
    let part = '';
    for (let k = 0; k < bytes.length; k += 8192) part += String.fromCharCode(...bytes.subarray(k, k + 8192));
    out += part + '\n';
  }
  return out;
}

const fmt = (v: number) => String(Math.round(v * 1000) / 1000);

/**
 * Scoate din pagina `pageIndex` (de la 0) textul ale cărui litere cad în zonele `boxes` (coordonatele PDF ale paginii).
 * O bucată de text (Tj / TJ) se scoate doar dacă e toată într-o zonă (de la început până la sfârșit). Întoarce câte bucăți s-au scos.
 */
export function removeTextInPage(doc: PDFDocument, pageIndex: number, boxes: Box[]): number {
  if (!boxes.length) return 0;
  const inside = (x: number, y: number) => boxes.some(([x0, y0, x1, y1]) => x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && y >= Math.min(y0, y1) && y <= Math.max(y0, y1));
  return rewriteText(doc, pageIndex, (h) => inside(h.xa, h.ya) && inside(h.xb, h.yb));
}

/**
 * Textul ascuns de pe pagină (pentru „Elimină informațiile ascunse”): invizibil (Tr 3), alb, complet transparent sau mai mic de
 * jumătate de punct. Textul invizibil / alb / transparent rămâne dacă stă peste o poză sau o formă colorată desenată înainte
 * (de ex. stratul de text al unui document scanat, sau un titlu alb pe o bandă colorată). Întoarce câte bucăți s-au scos.
 */
export function removeHiddenTextInPage(doc: PDFDocument, pageIndex: number): number {
  return rewriteText(doc, pageIndex, (h) => !h.blank && (h.size < 0.5 || ((h.tr === 3 || h.white || h.clear) && !h.painted(h.xa, h.ya) && !h.painted(h.xb, h.yb))));
}

/** Ce se știe despre o bucată de text: unde începe și unde se termină (pe pagină), cum se desenează și cât e de mare. */
interface Hit { blank: boolean; xa: number; ya: number; xb: number; yb: number; tr: number; white: boolean; clear: boolean; size: number; painted: (x: number, y: number) => boolean }

function rewriteText(doc: PDFDocument, pageIndex: number, decide: (h: Hit) => boolean): number {
  const src = pageContent(doc, pageIndex);
  if (src === null) return 0;
  const page = doc.getPage(pageIndex);
  const res = page.node.Resources();
  const fontsDict = res?.lookup(PDFName.of('Font'));
  const fonts = new Map<string, FontInfo>();
  const font = (name: string): FontInfo => {
    let f = fonts.get(name);
    if (!f) {
      const d = fontsDict instanceof PDFDict ? fontsDict.lookup(PDFName.of(name)) : undefined;
      f = fontInfo(doc, d instanceof PDFDict ? d : undefined);
      fonts.set(name, f);
    }
    return f;
  };
  const extG = res?.lookup(PDFName.of('ExtGState'));

  // fcs / fill: spațiul de culoare și culoarea de umplere; ca: opacitatea umplerii; tr: felul în care se desenează textul.
  interface GS { ctm: M; tc: number; tw: number; th: number; tl: number; font: string; size: number; rise: number; fcs: string; fill: number[]; ca: number; tr: number }
  let gs: GS = { ctm: ID, tc: 0, tw: 0, th: 1, tl: 0, font: '', size: 0, rise: 0, fcs: 'DeviceGray', fill: [0], ca: 1, tr: 0 };
  const isWhite = (cs: string, c: number[]) =>
    cs === 'DeviceGray' || cs === 'G' ? c[0] >= 0.99
      : cs === 'DeviceRGB' || cs === 'RGB' ? c.length === 3 && c.every((v) => v >= 0.99)
        : cs === 'DeviceCMYK' || cs === 'CMYK' ? c.length === 4 && c.every((v) => v <= 0.01) : false;
  // Zonele pe care s-a desenat deja ceva care nu e alb (forme pline, poze, umbriri), pe pagină.
  const paint: Box[] = [];
  let path: [number, number][] = [];
  const addBox = (pts: [number, number][]) => {
    if (!pts.length) return;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    paint.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
  };
  const unit = () => [apply(gs.ctm, 0, 0), apply(gs.ctm, 1, 0), apply(gs.ctm, 0, 1), apply(gs.ctm, 1, 1)] as [number, number][];
  const painted = (x: number, y: number) => paint.some(([x0, y0, x1, y1]) => x >= x0 - 0.5 && x <= x1 + 0.5 && y >= y0 - 0.5 && y <= y1 + 0.5);
  const stack: GS[] = [];
  let tm: M = ID, tlm: M = ID;
  const edits: { s: number; e: number; text: string }[] = [];
  let ops: Tok[] = [];
  let removed = 0;

  /**
   * Lățimea unui șir (în spațiul textului, înainte de Tm) și unde se termină ultima literă care nu e spațiu
   * (spațiile de la capăt nu se văd, deci nu trebuie să încapă în zonă).
   */
  const advance = (bytes: number[]): { w: number; vis: number } => {
    const f = font(gs.font);
    let w = 0, vis = -1;
    const step = f.two ? 2 : 1;
    for (let k = 0; k + step - 1 < bytes.length; k += step) {
      const c = f.two ? (bytes[k] << 8) | bytes[k + 1] : bytes[k];
      w += (f.width(c) / 1000) * gs.size + gs.tc + (f.spaceOk && !f.two && c === 32 ? gs.tw : 0);
      if (f.two ? !f.blank?.has(c) : c !== 32 && c !== 160 && c !== 9) vis = w;
    }
    return { w: w * gs.th, vis: vis < 0 ? -1 : vis * gs.th };
  };
  /** O bucată de text: scoasă dacă e în zonă (cu un spațiu gol de aceeași lățime în loc), cursorul merge mai departe oricum. */
  const show = (items: Tok[], s: number, e: number, prefix: string) => {
    const trm = mul(tm, gs.ctm);
    let adv = 0, end = 0;
    for (const it of items) {
      if (it.k === 'str') { const a = advance(it.v); if (a.vis >= 0) end = adv + a.vis; adv += a.w; }
      else if (it.k === 'num') adv += (-it.v / 1000) * gs.size * gs.th;
    }
    // Bucata se scoate doar dacă e toată în zonă (început și sfârșit): un cuvânt dintr-un rând mai lung lasă rândul neatins.
    const [xa, ya] = apply(trm, 0, gs.rise);
    const [xb, yb] = apply(trm, end, gs.rise);
    const size = Math.abs(gs.size) * Math.hypot(trm[2], trm[3]);
    const hit = items.some((it) => it.k === 'str' && it.v.length)
      && decide({ blank: end <= 0, xa, ya, xb, yb, tr: gs.tr, white: (gs.tr === 0 || gs.tr === 4) && isWhite(gs.fcs, gs.fill), clear: gs.ca <= 0.01, size, painted });
    if (hit) {
      const k = gs.size * gs.th;
      edits.push({ s, e, text: `${prefix}[${k ? fmt((-adv / k) * 1000) : 0}] TJ` });
      removed++;
    }
    tm = mul([1, 0, 0, 1, adv, 0], tm);
  };
  const num = (t: Tok | undefined) => (t && t.k === 'num' ? t.v : 0);

  for (const t of tokens(src)) {
    if (t.k !== 'op') { ops.push(t); continue; }
    const a = ops;
    ops = [];
    const s = a.length ? a[0].s : t.s;
    switch (t.v) {
      case 'q': stack.push({ ...gs }); break;
      case 'Q': gs = stack.pop() ?? gs; break;
      case 'cm': if (a.length >= 6) gs = { ...gs, ctm: mul(a.slice(-6).map(num) as M, gs.ctm) }; break;
      case 'BT': tm = ID; tlm = ID; break;
      case 'Tf': gs = { ...gs, font: a[a.length - 2]?.k === 'name' ? (a[a.length - 2] as { v: string }).v : gs.font, size: num(a[a.length - 1]) }; break;
      case 'Tc': gs = { ...gs, tc: num(a[0]) }; break;
      case 'Tw': gs = { ...gs, tw: num(a[0]) }; break;
      case 'Tz': gs = { ...gs, th: num(a[0]) / 100 }; break;
      case 'TL': gs = { ...gs, tl: num(a[0]) }; break;
      case 'Ts': gs = { ...gs, rise: num(a[0]) }; break;
      case 'Tr': gs = { ...gs, tr: num(a[0]) }; break;
      case 'g': gs = { ...gs, fcs: 'DeviceGray', fill: [num(a[0])] }; break;
      case 'rg': gs = { ...gs, fcs: 'DeviceRGB', fill: a.slice(-3).map(num) }; break;
      case 'k': gs = { ...gs, fcs: 'DeviceCMYK', fill: a.slice(-4).map(num) }; break;
      case 'cs': gs = { ...gs, fcs: a[0]?.k === 'name' ? a[0].v : '', fill: [] }; break;
      case 'sc': case 'scn': gs = { ...gs, fill: a.filter((x) => x.k === 'num').map(num) }; break;
      case 'gs': {
        const nm = a[0]?.k === 'name' ? a[0].v : '';
        const g = extG instanceof PDFDict ? extG.lookup(PDFName.of(nm)) : undefined;
        const ca = g instanceof PDFDict ? g.lookup(PDFName.of('ca')) : undefined;
        if (ca instanceof PDFNumber) gs = { ...gs, ca: ca.asNumber() };
        break;
      }
      case 'm': case 'l': path.push(apply(gs.ctm, num(a[a.length - 2]), num(a[a.length - 1]))); break;
      case 'c': for (let k = 0; k + 1 < a.length; k += 2) path.push(apply(gs.ctm, num(a[k]), num(a[k + 1]))); break;
      case 'v': case 'y': for (let k = 0; k + 1 < a.length; k += 2) path.push(apply(gs.ctm, num(a[k]), num(a[k + 1]))); break;
      case 're': {
        const [x, y, w, h] = a.slice(-4).map(num);
        path.push(apply(gs.ctm, x, y), apply(gs.ctm, x + w, y), apply(gs.ctm, x, y + h), apply(gs.ctm, x + w, y + h));
        break;
      }
      case 'f': case 'F': case 'f*': case 'B': case 'B*': case 'b': case 'b*':
        if (!isWhite(gs.fcs, gs.fill) && gs.ca > 0.01) addBox(path);
        path = [];
        break;
      case 'n': case 'S': case 's': path = []; break;
      case 'Do': case 'BI': addBox(unit()); break;
      case 'sh': paint.push([-1e9, -1e9, 1e9, 1e9]); break;
      case 'Td': tlm = mul([1, 0, 0, 1, num(a[0]), num(a[1])], tlm); tm = tlm; break;
      case 'TD': gs = { ...gs, tl: -num(a[1]) }; tlm = mul([1, 0, 0, 1, num(a[0]), num(a[1])], tlm); tm = tlm; break;
      case 'Tm': if (a.length >= 6) { tlm = a.slice(-6).map(num) as M; tm = tlm; } break;
      case 'T*': tlm = mul([1, 0, 0, 1, 0, -gs.tl], tlm); tm = tlm; break;
      case 'Tj': show(a.filter((x) => x.k === 'str'), s, t.e, ''); break;
      case 'TJ': { const arr = a.find((x) => x.k === 'arr'); show(arr && arr.k === 'arr' ? arr.v : [], s, t.e, ''); break; }
      case "'": tlm = mul([1, 0, 0, 1, 0, -gs.tl], tlm); tm = tlm; show(a.filter((x) => x.k === 'str'), s, t.e, 'T* '); break;
      case '"': {
        gs = { ...gs, tw: num(a[0]), tc: num(a[1]) };
        tlm = mul([1, 0, 0, 1, 0, -gs.tl], tlm); tm = tlm;
        show(a.filter((x) => x.k === 'str'), s, t.e, `${fmt(gs.tw)} Tw ${fmt(gs.tc)} Tc T* `);
        break;
      }
      default: break;
    }
  }
  if (!edits.length) return 0;
  let out = '';
  let at = 0;
  for (const ed of edits.sort((x, y) => x.s - y.s)) { out += src.slice(at, ed.s) + ed.text; at = ed.e; }
  out += src.slice(at);
  const bytes = new Uint8Array(out.length);
  for (let k = 0; k < out.length; k++) bytes[k] = out.charCodeAt(k) & 255;
  page.node.set(PDFName.of('Contents'), doc.context.register(doc.context.flateStream(bytes)));
  return removed;
}
