// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Inspectează documentul: ce informații ascunse pleacă odată cu fișierul (comentarii, modificări urmărite, autorul din
// proprietăți, antet / subsol / filigran, datele din poze: aparatul, data, uneori locul GPS) și curățarea lor înainte de trimitere.
import type { Node as PMNode } from '@tiptap/pm/model';
import { docProps, pageEven, pageFirst, pageWatermark, pageWatermarkImage, type PageSetup } from './format';

/** Segmentele JPEG cu date despre poză: APP1 (EXIF, XMP), APP13 (IPTC) și comentariile. Culorile (APP2) și JFIF rămân. */
const JPEG_META = new Set([0xe1, 0xed, 0xfe]);
/** Bucățile PNG cu text și date: tEXt, iTXt, zTXt, eXIf, tIME. */
const PNG_META = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);

function jpegSegments(b: Uint8Array): { marker: number; start: number; end: number }[] | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  const out: { marker: number; start: number; end: number }[] = [];
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    // Începutul datelor imaginii: de aici nu mai sunt segmente cu lungime.
    if (marker === 0xda) break;
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return out;
    out.push({ marker, start: i, end: i + 2 + len });
    i += 2 + len;
  }
  return out;
}

function pngChunks(b: Uint8Array): { type: string; start: number; end: number }[] | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (sig.some((v, k) => b[k] !== v)) return null;
  const out: { type: string; start: number; end: number }[] = [];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    const end = i + 12 + len;
    if (end > b.length) break;
    out.push({ type, start: i, end });
    i = end;
    if (type === 'IEND') break;
  }
  return out;
}

/** Are poza date despre ea (EXIF, GPS, XMP, IPTC, comentarii)? */
export function imageHasMeta(b: Uint8Array): boolean {
  const j = jpegSegments(b);
  if (j) return j.some((s) => JPEG_META.has(s.marker));
  const p = pngChunks(b);
  return !!p && p.some((c) => PNG_META.has(c.type));
}

/** Aceeași poză, fără datele despre ea; pixelii rămân neatinși (nu se recomprimă). */
export function stripImageMeta(b: Uint8Array): Uint8Array {
  const drop = (jpegSegments(b)?.filter((s) => JPEG_META.has(s.marker)) ?? pngChunks(b)?.filter((c) => PNG_META.has(c.type)) ?? []);
  if (!drop.length) return b;
  const parts: Uint8Array[] = [];
  let at = 0;
  for (const d of drop) { parts.push(b.subarray(at, d.start)); at = d.end; }
  parts.push(b.subarray(at));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let k = 0;
  for (const p of parts) { out.set(p, k); k += p.length; }
  return out;
}

const DATA_URL = /^data:(image\/(?:jpeg|jpg|png));base64,(.*)$/i;

export function dataUrlBytes(src: string): { mime: string; bytes: Uint8Array } | null {
  const m = DATA_URL.exec(src);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime: m[1].toLowerCase(), bytes };
  } catch { return null; }
}

export function bytesDataUrl(mime: string, b: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}

export interface Findings {
  comments: number;
  changes: number;
  props: string[];
  headFoot: string[];
  images: number[];
}

/** Ce s-a găsit în document. `images` = pozițiile pozelor cu date ascunse. */
export function inspectDoc(doc: PMNode, page: PageSetup): Findings {
  const comments = new Set<string>();
  let changes = 0;
  const images: number[] = [];
  doc.descendants((node, pos) => {
    if (node.isText) {
      for (const m of node.marks) {
        if (m.type.name === 'comment') comments.add(String(m.attrs.id));
        if (m.type.name === 'insertion' || m.type.name === 'deletion') changes++;
      }
      return false;
    }
    if (node.type.name === 'image') {
      const d = dataUrlBytes(String(node.attrs.src ?? ''));
      if (d && imageHasMeta(d.bytes)) images.push(pos);
    }
    return true;
  });
  const p = docProps(page) ?? {};
  const props = Object.entries(p).map(([k, v]) => `${({ title: 'Titlu', subject: 'Subiect', author: 'Autor', keywords: 'Cuvinte cheie' } as Record<string, string>)[k] ?? k}: ${v}`);
  const first = pageFirst(page);
  const even = pageEven(page);
  const headFoot = [
    page.header.trim() && `Antet: ${page.header.trim()}`,
    page.footer.trim() && `Subsol: ${page.footer.trim()}`,
    first?.header.trim() && `Antetul primei pagini: ${first.header.trim()}`,
    first?.footer.trim() && `Subsolul primei pagini: ${first.footer.trim()}`,
    even?.header.trim() && `Antetul paginilor pare: ${even.header.trim()}`,
    even?.footer.trim() && `Subsolul paginilor pare: ${even.footer.trim()}`,
    pageWatermark(page) && `Filigran: ${pageWatermark(page)}`,
    pageWatermarkImage(page) && 'Filigran din imagine',
  ].filter(Boolean) as string[];
  return { comments: comments.size, changes, props, headFoot, images };
}

/** Pagina fără antet, subsol (și cele ale primei pagini și ale paginilor pare) și filigran. */
export function withoutHeadFoot(page: PageSetup): PageSetup {
  const { firstPage: _f, evenPage: _e, watermark: _w, watermarkColor: _c, watermarkFlat: _fl, watermarkFont: _wf, watermarkImage: _wi, ...rest } = page;
  return { ...rest, header: '', footer: '' };
}
