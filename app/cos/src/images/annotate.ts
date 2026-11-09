// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Adnotări peste poză (ca la capturile de ecran): săgeată, dreptunghi, evidențiere, text și pixelare (ascunderea datelor).
// Aceleași funcții desenează previzualizarea (pe ecran, micșorat) și rezultatul (pe poza mare), în pixelii pozei.
import type { Anchor } from './pen';
import { hyphenPoints } from '../hyphenRo';
export type Tool ='arrow' | 'line' | 'rect' | 'mark' | 'text' | 'pixel' | 'image' | 'ellipse' | 'step' | 'triangle' | 'polygon' | 'star' | 'heart' | 'bubble' | 'shape';

export const TOOLS: [Tool, string, string][] = [
  ['arrow', '↗ Săgeată', 'Trage de unde pornește până unde arată'],
  ['line', '╱ Linie', 'Trage o linie dreaptă (Shift: orizontală, verticală sau la 45°)'],
  ['rect', '▭ Dreptunghi', 'Trage un chenar în jurul unei zone'],
  ['ellipse', '◯ Cerc', 'Trage un cerc (elipsă) în jurul unei zone'],
  ['triangle', '△ Triunghi', 'Trage un triunghi (vârful sus, la mijloc)'],
  ['polygon', '⬡ Poligon', 'Trage un poligon regulat; câte laturi are alegi în bară (3–12)'],
  ['star', '☆ Stea', 'Trage o stea cu 5 colțuri'],
  ['heart', '♡ Inimă', 'Trage o inimă'],
  ['bubble', '💬 Bulă', 'Trage o bulă de dialog (coada jos, în stânga), apoi scrie în ea cu T Text'],
  ['step', '① Pași', 'Click în ordine: pune numerele 1, 2, 3… (pașii dintr-o captură de ecran)'],
  ['mark', '▬ Evidențiere', 'Trage peste text, ca un marker'],
  ['text', 'T Text', 'Click unde vrei textul (sau trage o casetă: rândurile se rup singure), scrie, apoi Enter; dublu clic pe un text pus îl schimbă'],
  ['pixel', '▦ Pixelare', 'Trage peste ce vrei să ascunzi (numere, CNP, fețe)'],
];

export const COLORS = ['#e11d48', '#f59e0b', '#16a34a', '#2563eb', '#111827', '#ffffff'];

/** Grosimea liniilor, după mărimea pozei (ca săgeata să se vadă și pe o poză de 12 MP). */
export const lineWidth = (w: number, h: number) => Math.max(3, Math.round(Math.min(w, h) / 200));
/** Mărimea textului, după mărimea pozei. */
export const textSize = (w: number, h: number) => Math.max(16, Math.round(Math.min(w, h) / 22));

export function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
  const a = Math.atan2(y2 - y1, x2 - x1), head = width * 4.5;
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Linia se oprește la baza vârfului, ca vârful să rămână ascuțit.
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(a) * head * 0.8, y2 - Math.sin(a) * head * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45));
  ctx.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Cum se pictează o formă: doar conturul, plină cu culoarea aleasă, sau plină cu o altă culoare și cu contur
 * (ca la formele cu Umplere și Contur separate). `fc` = culoarea umplerii la „plin + contur”.
 */
export type Fill = 'none' | 'solid' | 'both';
export const FILLS: [Fill, string, string][] = [
  ['none', '▢ Contur', 'Doar marginea formei'],
  ['solid', '■ Plin', 'Forma plină cu culoarea aleasă'],
  ['both', '▣ Plin + contur', 'Forma plină cu culoarea umplerii, cu marginea în culoarea aleasă'],
];
/** Formele care se pot umple (săgeata, linia, evidențierea și pixelarea nu). */
export const FILLABLE: Tool[] = ['rect', 'ellipse', 'triangle', 'polygon', 'star', 'heart', 'bubble', 'shape'];
export const DEFAULT_FILL_COLOR = '#fde68a';

/** Pictează drumul făcut deja în ctx după modul de umplere. */
function paintPath(ctx: CanvasRenderingContext2D, color: string, width: number, fill: Fill = 'none', fc = DEFAULT_FILL_COLOR) {
  if (fill !== 'none') {
    ctx.fillStyle = fill === 'solid' ? color : fc;
    ctx.fill();
  }
  if (fill !== 'solid') {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

export function drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, width: number, fill: Fill = 'none', fc?: string) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  paintPath(ctx, color, width, fill, fc);
  ctx.restore();
}

export function drawEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, width: number, fill: Fill = 'none', fc?: string) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
  paintPath(ctx, color, width, fill, fc);
  ctx.restore();
}

/** Linie dreaptă cu capete rotunde. */
export function drawLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** Cu Shift, capătul liniei (sau al săgeții) se lipește de cea mai apropiată direcție la 45°. */
export function snap45(x1: number, y1: number, x2: number, y2: number): [number, number] {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const a = Math.round(Math.atan2(y2 - y1, x2 - x1) / (Math.PI / 4)) * (Math.PI / 4);
  return [x1 + Math.round(Math.cos(a) * len * 1e6) / 1e6, y1 + Math.round(Math.sin(a) * len * 1e6) / 1e6];
}

/** Poligon regulat cu n laturi în dreptunghiul dat (triunghiul: vârful sus, baza jos, pe toată lățimea). */
export function drawPolygon(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number, color: string, width: number, fill: Fill = 'none', fc?: string) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (n === 3) {
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
  } else {
    // Cu număr impar de laturi vârful e sus; cu număr par latura de sus e orizontală (pătratul drept, hexagonul ca înainte).
    const start = n % 2 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / n;
    for (let i = 0; i < n; i++) {
      const a = start + (Math.PI * 2 * i) / n;
      const px = x + w / 2 + (w / 2) * Math.cos(a), py = y + h / 2 + (h / 2) * Math.sin(a);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
  }
  ctx.closePath();
  paintPath(ctx, color, width, fill, fc);
  ctx.restore();
}

/** Raza unui număr de pas, după mărimea textului. */
export const stepRadius = (size: number) => size * 0.75;

/** Număr de pas: cerc plin în culoarea aleasă, cu cifra albă (neagră pe alb și galben) în mijloc. */
export function drawStep(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string, label: string) {
  const r = stepRadius(size);
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(2, r / 8);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color === '#ffffff' || color === '#f59e0b' ? '#111827' : '#ffffff';
  ctx.font = `700 ${Math.round(r * (label.length > 1 ? 1.05 : 1.3))}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + r * 0.05);
  ctx.restore();
}

/** Marker: culoare transparentă care se „înmulțește” cu ce e dedesubt, deci textul rămâne citibil. */
export function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = color === '#ffffff' || color === '#111827' ? '#facc15' : color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Fonturile pentru text: [nume, familia CSS, grosimea]; toate vin cu Windows, deci nu încărcăm nimic. */
export const FONTS: [string, string, number][] = [
  ['Simplu', '"Segoe UI", system-ui, sans-serif', 600],
  ['Clasic', 'Georgia, "Times New Roman", serif', 700],
  ['Titlu (Impact)', 'Impact, "Arial Black", sans-serif', 400],
  ['De mână', '"Segoe Print", "Comic Sans MS", cursive', 700],
  ['Mașină de scris', 'Consolas, "Courier New", monospace', 600],
  // Fonturile de mai jos se adaugă la capăt, ca numerele celor de sus (salvate în fișiere) să rămână aceleași.
  ['Arial', 'Arial, "Liberation Sans", sans-serif', 400],
  ['Verdana', 'Verdana, "DejaVu Sans", sans-serif', 400],
  ['Tahoma', 'Tahoma, sans-serif', 400],
  ['Trebuchet', '"Trebuchet MS", sans-serif', 400],
  ['Calibri', 'Calibri, Carlito, sans-serif', 400],
  ['Cambria', 'Cambria, Caladea, serif', 400],
  ['Times', '"Times New Roman", Times, serif', 400],
  ['Subțire', '"Segoe UI Light", "Segoe UI", sans-serif', 300],
  ['Foarte gros', '"Arial Black", "Segoe UI Black", sans-serif', 900],
];
/**
 * Numărul fontului ține și stilul: f % 1000 = fontul din FONTS, iar miile sunt biți de stil (1 = aldin, 2 = cursiv),
 * ca aldinul și cursivul să ajungă peste tot unde ajunge fontul (desenare, măsurare, fișiere) fără câmpuri noi.
 */
export const FONT_BOLD = 1, FONT_ITALIC = 2;
export const fontIdx = (f: number) => (f >= 0 ? f % 1000 : 0);
export const fontStyle = (f: number) => (f >= 0 ? Math.floor(f / 1000) : 0);
export const withStyle = (f: number, st: number) => fontIdx(f) + st * 1000;
/** Grosimea literelor: cea a fontului, sau mai groasă la aldin. */
export const fontWeight = (f: number) => { const w = (FONTS[fontIdx(f)] ?? FONTS[0])[2]; return fontStyle(f) & FONT_BOLD ? (w < 600 ? 700 : 900) : w; };
export const fontCss = (f: number, size: number) => { const fam = (FONTS[fontIdx(f)] ?? FONTS[0])[1]; return `${fontStyle(f) & FONT_ITALIC ? 'italic ' : ''}${fontWeight(f)} ${size}px ${fam}`; };

/** Text cu contur (alb în jurul literelor închise, negru în jurul celor deschise), ca să se citească pe orice fundal. */
/** Alinierea rândurilor unui text pe mai multe rânduri (ca în panoul Paragraph): 0 = stânga, 1 = centru, 2 = dreapta, 3 = stânga-dreapta. */
export const TEXT_ALIGNS: [string, string][] = [['Stânga', 'left'], ['Centru', 'center'], ['Dreapta', 'right'], ['Stânga-dreapta (justificat)', 'justify']];
/**
 * Justificat: unde începe fiecare cuvânt al unui rând, ca rândul să umple lățimea w (spațiile se lărgesc egal).
 * Ultimul rând și rândurile cu un singur cuvânt rămân la stânga, cu spațiul obișnuit (space).
 */
export function justifyXs(widths: number[], w: number, space: number, last: boolean): number[] {
  const sum = widths.reduce((a, b) => a + b, 0);
  const gap = !last && widths.length > 1 ? Math.max(space, (w - sum) / (widths.length - 1)) : space;
  const xs: number[] = [];
  let x = 0;
  for (const wd of widths) { xs.push(x); x += wd + gap; }
  return xs;
}
/** Un rând scris cuvânt cu cuvânt, întins pe lățimea w (doar la justificat). */
function justLine(ctx: CanvasRenderingContext2D, line: string, x: number, y: number, w: number, last: boolean, draw: (t: string, x: number, y: number) => void) {
  const words = line.split(/ +/).filter(Boolean);
  const xs = justifyXs(words.map((t) => ctx.measureText(t).width), w, ctx.measureText(' ').width, last);
  words.forEach((t, k) => draw(t, x + xs[k], y));
}
/** Cât se mută rândul de lățime lw într-un bloc lat de w, după aliniere. */
export const alignOffset = (w: number, lw: number, align = 0) => (align === 1 ? (w - lw) / 2 : align === 2 ? w - lw : 0);

/**
 * Spațierea textului (din panoul Character): `ls` = spațiul în plus dintre litere, în miimi din mărimea literei (0 = normal,
 * negativ = mai strâns), `lh` = distanța dintre rânduri față de cea obișnuită (1 = normal, 2 = dublu).
 */
export const LS_MIN = -200, LS_MAX = 1000;
export const LINE_SPACINGS: [string, number][] = [['0,8', 0.8], ['1', 1], ['1,15', 1.15], ['1,5', 1.5], ['2', 2], ['2,5', 2.5], ['3', 3]];
export const clampLs = (ls: number) => Math.max(LS_MIN, Math.min(LS_MAX, Math.round(ls) || 0));
/** Pasul dintre rânduri, în pixeli. */
export const lineStep = (size: number, lh = 1) => size * 1.25 * (lh || 1);
const setLs = (ctx: CanvasRenderingContext2D, size: number, ls = 0) => { ctx.letterSpacing = ls ? `${(ls * size) / 1000}px` : '0px'; };

/**
 * Cel mai lung început al cuvântului, despărțit după silabe (regulile românești, hyphenRo.ts), care încape: [început + „-”, restul].
 * Semnele de punctuație de la capete rămân lipite de cuvânt. Null dacă nu se poate despărți sau nicio bucată nu încape.
 */
export function hyphenSplit(word: string, ok: (head: string) => boolean): [string, string] | null {
  const m = /^(\P{L}*)(\p{L}+)(\P{L}*)$/u.exec(word);
  if (!m) return null;
  const pts = hyphenPoints(m[2]).map((p) => p + m[1].length);
  for (let j = pts.length - 1; j >= 0; j--) {
    const head = word.slice(0, pts[j]) + '-';
    if (ok(head)) return [head, word.slice(pts[j])];
  }
  return null;
}

/**
 * Rândurile textului. Fără casetă (box = 0) sunt rândurile scrise; cu casetă de paragraf (Paragraph Type), fiecare rând scris
 * se rupe singur între cuvinte ca să încapă în lățimea box (un cuvânt mai lung decât caseta se rupe între litere).
 * `last` = rândul încheie un paragraf (la justificat rămâne la stânga); fără casetă, doar ultimul rând, ca înainte.
 */
export function layLines(ctx: CanvasRenderingContext2D, text: string, box = 0, fi = 0, hy = false): { lines: string[]; last: boolean[]; first: boolean[] } {
  const hard = text.split('\n');
  if (!(box > 0)) return { lines: hard, last: hard.map((_, i) => i === hard.length - 1), first: hard.map(() => true) };
  const lines: string[] = [], last: boolean[] = [], first: boolean[] = [];
  for (const para of hard) {
    let cur = '';
    const start = lines.length;
    const push = (s: string) => { lines.push(s); last.push(false); first.push(lines.length - 1 === start); };
    // Primul rând al paragrafului are mai puțin loc, cât retragerea lui.
    const fits = (s: string) => ctx.measureText(s).width <= box - (lines.length === start ? Math.min(fi, box * 0.8) : 0);
    for (const word of para.split(/ +/)) {
      let rest = word;
      for (;;) {
        const tryLine = cur ? cur + ' ' + rest : rest;
        if (fits(tryLine)) { cur = tryLine; break; }
        // Despărțirea în silabe: cât mai mult din cuvânt rămâne pe rând, cu cratimă la capăt.
        const h = hy ? hyphenSplit(rest, (head) => fits(cur ? cur + ' ' + head : head)) : null;
        if (h) { push(cur ? cur + ' ' + h[0] : h[0]); cur = ''; rest = h[1]; continue; }
        if (cur) { push(cur); cur = ''; continue; }
        // Cuvântul singur nu încape: îl rupem între litere.
        cur = rest;
        while (cur.length > 1 && !fits(cur)) {
          const ch = Array.from(cur);
          let n = ch.length - 1;
          while (n > 1 && !fits(ch.slice(0, n).join(''))) n--;
          push(ch.slice(0, n).join(''));
          cur = ch.slice(n).join('');
        }
        break;
      }
    }
    lines.push(cur);
    last.push(true);
    first.push(lines.length - 1 === start);
  }
  return { lines, last, first };
}

/**
 * Paragraful (din panoul Paragraph): `fi` = retragerea primului rând al fiecărui paragraf, `li` / `ri` = retragerea tuturor
 * rândurilor din stânga / din dreapta, `pb` / `pa` = spațiul în plus înainte / după fiecare paragraf, toate în pixelii pozei
 * (un paragraf = ce scrii până la Shift+Enter).
 */
export type ParaFmt = { fi?: number; pa?: number; li?: number; ri?: number; pb?: number; hy?: boolean };
export const PARA_MAX = 2000;
export const clampPara = (v: number) => Math.max(0, Math.min(PARA_MAX, Math.round(v) || 0));
/** Unde stă fiecare rând (dx, dy față de colțul textului), lățimea blocului și înălțimea lui. */
export function textLayout(ctx: CanvasRenderingContext2D, text: string, size: number, lh = 1, box = 0, pg: ParaFmt = {}) {
  const fi = clampPara(pg.fi ?? 0), pa = clampPara(pg.pa ?? 0), pb = clampPara(pg.pb ?? 0), step = lineStep(size, lh);
  // Retragerile din stânga și din dreapta: în casetă lasă cel puțin o cincime din lățime pentru text.
  let li = clampPara(pg.li ?? 0), ri = clampPara(pg.ri ?? 0);
  if (box > 0 && li + ri > box * 0.8) { const k = (box * 0.8) / (li + ri); li *= k; ri *= k; }
  const inner = box > 0 ? box - li - ri : 0;
  const { lines, last, first } = layLines(ctx, text, inner, fi, !!pg.hy);
  let par = 0;
  const rows = lines.map((s, i) => {
    const dx = li + (first[i] ? (inner > 0 ? Math.min(fi, inner * 0.8) : fi) : 0), dy = i * step + par * pa + (par + 1) * pb;
    // Paragraful se termină unde începe altul (fără casetă, fiecare rând scris e un paragraf).
    if (first[i + 1]) par++;
    return { s, dx, dy, last: last[i], w: 0 };
  });
  const blockW = box > 0 ? box : Math.max(...rows.map((r) => r.dx + ctx.measureText(r.s).width)) + ri;
  // Locul rândului pentru aliniere: de la retragerea lui până la retragerea din dreapta.
  for (const r of rows) r.w = Math.max(0, blockW - r.dx - ri);
  const h = rows[rows.length - 1].dy + size * 1.25;
  return { rows, blockW, h };
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, f = 0, band = false, vert = false, plain = false, align = 0, ls = 0, lh = 1, box = 0, pg: ParaFmt = {}) {
  if (vert) { drawVertText(ctx, text, x, y, size, color, f, band, plain, ls, lh); return; }
  ctx.save();
  ctx.font = fontCss(f, size);
  setLs(ctx, size, ls);
  ctx.textBaseline = 'top';
  // Lățimea blocului (pentru aliniere și bandă): a casetei de paragraf, sau a celui mai lung rând.
  const { rows, blockW, h } = textLayout(ctx, text, size, lh, box, pg);
  // Rândul i, aliniat în locul rămas după retragere.
  const put = (r: (typeof rows)[number], draw: (t: string, tx: number, ty: number) => void) => {
    if (align === 3) justLine(ctx, r.s, x + r.dx, y + r.dy, r.w, r.last, draw);
    else draw(r.s, x + r.dx + alignOffset(r.w, ctx.measureText(r.s).width, align), y + r.dy);
  };
  if (band) {
    // Bandă: dreptunghi rotunjit în culoarea aleasă, cu textul alb (sau negru pe culorile deschise), ca la anunțuri și Instagram.
    const pad = size * 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - pad, y - pad * 0.7, blockW + pad * 2, h + pad * 1.2, pad);
    ctx.fill();
    ctx.fillStyle = color === '#ffffff' || color === '#f59e0b' ? '#111827' : '#ffffff';
    rows.forEach((r) => put(r, (t, tx, ty) => ctx.fillText(t, tx, ty)));
    ctx.restore();
    return;
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size / 7);
  const light = color === '#ffffff' || color === '#f59e0b';
  ctx.strokeStyle = light ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
  ctx.fillStyle = color;
  rows.forEach((r) => put(r, (t, tx, ty) => { if (!plain) ctx.strokeText(t, tx, ty); ctx.fillText(t, tx, ty); }));
  ctx.restore();
}

/**
 * Mască de text (Type Mask): forma literelor ca listă de octeți cât poza (255 = în literă), fără conturul de lizibilitate.
 * Din ea se face o selecție în forma textului.
 */
export function textAlpha(text: string, x: number, y: number, size: number, f: number, vert: boolean, W: number, H: number, align = 0, ls = 0, lh = 1, box = 0, pg: ParaFmt = {}): Uint8Array {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  drawText(ctx, text, x, y, size, '#000000', f, false, vert, true, align, ls, lh, box, pg);
  const d = ctx.getImageData(0, 0, W, H).data;
  c.width = 0;
  const a = new Uint8Array(W * H);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] >= 128 ? 255 : 0;
  return a;
}

/** Simbolurile din panoul Ω (ca Glyphs): semne, săgeți, monede, matematică, puncte; se pun în text la cursor. */
export const GLYPHS: [string, string][] = [
  ['Semne', '© ® ™ § ¶ † ‡ • · … ‰ № ℮ ° ′ ″'],
  ['Ghilimele', '„ ” « » ‹ › ‘ ’ – —'],
  ['Săgeți', '← → ↑ ↓ ↔ ↕ ⇐ ⇒ ⇔ ➜ ➤ ↩ ↪ ⟳'],
  ['Monede', '€ $ £ ¥ ¢ ₽ ₺ ₹ ₿'],
  ['Matematică', '± × ÷ ≈ ≠ ≤ ≥ ∞ √ ∑ π µ Ω ∆ ½ ¼ ¾ ² ³'],
  ['Forme', '★ ☆ ♥ ♦ ♣ ♠ ● ○ ■ □ ▲ △ ◆ ◇ ✓ ✔ ✗ ✘ ☐ ☑ ☒'],
  ['Diverse', '☀ ☁ ☂ ☎ ✉ ✂ ✈ ⚑ ⚠ ♪ ♫ ☺ ☹ ✿ ❄ ⌚ ⌛'],
];

/** Pune simbolul g în text la poziția pos (sau la sfârșit) și întoarce textul nou și poziția cursorului de după el. */
export function insertGlyph(text: string, g: string, pos?: number | null, end?: number | null): { text: string; caret: number } {
  const a = pos == null ? text.length : Math.max(0, Math.min(text.length, pos));
  const b = end == null ? a : Math.max(a, Math.min(text.length, end));
  return { text: text.slice(0, a) + g + text.slice(b), caret: a + g.length };
}

/** Pasul pe verticală între litere și pe orizontală între coloane, la textul vertical. */
const V_STEP = 1.1, V_COL = 1.3;
/** Coloanele textului vertical: fiecare rând scris devine o coloană, prima în dreapta, următoarele spre stânga. */
/** La textul vertical, spațierea literelor lungește coloana, iar cea a rândurilor depărtează coloanele. */
export function vertLayout(ctx: CanvasRenderingContext2D, text: string, size: number, ls = 0, lh = 1) {
  const cols = text.split('\n').map((l) => Array.from(l));
  const charW = Math.max(size * 0.6, ...cols.flat().map((c) => ctx.measureText(c).width));
  const colStep = size * V_COL * (lh || 1), step = Math.max(size * 0.2, size * V_STEP + (ls * size) / 1000);
  const w = (cols.length - 1) * colStep + charW;
  const h = Math.max(1, ...cols.map((c) => c.length)) * step;
  return { cols, w, h, charW, colStep, step };
}
/** Text vertical (Vertical Type): literele una sub alta, centrate în coloană, cu contur sau pe bandă. */
function drawVertText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, f: number, band: boolean, plain = false, ls = 0, lh = 1) {
  ctx.save();
  ctx.font = fontCss(f, size);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const { cols, w, h, charW, colStep, step } = vertLayout(ctx, text, size, ls, lh);
  const light = color === '#ffffff' || color === '#f59e0b';
  if (band) {
    const pad = size * 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - pad, y - pad * 0.7, w + pad * 2, h + pad * 1.2, pad);
    ctx.fill();
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size / 7);
  ctx.strokeStyle = light ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
  ctx.fillStyle = band ? (light ? '#111827' : '#ffffff') : color;
  cols.forEach((col, ci) => {
    const cx = x + w - charW / 2 - ci * colStep;
    col.forEach((ch, i) => {
      if (!band && !plain) ctx.strokeText(ch, cx, y + i * step);
      ctx.fillText(ch, cx, y + i * step);
    });
  });
  ctx.restore();
}

/** O adnotare pusă pe poză, care rămâne mutabilă până la „Gata” (un strat simplu). */
export type Obj = { t: Tool; x1: number; y1: number; x2: number; y2: number; color: string; text?: string; k?: number; f?: number; band?: boolean; vert?: boolean; al?: number; pic?: HTMLCanvasElement; alpha?: number; blend?: GlobalCompositeOperation; fx?: 'shadow' | 'glow'; n?: number; fill?: Fill; fc?: string; ls?: number; lh?: number; bw?: number; fi?: number; pa?: number; li?: number; ri?: number; pb?: number; hy?: boolean; us?: { a: Anchor[]; closed: boolean } };

/** Câte laturi poate avea poligonul (implicit 6, ca hexagonul de dinainte). */
export const POLY_MIN = 3, POLY_MAX = 12, POLY_DEFAULT = 6;
export const polySides = (n: number | undefined) => Math.max(POLY_MIN, Math.min(POLY_MAX, Math.round(n ?? POLY_DEFAULT)));

/** Transparența pozelor puse peste poză (logo, filigran): opac, pe jumătate, abia vizibil. */
export const ALPHAS: [string, number][] = [['100%', 1], ['60%', 0.6], ['30%', 0.3]];
/**
 * Stilurile de strat Umbră (Drop Shadow) și Strălucire (Outer Glow), pe text și pe poza pusă peste.
 * `size` = mărimea obiectului în pixelii pozei; umbra din canvas nu se scalează cu transformarea, deci o înmulțim noi.
 */
export function applyFx(ctx: CanvasRenderingContext2D, fx: Obj['fx'], size: number) {
  if (!fx) return;
  const k = Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1;
  ctx.shadowColor = fx === 'glow' ? 'rgba(255, 236, 140, 0.95)' : 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = size * (fx === 'glow' ? 0.45 : 0.22) * k;
  ctx.shadowOffsetX = ctx.shadowOffsetY = fx === 'glow' ? 0 : size * 0.1 * k;
}

/** Modurile de amestec pentru poza pusă peste (Blend modes din Photoshop), pe grupe, cu numele din canvas. */
export const BLENDS: [string, [GlobalCompositeOperation, string][]][] = [
  ['Normal', [['source-over', 'Normal']]],
  ['Întunecă', [['darken', 'Întunecă (Darken)'], ['multiply', 'Înmulțire (Multiply)'], ['color-burn', 'Ardere culoare (Color Burn)']]],
  ['Luminează', [['lighten', 'Luminează (Lighten)'], ['screen', 'Ecran (Screen)'], ['color-dodge', 'Diluare culoare (Color Dodge)'], ['lighter', 'Adunare (Linear Dodge)']]],
  ['Contrast', [['overlay', 'Suprapunere (Overlay)'], ['soft-light', 'Lumină difuză (Soft Light)'], ['hard-light', 'Lumină puternică (Hard Light)']]],
  ['Comparație', [['difference', 'Diferență (Difference)'], ['exclusion', 'Excludere (Exclusion)']]],
  ['Componente', [['hue', 'Nuanță (Hue)'], ['saturation', 'Saturație (Saturation)'], ['color', 'Culoare (Color)'], ['luminosity', 'Luminozitate (Luminosity)']]],
];

/** Mărimea liniilor și a textului, ca înmulțitor față de mărimea potrivită pentru poză. */
export const SIZES: [string, number][] = [['S', 0.6], ['M', 1], ['L', 1.6], ['XL', 2.4]];

let measurer: CanvasRenderingContext2D | null = null;
/** Dreptunghiul ocupat de o adnotare (pentru selectare cu click și chenarul de selecție). */
export function objBox(o: Obj, size: number) {
  if (o.t === 'step') { const r = stepRadius(size); return { x: o.x1 - r, y: o.y1 - r, w: r * 2, h: r * 2 }; }
  // Poza pusă peste: colțul stânga-sus rămâne pe loc, iar mărimea (S…XL) o micșorează sau o mărește.
  if (o.t === 'image') return { x: o.x1, y: o.y1, w: (o.x2 - o.x1) * (o.k ?? 1), h: (o.y2 - o.y1) * (o.k ?? 1) };
  if (o.t === 'text') {
    measurer ??= document.createElement('canvas').getContext('2d')!;
    measurer.font = fontCss(o.f ?? 0, size);
    setLs(measurer, size, 0);
    if (o.vert) { const v = vertLayout(measurer, o.text ?? '', size, o.ls, o.lh); return { x: o.x1, y: o.y1, w: v.w, h: v.h }; }
    setLs(measurer, size, o.ls);
    const L = textLayout(measurer, o.text ?? '', size, o.lh, o.bw, o);
    return { x: o.x1, y: o.y1, w: L.blockW, h: L.h };
  }
  return { x: Math.min(o.x1, o.x2), y: Math.min(o.y1, o.y2), w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) };
}

/** E punctul (în pixelii pozei) pe adnotare? `tol` = cât de aproape trebuie să fie de o linie. */
export function hitObj(o: Obj, px: number, py: number, size: number, tol: number): boolean {
  const b = objBox(o, size);
  const inside = (pad: number) => px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad;
  if (o.t === 'arrow' || o.t === 'line') {
    const dx = o.x2 - o.x1, dy = o.y2 - o.y1, len2 = dx * dx + dy * dy || 1;
    const k = Math.max(0, Math.min(1, ((px - o.x1) * dx + (py - o.y1) * dy) / len2));
    return Math.hypot(px - (o.x1 + k * dx), py - (o.y1 + k * dy)) <= tol;
  }
  // La chenar contează doar marginea: în interior se poate trage altă formă.
  if (o.t === 'rect' && (o.fill ?? 'none') === 'none') return inside(tol) && !(px > b.x + tol && px < b.x + b.w - tol && py > b.y + tol && py < b.y + b.h - tol);
  return inside(tol / 2);
}

/** Pixelare: zona devine pătrățele mari, din care nu se mai poate citi nimic (nu e un blur care se poate „desface”). */
export function pixelate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  x = Math.max(0, Math.round(x));
  y = Math.max(0, Math.round(y));
  w = Math.min(ctx.canvas.width - x, Math.round(w));
  h = Math.min(ctx.canvas.height - y, Math.round(h));
  if (w < 2 || h < 2) return;
  const block = Math.max(8, Math.round(Math.min(ctx.canvas.width, ctx.canvas.height) / 60));
  const sw = Math.max(1, Math.ceil(w / block)), sh = Math.max(1, Math.ceil(h / block));
  const small = document.createElement('canvas');
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext('2d')!;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, sw, sh);
  ctx.save();
  // Pătrățelele de la margine ar ieși puțin din zonă: le tăiem la dreptunghiul cerut.
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, sw, sh, x, y, sw * block, sh * block);
  ctx.restore();
  small.width = 0;
}

/** Colțurile unei stele cu n vârfuri în dreptunghiul (x, y, w, h), cu primul vârf sus; raza interioară = 0,4 din cea exterioară. */
export function starPoints(x: number, y: number, w: number, h: number, n = 5, inner = 0.4): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n, r = i % 2 ? inner : 1;
    out.push([x + w / 2 + (w / 2) * r * Math.cos(a), y + h / 2 + (h / 2) * r * Math.sin(a)]);
  }
  return out;
}

function outline(ctx: CanvasRenderingContext2D, color: string, width: number, path: () => void, fill: Fill = 'none', fc?: string) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  path();
  paintPath(ctx, color, width, fill, fc);
  ctx.restore();
}

/** O formă proprie (customShapes.ts shapeSegs), cu același contur și aceeași umplere ca celelalte forme. */
export function drawSegs(ctx: CanvasRenderingContext2D, s: { start: [number, number]; segs: [number, number][][]; closed: boolean }, color: string, width: number, fill: Fill = 'none', fc?: string) {
  outline(ctx, color, width, () => {
    ctx.moveTo(s.start[0], s.start[1]);
    for (const [c1, c2, e] of s.segs) ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
    if (s.closed) ctx.closePath();
  }, fill, fc);
}

/** Formele în plus (Custom Shape): stea, inimă, bulă de dialog, desenate ca un contur de grosimea celorlalte. */
export function drawCustom(ctx: CanvasRenderingContext2D, t: 'star' | 'heart' | 'bubble', x: number, y: number, w: number, h: number, color: string, width: number, fill: Fill = 'none', fc?: string) {
  outline(ctx, color, width, () => {
    if (t === 'star') {
      starPoints(x, y, w, h).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
    } else if (t === 'heart') {
      // Două arce sus și vârful jos, din curbe Bézier.
      const cx = x + w / 2;
      ctx.moveTo(cx, y + h * 0.3);
      ctx.bezierCurveTo(cx, y, x, y, x, y + h * 0.3);
      ctx.bezierCurveTo(x, y + h * 0.6, cx, y + h * 0.8, cx, y + h);
      ctx.bezierCurveTo(cx, y + h * 0.8, x + w, y + h * 0.6, x + w, y + h * 0.3);
      ctx.bezierCurveTo(x + w, y, cx, y, cx, y + h * 0.3);
      ctx.closePath();
    } else {
      // Dreptunghi rotunjit (80% din înălțime) cu o coadă jos, în stânga.
      const bh = h * 0.8, r = Math.min(w, bh) * 0.2;
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + bh - r);
      ctx.quadraticCurveTo(x + w, y + bh, x + w - r, y + bh);
      ctx.lineTo(x + w * 0.4, y + bh);
      ctx.lineTo(x + w * 0.15, y + h);
      ctx.lineTo(x + w * 0.22, y + bh);
      ctx.lineTo(x + r, y + bh);
      ctx.quadraticCurveTo(x, y + bh, x, y + bh - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }, fill, fc);
}
