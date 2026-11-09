// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Corecțiile și culoarea pozelor din Docs (ca Picture Format → Corrections / Color / Artistic Effects din Word):
// claritate, înmuiere, luminozitate, contrast, saturație, alb-negru, sepia, recolorare, plus efectele artistice din Slides.
// Ca la Stilul pozei, se aplică pe pixelii pozei din document (Ctrl+Z le anulează); poza rămâne la aceeași mărime.
import { filterDefaults, filterPixels, type FilterId } from '../images/filters';
import { artImage, artOf, artScale } from '../slides/artistic';

export interface PicCorrection { key: string; name: string; group: 'Claritate' | 'Lumină' | 'Culoare'; css?: string; filter?: FilterId; p?: Record<string, number> }

export const PIC_CORRECTIONS: PicCorrection[] = [
  { key: 'sharp25', name: 'Claritate +25%', group: 'Claritate', filter: 'unsharp', p: { v: 60, r: 1.5 } },
  { key: 'sharp50', name: 'Claritate +50%', group: 'Claritate', filter: 'unsharp', p: { v: 140, r: 1.5 } },
  { key: 'soft25', name: 'Înmuiere 25%', group: 'Claritate', filter: 'gauss', p: { r: 1 } },
  { key: 'soft50', name: 'Înmuiere 50%', group: 'Claritate', filter: 'gauss', p: { r: 2.5 } },
  { key: 'b+20', name: 'Luminozitate +20%', group: 'Lumină', css: 'brightness(1.2)' },
  { key: 'b+40', name: 'Luminozitate +40%', group: 'Lumină', css: 'brightness(1.4)' },
  { key: 'b-20', name: 'Luminozitate −20%', group: 'Lumină', css: 'brightness(0.8)' },
  { key: 'c+20', name: 'Contrast +20%', group: 'Lumină', css: 'contrast(1.2)' },
  { key: 'c+40', name: 'Contrast +40%', group: 'Lumină', css: 'contrast(1.4)' },
  { key: 'c-20', name: 'Contrast −20%', group: 'Lumină', css: 'contrast(0.8)' },
  { key: 'bc', name: 'Mai luminoasă și mai contrastată', group: 'Lumină', css: 'brightness(1.15) contrast(1.2)' },
  { key: 's0', name: 'Fără culori (saturație 0%)', group: 'Culoare', css: 'grayscale(1)' },
  { key: 's50', name: 'Culori stinse (saturație 50%)', group: 'Culoare', css: 'saturate(0.5)' },
  { key: 's150', name: 'Culori vii (saturație 150%)', group: 'Culoare', css: 'saturate(1.5)' },
  { key: 's200', name: 'Culori foarte vii (saturație 200%)', group: 'Culoare', css: 'saturate(2)' },
  { key: 'sepia', name: 'Sepia', group: 'Culoare', css: 'sepia(1)' },
  { key: 'warm', name: 'Tonuri calde', group: 'Culoare', css: 'sepia(0.3) saturate(1.3) hue-rotate(-10deg)' },
  { key: 'cool', name: 'Tonuri reci', group: 'Culoare', css: 'saturate(0.9) hue-rotate(15deg) brightness(1.03)' },
  { key: 'washout', name: 'Spălăcită (pentru fundal)', group: 'Culoare', css: 'contrast(0.35) brightness(1.55)' },
  { key: 'blue', name: 'Recolorare albastră', group: 'Culoare', css: 'grayscale(1) sepia(1) hue-rotate(180deg) saturate(2)' },
  { key: 'green', name: 'Recolorare verde', group: 'Culoare', css: 'grayscale(1) sepia(1) hue-rotate(60deg) saturate(1.8)' },
  { key: 'invert', name: 'Negativ', group: 'Culoare', css: 'invert(1)' },
];

const loadImg = (src: string) => new Promise<HTMLImageElement>((ok, bad) => {
  const im = new Image();
  im.onload = () => ok(im);
  im.onerror = () => bad(new Error('Poza nu se poate citi.'));
  im.src = src;
});

/** Poza (data URL) cu corecția aplicată; pozele cu transparență rămân PNG, celelalte JPEG. */
export async function correctImage(src: string, key: string): Promise<string> {
  const c = PIC_CORRECTIONS.find((x) => x.key === key);
  if (!c) return src;
  const img = await loadImg(src);
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx || !cv.width || !cv.height) throw new Error('Poza nu se poate citi.');
  if (c.css) ctx.filter = c.css;
  ctx.drawImage(img, 0, 0);
  if (c.filter) {
    const data = ctx.getImageData(0, 0, cv.width, cv.height);
    data.data.set(filterPixels(data.data, cv.width, cv.height, c.filter, { ...filterDefaults(c.filter), ...(c.p ?? {}) }, artScale(cv.width, cv.height)));
    ctx.putImageData(data, 0, 0);
  }
  const png = /^data:image\/(png|gif|webp|svg)/.test(src);
  return cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.92);
}

/** Efectul artistic (aceleași ca în Slides) pe poza din document. */
export async function artisticImage(src: string, key: string): Promise<string> {
  const fx = artOf(key);
  return fx ? artImage(src, fx) : src;
}
