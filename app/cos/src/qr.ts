// @ts-nocheck
// Din Cyber Office Studio (src/qr.ts, D-071), neschimbat.
// Coduri QR (standardul ISO/IEC 18004), scrise de noi: text în mod „octeți” (UTF-8), versiunile 1–10 (până la ~270 de octeți),
// nivelurile de corecție L / M / Q / H, masca aleasă după penalizările din standard. Folosit de PDF (câmp cod de bare),
// Docs și Slides (pune un cod QR). Testat în tests/qr.test.mjs.

export type QrLevel = 'L' | 'M' | 'Q' | 'H';

// Pe fiecare versiune (1–10) și nivel: [octeți de corecție pe bloc, blocuri în grupa 1, octeți de date pe bloc în grupa 1,
// blocuri în grupa 2 (cu un octet de date în plus)].
const BLOCKS: Record<QrLevel, [number, number, number, number][]> = {
  L: [[7, 1, 19, 0], [10, 1, 34, 0], [15, 1, 55, 0], [20, 1, 80, 0], [26, 1, 108, 0], [18, 2, 68, 0], [20, 2, 78, 0], [24, 2, 97, 0], [30, 2, 116, 0], [18, 2, 68, 2]],
  M: [[10, 1, 16, 0], [16, 1, 28, 0], [26, 1, 44, 0], [18, 2, 32, 0], [24, 2, 43, 0], [16, 4, 27, 0], [18, 4, 31, 0], [22, 2, 38, 2], [22, 3, 36, 2], [26, 4, 43, 1]],
  Q: [[13, 1, 13, 0], [22, 1, 22, 0], [18, 2, 17, 0], [26, 2, 24, 0], [18, 2, 15, 2], [24, 4, 19, 0], [18, 2, 14, 4], [22, 4, 18, 2], [20, 4, 16, 4], [24, 6, 19, 2]],
  H: [[17, 1, 9, 0], [28, 1, 16, 0], [22, 2, 13, 0], [16, 4, 9, 0], [22, 2, 11, 2], [28, 4, 15, 0], [26, 4, 13, 1], [26, 4, 14, 2], [24, 4, 12, 4], [28, 6, 15, 2]],
};
// Centrele modelelor de aliniere (versiunea 1 nu are).
const ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const LEVEL_BITS: Record<QrLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };
export const QR_MAX_VERSION = 10;

/** Câți octeți de date încap într-o versiune / un nivel. */
export const qrDataBytes = (version: number, level: QrLevel) => {
  const [, b1, d1, b2] = BLOCKS[level][version - 1];
  return b1 * d1 + b2 * (d1 + 1);
};

// Corpul Galois GF(256) cu polinomul x^8 + x^4 + x^3 + x^2 + 1 (0x11D).
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const gmul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** Octeții de corecție Reed–Solomon pentru un bloc de date. */
export function rsEcc(data: number[], n: number): number[] {
  // Generatorul: produsul (x - α^i), i = 0 … n-1; coeficienții de la gradul cel mai mare (fără primul, care e 1).
  let gen = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(gen.length + 1).fill(0);
    gen.forEach((g, j) => { next[j] ^= g; next[j + 1] ^= gmul(g, EXP[i]); });
    gen = next;
  }
  const rest = new Array(n).fill(0);
  for (const d of data) {
    const f = d ^ rest[0];
    rest.shift(); rest.push(0);
    for (let j = 0; j < n; j++) rest[j] ^= gmul(gen[j + 1], f);
  }
  return rest;
}

/** Cei 15 biți de format (nivelul și masca, cu corecția BCH și masca 0x5412). */
export function formatBits(level: QrLevel, mask: number): number {
  const d = (LEVEL_BITS[level] << 3) | mask;
  let r = d << 10;
  for (let i = 14; i >= 10; i--) if (r & (1 << i)) r ^= 0x537 << (i - 10);
  return ((d << 10) | r) ^ 0x5412;
}

/** Cei 18 biți de versiune (de la versiunea 7). */
export function versionBits(version: number): number {
  let r = version << 12;
  for (let i = 17; i >= 12; i--) if (r & (1 << i)) r ^= 0x1f25 << (i - 12);
  return (version << 12) | r;
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];
export const qrMask = (m: number, r: number, c: number) => MASKS[m](r, c);

/** Cuvintele de cod finale: datele (mod octeți, lungimea, terminatorul, completarea 0xEC / 0x11), împărțite în blocuri și
 *  întrețesute, urmate de corecția fiecărui bloc, tot întrețesută. */
export function qrCodewords(bytes: number[], version: number, level: QrLevel): number[] {
  const cap = qrDataBytes(version, level);
  const bits: number[] = [];
  const put = (v: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(0b0100, 4); put(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, cap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let k = 0; data.length < cap; k++) data.push(k % 2 ? 0x11 : 0xec);
  const [ecn, b1, d1, b2] = BLOCKS[level][version - 1];
  const blocks: number[][] = [];
  let at = 0;
  for (let b = 0; b < b1 + b2; b++) { const len = b < b1 ? d1 : d1 + 1; blocks.push(data.slice(at, at + len)); at += len; }
  const eccs = blocks.map((b) => rsEcc(b, ecn));
  const out: number[] = [];
  for (let i = 0; i <= d1; i++) blocks.forEach((b) => { if (i < b.length) out.push(b[i]); });
  for (let i = 0; i < ecn; i++) eccs.forEach((e) => out.push(e[i]));
  return out;
}

export interface QrCode { size: number; version: number; level: QrLevel; mask: number; dark: boolean[][] }

/** Codul QR pentru un text: cea mai mică versiune în care încape la nivelul ales. null dacă textul e prea lung. */
export function makeQr(text: string, level: QrLevel = 'M', forceMask?: number): QrCode | null {
  const bytes = [...new TextEncoder().encode(text)];
  let version = 1;
  while (version <= QR_MAX_VERSION && qrDataBytes(version, level) < bytes.length + (version < 10 ? 2 : 3)) version++;
  if (version > QR_MAX_VERSION) return null;
  const size = 17 + 4 * version;
  const dark = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (r: number, c: number, v: boolean) => { if (r >= 0 && c >= 0 && r < size && c < size) { dark[r][c] = v; fixed[r][c] = true; } };
  // Cele trei pătrate de găsire (cu marginea albă din jur), liniile de sincronizare, modelele de aliniere.
  for (const [r0, c0] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const d = Math.max(Math.abs(r - 3), Math.abs(c - 3));
      set(r0 + r, c0 + c, d !== 2 && d !== 4);
    }
  }
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const al = ALIGN[version - 1];
  for (const r of al) for (const c of al) {
    if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (r === al[al.length - 1] && c === 6)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }
  // Locurile pentru format (completate după alegerea măștii), modulul negru fix și versiunea.
  const drawFormat = (mask: number) => {
    const f = formatBits(level, mask), bit = (i: number) => ((f >>> i) & 1) === 1;
    for (let i = 0; i < 6; i++) set(i, 8, bit(i));
    set(7, 8, bit(6)); set(8, 8, bit(7)); set(8, 7, bit(8));
    for (let i = 9; i < 15; i++) set(8, 14 - i, bit(i));
    for (let i = 0; i < 8; i++) set(8, size - 1 - i, bit(i));
    for (let i = 8; i < 15; i++) set(size - 15 + i, 8, bit(i));
    set(size - 8, 8, true);
  };
  drawFormat(0);
  if (version >= 7) {
    const v = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const b = ((v >>> i) & 1) === 1, a = size - 11 + (i % 3), q = Math.floor(i / 3);
      set(q, a, b); set(a, q, b);
    }
  }
  // Datele: în zigzag, câte două coloane, de jos în sus și apoi de sus în jos, sărind coloana de sincronizare.
  const words = qrCodewords(bytes, version, level);
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const up = ((right + 1) & 2) === 0;
    for (let v = 0; v < size; v++) {
      const r = up ? size - 1 - v : v;
      for (const c of [right, right - 1]) {
        if (fixed[r][c]) continue;
        dark[r][c] = k < words.length * 8 && ((words[k >>> 3] >>> (7 - (k & 7))) & 1) === 1;
        k++;
      }
    }
  }
  const flip = (m: number) => { for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!fixed[r][c] && MASKS[m](r, c)) dark[r][c] = !dark[r][c]; };
  let best = forceMask ?? 0;
  if (forceMask === undefined) {
    let bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      flip(m); drawFormat(m);
      const s = penalty(dark);
      if (s < bestScore) { bestScore = s; best = m; }
      flip(m);
    }
  }
  flip(best); drawFormat(best);
  return { size, version, level, mask: best, dark };
}

/** Penalizările din standard: șiruri lungi de aceeași culoare, pătrate 2×2, modele ca cele de găsire, echilibrul alb / negru. */
function penalty(d: boolean[][]): number {
  const n = d.length;
  let p = 0, darkCount = 0;
  const line = (get: (i: number) => boolean) => {
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && get(i) === get(i - 1)) run++;
      else { if (run >= 5) p += run - 2; run = 1; }
    }
    for (let i = 0; i + 10 < n; i++) {
      const s = Array.from({ length: 11 }, (_, j) => (get(i + j) ? 1 : 0)).join('');
      if (s === '10111010000' || s === '00001011101') p += 40;
    }
  };
  for (let r = 0; r < n; r++) { line((i) => d[r][i]); line((i) => d[i][r]); }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (d[r][c]) darkCount++;
    if (r + 1 < n && c + 1 < n && d[r][c] === d[r][c + 1] && d[r][c] === d[r + 1][c] && d[r][c] === d[r + 1][c + 1]) p += 3;
  }
  p += Math.floor(Math.abs(darkCount * 20 - n * n * 10) / (n * n)) * 10;
  return p;
}

/** Codul ca imagine SVG (pătratele negre ca un singur drum), cu marginea albă de 4 module cerută de standard. */
export function qrSvg(q: QrCode, px = 4, dark = '#000', light = '#fff'): string {
  const n = q.size + 8, w = n * px;
  let path = '';
  for (let r = 0; r < q.size; r++) for (let c = 0; c < q.size; c++) if (q.dark[r][c]) path += `M${c + 4} ${r + 4}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}

function qrCanvas(q: QrCode, px: number): HTMLCanvasElement {
  const n = (q.size + 8) * px, cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, n, n); g.fillStyle = '#000';
  for (let r = 0; r < q.size; r++) for (let c = 0; c < q.size; c++) if (q.dark[r][c]) g.fillRect((c + 4) * px, (r + 4) * px, px, px);
  return cv;
}

/** Codul ca poză PNG (pentru documente, slide-uri, PDF): `px` pixeli pe modul, cu marginea albă de 4 module. Doar în pagină. */
export function qrPng(q: QrCode, px = 8): Promise<Blob> {
  const cv = qrCanvas(q, px);
  return new Promise((ok, bad) => cv.toBlob((b) => (b ? ok(b) : bad(new Error('PNG'))), 'image/png'));
}

/** Același PNG, ca adresă data: (fără încărcarea unei imagini, deci merge și când fereastra e ascunsă). */
export const qrDataUrl = (q: QrCode, px = 8) => qrCanvas(q, px).toDataURL('image/png');
