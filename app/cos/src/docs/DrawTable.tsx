// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Inserare › Tabele › ✎ Desenare tabel: creionul de tabel. Un dreptunghi tras pe pagină devine un tabel cu o celulă,
// cât lățimea trasă; o linie trasă într-un tabel îl împarte: orizontală = rând nou sub rândul ei, verticală = coloană nouă
// după coloana ei. Cu ⌫ Radieră (sau ținând Shift), un clic pe linia dintre două celule le unește. Esc sau ✓ Gata iese.
// O linie împarte doar celula atinsă: rândul / coloana nouă se unește la loc cu vecinele, în celelalte celule.
import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { CellSelection, TableMap } from '@tiptap/pm/tables';

/** Latura celulei cea mai apropiată de punct: linia pe care o șterge radiera. */
export function nearestSide(r: { left: number; top: number; right: number; bottom: number }, x: number, y: number): 'left' | 'top' | 'right' | 'bottom' {
  const d = { right: r.right - x, bottom: r.bottom - y, left: x - r.left, top: y - r.top };
  return (Object.keys(d) as (keyof typeof d)[]).reduce((a, b) => (d[b] < d[a] ? b : a));
}

/** Ce face o tragere: nimic (prea scurtă), tabel nou, rând nou sau coloană nouă. */
export function drawKind(inCell: boolean, dx: number, dy: number): 'table' | 'row' | 'col' | null {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (inCell) return ax >= 15 && ax > ay * 2 ? 'row' : ay >= 15 && ay > ax * 2 ? 'col' : null;
  return ax >= 30 && ay >= 12 ? 'table' : null;
}

export default function DrawTable({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const [erase, setErase] = useState(false);
  useEffect(() => {
    const dom = editor.view.dom as HTMLElement;
    const root = dom.closest('.editor');
    root?.classList.add('docs-drawtable');
    root?.classList.toggle('docs-drawtable-erase', erase);
    let start: { x: number; y: number; cell: HTMLElement | null; erase: boolean } | null = null;
    let ghost: HTMLDivElement | null = null;

    // Poziția din document a celulei (td / th) de pe ecran.
    const cellPos = (el: HTMLElement) => {
      const $p = editor.state.doc.resolve(editor.view.posAtDOM(el, 0));
      for (let d = $p.depth; d > 0; d--) if (/^table(Cell|Header)$/.test($p.node(d).type.name)) return $p.before(d);
      return -1;
    };
    // Radiera: linia cea mai apropiată de clic dispare, adică celula se unește cu vecina de dincolo de linie.
    const eraseAt = (x: number, y: number) => {
      const cell = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('td, th') as HTMLElement | null;
      if (!cell || !dom.contains(cell)) return;
      const r = cell.getBoundingClientRect();
      const side = nearestSide(r, x, y);
      const [ox, oy] = side === 'right' ? [r.right + 4, y] : side === 'left' ? [r.left - 4, y] : side === 'bottom' ? [x, r.bottom + 4] : [x, r.top - 4];
      const other = (document.elementFromPoint(ox, oy) as HTMLElement | null)?.closest('td, th') as HTMLElement | null;
      if (!other || other === cell || other.closest('table') !== cell.closest('table')) return;
      const a = cellPos(cell), b = cellPos(other);
      if (a < 0 || b < 0) return;
      const { state, dispatch } = editor.view;
      dispatch(state.tr.setSelection(CellSelection.create(state.doc, a, b)));
      editor.chain().focus().mergeCells().run();
    };
    // Linia din celulă: rând / coloană nouă după celula atinsă, apoi, în afara ei, fiecare celulă nouă se unește
    // cu vecina dinainte, ca restul tabelului să arate ca înainte.
    const splitOnly = (el: HTMLElement, k: 'row' | 'col') => {
      const pos = cellPos(el);
      if (pos < 0) return;
      const $c = editor.state.doc.resolve(pos);
      let d = $c.depth;
      while (d > 0 && $c.node(d).type.name !== 'table') d--;
      if (!d) return;
      const tablePos = $c.before(d), start = $c.start(d);
      const rect = TableMap.get($c.node(d)).findCell(pos - start);
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(pos + 1))));
      // Celula unită pe direcția liniei se desface la loc în celulele ei.
      if (k === 'col' ? rect.right - rect.left > 1 : rect.bottom - rect.top > 1) { editor.chain().focus().splitCell().run(); return; }
      if (k === 'row') editor.chain().focus().addRowAfter().run(); else editor.chain().focus().addColumnAfter().run();
      for (let i = 0; ; i++) {
        const table = editor.state.doc.nodeAt(tablePos);
        if (!table) return;
        const map = TableMap.get(table);
        const n = k === 'row' ? map.width : map.height;
        if (i >= n) break;
        if (k === 'row' ? i >= rect.left && i < rect.right : i >= rect.top && i < rect.bottom) continue;
        const a = k === 'row' ? map.map[(rect.bottom - 1) * map.width + i] : map.map[i * map.width + rect.right - 1];
        const b = k === 'row' ? map.map[rect.bottom * map.width + i] : map.map[i * map.width + rect.right];
        if (a === undefined || b === undefined || a === b) continue;
        const st = editor.state;
        editor.view.dispatch(st.tr.setSelection(CellSelection.create(st.doc, start + a, start + b)));
        editor.commands.mergeCells();
      }
      const st = editor.state;
      const inNew = TableMap.get(st.doc.nodeAt(tablePos)!);
      const nc = k === 'row' ? inNew.map[rect.bottom * inNew.width + rect.left] : inNew.map[rect.top * inNew.width + rect.right];
      if (nc !== undefined) editor.view.dispatch(st.tr.setSelection(TextSelection.near(st.doc.resolve(start + nc + 1))));
    };
    const show = (x: number, y: number) => {
      if (!start || start.erase) return;
      if (!ghost) { ghost = document.createElement('div'); ghost.className = 'docs-drawtable-ghost'; document.body.appendChild(ghost); }
      const dx = x - start.x, dy = y - start.y;
      const k = drawKind(!!start.cell, dx, dy);
      let l = Math.min(x, start.x), t = Math.min(y, start.y), w = Math.abs(dx), h = Math.abs(dy);
      if (start.cell) {
        // În tabel: doar linia dreaptă, pe toată lățimea / înălțimea celulei.
        const r = start.cell.getBoundingClientRect();
        if (k === 'row') { l = r.left; w = r.width; t = y; h = 0; }
        else if (k === 'col') { t = r.top; h = r.height; l = x; w = 0; }
        else { w = 0; h = 0; }
      }
      Object.assign(ghost.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
    };
    const finish = (x: number, y: number) => {
      const s = start;
      start = null;
      ghost?.remove(); ghost = null;
      if (!s) return;
      if (s.erase) { eraseAt(s.x, s.y); return; }
      const k = drawKind(!!s.cell, x - s.x, y - s.y);
      if (!k) return;
      const at = editor.view.posAtCoords({ left: s.x, top: s.y });
      if (!at) return;
      const { state, dispatch } = editor.view;
      dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(at.pos))));
      if (k === 'row' || k === 'col') { splitOnly(s.cell!, k); return; }
      // Tabel nou: o celulă, cât lățimea trasă (cel mult lățimea paginii).
      const w = Math.round(Math.min(Math.abs(x - s.x) / (editor.view.dom.getBoundingClientRect().width / editor.view.dom.clientWidth || 1), editor.view.dom.clientWidth));
      editor.chain().focus().insertTable({ rows: 1, cols: 1, withHeaderRow: false }).run();
      if (editor.isActive('table')) editor.chain().setCellAttribute('colwidth', [Math.max(40, w)]).run();
    };
    const down = (e: MouseEvent) => {
      if (e.button !== 0 || !dom.contains(e.target as Node)) return;
      e.preventDefault(); e.stopPropagation();
      const cell = (e.target as HTMLElement).closest('td, th') as HTMLElement | null;
      start = { x: e.clientX, y: e.clientY, cell: cell && dom.contains(cell) ? cell : null, erase: erase || e.shiftKey };
    };
    const move = (e: MouseEvent) => { if (start) { e.preventDefault(); show(e.clientX, e.clientY); } };
    const up = (e: MouseEvent) => { if (start) { e.preventDefault(); finish(e.clientX, e.clientY); } };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } };
    dom.addEventListener('mousedown', down, true);
    window.addEventListener('mousemove', move, true);
    window.addEventListener('mouseup', up, true);
    window.addEventListener('keydown', key, true);
    return () => {
      root?.classList.remove('docs-drawtable', 'docs-drawtable-erase');
      ghost?.remove();
      dom.removeEventListener('mousedown', down, true);
      window.removeEventListener('mousemove', move, true);
      window.removeEventListener('mouseup', up, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [editor, onClose, erase]);

  return (
    <div className="docs-drawtable-bar" role="status">
      <span>{erase ? '⌫ Radieră: clic pe linia dintre două celule ca să le unești.' : '✎ Desenare tabel: trage un dreptunghi ca să faci un tabel; în tabel, o linie orizontală sau verticală împarte celula atinsă. Shift + clic pe o linie o șterge.'}</span>
      <button onMouseDown={(e) => e.preventDefault()} onClick={() => setErase(!erase)} aria-pressed={erase} className={erase ? 'on' : undefined} title="Radieră: clic pe linia dintre două celule le unește (sau ține apăsat Shift)">⌫ Radieră</button>
      <button onMouseDown={(e) => e.preventDefault()} onClick={onClose} title="Ieși din desenarea tabelului (Esc)">✓ Gata</button>
    </div>
  );
}
