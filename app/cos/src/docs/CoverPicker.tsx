// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul „▣ Gardă” din Docs: alegi un model de pagină de gardă și el se pune la începutul documentului, urmat de o pagină nouă.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { COVER_TITLE, COVERS, coverContent, coverText, type CoverKind } from './coverPage';

export default function CoverPicker({ editor, title, author }: { editor: Editor; title?: string; author?: string }) {
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

  const insert = (kind: CoverKind) => {
    let heading: string | null = title ?? null;
    if (!heading) editor.state.doc.descendants((n) => { if (!heading && n.type.name === 'heading' && n.textContent.trim()) heading = n.textContent; return !heading; });
    // Titlul paginii de gardă se selectează, ca să-l poți rescrie direct.
    const content = coverContent(kind, coverText(heading, author ?? null));
    editor.chain().focus().insertContentAt(0, content).run();
    const t = COVER_TITLE[kind];
    let at = -1, i = 0;
    editor.state.doc.forEach((_n, pos) => { if (i++ === t) at = pos; });
    const node = at >= 0 ? editor.state.doc.nodeAt(at) : null;
    if (node?.isTextblock) editor.commands.setTextSelection({ from: at + 1, to: at + 1 + node.content.size });
    setOpen(false);
  };

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)}
        title="Pagină de gardă: o primă pagină cu titlul, subtitlul, autorul și data, aleasă dintr-un model">▣ Copertă</button>
      {open && (
        <div className="sym-pop date-pop" role="dialog" aria-label="Pagină de gardă">
          <div className="sym-head">Pagină de gardă: alege modelul</div>
          {COVERS.map(([id, name, tip]) => (
            <button key={id} className="date-row" title={tip} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(id)}>{name}</button>
          ))}
        </div>
      )}
    </div>
  );
}
