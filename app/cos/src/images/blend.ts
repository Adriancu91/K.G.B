// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Modurile de amestec ale straturilor. Cele pe care pânza le știe singură (globalCompositeOperation) merg direct;
// pe celelalte (Ardere liniară, Lumină vie, Scădere, Împărțire…) le calculăm noi pe pixeli, după formulele obișnuite
// de amestec (fundal = ce e dedesubt, sursă = stratul pus peste).

export type CustomBlend = 'dissolve' | 'linear-burn' | 'darker-color' | 'lighter-color' | 'vivid-light' | 'linear-light' | 'pin-light' | 'hard-mix' | 'subtract' | 'divide';
export type Blend = GlobalCompositeOperation | CustomBlend;

const CUSTOM = new Set<string>(['dissolve', 'linear-burn', 'darker-color', 'lighter-color', 'vivid-light', 'linear-light', 'pin-light', 'hard-mix', 'subtract', 'divide']);
export const isCustomBlend = (b: string): b is CustomBlend => CUSTOM.has(b);

/** Toate modurile pentru straturi, pe grupe (ordinea și grupele obișnuite din programele de editare foto). */
export const LAYER_BLENDS: [string, [Blend, string][]][] = [
  ['Normal', [['source-over', 'Normal'], ['dissolve', 'Dizolvare (Dissolve)']]],
  ['Întunecă', [['darken', 'Întunecă (Darken)'], ['multiply', 'Înmulțire (Multiply)'], ['color-burn', 'Ardere culoare (Color Burn)'],
    ['linear-burn', 'Ardere liniară (Linear Burn)'], ['darker-color', 'Culoarea mai închisă (Darker Color)']]],
  ['Luminează', [['lighten', 'Luminează (Lighten)'], ['screen', 'Ecran (Screen)'], ['color-dodge', 'Diluare culoare (Color Dodge)'],
    ['lighter', 'Adunare (Linear Dodge)'], ['lighter-color', 'Culoarea mai deschisă (Lighter Color)']]],
  ['Contrast', [['overlay', 'Suprapunere (Overlay)'], ['soft-light', 'Lumină difuză (Soft Light)'], ['hard-light', 'Lumină puternică (Hard Light)'],
    ['vivid-light', 'Lumină vie (Vivid Light)'], ['linear-light', 'Lumină liniară (Linear Light)'], ['pin-light', 'Lumină punctuală (Pin Light)'],
    ['hard-mix', 'Amestec dur (Hard Mix)']]],
  ['Comparație', [['difference', 'Diferență (Difference)'], ['exclusion', 'Excludere (Exclusion)'], ['subtract', 'Scădere (Subtract)'], ['divide', 'Împărțire (Divide)']]],
  ['Componente', [['hue', 'Nuanță (Hue)'], ['saturation', 'Saturație (Saturation)'], ['color', 'Culoare (Color)'], ['luminosity', 'Luminozitate (Luminosity)']]],
];

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const burn = (b: number, s: number) => (b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s));
const dodge = (b: number, s: number) => (b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s)));

/** Formula pe un canal (b = fundal, s = sursă, ambele 0–1), pentru modurile care lucrează canal cu canal. */
function channel(mode: CustomBlend, b: number, s: number): number {
  switch (mode) {
    case 'linear-burn': return clamp(b + s - 1);
    case 'vivid-light': return s <= 0.5 ? burn(b, 2 * s) : dodge(b, 2 * s - 1);
    case 'linear-light': return clamp(b + 2 * s - 1);
    case 'pin-light': return s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1);
    case 'hard-mix': return b + s >= 1 ? 1 : 0;
    case 'subtract': return clamp(b - s);
    case 'divide': return s <= 0 ? (b <= 0 ? 0 : 1) : clamp(b / s);
    default: return s;
  }
}

// Tabele 256 × 256 (fundal × sursă → rezultat), făcute o singură dată pe mod: amestecul devine o căutare.
const tables = new Map<CustomBlend, Uint8Array>();
function table(mode: CustomBlend) {
  let t = tables.get(mode);
  if (!t) {
    t = new Uint8Array(65536);
    for (let b = 0; b < 256; b++) for (let s = 0; s < 256; s++) t[(b << 8) | s] = Math.round(channel(mode, b / 255, s / 255) * 255);
    tables.set(mode, t);
  }
  return t;
}

/**
 * Amestecă pixelii sursei (`src`, aceeași mărime) peste `back`, pe loc în `back`, cu opacitatea `alpha`.
 * Compunerea urmează regula obișnuită: unde fundalul e transparent se vede sursa ca atare.
 */
export function blendPixels(back: Uint8ClampedArray, src: Uint8ClampedArray, mode: CustomBlend, alpha: number) {
  if (mode === 'dissolve') { dissolve(back, src, alpha); return; }
  const sep = mode !== 'darker-color' && mode !== 'lighter-color';
  const t = sep ? table(mode) : null;
  for (let i = 0; i < back.length; i += 4) {
    const as = (src[i + 3] / 255) * alpha;
    if (as <= 0) continue;
    const ab = back[i + 3] / 255;
    const ao = as + ab * (1 - as);
    // Culoarea mai închisă / deschisă: alege tot pixelul (după luminozitate), nu canal cu canal.
    const pickSrc = !t && ((0.3 * src[i] + 0.59 * src[i + 1] + 0.11 * src[i + 2]) < (0.3 * back[i] + 0.59 * back[i + 1] + 0.11 * back[i + 2])) === (mode === 'darker-color');
    for (let k = 0; k < 3; k++) {
      const cb = back[i + k], cs = src[i + k];
      const mixed = t ? t[(cb << 8) | cs] : pickSrc ? cs : cb;
      const m = (1 - ab) * cs + ab * mixed;
      back[i + k] = (as * m + ab * (1 - as) * cb) / ao;
    }
    back[i + 3] = ao * 255;
  }
}

/**
 * Dizolvare: fiecare pixel al sursei apare întreg sau deloc, cu șansa dată de opacitatea lui (grăunțe, nu transparență).
 * Zgomotul e fix pe poziție (același la fiecare desenare), ca poza să nu „fiarbă” la fiecare schimbare.
 */
function dissolve(back: Uint8ClampedArray, src: Uint8ClampedArray, alpha: number) {
  for (let i = 0, p = 0; i < back.length; i += 4, p++) {
    const as = (src[i + 3] / 255) * alpha;
    if (as <= 0) continue;
    let h = Math.imul(p ^ 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    if (((h ^ (h >>> 16)) >>> 0) / 4294967296 >= as) continue;
    back[i] = src[i]; back[i + 1] = src[i + 1]; back[i + 2] = src[i + 2]; back[i + 3] = 255;
  }
}

/** Desenează `pic` pe tot ctx (w × h) cu opacitatea și modul de amestec date. */
export function drawBlend(ctx: CanvasRenderingContext2D, pic: CanvasImageSource, blend: Blend, alpha: number, w: number, h: number) {
  if (!isCustomBlend(blend)) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = blend;
    ctx.drawImage(pic, 0, 0, w, h);
    ctx.restore();
    return;
  }
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tc = tmp.getContext('2d', { willReadFrequently: true })!;
  tc.drawImage(pic, 0, 0, w, h);
  const src = tc.getImageData(0, 0, w, h);
  tmp.width = 0;
  const back = ctx.getImageData(0, 0, w, h);
  blendPixels(back.data, src.data, blend, alpha);
  ctx.putImageData(back, 0, 0);
}
