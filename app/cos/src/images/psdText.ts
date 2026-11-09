// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Textele din .psd (blocul „TySh”): cuvintele, fontul, mărimea, culoarea, alinierea și transformarea lor, ca stratul să
// rămână text pe care îl poți rescrie (panoul Proprietăți). Fonturile și culorile stau în „EngineData”, un text cu
// dicționare (<< /Cheie valoare >>) în care șirurile sunt între paranteze, de obicei în UTF-16 cu BOM.

import { layLines } from './annotate';
import { readTypeBlock } from './psdfx';

export interface PsdText {
  /** Textul, cu rândurile despărțite prin \n. */
  text: string;
  /** Numele fontului din fișier (de exemplu ArialMT) și familia pe care o cerem pe ecran. */
  font: string;
  family: string;
  bold?: boolean;
  italic?: boolean;
  /** Mărimea în punctele textului, înainte de transformare (pe ecran: × scara transformării). */
  size: number;
  color: string;
  /** 0 stânga, 1 dreapta, 2 centru. */
  align: 0 | 1 | 2;
  /** Transformarea: xx xy yx yy tx ty (tx, ty = locul primului rând, pe linia de bază; la casetă, colțul ei). */
  tf: number[];
  /** Casetă de paragraf (text în chenar): stânga, sus, dreapta, jos, înainte de transformare. Lipsă = text pe un punct. */
  box?: number[];
  /** Blocul TySh din fișier (cu textul rescris pus în el, vezi retextBlock): se scrie înapoi la salvarea .psd, ca textul să rămână text. */
  raw?: Uint8Array;
}

/** Șirul din paranteze care începe la `i` (după „(”): octeții, fără escape-uri; UTF-16 dacă are BOM. */
function parenStr(t: string, i: number): string {
  const bytes: number[] = [];
  for (; i < t.length && t[i] !== ')'; i++) {
    if (t.charCodeAt(i) === 92 && i + 1 < t.length) i++;
    bytes.push(t.charCodeAt(i) & 255);
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let s = '';
    for (let k = 2; k + 1 < bytes.length; k += 2) s += String.fromCharCode((bytes[k] << 8) | bytes[k + 1]);
    return s;
  }
  return String.fromCharCode(...bytes);
}

/** Numele fontului din fișier → familia și stilul (ArialMT → Arial; TimesNewRomanPS-BoldMT → Times New Roman, aldin). */
export function familyOf(font: string): { family: string; bold: boolean; italic: boolean } {
  const [base, style = ''] = font.split('-');
  const family = base.replace(/(PS)?(MT)?$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').trim() || 'Arial';
  return { family, bold: /bold|black|heavy|semibold/i.test(style), italic: /italic|oblique/i.test(style) };
}

const hex = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');

/** Fontul, mărimea, culoarea și alinierea primului șir de stil din EngineData. */
export function readEngine(t: string): Pick<PsdText, 'font' | 'size' | 'color' | 'align' | 'box'> & { fauxBold?: boolean; fauxItalic?: boolean } {
  const fonts: string[] = [];
  const fs = t.indexOf('/FontSet');
  if (fs >= 0) {
    const end = t.indexOf('/StyleSheetSet', fs);
    const re = /\/Name\s*\(/g;
    re.lastIndex = fs;
    for (let m; (m = re.exec(t)) && (end < 0 || m.index < end);) fonts.push(parenStr(t, m.index + m[0].length));
  }
  // Primul stil folosit de text (StyleRun), altfel stilul implicit din fișier.
  const sr = t.indexOf('/StyleRun'), from = sr >= 0 ? sr : 0;
  const after = (re: RegExp) => { const m = re.exec(t.slice(from)) ?? re.exec(t); return m ? m[1] : undefined; };
  const fi = Number(after(/\/Font\s+(\d+)/) ?? 0);
  const size = Number(after(/\/FontSize\s+([\d.]+)/) ?? 12);
  const vals = after(/\/FillColor\s*<<\s*\/Type\s+1\s*\/Values\s*\[\s*([\d.\s]+)\]/)?.trim().split(/\s+/).map(Number);
  const color = vals && vals.length >= 4 ? '#' + hex(vals[1]) + hex(vals[2]) + hex(vals[3]) : '#000000';
  const pr = t.indexOf('/ParagraphRun');
  const j = /\/Justification\s+(\d)/.exec(pr >= 0 ? t.slice(pr) : t)?.[1];
  const align = (j === '1' ? 1 : j === '2' ? 2 : 0) as 0 | 1 | 2;
  const bb = /\/ShapeType\s+1\b/.test(t) ? /\/BoxBounds\s*\[\s*([-\d.\s]+)\]/.exec(t)?.[1].trim().split(/\s+/).map(Number) : undefined;
  return {
    font: fonts[fi] ?? fonts[0] ?? 'Arial', size: Number.isFinite(size) && size > 0 ? size : 12, color, align,
    ...(bb && bb.length === 4 && bb.every(Number.isFinite) && bb[2] > bb[0] ? { box: bb } : {}),
    ...(/\/FauxBold\s+true/.test(t.slice(from)) ? { fauxBold: true } : {}),
    ...(/\/FauxItalic\s+true/.test(t.slice(from)) ? { fauxItalic: true } : {}),
  };
}

/** Blocul TySh → textul stratului; stricat sau fără text → null. */
export function readPsdText(b: Uint8Array): PsdText | null {
  const blk = readTypeBlock(b);
  if (!blk) return null;
  const txt = blk.d['Txt '];
  if (typeof txt !== 'string') return null;
  const eng = blk.d.EngineData;
  let t = '';
  if (eng instanceof Uint8Array) for (let i = 0; i < eng.length; i += 8192) t += String.fromCharCode(...eng.subarray(i, i + 8192));
  const e = readEngine(t);
  const f = familyOf(e.font);
  return {
    text: txt.replace(/\r\n?/g, '\n').replace(/\n$/, ''), font: e.font, family: f.family,
    ...(f.bold || e.fauxBold ? { bold: true } : {}), ...(f.italic || e.fauxItalic ? { italic: true } : {}),
    size: e.size, color: e.color, align: e.align, ...(e.box ? { box: e.box } : {}), raw: b.slice(), tf: blk.tf.every(Number.isFinite) ? blk.tf : [1, 0, 0, 1, 0, 0],
  };
}

// ---- Textul rescris pus înapoi în blocul TySh (ca stratul să rămână text și după rescriere) ----

const bytesOf = (s: string) => Array.from(s, (c) => c.charCodeAt(0) & 255);
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function findBytes(b: Uint8Array, pat: number[]): number {
  outer: for (let i = 0; i + pat.length <= b.length; i++) {
    for (let k = 0; k < pat.length; k++) if (b[i + k] !== pat[k]) continue outer;
    return i;
  }
  return -1;
}

/** Sfârșitul șirului din paranteze care începe la `i` (după „(”): poziția lui „)”. */
function parenEnd(t: string, i: number): number {
  for (; i < t.length; i++) { if (t.charCodeAt(i) === 92) i++; else if (t[i] === ')') return i; }
  return -1;
}

/** Lista `[ … ]` care începe la `i`: dicționarele `<< … >>` de pe primul nivel și poziția lui „]”. */
function listDicts(t: string, i: number): { dicts: string[]; end: number } | null {
  const dicts: string[] = [];
  let depth = 0, start = -1;
  for (let k = i + 1; k < t.length; k++) {
    const c = t[k];
    if (c === '(') { k = parenEnd(t, k + 1); if (k < 0) return null; continue; }
    if (c === '<' && t[k + 1] === '<') { if (depth++ === 0) start = k; k++; continue; }
    if (c === '>' && t[k + 1] === '>') { if (--depth === 0) dicts.push(t.slice(start, k + 2)); k++; continue; }
    if (c === ']' && depth === 0) return { dicts, end: k };
  }
  return null;
}

/** În secțiunea `key` (ParagraphRun / StyleRun): câte un șir cu primul stil pentru fiecare lungime din `lens`. */
function setRuns(t: string, key: string, lens: number[]): string | null {
  const at = t.indexOf(key);
  if (at < 0) return t;
  const ra = t.indexOf('/RunArray', at), rl = t.indexOf('/RunLengthArray', at);
  if (ra < 0 || rl < 0) return null;
  const b1 = t.indexOf('[', ra), list = b1 < 0 ? null : listDicts(t, b1);
  const b2 = t.indexOf('[', rl), e2 = b2 < 0 ? -1 : t.indexOf(']', b2);
  if (!list || !list.dicts.length || e2 < 0) return null;
  const parts: [number, number, string][] = [
    [b1, list.end + 1, '[ ' + lens.map(() => list.dicts[0]).join(' ') + ' ]'],
    [b2, e2 + 1, '[ ' + lens.join(' ') + ' ]'],
  ];
  // Întâi bucata de mai la sfârșit, ca pozițiile celeilalte să rămână bune.
  parts.sort((a, b) => b[0] - a[0]);
  for (const [a, b, v] of parts) t = t.slice(0, a) + v + t.slice(b);
  return t;
}

/**
 * Blocul TySh cu alt text: „Txt ” din descriptor și /Text din EngineData primesc cuvintele noi; fiecare paragraf primește
 * stilul primului paragraf, iar tot textul stilul primului șir (aceleași cu care îl desenăm noi). Fontul, mărimea,
 * transformarea și caseta rămân. Un bloc pe care nu-l înțelegem → null (stratul se salvează atunci ca pixeli).
 */
export function retextBlock(raw: Uint8Array, text: string): Uint8Array | null {
  const CR = String.fromCharCode(13);
  const body = text.split(String.fromCharCode(10)).join(CR);
  const ti = findBytes(raw, [0, 0, 0, 0, ...bytesOf('Txt TEXT')]);
  const ei = findBytes(raw, [0, 0, 0, 10, ...bytesOf('EngineDatatdta')]);
  if (ti < 0 || ei < 0 || ei < ti) return null;
  const n = (raw[ti + 12] << 24 | raw[ti + 13] << 16 | raw[ti + 14] << 8 | raw[ti + 15]) >>> 0;
  const tEnd = ti + 16 + n * 2, nul = n > 0 && raw[tEnd - 2] === 0 && raw[tEnd - 1] === 0;
  const en = (raw[ei + 18] << 24 | raw[ei + 19] << 16 | raw[ei + 20] << 8 | raw[ei + 21]) >>> 0;
  const eEnd = ei + 22 + en;
  if (tEnd > ei || eEnd > raw.length) return null;
  let t = '';
  for (let i = ei + 22; i < eEnd; i += 8192) t += String.fromCharCode(...raw.subarray(i, Math.min(eEnd, i + 8192)));
  // /Text: UTF-16 cu BOM, cu ( ) și bara inversă scrise cu o bară inversă în față; textul din EngineData se termină mereu cu un paragraf.
  const full = body + CR;
  const tx = t.indexOf('/Text (');
  const te = tx < 0 ? -1 : parenEnd(t, tx + 7);
  if (te < 0) return null;
  const u16 = [0xfe, 0xff];
  for (let i = 0; i < full.length; i++) { const k = full.charCodeAt(i); u16.push(k >> 8, k & 255); }
  const enc = u16.map((v) => (v === 0x28 || v === 0x29 || v === 0x5c ? String.fromCharCode(92) : '') + String.fromCharCode(v)).join('');
  t = t.slice(0, tx + 7) + enc + t.slice(te);
  const paras = full.split(CR).slice(0, -1).map((p) => p.length + 1);
  const pr = setRuns(t, '/ParagraphRun', paras);
  const sr = pr === null ? null : setRuns(pr, '/StyleRun', [full.length]);
  if (sr === null) return null;
  const words: number[] = [];
  const tw = body + (nul ? String.fromCharCode(0) : '');
  for (let i = 0; i < tw.length; i++) { const k = tw.charCodeAt(i); words.push(k >> 8, k & 255); }
  const out = [
    ...raw.subarray(0, ti + 12), ...be32(words.length / 2), ...words,
    ...raw.subarray(tEnd, ei + 18), ...be32(sr.length), ...bytesOf(sr),
    ...raw.subarray(eEnd),
  ];
  return new Uint8Array(out);
}

/** Mărimea pe ecran (în pixelii pozei): mărimea din fișier × scara transformării. */
export const textPx = (t: PsdText) => t.size * Math.hypot(t.tf[2], t.tf[3]);

/** Desenează textul pe o pânză nouă, cât poza: fontul, culoarea, alinierea și transformarea din fișier. */
export function drawPsdText(w: number, h: number, t: PsdText): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const [a, b, cc, d, e, f] = t.tf;
  ctx.setTransform(a, b, cc, d, e, f);
  ctx.font = `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${t.size}px "${t.family}", Arial, sans-serif`;
  ctx.fillStyle = t.color;
  ctx.textAlign = t.align === 1 ? 'right' : t.align === 2 ? 'center' : 'left';
  ctx.textBaseline = 'alphabetic';
  // În casetă: rândurile pornesc de sus (prima linie de bază cam la o mărime de font) și se aliniază în lățimea ei.
  const bx = t.box, x0 = !bx ? 0 : t.align === 1 ? bx[2] : t.align === 2 ? (bx[0] + bx[2]) / 2 : bx[0], y0 = bx ? bx[1] + t.size * 0.9 : 0;
  // Rândurile prea lungi pentru casetă se rup între cuvinte, la lățimea ei.
  layLines(ctx, t.text, bx ? bx[2] - bx[0] : 0).lines.forEach((line, i) => ctx.fillText(line, x0, y0 + i * t.size * 1.2));
  return c;
}
