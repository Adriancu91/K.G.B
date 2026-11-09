// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Rapoartele „.xls” care sunt de fapt o pagină web cu tabele (le salvează așa multe programe de gestiune și site-uri:
// <html> cu <table>, uneori cu rânduri goale înainte). Programul de calcul cunoscut le deschide ca tabel; noi la fel:
// toate tabelele paginii, unul sub altul, cu celulele unite (colspan / rowspan), capul de tabel îngroșat, culorile,
// alinierea, chenarele și mărimea titlurilor din stilul paginii. Scris de la zero, cu DOMParser-ul ferestrei.
import type { CellStyle } from './format';
import type { XlsxImport, XlsxSheet } from './xlsx';

const MAX_ROWS = 100000, MAX_COLS = 1000;

/** Începutul fișierului (fără rânduri goale) e HTML cu tabel? */
export function looksLikeHtmlTable(data: Uint8Array): boolean {
  const head = new TextDecoder('utf-8', { fatal: false }).decode(data.subarray(0, 4096)).replace(/^\uFEFF/, '').trimStart().toLowerCase();
  if (!head.startsWith('<')) return false;
  return /<(html|table|!doctype html|body|meta)\b/.test(head) && !/^<\?xml[^>]*>\s*<\?mso-application[^>]*excel\.sheet/.test(head);
}

function decode(data: Uint8Array): string {
  const utf = new TextDecoder('utf-8', { fatal: false }).decode(data);
  const cs = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(utf.slice(0, 4096))?.[1]?.toLowerCase();
  if (cs && !/^utf-?8$/.test(cs)) {
    try { return new TextDecoder(cs).decode(data); } catch { /* codare necunoscută: rămâne UTF-8 */ }
  }
  return utf;
}

const colName = (c: number) => { let s = ''; for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const cellId = (r: number, c: number) => colName(c) + (r + 1);

/** Culoarea CSS ca #rrggbb (nume simple, #rgb, #rrggbb, rgb(…)), altfel nimic. */
function cssColor(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const t = v.trim().toLowerCase();
  const NAMES: Record<string, string> = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', gray: '#808080', grey: '#808080', silver: '#c0c0c0', orange: '#ffa500', navy: '#000080', maroon: '#800000', lightgray: '#d3d3d3', lightgrey: '#d3d3d3' };
  if (NAMES[t]) return NAMES[t];
  let m = /^#([0-9a-f]{3})$/.exec(t);
  if (m) return '#' + [...m[1]].map((x) => x + x).join('');
  m = /^#([0-9a-f]{6})$/.exec(t);
  if (m) return t;
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(t);
  if (m) return '#' + [m[1], m[2], m[3]].map((x) => Math.min(255, +x).toString(16).padStart(2, '0')).join('');
  return undefined;
}

type Decl = Record<string, string>;
const parseDecl = (s: string): Decl => {
  const out: Decl = {};
  for (const part of s.split(';')) {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim().replace(/\s*!important$/i, '');
  }
  return out;
};

/** Regulile simple din <style> pentru etichete (th, td, h1…): doar selectoarele de o singură etichetă, ce folosesc rapoartele. */
function tagRules(doc: Document): Record<string, Decl> {
  const out: Record<string, Decl> = {};
  for (const st of doc.querySelectorAll('style')) {
    const css = (st.textContent ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const decl = parseDecl(m[2]);
      for (const sel of m[1].split(',').map((x) => x.trim().toLowerCase())) {
        if (/^[a-z][a-z0-9]*$/.test(sel)) out[sel] = { ...out[sel], ...decl };
      }
    }
  }
  return out;
}

/** Stilul celulei din etichetă, regulile paginii, stilul ei și elementele dinăuntru (b, strong, h1…). */
function cellStyle(td: Element, rules: Record<string, Decl>): CellStyle {
  const tag = td.tagName.toLowerCase();
  const d: Decl = { ...rules[tag], ...parseDecl(td.getAttribute('style') ?? '') };
  const st: CellStyle = {};
  const heading = td.querySelector('h1, h2, h3, h4, h5, h6');
  if (tag === 'th' || /^(bold|bolder|[6-9]00)$/.test(d['font-weight'] ?? '') || td.querySelector('b, strong') || heading) st.b = true;
  if (d['font-weight'] && /^(normal|[1-4]00)$/.test(d['font-weight']) && tag !== 'th') delete st.b;
  if (/italic/.test(d['font-style'] ?? '') || td.querySelector('i, em')) st.i = true;
  if (/underline/.test(d['text-decoration'] ?? '') || td.querySelector('u')) st.u = true;
  const hSize: Record<string, number> = { h1: 18, h2: 15, h3: 13, h4: 12, h5: 11, h6: 10 };
  const fs = /^([\d.]+)(px|pt)$/.exec(d['font-size'] ?? '');
  if (heading) st.sz = hSize[heading.tagName.toLowerCase()];
  else if (fs) { const pt = fs[2] === 'px' ? Math.round(+fs[1] * 0.75) : Math.round(+fs[1]); if (pt && pt !== 11) st.sz = pt; }
  const color = cssColor(d.color);
  if (color && color !== '#000000') st.color = color;
  const bg = cssColor(d['background-color'] ?? d.background?.split(/\s+/)[0] ?? td.getAttribute('bgcolor') ?? undefined);
  if (bg && bg !== '#ffffff') st.bg = bg;
  const al = (d['text-align'] ?? td.getAttribute('align') ?? '').toLowerCase();
  if (al === 'center' || al === 'right' || al === 'left') st.align = al;
  const va = (d['vertical-align'] ?? td.getAttribute('valign') ?? '').toLowerCase();
  if (va === 'top' || va === 'bottom') st.va = va;
  if ((d.border && !/^(0|none)/.test(d.border)) || td.closest('table')?.getAttribute('border') && td.closest('table')!.getAttribute('border') !== '0') st.bd = 'tblr';
  if (/normal|pre-wrap/.test(d['white-space'] ?? '') && /<br/i.test(td.innerHTML)) st.wrap = true;
  return st;
}

/** Textul celulei: spațiile strânse, <br> = rând nou în celulă. */
function cellText(td: Element): string {
  const parts: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === 3) parts.push((n as Text).data);
    else if (n.nodeType === 1) {
      const el = n as Element;
      if (el.tagName === 'BR') { parts.push('\n'); return; }
      if (/^(SCRIPT|STYLE)$/.test(el.tagName)) return;
      el.childNodes.forEach(walk);
      if (/^(P|DIV|H[1-6]|LI)$/.test(el.tagName)) parts.push('\n');
    }
  };
  td.childNodes.forEach(walk);
  return parts.join('').split('\n').map((l) => l.replace(/[\s\u00a0]+/g, ' ').trim()).filter((l, i, a) => l || (i > 0 && i < a.length - 1)).join('\n').trim();
}

export function readHtmlTable(data: Uint8Array): XlsxImport {
  const html = decode(data);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rules = tagRules(doc);
  // Numele foii din antetul pentru programele de calcul (<x:Name>Raport</x:Name>), dacă există.
  const name = (/<x:Name>([^<]{1,31})<\/x:Name>/i.exec(html)?.[1] ?? '').replace(/[:\\/?*[\]]/g, '').trim() || 'Foaia 1';
  const cells: Record<string, string> = {};
  const styles: Record<string, CellStyle> = {};
  const merges: string[] = [];
  const widths: number[] = [];
  let row = 0;
  // Tabelele de pe primul nivel, în ordinea din pagină (cele din alt tabel se citesc ca text al celulei lor).
  const tables = [...doc.querySelectorAll('table')].filter((t) => !t.parentElement?.closest('table'));
  let cut = false;
  let maxC = 0;
  for (const table of tables) {
    const taken = new Set<string>();
    const trs = [...table.querySelectorAll('tr')].filter((tr) => tr.closest('table') === table);
    for (const tr of trs) {
      if (row >= MAX_ROWS) { cut = true; break; }
      let c = 0;
      for (const td of [...tr.children].filter((x) => /^(TD|TH)$/.test(x.tagName))) {
        while (taken.has(`${row},${c}`)) c++;
        if (c >= MAX_COLS) { cut = true; break; }
        const cs = Math.max(1, Math.min(MAX_COLS - c, parseInt(td.getAttribute('colspan') ?? '1', 10) || 1));
        const rs = Math.max(1, Math.min(1000, parseInt(td.getAttribute('rowspan') ?? '1', 10) || 1));
        const id = cellId(row, c);
        let text = cellText(td);
        // Codurile cu zerouri în față marcate ca text (mso-number-format:"\@") rămân text, ca în programul cunoscut.
        if (/mso-number-format\s*:\s*["']?\\?@/i.test(td.getAttribute('style') ?? '') && /^\d/.test(text)) text = "'" + text;
        if (text) cells[id] = text;
        const st = cellStyle(td, rules);
        if (Object.keys(st).length) styles[id] = st;
        if (cs > 1 || rs > 1) {
          merges.push(`${id}:${cellId(row + rs - 1, c + cs - 1)}`);
          for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) if (i || j) taken.add(`${row + i},${c + j}`);
          // Chenarul și fundalul se întind pe toată celula unită.
          if (st.bd || st.bg) for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) if (i || j) styles[cellId(row + i, c + j)] = { ...(st.bd ? { bd: st.bd } : {}), ...(st.bg ? { bg: st.bg } : {}) };
        } else if (text) {
          // Lățimea coloanei după cel mai lung rând de text (fără titlurile unite peste mai multe coloane).
          const longest = Math.max(...text.split('\n').map((l) => l.length));
          widths[c] = Math.max(widths[c] ?? 0, longest * (st.b ? 8 : 7.2) * ((st.sz ?? 11) / 11) + 18);
        }
        c += cs;
        maxC = Math.max(maxC, c);
      }
      row++;
    }
  }
  const colW: Record<string, number> = {};
  widths.forEach((w, c) => { if (w) colW[colName(c)] = Math.round(Math.min(420, Math.max(64, w))); });
  // Rândurile cu titluri mari (h1…) primesc înălțime pe măsura textului.
  const rowH: Record<string, number> = {};
  for (const [id, st] of Object.entries(styles)) if (st.sz && st.sz > 13) { const r = id.replace(/^[A-Z]+/, ''); rowH[r] = Math.max(rowH[r] ?? 0, Math.round(st.sz * 1.9)); }
  if (!Object.keys(cells).length) throw new Error('Pagina din fișier nu are niciun tabel cu date.');
  const sheet: XlsxSheet = { name, cells, styles, colW, charts: [], lists: [], rules: [], merges, rowH, rows: row, cols: maxC };
  return { sheets: [sheet], active: 0, cut, asValues: 0, chartsSkipped: 0, skipped: 0 };
}
