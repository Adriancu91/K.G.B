// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Lipire din pagini web și din Word (ca „clipping”-ul din OneNote, cât se poate într-o notiță cu text simplu):
// listele devin • / 1. (cu sub-liste), căsuțele ☐ / ☑, legăturile „text (adresă)”, tabelele rânduri „| a | b |”, paragrafele rânduri separate,
// titlurile „# ” / „## ” / „### ”, iar aldinul, cursivul, sublinierea, tăierea, evidențierea și culorile devin semnele din inline.ts
// (**…**, *…*, ++…++, ~~…~~, ==…==, {roșu:…}, {fundal verde:…}), iar textul mai mare / mai mic sau cu alt font decât restul
// devine {mare:…} / {mic:…} / {font Georgia:…} (doar fonturile din lista notițelor; fontul și mărimea folosite de cea mai mare parte
// a textului lipit sunt „obișnuite” și nu se mai scriu).
// Se folosește doar când HTML-ul are liste, legături, tabele, titluri sau formatare; altfel lipirea obișnuită e deja bună.
import { INK_COLORS, INK_FONTS } from './inline';

const BLOCK = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'DL', 'DT', 'DD', 'FIGURE', 'FIGCAPTION', 'ADDRESS', 'MAIN', 'NAV', 'ASIDE']);
// După acestea vine un rând gol (ca între paragrafe).
const GAP = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'TABLE', 'FIGURE']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'OBJECT', 'SVG', 'HEAD', 'TITLE', 'META', 'LINK', 'BUTTON', 'SELECT']);

const FORMAT_SEL = 'b, strong, i, em, u, ins, s, strike, del, mark, h1, h2, h3, font, code, kbd, samp, [style*="font-weight"], [style*="italic"], [style*="color"], [style*="underline"], [style*="line-through"], [style*="background"], [style*="font-size"], [style*="font-family"]';

/** Proprietatea CSS „p” din atributul style al elementului ('' dacă lipsește). */
const styleProp = (el: Element, p: string) => new RegExp(`(?:^|;)\\s*${p}\\s*:\\s*([^;]+)`).exec((el.getAttribute('style') ?? '').toLowerCase())?.[1]?.trim() ?? '';
/** Mărimea din <font size="1…7">, în puncte (3 = obișnuit). */
const FONT_TAG_PT = [0, 7.5, 10, 12, 13.5, 18, 24, 36];
/** Mărimea fontului unui element, în puncte (px → pt), ca raport (em, %) sau ca nume (large); null dacă n-are. */
function ownSize(el: Element): { pt?: number; rel?: number } | null {
  if (el.tagName === 'FONT') { const n = Number(el.getAttribute('size')); if (n >= 1 && n <= 7) return { pt: FONT_TAG_PT[n] }; }
  const v = styleProp(el, 'font-size');
  if (!v) return null;
  const m = /^([\d.]+)\s*(pt|px|em|rem|%)?/.exec(v);
  if (m) {
    const n = parseFloat(m[1]), u = m[2] ?? 'px';
    return u === 'pt' ? { pt: n } : u === 'px' ? { pt: n * 0.75 } : { rel: u === '%' ? n / 100 : n };
  }
  const kw: Record<string, number> = { 'xx-small': 0.6, 'x-small': 0.7, small: 0.85, smaller: 0.85, medium: 1, large: 1.3, larger: 1.3, 'x-large': 1.6, 'xx-large': 2, 'xxx-large': 3 };
  return kw[v] ? { rel: kw[v] } : null;
}
/** Numele mărimii din notiță pentru raportul față de textul obișnuit (null = obișnuit). */
export function sizeName(ratio: number): string | null {
  if (!(ratio > 0)) return null;
  return ratio < 0.8 ? 'foarte mic' : ratio < 0.93 ? 'mic' : ratio < 1.15 ? null : ratio < 1.5 ? 'mare' : ratio < 1.95 ? 'foarte mare' : 'uriaș';
}
/** Fontul din lista notițelor pentru o valoare CSS font-family (primul font cunoscut din listă); null dacă nu-l avem. */
export function fontName(css: string): string | null {
  for (const part of css.split(',')) {
    const n = part.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
    const hit = INK_FONTS.find(([f]) => f.toLowerCase() === n);
    if (hit) return hit[0];
    if (/^(serif|sans-serif|monospace|cursive|system-ui)$/.test(n)) return null;
  }
  return null;
}
const ownFont = (el: Element) => (el.tagName === 'FONT' && el.getAttribute('face')) || styleProp(el, 'font-family');

/** Fontul și mărimea (în puncte) folosite de cea mai mare parte a textului lipit: ele rămân „text obișnuit”. */
let base: { pt: number; font: string | null } = { pt: 12, font: null };
function findBase(doc: Document) {
  const pts = new Map<number, number>(), fonts = new Map<string, number>();
  const w = doc.createTreeWalker(doc.body, 4);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const len = (n.textContent ?? '').trim().length;
    if (!len) continue;
    let pt: number | null = null, rel = 1, font: string | null | undefined;
    for (let e = n.parentElement; e && e !== doc.documentElement; e = e.parentElement) {
      const sz: ReturnType<typeof ownSize> = pt === null ? ownSize(e) : null;
      if (sz?.pt) pt = sz.pt * rel; else if (sz?.rel) rel *= sz.rel;
      if (font === undefined) { const f = ownFont(e); if (f) font = fontName(f); }
    }
    const p = Math.round((pt ?? 12 * rel) * 2) / 2;
    pts.set(p, (pts.get(p) ?? 0) + len);
    const fk = font ?? '';
    fonts.set(fk, (fonts.get(fk) ?? 0) + len);
  }
  const top = <K,>(m: Map<K, number>, d: K) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0] ?? d;
  base = { pt: top(pts, 12), font: top(fonts, '') || null };
}

/** True dacă merită convertit HTML-ul (are liste, legături web, tabele, titluri sau text formatat). */
export function worthConverting(doc: Document): boolean {
  if (doc.body) findBase(doc);
  if (doc.body?.querySelector('li, table, a[href^="http"], a[href^="mailto:"], input[type="checkbox"]')) return true;
  return [...(doc.body?.querySelectorAll(FORMAT_SEL) ?? [])].some((el) => inlineMarks(el).length > 0 || /^H[1-3]$/.test(el.tagName));
}

/** Culoarea CSS ca [r, g, b] (#rgb, #rrggbb, rgb(), rgba() opac și câteva nume); null dacă nu o știm. */
const NAMED: Record<string, string> = { red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', magenta: '#ff00ff', fuchsia: '#ff00ff', lime: '#00ff00', aqua: '#00ffff', cyan: '#00ffff', teal: '#008080', navy: '#000080', maroon: '#800000', olive: '#808000', darkred: '#8b0000', darkgreen: '#006400', darkblue: '#00008b', gray: '#808080', grey: '#808080', black: '#000000', white: '#ffffff' };
export function cssRgb(v: string): [number, number, number] | null {
  let s = v.trim().toLowerCase();
  if (NAMED[s]) s = NAMED[s];
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [0, 1, 2].map((i) => parseInt(m![1][i] + m![1][i], 16)) as [number, number, number];
  m = /^#([0-9a-f]{6})/.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as [number, number, number];
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)/.exec(s);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return a < 0.5 ? null : [+m[1], +m[2], +m[3]];
  }
  return null;
}

/** Numele culorii din notiță cea mai apropiată (după nuanță); null la negru, alb și gri (textul obișnuit). */
export function nearestInk(rgb: [number, number, number], back: boolean): string | null {
  const [r, g, b] = rgb, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  // Fundalurile sunt de obicei culori pale (puțin diferite de alb), textul colorat e mai aprins.
  if (mx - mn < (back ? 24 : 50)) return null;
  let best: string | null = null, bd = Infinity;
  for (const [name, text] of INK_COLORS) {
    if (name === 'gri') continue;
    const c = cssRgb(text)!;
    // Comparăm nuanțele (culorile aduse la aceeași strălucire), ca roșul închis să rămână roșu și galbenul pal galben.
    const k = (x: [number, number, number]) => { const m = Math.min(...x), t = Math.max(1, x[0] + x[1] + x[2] - 3 * m); return x.map((v) => (v - m) / t); };
    const p = k(rgb), q = k(c), d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
    if (d < bd) { bd = d; best = name; }
  }
  return best;
}

/** Semnele de formatare ale unui element din text (de la exterior spre interior): aldin, cursiv, subliniat, tăiat, culori. */
export function inlineMarks(el: Element, inHeading = false): [string, string][] {
  const tag = el.tagName;
  const prop = (p: string) => styleProp(el, p);
  const out: [string, string][] = [];
  // Fontul (doar dacă e altul decât al restului textului; <code> = Consolas) și mărimea față de textul obișnuit (nu în titluri).
  const fn = /^(CODE|KBD|SAMP|TT)$/.test(tag) ? 'Consolas' : (() => { const f = ownFont(el); return f ? fontName(f) : null; })();
  if (fn && fn !== base.font) out.push([`{font ${fn}:`, '}']);
  const sz = inHeading ? null : ownSize(el);
  const szName = sz ? sizeName(sz.pt ? sz.pt / base.pt : sz.rel!) : null;
  if (szName) out.push([`{${szName}:`, '}']);
  const fw = prop('font-weight');
  // Documentele online pun totul într-un <b style="font-weight:normal">: acela nu e aldin.
  if (/^(bold|bolder|[6-9]00)$/.test(fw) || ((tag === 'B' || tag === 'STRONG') && !/^(normal|[1-4]00)$/.test(fw))) out.push(['**', '**']);
  const fs = prop('font-style');
  if (fs === 'italic' || fs === 'oblique' || ((tag === 'I' || tag === 'EM') && fs !== 'normal')) out.push(['*', '*']);
  const td = prop('text-decoration') + ' ' + prop('text-decoration-line');
  if (/underline/.test(td) || ((tag === 'U' || tag === 'INS') && !/none/.test(td))) out.push(['++', '++']);
  if (/line-through/.test(td) || tag === 'S' || tag === 'STRIKE' || tag === 'DEL') out.push(['~~', '~~']);
  const bg = prop('background-color') || prop('background') || prop('mso-highlight');
  const bgRgb = bg ? cssRgb(bg.split(/\s+/)[0]) : null;
  const bgName = tag === 'MARK' && !bg ? 'galben' : bgRgb ? nearestInk(bgRgb, true) : null;
  if (bgName === 'galben') out.push(['==', '==']);
  else if (bgName) out.push([`{fundal ${bgName}:`, '}']);
  const col = prop('color') || (tag === 'FONT' ? el.getAttribute('color') ?? '' : '');
  const colName = col ? (() => { const c = cssRgb(col); return c ? nearestInk(c, false) : null; })() : null;
  if (colName) out.push([`{${colName}:`, '}']);
  return out;
}

/**
 * Pozele din HTML-ul lipit, în ordine, fără dubluri (cel mult 10): cele puse direct în text (data:image/…) și cele de pe
 * internet (http / https, cu adresa făcută completă după <base> sau SourceURL). Pozele de 1–2 px (contoare) se sar.
 */
export function htmlImageSources(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const base = doc.querySelector('base[href]')?.getAttribute('href') || /SourceURL:(\S+)/.exec(html)?.[1] || undefined;
  const out: string[] = [];
  for (const el of doc.querySelectorAll('img')) {
    const raw = (el.getAttribute('src') ?? '').trim();
    const tiny = ['width', 'height'].some((a) => { const v = parseInt(el.getAttribute(a) ?? '', 10); return v > 0 && v <= 2; });
    if (!raw || tiny || SKIP_IMG(el)) continue;
    let src = '';
    if (/^data:image[/](png|jpe?g|gif|webp|bmp);base64,/i.test(raw)) src = raw.replace(/\s+/g, '');
    else { try { const u = new URL(raw, base); if (/^https?:$/.test(u.protocol)) src = u.href; } catch { /* adresă relativă fără pagină: o sărim */ } }
    if (src && !out.includes(src)) out.push(src);
    if (out.length >= 10) break;
  }
  return out;
}
const SKIP_IMG = (el: Element) => (el as HTMLElement).hidden || /display:\s*none/i.test(el.getAttribute('style') ?? '');

export function htmlToNoteText(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc.body || !worthConverting(doc)) return null;
  const out: string[] = [];
  let line = '';
  // \s cuprinde și spațiul care nu se rupe (&nbsp;). Spațiile de la început (sub-liste) rămân.
  const flush = () => {
    const pad = /^ */.exec(line)![0];
    const t = pad + line.slice(pad.length).replace(/\s+/g, ' ').trimEnd();
    if (t.trim()) out.push(t);
    line = '';
  };
  const gap = () => { flush(); if (out.length && out[out.length - 1] !== '') out.push(''); };
  const text = (s: string) => { line += line.trim() ? s : s.replace(/^\s+/, ''); };

  let heading = 0;
  const walk = (n: Node, depth: number) => {
    if (n.nodeType === 3) { text((n.textContent ?? '').replace(/\s+/g, ' ')); return; }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    const tag = el.tagName;
    if (SKIP.has(tag)) return;
    if ((el as HTMLElement).hidden || /display:\s*none/i.test(el.getAttribute('style') ?? '')) return;
    if (tag === 'BR') { flush(); return; }
    if (tag === 'IMG') { const alt = el.getAttribute('alt')?.trim(); if (alt) text(`[${alt}] `); return; }
    if (tag === 'INPUT' && (el as HTMLInputElement).type === 'checkbox') { text((el as HTMLInputElement).checked || el.hasAttribute('checked') ? '☑ ' : '☐ '); return; }
    if (tag === 'A') {
      const href = el.getAttribute('href') ?? '';
      const label = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (/^(https?:|mailto:)/i.test(href)) {
        const url = href.replace(/^mailto:/i, '');
        text(!label || label === href || label === url ? url : `${label} (${url})`);
        return;
      }
    }
    if (tag === 'LI') {
      flush();
      const parent = el.parentElement;
      const pad = '    '.repeat(Math.max(0, depth - 1));
      const hasBox = !!el.querySelector(':scope > input[type="checkbox"], :scope > label > input[type="checkbox"], :scope > p > input[type="checkbox"]');
      if (hasBox) line = pad;
      else if (parent?.tagName === 'OL') {
        const start = Number(parent.getAttribute('start')) || 1;
        line = `${pad}${start + [...parent.children].filter((c) => c.tagName === 'LI').indexOf(el)}. `;
      } else line = `${pad}• `;
      for (const c of el.childNodes) {
        const t = (c as Element).tagName;
        if (t === 'P' || t === 'DIV') { for (const cc of c.childNodes) walk(cc, depth); continue; } // <li><p>…</p></li> din Word
        walk(c, t === 'UL' || t === 'OL' ? depth + 1 : depth);
      }
      flush();
      return;
    }
    if (tag === 'UL' || tag === 'OL') {
      if (depth === 0) gap(); else flush();
      for (const c of el.childNodes) walk(c, depth === 0 ? 1 : depth);
      if (depth === 0) gap(); else flush();
      return;
    }
    if (tag === 'TR') {
      flush();
      const cells = [...el.children].filter((c) => c.tagName === 'TD' || c.tagName === 'TH').map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim());
      if (cells.some(Boolean)) {
        // Tabel ca rânduri „| a | b |”; sub primul rând, „| --- |” îl face cap de tabel (Lectura și exportul arată un tabel adevărat).
        out.push('| ' + cells.join(' | ') + ' |');
        if (el.closest('table')?.querySelector('tr') === el) out.push('| ' + cells.map(() => '---').join(' | ') + ' |');
      }
      return;
    }
    const hl = /^H([1-3])$/.exec(tag);
    if (hl) {
      // Titlul: „# ” / „## ” / „### ” la începutul rândului (un titlu gol nu lasă semnul singur).
      gap();
      const mark = '#'.repeat(+hl[1]) + ' ';
      line = mark;
      heading++;
      for (const c of el.childNodes) walk(c, depth);
      heading--;
      if (line === mark || !line.slice(mark.length).trim()) line = '';
      gap();
      return;
    }
    const marks = BLOCK.has(tag) ? [] : inlineMarks(el, heading > 0);
    if (GAP.has(tag)) gap(); else if (BLOCK.has(tag)) flush();
    const n0 = out.length, at = line.length;
    for (const c of el.childNodes) walk(c, depth);
    // Textul formatat de pe același rând se pune între semne (spațiile rămân în afara lor, ca semnele să fie recunoscute).
    if (marks.length && out.length === n0 && line.length > at) {
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(line.slice(at))!;
      let s = m[2];
      if (s) {
        for (const [o, cl] of [...marks].reverse()) if (!(s.startsWith(o) && s.endsWith(cl) && s.length > o.length + cl.length)) s = o + s + cl;
        line = line.slice(0, at) + m[1] + s + m[3];
      }
    }
    if (GAP.has(tag)) gap(); else if (BLOCK.has(tag)) flush();
  };
  walk(doc.body, 0);
  flush();
  while (out.length && !out[out.length - 1]) out.pop();
  while (out.length && !out[0]) out.shift();
  const res = out.join('\n');
  return res.trim() ? res : null;
}
