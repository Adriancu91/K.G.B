// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Galeria Stiluri din Pornire (ca în procesorul de text cunoscut, Pornire → Stiluri): câteva stiluri la vedere, fiecare
// arătat cum arată („AaBbCc” cu fontul, mărimea și culoarea lui); clic pune stilul pe paragrafele selectate, stilul de la
// cursor e încadrat. ▾ deschide toate stilurile (și pe cele create de tine), plus panoul Stiluri.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { DocStyles } from './docStyles';
import { BLOCK_STYLES, applyBlock, currentBlock } from './paraStyle';
import { previewStyle } from './StylesPane';
import './styleGallery.css';

/** Stilurile la vedere în panglică, în ordinea cunoscută (Normal, Titlu 1, Titlu 2, Titlu, Subtitlu). */
export const GALLERY_STYLES = ['p', 'h1', 'h2', 'title', 'subtitle'];
const SHORT: Record<string, string> = { p: 'Normal', title: 'Titlu', h1: 'Titlu 1', h2: 'Titlu 2', h3: 'Titlu 3', subtitle: 'Subtitlu' };

export default function StyleGallery({ editor, styles, onPane }: { editor: Editor; styles?: DocStyles; onPane(): void }) {
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
  const cur = currentBlock(editor);
  const all: [string, string][] = [...BLOCK_STYLES, ...(styles?.custom ?? []).map((c): [string, string] => ['c:' + c.id, c.name])];
  const nameOf = (v: string) => SHORT[v] ?? all.find(([k]) => k === v)?.[1] ?? v;
  // `opt`: pe ecrane înguste (panglica „compactă”) se ascunde; rămâne în lista ▾.
  const tile = (v: string, label: string, opt = false) => {
    const st = previewStyle(v, styles);
    const fs = typeof st.fontSize === 'number' ? Math.min(st.fontSize, 17) : 13;
    return (
      <button key={v} className={`doc-style-tile${cur === v ? ' active' : ''}${opt ? ' rb-opt' : ''}`} data-style={v} aria-pressed={cur === v}
        onMouseDown={(e) => e.preventDefault()} onClick={() => { applyBlock(editor, v); setOpen(false); }}
        title={`Stilul „${label}”: clic îl pune pe paragrafele selectate`}>
        <span className="doc-style-prev" style={{ ...st, fontSize: fs }}>AaBbCc</span>
        <span className="doc-style-name">{label}</span>
      </button>
    );
  };
  return (
    <div className="doc-style-gallery sym-wrap" ref={box}>
      <div className="doc-style-strip" role="listbox" aria-label="Galeria de stiluri">
        {GALLERY_STYLES.map((v, i) => tile(v, nameOf(v), i >= 3))}
      </div>
      <button className={`doc-style-more${open ? ' active' : ''}`} data-keytip="L" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)}
        title="Stil paragraf" aria-label="Toate stilurile" aria-expanded={open}>▾</button>
      {open && (
        <div className="sym-pop doc-style-pop" role="dialog" aria-label="Toate stilurile">
          <div className="doc-style-grid">{all.map(([v, label]) => tile(v, label))}</div>
          <button className="doc-style-pane" onMouseDown={(e) => e.preventDefault()} onClick={() => { setOpen(false); onPane(); }}
            title="Panoul Stiluri: toate stilurile, seturi de stiluri, stil nou (Ctrl+Shift+Alt+S)">¶ Panoul Stiluri…</button>
        </div>
      )}
    </div>
  );
}
