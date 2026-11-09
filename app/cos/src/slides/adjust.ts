// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Ajustările pozelor din Slides: luminozitate, contrast, saturație și culoare (alb-negru / sepia).
// Pe ecran sunt un filtru CSS (poza din fișier rămâne neschimbată); la export (.pptx) se aplică pe pixeli, cu o pânză,
// ca poza să arate la fel în orice program. Din .pptx se citesc a:lum (luminozitate / contrast) și a:grayscl (alb-negru).

export interface ImgAdj {
  /** Luminozitatea: −100 … 100 (0 = neschimbată). */
  b?: number;
  /** Contrastul: −100 … 100 (0 = neschimbat). */
  c?: number;
  /** Saturația, în procente: 0 (fără culori) … 200 (lipsă = 100, neschimbată). */
  s?: number;
  /** Culoarea: alb-negru sau sepia (lipsă = culorile pozei). */
  tone?: 'gray' | 'sepia';
}

export const TONES: [NonNullable<ImgAdj['tone']> | '', string][] = [['', 'Culori normale'], ['gray', 'Alb-negru'], ['sepia', 'Sepia']];

const clampInt = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : undefined;

/** Ajustările curățate (din fișier sau din interfață); undefined dacă poza e neschimbată. */
export function cleanAdj(v: unknown): ImgAdj | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const out: ImgAdj = {};
  const b = clampInt(o.b, -100, 100), c = clampInt(o.c, -100, 100), s = clampInt(o.s, 0, 200);
  if (b) out.b = b;
  if (c) out.c = c;
  if (s !== undefined && s !== 100) out.s = s;
  if (o.tone === 'gray' || o.tone === 'sepia') out.tone = o.tone;
  return Object.keys(out).length ? out : undefined;
}

/** Filtrul CSS al ajustărilor ('' = niciunul). */
export function adjFilter(a: ImgAdj | undefined): string {
  if (!a) return '';
  const parts: string[] = [];
  if (a.b) parts.push(`brightness(${1 + a.b / 100})`);
  if (a.c) parts.push(`contrast(${1 + a.c / 100})`);
  if (a.s !== undefined && a.s !== 100) parts.push(`saturate(${a.s / 100})`);
  if (a.tone === 'gray') parts.push('grayscale(1)');
  if (a.tone === 'sepia') parts.push('sepia(1)');
  return parts.join(' ');
}

/** Poza cu ajustările aplicate pe pixeli (pentru export); dacă nu se poate (fără pânză), rămâne poza originală. */
export async function bakeAdj(src: string, a: ImgAdj | undefined): Promise<string> {
  const filter = adjFilter(a);
  if (!filter || typeof document === 'undefined') return src;
  try {
    // onload, nu decode(): decode() nu se termină cât fereastra e ascunsă sau minimizată.
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = src; });
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d');
    if (!ctx || !cv.width || !cv.height) return src;
    ctx.filter = filter;
    ctx.drawImage(img, 0, 0);
    // Pozele cu transparență rămân PNG; celelalte, JPEG (fișier mai mic).
    const png = src.startsWith('data:image/png') || src.startsWith('data:image/gif') || src.startsWith('data:image/webp');
    return cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.92);
  } catch {
    return src;
  }
}

/** Ajustările din a:blip-ul unei poze din .pptx: a:lum bright / contrast (în miimi de procent) și a:grayscl. */
export function adjOfBlip(blip: Element | null | undefined): ImgAdj | undefined {
  if (!blip) return undefined;
  let lum: Element | undefined, gray = false;
  for (const k of Array.from(blip.children)) {
    if (k.localName === 'lum') lum = k;
    if (k.localName === 'grayscl') gray = true;
  }
  const pct = (name: string) => {
    const v = lum?.getAttribute(name);
    return v && Number.isFinite(+v) ? Math.round(+v / 1000) : 0;
  };
  return cleanAdj({ b: pct('bright'), c: pct('contrast'), ...(gray ? { tone: 'gray' } : {}) });
}
