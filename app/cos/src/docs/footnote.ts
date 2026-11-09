// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Note de subsol (Ctrl+Alt+F, ca în Word): în text e un număr mic (¹, ², ³ se numerotează singure),
// iar textul notelor se scrie în lista de sub document. La Export Word devin note de subsol adevărate.
// Notele de final (Ctrl+Alt+D) sunt același nod, cu `end`: se numerotează separat (i, ii, iii) și în Word stau la sfârșitul documentului.
import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnote: {
      insertFootnote: (text?: string) => ReturnType;
      insertEndnote: (text?: string) => ReturnType;
      setFootnoteText: (index: number, text: string, end?: boolean) => ReturnType;
    };
  }
}

export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      text: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-footnote') ?? '',
        renderHTML: (a) => ({ 'data-footnote': a.text, title: a.text || (a.end ? 'Notă de final (scrie textul ei sub document)' : 'Notă de subsol (scrie textul ei sub document)') }),
      },
      end: {
        default: false,
        parseHTML: (el) => el.hasAttribute('data-endnote'),
        renderHTML: (a) => (a.end ? { 'data-endnote': '' } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'sup[data-footnote]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return ['sup', mergeAttributes(HTMLAttributes, { class: node.attrs.end ? 'doc-en' : 'doc-fn' })];
  },

  renderText: () => '',

  addCommands() {
    return {
      insertFootnote: (text = '') => ({ commands }) => commands.insertContent({ type: this.name, attrs: { text } }),
      insertEndnote: (text = '') => ({ commands }) => commands.insertContent({ type: this.name, attrs: { text, end: true } }),
      setFootnoteText: (index, text, end = false) => ({ state, tr, dispatch }) => {
        const pos = footnotePositions(state.doc, end)[index];
        if (pos === undefined) return false;
        const node = state.doc.nodeAt(pos);
        if (!node) return false;
        if (dispatch) dispatch(tr.setNodeMarkup(pos, undefined, { ...node.attrs, text }));
        return true;
      },
    };
  },

  addKeyboardShortcuts() {
    return { 'Mod-Alt-f': () => this.editor.commands.insertFootnote(), 'Mod-Alt-d': () => this.editor.commands.insertEndnote() };
  },
});

/** Pozițiile notelor de subsol (sau, cu end, ale notelor de final) din document, în ordinea în care apar (nota 1, 2, 3…). */
export function footnotePositions(doc: PMNode, end = false): number[] {
  const out: number[] = [];
  doc.descendants((n, pos) => {
    if (n.type.name === 'footnote' && !!n.attrs.end === end) out.push(pos);
    return true;
  });
  return out;
}

export function listFootnotes(doc: PMNode, end = false): string[] {
  return footnotePositions(doc, end).map((pos) => String(doc.nodeAt(pos)?.attrs.text ?? ''));
}

const NL = String.fromCharCode(10);
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/**
 * Mammoth pune notele din Word la sfârșit, ca listă (<li id="footnote-1">…</li>), iar în text trimiteri „[1]”.
 * Le facem note de-ale noastre: trimiterea devine <sup data-footnote="textul notei">, iar lista dispare.
 */
export function footnotesFromMammoth(html: string): string {
  const notes = new Map<string, string>();
  let out = html.replace(/<li id="((?:foot|end)note-[0-9]+)">([^]*?)<[/]li>/g, (_m, id: string, body: string) => {
    const text = body
      .replace(/<a href="#(?:foot|end)note-ref-[0-9]+">[^<]*<[/]a>/g, '')
      .replace(/<[/]p>[ ]*<p[^>]*>/g, NL)
      .replace(/<[^>]+>/g, '');
    notes.set(id, unesc(text).trim());
    return '';
  });
  if (!notes.size) return html;
  out = out.replace(/<ol>[ ]*<[/]ol>/g, '');
  return out.replace(
    /<sup><a href="#((?:foot|end)note-[0-9]+)" id="[^"]*">[^<]*<[/]a><[/]sup>/g,
    (_m, id: string) => `<sup data-footnote="${esc(notes.get(id) ?? '')}"${id.startsWith('endnote') ? ' data-endnote=""' : ''}></sup>`,
  );
}
