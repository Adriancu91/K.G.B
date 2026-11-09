// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fișier → Proprietăți… în Sheets: titlul registrului, subiectul, autorul și cuvintele cheie, cu numărul de foi și de celule.
// Se păstrează în fișierul Suite și în .xlsx (docProps/core.xml), de unde se și citesc înapoi.
// Slides o folosește și ea, cu alt titlu și alt rând de informații (`heading`, `info`) și căsuța pentru clasificarea în subsol (`mark`).
import { useState } from 'react';
import { DOC_PROPS, type DocProps } from '../docs/format';
import { LabelRow } from '../docs/LabelRow';

export default function PropsDialog({ value, stats, heading, info, mark, onSave, onClose }: {
  value: DocProps; stats?: { sheets: number; cells: number }; heading?: string; info?: string;
  /** Căsuța „scrie clasificarea în subsol”: dacă e bifată acum și textul ei. */
  mark?: { on: boolean; text: string; hint: string };
  onSave(p: DocProps, markOn: boolean): void; onClose(): void;
}) {
  const [p, setP] = useState<DocProps>(value);
  const [markOn, setMarkOn] = useState(!!mark?.on);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg" role="dialog" aria-label="Proprietăți" onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement && e.target.type === 'checkbox')) { e.preventDefault(); onSave(p, markOn); }
      }}>
        <h3>{heading ?? 'Proprietățile tabelului'}</h3>
        {DOC_PROPS.map(([k, label], i) => (
          <div className="print-row" key={k}>
            <span className="print-label">{label}</span>
            <input className="print-area" autoFocus={i === 0} value={p[k] ?? ''} maxLength={200} aria-label={label}
              onChange={(e) => setP({ ...p, [k]: e.target.value })}
              placeholder={k === 'keywords' ? 'de exemplu: buget, 2026, firmă' : k === 'author' ? 'numele tău' : ''} />
          </div>
        ))}
        <LabelRow value={p.label} onChange={(label) => setP({ ...p, label })} />
        {mark && p.label && (
          <label className="print-row" title={mark.hint}>
            <input type="checkbox" data-label-mark="footer" checked={markOn} onChange={(e) => setMarkOn(e.target.checked)} /> {mark.text}
          </label>
        )}
        <p className="print-info">{info ?? (stats && <>{stats.sheets} {stats.sheets === 1 ? 'foaie' : 'foi'}, {stats.cells.toLocaleString('ro-RO')} celule completate. Proprietățile se salvează în tabel și în fișierul .xlsx exportat.</>)}</p>
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" onClick={() => onSave(p, markOn)}>Gata</button>
        </div>
      </div>
    </div>
  );
}
