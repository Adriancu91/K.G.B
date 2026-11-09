// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Operații pe tabelul în care e cursorul (ca Sort / Split Table / Convert to Text din Word):
// sortarea rândurilor după coloana curentă, împărțirea tabelului în două și transformarea lui în text cu tab-uri.
// Sunt comenzi ProseMirror obișnuite (state, dispatch), deci Ctrl+Z le anulează dintr-un pas.
import { Fragment, type Node as PMNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { CellSelection, TableMap } from '@tiptap/pm/tables';

type Cmd = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean;

interface Where { table: PMNode; pos: number; row: number; col: number }

/** Tabelul în care e cursorul, rândul și coloana celulei curente. */
export function tableAt(state: EditorState): Where | null {
  const $p = state.selection.$from;
  let cellDepth = -1;
  for (let d = $p.depth; d > 0; d--) {
    const n = $p.node(d);
    if (cellDepth < 0 && (n.type.name === 'tableCell' || n.type.name === 'tableHeader')) cellDepth = d;
    if (n.type.name === 'table') {
      if (cellDepth < 0) return null;
      const start = $p.start(d);
      const rect = TableMap.get(n).findCell($p.before(cellDepth) - start);
      return { table: n, pos: $p.before(d), row: rect.top, col: rect.left };
    }
  }
  return null;
}

const isHeaderRow = (r: PMNode) => r.childCount > 0 && Array.from({ length: r.childCount }, (_, i) => r.child(i)).every((c) => c.type.name === 'tableHeader');
/** Rândurile cu celule care coboară peste alte rânduri (rowspan) nu se pot muta sau tăia fără să strice tabelul. */
const hasRowspan = (t: PMNode) => { let any = false; t.descendants((n) => { if ((n.attrs.rowspan ?? 1) > 1) any = true; return !any && n.type.name !== 'paragraph'; }); return any; };

/** Textul celulei din coloana `col` a rândului (ține cont de celulele unite pe orizontală). */
function cellText(row: PMNode, col: number): string {
  let c = 0;
  for (let i = 0; i < row.childCount; i++) {
    const cell = row.child(i), span = cell.attrs.colspan ?? 1;
    if (col < c + span) return cell.textContent.trim();
    c += span;
  }
  return '';
}

/** Număr scris ca la noi („1.250,50”, „-3,5”, „12 %”) sau ca în engleză („1250.5”); altfel null. */
export function sortNumber(t: string): number | null {
  const s = t.replace(/[\s ]|lei|ron|%|€|\$/gi, '');
  if (!/^[-+]?[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  let v = s;
  // Virgula e cea zecimală (1.250,50 / 3,5); punctele dintr-un număr ca 1.250 sau 2.000.000 despart miile.
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  else if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Data scrisă ca la noi (19.10.2026, 19/10/2026) → număr pentru comparare; altfel null. */
function sortDate(t: string): number | null {
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(t.trim());
  return m ? +m[3] * 10000 + +m[2] * 100 + +m[1] : null;
}

/** Compară două texte de celulă: numerele ca numere, datele ca date, restul alfabetic (cu ă, â, î, ș, ț); celulele goale la final. */
export function compareCells(a: string, b: string): number {
  if (!a || !b) return a ? -1 : b ? 1 : 0;
  const na = sortNumber(a), nb = sortNumber(b);
  if (na !== null && nb !== null) return na - nb;
  const da = sortDate(a), db = sortDate(b);
  if (da !== null && db !== null) return da - db;
  return a.localeCompare(b, 'ro', { numeric: true, sensitivity: 'base' });
}

/** Sortează rândurile tabelului după coloana cursorului (1 = A→Z / crescător, -1 = Z→A / descrescător).
 *  Rândurile de antet (cu celule de antet) rămân sus; `keepFirst` ține sus și primul rând, dacă tabelul n-are antet. */
export const sortTable = (dir: 1 | -1, keepFirst = false): Cmd => (state, dispatch) => {
  const w = tableAt(state);
  if (!w || hasRowspan(w.table)) return false;
  const rows = Array.from({ length: w.table.childCount }, (_, i) => w.table.child(i));
  let head = 0;
  while (head < rows.length && isHeaderRow(rows[head])) head++;
  if (keepFirst && head === 0) head = 1;
  const body = rows.slice(head);
  if (body.length < 2) return false;
  // Sortare stabilă: rândurile egale își păstrează ordinea.
  const sorted = body.map((r, i) => ({ r, i, t: cellText(r, w.col) }))
    .sort((x, y) => { const c = compareCells(x.t, y.t); return (x.t && y.t ? c * dir : c) || x.i - y.i; })
    .map((x) => x.r);
  if (dispatch) {
    const table = w.table.type.create(w.table.attrs, Fragment.from([...rows.slice(0, head), ...sorted]), w.table.marks);
    dispatch(state.tr.replaceWith(w.pos, w.pos + w.table.nodeSize, table).scrollIntoView());
  }
  return true;
};

/** Împarte tabelul în două, deasupra rândului cu cursorul; între ele rămâne un paragraf gol. */
export const splitTable: Cmd = (state, dispatch) => {
  const w = tableAt(state);
  if (!w || w.row === 0 || hasRowspan(w.table)) return false;
  const rows = Array.from({ length: w.table.childCount }, (_, i) => w.table.child(i));
  if (dispatch) {
    const { table } = w;
    const a = table.type.create(table.attrs, Fragment.from(rows.slice(0, w.row)), table.marks);
    const b = table.type.create(table.attrs, Fragment.from(rows.slice(w.row)), table.marks);
    const p = state.schema.nodes.paragraph.create();
    dispatch(state.tr.replaceWith(w.pos, w.pos + table.nodeSize, [a, p, b]).scrollIntoView());
  }
  return true;
};

/** Împarte celula cu cursorul în două coloane (`cols`) sau în două rânduri (`rows`), ca Split Cells din Word: celula nouă, goală,
 *  vine la dreapta / dedesubt, iar celulele din aceeași coloană / același rând se lățesc peste ea, ca tabelul să rămână drept.
 *  O celulă deja unită pe direcția aleasă nu se împarte (pentru ea e „desparte celulele”). */
export const splitCellInto = (dir: 'cols' | 'rows'): Cmd => (state, dispatch) => {
  const w = tableAt(state);
  if (!w) return false;
  const map = TableMap.get(w.table);
  const start = w.pos + 1;
  const targetRel = map.map[w.row * map.width + w.col];
  const target = w.table.nodeAt(targetRel);
  if (!target) return false;
  const rect = map.findCell(targetRel);
  if (dir === 'cols' ? rect.right - rect.left !== 1 : rect.bottom - rect.top !== 1) return false;
  if (!dispatch) return true;
  const tr = state.tr;
  const half = (v: number) => Math.max(20, Math.round(v / 2));
  // Celulele care trec prin coloana / rândul celulei (fiecare o dată), în afară de ea.
  const seen = new Set<number>([targetRel]);
  const n = dir === 'cols' ? map.height : map.width;
  for (let i = 0; i < n; i++) {
    const rel = dir === 'cols' ? map.map[i * map.width + rect.left] : map.map[rect.top * map.width + i];
    if (seen.has(rel)) continue;
    seen.add(rel);
    const cell = w.table.nodeAt(rel)!;
    if (dir === 'cols') {
      const cw: number[] | null = cell.attrs.colwidth;
      const at = rect.left - map.findCell(rel).left;
      const colwidth = cw && cw[at] ? [...cw.slice(0, at), half(cw[at]), half(cw[at]), ...cw.slice(at + 1)] : cw ? [...cw.slice(0, at + 1), 0, ...cw.slice(at + 1)] : null;
      tr.setNodeMarkup(start + rel, undefined, { ...cell.attrs, colspan: (cell.attrs.colspan ?? 1) + 1, colwidth });
    } else {
      tr.setNodeMarkup(start + rel, undefined, { ...cell.attrs, rowspan: (cell.attrs.rowspan ?? 1) + 1 });
    }
  }
  const tw: number[] | null = target.attrs.colwidth;
  if (dir === 'cols') {
    const colwidth = tw && tw[0] ? [half(tw[0])] : null;
    tr.setNodeMarkup(start + targetRel, undefined, { ...target.attrs, colwidth });
    const fresh = target.type.createAndFill({ ...target.attrs, colspan: 1, colwidth })!;
    tr.insert(start + targetRel + target.nodeSize, fresh);
  } else {
    const fresh = target.type.createAndFill({ ...target.attrs, rowspan: 1 })!;
    let rowEnd = start;
    for (let r = 0; r <= rect.top; r++) rowEnd += w.table.child(r).nodeSize;
    tr.insert(rowEnd, w.table.child(rect.top).type.create(null, fresh));
  }
  dispatch(tr.scrollIntoView());
  return true;
};

/** Transformă tabelul în text: un paragraf pe rând, cu celulele despărțite prin tab (formatul literelor rămâne). */
export const tableToText: Cmd = (state, dispatch) => {
  const w = tableAt(state);
  if (!w) return false;
  if (dispatch) {
    const { schema } = state;
    const paras: PMNode[] = [];
    w.table.forEach((row) => {
      const parts: PMNode[] = [];
      row.forEach((cell, _o, ci) => {
        if (ci > 0) parts.push(schema.text('\t'));
        let first = true;
        cell.descendants((n) => {
          if (!n.isTextblock) return true;
          if (!first && n.content.size) parts.push(schema.text(' '));
          if (n.content.size) { n.content.forEach((x) => { parts.push(x); }); first = false; }
          return false;
        });
      });
      paras.push(schema.nodes.paragraph.create(null, parts));
    });
    dispatch(state.tr.replaceWith(w.pos, w.pos + w.table.nodeSize, paras).scrollIntoView());
  }
  return true;
};

/** Selectează celula, rândul, coloana sau tot tabelul în care e cursorul (ca Select din Word), ca selecție de celule:
 *  apoi fundalul, ștergerea, înălțimea rândurilor sau formatul textului se aplică pe toată bucata. */
export const selectTablePart = (part: 'cell' | 'row' | 'col' | 'table'): Cmd => (state, dispatch) => {
  const w = tableAt(state);
  if (!w) return false;
  const map = TableMap.get(w.table);
  const start = w.pos + 1;
  const at = (r: number, c: number) => start + map.map[r * map.width + c];
  const [a, b] = part === 'cell' ? [at(w.row, w.col), at(w.row, w.col)]
    : part === 'row' ? [at(w.row, 0), at(w.row, map.width - 1)]
      : part === 'col' ? [at(0, w.col), at(map.height - 1, w.col)]
        : [at(0, 0), at(map.height - 1, map.width - 1)];
  if (dispatch) dispatch(state.tr.setSelection(CellSelection.create(state.doc, a, b)));
  return true;
};

/** Primul rând al tabelului e rând de antet (toate celulele lui sunt celule de antet)? */
export function hasHeaderRow(state: EditorState): boolean {
  const w = tableAt(state);
  return !!w && w.table.childCount > 0 && isHeaderRow(w.table.child(0));
}

/** Potrivirea automată a tabelului (ca AutoFit din Word): „content” = coloanele cât textul din ele, tabelul doar cât e nevoie;
 *  „window” = pe toată lățimea paginii, cu coloane egale. Lățimile trase cu mausul se șterg în ambele cazuri. */
export const setTableFit = (fit: 'content' | 'window'): Cmd => (state, dispatch) => {
  const w = tableAt(state);
  if (!w) return false;
  if (dispatch) {
    const tr = state.tr;
    tr.setNodeMarkup(w.pos, undefined, { ...w.table.attrs, fit: fit === 'content' ? 'content' : null });
    w.table.descendants((n, p) => {
      if (n.type.name !== 'tableCell' && n.type.name !== 'tableHeader') return true;
      if (n.attrs.colwidth) tr.setNodeMarkup(w.pos + 1 + p, undefined, { ...n.attrs, colwidth: null });
      return false;
    });
    dispatch(tr);
  }
  return true;
};

const PX_PER_CM = 96 / 2.54;

/** Lățimea coloanei cu cursorul (cm, cu o zecimală) sau null când e automată. */
export function columnWidthAt(state: EditorState): number | null {
  const w = tableAt(state);
  if (!w) return null;
  const map = TableMap.get(w.table);
  const rel = map.map[w.row * map.width + w.col];
  const rect = map.findCell(rel);
  const px = (w.table.nodeAt(rel)?.attrs.colwidth as number[] | null)?.[w.col - rect.left];
  return px ? Math.round((px / PX_PER_CM) * 10) / 10 : null;
}

/** Lățimea coloanei cu cursorul (cm; null = automată), pe toate celulele ei, dintr-un singur pas de anulare. */
export const setColumnWidth = (cm: number | null): Cmd => (state, dispatch) => {
  const w = tableAt(state);
  if (!w) return false;
  const px = cm && cm > 0 ? Math.round(Math.min(50, Math.max(0.3, cm)) * PX_PER_CM) : 0;
  if (dispatch) {
    const map = TableMap.get(w.table);
    const start = w.pos + 1;
    const tr = state.tr;
    const done = new Set<number>();
    for (let r = 0; r < map.height; r++) {
      const rel = map.map[r * map.width + w.col];
      if (done.has(rel)) continue;
      done.add(rel);
      const cell = w.table.nodeAt(rel);
      if (!cell) continue;
      const rect = map.findCell(rel);
      const span = cell.attrs.colspan ?? 1;
      const cw: number[] = Array.from({ length: span }, (_, i) => (cell.attrs.colwidth as number[] | null)?.[i] ?? 0);
      cw[w.col - rect.left] = px;
      tr.setNodeMarkup(start + rel, undefined, { ...cell.attrs, colwidth: cw.some((x) => x > 0) ? cw : null });
    }
    // Cu o lățime aleasă, tabelul nu mai e „potrivit conținutului”.
    if (px && w.table.attrs.fit === 'content') tr.setNodeMarkup(w.pos, undefined, { ...w.table.attrs, fit: null });
    dispatch(tr);
  }
  return true;
};
