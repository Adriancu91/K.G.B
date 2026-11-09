// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul 🔖 din Docs: fereastra „Semn de carte”. Scrii un nume și Adaugă pune semnul unde e cursorul; din listă
// mergi la un semn, îl ștergi sau copiezi o legătură spre el (Legătură 🔗 → „Semn de carte”). Ascunsele (_Toc…) nu apar.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { bookmarkName, goToBookmark, isHiddenBookmark, listBookmarks, removeBookmark } from './bookmark';

export default function BookmarkPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [order, setOrder] = useState<'name' | 'pos'>('pos');
  const [, redraw] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor.commands.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, editor]);

  const all = open ? listBookmarks(editor.state.doc).filter((b) => !isHiddenBookmark(b.name)) : [];
  const shown = order === 'name' ? [...all].sort((a, b) => a.name.localeCompare(b.name, 'ro')) : all;
  const name = bookmarkName(raw);
  const exists = !!name && all.some((b) => b.name === name);

  const add = () => {
    if (!name) return;
    editor.chain().focus().setBookmark(name).run();
    setRaw('');
    setOpen(false);
  };

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)}
        title="Semn de carte: dă un nume locului în care e cursorul, ca să sari la el sau să faci o legătură spre el">🔖</button>
      {open && (
        <div className="sym-pop sign-pop bm-pop" role="dialog" aria-label="Semn de carte">
          <div className="sym-head">Semn de carte</div>
          <label>Nume <input autoFocus value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="de ex. Capitolul_2"
            aria-label="Numele semnului de carte" onKeyDown={(e) => { if (e.key === 'Enter') add(); }} /></label>
          <p className="bm-info">{raw && !name ? 'Numele începe cu o literă și are doar litere, cifre și „_” (cel mult 40).'
            : exists ? 'Există deja: Adaugă îl mută unde e cursorul.' : 'Se pune unde e cursorul și nu se tipărește.'}</p>
          {all.length > 0 && (
            <>
              <div className="bm-order">
                Ordine: <label><input type="radio" checked={order === 'pos'} onChange={() => setOrder('pos')} /> în document</label>
                <label><input type="radio" checked={order === 'name'} onChange={() => setOrder('name')} /> după nume</label>
              </div>
              <ul className="bm-list" aria-label="Semnele de carte din document">
                {shown.map((b) => (
                  <li key={b.name}>
                    <button className="bm-go" title="Mergi la el" onClick={() => { goToBookmark(editor, b.name); setOpen(false); }}>{b.name}</button>
                    <button className="bm-del" title="Șterge semnul (textul rămâne)" aria-label={`Șterge ${b.name}`}
                      onClick={() => { removeBookmark(editor, b.name); redraw((x) => x + 1); }}>✕</button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="sign-actions">
            <button onClick={() => setOpen(false)}>Închide</button>
            <button className="primary" disabled={!name} onClick={add}>Adaugă</button>
          </div>
        </div>
      )}
    </div>
  );
}
