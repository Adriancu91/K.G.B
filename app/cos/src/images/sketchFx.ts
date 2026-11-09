// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Imagini → 🌀 Filtre → Schiță (Sketch din Filter Gallery): Basorelief, Cretă și cărbune, Fotocopie, Ștampilă,
// Margini rupte și Model de semiton. Toate desenează cu două culori: cerneala (pentru umbre) și hârtia (pentru lumini),
// alese din SKETCH_INKS. Lucrăm pe luminozitate, într-un singur canal (Float32), deci sunt rapide și pe poze mari.

type Px = Uint8ClampedArray;

/** Perechile cerneală / hârtie (ca culoarea din față și cea de fundal). */
export const SKETCH_INKS: [string, [number, number, number], [number, number, number]][] = [
  ['Negru pe alb', [0, 0, 0], [255, 255, 255]],
  ['Sepia pe crem', [74, 46, 24], [244, 232, 206]],
  ['Albastru pe alb', [22, 52, 128], [250, 250, 252]],
  ['Roșu pe alb', [150, 20, 28], [252, 248, 244]],
  ['Alb pe negru', [255, 255, 255], [18, 18, 18]],
];
export const LIGHT_DIRS = ['Sus', 'Stânga sus', 'Stânga', 'Stânga jos', 'Jos', 'Dreapta jos', 'Dreapta', 'Dreapta sus'];
export const HALFTONE_TYPES = ['Puncte', 'Cercuri', 'Linii'];

/** Luminozitatea fiecărui pixel, 0…255. */
export function lumOf(src: Px, w: number, h: number) {
  const L = new Float32Array(w * h);
  for (let i = 0, o = 0; i < L.length; i++, o += 4) L[i] = 0.299 * src[o] + 0.587 * src[o + 1] + 0.114 * src[o + 2];
  return L;
}

/** Estompare aproape gaussiană pe un canal: trei treceri de medie în cutie, pe rânduri și pe coloane. */
export function blur1(a: Float32Array, w: number, h: number, sigma: number) {
  if (sigma < 0.5) return a.slice();
  const r = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2));
  let cur = a.slice(), tmp = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let s = 0;
      for (let x = -r; x <= r; x++) s += cur[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = s / (2 * r + 1);
        s += cur[row + Math.min(w - 1, x + r + 1)] - cur[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        cur[y * w + x] = s / (2 * r + 1);
        s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
  return cur;
}

/** Pseudo-aleator cu sămânță (același model la fiecare aplicare). */
function hash(x: number, y: number, s = 0) {
  let t = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 1442695041)) | 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

/** Scrie rezultatul: t = 0 cerneală, t = 1 hârtie; transparența rămâne a pozei. */
export function paint(src: Px, t: Float32Array, ink: number) {
  const [, a, b] = SKETCH_INKS[Math.max(0, Math.min(SKETCH_INKS.length - 1, Math.round(ink)))] ?? SKETCH_INKS[0];
  const out = src.slice();
  for (let i = 0, o = 0; i < t.length; i++, o += 4) {
    const k = t[i] < 0 ? 0 : t[i] > 1 ? 1 : t[i];
    out[o] = a[0] + (b[0] - a[0]) * k; out[o + 1] = a[1] + (b[1] - a[1]) * k; out[o + 2] = a[2] + (b[2] - a[2]) * k;
  }
  return out;
}

/** Basorelief: poza netezită, luminată dintr-o parte, ca sculptată în piatră. */
export function basRelief(src: Px, w: number, h: number, v: Record<string, number>) {
  const L = blur1(lumOf(src, w, h), w, h, Math.max(0.5, v.s));
  const ang = (Math.round(v.dir) % 8) * (Math.PI / 4), dx = Math.round(-Math.sin(ang) * 1.5) || 0, dy = Math.round(-Math.cos(ang) * 1.5) || 0;
  const gain = (v.d / 100) * 6, t = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = L[Math.min(h - 1, Math.max(0, y + dy)) * w + Math.min(w - 1, Math.max(0, x + dx))];
    const b = L[Math.min(h - 1, Math.max(0, y - dy)) * w + Math.min(w - 1, Math.max(0, x - dx))];
    // Partea întoarsă spre lumină e mai deschisă; puțin din tonul pozei rămâne, ca relieful să nu fie doar gri.
    t[y * w + x] = 0.5 + ((b - a) * gain) / 255 + (L[y * w + x] / 255 - 0.5) * 0.35;
  }
  return paint(src, t, v.ink);
}

/** Cretă și cărbune: umbrele cu tușe de cărbune, luminile cu tușe de cretă, pe hârtie gri. */
export function chalkCharcoal(src: Px, w: number, h: number, v: Record<string, number>) {
  const L = lumOf(src, w, h), len = Math.max(1, Math.round(v.r)), noise = new Float32Array(w * h);
  // Tușele: zgomot întins pe diagonală (cărbunele) — o medie a zgomotului de-a lungul liniei.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let i = -len; i <= len; i++) s += hash(x + i, y - i, 7);
    noise[y * w + x] = s / (2 * len + 1) - 0.5;
  }
  const amp = 0.5 * Math.sqrt(2 * len + 1) * (0.4 + v.p / 100);
  const ch = v.ch / 100, ck = v.ck / 100, t = new Float32Array(w * h);
  for (let i = 0; i < t.length; i++) {
    const q = L[i] / 255 + noise[i] * amp * 0.5;
    // Sub prag: cărbune (cerneală); peste: cretă (hârtie); între: hârtia gri.
    t[i] = q < 0.25 + ch * 0.3 ? 0 : q > 0.75 - ck * 0.3 ? 1 : 0.5;
  }
  return paint(src, t, v.ink);
}

/** Fotocopie: doar locurile mai închise decât vecinii lor devin cerneală, restul hârtie albă. */
export function photocopy(src: Px, w: number, h: number, v: Record<string, number>) {
  const L = lumOf(src, w, h), B = blur1(L, w, h, Math.max(0.5, v.r)), dark = 1 + (v.d / 100) * 8, t = new Float32Array(w * h);
  for (let i = 0; i < t.length; i++) t[i] = 1 - Math.max(0, (B[i] - L[i]) / 255) * dark * 4;
  return paint(src, t, v.ink);
}

/** Ștampilă: poza netezită și tăiată la un prag, ca o ștampilă de cauciuc. */
export function stamp(src: Px, w: number, h: number, v: Record<string, number>) {
  const L = blur1(lumOf(src, w, h), w, h, Math.max(0.5, v.s)), th = (v.b / 100) * 255, t = new Float32Array(w * h);
  // Marginea moale de un pixel (fără zimți).
  for (let i = 0; i < t.length; i++) t[i] = 0.5 + (L[i] - th) / 6;
  return paint(src, t, v.ink);
}

/** Margini rupte: ca ștampila, dar marginile sunt zdrențuite, ca hârtia ruptă. */
export function tornEdges(src: Px, w: number, h: number, v: Record<string, number>) {
  const L = blur1(lumOf(src, w, h), w, h, Math.max(0.5, v.s)), th = (v.b / 100) * 255, n = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) n[y * w + x] = hash(x, y, 3) - 0.5;
  // Zgomot fin plus zgomot mai mare (fibrele hârtiei), adăugat înaintea pragului.
  const n2 = blur1(n, w, h, 2), t = new Float32Array(w * h), soft = 2 + (25 - Math.min(25, v.c)) * 1.5;
  for (let i = 0; i < t.length; i++) t[i] = 0.5 + (L[i] + n[i] * 14 + n2[i] * 220 - th) / soft;
  return paint(src, t, v.ink);
}

/** Model de semiton: puncte, cercuri din centru sau linii, mai groase unde poza e mai închisă. */
export function halftonePattern(src: Px, w: number, h: number, v: Record<string, number>) {
  const L = lumOf(src, w, h), sz = Math.max(2, v.r), type = Math.round(v.t), con = 1 + (v.c / 100) * 8;
  const B = blur1(L, w, h, sz / 3), cx = w / 2, cy = h / 2, t = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, dark = 1 - B[i] / 255;
    let d: number;
    if (type === 0) {
      // Distanța până la mijlocul celulei, împărțită la raza celulei (punctul crește până acoperă celula).
      const u = (x / sz) % 1 - 0.5, q = (y / sz) % 1 - 0.5;
      d = Math.hypot(u, q) / 0.7071;
    } else {
      // Undă triunghi: 0 pe mijlocul liniei, 1 la jumătatea dintre linii.
      const s = type === 1 ? Math.hypot(x - cx, y - cy) / sz : y / sz;
      d = Math.abs((s % 1) - 0.5) * 2;
    }
    t[i] = 0.5 + (d - Math.sqrt(dark)) * con;
  }
  return paint(src, t, v.ink);
}
