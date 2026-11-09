// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Panoul „Sinonime” (Word: Revizuire → Dicționar de sinonime, Shift+F7): sensurile cuvântului de la cursor (sau al celui ales),
// cu sinonimele fiecăruia. Clic pe un sinonim îl pune în locul cuvântului, cu aceleași majuscule și aceeași formatare;
// clic pe numele unui sens îl caută pe acela. Caseta de sus caută orice alt cuvânt.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { matchCase, synonyms, wordAt } from '../thesaurus';

interface Word { text: string; from: number; to: number }

const OBJ = String.fromCharCode(65532);

/** Cuvântul de la cursor (sau textul ales, dacă e scurt și într-un singur paragraf), cu locul lui în document. */
export function wordAtCursor(editor: Editor, pos?: number): Word | null {
  const { state } = editor;
  const sel = state.selection;
  if (pos === undefined && !sel.empty && sel.$from.sameParent(sel.$to)) {
    const text = state.doc.textBetween(sel.from, sel.to);
    if (text.trim() && text.length <= 40 && /\p{L}/u.test(text)) {
      const lead = text.length - text.trimStart().length;
      return { text: text.trim(), from: sel.from + lead, to: sel.from + lead + text.trim().length };
    }
  }
  const $p = state.doc.resolve(pos ?? sel.from);
  if (!$p.parent.isTextblock) return null;
  const text = $p.parent.textBetween(0, $p.parent.content.size, undefined, OBJ);
  const r = wordAt(text, $p.parentOffset);
  if (!r) return null;
  const start = $p.start();
  return { text: text.slice(r[0], r[1]), from: start + r[0], to: start + r[1] };
}

/** Pune `repl` în locul cuvântului `w` (cu majusculele lui); întoarce noul cuvânt. */
export function replaceWord(editor: Editor, w: Word, repl: string): Word {
  const text = matchCase(w.text, repl);
  editor.view.dispatch(editor.state.tr.insertText(text, w.from, w.to).scrollIntoView());
  return { text, from: w.from, to: w.from + text.length };
}

export default function ThesaurusPane({ editor, readOnly, onClose }: { editor: Editor; readOnly?: boolean; onClose(): void }) {
  const [word, setWord] = useState<Word | null>(() => wordAtCursor(editor));
  const [query, setQuery] = useState(() => word?.text ?? '');
  const [history, setHistory] = useState<string[]>([]);
  // După o înlocuire făcută de panou lista rămâne aceeași, ca să poți încerca alt sinonim.
  const own = useRef(false);

  useEffect(() => {
    const onSel = () => {
      if (!editor.isFocused || own.current) return;
      const w = wordAtCursor(editor);
      if (!w) return;
      setWord(w);
      setQuery(w.text);
      setHistory([]);
    };
    editor.on('selectionUpdate', onSel);
    return () => { editor.off('selectionUpdate', onSel); };
  }, [editor]);

  const res = synonyms(query);
  const look = (w: string) => { setHistory((h) => [...h, query].slice(-20)); setQuery(w); };
  const put = (w: string) => {
    if (readOnly) return;
    const target = word && editor.state.doc.textBetween(word.from, Math.min(word.to, editor.state.doc.content.size)) === word.text ? word : wordAtCursor(editor);
    if (!target) { editor.chain().focus().insertContent(w).run(); return; }
    own.current = true;
    const nw = replaceWord(editor, target, w);
    setWord(nw);
    editor.commands.focus();
    window.setTimeout(() => { own.current = false; }, 0);
  };

  return (
    <aside className="doc-nav doc-thes" aria-label="Sinonime">
      <div className="doc-nav-head">
        <b>Sinonime</b>
        <button className="doc-nav-x" onClick={onClose} title="Închide panoul" aria-label="Închide panoul de sinonime">×</button>
      </div>
      <div className="doc-thes-search">
        <button disabled={!history.length} onClick={() => { setQuery(history[history.length - 1]); setHistory((h) => h.slice(0, -1)); }} title="Înapoi la cuvântul căutat înainte" aria-label="Înapoi">←</button>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caută un cuvânt" aria-label="Cuvântul căutat" spellCheck={false} />
      </div>
      {!query.trim() ? (
        <p className="doc-nav-empty">Pune cursorul pe un cuvânt din document sau scrie unul aici.</p>
      ) : res.groups.length === 0 ? (
        <p className="doc-nav-empty">Niciun sinonim pentru „{query.trim()}”. Încearcă forma de bază a cuvântului (de exemplu „casă” în loc de „casele”).</p>
      ) : (
        <ul className="doc-nav-list doc-thes-list">
          {res.base.toLocaleLowerCase('ro-RO') !== query.trim().toLocaleLowerCase('ro-RO') && <li className="doc-nav-empty">Forma de bază: <b>{res.base}</b></li>}
          {res.groups.map((g, i) => (
            <li key={i} className="doc-thes-group">
              <button className="doc-thes-sense" onClick={() => look(g.sense)} title={`Caută sinonimele lui „${g.sense}”`}>{g.sense}</button>
              <div>
                {g.words.map((w) => (
                  <button key={w} className="doc-thes-word" disabled={readOnly} onClick={() => put(w)}
                    title={readOnly ? w : `Pune „${matchCase(word?.text ?? query, w)}” în locul cuvântului`}>{w}</button>
                ))}
              </div>
            </li>
          ))}
          {word && !readOnly && <li className="doc-nav-empty">Clic pe un cuvânt îl pune în locul lui „{word.text}”.</li>}
        </ul>
      )}
    </aside>
  );
}
