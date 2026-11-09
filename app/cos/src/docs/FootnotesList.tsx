// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Lista notelor de subsol (sau, cu `end`, a notelor de final), sub document: aici se scrie textul fiecărei note.
// La tipărire și PDF apare la sfârșitul documentului; în Word notele de subsol stau jos pe pagină, iar cele de final la sfârșit.
import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { footnotePositions, listFootnotes } from './footnote';

export default function FootnotesList({ editor, end = false }: { editor: Editor; end?: boolean }) {
  const notes = listFootnotes(editor.state.doc, end);
  const cls = end ? '.doc-en' : '.doc-fn';
  const boxes = useRef<(HTMLTextAreaElement | null)[]>([]);
  const prevCount = useRef(notes.length);

  // Nota abia pusă primește cursorul, ca să-i scrii textul.
  useEffect(() => {
    if (notes.length > prevCount.current) {
      const at = editor.state.selection.from;
      const index = footnotePositions(editor.state.doc, end).filter((p) => p < at).length - 1;
      boxes.current[Math.max(0, index)]?.focus();
    }
    prevCount.current = notes.length;
  }, [notes.length, editor, end]);

  // Click pe numărul notei din text duce la textul ei.
  useEffect(() => {
    const dom = editor.view.dom;
    const onClick = (e: MouseEvent) => {
      const mark = (e.target as HTMLElement).closest?.(cls);
      if (!mark) return;
      const index = [...dom.querySelectorAll(cls)].indexOf(mark);
      boxes.current[index]?.focus();
    };
    dom.addEventListener('click', onClick);
    return () => dom.removeEventListener('click', onClick);
  }, [editor, cls]);

  if (!notes.length) return null;

  const backToText = (index: number) => {
    const pos = footnotePositions(editor.state.doc, end)[index];
    if (pos !== undefined) editor.chain().focus().setTextSelection(pos + 1).run();
  };

  const remove = (index: number) => {
    const pos = footnotePositions(editor.state.doc, end)[index];
    if (pos !== undefined) editor.chain().focus().deleteRange({ from: pos, to: pos + 1 }).run();
  };

  return (
    <div className="doc-footnotes" contentEditable={false}>
      <div className="doc-fn-title">{end ? 'Note de final' : 'Note de subsol'}</div>
      <ol type={end ? 'i' : '1'}>
        {notes.map((text, i) => (
          <li key={i}>
            <textarea
              ref={(el) => { boxes.current[i] = el; }}
              className="doc-fn-input"
              rows={Math.max(1, text.split(String.fromCharCode(10)).length)}
              value={text}
              placeholder="Scrie textul notei… (Enter: înapoi la text)"
              aria-label={`Textul notei ${i + 1}`}
              onChange={(e) => editor.commands.setFootnoteText(i, e.target.value, end)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Escape') { e.preventDefault(); backToText(i); }
              }}
            />
            <span className="doc-fn-print">{text}</span>
            <button className="fmt doc-fn-del" onClick={() => remove(i)} title="Șterge nota">✕</button>
          </li>
        ))}
      </ol>
    </div>
  );
}
