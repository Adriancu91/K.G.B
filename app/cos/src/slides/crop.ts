// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Decuparea pozelor (Crop din PowerPoint): `crop` spune cât se taie din fiecare latură a pozei întregi (0–0,95, fracții).
// Caseta arată doar partea rămasă; poza din fișier rămâne întreagă, deci decuparea se poate desface oricând.
import type { SlideEl } from './model';

export interface Crop { l: number; t: number; r: number; b: number }
type Geom = Pick<SlideEl, 'x' | 'y' | 'w' | 'h'>;

const MAX = 0.95;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** Decuparea curățată (din fișier sau din import), sau undefined dacă nu taie nimic. */
export function cleanCrop(c: unknown): Crop | undefined {
  if (!c || typeof c !== 'object') return undefined;
  const o = c as Record<string, unknown>;
  const v = (k: string) => (typeof o[k] === 'number' && Number.isFinite(o[k]) ? Math.min(MAX, Math.max(0, o[k] as number)) : 0);
  const out = { l: r4(v('l')), t: r4(v('t')), r: r4(v('r')), b: r4(v('b')) };
  if (out.l + out.r > MAX || out.t + out.b > MAX) return undefined;
  return out.l || out.t || out.r || out.b ? out : undefined;
}

/** Poza întreagă (inclusiv părțile tăiate), în coordonatele slide-ului. */
export function fullBox(el: SlideEl): Geom {
  const c = el.crop ?? { l: 0, t: 0, r: 0, b: 0 };
  const w = el.w / (1 - c.l - c.r), h = el.h / (1 - c.t - c.b);
  return { x: el.x - c.l * w, y: el.y - c.t * h, w, h };
}

/**
 * Decupare prin tragere: poza întreagă stă pe loc, iar caseta nouă `g` (din mânere sau mutată) e fereastra prin care se vede.
 * Fereastra nu iese din poză și rămâne de cel puțin 5% din ea.
 */
export function cropTo(el: SlideEl, g: Geom): SlideEl {
  const f = fullBox(el);
  const side = (a: number, len: number, f0: number, fl: number, a0: number, len0: number) => {
    let lo = Math.max(f0, Math.min(a, f0 + fl)), hi = Math.min(f0 + fl, Math.max(a + len, f0));
    // Prea mică: rămâne cum era.
    if (hi - lo < fl * (1 - MAX)) { lo = a0; hi = a0 + len0; }
    return { lo, hi, cut0: (lo - f0) / fl, cut1: (f0 + fl - hi) / fl };
  };
  const h = side(g.x, g.w, f.x, f.w, el.x, el.w), v = side(g.y, g.h, f.y, f.h, el.y, el.h);
  const crop = cleanCrop({ l: h.cut0, r: h.cut1, t: v.cut0, b: v.cut1 });
  const out: SlideEl = { ...el, x: Math.round(h.lo), y: Math.round(v.lo), w: Math.round(h.hi - h.lo), h: Math.round(v.hi - v.lo) };
  if (crop) out.crop = crop; else delete out.crop;
  return out;
}

/** Fără decupare: caseta ia din nou poza întreagă, în locul ei. */
export function uncrop(el: SlideEl): SlideEl {
  const f = fullBox(el);
  const { crop: _c, ...rest } = el;
  return { ...rest, x: Math.round(f.x), y: Math.round(f.y), w: Math.round(f.w), h: Math.round(f.h) };
}

/** Stilul pozei din casetă: poza întreagă, mutată și mărită ca să se vadă doar partea rămasă. */
export function cropImgStyle(c: Crop): Record<string, string> {
  const w = 1 - c.l - c.r, h = 1 - c.t - c.b;
  return {
    position: 'absolute', objectFit: 'fill', maxWidth: 'none',
    width: `${100 / w}%`, height: `${100 / h}%`, left: `${(-c.l / w) * 100}%`, top: `${(-c.t / h) * 100}%`,
  };
}

/** În PowerPoint: <a:srcRect l t r b> în miimi de procent. */
export const srcRectXml = (c: Crop) =>
  `<a:srcRect l="${Math.round(c.l * 100000)}" t="${Math.round(c.t * 100000)}" r="${Math.round(c.r * 100000)}" b="${Math.round(c.b * 100000)}"/>`;
export function cropOfSrcRect(e: Element | null | undefined): Crop | undefined {
  if (!e) return undefined;
  const a = (k: string) => (Number(e.getAttribute(k) ?? 0) || 0) / 100000;
  return cleanCrop({ l: a('l'), t: a('t'), r: a('r'), b: a('b') });
}

/** Decupare la formă (Crop to Shape): poza se vede doar în interiorul formei; numele sunt cele din .pptx (a:prstGeom). */
export type ClipShape = 'ellipse' | 'roundRect' | 'triangle' | 'diamond' | 'hexagon' | 'star5' | 'heart';
export const CLIP_SHAPES: [ClipShape, string][] = [
  ['ellipse', 'Cerc / elipsă'], ['roundRect', 'Colțuri rotunjite'], ['triangle', 'Triunghi'], ['diamond', 'Romb'],
  ['hexagon', 'Hexagon'], ['star5', 'Stea'], ['heart', 'Inimă'],
];
export const cleanClip = (v: unknown): ClipShape | undefined => (CLIP_SHAPES.some(([k]) => k === v) ? v as ClipShape : undefined);

/** Stea cu 5 colțuri, în procente din casetă (pentru clip-path). */
function starPoints(): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.19 : 0.5;
    pts.push(`${(50 + r * 100 * Math.cos(a)).toFixed(1)}% ${(52 + r * 100 * Math.sin(a)).toFixed(1)}%`);
  }
  return `polygon(${pts.join(', ')})`;
}
/** Inima: două arce sus și vârful jos, ca poligon (clip-path cu path() nu se mărește odată cu caseta). */
function heartPoints(): string {
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = Math.PI - (i / 40) * 2 * Math.PI;
    const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push(`${(50 + (x / 17) * 50).toFixed(1)}% ${(40 - (y / 17) * 58).toFixed(1)}%`);
  }
  return `polygon(${pts.join(', ')})`;
}
/** clip-path pentru casetă (procente, deci urmează mărimea casetei). */
export function clipCss(s: ClipShape): string {
  switch (s) {
    case 'ellipse': return 'ellipse(50% 50% at 50% 50%)';
    case 'roundRect': return 'inset(0 round 16%)';
    case 'triangle': return 'polygon(50% 0, 100% 100%, 0 100%)';
    case 'diamond': return 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)';
    case 'hexagon': return 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)';
    case 'star5': return starPoints();
    case 'heart': return heartPoints();
  }
}

/** Proporțiile pentru „Decupează la proporție” (lățime / înălțime). */
export const ASPECTS: [string, number][] = [['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['16:9', 16 / 9], ['9:16', 9 / 16], ['3:2', 3 / 2], ['2:3', 2 / 3]];

/** Decupează poza la proporția dată: cea mai mare fereastră cu proporția aceea, în mijlocul pozei întregi. */
export function cropToAspect(el: SlideEl, ratio: number): SlideEl {
  const f = fullBox(el);
  const w = f.w / f.h > ratio ? f.h * ratio : f.w, h = w / ratio;
  return cropTo(el, { x: f.x + (f.w - w) / 2, y: f.y + (f.h - h) / 2, w, h });
}
