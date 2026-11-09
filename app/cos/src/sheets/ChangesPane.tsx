// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Revizuire → 🕘 Afișare modificări: celulele schimbate (cele mai noi sus), pentru tot registrul, foaia de acum sau zona aleasă;
// clic pe una te duce la celula ei. Jurnalul vine din changes.ts și se ține în fișier.
import { useState } from 'react';
import { changesIn, type CellChange } from './changes';
import type { Range } from './fill';

type Scope = 'book' | 'sheet' | 'range';
const SHOW = 300;

const when = (t: number) => {
  const d = new Date(t), now = new Date();
  const hm = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === now.toDateString() ? `azi, ${hm}` : `${d.toLocaleDateString('ro-RO')}, ${hm}`;
};
const val = (s: string) => (s === '' ? '(gol)' : `„${s}”`);

export default function ChangesPane({ log, sheet, range, rangeText, onGo, onClear, onClose }: {
  log: CellChange[] | undefined; sheet: string; range: Range; rangeText: string;
  onGo(sheet: string, id: string): void; onClear(): void; onClose(): void;
}) {
  const [scope, setScope] = useState<Scope>('book');
  const list = changesIn(log, scope === 'book' ? null : sheet, scope === 'range' ? range : undefined);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg sl-a11y-dlg" role="dialog" aria-label="Afișare modificări" data-testid="changes-dlg"
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>🕘 Modificări</h3>
        <label className="print-row"><span className="print-label">Arată</span>
          <select aria-label="Arată modificările din" data-testid="changes-scope" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
            <option value="book">Tot registrul</option>
            <option value="sheet">{`Foaia ${sheet}`}</option>
            <option value="range">{`Zona aleasă (${rangeText})`}</option>
          </select>
        </label>
        <p className="print-info" data-testid="changes-count">{list.length
          ? `${list.length} ${list.length === 1 ? 'celulă schimbată' : 'celule schimbate'}, cele mai noi sus. Clic pe una te duce la ea.`
          : 'Nicio celulă schimbată aici de când se ține lista.'}</p>
        {list.length > 0 && (
          <ul className="sl-a11y-list" data-testid="changes-list">
            {list.slice(0, SHOW).map((x, i) => (
              <li key={i}>
                <button onClick={() => onGo(x.sheet, x.id)}>
                  <b>{scope === 'book' ? `${x.sheet}!${x.id}` : x.id}</b> {val(x.o)} → {val(x.n)}
                  <br /><small>{x.who ? `${x.who}, ` : ''}{when(x.t)}{x.more ? ` (și încă ${x.more} celule odată cu ea)` : ''}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {list.length > SHOW && <p className="print-info">{`Se văd primele ${SHOW}.`}</p>}
        <div className="print-actions">
          {!!log?.length && <button onClick={onClear} title="Șterge lista modificărilor din registru (celulele rămân cum sunt)">Golește lista</button>}
          <button onClick={onClose} autoFocus>Închide</button>
        </div>
      </div>
    </div>
  );
}
