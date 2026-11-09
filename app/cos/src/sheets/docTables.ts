// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Import .docx (tabele): tabelele dintr-un document (.docx, .odt, .doc, .rtf) aduse în Sheets, ca la copierea tabelelor
// dintr-un procesor de text într-un program de tabele: celulele unite rămân unite, capul de tabel îngroșat, numerele și
// datele devin numere și date, chenarele rămân. Fiecare tabel pe foaia lui sau toate pe o foaie, unul sub altul;
// textul dintre tabele poate veni și el, ca rânduri. Documentul se citește cu cititorii din Docs (readImport.ts), care dau
// HTML; aici HTML-ul se desface cu un cititor mic, scris de la zero, care merge și fără fereastră (în teste).
import type { CellStyle } from './format';
import type { XlsxImport, XlsxSheet } from './xlsx';
import { convertValue, detectDateOrder, detectDecimal, type DateOrder } from './textImport';

interface HNode { tag: string; attrs: Record<string, string>; kids: (HNode | string)[]; parent: HNode | null }

const VOID = new Set(['br', 'img', 'hr', 'col', 'meta', 'input', 'link', 'area', 'base', 'wbr', 'source']);
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function entities(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : all;
    }
    return ENT[e.toLowerCase()] ?? all;
  });
}

/** HTML → arbore simplu (etichete, atribute, text). Îngăduitor cu etichetele neînchise. */
export function parseHtml(html: string): HNode {
  const root: HNode = { tag: '#root', attrs: {}, kids: [], parent: null };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)|</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<!--')) continue;
    if (m[4] !== undefined) { cur.kids.push(entities(m[4])); continue; }
    if (m[2] === undefined) { cur.kids.push('<'); continue; }
    const tag = m[2].toLowerCase();
    if (m[1]) {
      let n: HNode | null = cur;
      while (n && n.tag !== tag) n = n.parent;
      if (n && n.parent) cur = n.parent;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of m[3].matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) attrs[a[1].toLowerCase()] = entities(a[2] ?? a[3] ?? a[4] ?? '');
    const node: HNode = { tag, attrs, kids: [], parent: cur };
    cur.kids.push(node);
    if (!VOID.has(tag) && !/\/\s*$/.test(m[3])) cur = node;
  }
  return root;
}

const BLOCK = /^(p|div|h[1-6]|li|tr|caption|pre|blockquote)$/;

/** Textul unui nod: <br> și sfârșitul de paragraf = rând nou; tabelele din el, cu celulele despărțite prin spațiu. */
function textOf(n: HNode): string {
  const parts: string[] = [];
  const walk = (x: HNode | string) => {
    if (typeof x === 'string') { parts.push(x); return; }
    if (x.tag === 'br') { parts.push('\n'); return; }
    if (/^(style|script|head|title)$/.test(x.tag)) return;
    x.kids.forEach(walk);
    if (BLOCK.test(x.tag)) parts.push('\n');
    else if (x.tag === 'td' || x.tag === 'th') parts.push(' ');
  };
  n.kids.forEach(walk);
  return parts.join('').split('\n').map((l) => l.replace(/[\s]+/g, ' ').trim()).filter((l, i, a) => l || (i > 0 && i < a.length - 1)).join('\n').trim();
}

/** Tot textul celulei e îngroșat (<strong>, <b>, <th> sau titlu)? */
function allBold(n: HNode): boolean {
  let bold = 0, plain = 0;
  const walk = (x: HNode | string, on: boolean) => {
    if (typeof x === 'string') { if (x.trim()) { if (on) bold++; else plain++; } return; }
    const style = (x.attrs.style ?? '').toLowerCase();
    const b = on || /^(strong|b|th|h[1-6])$/.test(x.tag) || /font-weight\s*:\s*(bold|[6-9]00)/.test(style);
    x.kids.forEach((k) => walk(k, b));
  };
  walk(n, n.tag === 'th');
  return bold > 0 && plain === 0;
}

const find = (n: HNode, test: (x: HNode) => boolean, into: (x: HNode) => boolean, out: HNode[] = []): HNode[] => {
  for (const k of n.kids) {
    if (typeof k === 'string') continue;
    if (test(k)) out.push(k);
    else if (into(k)) find(k, test, into, out);
  }
  return out;
};

type Block = { kind: 'table'; node: HNode } | { kind: 'text'; text: string; level: number; bold: boolean };

function blocksOf(root: HNode): Block[] {
  const out: Block[] = [];
  const walk = (n: HNode) => {
    for (const k of n.kids) {
      if (typeof k === 'string') continue;
      if (k.tag === 'table') out.push({ kind: 'table', node: k });
      else if (/^(p|h[1-6]|li|caption|pre|blockquote)$/.test(k.tag) && !find(k, (x) => x.tag === 'table', () => true).length) {
        const text = textOf(k);
        if (text) out.push({ kind: 'text', text, level: /^h[1-6]$/.test(k.tag) ? +k.tag[1] : 0, bold: allBold(k) });
      } else if (!/^(style|script|head|title)$/.test(k.tag)) walk(k);
    }
  };
  walk(root);
  return out;
}

/** Câte tabele are documentul (doar cele de pe primul nivel). */
export function countTables(html: string): number {
  return blocksOf(parseHtml(html)).filter((b) => b.kind === 'table').length;
}

export interface DocTablesOptions {
  /** „sheets” = fiecare tabel pe foaia lui; „stack” = toate pe o foaie, unul sub altul. */
  layout: 'sheets' | 'stack';
  /** Textul dintre tabele vine și el, ca rânduri (în coloana A). */
  paragraphs: boolean;
}

interface Grid { cells: Record<string, string>; styles: Record<string, CellStyle>; merges: string[]; widths: number[]; row: number; maxC: number; rowH: Record<string, number> }

const colName = (c: number) => { let s = ''; for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const cellId = (r: number, c: number) => colName(c) + (r + 1);
const MAX_ROWS = 100000, MAX_COLS = 1000;

/** Rândurile unui tabel (din thead / tbody / tfoot, fără cele ale tabelelor din celule). */
const rowsOf = (table: HNode) => find(table, (x) => x.tag === 'tr', (x) => x.tag !== 'table');
const cellsOf = (tr: HNode) => tr.kids.filter((k): k is HNode => typeof k !== 'string' && (k.tag === 'td' || k.tag === 'th'));

function putTable(g: Grid, table: HNode, o: { decimal: ',' | '.'; dates: DateOrder }): boolean {
  const trs = rowsOf(table);
  if (!trs.length) return false;
  const taken = new Set<string>();
  const top = g.row;
  // Capul de tabel: primul rând îngroșat (sau <th>), ori numai texte deasupra unor numere.
  const firstCells = cellsOf(trs[0]);
  const firstTexts = firstCells.map(textOf);
  let head = firstCells.length > 0 && firstCells.every((td, i) => !firstTexts[i] || allBold(td) || td.tag === 'th') && firstTexts.some(Boolean);
  if (!head && trs.length > 1 && firstTexts.some(Boolean) && firstTexts.every((t) => !t || !convertValue(t, 'general', o)?.fmt && !/^-?\d/.test(t))) {
    head = trs.slice(1).some((tr) => cellsOf(tr).some((td) => { const t = textOf(td); const v = t && convertValue(t, 'general', o); return !!v && (!!v.fmt || /^-?\d+(,\d+)?$/.test(v.raw)); }));
  }
  let cut = false;
  trs.forEach((tr, ri) => {
    if (g.row >= MAX_ROWS) { cut = true; return; }
    let c = 0;
    for (const td of cellsOf(tr)) {
      while (taken.has(`${g.row},${c}`)) c++;
      if (c >= MAX_COLS) { cut = true; break; }
      const cs = Math.max(1, Math.min(MAX_COLS - c, parseInt(td.attrs.colspan ?? '1', 10) || 1));
      const rs = Math.max(1, Math.min(1000, parseInt(td.attrs.rowspan ?? '1', 10) || 1));
      const id = cellId(g.row, c);
      const text = textOf(td);
      const st: CellStyle = { bd: 'tblr' };
      const isHead = ri === 0 && head;
      if (text) {
        if (isHead || text.includes('\n')) {
          g.cells[id] = /^[=@]/.test(text) || /^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(text) ? "'" + text : text;
          if (text.includes('\n')) st.wrap = true;
        } else {
          const v = convertValue(text, 'general', o);
          if (v) { g.cells[id] = v.raw; if (v.fmt) st.fmt = v.fmt; if (v.dec !== undefined) st.dec = v.dec; }
        }
      }
      if (isHead || (text && allBold(td))) st.b = true;
      const al = /text-align\s*:\s*(left|center|right)/i.exec(td.attrs.style ?? '')?.[1]?.toLowerCase() ?? td.attrs.align?.toLowerCase();
      if (al === 'left' || al === 'center' || al === 'right') st.align = al;
      if (isHead && cs > 1 && !st.align) st.align = 'center';
      g.styles[id] = st;
      if (cs > 1 || rs > 1) {
        g.merges.push(`${id}:${cellId(g.row + rs - 1, c + cs - 1)}`);
        for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) if (i || j) { taken.add(`${g.row + i},${c + j}`); g.styles[cellId(g.row + i, c + j)] = { bd: 'tblr' }; }
      } else if (text) {
        const longest = Math.max(...text.split('\n').map((l) => l.length));
        g.widths[c] = Math.max(g.widths[c] ?? 0, longest * (st.b ? 8 : 7.2) + 18);
      }
      c += cs;
      g.maxC = Math.max(g.maxC, c);
    }
    g.row++;
  });
  // Rândurile ocupate doar de celule unite de sus (rowspan peste ultimul rând) se numără și ele.
  for (const k of taken) { const r = +k.split(',')[0]; if (r >= g.row) g.row = r + 1; }
  return cut || g.row === top;
}

function putText(g: Grid, b: Extract<Block, { kind: 'text' }>) {
  if (g.row >= MAX_ROWS) return;
  const id = cellId(g.row, 0);
  g.cells[id] = /^[=@]/.test(b.text) || /^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(b.text) ? "'" + b.text : b.text;
  const st: CellStyle = {};
  if (b.level || b.bold) st.b = true;
  const sz = ({ 1: 16, 2: 14, 3: 12 } as Record<number, number>)[b.level];
  if (sz) { st.sz = sz; g.rowH[String(g.row + 1)] = Math.round(sz * 1.9); }
  if (Object.keys(st).length) g.styles[id] = st;
  g.maxC = Math.max(g.maxC, 1);
  g.row++;
}

const newGrid = (): Grid => ({ cells: {}, styles: {}, merges: [], widths: [], row: 0, maxC: 0, rowH: {} });

function toSheet(g: Grid, name: string): XlsxSheet {
  const colW: Record<string, number> = {};
  g.widths.forEach((w, c) => { if (w) colW[colName(c)] = Math.round(Math.min(420, Math.max(64, w))); });
  return { name, cells: g.cells, styles: g.styles, colW, charts: [], lists: [], rules: [], merges: g.merges, rowH: g.rowH, rows: g.row, cols: g.maxC };
}

/** HTML-ul documentului → registrul cu tabelele lui. Fără niciun tabel: eroare cu mesaj pentru utilizator. */
export function docTablesToBook(html: string, opts: DocTablesOptions): XlsxImport & { tables: number } {
  const blocks = blocksOf(parseHtml(html));
  const tables = blocks.filter((b): b is Extract<Block, { kind: 'table' }> => b.kind === 'table');
  if (!tables.length) throw new Error('Documentul nu are niciun tabel.');
  // Zecimalele și ordinea datelor, după toate celulele din tabele.
  const all = tables.flatMap((t) => rowsOf(t.node).map((tr) => cellsOf(tr).map(textOf)));
  const o = { decimal: detectDecimal(all, ';'), dates: detectDateOrder(all) };
  const sheets: XlsxSheet[] = [];
  let cut = false;
  let g = newGrid();
  let pending: Extract<Block, { kind: 'text' }>[] = [];
  let n = 0;
  let last: Block['kind'] | null = null;
  for (const b of blocks) {
    if (b.kind === 'text') {
      if (!opts.paragraphs) continue;
      if (opts.layout === 'sheets') { pending.push(b); continue; }
      if (last === 'table') g.row++;
      putText(g, b);
      last = 'text';
      continue;
    }
    n++;
    if (opts.layout === 'sheets') {
      if (n > 1) sheets.push(toSheet(g, `Tabel ${n - 1}`));
      g = newGrid();
      for (const p of pending) putText(g, p);
      if (pending.length) g.row++;
      pending = [];
    } else if (last) g.row++;
    if (putTable(g, b.node, o)) cut = cut || g.row >= MAX_ROWS;
    last = 'table';
  }
  if (opts.layout === 'sheets') {
    if (pending.length) { g.row++; for (const p of pending) putText(g, p); }
    sheets.push(toSheet(g, `Tabel ${n}`));
  } else sheets.push(toSheet(g, 'Tabele'));
  return { sheets, active: 0, cut, asValues: 0, chartsSkipped: 0, skipped: 0, tables: tables.length };
}
