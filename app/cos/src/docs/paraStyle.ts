// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Stilurile de paragraf „Titlu document” și „Subtitlu” (Title / Subtitle din Word): un atribut al paragrafului,
// ca să rămână text obișnuit (nu intră în cuprins și nici în panoul de navigare, ca în Word).
import { Extension } from '@tiptap/core';

export type ParaStyle = 'title' | 'subtitle' | 'caption';
export const PARA_STYLES: [ParaStyle, string][] = [['title', 'Titlu document'], ['subtitle', 'Subtitlu'], ['caption', 'Legendă']];

const isStyle = (v: string | null): v is ParaStyle => v === 'title' || v === 'subtitle' || v === 'caption';

export const ParaStyleAttr = Extension.create({
  name: 'paraStyle',
  addGlobalAttributes() {
    return [{
      // Stilul nou, creat de utilizator: id-ul lui (cum arată vine din foaia de stil a documentului); rămâne și pe paragraful următor, ca în Word.
      types: ['paragraph', 'heading'],
      attributes: {
        cstyle: {
          default: null,
          parseHTML: (el) => { const v = el.getAttribute('data-cstyle'); return v && /^[a-z0-9]{1,12}$/.test(v) ? v : null; },
          renderHTML: (a) => (a.cstyle ? { 'data-cstyle': a.cstyle } : {}),
        },
      },
    }, {
      types: ['paragraph'],
      attributes: {
        pstyle: {
          default: null,
          // Enter după titlu începe un paragraf normal, ca în Word (stilul următor = Normal).
          keepOnSplit: false,
          // data-pstyle vine din editor / .sdoc; clasa vine de la importul .docx (mammoth).
          parseHTML: (el) => {
            const v = el.getAttribute('data-pstyle');
            if (isStyle(v)) return v;
            return el.classList.contains('doc-title') ? 'title' : el.classList.contains('doc-subtitle') ? 'subtitle' : el.classList.contains('doc-caption') ? 'caption' : null;
          },
          renderHTML: (a) => (isStyle(a.pstyle) ? { 'data-pstyle': a.pstyle, class: `doc-${a.pstyle}` } : {}),
        },
      },
    }];
  },
});

/** Stilurile de bloc din lista „Stil paragraf” și din panoul Stiluri, în ordinea lor. */
export const BLOCK_STYLES: [string, string][] = [
  ['p', 'Text normal'], ...PARA_STYLES, ['quote', 'Citat'],
  ['h1', 'Titlu 1'], ['h2', 'Titlu 2'], ['h3', 'Titlu 3'], ['h4', 'Titlu 4'], ['h5', 'Titlu 5'], ['h6', 'Titlu 6'],
];
interface BlockEditor {
  isActive(name: string): boolean;
  getAttributes(name: string): Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chain(): any;
}
/** Stilul paragrafului de la cursor ('p', 'title', 'quote', 'h1'…). */
export function currentBlock(editor: BlockEditor): string {
  const cs = (editor.getAttributes('paragraph').cstyle ?? editor.getAttributes('heading').cstyle) as string | null;
  if (cs) return 'c:' + cs;
  if (editor.isActive('heading')) return `h${Number(editor.getAttributes('heading').level) || 1}`;
  const ps = editor.getAttributes('paragraph').pstyle as string | null;
  if (ps) return ps;
  return editor.isActive('blockquote') ? 'quote' : 'p';
}
/** Pune stilul `v` pe paragrafele selectate (scoate citatul, dacă stilul nou nu e Citat). */
export function applyBlock(editor: BlockEditor, v: string): void {
  let c = editor.chain().focus();
  // Stil nou (c:id): paragraf obișnuit cu atributul stilului; orice alt stil scoate atributul.
  if (v.startsWith('c:')) {
    if (editor.isActive('blockquote')) c = c.lift('blockquote');
    c.setParagraph().updateAttributes('paragraph', { pstyle: null, cstyle: v.slice(2) }).run();
    return;
  }
  c = c.updateAttributes('paragraph', { cstyle: null }).updateAttributes('heading', { cstyle: null });
  if (v !== 'quote' && editor.isActive('blockquote')) c = c.lift('blockquote');
  if (v === 'p') c.setParagraph().updateAttributes('paragraph', { pstyle: null }).run();
  else if (isStyle(v)) c.setParagraph().updateAttributes('paragraph', { pstyle: v }).run();
  else if (v === 'quote') {
    c = c.setParagraph().updateAttributes('paragraph', { pstyle: null });
    (editor.isActive('blockquote') ? c : c.setBlockquote()).run();
  } else if (/^h[1-6]$/.test(v)) c.setHeading({ level: Number(v[1]) }).run();
}
