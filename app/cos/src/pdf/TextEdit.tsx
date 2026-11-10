// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Unealta „Editează text” din PDF: cu ea pornită, rândurile de text ale paginii se încadrează la trecerea mouse-ului;
// un clic pe un rând deschide peste el o casetă cu textul lui, la aceeași mărime. Enter schimbă textul (cel vechi se scoate
// din pagină, vezi textRemove.ts / replaceText.ts), Delete pe tot textul selectat sau caseta golită îl șterge, Esc renunță.
// Bucățile sunt cele date de pdf.js (de obicei un rând sau o parte de rând scrisă cu același font). Rândurile care fac parte
// dintr-un paragraf (paragraphs.ts) se editează împreună, într-o casetă cu mai multe rânduri: textul nou se reașază pe lățimea
// paragrafului (Shift+Enter = paragraf nou); Alt+clic editează doar rândul.
// Imaginile din pagină (pageImages.ts): clic o alege, tragerea o mută, colțurile o măresc / micșorează, ✂ o decupează (chenar cu 8 mânere, Enter / Esc), 🖼 o înlocuiește, Delete sau 🗑 o șterge.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { api } from '../api';
import { paragraphAt, paragraphsOf } from './paragraphs';
import { fontStyleOf, segBox, segOf } from './replaceText';

/** Un bloc de text de pe pagină: indicele lui la pdf.js, textul și dreptunghiul lui în puncte, de sus din stânga. */
/** Alinierea unui paragraf, în afară de stânga. */
export type ParaAlign = 'center' | 'right' | 'justify';

export interface TextBlock {
  i: number; str: string; x: number; y: number; w: number; h: number; size: number; bold?: boolean; italic?: boolean;
  /** Text orizontal pe o pagină nerotită (doar el se poate aduna în paragrafe). */
  flat?: boolean;
  /** La un paragraf: bucățile lui de text, în ordine, și pasul dintre rânduri (puncte). */
  lines?: TextBlock[]; lead?: number;
  /** Doar spații (pdf.js le pune între cuvintele depărtate ale unui rând): nu se aleg cu clic, dar leagă cuvintele în rând. */
  ws?: boolean;
  /** Alinierea paragrafului (lipsă = la stânga). */
  align?: ParaAlign;
}

/** Ce se schimbă la textul nou, față de cel vechi (lipsă = la fel): culoarea (0–1), mărimea în puncte, aldin, cursiv. */
export interface EditStyle { color?: [number, number, number]; size?: number; bold?: boolean; italic?: boolean; family?: EditFamily }
/** Fontul textului nou: fără serife, cu serife, monospațiat sau unul de pe calculator, `sys:<nume>` (lipsă = cel original, dacă se poate). */
export type EditFamily = 'sans' | 'serif' | 'mono' | `sys:${string}`;
export const EDIT_FAMILIES: [EditFamily | '', string, string][] = [['', 'Fontul original', 'inherit'], ['sans', 'Fără serife', 'Arial, "Liberation Sans", sans-serif'], ['serif', 'Cu serife', '"Times New Roman", "Liberation Serif", serif'], ['mono', 'Monospațiat', '"Courier New", "Liberation Mono", monospace']];
/** Fontul pentru caseta de editare (CSS). */
const familyCss = (f: EditFamily) => (f.startsWith('sys:') ? `"${f.slice(4)}", sans-serif` : EDIT_FAMILIES.find((x) => x[0] === f)?.[2] ?? 'inherit');
/** Fonturile calculatorului (citite o singură dată; în browser lista e goală). */
let sysFontList: Promise<string[]> | null = null;
const loadSysFonts = () => (sysFontList ??= (api.sysFonts?.() ?? Promise.resolve([])).catch(() => []));
/** Mărimile din listă (puncte). */
export const EDIT_SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];
const toHex = (c: [number, number, number]) => '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
const fromHex = (h: string): [number, number, number] => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255) as [number, number, number];

/** Blocurile de text ale unei pagini (fără cele goale), cu dreptunghiul în coordonatele vederii la mărimea 1. */
export async function pageBlocks(doc: PDFDocumentProxy, n: number): Promise<TextBlock[]> {
  const pg = await doc.getPage(n);
  const vp = pg.getViewport({ scale: 1 });
  const items = (await pg.getTextContent()).items.filter((it): it is TextItem => 'str' in it);
  const out: TextBlock[] = [];
  items.forEach((it, i) => {
    if (!it.str || (!it.str.trim() && !(it.width > 0))) return;
    const s = segOf(it, 0, it.str.length, n, true);
    const [a, b, c, d] = vp.convertToViewportRectangle(segBox(s));
    // Aldin / cursiv după numele fontului (dacă pdf.js l-a încărcat deja, la desenarea paginii).
    let st: { bold?: boolean; italic?: boolean } = {};
    try { const f = fontStyleOf((pg.commonObjs.get(it.fontName) as { name?: string })?.name ?? ''); st = { ...(f.bold ? { bold: true } : {}), ...(f.italic ? { italic: true } : {}) }; } catch { /* fontul nu e încă încărcat */ }
    const flat = vp.rotation % 360 === 0 && Math.abs(s.angle) < 0.5;
    out.push({ i, str: it.str, x: Math.min(a, c), y: Math.min(b, d), w: Math.abs(c - a), h: Math.abs(d - b), size: s.size, ...st, ...(flat ? { flat } : {}), ...(it.str.trim() ? {} : { ws: true }) });
  });
  return out;
}

/** Culorile unui rând, din pixelii paginii desenate (RGBA): fundalul = culoarea cea mai des întâlnită, textul = media
 * pixelilor cei mai depărtați de fundal (marginile netezite ale literelor au culori amestecate, așa că le lăsăm). 0–1. */
export function inkColors(px: Uint8ClampedArray): { color: [number, number, number]; bg: [number, number, number] } | null {
  const n = px.length / 4;
  if (!n) return null;
  const freq = new Map<number, number>();
  for (let i = 0; i < n; i++) { const k = ((px[i * 4] >> 3) << 10) | ((px[i * 4 + 1] >> 3) << 5) | (px[i * 4 + 2] >> 3); freq.set(k, (freq.get(k) ?? 0) + 1); }
  let bk = 0, bc = -1;
  for (const [k, c] of freq) if (c > bc) { bc = c; bk = k; }
  // Media pixelilor din căsuța de culoare cea mai deasă = fundalul exact.
  let br = 0, bgg = 0, bb = 0, bn = 0;
  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    if ((((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)) === bk) { br += r; bgg += g; bb += b; bn++; }
  }
  br /= bn; bgg /= bn; bb /= bn;
  let max = 0;
  for (let i = 0; i < n; i++) { dist[i] = Math.hypot(px[i * 4] - br, px[i * 4 + 1] - bgg, px[i * 4 + 2] - bb); if (dist[i] > max) max = dist[i]; }
  const bg: [number, number, number] = [br / 255, bgg / 255, bb / 255];
  if (max < 40) return { color: [0, 0, 0], bg };
  let r = 0, g = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) if (dist[i] >= max * 0.85) { r += px[i * 4]; g += px[i * 4 + 1]; b += px[i * 4 + 2]; c++; }
  return { color: [r / c / 255, g / c / 255, b / c / 255], bg };
}

/** Culorile rândului `b` din pânza paginii (desenată la mărimea `zoom` pe ecran). */
export function blockColors(canvas: HTMLCanvasElement | null, b: TextBlock, zoom: number) {
  if (!canvas || !canvas.width) return null;
  const k = canvas.width / (canvas.clientWidth || canvas.width);
  const x = Math.max(0, Math.floor(b.x * zoom * k)), y = Math.max(0, Math.floor(b.y * zoom * k));
  const w = Math.min(canvas.width - x, Math.ceil(b.w * zoom * k)), h = Math.min(canvas.height - y, Math.ceil(b.h * zoom * k));
  if (w < 1 || h < 1) return null;
  try { return inkColors(canvas.getContext('2d')!.getImageData(x, y, w, h).data); } catch { return null; }
}

/** Blocul aflat sub punctul (x, y) (puncte, de sus din stânga); la suprapuneri, cel mai mic. */
export function blockAt(blocks: TextBlock[], x: number, y: number): TextBlock | null {
  let best: TextBlock | null = null;
  for (const b of blocks) {
    if (b.ws) continue;
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue;
    if (!best || b.w * b.h < best.w * best.h) best = b;
  }
  return best;
}

/** O imagine de pe pagină, în puncte de sus din stânga (ca blocurile de text). */
export interface ImgBox { x: number; y: number; w: number; h: number; /** O formă desenată (linie, dreptunghi, curbă), nu o imagine. */ shape?: boolean; /** Grosimea liniei formei (puncte) și culoarea ei. */ lw?: number; color?: string }
/** Ce se face cu o imagine: mutare (puncte, în jos = pozitiv), redimensionare (dreptunghiul vechi → cel nou) sau ștergere. */
export type ImgAct = { dx: number; dy: number } | { from: ImgBox; to: ImgBox } | { crop: ImgBox } | { color: string } | { lw: number } | 'delete' | 'replace';
export type Corner = 'nw' | 'ne' | 'sw' | 'se';
const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se'];
/** Grosimile din lista formei (puncte). */
const LINE_WIDTHS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12];

/**
 * Dreptunghiul nou când tragi colțul `c` cu (dx, dy) puncte: colțul opus rămâne pe loc; fără `free` (Shift) se păstrează
 * proporțiile. Cel puțin 4 puncte pe fiecare latură.
 */
export function resizeBox(r: ImgBox, c: Corner, dx: number, dy: number, free = false): ImgBox {
  let w = r.w + (c.includes('e') ? dx : -dx), h = r.h + (c.includes('s') ? dy : -dy);
  if (!free) { const k = Math.max(w / r.w, h / r.h); w = r.w * k; h = r.h * k; }
  w = Math.max(4, w); h = Math.max(4, h);
  return { x: c.includes('w') ? r.x + r.w - w : r.x, y: c.includes('n') ? r.y + r.h - h : r.y, w, h };
}

/** Mânerele chenarului de decupare: colțurile și mijlocul laturilor. */
const CROP_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/**
 * Chenarul de decupare nou când tragi mânerul `h` (n, s, e, w sau un colț) cu (dx, dy) puncte; `h` = '' mută tot chenarul.
 * Rămâne în imaginea `lim` și are cel puțin 4 puncte pe fiecare latură.
 */
export function cropBox(r: ImgBox, h: string, dx: number, dy: number, lim: ImgBox): ImgBox {
  const L = lim.x, T = lim.y, R = lim.x + lim.w, B = lim.y + lim.h;
  if (!h) {
    const x = Math.min(R - r.w, Math.max(L, r.x + dx)), y = Math.min(B - r.h, Math.max(T, r.y + dy));
    return { x, y, w: r.w, h: r.h };
  }
  let x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
  if (h.includes('w')) x0 = Math.min(x1 - 4, Math.max(L, x0 + dx));
  if (h.includes('e')) x1 = Math.max(x0 + 4, Math.min(R, x1 + dx));
  if (h.includes('n')) y0 = Math.min(y1 - 4, Math.max(T, y0 + dy));
  if (h.includes('s')) y1 = Math.max(y0 + 4, Math.min(B, y1 + dy));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Imaginea de sub punct (cea mai mică, la suprapuneri), ca indice în listă; -1 dacă nu e niciuna. */
export function imageAt(imgs: ImgBox[], x: number, y: number): number {
  let best = -1;
  imgs.forEach((b, i) => { if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h && (best < 0 || b.w * b.h < imgs[best].w * imgs[best].h)) best = i; });
  return best;
}

interface Props {
  doc: PDFDocumentProxy;
  n: number;
  zoom: number;
  busy: boolean;
  /** Textul nou al blocului (gol = șterge blocul), cu culorile rândului citite din pagina desenată. */
  onCommit(block: TextBlock, text: string, colors: ReturnType<typeof inkColors>, style?: EditStyle): void;
  /** Imaginile paginii (se recitesc când se schimbă documentul). */
  loadImages?(n: number): Promise<ImgBox[]>;
  /** Mută, redimensionează sau șterge imaginea. */
  onImage?(index: number, act: ImgAct): void;
}

export function TextEditLayer({ doc, n, zoom, busy, onCommit, loadImages, onImage }: Props) {
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [hover, setHover] = useState<TextBlock | null>(null);
  const [edit, setEdit] = useState<TextBlock | null>(null);
  const [val, setVal] = useState('');
  // Culoarea, mărimea, aldinul și cursivul alese în bara de deasupra casetei (gol = ca textul vechi) și culoarea citită din pagină.
  const [sty, setSty] = useState<EditStyle>({});
  const [ink, setInk] = useState('#000000');
  const [sysFonts, setSysFonts] = useState<string[]>([]);
  // Ortografia textului nou (dicționarul românesc), după aceeași setare ca în Docs („Verifică ortografia”).
  const [spell, setSpell] = useState(true);
  useEffect(() => {
    let live = true;
    void loadSysFonts().then((l) => { if (live) setSysFonts(l); });
    void window.suite?.getSettings?.().then((s) => { if (live) setSpell(s.spellcheck !== false); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const inp = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [imgs, setImgs] = useState<ImgBox[]>([]);
  // Gata = rândurile și imaginile paginii sunt citite (folosit și de teste).
  const [ready, setReady] = useState(false);
  const paras = useMemo(() => paragraphsOf(blocks), [blocks]);
  const [selImg, setSelImg] = useState(-1);
  const [hoverImg, setHoverImg] = useState(-1);
  // Tragerea unei imagini: punctul de pornire și deplasarea de acum (puncte).
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [off, setOff] = useState<[number, number]>([0, 0]);
  // Săgețile mută imaginea / forma aleasă cu 1 punct (Shift: 10); apăsările la rând se adună și se aplică o singură dată.
  const nudge = useRef<{ dx: number; dy: number; t: number } | null>(null);
  const flushNudge = () => {
    const g = nudge.current;
    nudge.current = null;
    if (!g) return;
    window.clearTimeout(g.t);
    setOff([0, 0]);
    if (selImg >= 0 && (g.dx || g.dy)) onImage?.(selImg, { dx: g.dx, dy: g.dy });
  };
  // Tragerea unui colț: colțul, punctul de pornire și dreptunghiul de dinainte; `box` = dreptunghiul de acum (previzualizare).
  const resize = useRef<{ c: Corner; x: number; y: number; r: ImgBox } | null>(null);
  const [box, setBox] = useState<ImgBox | null>(null);
  // Decuparea imaginii alese: chenarul de acum (puncte) și tragerea unui mâner (sau a chenarului întreg, h = '').
  const [crop, setCrop] = useState<ImgBox | null>(null);
  const cropDrag = useRef<{ h: string; x: number; y: number; r: ImgBox } | null>(null);
  const applyCrop = () => {
    const c = crop, im = imgs[selImg];
    setCrop(null);
    if (c && im && (Math.abs(c.x - im.x) + Math.abs(c.y - im.y) + Math.abs(c.w - im.w) + Math.abs(c.h - im.h)) * zoom > 1) onImage?.(selImg, { crop: c });
  };

  useEffect(() => {
    let stop = false;
    setEdit(null);
    setReady(false);
    setSelImg(-1);
    setCrop(null);
    Promise.all([
      pageBlocks(doc, n).catch(() => [] as TextBlock[]),
      loadImages ? loadImages(n).catch(() => [] as ImgBox[]) : Promise.resolve([] as ImgBox[]),
    ]).then(([b, im]) => { if (!stop) { setBlocks(b); setImgs(im); setReady(true); } });
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, n]);
  useEffect(() => {
    if (!edit) return;
    setSty({});
    const c = blockColors(layer.current?.parentElement?.querySelector('canvas') ?? null, edit, zoom);
    setInk(c ? toHex(c.color) : '#000000');
    inp.current?.focus(); inp.current?.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);

  // offsetX/Y sunt în sistemul stratului, chiar dacă pagina e rotită în vedere (CSS); încadrările nu prind mouse-ul.
  const pt = (e: React.MouseEvent): [number, number] | null => e.target === e.currentTarget ? [e.nativeEvent.offsetX / zoom, e.nativeEvent.offsetY / zoom] : null;
  const at = (e: React.MouseEvent) => { const p = pt(e); return p ? blockAt(blocks, p[0], p[1]) : null; };
  const imgAt = (e: React.MouseEvent) => { const p = pt(e); return p ? imageAt(imgs, p[0], p[1]) : -1; };
  const commit = (text: string) => {
    if (!edit) return;
    const b = edit;
    setEdit(null);
    const styled = text && Object.keys(sty).length ? sty : undefined;
    if (text !== b.str || styled) onCommit(b, text, blockColors(layer.current?.parentElement?.querySelector('canvas') ?? null, b, zoom), styled);
  };

  return (
    <div
      ref={layer} className="pdf-textedit" data-testid="pdf-textedit" data-ready={ready ? '1' : undefined}
      tabIndex={-1}
      onMouseMove={(e) => {
        if (cropDrag.current && imgs[selImg]) { const s = cropDrag.current; setCrop(cropBox(s.r, s.h, e.clientX / zoom - s.x, e.clientY / zoom - s.y, imgs[selImg])); return; }
        if (resize.current) { const s = resize.current; setBox(resizeBox(s.r, s.c, e.clientX / zoom - s.x, e.clientY / zoom - s.y, e.shiftKey)); return; }
        if (drag.current) { setOff([e.clientX / zoom - drag.current.x, e.clientY / zoom - drag.current.y]); return; }
        if (edit) return;
        const b = at(e);
        setHover(b && !e.altKey ? paragraphAt(paras, b) ?? b : b);
        setHoverImg(b ? -1 : imgAt(e));
      }}
      onMouseLeave={() => { setHover(null); setHoverImg(-1); }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('.pdf-textedit-box, .pdf-textedit-imgbar')) return;
        e.preventDefault();
        // În timpul decupării, un clic în afara chenarului o aplică (ca la editoarele foto), dar nu alege altceva.
        if (crop) { applyCrop(); return; }
        // Locul clicului se citește înainte de focus (offsetX se socotește față de locul de acum al stratului).
        const b = at(e), k = b ? -1 : imgAt(e);
        layer.current?.focus({ preventScroll: true });
        if (edit) commit(val);
        if (b && !busy) { const t = (!e.altKey && paragraphAt(paras, b)) || b; setEdit(t); setVal(t.str); setSelImg(-1); return; }
        setSelImg(k);
        if (k >= 0 && !busy && onImage) { drag.current = { x: e.clientX / zoom, y: e.clientY / zoom }; setOff([0, 0]); }
      }}
      onMouseUp={() => {
        if (cropDrag.current) { cropDrag.current = null; return; }
        const s = resize.current;
        if (s) {
          resize.current = null;
          const to = box;
          setBox(null);
          if (to && selImg >= 0 && (Math.abs(to.w - s.r.w) + Math.abs(to.h - s.r.h)) * zoom > 2) onImage?.(selImg, { from: s.r, to });
          return;
        }
        const d = drag.current;
        drag.current = null;
        if (!d || selImg < 0) return;
        const [dx, dy] = off;
        setOff([0, 0]);
        if (Math.hypot(dx, dy) * zoom > 3) onImage?.(selImg, { dx, dy });
      }}
      onKeyDown={(e) => {
        if (crop) {
          if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); applyCrop(); }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setCrop(null); }
          return;
        }
        const arrow = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[e.key];
        if (selImg >= 0 && arrow && onImage && !busy && !drag.current && !resize.current) {
          e.preventDefault(); e.stopPropagation();
          const k = e.shiftKey ? 10 : 1, g = nudge.current ?? { dx: 0, dy: 0, t: 0 };
          window.clearTimeout(g.t);
          g.dx += arrow[0] * k; g.dy += arrow[1] * k;
          g.t = window.setTimeout(flushNudge, 450);
          nudge.current = g;
          setOff([g.dx, g.dy]);
          return;
        }
        if (selImg >= 0 && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); e.stopPropagation(); onImage?.(selImg, 'delete'); setSelImg(-1); }
        else if (selImg >= 0 && e.key === 'Escape') { e.stopPropagation(); setSelImg(-1); }
      }}
      title="Editează: dă clic pe un paragraf sau pe un rând ca să-l schimbi (Enter păstrează, Shift+Enter începe un paragraf nou, Delete îl șterge, Esc renunță; Alt+clic = doar rândul) sau pe o imagine ori o formă desenată: linie, chenar, dreptunghi (trage-o ca s-o muți, de colțuri ca s-o mărești sau micșorezi, săgețile o mută cu câte un punct, cu Shift câte 10, Delete o șterge)"
    >
      {hoverImg >= 0 && hoverImg !== selImg && imgs[hoverImg] && <div className="pdf-textedit-img" style={{ left: imgs[hoverImg].x * zoom, top: imgs[hoverImg].y * zoom, width: imgs[hoverImg].w * zoom, height: imgs[hoverImg].h * zoom }} />}
      {selImg >= 0 && imgs[selImg] && (() => { const r = box ?? { ...imgs[selImg], x: imgs[selImg].x + off[0], y: imgs[selImg].y + off[1] }; return (
        <div className={'pdf-textedit-img sel' + (imgs[selImg].shape ? ' shape' : '')} data-testid="pdf-textedit-img" style={{ left: r.x * zoom, top: r.y * zoom, width: r.w * zoom, height: r.h * zoom }}>
          {onImage && !busy && !crop && CORNERS.map((c) => (
            <span key={c} className={`pdf-textedit-handle ${c}`} data-corner={c}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); layer.current?.focus({ preventScroll: true }); resize.current = { c, x: e.clientX / zoom, y: e.clientY / zoom, r: imgs[selImg] }; setBox(imgs[selImg]); }}
              title="Trage colțul ca să mărești sau să micșorezi imaginea (cu Shift, fără să păstrezi proporțiile)" />
          ))}
          {crop && (<div className="pdf-textedit-cropwrap">
            <div className="pdf-textedit-crop" data-testid="pdf-textedit-crop"
              style={{ left: (crop.x - r.x) * zoom, top: (crop.y - r.y) * zoom, width: crop.w * zoom, height: crop.h * zoom }}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); cropDrag.current = { h: (e.target as HTMLElement).dataset.h ?? '', x: e.clientX / zoom, y: e.clientY / zoom, r: crop }; }}
              title="Trage mânerele ca să alegi partea păstrată (sau chenarul, ca să-l muți); Enter decupează, Esc renunță">
              {CROP_HANDLES.map((h) => <span key={h} className={`pdf-textedit-chandle ${h}`} data-h={h} />)}
            </div>
          </div>)}
          <span className="pdf-textedit-imgbar">
          {crop ? (<>
          <button className="pdf-textedit-cropok" data-testid="pdf-textedit-cropok" onMouseDown={(e) => e.stopPropagation()} onClick={applyCrop} title="Decupează imaginea la chenar (Enter)" aria-label="Decupează">✓</button>
          <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setCrop(null)} title="Renunță la decupare (Esc)" aria-label="Renunță la decupare">✕</button>
          </>) : imgs[selImg].shape ? (<>
          <label className="pdf-textedit-imgcolor" data-testid="pdf-textedit-shapecolor" onMouseDown={(e) => e.stopPropagation()} title="Altă culoare pentru formă (umplerea și linia ei)" aria-label="Culoarea formei">🎨
            <input type="color" key={selImg} defaultValue={imgs[selImg].color ?? '#000000'} ref={(el) => { if (el) el.onchange = () => onImage?.(selImg, { color: el.value }); }} />
          </label>
          {imgs[selImg].lw !== undefined && (
            <select className="pdf-textedit-shapelw" data-testid="pdf-textedit-shapelw" key={'w' + selImg} value={String(LINE_WIDTHS.reduce((a, b) => (Math.abs(b - imgs[selImg].lw!) < Math.abs(a - imgs[selImg].lw!) ? b : a)))}
              onMouseDown={(e) => e.stopPropagation()} onChange={(e) => onImage?.(selImg, { lw: +e.target.value })} title="Grosimea liniei formei" aria-label="Grosimea liniei">
              {LINE_WIDTHS.map((w) => <option key={w} value={w}>{String(w).replace('.', ',')} pt</option>)}
            </select>
          )}
          <button className="pdf-textedit-imgdel" onMouseDown={(e) => e.stopPropagation()} onClick={() => { onImage?.(selImg, 'delete'); setSelImg(-1); }} title="Șterge forma din pagină (Delete)" aria-label="Șterge forma">🗑</button>
          </>) : (<>
          <button className="pdf-textedit-imgcrop" data-testid="pdf-textedit-imgcrop" onMouseDown={(e) => e.stopPropagation()} onClick={() => { setCrop({ ...imgs[selImg] }); layer.current?.focus({ preventScroll: true }); }} title="Decupează imaginea: trage mânerele chenarului, apoi Enter" aria-label="Decupează imaginea">✂</button>
          <button className="pdf-textedit-imgrep" data-testid="pdf-textedit-imgrep" onMouseDown={(e) => e.stopPropagation()} onClick={() => onImage?.(selImg, 'replace')} title="Înlocuiește imaginea cu alta de pe calculator (JPG, PNG…), în același loc" aria-label="Înlocuiește imaginea">🖼</button>
          <button className="pdf-textedit-imgdel" onMouseDown={(e) => e.stopPropagation()} onClick={() => { onImage?.(selImg, 'delete'); setSelImg(-1); }} title="Șterge imaginea din pagină (Delete)" aria-label="Șterge imaginea">🗑</button>
          </>)}
          </span>
        </div>
      ); })()}
      {hover && !edit && <div className="pdf-textedit-hover" style={{ left: hover.x * zoom, top: hover.y * zoom, width: hover.w * zoom, height: hover.h * zoom }} />}
      {edit && (
        <div className={'pdf-textedit-box' + (edit.lines ? ' para' : '')} style={{ left: edit.x * zoom, top: edit.y * zoom, minWidth: edit.w * zoom, height: edit.lines ? undefined : edit.h * zoom }}>
          {edit.lines ? (
          <textarea
            ref={inp} value={val} aria-label="Textul paragrafului" data-testid="pdf-textedit-input" data-para="1" spellCheck={spell} lang="ro"
            style={{ fontSize: (sty.size ?? edit.size) * zoom * 0.9, lineHeight: (edit.lead ?? edit.size * 1.2) * ((sty.size ?? edit.size) / edit.size) * zoom + 'px', color: sty.color ? toHex(sty.color) : ink, fontWeight: sty.bold ?? edit.bold ? 700 : 400, fontStyle: sty.italic ?? edit.italic ? 'italic' : 'normal', ...(sty.family ? { fontFamily: familyCss(sty.family) } : {}), textAlign: edit.align ?? 'left', width: edit.w * zoom + 8, minHeight: edit.h * zoom + 6, height: Math.max(edit.h * zoom + 6, Math.ceil(val.length / Math.max(1, edit.str.length) * edit.h * zoom) + 6) }}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              const el = e.currentTarget;
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(val); }
              else if (e.key === 'Escape') { e.preventDefault(); setEdit(null); }
              else if (e.key === 'Delete' && el.selectionStart === 0 && el.selectionEnd === val.length) { e.preventDefault(); commit(''); }
            }}
          />
          ) : (
          <input
            ref={inp} value={val} aria-label="Textul rândului" data-testid="pdf-textedit-input" spellCheck={spell} lang="ro"
            style={{ fontSize: (sty.size ?? edit.size) * zoom * 0.9, color: sty.color ? toHex(sty.color) : ink, fontWeight: sty.bold ?? edit.bold ? 700 : 400, fontStyle: sty.italic ?? edit.italic ? 'italic' : 'normal', ...(sty.family ? { fontFamily: familyCss(sty.family) } : {}), height: edit.h * zoom, width: Math.max(edit.w * zoom, (val.length + 2) * edit.size * zoom * 0.5) }}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              const el = e.currentTarget;
              if (e.key === 'Enter') { e.preventDefault(); commit(val); }
              else if (e.key === 'Escape') { e.preventDefault(); setEdit(null); }
              else if (e.key === 'Delete' && el.selectionStart === 0 && el.selectionEnd === val.length) { e.preventDefault(); commit(''); }
            }}
          />
          )}
          <div className="pdf-textedit-fmt" role="toolbar" aria-label="Formatul textului nou">
            <input type="color" value={sty.color ? toHex(sty.color) : ink} aria-label="Culoarea textului" title="Culoarea textului nou (la început, cea a textului vechi)"
              onChange={(e) => setSty((x) => ({ ...x, color: fromHex(e.target.value) }))} />
            <select value={sty.family ?? ''} aria-label="Fontul textului" title="Fontul textului nou: cel original (dacă are literele) sau unul standard"
              onChange={(e) => { const v = e.target.value as EditFamily | ''; setSty(({ family: _f, ...x }) => (v ? { ...x, family: v } : x)); }}>
              {EDIT_FAMILIES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              {!!sysFonts.length && (
                <optgroup label="Fonturile calculatorului">
                  {sysFonts.map((n) => <option key={n} value={`sys:${n}`} style={{ fontFamily: `"${n}"` }}>{n}</option>)}
                </optgroup>
              )}
            </select>
            <select value={String(sty.size ?? Math.round(edit.size))} aria-label="Mărimea textului" title="Mărimea textului nou, în puncte"
              onChange={(e) => setSty((x) => ({ ...x, size: Number(e.target.value) }))}>
              {[...new Set([...EDIT_SIZES, Math.round(edit.size)])].sort((a, b) => a - b).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <button className={sty.bold ?? edit.bold ? 'on' : ''} aria-pressed={!!(sty.bold ?? edit.bold)} onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSty((x) => ({ ...x, bold: !(x.bold ?? edit.bold) }))} title="Aldin (textul nou)" aria-label="Aldin"><b>B</b></button>
            <button className={sty.italic ?? edit.italic ? 'on' : ''} aria-pressed={!!(sty.italic ?? edit.italic)} onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSty((x) => ({ ...x, italic: !(x.italic ?? edit.italic) }))} title="Cursiv (textul nou)" aria-label="Cursiv"><i>I</i></button>
          </div>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => commit(val)} title="Păstrează textul nou (Enter)">✓</button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => commit('')} title={edit.lines ? 'Șterge paragraful din pagină (Delete)' : 'Șterge rândul din pagină (Delete)'} aria-label={edit.lines ? 'Șterge paragraful' : 'Șterge rândul'}>🗑</button>
        </div>
      )}
    </div>
  );
}
