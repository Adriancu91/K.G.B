// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Biblioteca de buline și numerotări: lista cu buline poate avea cerc, pătrat, bifă, liniuță sau săgeată, iar cea numerotată
// 1) 2) 3), a. b. c., A. B. C., i. ii. iii., I. II. III. sau pe niveluri 1. / 1.1. / 1.1.1. (ca „Bibliotecă de buline / numerotare” din Word).
// Stilul stă pe listă (`listStyle`, null = cel obișnuit: • și 1.); pe ecran îl desenează CSS-ul (`data-list-style`),
// iar la export .docx devine o numerotare proprie (vezi docx.ts).
import { Extension, type Editor } from '@tiptap/core';

export type ListKind = 'bulletList' | 'orderedList';
/** [stil, simbol, nume]; primul e cel obișnuit. */
export const BULLET_STYLES: [string, string, string][] = [
  ['disc', '•', 'Bulină'], ['circle', '◦', 'Cerc'], ['square', '▪', 'Pătrat'],
  ['check', '✓', 'Bifă'], ['dash', '–', 'Liniuță'], ['arrow', '➢', 'Săgeată'],
];
export const NUMBER_STYLES: [string, string, string][] = [
  ['decimal', '1. 2. 3.', 'Cifre'], ['decimal-paren', '1) 2) 3)', 'Cifre cu paranteză'], ['lower-alpha', 'a. b. c.', 'Litere mici'],
  ['upper-alpha', 'A. B. C.', 'Litere mari'], ['lower-roman', 'i. ii. iii.', 'Cifre romane mici'], ['upper-roman', 'I. II. III.', 'Cifre romane mari'],
  // Pe niveluri: sublistele continuă numărul de deasupra (1.1., 1.1.1.), ca la capitolele unui regulament sau ale unei lucrări.
  ['outline', '1. 1.1. 1.1.1.', 'Pe niveluri'],
];
const KNOWN = new Set([...BULLET_STYLES, ...NUMBER_STYLES].map(([s]) => s));
/** Simbolul bulinei pentru un stil (la export). */
export const bulletSymbol = (style: string | null | undefined) => BULLET_STYLES.find(([s]) => s === style)?.[1] ?? '•';

export const ListStyle = Extension.create({
  name: 'listStyle',
  addGlobalAttributes() {
    return [{
      types: ['bulletList', 'orderedList'],
      attributes: {
        listStyle: {
          default: null,
          parseHTML: (el: HTMLElement) => {
            const v = el.getAttribute('data-list-style');
            return v && KNOWN.has(v) ? v : null;
          },
          renderHTML: (a: Record<string, unknown>) => (a.listStyle ? { 'data-list-style': a.listStyle } : {}),
        },
      },
    }];
  },
});

/** Poziția listei de felul ăsta în care e cursorul (cea mai apropiată). */
function listAt(editor: Editor, kind: ListKind): number | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === kind) return $from.before(d);
  return null;
}

/** Stilul listei în care e cursorul („disc” / „decimal” dacă e cel obișnuit; null dacă nu e într-o listă de felul ăsta). */
export function currentListStyle(editor: Editor, kind: ListKind): string | null {
  const pos = listAt(editor, kind);
  if (pos === null) return null;
  return (editor.state.doc.nodeAt(pos)?.attrs.listStyle as string | null) ?? (kind === 'bulletList' ? 'disc' : 'decimal');
}

/** Pune stilul pe lista în care e cursorul; dacă textul nu e încă în listă (sau e în lista celălalt fel), o face întâi. */
export function applyListStyle(editor: Editor, kind: ListKind, style: string): boolean {
  if (listAt(editor, kind) === null) {
    const ok = kind === 'bulletList' ? editor.chain().focus().toggleBulletList().run() : editor.chain().focus().toggleOrderedList().run();
    if (!ok) return false;
  }
  const pos = listAt(editor, kind);
  if (pos === null) return false;
  const value = style === 'disc' || style === 'decimal' || !KNOWN.has(style) ? null : style;
  return editor.chain().focus().command(({ tr }) => {
    tr.setNodeMarkup(pos, undefined, { ...tr.doc.nodeAt(pos)!.attrs, listStyle: value });
    return true;
  }).run();
}
