// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Desenele vechi din documente și prezentări (.wmf și .emf, „metafișiere”): o listă de comenzi de desen (linii, poligoane,
// dreptunghiuri, text, poze). Le citim noi și le transformăm într-un SVG, pe care îl folosim apoi ca pe orice poză.
// Scris de la zero după descrierea publică a formatelor. Ce nu înțelegem (decupări, hașuri, EMF+ fără variantă simplă)
// se sare; dacă nu iese nimic desenat, întoarcem null (poza rămâne „n-a putut fi adusă”).

type Pt = [number, number];
type Pen = { k: 'pen'; color: string; w: number; none: boolean; dash?: string };
type Brush = { k: 'brush'; color: string | null };
type Font = { k: 'font'; h: number; weight: number; italic: boolean; under: boolean; strike: boolean; face: string; esc: number; cp: string };
type Obj = Pen | Brush | Font | { k: 'other' };

/** Mărimea celei mai lungi laturi a SVG-ului rezultat (pixeli). */
const OUT = 1200;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const num = (v: number) => (Math.round(v * 100) / 100).toString();
const CHARSET_CP: Record<number, string> = { 238: 'windows-1250', 204: 'windows-1251', 161: 'windows-1253', 162: 'windows-1254', 177: 'windows-1255', 178: 'windows-1256', 186: 'windows-1257' };

function decode(bytes: Uint8Array, cp: string): string {
  try { return new TextDecoder(cp).decode(bytes); } catch { return Array.from(bytes, (b) => String.fromCharCode(b)).join(''); }
}

/** O poză DIB (antet + culori + pixeli) → BMP / PNG / JPEG ca data URL. */
type Dib = { url: string; w: number; h: number };
function dibUrl(bmi: Uint8Array, bits: Uint8Array): Dib | null {
  if (bmi.length < 12) return null;
  const dv = new DataView(bmi.buffer, bmi.byteOffset, bmi.byteLength);
  const core = dv.getUint32(0, true) === 12;
  const w = core ? dv.getUint16(4, true) : dv.getInt32(4, true), h = Math.abs(core ? dv.getInt16(6, true) : dv.getInt32(8, true));
  if (w <= 0 || !h) return null;
  const comp = bmi.length >= 40 ? dv.getUint32(16, true) : 0;
  let bytes: Uint8Array, mime: string;
  if (comp === 4 || comp === 5) { bytes = bits; mime = comp === 4 ? 'image/jpeg' : 'image/png'; }
  else {
    bytes = new Uint8Array(14 + bmi.length + bits.length);
    const o = new DataView(bytes.buffer);
    bytes[0] = 0x42; bytes[1] = 0x4d;
    o.setUint32(2, bytes.length, true);
    o.setUint32(10, 14 + bmi.length, true);
    bytes.set(bmi, 14);
    bytes.set(bits, 14 + bmi.length);
    mime = 'image/bmp';
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { url: `data:${mime};base64,${btoa(bin)}`, w, h };
}

/** Lungimea antetului unei poze DIB (cu tabelul de culori), ca să știm unde încep pixelii. */
function dibHeaderLen(d: DataView, at: number): number {
  const size = d.getUint32(at, true);
  if (size === 12) { const bc = d.getUint16(at + 10, true); return 12 + (bc <= 8 ? 3 << bc : 0); }
  const bc = d.getUint16(at + 14, true), comp = d.getUint32(at + 16, true), used = d.getUint32(at + 32, true);
  return size + (comp === 3 && size === 40 ? 12 : 0) + 4 * (used || (bc <= 8 ? 1 << bc : 0));
}

/** Starea comună („contextul de desen”) și ieșirea SVG; WMF și EMF îi dau comenzile. */
class Painter {
  out: string[] = [];
  objs: (Obj | null)[] = [];
  pen: Pen = { k: 'pen', color: '#000000', w: 0, none: false };
  brush: Brush = { k: 'brush', color: '#ffffff' };
  font: Font = { k: 'font', h: 12, weight: 400, italic: false, under: false, strike: false, face: 'Arial', esc: 0, cp: 'windows-1252' };
  text = '#000000';
  align = 0;
  winding = false;
  cur: Pt = [0, 0];
  path: string[] | null = null;
  stack: unknown[] = [];
  drawn = 0;
  constructor(public map: (p: Pt) => Pt, public scale: () => number) {}

  add(o: Obj) { const i = this.objs.indexOf(null); if (i >= 0) this.objs[i] = o; else this.objs.push(o); }
  put(i: number, o: Obj) { this.objs[i] = o; }
  select(o: Obj | null | undefined) { if (o?.k === 'pen') this.pen = o; else if (o?.k === 'brush') this.brush = o; else if (o?.k === 'font') this.font = o; }

  stroke(): string {
    if (this.pen.none) return 'stroke="none"';
    const w = Math.max(1, this.pen.w * this.scale());
    return `stroke="${this.pen.color}" stroke-width="${num(w)}"${this.pen.dash ? ` stroke-dasharray="${this.pen.dash.split(' ').map((v) => num(+v * w)).join(' ')}"` : ''} stroke-linejoin="round"`;
  }
  fill(): string { return this.brush.color ? `fill="${this.brush.color}"${this.winding ? '' : ' fill-rule="evenodd"'}` : 'fill="none"'; }

  d(pts: Pt[], close: boolean): string {
    const m = pts.map((p) => this.map(p));
    return 'M' + m.map(([x, y]) => `${num(x)} ${num(y)}`).join('L') + (close ? 'Z' : '');
  }
  emit(d: string, fill: boolean, stroke: boolean) {
    if (this.path) { this.path.push(d); return; }
    if (!d || (!fill || !this.brush.color) && (!stroke || this.pen.none)) return;
    this.out.push(`<path d="${d}" ${fill ? this.fill() : 'fill="none"'} ${stroke ? this.stroke() : 'stroke="none"'}/>`);
    this.drawn++;
  }
  poly(pts: Pt[], close: boolean) { if (pts.length > 1) this.emit(this.d(pts, close), close, true); }
  polys(list: Pt[][]) { this.emit(list.filter((p) => p.length > 1).map((p) => this.d(p, true)).join(''), true, true); }
  bezier(pts: Pt[], from?: Pt) {
    const all = from ? [from, ...pts] : pts;
    if (all.length < 4) return;
    const m = all.map((p) => this.map(p));
    let d = `M${num(m[0][0])} ${num(m[0][1])}`;
    for (let i = 1; i + 2 < m.length; i += 3) d += `C${[m[i], m[i + 1], m[i + 2]].map(([x, y]) => `${num(x)} ${num(y)}`).join(' ')}`;
    if (this.path) this.path.push(from ? d.replace(/^M[^C]*/, '') : d);
    else this.emit(d, false, true);
    this.cur = all[all.length - 1];
  }
  /** Linie de la poziția curentă (în interiorul unei căi, continuă calea). */
  lineTo(p: Pt) {
    if (this.path) { const [x, y] = this.map(p); this.path.push(`L${num(x)} ${num(y)}`); }
    else this.poly([this.cur, p], false);
    this.cur = p;
  }
  moveTo(p: Pt) {
    if (this.path) { const [x, y] = this.map(p); this.path.push(`M${num(x)} ${num(y)}`); }
    this.cur = p;
  }
  /** Elipsă / dreptunghi rotunjit prin curbe, ca să meargă și cu transformări. */
  ellipse(l: number, t: number, r: number, b: number) {
    const cx = (l + r) / 2, cy = (t + b) / 2, rx = (r - l) / 2, ry = (b - t) / 2, k = 0.5523;
    const P: Pt[] = [[cx + rx, cy], [cx + rx, cy + ry * k], [cx + rx * k, cy + ry], [cx, cy + ry], [cx - rx * k, cy + ry], [cx - rx, cy + ry * k], [cx - rx, cy],
      [cx - rx, cy - ry * k], [cx - rx * k, cy - ry], [cx, cy - ry], [cx + rx * k, cy - ry], [cx + rx, cy - ry * k], [cx + rx, cy]];
    const m = P.map((p) => this.map(p));
    let d = `M${num(m[0][0])} ${num(m[0][1])}`;
    for (let i = 1; i < m.length; i += 3) d += `C${[m[i], m[i + 1], m[i + 2]].map(([x, y]) => `${num(x)} ${num(y)}`).join(' ')}`;
    this.emit(d + 'Z', true, true);
  }
  rect(l: number, t: number, r: number, b: number, rw = 0, rh = 0) {
    if (rw > 0 && rh > 0) {
      const ax = Math.min(rw / 2, (r - l) / 2), ay = Math.min(rh / 2, (b - t) / 2), k = 0.4477;
      const P: Pt[] = [[l + ax, t], [r - ax, t], [r - ax * k, t], [r, t + ay * k], [r, t + ay], [r, b - ay], [r, b - ay * k], [r - ax * k, b], [r - ax, b], [l + ax, b], [l + ax * k, b], [l, b - ay * k], [l, b - ay], [l, t + ay], [l, t + ay * k], [l + ax * k, t], [l + ax, t]];
      const m = P.map((p) => this.map(p)), s = ([x, y]: Pt) => `${num(x)} ${num(y)}`;
      this.emit(`M${s(m[0])}L${s(m[1])}C${s(m[2])} ${s(m[3])} ${s(m[4])}L${s(m[5])}C${s(m[6])} ${s(m[7])} ${s(m[8])}L${s(m[9])}C${s(m[10])} ${s(m[11])} ${s(m[12])}L${s(m[13])}C${s(m[14])} ${s(m[15])} ${s(m[16])}Z`, true, true);
    } else this.emit(this.d([[l, t], [r, t], [r, b], [l, b]], true), true, true);
  }
  /** rop = operația cu care se pune poza: masca (ȘI) se înmulțește, poza peste mască (SAU / SAU-exclusiv) se luminează. */
  image(dib: Dib | null, x: number, y: number, w: number, h: number, rop = 0xcc0020, src?: [number, number, number, number]) {
    if (!dib) return;
    const [x1, y1] = this.map([x, y]), [x2, y2] = this.map([x + w, y + h]);
    const fx = x2 < x1, fy = y2 < y1, l = Math.min(x1, x2), t = Math.min(y1, y2), W = Math.abs(x2 - x1), H = Math.abs(y2 - y1);
    if (W < 0.5 || H < 0.5) return;
    const tr = fx || fy ? ` transform="translate(${num(fx ? 2 * l + W : 0)} ${num(fy ? 2 * t + H : 0)}) scale(${fx ? -1 : 1} ${fy ? -1 : 1})"` : '';
    const blend = BLEND[rop] ? ` style="mix-blend-mode:${BLEND[rop]}"` : '';
    // Doar o parte din poză (sursa decupată): un SVG interior cu viewBox pe bucata aceea.
    const [sx, sy, sw, sh] = src && src[2] > 0 && src[3] > 0 ? src : [0, 0, dib.w, dib.h];
    this.out.push(sx || sy || sw !== dib.w || sh !== dib.h
      ? `<g${tr}${blend}><svg x="${num(l)}" y="${num(t)}" width="${num(W)}" height="${num(H)}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none"><image width="${dib.w}" height="${dib.h}" preserveAspectRatio="none" href="${dib.url}"/></svg></g>`
      : `<image x="${num(l)}" y="${num(t)}" width="${num(W)}" height="${num(H)}" preserveAspectRatio="none"${tr}${blend} href="${dib.url}"/>`);
    this.drawn++;
  }
  /** Un dreptunghi plin cu pensula curentă (PatBlt), sau negru / alb după operația cerută. */
  patch(x: number, y: number, w: number, h: number, rop: number) {
    const color = rop === 0x42 ? '#000000' : rop === 0xff0062 ? '#ffffff' : rop === 0xf00021 ? this.brush.color : null;
    if (!color) return;
    const keep = this.brush, kp = this.pen;
    this.brush = { k: 'brush', color }; this.pen = { ...kp, none: true };
    this.rect(x, y, x + w, y + h);
    this.brush = keep; this.pen = kp;
  }
  textOut(p: Pt, s: string, dx?: number[]) {
    s = s.replace(/[\u0000-\u001f]/g, '');
    if (!s.trim()) return;
    const f = this.font, sc = this.scale(), size = Math.max(1, Math.abs(f.h) * sc * (f.h > 0 ? 0.8 : 1));
    const [x, y] = this.map(p);
    const va = this.align & 24, ha = this.align & 6;
    const base = va === 24 ? '' : va === 8 ? ' dominant-baseline="text-after-edge"' : ' dominant-baseline="text-before-edge"';
    const anchor = ha === 6 ? ' text-anchor="middle"' : ha === 2 ? ' text-anchor="end"' : '';
    const deco = [f.under ? 'underline' : '', f.strike ? 'line-through' : ''].filter(Boolean).join(' ');
    const len = dx && dx.length >= s.length ? dx.slice(0, s.length - 1).reduce((a, b) => a + b, 0) * sc : 0;
    const rot = f.esc ? ` transform="rotate(${num(-f.esc / 10)} ${num(x)} ${num(y)})"` : '';
    this.out.push(`<text x="${num(x)}" y="${num(y)}" font-family="${esc(f.face)}, sans-serif" font-size="${num(size)}"${f.weight >= 600 ? ' font-weight="bold"' : ''}${f.italic ? ' font-style="italic"' : ''}${deco ? ` text-decoration="${deco}"` : ''} fill="${this.text}"${base}${anchor}${rot}${len > 0 && s.length > 1 ? ` textLength="${num(len + size * 0.5)}" lengthAdjust="spacingAndGlyphs"` : ''} xml:space="preserve">${esc(s)}</text>`);
    this.drawn++;
  }
}

const BLEND: Record<number, string> = { 0x8800c6: 'multiply', 0x660046: 'lighten', 0xee0086: 'lighten' };

function penDash(style: number): string | undefined {
  return ({ 1: '4 2', 2: '1 1', 3: '4 1 1 1', 4: '4 1 1 1 1 1' } as Record<number, string>)[style & 15];
}

/** Un fișier .wmf → SVG (text), sau null dacă nu e WMF ori nu are nimic de desenat. */
export function wmfToSvg(data: Uint8Array): string | null {
  const d = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length < 18) return null;
  let at = 0, box: [number, number, number, number] | null = null;
  if (d.getUint32(0, true) === 0x9ac6cdd7) {
    box = [d.getInt16(6, true), d.getInt16(8, true), d.getInt16(10, true), d.getInt16(12, true)];
    at = 22;
  }
  if (data.length < at + 18 || ![1, 2].includes(d.getUint16(at, true)) || d.getUint16(at + 2, true) !== 9) return null;
  at += 18;
  // Fereastra (coordonatele logice): prima SETWINDOWEXT / ORG, altfel chenarul din antet.
  let org: Pt = box ? [box[0], box[1]] : [0, 0], ext: Pt = box ? [box[2] - box[0], box[3] - box[1]] : [0, 0];
  for (let p = at, gotO = false, gotE = false; p + 6 <= data.length && !(gotO && gotE);) {
    const size = d.getUint32(p, true) * 2, fn = d.getUint16(p + 4, true);
    if (size < 6 || fn === 0) break;
    if (fn === 0x020b && !gotO && p + 10 <= data.length) { org = [d.getInt16(p + 8, true), d.getInt16(p + 6, true)]; gotO = true; }
    if (fn === 0x020c && !gotE && p + 10 <= data.length) { ext = [d.getInt16(p + 8, true), d.getInt16(p + 6, true)]; gotE = true; }
    p += size;
  }
  if (!ext[0] || !ext[1]) return null;
  const k = OUT / Math.max(Math.abs(ext[0]), Math.abs(ext[1]));
  const W = Math.max(1, Math.round(Math.abs(ext[0]) * k)), H = Math.max(1, Math.round(Math.abs(ext[1]) * k));
  const win = { org, ext };
  const P = new Painter(
    ([x, y]) => [(x - win.org[0]) * W / win.ext[0], (y - win.org[1]) * H / win.ext[1]],
    () => Math.abs(W / win.ext[0]),
  );
  const i16 = (o: number) => d.getInt16(o, true), u16 = (o: number) => d.getUint16(o, true);
  const color = (o: number) => hex(data[o], data[o + 1], data[o + 2]);
  const pts = (o: number, n: number): Pt[] => Array.from({ length: n }, (_, i) => [i16(o + 4 * i), i16(o + 4 * i + 2)] as Pt);
  for (let p = at; p + 6 <= data.length;) {
    const size = d.getUint32(p, true) * 2, fn = u16(p + 4), q = p + 6;
    if (size < 6 || p + size > data.length) break;
    if (fn === 0) break;
    try {
      switch (fn) {
        case 0x020b: win.org = [i16(q + 2), i16(q)]; break;
        case 0x020c: win.ext = [i16(q + 2), i16(q)] as Pt; if (!win.ext[0] || !win.ext[1]) win.ext = ext; break;
        case 0x02fa: { const st = u16(q); P.add({ k: 'pen', color: color(q + 6), w: i16(q + 2), none: (st & 15) === 5, dash: penDash(st) }); break; }
        case 0x02fc: { const st = u16(q); P.add({ k: 'brush', color: st === 1 ? null : st === 0 || st === 2 ? color(q + 2) : '#c0c0c0' }); break; }
        case 0x02fb: {
          let face = decode(data.subarray(q + 18, Math.min(p + size, q + 50)), 'windows-1252');
          face = face.split('\0')[0].trim() || 'Arial';
          P.add({ k: 'font', h: i16(q), esc: i16(q + 4), weight: i16(q + 8), italic: !!data[q + 10], under: !!data[q + 11], strike: !!data[q + 12], face, cp: CHARSET_CP[data[q + 13]] ?? 'windows-1252' });
          break;
        }
        case 0x00f7: case 0x01f9: case 0x0142: case 0x06ff: P.add({ k: 'other' }); break;
        case 0x012d: P.select(P.objs[u16(q)]); break;
        case 0x01f0: P.objs[u16(q)] = null; break;
        case 0x0209: P.text = color(q); break;
        case 0x0106: P.winding = u16(q) === 2; break;
        case 0x012e: P.align = u16(q); break;
        case 0x001e: P.stack.push({ pen: P.pen, brush: P.brush, font: P.font, text: P.text, align: P.align, org: win.org, ext: win.ext }); break;
        case 0x0127: {
          const n = i16(q); let s: any;
          for (let i = 0; i < (n < 0 ? -n : 1); i++) s = P.stack.pop() ?? s;
          if (s) { P.pen = s.pen; P.brush = s.brush; P.font = s.font; P.text = s.text; P.align = s.align; win.org = s.org; win.ext = s.ext; }
          break;
        }
        case 0x0214: P.moveTo([i16(q + 2), i16(q)]); break;
        case 0x0213: P.lineTo([i16(q + 2), i16(q)]); break;
        case 0x0324: P.poly(pts(q + 2, u16(q)), true); break;
        case 0x0325: P.poly(pts(q + 2, u16(q)), false); break;
        case 0x0538: {
          const n = u16(q), counts = Array.from({ length: n }, (_, i) => u16(q + 2 + 2 * i));
          let o = q + 2 + 2 * n; const list: Pt[][] = [];
          for (const c of counts) { list.push(pts(o, c)); o += 4 * c; }
          P.polys(list);
          break;
        }
        case 0x041b: P.rect(i16(q + 6), i16(q + 4), i16(q + 2), i16(q)); break;
        case 0x0418: P.ellipse(i16(q + 6), i16(q + 4), i16(q + 2), i16(q)); break;
        case 0x061c: P.rect(i16(q + 10), i16(q + 8), i16(q + 6), i16(q + 4), i16(q + 2), i16(q)); break;
        case 0x0521: {
          const n = i16(q), s = decode(data.subarray(q + 2, q + 2 + n), P.font.cp), o = q + 2 + n + (n & 1);
          P.textOut([i16(o + 2), i16(o)], s);
          break;
        }
        case 0x0a32: {
          const y = i16(q), x = i16(q + 2), n = i16(q + 4), opt = u16(q + 6);
          let o = q + 8 + (opt & 6 ? 8 : 0);
          const s = decode(data.subarray(o, o + n), P.font.cp);
          o += n + (n & 1);
          const dx = o + 2 * n <= p + size ? Array.from({ length: n }, (_, i) => i16(o + 2 * i)) : undefined;
          P.textOut([x, y], s, dx);
          break;
        }
        case 0x041f: P.patch(i16(q + 10), i16(q + 8), i16(q + 6), i16(q + 4), d.getUint32(q, true)); break; // PATBLT
        case 0x0f43: { // STRETCHDIB
          const hdr = q + 22, hl = dibHeaderLen(d, hdr);
          P.image(dibUrl(data.subarray(hdr, hdr + hl), data.subarray(hdr + hl, p + size)), i16(q + 20), i16(q + 18), i16(q + 16), i16(q + 14), d.getUint32(q, true), [i16(q + 12), i16(q + 10), i16(q + 8), i16(q + 6)]);
          break;
        }
        case 0x0b41: case 0x0940: { // DIBSTRETCHBLT, DIBBITBLT
          const stretch = fn === 0x0b41, hdr = q + (stretch ? 20 : 16);
          if (hdr + 4 > p + size || size <= (stretch ? 28 : 24)) break;
          const hl = dibHeaderLen(d, hdr);
          const [h, w, y, x] = stretch ? [i16(q + 12), i16(q + 14), i16(q + 16), i16(q + 18)] : [i16(q + 8), i16(q + 10), i16(q + 12), i16(q + 14)];
          const src: [number, number, number, number] = stretch ? [i16(q + 10), i16(q + 8), i16(q + 6), i16(q + 4)] : [i16(q + 6), i16(q + 4), w, h];
          P.image(dibUrl(data.subarray(hdr, hdr + hl), data.subarray(hdr + hl, p + size)), x, y, w, h, d.getUint32(q, true), src);
          break;
        }
      }
    } catch { /* comandă tăiată: o sărim */ }
    p += size;
  }
  if (!P.drawn) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${P.out.join('')}</svg>`;
}

type Xf = [number, number, number, number, number, number];
const mul = (a: Xf, b: Xf): Xf => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
const ID: Xf = [1, 0, 0, 1, 0, 0];

/** Un fișier .emf → SVG (text), sau null dacă nu e EMF ori nu are nimic de desenat (de exemplu doar EMF+). */
export function emfToSvg(data: Uint8Array): string | null {
  const d = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length < 88 || d.getUint32(0, true) !== 1 || d.getUint32(40, true) !== 0x464d4520) return null;
  const i32 = (o: number) => d.getInt32(o, true), u32 = (o: number) => d.getUint32(o, true);
  const devX = i32(72), devY = i32(76), mmX = i32(80), mmY = i32(84);
  const pxmmX = devX > 0 && mmX > 0 ? devX / mmX : 3.78, pxmmY = devY > 0 && mmY > 0 ? devY / mmY : 3.78;
  // Chenarul desenului: Frame (sutimi de mm) adus la pixeli, altfel Bounds.
  let [l, t, r, b] = [i32(24), i32(28), i32(32), i32(36)].map((v, i) => v * (i % 2 ? pxmmY : pxmmX) / 100);
  if (r - l < 1 || b - t < 1) [l, t, r, b] = [i32(8), i32(12), i32(16) + 1, i32(20) + 1];
  if (r - l < 1 || b - t < 1) return null;
  const k = OUT / Math.max(r - l, b - t), W = Math.max(1, Math.round((r - l) * k)), H = Math.max(1, Math.round((b - t) * k));
  const st = { xf: ID, mode: 1, wo: [0, 0] as Pt, we: [1, 1] as Pt, vo: [0, 0] as Pt, ve: [1, 1] as Pt };
  const UNIT: Record<number, number> = { 2: 0.1, 3: 0.01, 4: 0.254, 5: 0.0254, 6: 25.4 / 1440 };
  const page = (): [number, number] => {
    if (st.mode === 7 || st.mode === 8) {
      let sx = st.we[0] ? st.ve[0] / st.we[0] : 1, sy = st.we[1] ? st.ve[1] / st.we[1] : 1;
      if (st.mode === 7) { const m = Math.min(Math.abs(sx), Math.abs(sy)); sx = Math.sign(sx) * m; sy = Math.sign(sy) * m; }
      return [sx, sy];
    }
    const u = UNIT[st.mode];
    return u ? [u * pxmmX, -u * pxmmY] : [1, 1];
  };
  const map = ([x, y]: Pt): Pt => {
    const X = x * st.xf[0] + y * st.xf[2] + st.xf[4], Y = x * st.xf[1] + y * st.xf[3] + st.xf[5];
    const [sx, sy] = page();
    return [((X - st.wo[0]) * sx + st.vo[0] - l) * k, ((Y - st.wo[1]) * sy + st.vo[1] - t) * k];
  };
  const P = new Painter(map, () => { const [sx] = page(); return Math.abs(sx * Math.hypot(st.xf[0], st.xf[1])) * k; });
  const STOCK: Record<number, Obj> = {
    0: { k: 'brush', color: '#ffffff' }, 1: { k: 'brush', color: '#c0c0c0' }, 2: { k: 'brush', color: '#808080' }, 3: { k: 'brush', color: '#404040' },
    4: { k: 'brush', color: '#000000' }, 5: { k: 'brush', color: null }, 6: { k: 'pen', color: '#ffffff', w: 0, none: false },
    7: { k: 'pen', color: '#000000', w: 0, none: false }, 8: { k: 'pen', color: '#000000', w: 0, none: true },
    18: { k: 'brush', color: '#ffffff' }, 19: { k: 'pen', color: '#000000', w: 0, none: false },
  };
  const color = (o: number) => hex(data[o], data[o + 1], data[o + 2]);
  const pL = (o: number, n: number): Pt[] => Array.from({ length: n }, (_, i) => [i32(o + 8 * i), i32(o + 8 * i + 4)] as Pt);
  const pS = (o: number, n: number): Pt[] => Array.from({ length: n }, (_, i) => [d.getInt16(o + 4 * i, true), d.getInt16(o + 4 * i + 2, true)] as Pt);
  const bmp = (p: number, offBmi: number, cbBmi: number, offBits: number, cbBits: number) =>
    cbBmi ? dibUrl(data.subarray(p + offBmi, p + offBmi + cbBmi), data.subarray(p + offBits, p + offBits + cbBits)) : null;
  for (let p = 0; p + 8 <= data.length;) {
    const type = u32(p), size = u32(p + 4);
    if (size < 8 || p + size > data.length) break;
    if (type === 14) break;
    const q = p + 8;
    try {
      switch (type) {
        case 9: st.we = [i32(q), i32(q + 4)]; break;
        case 10: st.wo = [i32(q), i32(q + 4)]; break;
        case 11: st.ve = [i32(q), i32(q + 4)]; break;
        case 12: st.vo = [i32(q), i32(q + 4)]; break;
        case 17: st.mode = u32(q); break;
        case 19: P.winding = u32(q) === 2; break;
        case 22: P.align = u32(q); break;
        case 24: P.text = color(q); break;
        case 35: st.xf = Array.from({ length: 6 }, (_, i) => d.getFloat32(q + 4 * i, true)) as Xf; break;
        case 36: {
          const m = Array.from({ length: 6 }, (_, i) => d.getFloat32(q + 4 * i, true)) as Xf, mode = u32(q + 24);
          st.xf = mode === 1 ? ID : mode === 2 ? mul(m, st.xf) : mode === 3 ? mul(st.xf, m) : m;
          break;
        }
        case 33: P.stack.push({ pen: P.pen, brush: P.brush, font: P.font, text: P.text, align: P.align, st: { ...st } }); break;
        case 34: {
          const n = i32(q); let s: any;
          for (let i = 0; i < (n < 0 ? -n : 1); i++) s = P.stack.pop() ?? s;
          if (s) { P.pen = s.pen; P.brush = s.brush; P.font = s.font; P.text = s.text; P.align = s.align; Object.assign(st, s.st); }
          break;
        }
        case 37: { const i = u32(q); P.select(i & 0x80000000 ? STOCK[i & 0x7fffffff] : P.objs[i]); break; }
        case 40: P.objs[u32(q)] = null; break;
        case 38: { const s = u32(q + 4); P.put(u32(q), { k: 'pen', color: color(q + 16), w: i32(q + 8), none: (s & 15) === 5, dash: penDash(s) }); break; }
        case 95: { const s = u32(q + 20); P.put(u32(q), { k: 'pen', color: color(q + 32), w: u32(q + 24), none: (s & 15) === 5 || u32(q + 28) === 1, dash: penDash(s) }); break; }
        case 39: { const s = u32(q + 4); P.put(u32(q), { k: 'brush', color: s === 1 ? null : s === 0 || s === 2 ? color(q + 8) : '#c0c0c0' }); break; }
        case 93: case 94: P.put(u32(q), { k: 'brush', color: '#c0c0c0' }); break; // pensule cu model: gri
        case 82: {
          const o = q + 4, face = String.fromCharCode(...Array.from({ length: 32 }, (_, i) => d.getUint16(o + 28 + 2 * i, true))).split('\0')[0].trim() || 'Arial';
          P.put(u32(q), { k: 'font', h: i32(o), esc: i32(o + 8), weight: i32(o + 16), italic: !!data[o + 20], under: !!data[o + 21], strike: !!data[o + 22], face, cp: 'utf-16le' });
          break;
        }
        case 27: P.moveTo([i32(q), i32(q + 4)]); break;
        case 54: P.lineTo([i32(q), i32(q + 4)]); break;
        case 2: case 85: { const n = u32(q + 16); P.bezier(type === 2 ? pL(q + 20, n) : pS(q + 20, n)); break; }
        case 5: case 88: { const n = u32(q + 16); P.bezier(type === 5 ? pL(q + 20, n) : pS(q + 20, n), P.cur); break; }
        case 3: case 86: case 4: case 87: {
          const n = u32(q + 16), pts = type === 3 || type === 4 ? pL(q + 20, n) : pS(q + 20, n), close = type === 3 || type === 86;
          if (P.path) { pts.forEach((pt, i) => (i ? P.lineTo(pt) : P.moveTo(pt))); if (close) P.path.push('Z'); }
          else P.poly(pts, close);
          break;
        }
        case 6: case 89: { const n = u32(q + 16); (type === 6 ? pL(q + 20, n) : pS(q + 20, n)).forEach((pt) => P.lineTo(pt)); break; }
        case 7: case 8: case 90: case 91: {
          const n = u32(q + 16), long = type === 7 || type === 8, close = type === 8 || type === 91;
          const counts = Array.from({ length: n }, (_, i) => u32(q + 24 + 4 * i));
          let o = q + 24 + 4 * n; const list: Pt[][] = [];
          for (const c of counts) { list.push(long ? pL(o, c) : pS(o, c)); o += c * (long ? 8 : 4); }
          if (close) P.polys(list); else list.forEach((pts) => P.poly(pts, false));
          break;
        }
        case 42: P.ellipse(i32(q), i32(q + 4), i32(q + 8), i32(q + 12)); break;
        case 43: P.rect(i32(q), i32(q + 4), i32(q + 8), i32(q + 12)); break;
        case 44: P.rect(i32(q), i32(q + 4), i32(q + 8), i32(q + 12), i32(q + 16), i32(q + 20)); break;
        case 59: P.path = []; break;
        case 61: P.path?.push('Z'); break;
        case 60: break;
        case 68: P.path = null; break;
        case 62: case 63: case 64: {
          const dd = P.path?.join('') ?? ''; P.path = null;
          if (/^M/.test(dd)) P.emit(dd, type !== 64, type !== 62);
          break;
        }
        case 67: P.path = null; break; // SELECTCLIPPATH: decupările nu le facem
        case 84: case 83: {
          const o = q + 28, n = u32(o + 8), off = u32(o + 12), offDx = u32(o + 36);
          const s = type === 84 ? String.fromCharCode(...Array.from({ length: n }, (_, i) => d.getUint16(p + off + 2 * i, true)))
            : decode(data.subarray(p + off, p + off + n), P.font.cp === 'utf-16le' ? 'windows-1252' : P.font.cp);
          const dx = offDx && p + offDx + 4 * n <= p + size ? Array.from({ length: n }, (_, i) => i32(p + offDx + 4 * i)) : undefined;
          P.textOut([i32(o), i32(o + 4)], s, dx);
          break;
        }
        case 81: P.image(bmp(p, u32(q + 40), u32(q + 44), u32(q + 48), u32(q + 52)), i32(q + 16), i32(q + 20), i32(q + 64), i32(q + 68), u32(q + 60), [i32(q + 24), i32(q + 28), i32(q + 32), i32(q + 36)]); break;
        case 76: case 77: {
          const [x, y, w, h] = [i32(q + 16), i32(q + 20), i32(q + 24), i32(q + 28)];
          if (u32(q + 80)) P.image(bmp(p, u32(q + 76), u32(q + 80), u32(q + 84), u32(q + 88)), x, y, w, h, u32(q + 32),
            [i32(q + 36), i32(q + 40), type === 77 ? i32(q + 92) : w, type === 77 ? i32(q + 96) : h]);
          else P.patch(x, y, w, h, u32(q + 32) >>> 16 === 0xf0 ? 0xf00021 : u32(q + 32));
          break;
        }
      }
    } catch { /* comandă tăiată: o sărim */ }
    p += size;
  }
  if (!P.drawn) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${P.out.join('')}</svg>`;
}

/** WMF sau EMF (după primii octeți) → SVG, sau null. */
export function metafileToSvg(data: Uint8Array): string | null {
  if (data.length < 8) return null;
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return v.getUint32(0, true) === 1 ? emfToSvg(data) : wmfToSvg(data);
}

/** Extensia (fără punct) e a unui metafișier? */
export const isMetafileExt = (ext: string) => /^(wmf|emf)$/i.test(ext);

/**
 * Un .wmf / .emf → poză data URL, gata de pus în document sau în foaie: PNG în fereastră (desenat pe un canvas, ca să se
 * poată salva înapoi în .docx / .xlsx), SVG în afara ei (teste). null dacă nu e metafișier sau n-are nimic de desenat.
 */
export async function metafileToUrl(data: Uint8Array, maxSide = 1200): Promise<string | null> {
  const svg = metafileToSvg(data);
  if (!svg) return null;
  if (typeof document === 'undefined') return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const im = new Image();
    im.src = url;
    await im.decode();
    const k = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.naturalWidth * k));
    c.height = Math.max(1, Math.round(im.naturalHeight * k));
    c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/png');
    c.width = 0;
    return out;
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}

/** Octeții dintr-un text base64. */
export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Pozele .wmf / .emf dintr-un HTML de document (data:image/x-wmf, x-emf…) → PNG; cele care nu se pot desena rămân cum erau. */
export async function htmlWithMetafiles(html: string): Promise<string> {
  const re = /src="data:image\/(?:x-)?(?:wmf|emf|msmetafile|windows-metafile);base64,([^"]+)"/g;
  const found = [...html.matchAll(re)];
  if (!found.length) return html;
  const urls = await Promise.all(found.map((m) => metafileToUrl(fromBase64(m[1])).catch(() => null)));
  let i = 0;
  return html.replace(re, (m) => { const u = urls[i++]; return u ? `src="${u}"` : m; });
}
