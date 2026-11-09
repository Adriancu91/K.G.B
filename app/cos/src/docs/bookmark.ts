// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Semne de carte (🔖): un loc numit din document, la care sari din fereastra „Semn de carte” sau printr-o legătură (#nume).
// Pe ecran e un mic semn gri care nu se tipărește. În .docx devine w:bookmarkStart / w:bookmarkEnd, în .odt text:bookmark,
// iar la import citim semnele din Word (inclusiv cele ascunse, de tipul _Toc…, ca să meargă legăturile din cuprins).
import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bookmark: { setBookmark: (name: string) => ReturnType };
  }
}

/** Numele unui semn de carte: literă la început, apoi litere, cifre sau „_”, cel mult 40 (ca în Word). */
export function bookmarkName(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, '_');
  return /^[\p{L}_][\p{L}\p{N}_]{0,39}$/u.test(t) ? t : null;
}

/** Semnele ascunse (_Toc…, _Ref…) le face programul singur; nu le arătăm în listă. */
export const isHiddenBookmark = (name: string) => name.startsWith('_');

export interface BookmarkAt { name: string; pos: number }

export function listBookmarks(doc: PMNode): BookmarkAt[] {
  const out: BookmarkAt[] = [];
  doc.descendants((n, pos) => {
    if (n.type.name === 'bookmark') out.push({ name: String(n.attrs.name), pos });
  });
  return out;
}

/** Pune cursorul la semnul de carte și derulează până la el. */
export function goToBookmark(editor: Editor, name: string): boolean {
  const b = listBookmarks(editor.state.doc).find((x) => x.name === name);
  if (!b) return false;
  const { tr } = editor.state;
  editor.view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(b.pos + 1))).scrollIntoView());
  editor.view.focus();
  const el = editor.view.dom.querySelector(`[data-bookmark="${CSS.escape(name)}"]`);
  el?.scrollIntoView({ block: 'center' });
  return true;
}

export function removeBookmark(editor: Editor, name: string): boolean {
  const b = listBookmarks(editor.state.doc).find((x) => x.name === name);
  if (!b) return false;
  editor.view.dispatch(editor.state.tr.delete(b.pos, b.pos + 1));
  return true;
}

export const Bookmark = Node.create({
  name: 'bookmark',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return { name: { default: '' } };
  },

  parseHTML() {
    return [
      { tag: 'span[data-bookmark]', getAttrs: (el) => ({ name: (el as HTMLElement).getAttribute('data-bookmark') ?? '' }) },
      // Semnele din .docx (prin mammoth) și din paginile web: <a id="nume"></a>. _GoBack e doar locul ultimei modificări.
      { tag: 'a[id]', getAttrs: (el) => {
        const e = el as HTMLElement;
        const name = e.getAttribute('id') ?? '';
        return !e.hasAttribute('href') && !e.textContent && name && name !== '_GoBack' ? { name } : false;
      } },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = String(node.attrs.name);
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-bookmark': name,
      class: isHiddenBookmark(name) ? 'doc-bookmark doc-bookmark-hidden' : 'doc-bookmark',
      title: `Semn de carte: ${name}`,
    })];
  },

  renderText() {
    return '';
  },

  addCommands() {
    return {
      // Un nume folosit deja se mută aici (ca în Word: „Adaugă” cu un nume existent îl mută).
      setBookmark: (name) => ({ state, tr, dispatch }) => {
        const old = listBookmarks(state.doc).find((b) => b.name === name);
        if (!dispatch) return true;
        const at = state.selection.from;
        tr.insert(at, this.type.create({ name }));
        if (old) {
          const p = tr.mapping.map(old.pos, old.pos < at ? -1 : 1);
          tr.delete(p, p + 1);
        }
        return true;
      },
    };
  },
});
