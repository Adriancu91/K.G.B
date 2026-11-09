// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Pozele de pe foaie (Inserare → Imagine): stau peste celule, prinse de colțul din stânga sus al unei celule
// (rândul r, coloana c și cât de departe de colț, în pixeli), cu lățimea și înălțimea lor. Se mută cu celula
// când derulezi; la .xlsx devin xdr:pic într-un xdr:oneCellAnchor.

import { parseWordArt, type WordArtSpec } from '../docs/wordArt';
import { parseShapeBox, type ShapeBox } from './shapeBox';
import { parseDiagram, type DocDiagram } from '../docs/diagram';
import { cleanM3d, type Model3DKeep } from '../model3d';
import { parseIconSpec, type IconSpec } from '../icons/iconLib';

export interface SheetPic {
  id: string;
  /** Poza, ca data: URL (PNG / JPEG / GIF / WebP / BMP). */
  src: string;
  r: number;
  c: number;
  dx: number;
  dy: number;
  w: number;
  h: number;
  /** Textul alternativ (ce arată poza), pentru cititoarele de ecran. */
  alt?: string;
  /** Poza în celulă: umple celula r, c (cu proporțiile păstrate) și se mută odată cu ea; w / h sunt mărimea la ultima așezare. */
  cell?: true;
  /** Textul artistic din care s-a desenat poza (vezi docs/wordArt.ts), ca să poată fi schimbat cu dublu-click. */
  wa?: WordArtSpec;
  /** Forma (sau caseta de text) din care s-a desenat poza (vezi shapeBox.ts), ca să poată fi schimbată și redesenată. */
  sh?: ShapeBox;
  /** Ecuația din care s-a desenat poza (textul ei, vezi docs/equation.ts), ca să poată fi schimbată cu dublu-click. */
  eq?: string;
  /** Schema din care s-a desenat poza (proces, listă, ciclu…, vezi docs/diagram.ts), ca să poată fi schimbată cu dublu-click. */
  dg?: DocDiagram;
  /** Modelul 3D din care s-a desenat poza (vezi model3d.ts), ca să poată fi rotit din nou cu dublu-click. */
  m3d?: Model3DKeep;
  /** Pictograma din care s-a desenat poza (vezi icons/iconLib.ts): culoarea și grosimea liniei se schimbă de pe bara ei. */
  ic?: IconSpec;
}

export const MAX_PICS = 50;
export const PIC_MIN = 8;
export const PIC_MAX = 4000;
/** Lățimea cu care intră o poză nouă (cea mai mare latură), ca să nu acopere tot tabelul. */
export const PIC_START = 320;

const isImg = (s: unknown): s is string => typeof s === 'string' && /^data:image\/(png|jpeg|gif|webp|bmp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(s);
const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null);

/** Mărimea de început a unei poze: latura mare cel mult PIC_START, cu proporțiile păstrate. */
export function startSize(w: number, h: number): { w: number; h: number } {
  const k = Math.min(1, PIC_START / Math.max(w, h, 1));
  return { w: Math.max(PIC_MIN, Math.round(w * k)), h: Math.max(PIC_MIN, Math.round(h * k)) };
}

/** Noua mărime când tragi de colțul din dreapta jos; cu `keep` (fără Shift) proporțiile rămân aceleași. */
export function resized(p: { w: number; h: number }, dw: number, dh: number, keep: boolean): { w: number; h: number } {
  let w = p.w + dw, h = p.h + dh;
  if (keep) {
    const k = Math.max(w / p.w, h / p.h);
    w = p.w * k; h = p.h * k;
  }
  return { w: Math.min(PIC_MAX, Math.max(PIC_MIN, Math.round(w))), h: Math.min(PIC_MAX, Math.max(PIC_MIN, Math.round(h))) };
}

/** Pozele citite din fișier: doar cele cu imagine validă și poziție bună; cel mult MAX_PICS. */
export function cleanPics(raw: unknown, rows: number, cols: number): SheetPic[] {
  if (!Array.isArray(raw)) return [];
  const out: SheetPic[] = [];
  for (const p of raw) {
    if (out.length >= MAX_PICS) break;
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    const r = int(o.r, 0, rows - 1), c = int(o.c, 0, cols - 1), w = int(o.w, PIC_MIN, PIC_MAX), h = int(o.h, PIC_MIN, PIC_MAX);
    if (!isImg(o.src) || r === null || c === null || w === null || h === null) continue;
    out.push({
      id: typeof o.id === 'string' && o.id ? o.id.slice(0, 40) : `p${out.length + 1}`,
      src: o.src, r, c, dx: int(o.dx, 0, 4000) ?? 0, dy: int(o.dy, 0, 4000) ?? 0, w, h,
      ...(typeof o.alt === 'string' && o.alt.trim() ? { alt: o.alt.trim().slice(0, 500) } : {}),
      ...(o.cell === true ? { cell: true as const } : {}),
      ...(parseWordArt(o.wa) ? { wa: parseWordArt(o.wa)! } : {}),
      ...(parseShapeBox(o.sh) ? { sh: parseShapeBox(o.sh)! } : {}),
      ...(typeof o.eq === 'string' && o.eq.trim() ? { eq: o.eq.trim().slice(0, 2000) } : {}),
      ...(parseDiagram(o.dg) ? { dg: parseDiagram(o.dg)! } : {}),
      ...(cleanM3d(o.m3d) ? { m3d: cleanM3d(o.m3d)! } : {}),
      ...(parseIconSpec(o.ic) ? { ic: parseIconSpec(o.ic)! } : {}),
    });
  }
  return out;
}

/** O poză de pe foaie ca fișier în .xlsx: extensia, tipul și conținutul (base64); null pentru ce nu se poate pune (SVG). */
export function picPart(src: string): { ext: string; mime: string; b64: string } | null {
  const m = /^data:image\/(png|jpeg|gif|bmp|webp);base64,(.+)$/.exec(src);
  return m ? { ext: m[1] === 'jpeg' ? 'jpeg' : m[1], mime: 'image/' + m[1], b64: m[2] } : null;
}

const EMU = 9525;
const xmlAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Pozele foii ca xdr:oneCellAnchor (prinse de o celulă, cu mărimea lor), cu legăturile rIdP1, rIdP2… */
export function picAnchorsXml(pics: SheetPic[], firstId: number): string {
  return pics.map((p, k) => {
    const cx = p.w * EMU, cy = p.h * EMU;
    return `<xdr:oneCellAnchor><xdr:from><xdr:col>${p.c}</xdr:col><xdr:colOff>${p.dx * EMU}</xdr:colOff><xdr:row>${p.r}</xdr:row><xdr:rowOff>${p.dy * EMU}</xdr:rowOff></xdr:from>`
      + `<xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${firstId + k}" name="Poza ${k + 1}"${p.alt ? ` descr="${xmlAttr(p.alt)}"` : ''}/>`
      + '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>'
      + `<xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdP${k + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>`
      + `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
  }).join('');
}

/** Tipul pozei după extensia fișierului din .xlsx (EMF / WMF se transformă separat, în metafile.ts; TIFF nu se poate arăta). */
export function picMime(path: string): string | null {
  const e = path.split('.').pop()?.toLowerCase() ?? '';
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' } as Record<string, string>)[e] ?? null;
}

/** Locul unei poze citite: celula din colț (from), depărtarea în pixeli și mărimea (din ext, în EMU). */
export function picPlace(from: { col: number; colOff: number; row: number; rowOff: number }, cx: number, cy: number): Pick<SheetPic, 'r' | 'c' | 'dx' | 'dy' | 'w' | 'h'> | null {
  const px = (v: number) => Math.round(v / EMU);
  const w = px(cx), h = px(cy);
  if (![from.col, from.row, w, h].every(Number.isFinite) || w < 1 || h < 1) return null;
  return { r: Math.max(0, from.row), c: Math.max(0, from.col), dx: Math.max(0, px(from.colOff) || 0), dy: Math.max(0, px(from.rowOff) || 0), w: Math.min(PIC_MAX, Math.max(PIC_MIN, w)), h: Math.min(PIC_MAX, Math.max(PIC_MIN, h)) };
}
