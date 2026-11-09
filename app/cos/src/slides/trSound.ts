// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Sunetul tranziției (Timing → Sound): se aude când slide-ul intră în prezentare. Sunetele gata făcute sunt
// generate aici, din formule (nu sunt fișiere luate de undeva), ca WAV mono de 22 kHz; se poate pune și un sunet propriu.
// În .pptx sunetul intră ca fișier .wav în ppt/media, legat din <p:transition> prin <p:sndAc><p:stSnd><p:snd r:embed/>.

export const TR_SOUNDS: [string, string][] = [
  ['clic', 'Clic'], ['clopotel', 'Clopoțel'], ['gong', 'Gong'], ['whoosh', 'Foșnet (whoosh)'],
  ['tobe', 'Tobe'], ['aplauze', 'Aplauze'], ['camera', 'Aparat foto'], ['coarda', 'Coardă'],
];
const RATE = 22050;

/** Un generator de zgomot cu sămânță fixă, ca sunetul să fie mereu același (și testabil). */
function noise(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s / 4294967296) * 2 - 1; };
}

/** Eșantioanele sunetului gata făcut (−1…1), sau null dacă numele nu e cunoscut. */
export function synthSound(id: string): Float32Array | null {
  const len = (sec: number) => new Float32Array(Math.round(RATE * sec));
  const rnd = noise(id.length * 7919 + id.charCodeAt(0));
  let out: Float32Array;
  switch (id) {
    case 'clic': {
      out = len(0.06);
      for (let i = 0; i < out.length; i++) { const t = i / RATE; out[i] = (rnd() * 0.6 + Math.sin(2 * Math.PI * 2000 * t) * 0.4) * Math.exp(-t * 120); }
      break;
    }
    case 'clopotel': {
      out = len(1.4);
      for (let i = 0; i < out.length; i++) {
        const t = i / RATE;
        out[i] = (Math.sin(2 * Math.PI * 1318.5 * t) + 0.5 * Math.sin(2 * Math.PI * 2637 * t) + 0.25 * Math.sin(2 * Math.PI * 3955.5 * t)) / 1.75 * Math.exp(-t * 3.2);
      }
      break;
    }
    case 'gong': {
      out = len(2.2);
      for (let i = 0; i < out.length; i++) {
        const t = i / RATE;
        out[i] = (Math.sin(2 * Math.PI * 110 * t) + 0.6 * Math.sin(2 * Math.PI * 164.3 * t + 0.3) + 0.4 * Math.sin(2 * Math.PI * 247.1 * t) + 0.2 * Math.sin(2 * Math.PI * 371.4 * t)) / 2.2
          * Math.exp(-t * 1.6) * Math.min(1, t * 200);
      }
      break;
    }
    case 'whoosh': {
      out = len(0.7);
      // Zgomot filtrat (trece-jos cu frecvența care urcă și coboară), cu volumul ca un arc.
      let y = 0;
      for (let i = 0; i < out.length; i++) {
        const p = i / out.length, k = 0.02 + 0.25 * Math.sin(Math.PI * p);
        y += k * (rnd() - y);
        out[i] = y * Math.sin(Math.PI * p) * 2.2;
      }
      break;
    }
    case 'tobe': {
      out = len(0.9);
      // Trei lovituri: tobă mare, tobă mică, tobă mare.
      for (const [at, f, snare] of [[0, 70, 0], [0.25, 180, 1], [0.5, 60, 0]] as [number, number, number][]) {
        const s0 = Math.round(at * RATE);
        for (let i = 0; s0 + i < out.length && i < RATE * 0.4; i++) {
          const t = i / RATE;
          out[s0 + i] += (snare ? rnd() * 0.7 + 0.3 * Math.sin(2 * Math.PI * f * t) : Math.sin(2 * Math.PI * f * t * (1 - t))) * Math.exp(-t * (snare ? 18 : 9));
        }
      }
      break;
    }
    case 'aplauze': {
      out = len(2);
      // Multe bătăi scurte din palme, la întâmplare, mai dese la mijloc.
      for (let c = 0; c < 260; c++) {
        const at = Math.floor(((c + rnd() * 0.5 + 0.5) / 260) * (out.length - RATE * 0.03));
        const amp = 0.25 + 0.2 * Math.abs(rnd());
        for (let i = 0; i < RATE * 0.02 && at + i < out.length; i++) out[at + i] += rnd() * amp * Math.exp(-i / (RATE * 0.004));
      }
      for (let i = 0; i < out.length; i++) { const p = i / out.length; out[i] *= Math.min(1, p * 8, (1 - p) * 3); }
      break;
    }
    case 'camera': {
      out = len(0.25);
      for (const at of [0, 0.11]) {
        const s0 = Math.round(at * RATE);
        for (let i = 0; i < RATE * 0.08; i++) { const t = i / RATE; out[s0 + i] += (rnd() * 0.8 + 0.2 * Math.sin(2 * Math.PI * 900 * t)) * Math.exp(-t * 60); }
      }
      break;
    }
    case 'coarda': {
      // Coardă ciupită: zgomot care trece printr-o buclă cu întârziere (sună ca o chitară), nota La (220 Hz).
      out = len(1.5);
      const p = Math.round(RATE / 220), buf = new Float32Array(p);
      for (let i = 0; i < p; i++) buf[i] = rnd();
      for (let i = 0; i < out.length; i++) { const j = i % p, nx = (j + 1) % p; out[i] = buf[j]; buf[j] = 0.996 * 0.5 * (buf[j] + buf[nx]); }
      break;
    }
    default: return null;
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] = (out[i] / peak) * 0.8;
  return out;
}

/** Eșantioanele ca fișier WAV (PCM pe 16 biți, mono). */
export function wavBytes(samples: Float32Array, rate = RATE): Uint8Array {
  const b = new Uint8Array(44 + samples.length * 2), v = new DataView(b.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
  return b;
}

/** Fișierul sunetului tranziției: cel gata făcut (WAV) sau cel propriu (din data: URL); numele, extensia și tipul lui. */
export function trSoundFile(snd: string): { data: Uint8Array; ext: string; mime: string; name: string } | null {
  const own = /^data:(audio\/[\w.+-]+);base64,(.*)$/.exec(snd);
  if (own) {
    const bin = atob(own[2]), data = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    const ext = /mpeg|mp3/.test(own[1]) ? 'mp3' : /wav/.test(own[1]) ? 'wav' : /ogg/.test(own[1]) ? 'ogg' : /mp4|m4a|aac/.test(own[1]) ? 'm4a' : 'wav';
    return { data, ext, mime: own[1], name: 'Sunet propriu' };
  }
  const s = synthSound(snd);
  if (!s) return null;
  return { data: wavBytes(s), ext: 'wav', mime: 'audio/wav', name: TR_SOUNDS.find(([k]) => k === snd)?.[1] ?? snd };
}

/** Pornește sunetul tranziției (în prezentare sau la previzualizare). Întoarce elementul audio, ca să poată fi oprit. */
export function playTrSound(snd: string | undefined): HTMLAudioElement | null {
  if (!snd) return null;
  let url = snd;
  if (!snd.startsWith('data:')) {
    const f = trSoundFile(snd);
    if (!f) return null;
    url = URL.createObjectURL(new Blob([f.data.slice().buffer], { type: f.mime }));
  }
  const a = new Audio(url);
  if (url.startsWith('blob:')) a.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
  a.play().catch(() => { /* fără voie de redare: tăcere */ });
  return a;
}

/** Adaugă sunetul în XML-ul tranziției (toate variantele <p:transition>); fără tranziție, face una doar cu sunetul. */
export function withSoundXml(trXml: string, rid: string, name: string): string {
  const snd = `<p:sndAc><p:stSnd><p:snd r:embed="${rid}" name="${name.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"/></p:stSnd></p:sndAc>`;
  if (!trXml) return `<p:transition>${snd}</p:transition>`;
  return trXml.replace(/<p:transition([^>]*?)\/>/g, '<p:transition$1></p:transition>').replace(/<\/p:transition>/g, snd + '</p:transition>');
}
