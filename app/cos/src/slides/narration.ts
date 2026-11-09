// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// 🎙 Înregistrează prezentarea (Record Slide Show): vocea de la microfon, slide cu slide, cât ții prezentarea.
// Fiecare trecere pe un slide e o bucată separată (un MediaRecorder nou, pe același microfon); la sfârșit bucățile
// aceluiași slide se lipesc într-un singur sunet WAV (merge și în .pptx), care pornește singur pe slide-ul lui.
import { wavBytes } from './media';

export interface Narration {
  /** Slide-ul pe care se înregistrează de acum (null = niciunul, de exemplu pe ecranul negru de final). */
  switchTo(id: string | null): void;
  pause(): void;
  resume(): void;
  /** Oprește tot și dă bucățile înregistrate, pe id-ul slide-ului, în ordine. */
  finish(): Promise<Record<string, Blob[]>>;
  cancel(): void;
}

/** Pornește microfonul; aruncă o eroare pe românește dacă nu se poate folosi. */
export async function startNarration(): Promise<Narration> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    throw new Error((e as DOMException)?.name === 'NotFoundError' ? 'Nu am găsit niciun microfon.' : 'Microfonul nu se poate folosi. Verifică în Setări Windows → Confidențialitate → Microfon.');
  }
  const type = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
  const got: Record<string, Blob[]> = {};
  const waits: Promise<void>[] = [];
  let cur: { id: string; rec: MediaRecorder } | null = null;
  let paused = false;
  const close = () => {
    if (!cur) return;
    const { id, rec } = cur;
    cur = null;
    if (rec.state === 'inactive') return;
    waits.push(new Promise((ok) => {
      const parts: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
      rec.onstop = () => { if (parts.length) (got[id] ??= []).push(new Blob(parts, { type: 'audio/webm' })); ok(); };
      rec.stop();
    }));
  };
  const open = (id: string) => {
    const rec = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: 32000 });
    rec.start();
    if (paused) rec.pause();
    cur = { id, rec };
  };
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    switchTo(id) {
      if (cur?.id === id) return;
      close();
      if (id) open(id);
    },
    pause() { paused = true; if (cur?.rec.state === 'recording') cur.rec.pause(); },
    resume() { paused = false; if (cur?.rec.state === 'paused') cur.rec.resume(); },
    async finish() {
      close();
      await Promise.all(waits);
      release();
      return got;
    },
    cancel() {
      if (cur && cur.rec.state !== 'inactive') { cur.rec.onstop = null; cur.rec.stop(); }
      cur = null;
      release();
    },
  };
}

/** Bucățile unui slide lipite una după alta, ca WAV mono pe 22 050 Hz; și lungimea, în secunde. */
export async function narrationWav(parts: Blob[]): Promise<{ wav: Uint8Array; sec: number }> {
  const RATE = 22050;
  const bufs: AudioBuffer[] = [];
  const ctx = new AudioContext();
  try {
    for (const p of parts) {
      try { bufs.push(await ctx.decodeAudioData(await p.arrayBuffer())); } catch { /* bucată stricată sau prea scurtă: se sare */ }
    }
  } finally {
    void ctx.close();
  }
  const chunks: Float32Array[] = [];
  for (const b of bufs) {
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(b.duration * RATE)), RATE);
    const src = off.createBufferSource();
    src.buffer = b;
    src.connect(off.destination);
    src.start();
    chunks.push((await off.startRendering()).getChannelData(0));
  }
  const pcm = new Float32Array(chunks.reduce((a, c) => a + c.length, 0));
  let at = 0;
  for (const c of chunks) { pcm.set(c, at); at += c.length; }
  return { wav: wavBytes(pcm, RATE), sec: pcm.length / RATE };
}

/**
 * Pista de voce pentru „Fă video din prezentare”: narațiunea fiecărui slide (data URL sau null) pusă la începutul slide-ului ei.
 * Slide-ul stă cel puțin cât narațiunea lui (plus o jumătate de secundă), între `min` și `max` secunde; vocea mai lungă se taie.
 * Întoarce lungimile noi ale slide-urilor și WAV-ul (sau null dacă nu e nicio narațiune).
 */
export async function narrationTrack(items: { src: string | null; dur: number }[], min: number, max: number): Promise<{ wav: Uint8Array | null; durs: number[] }> {
  const RATE = 22050;
  const pcms: (Float32Array | null)[] = [];
  for (const it of items) {
    if (!it.src) { pcms.push(null); continue; }
    try {
      // Fără fetch: regulile paginii nu lasă citirea adreselor data: (connect-src).
      const bin = atob(it.src.slice(it.src.indexOf(',') + 1));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const { wav } = await narrationWav([new Blob([bytes])]);
      const ctx = new OfflineAudioContext(1, 1, RATE);
      pcms.push((await ctx.decodeAudioData(wav.slice().buffer)).getChannelData(0));
    } catch { pcms.push(null); }
  }
  const durs = items.map((it, i) => {
    const sec = pcms[i] ? pcms[i]!.length / RATE + 0.5 : 0;
    return Math.min(max, Math.max(min, it.dur, Math.round(sec * 10) / 10));
  });
  if (!pcms.some(Boolean)) return { wav: null, durs };
  const out = new Float32Array(Math.ceil(durs.reduce((a, d) => a + d, 0) * RATE));
  let at = 0;
  pcms.forEach((p, i) => {
    const len = Math.round(durs[i] * RATE);
    if (p) out.set(p.subarray(0, Math.min(p.length, len, out.length - at)), at);
    at += len;
  });
  return { wav: wavBytes(out, RATE), durs };
}
