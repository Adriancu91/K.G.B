// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul „Tabel de autorități” din Docs: marchează citarea aleasă (lege, hotărâre, carte…) pe categoria ei, o dată sau
// la toate aparițiile, și pune tabelul de autorități (toate categoriile sau una), cu paginile citărilor.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { AUTH_CATS, authHits, cleanCite } from './authorities';

export default function AuthPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState('');
  const [short, setShort] = useState('');
  const [cat, setCat] = useState(1);
  const [tableCat, setTableCat] = useState(0);
  const [passim, setPassim] = useState(true);
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
    const t = cleanCite(editor.state.doc.textBetween(from, to, ' '));
    setLong(t);
    setShort(cleanCite(t, 120));
    setMsg('');
    setOpen(true);
  };
  const picked = () => cleanCite(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' '), 120);
  const mark = (all: boolean) => {
    const before = authHits(editor.state.doc).length;
    const done = editor.chain().focus().markCitation(long, short, cat, all, short || picked()).run();
    const n = authHits(editor.state.doc).length - before;
    if (!done || !n) { setMsg(all ? 'Citarea nu mai apare nemarcată în document.' : 'Scrie citarea.'); return; }
    if (all) { setMsg(`Am marcat ${n} ${n === 1 ? 'loc' : 'locuri'}.`); return; }
    setOpen(false);
  };
  const ok = !!cleanCite(long);

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => (open ? setOpen(false) : show())}
        title="Tabel de autorități: marchezi legile, hotărârile și cărțile citate, apoi pui tabelul lor pe categorii, cu paginile">§ Tabel de autorități</button>
      {open && (
        <div className="sym-pop sign-pop" role="dialog" aria-label="Tabel de autorități">
          <div className="sym-head">Marcare citare</div>
          <label>Citarea întreagă <textarea rows={2} autoFocus value={long} onChange={(e) => setLong(e.target.value)} placeholder="de ex. Legea nr. 31/1990 privind societățile" aria-label="Citarea întreagă" /></label>
          <label>Citarea scurtă <input value={short} onChange={(e) => setShort(e.target.value)} placeholder="de ex. Legea nr. 31/1990" aria-label="Citarea scurtă"
            onKeyDown={(e) => { if (e.key === 'Enter' && ok) mark(false); }} /></label>
          <label>Categoria <select value={cat} onChange={(e) => setCat(Number(e.target.value))} aria-label="Categoria citării">
            {AUTH_CATS.map((c, i) => <option key={c} value={i + 1}>{c}</option>)}
          </select></label>
          <div className="doc-index-hint">Citarea întreagă apare în tabel; după cea scurtă se caută celelalte locuri la „Marchează toate”. Marcajele se văd doar cu ¶.</div>
          {msg && <div className="doc-index-hint" role="status">{msg}</div>}
          <div className="sign-actions">
            <button onClick={() => mark(true)} disabled={!ok}
              title="Marchează fiecare loc din document unde apare citarea scurtă">Marchează toate</button>
            <button className="primary" onClick={() => mark(false)} disabled={!ok}>Marchează</button>
          </div>
          <div className="sym-head">Inserare tabel de autorități</div>
          <label>Categoria <select value={tableCat} onChange={(e) => setTableCat(Number(e.target.value))} aria-label="Categoriile din tabel">
            <option value={0}>Toate</option>
            {AUTH_CATS.map((c, i) => <option key={c} value={i + 1}>{c}</option>)}
          </select></label>
          <label className="check"><input type="checkbox" checked={passim} onChange={(e) => setPassim(e.target.checked)} /> Folosește „passim” (citările de pe 5 pagini sau mai multe)</label>
          <div className="sign-actions">
            <button onClick={() => { editor.chain().focus().insertAuthorities(tableCat, passim).run(); setOpen(false); }}
              title="Tabelul citărilor marcate, pe categorii, în ordine alfabetică, cu paginile; se completează singur">☰ Inserează tabelul</button>
          </div>
        </div>
      )}
    </div>
  );
}
