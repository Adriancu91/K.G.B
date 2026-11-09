// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Video online (Inserare → ▶ Video online, în Docs și Slides): din adresa unui clip aducem pagina (doar citită, fără cookie-uri,
// prin web:get) și poza ei (og:image), apoi desenăm o „copertă”: poza clipului, ▶ în mijloc și titlul jos. Coperta intră ca poză
// cu legătura spre clip; clipul pornește în browser. Nu redăm playerul site-ului în aplicație (ar rula scripturi străine). Scris de la zero.
import { api } from './api';

export interface VideoCover { blob: Blob; title: string; href: string; site: string; w: number; h: number }

type Got = { data: Uint8Array; type: string; url: string };
async function get(href: string): Promise<Got> {
  if (api.webGet) {
    try { return await api.webGet(href); } catch (e) {
      throw new Error((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    }
  }
  const res = await fetch(href);
  if (!res.ok) throw new Error(`Site-ul a răspuns cu eroarea ${res.status}.`);
  return { data: new Uint8Array(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '', url: res.url || href };
}

/** Adresa scrisă de om („youtu.be/…”, „www.site.ro/clip”) cu https:// în față; undefined dacă nu e o adresă web. */
export function videoHref(v: string): string | undefined {
  const s = v.trim();
  if (!s || /[ <>"]/.test(s)) return undefined;
  const h = /^https?:[/][/]/i.test(s) ? s : /^(www[.])?[^ /@]+[.][a-z]{2,}([/?#].*)?$/i.test(s) ? 'https://' + s : '';
  try { return h && /^https?:$/.test(new URL(h).protocol) ? new URL(h).href : undefined; } catch { return undefined; }
}

/** Rândurile titlului, tăiate la lățimea dată (cel mult `max` rânduri, ultimul cu … dacă nu încape). */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/ +/).filter(Boolean), lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width <= width || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > max) {
    let last = lines[max - 1] + ' ' + lines.slice(max).join(' ');
    while (last.length > 1 && ctx.measureText(last + '…').width > width) last = last.slice(0, -1);
    lines.splice(max - 1, lines.length, last.trimEnd() + '…');
  }
  return lines;
}

/** Coperta clipului, 640 × 360 (16:9): poza paginii acoperind tot, ▶ în mijloc, titlul și site-ul jos. */
export async function videoCover(input: string): Promise<VideoCover> {
  const href = videoHref(input);
  if (!href) throw new Error('Adresa trebuie să fie o pagină web (de exemplu https://… ).');
  const { decodePage } = await import('./sheets/webTables');
  const { linkPreviewOf } = await import('./notes/linkPreview');
  const r = await get(href);
  const html = !r.type || /html|xml/i.test(r.type) ? decodePage(r.data.subarray(0, 600000), r.type) : '';
  const p = linkPreviewOf(html, r.url || href);
  let bmp: ImageBitmap | null = null;
  if (p.image) {
    try {
      const im = await get(p.image);
      if (/^image[/](jpeg|jpg|png|gif|webp|avif|bmp)/i.test(im.type) && im.data.length <= 8 * 1024 * 1024)
        bmp = await createImageBitmap(new Blob([im.data as BlobPart], { type: im.type.split(';')[0] }));
    } catch { /* fără poză: coperta rămâne închisă la culoare */ }
  }
  const W = 640, H = 360, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1f2430'; ctx.fillRect(0, 0, W, H);
  if (bmp) {
    const k = Math.max(W / bmp.width, H / bmp.height), dw = bmp.width * k, dh = bmp.height * k;
    ctx.drawImage(bmp, (W - dw) / 2, (H - dh) / 2, dw, dh);
    bmp.close();
  }
  // Jos, o umbră spre negru, ca titlul să se citească pe orice poză.
  const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = g; ctx.fillRect(0, H * 0.55, W, H * 0.45);
  // ▶ în mijloc: cerc închis, triunghi alb.
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.beginPath(); ctx.arc(W / 2, H / 2 - 12, 42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(W / 2 - 14, H / 2 - 36); ctx.lineTo(W / 2 + 24, H / 2 - 12); ctx.lineTo(W / 2 - 14, H / 2 + 12); ctx.closePath(); ctx.fill();
  ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif'; ctx.textBaseline = 'alphabetic';
  const lines = wrap(ctx, p.title, W - 48, 2);
  lines.forEach((l, i) => ctx.fillText(l, 24, H - 26 - (lines.length - 1 - i) * 30 - 22));
  ctx.font = '16px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('▶ ' + (p.site ?? ''), 24, H - 20);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Coperta nu s-a putut desena.'))), 'image/jpeg', 0.88));
  return { blob, title: p.title, href, site: p.site ?? '', w: W, h: H };
}
