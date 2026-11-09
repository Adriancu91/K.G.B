// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Un e-mail salvat (.eml, MIME) → pagină HTML pentru PDF, în ⧉ Combină și ⚙ Lot: antetul (De la, Către, Cc, Data, Subiect),
// textul mesajului (partea HTML, altfel textul simplu), pozele din mesaj (cid:) puse la locul lor și lista atașamentelor.
// Pagina se face PDF în fereastra ascunsă fără scripturi și fără internet (pozele de pe site-uri nu se încarcă: nu anunță expeditorul).
import { currentLang, translateMsg } from '../i18n';

interface Part { headers: Map<string, string>; body: string; parts: Part[] }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const latin1 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const bytesOf = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255);

function decodeText(b: Uint8Array, charset: string): string {
  try { return new TextDecoder(charset || 'utf-8').decode(b); } catch { return new TextDecoder('utf-8').decode(b); }
}

function qp(s: string): Uint8Array {
  const t = s.replace(/=\r?\n/g, '');
  const out: number[] = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) { out.push(parseInt(t.slice(i + 1, i + 3), 16)); i += 2; } else out.push(t.charCodeAt(i) & 255);
  }
  return new Uint8Array(out);
}

function b64(s: string): Uint8Array {
  try { return bytesOf(atob(s.replace(/[^A-Za-z0-9+/=]/g, ''))); } catch { return new Uint8Array(); }
}

/** Antetele cu =?utf-8?B?…?= / =?iso-8859-2?Q?…?= (RFC 2047) → text. */
export function decodeWords(s: string): string {
  return s.replace(/=[?]([^?]+)[?]([BbQq])[?]([^?]*)[?]=(\s+(?==[?]))?/g, (_m, cs: string, enc: string, txt: string) => {
    const b = enc.toUpperCase() === 'B' ? b64(txt) : qp(txt.replace(/_/g, ' '));
    return decodeText(b, cs.replace(/[*].*$/, ''));
  });
}

function parsePart(raw: string): Part {
  const m = /\r?\n\r?\n/.exec(raw);
  const head = m ? raw.slice(0, m.index) : raw, body = m ? raw.slice(m.index + m[0].length) : '';
  const headers = new Map<string, string>();
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const k = line.indexOf(':');
    if (k > 0) { const name = line.slice(0, k).trim().toLowerCase(); if (!headers.has(name)) headers.set(name, line.slice(k + 1).trim()); }
  }
  const part: Part = { headers, body, parts: [] };
  const ct = headers.get('content-type') ?? '';
  const bd = /boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i.exec(ct);
  if (/^multipart\//i.test(ct) && bd) {
    const sep = '--' + (bd[1] ?? bd[2]);
    const chunks = body.split(sep);
    // Înainte de primul separator e preambulul; după „--” de la ultimul, epilogul.
    for (const c of chunks.slice(1)) {
      if (c.startsWith('--')) break;
      part.parts.push(parsePart(c.replace(/^\r?\n/, '')));
    }
  }
  return part;
}

const param = (h: string, name: string) => {
  // Forma cu diacritice (filename*=UTF-8''…) are întâietate față de cea fără (filename="…"), oricare ar fi ordinea lor.
  const m = new RegExp(name + '\\*\\s*=\\s*(?:"([^"]*)"|([^;]+))', 'i').exec(h) ?? new RegExp(name + '\\*?\\s*=\\s*(?:"([^"]*)"|([^;]+))', 'i').exec(h);
  const v = (m?.[1] ?? m?.[2] ?? '').trim();
  // filename*=utf-8''Raport%20lunar.pdf (RFC 2231)
  const ext = /^([^']*)'[^']*'(.*)$/.exec(v);
  if (ext) { return decodeText(bytesOf(ext[2].replace(/%([0-9A-Fa-f]{2})/g, (_x, hx: string) => String.fromCharCode(parseInt(hx, 16)))), ext[1]); }
  return decodeWords(v);
};

function partBytes(p: Part): Uint8Array {
  const enc = (p.headers.get('content-transfer-encoding') ?? '').toLowerCase();
  return enc.includes('base64') ? b64(p.body) : enc.includes('quoted-printable') ? qp(p.body) : bytesOf(p.body);
}

const leaves = (p: Part): Part[] => (p.parts.length ? p.parts.flatMap(leaves) : [p]);
const typeOf = (p: Part) => (p.headers.get('content-type') ?? 'text/plain').split(';')[0].trim().toLowerCase();
const isAttachment = (p: Part) => /^attachment/i.test(p.headers.get('content-disposition') ?? '') || (!!param(p.headers.get('content-disposition') ?? '', 'filename') && !p.headers.get('content-id'));

function toDataUrl(type: string, b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return `data:${type};base64,${btoa(s)}`;
}

function sizeText(n: number): string {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1).replace('.', ',')} MB`;
}

/** O pagină web salvată „într-un singur fișier” (.mht / .mhtml, tot MIME) → pagina HTML cu pozele și stilurile ei puse înăuntru
 *  (data URL), ca să se vadă fără internet. Fără scripturi, cadre și trimiteri la fișierele de pe calculator. */
export function mhtToHtml(data: Uint8Array): string {
  const all = leaves(parsePart(latin1(data)));
  const page = all.find((p) => typeOf(p) === 'text/html');
  if (!page) throw new Error('pagina e goală');
  const keyOf = (p: Part) => [(p.headers.get('content-location') ?? '').trim(), (p.headers.get('content-id') ?? '').replace(/^<|>$/g, '').trim()];
  const urls = new Map<string, string>();
  const swap = (s: string) => {
    let out = s;
    for (const [k, u] of urls) if (k) out = out.split(k).join(u);
    return out;
  };
  // Întâi pozele și fonturile, apoi foile de stil (care pot trimite la ele).
  for (const p of all) {
    if (p === page || typeOf(p) === 'text/css' || typeOf(p) === 'text/html') continue;
    const [loc, id] = keyOf(p), u = toDataUrl(typeOf(p), partBytes(p));
    if (loc) urls.set(loc, u);
    if (id) urls.set('cid:' + id, u);
  }
  for (const p of all) {
    if (typeOf(p) !== 'text/css') continue;
    const css = swap(decodeText(partBytes(p), param(p.headers.get('content-type') ?? '', 'charset'))).replace(/\bfile:/gi, 'blocat:');
    const u = toDataUrl('text/css', new TextEncoder().encode(css));
    const [loc, id] = keyOf(p);
    if (loc) urls.set(loc, u);
    if (id) urls.set('cid:' + id, u);
  }
  // Adresele lungi întâi, ca o adresă să nu fie înlocuită în mijlocul alteia mai lungi.
  const sorted = new Map([...urls].sort((a, b) => b[0].length - a[0].length));
  urls.clear();
  for (const [k, v] of sorted) urls.set(k, v);
  let html = swap(decodeText(partBytes(page), param(page.headers.get('content-type') ?? '', 'charset')))
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<\/?(iframe|frame|frameset|object|embed|meta|base)\b[^>]*>/gi, '').replace(/\bfile:/gi, 'blocat:');
  const head = /<head[^>]*>/i.exec(html);
  html = head ? html.slice(0, head.index + head[0].length) + '<meta charset="utf-8">' + html.slice(head.index + head[0].length) : '<meta charset="utf-8">' + html;
  return html;
}

/** Fișierele atașate la mesaj (numele, felul, octeții), pentru PDF-ul mesajului: intră ca atașamente în PDF, nu se rulează. */
export function emlAttachments(data: Uint8Array): { name: string; type: string; data: Uint8Array }[] {
  const root = parsePart(latin1(data));
  const all = leaves(root);
  const html = all.find((p) => typeOf(p) === 'text/html' && !isAttachment(p));
  const plain = all.find((p) => typeOf(p) === 'text/plain' && !isAttachment(p));
  return attachedParts(all, html, plain).map((p, i) => ({
    name: param(p.headers.get('content-disposition') ?? '', 'filename') || param(p.headers.get('content-type') ?? '', 'name') || `atasament-${i + 1}`,
    type: typeOf(p),
    data: partBytes(p),
  }));
}

/** Părțile care sunt fișiere atașate: marcate așa sau, fără Content-ID, orice nu e textul mesajului. */
const attachedParts = (all: Part[], html?: Part, plain?: Part) =>
  all.filter((p) => isAttachment(p) || (!p.headers.get('content-id') && p !== html && p !== plain && !typeOf(p).startsWith('text/') && !typeOf(p).startsWith('multipart/')));

/** Pagina HTML completă a mesajului. */
export function emlToHtml(data: Uint8Array, fallbackTitle: string): string {
  const root = parsePart(latin1(data));
  const h = (n: string) => decodeWords(root.headers.get(n) ?? '');
  const all = leaves(root);
  const html = all.find((p) => typeOf(p) === 'text/html' && !isAttachment(p));
  const plain = all.find((p) => typeOf(p) === 'text/plain' && !isAttachment(p));
  const charset = (p: Part) => param(p.headers.get('content-type') ?? '', 'charset');
  // Pozele din mesaj: cid:… → data URL.
  const cids = new Map<string, string>();
  for (const p of all) {
    const id = (p.headers.get('content-id') ?? '').replace(/^<|>$/g, '').trim();
    if (id && typeOf(p).startsWith('image/')) cids.set(id.toLowerCase(), toDataUrl(typeOf(p), partBytes(p)));
  }
  let body = '', style = '';
  if (html) {
    let src = decodeText(partBytes(html), charset(html));
    style = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
    const bm = /<body[^>]*>([\s\S]*)<\/body>/i.exec(src);
    src = bm ? bm[1] : src.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<\/?html[^>]*>/gi, '');
    // Fără scripturi, cadre și trimiteri la fișierele de pe calculator (file:): mesajul nu are voie să aducă în PDF alte fișiere.
    body = src.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<\/?(iframe|frame|frameset|object|embed|link|meta|base)\b[^>]*>/gi, '').replace(/\bfile:/gi, 'blocat:').replace(/(src\s*=\s*["']?)cid:([^"'\s>]+)/gi, (m, pre: string, id: string) => {
      const u = cids.get(decodeURIComponent(id).toLowerCase());
      return u ? pre + u : m;
    });
  } else if (plain) {
    body = `<pre class="mail-plain">${esc(decodeText(partBytes(plain), charset(plain)))}</pre>`;
  }
  const files = attachedParts(all, html, plain);
  const rows: [string, string][] = [['De la:', h('from')], ['Către:', h('to')], ['Cc:', h('cc')], ['Data:', h('date')], ['Subiect:', h('subject')]];
  const date = new Date(h('date'));
  if (!isNaN(+date)) rows[3][1] = date.toLocaleString(currentLang() === 'en' ? 'en-GB' : 'ro-RO', { dateStyle: 'full', timeStyle: 'short' });
  const head = rows.filter(([, v]) => v).map(([k, v]) => `<tr><th>${esc(translateMsg(k))}</th><td>${esc(v)}</td></tr>`).join('');
  const att = files.length
    ? `<div class="mail-att"><b>${esc(translateMsg('Atașamente:'))}</b> ${files.map((p) => esc(param(p.headers.get('content-disposition') ?? '', 'filename') || param(p.headers.get('content-type') ?? '', 'name') || translateMsg('fără nume')) + ` (${sizeText(partBytes(p).length)})`).join(', ')}</div>`
    : '';
  const title = h('subject') || fallbackTitle;
  return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>'
    + 'body{font-family:Calibri,Carlito,Arial,sans-serif;font-size:11pt;line-height:1.35;color:#000;margin:0}'
    + '.mail-head{border-collapse:collapse;margin:0 0 4pt;font-size:10.5pt}.mail-head th{text-align:left;padding:1pt 8pt 1pt 0;color:#555;font-weight:600;vertical-align:top;white-space:nowrap}.mail-head td{padding:1pt 0}'
    + '.mail-att{font-size:10pt;color:#333;margin:4pt 0}.mail-sep{border:0;border-top:1px solid #999;margin:6pt 0 10pt}'
    + '.mail-plain{white-space:pre-wrap;font:inherit;margin:0}img{max-width:100%;height:auto}'
    + '</style><style>' + style.replace(/<\/style/gi, '').replace(/\bfile:/gi, 'blocat:') + '</style></head><body>'
    + '<table class="mail-head">' + head + '</table>' + att + '<hr class="mail-sep">' + body + '</body></html>';
}
