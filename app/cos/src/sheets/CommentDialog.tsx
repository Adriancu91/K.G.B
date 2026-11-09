// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { useState } from 'react';
import { commentTime, MAX_COMMENT, type CellComment } from './comments';

// Fereastra comentariului cu fir de pe o celulă: discuția (autor, oră, text), răspuns nou, rezolvare, ștergere.
// Numele autorului e cel din panoul de comentarii din Docs (aceeași memorie locală), ca să fie unul singur în suită.
const AUTHOR_KEY = 'suite.docs.author';

function savedAuthor(): string {
  try { return localStorage.getItem(AUTHOR_KEY) ?? ''; } catch { return ''; }
}

export default function CommentDialog({ cell, thread, done, onSave, onClose }: {
  cell: string; thread: CellComment[]; done: boolean;
  /** Firul nou (gol = comentariul se șterge) și starea „rezolvat”. */
  onSave(th: CellComment[], done: boolean): void;
  onClose(): void;
}) {
  const [author, setAuthor] = useState(savedAuthor);
  const [text, setText] = useState('');
  const keepAuthor = () => { try { localStorage.setItem(AUTHOR_KEY, author.trim()); } catch { /* rămâne doar acum */ } };
  const post = () => {
    if (!text.trim()) return;
    keepAuthor();
    onSave([...thread, { a: author.trim(), t: new Date().toISOString(), x: text.replace(/\s+$/, '').slice(0, MAX_COMMENT) }], false);
    setText('');
  };
  const removeAt = (i: number) => onSave(i === 0 ? [] : thread.filter((_, k) => k !== i), done);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg list-dlg cmt-dlg"
        role="dialog"
        aria-label="Comentariu pe celulă"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          else if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); post(); }
        }}
      >
        <h3>Comentariu pe celula {cell}{done ? ' · ✓ Rezolvat' : ''}</h3>
        {thread.length ? (
          <div className="cmt-thread">
            {thread.map((c, i) => (
              <div key={i} className={'cmt-item' + (i ? ' cmt-reply' : '')}>
                <div className="cmt-head">
                  <b>{i ? '↩ ' : ''}{c.a || 'Autor'}</b>
                  <span className="cmt-time">{commentTime(c.t)}</span>
                  <button className="cmt-del" onClick={() => removeAt(i)} title={i ? 'Șterge răspunsul' : 'Șterge tot firul (comentariul și răspunsurile)'} aria-label={i ? 'Șterge răspunsul' : 'Șterge firul'}>✕</button>
                </div>
                <div className="cmt-text">{c.x}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="print-info">Comentariile sunt discuții: fiecare are autorul și ora, iar ceilalți pot răspunde. Celulele cu comentariu au un colț mov.</p>
        )}
        <label className="cmt-author">Numele tău: <input value={author} onChange={(e) => setAuthor(e.target.value)} onBlur={keepAuthor} placeholder="Autor" maxLength={80} /></label>
        <textarea
          autoFocus
          rows={4}
          maxLength={MAX_COMMENT}
          value={text}
          placeholder={thread.length ? 'Răspunde…' : 'De exemplu: poți verifica suma din martie?'}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="print-info">Ctrl+Enter trimite.</p>
        <div className="print-actions">
          {thread.length > 0 && <button onClick={() => onSave(thread, !done)} title={done ? 'Discuția se redeschide' : 'Discuția s-a încheiat: colțul celulei devine gri'}>{done ? 'Redeschide' : '✓ Rezolvă firul'}</button>}
          <button onClick={onClose}>Închide</button>
          <button className="primary" disabled={!text.trim()} onClick={post}>{thread.length ? 'Răspunde' : 'Comentează'}</button>
        </div>
      </div>
    </div>
  );
}
