// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Poze în notițe (lipite cu Ctrl+V, trase în notiță sau alese): se micșorează la cel mult 1600 px și se păstrează
// în caiet ca JPEG, ca fișierul să rămână mic (o poză de telefon de 4 MB devine ~200 KB).
export const MAX_IMAGES = 20;
const MAX_SIDE = 1600;

export function imageFiles(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => /^image\/(png|jpe?g|gif|webp|bmp)$/.test(f.type));
}

export async function shrinkImage(blob: Blob): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  // Fundal alb: pozele PNG transparente (capturi de ecran) nu devin negre în JPEG.
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

/** Pozele salvate în caiet: doar imagini „data:”, cel mult MAX_IMAGES. */
export function cleanImages(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw.filter((s): s is string => typeof s === 'string' && s.startsWith('data:image/')).slice(0, MAX_IMAGES);
  return list.length ? list : undefined;
}
