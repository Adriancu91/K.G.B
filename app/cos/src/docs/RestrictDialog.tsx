// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// 🔐 Restricționează editarea: documentul devine doar de citit, doar de comentat sau se poate modifica doar cu urmărirea
// modificărilor (blocată). Parola e opțională; în document și în .docx se păstrează doar hash-ul ei (SHA-512, cu sare).
// Oprirea protecției cere parola, dacă a fost pusă.
import { useState } from 'react';
import { checkSheetPw, makeSheetPw, type SheetPw } from '../sheets/sheetPassword';

export type RestrictMode = 'read' | 'comments' | 'tracked';

const MODES: [RestrictMode, string, string][] = [
  ['read', 'Doar citire', 'nimeni nu poate schimba textul sau formatarea'],
  ['comments', 'Doar comentarii', 'se pot adăuga comentarii la text, dar textul nu se poate schimba'],
  ['tracked', 'Doar cu urmărirea modificărilor', 'orice schimbare se vede (verde / tăiat) și nu se poate accepta sau respinge până la oprirea protecției'],
];

export function RestrictDialog({ onApply, onClose }: { onApply(mode: RestrictMode, pw?: SheetPw): void; onClose(): void }) {
  const [mode, setMode] = useState<RestrictMode>('read');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const apply = async () => {
    if (pw !== pw2) { setErr('Parolele nu sunt la fel. Scrie aceeași parolă de două ori.'); return; }
    if (pw && mode === 'tracked') { setErr('La urmărirea modificărilor protecția merge fără parolă (lasă câmpurile goale).'); return; }
    setBusy(true);
    try { onApply(mode, pw ? await makeSheetPw(pw) : undefined); } finally { setBusy(false); }
  };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg" role="dialog" aria-label="Restricționează editarea" onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'Enter') { e.preventDefault(); void apply(); }
      }}>
        <h3>🔐 Restricționează editarea</h3>
        <p className="print-info">Ce se mai poate face în document după ce pornești protecția:</p>
        {MODES.map(([k, label, help]) => (
          <label className="print-row" key={k} title={help}>
            <input type="radio" name="restrict-mode" checked={mode === k} onChange={() => { setMode(k); setErr(''); }} /> <b>{label}</b>: {help}
          </label>
        ))}
        <div className="print-row">
          <span className="print-label">Parolă (opțional)</span>
          <input className="print-area page-hf-input" type="password" value={pw} autoFocus aria-label="Parola" disabled={mode === 'tracked'}
            onChange={(e) => { setPw(e.target.value); setErr(''); }} />
        </div>
        <div className="print-row">
          <span className="print-label">Parola, încă o dată</span>
          <input className="print-area page-hf-input" type="password" value={pw2} aria-label="Parola, încă o dată" disabled={mode === 'tracked'}
            onChange={(e) => { setPw2(e.target.value); setErr(''); }} />
        </div>
        {err && <p className="print-info" role="alert" style={{ color: 'var(--danger, #c0392b)' }}>{err}</p>}
        <p className="print-info">Protecția se păstrează în document și în fișierul .docx. Nu e o criptare: pentru ca nimeni să nu poată citi documentul, salvează-l ca .docx cu parolă.</p>
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" disabled={busy} onClick={() => void apply()}>Pornește protecția</button>
        </div>
      </div>
    </div>
  );
}

/** Oprirea protecției cu parolă: verifică parola față de hash-ul din document. */
export function UnrestrictDialog({ pw, onDone, onClose }: { pw: SheetPw; onDone(): void; onClose(): void }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const check = async () => {
    if (await checkSheetPw(text, pw)) onDone();
    else setErr('Parola nu e bună.');
  };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg" role="dialog" aria-label="Oprește protecția" onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'Enter') { e.preventDefault(); void check(); }
      }}>
        <h3>Oprește protecția</h3>
        <div className="print-row">
          <span className="print-label">Parola</span>
          <input className="print-area page-hf-input" type="password" value={text} autoFocus aria-label="Parola" onChange={(e) => { setText(e.target.value); setErr(''); }} />
        </div>
        {err && <p className="print-info" role="alert" style={{ color: 'var(--danger, #c0392b)' }}>{err}</p>}
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" onClick={() => void check()}>Oprește protecția</button>
        </div>
      </div>
    </div>
  );
}
