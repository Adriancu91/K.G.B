// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Rotirea (90° la dreapta / la stânga) și oglindirea (orizontal / vertical) unei imagini din Docs.
// Poza se redesenează rotită, deci ajunge la fel în .docx, .odt, PDF și pagina web, fără ca acele formate să știe de rotire.

export type ImageOp = 'r' | 'l' | 'h' | 'v';

/** Mărimea după operație: rotirile schimbă lățimea cu înălțimea. */
export function sizeAfter(op: ImageOp, w: number, h: number): { w: number; h: number } {
  return op === 'r' || op === 'l' ? { w: h, h: w } : { w, h };
}

/** Șirul de operații al unei forme, scurtat: 4 rotiri la fel sau 2 oglindiri la fel una după alta se anulează. */
export function addOp(ops: string, op: ImageOp): string {
  let s = (ops + op).replace(/[^rlhv]/g, '');
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/rl|lr|hh|vv|rrrr|llll/g, '');
  }
  return s.slice(-16);
}

const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const im = new Image();
  // onload, nu decode(): decode() poate să nu se termine cât fereastra e minimizată.
  im.onload = () => resolve(im);
  im.onerror = () => reject(new Error('imaginea nu s-a putut citi'));
  im.src = src;
});

/** Aplică o operație pe imagine; fotografiile rămân JPEG, restul PNG (cu transparență). */
export async function transformImage(src: string, op: ImageOp): Promise<{ src: string; w: number; h: number }> {
  const im = await load(src);
  const { w, h } = sizeAfter(op, im.naturalWidth, im.naturalHeight);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  if (op === 'r') { g.translate(w, 0); g.rotate(Math.PI / 2); }
  else if (op === 'l') { g.translate(0, h); g.rotate(-Math.PI / 2); }
  else if (op === 'h') { g.translate(w, 0); g.scale(-1, 1); }
  else { g.translate(0, h); g.scale(1, -1); }
  g.drawImage(im, 0, 0);
  const jpeg = /^data:image\/jpe?g/i.test(src);
  return { src: jpeg ? c.toDataURL('image/jpeg', 0.92) : c.toDataURL('image/png'), w, h };
}

/** Aplică pe rând un șir de operații (pentru formele redesenate după recolorare). */
export async function applyOps(src: string, ops: string): Promise<string> {
  let s = src;
  for (const op of ops) if ('rlhv'.includes(op)) s = (await transformImage(s, op as ImageOp)).src;
  return s;
}

/** Cât se taie din fiecare margine, ca parte din lățime / înălțime (0 = nimic, 0.25 = un sfert). */
export interface Insets { l: number; t: number; r: number; b: number }
/** Cel mai mic rest după decupare: 5% din latură. */
export const CROP_MIN = 0.05;

/** Marginile aduse în limite: niciuna negativă și rămâne cel puțin CROP_MIN din fiecare latură. */
export function clampInsets(ins: Insets): Insets {
  const c = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
  let { l, t, r, b } = { l: c(ins.l), t: c(ins.t), r: c(ins.r), b: c(ins.b) };
  if (l + r > 1 - CROP_MIN) { const k = (1 - CROP_MIN) / (l + r); l *= k; r *= k; }
  if (t + b > 1 - CROP_MIN) { const k = (1 - CROP_MIN) / (t + b); t *= k; b *= k; }
  return { l, t, r, b };
}

/** Dreptunghiul păstrat, în pixelii pozei. */
export function cropRect(w: number, h: number, ins: Insets): { sx: number; sy: number; sw: number; sh: number } {
  const { l, t, r, b } = clampInsets(ins);
  const sx = Math.round(w * l), sy = Math.round(h * t);
  return { sx, sy, sw: Math.max(1, Math.round(w * (1 - r)) - sx), sh: Math.max(1, Math.round(h * (1 - b)) - sy) };
}

/** Decupează poza: rămâne doar dreptunghiul din interiorul marginilor. */
export async function cropImage(src: string, ins: Insets): Promise<{ src: string; w: number; h: number }> {
  const im = await load(src);
  const { sx, sy, sw, sh } = cropRect(im.naturalWidth, im.naturalHeight, ins);
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  c.getContext('2d')!.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
  const jpeg = /^data:image\/jpe?g/i.test(src);
  return { src: jpeg ? c.toDataURL('image/jpeg', 0.92) : c.toDataURL('image/png'), w: sw, h: sh };
}

/** Stilurile de poză din bara imaginii (aplicate o dată pe poză; Ctrl+Z le scoate). */
export const PICTURE_STYLES: [PictureStyle, string][] = [
  ['thin', 'Chenar subțire'], ['frame', 'Ramă albă'], ['shadow', 'Umbră'], ['rounded', 'Colțuri rotunjite'], ['oval', 'Oval'],
  ['glow', 'Strălucire'], ['soft', 'Margini estompate'], ['reflection', 'Reflexie'],
  ['dashed', 'Chenar întrerupt'], ['bevel', 'Relief'], ['perspL', 'Perspectivă stânga'], ['perspR', 'Perspectivă dreapta'],
];
export type PictureStyle = 'thin' | 'frame' | 'shadow' | 'rounded' | 'oval' | 'glow' | 'soft' | 'reflection' | 'dashed' | 'bevel' | 'perspL' | 'perspR';

/** Marginea adăugată în jurul pozei (px, pe fiecare parte) de un stil; 0 = poza rămâne la fel de mare. */
export function stylePad(style: PictureStyle, w: number, h: number): number {
  const m = Math.min(w, h);
  return style === 'frame' ? Math.max(6, Math.round(m * 0.05)) : style === 'shadow' || style === 'glow' ? Math.max(8, Math.round(m * 0.06)) : 0;
}

/** Aplică un stil pe poză: chenar, ramă, umbră sau decupare rotunjită / ovală (cu transparență, deci PNG). */
/** `border`: chenarul ales de mână (culoarea și grosimea în pixelii de pe ecran; `shownW` = lățimea pozei pe ecran). */
export async function styleImage(src: string, style: PictureStyle, border?: { color: string; px: number; shownW?: number }): Promise<{ src: string; w: number; h: number; pad: number }> {
  const im = await load(src);
  const w = im.naturalWidth, h = im.naturalHeight, m = Math.min(w, h);
  const pad = stylePad(style, w, h);
  const c = document.createElement('canvas');
  c.width = w + 2 * pad;
  // Reflexia: sub poză, o copie întoarsă care se stinge, cât 40% din înălțime (lățimea rămâne).
  const refl = style === 'reflection' ? Math.round(h * 0.4) : 0, gap = refl ? Math.max(2, Math.round(m * 0.01)) : 0;
  c.height = h + 2 * pad + gap + refl;
  const g = c.getContext('2d')!;
  if (style === 'glow') {
    // Strălucire aurie în jurul pozei (de două ori, ca să fie plină).
    g.shadowColor = 'rgba(245, 158, 11, 0.85)';
    g.shadowBlur = pad * 0.9;
    g.drawImage(im, pad, pad);
    g.drawImage(im, pad, pad);
    g.shadowColor = 'transparent';
    g.drawImage(im, pad, pad);
  } else if (style === 'soft') {
    // Margini estompate: poza se topește spre transparent pe margini (o mască albă cu marginile încețoșate).
    const f = Math.max(3, Math.round(m * 0.05));
    const mask = document.createElement('canvas');
    mask.width = w;
    mask.height = h;
    const mg = mask.getContext('2d')!;
    mg.filter = `blur(${f}px)`;
    mg.fillStyle = '#ffffff';
    mg.fillRect(f * 1.5, f * 1.5, w - f * 3, h - f * 3);
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = 'source-over';
  } else if (style === 'reflection') {
    g.drawImage(im, 0, 0);
    // Copia întoarsă (doar partea de jos a pozei), cu transparența crescând în jos.
    const r = document.createElement('canvas');
    r.width = w;
    r.height = refl;
    const rg = r.getContext('2d')!;
    rg.translate(0, refl);
    rg.scale(1, -1);
    rg.drawImage(im, 0, h - refl, w, refl, 0, 0, w, refl);
    rg.setTransform(1, 0, 0, 1, 0, 0);
    const grad = rg.createLinearGradient(0, 0, 0, refl);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    rg.globalCompositeOperation = 'destination-in';
    rg.fillStyle = grad;
    rg.fillRect(0, 0, w, refl);
    g.drawImage(r, 0, h + gap);
  } else if (style === 'frame') {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(im, pad, pad);
    g.strokeStyle = '#b8b8c0';
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
  } else if (style === 'shadow') {
    g.shadowColor = 'rgba(0, 0, 0, 0.45)';
    g.shadowBlur = pad * 0.8;
    g.shadowOffsetX = g.shadowOffsetY = pad * 0.35;
    g.fillStyle = '#ffffff';
    g.fillRect(pad * 0.6, pad * 0.6, w, h);
    g.shadowColor = 'transparent';
    g.drawImage(im, pad * 0.6, pad * 0.6);
  } else if (style === 'bevel') {
    // Relief: marginile de sus și din stânga luminate, cele de jos și din dreapta umbrite, ca o placă ridicată.
    g.drawImage(im, 0, 0);
    const b = Math.max(4, Math.round(m * 0.045));
    const side = (pts: number[], fill: string) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fillStyle = fill; g.fill(); };
    side([0, 0, w, 0, w - b, b, b, b], 'rgba(255, 255, 255, 0.5)');
    side([0, 0, b, b, b, h - b, 0, h], 'rgba(255, 255, 255, 0.32)');
    side([0, h, b, h - b, w - b, h - b, w, h], 'rgba(0, 0, 0, 0.38)');
    side([w, 0, w, h, w - b, h - b, w - b, b], 'rgba(0, 0, 0, 0.26)');
  } else if (style === 'perspL' || style === 'perspR') {
    // Perspectivă 3-D: poza rotită în jurul axei verticale; latura din spate e mai scurtă (80%) și mai apropiată (lățimea scade la 88%).
    // Se desenează pe coloane de un pixel, fiecare cu înălțimea ei; colțurile rămase goale sunt transparente.
    const W = Math.round(w * 0.88);
    for (let x = 0; x < W; x++) {
      const t = x / Math.max(1, W - 1), near = style === 'perspL' ? t : 1 - t;
      const s = 0.8 + 0.2 * near;
      // Partea din spate se strânge mai mult (pasul în poză crește spre spate), ca în perspectiva adevărată.
      const u = style === 'perspL' ? (Math.sqrt(0.8 * 0.8 + (1 - 0.64) * t) - 0.8) / 0.2 : 1 - (Math.sqrt(0.8 * 0.8 + (1 - 0.64) * (1 - t)) - 0.8) / 0.2;
      const sx = Math.min(w - 1, Math.max(0, Math.floor(u * w)));
      const dh = h * s;
      g.drawImage(im, sx, 0, 1, h, x + (w - W) / 2, (h - dh) / 2, 1.5, dh);
    }
  } else if (style === 'thin' || style === 'dashed') {
    g.drawImage(im, 0, 0);
    const lw = border ? Math.max(1, Math.round(border.px * (border.shownW ? w / border.shownW : 1))) : Math.max(2, Math.round(m * 0.008));
    g.strokeStyle = border && /^#[0-9a-f]{6}$/i.test(border.color) ? border.color : '#33333d';
    g.lineWidth = lw;
    if (style === 'dashed') g.setLineDash([lw * 3, lw * 2]);
    g.strokeRect(lw / 2, lw / 2, w - lw, h - lw);
  } else {
    g.beginPath();
    if (style === 'oval') g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else g.roundRect(0, 0, w, h, Math.round(m * 0.1));
    g.clip();
    g.drawImage(im, 0, 0);
  }
  const keepJpeg = /^data:image\/jpe?g/i.test(src) && (style === 'thin' || style === 'frame' || style === 'dashed' || style === 'bevel');
  return { src: keepJpeg ? c.toDataURL('image/jpeg', 0.92) : c.toDataURL('image/png'), w: c.width, h: c.height, pad };
}
