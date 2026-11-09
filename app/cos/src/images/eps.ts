// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Deschiderea fișierelor .eps (PostScript încapsulat) în Imagini, fără să rulăm PostScript-ul din ele.
// Un .eps e un program de desenare; noi nu avem (și nu vrem) un interpretor PostScript, așa că luăm poza pe care fișierul
// o poartă deja, în ordinea asta:
//  1. „%ImageData:” — pozele salvate ca .eps din programele de editat poze au toți pixelii scriși în fișier (binar, hex sau
//     ASCII85), la mărimea lor reală;
//  2. previzualizarea TIFF din antetul binar (fișierele care încep cu C5 D0 D3 C6);
//  3. previzualizarea EPSI („%%BeginPreview:”, hex, 1–8 biți, de obicei alb-negru);
//  4. miniatura din metadatele XMP (JPEG mic, pus de programele de desen vectorial).
// Totul e cod propriu și nu depinde de DOM, ca să se poată testa în Node.

export class EpsError extends Error {}

export type EpsPicture =
  | { kind: 'rgba'; w: number; h: number; data: Uint8ClampedArray; source: 'imagedata' | 'epsi' }
  | { kind: 'tiff' | 'jpeg'; bytes: Uint8Array; source: 'tiff' | 'xmp' };

const MAX_PIXELS = 100_000_000;

/** Fișier .eps: antetul binar (DOS) sau textul „%!PS-Adobe… EPSF”. */
export function isEps(b: Uint8Array): boolean {
  if (b.length >= 30 && b[0] === 0xc5 && b[1] === 0xd0 && b[2] === 0xd3 && b[3] === 0xc6) return true;
  const head = latin1(b, 0, Math.min(b.length, 64));
  // Și fișierele vechi fără „EPSF” în primul rând, dar cu chenarul desenului (%%BoundingBox) în antet.
  return /^%!PS-Adobe-\d\.\d\s+EPSF/.test(head) || (/^%!PS-Adobe-\d\.\d/.test(head) && /%%BoundingBox:/.test(latin1(b, 0, Math.min(b.length, 2048))));
}

function latin1(b: Uint8Array, start: number, end: number): string {
  let s = '';
  for (let i = start; i < end; i += 8192) s += String.fromCharCode(...b.subarray(i, Math.min(end, i + 8192)));
  return s;
}

const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Bounding box-ul desenului, în puncte (1/72 inch), dacă fișierul îl spune; util în mesajul pentru utilizator. */
export function epsBoundingBox(b: Uint8Array): { w: number; h: number } | null {
  const { ps } = split(b);
  const m = /%%(?:HiRes)?BoundingBox:\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(latin1(ps, 0, Math.min(ps.length, 65536)));
  if (!m) return null;
  const w = Math.abs(+m[3] - +m[1]), h = Math.abs(+m[4] - +m[2]);
  return w > 0 && h > 0 ? { w, h } : null;
}

/** Partea PostScript și previzualizarea TIFF (dacă e un .eps cu antet binar). */
function split(b: Uint8Array): { ps: Uint8Array; tiff: Uint8Array | null } {
  if (!(b[0] === 0xc5 && b[1] === 0xd0 && b[2] === 0xd3 && b[3] === 0xc6) || b.length < 30) return { ps: b, tiff: null };
  const psStart = u32(b, 4), psLen = u32(b, 8), tStart = u32(b, 20), tLen = u32(b, 24);
  const ps = psStart < b.length ? b.subarray(psStart, Math.min(b.length, psStart + psLen)) : new Uint8Array(0);
  const tiff = tLen > 8 && tStart + tLen <= b.length ? b.subarray(tStart, tStart + tLen) : null;
  return { ps, tiff };
}

/** Găsește poza din fișier. Aruncă EpsError cu un mesaj clar dacă nu are niciuna. */
export function readEps(b: Uint8Array): EpsPicture {
  const { ps, tiff } = split(b);
  const text = latin1(ps, 0, ps.length);
  const img = imageData(ps, text);
  if (img) return img;
  if (tiff) return { kind: 'tiff', bytes: tiff, source: 'tiff' };
  const epsi = epsiPreview(text);
  if (epsi) return epsi;
  const xmp = xmpThumb(text);
  if (xmp) return { kind: 'jpeg', bytes: xmp, source: 'xmp' };
  throw new EpsError('Fișierul .eps conține doar desen PostScript, fără o poză în el, și nu-l putem desena aici. Salvează-l ca PDF sau SVG din programul în care a fost făcut și deschide-l pe acela.');
}

// ---- 1. %ImageData: <coloane> <rânduri> <biți> <mod> <canale în plus> <bloc> <codare> "<începutul datelor>" ----

function imageData(ps: Uint8Array, text: string): EpsPicture | null {
  const m = /%ImageData:\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+"([^"]*)"/.exec(text);
  if (!m) return null;
  const [w, h, depth, mode, pad, block, enc] = m.slice(1, 8).map(Number);
  const start = m[8];
  // Modul: 1 = tonuri de gri (sau alb-negru la 1 bit), 3 = RGB, 4 = CMYK; Lab (2) îl lăsăm pe seama previzualizării.
  const colorCh = mode === 1 ? 1 : mode === 3 ? 3 : mode === 4 ? 4 : 0;
  if (!colorCh || !(depth === 1 || depth === 8) || (depth === 1 && colorCh !== 1) || !w || !h || w * h > MAX_PIXELS) return null;
  const ch = colorCh + pad;
  // Datele încep pe rândul de după cel care conține exact textul dintre ghilimele (după comentariul %ImageData).
  let at = m.index + m[0].length, from = -1;
  while ((at = text.indexOf(start, at)) >= 0) {
    let j = at + start.length;
    while (text[j] === ' ' || text[j] === '\t') j++;
    const before = text[at - 1];
    if ((before === '\n' || before === '\r') && (text[j] === '\r' || text[j] === '\n')) {
      if (text[j] === '\r' && text[j + 1] === '\n') j++;
      from = j + 1;
      break;
    }
    at += start.length;
  }
  if (from < 0) return null;
  const rowBytes = Math.ceil((w * depth) / 8);
  const interleaved = ch > 1 && block < rowBytes;
  const need = interleaved ? Math.ceil((w * ch * depth) / 8) * h : rowBytes * ch * h;
  // Codarea: 1 = binar, 2 = hex, 7 = ASCII85; unele programe scriu hex deși spun „binar”, așa că ne uităm la date.
  let raw: Uint8Array | null;
  const peek = text.slice(from, from + 256);
  if (enc === 7) raw = ascii85(text, from, need);
  else if (enc === 2 || looksHex(peek, need)) raw = hex(text, from, need);
  else if (enc === 1) raw = from + need <= ps.length ? ps.subarray(from, from + need) : null;
  else raw = null;
  if (!raw || raw.length < need) return null;
  // Decode [1 0] = valorile sunt inversate (la alb-negru: 1 = negru).
  const invert = colorCh === 1 && /\/Decode\s*\[\s*1\s+0\s*\]/.test(text.slice(Math.max(0, from - 3000), from));
  const out = new Uint8ClampedArray(w * h * 4);
  // Valoarea eșantionului numărul i, începând de la octetul o (la 1 bit: 0 sau 255).
  const px = raw;
  const sample = (o: number, i: number) => (depth === 8 ? px[o + i] : (px[o + (i >> 3)] >> (7 - (i & 7))) & 1 ? 255 : 0);
  const rb = Math.ceil((w * ch * depth) / 8), v = [0, 0, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < colorCh; c++) v[c] = interleaved ? sample(y * rb, x * ch + c) : sample((y * ch + c) * rowBytes, x);
      const p = (y * w + x) * 4;
      if (colorCh === 1) { const g = invert ? 255 - v[0] : v[0]; out[p] = out[p + 1] = out[p + 2] = g; }
      else if (colorCh === 3) { out[p] = v[0]; out[p + 1] = v[1]; out[p + 2] = v[2]; }
      else {
        // CMYK ca în PostScript: 0 = fără cerneală.
        const k = 1 - v[3] / 255;
        out[p] = (255 - v[0]) * k; out[p + 1] = (255 - v[1]) * k; out[p + 2] = (255 - v[2]) * k;
      }
      out[p + 3] = 255;
    }
  }
  return { kind: 'rgba', w, h, data: out, source: 'imagedata' };
}

/** Datele sunt scrise ca hex (doar cifre hex și spații în primele caractere), chiar dacă antetul spune altceva. */
function looksHex(peek: string, need: number): boolean {
  const t = peek.replace(/\s+/g, '').slice(0, Math.min(64, need * 2));
  return t.length >= Math.min(64, need * 2) && /^[0-9a-fA-F]+$/.test(t);
}

function hex(text: string, from: number, need: number): Uint8Array {
  const out = new Uint8Array(need);
  let n = 0, hi = -1;
  for (let i = from; i < text.length && n < need; i++) {
    const c = text.charCodeAt(i);
    const d = c >= 48 && c <= 57 ? c - 48 : c >= 97 && c <= 102 ? c - 87 : c >= 65 && c <= 70 ? c - 55 : -1;
    if (d < 0) { if (c > 32) break; continue; }
    if (hi < 0) hi = d; else { out[n++] = (hi << 4) | d; hi = -1; }
  }
  return out.subarray(0, n);
}

function ascii85(text: string, from: number, need: number): Uint8Array {
  const out = new Uint8Array(need + 4);
  let n = 0, k = 0, acc = 0;
  for (let i = from; i < text.length && n < need; i++) {
    const c = text.charCodeAt(i);
    if (c <= 32) continue;
    if (c === 126) break; // „~>”: sfârșitul
    if (c === 122 && k === 0) { n += 4; continue; } // „z” = patru zerouri
    if (c < 33 || c > 117) break;
    acc = acc * 85 + (c - 33);
    if (++k === 5) { out[n++] = acc >>> 24; out[n++] = (acc >>> 16) & 255; out[n++] = (acc >>> 8) & 255; out[n++] = acc & 255; acc = 0; k = 0; }
  }
  if (k > 1) {
    for (let j = k; j < 5; j++) acc = acc * 85 + 84;
    const bytes = [acc >>> 24, (acc >>> 16) & 255, (acc >>> 8) & 255, acc & 255];
    for (let j = 0; j < k - 1; j++) out[n++] = bytes[j];
  }
  return out.subarray(0, Math.min(n, need));
}

// ---- 3. Previzualizarea EPSI: %%BeginPreview: <lățime> <înălțime> <biți> <rânduri>, apoi rânduri „% <hex>” ----

function epsiPreview(text: string): EpsPicture | null {
  const m = /%%BeginPreview:\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/.exec(text);
  if (!m) return null;
  const [w, h, depth] = m.slice(1, 4).map(Number);
  if (!w || !h || ![1, 2, 4, 8].includes(depth) || w * h > MAX_PIXELS) return null;
  const end = text.indexOf('%%EndPreview', m.index);
  const body = text.slice(m.index + m[0].length, end < 0 ? undefined : end).replace(/(^|[\r\n])%/g, '$1');
  const rowBytes = Math.ceil((w * depth) / 8);
  const raw = hex(body, 0, rowBytes * h);
  if (raw.length < rowBytes * h) return null;
  const out = new Uint8ClampedArray(w * h * 4), max = (1 << depth) - 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const bit = x * depth, byte = raw[y * rowBytes + (bit >> 3)];
    const v = (byte >> (8 - depth - (bit & 7))) & max;
    // În EPSI, 0 = alb și valoarea cea mai mare = negru.
    const g = 255 - Math.round((v * 255) / max), p = (y * w + x) * 4;
    out[p] = out[p + 1] = out[p + 2] = g; out[p + 3] = 255;
  }
  return { kind: 'rgba', w, h, data: out, source: 'epsi' };
}

// ---- 4. Miniatura XMP: <xmpGImg:image>base64 JPEG</xmpGImg:image> ----

function xmpThumb(text: string): Uint8Array | null {
  const m = /<xmpGImg:image>([\s\S]*?)<\/xmpGImg:image>/.exec(text);
  if (!m) return null;
  const b64 = m[1].replace(/&#xA;|&#10;|&#xD;|&#13;|\s/g, '');
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out[0] === 0xff && out[1] === 0xd8 ? out : null;
  } catch {
    return null;
  }
}
