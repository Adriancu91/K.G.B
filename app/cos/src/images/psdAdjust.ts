// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Straturile de ajustare din .psd (blocurile lor binare) → ajustările noastre (adjust.ts), ca straturi de ajustare care se pot schimba.
// Citim: Niveluri (levl), Curbe (curv), Nuanță / Saturație (hue2), Balans de culoare (blnc), Expunere (expA), Negativ (nvrt),
// Prag (thrs), Posterizare (post), Mixer de canale (mixr), Filtru foto (phfl), Hartă de gradient (grdm), Alb-negru (blwh),
// Culoare selectivă (selc), Vibranță (vibA) și Luminozitate / Contrast (CgEd). Doar canalul compus (RGB); ce e pe canale separate se pierde.
// Celelalte (căutare de culoare…) → null, rămân numărate ca pierdute.
import { NO_ADJUST, type Adjust, type Tri, type SelRange } from './adjust';
import { readDescBlock } from './psdfx';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const hx = (x: number) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0');

/** Culoarea Lab (L 0–100, a / b −128…127) → #rrggbb în sRGB (D50 adaptat la D65, cele din afara gamei tăiate). */
export function labHex(L: number, A: number, B: number): string {
  const fy = (L + 16) / 116, fx = fy + A / 500, fz = fy - B / 200;
  const inv = (t: number) => (t > 6 / 29 ? t * t * t : 3 * (6 / 29) * (6 / 29) * (t - 4 / 29));
  const X = 0.9642 * inv(fx), Y = inv(fy), Z = 0.8251 * inv(fz);
  const lin = [3.1339 * X - 1.6169 * Y - 0.4906 * Z, -0.9785 * X + 1.9160 * Y + 0.0334 * Z, 0.0720 * X - 0.2290 * Y + 1.4057 * Z];
  return '#' + lin.map((c) => hx(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055))).join('');
}

/** Culoarea din structura de 10 octeți a fișierului (spațiul de culoare + 4 numere pe 16 biți); null dacă n-o știm citi. */
function psdColor(v: DataView, p: number): string | null {
  const cs = v.getUint16(p), c = [v.getUint16(p + 2), v.getUint16(p + 4), v.getUint16(p + 6), v.getUint16(p + 8)];
  if (cs === 0) return '#' + hx(c[0] / 257) + hx(c[1] / 257) + hx(c[2] / 257);
  if (cs === 7) return labHex(c[0] / 100, v.getInt16(p + 4) / 100, v.getInt16(p + 6) / 100);
  if (cs === 8) { const g = 255 - (c[0] / 10000) * 255; return '#' + hx(g) + hx(g) + hx(g); }
  if (cs === 1) {
    const h = (c[0] / 65535) * 6, s = c[1] / 65535, b = c[2] / 65535;
    const f = (n: number) => { const k = (n + h) % 6; return 255 * (b - b * s * Math.max(0, Math.min(k, 4 - k, 1))); };
    return '#' + hx(f(5)) + hx(f(3)) + hx(f(1));
  }
  return null;
}

/** Ajustarea din blocul `key` (conținutul lui în `b`); null dacă n-o avem sau blocul e stricat. */
export function readPsdAdjust(key: string, b: Uint8Array): Adjust | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (p: number) => v.getUint16(p), s16 = (p: number) => v.getInt16(p);
  try {
    if (key === 'nvrt') return { ...NO_ADJUST, invert: true };
    if (key === 'thrs' && b.length >= 2) { const t = u16(0); return t >= 1 && t <= 255 ? { ...NO_ADJUST, threshold: t } : null; }
    if (key === 'post' && b.length >= 2) { const n = u16(0); return n >= 2 ? { ...NO_ADJUST, posterize: clamp(n, 2, 32) } : null; }
    if (key === 'levl' && b.length >= 12) {
      // Versiunea, apoi câte 5 numere pe canal (intrare jos / sus, ieșire jos / sus, gamma × 100); primul e compusul.
      const inLo = u16(2), inHi = u16(4), outLo = u16(6), outHi = u16(8), g = u16(10) / 100;
      if (inHi > 255 || outHi > 255 || !(g > 0)) return null;
      return { ...NO_ADJUST, levels: { inLo, inHi, outLo, outHi, gamma: clamp(g, 0.1, 9.99) } };
    }
    if (key === 'curv' && b.length >= 7) {
      // Un octet de umplutură, versiunea (1 sau 4), harta curbelor (bitul 0 = compusul), apoi la fiecare: câte puncte, (ieșire, intrare).
      const ver = u16(1);
      if (ver !== 1 && ver !== 4) return null;
      const bits = v.getUint32(3);
      if (!(bits & 1)) return null;
      const n = u16(7);
      if (n < 2 || n > 19 || 9 + n * 4 > b.length) return null;
      const pts: [number, number][] = [];
      for (let i = 0; i < n; i++) pts.push([clamp(u16(9 + i * 4 + 2), 0, 255), clamp(u16(9 + i * 4), 0, 255)]);
      pts.sort((a, c) => a[0] - c[0]);
      return { ...NO_ADJUST, curve: pts };
    }
    if (key === 'hue2' && b.length >= 16) {
      // Versiunea, colorare (1 octet + umplutură), nuanța / saturația / luminozitatea colorării, apoi cele principale.
      const colorize = b[2] === 1;
      if (colorize) return { ...NO_ADJUST, colorize: { h: ((s16(4) % 360) + 360) % 360, s: clamp(s16(6), 0, 100) }, brightness: clamp(s16(8), -100, 100) };
      return { ...NO_ADJUST, hue: clamp(s16(10), -180, 180), saturation: clamp(s16(12), -100, 100), brightness: clamp(s16(14), -100, 100) };
    }
    if (key === 'blnc' && b.length >= 18) {
      // Umbre, tonuri medii, lumini: câte trei (cyan ↔ roșu, magenta ↔ verde, galben ↔ albastru).
      const tri = (p: number): Tri => [clamp(s16(p), -100, 100), clamp(s16(p + 2), -100, 100), clamp(s16(p + 4), -100, 100)];
      return { ...NO_ADJUST, balance: { shadows: tri(0), mid: tri(6), high: tri(12) } };
    }
    if (key === 'expA' && b.length >= 14) {
      // Versiunea, expunerea (trepte), decalajul (−0,5…0,5), gamma (1 = neschimbat; gamma nu o aducem).
      const ev = v.getFloat32(2), off = v.getFloat32(6);
      if (!Number.isFinite(ev) || !Number.isFinite(off)) return null;
      return { ...NO_ADJUST, exposure: clamp(Math.round(ev * 50), -100, 100), expOffset: clamp(Math.round(off * 200), -100, 100) };
    }
    if (key === 'mixr' && b.length >= 34) {
      // Versiunea, monocrom, apoi pe fiecare canal de ieșire: roșu, verde, albastru, (negru), constanta (n-o avem), în procente.
      const tri = (p: number): Tri => [clamp(s16(p), -200, 200), clamp(s16(p + 2), -200, 200), clamp(s16(p + 4), -200, 200)];
      const r = tri(4);
      if (u16(2) === 1) return { ...NO_ADJUST, mixer: { r, g: r, b: r } };
      return { ...NO_ADJUST, mixer: { r, g: tri(14), b: tri(24) } };
    }
    if (key === 'phfl' && b.length >= 17 && u16(0) === 2) {
      // Versiunea 2: culoarea (10 octeți), densitatea (procente), păstrarea luminozității (o păstrăm mereu).
      const color = psdColor(v, 2), density = v.getUint32(12);
      return color ? { ...NO_ADJUST, photo: { color, density: clamp(density, 0, 100) } } : null;
    }
    if (key === 'grdm' && b.length >= 10) {
      // Versiunea, întors, cu zgomot de netezire, numele (text Unicode), apoi opririle de culoare (câte 20 de octeți).
      const rev = b[2] === 1;
      let p = 4;
      const nl = v.getUint32(p);
      p += 4 + nl * 2;
      const n = u16(p);
      p += 2;
      if (n < 2 || n > 64 || p + n * 20 > b.length) return null;
      let st: [string, number][] = [];
      for (let i = 0; i < n; i++, p += 20) {
        const c = psdColor(v, p + 8);
        if (!c) return null;
        st.push([c, clamp(v.getUint32(p) / 4096, 0, 1)]);
      }
      if (rev) st = st.map(([c, at]): [string, number] => [c, 1 - at]).reverse();
      st.sort((x, y) => x[1] - y[1]);
      // Capetele: prima și ultima culoare; dacă nu stau chiar la 0 și 1, le punem și ca opriri în mijloc.
      const mid = st.filter(([, at], i) => (i > 0 && i < st.length - 1) || (i === 0 && at > 0) || (i === st.length - 1 && at < 1));
      return { ...NO_ADJUST, gmap: { dark: st[0][0], light: st[st.length - 1][0], ...(mid.length ? { mid } : {}) } };
    }
    if (key === 'blwh') {
      // Descriptor: procentele pentru roșu, galben, verde, cyan, albastru, magenta (nuanța „tint” n-o aducem).
      const d = readDescBlock(b);
      const g = (k: string, def: number) => { const x = d?.[k]; return typeof x === 'number' && Number.isFinite(x) ? clamp(x, -200, 300) : def; };
      if (!d) return null;
      return { ...NO_ADJUST, bw: { r: g('Rd  ', 40), y: g('Yllw', 60), g: g('Grn ', 40), c: g('Cyn ', 60), b: g('Bl  ', 20), m: g('Mgnt', 80) } };
    }
    if (key === 'selc' && b.length >= 84) {
      // Versiunea, metoda (relativ / absolut: o punem pe a noastră), un rând gol, apoi câte 4 numere (cyan, magenta, galben, negru)
      // pentru roșii, galbene, verzi, cyan, albastre, magenta, albe, neutre, negre.
      const order: SelRange[] = ['r', 'y', 'g', 'c', 'b', 'm', 'w', 'n', 'k'];
      const selective: NonNullable<Adjust['selective']> = {};
      order.forEach((k, i) => {
        const p = 12 + i * 8, q: [number, number, number, number] = [s16(p), s16(p + 2), s16(p + 4), s16(p + 6)].map((x) => clamp(x, -100, 100)) as [number, number, number, number];
        if (q.some((x) => x)) selective[k] = q;
      });
      return { ...NO_ADJUST, selective };
    }
    if (key === 'vibA') {
      // Descriptor: vibranța și saturația (-100…100).
      const d = readDescBlock(b);
      if (!d) return null;
      const n = (k: string) => { const x = d[k]; return typeof x === 'number' && Number.isFinite(x) ? clamp(x, -100, 100) : 0; };
      return { ...NO_ADJUST, vibrance: n('vibrance'), saturation: n('Strt') };
    }
    if (key === 'CgEd') {
      // Descriptor: luminozitatea (−150…150) și contrastul (−50…100), puse pe scara noastră (−100…100).
      const d = readDescBlock(b);
      if (!d) return null;
      const n = (k: string) => { const x = d[k]; return typeof x === 'number' && Number.isFinite(x) ? x : 0; };
      return { ...NO_ADJUST, brightness: clamp(Math.round(n('Brgh') / 1.5), -100, 100), contrast: clamp(Math.round(n('Cntr')), -100, 100) };
    }
  } catch { /* bloc tăiat */ }
  return null;
}
