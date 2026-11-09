// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fișierele .psd și .psb (poze cu straturi), citite și scrise în cod propriu, după specificația publică a formatului.
// Citim RGB, tonuri de gri, CMYK, duotone și paletă, pe 8, 16 sau 32 de biți, cu compresie RLE, ZIP sau fără: poza compusă și
// straturile (pixeli, poziție, nume cu diacritice, ochi, opacitate, mod de amestec, mască, decupare). Grupurile rămân
// grupuri, și cele din alte grupuri (fiecare grup știe grupul în care stă).
// Scriem RGB pe 8 biți: fiecare strat cu transparență, mască și nume, compresie RLE, plus poza compusă, ca fișierul să
// se deschidă și în programele care citesc doar poza compusă.
// Fără DOM aici (doar octeți), ca să se poată testa direct în Node; legătura cu pânzele e în `psdDoc.ts`.
import { PsdPath, pathNameBytes, pathRecords, readPathResources } from './psdPaths';
import type { Blend } from './blend';
import type { LayerFx } from './layerfx';
import { readPsdAdjust } from './psdAdjust';
import type { Adjust } from './adjust';
import { readVectorMask, rasterizeVectorMask, vectorMaskOff } from './psdVector';
import { blur1 } from './sketchFx';
import { readPatterns, patternFillOf, drawPatternFill, type PsdPattern, type PsdPatternFill } from './psdPattern';
import { readPsdText, type PsdText } from './psdText';
import { decodeAnno, encodeAnno, type PsdNote } from './psdNotes';
import { PsdFx, PsdGradFill, readLayerFx, readSolidFill, readGradientFill, drawGradientFill, readDescBlock } from './psdfx';

export class PsdError extends Error {}

const BROKEN = 'Fișierul .psd e deteriorat sau tăiat și nu poate fi citit.';
/** Cea mai mare poză pe care o deschidem (ca la celelalte formate), ca un fișier uriaș să nu umple memoria laptopului. */
const MAX_PIXELS = 100_000_000;
/** Cea mai mare latură pe care o primește un .psd (un .psb poate mai mult, dar nu-l scriem). */
export const PSD_MAX_SIDE = 30000;

export interface PsdMask {
  left: number;
  top: number;
  w: number;
  h: number;
  /** Tonuri de gri, w × h (255 = se vede). */
  data: Uint8Array | null;
  /** Culoarea măștii în afara dreptunghiului ei (0 sau 255). */
  def: number;
  /** Masca e oprită. */
  off: boolean;
}

export interface PsdLayer {
  name: string;
  left: number;
  top: number;
  w: number;
  h: number;
  /** RGBA, w × h. */
  rgba: Uint8ClampedArray;
  visible: boolean;
  /** 0–1 */
  opacity: number;
  blend: Blend;
  mask?: PsdMask;
  /** Decupat de stratul de sub el (mască de decupare). */
  clip: boolean;
  /** Blocat de tot (în fișier: blocul „lspf”). */
  locked?: boolean;
  /** Doar pixelii transparenți / pixelii / poziția blocate. */
  lockAlpha?: boolean;
  lockPixels?: boolean;
  lockPos?: boolean;
  /** Strat de ajustare (fără pixeli): ajustarea lui, aplicată pe tot ce e sub el, prin mască. */
  adj?: Adjust;
  /** Stilurile stratului (umbră, contur, strălucire…), citite din blocul „lfx2”. */
  fx?: LayerFx;
  /** Strat de text: cuvintele, fontul, mărimea și culoarea lui (pixelii sunt cei desenați de programul care l-a salvat). */
  text?: PsdText;
  /** Grupul (cel mai apropiat) din care face parte: același `key` pentru toate straturile lui; `parent` = grupul lui. */
  group?: PsdGroup;
  /** Poza legată de un fișier (blocul nostru „SuLk”, JSON): calea, semnătura și dreptunghiurile, ca la stratul 🖇. */
  link?: PsdLink;
}

/** Legătura unui strat cu fișierul pozei lui (vezi Layer.link în layers.ts). */
export interface PsdLink { path: string; sig: string; box: { x: number; y: number; w: number; h: number }; abox: { x: number; y: number; w: number; h: number } | null }

/** Blocul cu legătura: cheia e a noastră, deci celelalte programe îl sar (citesc lungimea și trec mai departe). */
const LINK_KEY = 'SuLk';
const isRect = (r: unknown): r is PsdLink['box'] => !!r && typeof r === 'object' && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite((r as Record<string, unknown>)[k]));
function readLink(b: Uint8Array): PsdLink | undefined {
  try {
    let e = b.length;
    while (e > 0 && !b[e - 1]) e--; // umplutura de la capăt
    const j = JSON.parse(new TextDecoder().decode(b.subarray(0, e)));
    if (typeof j?.path !== 'string' || !j.path || typeof j.sig !== 'string' || !isRect(j.box) || (j.abox !== null && !isRect(j.abox))) return undefined;
    return { path: j.path, sig: j.sig, box: j.box, abox: j.abox };
  } catch { return undefined; }
}

export interface PsdGroup { key: number; name: string; visible: boolean; opacity: number; open: boolean; parent?: PsdGroup }

export interface Psd {
  width: number;
  height: number;
  /** De jos în sus; grupurile sunt în `group` la fiecare strat. */
  layers: PsdLayer[];
  composite: Uint8ClampedArray | null;
  /** Ce trebuie să știe utilizatorul (ce nu s-a putut păstra). */
  notes: string[];
  /** Straturile citite nu arată exact ca poza compusă (ajustări, efecte, umpleri pe care nu le refacem). */
  lossy: boolean;
  /** Selecțiile salvate (canalele alfa), cu numele lor: câte un octet pe pixel, 255 = selectat. */
  channels: PsdChannel[];
  /** Traseele salvate (panoul Paths), în pixeli. */
  paths: PsdPath[];
  /** Notele 🗒 de pe poză (blocul „Anno”). */
  annotations: PsdNote[];
}

export interface PsdChannel { name: string; data: Uint8Array }

/** Cel mult atâtea selecții salvate citim dintr-un fișier (fiecare ține cât un canal al pozei în memorie). */
const MAX_CHANNELS = 16;

/**
 * Numele canalelor alfa din resurse: 1045 (UTF-16, cu diacritice) are întâietate față de 1006 (octeți simpli).
 * `spot`: canalele de culoare specială (cerneluri, din 1077 / 1007), care nu sunt selecții.
 */
function channelNames(b: Uint8Array, s: number, e: number): { names: string[]; spot: boolean[] } {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pascal: string[] = [], uni: string[] = [];
  let spot: boolean[] = [];
  let p = s;
  while (p + 12 <= e && b[p] === 0x38 && b[p + 1] === 0x42 && b[p + 2] === 0x49 && b[p + 3] === 0x4d) {
    const id = v.getUint16(p + 4);
    const nl = b[p + 6];
    let q = p + 6 + 1 + nl;
    if ((1 + nl) % 2) q++;
    if (q + 4 > e) break;
    const len = v.getUint32(q);
    const ds = q + 4, de = Math.min(e, ds + len);
    if (id === 1006) {
      const out: string[] = [];
      for (let k = ds; k < de;) { const n = b[k]; let t = ''; for (let i = 1; i <= n && k + i < de; i++) t += String.fromCharCode(b[k + i]); out.push(t); k += 1 + n; }
      pascal = out;
    } else if (id === 1045) {
      const out: string[] = [];
      for (let k = ds; k + 4 <= de;) {
        const n = v.getUint32(k);
        k += 4;
        if (k + n * 2 > de) break;
        let t = '';
        for (let i = 0; i < n; i++) t += String.fromCharCode(v.getUint16(k + i * 2));
        out.push(t.replace(/\0+$/, ''));
        k += n * 2;
      }
      uni = out;
    } else if (id === 1077 && len >= 4) {
      // Versiunea, apoi câte 13 octeți pe canal; ultimul spune felul (0, 1 = selecție, 2 = culoare specială).
      spot = [];
      for (let k = ds + 4; k + 13 <= de; k += 13) spot.push(b[k + 12] === 2);
    } else if (id === 1007 && !spot.length) {
      spot = [];
      for (let k = ds; k + 14 <= de; k += 14) spot.push(b[k + 12] === 2);
    }
    p = ds + len + (len % 2);
  }
  return { names: uni.length ? uni : pascal, spot };
}

// Modurile de amestec: cheia din fișier ↔ cel al pânzei. Cele fără pereche iau cel mai apropiat.
const BLEND_IN: Record<string, Blend> = {
  norm: 'source-over', pass: 'source-over', diss: 'dissolve',
  dark: 'darken', dkCl: 'darker-color', mul: 'multiply', idiv: 'color-burn', lbrn: 'linear-burn',
  lite: 'lighten', lgCl: 'lighter-color', scrn: 'screen', 'div ': 'color-dodge', lddg: 'lighter',
  over: 'overlay', sLit: 'soft-light', hLit: 'hard-light', vLit: 'vivid-light', lLit: 'linear-light', pLit: 'pin-light', hMix: 'hard-mix',
  diff: 'difference', smud: 'exclusion', fsub: 'subtract', fdiv: 'divide',
  'hue ': 'hue', 'sat ': 'saturation', colr: 'color', 'lum ': 'luminosity',
};
const BLEND_OUT: Partial<Record<Blend, string>> = {
  'source-over': 'norm', multiply: 'mul ', screen: 'scrn', overlay: 'over', darken: 'dark', lighten: 'lite',
  'color-dodge': 'div ', 'color-burn': 'idiv', 'hard-light': 'hLit', 'soft-light': 'sLit', difference: 'diff',
  exclusion: 'smud', hue: 'hue ', saturation: 'sat ', color: 'colr', luminosity: 'lum ', lighter: 'lddg',
  'linear-burn': 'lbrn', 'darker-color': 'dkCl', 'lighter-color': 'lgCl', 'vivid-light': 'vLit', 'linear-light': 'lLit',
  'pin-light': 'pLit', 'hard-mix': 'hMix', subtract: 'fsub', divide: 'fdiv', dissolve: 'diss',
};
// „mul ” are spațiu la final în fișier.
BLEND_IN['mul '] = 'multiply';

/** Cheile blocurilor care au lungimea pe 8 octeți în .psb. */
const BIG_KEYS = new Set(['LMsk', 'Lr16', 'Lr32', 'Layr', 'Mt16', 'Mt32', 'Mtrn', 'Alph', 'FMsk', 'lnk2', 'FEid', 'FXid', 'PxSD']);
/** Straturi de ajustare și de umplere: în fișier au doar setările, nu pixeli. */
const ADJ_KEYS = new Set(['levl', 'curv', 'brit', 'blnc', 'hue2', 'hue ', 'selc', 'mixr', 'grdm', 'thrs', 'nvrt', 'post', 'vibA', 'expA', 'phfl', 'clrL', 'blwh', 'CgEd', 'SoCo', 'GdFl', 'PtFl']);

class Rd {
  p = 0;
  v: DataView;
  constructor(public b: Uint8Array) { this.v = new DataView(b.buffer, b.byteOffset, b.byteLength); }
  need(n: number) { if (this.p + n > this.b.length) throw new PsdError(BROKEN); }
  u8() { this.need(1); return this.b[this.p++]; }
  u16() { this.need(2); const x = this.v.getUint16(this.p); this.p += 2; return x; }
  i16() { this.need(2); const x = this.v.getInt16(this.p); this.p += 2; return x; }
  u32() { this.need(4); const x = this.v.getUint32(this.p); this.p += 4; return x; }
  i32() { this.need(4); const x = this.v.getInt32(this.p); this.p += 4; return x; }
  f64() { this.need(8); const x = this.v.getFloat64(this.p); this.p += 8; return x; }
  u64() { const hi = this.u32(), lo = this.u32(); return hi * 4294967296 + lo; }
  str(n: number) { this.need(n); let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(this.b[this.p + i]); this.p += n; return s; }
  /** E o semnătură de bloc („8BIM” / „8B64”) la poziția q? */
  sigAt(q: number) {
    const b = this.b;
    return q + 4 <= b.length && b[q] === 0x38 && b[q + 1] === 0x42 && ((b[q + 2] === 0x49 && b[q + 3] === 0x4d) || (b[q + 2] === 0x36 && b[q + 3] === 0x34));
  }
  /** După un bloc: programele rotunjesc diferit lungimea (la 2 sau la 4), așa că sărim până la 3 octeți de completare. */
  nextBlock(end: number) {
    for (let k = 0; k < 4 && this.p + k + 12 <= end; k++) if (this.sigAt(this.p + k)) { this.p += k; return true; }
    return false;
  }
}

/** Despachetează un rând PackBits din src[s, e) în out[o, o + len). */
function unpackBits(src: Uint8Array, s: number, e: number, out: Uint8Array, o: number, len: number) {
  let k = o;
  const stop = o + len;
  while (s < e && k < stop) {
    let n = src[s++];
    if (n < 128) {
      n++;
      while (n-- > 0 && s < e && k < stop) out[k++] = src[s++];
    } else if (n > 128) {
      n = 257 - n;
      const v = src[s++];
      while (n-- > 0 && k < stop) out[k++] = v;
    }
  }
}

/** `rows` rânduri RLE: întâi lungimile tuturor rândurilor (2 octeți, 4 în .psb), apoi datele. Întoarce poziția de după ele. */
function unpackRle(b: Uint8Array, p: number, end: number, rows: number, rowBytes: number, big: boolean, out: Uint8Array) {
  const cnt = big ? 4 : 2;
  let d = p + rows * cnt;
  if (d > end) throw new PsdError(BROKEN);
  for (let y = 0; y < rows; y++) {
    const q = p + y * cnt;
    const n = big ? ((b[q] << 24) | (b[q + 1] << 16) | (b[q + 2] << 8) | b[q + 3]) >>> 0 : (b[q] << 8) | b[q + 1];
    unpackBits(b, d, Math.min(d + n, end), out, y * rowBytes, rowBytes);
    d += n;
  }
  return d;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  try {
    const ds = new DecompressionStream('deflate');
    return new Uint8Array(await new Response(new Blob([data as BlobPart]).stream().pipeThrough(ds)).arrayBuffer());
  } catch {
    throw new PsdError(BROKEN);
  }
}

/** Compresia ZIP „cu predicție”: fiecare valoare e diferența față de cea din stânga. */
function unpredict(d: Uint8Array, w: number, rows: number, bps: number) {
  if (bps === 1) {
    for (let y = 0; y < rows; y++) for (let x = 1, i = y * w + 1; x < w; x++, i++) d[i] = (d[i] + d[i - 1]) & 255;
  } else if (bps === 4) {
    // 32 de biți: rândul are întâi primul octet al tuturor valorilor, apoi al doilea…, cu diferențe pe tot rândul.
    const row = w * 4, tmp = new Uint8Array(row);
    for (let y = 0; y < rows; y++) {
      const o = y * row;
      for (let i = o + 1; i < o + row; i++) d[i] = (d[i] + d[i - 1]) & 255;
      tmp.set(d.subarray(o, o + row));
      for (let x = 0; x < w; x++) { d[o + x * 4] = tmp[x]; d[o + x * 4 + 1] = tmp[w + x]; d[o + x * 4 + 2] = tmp[2 * w + x]; d[o + x * 4 + 3] = tmp[3 * w + x]; }
    }
  } else {
    for (let y = 0; y < rows; y++) {
      let prev = (d[y * w * 2] << 8) | d[y * w * 2 + 1];
      for (let x = 1; x < w; x++) {
        const i = (y * w + x) * 2;
        prev = (prev + ((d[i] << 8) | d[i + 1])) & 0xffff;
        d[i] = prev >> 8;
        d[i + 1] = prev & 255;
      }
    }
  }
}

/** Valorile pe 8 biți ale unui canal (din 16 biți păstrăm octetul de sus; 32 de biți = număr real liniar, trecut în sRGB). */
function to8(raw: Uint8Array, n: number, bps: number, alpha = false): Uint8Array {
  if (bps === 4) {
    const o = new Uint8Array(n), v = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    for (let i = 0, m = Math.min(n, raw.length >> 2); i < m; i++) {
      const x = Math.max(0, Math.min(1, v.getFloat32(i * 4) || 0));
      o[i] = Math.round(255 * (alpha ? x : x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
    }
    return o;
  }
  if (bps === 1) {
    if (raw.length >= n) return raw.length === n ? raw : raw.slice(0, n);
    const o = new Uint8Array(n);
    o.set(raw);
    return o;
  }
  const o = new Uint8Array(n);
  for (let i = 0, m = Math.min(n, raw.length >> 1); i < m; i++) o[i] = raw[i * 2];
  return o;
}

/** Un canal (cu cei 2 octeți de compresie în față), din r.p până la `end`. */
async function readChannel(r: Rd, end: number, w: number, h: number, bps: number, big: boolean, alpha: boolean): Promise<Uint8Array> {
  const comp = r.u16();
  const rowBytes = w * bps;
  let raw: Uint8Array;
  if (comp === 0) raw = r.b.subarray(r.p, Math.min(end, r.p + rowBytes * h));
  else if (comp === 1) { raw = new Uint8Array(rowBytes * h); unpackRle(r.b, r.p, end, h, rowBytes, big, raw); }
  else if (comp === 2 || comp === 3) {
    raw = await inflate(r.b.subarray(r.p, end));
    if (comp === 3) unpredict(raw, w, Math.min(h, Math.floor(raw.length / rowBytes)), bps);
  } else throw new PsdError('Fișierul .psd folosește o compresie pe care nu o cunoaștem.');
  return to8(raw, w * h, bps, alpha);
}

/** Canalele unui strat sau ale pozei compuse → RGBA. Canalele lipsă: culoare 0, transparență 255. */
function toRGBA(mode: number, ch: (Uint8Array | undefined)[], alpha: Uint8Array | undefined, n: number, pal: Uint8Array | null): Uint8ClampedArray {
  const o = new Uint8ClampedArray(n * 4);
  const [c0, c1, c2, c3] = ch;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    if (mode === 3) { o[j] = c0 ? c0[i] : 0; o[j + 1] = c1 ? c1[i] : 0; o[j + 2] = c2 ? c2[i] : 0; }
    else if (mode === 4) {
      // CMYK: în fișier 255 = fără cerneală.
      const k = c3 ? c3[i] : 255;
      o[j] = ((c0 ? c0[i] : 255) * k) / 255;
      o[j + 1] = ((c1 ? c1[i] : 255) * k) / 255;
      o[j + 2] = ((c2 ? c2[i] : 255) * k) / 255;
    } else if (mode === 2 && pal) { const x = c0 ? c0[i] : 0; o[j] = pal[x]; o[j + 1] = pal[256 + x]; o[j + 2] = pal[512 + x]; }
    else { const g = c0 ? c0[i] : 0; o[j] = o[j + 1] = o[j + 2] = g; }
    o[j + 3] = alpha ? alpha[i] : 255;
  }
  return o;
}

/** Câte canale de culoare are modul (fără transparență). */
const colorChannels = (mode: number) => (mode === 3 ? 3 : mode === 4 ? 4 : 1);

interface Rec {
  top: number; left: number; bottom: number; right: number;
  chans: { id: number; len: number }[];
  blend: string; opacity: number; clip: boolean; hidden: boolean;
  mask: PsdMask | null;
  /** Densitatea (0–255) și estomparea (pixeli) măștii de pixeli (u) și a celei vectoriale (v), dacă fișierul le are. */
  soft?: { ud: number; uf: number; vd: number; vf: number };
  /** Masca de pixeli e desenată de program din masca vectorială (densitatea / estomparea vectorială sunt ale ei). */
  fromVec?: boolean;
  /** A doua mască (canalul -3), când stratul are și mască vectorială desenată, și mască de pixeli pusă de om. */
  mask2?: PsdMask;
  name: string; section: number; fill: number; kinds: Set<string>; fx: PsdFx | null; locked: boolean; lockAlpha: boolean; lockPixels: boolean; lockPos: boolean;
  /** Stratul de umplere cu o culoare (SoCo): culoarea lui. */
  solid?: string;
  /** Stratul de umplere cu model (PtFl). */
  pat?: PsdPatternFill;
  /** Stratul de umplere cu degrade (GdFl). */
  grad?: PsdGradFill;
  /** Masca vectorială (blocul vmsk / vsms), necitită încă. */
  vmask?: Uint8Array;
  /** Stratul de ajustare pe care îl putem reface (niveluri, curbe…). */
  adjust?: Adjust;
  /** Textul stratului (blocul TySh), dacă s-a putut citi. */
  text?: PsdText;
  link?: PsdLink;
}

interface Ctx { mode: number; bps: number; big: boolean; notes: string[]; width: number; height: number; patterns?: Map<string, PsdPattern> }

/** Secțiunea cu straturile (din r.p până la `end`). */
async function readLayers(r: Rd, end: number, cx: Ctx): Promise<{ layers: PsdLayer[]; alpha: boolean; lossy: boolean }> {
  let count = r.i16();
  const alpha = count < 0;
  count = Math.abs(count);
  const recs: Rec[] = [];
  for (let k = 0; k < count; k++) {
    const top = r.i32(), left = r.i32(), bottom = r.i32(), right = r.i32();
    const nc = r.u16();
    if (nc > 56) throw new PsdError(BROKEN);
    const chans: Rec['chans'] = [];
    for (let c = 0; c < nc; c++) chans.push({ id: r.i16(), len: cx.big ? r.u64() : r.u32() });
    if (!r.sigAt(r.p)) throw new PsdError(BROKEN);
    r.p += 4;
    const blend = r.str(4), opacity = r.u8(), clip = r.u8(), flags = r.u8();
    r.p++;
    const exLen = r.u32(), exEnd = r.p + exLen;
    if (exEnd > end) throw new PsdError(BROKEN);
    let mask: PsdMask | null = null, soft: Rec['soft'], mask2: PsdMask | undefined, fromVec = false;
    const mLen = r.u32(), mEnd = r.p + mLen;
    if (mLen >= 18) {
      const mt = r.i32(), ml = r.i32(), mb = r.i32(), mr = r.i32(), def = r.u8(), mf = r.u8();
      mask = { top: mt, left: ml, w: Math.max(0, mr - ml), h: Math.max(0, mb - mt), data: null, def: def >= 128 ? 255 : 0, off: !!(mf & 2) };
      // Cu două măști: după prima vin steagurile, fondul și dreptunghiul măștii puse de om (canalul -3).
      if (mLen >= 36) {
        const rf = r.u8(), rd = r.u8(), t2 = r.i32(), l2 = r.i32(), b2 = r.i32(), r2 = r.i32();
        mask2 = { top: t2, left: l2, w: Math.max(0, r2 - l2), h: Math.max(0, b2 - t2), data: null, def: rd >= 128 ? 255 : 0, off: !!(rf & 2) };
      }
      if (mf & 8) fromVec = true;
      // Parametrii măștii (densitate și estompare), la sfârșit, dacă sunt.
      if (mf & 16 && r.p < mEnd) {
        const pf = r.u8();
        soft = { ud: 255, uf: 0, vd: 255, vf: 0 };
        if (pf & 1) soft.ud = r.u8();
        if (pf & 2) soft.uf = r.f64();
        if (pf & 4) soft.vd = r.u8();
        if (pf & 8) soft.vf = r.f64();
      }
    }
    r.p = mEnd;
    { const n = r.u32(); r.p += n; } // intervalele de amestec („Blend If”): nu le folosim
    const nlen = r.u8();
    let name = r.str(nlen);
    r.p += (4 - ((1 + nlen) % 4)) % 4;
    let fxs: PsdFx | null = null;
    let section = 0, fill = 255, locked = false, lockAlpha = false, lockPixels = false, lockPos = false;
    const kinds = new Set<string>();
    let solid: string | undefined, grad: PsdGradFill | undefined, pat: PsdPatternFill | undefined, vmask: Uint8Array | undefined, adjust: Adjust | undefined, text: PsdText | undefined, link: PsdLink | undefined;
    while (r.p + 12 <= exEnd && r.nextBlock(exEnd)) {
      r.p += 4;
      const key = r.str(4);
      const len = cx.big && BIG_KEYS.has(key) ? r.u64() : r.u32();
      const s = r.p;
      if (s + len > exEnd) break;
      if (key === 'luni' && len >= 4) {
        const n = r.u32();
        let u = '';
        for (let i = 0; i < n && r.p + 2 <= s + len; i++) u += String.fromCharCode(r.u16());
        name = u.replace(/\0+$/, '');
      } else if ((key === 'lsct' || key === 'lsdk') && len >= 4) section = r.u32();
      else if (key === 'iOpa' && len >= 1) fill = r.u8();
      // Blocările: bitul de sus = totul blocat; transparența + pixelii + poziția împreună înseamnă tot la noi.
      else if (key === 'lspf' && len >= 4) { const f = r.u32(); locked = !!(f & 0x80000000) || (f & 7) === 7; lockAlpha = !locked && !!(f & 1); lockPixels = !locked && !!(f & 2); lockPos = !locked && !!(f & 4); }
      else if (key === 'SoCo') { kinds.add('adj'); solid = readSolidFill(r.b.subarray(s, s + len)) ?? undefined; }
      else if (key === 'PtFl') { kinds.add('adj'); pat = patternFillOf(readDescBlock(r.b.subarray(s, s + len))) ?? undefined; }
      else if (key === 'GdFl') { kinds.add('adj'); grad = readGradientFill(r.b.subarray(s, s + len)) ?? undefined; }
      else if (ADJ_KEYS.has(key)) { kinds.add('adj'); adjust = readPsdAdjust(key, r.b.subarray(s, s + len)) ?? adjust; }
      else if (key === 'lfx2') { kinds.add('fx'); fxs = readLayerFx(r.b.subarray(s, s + len), cx.patterns); }
      else if (key === 'lrFX' || key === 'lmfx') kinds.add('fx');
      else if (key === 'TySh') { kinds.add('text'); text = readPsdText(r.b.subarray(s, s + len)) ?? undefined; }
      else if (key === 'tySh') kinds.add('text');
      else if (key === 'SoLd' || key === 'PlLd' || key === 'SoLE') kinds.add('smart');
      else if (key === 'vmsk' || key === 'vsms') { kinds.add('vector'); vmask = r.b.subarray(s, s + len); }
      else if (key === LINK_KEY) link = readLink(r.b.subarray(s, s + len));
      r.p = s + len;
    }
    r.p = exEnd;
    recs.push({ top, left, bottom, right, chans, blend, opacity, clip: clip === 1, hidden: !!(flags & 2), mask, ...(soft ? { soft } : {}), ...(fromVec ? { fromVec } : {}), ...(mask2 ? { mask2 } : {}), name, section, fill, kinds, fx: fxs, locked, lockAlpha, lockPixels, lockPos, ...(solid ? { solid } : {}), ...(grad ? { grad } : {}), ...(pat ? { pat } : {}), ...(vmask ? { vmask } : {}), ...(adjust ? { adjust } : {}), ...(text ? { text } : {}), ...(link ? { link } : {}) });
  }

  // Pixelii, strat cu strat, canal cu canal.
  const px: Map<number, Uint8Array>[] = [];
  for (const rec of recs) {
    const m = new Map<number, Uint8Array>();
    const w = Math.max(0, rec.right - rec.left), h = Math.max(0, rec.bottom - rec.top);
    if (w * h > MAX_PIXELS) throw new PsdError('Un strat din fișierul .psd e prea mare pentru memoria laptopului.');
    for (const ch of rec.chans) {
      const s = r.p, e = s + ch.len;
      if (e > end) throw new PsdError(BROKEN);
      const mk = ch.id === -2 ? rec.mask : ch.id === -3 ? rec.mask2 : null;
      const cw = mk ? mk.w : ch.id < -1 ? 0 : w, chh = mk ? mk.h : ch.id < -1 ? 0 : h;
      if (ch.len > 2 && cw > 0 && chh > 0 && ch.id >= -3) m.set(ch.id, await readChannel(r, e, cw, chh, cx.bps, cx.big, ch.id < 0));
      r.p = e;
    }
    px.push(m);
  }

  // Grupurile: de sus în jos, „dosarul” (1 sau 2) vine deasupra straturilor lui, iar capătul (3) sub ele.
  // Fiecare grup deschis: ochiul și opacitatea adunate (cu ale lui), plus grupul însuși pentru straturile din el.
  type Open = { g: PsdGroup };
  const stack: Open[] = [];
  const out: PsdLayer[] = [];
  let groups = 0, adj = 0, fx = 0, text = 0, texts = 0, smart = 0, vector = 0;
  for (let k = recs.length - 1; k >= 0; k--) {
    const rec = recs[k], m = px[k];
    const par = stack[stack.length - 1];
    if (rec.section === 1 || rec.section === 2) {
      stack.push({
        g: { key: k, name: rec.name || `Grup ${groups + 1}`, visible: !rec.hidden, opacity: rec.opacity / 255, open: rec.section === 1, ...(par ? { parent: par.g } : {}) },
      });
      groups++;
      continue;
    }
    if (rec.section === 3) { stack.pop(); continue; }
    let w = Math.max(0, rec.right - rec.left), h = Math.max(0, rec.bottom - rec.top);
    const hasPixels = w > 0 && h > 0 && [0, 1, 2, 3, -1].some((id) => m.has(id));
    // Umplerea cu o culoare fără pixeli: un strat cât toată poza, plin cu culoarea ei (masca de pixeli, dacă are, o decupează).
    // Cu mască vectorială (o formă) n-avem conturul, deci rămâne pierdută.
    let solid: Uint8ClampedArray | null = null;
    const patOf = (x: Rec) => (x.pat ? cx.patterns?.get(x.pat.id) : undefined);
    // O formă fără pixeli (umplere + mască vectorială): conturul ei devine masca de pixeli a stratului.
    const big = cx.width * cx.height > MAX_PIXELS;
    const vec = rec.kinds.has('vector') && rec.vmask && !hasPixels && (rec.solid || rec.grad || patOf(rec)) && !big ? readVectorMask(rec.vmask, cx.width, cx.height) : null;
    const fillOk = !rec.kinds.has('vector') || !!vec;
    // Un strat obișnuit (cu pixeli) cu mască vectorială: conturul decupează pixelii, ca o mască de pixeli.
    // Dacă programul a pus în fișier și masca desenată din contur (canalul -2), o folosim pe aceea.
    const drawn = !!rec.fromVec && px[k].has(-2);
    const pvec = !vec && !drawn && hasPixels && !rec.kinds.has('adj') && rec.vmask && !big ? readVectorMask(rec.vmask, cx.width, cx.height) : null;
    if (rec.kinds.has('adj') && !hasPixels && rec.solid && fillOk && !big) {
      const c = parseInt(rec.solid.slice(1), 16);
      w = cx.width; h = cx.height;
      solid = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < solid.length; i += 4) { solid[i] = c >> 16; solid[i + 1] = (c >> 8) & 255; solid[i + 2] = c & 255; solid[i + 3] = 255; }
    } else if (rec.kinds.has('adj') && !hasPixels && rec.grad && fillOk && !big) {
      // La fel umplerea cu degrade: desenată cât toată poza, cu felul, unghiul și scara din fișier.
      w = cx.width; h = cx.height;
      solid = drawGradientFill(rec.grad, w, h);
    } else if (rec.kinds.has('adj') && !hasPixels && patOf(rec) && fillOk && !big) {
      // Și umplerea cu model: modelul din fișier, repetat pe toată poza.
      w = cx.width; h = cx.height;
      solid = drawPatternFill(patOf(rec)!, rec.pat!, w, h);
    } else if (rec.kinds.has('adj') && !hasPixels && !rec.adjust) { adj++; continue; }
    const isAdj = rec.kinds.has('adj') && !hasPixels && !solid && !!rec.adjust;
    if (isAdj) { w = 0; h = 0; }
    // Efectele pe care le avem devin stiluri; se numără doar dacă lipsește ceva (relief, satin, degrade, model).
    if (rec.kinds.has('fx') && (!rec.fx || rec.fx.unsupported > 0)) fx++;
    if (rec.kinds.has('text') && !rec.text) text++;
    if (rec.text) texts++;
    if (rec.kinds.has('smart')) smart++;
    // O formă (umplere + contur vectorial) are deja pixelii desenați; doar un strat obișnuit cu mască vectorială pierde ceva.
    if (rec.kinds.has('vector') && !rec.kinds.has('adj') && !pvec && !drawn && !(rec.vmask && vectorMaskOff(rec.vmask))) vector++;
    // Grupul cel mai apropiat (cu grupurile de deasupra lui în `parent`).
    const inner = stack[stack.length - 1];
    const n = w * h;
    const nc = colorChannels(cx.mode);
    const rgba = solid ?? (n ? toRGBA(cx.mode, [0, 1, 2, 3].slice(0, nc).map((id) => m.get(id)), m.get(-1), n, null) : new Uint8ClampedArray(0));
    let mask: PsdMask | undefined;
    if (rec.mask) mask = { ...rec.mask, data: m.get(-2) ?? null };
    // Densitatea și estomparea: ale măștii vectoriale, dacă masca e desenată din contur; altfel ale celei de pixeli.
    const sf = rec.soft, sd = rec.fromVec ? sf?.vd : sf?.ud, sfe = rec.fromVec ? sf?.vf : sf?.uf;
    if (mask && sf && (sd! < 255 || sfe! > 0)) mask = softenMask(mask, sfe!, sd!);
    if (rec.mask2 && m.has(-3)) {
      // A doua mască (a omului), cu densitatea / estomparea ei, înmulțită cu prima.
      let m2: PsdMask = { ...rec.mask2, data: m.get(-3)! };
      if (sf && (sf.ud < 255 || sf.uf > 0)) m2 = softenMask(m2, sf.uf, sf.ud);
      mask = mask ? mulMasks(mask, m2) : m2;
    }
    if (vec && solid) {
      // Conturul formei, înmulțit cu masca de pixeli (dacă are), într-o singură mască cât poza.
      mask = joinVectorMask(softVector(vec, 0, 0, w, h, rec.soft), 0, 0, w, h, mask);
    } else if (pvec) {
      // La un strat cu pixeli, masca e cât stratul (în afara lui n-are ce decupa).
      mask = joinVectorMask(softVector(pvec, rec.left, rec.top, w, h, rec.soft), rec.left, rec.top, w, h, mask);
    }
    out.push({
      name: rec.name, left: solid ? 0 : rec.left, top: solid ? 0 : rec.top, w, h, rgba,
      visible: !rec.hidden,
      // Umplerea (Fill): cu stiluri de strat se ține separat (stilurile rămân întregi); fără stiluri e același lucru cu opacitatea.
      opacity: (rec.opacity / 255) * (rec.fx?.fx && rec.fill < 255 ? 1 : rec.fill / 255),
      ...(inner ? { group: inner.g } : {}),
      blend: BLEND_IN[rec.blend] ?? 'source-over',
      mask, clip: rec.clip,
      ...(rec.locked ? { locked: true } : {}),
      ...(rec.lockAlpha ? { lockAlpha: true } : {}),
      ...(rec.lockPixels ? { lockPixels: true } : {}),
      ...(rec.lockPos ? { lockPos: true } : {}),
      ...(isAdj ? { adj: rec.adjust } : {}),
      ...(rec.fx?.fx ? { fx: rec.fill < 255 ? { ...rec.fx.fx, fill: rec.fill / 255 } : rec.fx.fx } : {}),
      ...(rec.text ? { text: rec.text } : {}),
      ...(rec.link ? { link: rec.link } : {}),
    });
  }
  out.reverse();
  const n = cx.notes;
  if (adj) n.push(`${adj} ${adj === 1 ? 'strat de ajustare sau de umplere nu a putut fi păstrat' : 'straturi de ajustare sau de umplere nu au putut fi păstrate'}.`);
  if (fx) n.push(`Unele efecte de strat (relief, satin, degrade, model) de pe ${fx} ${fx === 1 ? 'strat nu se văd' : 'straturi nu se văd'}.`);
  if (text) n.push(`Textele (${text}) au devenit pixeli (nu se mai pot edita ca text).`);
  if (texts) n.push(`Textele (${texts}) se văd cum au fost desenate; cuvintele, fontul și culoarea lor se pot rescrie din ⓘ Proprietăți.`);
  if (smart) n.push(`Obiectele inteligente (${smart}) au devenit pixeli.`);
  if (vector) n.push('Măștile vectoriale nu se folosesc.');
  return { layers: out, alpha, lossy: adj + fx + vector > 0 };
}

/** Modelele din blocurile „Patt” / „Pat2” / „Pat3” de după straturi (căutate fără să mute cititorul principal). */
function scanPatterns(data: Uint8Array, from: number, end: number, big: boolean): Map<string, PsdPattern> {
  const pats = new Map<string, PsdPattern>();
  try {
    const r = new Rd(data);
    r.p = from;
    if (r.p + 4 <= end) { const n = r.u32(); r.p += n; } // masca globală
    while (r.p + 12 <= end && r.nextBlock(end)) {
      r.p += 4;
      const key = r.str(4);
      const len = big && BIG_KEYS.has(key) ? r.u64() : r.u32();
      const s = r.p;
      if ((key === 'Patt' || key === 'Pat2' || key === 'Pat3') && s + len <= end) readPatterns(data.subarray(s, s + len), pats);
      r.p = s + len;
    }
  } catch { /* fără modele: umplerile cu model rămân pierdute */ }
  return pats;
}

/** Două măști înmulțite, într-una singură pe dreptunghiul care le cuprinde pe amândouă. */
function mulMasks(a: PsdMask, b: PsdMask): PsdMask {
  const at = (m: PsdMask, x: number, y: number) => {
    if (m.off) return 255;
    const mx = x - m.left, my = y - m.top;
    return m.data && mx >= 0 && my >= 0 && mx < m.w && my < m.h ? m.data[my * m.w + mx] : m.def;
  };
  const left = Math.min(a.left, b.left), top = Math.min(a.top, b.top);
  const w = Math.max(a.left + a.w, b.left + b.w) - left, h = Math.max(a.top + a.h, b.top + b.h) - top;
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = Math.round((at(a, x + left, y + top) * at(b, x + left, y + top)) / 255);
  return { top, left, w, h, data, def: Math.round(((a.off ? 255 : a.def) * (b.off ? 255 : b.def)) / 255), off: false };
}

/** Masca de pixeli estompată (feather, în pixeli) și cu densitatea ei (255 = masca întreagă, 0 = nu ascunde nimic). */
function softenMask(m: PsdMask, feather: number, dens: number): PsdMask {
  let { data, w, h, left, top } = m;
  if (data && feather > 0) {
    // Marginea din jur (cu valoarea de fond), ca estomparea să nu se oprească la marginea măștii.
    const P = Math.ceil(feather * 1.5), W = w + 2 * P, H = h + 2 * P;
    const a = new Float32Array(W * H).fill(m.def);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[(y + P) * W + x + P] = data[y * w + x];
    const b = blur1(a, W, H, feather / 2);
    data = new Uint8Array(W * H);
    for (let i = 0; i < b.length; i++) data[i] = Math.round(b[i]);
    w = W; h = H; left -= P; top -= P;
  }
  const dn = (v: number) => Math.round(255 - ((255 - v) * dens) / 255);
  if (data && dens < 255) { data = data.slice(); for (let i = 0; i < data.length; i++) data[i] = dn(data[i]); }
  return { ...m, data, w, h, left, top, def: dn(m.def) };
}

/** Masca vectorială desenată în dreptunghiul stratului (w × h, cu colțul în left, top), estompată și cu densitatea din fișier. */
function softVector(vec: NonNullable<ReturnType<typeof readVectorMask>>, left: number, top: number, w: number, h: number, soft: Rec['soft']): Uint8Array {
  const f = soft?.vf ?? 0, d = soft?.vd ?? 255;
  // Cu estompare se desenează cu o margine în plus (traseele de lângă strat contează), apoi se taie.
  const P = f > 0 ? Math.ceil(f * 1.5) : 0, W = w + 2 * P, H = h + 2 * P;
  const sh = vec.paths.map((p) => p.map(([x, y]) => [x - left + P, y - top + P] as [number, number]));
  let vm = rasterizeVectorMask(sh, W, H, vec.invert, vec.ops);
  if (P) {
    const b = blur1(Float32Array.from(vm), W, H, f / 2);
    vm = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) vm[y * w + x] = Math.round(b[(y + P) * W + x + P]);
  }
  if (d < 255) for (let i = 0; i < vm.length; i++) vm[i] = Math.round(255 - ((255 - vm[i]) * d) / 255);
  return vm;
}

/** Masca vectorială desenată (w × h, cu colțul în left, top), înmulțită cu masca de pixeli a stratului, dacă are una pornită. */
function joinVectorMask(vm: Uint8Array, left: number, top: number, w: number, h: number, pm: PsdMask | undefined): PsdMask {
  if (pm && !pm.off) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const mx = x + left - pm.left, my = y + top - pm.top;
      const pv = pm.data && mx >= 0 && my >= 0 && mx < pm.w && my < pm.h ? pm.data[my * pm.w + mx] : pm.def;
      vm[y * w + x] = Math.round((vm[y * w + x] * pv) / 255);
    }
  }
  return { top, left, w, h, data: vm, def: 0, off: false };
}

/** Poza compusă de la final: toate canalele, unul după altul, cu o singură compresie. */
async function readComposite(r: Rd, nch: number, w: number, h: number, cx: Ctx, pal: Uint8Array | null, alpha: boolean, extra: number): Promise<{ rgba: Uint8ClampedArray; extra: Uint8Array[] }> {
  const comp = r.u16();
  const rowBytes = w * cx.bps, plane = rowBytes * h;
  const nc = colorChannels(cx.mode);
  const first = Math.min(nch, nc + (alpha ? 1 : 0));
  const use = Math.min(nch, first + extra);
  let all: Uint8Array;
  if (comp === 0) all = r.b.subarray(r.p, Math.min(r.b.length, r.p + plane * use));
  else if (comp === 1) {
    // Lungimile rândurilor sunt pentru toate canalele din fișier, dar desenăm doar câte ne trebuie.
    const cnt = cx.big ? 4 : 2;
    all = new Uint8Array(plane * use);
    const b = r.b;
    let d = r.p + nch * h * cnt;
    if (d > b.length) throw new PsdError(BROKEN);
    for (let y = 0; y < use * h; y++) {
      const q = r.p + y * cnt;
      const n = cx.big ? ((b[q] << 24) | (b[q + 1] << 16) | (b[q + 2] << 8) | b[q + 3]) >>> 0 : (b[q] << 8) | b[q + 1];
      unpackBits(b, d, Math.min(d + n, b.length), all, y * rowBytes, rowBytes);
      d += n;
    }
  } else if (comp === 2 || comp === 3) {
    all = await inflate(r.b.subarray(r.p));
    if (comp === 3) unpredict(all, w, Math.min(h * use, Math.floor(all.length / rowBytes)), cx.bps);
  } else throw new PsdError('Fișierul .psd folosește o compresie pe care nu o cunoaștem.');
  const chans: Uint8Array[] = [];
  for (let i = 0; i < use; i++) chans.push(to8(all.subarray(i * plane, (i + 1) * plane), w * h, cx.bps, i >= nc));
  // Selecțiile salvate se copiază, ca restul canalelor să poată fi eliberat.
  const ex = chans.slice(first).map((c) => c.slice());
  return { rgba: toRGBA(cx.mode, chans.slice(0, nc), alpha && first > nc ? chans[nc] : undefined, w * h, pal), extra: ex };
}

export async function readPSD(data: Uint8Array): Promise<Psd> {
  const r = new Rd(data);
  if (data.length < 26 || r.str(4) !== '8BPS') throw new PsdError('Fișierul nu este un .psd.');
  const ver = r.u16();
  if (ver !== 1 && ver !== 2) throw new PsdError(BROKEN);
  const big = ver === 2;
  r.p += 6;
  const nch = r.u16(), height = r.u32(), width = r.u32(), depth = r.u16(), mode = r.u16();
  if (!width || !height || !nch) throw new PsdError(BROKEN);
  if (width * height > MAX_PIXELS) throw new PsdError(`Poza e prea mare (${width} × ${height} px) pentru memoria laptopului.`);
  if (depth !== 8 && depth !== 16 && depth !== 32) throw new PsdError('Fișierul .psd e alb-negru pe 1 bit și nu poate fi deschis încă.');
  if (![1, 2, 3, 4, 8].includes(mode)) throw new PsdError('Fișierul .psd e în modul Lab sau multicanal, pe care nu le putem deschide încă.');
  const cx: Ctx = { mode, bps: depth / 8, big, notes: [], width, height };
  const cmLen = r.u32();
  const pal = mode === 2 && cmLen >= 768 ? data.subarray(r.p, r.p + 768) : null;
  r.p += cmLen;
  // Resursele: din ele luăm numele selecțiilor salvate (canalele alfa) și traseele salvate.
  let names: string[] = [], spot: boolean[] = [], paths: PsdPath[] = [];
  { const n = r.u32(), re = Math.min(data.length, r.p + n);
    try { ({ names, spot } = channelNames(data, r.p, re)); } catch { names = []; }
    try { paths = readPathResources(data, r.p, re, width, height); } catch { paths = []; }
    r.p += n; }
  const lmLen = big ? r.u64() : r.u32();
  const lmEnd = r.p + lmLen;
  let layers: PsdLayer[] = [];
  let alpha = false, lossy = false;
  let annotations: PsdNote[] = [];
  if (lmLen > 0) {
    try {
      if (lmEnd > data.length) throw new PsdError(BROKEN);
      const liLen = big ? r.u64() : r.u32();
      const liEnd = r.p + liLen;
      // Modelele (blocurile de la final) se citesc întâi: straturile de umplere cu model au nevoie de ele.
      cx.patterns = scanPatterns(data, liEnd, lmEnd, big);
      if (liLen > 0) ({ layers, alpha, lossy } = await readLayers(r, liEnd, cx));
      r.p = liEnd;
      if (r.p + 4 <= lmEnd) { const n = r.u32(); r.p += n; } // masca globală
      // Blocurile de la final: la 16 biți straturile sunt aici („Lr16”), nu mai sus.
      while (r.p + 12 <= lmEnd && r.nextBlock(lmEnd)) {
        r.p += 4;
        const key = r.str(4);
        const len = big && BIG_KEYS.has(key) ? r.u64() : r.u32();
        const s = r.p;
        if (key === 'Anno' && s + len <= lmEnd) { try { annotations = decodeAnno(data.subarray(s, s + len), width, height); } catch { annotations = []; } }
        if (!layers.length && (key === 'Lr16' || key === 'Lr32' || key === 'Layr') && s + len <= lmEnd) ({ layers, alpha, lossy } = await readLayers(r, s + len, cx));
        r.p = s + len;
      }
    } catch (e) {
      layers = [];
      cx.notes.length = 0;
      cx.notes.push('Straturile din fișier n-au putut fi citite; s-a deschis poza compusă.');
      if (!(e instanceof PsdError)) console.warn(e);
    }
  }
  r.p = lmEnd;
  let composite: Uint8ClampedArray | null = null;
  const channels: PsdChannel[] = [];
  // Canalele de după culori (și după transparență) sunt selecțiile salvate; le luăm doar pe cele care au nume în resurse.
  const extra = Math.min(MAX_CHANNELS, names.length, Math.max(0, nch - colorChannels(mode) - (alpha ? 1 : 0)));
  try {
    if (r.p + 2 <= data.length) {
      const c = await readComposite(r, nch, width, height, cx, pal, alpha, extra);
      composite = c.rgba;
      c.extra.forEach((d, i) => { if (!spot[i]) channels.push({ name: names[i] || `Selecția ${i + 1}`, data: d }); });
    }
  } catch {
    composite = null;
  }
  if (!composite && !layers.length) throw new PsdError(BROKEN);
  if (depth > 8) cx.notes.push(`Fișierul e pe ${depth}${depth > 19 ? " de" : ""} biți${depth === 32 ? ' (HDR)' : ''}: s-a deschis pe 8 biți.`);
  if (mode === 4) cx.notes.push('Culorile CMYK au fost transformate în RGB.');
  return { width, height, layers, composite, notes: cx.notes, lossy, channels, paths, annotations };
}

// ——— Scrierea ———

class Wr {
  b = new Uint8Array(1 << 16);
  p = 0;
  ensure(n: number) {
    if (this.p + n <= this.b.length) return;
    let m = this.b.length * 2;
    while (m < this.p + n) m *= 2;
    const nb = new Uint8Array(m);
    nb.set(this.b.subarray(0, this.p));
    this.b = nb;
  }
  u8(x: number) { this.ensure(1); this.b[this.p++] = x & 255; }
  u16(x: number) { this.ensure(2); this.b[this.p++] = (x >> 8) & 255; this.b[this.p++] = x & 255; }
  u32(x: number) { this.ensure(4); x >>>= 0; this.b[this.p++] = x >>> 24; this.b[this.p++] = (x >>> 16) & 255; this.b[this.p++] = (x >>> 8) & 255; this.b[this.p++] = x & 255; }
  str(s: string) { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); }
  bytes(a: Uint8Array) { this.ensure(a.length); this.b.set(a, this.p); this.p += a.length; }
  zeros(n: number) { this.ensure(n); this.b.fill(0, this.p, this.p + n); this.p += n; }
  set32(at: number, x: number) { x >>>= 0; this.b[at] = x >>> 24; this.b[at + 1] = (x >>> 16) & 255; this.b[at + 2] = (x >>> 8) & 255; this.b[at + 3] = x & 255; }
  done() { return this.b.slice(0, this.p); }
}

/** Un rând comprimat PackBits: repetițiile (2–128) ca pereche, restul ca bucăți literale (până la 128). */
function packRow(src: Uint8Array, s: number, len: number, out: Wr) {
  let i = 0;
  while (i < len) {
    let run = 1;
    while (i + run < len && run < 128 && src[s + i + run] === src[s + i]) run++;
    if (run >= 2) { out.u8(257 - run); out.u8(src[s + i]); i += run; continue; }
    let j = i + 1;
    while (j < len && j - i < 128 && !(j + 2 < len && src[s + j] === src[s + j + 1] && src[s + j] === src[s + j + 2])) j++;
    out.u8(j - i - 1);
    out.bytes(src.subarray(s + i, s + j));
    i = j;
  }
}

/** Canalul comprimat RLE: lungimile rândurilor, apoi rândurile. Fără cei 2 octeți de compresie. */
function rleChannel(plane: Uint8Array, w: number, h: number): Uint8Array {
  const data = new Wr();
  const counts = new Uint16Array(h);
  for (let y = 0; y < h; y++) {
    const before = data.p;
    packRow(plane, y * w, w, data);
    counts[y] = data.p - before;
  }
  const out = new Wr();
  out.ensure(h * 2 + data.p);
  for (let y = 0; y < h; y++) out.u16(counts[y]);
  out.bytes(data.b.subarray(0, data.p));
  return out.done();
}

/** Canalul `k` (0–3) dintr-un RGBA. */
function planeOf(rgba: Uint8ClampedArray, k: number): Uint8Array {
  const n = rgba.length >> 2, o = new Uint8Array(n);
  for (let i = 0, j = k; i < n; i++, j += 4) o[i] = rgba[j];
  return o;
}

/** Numele în octeți simpli (fără diacritice), pentru câmpul vechi; numele întreg merge separat, în UTF-16. */
function asciiName(s: string) {
  let o = '';
  for (const ch of s.normalize('NFD')) {
    const c = ch.charCodeAt(0);
    if (c >= 0x300 && c <= 0x36f) continue;
    o += c >= 32 && c < 127 ? ch : '_';
  }
  return o.slice(0, 255);
}

export interface PsdOutLayer {
  name: string;
  /** Pixelii RGBA (w × h), ceruți abia când se scrie stratul, ca să nu ținem toate straturile deodată în memorie. */
  rgba: () => Uint8ClampedArray;
  visible: boolean;
  opacity: number;
  blend: Blend;
  /** Masca în tonuri de gri (w × h), dacă are. */
  mask?: () => Uint8Array;
  maskOff?: boolean;
  locked?: boolean;
  lockAlpha?: boolean;
  lockPixels?: boolean;
  lockPos?: boolean;
  /** Mască de decupare pe stratul de sub el. */
  clip?: boolean;
  /**
   * Înregistrare de grup, fără pixeli: 1 = dosarul (deschis), 2 = dosarul (strâns), 3 = capătul grupului.
   * De jos în sus: capătul, straturile grupului, apoi dosarul (cu numele, ochiul și opacitatea grupului).
   */
  section?: 1 | 2 | 3;
  /** Blocul textului (TySh), scris înapoi neschimbat: stratul rămâne text în programele care îl citesc. */
  typeTool?: Uint8Array;
  /** Legătura cu fișierul pozei (stratul 🖇). */
  link?: PsdLink;
}

/** Un .psd RGB pe 8 biți, cu straturile date (de jos în sus) și poza compusă (RGBA, w × h). */
export function writePSD(width: number, height: number, layers: PsdOutLayer[], composite: Uint8ClampedArray, channels: PsdChannel[] = [], paths: PsdPath[] = [], annos: PsdNote[] = []): Uint8Array {
  if (width > PSD_MAX_SIDE || height > PSD_MAX_SIDE) throw new PsdError(`Un .psd poate avea cel mult ${PSD_MAX_SIDE.toLocaleString('ro-RO')} px pe latură.`);
  let hasAlpha = false;
  for (let i = 3; i < composite.length; i += 4) if (composite[i] < 255) { hasAlpha = true; break; }
  const nch = (hasAlpha ? 4 : 3) + channels.length;
  const w = new Wr();
  w.str('8BPS');
  w.u16(1);
  w.zeros(6);
  w.u16(nch);
  w.u32(height);
  w.u32(width);
  w.u16(8);
  w.u16(3);
  w.u32(0); // fără paletă
  // Resursele: rezoluția (72 dpi), ca la o poză obișnuită, și numele selecțiilor salvate (1006 simplu, 1045 cu diacritice).
  const res = w.p;
  w.u32(0);
  w.str('8BIM');
  w.u16(0x03ed);
  w.u16(0); // nume gol, completat la număr par
  w.u32(16);
  w.u32(72 << 16); w.u16(1); w.u16(1);
  w.u32(72 << 16); w.u16(1); w.u16(1);
  if (channels.length) {
    const block = (id: number, body: () => void) => {
      w.str('8BIM'); w.u16(id); w.u16(0);
      const at = w.p;
      w.u32(0);
      const st = w.p;
      body();
      w.set32(at, w.p - st);
      if ((w.p - st) % 2) w.u8(0);
    };
    block(1006, () => { for (const c of channels) { const a = asciiName(c.name); w.u8(a.length); w.str(a); } });
    block(1045, () => { for (const c of channels) { w.u32(c.name.length + 1); for (let i = 0; i < c.name.length; i++) w.u16(c.name.charCodeAt(i)); w.u16(0); } });
  }
  // Traseele salvate: resursele 2000, 2001…, fiecare cu numele traseului (octeți simpli) și punctele lui.
  paths.slice(0, 998).forEach((pt, i) => {
    if (pt.a.length < 2) return;
    const nm = pathNameBytes(pt.name);
    w.str('8BIM'); w.u16(2000 + i); w.u8(nm.length); for (const c of nm) w.u8(c);
    if ((1 + nm.length) % 2) w.u8(0);
    const d = pathRecords(pt, width, height);
    w.u32(d.length); w.bytes(d);
  });
  w.set32(res, w.p - res - 4);

  // Straturile: întâi comprimăm canalele fiecăruia (ca să le știm lungimile), apoi scriem înregistrările și datele.
  const chData: { id: number; data: Uint8Array }[][] = layers.map((l) => {
    // Dosarele și capetele de grup n-au pixeli: canale goale (doar felul compresiei).
    if (l.section) return [-1, 0, 1, 2].map((id) => ({ id, data: new Uint8Array(0) }));
    const rgba = l.rgba();
    const list = [-1, 0, 1, 2].map((id) => ({ id, data: rleChannel(planeOf(rgba, id < 0 ? 3 : id), width, height) }));
    if (l.mask) list.push({ id: -2, data: rleChannel(l.mask(), width, height) });
    return list;
  });
  const lm = w.p;
  w.u32(0); // lungimea secțiunii straturi + mască (o completăm la final)
  const li = w.p;
  w.u32(0);
  const liStart = w.p;
  w.u16((hasAlpha ? -layers.length : layers.length) & 0xffff);
  layers.forEach((l, k) => {
    if (l.section) { w.u32(0); w.u32(0); w.u32(0); w.u32(0); } else { w.u32(0); w.u32(0); w.u32(height); w.u32(width); }
    const chans = chData[k];
    w.u16(chans.length);
    for (const c of chans) { w.u16(c.id & 0xffff); w.u32(2 + c.data.length); }
    w.str('8BIM');
    // Dosarul unui grup e „trecere” (pass through): straturile lui se amestecă direct cu ce e sub grup.
    w.str(l.section === 1 || l.section === 2 ? 'pass' : BLEND_OUT[l.blend] ?? 'norm');
    w.u8(Math.round(Math.max(0, Math.min(1, l.opacity)) * 255));
    w.u8(l.clip ? 1 : 0); // mască de decupare
    w.u8((l.visible ? 0 : 2) | 8 | (l.section ? 16 : 0));
    w.u8(0);
    const ex = w.p;
    w.u32(0);
    const exStart = w.p;
    if (l.mask) {
      w.u32(20);
      w.u32(0); w.u32(0); w.u32(height); w.u32(width);
      w.u8(0);
      w.u8(l.maskOff ? 2 : 0);
      w.u16(0);
    } else w.u32(0);
    w.u32(0); // fără intervale de amestec
    const an = asciiName(l.name);
    w.u8(an.length);
    w.str(an);
    w.zeros((4 - ((1 + an.length) % 4)) % 4);
    // Numele întreg (cu ș, ț, ă…), în UTF-16, completat la multiplu de 4.
    const n = l.name.length;
    const pad = n % 2 ? 2 : 0;
    w.str('8BIM');
    w.str('luni');
    w.u32(4 + n * 2 + pad);
    w.u32(n);
    for (let i = 0; i < n; i++) w.u16(l.name.charCodeAt(i));
    w.zeros(pad);
    // Blocările: bitul de sus = tot; altfel 1 = transparența, 2 = pixelii, 4 = poziția.
    const lf = l.locked ? 0x80000000 : (l.lockAlpha ? 1 : 0) | (l.lockPixels ? 2 : 0) | (l.lockPos ? 4 : 0);
    if (lf) { w.str('8BIM'); w.str('lspf'); w.u32(4); w.u32(lf >>> 0); }
    if (l.typeTool) { const tp = l.typeTool.length % 2; w.str('8BIM'); w.str('TySh'); w.u32(l.typeTool.length + tp); w.bytes(l.typeTool); w.zeros(tp); }
    if (l.link) {
      const j = new TextEncoder().encode(JSON.stringify({ path: l.link.path, sig: l.link.sig, box: l.link.box, abox: l.link.abox }));
      const lp = (4 - (j.length % 4)) % 4;
      w.str('8BIM'); w.str(LINK_KEY); w.u32(j.length + lp); w.bytes(j); w.zeros(lp);
    }
    if (l.section === 3) { w.str('8BIM'); w.str('lsct'); w.u32(4); w.u32(3); }
    else if (l.section) { w.str('8BIM'); w.str('lsct'); w.u32(12); w.u32(l.section); w.str('8BIM'); w.str('pass'); }
    w.set32(ex, w.p - exStart);
  });
  for (const chans of chData) for (const c of chans) { w.u16(1); w.bytes(c.data); }
  while ((w.p - liStart) % 4) w.u8(0);
  w.set32(li, w.p - liStart);
  w.u32(0); // fără mască globală
  // Notele 🗒 de pe poză.
  if (annos.length) { const a = encodeAnno(annos); w.str('8BIM'); w.str('Anno'); w.u32(a.length); w.bytes(a); }
  w.set32(lm, w.p - lm - 4);

  // Poza compusă: RLE, întâi lungimile rândurilor tuturor canalelor, apoi datele.
  w.u16(1);
  const packed = [0, 1, 2, 3].slice(0, nch - channels.length).map((k) => rleChannel(planeOf(composite, k), width, height));
  for (const c of channels) packed.push(rleChannel(c.data, width, height));
  for (const p of packed) w.bytes(p.subarray(0, height * 2));
  for (const p of packed) w.bytes(p.subarray(height * 2));
  return w.done();
}
