// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Sfârșit de coloană (Ctrl+Shift+Enter, ca în Word): în textul pe 2–3 coloane, ce urmează începe în coloana următoare.
// Pe ecran e o linie punctată cu eticheta „Sfârșit de coloană”; la tipărire / PDF rămâne doar saltul.
import { Node, mergeAttributes } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columnBreak: { setColumnBreak: () => ReturnType };
  }
}

export const ColumnBreak = Node.create({
  name: 'columnBreak',
  priority: 1000,
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-column-break]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-column-break': '', class: 'doc-column-break' })];
  },

  addCommands() {
    return {
      // Ca la pagina nouă: la sfârșitul documentului mai punem un paragraf gol după el, ca să ai unde scrie.
      setColumnBreak: () => ({ chain }) => chain()
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
    };
  },

  addKeyboardShortcuts() {
    return { 'Mod-Shift-Enter': () => this.editor.commands.setColumnBreak() };
  },
});
