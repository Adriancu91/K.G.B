// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fundal cu un click (fără AI): click pe fundal → se alege tot ce are o culoare apropiată și e legat de locul apăsat
// (ca „bagheta magică”). Merge bine la produse pe fundal simplu și la poze de act făcute pe un perete.
// Calculăm pe o copie micșorată (cel mult 1600 px), ca fiecare click să fie instant; masca se mărește apoi lin
// peste poza mare, deci marginile ies netede, nu în trepte.
export type Seed = { x: number; y: number };
export const WORK_SIDE = 1600;

/** Copia de lucru, micșorată, și raportul față de poza mare. */
export function workCopy(img: HTMLCanvasElement): { data: ImageData; k: number } {
  const k = Math.min(1, WORK_SIDE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  c.width = 0;
  return { data, k };
}

/** Puncte de pornire de-a lungul marginilor (pentru „Automat”: la poze de produs, marginile sunt de obicei fundal). */
export function edgeSeeds(w: number, h: number): Seed[] {
  const out: Seed[] = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const x = Math.round(((w - 1) * i) / n), y = Math.round(((h - 1) * i) / n);
    out.push({ x, y: 0 }, { x, y: h - 1 }, { x: 0, y }, { x: w - 1, y });
  }
  return out;
}

/**
 * Masca fundalului (255 = fundal), pe copia de lucru. Fiecare punct de pornire are culoarea lui de referință,
 * iar `tol` (0–100) spune cât de diferită poate fi o culoare ca să mai fie „fundal”.
 */
export function backgroundMask(d: ImageData, seeds: Seed[], tol: number): Uint8Array {
  const { width: w, height: h, data } = d;
  const mask = new Uint8Array(w * h);
  const limit = (tol / 100) * 441.7; // 441,7 = distanța dintre negru și alb
  const lim2 = limit * limit;
  const stack = new Int32Array(w * h);
  for (const s of seeds) {
    const sx = Math.max(0, Math.min(w - 1, Math.round(s.x))), sy = Math.max(0, Math.min(h - 1, Math.round(s.y)));
    const start = sy * w + sx;
    if (mask[start]) continue;
    const r0 = data[start * 4], g0 = data[start * 4 + 1], b0 = data[start * 4 + 2];
    const near = (i: number) => {
      const dr = data[i * 4] - r0, dg = data[i * 4 + 1] - g0, db = data[i * 4 + 2] - b0;
      return dr * dr + dg * dg + db * db <= lim2;
    };
    let top = 0;
    stack[top++] = start;
    mask[start] = 255;
    while (top) {
      const i = stack[--top];
      const x = i % w;
      if (x > 0 && !mask[i - 1] && near(i - 1)) { mask[i - 1] = 255; stack[top++] = i - 1; }
      if (x < w - 1 && !mask[i + 1] && near(i + 1)) { mask[i + 1] = 255; stack[top++] = i + 1; }
      if (i >= w && !mask[i - w] && near(i - w)) { mask[i - w] = 255; stack[top++] = i - w; }
      if (i + w < w * h && !mask[i + w] && near(i + w)) { mask[i + w] = 255; stack[top++] = i + w; }
    }
  }
  return mask;
}

/** Masca devine o pânză (alb opac = fundal), cu marginea netezită pe un pixel. */
export function maskCanvas(mask: Uint8Array, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const out = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += mask[yy * w + xx];
          n++;
        }
      }
      out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = 255;
      out.data[i * 4 + 3] = sum / n;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

/** Tablă de șah gri-albă, semnul obișnuit pentru „transparent”. */
export function checker(ctx: CanvasRenderingContext2D, size = 10): CanvasPattern {
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size * 2, size * 2);
  g.fillStyle = '#d1d5db';
  g.fillRect(0, 0, size, size);
  g.fillRect(size, size, size, size);
  return ctx.createPattern(c, 'repeat')!;
}

/**
 * Pune peste `ctx` (de mărime w × h) fundalul nou: transparent (fill = null) sau o culoare, doar unde e masca.
 * `paint` desenează în prealabil poza; aici doar tăiem fundalul și, la culoare, îl umplem.
 */
export function replaceBackground(ctx: CanvasRenderingContext2D, m: HTMLCanvasElement, w: number, h: number, fill: string | CanvasPattern | null) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(m, 0, 0, w, h);
  if (fill) {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}
