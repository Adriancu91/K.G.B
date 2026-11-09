// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Ajustările pozei (luminozitate, contrast, saturație, temperatură) și redimensionarea, calculate pe pixeli în Canvas 2D.
import { lutPixel, type Lut } from './lut';
import { matchPixels, type MatchColor } from './match';
import { hslMixPixels, hslNeutral, type HslMix } from './hslMix';
// Aceleași funcții se folosesc pentru previzualizare (pe poza micșorată de pe ecran) și pentru rezultatul final.
export interface Adjust {
  /** Toate între -100 și 100; 0 = neschimbat. */
  brightness: number;
  contrast: number;
  saturation: number;
  /** Pozitiv = mai cald (gălbui), negativ = mai rece (albăstrui). */
  temperature: number;
  /** Pozitiv = zonele întunecate se luminează (fețe în contra-lumină); negativ = umbre mai adânci. */
  shadows: number;
  /** Negativ = cerul ars și zonele prea luminoase își recapătă detaliile; pozitiv = lumini mai strălucitoare. */
  highlights: number;
  /** Pozitiv = mai clar (contururi accentuate, pentru poze ușor mișcate); negativ = estompat, mai moale. */
  sharpen: number;
  /** Expunere, ca la aparatul foto: +50 = de două ori mai multă lumină, −50 = jumătate (opțional în fișierele vechi). */
  exposure?: number;
  /** Expunere → Decalaj (-100…100): ridică negrul (ceață, aspect mat) sau îl adâncește; ±100 = ±jumătate din scară. */
  expOffset?: number;
  /** Expunere → Gamma (-100…100): pozitiv = tonurile de mijloc mai luminoase, negativ = mai închise; albul și negrul rămân. */
  expGamma?: number;
  /** Niveluri, ca în Photoshop (opțional): ce intră ca negru / alb devine negru / alb, gamma mută tonurile de mijloc. */
  levels?: Levels;
  /** Curba tonurilor, ca Curves din Photoshop (opțional): puncte [intrare, ieșire] între 0 și 255, ordonate după intrare. */
  curve?: [number, number][];
  /** Nuanța (Hue din Hue/Saturation), în grade, între -180 și 180: toate culorile se rotesc pe cercul culorilor. */
  hue?: number;
  /** Vibranță (-100…100): saturație mai mare doar la culorile șterse, cu tonurile pielii protejate. */
  vibrance?: number;
  /** Colorare (Colorize din Hue/Saturation): toată poza într-o singură nuanță h (0–360), cu saturația s (0–100). */
  colorize?: { h: number; s: number };
  /**
   * Balans de culoare (Color Balance): pentru umbre, tonuri medii și lumini, câte trei valori între -100 și 100:
   * cyan ↔ roșu, magenta ↔ verde, galben ↔ albastru. Luminozitatea pixelului se păstrează.
   */
  balance?: { shadows: Tri; mid: Tri; high: Tri };
  /** Alb-negru cu mixer (Black & White): cât contează fiecare culoare în gri, în procente (roșu, galben, verde, cyan, albastru, magenta). */
  bw?: BW;
  /** Filtru foto (Photo Filter): o culoare pusă peste poză ca un filtru pe obiectiv, cu densitatea 0–100; luminozitatea se păstrează. */
  photo?: { color: string; density: number };
  /** Mixer de canale (Channel Mixer): fiecare canal de ieșire (R, G, B) e un amestec de procente din R, G, B de intrare. */
  mixer?: { r: Tri; g: Tri; b: Tri };
  /** Hartă de gradient (Gradient Map): umbrele iau culoarea „dark”, luminile culoarea „light”, cu trecere lină între ele;
   *  „mid” = culori în plus pe drum, fiecare cu locul ei (0–1), ca hărțile cu mai multe culori din .psd. */
  gmap?: { dark: string; light: string; mid?: [string, number][] };
  /** Egalizare (Equalize): luminozitățile se întind ca să fie folosite toate la fel de des (bun pe scanări șterse, poze în ceață). */
  equalize?: boolean;
  /** Culoare automată (Auto Color): fiecare canal R, G, B se întinde separat între [jos, sus]; scoate tenta de culoare. */
  chan?: [number, number][];
  /**
   * Culoare selectivă (Selective Color): pentru o gamă de culori (roșii, galbene, verzi, cyan, albastre, magenta, albe, neutre, negre),
   * cât cyan, magenta, galben și negru se adaugă (+) sau se scoate (−), între -100 și 100. Restul culorilor nu se schimbă.
   */
  selective?: Partial<Record<SelRange, [number, number, number, number]>>;
  /** Amestec HSL (ca panoul HSL din Camera Raw): nuanța, saturația și luminozitatea separat pentru opt game de culori. */
  hsl?: HslMix;
  /**
   * Înlocuiește culoarea (Replace Color): culorile apropiate de „from” (toleranța 1–100, cu trecere lină) își schimbă
   * nuanța (± 180°), saturația și luminozitatea (± 100).
   */
  replace?: { from: string; tol: number; hue: number; sat: number; light: number };
  /** Tabel de culori (Color Lookup): un fișier .cube sau un aspect gata făcut, aplicat după celelalte culori, cu intensitatea lui. */
  lut?: Lut;
  /** Potrivește culoarea (Match Color): tonurile și culorile luate de la altă poză, aplicate înaintea celorlalte ajustări. */
  match?: MatchColor;
  /** Negativ (Invert din Photoshop): fiecare culoare devine opusul ei. Se aplică după celelalte ajustări. */
  invert?: boolean;
  /** Posterizare: câte trepte rămân pe fiecare canal (2–32); 0 sau lipsă = oprită. */
  posterize?: number;
  /** Prag (Threshold): pixelii mai luminoși decât valoarea (1–255) devin albi, ceilalți negri; 0 sau lipsă = oprit. */
  threshold?: number;
}

export type Tri = [number, number, number];
export type SelRange = 'r' | 'y' | 'g' | 'c' | 'b' | 'm' | 'w' | 'n' | 'k';
const selNeutral = (x?: Adjust['selective']) => !x || Object.values(x).every((v) => !v || v.every((n) => !n));
export interface BW { r: number; y: number; g: number; c: number; b: number; m: number }
/** Valorile implicite din Photoshop pentru Alb-negru. */
export const BW_DEFAULT: BW = { r: 40, y: 60, g: 40, c: 60, b: 20, m: 80 };
export const NO_MIXER = { r: [100, 0, 0] as Tri, g: [0, 100, 0] as Tri, b: [0, 0, 100] as Tri };
const mixerNeutral = (m?: { r: Tri; g: Tri; b: Tri }) => !m || JSON.stringify(m) === JSON.stringify(NO_MIXER);
const hexRgb = (h: string): Tri => { const n = parseInt(h.slice(1), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const NO_BALANCE = { shadows: [0, 0, 0] as Tri, mid: [0, 0, 0] as Tri, high: [0, 0, 0] as Tri };
const balanceNeutral = (b?: { shadows: Tri; mid: Tri; high: Tri }) => !b || [b.shadows, b.mid, b.high].every((t) => t.every((v) => !v));

/** Curba neschimbată: o diagonală de la negru la alb. */
export const NO_CURVE: [number, number][] = [[0, 0], [255, 255]];

export const curveNeutral = (c?: [number, number][]) => !c || c.every(([x, y]) => x === y);

/**
 * Tabelul de 256 de valori pentru curbă: o curbă netedă prin puncte, care nu face valuri între ele
 * (interpolare cubică monotonă, Fritsch–Carlson). Înainte de primul punct și după ultimul rămâne dreaptă.
 */
export function curveLut(pts: [number, number][]): Uint8ClampedArray {
  const p = [...pts].sort((a, b) => a[0] - b[0]).filter((q, i, a) => i === 0 || q[0] !== a[i - 1][0]);
  const t = new Uint8ClampedArray(256);
  if (p.length < 2) {
    for (let v = 0; v < 256; v++) t[v] = p.length ? p[0][1] : v;
    return t;
  }
  const n = p.length, dx: number[] = [], m: number[] = [], k = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = (p[i + 1][1] - p[i][1]) / dx[i]; }
  k[0] = m[0];
  k[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) k[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { k[i] = 0; k[i + 1] = 0; continue; }
    const a = k[i] / m[i], b = k[i + 1] / m[i], h = a * a + b * b;
    if (h > 9) { const s3 = 3 / Math.sqrt(h); k[i] = s3 * a * m[i]; k[i + 1] = s3 * b * m[i]; }
  }
  let seg = 0;
  for (let v = 0; v < 256; v++) {
    if (v <= p[0][0]) { t[v] = p[0][1]; continue; }
    if (v >= p[n - 1][0]) { t[v] = p[n - 1][1]; continue; }
    while (v > p[seg + 1][0]) seg++;
    const h = dx[seg], u = (v - p[seg][0]) / h, u2 = u * u, u3 = u2 * u;
    t[v] = Math.round((2 * u3 - 3 * u2 + 1) * p[seg][1] + (u3 - 2 * u2 + u) * h * k[seg] + (-2 * u3 + 3 * u2) * p[seg + 1][1] + (u3 - u2) * h * k[seg + 1]);
  }
  return t;
}

/** Niveluri: inLo..inHi (0–255) se întind pe outLo..outHi; gamma > 1 luminează tonurile de mijloc, < 1 le întunecă. */
export interface Levels {
  inLo: number;
  inHi: number;
  gamma: number;
  outLo: number;
  outHi: number;
}

export const NO_LEVELS: Levels = { inLo: 0, inHi: 255, gamma: 1, outLo: 0, outHi: 255 };

export const levelsNeutral = (l?: Levels) => !l || (l.inLo === 0 && l.inHi === 255 && l.gamma === 1 && l.outLo === 0 && l.outHi === 255);

/** Tabelul de 256 de valori pentru niveluri (același pe R, G și B). */
export function levelsLut(l: Levels): Uint8ClampedArray {
  const t = new Uint8ClampedArray(256);
  const lo = Math.min(l.inLo, 254), hi = Math.max(l.inHi, lo + 1), g = Math.max(0.1, Math.min(10, l.gamma || 1));
  for (let v = 0; v < 256; v++) {
    const x = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    t[v] = Math.round(l.outLo + Math.pow(x, 1 / g) * (l.outHi - l.outLo));
  }
  return t;
}

/** Histograma luminozității (256 de trepte), pentru panoul Niveluri; pixelii transparenți nu contează. */
export function histogram(d: Uint8ClampedArray): Uint32Array {
  const hist = new Uint32Array(256);
  const step = Math.max(1, Math.floor(d.length / 4 / 250000)) * 4;
  for (let i = 0; i < d.length; i += step) if (d[i + 3] >= 128) hist[(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0]++;
  return hist;
}

/** Histogramele pe canale (luminozitate, roșu, verde, albastru) și cifrele din panoul Histogramă: media, abaterea standard,
 *  mediana, cel mai închis / deschis ton și câți pixeli s-au numărat (pixelii transparenți nu contează). */
export type HistChannel = 'lum' | 'r' | 'g' | 'b';
export interface HistStats { mean: number; std: number; median: number; min: number; max: number; count: number }
export function channelHistograms(d: Uint8ClampedArray): Record<HistChannel, Uint32Array> {
  const out = { lum: new Uint32Array(256), r: new Uint32Array(256), g: new Uint32Array(256), b: new Uint32Array(256) };
  const step = Math.max(1, Math.floor(d.length / 4 / 250000)) * 4;
  for (let i = 0; i < d.length; i += step) {
    if (d[i + 3] < 128) continue;
    out.r[d[i]]++; out.g[d[i + 1]]++; out.b[d[i + 2]]++;
    out.lum[(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0]++;
  }
  return out;
}
export function histStats(h: Uint32Array): HistStats {
  let count = 0, sum = 0, sq = 0, min = -1, max = -1;
  for (let v = 0; v < 256; v++) { const n = h[v]; if (!n) continue; if (min < 0) min = v; max = v; count += n; sum += n * v; sq += n * v * v; }
  if (!count) return { mean: 0, std: 0, median: 0, min: 0, max: 0, count: 0 };
  const mean = sum / count;
  let acc = 0, median = 0;
  for (let v = 0; v < 256; v++) { acc += h[v]; if (acc * 2 >= count) { median = v; break; } }
  return { mean, std: Math.sqrt(Math.max(0, sq / count - mean * mean)), median, min, max, count };
}

/** Niveluri automate: cel mai închis 0,5% din pixeli devine negru, cel mai deschis 0,5% alb. */
export function autoLevels(d: Uint8ClampedArray): Levels {
  const hist = histogram(d);
  let n = 0;
  for (let v = 0; v < 256; v++) n += hist[v];
  if (!n) return { ...NO_LEVELS };
  const pct = (q: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= n * q) return v;
    return 255;
  };
  const inLo = pct(0.005), inHi = Math.max(inLo + 1, pct(0.995));
  return { ...NO_LEVELS, inLo, inHi };
}

export const NO_ADJUST: Adjust = { brightness: 0, contrast: 0, saturation: 0, temperature: 0, shadows: 0, highlights: 0, sharpen: 0, exposure: 0 };

/** Presetări („filtre”), ca în aplicațiile de telefon. */
export const PRESETS: [string, Adjust][] = [
  ['Original', NO_ADJUST],
  ['Viu', { ...NO_ADJUST, brightness: 5, contrast: 20, saturation: 35, temperature: 0 }],
  ['Cald', { ...NO_ADJUST, brightness: 5, contrast: 5, saturation: 10, temperature: 35 }],
  ['Rece', { ...NO_ADJUST, brightness: 0, contrast: 5, saturation: 0, temperature: -35 }],
  ['Alb-negru', { ...NO_ADJUST, brightness: 0, contrast: 15, saturation: -100, temperature: 0 }],
  ['Document', { ...NO_ADJUST, brightness: 15, contrast: 45, saturation: -40, temperature: 0 }],
  ['Vechi', { ...NO_ADJUST, brightness: 5, contrast: -15, saturation: -35, temperature: 30, shadows: 15 }],
  ['Dramatic', { ...NO_ADJUST, contrast: 40, saturation: -10, shadows: -15, highlights: -25, sharpen: 30 }],
  ['Estompat', { ...NO_ADJUST, brightness: 10, contrast: -30, saturation: -20, shadows: 30 }],
  ['Luminos', { ...NO_ADJUST, exposure: 25, shadows: 30, highlights: -10, saturation: 10 }],
];

export const isNeutral = (a: Adjust) => !a.brightness && !a.contrast && !a.saturation && !a.temperature && !a.shadows && !a.highlights && !a.sharpen && !a.exposure && !a.expOffset && !a.expGamma && levelsNeutral(a.levels) && curveNeutral(a.curve) && !a.invert && !a.posterize && !a.threshold && !a.hue && !a.vibrance && !a.colorize && balanceNeutral(a.balance) && !a.bw && !(a.photo && a.photo.density) && mixerNeutral(a.mixer) && !a.gmap && !a.equalize && !a.chan && selNeutral(a.selective) && hslNeutral(a.hsl) && !(a.replace && (a.replace.hue || a.replace.sat || a.replace.light)) && !(a.lut && a.lut.amount > 0) && !(a.match && (a.match.lum || a.match.color) && a.match.fade < 100);

/**
 * Claritate: fiecare pixel se depărtează de media vecinilor lui (3 × 3), deci contururile ies mai tare; cu k negativ
 * se apropie de medie (estompare). Doar culorile se schimbă, transparența rămâne.
 */
export function sharpenPixels(d: Uint8ClampedArray, w: number, h: number, k: number) {
  if (!k || w < 3 || h < 3) return;
  const src = d.slice();
  const row = w * 4;
  for (let y = 0; y < h; y++) {
    const y0 = y > 0 ? -row : 0, y1 = y < h - 1 ? row : 0;
    for (let x = 0; x < w; x++) {
      const i = y * row + x * 4, x0 = x > 0 ? -4 : 0, x1 = x < w - 1 ? 4 : 0;
      for (let ch = 0; ch < 3; ch++) {
        const j = i + ch;
        const m = (src[j + y0 + x0] + src[j + y0] + src[j + y0 + x1] + src[j + x0] + src[j] + src[j + x1]
          + src[j + y1 + x0] + src[j + y1] + src[j + y1 + x1]) / 9;
        d[j] = src[j] + k * (src[j] - m);
      }
    }
  }
}

/** Aplică ajustările pe pixelii dați (RGBA), pe loc; claritatea are nevoie și de lățimea pozei (w). */
export function adjustPixels(d: Uint8ClampedArray, a: Adjust, w = 0) {
  // Luminozitatea, contrastul și temperatura sunt la fel pentru fiecare valoare: le punem în tabele (rapid și pe 12 MP).
  const c = a.contrast * 1.28;
  const f = (259 * (c + 255)) / (255 * (259 - c));
  // Expunerea înmulțește lumina (înainte de contrast), ca diafragma: albul rămâne alb, negrul rămâne negru.
  const gain = Math.pow(2, (a.exposure || 0) / 50);
  // Decalajul se adaugă după expunere, apoi gamma (ca în fereastra Expunere): 1 / gamma ridică tonurile de mijloc.
  const off = ((a.expOffset || 0) / 200) * 255, ig = 1 / Math.pow(2, (a.expGamma || 0) / 50);
  const expo = (x: number) => { const y = Math.min(255, Math.max(0, x + off)); return ig === 1 ? y : 255 * Math.pow(y / 255, ig); };
  // Nivelurile se aplică primele, pe valorile din poză (ca un strat de ajustare pus direct peste ea).
  // Apoi curba, peste niveluri (în Photoshop ar fi două straturi de ajustare puse unul peste altul).
  let L = levelsNeutral(a.levels) ? null : levelsLut(a.levels!);
  if (!curveNeutral(a.curve)) {
    const C = curveLut(a.curve!);
    if (L) for (let v = 0; v < 256; v++) L[v] = C[L[v]];
    else L = C;
  }
  const lut = (shift: number) => {
    const t = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) t[v] = f * (expo((L ? L[v] : v) * gain) + shift + a.brightness * 1.2 - 128) + 128;
    return t;
  };
  const warm = a.temperature * 0.5;
  const R = lut(warm), G = lut(0), B = lut(-warm);
  // Potrivirea culorii lucrează direct pe pixeli, înaintea tabelelor (statisticile se măsoară pe poza de acum).
  if (a.match && (a.match.lum || a.match.color) && a.match.fade < 100) matchPixels(d, a.match);
  // Înainte de toate: întinderea pe canale (Culoare automată), apoi egalizarea, ca tabele puse în fața celorlalte.
  const pre = preLuts(d, a);
  if (pre) {
    const r0 = R.slice(), g0 = G.slice(), b0 = B.slice();
    for (let v = 0; v < 256; v++) { R[v] = r0[pre[0][v]]; G[v] = g0[pre[1][v]]; B[v] = b0[pre[2][v]]; }
  }
  const k = 1 + a.saturation / 100;
  // Umbre / lumini: cât se adaugă la un pixel, după cât de luminos e (tabel pe 256 de trepte de luminozitate).
  // Umbrele contează mult la pixelii închiși și deloc la cei albi; luminile invers. Culorile rămân aceleași.
  const tone = new Float32Array(256);
  const toneOn = !!(a.shadows || a.highlights);
  for (let v = 0; v < 256; v++) {
    const t = v / 255, ws = (1 - t) * (1 - t), wh = t * t;
    tone[v] = (a.shadows || 0) * 0.9 * ws * (1 - ws * 0.5) + (a.highlights || 0) * 0.9 * wh * (1 - wh * 0.5);
  }
  // Nuanța: rotirea culorilor pe cercul HSL (maximul și minimul canalelor rămân), ca la straturile Nuanță din .psd.
  const hsh = a.hue ? a.hue / 60 : 0, hout = [0, 0, 0];
  const vib = (a.vibrance || 0) / 100;
  const col = a.colorize ? hslTable(a.colorize.h, a.colorize.s) : null;
  const bal = balanceNeutral(a.balance) ? null : a.balance!;
  const bw = a.bw ? bwWeights(a.bw) : null;
  const sel = selNeutral(a.selective) ? null : a.selective!;
  const rp = a.replace && (a.replace.hue || a.replace.sat || a.replace.light)
    ? { c: hexRgb(a.replace.from), lim: Math.max(1, a.replace.tol) / 100 * 441.7, m: hueMatrix(a.replace.hue || 0), k: 1 + (a.replace.sat || 0) / 100, l: (a.replace.light || 0) * 1.28 }
    : null;
  const ph = a.photo && a.photo.density ? { c: hexRgb(a.photo.color), d: Math.max(0, Math.min(100, a.photo.density)) / 100 } : null;
  const mx = mixerNeutral(a.mixer) ? null : [...a.mixer!.r, ...a.mixer!.g, ...a.mixer!.b].map((v) => v / 100);
  let gm: Uint8ClampedArray | null = null;
  if (a.gmap) {
    const st: [Tri, number][] = [[hexRgb(a.gmap.dark), 0], ...(a.gmap.mid ?? []).map(([c, at]): [Tri, number] => [hexRgb(c), Math.max(0, Math.min(1, at))]), [hexRgb(a.gmap.light), 1]];
    st.sort((p, q) => p[1] - q[1]);
    gm = new Uint8ClampedArray(256 * 3);
    for (let v = 0, j = 0; v < 256; v++) {
      const t = v / 255;
      while (j < st.length - 2 && t > st[j + 1][1]) j++;
      const [c0, p0] = st[j], [c1, p1] = st[j + 1], f = p1 > p0 ? Math.max(0, Math.min(1, (t - p0) / (p1 - p0))) : 1;
      for (let c = 0; c < 3; c++) gm[v * 3 + c] = Math.round(c0[c] + (c1[c] - c0[c]) * f);
    }
  }
  const lt = a.lut && a.lut.amount > 0 && a.lut.d.length ? a.lut : null;
  for (let i = 0; i < d.length; i += 4) {
    let r = R[d[i]], g = G[d[i + 1]], b = B[d[i + 2]];
    if (toneOn) {
      const dv = tone[(0.299 * r + 0.587 * g + 0.114 * b) | 0];
      r += dv;
      g += dv;
      b += dv;
    }
    if (bal) {
      // Umbrele contează la pixelii închiși, luminile la cei deschiși, tonurile medii la mijloc (cele trei ponderi fac 1).
      const L = Math.max(0, Math.min(1, (0.299 * r + 0.587 * g + 0.114 * b) / 255));
      const ws = (1 - L) * (1 - L), wh = L * L, wm = 1 - ws - wh;
      const dr = (ws * bal.shadows[0] + wm * bal.mid[0] + wh * bal.high[0]) * 0.6;
      const dg = (ws * bal.shadows[1] + wm * bal.mid[1] + wh * bal.high[1]) * 0.6;
      const db = (ws * bal.shadows[2] + wm * bal.mid[2] + wh * bal.high[2]) * 0.6;
      const dy = 0.299 * dr + 0.587 * dg + 0.114 * db;
      r += dr - dy;
      g += dg - dy;
      b += db - dy;
    }
    if (hsh) {
      hslRotate(r, g, b, hsh, hout);
      r = hout[0];
      g = hout[1];
      b = hout[2];
    }
    if (k !== 1) {
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      r = y + (r - y) * k;
      g = y + (g - y) * k;
      b = y + (b - y) * k;
    }
    if (vib) {
      // Cât de colorat e pixelul (0 = gri, 1 = culoare plină): cei șterși primesc mult, cei vii aproape nimic.
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 0 ? (mx - mn) / Math.max(mx, 1) : 0;
      let amt = vib > 0 ? vib * (1 - Math.min(1, sat)) : vib;
      // Pielea (roșu > verde > albastru, tonuri calde) primește doar jumătate, ca fețele să nu devină portocalii.
      if (vib > 0 && r > g && g > b && r - b > 20 && (g - b) < (r - b) * 0.75) amt *= 0.5;
      const y = 0.299 * r + 0.587 * g + 0.114 * b, kv = 1 + amt;
      r = y + (r - y) * kv;
      g = y + (g - y) * kv;
      b = y + (b - y) * kv;
    }
    if (mx) {
      const r0 = r, g0 = g, b0 = b;
      r = mx[0] * r0 + mx[1] * g0 + mx[2] * b0;
      g = mx[3] * r0 + mx[4] * g0 + mx[5] * b0;
      b = mx[6] * r0 + mx[7] * g0 + mx[8] * b0;
    }
    if (ph) {
      // Filtrul înmulțește culorile (ca o sticlă colorată), apoi aducem luminozitatea înapoi la cea de dinainte.
      const y0 = 0.299 * r + 0.587 * g + 0.114 * b;
      let r1 = r + ((r * ph.c[0]) / 255 - r) * ph.d, g1 = g + ((g * ph.c[1]) / 255 - g) * ph.d, b1 = b + ((b * ph.c[2]) / 255 - b) * ph.d;
      const dy = y0 - (0.299 * r1 + 0.587 * g1 + 0.114 * b1);
      r1 += dy;
      g1 += dy;
      b1 += dy;
      r = r1;
      g = g1;
      b = b1;
    }
    if (rp) {
      // Cât de aproape e pixelul de culoarea aleasă: 1 lângă ea, scade lin până la 0 la marginea toleranței.
      const dr0 = r - rp.c[0], dg0 = g - rp.c[1], db0 = b - rp.c[2];
      const dist = Math.sqrt(dr0 * dr0 + dg0 * dg0 + db0 * db0);
      if (dist < rp.lim) {
        const w = 1 - (dist / rp.lim) * (dist / rp.lim);
        let r1 = rp.m[0] * r + rp.m[1] * g + rp.m[2] * b, g1 = rp.m[3] * r + rp.m[4] * g + rp.m[5] * b, b1 = rp.m[6] * r + rp.m[7] * g + rp.m[8] * b;
        const y = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
        r1 = y + (r1 - y) * rp.k + rp.l;
        g1 = y + (g1 - y) * rp.k + rp.l;
        b1 = y + (b1 - y) * rp.k + rp.l;
        r += (r1 - r) * w;
        g += (g1 - g) * w;
        b += (b1 - b) * w;
      }
    }
    if (sel) {
      // Cât aparține pixelul fiecărei game (0–255), ca în Photoshop: culoarea primară = maxim − mijloc, cea secundară = mijloc − minim,
      // albele / negrele după cât de deschis / închis e, neutrele după cât de aproape de gri mijlociu.
      const R0 = Math.max(0, Math.min(255, r)), G0 = Math.max(0, Math.min(255, g)), B0 = Math.max(0, Math.min(255, b));
      const mx = Math.max(R0, G0, B0), mn = Math.min(R0, G0, B0), md = R0 + G0 + B0 - mx - mn;
      const prim: SelRange = mx === R0 ? 'r' : mx === G0 ? 'g' : 'b';
      const sec: SelRange = mn === B0 ? 'y' : mn === R0 ? 'c' : 'm';
      const ws: [SelRange, number][] = [[prim, mx - md], [sec, md - mn], ['w', Math.max(0, (mn - 128) * 2)], ['k', Math.max(0, (128 - mx) * 2)],
        ['n', Math.max(0, 255 - Math.abs(mx - 128) - Math.abs(mn - 128))]];
      let dr = 0, dg = 0, db = 0;
      for (const [k, w] of ws) {
        const v = sel[k];
        if (!v || !w) continue;
        const f = w / 255;
        // Cyan scade roșul, magenta scade verdele, galbenul scade albastrul, negrul le scade pe toate (ca cerneala).
        dr -= (v[0] + v[3]) * f * 1.28;
        dg -= (v[1] + v[3]) * f * 1.28;
        db -= (v[2] + v[3]) * f * 1.28;
      }
      r = R0 + dr;
      g = G0 + dg;
      b = B0 + db;
    }
    if (bw) {
      // Ca Black & White din Photoshop: griul = minimul + (mijloc − minim) × culoarea secundară + (maxim − mijloc) × culoarea primară.
      const R0 = Math.max(0, Math.min(255, r)), G0 = Math.max(0, Math.min(255, g)), B0 = Math.max(0, Math.min(255, b));
      let y: number;
      if (R0 >= G0 && G0 >= B0) y = B0 + (G0 - B0) * bw.y + (R0 - G0) * bw.r;
      else if (R0 >= B0 && B0 >= G0) y = G0 + (B0 - G0) * bw.m + (R0 - B0) * bw.r;
      else if (G0 >= R0 && R0 >= B0) y = B0 + (R0 - B0) * bw.y + (G0 - R0) * bw.g;
      else if (G0 >= B0 && B0 >= R0) y = R0 + (B0 - R0) * bw.c + (G0 - B0) * bw.g;
      else if (B0 >= R0 && R0 >= G0) y = G0 + (R0 - G0) * bw.m + (B0 - R0) * bw.b;
      else y = R0 + (G0 - R0) * bw.c + (B0 - G0) * bw.b;
      r = g = b = y;
    }
    if (gm) {
      const j = Math.max(0, Math.min(255, (0.299 * r + 0.587 * g + 0.114 * b) | 0)) * 3;
      r = gm[j];
      g = gm[j + 1];
      b = gm[j + 2];
    }
    if (col) {
      const j = Math.max(0, Math.min(255, (0.299 * r + 0.587 * g + 0.114 * b) | 0)) * 3;
      r = col[j];
      g = col[j + 1];
      b = col[j + 2];
    }
    if (lt) [r, g, b] = lutPixel(lt, r, g, b);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  hslMixPixels(d, a.hsl ?? {});
  if (a.sharpen && w) sharpenPixels(d, w, d.length / 4 / w, a.sharpen > 0 ? (a.sharpen / 100) * 1.5 : a.sharpen / 100);
  effectPixels(d, a);
}

/** Tabelele puse înaintea ajustărilor: întinderea pe fiecare canal, apoi egalizarea (din histograma pixelilor dați). */
function preLuts(d: Uint8ClampedArray, a: Adjust): Uint8ClampedArray[] | null {
  if (!a.equalize && !a.chan) return null;
  const P = [0, 1, 2].map((c) => {
    const t = new Uint8ClampedArray(256);
    const [lo, hi] = a.chan?.[c] ?? [0, 255];
    const span = Math.max(1, hi - lo);
    for (let v = 0; v < 256; v++) t[v] = Math.round(((v - lo) * 255) / span);
    return t;
  });
  if (a.equalize) {
    const hist = new Uint32Array(256);
    const step = Math.max(1, Math.floor(d.length / 4 / 250000)) * 4;
    let n = 0;
    for (let i = 0; i < d.length; i += step) {
      if (d[i + 3] < 128) continue;
      hist[(0.299 * P[0][d[i]] + 0.587 * P[1][d[i + 1]] + 0.114 * P[2][d[i + 2]]) | 0]++;
      n++;
    }
    if (n) {
      let acc = 0, first = 0;
      for (let v = 0; v < 256; v++) if (hist[v]) { first = hist[v]; break; }
      const E = new Uint8ClampedArray(256);
      for (let v = 0; v < 256; v++) { acc += hist[v]; E[v] = n > first ? Math.round(((acc - first) * 255) / (n - first)) : v; }
      for (const t of P) for (let v = 0; v < 256; v++) t[v] = E[t[v]];
    }
  }
  return P;
}

/** Culoare automată: pe fiecare canal, cel mai închis 0,5% devine 0 și cel mai deschis 0,5% devine 255 (scoate tenta generală). */
export function autoColor(d: Uint8ClampedArray): [number, number][] {
  const H = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  const step = Math.max(1, Math.floor(d.length / 4 / 250000)) * 4;
  let n = 0;
  for (let i = 0; i < d.length; i += step) {
    if (d[i + 3] < 128) continue;
    H[0][d[i]]++;
    H[1][d[i + 1]]++;
    H[2][d[i + 2]]++;
    n++;
  }
  return H.map((h) => {
    if (!n) return [0, 255] as [number, number];
    const pct = (q: number) => { let acc = 0; for (let v = 0; v < 256; v++) if ((acc += h[v]) >= n * q) return v; return 255; };
    const lo = pct(0.005), hi = Math.max(lo + 1, pct(0.995));
    return [lo, hi] as [number, number];
  });
}

/** Procentele mixerului alb-negru ca fracții (40% → 0,4). */
function bwWeights(m: BW): BW {
  return { r: m.r / 100, y: m.y / 100, g: m.g / 100, c: m.c / 100, b: m.b / 100, m: m.m / 100 };
}

/** Rotește nuanța în HSL cu „sh” sextanți (grade / 60): cel mai mare și cel mai mic canal rămân, deci și luminozitatea HSL și
 *  saturația; se schimbă doar care canal e care și valoarea celui din mijloc (ca Hue/Saturation din Photoshop: roșu +120° = verde aprins). */
export function hslRotate(r: number, g: number, b: number, sh: number, out: number[]): void {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
  if (c <= 0) { out[0] = r; out[1] = g; out[2] = b; return; }
  let h = mx === r ? (g - b) / c : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
  h = (((h + sh) % 6) + 6) % 6;
  const x = mn + c * (1 - Math.abs((h % 2) - 1));
  const s = h | 0;
  if (s === 0) { out[0] = mx; out[1] = x; out[2] = mn; }
  else if (s === 1) { out[0] = x; out[1] = mx; out[2] = mn; }
  else if (s === 2) { out[0] = mn; out[1] = mx; out[2] = x; }
  else if (s === 3) { out[0] = mn; out[1] = x; out[2] = mx; }
  else if (s === 4) { out[0] = x; out[1] = mn; out[2] = mx; }
  else { out[0] = mx; out[1] = mn; out[2] = x; }
}

/** Matricea 3 × 3 care rotește nuanța cu „deg” grade și păstrează luminozitatea (W3C Filter Effects, hue-rotate). */
export function hueMatrix(deg: number): number[] {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}

/** Colorare: pentru fiecare luminozitate 0–255, culoarea HSL cu nuanța h și saturația s (ca Colorize din Photoshop). */
export function hslTable(h: number, sPct: number): Uint8ClampedArray {
  const t = new Uint8ClampedArray(256 * 3), sat = Math.max(0, Math.min(100, sPct)) / 100, hh = (((h % 360) + 360) % 360) / 360;
  const f = (p: number, q: number, x: number) => {
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  for (let v = 0; v < 256; v++) {
    const l = v / 255, q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
    t[v * 3] = Math.round(f(p, q, hh + 1 / 3) * 255);
    t[v * 3 + 1] = Math.round(f(p, q, hh) * 255);
    t[v * 3 + 2] = Math.round(f(p, q, hh - 1 / 3) * 255);
  }
  return t;
}

/**
 * Efectele de la final, ca straturile de ajustare puse deasupra în Photoshop: Negativ, apoi Posterizare, apoi Prag.
 * Transparența rămâne neatinsă.
 */
export function effectPixels(d: Uint8ClampedArray, a: Adjust) {
  const inv = !!a.invert, n = a.posterize && a.posterize >= 2 ? Math.min(255, Math.round(a.posterize)) : 0;
  const th = a.threshold && a.threshold > 0 ? Math.min(255, Math.round(a.threshold)) : 0;
  if (!inv && !n && !th) return;
  // Un singur tabel pentru negativ + posterizare (Photoshop: trepte egale, de la negru la alb).
  const t = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    let x = inv ? 255 - v : v;
    if (n) x = Math.round(Math.round((x / 255) * (n - 1)) * (255 / (n - 1)));
    t[v] = x;
  }
  for (let i = 0; i < d.length; i += 4) {
    const r = t[d[i]], g = t[d[i + 1]], b = t[d[i + 2]];
    if (th) {
      const y = (0.299 * r + 0.587 * g + 0.114 * b) >= th ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = y;
    } else {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
  }
}

/**
 * „Automat”: citește poza și propune ajustările, ca butonul de îmbunătățire din Photos. Întinde tonurile între cel mai
 * închis și cel mai deschis 1% din pixeli (contrast + luminozitate), corectează o tentă de culoare generală (temperatura,
 * după media culorilor), luminează umbrele dacă poza e întunecată și adaugă puțină saturație la pozele șterse.
 * Rezultatul apare pe glisoare, deci se poate corecta de mână. Pixelii transparenți nu contează.
 */
export function autoAdjust(d: Uint8ClampedArray): Adjust {
  const hist = new Uint32Array(256);
  let n = 0, sr = 0, sb = 0, sat = 0;
  // La pozele mari ajunge un pixel din câțiva (viteză); rezultatul e același.
  const step = Math.max(1, Math.floor(d.length / 4 / 250000)) * 4;
  for (let i = 0; i < d.length; i += step) {
    if (d[i + 3] < 128) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    hist[(0.299 * r + 0.587 * g + 0.114 * b) | 0]++;
    sr += r;
    sb += b;
    sat += Math.max(r, g, b) - Math.min(r, g, b);
    n++;
  }
  if (!n) return { ...NO_ADJUST };
  const pct = (q: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= n * q) return v;
    return 255;
  };
  const lo0 = pct(0.01), hi0 = pct(0.99);
  const clamp = (v: number, a: number, b: number) => Math.round(Math.max(a, Math.min(b, v)));
  // Poza subexpusă (nici cele mai luminoase zone nu ajung aproape de alb): întâi expunerea, ca la aparat.
  const exposure = hi0 < 200 ? clamp(50 * Math.log2(235 / Math.max(hi0, 1)), 0, 70) : 0;
  const gain = Math.pow(2, exposure / 50);
  const lo = Math.min(255, lo0 * gain), hi = Math.min(255, hi0 * gain);
  // Contrastul care duce [lo, hi] pe [0, 255] (inversul formulei din adjustPixels), cu prudență: poza nu se „arde”.
  const span = Math.max(32, hi - lo);
  const f = Math.min(2, 255 / span);
  const c = (259 * 255 * (f - 1)) / (259 + 255 * f);
  const contrast = clamp((c / 1.28) * 0.8, 0, 60);
  const brightness = clamp(((128 - (lo + hi) / 2) / 1.2) * 0.8, -40, 40);
  // Media luminii după întindere: o poză încă întunecată primește umbre luminate; una prea albă, lumini coborâte.
  let acc = 0;
  for (let v = 0; v < 256; v++) acc += hist[v] * Math.min(255, v * gain);
  const mean = ((acc / n - (lo + hi) / 2) * f + 128) / 255;
  const shadows = mean < 0.42 ? clamp((0.42 - mean) * 160, 0, 50) : 0;
  const highlights = mean > 0.62 ? clamp(-(mean - 0.62) * 160, -50, 0) : 0;
  // Tenta generală („lumea e gri în medie”), doar pe jumătate, ca apusurile să nu devină gri.
  const temperature = clamp(((sb - sr) / n) * 0.5, -40, 40);
  // Culorile șterse primesc puțină saturație; pozele alb-negru (fără culoare deloc) rămân așa.
  const saturation = sat / n > 6 && sat / n < 40 ? clamp((40 - sat / n) * 0.6, 0, 20) : 0;
  return { ...NO_ADJUST, exposure, brightness, contrast, saturation, temperature, shadows, highlights };
}

/** O copie a pozei cu ajustările aplicate. */
export function adjustCanvas(src: HTMLCanvasElement, a: Adjust): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  adjustPixels(img.data, a, c.width);
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Redimensionare de calitate: la micșorări mari, înjumătățim de mai multe ori (altfel liniile subțiri „se rup”),
 * apoi ajungem exact la mărimea cerută.
 */
export function resizeCanvas(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  let cur = src;
  while (cur.width / 2 >= w && cur.height / 2 >= h) {
    const half = document.createElement('canvas');
    half.width = Math.max(1, Math.round(cur.width / 2));
    half.height = Math.max(1, Math.round(cur.height / 2));
    const ctx = half.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, half.width, half.height);
    if (cur !== src) cur.width = 0;
    cur = half;
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, w, h);
  if (cur !== src) cur.width = 0;
  return out;
}
