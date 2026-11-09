// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Export .mht: aceeași pagină ca la Export .html (tohtml.ts), dar ca „pagină web într-un singur fișier” (MHTML, RFC 2557):
// textul HTML și fiecare poză sunt părți MIME separate, legate prin Content-ID (adrese cid:, pe care le înțeleg și browserele). Se deschide în browsere și în
// programele de birou care citesc .mht, iar pozele nu mai sunt „data:” în mijlocul paginii.
const CRLF = '\r\n';

/** Base64 pe rânduri de 76 de caractere, cum cere MIME. */
function b64Lines(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return (btoa(bin).match(/.{1,76}/g) ?? []).join(CRLF);
}
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp' };
const unEsc = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Pozele „data:” din src="…" ale paginii, scoase ca părți separate (aceeași poză o singură dată); pagina le cere prin cid:. */
export function extractDataImages(html: string): { page: string; parts: { type: string; loc: string; bytes: Uint8Array }[] } {
  const parts: { type: string; loc: string; bytes: Uint8Array }[] = [];
  const seen = new Map<string, string>();
  const page = html.replace(/src="(data:[^"]*)"/g, (whole, attr: string) => {
    const url = unEsc(attr);
    const m = /^data:([^;,]+)((?:;[^;,]+)*),(.*)$/s.exec(url);
    if (!m) return whole;
    const known = seen.get(url);
    if (known) return `src="cid:${known}"`;
    const type = m[1].toLowerCase();
    let bytes: Uint8Array;
    try {
      bytes = /;base64/i.test(m[2]) ? Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(m[3]));
    } catch { return whole; }
    const loc = `poza${String(parts.length + 1).padStart(3, '0')}.${EXT[type] ?? 'bin'}@suite`;
    parts.push({ type, loc, bytes });
    seen.set(url, loc);
    return `src="cid:${loc}"`;
  });
  return { page, parts };
}

/** Pagina HTML devine MHTML: pozele „data:” din src="…" ies în părți separate (aceeași poză o singură dată). */
export function htmlToMht(html: string, title: string, boundary = '----=_Suite_' + Math.random().toString(36).slice(2, 12)): string {
  const base = 'file:///C:/notita';
  const { page, parts } = extractDataImages(html);
  const subject = '=?utf-8?B?' + b64Lines(new TextEncoder().encode(title)).replace(/\r\n/g, '') + '?=';
  const out = [
    'From: <Saved by Cyber Office Studio>',
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; type="text/html"; boundary="${boundary}"`,
    '',
    'This is a multi-part message in MIME format.',
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    `Content-Location: ${base}.htm`,
    '',
    b64Lines(new TextEncoder().encode(page)),
    '',
  ];
  for (const p of parts) {
    out.push(`--${boundary}`, `Content-Type: ${p.type}`, 'Content-Transfer-Encoding: base64', `Content-ID: <${p.loc}>`, '', b64Lines(p.bytes), '');
  }
  out.push(`--${boundary}--`, '');
  return out.join(CRLF);
}
