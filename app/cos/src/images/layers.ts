// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Straturile din Imagini: documentul e o listă de pânze puse una peste alta (jos → sus), fiecare cu vizibilitate,
// opacitate și mod de amestec. Uneltele lucrează pe stratul activ. La Anulează ținem „instantanee” ale listei:
// pânzele care nu s-au schimbat sunt aceleași obiecte, așa că memoria crește doar cu stratul modificat.

import type { Anchor } from './pen';

export interface Layer {
  id: number;
  name: string;
  c: HTMLCanvasElement;
  visible: boolean;
  /** 0–1 */
  opacity: number;
  blend: Blend;
  /** Masca stratului: poză alb-negru de aceeași mărime (alb = se vede, negru = ascuns, gri = pe jumătate). */
  mask?: HTMLCanvasElement;
  /** Masca e folosită (Shift+click pe ea în Photoshop o oprește). */
  maskOn?: boolean;
  /** Densitatea măștii, 0–100 (lipsă = 100): cât de tare ascunde negrul; la 50, ce e ascuns se vede pe jumătate. */
  maskDensity?: number;
  /** Estomparea marginilor măștii, în pixeli (lipsă = 0). Masca rămâne aceeași; doar se vede mai moale. */
  maskFeather?: number;
  /** Strat de ajustare: nu are pixeli proprii, ci schimbă tot ce e sub el (prin mască), fără să strice nimic. */
  adj?: Adjust;
  /** 🔒 Blocat: pixelii, masca și poziția nu se mai pot schimba, iar stratul nu se poate șterge sau uni (Lock all). */
  locked?: boolean;
  /** Pixelii transparenți sunt blocați: uneltele schimbă doar culoarea a ce există deja pe strat (Lock transparent pixels). */
  lockAlpha?: boolean;
  /** Doar pixelii blocați (nu se pictează pe el, dar se poate muta) / doar poziția blocată (se pictează, dar nu se mută). */
  lockPixels?: boolean;
  lockPos?: boolean;
  /**
   * Strat de umplere (Fill layer): pixelii se desenează din culoare / gradient, deci se pot schimba oricând din panou.
   * Orice pictare sau mutare pe el îl face strat obișnuit (fill dispare), ca să nu se piardă ce s-a pictat.
   */
  fill?: FillSpec;
  /** Grupul (dosarul) din care face parte; straturile unui grup stau unul lângă altul și au același obiect de grup. */
  group?: LayerGroup;
  /** Stilurile stratului (umbră, contur, strălucire…), desenate la afișare; pixelii rămân neschimbați. */
  fx?: LayerFx;
  /** Mască de decupare (Clipping mask): stratul se vede doar pe forma stratului de bază de sub el (primul fără decupare). */
  clip?: boolean;
  /** 🔗 Legat (Link layers): straturile legate se mută împreună cu unealta ✥ Mută. */
  linked?: boolean;
  /** Strat de text dintr-un .psd: cuvintele, fontul, mărimea și culoarea (se rescriu din ⓘ Proprietăți). */
  text?: PsdText;
  /** Cât stă stratul pe ecran când e cadru de animație (🎞 Cronologie), în ms; lipsă = durata comună a cadrelor. */
  frameMs?: number;
  /** Cadru (Frame tool): o poză trasă peste el sau 🖼 Din fișier îl umple, în forma măștii lui. */
  frame?: boolean;
  /**
   * Poză legată (Place Linked): calea fișierului și semnătura conținutului de la ultima citire; `box` = dreptunghiul în
   * care s-a pus poza, `abox` = unde au ieșit atunci pixelii ei (din diferența lor aflăm cât s-a mutat / mărit stratul).
   */
  link?: { path: string; sig: string; box: LinkRect; abox: LinkRect | null };
  /**
   * Masca vectorială (Vector mask): traseul din care s-a făcut masca, păstrat ca să se poată schimba după aceea (⌇ Trasee →
   * ◐ Masca vectorială), și masca de dinainte (`base`), cu care se înmulțește din nou la fiecare actualizare.
   */
  vmask?: { a: Anchor[]; base?: HTMLCanvasElement };
}
export interface LinkRect { x: number; y: number; w: number; h: number }
/** Semnătura unui fișier legat (lungimea + FNV-1a pe tot conținutul): se schimbă când fișierul e scris din nou. */
export function linkSig(d: Uint8Array) {
  let h = 0x811c9dc5;
  for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193); }
  return d.length + ':' + (h >>> 0).toString(16);
}
/** Unde are stratul pixeli (alfa > 0), sau null dacă e gol. */
export function alphaBox(c: HTMLCanvasElement): LinkRect | null {
  const W = c.width, H = c.height, d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
/**
 * Dreptunghiul în care intră din nou poza legată: cel de la punere, mutat și mărit cât s-au mutat / mărit pixelii ei
 * de atunci (de exemplu cu ✥ Mută sau Transformare liberă).
 */
export function linkTarget(l: { box: LinkRect; abox: LinkRect | null }, now: LinkRect | null): LinkRect {
  const { box, abox } = l;
  if (!abox || !now) return box;
  const sx = now.w / abox.w, sy = now.h / abox.h;
  return { x: now.x + (box.x - abox.x) * sx, y: now.y + (box.y - abox.y) * sy, w: box.w * sx, h: box.h * sy };
}

/** Un grup de straturi: nume, ochi și opacitate pentru toate straturile din el; `open` = desfăcut în panou. */
/**
 * Umplerea unui strat: o culoare, gradient liniar (cu unghi) sau radial (din mijloc), de la c1 la c2, ori un model
 * (dungi, carouri, puncte, cărămizi; Pattern Fill) desenat cu c1 peste fundalul c2, cu mărimea plăcuței `size`.
 */
export interface FillSpec { kind: 'solid' | 'linear' | 'radial' | 'pattern'; c1: string; c2: string; angle: number; pat?: number; size?: number }
export const FILL_KINDS: [FillSpec['kind'], string][] = [['solid', 'Culoare'], ['linear', 'Gradient liniar'], ['radial', 'Gradient radial'], ['pattern', 'Model']];

/** Pixelii unui strat de umplere, de mărimea w × h. Unghiul liniar: 0° = de la stânga la dreapta, 90° = de sus în jos. */
export function renderFill(sp: FillSpec, w: number, h: number): HTMLCanvasElement {
  const c = blankCanvas(w, h), ctx = c.getContext('2d')!;
  if (sp.kind === 'solid') ctx.fillStyle = sp.c1;
  else if (sp.kind === 'pattern') {
    ctx.fillStyle = sp.c2;
    ctx.fillRect(0, 0, w, h);
    const tile = patternTile(Math.max(0, Math.min(PATTERNS.length - 1, sp.pat ?? 0)), sp.c1, sp.size ?? 12);
    ctx.fillStyle = ctx.createPattern(tile, 'repeat') ?? sp.c1;
    tile.width = 0;
  } else {
    let g: CanvasGradient;
    if (sp.kind === 'radial') g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
    else {
      // Linia gradientului trece prin mijloc și acoperă exact poza pe direcția aleasă (colțurile au culorile de capăt).
      const a = (sp.angle * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
      const half = (Math.abs(dx) * w + Math.abs(dy) * h) / 2;
      g = ctx.createLinearGradient(w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half);
    }
    g.addColorStop(0, sp.c1);
    g.addColorStop(1, sp.c2);
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** `parent`: grupul în care stă grupul acesta (grupuri în grupuri); `group` de pe strat e cel mai apropiat de el. */
export interface LayerGroup { id: number; name: string; visible: boolean; opacity: number; open: boolean; parent?: LayerGroup }
/** Grupurile stratului, de la cel mai apropiat până la cel de sus. */
export function chainOf(g: LayerGroup | undefined): LayerGroup[] {
  const out: LayerGroup[] = [];
  for (let x = g; x; x = x.parent) out.push(x);
  return out;
}
/** Se vede stratul (cu ochiul lui și al tuturor grupurilor în care stă)? */
export const shown = (l: Layer) => l.visible && chainOf(l.group).every((g) => g.visible);
/** Opacitatea cu care se pune stratul (a lui înmulțită cu a grupurilor). */
export const alphaOf = (l: Layer) => chainOf(l.group).reduce((a, g) => a * g.opacity, l.opacity);
/** Stă grupul `g` (sau un grup din el) în grupul `id`? */
export const inGroup = (g: LayerGroup | undefined, id: number) => chainOf(g).some((x) => x.id === id);
/** Câte grupuri sunt deasupra stratului (0 = în afara oricărui grup). */
export const depthOf = (g: LayerGroup | undefined) => chainOf(g).length;
/**
 * Lanțul de grupuri cu grupul `id` schimbat (`null` = scos din lanț); copiile se fac doar unde e nevoie, iar `memo`
 * face ca straturile care aveau același obiect de grup să primească tot un singur obiect nou.
 */
function patchChain(g: LayerGroup | undefined, id: number, p: Partial<LayerGroup> | null, memo: Map<LayerGroup, LayerGroup | undefined>): LayerGroup | undefined {
  if (!g) return g;
  if (memo.has(g)) return memo.get(g);
  let r: LayerGroup | undefined;
  if (g.id === id) r = p ? { ...g, ...p } : g.parent;
  else {
    const parent = patchChain(g.parent, id, p, memo);
    r = parent === g.parent ? g : { ...g, parent };
  }
  memo.set(g, r);
  return r;
}
/** `editMask`: uneltele lucrează pe masca stratului activ, nu pe pixelii lui. */
export interface Doc { layers: Layer[]; active: number; editMask?: boolean }

const alphaCache = new WeakMap<HTMLCanvasElement, { out: HTMLCanvasElement; den: number; fe: number }>();
/**
 * Masca alb-negru ca pânză cu transparență (luminozitatea devine opacitate), gata de pus cu destination-in.
 * `den` = densitatea (0–100): negrul ascunde doar atât; `fe` = estomparea marginilor, în pixeli.
 */
export function maskAlpha(m: HTMLCanvasElement, cache = true, den = 100, fe = 0): HTMLCanvasElement {
  den = Math.max(0, Math.min(100, den));
  fe = Math.max(0, fe);
  const hit = cache ? alphaCache.get(m) : undefined;
  if (hit && hit.out.width && hit.den === den && hit.fe === fe) return hit.out;
  if (hit) hit.out.width = 0;
  let out = blankCanvas(m.width, m.height);
  const id = m.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, m.width, m.height), d = id.data;
  const k = den / 100;
  for (let i = 0; i < d.length; i += 4) {
    const v = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    const a = (v * d[i + 3]) / 255;
    d[i + 3] = 255 - (255 - a) * k;
    d[i] = d[i + 1] = d[i + 2] = 0;
  }
  out.getContext('2d')!.putImageData(id, 0, 0);
  if (fe > 0) { const b = blurPadded(out, fe); out.width = 0; out = b; }
  if (cache) alphaCache.set(m, { out, den, fe });
  return out;
}
/** Estompare cu marginile prelungite (altfel marginea pozei s-ar amesteca cu golul de dincolo de ea). */
function blurPadded(src: HTMLCanvasElement, r: number): HTMLCanvasElement {
  const w = src.width, h = src.height, p = Math.ceil(r * 3);
  const pad = blankCanvas(w + 2 * p, h + 2 * p), pc = pad.getContext('2d')!;
  pc.drawImage(src, p, p);
  pc.drawImage(src, 0, 0, 1, h, 0, p, p, h);
  pc.drawImage(src, w - 1, 0, 1, h, p + w, p, p, h);
  pc.drawImage(pad, 0, p, w + 2 * p, 1, 0, 0, w + 2 * p, p);
  pc.drawImage(pad, 0, p + h - 1, w + 2 * p, 1, 0, p + h, w + 2 * p, p);
  const out = blankCanvas(w, h), oc = out.getContext('2d')!;
  oc.filter = `blur(${r}px)`;
  oc.drawImage(pad, -p, -p);
  pad.width = 0;
  return out;
}
/** Masca stratului, așa cum se vede (cu densitatea și estomparea lui). */
export const layerMaskAlpha = (l: Layer) => maskAlpha(l.mask!, true, l.maskDensity ?? 100, l.maskFeather ?? 0);
/** Masca stratului ca poză alb-negru cu densitatea și estomparea puse (pentru salvarea în .psd); fără ele, masca însăși. */
export function bakedMask(l: Layer): HTMLCanvasElement {
  const m = l.mask!;
  if ((l.maskDensity ?? 100) === 100 && !l.maskFeather) return m;
  const out = blankCanvas(m.width, m.height), ctx = out.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, m.width, m.height);
  const white = blankCanvas(m.width, m.height), wc = white.getContext('2d')!;
  wc.fillStyle = '#fff';
  wc.fillRect(0, 0, m.width, m.height);
  wc.globalCompositeOperation = 'destination-in';
  wc.drawImage(layerMaskAlpha(l), 0, 0);
  ctx.drawImage(white, 0, 0);
  white.width = 0;
  return out;
}
/** O mască nouă: albă peste tot, sau albă doar unde e `shape` (o pânză opacă în zona aleasă, de exemplu selecția). */
export function makeMask(w: number, h: number, shape?: HTMLCanvasElement): HTMLCanvasElement {
  const m = blankCanvas(w, h);
  const ctx = m.getContext('2d')!;
  ctx.fillStyle = shape ? '#000' : '#fff';
  ctx.fillRect(0, 0, w, h);
  if (shape) {
    const white = blankCanvas(w, h), wc = white.getContext('2d')!;
    wc.fillStyle = '#fff';
    wc.fillRect(0, 0, w, h);
    wc.globalCompositeOperation = 'destination-in';
    wc.drawImage(shape, 0, 0, w, h);
    ctx.drawImage(white, 0, 0);
    white.width = 0;
  }
  return m;
}
/** Negativul măștii (ce era ascuns se vede și invers). */
export function invertMask(m: HTMLCanvasElement): HTMLCanvasElement {
  const out = blankCanvas(m.width, m.height), ctx = out.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, m.width, m.height);
  ctx.globalCompositeOperation = 'difference';
  ctx.drawImage(m, 0, 0);
  return out;
}
/** Are documentul nevoie de compunere (mai multe straturi sau o mască pornită)? */
export const needsCompose = (doc: Doc) => doc.layers.length > 1 || doc.layers.some((l) => (l.mask && l.maskOn !== false) || hasFx(l.fx));
/** Pixelii stratului cu masca aplicată (o pânză nouă, la mărimea reală). */
export function maskedPixels(l: Layer): HTMLCanvasElement {
  const out = blankCanvas(l.c.width, l.c.height), ctx = out.getContext('2d')!;
  ctx.drawImage(l.c, 0, 0);
  if (l.mask && l.maskOn !== false) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(layerMaskAlpha(l), 0, 0);
  }
  return out;
}
/** Pixelii stratului cu masca și cu stilurile puse (pentru unire, salvarea straturilor ca fișiere și .psd). */
export function styledPixels(l: Layer): HTMLCanvasElement {
  const m = maskedPixels(l);
  if (!hasFx(l.fx) || l.adj) return m;
  const out = withFx(m, l.fx!, 1);
  m.width = 0;
  return out;
}

import { Adjust, adjustPixels } from './adjust';
import { Blend, drawBlend } from './blend';
import { hasFx, LayerFx, withFx } from './layerfx';
import { PATTERNS, patternTile } from './tone';
import type { PsdText } from './psdText';

/** Poza unui strat cu stiluri, la mărimea de pe ecran; ținută cât timp stratul, masca, stilul și mărimea rămân aceleași. */
const fxCache = new WeakMap<HTMLCanvasElement, { mask?: HTMLCanvasElement; fx: LayerFx; w: number; h: number; out: HTMLCanvasElement }>();

let nextId = 1;
export const layerId = () => nextId++;

export function blankCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function newLayer(c: HTMLCanvasElement, name: string): Layer {
  return { id: layerId(), name, c, visible: true, opacity: 1, blend: 'source-over' };
}

/** Documentul cu un singur strat (o poză deschisă din fișier). */
export const singleDoc = (c: HTMLCanvasElement): Doc => ({ layers: [newLayer(c, 'Fundal')], active: 0 });

/** Un nume liber: „Strat 2”, „Strat 3”… */
export function freeName(doc: Doc, base = 'Strat') {
  const used = new Set(doc.layers.map((l) => l.name));
  let n = doc.layers.length + 1;
  while (used.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/**
 * Desenează straturile vizibile pe ctx (w × h, la scara poza → ecran dată de w). `active` înlocuiește pânza stratului
 * activ (de exemplu cu previzualizarea unei ajustări, deja la mărimea w × h).
 */
export function drawLayers(ctx: CanvasRenderingContext2D, doc: Doc, w: number, h: number, active?: HTMLCanvasElement, liveAdj?: Adjust) {
  // Stratul de bază pentru straturile cu mască de decupare de deasupra lui și forma lui (pixelii cu masca), făcută la nevoie.
  let base: { l: Layer; i: number } | null = null;
  let shape: HTMLCanvasElement | null = null;
  const shapeOf = (b: { l: Layer; i: number }) => {
    if (shape) return shape;
    const blive = b.i === doc.active && active ? active : null;
    shape = blankCanvas(w, h);
    const sc = shape.getContext('2d')!;
    sc.drawImage(blive && !doc.editMask ? blive : b.l.c, 0, 0, w, h);
    if (b.l.mask && b.l.maskOn !== false) {
      sc.globalCompositeOperation = 'destination-in';
      sc.drawImage(blive && doc.editMask ? maskAlpha(blive, false, b.l.maskDensity ?? 100, b.l.maskFeather ?? 0) : layerMaskAlpha(b.l), 0, 0, w, h);
    }
    return shape;
  };
  doc.layers.forEach((l, i) => {
    const clipTo = l.clip && base && !base.l.adj ? base : null;
    if (!l.clip || !base) { base = { l, i }; if (shape) shape.width = 0; shape = null; }
    if (!shown(l) || alphaOf(l) <= 0) return;
    // Decupat pe un strat de bază ascuns: nu se vede nici el.
    if (clipTo && (!shown(clipTo.l) || alphaOf(clipTo.l) <= 0)) return;
    // Când se lucrează pe mască, `active` e masca (cu previzualizările ei), nu pixelii.
    const live = i === doc.active && active ? active : null;
    let src = live && !doc.editMask ? live : l.c;
    let adjusted: HTMLCanvasElement | null = null;
    if (l.adj) {
      // Stratul de ajustare: ce s-a desenat până acum (straturile de dedesubt), cu ajustarea pusă peste.
      const id = ctx.getImageData(0, 0, w, h);
      adjustPixels(id.data, i === doc.active && liveAdj ? liveAdj : l.adj, w);
      adjusted = blankCanvas(w, h);
      adjusted.getContext('2d')!.putImageData(id, 0, 0);
      src = adjusted;
    }
    let pic: HTMLCanvasElement = src, tmp: HTMLCanvasElement | null = null;
    if (l.mask && l.maskOn !== false) {
      tmp = blankCanvas(w, h);
      const tc = tmp.getContext('2d')!;
      tc.drawImage(src, 0, 0, w, h);
      tc.globalCompositeOperation = 'destination-in';
      tc.drawImage(live && doc.editMask ? maskAlpha(live, false, l.maskDensity ?? 100, l.maskFeather ?? 0) : layerMaskAlpha(l), 0, 0, w, h);
      pic = tmp;
    }
    let styled: HTMLCanvasElement | null = null;
    if (hasFx(l.fx) && !l.adj) {
      // Stratul activ se poate schimba sub mână (pensula pictează direct pe el): pentru el nu se ține nimic minte.
      const hit = live ? undefined : fxCache.get(l.c);
      if (hit && hit.fx === l.fx && hit.mask === (l.maskOn !== false ? l.mask : undefined) && hit.w === w && hit.h === h && hit.out.width) pic = hit.out;
      else {
        const base = blankCanvas(w, h);
        base.getContext('2d')!.drawImage(pic, 0, 0, w, h);
        const out = withFx(base, l.fx!, w / l.c.width);
        base.width = 0;
        if (live) styled = out;
        else fxCache.set(l.c, { mask: l.maskOn !== false ? l.mask : undefined, fx: l.fx!, w, h, out });
        pic = out;
      }
    }
    let clipped: HTMLCanvasElement | null = null;
    if (clipTo) {
      clipped = blankCanvas(w, h);
      const cc = clipped.getContext('2d')!;
      cc.drawImage(pic, 0, 0, w, h);
      cc.globalCompositeOperation = 'destination-in';
      cc.drawImage(shapeOf(clipTo), 0, 0);
      pic = clipped;
    }
    drawBlend(ctx, pic, l.blend, alphaOf(l), w, h);
    if (clipped) clipped.width = 0;
    if (styled) styled.width = 0;
    if (tmp) tmp.width = 0;
    if (adjusted) adjusted.width = 0;
  });
  if (shape) (shape as HTMLCanvasElement).width = 0;
}

/** Pune înapoi transparența din `old` peste `next` (aceeași mărime): culorile noi rămân, forma stratului nu se schimbă. */
export function keepAlphaOf(next: HTMLCanvasElement, old: HTMLCanvasElement) {
  const w = next.width, h = next.height;
  const nc = next.getContext('2d', { willReadFrequently: true })!;
  const n = nc.getImageData(0, 0, w, h), o = old.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data, d = n.data;
  for (let i = 3; i < d.length; i += 4) d[i] = o[i];
  nc.putImageData(n, 0, 0);
}

/** Toate straturile vizibile într-o singură pânză, la mărimea reală (pentru salvare, copiere, aplatizare). */
export function flatten(doc: Doc): HTMLCanvasElement {
  const base = doc.layers[0].c;
  const out = blankCanvas(base.width, base.height);
  drawLayers(out.getContext('2d')!, doc, base.width, base.height);
  return out;
}

/** Stratul activ unit cu cel de sub el: rezultatul ia locul celui de jos (cu numele, opacitatea și modul lui). */
export function mergeDown(doc: Doc): Doc | null {
  const i = doc.active;
  if (i < 1) return null;
  const top = doc.layers[i], below = doc.layers[i - 1];
  // Un strat de ajustare se unește aplicându-l pe stratul de sub el.
  if (top.locked || below.locked) return null;
  if (top.adj) {
    const one: Doc = { layers: [{ ...below, opacity: 1, blend: 'source-over', visible: true }, top], active: 1 };
    const c = flatten(one);
    const layers = doc.layers.filter((_, j) => j !== i);
    layers[i - 1] = { ...below, c, visible: true, mask: undefined, maskOn: undefined };
    return { layers, active: i - 1 };
  }
  if (below.adj || top.locked || below.locked) return null;
  // Măștile ambelor straturi se aplică întâi pe pixeli; stratul unit nu mai are mască.
  const c = styledPixels(below);
  const ctx = c.getContext('2d')!;
  if (shown(top)) {
    const t = styledPixels(top);
    if (top.clip && !below.clip) {
      const tc = t.getContext('2d')!;
      tc.globalCompositeOperation = 'destination-in';
      const b = maskedPixels(below);
      tc.drawImage(b, 0, 0);
      b.width = 0;
    }
    drawBlend(ctx, t, top.blend, alphaOf(top), c.width, c.height);
    t.width = 0;
  }
  const layers = doc.layers.filter((_, j) => j !== i);
  layers[i - 1] = { ...below, c, visible: true, mask: undefined, maskOn: undefined, fx: undefined };
  return { layers, active: i - 1 };
}

/**
 * Mută stratul activ cu `dir` poziții (+1 = mai sus). La marginea unui grup, un pas înseamnă întâi intrarea în grup sau
 * ieșirea din el (stratul rămâne pe loc), ca straturile unui grup să stea mereu unul lângă altul.
 */
export function moveLayer(doc: Doc, dir: number): Doc | null {
  const i = doc.active, j = i + dir;
  const cur = doc.layers[i];
  const put = (group: LayerGroup | undefined) => ({ ...doc, layers: doc.layers.map((l, k) => (k === i ? { ...l, group } : l)) });
  if (j < 0 || j >= doc.layers.length) {
    // La capătul listei, un strat din grup mai poate ieși din grup (câte un nivel).
    return cur.group ? put(cur.group.parent) : null;
  }
  const next = doc.layers[j];
  if (cur.group?.id !== next.group?.id) {
    // Vecinul e mai adânc, într-un grup din grupul nostru: intrăm un nivel; altfel ieșim un nivel.
    const nc = chainOf(next.group);
    const at = cur.group ? nc.findIndex((g) => g.id === cur.group!.id) : nc.length;
    return put(at > 0 ? nc[at - 1] : cur.group!.parent);
  }
  const layers = [...doc.layers];
  [layers[i], layers[j]] = [layers[j], layers[i]];
  return { layers, active: j, editMask: doc.editMask };
}

/** Pânzele tuturor documentelor din listă. */
export function canvasesOf(docs: Doc[]) {
  const s = new Set<HTMLCanvasElement>();
  for (const d of docs) for (const l of d.layers) { s.add(l.c); if (l.mask) s.add(l.mask); }
  return s;
}

/** Eliberează memoria pânzelor din `gone` care nu mai sunt folosite de niciun document din `alive`. */
export function release(gone: Doc[], alive: Doc[]) {
  const keep = canvasesOf(alive);
  for (const c of canvasesOf(gone)) if (!keep.has(c)) c.width = 0;
}

/** Câți pixeli țin instantaneele din Anulează, fără pânzele documentului de acum (ele trebuie oricum ținute). */
export function historyPixels(stack: Doc[], current: Doc) {
  const cur = canvasesOf([current]);
  let px = 0;
  for (const c of canvasesOf(stack)) if (!cur.has(c)) px += c.width * c.height;
  return px;
}

/** Pune stratul activ într-un grup nou (Ctrl+G); dacă e deja într-unul, nu face nimic. */
export function groupActive(doc: Doc, name: string): Doc | null {
  const cur = doc.layers[doc.active];
  if (!cur) return null;
  // Un strat dintr-un grup intră într-un grup nou, din grupul lui.
  const group: LayerGroup = { id: layerId(), name, visible: true, opacity: 1, open: true, ...(cur.group ? { parent: cur.group } : {}) };
  return { ...doc, layers: doc.layers.map((l, k) => (k === doc.active ? { ...l, group } : l)) };
}

/** Schimbă grupul `id` (nume, ochi, opacitate, desfăcut) la toate straturile lui. */
export function setGroup(doc: Doc, id: number, p: Partial<LayerGroup>): Doc {
  if (!doc.layers.some((l) => inGroup(l.group, id))) return doc;
  const memo = new Map<LayerGroup, LayerGroup | undefined>();
  return { ...doc, layers: doc.layers.map((l) => (inGroup(l.group, id) ? { ...l, group: patchChain(l.group, id, p, memo) } : l)) };
}

/** Desface grupul: straturile rămân pe loc, cu ochiul și opacitatea grupului trecute pe ele (arată la fel). */
export function ungroup(doc: Doc, id: number): Doc {
  const memo = new Map<LayerGroup, LayerGroup | undefined>();
  return {
    ...doc,
    layers: doc.layers.map((l) => {
      const g = chainOf(l.group).find((x) => x.id === id);
      return g ? { ...l, visible: l.visible && g.visible, opacity: l.opacity * g.opacity, group: patchChain(l.group, id, null, memo) } : l;
    }),
  };
}

/** Un nume liber de grup: „Grup 1”, „Grup 2”… */
export function freeGroupName(doc: Doc) {
  const used = new Set(doc.layers.flatMap((l) => chainOf(l.group).map((g) => g.name)));
  let n = 1;
  while (used.has(`Grup ${n}`)) n++;
  return `Grup ${n}`;
}
