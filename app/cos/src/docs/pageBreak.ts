// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Pagină nouă (Ctrl+Enter, ca în Word): pe ecran e o linie punctată, la tipărire / PDF textul de după începe pe pagina următoare.
import { Node, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: { setPageBreak: () => ReturnType; insertBlankPage: () => ReturnType };
  }
}

export const PageBreak = Node.create({
  name: 'pageBreak',
  // Înaintea „rândului nou” din StarterKit, care folosește și el Ctrl+Enter.
  priority: 1000,
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': '', class: 'doc-page-break' })];
  },

  addCommands() {
    return {
      // La sfârșitul documentului mai punem un paragraf gol după ea, ca să ai unde scrie.
      setPageBreak: () => ({ chain }) => chain()
        .insertContent({ type: this.name })
        .command(({ tr, dispatch }) => {
          if (tr.doc.lastChild?.type.name === this.name && dispatch) {
            const end = tr.doc.content.size;
            tr.insert(end, tr.doc.type.schema.nodes.paragraph.create());
            tr.setSelection(TextSelection.create(tr.doc, end + 1));
          }
          return true;
        })
        .run(),
      // Pagină goală (ca Inserare → Pagină goală): pagină nouă, un rând gol, pagină nouă; cursorul rămâne pe pagina goală.
      insertBlankPage: () => ({ state, tr, dispatch, chain }) => {
        const { $from, empty } = state.selection;
        const pb = state.schema.nodes[this.name], para = state.schema.nodes.paragraph;
        // La începutul / sfârșitul unui paragraf cu text, pagina se pune înainte / după el (fără un rând gol în plus).
        const edge = empty && $from.depth === 1 && $from.parent.isTextblock && $from.parent.content.size
          ? ($from.parentOffset === 0 ? $from.before() : $from.parentOffset === $from.parent.content.size ? $from.after() : -1) : -1;
        if (edge < 0) {
          // În mijlocul textului (sau peste o selecție): ca la Pagină nouă, paragraful se rupe în două.
          return chain().insertContent([{ type: this.name }, { type: 'paragraph' }, { type: this.name }]).command(({ tr: t }) => {
            let target = -1;
            t.doc.nodesBetween(Math.max(0, t.selection.from - 6), Math.min(t.doc.content.size, t.selection.from + 2), (node, pos) => {
              if (node.type === para && !node.content.size && t.doc.resolve(pos).nodeBefore?.type === pb) target = pos + 1;
            });
            if (target > 0) t.setSelection(TextSelection.create(t.doc, target));
            return true;
          }).run();
        }
        if (dispatch) {
          tr.insert(edge, [pb.create(), para.create(), pb.create()]);
          if (tr.doc.lastChild?.type === pb) tr.insert(tr.doc.content.size, para.create());
          tr.setSelection(TextSelection.create(tr.doc, edge + 2));
          dispatch(tr.scrollIntoView());
        }
        return true;
      },
    };
  },

  addKeyboardShortcuts() {
    return { 'Mod-Enter': () => this.editor.commands.setPageBreak() };
  },
});
