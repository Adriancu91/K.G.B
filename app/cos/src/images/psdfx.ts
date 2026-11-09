// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Stilurile de strat din .psd (blocul „lfx2”): un „descriptor” (listă de chei cu valori: numere, culori, liste, obiecte)
// din care luăm umbra, umbra interioară, strălucirile, conturul și culoarea peste, ca stiluri ale noastre (layerfx.ts).
// Ce nu putem reface la fel (modelele din fișier, conturul cu degrade…) se numără, ca să apară în mesajul de la deschidere.

import { patternFillOf, patternB64, type PsdPattern } from './psdPattern';
import type { LayerFx, FxShadow, FxGlow } from './layerfx';

type DVal = number | string | boolean | DObj | DVal[] | Uint8Array | null;
interface DObj { [key: string]: DVal }

class DescReader {
  p = 0;
  v: DataView;
  constructor(public b: Uint8Array) { this.v = new DataView(b.buffer, b.byteOffset, b.byteLength); }
  need(n: number) { if (this.p + n > this.b.length) throw new Error('descriptor tăiat'); }
  u8() { this.need(1); return this.b[this.p++]; }
  u32() { this.need(4); const x = this.v.getUint32(this.p); this.p += 4; return x; }
  i32() { this.need(4); const x = this.v.getInt32(this.p); this.p += 4; return x; }
  f64() { this.need(8); const x = this.v.getFloat64(this.p); this.p += 8; return x; }
  str(n: number) { this.need(n); let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(this.b[this.p + i]); this.p += n; return s; }
  /** Text Unicode: lungimea (în caractere) și caracterele pe câte 2 octeți. */
  ustr() {
    const n = this.u32();
    if (n > 100000) throw new Error('text prea lung');
    this.need(n * 2);
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.v.getUint16(this.p + i * 2));
    this.p += n * 2;
    return s.replace(/\0+$/, '');
  }
  /** O cheie: lungimea 0 înseamnă 4 litere, altfel atâtea litere. */
  key() { const n = this.u32(); return this.str(n || 4); }
}

function readValue(r: DescReader, type: string, depth: number): DVal {
  if (depth > 20) throw new Error('descriptor prea adânc');
  switch (type) {
    case 'Objc': case 'GlbO': return readDesc(r, depth + 1);
    case 'VlLs': {
      const n = r.u32();
      if (n > 10000) throw new Error('listă prea lungă');
      const out: DVal[] = [];
      for (let i = 0; i < n; i++) out.push(readValue(r, r.str(4), depth + 1));
      return out;
    }
    case 'doub': return r.f64();
    case 'UntF': r.str(4); return r.f64();
    case 'UnFl': { r.str(4); const n = r.u32(); const out: number[] = []; for (let i = 0; i < n; i++) out.push(r.f64()); return out; }
    case 'TEXT': return r.ustr();
    case 'enum': r.key(); return r.key();
    case 'long': return r.i32();
    case 'comp': r.need(8); r.p += 8; return null;
    case 'bool': return r.u8() !== 0;
    case 'type': case 'GlbC': r.ustr(); return r.key();
    case 'alis': { const n = r.u32(); r.need(n); r.p += n; return null; }
    // Date brute (la text: EngineData, cu fonturile și culorile), păstrate ca octeți.
    case 'tdta': { const n = r.u32(); r.need(n); r.p += n; return r.b.subarray(r.p - n, r.p); }
    default: throw new Error('tip necunoscut ' + type);
  }
}
function readDesc(r: DescReader, depth = 0): DObj {
  r.ustr();
  r.key();
  const n = r.u32();
  if (n > 10000) throw new Error('prea multe chei');
  const out: DObj = {};
  for (let i = 0; i < n; i++) {
    const k = r.key();
    out[k] = readValue(r, r.str(4), depth);
  }
  return out;
}

const num = (v: DVal | undefined, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const obj = (v: DVal | undefined): DObj | null => (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Uint8Array) ? v : null);
const hex = (x: number) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0');
/** Culoarea din descriptor (RGB, gri sau HSB); altfel negru. */
function colorOf(v: DVal | undefined): string {
  const c = obj(v);
  if (!c) return '#000000';
  if ('Rd  ' in c || 'redFloat' in c) {
    const k = 'redFloat' in c ? 255 : 1;
    return '#' + hex(num(c['Rd  '] ?? c.redFloat, 0) * k) + hex(num(c['Grn '] ?? c.greenFloat, 0) * k) + hex(num(c['Bl  '] ?? c.blueFloat, 0) * k);
  }
  if ('Gry ' in c) { const g = 255 - (num(c['Gry '], 0) * 255) / 100; return '#' + hex(g) + hex(g) + hex(g); }
  if ('H   ' in c) {
    const h = num(c['H   '], 0) / 60, s = num(c.Strt, 0) / 100, b = num(c.Brgh, 0) / 100;
    const f = (n: number) => { const k = (n + h) % 6; return b - b * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return '#' + hex(f(5) * 255) + hex(f(3) * 255) + hex(f(1) * 255);
  }
  return '#000000';
}
/** Efectul pornit (din cheia simplă sau din lista „…Multi”, primul pornit). */
function pick(d: DObj, key: string, multi: string): DObj | null {
  const list = d[multi];
  if (Array.isArray(list)) {
    for (const x of list) { const o = obj(x); if (o && o.enab !== false) return o; }
    return null;
  }
  const o = obj(d[key]);
  return o && o.enab !== false ? o : null;
}
const shadowOf = (o: DObj): FxShadow => ({
  color: colorOf(o['Clr ']), opacity: num(o.Opct, 75) / 100, angle: num(o.lagl, 120), distance: num(o.Dstn, 5), size: num(o.blur, 5),
});
const glowOf = (o: DObj): FxGlow => ({ color: colorOf(o['Clr ']), opacity: num(o.Opct, 75) / 100, size: num(o.blur, 5) });

/** Rezultatul: stilurile noastre și câte efecte din fișier nu le putem reface. */
export interface PsdFx { fx?: LayerFx; unsupported: number }

/**
 * Blocul textului (TySh): versiunea, transformarea (6 numere: xx xy yx yy tx ty), versiunea textului și descriptorul lui
 * (cu „Txt ” = textul și EngineData = fonturile, mărimile, culorile). Stricat → null.
 */
export function readTypeBlock(b: Uint8Array): { tf: number[]; d: Record<string, unknown> } | null {
  try {
    const r = new DescReader(b);
    r.need(2); r.p += 2;
    const tf: number[] = [];
    for (let i = 0; i < 6; i++) tf.push(r.f64());
    r.need(2); r.p += 2;
    return r.u32() === 16 ? { tf, d: readDesc(r) } : null;
  } catch { return null; }
}

/** Un bloc „versiune 16 + descriptor” (alb-negru, umpleri): cheile lui; stricat → null. */
export function readDescBlock(b: Uint8Array): Record<string, unknown> | null {
  try {
    const r = new DescReader(b);
    return r.u32() === 16 ? readDesc(r) : null;
  } catch { return null; }
}

/** Stratul de umplere cu o culoare (blocul „SoCo”: versiunea, apoi descriptorul cu „Clr ”) → culoarea lui; stricat → null. */
export function readSolidFill(b: Uint8Array): string | null {
  try {
    const r = new DescReader(b);
    if (r.u32() !== 16) return null;
    const d = readDesc(r);
    return d['Clr '] ? colorOf(d['Clr ']) : null;
  } catch { return null; }
}

/** Stratul de umplere cu degrade (blocul „GdFl”), cum e scris în fișier. */
export interface PsdGradFill {
  /** lin = liniar, rad = radial, ang = unghiular, refl = reflectat, dia = romb. */
  type: 'lin' | 'rad' | 'ang' | 'refl' | 'dia';
  /** Unghiul în grade (0 = spre dreapta, 90 = în sus). */
  angle: number;
  /** Scara în procente (100 = cât stratul). */
  scale: number;
  /** Mutarea centrului, în procente din lățime / înălțime. */
  offset: [number, number];
  /** Culorile: [culoarea, locul 0–1, mijlocul dintre ea și următoarea 0–1]. */
  stops: [string, number, number][];
  /** Transparența: [opacitatea 0–1, locul 0–1, mijlocul 0–1]. */
  alpha: [number, number, number][];
}

const GRAD_TYPES: Record<string, PsdGradFill['type']> = { 'Lnr ': 'lin', 'Rdl ': 'rad', Angl: 'ang', Rflc: 'refl', Dmnd: 'dia' };

/** Blocul „GdFl” (versiunea 16, apoi descriptorul) → degradeul; degradeul cu zgomot sau stricat → null. */
export function readGradientFill(b: Uint8Array): PsdGradFill | null {
  try {
    const r = new DescReader(b);
    if (r.u32() !== 16) return null;
    const d = readDesc(r);
    const gr = obj(d.Grad);
    if (!gr || (gr.GrdF !== undefined && gr.GrdF !== 'CstS')) return null;
    const list = (v: DVal | undefined) => (Array.isArray(v) ? v.map(obj).filter((x): x is DObj => !!x) : []);
    // Locurile sunt pe 0–4096, mijlocul pe 0–100 (50 = la jumătate).
    let stops = list(gr.Clrs).map((c): [string, number, number] => [colorOf(c['Clr ']), num(c.Lctn, 0) / 4096, num(c.Mdpn, 50) / 100]);
    let alpha = list(gr.Trns).map((c): [number, number, number] => [num(c.Opct, 100) / 100, num(c.Lctn, 0) / 4096, num(c.Mdpn, 50) / 100]);
    if (!stops.length) return null;
    if (!alpha.length) alpha = [[1, 0, 0.5], [1, 1, 0.5]];
    if (d.Rvrs === true) {
      // Întors: locurile se oglindesc, iar mijlocul fiecărei bucăți trece la bucata oglindită.
      const flip = <T extends [unknown, number, number]>(a: T[]): T[] => {
        const o = a.map((s) => [s[0], 1 - s[1], 0.5] as T).reverse();
        for (let i = 0; i + 1 < o.length; i++) o[i][2] = 1 - a[a.length - 2 - i][2];
        return o;
      };
      stops = flip(stops);
      alpha = flip(alpha);
    }
    const of = obj(d.Ofst);
    return {
      type: GRAD_TYPES[String(d.Type)] ?? 'lin', angle: num(d.Angl, 90), scale: num(d['Scl '], 100),
      offset: [num(of?.Hrzn, 0), num(of?.Vrtc, 0)], stops, alpha,
    };
  } catch { return null; }
}

/** Valoarea degradeului în locul t (0–1): [r, g, b, opacitatea 0–1]. Mijlocul m strânge sau lărgește trecerea dintre două opriri. */
function gradAt<T>(list: [T, number, number][], t: number, mix: (a: T, b: T, f: number) => T): T {
  if (t <= list[0][1]) return list[0][0];
  for (let i = 0; i + 1 < list.length; i++) {
    const [a, pa, m] = list[i], [b, pb] = list[i + 1];
    if (t > pb) continue;
    let f = pb > pa ? (t - pa) / (pb - pa) : 1;
    const mid = Math.max(0.01, Math.min(0.99, m));
    if (mid !== 0.5) f = Math.pow(f, Math.log(0.5) / Math.log(mid));
    return mix(a, b, f);
  }
  return list[list.length - 1][0];
}

/** Desenează stratul de umplere cu degrade cât toată poza (w × h), ca în fișier. */
export function drawGradientFill(g: PsdGradFill, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  const rgb = g.stops.map(([c, at, m]): [number[], number, number] => { const n = parseInt(c.slice(1), 16); return [[n >> 16, (n >> 8) & 255, n & 255], at, m]; });
  // Tabel cu 1024 de trepte, ca să nu calculăm degradeul la fiecare pixel.
  const N = 1024, lut = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const c = gradAt(rgb, t, (a, b, f) => a.map((v, k) => v + (b[k] - v) * f));
    lut[i * 4] = c[0]; lut[i * 4 + 1] = c[1]; lut[i * 4 + 2] = c[2];
    lut[i * 4 + 3] = gradAt(g.alpha, t, (a, b, f) => a + (b - a) * f);
  }
  gradientPlaces(g, w, h, (o, t) => {
    const k = Math.round(t * (N - 1)) * 4;
    out[o * 4] = lut[k]; out[o * 4 + 1] = lut[k + 1]; out[o * 4 + 2] = lut[k + 2]; out[o * 4 + 3] = lut[k + 3] * 255;
  });
  return out;
}

/**
 * Locul în degrade (0–1) al fiecărui pixel dintr-o poză w × h, după felul degradeului (liniar, radial, unghiular, oglindit,
 * romb), unghi, scară și mutarea centrului: `put(pixel, t)`, cu pixelul numărat rând cu rând.
 */
export function gradientPlaces(g: Pick<PsdGradFill, 'type' | 'angle' | 'scale' | 'offset'>, w: number, h: number, put: (o: number, t: number) => void) {
  const a = (g.angle * Math.PI) / 180, dx = Math.cos(a), dy = -Math.sin(a);
  const cx = w / 2 + (g.offset[0] / 100) * w, cy = h / 2 + (g.offset[1] / 100) * h;
  // Jumătatea lungimii: elipsa stratului pe direcția unghiului (la un pătrat, cât jumătatea laturii la orice unghi;
  // potrivit pe pixelii din fișierele de test); scara o mărește sau o micșorează.
  const half = Math.max(1e-6, (Math.hypot(w * dx, h * dy) / 2) * (g.scale / 100));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - cx, py = y + 0.5 - cy;
      const along = px * dx + py * dy, across = -px * dy + py * dx;
      let t: number;
      if (g.type === 'lin') t = 0.5 + along / (2 * half);
      else if (g.type === 'rad') t = Math.hypot(px, py) / half;
      else if (g.type === 'refl') t = Math.abs(along) / half;
      else if (g.type === 'dia') t = (Math.abs(along) + Math.abs(across)) / half;
      // Unghiular: pornește de pe direcția unghiului și se rotește în sensul acelor de ceasornic.
      else { const d = a - Math.atan2(-py, px), T = 2 * Math.PI; t = (((d % T) + T) % T) / T; }
      put(y * w + x, Math.max(0, Math.min(1, t)));
    }
  }
}

/**
 * Opririle unui degrade cu transparența lui: la fiecare loc unde se schimbă culoarea sau opacitatea, culoarea (amestecată
 * liniar între opririle vecine) și opacitatea, ca „rgba(…)”; locurile 0–1. `rev` = degradeul întors.
 */
function rgbaStops(gr: DObj | null, rev: boolean): [string, number][] {
  const list = (v: DVal | undefined) => (Array.isArray(v) ? v.map(obj).filter((x): x is DObj => !!x) : []);
  const cs = list(gr?.Clrs).map((c) => ({ at: num(c.Lctn, 0) / 4096, rgb: [1, 3, 5].map((i) => parseInt(colorOf(c['Clr ']).slice(i, i + 2), 16)) }));
  const ts = list(gr?.Trns).map((t) => ({ at: num(t.Lctn, 0) / 4096, a: num(t.Opct, 100) / 100 }));
  if (cs.length < 2) return [];
  const lerp = <T,>(arr: { at: number }[], at: number, val: (i: number) => T, mix: (a: T, b: T, f: number) => T): T => {
    if (at <= arr[0].at) return val(0);
    for (let i = 1; i < arr.length; i++) if (at <= arr[i].at) { const f = (at - arr[i - 1].at) / Math.max(1e-9, arr[i].at - arr[i - 1].at); return mix(val(i - 1), val(i), f); }
    return val(arr.length - 1);
  };
  const places = [...new Set([...cs.map((c) => c.at), ...ts.map((t) => t.at)])].sort((a, b) => a - b);
  const out = places.map((at): [string, number] => {
    const rgb = lerp(cs, at, (i) => cs[i].rgb, (a, b, f) => a.map((v, j) => v + (b[j] - v) * f));
    const a = ts.length ? lerp(ts, at, (i) => ts[i].a, (x, y, f) => x + (y - x) * f) : 1;
    return [`rgba(${rgb.map((v) => Math.round(v)).join(',')},${+a.toFixed(3)})`, at];
  });
  return rev ? out.map(([c, at]): [string, number] => [c, 1 - at]).reverse() : out;
}

/** Citește blocul „lfx2” (versiunea efectelor, versiunea descriptorului, descriptorul). Fișier stricat → null. */
export function readLayerFx(b: Uint8Array, pats?: Map<string, PsdPattern>): PsdFx | null {
  try {
    const r = new DescReader(b);
    r.u32();
    if (r.u32() !== 16) return null;
    const d = readDesc(r);
    if (d.masterFXSwitch === false) return { unsupported: 0 };
    const fx: LayerFx = {};
    const ds = pick(d, 'DrSh', 'dropShadowMulti');
    if (ds) fx.shadow = shadowOf(ds);
    const is = pick(d, 'IrSh', 'innerShadowMulti');
    if (is) fx.innerShadow = shadowOf(is);
    const og = pick(d, 'OrGl', 'outerGlowMulti');
    if (og) fx.outerGlow = glowOf(og);
    const ig = pick(d, 'IrGl', 'innerGlowMulti');
    if (ig) fx.innerGlow = glowOf(ig);
    const st = pick(d, 'FrFX', 'frameFXMulti');
    if (st) {
      // Poziția: OutF = pe dinafară (implicit), InsF = înăuntru, CtrF = pe margine.
      const pos = st.Styl === 'InsF' ? 'in' : st.Styl === 'CtrF' ? 'center' : undefined;
      fx.stroke = { color: colorOf(st['Clr ']), opacity: num(st.Opct, 100) / 100, size: num(st['Sz  '], 3), ...(pos ? { pos } as const : {}) };
      // Conturul cu degrade liniar sau radial (cel cu „zgomot”, fără culori scrise, rămâne cu o culoare).
      const stops = st.PntT === 'GrFl' ? rgbaStops(obj(st.Grad), st.Rvrs === true) : [];
      const type = st.Type === undefined ? 'lin' : GRAD_TYPES[String(st.Type)];
      if (stops.length >= 2 && type) {
        fx.stroke.grad = {
          stops, angle: num(st.Angl, 90), scale: num(st['Scl '], 100),
          ...(type === 'rad' ? { radial: true } : type !== 'lin' ? { style: type } : {}),
        };
      }
    }
    const gf = pick(d, 'GrFl', 'gradientFillMulti');
    let gradOk = true;
    if (gf) {
      const gr = obj(gf.Grad);
      const raw = Array.isArray(gr?.Clrs) ? gr!.Clrs.map(obj).filter((x): x is DObj => !!x) : [];
      let stops = raw.map((c): [string, number] => [colorOf(c['Clr ']), num(c.Lctn, 0) / 4096]);
      if (gf.Rvrs === true) stops = stops.map(([c, at]): [string, number] => [c, 1 - at]).reverse();
      if (stops.length >= 2) {
        // Felul: liniar, radial, unghiular, oglindit sau romb (celelalte, necunoscute, se pun liniar și se numără ca pierdere).
        const type = gf.Type === undefined ? 'lin' : GRAD_TYPES[String(gf.Type)];
        const scale = num(gf['Scl '], 100);
        fx.gradient = {
          color: stops[0][0], color2: stops[stops.length - 1][0], angle: num(gf.Angl, 90), opacity: num(gf.Opct, 100) / 100,
          ...(stops.length > 2 ? { stops } : {}), ...(type && type !== 'lin' ? { style: type } : {}), ...(scale !== 100 ? { scale } : {}),
        };
        gradOk = !!type;
      } else gradOk = false;
    }
    const bv = pick(d, 'ebbl', '-');
    // Felul reliefului: InrB = interior, OtrB = exterior, Embs = în relief, PlEb = pernă, strokeEmboss = doar pe contur.
    const bvStyle = bv?.bvlS === 'OtrB' ? 'outer' : bv?.bvlS === 'Embs' ? 'emboss' : bv?.bvlS === 'PlEb' ? 'pillow' : undefined;
    if (bv) fx.bevel = {
      color: colorOf(bv.hglC), color2: colorOf(bv.sdwC), opacity: (num(bv.hglO, 75) + num(bv.sdwO, 75)) / 200,
      angle: num(bv.lagl, 120), size: num(bv.blur, 5), depth: num(bv.srgR, 100) / 100, up: bv.bvlD !== 'Out ',
      ...(bvStyle ? { style: bvStyle } as const : {}),
    };
    const so = pick(d, 'SoFi', 'solidFillMulti');
    if (so) fx.overlay = { color: colorOf(so['Clr ']), opacity: num(so.Opct, 100) / 100 };
    const sa = pick(d, 'ChFX', '-');
    if (sa) fx.satin = {
      color: colorOf(sa['Clr ']), opacity: num(sa.Opct, 50) / 100, angle: num(sa.lagl, 19), distance: num(sa.Dstn, 11), size: num(sa.blur, 14), invert: sa.Invr !== false,
    };
    let unsupported = 0;
    // Conturul cu degrade sau model: îl punem cu o singură culoare, dar spunem că nu e la fel.
    if (st && st.PntT !== undefined && st.PntT !== 'SClr' && !fx.stroke?.grad) unsupported++;
    if (!gradOk) unsupported++;
    // Relieful doar pe contur se pune ca relief interior.
    if (bv && bv.bvlS !== undefined && bv.bvlS !== 'InrB' && !bvStyle) unsupported++;
    // Modelul peste: poza lui e păstrată în fișier (blocurile „Patt”); fără ea (lipsă din fișier) nu-l putem pune.
    const pf = pick(d, 'patternFill', '-');
    if (pf) {
      const fill = patternFillOf(pf as Record<string, unknown>), pat = fill && pats?.get(fill.id);
      // Modelul mare (peste ~1 milion de pixeli) nu-l ținem în proiect.
      if (fill && pat && pat.w * pat.h <= 1 << 20) {
        fx.pattern = { color: '#000000', opacity: num(pf.Opct, 100) / 100, kind: 0, size: 12, src: { w: pat.w, h: pat.h, px: patternB64(pat), scale: fill.scale } };
      } else unsupported++;
    }
    return { fx: Object.keys(fx).length ? fx : undefined, unsupported };
  } catch {
    return null;
  }
}
