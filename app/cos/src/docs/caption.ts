// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Legende (Inserează legendă): „Figura 1: …”, „Tabelul 2: …”. Paragraful are stilul „Legendă”, iar numărul e un nod mic
// (`captionNum`) pe care îl renumerotăm singuri după fiecare modificare, în ordinea din document, separat pe fiecare etichetă.
// În .docx numărul devine câmp SEQ (Word îl actualizează), iar la import îl recunoaștem din nou în paragrafele cu stilul Caption.
import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Editor, JSONContent } from '@tiptap/react';

export const CAPTION_LABELS = ['Figura', 'Tabelul', 'Ecuația'];

export const CaptionNum = Node.create({
  name: 'captionNum',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      label: { default: 'Figura', parseHTML: (el) => el.getAttribute('data-seq') ?? 'Figura' },
      n: { default: 1, parseHTML: (el) => Number(el.textContent) || 1 },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-seq]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-seq': node.attrs.label, class: 'doc-seq', title: 'Se numerotează singur' }), String(node.attrs.n)];
  },

  renderText({ node }) {
    return String(node.attrs.n);
  },

  // Numărul intră și în textul paragrafului (textContent), deci în trimiteri, căutare și cuprinsuri.
  extendNodeSchema(extension) {
    return extension.name === 'captionNum' ? { leafText: (node: { attrs: Record<string, unknown> }) => String(node.attrs.n) } : {};
  },

  addProseMirrorPlugins() {
    const type = this.type;
    return [new Plugin({
      key: new PluginKey('captionRenumber'),
      appendTransaction: (trs, _old, state) => {
        if (!trs.some((t) => t.docChanged)) return null;
        const count = new Map<string, number>();
        let tr = null as typeof state.tr | null;
        state.doc.descendants((node, pos) => {
          if (node.type !== type) return true;
          const label = String(node.attrs.label);
          const n = (count.get(label) ?? 0) + 1;
          count.set(label, n);
          if (node.attrs.n !== n) (tr ??= state.tr).setNodeMarkup(pos, undefined, { ...node.attrs, n });
          return false;
        });
        return tr;
      },
    })];
  },
});

/** Paragraful legendei: „Figura ” + număr + „: text”. */
export function captionParagraph(label: string, text: string): JSONContent {
  const t = text.trim();
  return {
    type: 'paragraph', attrs: { pstyle: 'caption' },
    content: [{ type: 'text', text: label + ' ' }, { type: 'captionNum', attrs: { label, n: 1 } }, ...(t ? [{ type: 'text', text: ': ' + t }] : [])],
  };
}

/** Pune legenda sub sau deasupra blocului în care e cursorul (tabelul întreg, dacă e într-un tabel). */
export function insertCaption(editor: Editor, label: string, text: string, where: 'below' | 'above'): boolean {
  const { $from } = editor.state.selection;
  let depth = 1;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'table') { depth = d; break; }
  if ($from.depth === 0) return false;
  const at = where === 'above' ? $from.before(depth) : $from.after(depth);
  return editor.chain().focus().insertContentAt(at, captionParagraph(label, text)).run();
}

/** La importul .docx: în paragrafele cu stilul Caption, „Figura 3” devine număr care se actualizează. */
export function captionsFromHtml(html: string): string {
  return html.replace(/(<p class="doc-caption"[^>]*>(?:<[^>]+>)*)(Figura|Tabelul|Ecuația|Ecuatia|Figure|Table|Equation|Fig\.)(\s|&nbsp;)+(\d+)/g,
    (_m, open: string, label: string, _s: string, n: string) => `${open}${label} <span data-seq="${label}">${n}</span>`);
}
