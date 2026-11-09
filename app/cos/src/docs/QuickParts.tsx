// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul 🧩 din Docs: „Blocuri de text” (ca Quick Parts / AutoText): o bucată de document (o semnătură, un paragraf de
// încheiere, un tabel cu date de contact) se salvează cu un nume și se pune apoi oriunde, în orice document, cu un clic,
// sau scriind numele și apăsând F3. Blocurile stau în setările aplicației, deci sunt aceleași în toate documentele.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { api } from '../api';
import { DocBlock, blockFromSelection, blockPreview, findBlock } from './textBlocks';

export default function QuickParts({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [blocks, setBlocks] = useState<DocBlock[]>([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<DocBlock[]>([]);
  list.current = blocks;

  useEffect(() => { void api.getSettings().then((s) => setBlocks(Array.isArray(s.docBlocks) ? s.docBlocks : [])); }, []);
  const save = (next: DocBlock[]) => { setBlocks(next); void api.setSettings({ docBlocks: next }); };

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor.commands.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, editor]);

  // F3 după numele unui bloc (scris în text) îl înlocuiește cu blocul.
  useEffect(() => {
    const dom = editor.view.dom;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F3' || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      const { $from, empty } = editor.state.selection;
      if (!empty) return;
      const before = $from.parent.textBetween(0, $from.parentOffset, undefined, String.fromCharCode(0xfffc));
      const word = /(\S+)$/.exec(before)?.[1];
      const b = word ? findBlock(list.current, word) : null;
      if (!b || !word) return;
      e.preventDefault();
      editor.chain().focus().insertContentAt({ from: $from.pos - word.length, to: $from.pos }, b.content).run();
    };
    dom.addEventListener('keydown', onKey);
    return () => dom.removeEventListener('keydown', onKey);
  }, [editor]);

  const insert = (b: DocBlock) => {
    editor.chain().focus().insertContent(b.content).run();
    setOpen(false);
  };
  const add = () => {
    const b = blockFromSelection(editor.state, name);
    if (!b) { setMsg('Alege întâi în document textul de păstrat.'); return; }
    const rest = blocks.filter((x) => x.name.toLocaleLowerCase('ro') !== b.name.toLocaleLowerCase('ro'));
    save([...rest, b].sort((x, y) => x.name.localeCompare(y.name, 'ro')));
    setName('');
    setMsg(`Blocul „${b.name}” s-a salvat. Scrie „${b.name}” și apasă F3 ca să-l pui.`);
  };
  const remove = (b: DocBlock) => save(blocks.filter((x) => x !== b));
  const hasSel = !editor.state.selection.empty;

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()}
        onClick={() => { setMsg(''); setOpen(!open); }}
        title="Blocuri de text: păstrezi o bucată de document (semnătură, încheiere, date de contact) și o pui oricând; sau scrii numele blocului și apeși F3">🧩 Blocuri</button>
      {open && (
        <div className="sym-pop qp-pop" role="dialog" aria-label="Blocuri de text">
          <div className="sym-head">Blocuri de text</div>
          {blocks.length === 0 && <div className="qp-empty">Niciun bloc încă. Alege un text în document, dă-i un nume mai jos și apasă Salvează.</div>}
          {blocks.map((b) => (
            <div key={b.name} className="qp-row">
              <button className="date-row qp-ins" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(b)} title={`Pune blocul „${b.name}” la cursor (sau scrie ${b.name} și apasă F3)`}>
                <b>{b.name}</b> <span className="qp-prev">{blockPreview(b)}</span>
              </button>
              <button className="qp-del" onMouseDown={(e) => e.preventDefault()} onClick={() => remove(b)} title={`Șterge blocul „${b.name}”`} aria-label={`Șterge blocul ${b.name}`}>×</button>
            </div>
          ))}
          <div className="qp-new">
            <input value={name} placeholder={hasSel ? 'Numele blocului (de ex. semn)' : 'Alege întâi un text în document'} aria-label="Numele blocului"
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
            <button className="fmt" onMouseDown={(e) => e.preventDefault()} onClick={add} disabled={!hasSel} title="Păstrează textul ales ca bloc, cu numele scris">Salvează</button>
          </div>
          {msg && <div className="qp-msg" role="status">{msg}</div>}
        </div>
      )}
    </div>
  );
}
