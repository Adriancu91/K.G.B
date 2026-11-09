// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul ⤷ din Docs: fereastra „Trimitere”. Alegi un titlu sau un semn de carte și ce să arate trimiterea (textul lui, numărul
// paginii, „mai sus / mai jos”); Inserează o pune la cursor ca legătură (Ctrl+clic duce acolo). „Actualizează toate” (F9) le rescrie.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { insertXref, updateXrefs, xrefTargets, XREF_KINDS, type XrefKind } from './crossRef';

export default function CrossRefPicker({ editor, pageH }: { editor: Editor; pageH: number }) {
  const [open, setOpen] = useState(false);
  const [what, setWhat] = useState<'heading' | 'bookmark' | 'caption'>('heading');
  const [kind, setKind] = useState<XrefKind>('text');
  const [pick, setPick] = useState(0);
  const [info, setInfo] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor.commands.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, editor]);

  const list = open ? xrefTargets(editor.state.doc).filter((t) => t.kind === what) : [];
  const insert = () => {
    const t = list[pick];
    if (!t) return;
    insertXref(editor, t, kind, pageH);
    setOpen(false);
  };
  const update = () => {
    const r = updateXrefs(editor, pageH);
    setInfo(`${r.changed ? `Am actualizat ${r.changed}.` : 'Toate sunt la zi.'}${r.broken ? ` ${r.broken} duc la un loc care nu mai există.` : ''}`);
  };

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { setInfo(''); setPick(0); setOpen(!open); }}
        title="Trimitere: „vezi capitolul…”, „vezi pagina…” spre un titlu sau un semn de carte; F9 le actualizează">⤷</button>
      {open && (
        <div className="sym-pop sign-pop bm-pop" role="dialog" aria-label="Trimitere">
          <div className="sym-head">Trimitere</div>
          <label>Spre <select value={what} onChange={(e) => { setWhat(e.target.value as 'heading' | 'bookmark' | 'caption'); setPick(0); }} aria-label="Spre ce">
            <option value="heading">un titlu</option>
            <option value="bookmark">un semn de carte</option>
            <option value="caption">o legendă (Figura, Tabelul)</option>
          </select></label>
          {list.length ? (
            <ul className="bm-list xref-list" role="listbox" aria-label="Locul">
              {list.map((t, i) => (
                <li key={t.pos}>
                  <button className={`bm-go ${i === pick ? 'on' : ''}`} role="option" aria-selected={i === pick}
                    style={t.level ? { paddingLeft: 6 + (t.level - 1) * 12 } : undefined}
                    onClick={() => setPick(i)} onDoubleClick={() => { setPick(i); insert(); }}>{t.label}</button>
                </li>
              ))}
            </ul>
          ) : <p className="bm-info">{what === 'heading' ? 'Documentul nu are titluri (Titlu 1, Titlu 2…).' : what === 'caption' ? 'Nu există legende (butonul Legendă).' : 'Nu există semne de carte (🔖).'}</p>}
          <label>Arată <select value={kind} onChange={(e) => setKind(e.target.value as XrefKind)} aria-label="Ce arată">
            {XREF_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></label>
          {info && <p className="bm-info" role="status">{info}</p>}
          <div className="sign-actions">
            <button onClick={update} title="Rescrie toate trimiterile din document (F9)">Actualizează toate</button>
            <button className="primary" disabled={!list.length} onClick={insert}>Inserează</button>
          </div>
        </div>
      )}
    </div>
  );
}
