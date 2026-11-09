// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Formele din Docs (dreptunghi, cerc, săgeți, stea, balon de vorbire…). O formă e desenată ca SVG și pusă în document ca o imagine PNG,
// deci are tot ce au imaginile (mărime, aliniere, text în jur, legendă, mutare) și ajunge la fel în .docx, .odt, PDF și pagina web.
// Descrierea formei (felul, culorile) rămâne pe imagine, ca să poată fi recolorată oricând.

export type ShapeKind =
  | 'rect' | 'round' | 'ellipse' | 'triangle' | 'diamond' | 'pentagon' | 'star'
  | 'arrowRight' | 'arrowLeft' | 'arrowUp' | 'arrowDown' | 'arrowBoth' | 'line' | 'callout' | 'heart'
  | 'hexagon' | 'parallelogram' | 'trapezoid' | 'plus' | 'chevron' | 'rtTriangle' | 'star6';

export interface ShapeSpec {
  k: ShapeKind;
  /** Umplerea (#rrggbb) sau '' = fără umplere. */
  fill: string;
  /** Conturul (#rrggbb) sau '' = fără contur. */
  stroke: string;
  /** Grosimea conturului, în pixeli. */
  sw: number;
  /** Rotirile și oglindirile făcute pe formă (imageTransform.ts), refăcute după fiecare recolorare. */
  t?: string;
  /** Efectul formei: umbră, strălucire (în culoarea ei) sau margini estompate; lipsă = fără efect. */
  fx?: ShapeFx;
}

export type ShapeFx = 'shadow' | 'glow' | 'soft' | 'reflect' | 'bevel';
export const SHAPE_FX: [ShapeFx, string][] = [['shadow', 'Umbră'], ['glow', 'Strălucire'], ['soft', 'Margini estompate'], ['reflect', 'Reflexie'], ['bevel', 'Relief']];

/** Formele din meniu: felul, semnul din buton, numele și mărimea de pornire (lățime × înălțime, px). */
export const SHAPES: { k: ShapeKind; icon: string; name: string; w: number; h: number }[] = [
  { k: 'rect', icon: '▭', name: 'Dreptunghi', w: 200, h: 120 },
  { k: 'round', icon: '▢', name: 'Dreptunghi rotunjit', w: 200, h: 120 },
  { k: 'ellipse', icon: '◯', name: 'Cerc / elipsă', w: 140, h: 140 },
  { k: 'triangle', icon: '△', name: 'Triunghi', w: 150, h: 130 },
  { k: 'diamond', icon: '◇', name: 'Romb', w: 150, h: 150 },
  { k: 'pentagon', icon: '⬠', name: 'Pentagon', w: 150, h: 145 },
  { k: 'star', icon: '☆', name: 'Stea', w: 150, h: 145 },
  { k: 'heart', icon: '♡', name: 'Inimă', w: 150, h: 135 },
  { k: 'star6', icon: '✶', name: 'Stea cu 6 colțuri', w: 150, h: 150 },
  { k: 'hexagon', icon: '⬡', name: 'Hexagon', w: 160, h: 140 },
  { k: 'parallelogram', icon: '▱', name: 'Paralelogram', w: 200, h: 110 },
  { k: 'trapezoid', icon: '⏢', name: 'Trapez', w: 200, h: 120 },
  { k: 'rtTriangle', icon: '◺', name: 'Triunghi dreptunghic', w: 150, h: 130 },
  { k: 'plus', icon: '✚', name: 'Cruce', w: 140, h: 140 },
  { k: 'chevron', icon: '❯', name: 'Chevron', w: 180, h: 110 },
  { k: 'arrowRight', icon: '➡', name: 'Săgeată dreapta', w: 200, h: 100 },
  { k: 'arrowLeft', icon: '⬅', name: 'Săgeată stânga', w: 200, h: 100 },
  { k: 'arrowUp', icon: '⬆', name: 'Săgeată sus', w: 100, h: 180 },
  { k: 'arrowDown', icon: '⬇', name: 'Săgeată jos', w: 100, h: 180 },
  { k: 'arrowBoth', icon: '⬌', name: 'Săgeată dublă', w: 220, h: 100 },
  { k: 'line', icon: '╱', name: 'Linie', w: 240, h: 16 },
  { k: 'callout', icon: '💬', name: 'Balon de vorbire', w: 200, h: 140 },
];

const HEX = /^#[0-9a-f]{6}$/i;
const KINDS = new Set(SHAPES.map((s) => s.k));

/** Citește descrierea unei forme (din atributul imaginii); null dacă lipsește sau e stricată. */
export function parseShape(v: unknown): ShapeSpec | null {
  let o: unknown = v;
  if (typeof v === 'string') { try { o = JSON.parse(v); } catch { return null; } }
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  if (!KINDS.has(r.k as ShapeKind)) return null;
  const col = (c: unknown) => (typeof c === 'string' && HEX.test(c) ? c.toLowerCase() : '');
  const sw = Math.min(20, Math.max(0, Math.round(Number(r.sw) || 0)));
  const t = typeof r.t === 'string' ? r.t.replace(/[^rlhv]/g, '').slice(-16) : '';
  const fx = SHAPE_FX.find(([f]) => f === r.fx)?.[0];
  return { k: r.k as ShapeKind, fill: col(r.fill), stroke: col(r.stroke), sw, ...(t ? { t } : {}), ...(fx ? { fx } : {}) };
}

export function shapeSize(k: ShapeKind): { w: number; h: number } {
  const s = SHAPES.find((x) => x.k === k) ?? SHAPES[0];
  return { w: s.w, h: s.h };
}

const n = (v: number) => Math.round(v * 10) / 10;
const poly = (pts: [number, number][]) => `<polygon points="${pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}"/>`;

/** Desenul formei pe o suprafață w × h (conturul rămâne în interior). */
export function shapeSvg(spec: ShapeSpec, w: number, h: number): string {
  const sw = spec.stroke ? spec.sw : 0;
  // Cu efect, forma se strânge puțin, ca umbra / strălucirea să încapă în imagine.
  const e = spec.fx ? Math.max(4, Math.min(w, h) * 0.07) : 0;
  const p = sw / 2 + 1 + e;
  // Cu reflexie, forma ocupă 70% din înălțime, iar dedesubt e copia ei întoarsă, care se stinge.
  const refl = spec.fx === 'reflect';
  const W = w - 2 * p, H = (h - 2 * p) * (refl ? 0.7 : 1);
  const x0 = p, y0 = p, x1 = w - p, y1 = p + H, cx = w / 2, cy = p + H / 2;
  let body: string;
  switch (spec.k) {
    case 'rect': body = `<rect x="${n(x0)}" y="${n(y0)}" width="${n(W)}" height="${n(H)}"/>`; break;
    case 'round': { const r = Math.min(W, H) * 0.18; body = `<rect x="${n(x0)}" y="${n(y0)}" width="${n(W)}" height="${n(H)}" rx="${n(r)}" ry="${n(r)}"/>`; break; }
    case 'ellipse': body = `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(W / 2)}" ry="${n(H / 2)}"/>`; break;
    case 'triangle': body = poly([[cx, y0], [x1, y1], [x0, y1]]); break;
    case 'diamond': body = poly([[cx, y0], [x1, cy], [cx, y1], [x0, cy]]); break;
    case 'pentagon': body = poly([0, 1, 2, 3, 4].map((i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      return [cx + (W / 2) * Math.cos(a), y0 + H * 0.525 + (H * 0.525) * Math.sin(a)] as [number, number];
    }).map(([x, y]) => [x, Math.min(y1, y)] as [number, number])); break;
    case 'star': body = poly(Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 0.4 : 1;
      return [cx + (W / 2) * r * Math.cos(a), y0 + H * 0.525 + H * 0.525 * r * Math.sin(a)] as [number, number];
    }).map(([x, y]) => [x, Math.min(y1, y)] as [number, number])); break;
    case 'heart': body = `<path d="M${n(cx)},${n(y1)} C${n(x0 - W * 0.05)},${n(y0 + H * 0.55)} ${n(x0 + W * 0.05)},${n(y0 - H * 0.1)} ${n(cx)},${n(y0 + H * 0.25)} C${n(x1 - W * 0.05)},${n(y0 - H * 0.1)} ${n(x1 + W * 0.05)},${n(y0 + H * 0.55)} ${n(cx)},${n(y1)} Z"/>`; break;
    case 'arrowRight': { const t = y0 + H * 0.28, b = y1 - H * 0.28, hx = x1 - Math.min(W * 0.4, H); body = poly([[x0, t], [hx, t], [hx, y0], [x1, cy], [hx, y1], [hx, b], [x0, b]]); break; }
    case 'arrowLeft': { const t = y0 + H * 0.28, b = y1 - H * 0.28, hx = x0 + Math.min(W * 0.4, H); body = poly([[x1, t], [hx, t], [hx, y0], [x0, cy], [hx, y1], [hx, b], [x1, b]]); break; }
    case 'arrowUp': { const l = x0 + W * 0.28, r = x1 - W * 0.28, hy = y0 + Math.min(H * 0.4, W); body = poly([[l, y1], [l, hy], [x0, hy], [cx, y0], [x1, hy], [r, hy], [r, y1]]); break; }
    case 'arrowDown': { const l = x0 + W * 0.28, r = x1 - W * 0.28, hy = y1 - Math.min(H * 0.4, W); body = poly([[l, y0], [l, hy], [x0, hy], [cx, y1], [x1, hy], [r, hy], [r, y0]]); break; }
    case 'arrowBoth': { const t = y0 + H * 0.28, b = y1 - H * 0.28, hd = Math.min(W * 0.3, H); body = poly([[x0, cy], [x0 + hd, y0], [x0 + hd, t], [x1 - hd, t], [x1 - hd, y0], [x1, cy], [x1 - hd, y1], [x1 - hd, b], [x0 + hd, b], [x0 + hd, y1]]); break; }
    // 28.10: hexagon, paralelogram, trapez, triunghi dreptunghic, cruce, chevron și stea cu 6 colțuri (vârfurile interioare la 0,577).
    case 'hexagon': body = poly([[x0 + W * 0.25, y0], [x1 - W * 0.25, y0], [x1, cy], [x1 - W * 0.25, y1], [x0 + W * 0.25, y1], [x0, cy]]); break;
    case 'parallelogram': body = poly([[x0 + W * 0.25, y0], [x1, y0], [x1 - W * 0.25, y1], [x0, y1]]); break;
    case 'trapezoid': body = poly([[x0 + W * 0.2, y0], [x1 - W * 0.2, y0], [x1, y1], [x0, y1]]); break;
    case 'rtTriangle': body = poly([[x0, y0], [x1, y1], [x0, y1]]); break;
    case 'plus': { const a = W / 3, b = H / 3; body = poly([[x0 + a, y0], [x1 - a, y0], [x1 - a, y0 + b], [x1, y0 + b], [x1, y1 - b], [x1 - a, y1 - b], [x1 - a, y1], [x0 + a, y1], [x0 + a, y1 - b], [x0, y1 - b], [x0, y0 + b], [x0 + a, y0 + b]]); break; }
    case 'chevron': body = poly([[x0, y0], [x1 - W * 0.3, y0], [x1, cy], [x1 - W * 0.3, y1], [x0, y1], [x0 + W * 0.3, cy]]); break;
    case 'star6': body = poly(Array.from({ length: 12 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 6, r = i % 2 ? 0.577 : 1;
      return [cx + (W / 2) * r * Math.cos(a), cy + (H / 2) * r * Math.sin(a)] as [number, number];
    })); break;
    case 'line': body = `<line x1="${n(x0)}" y1="${n(cy)}" x2="${n(x1)}" y2="${n(cy)}"/>`; break;
    case 'callout': { const r = Math.min(W, H) * 0.15, bb = y0 + H * 0.75; body = `<path d="M${n(x0 + r)},${n(y0)} H${n(x1 - r)} Q${n(x1)},${n(y0)} ${n(x1)},${n(y0 + r)} V${n(bb - r)} Q${n(x1)},${n(bb)} ${n(x1 - r)},${n(bb)} H${n(x0 + W * 0.42)} L${n(x0 + W * 0.18)},${n(y1)} L${n(x0 + W * 0.26)},${n(bb)} H${n(x0 + r)} Q${n(x0)},${n(bb)} ${n(x0)},${n(bb - r)} V${n(y0 + r)} Q${n(x0)},${n(y0)} ${n(x0 + r)},${n(y0)} Z"/>`; break; }
    default: body = '';
  }
  // Linia nu are umplere: e trasă cu culoarea conturului (sau a umplerii, dacă nu are contur).
  const isLine = spec.k === 'line';
  const stroke = isLine ? spec.stroke || spec.fill || '#000000' : spec.stroke;
  const lw = isLine ? Math.max(2, spec.sw || 4) : sw;
  const fill = isLine ? 'none' : spec.fill || 'none';
  // Efectele, ca filtre SVG: umbra cade în jos-dreapta, strălucirea e în culoarea formei, marginile estompate se topesc în fundal.
  const glowCol = spec.fill || stroke || '#f59e0b';
  const filter = spec.fx === 'shadow' ? `<feDropShadow dx="${n(e * 0.5)}" dy="${n(e * 0.5)}" stdDeviation="${n(e * 0.35)}" flood-color="#000000" flood-opacity="0.35"/>`
    : spec.fx === 'glow' ? `<feDropShadow dx="0" dy="0" stdDeviation="${n(e * 0.4)}" flood-color="${glowCol}" flood-opacity="0.9"/>`
    : spec.fx === 'soft' ? `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(e * 0.45)}" result="b"/><feComposite in="SourceGraphic" in2="b" operator="in"/>`
    // Relieful: marginile încețoșate devin un „munte” luminat din stânga-sus; lumina se adaugă peste formă, doar în interiorul ei.
    : spec.fx === 'bevel' ? `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(e * 0.5)}" result="b"/><feSpecularLighting in="b" surfaceScale="${n(e * 0.9)}" specularConstant="0.9" specularExponent="18" lighting-color="#ffffff" result="s"><feDistantLight azimuth="225" elevation="40"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/><feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k1="0" k2="1" k3="0.85" k4="0"/>` : '';
  const defs = filter ? `<defs><filter id="fx" x="-25%" y="-25%" width="150%" height="150%">${filter}</filter></defs>` : '';
  const g = `<g id="sh" fill="${fill}" stroke="${stroke || 'none'}" stroke-width="${lw}" stroke-linejoin="round" stroke-linecap="round"${filter ? ' filter="url(#fx)"' : ''}>${body}</g>`;
  if (refl) {
    // Copia întoarsă față de baza formei, la 2 px dedesubt, cu masca care o stinge în jos.
    const gap = 2, top = y1 + gap, bot = h;
    const mask = `<defs><linearGradient id="rg" x1="0" y1="${n(top)}" x2="0" y2="${n(bot)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="rm" maskUnits="userSpaceOnUse" x="0" y="${n(top)}" width="${w}" height="${n(bot - top)}"><rect x="0" y="${n(top)}" width="${w}" height="${n(bot - top)}" fill="url(#rg)"/></mask></defs>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${mask}${g}<g mask="url(#rm)"><use href="#sh" xlink:href="#sh" transform="matrix(1 0 0 -1 0 ${n(2 * y1 + gap)})"/></g></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}${g}</svg>`;
}

/** Forma ca imagine PNG (de 2 ori mai mare, ca să fie clară la tipărire). Doar în fereastra aplicației (are nevoie de canvas). */
export async function shapeToPng(spec: ShapeSpec, w: number, h: number): Promise<string> {
  const svg = shapeSvg(spec, w, h);
  // onload, nu decode(): decode() poate să nu se termine cât fereastra e minimizată.
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('forma nu s-a putut desena'));
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
