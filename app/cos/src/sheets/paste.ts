// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Lipirea din alte programe (Excel, Google Sheets, pagini web): tabelul din clipboard → celule,
// cu formatarea simplă păstrată (aldin, cursiv, subliniat, culori, aliniere) și cu celulele pe mai multe rânduri.
import type { CellStyle } from './format';

export interface PastedCell {
  text: string;
  style: CellStyle;
}

/**
 * Textul copiat ca tabel (coloane separate prin Tab). Excel pune între ghilimele celulele care au rânduri noi
 * sau ghilimele („"Strada Mare` + rând nou + `nr. 5"”), așa că le citim ca o singură celulă.
 */
export function parseTsv(text: string): string[][] {
  const src = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  while (i <= src.length) {
    let cell = '';
    if (src[i] === '"') {
      // Câmp între ghilimele: se termină la ghilimeaua urmată de Tab, rând nou sau sfârșit.
      let j = i + 1;
      let out = '';
      let closed = false;
      while (j < src.length) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') { out += '"'; j += 2; continue; }
          if (j + 1 === src.length || src[j + 1] === '\t' || src[j + 1] === '\n') { closed = true; j++; break; }
        }
        out += src[j++];
      }
      if (closed) { cell = out; i = j; } else {
        // Ghilimele fără pereche: textul rămâne exact cum era.
        const end = nextStop(src, i);
        cell = src.slice(i, end);
        i = end;
      }
    } else {
      const end = nextStop(src, i);
      cell = src.slice(i, end);
      i = end;
    }
    row.push(cell);
    if (i >= src.length) { rows.push(row); break; }
    if (src[i] === '\n') { rows.push(row); row = []; }
    i++;
  }
  return rows.length ? rows : [['']];
}

function nextStop(s: string, from: number): number {
  for (let k = from; k < s.length; k++) if (s[k] === '\t' || s[k] === '\n') return k;
  return s.length;
}

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00',
  orange: '#ffa500', gray: '#808080', grey: '#808080', silver: '#c0c0c0', maroon: '#800000', navy: '#000080',
  purple: '#800080', teal: '#008080', lime: '#00ff00', aqua: '#00ffff', fuchsia: '#ff00ff', olive: '#808000',
};

/** O culoare CSS („#f00”, „#ff0000”, „rgb(255, 0, 0)”, „red”) → „#ff0000”; null dacă nu o recunoaștem. */
export function cssColor(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase().replace(/\s*!important$/, '');
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map((c) => c + c).join('');
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s);
  if (m) {
    if (m[4] !== undefined && Number(m[4]) === 0) return null;
    return '#' + [m[1], m[2], m[3]].map((x) => Math.min(255, Number(x)).toString(16).padStart(2, '0')).join('');
  }
  return NAMED[s] ?? null;
}

/** Declarațiile CSS „a:b; c:d” → { a: 'b', c: 'd' } (numele cu litere mici). */
export function cssDecls(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.split(';')) {
    const k = part.indexOf(':');
    if (k < 0) continue;
    const name = part.slice(0, k).trim().toLowerCase();
    if (name) out[name] = part.slice(k + 1).trim();
  }
  return out;
}

/** Stilul nostru din declarațiile CSS ale unei celule (doar ce știm afișa; negrul și albul obișnuite se ignoră). */
export function styleFromCss(d: Record<string, string>, align?: string | null): CellStyle {
  const st: CellStyle = {};
  const w = d['font-weight'];
  if (w && (w === 'bold' || w === 'bolder' || Number(w) >= 600)) st.b = true;
  if (/italic|oblique/.test(d['font-style'] ?? '')) st.i = true;
  if (/underline/.test(d['text-decoration'] ?? '') || /underline/.test(d['text-decoration-line'] ?? '') || /single|double/.test(d['text-underline-style'] ?? '')) st.u = true;
  if (/line-through/.test(d['text-decoration'] ?? '') || /line-through/.test(d['text-decoration-line'] ?? '')) st.s = true;
  const color = cssColor(d.color);
  if (color && color !== '#000000') st.color = color;
  // Excel scrie „background:yellow”, Google Sheets „background-color:#ffff00”.
  const bgText = d['background-color'] ?? d.background?.split(/\s+/).find((x) => cssColor(x)) ?? undefined;
  const bg = cssColor(bgText);
  if (bg && bg !== '#ffffff') st.bg = bg;
  const a = (d['text-align'] ?? align ?? '').toLowerCase();
  if (a === 'left' || a === 'center' || a === 'right') st.align = a;
  return st;
}

/** Regulile „.xl65 { … }” din <style> (Excel le folosește în loc de stiluri pe celulă). */
function classRules(doc: Document): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const el of Array.from(doc.querySelectorAll('style'))) {
    const css = (el.textContent ?? '').replace(/<!--|-->/g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const decls = cssDecls(m[2]);
      for (const sel of m[1].split(',')) {
        const c = /^\s*(?:td|th)?\.([\w-]+)\s*$/i.exec(sel);
        if (c) out[c[1]] = { ...out[c[1]], ...decls };
      }
    }
  }
  return out;
}

/** Textul unei celule HTML: <br> și paragrafele devin rânduri noi, spațiile duble dispar. */
function cellText(td: Element): string {
  const parts: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeType === 3) { parts.push((n.textContent ?? '').replace(/[ \t\r\n ]+/g, ' ')); return; }
    if (n.nodeType !== 1) return;
    const tag = (n as Element).tagName.toLowerCase();
    if (tag === 'br') { parts.push('\n'); return; }
    if (tag === 'style' || tag === 'script') return;
    const block = tag === 'p' || tag === 'div' || tag === 'li';
    if (block && parts.length && !parts[parts.length - 1].endsWith('\n')) parts.push('\n');
    n.childNodes.forEach(walk);
    if (block) parts.push('\n');
  };
  td.childNodes.forEach(walk);
  return parts.join('').split('\n').map((l) => l.trim()).join('\n').replace(/^\n+|\n+$/g, '');
}

/** Primul tabel din HTML-ul copiat → rânduri de celule cu text și stil; null dacă nu e niciun tabel. */
export function parseHtmlTable(html: string): PastedCell[][] | null {
  if (!/<table[\s>]/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;
  const classes = classRules(doc);
  const rows: PastedCell[][] = [];
  // Celulele întinse pe mai multe rânduri (rowspan) lasă locuri goale în rândurile de dedesubt.
  const taken: Record<number, number> = {};
  for (const tr of Array.from(table.querySelectorAll('tr'))) {
    if (tr.closest('table') !== table) continue;
    const r = rows.length;
    const row: PastedCell[] = [];
    const rowCss = cssDecls(tr.getAttribute('style') ?? '');
    for (const td of Array.from(tr.children)) {
      const tag = td.tagName.toLowerCase();
      if (tag !== 'td' && tag !== 'th') continue;
      while ((taken[row.length] ?? -1) >= r) row.push({ text: '', style: {} });
      let d: Record<string, string> = { ...rowCss };
      for (const c of (td.getAttribute('class') ?? '').split(/\s+/)) if (classes[c]) d = { ...d, ...classes[c] };
      d = { ...d, ...cssDecls(td.getAttribute('style') ?? '') };
      // Formatarea pusă cu etichete în celulă: <b>, <i>, <u>, <font color>.
      if (tag === 'th' || td.querySelector('b, strong')) d['font-weight'] ??= 'bold';
      if (td.querySelector('i, em')) d['font-style'] ??= 'italic';
      if (td.querySelector('u')) d['text-decoration'] ??= 'underline';
      if (td.querySelector('s, strike, del')) d['text-decoration'] = (d['text-decoration'] ? d['text-decoration'] + ' ' : '') + 'line-through';
      const font = td.querySelector('font[color]');
      if (font && !d.color) d.color = font.getAttribute('color') ?? '';
      const inner = td.querySelector('span[style]');
      if (inner && td.children.length === 1) d = { ...d, ...cssDecls(inner.getAttribute('style') ?? '') };
      const bgAttr = td.getAttribute('bgcolor');
      if (bgAttr && !d['background-color'] && !d.background) d['background-color'] = bgAttr;
      const span = Math.max(1, Math.min(50, Number(td.getAttribute('colspan')) || 1));
      const down = Math.max(1, Math.min(500, Number(td.getAttribute('rowspan')) || 1));
      const style = styleFromCss(d, td.getAttribute('align'));
      for (let k = 0; k < span; k++) {
        if (down > 1) taken[row.length] = r + down - 1;
        row.push(k === 0 ? { text: cellText(td), style } : { text: '', style: {} });
      }
    }
    rows.push(row);
  }
  return rows.length ? rows : null;
}

// ---------- Copiere spre alte programe ----------

export interface CopiedCell {
  text: string;
  style?: CellStyle;
  /** Numerele se aliniază la dreapta, ca în tabel. */
  num?: boolean;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Stilul unei celule ca CSS pe celulă (Excel, Word, Google Docs și Docs-ul nostru îl înțeleg). */
export function styleToCss(st: CellStyle | undefined, num = false): string {
  const parts = ['border:1px solid #d0d0d0', 'padding:2px 6px', 'vertical-align:top'];
  if (st?.b) parts.push('font-weight:bold');
  if (st?.i) parts.push('font-style:italic');
  if (st?.u || st?.s) parts.push('text-decoration:' + [st.u && 'underline', st.s && 'line-through'].filter(Boolean).join(' '));
  if (st?.color) parts.push(`color:${st.color}`);
  if (st?.bg) parts.push(`background-color:${st.bg}`);
  const align = st?.align === 'across' ? 'center' : st?.align ?? (num ? 'right' : undefined);
  if (align) parts.push(`text-align:${align}`);
  if (st?.bd) {
    for (const [k, side] of [['t', 'top'], ['b', 'bottom'], ['l', 'left'], ['r', 'right']]) {
      if (st.bd.includes(k)) parts.push(`border-${side}:1px solid #000000`);
    }
  }
  if (!st?.wrap) parts.push('white-space:nowrap');
  return parts.join(';');
}

/** Zona copiată ca tabel HTML, cu valorile afișate (așa cum se văd) și formatarea; lățimile coloanelor în pixeli. */
export function tableHtml(rows: CopiedCell[][], widths: number[]): string {
  const cols = widths.map((w) => `<col width="${Math.round(w)}" style="width:${Math.round(w)}px">`).join('');
  // Textul primește și etichete (<b>, <i>, <u>, culoare), pentru editoarele care nu citesc stilul celulei (de exemplu Docs).
  const inner = (c: CopiedCell) => {
    let h = esc(c.text).replace(/\n/g, '<br>');
    if (!h) return h;
    if (c.style?.color) h = `<span style="color:${c.style.color}">${h}</span>`;
    if (c.style?.s) h = `<s>${h}</s>`;
    if (c.style?.u) h = `<u>${h}</u>`;
    if (c.style?.i) h = `<i>${h}</i>`;
    if (c.style?.b) h = `<b>${h}</b>`;
    return h;
  };
  const body = rows.map((row) => '<tr>' + row.map((c) =>
    `<td style="${styleToCss(c.style, c.num)}">${inner(c)}</td>`).join('') + '</tr>').join('');
  return '<meta charset="utf-8"><table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt">'
    + `<colgroup>${cols}</colgroup><tbody>${body}</tbody></table>`;
}
