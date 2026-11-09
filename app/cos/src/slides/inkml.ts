// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Cerneala din .pptx (ppt/ink/inkN.xml, formatul InkML al W3C): liniile desenate de mână în alte programe.
// La citire liniile devin desenul pozei de rezervă (câmpul ink), ca ✎ Desen să le poată schimba; la scriere desenul
// nostru pleacă tot ca InkML, ca în fișierul primit să rămână cerneală adevărată, nu doar o poză.
import { MAX_LINES, MAX_PTS, type InkLine } from './ink';

/** O linie citită: punctele x, y în unitățile fișierului, culoarea, grosimea (tot în unitățile fișierului), opacitatea. */
export interface RawStroke { p: number[]; c: string; w: number; o: number }
/** Cerneala citită: liniile și câte unități ale fișierului are un centimetru (0 = nu se știe). */
export interface RawInk { strokes: RawStroke[]; perCm: number }

const local = (e: Element) => e.localName || e.nodeName.replace(/^.*:/, '');
const all = (root: Element | Document, name: string) => [...(root as Element).getElementsByTagName('*')].filter((e) => local(e) === name);

/** Punctele unei urme InkML: valori explicite, sau cu ' (diferența față de punctul dinainte) și " (diferența diferenței). */
export function traceValues(text: string, channels: number): number[][] {
  const mode: string[] = Array(channels).fill('!');
  const last: number[] = Array(channels).fill(0), vel: number[] = Array(channels).fill(0);
  const pts: number[][] = [];
  for (const part of text.split(',')) {
    const toks = part.match(/[!'"]?\s*-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
    if (!toks) continue;
    const pt: number[] = [];
    toks.slice(0, channels).forEach((t, ch) => {
      const m = /^[!'"]/.exec(t);
      if (m) mode[ch] = m[0];
      const v = +t.replace(/^[!'"]\s*/, '');
      if (!Number.isFinite(v)) return;
      const first = pts.length === 0;
      let x: number;
      if (mode[ch] === '"' && !first) { vel[ch] += v; x = last[ch] + vel[ch]; }
      else if (mode[ch] === "'" && !first) { vel[ch] = v; x = last[ch] + v; }
      else { vel[ch] = first ? 0 : v - last[ch]; x = v; }
      last[ch] = x;
      pt.push(x);
    });
    if (pt.length >= 2) pts.push(pt);
    if (pts.length >= MAX_PTS) break;
  }
  return pts;
}

/** Citește un fișier InkML (textul lui deja ca document XML). */
export function readInkml(doc: Document): RawInk {
  // Ordinea canalelor (de obicei X, Y, apoi apăsarea și timpul) și rezoluția lui X.
  const fmt = all(doc, 'traceFormat')[0];
  const chans = fmt ? all(fmt, 'channel').map((c) => c.getAttribute('name') ?? '') : ['X', 'Y'];
  const xi = Math.max(0, chans.indexOf('X')), yi = chans.indexOf('Y') >= 0 ? chans.indexOf('Y') : 1;
  let perCm = 0;
  for (const cp of all(doc, 'channelProperty')) {
    if (cp.getAttribute('channel') !== 'X' || cp.getAttribute('name') !== 'resolution') continue;
    const v = +(cp.getAttribute('value') ?? 0), u = (cp.getAttribute('units') ?? '').toLowerCase();
    perCm = !(v > 0) ? 0 : u === '1/cm' ? v : u === '1/mm' ? v * 10 : u === '1/in' ? v / 2.54 : 0;
  }
  if (!perCm && fmt) {
    const u = (all(fmt, 'channel').find((c) => c.getAttribute('name') === 'X')?.getAttribute('units') ?? '').toLowerCase();
    perCm = u === 'cm' ? 1 : u === 'mm' ? 10 : u === 'in' ? 1 / 2.54 : u === 'himetric' ? 1000 : 0;
  }
  // Pensulele: culoarea, grosimea în centimetri, markerul (vârf dreptunghiular sau „maskPen”) pe jumătate transparent.
  const brushes = new Map<string, { c: string; wCm: number; o: number }>();
  for (const b of all(doc, 'brush')) {
    const id = b.getAttribute('xml:id') ?? b.getAttribute('id') ?? '';
    const prop: Record<string, string> = {}, units: Record<string, string> = {};
    for (const p of all(b, 'brushProperty')) { const n = p.getAttribute('name') ?? ''; prop[n] = p.getAttribute('value') ?? ''; units[n] = (p.getAttribute('units') ?? '').toLowerCase(); }
    const c = /^#[0-9a-f]{6}$/i.test(prop.color ?? '') ? prop.color.toLowerCase() : '#000000';
    const w = +(prop.width ?? 0);
    const wCm = w > 0 ? (units.width === 'mm' ? w / 10 : units.width === 'in' ? w * 2.54 : units.width === 'himetric' ? w / 1000 : w) : 0.05;
    const marker = /maskpen/i.test(prop.rasterOp ?? '') || /rectangle/i.test(prop.tip ?? '');
    const tr = +(prop.transparency ?? 0);
    const o = marker ? 0.4 : tr > 0 && tr < 256 ? Math.max(0.05, 1 - tr / 255) : 1;
    brushes.set(id, { c, wCm: Math.min(2, wCm), o });
  }
  const strokes: RawStroke[] = [];
  const n = Math.max(2, chans.length || 2);
  for (const t of all(doc, 'trace')) {
    if (strokes.length >= MAX_LINES) break;
    const b = brushes.get((t.getAttribute('brushRef') ?? '').replace(/^#/, '')) ?? { c: '#000000', wCm: 0.05, o: 1 };
    const pts = traceValues(t.textContent ?? '', n);
    if (!pts.length) continue;
    const p: number[] = [];
    for (const q of pts) if (Number.isFinite(q[xi]) && Number.isFinite(q[yi])) p.push(q[xi], q[yi]);
    if (p.length < 2) continue;
    strokes.push({ p, c: b.c, w: b.wCm * (perCm || 1000), o: b.o });
  }
  return { strokes, perCm };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Liniile cernelii așezate pe poza de rezervă (în pixelii slide-ului). Cu rezoluția cunoscută mărimea e cea adevărată
 * (pxPerCm), centrată pe poză; altfel desenul se potrivește în poză.
 */
export function placeRawInk(ink: RawInk, box: { x: number; y: number; w: number; h: number }, pxPerCm: number): InkLine[] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, wMax = 0;
  for (const s of ink.strokes) {
    wMax = Math.max(wMax, s.w);
    for (let k = 0; k + 1 < s.p.length; k += 2) { x0 = Math.min(x0, s.p[k]); x1 = Math.max(x1, s.p[k]); y0 = Math.min(y0, s.p[k + 1]); y1 = Math.max(y1, s.p[k + 1]); }
  }
  if (!Number.isFinite(x0)) return [];
  const bw = x1 - x0 + wMax, bh = y1 - y0 + wMax;
  let k = ink.perCm > 0 && pxPerCm > 0 ? pxPerCm / ink.perCm : 0;
  // O mărime care nu se potrivește deloc cu poza (rezoluție greșită în fișier) → desenul se potrivește în poză.
  let real = k > 0;
  if (!k || bw * k > box.w * 3 || bh * k > box.h * 3 || (bw * k < box.w / 3 && bh * k < box.h / 3)) { real = false; k = Math.min(box.w / Math.max(bw, 1e-6), box.h / Math.max(bh, 1e-6)); }
  // Punctele socotite de la colțul pozei (cum le scriem noi) rămân pe loc; altfel desenul se centrează pe poză.
  const fromCorner = real && x0 >= -wMax && y0 >= -wMax && x1 * k <= box.w + 1 && y1 * k <= box.h + 1;
  const cx = fromCorner ? box.x + x0 * k : box.x + box.w / 2 - ((x0 + x1) / 2 - x0) * k;
  const cy = fromCorner ? box.y + y0 * k : box.y + box.h / 2 - ((y0 + y1) / 2 - y0) * k;
  return ink.strokes.map((s) => ({
    c: s.c, o: s.o, w: r1(Math.min(80, Math.max(0.5, s.w * k))),
    p: s.p.map((v, q) => r1(q % 2 ? cy + (v - y0) * k : cx + (v - x0) * k)),
  }));
}

/** Desenul nostru ca fișier InkML (liniile în sutimi de milimetru față de colțul pozei), cu pensulele lui. */
export function writeInkml(lines: InkLine[], box: { x: number; y: number }, pxPerCm: number): string {
  const per = 1000; // unități pe centimetru
  const k = per / pxPerCm;
  const brushes: string[] = [], keys = new Map<string, string>();
  const traces = lines.map((l) => {
    const key = `${l.c}|${l.w}|${l.o}`;
    let id = keys.get(key);
    if (!id) {
      id = `br${keys.size}`; keys.set(key, id);
      const wCm = (l.w / pxPerCm).toFixed(4);
      const mark = l.o < 1;
      brushes.push(`<inkml:brush xml:id="${id}"><inkml:brushProperty name="width" value="${wCm}" units="cm"/><inkml:brushProperty name="height" value="${wCm}" units="cm"/>`
        + `<inkml:brushProperty name="color" value="${l.c.toUpperCase()}"/>${mark ? '<inkml:brushProperty name="tip" value="rectangle"/><inkml:brushProperty name="rasterOp" value="maskPen"/>' : ''}</inkml:brush>`);
    }
    const pts: string[] = [];
    for (let q = 0; q + 1 < l.p.length; q += 2) pts.push(`${Math.round((l.p[q] - box.x) * k)} ${Math.round((l.p[q + 1] - box.y) * k)}`);
    if (pts.length === 1) pts.push(pts[0]);
    return `<inkml:trace contextRef="#ctx0" brushRef="#${id}">${pts.join(', ')}</inkml:trace>`;
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n<inkml:ink xmlns:inkml="http://www.w3.org/2003/InkML"><inkml:definitions>'
    + '<inkml:context xml:id="ctx0"><inkml:inkSource xml:id="inkSrc0"><inkml:traceFormat><inkml:channel name="X" type="integer" units="cm"/><inkml:channel name="Y" type="integer" units="cm"/></inkml:traceFormat>'
    + `<inkml:channelProperties><inkml:channelProperty channel="X" name="resolution" value="${per}" units="1/cm"/><inkml:channelProperty channel="Y" name="resolution" value="${per}" units="1/cm"/></inkml:channelProperties>`
    + '</inkml:inkSource></inkml:context>' + brushes.join('') + '</inkml:definitions>' + traces.join('') + '</inkml:ink>';
}
