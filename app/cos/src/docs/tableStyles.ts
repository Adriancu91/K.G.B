// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Stilurile de tabel (ca galeria „Table Styles” și „Table Style Options” din editoarele de text): un set de culori pentru
// rândul de antet, rândurile alternante, prima coloană și rândul de total. Stilul se scrie ca fundal pe celule (deci ajunge
// la fel în .docx, .odt, PDF și la tipărire), iar tabelul ține minte stilul și opțiunile, ca bifele să-l refacă.
import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { tableAt } from './tableOps';

type Cmd = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean;

export interface TableStyle { id: string; name: string; head: string; band: string; first: string; total: string }
/** Culori deschise (textul rămâne negru și se citește bine, și tipărit alb-negru). */
export const TABLE_STYLES: TableStyle[] = [
  { id: 'gri', name: 'Gri', head: '#d1d5db', band: '#f3f4f6', first: '#e5e7eb', total: '#d1d5db' },
  { id: 'albastru', name: 'Albastru', head: '#bfdbfe', band: '#eff6ff', first: '#dbeafe', total: '#bfdbfe' },
  { id: 'verde', name: 'Verde', head: '#bbf7d0', band: '#f0fdf4', first: '#dcfce7', total: '#bbf7d0' },
  { id: 'portocaliu', name: 'Portocaliu', head: '#fed7aa', band: '#fff7ed', first: '#ffedd5', total: '#fed7aa' },
  { id: 'rosu', name: 'Roșu', head: '#fecaca', band: '#fef2f2', first: '#fee2e2', total: '#fecaca' },
  { id: 'mov', name: 'Mov', head: '#ddd6fe', band: '#f5f3ff', first: '#ede9fe', total: '#ddd6fe' },
  { id: 'turcoaz', name: 'Turcoaz', head: '#a5f3fc', band: '#ecfeff', first: '#cffafe', total: '#a5f3fc' },
  { id: 'galben', name: 'Galben', head: '#fde68a', band: '#fefce8', first: '#fef9c3', total: '#fde68a' },
];

/** Opțiunile stilului: rând de antet, rânduri alternante, prima coloană, rând de total, ultima coloană, coloane alternante. */
export interface TableOpts { head: boolean; band: boolean; first: boolean; total: boolean; last?: boolean; bandCol?: boolean }
export const DEFAULT_OPTS: TableOpts = { head: true, band: true, first: false, total: false };
export const optsText = (o: TableOpts) => (o.head ? 'h' : '') + (o.band ? 'b' : '') + (o.first ? 'f' : '') + (o.total ? 't' : '') + (o.last ? 'l' : '') + (o.bandCol ? 'c' : '');
export const parseOpts = (s: unknown): TableOpts => (typeof s === 'string'
  ? { head: s.includes('h'), band: s.includes('b'), first: s.includes('f'), total: s.includes('t'), last: s.includes('l'), bandCol: s.includes('c') }
  : DEFAULT_OPTS);

export const TableLook = Extension.create({
  name: 'tableLook',
  addGlobalAttributes() {
    return [{
      types: ['table'],
      attributes: {
        tableStyle: {
          default: null,
          parseHTML: (el) => { const v = el.getAttribute('data-tstyle'); return TABLE_STYLES.some((s) => s.id === v) ? v : null; },
          renderHTML: (a) => (a.tableStyle ? { 'data-tstyle': a.tableStyle } : {}),
        },
        tableOpts: {
          default: null,
          parseHTML: (el) => { const v = el.getAttribute('data-topts'); return v !== null && /^h?b?f?t?l?c?$/.test(v) ? v : null; },
          renderHTML: (a) => (a.tableOpts !== null && a.tableOpts !== undefined ? { 'data-topts': a.tableOpts } : {}),
        },
      },
    }];
  },
});

/** Culoarea unei celule după stil și opțiuni (rândul de antet și cel de total au întâietate, apoi prima / ultima coloană, apoi benzile).
 *  `cols` = câte coloane are tabelul (pentru ultima coloană); `span` = câte coloane acoperă celula (o celulă unită până la capăt e și ea „ultima”). */
export function cellColor(st: TableStyle | null, o: TableOpts, row: number, col: number, rows: number, cols = 0, span = 1): string | null {
  if (!st) return null;
  if (o.head && row === 0) return st.head;
  if (o.total && row === rows - 1 && rows > 1) return st.total;
  if (o.first && col === 0) return st.first;
  if (o.last && cols > 1 && col + span >= cols) return st.first;
  const r = row - (o.head ? 1 : 0);
  if (o.band && r % 2 === 1) return st.band;
  const c = col - (o.first ? 1 : 0);
  if (o.bandCol && c % 2 === 1) return st.band;
  return null;
}

/**
 * Pune stilul pe tabelul cu cursorul (id null = fără stil: fundalurile se scot). Rândul de antet devine și antet adevărat
 * (celule de antet, care se repetă la tipărire și sunt citite ca atare), iar fără antet revine la celule obișnuite.
 */
export function applyTableStyle(id: string | null, opts: TableOpts): Cmd {
  return (state, dispatch) => {
    const w = tableAt(state);
    if (!w) return false;
    if (!dispatch) return true;
    const st = id ? TABLE_STYLES.find((s) => s.id === id) ?? null : null;
    const { tableHeader, tableCell } = state.schema.nodes;
    const tr = state.tr;
    const rows = w.table.childCount;
    let cols = 0;
    w.table.firstChild?.forEach((c: PMNode) => { cols += c.attrs.colspan ?? 1; });
    let pos = w.pos + 1;
    w.table.forEach((row: PMNode, _o, ri) => {
      let cpos = pos + 1;
      let col = 0;
      row.forEach((cell: PMNode) => {
        const bg = cellColor(st, opts, ri, col, rows, cols, cell.attrs.colspan ?? 1);
        // Antetul: primul rând devine antet când e bifat; la scoaterea bifei, celulele de antet ale primului rând revin la obișnuite.
        let type = cell.type;
        if (st && ri === 0) type = opts.head ? tableHeader : cell.type === tableHeader ? tableCell : cell.type;
        if (bg !== (cell.attrs.backgroundColor ?? null) || type !== cell.type) tr.setNodeMarkup(cpos, type, { ...cell.attrs, backgroundColor: bg });
        cpos += cell.nodeSize;
        col += cell.attrs.colspan ?? 1;
      });
      pos += row.nodeSize;
    });
    tr.setNodeMarkup(w.pos, undefined, { ...w.table.attrs, tableStyle: st ? st.id : null, tableOpts: st ? optsText(opts) : null });
    dispatch(tr.scrollIntoView());
    return true;
  };
}
