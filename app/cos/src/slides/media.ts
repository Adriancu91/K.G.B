// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Clipuri video și sunete pe slide. Fișierul intră în prezentare (ca data URL), deci prezentarea merge și pe alt calculator;
// de aceea are o limită de mărime, ca fișierul .sslides să rămână ușor de deschis pe un laptop cu 8 GB RAM.
import { Size, SlideEl, uid } from './model';

/** Extensiile pe care Chromium le poate reda, cu tipul lor. */
export const MEDIA_TYPES: Record<string, string> = {
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac',
};
export const MEDIA_MAX_MB = 40;

export const isVideo = (el: SlideEl) => !!el.src?.startsWith('data:video/');

/** Extensia potrivită pentru tipul din data URL (pentru exportul în PowerPoint). */
export function mediaExt(src: string): string {
  const mime = /^data:([^;,]+)/.exec(src)?.[1] ?? '';
  return Object.entries(MEDIA_TYPES).find(([, m]) => m === mime)?.[0] ?? (mime.startsWith('audio/') ? 'mp3' : 'mp4');
}

function dataUrl(data: Uint8Array, mime: string): Promise<string> {
  if (typeof FileReader === 'undefined') {
    // Fără FileReader (teste în Node): base64 pe bucăți.
    let bin = '';
    for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
    return Promise.resolve(`data:${mime};base64,${btoa(bin)}`);
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^;,]*/, 'data:' + mime));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(new Blob([data as BlobPart], { type: mime }));
  });
}

/** Caseta cu clipul / sunetul, în mijlocul slide-ului; sau mesajul de eroare (format necunoscut, fișier prea mare). */
export async function mediaEl(name: string, data: Uint8Array, size: Size, bytes = data.length): Promise<SlideEl | string> {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const mime = MEDIA_TYPES[ext];
  if (!mime) return 'Formatul acesta nu se poate pune pe slide. Merg: MP4, WebM, MP3, M4A, WAV, OGG, FLAC.';
  if (bytes > MEDIA_MAX_MB * 1024 * 1024) {
    return `Fișierul are ${Math.round(bytes / 1048576)} MB; pe slide încap cel mult ${MEDIA_MAX_MB} MB. Scurtează sau micșorează clipul în modulul Video.`;
  }
  const src = await dataUrl(data, mime);
  const video = mime.startsWith('video/');
  const w = video ? Math.round(size.w / 2) : 420, h = video ? Math.round(w * 9 / 16) : 90;
  const title = name.split(/[\\/]/).pop() ?? '';
  return { id: uid(), kind: 'media', x: Math.round((size.w - w) / 2), y: Math.round((size.h - h) / 2), w, h, text: title, src };
}

/** Lungimea clipului în secunde, citită din antetul fișierului: MP4 / MOV / M4A (caseta mvhd) și WAV (fmt + data);
 *  undefined dacă nu se găsește. */
export function headerLength(b: Uint8Array): number | undefined {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const at = (i: number, s: string) => s.split('').every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length > 44 && at(0, 'RIFF') && at(8, 'WAVE')) {
    let rate = 0;
    for (let i = 12; i + 8 <= b.length;) {
      const size = dv.getUint32(i + 4, true);
      if (at(i, 'fmt ') && i + 20 <= b.length) rate = dv.getUint32(i + 16, true);
      if (at(i, 'data')) return rate > 0 ? Math.min(size, b.length - i - 8) / rate : undefined;
      i += 8 + size + (size % 2);
    }
    return undefined;
  }
  for (let i = 4; i + 32 <= b.length; i++) {
    if (b[i] !== 0x6d || !at(i, 'mvhd')) continue;
    const v = b[i + 4];
    const scale = dv.getUint32(i + (v === 1 ? 24 : 16));
    const dur = v === 1 ? dv.getUint32(i + 28) * 4294967296 + dv.getUint32(i + 32) : dv.getUint32(i + 20);
    return scale > 0 && dur > 0 && dur !== 0xffffffff ? dur / scale : undefined;
  }
  return undefined;
}

/** Lungimea clipului (data URL sau octeții lui), în secunde: din antet, altfel (în aplicație) din playerul browserului. */
export async function mediaLength(src: string, bytes?: Uint8Array): Promise<number | undefined> {
  let b = bytes;
  if (!b) {
    const i = src.indexOf(',');
    try { const bin = atob(src.slice(i + 1)); b = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) b[k] = bin.charCodeAt(k); } catch { b = new Uint8Array(0); }
  }
  const h = headerLength(b);
  if (h || typeof document === 'undefined') return h;
  return new Promise((resolve) => {
    const m = document.createElement(src.startsWith('data:video/') ? 'video' : 'audio');
    const done = (v?: number) => { clearTimeout(t); m.removeAttribute('src'); resolve(v); };
    const t = setTimeout(() => done(), 4000);
    m.preload = 'metadata';
    m.onloadedmetadata = () => done(Number.isFinite(m.duration) && m.duration > 0 ? m.duration : undefined);
    m.onerror = () => done();
    m.src = src;
  });
}

/** Decuparea, apariția / stingerea și semnele de carte ale clipului ca în .pptx: copiii lui p14:media, în milisecunde. p14:trim are `st` = cât se taie
 *  de la început și `end` = cât se taie de la coadă (de aceea trebuie lungimea clipului; fără ea se scrie doar începutul). */
export async function p14MediaKids(e: SlideEl, len?: number): Promise<string> {
  const ms = (s: number) => String(Math.round(s * 1000));
  const L = e.trimB ? len ?? await mediaLength(e.src ?? '') : undefined;
  const st = e.trimA ? ` st="${ms(e.trimA)}"` : '';
  const end = e.trimB && L && L - e.trimB >= 0.05 ? ` end="${ms(L - e.trimB)}"` : '';
  const fade = e.fadeIn || e.fadeOut ? `<p14:fade${e.fadeIn ? ` inDuration="${ms(e.fadeIn)}"` : ''}${e.fadeOut ? ` outDuration="${ms(e.fadeOut)}"` : ''}/>` : '';
  // Semnele de carte (p14:bmkLst), cu timpul din clipul întreg, în ms.
  const bmk = e.bmk?.length ? `<p14:bmkLst>${e.bmk.map((t, i) => `<p14:bmk name="Semn ${i + 1}" time="${ms(t)}"/>`).join('')}</p14:bmkLst>` : '';
  return (st || end ? `<p14:trim${st}${end}/>` : '') + fade + bmk;
}

/** Înregistrarea de la microfon (WebM / Opus) ca WAV mono pe 16 biți, 22.050 Hz, pe care îl pot reda și alte programe de prezentare. */
export async function recordingToWav(blob: Blob): Promise<Uint8Array> {
  const ctx = new AudioContext();
  let buf: AudioBuffer;
  try {
    buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void ctx.close();
  }
  const RATE = 22050;
  const len = Math.max(1, Math.ceil(buf.duration * RATE));
  const off = new OfflineAudioContext(1, len, RATE);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  return wavBytes(pcm, RATE);
}

/** Eșantioanele (−1…1) ca fișier WAV PCM mono pe 16 biți. */
export function wavBytes(pcm: Float32Array, rate: number): Uint8Array {
  const out = new Uint8Array(44 + pcm.length * 2);
  const v = new DataView(out.buffer);
  const str = (at: number, s: string) => { for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), true);
  return out;
}
