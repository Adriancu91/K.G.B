// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Citire cu voce tare cu vocile din Windows (speechSynthesis, fără internet). Folosită de PDF și Docs.

/** Bucăți de cel mult ~220 de litere, tăiate la sfârșit de propoziție: vocile citesc mai sigur fraze scurte. */
export function speechChunks(text: string, max = 220): string[] {
  const chunks: string[] = [];
  for (const s of text.match(/[^.!?\n]+[.!?]*/g) ?? [text]) {
    const t = s.trim();
    if (!t) continue;
    if (chunks.length && chunks[chunks.length - 1].length + t.length < max) chunks[chunks.length - 1] += ' ' + t;
    else chunks.push(t);
  }
  return chunks;
}

/** Pornește citirea textului (oprește ce se citea înainte); `onEnd` vine la sfârșit sau la eroare. Întoarce false dacă nu se poate citi. */
export function speak(text: string, onEnd: () => void): boolean {
  const synth = window.speechSynthesis;
  const chunks = speechChunks(text);
  if (!synth || !chunks.length) return false;
  const ro = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('ro'));
  synth.cancel();
  chunks.forEach((c, i) => {
    const u = new SpeechSynthesisUtterance(c);
    if (ro) u.voice = ro;
    u.lang = ro?.lang ?? 'ro-RO';
    if (i === chunks.length - 1) { u.onend = onEnd; u.onerror = onEnd; }
    synth.speak(u);
  });
  return true;
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
}
