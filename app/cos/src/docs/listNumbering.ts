// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Numerotarea listelor: o listă numerotată pusă după o imagine, un tabel sau un paragraf poate continua numerotarea
// listei de dinainte (5, 6, 7…) sau poate reîncepe de la 1. În Word asta e una din cele mai frecvente plângeri.
import type { Editor } from '@tiptap/core';

/** Lista numerotată în care e cursorul (cea mai apropiată), cu poziția ei. */
function currentList(editor: Editor): { pos: number; start: number } | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'orderedList') return { pos: $from.before(d), start: Number(node.attrs.start) || 1 };
  }
  return null;
}

/** Numărul cu care ar continua lista numerotată de dinainte (ultimul ei număr + 1), sau null dacă nu există una. */
export function continueNumber(editor: Editor): number | null {
  const cur = currentList(editor);
  if (!cur) return null;
  let next: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (pos >= cur.pos) return false;
    if (node.type.name === 'orderedList' && pos + node.nodeSize <= cur.pos) {
      next = (Number(node.attrs.start) || 1) + node.childCount;
      return false; // listele din interiorul ei nu contează
    }
    return true;
  });
  return next;
}

export function setListStart(editor: Editor, start: number): boolean {
  const cur = currentList(editor);
  if (!cur || start < 1) return false;
  return editor.chain().focus().command(({ tr }) => {
    tr.setNodeMarkup(cur.pos, undefined, { ...tr.doc.nodeAt(cur.pos)!.attrs, start });
    return true;
  }).run();
}

export function listStart(editor: Editor): number | null {
  return currentList(editor)?.start ?? null;
}
