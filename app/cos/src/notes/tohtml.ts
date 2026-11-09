// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Notița ca pagină web (.html) dintr-un singur fișier: titlul, textul (cu rândurile păstrate și adresele web clicabile), pozele incluse
// și lista atașamentelor. Se deschide în orice browser și se poate trimite oricui (ca exportul „Pagină web” din OneNote).
import { Note, shownTitle } from './store';
import { boxImages, withBoxes } from './freeCanvas';
import { fontCss, parseBlocks, parseInline } from './inline';
import { equationAlt, equationSvg } from '../docs/equation';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Textul notiței în HTML: caracterele speciale scăpate, adresele web devin legături. */
export function bodyHtml(body: string): string {
  const re = /\b(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]]|www\.[^\s<>"]+[^\s<>".,;:!?)\]])/g;
  let out = '';
  let at = 0;
  for (const m of body.matchAll(re)) {
    out += esc(body.slice(at, m.index));
    const url = m[0];
    out += `<a href="${esc(url.startsWith('www.') ? 'https://' + url : url)}">${esc(url)}</a>`;
    at = m.index! + url.length;
  }
  return out + esc(body.slice(at));
}

/** Un rând cu formatarea lui: <strong>, <em>, <u>, <s>, <mark>. */
function inlineHtml(t: string): string {
  return parseInline(t).map((p) => {
    if (p.eq) return '<img class="eq" style="vertical-align:middle" alt="' + esc(equationAlt({ src: p.eq })) + '" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(equationSvg({ src: p.eq }).svg) + '">';
    let h = bodyHtml(p.s);
    if (p.c) h = '<span style="color:' + p.c + '">' + h + '</span>';
    if (p.sz || p.f) h = '<span style="' + (p.sz ? 'font-size:' + p.sz + 'em;' : '') + (p.f ? 'font-family:' + esc(p.f) : '') + '">' + h + '</span>';
    if (p.hc) h = '<mark style="background:' + p.hc + '">' + h + '</mark>';
    if (p.h) h = '<mark>' + h + '</mark>';
    if (p.u) h = '<u>' + h + '</u>';
    if (p.x) h = '<s>' + h + '</s>';
    if (p.i) h = '<em>' + h + '</em>';
    if (p.b) h = '<strong>' + h + '</strong>';
    return h;
  }).join('');
}

/** Textul notiței pe blocuri: titluri, tabele și paragrafe (rândurile din paragraf rămân pe rânduri). */
export function richBodyHtml(body: string): string {
  return parseBlocks(body).map((b) => {
    const st = b.kind !== 'table' && b.align ? ` style="text-align:${b.align}"` : '';
    if (b.kind === 'h') { const h = Math.min(6, b.level + 1); return `<h${h}${st}>${inlineHtml(b.text)}</h${h}>`; }
    if (b.kind === 'table') {
      const head = b.head ? '<thead><tr>' + b.head.map((c) => '<th>' + inlineHtml(c) + '</th>').join('') + '</tr></thead>' : '';
      return '<table>' + head + '<tbody>' + b.rows.map((r) => '<tr>' + r.map((c) => '<td>' + inlineHtml(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
    }
    return '<p' + st + '>' + inlineHtml(b.text) + '</p>';
  }).join('');
}

export function noteToHtml(n: Note): string {
  const title = shownTitle(n) || 'Notiță';
  const imgs = n.secret ? [] : [...(n.images ?? []), ...boxImages(n.boxes)];
  const files = n.secret ? [] : n.files ?? [];
  const when = new Date(n.updated);
  const date = Number.isNaN(when.getTime()) ? '' : when.toLocaleString('ro-RO', { dateStyle: 'long', timeStyle: 'short' });
  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body { font-family: ${fontCss(n.font) ?? "'Segoe UI', Arial, sans-serif"}; max-width: 760px; margin: 32px auto; padding: 0 16px; color: #1f2328; line-height: 1.6; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .meta { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
  .body { overflow-wrap: anywhere; font-size: 16px; }
  .body p { white-space: pre-wrap; margin: 0 0 12px; }
  .body h2, .body h3, .body h4 { margin: 20px 0 8px; }
  .body mark { background: #fff176; }
  table { border-collapse: collapse; margin: 0 0 12px; }
  th, td { border: 1px solid #c9ced6; padding: 4px 10px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
  img { max-width: 100%; border-radius: 6px; margin: 12px 0; display: block; }
  .files { color: #6b7280; font-size: 14px; margin-top: 16px; }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<div class="meta">${n.section ? `${esc(n.section)} · ` : ''}${esc(date)}</div>
<div class="body">${n.secret ? '🔒 Notiță blocată cu parolă.' : richBodyHtml(withBoxes(n.title.trim() ? n.body : n.body.split('\n').slice(1).join('\n'), n))}</div>
${imgs.map((src, i) => `<img src="${esc(src)}" alt="Poza ${i + 1}">`).join('\n')}
${files.length ? `<p class="files">Atașamente (rămase în Cyber Office Studio): ${files.map((f) => esc(f.name)).join(', ')}</p>` : ''}
</body>
</html>
`;
}
