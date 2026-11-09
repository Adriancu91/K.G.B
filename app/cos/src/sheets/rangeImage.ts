// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Copiază ca imagine” pentru celule: zona selectată, cu valorile afișate, formatarea și liniile grilei, devine o poză PNG
// (tabelul HTML de la copiere, pus într-un SVG cu foreignObject și desenat pe o pânză, de două ori mai mare, ca să fie clar).

const XHTML = 'http://www.w3.org/1999/xhtml';
/** Liniile grilei, ca pe ecran: subțiri și gri, sub chenarele puse de mână (care rămân în stilul celulei). */
const GRID_CSS = 'table{border-collapse:collapse;background:#fff}td{border:1px solid #d9d9d9;padding:2px 4px;vertical-align:bottom;white-space:pre-wrap}';

/** Tabelul HTML (de la copiere) ca SVG de mărimea dată (XHTML în foreignObject). */
export function tableSvg(html: string, w: number, h: number): string {
  const doc = new DOMParser().parseFromString(`<div xmlns="${XHTML}"><style>${GRID_CSS}</style>${html.replace(/<meta[^>]*>/i, '')}</div>`, 'text/html');
  const div = doc.body.firstElementChild as HTMLElement;
  div.setAttribute('xmlns', XHTML);
  const xhtml = new XMLSerializer().serializeToString(div);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${xhtml}</foreignObject></svg>`;
}

/** Măsoară tabelul în pagină (ascuns), apoi îl desenează ca PNG. */
export async function tableToPng(html: string, scale = 2): Promise<{ png: Blob; w: number; h: number }> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden';
  host.innerHTML = `<style>${GRID_CSS}</style>${html}`;
  document.body.appendChild(host);
  const t = host.querySelector('table');
  const box = t ? t.getBoundingClientRect() : { width: 0, height: 0 };
  host.remove();
  const w = Math.max(1, Math.ceil(box.width) + 1), h = Math.max(1, Math.ceil(box.height) + 1);
  const svg = tableSvg(html, w, h);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  const png = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('poza nu a putut fi făcută'))), 'image/png'));
  return { png, w, h };
}
