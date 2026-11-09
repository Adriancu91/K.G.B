// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul „Index” din Docs: marchează cuvântul ales ca intrare (o dată sau la toate aparițiile) și pune indexul alfabetic.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { cleanTerm, indexHits } from './indexEntry';

export default function IndexPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [sub, setSub] = useState('');
  const [msg, setMsg] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor.commands.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, editor]);

  const show = () => {
    const { from, to } = editor.state.selection;
    setTerm(cleanTerm(editor.state.doc.textBetween(from, to, ' ')));
    setSub('');
    setMsg('');
    setOpen(true);
  };
  const mark = (all: boolean) => {
    const before = indexHits(editor.state.doc).length;
    const done = editor.chain().focus().markIndexEntry(term, sub, all).run();
    const n = indexHits(editor.state.doc).length - before;
    if (!done || !n) { setMsg(all ? 'Textul ales nu apare în document.' : 'Scrie intrarea.'); return; }
    if (all) { setMsg(`Am marcat ${n} ${n === 1 ? 'loc' : 'locuri'}.`); return; }
    setOpen(false);
  };
  const ok = !!cleanTerm(term);

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => (open ? setOpen(false) : show())}
        title="Index alfabetic: marchezi cuvintele importante, apoi pui indexul (cu paginile lor) la sfârșitul documentului">Index</button>
      {open && (
        <div className="sym-pop sign-pop" role="dialog" aria-label="Index">
          <div className="sym-head">Marchează intrarea în index</div>
          <label>Intrare <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="de ex. contract" aria-label="Intrarea"
            onKeyDown={(e) => { if (e.key === 'Enter' && ok) mark(false); }} /></label>
          <label>Subintrare <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="opțional, de ex. reziliere" aria-label="Subintrarea"
            onKeyDown={(e) => { if (e.key === 'Enter' && ok) mark(false); }} /></label>
          <div className="doc-index-hint">Intrările nu se văd în text; le arată butonul ¶ (semnele de formatare).</div>
          {msg && <div className="doc-index-hint" role="status">{msg}</div>}
          <div className="sign-actions">
            <button onClick={() => { editor.chain().focus().insertIndex().run(); setOpen(false); }}
              title="Indexul alfabetic, cu literele și paginile; se completează singur">☰ Inserează indexul</button>
            <button onClick={() => mark(true)} disabled={!ok || editor.state.selection.empty}
              title="Marchează fiecare loc din document unde apare textul ales">Marchează toate</button>
            <button className="primary" onClick={() => mark(false)} disabled={!ok}>Marchează</button>
          </div>
        </div>
      )}
    </div>
  );
}
