// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Pozele .tga (Truevision TARGA): folosite în jocuri, grafică 3D, video și programe vechi. Cod propriu, pe pixelii RGBA.
// Citire: necomprimat sau RLE; culori (15 / 16 / 24 / 32 de biți), tonuri de gri (8 / 16 biți) și paletă (8 biți);
// rândurile de sus în jos sau de jos în sus, de la stânga sau de la dreapta. Scriere: RLE, 32 de biți dacă poza are
// transparență, altfel 24 (ca „Save As → Targa” cu compresie).

export class TgaError extends Error {}

export interface TgaImage { width: number; height: number; data: Uint8ClampedArray }

/** Cea mai mare poză pe care o citim (ca un antet stricat să nu ceară gigaocteți de memorie). */
const MAX_PIXELS = 100_000_000;

/** Antetul pare de TGA: tipul, adâncimea și mărimile au valori posibile (TGA nu are o semnătură la început). */
export function looksLikeTga(b: Uint8Array): boolean {
  if (b.length < 18) return false;
  // TGA 2.0: semnătura de la sfârșit.
  const foot = 'TRUEVISION-XFILE.';
  if (b.length >= 26) {
    let ok = true;
    for (let i = 0; i < foot.length; i++) if (b[b.length - 18 + i] !== foot.charCodeAt(i)) { ok = false; break; }
    if (ok) return true;
  }
  const cmType = b[1], type = b[2], bpp = b[16];
  const w = b[12] | (b[13] << 8), h = b[14] | (b[15] << 8);
  if (cmType > 1 || w === 0 || h === 0) return false;
  if (![1, 2, 3, 9, 10, 11].includes(type)) return false;
  if ((type === 1 || type === 9) && (cmType !== 1 || bpp !== 8)) return false;
  if ((type === 2 || type === 10) && ![15, 16, 24, 32].includes(bpp)) return false;
  if ((type === 3 || type === 11) && ![8, 16].includes(bpp)) return false;
  if ((b[17] & 0xc0) !== 0) return false; // biții de întrețesere (nefolosiți) trebuie să fie 0
  return true;
}

export function decodeTga(b: Uint8Array): TgaImage {
  if (!looksLikeTga(b)) throw new TgaError('Fișierul .tga e deteriorat sau are un fel pe care nu-l cunoaștem.');
  const idLen = b[0], cmType = b[1], type = b[2];
  const cmFirst = b[3] | (b[4] << 8), cmLen = b[5] | (b[6] << 8), cmBits = b[7];
  const w = b[12] | (b[13] << 8), h = b[14] | (b[15] << 8), bpp = b[16], desc = b[17];
  if (w * h > MAX_PIXELS) throw new TgaError(`Poza .tga e prea mare (${w} × ${h} pixeli).`);
  let p = 18 + idLen;
  // Paleta: culorile pe 15 / 16 / 24 / 32 de biți, ca RGBA.
  let pal: Uint8Array | null = null;
  if (cmType === 1) {
    const cb = Math.ceil(cmBits / 8);
    if (![2, 3, 4].includes(cb)) throw new TgaError('Paleta din fișierul .tga are un fel pe care nu-l cunoaștem.');
    pal = new Uint8Array((cmFirst + cmLen) * 4);
    for (let i = 0; i < cmLen; i++, p += cb) {
      if (p + cb > b.length) throw new TgaError('Fișierul .tga e tăiat (paleta nu e întreagă).');
      readPixel(b, p, cb, cmBits, false, pal, (cmFirst + i) * 4);
    }
  }
  const pb = Math.ceil(bpp / 8);
  const gray = type === 3 || type === 11, mapped = type === 1 || type === 9, rle = type >= 9;
  // Biții de transparență din descriptor; 0 = fără canal alfa (unele programe scriu 32 de biți cu alfa 0 peste tot).
  const alphaBits = desc & 0x0f;
  const n = w * h, raw = new Uint8Array(n * 4);
  const put = (src: number, dst: number) => {
    if (mapped) {
      const k = b[src] | (pb > 1 ? b[src + 1] << 8 : 0);
      if (!pal || k >= pal.length / 4) { raw[dst + 3] = 0; return; }
      raw[dst] = pal[k * 4]; raw[dst + 1] = pal[k * 4 + 1]; raw[dst + 2] = pal[k * 4 + 2]; raw[dst + 3] = pal[k * 4 + 3];
    } else if (gray) {
      raw[dst] = raw[dst + 1] = raw[dst + 2] = b[src];
      raw[dst + 3] = pb === 2 && alphaBits ? b[src + 1] : 255;
    } else readPixel(b, src, pb, bpp, alphaBits > 0, raw, dst);
  };
  let i = 0;
  if (!rle) {
    if (p + n * pb > b.length) throw new TgaError('Fișierul .tga e tăiat (lipsesc pixeli).');
    for (; i < n; i++, p += pb) put(p, i * 4);
  } else {
    while (i < n) {
      if (p >= b.length) throw new TgaError('Fișierul .tga e tăiat (lipsesc pixeli).');
      const c = b[p++], cnt = (c & 0x7f) + 1;
      if (c & 0x80) {
        if (p + pb > b.length) throw new TgaError('Fișierul .tga e tăiat (lipsesc pixeli).');
        for (let k = 0; k < cnt && i < n; k++, i++) put(p, i * 4);
        p += pb;
      } else {
        if (p + cnt * pb > b.length) throw new TgaError('Fișierul .tga e tăiat (lipsesc pixeli).');
        for (let k = 0; k < cnt && i < n; k++, i++, p += pb) put(p, i * 4);
      }
    }
  }
  // Poza e scrisă de jos în sus (bitul 5 = 0) și / sau de la dreapta la stânga (bitul 4 = 1): o întoarcem.
  const top = (desc & 0x20) !== 0, right = (desc & 0x10) !== 0;
  const out = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < h; y++) {
    const sy = top ? y : h - 1 - y;
    for (let x = 0; x < w; x++) {
      const sx = right ? w - 1 - x : x, s = (sy * w + sx) * 4, d = (y * w + x) * 4;
      out[d] = raw[s]; out[d + 1] = raw[s + 1]; out[d + 2] = raw[s + 2]; out[d + 3] = raw[s + 3];
    }
  }
  // 32 de biți cu alfa declarat, dar 0 peste tot: e de fapt o poză fără transparență (altfel ar ieși invizibilă).
  if (!gray && !mapped && pb === 4) {
    let any = false;
    for (let k = 3; k < out.length; k += 4) if (out[k] !== 0) { any = true; break; }
    if (!any) for (let k = 3; k < out.length; k += 4) out[k] = 255;
  }
  return { width: w, height: h, data: out };
}

/** Un pixel BGR(A) din fișier → RGBA. 15 / 16 biți: 5 biți pe culoare, bitul de sus = alfa (doar dacă e declarat). */
function readPixel(b: Uint8Array, s: number, pb: number, bits: number, alpha: boolean, out: Uint8Array, d: number) {
  if (pb === 2) {
    const v = b[s] | (b[s + 1] << 8);
    out[d] = (((v >> 10) & 31) * 255 / 31) | 0;
    out[d + 1] = (((v >> 5) & 31) * 255 / 31) | 0;
    out[d + 2] = ((v & 31) * 255 / 31) | 0;
    out[d + 3] = bits === 16 && alpha ? (v & 0x8000 ? 255 : 0) : 255;
  } else {
    out[d] = b[s + 2]; out[d + 1] = b[s + 1]; out[d + 2] = b[s];
    out[d + 3] = pb === 4 && (alpha || bits === 32) ? b[s + 3] : 255;
  }
}

/** TGA cu compresie RLE: 32 de biți (cu transparență) dacă poza are pixeli transparenți, altfel 24; rândurile de sus în jos. */
export function encodeTGA(d: Uint8ClampedArray, w: number, h: number): Uint8Array {
  let alpha = false;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) { alpha = true; break; }
  const pb = alpha ? 4 : 3, n = w * h;
  // În cel mai rău caz fiecare pachet de 128 de pixeli are un octet în plus.
  const out = new Uint8Array(18 + n * pb + Math.ceil(n / 128) + w + 26);
  out[2] = 10; // culori, RLE
  out[12] = w & 255; out[13] = w >> 8; out[14] = h & 255; out[15] = h >> 8;
  out[16] = pb * 8;
  out[17] = 0x20 | (alpha ? 8 : 0); // de sus în jos; biții de alfa
  let p = 18;
  const same = (a: number, c: number) => d[a] === d[c] && d[a + 1] === d[c + 1] && d[a + 2] === d[c + 2] && (!alpha || d[a + 3] === d[c + 3]);
  const px = (s: number) => { out[p++] = d[s + 2]; out[p++] = d[s + 1]; out[p++] = d[s]; if (alpha) out[p++] = d[s + 3]; };
  // Pachetele nu trec de capătul rândului (cum cere specificația, ca să le citească orice program).
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let x = 0;
    while (x < w) {
      const s = (row + x) * 4;
      let run = 1;
      while (x + run < w && run < 128 && same(s, s + run * 4)) run++;
      if (run > 1) { out[p++] = 0x80 | (run - 1); px(s); x += run; continue; }
      // Pixeli diferiți la rând, până la primele două la fel.
      let cnt = 1;
      while (x + cnt < w && cnt < 128 && !(x + cnt + 1 < w && same((row + x + cnt) * 4, (row + x + cnt + 1) * 4))) cnt++;
      out[p++] = cnt - 1;
      for (let k = 0; k < cnt; k++) px((row + x + k) * 4);
      x += cnt;
    }
  }
  // Coada TGA 2.0 (fără zonele de extensie): programele noi recunosc fișierul după ea.
  p += 8;
  const foot = 'TRUEVISION-XFILE.';
  for (let i = 0; i < foot.length; i++) out[p++] = foot.charCodeAt(i);
  out[p++] = 0;
  return out.slice(0, p);
}
