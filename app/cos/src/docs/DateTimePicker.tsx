// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul 📅 din Docs: fereastra „Dată și oră” (ca în Word), cu exemplele scrise cu data de acum.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { DATE_FORMATS, lastDateFormat, rememberDateFormat } from './dateTime';

export default function DateTimePicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor.commands.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, editor]);

  const insert = (id: string) => {
    const f = DATE_FORMATS.find(([x]) => x === id)!;
    editor.chain().focus().insertContent(f[1](new Date())).run();
    rememberDateFormat(id);
    setOpen(false);
  };
  const last = lastDateFormat();

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()}
        onClick={() => { setNow(new Date()); setOpen(!open); }}
        title="Inserează data și ora (Alt+Shift+D: data, Alt+Shift+T: ora)">📅</button>
      {open && (
        <div className="sym-pop date-pop" role="dialog" aria-label="Dată și oră">
          <div className="sym-head">Dată și oră: alege cum se scrie</div>
          {DATE_FORMATS.map(([id, fmt]) => (
            <button key={id} className={`date-row ${id === last ? 'on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(id)}
              title={id === last ? 'Formatul folosit de Alt+Shift+D' : undefined}>{fmt(now)}</button>
          ))}
        </div>
      )}
    </div>
  );
}
