// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Vizualizare → Macrocomenzi: fereastra de pornire a înregistrării (nume, referințe relative, descriere) și lista
// macrocomenzilor registrului (rulează, redenumește, șterge). Logica e în macros.ts.
import { useState } from 'react';
import { macroNameError, macroSize, type SheetMacro } from './macros';

export function MacroRecordDialog({ list, at, onStart, onClose }: {
  list: SheetMacro[];
  /** Celula de acum, de unde pornește înregistrarea. */
  at: string;
  onStart(name: string, rel: boolean, note: string, key: string, all: boolean): void;
  onClose(): void;
}) {
  let n = list.length + 1;
  while (list.some((m) => m.name === `Macrocomandă${n}`)) n++;
  const [name, setName] = useState(`Macrocomandă${n}`);
  const [rel, setRel] = useState(true);
  const [note, setNote] = useState('');
  const [key, setKey] = useState('');
  const [all, setAll] = useState(false);
  const [err, setErr] = useState('');
  const freeKeys = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter((k) => !list.some((m) => m.key === k));
  const start = () => {
    const e = macroNameError(name, list);
    if (e) { setErr(e); return; }
    onStart(name.trim(), rel, note, key, all);
  };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg macro-dlg" role="dialog" aria-label="Înregistrare macrocomandă" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); start(); } }}>
        <h3>Înregistrare macrocomandă</h3>
        <p className="print-info">{`Tot ce scrii și formatezi în foaie de acum se ține minte, până apeși ⏹ Oprește înregistrarea. Pornește din celula ${at}.`}</p>
        <label className="print-row">Nume: <input autoFocus value={name} aria-label="Numele macrocomenzii" maxLength={60} onChange={(e) => { setName(e.target.value); setErr(''); }} /></label>
        <label className="print-row rb-check" title="Bifat: pașii se repetă de la celula aleasă când rulezi (formulele se mută la fel ca la copiere). Nebifat: exact în aceleași celule.">
          <input type="checkbox" checked={rel} aria-label="Referințe relative" onChange={(e) => setRel(e.target.checked)} /> Referințe relative (pornește de la celula aleasă la rulare)</label>
        <label className="print-row" title="Macrocomanda pornește și cu tastele Ctrl+Shift+litera aleasă; are întâietate față de scurtătura obișnuită cu aceeași literă">Scurtătură: Ctrl+Shift+
          <select value={key} aria-label="Scurtătura macrocomenzii" onChange={(e) => setKey(e.target.value)}>
            <option value="">(fără)</option>
            {freeKeys.map((k) => <option key={k} value={k}>{k}</option>)}
          </select></label>
        <label className="print-row">Păstrează în:
          <select value={all ? 'all' : 'doc'} aria-label="Unde se păstrează macrocomanda" onChange={(e) => setAll(e.target.value === 'all')}>
            <option value="doc">Acest registru (în fișier)</option>
            <option value="all">Toate registrele (pe acest calculator)</option>
          </select></label>
        <label className="print-row">Descriere: <input value={note} aria-label="Descrierea macrocomenzii" maxLength={300} onChange={(e) => setNote(e.target.value)} /></label>
        {err && <p className="print-info links-warn" role="alert">{err}</p>}
        <div className="print-actions">
          <button className="primary" onClick={start}>⏺ Pornește înregistrarea</button>
          <button onClick={onClose}>Anulare</button>
        </div>
      </div>
    </div>
  );
}

export function MacroListDialog({ list, mine, at, onRun, onChange, onClose }: {
  /** Macrocomenzile registrului. */
  list: SheetMacro[];
  /** Macrocomenzile pentru toate registrele (păstrate pe acest calculator). */
  mine: SheetMacro[];
  at: string;
  onRun(m: SheetMacro): void;
  onChange(list: SheetMacro[], mine: SheetMacro[]): void;
  onClose(): void;
}) {
  const [sel, setSel] = useState(0);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const items = [...list.map((m) => ({ m, all: false })), ...mine.map((m) => ({ m, all: true }))];
  const all = items.map((x) => x.m);
  const emit = (next: typeof items) => onChange(next.filter((x) => !x.all).map((x) => x.m), next.filter((x) => x.all).map((x) => x.m));
  const i = Math.min(sel, items.length - 1);
  const cur = items[i]?.m;
  const rename = () => {
    if (renaming === null || !cur) return;
    const e = macroNameError(renaming, all, i);
    if (e) { setErr(e); return; }
    emit(items.map((x, k) => (k === i ? { ...x, m: { ...x.m, name: renaming.trim() } } : x)));
    setRenaming(null);
  };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg links-dlg macro-dlg" role="dialog" aria-label="Macrocomenzi" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); if (renaming !== null) setRenaming(null); else onClose(); } }}>
        <h3>Macrocomenzi</h3>
        {!items.length ? (
          <p className="print-info">Registrul nu are încă macrocomenzi. Apasă ⏺ Înregistrează macrocomandă, fă pașii în foaie, apoi ⏹ Oprește înregistrarea.</p>
        ) : (
          <>
            <p className="print-info">{`Rulează pornește de la celula ${at} (la cele cu referințe relative). Cele din „acest registru” se păstrează în fișier, cele din „toate registrele” pe acest calculator, pentru orice registru deschis.`}</p>
            <table className="links-table">
              <thead><tr><th>Nume</th><th>Pași</th><th>Celule</th><th>Referințe</th><th>Scurtătură</th><th>Unde</th><th>Descriere</th></tr></thead>
              <tbody>
                {items.map(({ m, all: a }, k) => (
                  <tr key={(a ? '*' : '') + m.name} className={k === i ? 'sel' : ''} onClick={() => { setSel(k); setRenaming(null); setErr(''); }} onDoubleClick={() => onRun(m)} aria-selected={k === i}>
                    <td>{m.name}</td><td>{m.steps.length}</td><td>{macroSize(m)}</td><td>{m.rel ? 'relative' : 'absolute'}</td><td>{m.key ? `Ctrl+Shift+${m.key}` : ''}</td><td>{a ? 'toate registrele' : 'acest registru'}</td><td>{m.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {renaming !== null && (
              <label className="print-row">Nume nou: <input autoFocus value={renaming} aria-label="Numele nou al macrocomenzii" maxLength={60}
                onChange={(e) => { setRenaming(e.target.value); setErr(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); rename(); } }} /></label>
            )}
            {err && <p className="print-info links-warn" role="alert">{err}</p>}
          </>
        )}
        <div className="print-actions">
          {cur && <button className="primary" onClick={() => onRun(cur)} title={`Repetă pașii macrocomenzii „${cur.name}” (Ctrl+Z îi anulează pe toți deodată)`}>▶ Rulează</button>}
          {cur && (renaming === null
            ? <button onClick={() => setRenaming(cur.name)}>✎ Redenumește</button>
            : <button onClick={rename}>✓ Salvează numele</button>)}
          {cur && <button onClick={() => emit(items.map((x, k) => (k === i ? { ...x, all: !x.all } : x)))}
            title={items[i].all ? 'Mută macrocomanda în fișierul acestui registru (nu mai apare în celelalte registre)' : 'Mută macrocomanda pe acest calculator, ca să meargă în orice registru deschis'}>{items[i].all ? '⇄ Mută în acest registru' : '⇄ Mută în toate registrele'}</button>}
          {cur && <button onClick={() => { emit(items.filter((_, k) => k !== i)); setRenaming(null); }} title={items[i].all ? `Șterge macrocomanda „${cur.name}” din toate registrele` : `Șterge macrocomanda „${cur.name}” (Ctrl+Z o aduce înapoi)`}>🗑 Șterge</button>}
          <button onClick={onClose}>Închide</button>
        </div>
      </div>
    </div>
  );
}
