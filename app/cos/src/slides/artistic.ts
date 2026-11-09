// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Efectele artistice ale pozelor din Slides (ca Picture Format → Artistic Effects din PowerPoint): schiță în creion, acuarelă,
// pictură în ulei, margini strălucitoare etc. Folosesc filtrele din Imagini (images/filters.ts), pe pixelii pozei.
// Poza de dinainte rămâne în caseta pozei (`orig`), ca „Fără efect” sau alt efect să pornească mereu de la ea;
// la .pptx pleacă poza cu efectul aplicat, ca să arate la fel în orice program.
import { filterDefaults, filterPixels, type FilterId } from '../images/filters';
import { removeBackground } from '../images/noBackground';
import type { SlideEl } from './model';

export interface ArtFx { key: string; name: string; filter: FilterId; p?: Record<string, number>; post?: 'invert' | 'gray' }

export const ART_FX: ArtFx[] = [
  { key: 'pencil', name: 'Schiță în creion', filter: 'sketch' },
  { key: 'pencilgray', name: 'Creion pe gri', filter: 'sketch', p: { v: 15 } },
  { key: 'lines', name: 'Desen cu linii', filter: 'edges', post: 'gray' },
  { key: 'glow', name: 'Margini strălucitoare', filter: 'edges', post: 'invert' },
  { key: 'water', name: 'Acuarelă', filter: 'watercolor' },
  { key: 'oil', name: 'Pictură în ulei', filter: 'oil' },
  { key: 'cutout', name: 'Decupaj din hârtie', filter: 'cutout' },
  { key: 'pastel', name: 'Pasteluri', filter: 'cutout', p: { n: 6, r: 3 } },
  { key: 'hatch', name: 'Hașurare', filter: 'crosshatch' },
  { key: 'canvas', name: 'Pânză', filter: 'canvas' },
  { key: 'spatter', name: 'Stropire', filter: 'spatter' },
  { key: 'chalk', name: 'Cretă', filter: 'accented', p: { v: 80 } },
  { key: 'mosaic', name: 'Mozaic de cristale', filter: 'crystallize' },
  { key: 'dots', name: 'Puncte de culoare', filter: 'pointillize' },
  { key: 'grain', name: 'Granulație de film', filter: 'noise', p: { v: 18, mono: 1 } },
  { key: 'blur', name: 'Estompare', filter: 'gauss' },
  { key: 'emboss', name: 'Relief', filter: 'emboss' },
];

export const artOf = (key: string | undefined) => ART_FX.find((a) => a.key === key);

/** Pixelii de rază ai filtrelor sunt gândiți pentru o poză de ~800 px; la pozele mai mari cresc odată cu ea. */
export const artScale = (w: number, h: number) => Math.max(1, Math.max(w, h) / 800);

/** Efectul pe pixelii RGBA (fără pânză: folosit și în teste). */
export function artPixels(px: Uint8ClampedArray, w: number, h: number, fx: ArtFx): Uint8ClampedArray {
  const alpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = px[i * 4 + 3];
  const out = filterPixels(px, w, h, fx.filter, { ...filterDefaults(fx.filter), ...(fx.p ?? {}) }, artScale(w, h));
  // Transparența rămâne a pozei (de exemplu după „Elimină fundalul”): efectul schimbă doar culorile.
  for (let i = 0; i < alpha.length; i++) out[i * 4 + 3] = alpha[i];
  if (fx.post) for (let i = 0; i < out.length; i += 4) {
    if (fx.post === 'invert') { out[i] = 255 - out[i]; out[i + 1] = 255 - out[i + 1]; out[i + 2] = 255 - out[i + 2]; }
    else { const y = 0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2]; out[i] = out[i + 1] = out[i + 2] = y; }
  }
  return out;
}

/** Poza (data URL) cu efectul aplicat; pozele cu transparență rămân PNG, celelalte JPEG. */
export async function artImage(src: string, fx: ArtFx): Promise<string> {
  // onload, nu decode(): decode() nu se termină cât fereastra e ascunsă sau minimizată.
  const img = await new Promise<HTMLImageElement>((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => bad(new Error('Poza nu se poate citi.')); im.src = src; });
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx || !cv.width || !cv.height) throw new Error('Poza nu se poate citi.');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, cv.width, cv.height);
  data.data.set(artPixels(data.data, cv.width, cv.height, fx));
  ctx.putImageData(data, 0, 0);
  const png = /^data:image\/(png|gif|webp|svg)/.test(src);
  return cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.92);
}

/** Caseta pozei cu efectul ales (key gol = fără efect: revine poza de dinainte). */
export async function withArt(el: SlideEl, key: string): Promise<SlideEl> {
  const base = el.orig ?? el.src;
  if (!base) return el;
  const { orig: _o, art: _a, ...rest } = el;
  const fx = artOf(key);
  if (!fx) return { ...rest, src: base };
  return { ...rest, src: await artImage(base, fx), orig: base, art: fx.key };
}

/** Caseta pozei fără fundal (vezi images/noBackground.ts). Pornește mereu de la poza cu fundal, ca altă treaptă să nu taie din tăiat;
 *  un efect artistic ales înainte se pune din nou peste poza fără fundal. */
export async function withNoBg(el: SlideEl, tol: number): Promise<SlideEl> {
  const base = el.nobg ?? el.orig ?? el.src;
  if (!base) return el;
  return withNoBgCut(el, await removeBackground(base, tol));
}

/** Poza fără fundal, decupată deja (de exemplu cu zonele marcate de mână), pusă pe casetă; fundalul rămâne în `nobg`. */
export async function withNoBgCut(el: SlideEl, cut: string): Promise<SlideEl> {
  const base = el.nobg ?? el.orig ?? el.src;
  if (!base) return el;
  const fx = artOf(el.art);
  if (fx) return { ...el, src: await artImage(cut, fx), orig: cut, nobg: base };
  return { ...el, src: cut, nobg: base };
}

/** Fundalul pus înapoi (cu efectul artistic, dacă poza are unul). */
export async function withBgBack(el: SlideEl): Promise<SlideEl> {
  if (!el.nobg) return el;
  const { nobg, ...rest } = el;
  if (artOf(el.art)) return withArt({ ...rest, orig: nobg }, el.art!);
  return { ...rest, src: nobg };
}
