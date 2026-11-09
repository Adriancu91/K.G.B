// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Previzualizarea legăturilor web din notițe: din pagina adusă (doar citită) luăm titlul, descrierea și numele site-ului,
// din etichetele <meta> de tip og: / twitter: sau din <title> și <meta name="description">. Scris de la zero.
import type { LinkPreview } from './store';

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»', bdquo: '„', rdquo: '”', ldquo: '“', rsquo: '’', lsquo: '‘' };
const entities = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
const clean = (s: string | undefined, max: number) => {
  const t = entities((s ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
};

/** Atributele unei etichete HTML (nume cu litere mici). */
function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  return out;
}

/** Fișa legăturii din textul paginii; fără titlu, folosește adresa (fără https://). */
export function linkPreviewOf(html: string, url: string): LinkPreview {
  const head = html.slice(0, 300000);
  const meta: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const k = (a.property || a.name || '').toLowerCase();
    if (k && a.content !== undefined && !(k in meta)) meta[k] = a.content;
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  let host = url;
  try { host = new URL(url).hostname.replace(/^www[.]/i, ''); } catch { /* adresă ciudată: rămâne cum e */ }
  const title = clean(meta['og:title'] || meta['twitter:title'] || titleTag, 200) || host;
  const desc = clean(meta['og:description'] || meta['twitter:description'] || meta.description, 300);
  const site = clean(meta['og:site_name'], 80) || host;
  // Poza paginii (og:image / twitter:image / <link rel="image_src">), cu adresa făcută completă; doar http(s).
  const linkImg = /<link\b[^>]*\brel\s*=\s*["']?image_src[^>]*>/i.exec(head)?.[0];
  const rawImg = meta['og:image:secure_url'] || meta['og:image'] || meta['og:image:url'] || meta['twitter:image'] || meta['twitter:image:src'] || (linkImg ? attrs(linkImg).href : '');
  let image = '';
  try { const a = new URL(entities(rawImg.trim()), url); if (rawImg.trim() && /^https?:$/.test(a.protocol)) image = a.href; } catch { /* adresă stricată: fără poză */ }
  // Video online (o pagină de clip): og:type video.* sau og:video / twitter:player.
  const video = /^video/i.test(meta['og:type'] ?? '') || !!(meta['og:video'] || meta['og:video:url'] || meta['og:video:secure_url'] || meta['twitter:player']);
  return { url, title, ...(desc ? { desc } : {}), ...(site ? { site } : {}), ...(image ? { image } : {}), ...(video ? { video: true } : {}) };
}
