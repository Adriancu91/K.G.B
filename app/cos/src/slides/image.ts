// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Pozele puse pe slide: le micșorăm la cel mult 1920 px și le păstrăm în fișier ca data URL
// (JPEG, ori PNG dacă poza are transparență), ca prezentarea să se poată muta oriunde dintr-un singur fișier.
import { Size, SLIDE_H, SLIDE_W, SlideEl, uid } from './model';

const MAX_SIDE = 1920;

/** Poza gata de desenat; SVG-urile nu merg cu createImageBitmap, așa că le încărcăm printr-un <img> (fără scripturi, ca imagine). */
async function drawable(data: Blob): Promise<{ width: number; height: number; close(): void; img: CanvasImageSource }> {
  if (!/svg/i.test(data.type)) { const b = await createImageBitmap(data); return { width: b.width, height: b.height, close: () => b.close(), img: b }; }
  const url = URL.createObjectURL(data);
  try {
    const im = new Image();
    im.src = url;
    await im.decode();
    // Un SVG fără mărime proprie primește mărimea unui slide.
    const width = im.naturalWidth || 1280, height = im.naturalHeight || 720;
    return { width, height, close: () => {}, img: im };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export async function imageToDataUrl(data: Blob): Promise<{ src: string; w: number; h: number }> {
  const d = await drawable(data);
  const bmp = { width: d.width, height: d.height, close: d.close };
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(d.img, 0, 0, w, h);
  bmp.close();
  // Transparență? (verificăm din 8 în 8 pixeli: e destul ca să prindem un logo cu fundal transparent)
  const px = ctx.getImageData(0, 0, w, h).data;
  let alpha = false;
  for (let i = 3; i < px.length; i += 32) if (px[i] < 250) { alpha = true; break; }
  const src = c.toDataURL(alpha ? 'image/png' : 'image/jpeg', 0.85);
  c.width = 0;
  return { src, w, h };
}

/** O casetă de imagine cu proporțiile pozei, cât încape frumos pe slide, centrată (sau în jurul unui punct). */
export function imageEl(src: string, w: number, h: number, at?: { x: number; y: number }, size: Size = { w: SLIDE_W, h: SLIDE_H }): SlideEl {
  const { w: SW, h: SH } = size;
  const k = Math.min(1, (SW * 0.6) / w, (SH * 0.6) / h);
  const ew = Math.round(w * k), eh = Math.round(h * k);
  const cx = at?.x ?? SW / 2, cy = at?.y ?? SH / 2;
  return {
    id: uid(), kind: 'image', text: '', src, w: ew, h: eh,
    x: Math.round(Math.max(0, Math.min(SW - ew, cx - ew / 2))),
    y: Math.round(Math.max(0, Math.min(SH - eh, cy - eh / 2))),
  };
}
