// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul „Legendă” din Docs: eticheta (Figura, Tabelul, Ecuația), textul și locul (sub / deasupra pozei sau tabelului
// în care e cursorul). Numărul se pune și se renumerotează singur.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { CAPTION_LABELS, insertCaption } from './caption';

const KEY = 'suite.docs.legenda';

export default function CaptionPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('Figura');
  const [text, setText] = useState('');
  const [where, setWhere] = useState<'below' | 'above'>('below');
  const box = useRef<HTMLDivElement>(null);
  const inTable = useRef(false);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor.commands.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, editor]);

  const show = () => {
    let last: { label?: string } = {};
    try { last = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { /* */ }
    // În tabel, legenda stă de obicei deasupra; la poze, dedesubt.
    inTable.current = editor.isActive('table');
    setLabel(inTable.current ? 'Tabelul' : last.label && CAPTION_LABELS.includes(last.label) ? last.label : 'Figura');
    setWhere(inTable.current ? 'above' : 'below');
    setText('');
    setOpen(true);
  };
  const insert = () => {
    insertCaption(editor, label, text, where);
    // Ținem minte doar eticheta aleasă în afara tabelelor (acolo e mereu Tabelul).
    if (!inTable.current) try { localStorage.setItem(KEY, JSON.stringify({ label })); } catch { /* */ }
    setOpen(false);
  };

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => (open ? setOpen(false) : show())}
        title="Legendă: „Figura 1: …”, „Tabelul 1: …” sub sau deasupra pozei / tabelului; numerele se pun singure">Legendă</button>
      {open && (
        <div className="sym-pop sign-pop" role="dialog" aria-label="Legendă">
          <div className="sym-head">Inserează legendă</div>
          <label>Eticheta <select value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Eticheta">
            {CAPTION_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select></label>
          <label>Text <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="de ex. Vânzări pe luni (opțional)"
            aria-label="Textul legendei" onKeyDown={(e) => { if (e.key === 'Enter') insert(); }} /></label>
          <label>Locul <select value={where} onChange={(e) => setWhere(e.target.value as 'below' | 'above')} aria-label="Locul">
            <option value="below">sub elementul cu cursorul</option>
            <option value="above">deasupra lui</option>
          </select></label>
          <div className="sign-actions">
            <button onClick={() => setOpen(false)}>Renunță</button>
            <button onClick={() => { editor.chain().focus().insertTableOfFigures(label).run(); setOpen(false); }}
              title="Lista legendelor cu această etichetă, ca un cuprins (se completează singură)">☰ Lista lor</button>
            <button className="primary" onClick={insert}>Inserează</button>
          </div>
        </div>
      )}
    </div>
  );
}
