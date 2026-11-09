// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Amestecul HSL pe opt culori (ca panoul HSL din Camera Raw): pentru roșii, portocalii, galbene, verzi, acvamarin, albastre,
// violete și magenta se schimbă separat nuanța, saturația și luminozitatea. Fișier separat de adjust.ts, ca bucla mare
// a ajustărilor să rămână mică (V8 o încetinește când crește).

/** Ordinea gamelor și nuanța din centrul fiecăreia, în grade. */
export const HSL_BANDS = ['r', 'o', 'y', 'g', 'a', 'b', 'p', 'm'] as const;
export type HslBand = (typeof HSL_BANDS)[number];
const CENTER = [0, 30, 60, 120, 180, 240, 270, 300];

/** Pentru fiecare gamă: [nuanță, saturație, luminozitate], fiecare între -100 și 100. */
export type HslMix = Partial<Record<HslBand, [number, number, number]>>;

export const hslNeutral = (m?: HslMix) => !m || Object.values(m).every((v) => !v || v.every((n) => !n));

/** Cât aparține nuanța h (0–360) fiecărei game: trecere liniară între centrele vecine, ponderile fac 1. */
export function bandWeights(h: number): Float32Array {
  const w = new Float32Array(8);
  h = ((h % 360) + 360) % 360;
  for (let i = 0; i < 8; i++) {
    const a = CENTER[i], b = i < 7 ? CENTER[i + 1] : 360;
    if (h >= a && h < b) {
      const t = (h - a) / (b - a);
      w[i] = 1 - t;
      w[(i + 1) % 8] = t;
      break;
    }
  }
  return w;
}

/**
 * Aplică amestecul pe pixelii RGBA, pe loc. Nuanța se mută cu cel mult ±30°, saturația merge de la gri (−100) la mult mai vie (+100),
 * luminozitatea se mută spre negru sau alb proporțional cu cât de colorat e pixelul (griurile rămân neschimbate).
 */
export function hslMixPixels(d: Uint8ClampedArray, m: HslMix) {
  if (hslNeutral(m)) return;
  // Tabelele pe 360 de grade: cât se schimbă nuanța, saturația și luminozitatea la fiecare nuanță.
  const DH = new Float32Array(360), DS = new Float32Array(360), DL = new Float32Array(360);
  for (let h = 0; h < 360; h++) {
    const w = bandWeights(h);
    let dh = 0, ds = 0, dl = 0;
    for (let i = 0; i < 8; i++) {
      const v = m[HSL_BANDS[i]];
      if (!v || !w[i]) continue;
      dh += w[i] * v[0];
      ds += w[i] * v[1];
      dl += w[i] * v[2];
    }
    DH[h] = (dh / 100) * 30;
    DS[h] = ds / 100;
    DL[h] = dl / 100;
  }
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
    if (c < 1 / 255) continue;
    let h: number;
    if (mx === r) h = ((g - b) / c) % 6;
    else if (mx === g) h = (b - r) / c + 2;
    else h = (r - g) / c + 4;
    h *= 60;
    if (h < 0) h += 360;
    let l = (mx + mn) / 2;
    let s = c / (1 - Math.abs(2 * l - 1) || 1);
    const hi = (h | 0) % 360;
    const dh = DH[hi], ds = DS[hi], dl = DL[hi];
    if (!dh && !ds && !dl) continue;
    h += dh;
    if (dl) l += dl * Math.min(1, s) * (dl > 0 ? 1 - l : l) * 0.8;
    if (ds) s = ds > 0 ? s + (1 - s) * ds * s : s * (1 + ds);
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    // Înapoi în RGB.
    const C = (1 - Math.abs(2 * l - 1)) * s, hp = (((h % 360) + 360) % 360) / 60, X = C * (1 - Math.abs((hp % 2) - 1)), M = l - C / 2;
    let r1 = 0, g1 = 0, b1 = 0;
    if (hp < 1) { r1 = C; g1 = X; }
    else if (hp < 2) { r1 = X; g1 = C; }
    else if (hp < 3) { g1 = C; b1 = X; }
    else if (hp < 4) { g1 = X; b1 = C; }
    else if (hp < 5) { r1 = X; b1 = C; }
    else { r1 = C; b1 = X; }
    d[i] = (r1 + M) * 255 + 0.5;
    d[i + 1] = (g1 + M) * 255 + 0.5;
    d[i + 2] = (b1 + M) * 255 + 0.5;
  }
}
