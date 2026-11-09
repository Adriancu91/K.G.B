// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul „⚙ Câmp” din Docs (Inserare → Text): lista câmpurilor, cu valoarea de acum lângă fiecare, plus actualizarea lor (F9).
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { FIELD_KINDS, fieldPages, fieldValue, insertField, updateFields, type FieldCtx, type FieldKind } from './field';

export default function FieldPicker({ editor, ctx, pageH, onStatus }: { editor: Editor; ctx: Omit<FieldCtx, 'pageOf'>; pageH: number; onStatus?(s: string): void }) {
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

  const full = (): FieldCtx => ({ ...ctx, pageOf: fieldPages(editor, pageH) });
  const insert = (kind: FieldKind) => { insertField(editor, kind, full()); setOpen(false); };
  const update = () => {
    const n = updateFields(editor, full());
    onStatus?.(n ? `Câmpuri actualizate: ${n}` : 'Câmpurile sunt la zi');
    setOpen(false);
    editor.commands.focus();
  };
  const at = editor.state.selection.from;
  const preview = open ? full() : null;

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)}
        title="Câmp: data, autorul, titlul, numele fișierului, numărul paginii, al paginilor sau al cuvintelor, care se actualizează cu F9">⚙ Câmp</button>
      {open && preview && (
        <div className="sym-pop date-pop" role="dialog" aria-label="Câmp">
          <div className="sym-head">Câmp: alege ce arată</div>
          {FIELD_KINDS.map(([kind, name]) => (
            <button key={kind} className="date-row field-row" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(kind)}>
              <span>{name}</span><span className="field-val">{fieldValue(kind, editor.state.doc, at, preview) || '0'}</span>
            </button>
          ))}
          <button className="date-row field-update" onMouseDown={(e) => e.preventDefault()} onClick={update}
            title="Rescrie toate câmpurile din document cu valorile de acum">↻ Actualizează câmpurile (F9)</button>
        </div>
      )}
    </div>
  );
}
