// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Bara „Mergi la” (Ctrl+G): alegi felul (titlu, tabel, imagine, comentariu, notă) și sari la următorul, anteriorul sau la al N-lea.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { containingTarget, GO_KINDS, goTargets, stepTarget, type GoKind } from './goTo';
import { pagePositions } from './pageCount';

export default function GoToBar({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const [kind, setKind] = useState<GoKind>('page');
  const [num, setNum] = useState('');
  const [msg, setMsg] = useState('');
  const numRef = useRef<HTMLInputElement>(null);
  useEffect(() => { numRef.current?.focus(); }, []);

  const targets = kind === 'page' ? pagePositions(editor.view) : goTargets(editor.state.doc, kind);
  const name = GO_KINDS.find(([k]) => k === kind)![1].toLocaleLowerCase('ro-RO');
  const jump = (pos: number | null | undefined) => {
    if (pos === null || pos === undefined) { setMsg(`Documentul nu are niciun element de tip „${name}”.`); return; }
    const node = editor.state.doc.nodeAt(pos);
    // În titluri, text și tabele cursorul intră înăuntru (în tabel: în prima celulă); imaginile și notele se aleg întregi.
    const chain = editor.chain().focus();
    if (kind === 'page') chain.setTextSelection(TextSelection.near(editor.state.doc.resolve(pos)).from);
    else if (node?.isText) chain.setTextSelection(pos);
    else if (node?.isTextblock) chain.setTextSelection(pos + 1);
    else if (node?.type.name === 'table') chain.setTextSelection(TextSelection.near(editor.state.doc.resolve(pos + 1)).from);
    else chain.setNodeSelection(pos);
    chain.scrollIntoView().run();
    const i = targets.indexOf(pos);
    if (kind === 'page') {
      // Pagina sus pe ecran (nu doar „vizibilă”), ca la Word.
      try {
        let box: HTMLElement | null = editor.view.dom.parentElement;
        while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
        if (box) box.scrollTop += editor.view.coordsAtPos(pos).top - box.getBoundingClientRect().top - 40;
      } catch { /* poziția nu are coordonate */ }
    }
    setMsg(`${GO_KINDS.find(([k]) => k === kind)![1]} ${i + 1} din ${targets.length}`);
  };
  const go = () => {
    const n = parseInt(num, 10);
    if (!num.trim()) return jump(stepTarget(targets, editor.state.selection.from, 1));
    if (!(n >= 1 && n <= targets.length)) { setMsg(targets.length ? `Alege un număr de la 1 la ${targets.length}.` : `Documentul nu are niciun element de tip „${name}”.`); return; }
    jump(targets[n - 1]);
  };

  return (
    <div className="searchbar goto-bar" role="dialog" aria-label="Mergi la" onKeyDown={(e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); editor.commands.focus(); }
      else if (e.key === 'Enter') { e.preventDefault(); go(); }
    }}>
      <b>Mergi la</b>
      <select value={kind} onChange={(e) => { setKind(e.target.value as GoKind); setMsg(''); }} aria-label="Mergi la">
        {GO_KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      <input ref={numRef} type="number" min={1} value={num} onChange={(e) => setNum(e.target.value)} placeholder="numărul" aria-label="Numărul" style={{ width: 80 }} />
      <button onClick={go} title="Enter: la numărul scris, sau la următorul dacă nu scrii nimic">Mergi</button>
      <button onClick={() => { const from = editor.state.selection.from; jump(stepTarget(targets, containingTarget(editor.state.doc, targets, from) ?? from, -1)); }} title="Anteriorul">↑ Anterior</button>
      <button onClick={() => jump(stepTarget(targets, editor.state.selection.from, 1))} title="Următorul">↓ Următor</button>
      <span className="goto-msg" aria-live="polite">{msg || `${targets.length} în document`}</span>
      <button onClick={() => { onClose(); editor.commands.focus(); }} title="Închide (Esc)" aria-label="Închide">×</button>
    </div>
  );
}
