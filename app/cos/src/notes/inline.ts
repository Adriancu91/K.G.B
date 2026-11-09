// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Formatarea din notițe cu semne simple, scrise în text (ca Markdown, deci exportul .md le păstrează):
// **aldin**, *cursiv*, ~~tăiat~~, ==evidențiat==, ++subliniat++, „# Titlu” / „## Subtitlu” / „### Titlu mic” la începutul rândului
// {roșu:text} / {fundal verde:text} pentru culoarea textului și a evidențierii, {mare:text} / {mic:text} pentru mărime,
// {font Georgia:text} pentru font (se pot pune unele în altele), {la centru:rândul întreg} pentru aliniere, {ecuație:x^2 + 1} pentru ecuații, și tabele „| a | b |”. Butoanele din bară pun și scot semnele; Lectura, exportul în Docs și pagina .html le arată formatate.
import type { Edit } from './checklist';

const NL = String.fromCharCode(10);

export type Span = { s: string; b?: boolean; i?: boolean; x?: boolean; h?: boolean; u?: boolean; c?: string; hc?: string; sz?: number; f?: string; al?: string; eq?: string; m?: boolean };

/** Ecuația scrisă pe un rând (ca în Docs: a/b, x^2, sqrt(x), sum_(i=1)^n…), desenată în Lectură, în .html și în Docs. */
export const EQ_OPEN = '{ecuație:';
export const equationMark = (src: string) => EQ_OPEN + src.split(NL).join(' ').trim() + '}';
/** Semnul de ecuație în care e poziția `at` din text: unde începe, unde se termină (după „}”) și textul ecuației. */
export function equationAt(t: string, at: number): { from: number; to: number; src: string } | null {
  const ls = t.lastIndexOf(NL, Math.max(0, at - 1)) + 1;
  for (let k = t.indexOf('{ecua', ls); k >= 0 && k <= at; k = t.indexOf('{ecua', k + 1)) {
    const len = eqOpenLen(t, k);
    if (!len) continue;
    const j = braceEnd(t, k + len);
    if (j >= 0 && at <= j + 1) return { from: k, to: j + 1, src: t.slice(k + len, j) };
  }
  return null;
}
const eqOpenLen = (t: string, i: number) => (t.startsWith(EQ_OPEN, i) || t.startsWith('{ecuatie:', i) ? EQ_OPEN.length : 0);

/** Culorile pentru text și evidențiere: numele scris în notiță → culoarea afișată (text, fundal). */
export const INK_COLORS: [name: string, text: string, back: string][] = [
  ['roșu', '#d32f2f', '#ffcdd2'],
  ['portocaliu', '#e65100', '#ffe0b2'],
  ['galben', '#b08900', '#fff176'],
  ['verde', '#2e7d32', '#c8e6c9'],
  ['albastru', '#1565c0', '#bbdefb'],
  ['mov', '#7b1fa2', '#e1bee7'],
  ['roz', '#c2185b', '#f8bbd0'],
  ['gri', '#616161', '#e0e0e0'],
];
/** Mărimile textului: numele scris în notiță → mărimea față de textul obișnuit. */
export const INK_SIZES: [name: string, em: number][] = [
  ['foarte mic', 0.75],
  ['mic', 0.85],
  ['mare', 1.3],
  ['foarte mare', 1.7],
  ['uriaș', 2.2],
];
/** Fonturile din Windows care se pot pune pe text: numele scris în notiță → familia de fonturi (cu rezervă). */
export const INK_FONTS: [name: string, css: string][] = [
  ['Arial', 'Arial, sans-serif'],
  ['Calibri', 'Calibri, Carlito, sans-serif'],
  ['Cambria', 'Cambria, Caladea, serif'],
  ['Comic Sans MS', '"Comic Sans MS", cursive'],
  ['Consolas', 'Consolas, "Courier New", monospace'],
  ['Courier New', '"Courier New", monospace'],
  ['Georgia', 'Georgia, serif'],
  ['Ink Free', '"Ink Free", "Segoe Print", cursive'],
  ['Segoe Print', '"Segoe Print", cursive'],
  ['Segoe UI', '"Segoe UI", sans-serif'],
  ['Tahoma', 'Tahoma, sans-serif'],
  ['Times New Roman', '"Times New Roman", serif'],
  ['Trebuchet MS', '"Trebuchet MS", sans-serif'],
  ['Verdana', 'Verdana, sans-serif'],
];
/** Familia de fonturi pentru numele dat (sau undefined dacă nu e în listă). */
export const fontCss = (name?: string) => INK_FONTS.find(([f]) => f === name)?.[1];
/** Felul semnului de stil: culoarea textului, a fundalului, mărimea sau fontul. */
export type StyleKind = 'c' | 'hc' | 'sz' | 'f' | 'al';
const PREFIX: Record<StyleKind, string> = { c: '', hc: 'fundal ', sz: '', f: 'font ', al: '' };
type Open = { kind: StyleKind; val: string | number; len: number };
/** „{roșu:”, „{fundal verde:”, „{mare:” sau „{font Georgia:” la poziția i: felul, valoarea și lungimea semnului de deschidere. */
function styleOpen(t: string, i: number): Open | null {
  if (t[i] !== '{') return null;
  const hit = (kind: StyleKind, name: string, val: string | number): Open | null => {
    const at = i + 1 + PREFIX[kind].length;
    return t.startsWith(PREFIX[kind], i + 1) && t.startsWith(name + ':', at) ? { kind, val, len: at - i + name.length + 1 } : null;
  };
  for (const [name, , back] of INK_COLORS) { const o = hit('hc', name, back); if (o) return o; }
  for (const [name, css] of INK_FONTS) { const o = hit('f', name, css); if (o) return o; }
  for (const [name, em] of INK_SIZES) { const o = hit('sz', name, em); if (o) return o; }
  for (const [name, css] of ALIGNS) { const o = hit('al', name, css); if (o) return o; }
  for (const [name, fg] of INK_COLORS) { const o = hit('c', name, fg); if (o) return o; }
  return null;
}
/** Acolada care închide semnul deschis înainte de `from` (sare peste perechile din interior), pe același rând; -1 dacă lipsește. */
const BS = String.fromCharCode(92);
function braceEnd(t: string, from: number): number {
  let depth = 0;
  for (let k = from; k < t.length; k++) {
    const ch = t[k];
    if (ch === NL) return -1;
    // Acoladele cu bară inversă în față (ecuațiile scrise așa: \{1, 2\}) sunt semne, nu grupează.
    if (t[k - 1] === BS) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { if (!depth) return k; depth--; }
  }
  return -1;
}
export type Wrap = '**' | '*' | '~~' | '==' | '++';
const KEY: Record<Wrap, 'b' | 'i' | 'x' | 'h' | 'u'> = { '**': 'b', '*': 'i', '~~': 'x', '==': 'h', '++': 'u' };
const ORDER: Wrap[] = ['**', '~~', '==', '++', '*'];

/** Poziția semnului de închidere pentru „m” (pentru „*” sare peste „**”), sau -1. */
function closing(t: string, m: Wrap, from: number): number {
  if (m !== '*') return t.indexOf(m, from);
  for (let k = from; k < t.length; k++) {
    if (t[k] !== '*') continue;
    if (t[k + 1] === '*') { k++; continue; }
    return k;
  }
  return -1;
}

/**
 * Textul unui rând împărțit în bucăți cu formatarea lor. Semnele fără pereche rămân text („2 * 3”).
 * Cu `keep`, semnele rămân și ele, ca bucăți cu `m` (pentru formatarea arătată în câmpul de scris, unde textul nu se schimbă).
 */
export function parseInline(t: string, base: Omit<Span, 's'> = {}, keep = false): Span[] {
  const out: Span[] = [];
  let buf = '';
  const flush = () => { if (buf) out.push({ s: buf, ...base }); buf = ''; };
  const mark = (s: string, b: Omit<Span, 's'> = base) => { if (keep && s) out.push({ s, ...b, m: true }); };
  let i = 0;
  outer: while (i < t.length) {
    const el = eqOpenLen(t, i);
    if (el) {
      const j = braceEnd(t, i + el);
      const src = j < 0 ? '' : t.slice(i + el, j).trim();
      if (src) { flush(); out.push({ s: keep ? t.slice(i, j + 1) : src, ...base, eq: src }); i = j + 1; continue; }
    }
    const co = styleOpen(t, i);
    if (co) {
      const j = braceEnd(t, i + co.len);
      const inner = j < 0 ? '' : t.slice(i + co.len, j);
      if (inner) {
        flush();
        const nb = { ...base, [co.kind]: co.val };
        mark(t.slice(i, i + co.len), nb);
        out.push(...parseInline(inner, nb, keep));
        mark('}', nb);
        i = j + 1;
        continue;
      }
    }
    // ***aldin cursiv*** (ca în Markdown): altfel „**” s-ar închide pe primele două stele de la capăt.
    if (t.startsWith('***', i) && !base.b && !base.i && t[i + 3] && t[i + 3] !== ' ' && t[i + 3] !== '*') {
      const j = t.indexOf('***', i + 3);
      const inner = j < 0 ? '' : t.slice(i + 3, j);
      if (inner && !inner.includes(NL) && !inner.endsWith(' ')) {
        flush();
        mark('***');
        out.push(...parseInline(inner, { ...base, b: true, i: true }, keep));
        mark('***');
        i = j + 3;
        continue;
      }
    }
    for (const m of ORDER) {
      if (!t.startsWith(m, i) || base[KEY[m]]) continue;
      const a = i + m.length;
      const first = t[a];
      if (first === undefined || first === ' ' || first === '*' && m === '*') continue;
      const j = closing(t, m, a);
      if (j <= a || t[j - 1] === ' ') continue;
      const inner = t.slice(a, j);
      if (inner.includes(NL)) continue;
      flush();
      mark(m);
      out.push(...parseInline(inner, { ...base, [KEY[m]]: true }, keep));
      mark(m);
      i = j + m.length;
      continue outer;
    }
    buf += t[i++];
  }
  flush();
  return out;
}

/** Textul fără semnele de formatare (pentru titluri în liste, căutare, citire cu voce). */
export const plainInline = (t: string) => parseInline(t).map((p) => p.s).join('');

/** Pune semnul în jurul selecției; dacă selecția e deja între semne (în ea sau imediat în afara ei), le scoate. */
export function wrapEdit(v: string, s: number, e: number, m: Wrap): Edit {
  const L = m.length;
  const sel = v.slice(s, e);
  if (sel.length >= 2 * L && sel.startsWith(m) && sel.endsWith(m)) {
    const text = sel.slice(L, sel.length - L);
    return { from: s, to: e, text, caret: s + text.length };
  }
  if (s >= L && v.slice(s - L, s) === m && v.slice(e, e + L) === m && (m !== '*' || (v[s - 2] !== '*' && v[e + 1] !== '*'))) {
    return { from: s - L, to: e + L, text: sel, caret: s - L + sel.length };
  }
  if (s === e) return { from: s, to: e, text: m + m, caret: s + L };
  // Spațiile de la margini rămân în afara semnelor („ cuvânt ” → „ **cuvânt** ”).
  const lead = sel.length - sel.trimStart().length;
  const trail = sel.length - sel.trimEnd().length;
  const core = sel.trim();
  const text = sel.slice(0, lead) + m + core + m + sel.slice(sel.length - trail);
  return { from: s, to: e, text, caret: s + text.length };
}

/** Selecția primește culoarea dată (text sau fundal); culoarea veche de același fel din jurul ei se înlocuiește.
 *  Numele gol scoate culoarea. */
export function colorEdit(v: string, s: number, e: number, name: string, back = false): Edit {
  return styleEdit(v, s, e, name, back ? 'hc' : 'c');
}

/** Selecția primește stilul dat (culoare, fundal, mărime sau font, după nume); stilul vechi de același fel din jurul ei se înlocuiește.
 *  Numele gol scoate stilul de acest fel. */
export function styleEdit(v: string, s: number, e: number, name: string, kind: StyleKind): Edit {
  const pre = PREFIX[kind];
  const lineStart = v.lastIndexOf(NL, s - 1);
  // Selecția e chiar în interiorul unui semn de același fel (poate fi în altele): îl schimbăm pe acela.
  for (let a = v.lastIndexOf('{', s); a > lineStart; a = a > 0 ? v.lastIndexOf('{', a - 1) : -1) {
    const co = styleOpen(v, a);
    if (!co || a + co.len > s) continue;
    const j = braceEnd(v, a + co.len);
    if (j < e) continue;
    if (co.kind !== kind) continue;
    const inner = v.slice(a + co.len, j);
    const text = name ? '{' + pre + name + ':' + inner + '}' : inner;
    return { from: a, to: j + 1, text, caret: a + text.length };
  }
  const sel = v.slice(s, e);
  if (!name) {
    // Scoate stilurile de acest fel din selecție (și pe cele puse unele în altele).
    const strip = (t: string): string => {
      let out = '';
      for (let k = 0; k < t.length;) {
        const co = styleOpen(t, k);
        const j = co ? braceEnd(t, k + co.len) : -1;
        if (co && j > 0) {
          const inner = strip(t.slice(k + co.len, j));
          out += co.kind === kind ? inner : t.slice(k, k + co.len) + inner + '}';
          k = j + 1;
        } else out += t[k++];
      }
      return out;
    };
    const out = strip(sel);
    return { from: s, to: e, text: out, caret: s + out.length };
  }
  if (s === e) { const text = '{' + pre + name + ':}'; return { from: s, to: e, text, caret: s + text.length - 1 }; }
  const lead = sel.length - sel.trimStart().length;
  const trail = sel.length - sel.trimEnd().length;
  // Pe mai multe rânduri, fiecare rând își primește stilul (semnele nu trec peste rând).
  const core = sel.trim().split(NL).map((l) => (l.trim() ? '{' + pre + name + ':' + l + '}' : l)).join(NL);
  const text = sel.slice(0, lead) + core + sel.slice(sel.length - trail);
  return { from: s, to: e, text, caret: s + text.length };
}

/** Nivelul de titlu al rândului („# ” = 1, „## ” = 2 … „###### ” = 6), 0 dacă nu e titlu. */
export function headingLevel(line: string): number {
  let k = 0;
  while (line[k] === '#' && k < 7) k++;
  return k >= 1 && k <= 6 && line[k] === ' ' ? k : 0;
}

/** Rândurile selectate devin titlu de nivelul dat (0 = text obișnuit); același nivel pus din nou îl scoate. */
export function headingEdit(v: string, s: number, e: number, level: number): Edit {
  const a = v.lastIndexOf(NL, s - 1) + 1;
  const endAt = e > s && v[e - 1] === NL ? e - 1 : e;
  const bi = v.indexOf(NL, endAt);
  const b = bi < 0 ? v.length : bi;
  const lines = v.slice(a, b).split(NL);
  const all = level > 0 && lines.filter((l) => l.trim()).every((l) => headingLevel(l) === level);
  const text = lines.map((l) => {
    if (!l.trim() && lines.length > 1) return l;
    const lv = headingLevel(l);
    const bare = lv ? l.slice(lv + 1) : l;
    return all || level === 0 ? bare : '#'.repeat(level) + ' ' + bare;
  }).join(NL);
  return { from: a, to: b, text, caret: a + text.length };
}

/**
 * Stilurile de paragraf (ca lista de stiluri a unui caiet): Citat (cursiv, gri), Sursă (citare: mic, gri) și Cod (font Consolas),
 * făcute din semnele obișnuite, ca să se vadă la fel în Lectură, în Docs și în .html. Pus din nou pe aceleași rânduri, stilul se scoate.
 */
export const PARA_STYLES: [id: string, label: string, open: string, close: string][] = [
  ['quote', 'Citat', '{gri:*', '*}'],
  ['cite', 'Sursă (citare)', '{mic:{gri:', '}}'],
  ['code', 'Cod', '{font Consolas:', '}'],
];
export function paraStyleEdit(v: string, s: number, e: number, id: string): Edit {
  const st = PARA_STYLES.find(([k]) => k === id);
  const a = v.lastIndexOf(NL, s - 1) + 1;
  const endAt = e > s && v[e - 1] === NL ? e - 1 : e;
  const bi = v.indexOf(NL, endAt);
  const b = bi < 0 ? v.length : bi;
  if (!st) return { from: a, to: b, text: v.slice(a, b), caret: b };
  const [, , open, close] = st;
  const lines = v.slice(a, b).split(NL);
  const has = (l: string) => { const t = l.slice(headingLevel(l) ? headingLevel(l) + 1 : 0); return t.startsWith(open) && t.endsWith(close) && t.length > open.length + close.length; };
  const all = lines.filter((l) => l.trim()).every(has);
  const text = lines.map((l) => {
    if (!l.trim()) return l;
    // Titlul se scoate (un rând e titlu sau citat, nu amândouă); celelalte stiluri de paragraf la fel.
    let t = l.slice(headingLevel(l) ? headingLevel(l) + 1 : 0);
    for (const [, , o, c] of PARA_STYLES) if (t.startsWith(o) && t.endsWith(c) && t.length > o.length + c.length) { t = t.slice(o.length, t.length - c.length); break; }
    return all ? t : open + t + close;
  }).join(NL);
  return { from: a, to: b, text, caret: a + text.length };
}

/** Alinierea rândurilor: numele scris în notiță („{la centru:rândul întreg}”) → alinierea din CSS și din Docs. */
export const ALIGNS: [name: string, css: 'center' | 'right' | 'justify'][] = [
  ['la centru', 'center'],
  ['la dreapta', 'right'],
  ['stânga-dreapta', 'justify'],
];
/** Rândul întreg e între semnele unei alinieri („{la centru:…}”): alinierea și textul din interior; altfel null. */
export function lineAlign(line: string): { align: 'center' | 'right' | 'justify'; text: string } | null {
  const k = line.length - line.trimStart().length;
  const co = styleOpen(line, k);
  if (!co || co.kind !== 'al') return null;
  const j = braceEnd(line, k + co.len);
  if (j < 0 || j !== line.trimEnd().length - 1) return null;
  return { align: co.val as 'center' | 'right' | 'justify', text: line.slice(k + co.len, j) };
}
/** Rândurile selectate (sau rândul cu cursorul) primesc alinierea dată; numele gol le duce înapoi la stânga. Titlurile își păstrează „# ”. */
export function alignEdit(v: string, s: number, e: number, name: string): Edit {
  const a = v.lastIndexOf(NL, s - 1) + 1;
  const endAt = e > s && v[e - 1] === NL ? e - 1 : e;
  const bi = v.indexOf(NL, endAt);
  const b = bi < 0 ? v.length : bi;
  const text = v.slice(a, b).split(NL).map((l) => {
    const lv = headingLevel(l);
    const pre = lv ? l.slice(0, lv + 1) : '';
    const rest = l.slice(pre.length);
    const la = lineAlign(rest);
    const bare = la ? la.text : rest;
    if (!bare.trim()) return l;
    return name ? pre + '{' + name + ':' + bare + '}' : pre + bare;
  }).join(NL);
  return { from: a, to: b, text, caret: a + text.length };
}

/** Golire formatare (Ctrl+Shift+N, „Normal”): rândurile selectate (sau rândul cu cursorul) pierd titlul, alinierea,
 *  aldinul, culorile, mărimea și fontul. Ecuațiile rămân ecuații. */
export function clearEdit(v: string, s: number, e: number): Edit {
  const a = v.lastIndexOf(NL, s - 1) + 1;
  const endAt = e > s && v[e - 1] === NL ? e - 1 : e;
  const bi = v.indexOf(NL, endAt);
  const b = bi < 0 ? v.length : bi;
  const text = v.slice(a, b).split(NL).map((l) => {
    const lv = headingLevel(l);
    const rest = lv ? l.slice(lv + 1) : l;
    const la = lineAlign(rest);
    return parseInline(la ? la.text : rest).map((p) => (p.eq ? equationMark(p.eq) : p.s)).join('');
  }).join(NL);
  return { from: a, to: b, text, caret: a + text.length };
}

/** Un tabel gol, gata de completat: primul rând e capul tabelului. */
export function tableText(cols: number, rows: number): string {
  const row = (cells: string[]) => '| ' + cells.join(' | ') + ' |';
  const head = row(Array.from({ length: cols }, (_, i) => `Coloana ${i + 1}`));
  const sep = row(Array.from({ length: cols }, () => '---'));
  const body = Array.from({ length: rows }, () => row(Array.from({ length: cols }, () => '   ')));
  return [head, sep, ...body].join(NL);
}

const isTableLine = (l: string) => { const t = l.trim(); return t.length > 1 && t.startsWith('|'); };
const isSepRow = (cells: string[]) => cells.length > 0 && cells.every((c) => c.length > 0 && [...c].every((ch) => ch === '-' || ch === ':'));
const cellsOf = (l: string) => {
  let t = l.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
};

export type Block =
  | { kind: 'h'; level: number; text: string; align?: string }
  | { kind: 'table'; head: string[] | null; rows: string[][] }
  | { kind: 'p'; text: string; align?: string };

/** Notița pe blocuri: titluri, tabele și paragrafe (rândurile goale despart paragrafele). */
export function parseBlocks(body: string): Block[] {
  const out: Block[] = [];
  const lines = body.split(NL);
  let para: string[] = [];
  const flush = () => { const t = para.join(NL); if (t.trim()) out.push({ kind: 'p', text: t }); para = []; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const lv = headingLevel(l);
    if (lv) { flush(); const t = l.slice(lv + 1), la = lineAlign(t); out.push({ kind: 'h', level: lv, text: la ? la.text : t, ...(la ? { align: la.align } : {}) }); continue; }
    if (isTableLine(l)) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && isTableLine(lines[i])) rows.push(cellsOf(lines[i++]));
      i--;
      const hasHead = rows.length > 1 && isSepRow(rows[1]);
      const data = rows.filter((r) => !isSepRow(r));
      out.push({ kind: 'table', head: hasHead ? data[0] : null, rows: hasHead ? data.slice(1) : data });
      continue;
    }
    if (!l.trim()) { flush(); continue; }
    // Un rând aliniat e paragraf separat (alinierea ține de tot paragraful).
    const la = lineAlign(l);
    if (la) { flush(); out.push({ kind: 'p', text: la.text, align: la.align }); continue; }
    para.push(l);
  }
  flush();
  return out;
}
