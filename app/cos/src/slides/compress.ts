// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Comprimare imagini (Compress Pictures): pozele de pe slide se micșorează la rezoluția aleasă, după mărimea lor pe slide
// (96 px pe slide = 1 inci), iar părțile decupate se pot tăia de-adevăratelea. Ca fișierul prezentării să fie mai mic
// (de trimis pe e-mail, de pus pe web). Poza nouă se păstrează doar dacă iese mai mică decât cea veche.
import type { Deck, SlideEl } from './model';
import { fullBox } from './crop';

/** [ppi, numele din fereastră]. */
export const COMPRESS_PPI: [number, string][] = [
  [330, 'Înaltă fidelitate (330 ppi): pentru ecrane foarte clare'],
  [220, 'Tipărire (220 ppi): calitate foarte bună la tipărire'],
  [150, 'Web (150 ppi): bună pentru pagini web și proiectoare'],
  [96, 'E-mail (96 ppi): fișiere cât mai mici de trimis'],
];

export interface CompressOpts { ppi: number; dropCrop: boolean }

/** Pozele care se pot comprima (nu ecuațiile și desenele de mână, care se refac din text / linii). */
export const canCompress = (e: SlideEl) => e.kind === 'image' && !!e.src?.startsWith('data:image/') && !e.eq && !e.ink;

const loadImg = (src: string) => new Promise<HTMLImageElement>((ok, bad) => {
  const im = new Image();
  im.onload = () => ok(im);
  im.onerror = () => bad(new Error('Poza nu s-a putut citi.'));
  im.src = src;
});

/** O poză (data URL) micșorată de `k` ori, cu partea `cut` (fracții din fiecare latură) tăiată; null = n-are rost (n-ar scădea). */
export async function shrinkData(src: string, k: number, cut?: { l: number; t: number; r: number; b: number }): Promise<string | null> {
  if (!cut && k >= 0.999) return null;
  const im = await loadImg(src);
  const W = im.naturalWidth, H = im.naturalHeight;
  if (!W || !H) return null;
  const sx = Math.round((cut?.l ?? 0) * W), sy = Math.round((cut?.t ?? 0) * H);
  const sw = Math.max(1, Math.round(W * (1 - (cut?.l ?? 0) - (cut?.r ?? 0)))), sh = Math.max(1, Math.round(H * (1 - (cut?.t ?? 0) - (cut?.b ?? 0))));
  const w = Math.max(1, Math.round(sw * Math.min(1, k))), h = Math.max(1, Math.round(sh * Math.min(1, k)));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(im, sx, sy, sw, sh, 0, 0, w, h);
  let alpha = false;
  if (src.startsWith('data:image/png') || src.startsWith('data:image/webp') || src.startsWith('data:image/gif')) {
    const px = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < px.length; i += 16) if (px[i] < 250) { alpha = true; break; }
  }
  const out = c.toDataURL(alpha ? 'image/png' : 'image/jpeg', 0.85);
  c.width = 0;
  // Fără decupare de tăiat, o poză care nu scade nu se schimbă.
  return cut || out.length < src.length ? out : null;
}

/** Caseta cu poza comprimată (aceeași dacă nu se câștigă nimic). Copiile de dinainte de efect / fundal se comprimă la fel. */
export async function compressEl(el: SlideEl, o: CompressOpts): Promise<SlideEl> {
  if (!canCompress(el)) return el;
  const im = await loadImg(el.src!);
  const full = fullBox(el);
  // Câți pixeli îi trebuie pozei întregi ca să aibă `ppi` la mărimea de pe slide.
  const need = (full.w / 96) * o.ppi;
  const k = Math.min(1, need / Math.max(1, im.naturalWidth));
  const cut = o.dropCrop ? el.crop : undefined;
  const next: SlideEl = { ...el };
  const src = await shrinkData(el.src!, k, cut);
  if (src) next.src = src;
  for (const key of ['orig', 'nobg'] as const) {
    const v = el[key];
    if (typeof v === 'string' && v.startsWith('data:image/')) { const s = await shrinkData(v, k, cut); if (s) next[key] = s; }
  }
  if (cut && src) delete next.crop;
  return next;
}

/** Comprimă pozele: doar caseta `onlyId` sau toate pozele din prezentare (și din coordonator). Întoarce prezentarea și câți octeți s-au câștigat. */
export async function compressDeck(deck: Deck, o: CompressOpts, onlyId?: string): Promise<{ deck: Deck; count: number; saved: number }> {
  let count = 0, saved = 0;
  const size = (e: SlideEl) => (e.src?.length ?? 0) + (e.orig?.length ?? 0) + (e.nobg?.length ?? 0);
  const els = async (list: SlideEl[]) => {
    const out: SlideEl[] = [];
    for (const e of list) {
      if ((onlyId && e.id !== onlyId) || !canCompress(e)) { out.push(e); continue; }
      const n = await compressEl(e, o);
      if (n !== e && (size(n) < size(e) || n.crop !== e.crop)) { count++; saved += Math.max(0, size(e) - size(n)); out.push(n); } else out.push(e);
    }
    return out;
  };
  const slides = [];
  for (const s of deck.slides) slides.push({ ...s, els: await els(s.els) });
  const master = deck.master ? { ...deck.master, els: await els(deck.master.els) } : undefined;
  // Data URL în base64: 4 litere = 3 octeți.
  let layoutMasters: Deck['layoutMasters'];
  for (const [l, list] of Object.entries(deck.layoutMasters ?? {})) if (list) layoutMasters = { ...layoutMasters, [l]: await els(list) };
  return { deck: { ...deck, slides, ...(master ? { master } : {}), ...(layoutMasters ? { layoutMasters } : {}) }, count, saved: Math.round((saved * 3) / 4) };
}
