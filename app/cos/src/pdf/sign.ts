// @ts-nocheck
// Din Cyber Office Studio (src/pdf/sign.ts, D-071, D-078), neschimbat.
// „Completează și semnează” (Fill & Sign): text, dată, bifă și semnătură puse oriunde pe pagină.
// Cât lucrezi, sunt elemente HTML peste pagină; la salvare fiecare devine o imagine PNG desenată în PDF cu pdf-lib.
// Imaginea păstrează diacriticele (ș, ț) fără să includem un font în PDF.
import { degrees, PDFArray, PDFDocument, PDFHexString, PDFName, PDFNull, PDFPage, PDFRef, PDFSignature, PDFString, rgb } from 'pdf-lib';
import { open } from './edit';
import { formatNum } from './calc';
import { addStampAnnot } from './stampAnnot';
import { addBarcodeField, barcodeFields } from './barcodeField';

export type MarkKind = 'text' | 'check' | 'cross' | 'sign' | 'stamp' | 'highlight' | 'note' | 'draw' | 'redact' | 'crop'
  | 'underline' | 'strike' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'image' | 'link' | 'polyline' | 'polygon' | 'cloud' | 'field' | 'callout'
  | 'caret' | 'replace' | 'fileatt';

/** Elementele care se trag ca un dreptunghi și se măresc liber (în lățime și în înălțime). */
export const RECT_KINDS: MarkKind[] = ['highlight', 'redact', 'crop', 'underline', 'strike', 'rect', 'ellipse', 'link', 'field', 'replace'];
/** Culoarea semnului de inserare (‸) la „Inserare text” și „Înlocuire text”. */
export const CARET_COLOR = '#1565c0';
/** Mărimea semnului de inserare pus cu un click (puncte). */
export const CARET_W = 10, CARET_H = 12;
/** Mărimea agrafei unui fișier atașat ca comentariu (puncte). */
export const CLIP_W = 12, CLIP_H = 20;
/** Culoarea agrafei (gri-albăstrui, ca o agrafă de metal). */
export const CLIP_COLOR = '#455a64';
/** Liniile trase de la un punct la altul. */
export const LINE_KINDS: MarkKind[] = ['line', 'arrow'];
/** Formele din mai multe puncte: click pentru fiecare colț, dublu-click încheie. */
export const POLY_KINDS: MarkKind[] = ['polyline', 'polygon', 'cloud'];
/** Grosimea liniei la forme (dreptunghi, elipsă, linie, săgeată), subliniere și tăiere (puncte). */
export const SHAPE_WIDTH = 2;
/** Culoarea tăierii (roșu, ca în Acrobat). */
export const STRIKE_COLOR = '#c62828';
/** Mărimea vârfului săgeții (puncte). */
export const ARROW_HEAD = 9;

/** Notele: litere de 10 puncte, rânduri de 13, margine de 4. */
export const NOTE_FONT = 10, NOTE_LINE = 13, NOTE_PAD = 4;

/** Împarte textul unei note pe rânduri care încap în lățimea dată (Enter începe rând nou). */
export type FieldType = 'check' | 'list' | 'date' | 'radio' | 'sum' | 'sig' | 'button' | 'barcode';

/** Ce face butonul de formular: golește formularul, tipărește, deschide o adresă web sau duce la o pagină. */
export type ButtonAction = { kind: 'reset' } | { kind: 'print' } | { kind: 'url'; url: string } | { kind: 'page'; page: number };
/** Acțiunea butonului, din câmpul `opts` („reset”, „print”, „url:adresa”, „page:3”); fără ea, golește formularul. */
export function buttonAction(opts: string | undefined): ButtonAction {
  const o = (opts ?? '').trim();
  if (o === 'print') return { kind: 'print' };
  if (o.startsWith('url:')) return { kind: 'url', url: o.slice(4).trim() };
  if (o.startsWith('page:')) return { kind: 'page', page: Math.max(1, parseInt(o.slice(5), 10) || 1) };
  return { kind: 'reset' };
}
export function buttonOpts(a: ButtonAction): string {
  return a.kind === 'url' ? 'url:' + a.url : a.kind === 'page' ? 'page:' + a.page : a.kind;
}
/** Adresa web cu https:// în față, dacă lipsește (un e-mail devine mailto:). */
export function normalUrl(u: string): string {
  const t = u.trim();
  if (!t) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return 'mailto:' + t;
  return 'https://' + t;
}
/** Textul obișnuit de pe buton, după acțiune. */
export function buttonCaption(m: Pick<Mark, 'text' | 'opts'>): string {
  const t = m.text?.trim();
  if (t) return t;
  const a = buttonAction(m.opts);
  return a.kind === 'print' ? 'Tipărește' : a.kind === 'url' ? 'Deschide' : a.kind === 'page' ? `Mergi la pagina ${a.page}` : 'Golește formularul';
}
/** Desenul butonului (chenar rotunjit, fundal albastru deschis, textul în mijloc), pe ecran și ca aspect în PDF. */
export function drawButton(ctx: CanvasRenderingContext2D, w: number, h: number, caption: string, k: number) {
  const r = Math.min(4 * k, h / 3, w / 3);
  ctx.beginPath();
  ctx.roundRect(k / 2, k / 2, w - k, h - k, r);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#e8f0fe'); g.addColorStop(1, '#c5d7f5');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = k;
  ctx.strokeStyle = '#5c7bb3';
  ctx.stroke();
  let size = Math.min(12 * k, h * 0.55);
  ctx.font = `bold ${size}px ${MARK_FONT}`;
  const tw = ctx.measureText(caption).width;
  if (tw > w * 0.9) { size *= (w * 0.9) / tw; ctx.font = `bold ${size}px ${MARK_FONT}`; }
  ctx.fillStyle = '#1a237e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(caption, w / 2, h / 2 + size * 0.05);
  ctx.textAlign = 'start';
}

/** Opțiunile listei sau ale butoanelor radio, din textul cu virgule (fără dubluri; „Da, Nu” dacă e gol). */
export function fieldOptions(m: Pick<Mark, 'opts'>): string[] {
  const opts = [...new Set((m.opts ?? '').split(/[,;\n]+/).map((o) => o.trim()).filter(Boolean))];
  return opts.length ? opts : ['Da', 'Nu'];
}

/**
 * Butoanele radio: câte unul pentru fiecare opțiune, unul lângă altul în dreptunghiul tras, fiecare cu eticheta lui în dreapta
 * (eticheta e un text pus pe pagină, ca elementele „T Text”).
 */
export function radioLayout(m: Mark): { opt: string; x: number; y: number; s: number; label: Mark }[] {
  const opts = fieldOptions(m);
  const slot = m.w / opts.length;
  const s = Math.max(6, Math.min(m.h, slot / 2, 16));
  const size = Math.max(6, Math.min(12, Math.round(m.h * 0.6)));
  return opts.map((opt, i) => {
    const x = m.x + i * slot, y = m.y + (m.h - s) / 2;
    const label: Mark = { id: m.id * 1000 + i + 1, page: m.page, kind: 'text', x: x + s + 3, y: m.y + (m.h - size * 1.3) / 2, w: Math.max(4, slot - s - 4), h: size * 1.3, text: opt, size, color: '#222222' };
    return { opt, x, y, s, label };
  });
}
/** Formatul câmpurilor de dată (ca AFDate_FormatEx din programele de PDF). */
export const DATE_FORMAT = 'dd.mm.yyyy';
/** Formatul totalurilor: două zecimale, cu punct la mii și virgulă zecimală (1.234,56), ca la noi. */
export const SUM_FORMAT = 'AFNumber_Format(2, 2, 0, 0, "", false);';

/** Numele câmpurilor adunate de un total, din textul cu virgule (punctele devin spații, ca la numele câmpurilor noi). */
export function sumFields(m: Pick<Mark, 'opts'>): string[] {
  return [...new Set((m.opts ?? '').split(/[,;\n]+/).map((o) => o.replace(/\./g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean))];
}

export function wrapLines(text: string, width: number, ctx?: CanvasRenderingContext2D, size = NOTE_FONT): string[] {
  measurer ??= document.createElement('canvas').getContext('2d')!;
  const c = ctx ?? measurer;
  if (!ctx) c.font = `${size}px ${MARK_FONT}`;
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && c.measureText(next).width > width) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  return out;
}

/** Înălțimea unei note cu textul și lățimea date (puncte). */
export function noteHeight(text: string, w: number): number {
  return Math.max(1, wrapLines(text, w - 2 * NOTE_PAD).length) * NOTE_LINE + 2 * NOTE_PAD;
}

/** Ștampilele gata făcute (Top 10 PDF: „PLĂTIT” / „PRIMIT”). */
export const STAMPS = ['PLĂTIT', 'PRIMIT', 'APROBAT', 'RESPINS', 'COPIE', 'CONFIDENȚIAL'];
export const STAMP_RED = '#c62828';
/** Culorile unei ștampile (se schimbă și după ce e pusă). */
export const STAMP_COLORS: [string, string][] = [['#c62828', 'Roșu'], ['#1a237e', 'Albastru'], ['#2e7d32', 'Verde'], ['#000000', 'Negru']];

/** Mărimea unei ștampile cu eticheta dată și rândul de sub ea (puncte): lățimea după textul cel mai lung. */
export function stampSize(label: string, sub = today()): { w: number; h: number } {
  measurer ??= document.createElement('canvas').getContext('2d')!;
  measurer.font = `bold 20px ${MARK_FONT}`;
  const top = measurer.measureText(label).width;
  measurer.font = `10px ${MARK_FONT}`;
  return { w: Math.max(110, Math.ceil(Math.max(top, measurer.measureText(sub).width)) + 28), h: 50 };
}

/** Rândul de sub ștampilă (ca ștampilele dinamice din Acrobat): data, la cerere ora și numele, fixate când se pune ștampila. */
export function stampLine(d: Date, opts: { time?: boolean; name?: string }): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const date = `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}` + (opts.time ? ` ${p(d.getHours())}:${p(d.getMinutes())}` : '');
  return opts.name?.trim() ? `${opts.name.trim()} · ${date}` : date;
}

export interface Mark {
  id: number;
  /** Pagina, de la 1. */
  page: number;
  /** Colțul din stânga-sus și mărimea, în puncte PDF, pe pagina așa cum se vede (cu rotirea ei), la 100%. */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: MarkKind;
  /** Textul (pentru text, dată și eticheta ștampilei; la legătură, adresa web sau numărul paginii). */
  text?: string;
  /** Mărimea literelor, în puncte. */
  size?: number;
  /** Culoarea aleasă (textul, bifa, desenul, formele); fără ea, culoarea obișnuită a elementului. */
  color?: string;
  /** Textul aldin / cursiv. */
  bold?: boolean;
  italic?: boolean;
  /** Grosimea liniei față de cea obișnuită (0,5 = subțire, 2 = groasă) și cât de opac e elementul (0–1). */
  thick?: number;
  opacity?: number;
  /** Semnătura desenată sau imaginea pusă pe pagină, ca data URL. */
  img?: string;
  /** Desenul liber: punctele liniei (x, y, x, y…), ca fracțiuni din lățimea și înălțimea elementului (0–1). */
  pts?: number[];
  /** Câmpul de formular nou: bifă, listă derulantă sau dată (fără: text) și, la listă, opțiunile despărțite prin virgulă. */
  ftype?: FieldType;
  opts?: string;
  /** Ștampila: rândul de sub etichetă (data, ora, numele), fixat la punere; fără el, data de azi. */
  sub?: string;
  /** Fișierul atașat ca comentariu (📎): numele și conținutul lui. */
  fname?: string;
  fdata?: Uint8Array;
}

/** Grosimea liniei la desenul liber (puncte) și marginea din jurul ei. */
export const DRAW_WIDTH = 2, DRAW_PAD = 2;

/** Desenul liber, din punctele trase pe pagină (puncte), devine un element: chenarul liniei + punctele în el. */
export function drawMark(points: number[], pad = DRAW_PAD): { x: number; y: number; w: number; h: number; pts: number[] } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    x0 = Math.min(x0, points[i]); x1 = Math.max(x1, points[i]);
    y0 = Math.min(y0, points[i + 1]); y1 = Math.max(y1, points[i + 1]);
  }
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const w = x1 - x0, h = y1 - y0;
  const pts = points.map((v, i) => Math.round((i % 2 ? (v - y0) / h : (v - x0) / w) * 10000) / 10000);
  return { x: x0, y: y0, w, h, pts };
}

export const MARK_FONT = 'Arial, "Segoe UI", sans-serif';
export const MARK_COLOR = '#1a237e';

/** Culorile din bara Semnează… (ca la pixurile de birou). */
export const MARK_COLORS: [string, string][] = [['#1a237e', 'Albastru'], ['#000000', 'Negru'], ['#c62828', 'Roșu'], ['#2e7d32', 'Verde']];
/** Elementele care își pot schimba culoarea. */
export const COLOR_KINDS: MarkKind[] = ['text', 'check', 'cross', 'draw', 'underline', 'strike', 'rect', 'ellipse', 'line', 'arrow', 'polyline', 'polygon', 'cloud'];
/** „bold italic ” pentru fontul de pe pânză (gol pentru textul obișnuit). */
export const textStyle = (m: { bold?: boolean; italic?: boolean }) => `${m.italic ? 'italic ' : ''}${m.bold ? 'bold ' : ''}`;

let measurer: CanvasRenderingContext2D | null = null;
/** Lățimea și înălțimea unui text de mărimea dată (puncte), cu o mică margine. */
export function measureText(text: string, size: number, style = ''): { w: number; h: number } {
  measurer ??= document.createElement('canvas').getContext('2d')!;
  measurer.font = `${style}${size}px ${MARK_FONT}`;
  return { w: Math.max(size, Math.ceil(measurer.measureText(text || ' ').width) + 4), h: Math.ceil(size * 1.3) };
}

/** Data de azi ca zz.ll.aaaa. */
export function today(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/** Desenează bifa (✓) sau X-ul ca linii, ca să arate la fel pe orice calculator. */
function drawTick(ctx: CanvasRenderingContext2D, kind: 'check' | 'cross', w: number, h: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, w * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'check') {
    ctx.moveTo(w * 0.15, h * 0.55);
    ctx.lineTo(w * 0.4, h * 0.8);
    ctx.lineTo(w * 0.85, h * 0.2);
  } else {
    ctx.moveTo(w * 0.2, h * 0.2);
    ctx.lineTo(w * 0.8, h * 0.8);
    ctx.moveTo(w * 0.8, h * 0.2);
    ctx.lineTo(w * 0.2, h * 0.8);
  }
  ctx.stroke();
}

/** Semnul de inserare (‸): un „acoperiș” albastru plin, cu vârful sus, în dreptunghiul dat. */
function drawCaret(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = CARET_COLOR;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w * 0.78, y + h);
  ctx.lineTo(x + w / 2, y + h * 0.42);
  ctx.lineTo(x + w * 0.22, y + h);
  ctx.closePath();
  ctx.fill();
}

/** Desenul unui element pentru ecran (pânza dată) sau pentru PDF (de 4 ori mai fin decât un punct). */
export async function paintMark(m: Mark, canvas: HTMLCanvasElement, scale: number) {
  canvas.width = Math.max(1, Math.round(m.w * scale));
  canvas.height = Math.max(1, Math.round(m.h * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Transparența aleasă (la text, bife, desen și forme); ștampilele, notele și imaginile rămân pline.
  ctx.globalAlpha = COLOR_KINDS.includes(m.kind) || m.kind === 'stamp' ? m.opacity ?? 1 : 1;
  if (m.kind === 'text') {
    ctx.fillStyle = m.color ?? MARK_COLOR;
    ctx.font = `${textStyle(m)}${(m.size ?? 12) * scale}px ${MARK_FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(m.text ?? '', 2 * scale, canvas.height / 2);
  } else if ((m.kind === 'sign' || m.kind === 'image' || m.kind === 'stamp') && m.img) {
    // Și ștampilele mele (din imagine) se desenează ca imaginea lor.
    const img = new Image();
    img.src = m.img;
    await img.decode();
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } else if (m.kind === 'check' || m.kind === 'cross') {
    drawTick(ctx, m.kind, canvas.width, canvas.height, m.color ?? MARK_COLOR);
  } else if (m.kind === 'stamp') {
    // Chenar roșu cu colțuri rotunjite, eticheta mare și data de sub ea, ca o ștampilă de birou.
    const k = canvas.width / m.w;
    const lw = 2.5 * k;
    ctx.strokeStyle = ctx.fillStyle = m.color ?? STAMP_RED;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.roundRect(lw, lw, canvas.width - 2 * lw, canvas.height - 2 * lw, 6 * k);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${20 * (canvas.height / 50)}px ${MARK_FONT}`;
    ctx.fillText(m.text ?? '', canvas.width / 2, canvas.height * 0.4);
    ctx.font = `${10 * (canvas.height / 50)}px ${MARK_FONT}`;
    ctx.fillText(m.sub ?? today(), canvas.width / 2, canvas.height * 0.77);
  } else if (m.kind === 'highlight') {
    ctx.fillStyle = 'rgba(255, 221, 0, 0.38)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (m.kind === 'underline' || m.kind === 'strike') {
    // Linia de sub text (subliniere) sau prin mijlocul lui (tăiere), pe toată lățimea trasă.
    const k = canvas.width / m.w, lw = SHAPE_WIDTH * (m.thick ?? 1) * k * (m.kind === 'strike' ? 0.75 : 1);
    ctx.fillStyle = m.color ?? (m.kind === 'strike' ? STRIKE_COLOR : MARK_COLOR);
    ctx.fillRect(0, m.kind === 'strike' ? (canvas.height - lw) / 2 : canvas.height - lw, canvas.width, lw);
  } else if (m.kind === 'fileatt') {
    // Agrafa (📎) desenată din linii, ca să arate la fel peste tot.
    const k = canvas.width / m.w, W = canvas.width, H = canvas.height;
    ctx.strokeStyle = CLIP_COLOR;
    ctx.lineWidth = 1.6 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(W * 0.62, H * 0.3);
    ctx.lineTo(W * 0.62, H * 0.72);
    ctx.arc(W * 0.47, H * 0.72, W * 0.15, 0, Math.PI);
    ctx.lineTo(W * 0.32, H * 0.2);
    ctx.arc(W * 0.52, H * 0.2, W * 0.2, Math.PI, 0);
    ctx.lineTo(W * 0.72, H * 0.8);
    ctx.arc(W * 0.47, H * 0.8, W * 0.25, 0, Math.PI);
    ctx.lineTo(W * 0.22, H * 0.35);
    ctx.stroke();
  } else if (m.kind === 'caret') {
    drawCaret(ctx, 0, 0, canvas.width, canvas.height);
  } else if (m.kind === 'replace') {
    // Înlocuire text: textul vechi tăiat cu roșu, iar la capătul lui semnul ‸ unde vine textul nou.
    const k = canvas.width / m.w, lw = SHAPE_WIDTH * 0.75 * k;
    ctx.fillStyle = STRIKE_COLOR;
    ctx.fillRect(0, (canvas.height - lw) / 2, canvas.width, lw);
    const cw = Math.min(canvas.width, CARET_W * k * 0.8), ch = Math.min(canvas.height, CARET_H * k * 0.6);
    drawCaret(ctx, canvas.width - cw, canvas.height - ch, cw, ch);
  } else if (m.kind === 'rect' || m.kind === 'ellipse') {
    // Contur fără umplere, la aceeași grosime oricât de mare e forma.
    const k = canvas.width / m.w, lw = SHAPE_WIDTH * (m.thick ?? 1) * k;
    ctx.strokeStyle = m.color ?? MARK_COLOR;
    ctx.lineWidth = lw;
    ctx.beginPath();
    if (m.kind === 'rect') ctx.rect(lw / 2, lw / 2, canvas.width - lw, canvas.height - lw);
    else ctx.ellipse(canvas.width / 2, canvas.height / 2, Math.max(0.5, (canvas.width - lw) / 2), Math.max(0.5, (canvas.height - lw) / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if ((m.kind === 'line' || m.kind === 'arrow') && m.pts && m.pts.length >= 4) {
    const k = canvas.width / m.w;
    const ax = m.pts[0] * canvas.width, ay = m.pts[1] * canvas.height, bx = m.pts[2] * canvas.width, by = m.pts[3] * canvas.height;
    ctx.strokeStyle = ctx.fillStyle = m.color ?? MARK_COLOR;
    ctx.lineWidth = SHAPE_WIDTH * (m.thick ?? 1) * k;
    ctx.lineCap = 'round';
    const a = Math.atan2(by - ay, bx - ax), head = ARROW_HEAD * k;
    // La săgeată linia se oprește la baza vârfului, ca vârful să rămână ascuțit.
    const ex = m.kind === 'arrow' ? bx - Math.cos(a) * head * 0.8 : bx, ey = m.kind === 'arrow' ? by - Math.sin(a) * head * 0.8 : by;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (m.kind === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - Math.cos(a - 0.45) * head, by - Math.sin(a - 0.45) * head);
      ctx.lineTo(bx - Math.cos(a + 0.45) * head, by - Math.sin(a + 0.45) * head);
      ctx.closePath();
      ctx.fill();
    }
  } else if (m.kind === 'link') {
    // Doar pe ecran: zona pe care se dă click (în PDF devine o legătură adevărată, nevăzută, vezi addLink).
    const k = canvas.width / m.w;
    ctx.fillStyle = m.text?.trim() ? 'rgba(25, 118, 210, 0.12)' : 'rgba(198, 40, 40, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = m.text?.trim() ? '#1976d2' : '#c62828';
    ctx.lineWidth = k;
    ctx.setLineDash([4 * k, 3 * k]);
    ctx.strokeRect(k / 2, k / 2, canvas.width - k, canvas.height - k);
  } else if (m.kind === 'field') {
    // Pe ecran: căsuța viitorului câmp, cu numele lui; la salvare devine un câmp de formular adevărat (vezi addField).
    const k = canvas.width / m.w;
    ctx.fillStyle = 'rgba(25, 118, 210, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#5c7bb3';
    ctx.lineWidth = k;
    ctx.strokeRect(k / 2, k / 2, canvas.width - k, canvas.height - k);
    const size = Math.min(9, m.h * 0.6) * k;
    ctx.fillStyle = '#5c7bb3';
    ctx.font = `${size}px ${MARK_FONT}`;
    ctx.textBaseline = 'middle';
    if (m.ftype === 'button') { drawButton(ctx, canvas.width, canvas.height, buttonCaption(m), k); return; }
    if (m.ftype === 'barcode') {
      // Pe ecran: un pătrat cu un model de cod QR și numele; codul adevărat se face la salvare, din datele formularului.
      const s = Math.min(canvas.width, canvas.height), c = s / 7;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#5c7bb3';
      for (const [x, y] of [[0, 0], [4, 0], [0, 4]]) {
        ctx.fillRect(x * c + c / 2, y * c + c / 2, 2.5 * c, 2.5 * c);
        ctx.clearRect(x * c + c, y * c + c, 1.5 * c, 1.5 * c);
        ctx.fillRect(x * c + 1.25 * c, y * c + 1.25 * c, c, c);
      }
      ctx.fillRect(4.5 * c, 4.5 * c, c, c); ctx.fillRect(5.5 * c, 5.5 * c, c / 2, c / 2);
      ctx.strokeRect(k / 2, k / 2, s - k, s - k);
      if (canvas.width > s + 20 * k) ctx.fillText(`▣ ${m.text?.trim() || 'Cod de bare'}`, s + 3 * k, canvas.height / 2, canvas.width - s - 6 * k);
      return;
    }
    const label = m.text?.trim() || (m.ftype === 'check' ? 'Bifă' : m.ftype === 'list' ? 'Listă' : m.ftype === 'date' ? 'zz.ll.aaaa' : m.ftype === 'sum' ? 'Total' : m.ftype === 'sig' ? 'Semnătură' : 'Câmp');
    if (m.ftype === 'radio') {
      // Butoanele radio: cercurile și opțiunile, cum vor sta în PDF.
      for (const b of radioLayout(m)) {
        const cx = (b.x - m.x + b.s / 2) * k, cy = canvas.height / 2, r = (b.s / 2) * k;
        ctx.lineWidth = k;
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(k, r - k / 2), 0, Math.PI * 2); ctx.stroke();
        ctx.fillText(b.opt, (b.label.x - m.x) * k, cy, b.label.w * k);
      }
      return;
    }
    ctx.fillText(`${m.ftype === 'check' ? '☐ ' : m.ftype === 'list' ? '▾ ' : m.ftype === 'date' ? '📅 ' : m.ftype === 'sum' ? 'Σ ' : m.ftype === 'sig' ? '✍ ' : ''}${label}`, 3 * k, m.h >= 36 ? size : canvas.height / 2, canvas.width - 6 * k);
  } else if (m.kind === 'crop') {
    // Pe ecran: chenar albastru punctat; la salvare pagina se taie la el (vezi redact.ts).
    const k = canvas.width / m.w;
    ctx.fillStyle = 'rgba(25, 118, 210, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1976d2';
    ctx.lineWidth = 1.5 * k;
    ctx.setLineDash([6 * k, 4 * k]);
    ctx.strokeRect(k, k, canvas.width - 2 * k, canvas.height - 2 * k);
  } else if (m.kind === 'redact') {
    // Pe ecran: culoarea aleasă ușor transparentă, ca să vezi ce acoperi; în PDF devine plină (vezi redact.ts).
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = m.color ?? REDACT_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    paintRedactLabel(ctx, m.text, 0, 0, canvas.width, canvas.height, m.color ?? REDACT_COLOR);
  } else if (POLY_KINDS.includes(m.kind) && m.pts && m.pts.length >= 4) {
    // Polilinia (deschisă), poligonul (închis) și norul (poligon cu marginea din arcuri mici, ca în Acrobat).
    const k = canvas.width / m.w;
    const p: number[] = m.pts.map((v, i) => v * (i % 2 ? canvas.height : canvas.width));
    ctx.strokeStyle = m.color ?? MARK_COLOR;
    ctx.lineWidth = SHAPE_WIDTH * (m.thick ?? 1) * k;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    if (m.kind === 'cloud') {
      // Arcurile ies în afară: sensul lor depinde de sensul în care au fost puse colțurile.
      let area = 0;
      for (let i = 0; i < p.length; i += 2) { const j = (i + 2) % p.length; area += p[i] * p[j + 1] - p[j] * p[i + 1]; }
      const out = area > 0 ? 1 : -1;
      for (let i = 0; i < p.length; i += 2) {
        const j = (i + 2) % p.length;
        const ax = p[i], ay = p[i + 1], dx = p[j] - ax, dy = p[j + 1] - ay, len = Math.hypot(dx, dy);
        const n = Math.max(1, Math.round(len / (9 * k)));
        for (let s = 0; s < n; s++) {
          const sx = ax + (dx * s) / n, sy = ay + (dy * s) / n, ex = ax + (dx * (s + 1)) / n, ey = ay + (dy * (s + 1)) / n;
          const seg = len / n;
          ctx.quadraticCurveTo((sx + ex) / 2 + (out * dy / len) * seg * 0.6, (sy + ey) / 2 - (out * dx / len) * seg * 0.6, ex, ey);
        }
      }
    } else {
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
      if (m.kind === 'polygon') ctx.closePath();
    }
    ctx.stroke();
  } else if (m.kind === 'draw' && m.pts && m.pts.length >= 2) {
    // Linia trasă cu mouse-ul, la aceeași grosime oricât de mare e elementul.
    const k = canvas.width / m.w;
    ctx.strokeStyle = m.color ?? MARK_COLOR;
    ctx.lineWidth = DRAW_WIDTH * (m.thick ?? 1) * k;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(m.pts[0] * canvas.width, m.pts[1] * canvas.height);
    for (let i = 2; i < m.pts.length; i += 2) ctx.lineTo(m.pts[i] * canvas.width, m.pts[i + 1] * canvas.height);
    if (m.pts.length === 2) ctx.lineTo(m.pts[0] * canvas.width + 0.01, m.pts[1] * canvas.height);
    ctx.stroke();
  } else if (m.kind === 'callout' && m.pts && m.pts.length >= 8) {
    // Callout-ul întreg (vezi calloutForPdf): linia de la margine la vârf, vârful de săgeată și caseta albă cu chenar și text.
    const k = canvas.width / m.w;
    const P = (vx: number, vy: number): [number, number] => [(vx - m.x) * k, (vy - m.y) * k];
    const [tx, ty, ex, ey, bx, by, bw, bh] = m.pts;
    const col = m.color ?? MARK_COLOR;
    ctx.strokeStyle = ctx.fillStyle = col;
    ctx.lineWidth = 1.2 * k;
    const [ax, ay] = P(tx, ty), [cx, cy] = P(ex, ey);
    if (Math.hypot(cx - ax, cy - ay) > 1) {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ax, ay); ctx.stroke();
      const a = Math.atan2(ay - cy, ax - cx), head = 7 * k;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - Math.cos(a - 0.45) * head, ay - Math.sin(a - 0.45) * head);
      ctx.lineTo(ax - Math.cos(a + 0.45) * head, ay - Math.sin(a + 0.45) * head);
      ctx.closePath(); ctx.fill();
    }
    const [x0, y0] = P(bx, by);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0, y0, bw * k, bh * k);
    ctx.strokeRect(x0 + k / 2, y0 + k / 2, bw * k - k, bh * k - k);
    ctx.fillStyle = '#222';
    ctx.font = `${NOTE_FONT * k}px ${MARK_FONT}`;
    ctx.textBaseline = 'middle';
    wrapLines(m.text ?? '', (bw - 2 * NOTE_PAD) * k, ctx).forEach((line, i) => {
      ctx.fillText(line, x0 + NOTE_PAD * k, y0 + (NOTE_PAD + NOTE_LINE * (i + 0.5)) * k);
    });
  } else if (m.kind === 'note') {
    // Bilețel galben (ca un post-it), cu textul pe rânduri.
    const k = canvas.width / m.w;
    ctx.fillStyle = '#fff59d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#d4b400';
    ctx.lineWidth = k;
    ctx.strokeRect(k / 2, k / 2, canvas.width - k, canvas.height - k);
    ctx.fillStyle = '#333';
    ctx.font = `${NOTE_FONT * k}px ${MARK_FONT}`;
    ctx.textBaseline = 'middle';
    wrapLines(m.text ?? '', (m.w - 2 * NOTE_PAD) * k, ctx).forEach((line, i) => {
      ctx.fillText(line, NOTE_PAD * k, (NOTE_PAD + NOTE_LINE * (i + 0.5)) * k);
    });
  }
}

/**
 * Un punct de pe pagina văzută (cu rotirea ei, y de sus în jos) → coordonatele PDF (y de jos în sus).
 * `box` e zona vizibilă a paginii (CropBox), `rot` rotirea ei (0/90/180/270, în sensul acelor de ceasornic).
 */
export function toPdfPoint(dx: number, dy: number, box: { x: number; y: number; width: number; height: number }, rot: number): [number, number] {
  let u = dx, v = dy;
  if (rot === 90) { u = dy; v = box.height - dx; }
  else if (rot === 180) { u = box.width - dx; v = box.height - dy; }
  else if (rot === 270) { u = box.width - dy; v = dx; }
  return [box.x + u, box.y + box.height - v];
}

/**
 * Ținta unei legături, din ce a scris omul: un număr = pagina din document; o adresă de e-mail = mailto:;
 * altfel adresă web (fără „https://” în față, îl punem noi).
 */
export function linkTarget(text: string, pages: number): { page: number } | { uri: string } | null {
  const t = text.trim();
  if (!t) return null;
  const n = /^(?:pagina *)?([0-9]+)$/i.exec(t);
  if (n) return { page: Math.max(1, Math.min(pages, Number(n[1]))) };
  if (/^[^ @/]+@[^ @/]+[.][^ @/]+$/.test(t)) return { uri: `mailto:${t}` };
  if (/^(https?|mailto|ftp):/i.test(t)) return { uri: t };
  return { uri: `https://${t}` };
}

/** O legătură adevărată în PDF (adnotare /Link): se poate da click pe ea în orice cititor de PDF. */
function addLink(doc: PDFDocument, page: PDFPage, m: Mark) {
  const target = linkTarget(m.text ?? '', doc.getPageCount());
  if (!target) return;
  const rot = ((page.getRotation().angle % 360) + 360) % 360;
  const box = page.getCropBox();
  const [ax, ay] = toPdfPoint(m.x, m.y, box, rot), [bx, by] = toPdfPoint(m.x + m.w, m.y + m.h, box, rot);
  const ctx = doc.context;
  const dict: Record<string, unknown> = {
    Type: 'Annot', Subtype: 'Link',
    Rect: [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)],
    Border: [0, 0, 0], F: 4,
  };
  if ('page' in target) dict.Dest = ctx.obj([doc.getPage(target.page - 1).ref, PDFName.of('XYZ'), PDFNull, PDFNull, PDFNull]);
  else dict.A = ctx.obj({ S: 'URI', URI: PDFString.of(target.uri) });
  page.node.addAnnot(ctx.register(ctx.obj(dict as Parameters<typeof ctx.obj>[0])));
}

/** Callout: punctul de pe marginea casetei cel mai apropiat de vârful săgeții (null dacă vârful e chiar în casetă). */
export function calloutEdge(m: Mark): [number, number] | null {
  const [tx, ty] = m.pts ?? [];
  if (tx == null || ty == null) return null;
  const ex = Math.max(m.x, Math.min(m.x + m.w, tx)), ey = Math.max(m.y, Math.min(m.y + m.h, ty));
  if (ex === tx && ey === ty) return null;
  return [ex, ey];
}

/**
 * Callout-ul pentru PDF: tot dreptunghiul (caseta + săgeata, cu loc pentru vârf), iar în `pts` vârful, punctul de pe margine
 * și caseta: [vx, vy, ex, ey, bx, by, bw, bh] (puncte pe pagina văzută).
 */
export function calloutForPdf(m: Mark): Mark {
  const [tx, ty] = m.pts ?? [m.x, m.y];
  const [ex, ey] = calloutEdge(m) ?? [tx, ty];
  const pad = ARROW_HEAD;
  const x0 = Math.min(m.x, tx - pad), y0 = Math.min(m.y, ty - pad);
  const x1 = Math.max(m.x + m.w, tx + pad), y1 = Math.max(m.y + m.h, ty + pad);
  return { ...m, x: x0, y: y0, w: x1 - x0, h: y1 - y0, pts: [tx, ty, ex, ey, m.x, m.y, m.w, m.h] };
}

/** Culorile redactării (ca „Redaction Properties” din Acrobat); prima e cea obișnuită. */
export const REDACT_COLOR = '#000000';
export const REDACT_COLORS: [string, string][] = [['#000000', 'Negru'], ['#ffffff', 'Alb'], ['#757575', 'Gri'], ['#7f0000', 'Roșu închis'], ['#0d47a1', 'Albastru închis']];

/** Textul pus peste redactare (de ex. „[CNP]”), centrat, cât de mare încape, alb pe culori închise și negru pe cele deschise. */
export function paintRedactLabel(ctx: CanvasRenderingContext2D, text: string | undefined, x: number, y: number, w: number, h: number, fill: string) {
  const t = text?.trim();
  if (!t || w < 4 || h < 4) return;
  const n = parseInt(fill.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  ctx.save();
  ctx.fillStyle = lum < 140 ? '#ffffff' : '#000000';
  let size = h * 0.7;
  ctx.font = `bold ${size}px ${MARK_FONT}`;
  const tw = ctx.measureText(t).width;
  if (tw > w * 0.92) { size *= (w * 0.92) / tw; ctx.font = `bold ${size}px ${MARK_FONT}`; }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t, x + w / 2, y + h / 2 + size * 0.05);
  ctx.restore();
}

/** Numele câmpului: cel scris (sau „Câmp”), fără puncte (în PDF punctul desparte numele părinte de copil), unic în formular. */
export function fieldName(wanted: string | undefined, taken: Set<string>): string {
  const base = (wanted ?? '').replace(/\./g, ' ').replace(/\s+/g, ' ').trim() || 'Câmp';
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base} ${n}`;
  taken.add(name);
  return name;
}

/** Câmpul de text nou (formular): oricine îl poate completa apoi în Suite, Acrobat, Edge sau Chrome. Cele înalte primesc mai multe rânduri. */
function addField(doc: PDFDocument, page: PDFPage, m: Mark, taken: Set<string>) {
  const rot = ((page.getRotation().angle % 360) + 360) % 360;
  const box = page.getCropBox();
  const [ax, ay] = toPdfPoint(m.x, m.y, box, rot), [bx, by] = toPdfPoint(m.x + m.w, m.y + m.h, box, rot);
  const form = doc.getForm();
  const place = {
    x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.abs(by - ay),
    borderColor: rgb(0.45, 0.55, 0.7), borderWidth: 1, backgroundColor: rgb(0.93, 0.96, 1),
  };
  if (m.ftype === 'check') {
    // Bifa: pătrat (latura cea mai mică a dreptunghiului tras).
    const s = Math.min(place.width, place.height);
    form.createCheckBox(fieldName(m.text || 'Bifă', taken)).addToPage(page, { ...place, width: s, height: s });
    return;
  }
  if (m.ftype === 'radio') {
    // Un grup de butoane radio: se poate alege una singură dintre opțiuni (etichetele se pun separat, ca text pe pagină).
    const rg = form.createRadioGroup(fieldName(m.text || 'Alegere', taken));
    for (const b of radioLayout(m)) {
      const [px, py] = toPdfPoint(b.x, b.y, box, rot), [qx, qy] = toPdfPoint(b.x + b.s, b.y + b.s, box, rot);
      rg.addOptionToPage(b.opt, page, { ...place, x: Math.min(px, qx), y: Math.min(py, qy), width: Math.abs(qx - px), height: Math.abs(qy - py) });
    }
    return;
  }
  if (m.ftype === 'barcode') {
    // ▣ Codul de bare: pătrat (latura cea mai mică), cu datele formularului; se reface la fiecare salvare din Suite.
    const s = Math.min(place.width, place.height);
    addBarcodeField(doc, page, { x: place.x, y: place.y + place.height - s, width: s, height: s }, fieldName(m.text || 'Cod de bare', taken), barcodeFields(m.opts));
    return;
  }
  if (m.ftype === 'sig') {
    addSigField(doc, page, place, fieldName(m.text || 'Semnătura', taken));
    return;
  }
  if (m.ftype === 'list') {
    const dd = form.createDropdown(fieldName(m.text || 'Listă', taken));
    dd.addOptions(fieldOptions(m));
    dd.addToPage(page, place);
    dd.setFontSize(Math.max(6, Math.min(12, Math.round(m.h * 0.6))));
    return;
  }
  if (m.ftype === 'date') {
    // Câmpul de dată: un câmp de text cu formatul zz.ll.aaaa, pe care programele de PDF îl verifică la scriere (și arată un calendar).
    const field = form.createTextField(fieldName(m.text || 'Data', taken));
    field.setMaxLength(10);
    field.addToPage(page, place);
    field.setFontSize(Math.max(6, Math.min(14, Math.round(m.h * 0.6))));
    const js = (code: string) => doc.context.obj({ S: 'JavaScript', JS: PDFString.of(code) });
    field.acroField.dict.set(PDFName.of('AA'), doc.context.obj({ F: js(`AFDate_FormatEx("${DATE_FORMAT}");`), K: js(`AFDate_KeystrokeEx("${DATE_FORMAT}");`) }));
    field.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText('Data (zz.ll.aaaa)'));
    return;
  }
  if (m.ftype === 'sum') {
    // Totalul: un câmp de text doar de citit, cu calculul standard „sumă a câmpurilor” (îl fac singure programele de PDF și Suite)
    // și formatul 1.234,56. Intră și în ordinea de calcul a formularului (/CO), fără de care unele programe nu-l recalculează.
    const field = form.createTextField(fieldName(m.text || 'Total', taken));
    field.addToPage(page, place);
    field.setFontSize(Math.max(6, Math.min(14, Math.round(m.h * 0.6))));
    field.setText(formatNum(0, SUM_FORMAT));
    field.enableReadOnly();
    const js = (code: string) => doc.context.obj({ S: 'JavaScript', JS: PDFString.of(code) });
    const names = sumFields(m).map((n) => JSON.stringify(n)).join(', ');
    field.acroField.dict.set(PDFName.of('AA'), doc.context.obj({ C: js(`AFSimple_Calculate("SUM", new Array(${names}));`), F: js(SUM_FORMAT) }));
    field.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(`Total: ${sumFields(m).join(' + ') || '—'}`));
    const acro = form.acroForm.dict;
    const co = acro.lookup(PDFName.of('CO'));
    if (co instanceof PDFArray) co.push(field.acroField.ref);
    else acro.set(PDFName.of('CO'), doc.context.obj([field.acroField.ref]));
    return;
  }
  const field = form.createTextField(fieldName(m.text, taken));
  if (m.h >= 36) field.enableMultiline();
  field.addToPage(page, place);
  // Mărimea literelor: după înălțime la câmpurile pe un rând, 11 la cele pe mai multe rânduri.
  field.setFontSize(m.h >= 36 ? 11 : Math.max(6, Math.min(14, Math.round(m.h * 0.6))));
}

/**
 * Câmpul de semnătură gol (/FT /Sig): locul în care cineva semnează mai târziu cu certificatul lui (ID digital),
 * în Suite sau în orice program de PDF. pdf-lib nu are o funcție pentru el, așa că punem singuri câmpul și widget-ul
 * (un singur dicționar, ca la celelalte câmpuri cu un singur loc), cu un aspect simplu: fundal deschis și chenar.
 */
export function addSigField(doc: PDFDocument, page: PDFPage, place: { x: number; y: number; width: number; height: number }, name: string) {
  const ctx = doc.context, form = doc.getForm();
  const w = Math.max(1, place.width), h = Math.max(1, place.height);
  const ops = `q 0.93 0.96 1 rg 0 0 ${w} ${h} re f 0.45 0.55 0.7 RG 1 w 0.5 0.5 ${w - 1} ${h - 1} re S Q`;
  const ap = ctx.register(ctx.stream(ops, { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, w, h] }));
  const ref = ctx.register(ctx.obj({
    Type: 'Annot', Subtype: 'Widget', FT: 'Sig', T: PDFHexString.fromText(name), TU: PDFHexString.fromText(`Semnătura: ${name}`),
    Rect: [place.x, place.y, place.x + w, place.y + h], F: 4, P: page.ref,
    MK: { BC: [0.45, 0.55, 0.7], BG: [0.93, 0.96, 1] }, AP: { N: ap },
  } as Parameters<typeof ctx.obj>[0]));
  form.acroForm.addField(ref);
  page.node.addAnnot(ref);
}

/** Câmpurile de semnătură încă goale (fără /V), cu pagina lor (de la 1; 0 dacă nu se știe), pentru panoul Semnături. */
export async function emptySigFields(bytes: Uint8Array): Promise<{ name: string; page: number; w?: number; h?: number }[]> {
  const doc = await open(bytes);
  const pages = doc.getPages(), found: { name: string; page: number; w?: number; h?: number }[] = [];
  for (const f of doc.getForm().getFields()) {
    if (!(f instanceof PDFSignature) || f.acroField.dict.get(PDFName.of('V'))) continue;
    const wd = f.acroField.getWidgets()[0], pref = wd?.P();
    let page = pref ? pages.findIndex((p) => p.ref === pref) + 1 : 0;
    if (!page && wd) {
      const ref = doc.context.getObjectRef(wd.dict);
      page = pages.findIndex((p) => { const a = p.node.Annots(); return !!a && !!ref && a.asArray().some((x) => x === ref); }) + 1;
    }
    const r = wd?.getRectangle();
    found.push({ name: f.getName(), page, ...(r && r.width > 1 && r.height > 1 ? { w: r.width, h: r.height } : {}) });
  }
  return found;
}

/** Tipul de adnotare PDF pentru fiecare comentariu (celelalte elemente se desenează în pagină). */
const ANNOT_TYPES: Partial<Record<MarkKind, string>> = {
  note: 'FreeText', callout: 'FreeText', highlight: 'Highlight', underline: 'Underline', strike: 'StrikeOut',
  rect: 'Square', ellipse: 'Circle', line: 'Line', arrow: 'Line', draw: 'Ink', polyline: 'PolyLine', polygon: 'Polygon', cloud: 'Polygon',
  caret: 'Caret', replace: 'StrikeOut', fileatt: 'FileAttachment',
};

/** Data de acum în formatul PDF: D:AAAALLZZOOMMSS. */
function pdfNow(): string {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
  return `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Numele fișierului doar cu litere simple (pentru programele vechi care nu citesc /UF): ș → s, ă → a, restul → _. */
function asciiName(name: string): string {
  return [...name.normalize('NFD')].filter((c) => c.charCodeAt(0) < 0x300 || c.charCodeAt(0) > 0x36f)
    .map((c) => (c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127 ? c : '_')).join('');
}

/** #rrggbb → [r, g, b] între 0 și 1. */
function rgbOf(hex: string): number[] {
  return [1, 3, 5].map((i) => Math.round((parseInt(hex.slice(i, i + 2), 16) / 255) * 1000) / 1000);
}

/**
 * Un comentariu ca adnotare PDF standard (Highlight, Underline, Square, Ink…), cu aspectul (/AP) desenat din imaginea noastră,
 * ca să arate la fel peste tot. Pagina nu e rotită; (x, y) e colțul din stânga-jos al elementului, în puncte PDF.
 */
function addMarkup(doc: PDFDocument, page: PDFPage, m: Mark, img: PDFRef, x: number, y: number) {
  const ctx = doc.context, w = m.w, h = m.h;
  const ap = ctx.register(ctx.stream(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`, {
    Type: 'XObject', Subtype: 'Form', BBox: [0, 0, w, h], Resources: { XObject: { Im0: img } },
  }));
  const color = m.kind === 'fileatt' ? CLIP_COLOR : m.kind === 'highlight' ? '#ffdd00' : m.kind === 'note' ? '#fff59d' : m.kind === 'caret' ? CARET_COLOR
    : m.kind === 'replace' ? STRIKE_COLOR : m.color ?? (m.kind === 'strike' ? STRIKE_COLOR : MARK_COLOR);
  const dict: Record<string, unknown> = {
    Type: 'Annot', Subtype: ANNOT_TYPES[m.kind], Rect: [x, y, x + w, y + h], F: 4, M: PDFString.of(pdfNow()),
    T: PDFHexString.fromText('Cyber Office Studio'), C: rgbOf(color), AP: { N: ap },
    NM: PDFString.of(`suite-${Date.now().toString(36)}-${m.id}`),
  };
  if (m.text?.trim()) dict.Contents = PDFHexString.fromText(m.text.trim());
  if (m.opacity !== undefined && m.opacity < 1) dict.CA = m.opacity;
  if (m.kind === 'highlight' || m.kind === 'underline' || m.kind === 'strike' || m.kind === 'replace') dict.QuadPoints = [x, y + h, x + w, y + h, x, y, x + w, y];
  // Inserare text: Caret cu textul de adăugat; „Sy /None” = semnul obișnuit (nu cel de paragraf nou).
  if (m.kind === 'caret') { dict.Sy = PDFName.of('None'); dict.Subj = PDFHexString.fromText('Inserare text'); }
  if (m.kind === 'fileatt' && m.fdata) {
    // Fișierul intră în PDF (comprimat) și se leagă de agrafă: îl poate salva oricine deschide PDF-ul.
    const name = m.fname || 'fisier';
    const ef = ctx.register(ctx.flateStream(m.fdata, { Type: 'EmbeddedFile', Params: { Size: m.fdata.length, ModDate: PDFString.of(pdfNow()) } }));
    dict.FS = ctx.obj({ Type: 'Filespec', F: PDFString.of(asciiName(name)), UF: PDFHexString.fromText(name), EF: { F: ef } } as Parameters<typeof ctx.obj>[0]);
    dict.Name = PDFName.of('Paperclip');
    if (/^Comentariu audio /.test(name)) dict.Subj = PDFHexString.fromText('Comentariu audio');
    if (!m.text?.trim()) dict.Contents = PDFHexString.fromText(name);
  }
  if (m.kind === 'replace') { dict.IT = PDFName.of('StrikeOutTextEdit'); dict.Subj = PDFHexString.fromText('Înlocuire text'); }
  if (m.kind === 'note' || m.kind === 'callout') dict.DA = PDFString.of('/Helv 10 Tf 0 g');
  if (m.kind === 'callout' && m.pts && m.pts.length >= 8) {
    // Callout-ul din Acrobat: FreeText cu /IT /FreeTextCallout și linia /CL (vârf, apoi punctul de pe casetă), în puncte PDF.
    const at = (vx: number, vy: number) => [x + (vx - m.x), y + m.h - (vy - m.y)];
    dict.IT = PDFName.of('FreeTextCallout');
    dict.CL = [...at(m.pts[0], m.pts[1]), ...at(m.pts[2], m.pts[3])];
    dict.LE = PDFName.of('OpenArrow');
  }
  if (m.kind !== 'note' && m.kind !== 'callout' && m.kind !== 'highlight' && m.kind !== 'fileatt') dict.BS = { W: (m.kind === 'draw' ? DRAW_WIDTH : SHAPE_WIDTH) * (m.thick ?? 1) };
  // Punctele liniei și ale desenului: din fracțiunile elementului (y în jos) în puncte PDF (y în sus).
  const pt = (i: number) => [x + (m.pts![i] * w), y + h - m.pts![i + 1] * h];
  if ((m.kind === 'line' || m.kind === 'arrow') && m.pts && m.pts.length >= 4) {
    dict.L = [...pt(0), ...pt(2)];
    if (m.kind === 'arrow') dict.LE = [PDFName.of('None'), PDFName.of('OpenArrow')];
  }
  if (m.kind === 'draw' && m.pts) dict.InkList = [m.pts.flatMap((_, i) => (i % 2 ? [] : pt(i)))];
  if (POLY_KINDS.includes(m.kind) && m.pts) dict.Vertices = m.pts.flatMap((_, i) => (i % 2 ? [] : pt(i)));
  if (m.kind === 'cloud') dict.BE = { S: 'C', I: 1 };
  const ref = ctx.register(ctx.obj(dict as Parameters<typeof ctx.obj>[0]));
  page.node.addAnnot(ref);
  if (m.kind === 'replace') {
    // Înlocuirea, ca în programele de PDF: tăierea (cu textul nou) plus un Caret legat de ea (/IRT, /RT /Group) la capătul textului.
    // Semnul ‸ e deja desenat în aspectul tăierii, deci Caret-ul are un aspect gol.
    const cw = Math.min(w, CARET_W * 0.8), ch = Math.min(h, CARET_H * 0.6);
    const empty = ctx.register(ctx.stream('', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, cw, ch] }));
    page.node.addAnnot(ctx.register(ctx.obj({
      Type: 'Annot', Subtype: 'Caret', Rect: [x + w - cw, y, x + w, y + ch], F: 4, M: PDFString.of(pdfNow()),
      T: PDFHexString.fromText('Cyber Office Studio'), C: rgbOf(CARET_COLOR), Sy: PDFName.of('None'), IRT: ref, RT: PDFName.of('Group'),
      AP: { N: empty }, NM: PDFString.of(`suite-${Date.now().toString(36)}-${m.id}-c`),
    } as Parameters<typeof ctx.obj>[0])));
  }
}

/**
 * Butonul de formular (pushbutton) cu acțiunea lui. Aspectul e desenul nostru (o imagine), ca literele românești să se vadă
 * peste tot; textul butonului e pus și în /MK /CA, pentru programele care își desenează singure butoanele.
 */
async function addButton(doc: PDFDocument, page: PDFPage, m: Mark, taken: Set<string>, canvas: HTMLCanvasElement) {
  const ctx = doc.context, form = doc.getForm();
  const rot = ((page.getRotation().angle % 360) + 360) % 360;
  const box = page.getCropBox();
  const [ax, ay] = toPdfPoint(m.x, m.y, box, rot), [bx, by] = toPdfPoint(m.x + m.w, m.y + m.h, box, rot);
  const x = Math.min(ax, bx), y = Math.min(ay, by), w = Math.max(1, Math.abs(bx - ax)), h = Math.max(1, Math.abs(by - ay));
  const caption = buttonCaption(m);
  await paintMark(m, canvas, 4);
  const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  const btn = form.createButton(fieldName(m.text || 'Buton', taken));
  // pdf-lib desenează singur aspectul cu un font fără diacritice, deci îi dăm un text gol și punem apoi aspectul nostru.
  btn.addToPage('', page, { x, y, width: w, height: h, borderWidth: 0 });
  const a = buttonAction(m.opts);
  const act = a.kind === 'reset' ? ctx.obj({ S: 'ResetForm' })
    : a.kind === 'print' ? ctx.obj({ S: 'Named', N: 'Print' })
    : a.kind === 'url' ? ctx.obj({ S: 'URI', URI: PDFString.of(normalUrl(a.url)) })
    : ctx.obj({ S: 'GoTo', D: [doc.getPage(Math.min(doc.getPageCount(), a.page) - 1).ref, PDFName.of('Fit')] });
  let ap = null;
  if (png) {
    const img = await doc.embedPng(new Uint8Array(await png.arrayBuffer()));
    ap = ctx.register(ctx.stream(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`, { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, w, h], Resources: { XObject: { Im0: img.ref } } }));
  }
  for (const wd of btn.acroField.getWidgets()) {
    wd.dict.set(PDFName.of('A'), act);
    wd.dict.set(PDFName.of('MK'), ctx.obj({ CA: PDFHexString.fromText(caption), BG: [0.91, 0.94, 1], BC: [0.36, 0.48, 0.7] }));
    wd.dict.set(PDFName.of('H'), PDFName.of('P'));
    if (ap) wd.dict.set(PDFName.of('AP'), ctx.obj({ N: ap }));
  }
  btn.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(caption));
}

/** Pune elementele în PDF (ca imagini) și întoarce noul document. */
export async function stampMarks(bytes: Uint8Array, marks: Mark[]): Promise<Uint8Array> {
  const doc = await open(bytes);
  const canvas = document.createElement('canvas');
  let taken: Set<string> | null = null;
  // Butoanele radio își aduc etichetele: câte un text lângă fiecare buton.
  const all = marks.flatMap((m) => (m.kind === 'field' && m.ftype === 'radio' ? [m, ...radioLayout(m).map((b) => b.label)] : [m]));
  for (const orig of all) {
    if ((orig.kind === 'text' || orig.kind === 'note' || orig.kind === 'link' || orig.kind === 'callout' || orig.kind === 'caret') && !orig.text?.trim()) continue;
    // Callout-ul se desenează cu tot cu săgeata: chenarul lui crește până la vârf.
    const m = orig.kind === 'callout' ? calloutForPdf(orig) : orig;
    if (m.page < 1 || m.page > doc.getPageCount()) continue;
    if (m.kind === 'link') { addLink(doc, doc.getPage(m.page - 1), m); continue; }
    if (m.kind === 'field') {
      taken ??= new Set(doc.getForm().getFields().map((f) => f.getName()));
      if (m.ftype === 'button') { await addButton(doc, doc.getPage(m.page - 1), m, taken, canvas); continue; }
      addField(doc, doc.getPage(m.page - 1), m, taken);
      continue;
    }
    await paintMark(m, canvas, 4);
    const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!png) continue;
    const img = await doc.embedPng(new Uint8Array(await png.arrayBuffer()));
    const page = doc.getPage(m.page - 1);
    // Ștampila: adnotare /Stamp cu aspectul și datele ei, ca să rămână de mutat și de schimbat la redeschidere.
    if (m.kind === 'stamp') { addStampAnnot(doc, page, m, img.ref); continue; }
    const rot = ((page.getRotation().angle % 360) + 360) % 360;
    // Colțul din stânga-jos al elementului, așa cum se vede; imaginea se rotește odată cu pagina, ca să stea dreaptă.
    const [x, y] = toPdfPoint(m.x, m.y + m.h, page.getCropBox(), rot);
    // Comentariile devin adnotări PDF reale (se pot muta / șterge în Acrobat, Edge…), cu desenul nostru ca aspect.
    // Pe paginile rotite rămân desenate în pagină, ca să nu le stricăm poziția.
    // Fișierul atașat rămâne mereu adnotare (altfel s-ar pierde fișierul).
    if ((rot === 0 || m.kind === 'fileatt') && ANNOT_TYPES[m.kind]) { addMarkup(doc, page, m, img.ref, x, y); continue; }
    page.drawImage(img, { x, y, width: m.w, height: m.h, rotate: degrees(rot) });
  }
  canvas.width = 0;
  return doc.save();
}
