// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Preluare date → Din web: o pagină de pe internet (sau un .csv de la o adresă), adusă de procesul principal, din care
// luăm tabelele. Pagina e doar text: scripturile, stilurile și comentariile se scot înainte de citire, nimic nu rulează.
// Scris de la zero.

/** Adresa scrisă de utilizator, completată cu https:// dacă lipsește; altfel un mesaj de eroare. */
export function normalizeUrl(s: string): URL | string {
  let t = s.trim();
  if (!t) return 'Scrie adresa paginii, de exemplu https://exemplu.ro/preturi.html';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) t = 'https://' + t;
  let u: URL;
  try { u = new URL(t); } catch { return 'Adresa nu e bună. Verifică dacă e scrisă întreagă.'; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'Adresa trebuie să înceapă cu http:// sau https://.';
  return u;
}

/** Numele registrului făcut din adresă: site-ul și ultima parte a căii (fără / și \). */
export function nameFromUrl(u: URL): string {
  const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '').replace(/\.(html?|php|aspx?|jsp)$/i, '');
  return (u.hostname + (last ? ' ' + last : '')).replace(/[\\/:*?"<>|]+/g, ' ').trim();
}

/** Răspunsul e un fișier de date simple (.csv / .txt), nu o pagină? */
export function isTextData(type: string, u: URL): boolean {
  return /text\/(csv|tab-separated-values|plain)/i.test(type) || /\.(csv|tsv|txt)$/i.test(u.pathname);
}

/** Textul paginii, în codarea ei (din antetul serverului sau din <meta charset>). */
export function decodePage(data: Uint8Array, type = ''): string {
  const utf = new TextDecoder('utf-8', { fatal: false }).decode(data);
  const cs = (/charset\s*=\s*["']?([\w-]+)/i.exec(type)?.[1] ?? /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(utf.slice(0, 4096))?.[1])?.toLowerCase();
  let html = utf;
  if (cs && !/^utf-?8$/.test(cs)) {
    try { html = new TextDecoder(cs).decode(data); } catch { /* codare necunoscută: rămâne UTF-8 */ }
  }
  return html;
}

/** Textul paginii fără scripturi, stiluri și comentarii (doar tabelele și textul rămân). */
export function webHtml(data: Uint8Array, type = ''): string {
  return decodePage(data, type)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template|svg|iframe|object|select)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|link|meta|input|button|select)\b[^>]*>/gi, '');
}
