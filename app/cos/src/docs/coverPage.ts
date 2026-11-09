// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Pagina de gardă (Word: Inserare → Pagină copertă): câteva modele gata făcute, puse la începutul documentului și urmate de o
// pagină nouă. Sunt paragrafe obișnuite (titlu, subtitlu, autor, dată), deci se scriu direct peste ele și se păstrează în .docx / .odt.
import type { JSONContent } from '@tiptap/react';

export type CoverKind = 'clasic' | 'banda' | 'chenar' | 'stanga';
export const COVERS: [CoverKind, string, string][] = [
  ['clasic', 'Clasică', 'Titlul și subtitlul pe mijlocul paginii, autorul și data jos'],
  ['banda', 'Bandă colorată', 'Titlul pe o bandă albastru închis, cu litere albe'],
  ['chenar', 'Cu chenar', 'Titlul și subtitlul încadrate, pe mijloc'],
  ['stanga', 'Modernă, la stânga', 'Totul aliniat la stânga, cu titlul mare și data sus'],
];

/** Al câtelea paragraf e titlul (se selectează după inserare, ca să-l rescrii). */
export const COVER_TITLE: Record<CoverKind, number> = { clasic: 0, banda: 1, chenar: 0, stanga: 1 };

export interface CoverText { title: string; subtitle: string; author: string; date: string }

const text = (t: string, marks?: JSONContent['marks']): JSONContent[] => (t ? [{ type: 'text', text: t, ...(marks ? { marks } : {}) }] : []);
const para = (attrs: Record<string, unknown>, t: string, marks?: JSONContent['marks']): JSONContent => ({ type: 'paragraph', attrs, content: text(t, marks) });
const size = (pt: number, color?: string) => [{ type: 'textStyle', attrs: { fontSize: `${pt}pt`, ...(color ? { color } : {}) } }];

/** Paragrafele paginii de gardă, cu pagină nouă la sfârșit. */
export function coverContent(kind: CoverKind, t: CoverText): JSONContent[] {
  const out: JSONContent[] = [];
  if (kind === 'clasic') {
    out.push(
      para({ textAlign: 'center', spaceBefore: 180, pstyle: 'title' }, t.title),
      para({ textAlign: 'center', pstyle: 'subtitle' }, t.subtitle),
      para({ textAlign: 'center', spaceBefore: 220 }, t.author, [{ type: 'bold' }]),
      para({ textAlign: 'center' }, t.date),
    );
  } else if (kind === 'banda') {
    out.push(
      para({ spaceBefore: 150, spaceAfter: 0, shade: '#1f3864' }, ''),
      para({ spaceBefore: 0, spaceAfter: 0, shade: '#1f3864' }, t.title, size(32, '#ffffff')),
      para({ spaceBefore: 0, shade: '#1f3864' }, t.subtitle, size(16, '#dbe5f1')),
      para({ spaceBefore: 260 }, t.author, [{ type: 'bold' }]),
      para({}, t.date),
    );
  } else if (kind === 'chenar') {
    out.push(
      para({ textAlign: 'center', spaceBefore: 160, spaceAfter: 0, box: true }, t.title, size(30)),
      para({ textAlign: 'center', spaceBefore: 0, box: true }, t.subtitle, size(15, '#44546a')),
      para({ textAlign: 'center', spaceBefore: 240 }, t.author),
      para({ textAlign: 'center' }, t.date),
    );
  } else {
    out.push(
      para({ spaceBefore: 40 }, t.date, size(12, '#44546a')),
      para({ spaceBefore: 160, spaceAfter: 6 }, t.title, [{ type: 'bold' }, ...size(36, '#1f3864')]),
      para({ spaceAfter: 6 }, t.subtitle, size(18, '#44546a')),
      para({ spaceBefore: 220 }, t.author, size(13)),
    );
  }
  out.push({ type: 'pageBreak' });
  return out;
}

/** Textul pus la început: titlul primului titlu din document (dacă există), altfel locuri de completat. */
export function coverText(firstHeading: string | null, author: string | null, now = new Date()): CoverText {
  return {
    title: firstHeading?.trim() || 'Titlul documentului',
    subtitle: 'Subtitlul documentului',
    author: author?.trim() || 'Numele autorului',
    date: now.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}
