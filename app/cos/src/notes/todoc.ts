// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Notița → document Docs: titlul devine „Titlu 1”, fiecare rând un paragraf, pozele imagini, iar PDF-urile atașate
// un rând cu numele lor. Documentul e nou și nesalvat; îl salvezi din Docs unde vrei.
import type { Note } from './store';
import { boxImages, withBoxes } from './freeCanvas';
import { shownTitle, webSpans } from './store';
import { fontCss, headingLevel, lineAlign, parseBlocks, parseInline } from './inline';
import { equationAlt } from '../docs/equation';

/** Desenele ecuațiilor (PNG), după textul lor: le face Notes.tsx înainte (în browser), ca aici totul să rămână sincron. */
export type EqPngs = Map<string, { src: string; w: number }>;
/** Textele tuturor ecuațiilor din notiță ({ecuație:…}). */
export const noteEquations = (n: Note): string[] => [...new Set(n.body.split(String.fromCharCode(10)).flatMap((l) => parseInline(l).filter((p) => p.eq).map((p) => p.eq!)))];

type Node = { type: string; attrs?: Record<string, unknown>; content?: Node[]; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[] };

// Adresele web din text devin hyperlink-uri; **aldin**, *cursiv*, ++subliniat++, ~~tăiat~~ și ==evidențiat== devin formatare adevărată.
// Fontul întregii notițe (dacă e ales) se pune pe textul fără font propriu.
let noteFont: string | undefined;
const runs = (text: string): Node[] => parseInline(text, noteFont ? { f: noteFont } : {}).flatMap((sp): Node[] => {
  if (sp.eq) return [{ type: 'noteEq', attrs: { src: sp.eq } }];
  const marks: NonNullable<Node['marks']> = [];
  if (sp.b) marks.push({ type: 'bold' });
  if (sp.i) marks.push({ type: 'italic' });
  if (sp.u) marks.push({ type: 'underline' });
  if (sp.x) marks.push({ type: 'strike' });
  if (sp.h || sp.hc) marks.push({ type: 'highlight', attrs: { color: sp.hc ?? '#fff176' } });
  // Mărimea față de textul obișnuit (11 pt) devine puncte; fontul păstrează doar primul nume (cel din Windows).
  if (sp.c || sp.sz || sp.f) marks.push({ type: 'textStyle', attrs: {
    ...(sp.c ? { color: sp.c } : {}),
    ...(sp.sz ? { fontSize: Math.round(11 * sp.sz) + 'pt' } : {}),
    ...(sp.f ? { fontFamily: sp.f.split(',')[0].replace(/"/g, '').trim() } : {}),
  } });
  return webSpans(sp.s).map((p) => {
    const m = p.url ? [...marks, { type: 'link', attrs: { href: p.url } }] : marks;
    return m.length ? { type: 'text', text: p.s, marks: m } : { type: 'text', text: p.s };
  });
});
// Un rând întreg între „{la centru:…}” devine paragraf aliniat.
const para = (text: string): Node => {
  // Paragraful retras cu Tab (câte 4 spații) devine paragraf cu retragere în Docs (câte 1,25 cm pe treaptă), fără spațiile din față.
  const ind = /^ {4,}/.exec(text);
  if (ind && text.trim()) { const inner = para(text.slice(ind[0].length)); return { ...inner, attrs: { ...inner.attrs, indent: Math.min(8, Math.floor(ind[0].length / 4)) } }; }
  const la = lineAlign(text);
  if (la) return { type: 'paragraph', attrs: { textAlign: la.align }, content: runs(la.text) };
  return text ? { type: 'paragraph', content: runs(text) } : { type: 'paragraph' };
};
// „| a | b |” → tabel; primul rând e cap de tabel dacă sub el e „| --- | --- |”.
const table = (head: string[] | null, rows: string[][]): Node => {
  const n = Math.max(head?.length ?? 0, ...rows.map((r) => r.length));
  const row = (cells: string[], type: string): Node => ({ type: 'tableRow', content: Array.from({ length: n }, (_, i) => ({ type, content: [para(cells[i] ?? '')] })) });
  return { type: 'table', content: [...(head ? [row(head, 'tableHeader')] : []), ...rows.map((r) => row(r, 'tableCell'))] };
};

// Ecuațiile scoase din rând: în Docs o ecuație e o imagine pe rândul ei, deci vine sub textul în care era (sau în locul lui, dacă rândul era doar ecuația).
const liftEq = (nodes: Node[], pngs: EqPngs): Node[] => nodes.flatMap((nd) => {
  if (nd.type !== 'paragraph' && nd.type !== 'heading') return nd.content ? [{ ...nd, content: liftEq(nd.content, pngs) }] : [nd];
  const eqs = (nd.content ?? []).filter((c) => c.type === 'noteEq');
  if (!eqs.length) return [nd];
  const rest = (nd.content ?? []).filter((c) => c.type !== 'noteEq');
  const imgs = eqs.map((c): Node => {
    const src = String(c.attrs!.src), png = pngs.get(src);
    return png
      ? { type: 'image', attrs: { src: png.src, alt: equationAlt({ src }), width: png.w, align: 'center', equation: JSON.stringify({ src }) } }
      : { type: 'paragraph', content: [{ type: 'text', text: src }] };
  });
  return [...(rest.some((c) => c.type !== 'text' || c.text?.trim()) ? [{ ...nd, content: rest }] : []), ...imgs];
});

export function noteToDoc(n: Note, pngs: EqPngs = new Map()): string {
  noteFont = fontCss(n.font);
  const content: Node[] = [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: shownTitle(n) }] }];
  const lines = withBoxes(n.title.trim() ? n.body : n.body.split('\n').slice(1).join('\n'), n).replace(/\s+$/, '').split('\n');
  // Rândurile cu buline („• ”) și numerotate („1. ”) devin liste Word adevărate (sub-listele intră la același nivel).
  const tables = parseBlocks(lines.join(String.fromCharCode(10))).filter((b) => b.kind === 'table');
  let inTable = false;
  for (const line of lines) {
    // Rândurile de tabel consecutive devin un singur tabel (în ordinea în care apar).
    if (line.trim().startsWith('|') && line.trim().length > 1) {
      if (!inTable) { const t = tables.shift(); if (t && t.kind === 'table') content.push(table(t.head, t.rows)); inTable = true; }
      continue;
    }
    inTable = false;
    const hl = headingLevel(line);
    if (hl) { const t = line.slice(hl + 1), la = lineAlign(t); content.push({ type: 'heading', attrs: { level: Math.min(6, hl + 1), ...(la ? { textAlign: la.align } : {}) }, content: runs(la ? la.text : t) }); continue; }
    const b = /^\s*[•*-] (.*)$/.exec(line);
    const num = b ? null : /^\s*(\d{1,3})[.)] (.*)$/.exec(line);
    const type = b ? 'bulletList' : num ? 'orderedList' : '';
    if (!type) { content.push(para(line)); continue; }
    const item: Node = { type: 'listItem', content: [para(b ? b[1] : num![2])] };
    const last = content[content.length - 1];
    if (last.type === type) last.content!.push(item);
    else content.push({ type, ...(num ? { attrs: { start: Number(num[1]) } } : {}), content: [item] });
  }
  for (const [i, src] of [...(n.images ?? []), ...boxImages(n.boxes)].entries()) content.push({ type: 'image', attrs: { src, alt: `Poza ${i + 1}` } });
  if (n.files?.length) content.push(para(`📎 Atașamente: ${n.files.map((f) => f.name).join(', ')}`));
  return JSON.stringify({ format: 'suite-doc', version: 1, content: { type: 'doc', content: liftEq(content, pngs) }, updatedAt: new Date().toISOString() });
}
