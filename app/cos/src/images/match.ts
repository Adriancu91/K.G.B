// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Potrivește culoarea (ca „Match Color” din editoarele foto): poza ia tonurile și culorile altei poze. Se măsoară media și
// împrăștierea luminozității și a culorilor (în spațiul Lab) în ambele poze, iar fiecare pixel se mută ca poza să aibă
// aceleași valori ca sursa. Luminozitatea și Culoarea spun cât se ia (100% = tot), Atenuarea amestecă înapoi cu originalul.

/** Ce se ține din poza sursă: media și împrăștierea pe L, a, b. */
export type LabStats = [mL: number, ma: number, mb: number, sL: number, sa: number, sb: number];
export interface MatchColor { name: string; src: LabStats; lum: number; color: number; fade: number }

const LIN = new Float32Array(256);
for (let v = 0; v < 256; v++) { const c = v / 255; LIN[v] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const fi = (t: number) => { const c = t * t * t; return c > 0.008856 ? c : (t - 16 / 116) / 7.787; };
const gam = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** sRGB (0–255) → Lab (alb D65). */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = LIN[r], G = LIN[g], B = LIN[b];
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
/** Lab → sRGB (0–255, netăiat; Uint8ClampedArray taie singur). */
export function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const y = (L + 16) / 116, x = a / 500 + y, z = y - b / 200;
  const X = fi(x) * 0.95047, Y = fi(y), Z = fi(z) * 1.08883;
  return [gam(3.2406 * X - 1.5372 * Y - 0.4986 * Z), gam(-0.9689 * X + 1.8758 * Y + 0.0415 * Z), gam(0.0557 * X - 0.204 * Y + 1.057 * Z)];
}

/** Media și împrăștierea în Lab a pixelilor vizibili (cel mult ~250.000 citiți, la pas egal). */
export function labStats(d: Uint8ClampedArray): LabStats {
  const step = Math.max(1, Math.floor(d.length / 4 / 250000)) * 4;
  let n = 0;
  const s = [0, 0, 0], q = [0, 0, 0];
  for (let i = 0; i < d.length; i += step) {
    if (d[i + 3] < 128) continue;
    const lab = rgbToLab(d[i], d[i + 1], d[i + 2]);
    for (let c = 0; c < 3; c++) { s[c] += lab[c]; q[c] += lab[c] * lab[c]; }
    n++;
  }
  if (!n) return [50, 0, 0, 1, 1, 1];
  const m = s.map((v) => v / n);
  const sd = q.map((v, c) => Math.sqrt(Math.max(0, v / n - m[c] * m[c])));
  return [m[0], m[1], m[2], sd[0], sd[1], sd[2]];
}

/** Aplică potrivirea pe pixeli (pe loc): statisticile pozei de acum se duc spre cele ale sursei. */
export function matchPixels(d: Uint8ClampedArray, m: MatchColor) {
  const t = labStats(d);
  const kL = Math.max(0, m.lum) / 100, kC = Math.max(0, m.color) / 100, keep = Math.max(0, Math.min(100, m.fade)) / 100;
  // Împrăștierea: raportul e limitat, ca o poză aproape plată să nu explodeze în zgomot.
  const ratio = (c: number) => Math.min(4, m.src[3 + c] / Math.max(0.5, t[3 + c]));
  const rL = ratio(0), ra = ratio(1), rb = ratio(2);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const [L, a, b] = rgbToLab(d[i], d[i + 1], d[i + 2]);
    const L2 = L + ((m.src[0] + (L - t[0]) * rL) - L) * kL;
    const a2 = a + ((m.src[1] + (a - t[1]) * ra) - a) * kC;
    const b2 = b + ((m.src[2] + (b - t[2]) * rb) - b) * kC;
    const [r, g, bb] = labToRgb(Math.max(0, Math.min(100, L2)), a2, b2);
    d[i] = r + (d[i] - r) * keep;
    d[i + 1] = g + (d[i + 1] - g) * keep;
    d[i + 2] = bb + (d[i + 2] - bb) * keep;
  }
}
