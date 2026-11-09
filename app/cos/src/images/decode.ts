// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Deschiderea oricărei poze, pentru tot modulul Imagini (și pentru testul de compatibilitate).
// Chromium știe singur JPG, PNG, WebP, GIF, BMP, ICO și AVIF. În plus aici: SVG (desenat printr-un <img>, unde scripturile
// și resursele externe sunt blocate) și TIFF (scanere, fax, arhive), cu UTIF.js (MIT), încărcat doar când e nevoie.
// TGA (jocuri, grafică 3D) se citește cu cod propriu (tga.ts).
// RAW de aparat foto (.dng, .cr2, .nef, .arw, .raf…): se deschide poza JPEG pusă de aparat în fișier (raw.ts).
// HEIC (pozele de pe iPhone) se deschide cu libheif (LGPL-3.0, ~2 MB), încărcat într-un fișier separat doar la prima poză HEIC.

import { isEps } from './eps';
import { looksLikeRaw, RAW_EXTENSIONS } from './raw';

/** Extensiile pe care le poate deschide modulul Imagini. */
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'ico', 'avif', 'svg', 'tif', 'tiff', 'heic', 'heif', 'psd', 'psb', 'tga', ...RAW_EXTENSIONS];
export const IMAGE_ACCEPT = IMAGE_EXTENSIONS.map((e) => '.' + e).join(',');
export const IMAGE_NAME_RE = new RegExp(`\\.(${IMAGE_EXTENSIONS.join('|')})$`, 'i');

/** Cea mai mare poză pe care o deschidem (în pixeli), ca un fișier uriaș să nu umple memoria laptopului. */
const MAX_PIXELS = 100_000_000;
/** Mărimea la care desenăm un SVG fără dimensiuni (doar viewBox sau nimic). */
const SVG_DEFAULT = 1000;
const SVG_MAX = 4000;

export interface Decoded {
  bmp: ImageBitmap;
  /** Ce trebuie să știe utilizatorul (de exemplu „TIFF cu 3 pagini: s-a deschis prima”); gol dacă nimic. */
  note: string;
}

type Kind = 'svg' | 'tiff' | 'heic' | 'psd' | 'eps' | 'other';

function kindOf(b: Uint8Array): Kind {
  if (b[0] === 0x38 && b[1] === 0x42 && b[2] === 0x50 && b[3] === 0x53) return 'psd';
  if (isEps(b)) return 'eps';
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a)) return 'tiff';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    // Cutia „ftyp”: marca principală și cele compatibile. AVIF (pe care Chromium îl știe) are și el „mif1”, deci îl lăsăm deoparte.
    const size = Math.min(b.length, Math.max(16, (b[0] << 24 | b[1] << 16 | b[2] << 8 | b[3]) >>> 0), 256);
    const brands: string[] = [];
    for (let i = 8; i + 4 <= size; i += 4) if (i !== 12) brands.push(String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]));
    if (brands.some((x) => /^avi[fs]$/.test(x))) return 'other';
    if (brands.some((x) => /^(heic|heix|heim|heis|hevc|hevx|hevm|hevs|mif1|msf1)$/.test(x))) return 'heic';
  }
  // SVG: text care conține <svg în primii câțiva KB (poate începe cu <?xml sau comentarii; TextDecoder scoate singur BOM-ul).
  const head = new TextDecoder().decode(b.subarray(0, 4096));
  if (/^\s*</.test(head) && /<svg[\s>]/i.test(head)) return 'svg';
  return 'other';
}

export class ImageError extends Error {}

/** .psd / .psb ca o singură poză (poza compusă din fișier); straturile le deschide editorul, prin psdDoc.ts. */
async function decodePsd(data: Uint8Array): Promise<Decoded> {
  const { readPSD, PsdError } = await import('./psd');
  try {
    const psd = await readPSD(data);
    let rgba = psd.composite;
    if (!rgba) {
      const { docFromPsd } = await import('./psdDoc');
      const { flatten } = await import('./layers');
      const c = flatten((await docFromPsd(data)).doc);
      rgba = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      c.width = 0;
    }
    const bmp = await createImageBitmap(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, psd.width, psd.height));
    return { bmp, note: psd.layers.length > 1 ? 'Fișierul .psd a fost deschis ca o singură poză (straturile unite).' : '' };
  } catch (e) {
    throw new ImageError(e instanceof PsdError ? e.message : 'Fișierul .psd e deteriorat și nu poate fi citit.');
  }
}

/** .eps: pixelii din fișier sau poza de previzualizare din el (PostScript-ul nu-l desenăm; vezi eps.ts). */
async function decodeEps(data: Uint8Array): Promise<Decoded> {
  const { readEps, EpsError } = await import('./eps');
  let pic;
  try {
    pic = readEps(data);
  } catch (e) {
    throw new ImageError(e instanceof EpsError ? e.message : 'Fișierul .eps e deteriorat și nu poate fi citit.');
  }
  let bmp: ImageBitmap;
  if (pic.kind === 'rgba') bmp = await createImageBitmap(new ImageData(pic.data as Uint8ClampedArray<ArrayBuffer>, pic.w, pic.h));
  else if (pic.kind === 'tiff') bmp = (await decodeTiff(pic.bytes.slice())).bmp;
  else {
    try {
      bmp = await createImageBitmap(new Blob([pic.bytes.slice() as BlobPart]));
    } catch {
      throw new ImageError('Fișierul .eps conține doar desen PostScript, iar miniatura din el e deteriorată. Salvează-l ca PDF sau SVG din programul în care a fost făcut și deschide-l pe acela.');
    }
  }
  const size = `${bmp.width} × ${bmp.height} px`;
  return {
    bmp,
    note: pic.kind === 'rgba' && pic.source === 'imagedata'
      ? `Fișierul .eps a fost deschis cu pixelii din el (${size}); la salvare iese PNG, JPG, TIFF sau alt format obișnuit.`
      : `Desenul PostScript din fișierul .eps nu se poate desena aici, așa că s-a deschis poza de previzualizare din el (${size}), mai mică și uneori doar alb-negru. Pentru calitate întreagă, salvează-l ca PDF sau SVG din programul în care a fost făcut.`,
  };
}

export async function decodeImage(input: Uint8Array | Blob): Promise<Decoded> {
  const data = input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer());
  const kind = kindOf(data);
  if ((kind === 'tiff' || kind === 'other') && looksLikeRaw(data)) return decodeRaw(data);
  if (kind === 'svg') return decodeSvg(data);
  if (kind === 'tiff') return decodeTiff(data);
  if (kind === 'heic') return decodeHeic(data);
  if (kind === 'psd') return decodePsd(data);
  if (kind === 'eps') return decodeEps(data);
  try {
    return { bmp: await createImageBitmap(new Blob([data as BlobPart])), note: '' };
  } catch {
    // .tga nu are semnătură la început: îl încercăm după ce Chromium nu l-a recunoscut, dacă antetul pare de TGA.
    const { looksLikeTga, decodeTga, TgaError } = await import('./tga');
    if (looksLikeTga(data)) {
      try {
        const t = decodeTga(data);
        return { bmp: await createImageBitmap(new ImageData(t.data as Uint8ClampedArray<ArrayBuffer>, t.width, t.height)), note: '' };
      } catch (e) {
        throw new ImageError(e instanceof TgaError ? e.message : 'Fișierul .tga e deteriorat și nu poate fi citit.');
      }
    }
    // Chromium spune doar „The source image could not be decoded”, în engleză.
    throw new ImageError('Fișierul nu pare o imagine pe care o putem deschide (JPG, PNG, WebP, GIF, BMP, TIFF, SVG, ICO, AVIF, HEIC, PSD, TGA, RAW) sau e deteriorat.');
  }
}

interface HeifImage {
  get_width(): number;
  get_height(): number;
  display(target: ImageData, done: (d: ImageData | null) => void): void;
  free?(): void;
}
interface HeifLib { HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] } }
let heif: Promise<HeifLib> | null = null;

async function decodeHeic(data: Uint8Array): Promise<Decoded> {
  heif ??= import('libheif-js/libheif-wasm/libheif-bundle.mjs').then(async (m) => {
    const lib = (m.default as () => HeifLib | Promise<HeifLib>)();
    return 'HeifDecoder' in lib ? lib : await lib;
  });
  let lib: HeifLib;
  try {
    lib = await heif;
  } catch {
    heif = null;
    throw new ImageError('Nu am putut porni cititorul de poze HEIC. Închide și redeschide aplicația, apoi încearcă din nou.');
  }
  let images: HeifImage[];
  try {
    images = new lib.HeifDecoder().decode(data);
  } catch {
    images = [];
  }
  if (!images.length) throw new ImageError('Poza HEIC e deteriorată sau nu conține nicio imagine.');
  try {
    const w = images[0].get_width(), h = images[0].get_height();
    if (!w || !h) throw new ImageError('Poza HEIC e deteriorată sau nu conține nicio imagine.');
    if (w * h > MAX_PIXELS) throw new ImageError(`Poza e prea mare (${w}×${h} pixeli) pentru memoria acestui calculator.`);
    const pixels = await new Promise<ImageData>((ok, fail) => {
      images[0].display(new ImageData(w, h), (d) => (d ? ok(d) : fail(new ImageError('Poza HEIC e deteriorată și nu poate fi desenată.'))));
    });
    const note = images.length > 1 ? `Fișierul HEIC are ${images.length} poze (de exemplu o rafală): s-a deschis prima.` : '';
    return { bmp: await createImageBitmap(pixels), note };
  } finally {
    for (const im of images) im.free?.();
  }
}

/** RAW: poza JPEG din fișier, rotită după orientarea din fișier dacă JPEG-ul nu are orientarea lui. */
async function decodeRaw(data: Uint8Array): Promise<Decoded> {
  const { rawPreview } = await import('./raw');
  const p = rawPreview(data);
  if (!p) throw new ImageError('Fișierul RAW nu are înăuntru o poză JPEG pe care s-o putem deschide (datele brute ale senzorului nu se developează aici).');
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(new Blob([p.jpeg as BlobPart], { type: 'image/jpeg' }));
  } catch {
    throw new ImageError('Poza JPEG din fișierul RAW e deteriorată și nu poate fi desenată.');
  }
  if (p.orientation !== 1) {
    const side = p.orientation !== 3;
    const c = document.createElement('canvas');
    c.width = side ? bmp.height : bmp.width;
    c.height = side ? bmp.width : bmp.height;
    const g = c.getContext('2d')!;
    g.translate(c.width / 2, c.height / 2);
    g.rotate(p.orientation === 6 ? Math.PI / 2 : p.orientation === 8 ? -Math.PI / 2 : Math.PI);
    g.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
    bmp.close();
    bmp = await createImageBitmap(c);
    c.width = 0;
  }
  return { bmp, note: `Fișier RAW de aparat foto: s-a deschis poza JPEG pusă de aparat în el (${bmp.width}×${bmp.height}), nu datele brute ale senzorului. La salvare iese JPG, PNG, TIFF sau alt format obișnuit.` };
}

async function decodeSvg(data: Uint8Array): Promise<Decoded> {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new ImageError('Desenul SVG are greșeli în el și nu poate fi afișat.');
    }
    // Un SVG fără width/height vine la 300×150 sau 0×0: îl desenăm la o mărime rezonabilă, păstrând proporțiile din viewBox.
    let w = img.naturalWidth, h = img.naturalHeight;
    const text = new TextDecoder().decode(data.subarray(0, 8192));
    const tag = /<svg\b[^>]*>/i.exec(text)?.[0] ?? '';
    const vb = /viewBox\s*=\s*["']\s*[-\d.e]+[\s,]+[-\d.e]+[\s,]+([\d.e]+)[\s,]+([\d.e]+)/i.exec(tag);
    const sized = /\swidth\s*=/.test(tag) && /\sheight\s*=/.test(tag) && !/(width|height)\s*=\s*["']\s*[\d.]+%/.test(tag);
    if (!sized || !w || !h) {
      const ratio = vb && +vb[1] > 0 && +vb[2] > 0 ? +vb[1] / +vb[2] : w && h ? w / h : 1;
      w = ratio >= 1 ? SVG_DEFAULT : Math.round(SVG_DEFAULT * ratio);
      h = ratio >= 1 ? Math.round(SVG_DEFAULT / ratio) : SVG_DEFAULT;
    }
    const k = Math.min(1, SVG_MAX / Math.max(w, h));
    w = Math.max(1, Math.round(w * k));
    h = Math.max(1, Math.round(h * k));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return { bmp: await createImageBitmap(c), note: 'Desenul SVG a fost transformat în poză (pixeli); la salvare iese PNG, JPG, WebP, GIF, TIFF sau BMP.' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeTiff(data: Uint8Array): Promise<Decoded> {
  const UTIF = (await import('utif2')).default ?? (await import('utif2'));
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  let ifds: ReturnType<typeof UTIF.decode>;
  try {
    ifds = UTIF.decode(buf);
  } catch {
    throw new ImageError('Fișierul TIFF e deteriorat și nu poate fi citit.');
  }
  // Paginile adevărate au lățime și înălțime; miniaturile (subIFD) le sărim.
  const pages = ifds.filter((d) => d.t256 && d.t257);
  if (!pages.length) throw new ImageError('Fișierul TIFF nu conține nicio poză.');
  const page = pages[0];
  const w = +(page.t256 as number[])[0], h = +(page.t257 as number[])[0];
  if (w * h > MAX_PIXELS) throw new ImageError(`Poza e prea mare (${w}×${h} pixeli) pentru memoria acestui calculator.`);
  try {
    UTIF.decodeImage(buf, page);
  } catch {
    throw new ImageError('Fișierul TIFF e deteriorat sau folosește o compresie pe care nu o cunoaștem.');
  }
  if (!page.width || !page.height || !page.data?.length) throw new ImageError('Fișierul TIFF e deteriorat sau folosește o compresie pe care nu o cunoaștem.');
  const rgba = UTIF.toRGBA8(page);
  const full = new Uint8ClampedArray(page.width * page.height * 4);
  full.set(rgba.subarray(0, full.length)); // un fișier tăiat dă mai puțini pixeli: restul rămân transparenți
  const bmp = await createImageBitmap(new ImageData(full, page.width, page.height));
  const notes: string[] = [];
  if (pages.length > 1) notes.push(`TIFF cu ${pages.length} pagini: s-a deschis prima.`);
  if (rgba.length < full.length) notes.push('Fișierul era tăiat: o parte din poză lipsește.');
  return { bmp, note: notes.join(' ') };
}
