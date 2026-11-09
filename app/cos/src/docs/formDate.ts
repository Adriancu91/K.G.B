// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Selectorul de dată din text (ca Date Picker Content Control): o dată la cursor, aleasă dintr-un calendar care se deschide
// la clic, chiar și în documentul protejat pentru completare. În .docx: w:sdt cu w:date (w:fullDate și formatul zz.LL.aaaa,
// dus-întors); în .odt și ca text: data scrisă (sau textul de completat, dacă nu e aleasă).
import { Node, mergeAttributes } from '@tiptap/core';

export const DATE_EMPTY = 'Alegeți o dată.';

/** Data păstrată (AAAA-LL-ZZ) sau „” dacă nu e o dată adevărată. */
export function cleanDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/** Data scrisă de om (zz.LL.aaaa, zz/LL/aaaa sau zz-LL-aaaa) ca AAAA-LL-ZZ; „” dacă nu se poate citi. */
export function parseShownDate(s: string): string {
  const iso = cleanDate(s);
  if (iso) return iso;
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s.trim());
  return m ? cleanDate(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`) : '';
}

/** Textul arătat (și scris în .docx / .odt / ca text): zz.LL.aaaa sau textul de completat. */
export function dateText(attrs: { value?: unknown } | undefined): string {
  const v = cleanDate(String(attrs?.value ?? ''));
  return v ? `${v.slice(8, 10)}.${v.slice(5, 7)}.${v.slice(0, 4)}` : DATE_EMPTY;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formDate: { insertFormDate: (value?: string) => ReturnType };
  }
}

export const FormDate = Node.create({
  name: 'formDate',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      value: {
        default: '',
        parseHTML: (el) => cleanDate(el.getAttribute('data-form-date') ?? ''),
        renderHTML: (a) => ({ 'data-form-date': a.value }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-form-date]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-form-date' + (node.attrs.value ? '' : ' empty') }), dateText(node.attrs)];
  },
  renderText({ node }) {
    return dateText(node.attrs);
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let cur = node;
      const dom = document.createElement('span');
      dom.className = 'doc-form-date';
      dom.contentEditable = 'false';
      const inp = document.createElement('input');
      inp.type = 'date';
      inp.title = 'Selector de dată: alege data din calendar';
      const fill = () => { inp.value = cleanDate(String(cur.attrs.value || '')); dom.classList.toggle('empty', !inp.value); };
      fill();
      inp.addEventListener('change', () => {
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof pos !== 'number') return;
        const n = editor.state.doc.nodeAt(pos);
        if (!n || n.type.name !== 'formDate') return;
        const value = cleanDate(inp.value);
        if (value === n.attrs.value) return;
        // Data trece și în documentul protejat pentru completare (ca la caseta de selectare).
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...n.attrs, value }).setMeta('formFill', true));
      });
      dom.appendChild(inp);
      return {
        dom,
        update: (n) => { if (n.type.name !== 'formDate') return false; cur = n; fill(); return true; },
        stopEvent: (e) => e.target === inp,
        ignoreMutation: () => true,
      };
    };
  },
  addCommands() {
    return {
      insertFormDate: (value = '') => ({ commands }) => commands.insertContent({ type: this.name, attrs: { value: cleanDate(value) } }),
    };
  },
});
