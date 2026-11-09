// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Bordurile puse pe celulele alese (ca Borders ▾ pe selecție și Border Painter din Word): fiecare latură a celulei
// (sus, dreapta, jos, stânga) poate avea linia ei (fel + culoare) sau „fără linie”; restul rămân după liniile tabelului (tableLines.ts).
// Pe ecran: atributul data-cl pe <td>/<th>, cu stilul border-* pus direct; în .docx: w:tcBorders; în .odt: fo:border-* pe celulă.
import { Extension } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { selectedRect } from '@tiptap/pm/tables';

export type PenStyle = 'single' | 'thick' | 'double' | 'dashed' | 'dotted';
export type CellSide = 't' | 'r' | 'b' | 'l';
export type BorderKind = 'bottom' | 'top' | 'left' | 'right' | 'none' | 'all' | 'outer' | 'inner' | 'insideH' | 'insideV';
export interface Pen { style: PenStyle; color: string }

export const PEN_STYLES: [PenStyle, string][] = [['single', 'Subțire'], ['thick', 'Groasă'], ['double', 'Dublă'], ['dashed', 'Întreruptă'], ['dotted', 'Punctată']];
export const BORDER_KINDS: [BorderKind, string][] = [
  ['bottom', 'Bordură jos'], ['top', 'Bordură sus'], ['left', 'Bordură stânga'], ['right', 'Bordură dreapta'],
  ['none', 'Fără bordură'], ['all', 'Toate bordurile'], ['outer', 'Borduri exterioare'], ['inner', 'Borduri interioare'],
  ['insideH', 'Bordură orizontală interioară'], ['insideV', 'Bordură verticală interioară'],
];
const SIDES: CellSide[] = ['t', 'r', 'b', 'l'];
const CSS_SIDE: Record<CellSide, string> = { t: 'top', r: 'right', b: 'bottom', l: 'left' };

/** O latură: '' = după tabel, 'none' = fără linie, altfel „fel #culoare”. */
function cleanSide(v: string | undefined): string {
  const s = (v ?? '').trim().toLowerCase();
  if (s === 'none') return 'none';
  const m = /^(single|thick|double|dashed|dotted) (#[0-9a-f]{6})$/.exec(s);
  return m ? `${m[1]} ${m[2]}` : '';
}

/** Cele patru laturi (sus, dreapta, jos, stânga) din valoarea atributului. */
export function parseLines(v: unknown): Record<CellSide, string> {
  const p = typeof v === 'string' ? v.split('|') : [];
  return { t: cleanSide(p[0]), r: cleanSide(p[1]), b: cleanSide(p[2]), l: cleanSide(p[3]) };
}

/** Valoarea atributului (sau null când nicio latură nu e aleasă). */
export function joinLines(s: Record<CellSide, string>): string | null {
  const v = SIDES.map((k) => cleanSide(s[k]));
  return v.some(Boolean) ? v.join('|') : null;
}

export const cleanLines = (v: unknown): string | null => joinLines(parseLines(v));

/** Linia ca CSS (lățime, fel, culoare); „fără linie” e hidden, ca să bată și latura vecinei. */
export function cssLine(side: string): string {
  if (side === 'none') return 'hidden';
  const [st, c] = side.split(' ');
  return st === 'thick' ? `2px solid ${c}` : st === 'double' ? `3px double ${c}` : st === 'dashed' ? `1px dashed ${c}` : st === 'dotted' ? `1px dotted ${c}` : `1px solid ${c}`;
}

export function cssOf(v: unknown): string {
  const s = parseLines(v);
  return SIDES.filter((k) => s[k]).map((k) => `border-${CSS_SIDE[k]}: ${cssLine(s[k])}`).join('; ');
}

export const CellLines = Extension.create({
  name: 'cellLines',
  addGlobalAttributes() {
    return [{
      types: ['tableCell', 'tableHeader'],
      attributes: {
        cellLines: {
          default: null,
          parseHTML: (el) => cleanLines(el.getAttribute('data-cl')),
          renderHTML: (a) => (a.cellLines ? { 'data-cl': a.cellLines, style: cssOf(a.cellLines) } : {}),
        },
      },
    }];
  },
});

const penValue = (pen: Pen) => `${pen.style} ${/^#[0-9a-f]{6}$/i.test(pen.color) ? pen.color.toLowerCase() : '#000000'}`;

/** Ce laturi ale unei celule primește felul de bordură ales, după locul ei în zona aleasă. */
export function sidesFor(kind: BorderKind, edge: Record<CellSide, boolean>): CellSide[] {
  switch (kind) {
    case 'all': case 'none': return SIDES;
    case 'outer': return SIDES.filter((k) => edge[k]);
    case 'inner': return SIDES.filter((k) => !edge[k]);
    case 'insideH': return (['t', 'b'] as CellSide[]).filter((k) => !edge[k]);
    case 'insideV': return (['l', 'r'] as CellSide[]).filter((k) => !edge[k]);
    case 'top': return edge.t ? ['t'] : [];
    case 'bottom': return edge.b ? ['b'] : [];
    case 'left': return edge.l ? ['l'] : [];
    case 'right': return edge.r ? ['r'] : [];
  }
}

/** Pune bordura aleasă pe celulele alese (sau pe celula cu cursorul). */
export function applyCellBorders(kind: BorderKind, pen: Pen) {
  return (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
    let rect;
    try { rect = selectedRect(state); } catch { return false; }
    if (!dispatch) return true;
    const { map, tableStart, table } = rect;
    const tr = state.tr;
    const line = kind === 'none' ? 'none' : penValue(pen);
    for (const rel of map.cellsInRect(rect)) {
      const cell = table.nodeAt(rel);
      if (!cell) continue;
      const c = map.findCell(rel);
      const edge = { t: c.top === rect.top, b: c.bottom === rect.bottom, l: c.left === rect.left, r: c.right === rect.right };
      const sides = sidesFor(kind, edge);
      if (!sides.length) continue;
      const s = parseLines(cell.attrs.cellLines);
      for (const k of sides) s[k] = line;
      tr.setNodeMarkup(tableStart + rel, undefined, { ...cell.attrs, cellLines: joinLines(s) });
    }
    dispatch(tr);
    return true;
  };
}

/** Pensula pentru borduri: latura celulei pe care s-a dat clic (aproape de margine), altfel toate cele patru. */
export function sideAt(r: { left: number; right: number; top: number; bottom: number }, x: number, y: number, near = 7): CellSide | null {
  const d: [CellSide, number][] = [['t', y - r.top], ['b', r.bottom - y], ['l', x - r.left], ['r', r.right - x]];
  d.sort((a, b) => a[1] - b[1]);
  return d[0][1] <= near ? d[0][0] : null;
}

export function paintCell(view: EditorView, cellDom: HTMLElement, side: CellSide | null, pen: Pen): boolean {
  let pos: number;
  try { pos = view.posAtDOM(cellDom, 0); } catch { return false; }
  const $p = view.state.doc.resolve(pos);
  for (let d = $p.depth; d > 0; d--) {
    const n = $p.node(d);
    if (n.type.name !== 'tableCell' && n.type.name !== 'tableHeader') continue;
    const s = parseLines(n.attrs.cellLines);
    for (const k of side ? [side] : SIDES) s[k] = penValue(pen);
    view.dispatch(view.state.tr.setNodeMarkup($p.before(d), undefined, { ...n.attrs, cellLines: joinLines(s) }));
    return true;
  }
  return false;
}

interface DocxLib { BorderStyle: Record<string, string> }
/** w:tcBorders pentru biblioteca docx (sau undefined când celula n-are laturi alese). */
export function docxCellBorders(lib: DocxLib, v: unknown) {
  const s = parseLines(v);
  if (!SIDES.some((k) => s[k])) return undefined;
  const one = (side: string) => {
    if (side === 'none') return { style: lib.BorderStyle.NIL, size: 0, color: 'auto' };
    const [st, c] = side.split(' ');
    return {
      style: st === 'double' ? lib.BorderStyle.DOUBLE : st === 'dashed' ? lib.BorderStyle.DASHED : st === 'dotted' ? lib.BorderStyle.DOTTED : lib.BorderStyle.SINGLE,
      size: st === 'thick' ? 12 : 4,
      color: c.slice(1).toUpperCase(),
    };
  };
  const out: Record<string, unknown> = {};
  if (s.t) out.top = one(s.t);
  if (s.b) out.bottom = one(s.b);
  if (s.l) out.left = one(s.l);
  if (s.r) out.right = one(s.r);
  return out;
}

/** Latura în .odt (fo:border-*), sau null când rămâne după tabel. */
export function odtSide(side: string): string | null {
  if (!side) return null;
  if (side === 'none') return 'none';
  const [st, c] = side.split(' ');
  return st === 'double' ? `1.1pt double ${c}` : st === 'thick' ? `1.5pt solid ${c}` : st === 'dashed' ? `0.5pt dashed ${c}` : st === 'dotted' ? `0.5pt dotted ${c}` : `0.5pt solid ${c}`;
}

/** Laturile din w:tcBorders (la deschiderea unui .docx), în aceeași formă ca atributul; null dacă nu e nimic de păstrat. */
export function linesFromTcBorders(xml: string): string | null {
  const side = (names: string[]) => {
    for (const n of names) {
      const tag = new RegExp(`<w:${n}\\b[^>]*>`).exec(xml)?.[0];
      if (!tag) continue;
      const val = /w:val="([^"]*)"/.exec(tag)?.[1] ?? 'single';
      if (val === 'none' || val === 'nil') return 'none';
      const sz = Number(/w:sz="(\d+)"/.exec(tag)?.[1] ?? 4);
      const col = /w:color="([0-9A-Fa-f]{6})"/.exec(tag)?.[1];
      const st = /double/i.test(val) ? 'double' : /dash/i.test(val) ? 'dashed' : /dot/i.test(val) ? 'dotted' : sz >= 12 ? 'thick' : 'single';
      return `${st} #${(col ?? '000000').toLowerCase()}`;
    }
    return '';
  };
  return joinLines({ t: side(['top']), r: side(['right', 'end']), b: side(['bottom']), l: side(['left', 'start']) });
}

