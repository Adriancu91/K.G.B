// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Date → Editare legături: registrele externe din formule ([Buget.xlsx]Foaie1!A1), cu valorile păstrate în tabel.
// Pentru fiecare: Actualizează valorile (recitește fișierul), Schimbă sursa… (alt fișier, formulele trec pe el) și
// Rupe legătura (formulele spre fișier devin valorile lor de acum); Deschide sursa îl deschide într-un tab nou.
import { useState } from 'react';
import type { ExtBook } from './formula';

export interface LinkRow { link: ExtBook; uses: number; msg?: string }

export function LinksDialog({ rows, busy, onUpdate, onUpdateAll, onChange, onOpen, onBreak, onClose }: {
  rows: LinkRow[];
  busy: boolean;
  onUpdate(i: number): void;
  onUpdateAll(): void;
  onChange(i: number): void;
  onOpen(i: number): void;
  onBreak(i: number): void;
  onClose(): void;
}) {
  const [sel, setSel] = useState(0);
  const [sure, setSure] = useState(false);
  const cur = rows[Math.min(sel, rows.length - 1)];
  const at = Math.min(sel, rows.length - 1);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg links-dlg" role="dialog" aria-label="Editare legături" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Editare legături</h3>
        {!rows.length ? <p className="print-info">Registrul nu are formule care iau valori din alte fișiere.</p> : <>
          <p className="print-info">Formulele de mai jos iau valori din alte fișiere. Valorile lor sunt păstrate în tabel (de la ultima citire),
            deci formulele merg și fără fișier; „Actualizează valorile” le citește din nou.</p>
          <table className="links-table">
            <thead><tr><th>Fișierul</th><th>Unde este</th><th>Formule</th><th>Stare</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.link.name} className={i === at ? 'sel' : ''} onClick={() => { setSel(i); setSure(false); }} aria-selected={i === at}>
                  <td>{r.link.name}</td>
                  <td className="links-path" title={r.link.path ?? ''}>{r.link.path || 'lângă acest registru'}</td>
                  <td>{r.uses}</td>
                  <td>{r.msg ?? (r.link.sheets.some((s) => Object.keys(s.cells).length) ? 'Valori păstrate' : 'Fără valori')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sure && cur ? (
            <p className="print-info links-warn">Formulele spre „{cur.link.name}” ({cur.uses}) devin valorile lor de acum, iar legătura dispare.
              Se poate anula cu Ctrl+Z.</p>
          ) : null}
        </>}
        <div className="print-actions">
          {cur && !sure && <>
            <button disabled={busy} onClick={() => onUpdate(at)} title="Citește din nou valorile din fișier (de pe disc) și recalculează formulele">↻ Actualizează valorile</button>
            {rows.length > 1 && <button disabled={busy} onClick={onUpdateAll} title="Citește din nou toate fișierele legate">Actualizează tot</button>}
            <button disabled={busy} onClick={() => onOpen(at)} title="Deschide fișierul legat într-un tab nou">Deschide sursa</button>
            <button disabled={busy} onClick={() => onChange(at)} title="Alege alt fișier: formulele vor lua valorile din el">Schimbă sursa…</button>
            <button disabled={busy} onClick={() => setSure(true)} title="Formulele spre acest fișier devin valori">Rupe legătura</button>
          </>}
          {cur && sure && <>
            <button onClick={() => setSure(false)}>Renunță</button>
            <button className="primary" onClick={() => { setSure(false); setSel(0); onBreak(at); }}>Rupe legătura</button>
          </>}
          {!sure && <button className="primary" onClick={onClose}>Închide</button>}
        </div>
      </div>
    </div>
  );
}
