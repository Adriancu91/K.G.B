// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul ▾ de lângă liste: alegi bulina (•, ◦, ▪, ✓, –, ➢) sau felul numerotării (1., 1), a., A., i., I.).
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { applyListStyle, BULLET_STYLES, currentListStyle, NUMBER_STYLES } from './listStyle';

export default function ListStylePicker({ editor, keytip }: { editor: Editor; keytip?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor.commands.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, editor]);

  const bullet = currentListStyle(editor, 'bulletList');
  const number = currentListStyle(editor, 'orderedList');
  const pick = (kind: 'bulletList' | 'orderedList', style: string) => { applyListStyle(editor, kind, style); setOpen(false); };

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} data-keytip={keytip} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)}
        title="Felul bulinelor și al numerotării" aria-label="Felul bulinelor și al numerotării">▾</button>
      {open && (
        <div className="sym-pop list-style-pop" role="dialog" aria-label="Buline și numerotare">
          <div className="sym-head">Buline</div>
          <div className="list-style-grid">
            {BULLET_STYLES.map(([s, sym, name]) => (
              <button key={s} className={bullet === s ? 'on' : ''} title={name} aria-label={`Buline: ${name}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick('bulletList', s)}>
                <span className="ls-sym">{sym}</span><span className="ls-lines" />
              </button>
            ))}
          </div>
          <div className="sym-head">Numerotare</div>
          <div className="list-style-grid">
            {NUMBER_STYLES.map(([s, sample, name]) => (
              <button key={s} className={number === s ? 'on' : ''} title={name} aria-label={`Numerotare: ${name}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick('orderedList', s)}>
                {sample}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
