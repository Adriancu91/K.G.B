// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Caseta de selectare din text (ca Check Box Content Control): ☐ / ☒ la cursor, bifată sau debifată cu un clic, chiar și
// în documentul protejat pentru completare. În .docx: w:sdt cu w14:checkbox (dus-întors); în .odt și ca text: ☐ / ☒.
import { Node, mergeAttributes } from '@tiptap/core';

export const CHECK_ON = '☒', CHECK_OFF = '☐';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formCheck: { insertFormCheck: (checked?: boolean) => ReturnType };
  }
}

export const FormCheck = Node.create({
  name: 'formCheck',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      checked: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-form-check') === '1',
        renderHTML: (a) => ({ 'data-form-check': a.checked ? '1' : '0' }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-form-check]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-form-check', role: 'checkbox', 'aria-checked': node.attrs.checked ? 'true' : 'false' }), node.attrs.checked ? CHECK_ON : CHECK_OFF];
  },
  renderText({ node }) {
    return node.attrs.checked ? CHECK_ON : CHECK_OFF;
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('span');
      dom.className = 'doc-form-check';
      dom.setAttribute('data-form-check', node.attrs.checked ? '1' : '0');
      dom.setAttribute('role', 'checkbox');
      dom.setAttribute('aria-checked', node.attrs.checked ? 'true' : 'false');
      dom.contentEditable = 'false';
      dom.textContent = node.attrs.checked ? CHECK_ON : CHECK_OFF;
      // Clicul bifează / debifează (și în formularul protejat, unde restul textului nu se poate schimba).
      dom.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof pos !== 'number') return;
        const cur = editor.state.doc.nodeAt(pos);
        if (!cur || cur.type.name !== 'formCheck') return;
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...cur.attrs, checked: !cur.attrs.checked }).setMeta('formFill', true));
      });
      return { dom };
    };
  },
  addCommands() {
    return {
      insertFormCheck: (checked = false) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { checked } }),
    };
  },
});
