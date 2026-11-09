// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Tabel de figuri: lista legendelor din document (Figura 1: …, Figura 2: …), ca un cuprins. Se completează singur;
// clic pe un rând duce la legendă. Poate lua o singură etichetă (doar figurile, doar tabelele) sau toate legendele.
import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { JSONContent } from '@tiptap/react';
import { pagesFor, tocRow } from './toc';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableOfFigures: { insertTableOfFigures: (label: string) => ReturnType };
  }
}

export interface FigureEntry { label: string; text: string; pos: number }

/** Titlul listei după etichetă. */
export function figuresTitle(label: string): string {
  return ({ Figura: 'Lista figurilor', Tabelul: 'Lista tabelelor', 'Ecuația': 'Lista ecuațiilor' } as Record<string, string>)[label] ?? 'Tabel de figuri';
}

/** Legendele din document, cu eticheta lor (din numărul automat); `label` gol = toate. */
export function figureEntries(doc: PMNode, label = ''): FigureEntry[] {
  const out: FigureEntry[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (node.type.name === 'paragraph' && node.attrs.pstyle === 'caption') {
      let lab = '';
      node.forEach((ch) => { if (!lab && ch.type.name === 'captionNum') lab = String(ch.attrs.label); });
      const text = node.textContent.trim();
      if (text && (!label || lab === label)) out.push({ label: lab, text, pos });
    }
    return false;
  });
  return out;
}

/** La fel, pe documentul salvat (JSON), pentru exportul .docx / .odt. */
export function figureEntriesJson(doc: JSONContent, label = ''): string[] {
  const out: string[] = [];
  const text = (n: JSONContent): string => n.type === 'captionNum' ? String(n.attrs?.n ?? '') : n.text ?? (n.content ?? []).map(text).join('');
  const walk = (n: JSONContent) => {
    if (n.type === 'paragraph' && n.attrs?.pstyle === 'caption') {
      const lab = String((n.content ?? []).find((c) => c.type === 'captionNum')?.attrs?.label ?? '');
      const t = text(n).trim();
      if (t && (!label || lab === label)) out.push(t);
    } else (n.content ?? []).forEach(walk);
  };
  walk(doc);
  return out;
}

export const TableOfFigures = Node.create({
  name: 'tableOfFigures',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return { label: { default: '', parseHTML: (el) => el.getAttribute('data-figures') ?? '' } };
  },

  parseHTML() {
    return [{ tag: 'div[data-figures]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-figures': node.attrs.label, class: 'doc-toc doc-figures' })];
  },

  addCommands() {
    return {
      // Ca la cuprins: intră după blocul cu cursorul (sau în locul unui paragraf gol).
      insertTableOfFigures: (label) => ({ state, commands }) => {
        const { $from } = state.selection;
        const node = { type: this.name, attrs: { label } };
        if ($from.depth === 0) return commands.insertContent(node);
        const block = $from.node(1);
        const empty = block.type.name === 'paragraph' && block.content.size === 0;
        return commands.insertContentAt(empty ? { from: $from.before(1), to: $from.after(1) } : $from.after(1), node);
      },
    };
  },

  addNodeView() {
    return ({ editor, node: first }) => {
      let label = String(first.attrs.label);
      const dom = document.createElement('div');
      dom.className = 'doc-toc doc-figures';
      dom.setAttribute('data-figures', label);
      dom.contentEditable = 'false';
      let last = '';

      const render = () => {
        const entries = figureEntries(editor.state.doc, label);
        const pages = pagesFor(editor.view, entries.map((e) => e.pos));
        const key = label + '\n' + entries.map((e, i) => `${e.text}|${e.pos}|${pages[i]}`).join('\n');
        if (key === last && dom.firstChild) return;
        last = key;
        dom.replaceChildren();
        const title = document.createElement('div');
        title.className = 'doc-toc-title';
        title.textContent = figuresTitle(label);
        dom.append(title);
        if (!entries.length) {
          const empty = document.createElement('div');
          empty.className = 'doc-toc-empty';
          empty.textContent = 'Lista se completează singură cu legendele documentului (butonul Legendă).';
          dom.append(empty);
          return;
        }
        for (const [i, e] of entries.entries()) {
          const row = tocRow(e.text, pages[i], 'doc-toc-row');
          row.title = 'Du-te la această legendă';
          row.onmousedown = (ev) => ev.preventDefault();
          row.onclick = (ev) => {
            ev.preventDefault();
            editor.chain().focus().setTextSelection(e.pos + 1).scrollIntoView().run();
            requestAnimationFrame(() => (editor.view.nodeDOM(e.pos) as HTMLElement | null)?.scrollIntoView({ block: 'center' }));
          };
          dom.append(row);
        }
      };

      let timer = 0;
      const later = () => { window.clearTimeout(timer); timer = window.setTimeout(render, 200); };
      render();
      later();
      editor.on('update', later);
      editor.view.dom.addEventListener('suite-pages', later);
      return {
        dom,
        update: (node) => {
          if (node.type.name !== 'tableOfFigures') return false;
          if (String(node.attrs.label) !== label) { label = String(node.attrs.label); render(); }
          return true;
        },
        ignoreMutation: () => true,
        stopEvent: (ev) => !!(ev.target as HTMLElement | null)?.closest?.('.doc-toc-row'),
        destroy: () => { window.clearTimeout(timer); editor.off('update', later); editor.view.dom.removeEventListener('suite-pages', later); },
      };
    };
  },
});
