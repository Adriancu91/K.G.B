// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul ▦ din Docs: grila de rânduri × coloane (ca în Word), dimensiuni scrise de mână și „Transformă textul în tabel”.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { convertTextToTable, GRID_COLS, GRID_ROWS, insertGridTable, MAX_COLS, MAX_ROWS, selectedLines } from './tableInsert';

export default function TablePicker({ editor, onDraw }: { editor: Editor; onDraw?(): void }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<[number, number]>([0, 0]);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [header, setHeader] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor.commands.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, editor]);

  const put = (r: number, c: number) => { insertGridTable(editor, r, c, header); setOpen(false); };
  const canConvert = open && !!selectedLines(editor);
  const [hr, hc] = hover;

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { setHover([0, 0]); setOpen(!open); }}
        title="Inserează tabel: alege rândurile și coloanele">▦</button>
      {open && (
        <div className="sym-pop table-pop" role="dialog" aria-label="Inserează tabel">
          <div className="sym-head">{hr ? `Tabel ${hc} × ${hr} (coloane × rânduri)` : 'Alege mărimea tabelului'}</div>
          <div className="table-grid" onMouseLeave={() => setHover([0, 0])} style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 16px)` }}>
            {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
              const r = Math.floor(i / GRID_COLS) + 1, c = (i % GRID_COLS) + 1;
              return (
                <button key={i} className={`table-cell-pick ${r <= hr && c <= hc ? 'on' : ''}`} aria-label={`${c} × ${r}`}
                  onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setHover([r, c])} onClick={() => put(r, c)} />
              );
            })}
          </div>
          <div className="table-size">
            <label>Coloane <input type="number" min={1} max={MAX_COLS} value={cols} onChange={(e) => setCols(Number(e.target.value))} aria-label="Coloane" /></label>
            <label>Rânduri <input type="number" min={1} max={MAX_ROWS} value={rows} onChange={(e) => setRows(Number(e.target.value))} aria-label="Rânduri" /></label>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => put(rows, cols)}>Inserează</button>
          </div>
          <label className="table-head-opt"><input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} /> Primul rând e antet</label>
          <button className="table-convert" disabled={!canConvert} onMouseDown={(e) => e.preventDefault()}
            onClick={() => { if (convertTextToTable(editor, header)) setOpen(false); }}
            title={canConvert ? 'Fiecare rând selectat devine un rând de tabel; coloanele se despart la Tab, „;” sau „,”' : 'Selectează întâi câteva rânduri de text'}>
            Transformă textul selectat în tabel
          </button>
          {onDraw && (
            <button className="table-convert" onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen(false); onDraw(); }}
              title="Desenare tabel: trage cu mausul un dreptunghi ca să faci un tabel, apoi linii în el (orizontală = rând nou, verticală = coloană nouă); Esc iese">
              ✎ Desenare tabel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
