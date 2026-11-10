// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Înregistrare audio în notițe (ca în OneNote): microfonul prin MediaRecorder, sunet Opus în .webm (32 kbit/s, ~14 MB pe oră).
// Fișierul se păstrează lângă caiet, ca PDF-urile atașate.

export const MAX_RECORD_MIN = 120;
/** Video: cel mult o jumătate de oră (la ~1 Mbit/s, ~250 MB), ca fișierele de lângă caiet să nu crească prea mult. */
export const MAX_VIDEO_MIN = 30;

/** Durata ca „1:05” sau „1:02:03”. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Numele înregistrării: „Înregistrare 19.10.2026 10.08 (1:05).webm”. */
export function recordingName(at: Date, sec: number): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `Înregistrare ${p(at.getDate())}.${p(at.getMonth() + 1)}.${at.getFullYear()} ${p(at.getHours())}.${p(at.getMinutes())} (${clock(sec)}).webm`;
}

export const isAudio = (name: string) => /\.webm$/i.test(name);

/** Numele unui clip video: „Video 19.10.2026 10.08 (1:05).webm” (după nume se știe că e video, nu doar sunet). */
export function videoName(at: Date, sec: number): string {
  return recordingName(at, sec).replace(/^Înregistrare /, 'Video ');
}
export const isVideoName = (name: string) => /^Video .*\.webm$/i.test(name);

export interface Recording { stop(): Promise<{ blob: Blob; sec: number; at: Date }>; cancel(): void; stream: MediaStream; video: boolean }

/** Pornește microfonul (și camera, cu `video`) și înregistrarea; aruncă o eroare pe românește dacă nu se pot folosi. */
export async function startRecording(video = false): Promise<Recording> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, ...(video ? { video: { width: { ideal: 1280 }, height: { ideal: 720 } } } : {}) });
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (video) throw new Error(name === 'NotFoundError' ? 'Nu am găsit nicio cameră (sau niciun microfon).' : 'Camera nu se poate folosi. Verifică în Setări Windows → Confidențialitate → Cameră și Microfon.');
    throw new Error(name === 'NotFoundError' ? 'Nu am găsit niciun microfon.' : 'Microfonul nu se poate folosi. Verifică în Setări Windows → Confidențialitate → Microfon.');
  }
  const type = video ? (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm')
    : MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
  const rec = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: video ? 64000 : 32000, ...(video ? { videoBitsPerSecond: 1_000_000 } : {}) });
  const parts: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  const at = new Date();
  const t0 = performance.now();
  rec.start(1000);
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () => new Promise((ok) => {
      rec.onstop = () => { release(); ok({ blob: new Blob(parts, { type: video ? 'video/webm' : 'audio/webm' }), sec: (performance.now() - t0) / 1000, at }); };
      rec.stop();
    }),
    cancel: () => { rec.onstop = release; if (rec.state !== 'inactive') rec.stop(); else release(); },
    stream,
    video,
  };
}
