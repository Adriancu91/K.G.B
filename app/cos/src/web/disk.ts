// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fișierele de pe calculator în pagina web: browserele pe bază de Chromium (pe calculator) lasă pagina să deschidă și să
// scrie fișiere și dosare alese de om, cu fereastra Deschide / Salvează a sistemului. Ținem „mânerul” fiecărui fișier
// (nu octeții) în IndexedDB, sub o cale închipuită „Calculator/<nume>”, ca Recente și Ctrl+S să scrie în același fișier.
// Unde browserul nu știe asta (de exemplu pe telefon), bridge.ts rămâne la fișierele păstrate în browser.

type Picker = { description?: string; accept: Record<string, string[]> };
type W = {
  showOpenFilePicker?: (o?: { multiple?: boolean; types?: Picker[]; excludeAcceptAllOption?: boolean; id?: string }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (o?: { suggestedName?: string; types?: Picker[]; id?: string }) => Promise<FileSystemFileHandle>;
  showDirectoryPicker?: (o?: { mode?: 'read' | 'readwrite'; id?: string }) => Promise<FileSystemDirectoryHandle>;
};
type Perm = { queryPermission?: (o: { mode: string }) => Promise<string>; requestPermission?: (o: { mode: string }) => Promise<string> };
const w = window as unknown as W;

export const hasDisk = typeof w.showOpenFilePicker === 'function' && typeof w.showSaveFilePicker === 'function';
export const DISK = 'Calculator';

/** Ce se poate alege la Deschide / Salvează (aceleași grupuri ca în aplicația instalată). */
export const FORMATS: Record<string, { name: string; ext: string[] }> = {
  any: { name: 'Orice fișier', ext: [] },
  docx: { name: 'Document .docx, .doc, .odt, .rtf, .txt sau e-mail (.eml, .msg)', ext: ['docx', 'docm', 'doc', 'odt', 'fodt', 'rtf', 'txt', 'eml', 'msg'] },
  pptx: { name: 'Prezentare .pptx, .ppt sau .odp', ext: ['pptx', 'ppt', 'odp', 'fodp', 'ppsx', 'potx', 'pptm', 'ppsm', 'potm'] },
  ppsx: { name: 'Prezentare de rulat (.ppsx)', ext: ['ppsx'] },
  potx: { name: 'Șablon de prezentare (.potx)', ext: ['potx'] },
  reuse: { name: 'Prezentare (Cyber Office Studio, .pptx, .ppt sau .odp)', ext: ['sslides', 'pptx', 'ppt', 'odp', 'fodp', 'ppsx', 'potx', 'pptm', 'ppsm', 'potm'] },
  csv: { name: 'Tabel CSV', ext: ['csv', 'txt'] },
  textdata: { name: 'Text cu date (.csv, .txt, .tsv, .prn)', ext: ['csv', 'txt', 'tsv', 'tab', 'prn', 'dat'] },
  doctables: { name: 'Document cu tabele (.docx, .odt, .doc, .rtf)', ext: ['docx', 'docm', 'odt', 'fodt', 'doc', 'rtf'] },
  model3d: { name: 'Model 3D (.obj, .stl, .glb, .gltf, .ply)', ext: ['obj', 'stl', 'glb', 'gltf', 'ply'] },
  xlsx: { name: 'Tabel .xlsx, .xls sau .ods', ext: ['xlsx', 'xlsm', 'xls', 'xlsb', 'ods', 'fods'] },
  png: { name: 'Imagine PNG', ext: ['png'] },
  jpg: { name: 'Imagine JPG', ext: ['jpg', 'jpeg'] },
  webp: { name: 'Imagine WebP', ext: ['webp'] },
  bmp: { name: 'Imagine BMP', ext: ['bmp'] },
  tga: { name: 'Imagine TGA', ext: ['tga'] },
  ico: { name: 'Pictogramă ICO', ext: ['ico'] },
  tiff: { name: 'Imagine TIFF', ext: ['tif', 'tiff'] },
  gif: { name: 'Imagine GIF', ext: ['gif'] },
  psd: { name: 'Imagine cu straturi .psd', ext: ['psd'] },
  image: { name: 'Imagini', ext: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'ico', 'avif', 'svg', 'tif', 'tiff', 'heic', 'heif', 'psd', 'psb', 'tga', 'dng', 'cr2', 'nef', 'nrw', 'arw', 'srw', 'pef', 'raf', 'rw2', 'orf'] },
  pdf: { name: 'Document PDF', ext: ['pdf'] },
  picture: { name: 'Imagini și PDF', ext: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'ico', 'avif', 'svg', 'tif', 'tiff', 'heic', 'heif', 'psd', 'psb', 'pdf', 'ai', 'eps'] },
  media: { name: 'Video sau sunet', ext: ['mp4', 'm4v', 'webm', 'ogv', 'mp3', 'm4a', 'aac', 'wav', 'ogg', 'opus', 'flac'] },
  webm: { name: 'Video WebM', ext: ['webm'] },
  srt: { name: 'Subtitrări SRT', ext: ['srt'] },
  voice: { name: 'Înregistrare de voce', ext: ['webm'] },
  narration: { name: 'Narațiune', ext: ['wav'] },
  md: { name: 'Text Markdown', ext: ['md'] },
  txt: { name: 'Text simplu', ext: ['txt'] },
  textrtf: { name: 'Text (.txt sau .rtf)', ext: ['txt', 'rtf'] },
  odt: { name: 'Document OpenDocument (.odt)', ext: ['odt'] },
  ods: { name: 'Tabel OpenDocument (.ods)', ext: ['ods'] },
  odp: { name: 'Prezentare OpenDocument (.odp)', ext: ['odp'] },
  html: { name: 'Pagină web', ext: ['html', 'htm'] },
  mht: { name: 'Pagină web într-un fișier (.mht)', ext: ['mht', 'mhtml'] },
  webpage: { name: 'Pagină web', ext: ['html', 'htm', 'mht', 'mhtml'] },
  ics: { name: 'Sarcini pentru calendar (.ics)', ext: ['ics'] },
  eml: { name: 'Mesaj de e-mail (.eml)', ext: ['eml'] },
  sheettable: { name: 'Foaie de calcul (.xlsx, .ods, .csv)', ext: ['xlsx', 'xlsm', 'ods', 'fods', 'csv', 'txt'] },
  rtf: { name: 'Text formatat (.rtf)', ext: ['rtf'] },
  xml: { name: 'Fișier XML (.xml)', ext: ['xml'] },
  xfdf: { name: 'Comentarii PDF (.xfdf, .fdf)', ext: ['xfdf', 'fdf'] },
  cer: { name: 'Certificat (.cer, .crt, .pem)', ext: ['cer', 'crt', 'pem'] },
  pfx: { name: 'Certificat cu cheie (.pfx, .p12)', ext: ['pfx', 'p12'] },
  p7s: { name: 'Semnătură digitală (.p7s)', ext: ['p7s'] },
  signed: { name: 'Fișier semnat (.p7s, .p7m)', ext: ['p7s', 'p7m', 'p7c'] },
  formdata: { name: 'Date de formular (.xfdf, .fdf, .csv)', ext: ['xfdf', 'fdf', 'csv', 'txt'] },
  fdf: { name: 'Fișier FDF (.fdf)', ext: ['fdf'] },
  sactions: { name: 'Acțiuni de imagine (.sactions)', ext: ['sactions'] },
  keep: { name: 'Notițe exportate (.zip, .json, .enex, .docx)', ext: ['zip', 'json', 'enex', 'docx'] },
  efactura: { name: 'e-Factura (XML sau ZIP din SPV)', ext: ['xml', 'zip'] },
  statement: { name: 'Extras de cont (.pdf, .csv, .xlsx, .xls, .ods)', ext: ['pdf', 'csv', 'txt', 'xlsx', 'xlsm', 'xls', 'xlsb', 'ods', 'fods'] },
};

const types = (name: string, ext: string[]): Picker[] | undefined =>
  ext.length ? [{ description: name, accept: { 'application/octet-stream': ext.map((e) => '.' + e) } }] : undefined;
const aborted = (e: unknown) => (e as { name?: string })?.name === 'AbortError';

/** Fereastra Deschide; [] dacă omul a renunțat. */
export async function pickFiles(name: string, ext: string[], multiple = false): Promise<FileSystemFileHandle[]> {
  try { return await w.showOpenFilePicker!({ multiple, types: types(name, ext), id: 'cos-open' }); }
  catch (e) { if (aborted(e)) return []; throw e; }
}

/** Fereastra Salvează; null dacă omul a renunțat; `undefined` dacă browserul n-a lăsat-o să se deschidă (prea târziu după clic). */
export async function pickSave(suggestedName: string, name: string, ext: string[]): Promise<FileSystemFileHandle | null | undefined> {
  try { return await w.showSaveFilePicker!({ suggestedName, types: types(name, ext), id: 'cos-save' }); }
  catch (e) { if (aborted(e)) return null; return undefined; }
}

export async function pickDir(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof w.showDirectoryPicker !== 'function') return null;
  try { return await w.showDirectoryPicker({ mode: 'readwrite', id: 'cos-dir' }); }
  catch (e) { if (aborted(e)) return null; throw e; }
}

/** Voia de citire / scriere pentru un fișier ales mai demult (browserul o poate cere din nou după repornire). */
export async function allow(h: FileSystemHandle, write = false): Promise<void> {
  const p = h as unknown as Perm, o = { mode: write ? 'readwrite' : 'read' };
  if ((await p.queryPermission?.(o)) === 'granted') return;
  if ((await p.requestPermission?.(o)) !== 'granted') throw new Error('Browserul nu a dat voie la fișierul ' + h.name);
}

export async function readBytes(h: FileSystemFileHandle): Promise<Uint8Array> {
  await allow(h);
  return new Uint8Array(await (await h.getFile()).arrayBuffer());
}
export async function readText(h: FileSystemFileHandle): Promise<string> {
  await allow(h);
  return (await h.getFile()).text();
}
export async function write(h: FileSystemFileHandle, data: string | Uint8Array): Promise<void> {
  await allow(h, true);
  const s = await h.createWritable();
  await s.write(data as FileSystemWriteChunkType);
  await s.close();
}

/** Fișierele dintr-un dosar și din subdosare (cel mult `depth` niveluri), cu calea lor față de dosar. */
export async function walk(dir: FileSystemDirectoryHandle, test: (name: string) => boolean, max: number, depth: number):
  Promise<{ rel: string; h: FileSystemFileHandle }[]> {
  const out: { rel: string; h: FileSystemFileHandle }[] = [];
  const go = async (d: FileSystemDirectoryHandle, pre: string, level: number) => {
    const items: FileSystemHandle[] = [];
    for await (const it of (d as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) items.push(it);
    items.sort((a, b) => a.name.localeCompare(b.name, 'ro', { numeric: true }));
    for (const it of items) {
      if (out.length >= max) return;
      if (it.name.startsWith('.') || it.name.startsWith('~$')) continue;
      if (it.kind === 'file' && test(it.name)) out.push({ rel: pre + it.name, h: it as FileSystemFileHandle });
      else if (it.kind === 'directory' && level < depth) await go(it as FileSystemDirectoryHandle, pre + it.name + '/', level + 1);
    }
  };
  await allow(dir);
  await go(dir, '', 0);
  return out;
}

/** Un fișier dintr-un dosar ales (calea relativă cu „/”). */
export async function fileIn(dir: FileSystemDirectoryHandle, rel: string): Promise<FileSystemFileHandle> {
  await allow(dir);
  const parts = rel.split('/').filter(Boolean);
  let d = dir;
  for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p);
  return d.getFileHandle(parts[parts.length - 1]);
}

/** Scrie un fișier nou în dosar, fără să-l înlocuiască pe unul existent („poza (2).jpg”). */
export async function writeNew(dir: FileSystemDirectoryHandle, name: string, data: Uint8Array): Promise<string> {
  await allow(dir, true);
  const base = name.replace(/[<>:"/\\|?*]/g, '_') || 'fisier';
  const dot = base.lastIndexOf('.'), stem = dot > 0 ? base.slice(0, dot) : base, ext = dot > 0 ? base.slice(dot) : '';
  let target = base;
  for (let i = 2; ; i++) {
    try { await dir.getFileHandle(target); target = `${stem} (${i})${ext}`; } catch { break; }
  }
  await write(await dir.getFileHandle(target, { create: true }), data);
  return target;
}
