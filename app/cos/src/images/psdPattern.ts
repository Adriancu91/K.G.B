// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Modelele (pattern) păstrate chiar în fișierul .psd (blocurile „Patt” / „Pat2” / „Pat3” de la sfârșitul straturilor):
// fiecare e o poză mică, cu un identificator. Straturile de umplere cu model (blocul „PtFl”) o repetă pe toată poza.

/** Un model: poza lui (RGBA), cu identificatorul din fișier. */
export interface PsdPattern { w: number; h: number; rgba: Uint8ClampedArray }

/** Stratul de umplere cu model, cum e scris în fișier: ce model, scara (procente) și mutarea (pixeli). */
export interface PsdPatternFill { id: string; scale: number; phase: [number, number] }

const MAX_SIDE = 4096;

/** Desface PackBits: din b[s..e) în out[o..o+len). */
function unpack(b: Uint8Array, s: number, e: number, out: Uint8Array, o: number, len: number) {
  let p = s, q = o;
  const end = o + len;
  while (p < e && q < end) {
    const n = b[p++];
    if (n < 128) { const k = Math.min(n + 1, end - q, e - p); out.set(b.subarray(p, p + k), q); q += k; p += n + 1; }
    else if (n > 128) { const k = Math.min(257 - n, end - q); out.fill(b[p++], q, q + k); q += k; }
  }
}

/** Toate modelele dintr-un bloc; un model stricat se sare (celelalte rămân). */
export function readPatterns(b: Uint8Array, into: Map<string, PsdPattern>): void {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 0;
  while (p + 4 <= b.length) {
    const len = v.getUint32(p), start = p + 4, next = start + len + ((4 - (len % 4)) % 4);
    if (len < 16 || start + len > b.length) break;
    try {
      const pat = readOne(b, v, start, start + len);
      if (pat) into.set(pat.id, pat.pat);
    } catch { /* model stricat: îl sărim */ }
    p = next;
  }
}

function readOne(b: Uint8Array, v: DataView, p: number, end: number): { id: string; pat: PsdPattern } | null {
  if (v.getUint32(p) !== 1) return null;
  const mode = v.getUint32(p + 4), h = v.getUint16(p + 8), w = v.getUint16(p + 10);
  p += 12;
  const nameLen = v.getUint32(p); p += 4 + nameLen * 2;
  const idLen = b[p]; const id = String.fromCharCode(...b.subarray(p + 1, p + 1 + idLen)); p += 1 + idLen;
  let pal: Uint8Array | null = null;
  if (mode === 2) { pal = b.subarray(p, p + 768); p += 768; if (v.getUint32(p) !== 3) p += 4; }
  if (!w || !h || w > MAX_SIDE || h > MAX_SIDE) return null;
  // Lista de canale („virtual memory array list”): versiunea 3, lungimea, dreptunghiul, câte canale.
  if (v.getUint32(p) !== 3) return null;
  const top = v.getUint32(p + 8), left = v.getUint32(p + 12), bottom = v.getUint32(p + 16), right = v.getUint32(p + 20);
  const nch = v.getUint32(p + 24);
  p += 28;
  const cw = right - left, chh = bottom - top;
  if (cw !== w || chh !== h) return null;
  const chans: (Uint8Array | null)[] = [];
  // Canalele de culoare, apoi două măști (a utilizatorului și a foii): prima mască e transparența modelului.
  for (let c = 0; c < nch + 2 && p + 8 <= end; c++) {
    const written = v.getUint32(p); p += 4;
    if (!written) { chans.push(null); continue; }
    const clen = v.getUint32(p); p += 4;
    if (!clen) { chans.push(null); continue; }
    const cend = p + clen;
    const depth = v.getUint32(p);
    const ct = v.getUint32(p + 4), cl = v.getUint32(p + 8), cb = v.getUint32(p + 12), cr = v.getUint32(p + 16);
    const comp = b[p + 22];
    const rw = cr - cl, rh = cb - ct, bpp = depth === 16 ? 2 : 1;
    let d = p + 23;
    const raw = new Uint8Array(rw * rh * bpp);
    if (comp === 0) raw.set(b.subarray(d, Math.min(cend, d + raw.length)));
    else if (comp === 1) {
      let q = d + rh * 2;
      for (let y = 0; y < rh; y++) { const n = v.getUint16(d + y * 2); unpack(b, q, Math.min(q + n, cend), raw, y * rw * bpp, rw * bpp); q += n; }
    } else { chans.push(null); p = cend; continue; }
    let ch = raw;
    if (bpp === 2) { ch = new Uint8Array(rw * rh); for (let i = 0; i < ch.length; i++) ch[i] = raw[i * 2]; }
    chans.push(rw === w && rh === h ? ch : null);
    p = cend;
  }
  const rgba = new Uint8ClampedArray(w * h * 4);
  const a = chans[nch];
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (mode === 3) { rgba[o] = chans[0]?.[i] ?? 0; rgba[o + 1] = chans[1]?.[i] ?? 0; rgba[o + 2] = chans[2]?.[i] ?? 0; }
    else if (mode === 2 && pal) { const k = chans[0]?.[i] ?? 0; rgba[o] = pal[k]; rgba[o + 1] = pal[256 + k]; rgba[o + 2] = pal[512 + k]; }
    else if (mode === 4) {
      // CMYK (scris întors: 255 = fără cerneală), trecut simplu în RGB.
      const k = (chans[3]?.[i] ?? 255) / 255;
      rgba[o] = (chans[0]?.[i] ?? 255) * k; rgba[o + 1] = (chans[1]?.[i] ?? 255) * k; rgba[o + 2] = (chans[2]?.[i] ?? 255) * k;
    } else { const g = chans[0]?.[i] ?? 0; rgba[o] = g; rgba[o + 1] = g; rgba[o + 2] = g; }
    rgba[o + 3] = a ? a[i] : 255;
  }
  return { id, pat: { w, h, rgba } };
}

/** Pixelii unui model în base64 (ca să poată fi păstrați în proiect, ca text). */
export function patternB64(p: PsdPattern): string {
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const b = p.rgba;
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += T[(n >> 18) & 63] + T[(n >> 12) & 63] + (i + 1 < b.length ? T[(n >> 6) & 63] : '=') + (i + 2 < b.length ? T[n & 63] : '=');
  }
  return out;
}

/** Descriptorul blocului „PtFl” → ce model și cum; fără identificator → null. */
export function patternFillOf(d: Record<string, unknown> | null): PsdPatternFill | null {
  const o = (x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
  const n = (x: unknown, def: number) => (typeof x === 'number' && Number.isFinite(x) ? x : def);
  const pt = o(d?.Ptrn);
  if (!pt || typeof pt.Idnt !== 'string') return null;
  const ph = o(d?.phase);
  return { id: pt.Idnt, scale: Math.max(1, n(d?.['Scl '], 100)), phase: [n(ph?.Hrzn, 0), n(ph?.Vrtc, 0)] };
}

/** Modelul repetat pe o poză w × h (de la colțul pozei, cu scara și mutarea lui). */
export function drawPatternFill(pat: PsdPattern, f: PsdPatternFill, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  const s = f.scale / 100, pw = pat.w, ph = pat.h;
  const mod = (a: number, m: number) => ((a % m) + m) % m;
  for (let y = 0; y < h; y++) {
    const py = mod(Math.floor((y - f.phase[1]) / s), ph);
    for (let x = 0; x < w; x++) {
      const px = mod(Math.floor((x - f.phase[0]) / s), pw);
      const i = (py * pw + px) * 4, o = (y * w + x) * 4;
      out[o] = pat.rgba[i]; out[o + 1] = pat.rgba[i + 1]; out[o + 2] = pat.rgba[i + 2]; out[o + 3] = pat.rgba[i + 3];
    }
  }
  return out;
}
