// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Lista verticală din text (ca Drop-Down List Content Control): o alegere dintr-o listă de variante, la cursor, schimbată
// dintr-o listă care se deschide la clic, chiar și în documentul protejat pentru completare. În .docx: w:sdt cu
// w:dropDownList (dus-întors); în .odt și ca text: varianta aleasă (sau textul de completat, dacă nu e aleasă niciuna).
import { Node, mergeAttributes } from '@tiptap/core';
import { askText } from '../ask';

import { DROP_EMPTY, parseDropItems, dropText } from './formDropData';
export { DROP_EMPTY, parseDropItems, dropText };

const SEP = String.fromCharCode(10);
const EDIT = String.fromCharCode(1) + 'edit';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formDrop: { insertFormDrop: (items: string[], value?: string) => ReturnType };
  }
}

export const FormDrop = Node.create({
  name: 'formDrop',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      items: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-items') ?? '',
        renderHTML: (a) => ({ 'data-items': a.items }),
      },
      value: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-form-drop') ?? '',
        renderHTML: (a) => ({ 'data-form-drop': a.value }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-form-drop]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-form-drop' + (node.attrs.value ? '' : ' empty') }), dropText(node.attrs)];
  },
  renderText({ node }) {
    return dropText(node.attrs);
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let cur = node;
      const dom = document.createElement('span');
      dom.className = 'doc-form-drop';
      dom.contentEditable = 'false';
      const sel = document.createElement('select');
      sel.title = 'Listă verticală: alege o variantă';
      const fill = () => {
        const items = String(cur.attrs.items || '').split(SEP).filter(Boolean);
        const value = String(cur.attrs.value || '');
        dom.classList.toggle('empty', !value);
        sel.textContent = '';
        const add = (v: string, label: string) => { const o = document.createElement('option'); o.value = v; o.textContent = label; sel.appendChild(o); };
        add('', DROP_EMPTY);
        for (const it of items) add(it, it);
        // O alegere din fișier care nu e în listă rămâne arătată.
        if (value && !items.includes(value)) add(value, value);
        add(EDIT, '✎ Schimbă variantele…');
        sel.value = value;
      };
      fill();
      const at = () => {
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof pos !== 'number') return null;
        const n = editor.state.doc.nodeAt(pos);
        return n && n.type.name === 'formDrop' ? { pos, n } : null;
      };
      sel.addEventListener('change', () => {
        const hit = at();
        if (!hit) return;
        if (sel.value === EDIT) {
          sel.value = String(hit.n.attrs.value || '');
          void askText('Listă verticală', 'Variantele listei, despărțite prin punct și virgulă (;):', String(hit.n.attrs.items || '').split(SEP).filter(Boolean).join('; ')).then((t) => {
            const again = at();
            if (t == null || !again) return;
            const items = parseDropItems(t);
            if (!items.length) return;
            const value = items.includes(String(again.n.attrs.value)) ? String(again.n.attrs.value) : '';
            editor.view.dispatch(editor.state.tr.setNodeMarkup(again.pos, undefined, { ...again.n.attrs, items: items.join(SEP), value }));
          });
          return;
        }
        // Alegerea trece și în documentul protejat pentru completare (ca la caseta de selectare).
        editor.view.dispatch(editor.state.tr.setNodeMarkup(hit.pos, undefined, { ...hit.n.attrs, value: sel.value }).setMeta('formFill', true));
      });
      dom.appendChild(sel);
      return {
        dom,
        update: (n) => { if (n.type.name !== 'formDrop') return false; cur = n; fill(); return true; },
        stopEvent: (e) => e.target === sel,
        ignoreMutation: () => true,
      };
    };
  },
  addCommands() {
    return {
      insertFormDrop: (items, value = '') => ({ commands }) => commands.insertContent({ type: this.name, attrs: { items: items.join(SEP), value } }),
    };
  },
});
