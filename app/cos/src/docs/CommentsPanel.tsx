// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Panoul cu modificările urmărite și comentariile documentului, în dreapta paginii. Click pe o modificare sau pe un
// comentariu alege textul lui; „Răspunde” adaugă un răspuns sub comentariu (fir de discuție); „Rezolvă” îl marchează rezolvat (rămâne, cu tot firul, sub „Rezolvate”; se poate redeschide sau șterge). Numele autorului se ține minte pe acest calculator.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { DocComment } from './comment';
import { listChanges, nearChange, type DocChange } from './track';

interface Props {
  editor: Editor;
  comments: DocComment[];
  changes: DocChange[];
  activeId: string | null;
  focusId: string | null;
  author: string;
  setAuthor(a: string): void;
  onFocused(): void;
  onClose(): void;
  /** Urmărirea e blocată: modificările nu se pot accepta / respinge. */
  locked?: boolean;
}

export default function CommentsPanel({ editor, comments: all, changes, activeId, focusId, author, setAuthor, onFocused, onClose, locked }: Props) {
  // Rezolvatele stau ascunse până la „Arată rezolvatele”.
  const [showDone, setShowDone] = useState(false);
  const doneCount = all.filter((c) => c.done).length;
  const comments = showDone ? all : all.filter((c) => !c.done);
  const refs = useRef(new Map<string, HTMLTextAreaElement>());
  // Răspunsul nou primește cursorul după ce apare în panou (cheia: id#număr).
  const [replyFocus, setReplyFocus] = useState<string | null>(null);
  useEffect(() => {
    if (!replyFocus) return;
    const el = refs.current.get(replyFocus);
    if (el) { el.focus(); setReplyFocus(null); }
  });

  useEffect(() => {
    if (!focusId) return;
    refs.current.get(focusId)?.focus();
    onFocused();
  }, [focusId, onFocused]);

  useEffect(() => {
    if (activeId) refs.current.get(activeId)?.closest('.doc-cmt')?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const select = (c: DocComment) => {
    editor.chain().setTextSelection({ from: c.from, to: c.to }).scrollIntoView().run();
  };

  // Salt la modificarea următoare / anterioară; după acceptare sau respingere, la următoarea (ca în Word).
  const goChange = (dir: 1 | -1) => {
    const c = nearChange(changes, editor.state.selection.from, dir);
    if (c) editor.chain().focus().setTextSelection({ from: c.from, to: c.to }).scrollIntoView().run();
  };
  const decide = (c: DocChange, accept: boolean) => {
    const chain = editor.chain().focus();
    (accept ? chain.acceptChange(c.from, c.to, c.kind) : chain.rejectChange(c.from, c.to, c.kind)).run();
    const left = listChanges(editor.state.doc);
    const pos = editor.state.selection.from;
    const next = left.find((x) => x.from >= Math.min(pos, c.from));
    if (next) editor.chain().setTextSelection({ from: next.from, to: next.to }).scrollIntoView().run();
  };

  const when = (d: string) => (d ? new Date(d).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

  return (
    <aside className="doc-comments" aria-label="Comentarii și modificări">
      <div className="doc-comments-head">
        <b>{changes.length ? `Modificări (${changes.length}) · ` : ''}Comentarii ({all.length - doneCount})</b>
        <button className="fmt" onClick={onClose} title="Ascunde panoul (comentariile și modificările rămân în document)">✕</button>
      </div>
      {doneCount > 0 && <label className="doc-cmt-author"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Arată rezolvatele ({doneCount})</label>}
      <label className="doc-cmt-author">Numele tău: <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Autor" /></label>
      {changes.length > 0 && (
        <>
          <div className="doc-chg-all">
            <button disabled={locked} onClick={() => editor.chain().focus().acceptAllChanges().run()} title={locked ? 'Urmărirea e blocată (🔒): deblocheaz-o ca să accepți' : 'Toate modificările devin text obișnuit'}>✓ Acceptă tot</button>
            <button disabled={locked} onClick={() => editor.chain().focus().rejectAllChanges().run()} title={locked ? 'Urmărirea e blocată (🔒): deblocheaz-o ca să respingi' : 'Documentul revine cum era înainte de modificări'}>✕ Respinge tot</button>
          </div>
          <div className="doc-chg-all">
            <button onClick={() => goChange(-1)} title="Alege modificarea dinaintea cursorului">◀ Anterioara</button>
            <button onClick={() => goChange(1)} title="Alege modificarea de după cursor">Următoarea ▶</button>
          </div>
          {changes.map((c) => (
            <div key={`${c.kind}${c.from}`} className={`doc-cmt doc-chg ${c.kind}`} onMouseDown={(e) => {
              if ((e.target as HTMLElement).closest('button')) return;
              e.preventDefault();
              editor.chain().focus().setTextSelection({ from: c.from, to: c.to }).scrollIntoView().run();
            }}>
              <div className="doc-cmt-meta">
                <b>{c.author || 'Autor'} {c.kind === 'insertion' ? 'a adăugat' : c.kind === 'format' ? 'a formatat' : c.kind === 'paragraph' ? 'a formatat paragraful' : 'a șters'}</b>
                <span>{when(c.date)}</span>
              </div>
              <div className="doc-cmt-quote">„{c.text.length > 60 ? c.text.slice(0, 60) + '…' : c.text}”</div>
              {c.parts && <div className="doc-chg-desc"><span>Format:</span> {c.parts.map((p, i) => <span key={i}>{i > 0 && ', '}<span>{p.not ? `fără ${p.label}` : p.label}</span></span>)}</div>}
              <div className="doc-cmt-actions">
                <button disabled={locked} onClick={() => decide(c, true)} title="Acceptă modificarea și treci la următoarea">✓ Acceptă</button>
                <button disabled={locked} onClick={() => decide(c, false)} title="Respinge modificarea și treci la următoarea">✕ Respinge</button>
              </div>
            </div>
          ))}
        </>
      )}
      {!all.length && !changes.length && <p className="muted">Alege un text și apasă 💬 ca să-i pui un comentariu.</p>}
      {comments.map((c) => (
        <div key={c.id} className={`doc-cmt ${c.id === activeId ? 'active' : ''} ${c.done ? 'done' : ''}`} onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('textarea, button')) return;
          e.preventDefault();
          select(c);
        }}>
          <div className="doc-cmt-meta">
            <b>{c.author || 'Autor'}</b>
            <span>{when(c.date)}</span>
          </div>
          <div className="doc-cmt-quote">„{c.quote.length > 60 ? c.quote.slice(0, 60) + '…' : c.quote}”</div>
          <textarea
            ref={(el) => { if (el) refs.current.set(c.id, el); else refs.current.delete(c.id); }}
            value={c.text}
            rows={2}
            placeholder="Scrie comentariul…"
            onFocus={() => select(c)}
            onChange={(e) => editor.commands.updateComment(c.id, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); editor.commands.focus(); } }}
          />
          {c.replies.map((r, i) => (
            <div key={i} className="doc-cmt-reply">
              <div className="doc-cmt-meta">
                <b>↩ {r.author || 'Autor'}</b>
                <span>{when(r.date)}</span>
                <button className="fmt" onClick={() => editor.commands.removeReply(c.id, i)} title="Șterge răspunsul" aria-label="Șterge răspunsul">✕</button>
              </div>
              <textarea
                ref={(el) => { const k = `${c.id}#${i}`; if (el) refs.current.set(k, el); else refs.current.delete(k); }}
                value={r.text}
                rows={1}
                aria-label="Răspuns"
                placeholder="Scrie răspunsul…"
                onFocus={() => select(c)}
                onChange={(e) => editor.commands.updateReply(c.id, i, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); editor.commands.focus(); } }}
              />
            </div>
          ))}
          <div className="doc-cmt-actions">
            <button onClick={() => { editor.commands.addReply(c.id, author); setReplyFocus(`${c.id}#${c.replies.length}`); }} title="Răspunde la comentariu: răspunsul apare dedesubt, cu numele tău și data">↩ Răspunde</button>
            {c.done
              ? <button onClick={() => editor.chain().focus().setCommentDone(c.id, false).run()} title="Comentariul devine din nou deschis (textul se colorează iar)">↺ Redeschide</button>
              : <button onClick={() => editor.chain().focus().setCommentDone(c.id, true).run()} title="Marchează comentariul rezolvat: rămâne în document, cu răspunsurile, dar nu mai colorează textul (în .docx apare ca rezolvat)">✓ Rezolvă</button>}
            <button onClick={() => editor.chain().focus().removeComment(c.id).run()} title="Șterge comentariul și răspunsurile lui (textul rămâne)" aria-label="Șterge comentariul">🗑</button>
          </div>
        </div>
      ))}
    </aside>
  );
}
