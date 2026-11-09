// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Cuprins automat: un bloc care arată titlurile documentului și se actualizează singur la fiecare modificare.
// Click pe un rând duce la titlul lui. În fișier se păstrează doar locul cuprinsului (<div data-toc>), nu textul.
import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { pageHeight, pageMap } from './pageCount';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableOfContents: { insertTableOfContents: () => ReturnType };
  }
}

export interface TocEntry { level: number; text: string; pos: number }

/** Nivelurile cuprinsului: 1–6, implicit 3. */
export function tocLevels(v: unknown): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : 3;
}

/** Un rând de cuprins: textul, punctele de legătură și numărul paginii (pe ecran, ca la tipărire). */
export function tocRow(text: string, page: number | null, cls: string): HTMLAnchorElement {
  const row = document.createElement('a');
  row.className = cls;
  const t = document.createElement('span');
  t.className = 'doc-toc-text';
  t.textContent = text;
  row.append(t);
  if (page !== null) {
    const dots = document.createElement('span');
    dots.className = 'doc-toc-dots';
    const num = document.createElement('span');
    num.className = 'doc-toc-page';
    num.textContent = String(page);
    row.append(dots, num);
  }
  return row;
}

/** Pagina fiecărei poziții, măsurată pe ecran (ca „Pagina X din Y”); fără număr dacă editorul nu e afișat. */
export function pagesFor(view: import('@tiptap/pm/view').EditorView, positions: number[]): (number | null)[] {
  if (!view.dom.isConnected || !(view.dom as HTMLElement).offsetHeight) return positions.map(() => null);
  const at = pageMap(view, pageHeight(view));
  return positions.map((p) => at(p + 1).page);
}

/** Titlurile documentului (până la `maxLevel`), în ordine, cu poziția lor. Titlurile goale se sar. */
export function tocEntries(doc: PMNode, maxLevel = 6): TocEntry[] {
  const out: TocEntry[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const text = node.textContent.trim();
      if (text && (Number(node.attrs.level) || 1) <= maxLevel) out.push({ level: Number(node.attrs.level) || 1, text, pos });
      return false;
    }
    // Titlurile din tabele nu intră în cuprins (ca în Word, unde stau rar acolo).
    return node.type.name !== 'table';
  });
  return out;
}

export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      // Câte niveluri de titlu intră (implicit 1–3, ca în Word) și dacă se arată numerele de pagină.
      levels: { default: 3, parseHTML: (el) => tocLevels(el.getAttribute('data-levels')), renderHTML: (a) => (a.levels !== 3 ? { 'data-levels': a.levels } : {}) },
      pages: { default: true, parseHTML: (el) => el.getAttribute('data-pages') !== 'no', renderHTML: (a) => (a.pages ? {} : { 'data-pages': 'no' }) },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-toc]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-toc': '', class: 'doc-toc' })];
  },

  addCommands() {
    return {
      // Cuprinsul nu rupe paragraful și nu înlocuiește textul ales: intră după blocul în care e cursorul
      // (sau în locul lui, dacă e un paragraf gol).
      insertTableOfContents: () => ({ state, commands }) => {
        const { $from } = state.selection;
        if ($from.depth === 0) return commands.insertContent({ type: this.name });
        const block = $from.node(1);
        const empty = block.type.name === 'paragraph' && block.content.size === 0;
        const range = empty ? { from: $from.before(1), to: $from.after(1) } : $from.after(1);
        return commands.insertContentAt(range, { type: this.name });
      },
    };
  },

  addNodeView() {
    return ({ editor, node: first, getPos }) => {
      const dom = document.createElement('div');
      dom.className = 'doc-toc';
      dom.setAttribute('data-toc', '');
      dom.contentEditable = 'false';
      let last = '';
      let opts = { levels: tocLevels(first.attrs.levels), pages: first.attrs.pages !== false };

      // Opțiunile se schimbă din bara mică de lângă titlu (nu se tipărește): se scriu în atributele blocului.
      const setOpt = (o: Partial<typeof opts>) => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos == null) return;
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...opts, ...o }));
      };
      const toolbar = () => {
        const bar = document.createElement('span');
        bar.className = 'doc-toc-opts';
        const sel = document.createElement('select');
        sel.title = 'Câte niveluri de titlu intră în cuprins';
        sel.setAttribute('aria-label', 'Niveluri în cuprins');
        for (const n of [1, 2, 3, 4, 5, 6]) sel.append(new Option(n === 1 ? 'Titlu 1' : `Titlu 1–${n}`, String(n), false, n === opts.levels));
        sel.onchange = () => setOpt({ levels: Number(sel.value) });
        const lab = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = opts.pages;
        box.setAttribute('aria-label', 'Numerele paginilor');
        box.onchange = () => setOpt({ pages: box.checked });
        lab.append(box, ' pagini');
        bar.append(sel, lab);
        return bar;
      };

      const render = () => {
        // Implicit Titlu 1–3, ca în Word; se poate alege din bara mică de lângă titlu.
        const entries = tocEntries(editor.state.doc, opts.levels);
        const pages = opts.pages ? pagesFor(editor.view, entries.map((e) => e.pos)) : entries.map(() => null);
        const key = `${opts.levels}|${opts.pages}\n` + entries.map((e, i) => `${e.level}|${e.text}|${e.pos}|${pages[i]}`).join('\n');
        if (key === last && dom.firstChild) return;
        last = key;
        dom.replaceChildren();
        const title = document.createElement('div');
        title.className = 'doc-toc-title';
        title.append('Cuprins', toolbar());
        dom.append(title);
        if (!entries.length) {
          const empty = document.createElement('div');
          empty.className = 'doc-toc-empty';
          empty.textContent = 'Cuprinsul se completează singur cu titlurile documentului (Titlu 1, 2, 3 din lista de stiluri).';
          dom.append(empty);
          return;
        }
        for (const [i, e] of entries.entries()) {
          const row = tocRow(e.text, pages[i], `doc-toc-row l${e.level}`);
          row.title = 'Du-te la acest titlu';
          row.onmousedown = (ev) => ev.preventDefault();
          row.onclick = (ev) => {
            ev.preventDefault();
            editor.chain().focus().setTextSelection(e.pos + 1).scrollIntoView().run();
            // Titlul ajunge sus, nu la marginea de jos a ecranului.
            requestAnimationFrame(() => (editor.view.nodeDOM(e.pos) as HTMLElement | null)?.scrollIntoView({ block: 'start' }));
          };
          dom.append(row);
        }
      };

      // Paginile se schimbă după ce textul s-a așezat: desenăm din nou puțin mai târziu, o dată la câteva taste.
      let timer = 0;
      const later = () => { window.clearTimeout(timer); timer = window.setTimeout(render, 200); };
      render();
      later();
      editor.on('update', later);
      editor.view.dom.addEventListener('suite-pages', later);
      return {
        dom,
        update: (node) => {
          if (node.type.name !== 'tableOfContents') return false;
          const next = { levels: tocLevels(node.attrs.levels), pages: node.attrs.pages !== false };
          if (next.levels !== opts.levels || next.pages !== opts.pages) { opts = next; render(); }
          return true;
        },
        ignoreMutation: () => true,
        // Click pe un rând = salt; click pe titlul „Cuprins” alege tot blocul (ca să-l poți șterge cu Delete).
        stopEvent: (ev) => !!(ev.target as HTMLElement | null)?.closest?.('.doc-toc-row, .doc-toc-opts'),
        destroy: () => { window.clearTimeout(timer); editor.off('update', later); editor.view.dom.removeEventListener('suite-pages', later); },
      };
    };
  },
});
