// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Apărare împotriva PDF-urilor „bombă”: un flux JBIG2 de câțiva KB poate spune că desenul lui are 100.000 × 100.000 de puncte,
// iar pdf.js ar încerca să-l desfacă (peste 1 GB de memorie pentru fiecare flux), cu procesorul ocupat minute întregi.
// Pe un laptop cu 8 GB asta poate bloca tot calculatorul. Înainte de deschidere citim antetul fiecărui flux JBIG2
// (mărimea paginii și a zonelor lui) și, dacă e uriaș, îi schimbăm numele filtrului într-unul necunoscut, de aceeași lungime:
// pdf.js îl sare, iar restul documentului (textul, celelalte pagini) se deschide normal. Fișierul de pe disc rămâne neatins.

/** Peste atâtea puncte, un desen JBIG2 nu e o scanare reală (o pagină A4 la 1200 dpi are ~140 de milioane). */
const MAX_PIXELS = 300_000_000;

const NAME = new TextEncoder().encode('/JBIG2Decode');
const STREAM = new TextEncoder().encode('stream');

function indexOf(hay: Uint8Array, needle: Uint8Array, from: number): number {
  const first = needle[0];
  outer: for (let i = hay.indexOf(first, from); i !== -1 && i <= hay.length - needle.length; i = hay.indexOf(first, i + 1)) {
    for (let k = 1; k < needle.length; k++) if (hay[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}

const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

/** Cea mai mare suprafață (în puncte) anunțată de segmentele unui flux JBIG2 încorporat (fără antet de fișier). */
export function jbig2Area(b: Uint8Array, start: number, end = b.length): number {
  let i = start, max = 0;
  for (let seg = 0; seg < 64 && i + 11 <= end; seg++) {
    const number = u32(b, i); i += 4;
    const flags = b[i++];
    const type = flags & 0x3f;
    const pageAssoc4 = (flags & 0x40) !== 0;
    let count = b[i] >> 5;
    if (count === 7) { count = u32(b, i) & 0x1fffffff; i += 4 + Math.ceil((count + 1) / 8); } else i += 1;
    if (count > 1000) break;
    i += count * (number <= 256 ? 1 : number <= 65536 ? 2 : 4);
    i += pageAssoc4 ? 4 : 1;
    if (i + 4 > end) break;
    const len = u32(b, i); i += 4;
    // Informația paginii (48) și zonele de text / șablon / generice (6–43) încep cu lățimea și înălțimea.
    if ((type === 48 || (type >= 6 && type <= 43)) && i + 8 <= end) max = Math.max(max, u32(b, i) * u32(b, i + 4));
    if (type === 51 || len === 0xffffffff) break; // sfârșitul fișierului sau lungime necunoscută
    i += len;
  }
  return max;
}

/** Copia pe care o dăm lui pdf.js, fără fluxurile-bombă, și câte fluxuri am sărit. */
export function defuse(data: Uint8Array): { data: Uint8Array; removed: number } {
  let removed = 0;
  let out = data;
  for (let at = indexOf(data, NAME, 0); at !== -1; at = indexOf(data, NAME, at + NAME.length)) {
    let s = indexOf(data, STREAM, at);
    if (s === -1) break;
    s += STREAM.length;
    if (data[s] === 0x0d) s++;
    if (data[s] === 0x0a) s++;
    let area = 0;
    try { area = jbig2Area(data, s, Math.min(data.length, s + 1_000_000)); } catch { /* antet ciudat: îl lăsăm */ }
    if (area <= MAX_PIXELS) continue;
    if (out === data) out = data.slice();
    // „/JBIG2Decode” → „/SuiteBomb__”: aceeași lungime, deci tabelul de poziții al PDF-ului rămâne bun.
    out.set(new TextEncoder().encode('/SuiteBomb__'), at);
    removed++;
  }
  return { data: out, removed };
}
