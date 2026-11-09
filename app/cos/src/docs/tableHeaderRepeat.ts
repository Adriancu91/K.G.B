// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Rândul de antet repetat pe fiecare pagină (ca „Repeat Header Rows” din Word): rândurile marcate de la începutul tabelului
// se tipăresc din nou în capul fiecărei pagini pe care continuă tabelul (la tipărire și la PDF), iar în .docx devin w:tblHeader
// și în .odt table:table-header-rows. La deschidere se recunosc din <thead> (așa vin rândurile w:tblHeader din .docx) și din .odt.
import { Extension } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { tableAt } from './tableOps';

type Cmd = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean;

export const TableHeaderRepeat = Extension.create({
  name: 'tableHeaderRepeat',
  addGlobalAttributes() {
    return [{
      types: ['tableRow'],
      attributes: {
        repeatHeader: {
          default: false,
          parseHTML: (el) => el.hasAttribute('data-repeat-header') || el.parentElement?.tagName === 'THEAD',
          renderHTML: (a) => (a.repeatHeader ? { 'data-repeat-header': '' } : {}),
        },
      },
    }];
  },
});

/** Câte rânduri de la începutul tabelului se repetă (doar cele marcate la rând, de sus). */
export function repeatCount(rows: { attrs?: Record<string, unknown> | null }[]): number {
  let n = 0;
  while (n < rows.length && rows[n].attrs?.repeatHeader) n++;
  return n;
}

/** E rândul cursorului printre rândurile repetate? */
export function isRepeatOn(state: EditorState): boolean {
  const w = tableAt(state);
  if (!w) return false;
  const rows = Array.from({ length: w.table.childCount }, (_, i) => w.table.child(i));
  return w.row < repeatCount(rows.map((r) => ({ attrs: r.attrs })));
}

/** Pornește / oprește repetarea: pornită, se repetă toate rândurile de sus până la cel cu cursorul (ca în Word, antetul
 *  trebuie să înceapă cu primul rând); oprită, nu se mai repetă rândul cursorului și nici cele de sub el. */
export const toggleRepeatHeader: Cmd = (state, dispatch) => {
  const w = tableAt(state);
  if (!w) return false;
  const on = !isRepeatOn(state);
  if (dispatch) {
    const tr = state.tr;
    let pos = w.pos + 1;
    for (let i = 0; i < w.table.childCount; i++) {
      const row = w.table.child(i);
      const want = on ? (i <= w.row || !!row.attrs.repeatHeader) : (i < w.row && !!row.attrs.repeatHeader);
      if (!!row.attrs.repeatHeader !== want) tr.setNodeMarkup(pos, undefined, { ...row.attrs, repeatHeader: want });
      pos += row.nodeSize;
    }
    dispatch(tr.scrollIntoView());
  }
  return true;
};
