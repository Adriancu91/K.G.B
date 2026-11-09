// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Înălțimea rândurilor de tabel (ca „Row Height” din Word): o înălțime minimă în cm pentru rândul cu cursorul sau pentru
// rândurile alese; textul mai lung crește rândul mai departe. În .docx devine w:trHeight (cel puțin), în .odt
// style:min-row-height, și se citește înapoi din ambele.
import { Extension } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';

type Cmd = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean;

/** Înălțimea scrisă în stil sau în data-row-height → cm (cu două zecimale), sau null. */
export function parseRowHeight(v: string | null | undefined): number | null {
  const m = /^\s*([\d.]+)\s*(cm|mm|pt|px|in)?\s*$/.exec(v ?? '');
  if (!m) return null;
  const n = Number(m[1]);
  const cm = { cm: n, mm: n / 10, pt: (n / 72) * 2.54, px: (n / 96) * 2.54, in: n * 2.54 }[(m[2] ?? 'cm') as 'cm'];
  return Number.isFinite(cm) && cm > 0 ? Math.min(50, Math.round(cm * 100) / 100) : null;
}

export const TableRowHeight = Extension.create({
  name: 'tableRowHeight',
  addGlobalAttributes() {
    return [{
      types: ['tableRow'],
      attributes: {
        rowHeight: {
          default: null,
          parseHTML: (el) => parseRowHeight(el.getAttribute('data-row-height')) ?? parseRowHeight(el.style.height),
          renderHTML: (a) => (a.rowHeight ? { 'data-row-height': String(a.rowHeight), style: `height: ${a.rowHeight}cm` } : {}),
        },
        // Rândul nu se rupe între pagini (Proprietăți tabel → Rând; w:cantSplit în .docx, fo:keep-together în .odt).
        noSplit: {
          default: false,
          parseHTML: (el) => el.hasAttribute('data-no-split'),
          renderHTML: (a) => (a.noSplit ? { 'data-no-split': '', style: 'break-inside: avoid' } : {}),
        },
      },
    }];
  },
});

/** Pozițiile și nodurile rândurilor de tabel atinse de selecție (sau rândul cursorului). */
function selectedRows(state: EditorState): { pos: number; attrs: Record<string, unknown> }[] {
  const out: { pos: number; attrs: Record<string, unknown> }[] = [];
  const { from, to } = state.selection;
  state.doc.nodesBetween(from, Math.max(from + 1, to), (n, pos) => {
    if (n.type.name === 'tableRow') { out.push({ pos, attrs: n.attrs }); return false; }
    return true;
  });
  return out;
}

/** Înălțimea rândului cu cursorul (cm) sau null când e automată / nu e într-un tabel. */
export function rowHeightAt(state: EditorState): number | null {
  const $p = state.selection.$from;
  for (let d = $p.depth; d > 0; d--) if ($p.node(d).type.name === 'tableRow') return ($p.node(d).attrs.rowHeight as number | null) ?? null;
  return null;
}

/** Pune înălțimea (cm; null = automată) pe rândurile alese, dintr-un singur pas de anulare. */
export const setRowHeight = (cm: number | null): Cmd => (state, dispatch) => {
  const rows = selectedRows(state);
  if (!rows.length) return false;
  const v = cm && cm > 0 ? Math.min(50, Math.round(cm * 100) / 100) : null;
  if (dispatch) {
    const tr = state.tr;
    for (const r of rows) if (r.attrs.rowHeight !== v) tr.setNodeMarkup(r.pos, undefined, { ...r.attrs, rowHeight: v });
    dispatch(tr);
  }
  return true;
};

/** Rândul cu cursorul nu se rupe între pagini? */
export function rowNoSplitAt(state: EditorState): boolean {
  const $p = state.selection.$from;
  for (let d = $p.depth; d > 0; d--) if ($p.node(d).type.name === 'tableRow') return !!$p.node(d).attrs.noSplit;
  return false;
}

/** Rândurile alese nu se rup (sau se pot rupe din nou) între pagini, dintr-un singur pas de anulare. */
export const setRowNoSplit = (on: boolean): Cmd => (state, dispatch) => {
  const rows = selectedRows(state);
  if (!rows.length) return false;
  if (dispatch) {
    const tr = state.tr;
    for (const r of rows) if (!!r.attrs.noSplit !== on) tr.setNodeMarkup(r.pos, undefined, { ...r.attrs, noSplit: on });
    dispatch(tr);
  }
  return true;
};
