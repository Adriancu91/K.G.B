// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Elimină fundalul” dintr-o poză pusă în Docs sau în Slides (Remove Background din Word / PowerPoint), fără AI:
// fundalul e culoarea care domină marginile pozei; pornim de pe margini și luăm tot ce are o culoare apropiată
// și e legat de ele (ca „bagheta magică” din Imagini, background.ts). Merge la sigle, produse pe fundal simplu,
// poze de act pe perete. Un obiect care atinge marginea rămâne: pornim doar din punctele cu culoarea fundalului.
import { backgroundMask, edgeSeeds, maskCanvas, replaceBackground, workCopy, type Seed } from './background';

/** Cât de diferită poate fi o culoare ca să fie încă „fundal” (0–100). */
export const NOBG_LEVELS: [key: string, name: string, tol: number][] = [
  ['strict', 'Elimină fundalul (strict)', 10],
  ['normal', 'Elimină fundalul', 18],
  ['larg', 'Elimină fundalul (larg)', 30],
];

export const nobgTol = (key: string) => NOBG_LEVELS.find(([k]) => k === key)?.[2];

type Px = { width: number; height: number; data: Uint8ClampedArray };

/** Culoarea care domină marginile (pe trepte de 16, ca nuanțele apropiate să cadă în aceeași căsuță); null dacă marginea e transparentă. */
export function edgeColor(d: Px): [number, number, number] | null {
  const { width: w, height: h, data } = d;
  const count = new Map<number, { n: number; r: number; g: number; b: number }>();
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 128) return;
    const k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const c = count.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n++; c.r += data[i]; c.g += data[i + 1]; c.b += data[i + 2];
    count.set(k, c);
  };
  for (let x = 0; x < w; x++) { add(x, 0); if (h > 1) add(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { add(0, y); if (w > 1) add(w - 1, y); }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const c of count.values()) if (!best || c.n > best.n) best = c;
  return best ? [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)] : null;
}

/**
 * Masca fundalului (255 = fundal) pe pixelii dați și partea din poză pe care o acoperă (0–1).
 * Punctele de pornire sunt cele de pe margini care au culoarea fundalului (nu cele de pe obiectul care atinge marginea).
 */
export function autoBackground(d: Px, tol: number): { mask: Uint8Array; share: number; edge: number } {
  const { width: w, height: h, data } = d;
  const ref = edgeColor(d);
  if (!ref) return { mask: new Uint8Array(w * h), share: 0, edge: 0 };
  const lim = (tol / 100) * 441.7;
  // Cât din margine are culoarea fundalului: la o fotografie obișnuită marginea e pestriță și nu avem ce scoate.
  let near = 0, all = 0;
  const look = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const dr = data[i] - ref[0], dg = data[i + 1] - ref[1], db = data[i + 2] - ref[2];
    all++;
    if (data[i + 3] >= 128 && dr * dr + dg * dg + db * db <= lim * lim) near++;
  };
  for (let x = 0; x < w; x++) { look(x, 0); if (h > 1) look(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { look(0, y); if (w > 1) look(w - 1, y); }
  const seeds: Seed[] = edgeSeeds(w, h).filter(({ x, y }) => {
    const i = (y * w + x) * 4;
    const dr = data[i] - ref[0], dg = data[i + 1] - ref[1], db = data[i + 2] - ref[2];
    return data[i + 3] >= 128 && dr * dr + dg * dg + db * db <= lim * lim;
  });
  const mask = backgroundMask(d as ImageData, seeds, tol);
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) n++;
  return { mask, share: mask.length ? n / mask.length : 0, edge: all ? near / all : 0 };
}

/** De ce nu se poate elimina fundalul (mesajul arătat), sau null dacă masca e bună. */
export function nobgProblem(share: number, edge = 1): string | null {
  if (share < 0.01 || edge < 0.3) return 'Nu am găsit un fundal de o singură culoare la marginile pozei. Încearcă „Elimină fundalul (larg)” sau modulul Imagini (✨ Fundal), unde alegi tu locurile.';
  if (share > 0.97) return 'Aproape toată poza are culoarea fundalului. Încearcă „Elimină fundalul (strict)”.';
  return null;
}

/** Un semn tras cu pensula în „Marchează zonele” (Mark Areas to Keep / Remove): punctele, în pixelii copiei de lucru. */
export interface NobgMark { keep: boolean; pts: Seed[] }

/** Raza pensulei de marcat, în pixelii copiei de lucru (cam 1% din latura mare). */
export const markRadius = (w: number, h: number) => Math.max(3, Math.round(Math.max(w, h) * 0.012));

/** Pixelii legați de puncte, cu o culoare apropiată de a punctului din care pornesc, doar în dreptunghiul dat. */
function floodBox(d: Px, seeds: Seed[], tol: number, box: [number, number, number, number]): Uint8Array {
  const { width: w, height: h, data } = d;
  const [x0, y0, x1, y1] = [Math.max(0, box[0]), Math.max(0, box[1]), Math.min(w - 1, box[2]), Math.min(h - 1, box[3])];
  const mask = new Uint8Array(w * h);
  const lim2 = ((tol / 100) * 441.7) ** 2;
  const stack: number[] = [];
  for (const s of seeds) {
    const sx = Math.round(s.x), sy = Math.round(s.y);
    if (sx < x0 || sy < y0 || sx > x1 || sy > y1) continue;
    const start = sy * w + sx;
    if (mask[start]) continue;
    const r0 = data[start * 4], g0 = data[start * 4 + 1], b0 = data[start * 4 + 2];
    mask[start] = 255;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i - x) / w;
      const tryAt = (j: number) => {
        if (mask[j]) return;
        const dr = data[j * 4] - r0, dg = data[j * 4 + 1] - g0, db = data[j * 4 + 2] - b0;
        if (dr * dr + dg * dg + db * db <= lim2) { mask[j] = 255; stack.push(j); }
      };
      if (x > x0) tryAt(i - 1);
      if (x < x1) tryAt(i + 1);
      if (y > y0) tryAt(i - w);
      if (y < y1) tryAt(i + w);
    }
  }
  return mask;
}

/**
 * Masca fundalului după semnele trase de mână, peste masca automată, în ordinea lor (semnul de mai târziu are ultimul cuvânt).
 * „Elimină” (−): locul pensulei și tot ce are culoarea lui și e legat de el, oriunde în poză (de exemplu golul dintr-o literă „O”).
 * „Păstrează” (+): locul pensulei și culoarea lui legată de el, dar doar în preajma semnului, ca să nu aducă înapoi tot fundalul
 * când obiectul are aceeași culoare cu el.
 */
export function markedBackground(d: Px, base: Uint8Array, marks: NobgMark[], tol: number): Uint8Array {
  const { width: w, height: h } = d;
  const out = base.slice();
  const r = markRadius(w, h);
  for (const m of marks) {
    if (!m.pts.length) continue;
    const reach = m.keep ? r * 6 : Math.max(w, h);
    const xs = m.pts.map((p) => p.x), ys = m.pts.map((p) => p.y);
    const region = floodBox(d, m.pts, tol, [Math.min(...xs) - reach, Math.min(...ys) - reach, Math.max(...xs) + reach, Math.max(...ys) + reach]);
    const v = m.keep ? 0 : 255;
    for (let i = 0; i < region.length; i++) if (region[i]) out[i] = v;
    for (const p of m.pts) {
      for (let y = Math.max(0, Math.round(p.y - r)); y <= Math.min(h - 1, Math.round(p.y + r)); y++) {
        for (let x = Math.max(0, Math.round(p.x - r)); x <= Math.min(w - 1, Math.round(p.x + r)); x++) {
          if ((x - p.x) ** 2 + (y - p.y) ** 2 <= r * r) out[y * w + x] = v;
        }
      }
    }
  }
  return out;
}

/** Poza întreagă (data URL PNG) cu fundalul dat de masca de pe copia de lucru făcut transparent. */
export function cutWithMask(img: HTMLImageElement, mask: Uint8Array, w: number, h: number): string {
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  replaceBackground(ctx, maskCanvas(mask, w, h), cv.width, cv.height, null);
  return cv.toDataURL('image/png');
}

export const loadImg = (src: string) => new Promise<HTMLImageElement>((ok, bad) => {
  // onload, nu decode(): decode() nu se termină cât fereastra e ascunsă sau minimizată.
  const im = new Image();
  im.onload = () => ok(im);
  im.onerror = () => bad(new Error('Poza nu se poate citi.'));
  im.src = src;
});

/** Poza (data URL PNG) cu fundalul transparent. Aruncă o eroare cu mesaj clar dacă nu găsește fundalul. */
export async function removeBackground(src: string, tol: number): Promise<string> {
  const img = await loadImg(src);
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d');
  if (!ctx || !cv.width || !cv.height) throw new Error('Poza nu se poate citi.');
  ctx.drawImage(img, 0, 0);
  const wk = workCopy(cv);
  const { mask, share, edge } = autoBackground(wk.data, tol);
  const why = nobgProblem(share, edge);
  if (why) throw new Error(why);
  replaceBackground(ctx, maskCanvas(mask, wk.data.width, wk.data.height), cv.width, cv.height, null);
  return cv.toDataURL('image/png');
}
