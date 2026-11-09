// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Stilurile de strat (Layer styles în Photoshop): umbră, strălucire, contur, umbră și strălucire interioară, culoare, degrade și model peste, satin, relief.
// Sunt nedistructive: pixelii stratului rămân neschimbați, efectele se desenează la fiecare afișare (și se pot opri oricând).
// Totul e făcut cu pânze 2D (filtrul blur al pânzei și desenări suprapuse), fără placa video.

import { blankCanvas } from './layers';
import { patternTile } from './tone';
import { drawGradientFill, gradientPlaces } from './psdfx';

/** Umbra (în afară sau în interior): unghiul luminii în grade (120 = de sus-stânga, ca în programele mari), distanța și mărimea în pixeli. */
export interface FxShadow { color: string; opacity: number; angle: number; distance: number; size: number }
/** Strălucirea (în afară sau în interior): culoare, opacitate și mărime în pixeli. */
export interface FxGlow { color: string; opacity: number; size: number }
/** Conturul: pe dinafara formei (implicit), înăuntrul ei (`in`, ca o ramă pe o poză întreagă) sau pe margine, jumătate-jumătate (`center`). */
export interface FxStroke {
  color: string; opacity: number; size: number; pos?: 'in' | 'center';
  /**
   * Conturul umplut cu un degrade (din .psd): culorile cu transparența lor (rgba) și locul 0–1, unghiul ca la degradeul peste,
   * liniar sau radial (din mijloc), cu scara în procente. Când e, înlocuiește culoarea. `style`: unghiular, oglindit sau romb.
   */
  grad?: { stops: [string, number][]; angle: number; radial?: boolean; scale?: number; style?: 'ang' | 'refl' | 'dia' };
}
/**
 * Degradeul pus peste strat: de la `color` la `color2`, în direcția unghiului (0 = de la stânga la dreapta, 90 = de jos în sus).
 * `stops` (culoare, loc 0–1) vin din .psd când degradeul are mai multe culori; o culoare schimbată din panou le înlocuiește.
 */
/**
 * Degradeul peste: `style` lipsă = liniar; rad = radial (din mijloc), ang = unghiular (în jurul mijlocului), refl = oglindit
 * (din mijloc spre ambele părți), dia = romb; `scale` în procente (100 = cât forma).
 */
export interface FxGradient { color: string; color2: string; angle: number; opacity: number; stops?: [string, number][]; style?: 'rad' | 'ang' | 'refl' | 'dia'; scale?: number }
/** Felurile degradeului peste, cu numele din panou. */
export const GRAD_STYLES: ['lin' | NonNullable<FxGradient['style']>, string][] = [['lin', 'Liniar'], ['rad', 'Radial'], ['ang', 'Unghiular'], ['refl', 'Oglindit'], ['dia', 'Romb']];
/** Relieful: marginile dinăuntru luminate dinspre unghiul ales și umbrite în partea opusă; `depth` 1 = 100%, `up` = în afară (nu adâncit). */
export interface FxBevel {
  color: string; color2: string; opacity: number; angle: number; size: number; depth: number; up: boolean;
  /** Unde e panta: lipsă = înăuntrul formei; outer = în afara ei; emboss = de o parte și de alta a marginii; pillow = ca o pernă cusută pe margine. */
  style?: 'outer' | 'emboss' | 'pillow';
}
/** Culoarea pusă peste tot stratul (doar unde are pixeli). */
export interface FxOverlay { color: string; opacity: number }
/**
 * Satinul: umbre moi, ca reflexiile pe mătase. Forma, mutată în direcția unghiului și în cea opusă, încețoșată, se scade din ea însăși;
 * ce rămâne (marginile care nu se suprapun) se colorează în interiorul formei. `invert` = umbra pe mijloc, nu pe margini.
 */
export interface FxSatin { color: string; opacity: number; angle: number; distance: number; size: number; invert: boolean }
/** Modelul pus peste formă: unul din modelele de la pensula Model (dungi, carouri, puncte, cărămizi), cu mărimea plăcuței în pixeli. */
export interface FxPattern {
  color: string; opacity: number; kind: number; size: number;
  /** Modelul adus dintr-un .psd: poza lui (RGBA în base64) și scara în procente; când e, înlocuiește modelul ales din listă. */
  src?: { w: number; h: number; px: string; scale: number };
}

/** Un efect lipsă = oprit. */
export interface LayerFx {
  shadow?: FxShadow;
  outerGlow?: FxGlow;
  stroke?: FxStroke;
  gradient?: FxGradient;
  overlay?: FxOverlay;
  innerGlow?: FxGlow;
  innerShadow?: FxShadow;
  bevel?: FxBevel;
  satin?: FxSatin;
  pattern?: FxPattern;
  /**
   * Opacitatea umplerii (Fill), între 0 și 1; lipsă = 1. Spre deosebire de opacitatea stratului, face transparenți doar
   * pixelii stratului: stilurile (umbră, contur, culoare peste…) rămân întregi (de exemplu text doar cu contur, fără umplere).
   */
  fill?: number;
}
export type FxKind = Exclude<keyof LayerFx, 'fill'>;

/** Valorile cu care pornește fiecare efect când e bifat. */
export const FX_DEFAULTS: { [K in FxKind]-?: NonNullable<LayerFx[K]> } = {
  shadow: { color: '#000000', opacity: 0.6, angle: 120, distance: 8, size: 10 },
  outerGlow: { color: '#ffee88', opacity: 0.8, size: 14 },
  stroke: { color: '#000000', opacity: 1, size: 4 },
  gradient: { color: '#000000', color2: '#ffffff', angle: 90, opacity: 1 },
  overlay: { color: '#ff0000', opacity: 1 },
  innerGlow: { color: '#ffffcc', opacity: 0.8, size: 12 },
  innerShadow: { color: '#000000', opacity: 0.6, angle: 120, distance: 6, size: 8 },
  bevel: { color: '#ffffff', color2: '#000000', opacity: 0.75, angle: 120, size: 8, depth: 1, up: true },
  satin: { color: '#000000', opacity: 0.5, angle: 19, distance: 11, size: 14, invert: true },
  pattern: { color: '#000000', opacity: 0.5, kind: 0, size: 12 },
};
/** Numele din panou, în ordinea în care apar. */
export const FX_NAMES: [FxKind, string, string][] = [
  ['shadow', '◪ Umbră', 'Umbra stratului pe ce e dedesubt, ca și cum lumina ar veni din unghiul ales'],
  ['outerGlow', '✺ Strălucire', 'Un halou de lumină în jurul formei'],
  ['stroke', '▢ Contur', 'O linie de jur împrejurul formei (bun la texte și obiecte decupate)'],
  ['gradient', '▤ Degrade peste', 'Un degrade între două culori peste toată forma, în direcția aleasă'],
  ['overlay', '■ Culoare peste', 'Toată forma ia culoarea aleasă (de exemplu o siglă recolorată), fără să se strice pixelii'],
  ['innerGlow', '◌ Strălucire interioară', 'Lumină pe marginile din interiorul formei'],
  ['innerShadow', '◩ Umbră interioară', 'Umbră pe marginile din interior, ca și cum forma ar fi adâncită'],
  ['bevel', '◆ Relief', 'Marginile formei luminate pe o parte și umbrite pe cealaltă, ca un buton sau o literă în relief'],
  ['satin', '≈ Satin', 'Umbre moi în interiorul formei, ca reflexiile pe mătase sau pe metal lustruit'],
  ['pattern', '▦ Model peste', 'Un model (dungi, carouri, puncte, cărămizi) peste toată forma, fără să se strice pixelii'],
];

/** Plăcuța modelului adus din .psd (pixelii lui, din base64). */
function srcTile(src: NonNullable<FxPattern['src']>): HTMLCanvasElement | null {
  try {
    const bin = atob(src.px);
    if (bin.length !== src.w * src.h * 4) return null;
    const c = blankCanvas(src.w, src.h);
    const d = new ImageData(src.w, src.h);
    for (let i = 0; i < bin.length; i++) d.data[i] = bin.charCodeAt(i);
    c.getContext('2d')!.putImageData(d, 0, 0);
    return c;
  } catch { return null; }
}

/** Are stratul măcar un efect pornit? */
export const hasFx = (fx?: LayerFx) => !!fx && ((fx.fill ?? 1) < 1 || (Object.keys(fx) as (keyof LayerFx)[]).some((k) => k !== 'fill' && !!fx[k]));

/** Forma pozei (canalul de transparență) umplută cu o singură culoare. */
function silhouette(pic: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const out = blankCanvas(pic.width, pic.height), ctx = out.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(pic, 0, 0);
  return out;
}
/** Culoarea peste tot în afara formei (pentru efectele din interior). */
function outside(pic: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const out = blankCanvas(pic.width, pic.height), ctx = out.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(pic, 0, 0);
  return out;
}
/**
 * Forma „îngroșată” cu R pixeli: aceeași siluetă desenată de jur împrejur, pe mai multe cercuri până la R.
 * `src` poate fi mai mare decât poza (cu `pad` pixeli pe fiecare latură); rezultatul are mărimea pozei.
 */
function dilate(src: HTMLCanvasElement, R: number, w: number, h: number, pad = 0): HTMLCanvasElement {
  const ring = blankCanvas(w, h), rc = ring.getContext('2d')!;
  for (let r = R; r > 0; r -= Math.max(1, R / 3)) {
    const n = Math.min(48, Math.max(8, Math.ceil((2 * Math.PI * r) / 1.5)));
    for (let i = 0; i < n; i++) rc.drawImage(src, Math.cos((2 * Math.PI * i) / n) * r - pad, Math.sin((2 * Math.PI * i) / n) * r - pad);
  }
  return ring;
}

/** Conturul dinăuntru: tot ce e în afara formei (și dincolo de marginile pozei), îngroșat cu R spre interior și tăiat pe formă. */
function innerRing(pic: HTMLCanvasElement, color: string, R: number): HTMLCanvasElement {
  const w = pic.width, h = pic.height, pad = Math.ceil(R) + 2;
  const out = blankCanvas(w + 2 * pad, h + 2 * pad), oc = out.getContext('2d')!;
  oc.fillStyle = color;
  oc.fillRect(0, 0, out.width, out.height);
  oc.globalCompositeOperation = 'destination-out';
  oc.drawImage(pic, pad, pad);
  const ring = dilate(out, R, w, h, pad), rc = ring.getContext('2d')!;
  rc.globalCompositeOperation = 'destination-in';
  rc.drawImage(pic, 0, 0);
  return ring;
}

/** Linia degradeului: trece prin mijlocul pozei, pe toată lungimea ei în direcția unghiului (90 = de jos în sus). */
function linearAcross(ctx: CanvasRenderingContext2D, w: number, h: number, angle: number, scale = 1): CanvasGradient {
  const a = (angle * Math.PI) / 180, dx = Math.cos(a), dy = -Math.sin(a), half = ((Math.abs(dx) * w + Math.abs(dy) * h) / 2) * scale;
  return ctx.createLinearGradient(w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half);
}
/** Conturul cu degrade: inelul (desenat cu o culoare) e vopsit pe loc cu degradeul, păstrându-i forma. Fără degrade rămâne la fel. */
function strokePaint(ring: HTMLCanvasElement, s: FxStroke): HTMLCanvasElement {
  if (!s.grad?.stops.length) return ring;
  const w = ring.width, h = ring.height, c = ring.getContext('2d')!, k = Math.max(0.05, (s.grad.scale ?? 100) / 100);
  c.save();
  c.globalCompositeOperation = 'source-in';
  if (s.grad.style) {
    // Unghiular, oglindit, romb: un tabel de 1024 de culori (cu transparența lor), pus pixel cu pixel.
    const N = 1024, row = blankCanvas(N, 1), rc = row.getContext('2d')!, lg = rc.createLinearGradient(0, 0, N, 0);
    for (const [col, at] of s.grad.stops) lg.addColorStop(Math.max(0, Math.min(1, at)), col);
    rc.fillStyle = lg;
    rc.fillRect(0, 0, N, 1);
    const lut = rc.getImageData(0, 0, N, 1).data, px = new Uint8ClampedArray(w * h * 4);
    row.width = 0;
    gradientPlaces({ type: s.grad.style, angle: s.grad.angle, scale: s.grad.scale ?? 100, offset: [0, 0] }, w, h, (o, t) => {
      const j = Math.min(N - 1, Math.floor(t * N)) * 4;
      px[o * 4] = lut[j]; px[o * 4 + 1] = lut[j + 1]; px[o * 4 + 2] = lut[j + 2]; px[o * 4 + 3] = lut[j + 3];
    });
    const tile = blankCanvas(w, h);
    tile.getContext('2d')!.putImageData(new ImageData(px as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
    c.drawImage(tile, 0, 0);
    tile.width = 0;
  } else {
    const g = s.grad.radial ? c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, (Math.hypot(w, h) / 2) * k) : linearAcross(c, w, h, s.grad.angle, k);
    for (const [col, at] of s.grad.stops) g.addColorStop(Math.max(0, Math.min(1, at)), col);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
  c.restore();
  return ring;
}

/** Desenează `src` pe ctx, încețoșat cu `blur` pixeli și mutat cu (dx, dy). */
function drawSoft(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, blur: number, dx = 0, dy = 0) {
  ctx.save();
  if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(2)}px)`;
  ctx.drawImage(src, dx, dy);
  ctx.restore();
}
/** Deplasarea umbrei: lumina vine din `angle` grade, deci umbra cade în partea opusă. */
const offsetOf = (s: FxShadow, k: number) => {
  const a = (s.angle * Math.PI) / 180;
  return [-Math.cos(a) * s.distance * k, Math.sin(a) * s.distance * k];
};

/**
 * Poza stratului cu efectele puse (o pânză nouă de aceeași mărime). `k` = scara față de poza reală
 * (mărimile efectelor sunt în pixelii pozei, deci pe ecranul micșorat se micșorează și ele).
 */
export function withFx(pic: HTMLCanvasElement, fx: LayerFx, k = 1): HTMLCanvasElement {
  const w = pic.width, h = pic.height;
  const out = blankCanvas(w, h), ctx = out.getContext('2d')!;
  const temp: HTMLCanvasElement[] = [];
  const keep = (c: HTMLCanvasElement) => (temp.push(c), c);
  // Sub stratul propriu-zis: umbra, strălucirea și conturul.
  if (fx.shadow) {
    const [dx, dy] = offsetOf(fx.shadow, k);
    ctx.globalAlpha = fx.shadow.opacity;
    drawSoft(ctx, keep(silhouette(pic, fx.shadow.color)), (fx.shadow.size * k) / 2, dx, dy);
  }
  if (fx.outerGlow) {
    const s = keep(silhouette(pic, fx.outerGlow.color));
    ctx.globalAlpha = fx.outerGlow.opacity;
    // De două ori: halou mai plin lângă formă, ca la „spread” mic.
    drawSoft(ctx, s, (fx.outerGlow.size * k) / 2);
    drawSoft(ctx, s, (fx.outerGlow.size * k) / 4);
  }
  // Conturul pe dinafară stă sub strat; cel dinăuntru (și jumătatea dinăuntru a celui de pe margine) se pune peste, la sfârșit.
  const strokeR = fx.stroke && fx.stroke.size > 0 ? Math.max(0.5, fx.stroke.size * k) : 0;
  const outR = !fx.stroke?.pos ? strokeR : fx.stroke.pos === 'center' ? strokeR / 2 : 0;
  const inR = strokeR - outR;
  if (fx.stroke && outR > 0) {
    ctx.globalAlpha = fx.stroke.opacity;
    ctx.drawImage(strokePaint(keep(dilate(keep(silhouette(pic, fx.stroke.color)), outR, w, h)), fx.stroke), 0, 0);
  }
  ctx.globalAlpha = 1;
  // Stratul, apoi peste el (doar unde are pixeli) culoarea, strălucirea și umbra interioară.
  // Cu umplerea sub 100%, efectele dinăuntru se desenează separat și se taie apoi după forma stratului (întreagă),
  // iar pixelii stratului se pun sub ele, mai transparenți.
  const fill = Math.max(0, Math.min(1, fx.fill ?? 1));
  const body = keep(blankCanvas(w, h)), bc = body.getContext('2d')!;
  if (fill >= 1) {
    bc.drawImage(pic, 0, 0);
    bc.globalCompositeOperation = 'source-atop';
  }
  // Ordinea din programele mari, de jos în sus: model, degrade, culoare, satin, strălucire și umbră interioară, relief.
  if (fx.pattern) {
    const p = fx.pattern;
    const own = p.src ? srcTile(p.src) : null;
    const tile = own ? keep(own) : keep(patternTile(Math.max(0, Math.round(p.kind)), p.color, Math.max(8, p.size * k)));
    bc.globalAlpha = p.opacity;
    const pat = bc.createPattern(tile, 'repeat');
    // Modelul din fișier se mărește cu scara lui (și cu mărimea afișării).
    if (pat && own && p.src) { const s = (p.src.scale / 100) * k; pat.setTransform(new DOMMatrix([s, 0, 0, s, 0, 0])); }
    bc.fillStyle = pat ?? p.color;
    bc.fillRect(0, 0, w, h);
  }
  if (fx.gradient?.style) {
    // Radial, unghiular, oglindit, romb: pixel cu pixel, ca degradeurile din .psd.
    const g = fx.gradient;
    const stops = (g.stops?.length ? g.stops : ([[g.color, 0], [g.color2, 1]] as [string, number][])).map(([c, at]): [string, number, number] => [c, at, 0.5]);
    const tile = keep(blankCanvas(w, h));
    const px = drawGradientFill({ type: g.style ?? 'lin', angle: g.angle, scale: g.scale ?? 100, offset: [0, 0], stops, alpha: [[1, 0, 0.5], [1, 1, 0.5]] }, w, h);
    tile.getContext('2d')!.putImageData(new ImageData(px as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
    bc.globalAlpha = g.opacity;
    bc.drawImage(tile, 0, 0);
  } else if (fx.gradient) {
    const g = fx.gradient, lg = linearAcross(bc, w, h, g.angle);
    const stops = g.stops?.length ? g.stops : ([[g.color, 0], [g.color2, 1]] as [string, number][]);
    for (const [c, at] of stops) lg.addColorStop(Math.max(0, Math.min(1, at)), c);
    bc.globalAlpha = g.opacity;
    bc.fillStyle = lg;
    bc.fillRect(0, 0, w, h);
  }
  if (fx.overlay) {
    bc.globalAlpha = fx.overlay.opacity;
    bc.fillStyle = fx.overlay.color;
    bc.fillRect(0, 0, w, h);
  }
  if (fx.satin) {
    const s = fx.satin, a = (s.angle * Math.PI) / 180, dx = Math.cos(a) * s.distance * k, dy = -Math.sin(a) * s.distance * k;
    const sil = keep(silhouette(pic, s.color));
    const m = keep(blankCanvas(w, h)), mc = m.getContext('2d')!;
    drawSoft(mc, sil, (s.size * k) / 2, dx, dy);
    mc.globalCompositeOperation = 'xor';
    drawSoft(mc, sil, (s.size * k) / 2, -dx, -dy);
    let src = m;
    if (s.invert) {
      src = keep(blankCanvas(w, h));
      const ic = src.getContext('2d')!;
      ic.fillStyle = s.color;
      ic.fillRect(0, 0, w, h);
      ic.globalCompositeOperation = 'destination-out';
      ic.drawImage(m, 0, 0);
    }
    bc.globalAlpha = s.opacity;
    bc.drawImage(src, 0, 0);
  }
  if (fx.innerGlow) {
    bc.globalAlpha = fx.innerGlow.opacity;
    drawSoft(bc, keep(outside(pic, fx.innerGlow.color)), (fx.innerGlow.size * k) / 2);
  }
  if (fx.innerShadow) {
    const [dx, dy] = offsetOf(fx.innerShadow, k);
    bc.globalAlpha = fx.innerShadow.opacity;
    drawSoft(bc, keep(outside(pic, fx.innerShadow.color)), (fx.innerShadow.size * k) / 2, dx, dy);
  }
  if (fx.bevel && fx.bevel.size > 0) {
    bc.globalAlpha = 1;
    drawBevel(bc, ctx, pic, fx.bevel, k, keep);
  }
  if (fx.stroke && inR > 0) {
    bc.globalAlpha = fx.stroke.opacity;
    bc.drawImage(strokePaint(keep(innerRing(pic, fx.stroke.color, inR)), fx.stroke), 0, 0);
  }
  if (fill < 1) {
    bc.globalAlpha = 1;
    bc.globalCompositeOperation = 'destination-in';
    bc.drawImage(pic, 0, 0);
    // Sub formă, umbra / strălucirea / conturul de dinafară nu se văd prin pixelii mai transparenți (ca „stratul acoperă umbra”).
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(pic, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fill;
    ctx.drawImage(pic, 0, 0);
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(body, 0, 0);
  for (const c of temp) c.width = 0;
  return out;
}

/**
 * Relieful: forma încețoșată e o „hartă de înălțime”; panta ei, comparată cu direcția luminii, dă lumina (culoarea 1)
 * pe marginile întoarse spre lumină și umbra (culoarea 2) pe cele din partea opusă. Partea din formă se desenează pe `inCtx`
 * (tăiată pe formă), iar partea din afară (relieful exterior, în relief, pernă) pe `outCtx`, sub strat.
 */
function drawBevel(inCtx: CanvasRenderingContext2D, outCtx: CanvasRenderingContext2D, pic: HTMLCanvasElement, b: FxBevel, k: number, keep: (c: HTMLCanvasElement) => HTMLCanvasElement) {
  const w = pic.width, h = pic.height, R = Math.max(0.5, (b.size * k) / 2);
  const soft = keep(blankCanvas(w, h));
  const sil = keep(silhouette(pic, '#000'));
  // Relieful exterior: forma îngroșată cu jumătate din mărime, apoi încețoșată, ca panta să cadă în afara formei.
  drawSoft(soft.getContext('2d')!, b.style === 'outer' ? keep(dilate(sil, R, w, h)) : sil, R);
  const A = soft.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  const P = pic.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  const st = b.style;
  // Cât din relief se vede înăuntru / în afară și cu ce semn: perna e întoarsă în afară (marginea pare cusută).
  const wIn = st === 'outer' ? 0 : 1, wOut = !st ? 0 : st === 'pillow' ? -1 : 1;
  const hi = new ImageData(w, h), lo = new ImageData(w, h);
  const [ohi, olo] = wOut ? [new ImageData(w, h), new ImageData(w, h)] : [hi, lo];
  const a = (b.angle * Math.PI) / 180, lx = Math.cos(a), ly = -Math.sin(a);
  const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) || 0);
  const [hr, hg, hb] = hex(b.color), [sr, sg, sb] = hex(b.color2);
  // Panta e mai mică la un relief lat: o înmulțim cu mărimea, ca toate mărimile să arate la fel de „înalte”.
  const gain = (b.depth * Math.max(1, b.size * k)) / 255 * (b.up ? 1 : -1);
  const put = (D: Uint8ClampedArray, i: number, r: number, g: number, bl: number, al: number) => { D[i] = r; D[i + 1] = g; D[i + 2] = bl; D[i + 3] = al; };
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4, pa = P[i + 3] / 255;
      const gx = A[i + 7] - A[i - 1], gy = A[i + w * 4 + 3] - A[i - w * 4 + 3];
      if (!gx && !gy) continue;
      // Panta urcă spre interior; marginea întoarsă spre lumină are panta opusă luminii.
      const v = -(gx * lx + gy * ly) * gain;
      const al = Math.min(255, Math.abs(v) * 255) * b.opacity;
      if (pa > 0 && wIn) {
        if (v > 0) put(hi.data, i, hr, hg, hb, al * pa);
        else if (v < 0) put(lo.data, i, sr, sg, sb, al * pa);
      }
      if (pa < 1 && wOut) {
        const u = v * wOut;
        if (u > 0) put(ohi.data, i, hr, hg, hb, al * (1 - pa));
        else if (u < 0) put(olo.data, i, sr, sg, sb, al * (1 - pa));
      }
    }
  }
  const draw = (ctx: CanvasRenderingContext2D, ds: ImageData[]) => {
    for (const d of ds) {
      const c = keep(blankCanvas(w, h));
      c.getContext('2d')!.putImageData(d, 0, 0);
      ctx.drawImage(c, 0, 0);
    }
  };
  draw(inCtx, [hi, lo]);
  if (wOut) draw(outCtx, [ohi, olo]);
}
